import { Request, Response, Router } from "express";
import { HTTP_STATUS } from "../constants/http-status";
import { logger } from "../logger";
import { renderBlueprintProofReel } from "../utils/creative-execution";
import { buildCreativeCampaignKit } from "../utils/creative-pipeline";
import {
  classifyGoogleCreativeFailure,
  getGoogleCreativeStatus,
} from "../utils/provider-status";
import { hasAnyRole, resolveAccessContext } from "../utils/access-control";
import { getRunwayTask, startRunwayImageToVideoTask } from "../utils/runway";
import { generateGoogleCreativeImages } from "../utils/google-creative";

const router = Router();

async function requireOps(_req: Request, res: Response, next: () => void) {
  const user = res.locals.firebaseUser;

  if (!user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  if (!(await hasAnyRole(res, ["admin", "ops"]))) {
    return res.status(403).json({ error: "Ops access required" });
  }

  next();
}

async function operatorEmail(res: Response) {
  const access = await resolveAccessContext(res);
  return access.email || "ops@tryblueprint.io";
}

router.post("/campaign-kit", requireOps, async (req, res) => {
  try {
    const skuName = typeof req.body?.skuName === "string" ? req.body.skuName.trim() : "";
    const audience = typeof req.body?.audience === "string" ? req.body.audience.trim() : "";
    const siteType = typeof req.body?.siteType === "string" ? req.body.siteType.trim() : "";
    const workflow = typeof req.body?.workflow === "string" ? req.body.workflow.trim() : "";
    const callToAction =
      typeof req.body?.callToAction === "string" ? req.body.callToAction.trim() : "";
    const assetGoal =
      typeof req.body?.assetGoal === "string" ? req.body.assetGoal.trim() : "landing_page";

    if (!skuName || !audience || !siteType || !workflow || !callToAction) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        ok: false,
        error: "skuName, audience, siteType, workflow, and callToAction are required",
      });
    }

    const kit = buildCreativeCampaignKit({
      skuName,
      audience,
      siteType,
      workflow,
      callToAction,
      assetGoal:
        assetGoal === "email_campaign"
        || assetGoal === "outbound_sequence"
        || assetGoal === "social_cutdown"
        || assetGoal === "proof_reel"
          ? assetGoal
          : "landing_page",
      proofPoints: Array.isArray(req.body?.proofPoints)
        ? req.body.proofPoints.filter((value: unknown): value is string => typeof value === "string")
        : [],
      differentiators: Array.isArray(req.body?.differentiators)
        ? req.body.differentiators.filter((value: unknown): value is string => typeof value === "string")
        : [],
    });

    return res.status(HTTP_STATUS.OK).json({ ok: true, kit });
  } catch (error) {
    logger.error({ err: error }, "Failed to build creative campaign kit");
    return res
      .status(500)
      .json({ ok: false, error: "Failed to build creative campaign kit" });
  }
});

router.post("/generate-image", requireOps, async (req, res) => {
  try {
    const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";
    if (!prompt) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        ok: false,
        error: "Prompt is required",
        providerStatus: getGoogleCreativeStatus(),
      });
    }

    return res.status(HTTP_STATUS.OK).json(
      await generateGoogleCreativeImages({
        prompt,
        aspectRatio:
          typeof req.body?.aspectRatio === "string" ? req.body.aspectRatio : null,
        imageSize:
          typeof req.body?.imageSize === "string" ? req.body.imageSize : null,
        thinkingLevel:
          typeof req.body?.thinkingLevel === "string" ? req.body.thinkingLevel : null,
        personGeneration:
          typeof req.body?.personGeneration === "string" ? req.body.personGeneration : null,
        sampleCount: Number(req.body?.sampleCount || 1),
      }),
    );
  } catch (error) {
    logger.error({ err: error }, "Failed to generate creative image");
    const message = error instanceof Error ? error.message : "Failed to generate image";
    const statusCode =
      typeof (error as { statusCode?: unknown })?.statusCode === "number"
        ? Number((error as { statusCode?: number }).statusCode)
        : 500;
    const providerStatus =
      (error as { providerStatus?: unknown })?.providerStatus &&
      typeof (error as { providerStatus?: unknown }).providerStatus === "object"
        ? (error as { providerStatus: unknown }).providerStatus
        : classifyGoogleCreativeFailure(statusCode, message);
    return res
      .status(statusCode)
      .json({
        ok: false,
        error: message,
        providerStatus,
      });
  }
});

router.post("/generate-video", requireOps, async (req, res) => {
  try {
    const promptText =
      typeof req.body?.promptText === "string" ? req.body.promptText.trim() : "";
    if (!promptText) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        ok: false,
        error: "promptText is required",
      });
    }

    const task = await startRunwayImageToVideoTask({
      promptText,
      promptImage:
        typeof req.body?.promptImage === "string" ? req.body.promptImage : null,
      model: typeof req.body?.model === "string" ? req.body.model : null,
      ratio: typeof req.body?.ratio === "string" ? req.body.ratio : null,
      duration:
        typeof req.body?.duration === "number"
          ? req.body.duration
          : Number(req.body?.duration || 5),
      seed:
        typeof req.body?.seed === "number"
          ? req.body.seed
          : Number.isFinite(Number(req.body?.seed))
            ? Number(req.body.seed)
            : null,
    });

    return res.status(HTTP_STATUS.OK).json({
      ok: true,
      task,
      requestedBy: await operatorEmail(res),
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to start Runway video generation");
    return res.status(500).json({
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to start video generation",
    });
  }
});

router.get("/video-tasks/:taskId", requireOps, async (req, res) => {
  try {
    const taskId = typeof req.params.taskId === "string" ? req.params.taskId.trim() : "";
    if (!taskId) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        ok: false,
        error: "taskId is required",
      });
    }

    const task = await getRunwayTask(taskId);
    return res.status(HTTP_STATUS.OK).json({ ok: true, task });
  } catch (error) {
    logger.error({ err: error }, "Failed to fetch Runway task status");
    return res.status(500).json({
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch video task status",
    });
  }
});

router.post("/render-proof-reel", requireOps, async (_req, res) => {
  try {
    const { stdout, stderr, outputPath } = await renderBlueprintProofReel();

    return res.status(HTTP_STATUS.OK).json({
      ok: true,
      outputPath,
      stdout,
      stderr,
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to render proof reel");
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Failed to render proof reel",
    });
  }
});

export default router;
