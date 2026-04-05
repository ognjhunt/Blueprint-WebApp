import { Request, Response, Router } from "express";
import { getConfiguredEnvValue } from "../config/env";
import { hasAnyRole, resolveAccessContext } from "../utils/access-control";
import { dbAdmin as db, storageAdmin } from "../../client/src/lib/firebaseAdmin";
import {
  createGrowthCampaignDraft,
  ingestSendGridWebhook,
  listGrowthCampaigns,
  queueGrowthCampaignSend,
  runBuyerLifecycleCheck,
  verifyGrowthIntegrations,
} from "../utils/growth-ops";
import { logger } from "../logger";
import { runExperimentAutorollout } from "../utils/experiment-ops";
import { runCreativeAssetFactoryLoop } from "../utils/creative-factory";
import { runAutonomousResearchOutboundLoop } from "../utils/autonomous-growth";
import { syncGrowthStudioToNotion } from "../utils/notion-sync";
import {
  createContentOutcomeReview,
  listContentOutcomeReviews,
  normalizeContentOutcomeReviewInput,
  summarizeRecentContentOutcomeReviews,
} from "../utils/content-ops";
import { parseGsUri } from "../utils/pipeline-dashboard";

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

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function maybeCreateSignedStorageUrl(uri: string | null) {
  if (!uri || !storageAdmin) {
    return null;
  }

  try {
    const { bucket, objectPath } = parseGsUri(uri);
    const [signedUrl] = await storageAdmin.bucket(bucket).file(objectPath).getSignedUrl({
      action: "read",
      expires: Date.now() + 60 * 60 * 1000,
    });
    return signedUrl;
  } catch {
    return null;
  }
}

router.get("/campaigns", requireOps, async (_req, res) => {
  try {
    return res.json(await listGrowthCampaigns());
  } catch (error) {
    logger.error({ err: error }, "Failed to list growth campaigns");
    return res.status(500).json({ error: "Failed to list growth campaigns" });
  }
});

router.get("/creative-runs", requireOps, async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: "Database not available" });
    }

    const limit = Math.min(
      Math.max(parseInt(typeof req.query.limit === "string" ? req.query.limit : "10", 10) || 10, 1),
      25,
    );

    const snapshot = await db
      .collection("creative_factory_runs")
      .orderBy("created_at", "desc")
      .limit(limit)
      .get();

    const items = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const data = doc.data() as Record<string, unknown>;
        const remotionReel =
          data.remotion_reel && typeof data.remotion_reel === "object"
            ? (data.remotion_reel as Record<string, unknown>)
            : {};
        const imageBatch = Array.isArray(data.image_batch) ? data.image_batch : [];
        const storageUri = normalizeString(remotionReel.storage_uri) || null;

        return {
          id: doc.id,
          status: normalizeString(data.status) || "unknown",
          skuName: normalizeString(data.sku_name) || "Unknown SKU",
          researchTopic: normalizeString(data.research_topic) || null,
          rolloutVariant: normalizeString(data.rollout_variant) || null,
          createdAt: normalizeString(data.created_at_iso) || null,
          generatedImages: imageBatch.length,
          buyerObjections: Array.isArray(data.buyer_objections)
            ? data.buyer_objections.filter((value): value is string => typeof value === "string")
            : [],
          remotionReel: {
            status: normalizeString(remotionReel.status) || null,
            outputPath: normalizeString(remotionReel.output_path) || null,
            storageUri,
            signedUrl: await maybeCreateSignedStorageUrl(storageUri),
            durationSeconds:
              typeof remotionReel.duration_seconds === "number"
                ? remotionReel.duration_seconds
                : null,
            frames:
              typeof remotionReel.frames === "number" ? remotionReel.frames : null,
            error: normalizeString(remotionReel.error) || null,
          },
        };
      }),
    );

    return res.json({ items });
  } catch (error) {
    logger.error({ err: error }, "Failed to list creative runs");
    return res.status(500).json({ error: "Failed to list creative runs" });
  }
});

router.post("/campaigns", requireOps, async (req, res) => {
  try {
    const name = normalizeString(req.body?.name);
    const subject = normalizeString(req.body?.subject);
    const body = normalizeString(req.body?.body);
    const audienceQuery = normalizeString(req.body?.audienceQuery);
    const channel = normalizeString(req.body?.channel) || "sendgrid";
    const recipientEmails = Array.isArray(req.body?.recipientEmails)
      ? req.body.recipientEmails.filter((value: unknown): value is string => typeof value === "string")
      : typeof req.body?.recipientEmails === "string"
        ? req.body.recipientEmails.split(/[\n,]+/).map((value: string) => value.trim()).filter(Boolean)
        : [];
    const audienceId = normalizeString(req.body?.audienceId) || null;
    const sequenceId = normalizeString(req.body?.sequenceId) || null;

    if (!name || !subject || !body) {
      return res.status(400).json({ error: "name, subject, and body are required" });
    }

    const result = await createGrowthCampaignDraft({
      name,
      subject,
      body,
      audienceQuery: audienceQuery || null,
      channel,
      recipientEmails,
      audienceId,
      sequenceId,
    });

    return res.status(201).json({
      ok: true,
      id: result.id,
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to create growth campaign");
    return res.status(500).json({ error: "Failed to create growth campaign" });
  }
});

router.post("/campaigns/:campaignId/queue-send", requireOps, async (req, res) => {
  try {
    const campaignId = req.params.campaignId?.trim();
    if (!campaignId) {
      return res.status(400).json({ error: "Missing campaign id" });
    }

    const operator = await operatorEmail(res);
    const result = await queueGrowthCampaignSend({
      campaignId,
      operatorEmail: operator,
    });

    return res.json({ ok: true, result });
  } catch (error) {
    logger.error({ err: error }, "Failed to queue campaign send");
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to queue campaign send",
    });
  }
});

router.get("/campaigns/:campaignId/events", requireOps, async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: "Database not available" });
    }

    const campaignId = req.params.campaignId?.trim();
    if (!campaignId) {
      return res.status(400).json({ error: "Missing campaign id" });
    }

    const snapshot = await db
      .collection("growth_campaign_events")
      .where("campaign_id", "==", campaignId)
      .orderBy("received_at", "desc")
      .limit(100)
      .get();

    return res.json({
      items: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to fetch campaign events");
    return res.status(500).json({ error: "Failed to fetch campaign events" });
  }
});

router.get("/campaigns/ship-broadcast/pending-approval", requireOps, async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: "Database not available" });
    }

    const limit = Math.min(
      Math.max(parseInt(typeof req.query.limit === "string" ? req.query.limit : "12", 10) || 12, 1),
      50,
    );

    const snapshot = await db
      .collection("growthCampaigns")
      .where("send_status", "==", "pending_approval")
      .orderBy("created_at", "desc")
      .limit(limit * 3)
      .get();

    const items = snapshot.docs
      .map((doc) => {
      const data = doc.data() as Record<string, unknown>;
      const automationContext =
        data.automation_context && typeof data.automation_context === "object"
          ? (data.automation_context as Record<string, unknown>)
          : {};
      return {
        id: doc.id,
        name: normalizeString(data.name) || "Unnamed campaign",
        subject: normalizeString(data.subject) || "",
        recipientCount:
          typeof data.recipient_count === "number" ? data.recipient_count : 0,
        sendStatus: normalizeString(data.send_status) || "unknown",
        createdAt:
          typeof data.created_at_iso === "string"
            ? data.created_at_iso
            : null,
        lastLedgerDocId: normalizeString(data.last_ledger_doc_id) || null,
        approvalReason: normalizeString(data.approval_reason) || null,
        assetKey: normalizeString(automationContext.asset_key) || null,
        assetType: normalizeString(automationContext.asset_type) || null,
        sourceIssueIds: Array.isArray(automationContext.source_issue_ids)
          ? automationContext.source_issue_ids.filter((value): value is string => typeof value === "string")
          : [],
        proofLinks: Array.isArray(automationContext.proof_links)
          ? automationContext.proof_links.filter((value): value is string => typeof value === "string")
          : [],
      };
      })
      .filter((item) => item.assetType === "ship_broadcast")
      .slice(0, limit);

    return res.json({ items });
  } catch (error) {
    logger.error({ err: error }, "Failed to list ship-broadcast drafts waiting approval");
    return res.status(500).json({ error: "Failed to list ship-broadcast drafts waiting approval" });
  }
});

router.post("/lifecycle/run", requireOps, async (req, res) => {
  try {
    const daysSinceGrant = Math.max(
      7,
      Number(req.body?.daysSinceGrant || 30),
    );
    const result = await runBuyerLifecycleCheck({ daysSinceGrant });
    return res.json({ ok: true, ...result });
  } catch (error) {
    logger.error({ err: error }, "Failed to run lifecycle automation");
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to run lifecycle automation",
    });
  }
});

router.get("/content-reviews", requireOps, async (req, res) => {
  try {
    const limit = Math.min(
      Math.max(parseInt(typeof req.query.limit === "string" ? req.query.limit : "25", 10) || 25, 1),
      100,
    );
    const assetKey = typeof req.query.assetKey === "string" ? req.query.assetKey.trim() : null;
    const items = await listContentOutcomeReviews({ limit, assetKey });
    return res.json({ items });
  } catch (error) {
    logger.error({ err: error }, "Failed to list content outcome reviews");
    return res.status(500).json({ error: "Failed to list content outcome reviews" });
  }
});

router.get("/content-reviews/summary", requireOps, async (req, res) => {
  try {
    const lookbackDays = Math.min(
      Math.max(parseInt(typeof req.query.lookbackDays === "string" ? req.query.lookbackDays : "30", 10) || 30, 1),
      180,
    );
    const limit = Math.min(
      Math.max(parseInt(typeof req.query.limit === "string" ? req.query.limit : "50", 10) || 50, 1),
      100,
    );
    return res.json(await summarizeRecentContentOutcomeReviews({ lookbackDays, limit }));
  } catch (error) {
    logger.error({ err: error }, "Failed to summarize content outcome reviews");
    return res.status(500).json({ error: "Failed to summarize content outcome reviews" });
  }
});

router.post("/content-reviews", requireOps, async (req, res) => {
  try {
    const recordedAtIso = new Date().toISOString();
    const review = normalizeContentOutcomeReviewInput(
      req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {},
      recordedAtIso,
      await operatorEmail(res),
    );
    if (!review.assetKey || !review.summary || !review.evidenceSource) {
      return res.status(400).json({ error: "assetKey, summary, and evidenceSource are required" });
    }
    return res.status(201).json({
      ok: true,
      review: await createContentOutcomeReview({ review }),
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to create content outcome review");
    return res.status(500).json({ error: "Failed to create content outcome review" });
  }
});

router.post("/automation/experiments/run", requireOps, async (_req, res) => {
  try {
    const result = await runExperimentAutorollout();
    return res.json({ ok: true, ...result });
  } catch (error) {
    logger.error({ err: error }, "Failed to run experiment autorollout");
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to run experiment autorollout",
    });
  }
});

router.post("/automation/outbound/run", requireOps, async (_req, res) => {
  try {
    const result = await runAutonomousResearchOutboundLoop({
      operatorEmail: await operatorEmail(res),
    });
    return res.json({ ok: true, ...result });
  } catch (error) {
    logger.error({ err: error }, "Failed to run autonomous outbound loop");
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to run autonomous outbound loop",
    });
  }
});

router.post("/automation/creative/run", requireOps, async (_req, res) => {
  try {
    const result = await runCreativeAssetFactoryLoop();
    return res.json({ ok: true, ...result });
  } catch (error) {
    logger.error({ err: error }, "Failed to run creative factory");
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to run creative factory",
    });
  }
});

router.post("/notion/sync", requireOps, async (req, res) => {
  try {
    const limit = Math.min(
      Math.max(parseInt(typeof req.body?.limit === "number" ? String(req.body.limit) : String(req.body?.limit || "50"), 10) || 50, 1),
      200,
    );
    const refreshIntegrationSnapshot = req.body?.refreshIntegrationSnapshot !== false;

    return res.json({
      ok: true,
      result: await syncGrowthStudioToNotion({
        limit,
        refreshIntegrationSnapshot,
      }),
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to sync Growth Studio mirror to Notion");
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to sync Growth Studio mirror to Notion",
    });
  }
});

router.get("/integrations/verify", requireOps, async (_req, res) => {
  try {
    return res.json(await verifyGrowthIntegrations());
  } catch (error) {
    logger.error({ err: error }, "Failed to verify integrations");
    return res.status(500).json({ error: "Failed to verify integrations" });
  }
});

export async function sendgridWebhookHandler(req: Request, res: Response) {
  const configuredSecret = getConfiguredEnvValue("SENDGRID_EVENT_WEBHOOK_SECRET");
  const providedSecret =
    normalizeString(req.header("x-blueprint-growth-secret"))
    || normalizeString(req.query.secret);

  if (configuredSecret && configuredSecret !== providedSecret) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    await ingestSendGridWebhook(req.body ?? []);
    return res.status(202).json({ ok: true });
  } catch (error) {
    logger.error({ err: error }, "Failed to ingest SendGrid webhook");
    return res.status(500).json({ error: "Failed to ingest SendGrid webhook" });
  }
}

export default router;
