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
import {
  readCurrentCityLaunchActivation,
  runCityLaunchExecutionHarness,
} from "../utils/cityLaunchExecutionHarness";
import { resolveCityLaunchActivationFounderApproval } from "../utils/cityLaunchApprovalMode";
import {
  listCityLaunchBudgetEvents,
  listCityLaunchBuyerTargets,
  listCityLaunchChannelAccounts,
  listCityLaunchProspects,
  listCityLaunchReplyConversions,
  listCityLaunchSendActions,
  listCityLaunchTouches,
  readCityLaunchChannelAccount,
  readCityLaunchSendAction,
  readCityLaunchActivation,
  recordCityLaunchBudgetEvent,
  recordCityLaunchTouch,
  summarizeCityLaunchLedgers,
  upsertCityLaunchBuyerTarget,
  upsertCityLaunchChannelAccount,
  upsertCityLaunchProspect,
  upsertCityLaunchReplyConversion,
  upsertCityLaunchSendAction,
} from "../utils/cityLaunchLedgers";
import { isCityLaunchBuyerProofPath } from "../utils/cityLaunchResearchContracts";
import { sendEmail, getEmailTransportStatus } from "../utils/email";

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

function normalizeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeIsoOrNull(value: unknown) {
  const normalized = normalizeString(value);
  if (!normalized) return null;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
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

router.post("/city-launch/activate", requireOps, async (req, res) => {
  try {
    const city = normalizeString(req.body?.city);
    if (!city) {
      return res.status(400).json({ error: "city is required" });
    }

    const rawBudgetTier = normalizeString(req.body?.budgetTier);
    const budgetTier =
      rawBudgetTier === "zero_budget" || rawBudgetTier === "low_budget" || rawBudgetTier === "funded"
        ? rawBudgetTier
        : undefined;

    const result = await runCityLaunchExecutionHarness({
      city,
      founderApproved: resolveCityLaunchActivationFounderApproval({
        founderApproved: req.body?.founderApproved,
        requireFounderApproval: req.body?.requireFounderApproval,
      }),
      budgetTier,
      budgetMaxUsd: normalizeNumber(req.body?.budgetMaxUsd) ?? undefined,
      operatorAutoApproveUsd:
        normalizeNumber(req.body?.operatorAutoApproveUsd) ?? undefined,
      dispatchIssues: req.body?.dispatchIssues !== false,
    });

    return res.status(201).json({ ok: true, result });
  } catch (error) {
    logger.error({ err: error }, "Failed to activate city launch harness");
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to activate city launch harness",
    });
  }
});

router.get("/city-launch/activation", requireOps, async (req, res) => {
  try {
    const city = normalizeString(req.query.city) || "Austin, TX";
    return res.json({
      ok: true,
      activation: await readCurrentCityLaunchActivation(city),
      ledgers: await summarizeCityLaunchLedgers(city),
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to read city launch activation");
    return res.status(500).json({ error: "Failed to read city launch activation" });
  }
});

router.post("/city-launch/ledgers/prospects", requireOps, async (req, res) => {
  try {
    const city = normalizeString(req.body?.city);
    const sourceBucket = normalizeString(req.body?.sourceBucket);
    const channel = normalizeString(req.body?.channel);
    const name = normalizeString(req.body?.name);
    const status = normalizeString(req.body?.status);
    if (!city || !sourceBucket || !channel || !name || !status) {
      return res.status(400).json({
        error: "city, sourceBucket, channel, name, and status are required",
      });
    }
    const prospect = await upsertCityLaunchProspect({
      id: normalizeString(req.body?.id) || undefined,
      city,
      launchId: normalizeString(req.body?.launchId) || null,
      sourceBucket,
      channel,
      name,
      email: normalizeString(req.body?.email) || null,
      status:
        status as
          | "identified"
          | "contacted"
          | "responded"
          | "qualified"
          | "approved"
          | "onboarded"
          | "capturing"
          | "inactive",
      ownerAgent: normalizeString(req.body?.ownerAgent) || null,
      notes: normalizeString(req.body?.notes) || null,
      firstContactedAt: normalizeString(req.body?.firstContactedAt) || null,
      lastContactedAt: normalizeString(req.body?.lastContactedAt) || null,
      siteAddress: normalizeString(req.body?.siteAddress) || null,
      locationSummary: normalizeString(req.body?.locationSummary) || null,
      lat: normalizeNumber(req.body?.lat),
      lng: normalizeNumber(req.body?.lng),
      siteCategory: normalizeString(req.body?.siteCategory) || null,
      workflowFit: normalizeString(req.body?.workflowFit) || null,
      priorityNote: normalizeString(req.body?.priorityNote) || null,
      researchProvenance: null,
    });
    return res.status(201).json({ ok: true, prospect });
  } catch (error) {
    logger.error({ err: error }, "Failed to upsert city launch prospect");
    return res.status(500).json({ error: "Failed to upsert city launch prospect" });
  }
});

router.post("/city-launch/ledgers/buyer-targets", requireOps, async (req, res) => {
  try {
    const city = normalizeString(req.body?.city);
    const companyName = normalizeString(req.body?.companyName);
    const status = normalizeString(req.body?.status);
    if (!city || !companyName || !status) {
      return res.status(400).json({
        error: "city, companyName, and status are required",
      });
    }
    const buyerTarget = await upsertCityLaunchBuyerTarget({
      id: normalizeString(req.body?.id) || undefined,
      city,
      launchId: normalizeString(req.body?.launchId) || null,
      companyName,
      contactName: normalizeString(req.body?.contactName) || null,
      contactEmail: normalizeString(req.body?.contactEmail) || null,
      status:
        status as
          | "identified"
          | "researched"
          | "queued"
          | "contacted"
          | "engaged"
          | "hosted_review"
          | "commercial_handoff"
          | "closed_won"
          | "closed_lost",
      workflowFit: normalizeString(req.body?.workflowFit) || null,
      proofPath: isCityLaunchBuyerProofPath(normalizeString(req.body?.proofPath) || null)
        ? normalizeString(req.body?.proofPath) as "exact_site" | "adjacent_site" | "scoped_follow_up"
        : null,
      ownerAgent: normalizeString(req.body?.ownerAgent) || null,
      notes: normalizeString(req.body?.notes) || null,
      sourceBucket: normalizeString(req.body?.sourceBucket) || null,
      researchProvenance: null,
    });
    return res.status(201).json({ ok: true, buyerTarget });
  } catch (error) {
    logger.error({ err: error }, "Failed to upsert city launch buyer target");
    return res.status(500).json({ error: "Failed to upsert city launch buyer target" });
  }
});

router.post("/city-launch/ledgers/touches", requireOps, async (req, res) => {
  try {
    const city = normalizeString(req.body?.city);
    const referenceType = normalizeString(req.body?.referenceType);
    const touchType = normalizeString(req.body?.touchType);
    const channel = normalizeString(req.body?.channel);
    const status = normalizeString(req.body?.status);
    if (!city || !referenceType || !touchType || !channel || !status) {
      return res.status(400).json({
        error: "city, referenceType, touchType, channel, and status are required",
      });
    }
    const touch = await recordCityLaunchTouch({
      city,
      launchId: normalizeString(req.body?.launchId) || null,
      referenceType: referenceType as "prospect" | "buyer_target" | "general",
      referenceId: normalizeString(req.body?.referenceId) || null,
      touchType:
        touchType as
          | "first_touch"
          | "follow_up"
          | "approval_request"
          | "intro"
          | "operator_send",
      channel,
      status: status as "draft" | "queued" | "sent" | "delivered" | "replied" | "failed",
      campaignId: normalizeString(req.body?.campaignId) || null,
      issueId: normalizeString(req.body?.issueId) || null,
      notes: normalizeString(req.body?.notes) || null,
      researchProvenance: null,
    });
    return res.status(201).json({ ok: true, touch });
  } catch (error) {
    logger.error({ err: error }, "Failed to record city launch touch");
    return res.status(500).json({ error: "Failed to record city launch touch" });
  }
});

router.post("/city-launch/ledgers/budget-events", requireOps, async (req, res) => {
  try {
    const city = normalizeString(req.body?.city);
    const category = normalizeString(req.body?.category);
    const amountUsd = normalizeNumber(req.body?.amountUsd);
    if (!city || !category || amountUsd === null) {
      return res.status(400).json({
        error: "city, category, and amountUsd are required",
      });
    }
    const budgetEvent = await recordCityLaunchBudgetEvent({
      city,
      launchId: normalizeString(req.body?.launchId) || null,
      category:
        category as
          | "creative"
          | "outbound"
          | "community"
          | "field_ops"
          | "travel"
          | "tools"
          | "other",
      amountUsd,
      note: normalizeString(req.body?.note) || null,
      approvedByRole: normalizeString(req.body?.approvedByRole) || null,
      withinPolicy: req.body?.withinPolicy !== false,
      eventType: req.body?.eventType === "recommended" ? "recommended" : "actual",
      researchProvenance: null,
    });
    return res.status(201).json({ ok: true, budgetEvent });
  } catch (error) {
    logger.error({ err: error }, "Failed to record city launch budget event");
    return res.status(500).json({ error: "Failed to record city launch budget event" });
  }
});

router.post("/city-launch/ledgers/channel-accounts", requireOps, async (req, res) => {
  try {
    const city = normalizeString(req.body?.city);
    const lane = normalizeString(req.body?.lane);
    const channelClass = normalizeString(req.body?.channelClass);
    const accountLabel = normalizeString(req.body?.accountLabel);
    if (!city || !lane || !channelClass || !accountLabel) {
      return res.status(400).json({
        error: "city, lane, channelClass, and accountLabel are required",
      });
    }

    const channelAccount = await upsertCityLaunchChannelAccount({
      id: normalizeString(req.body?.id) || undefined,
      city,
      launchId: normalizeString(req.body?.launchId) || null,
      lane:
        lane as
          | "warehouse-facility-direct"
          | "buyer-linked-site"
          | "professional-capturer"
          | "public-commercial-community",
      channelClass,
      accountLabel,
      ownerAgent: normalizeString(req.body?.ownerAgent) || null,
      status:
        (normalizeString(req.body?.status) || "planned") as
          | "planned"
          | "ready_to_create"
          | "created"
          | "blocked",
      approvalState:
        (normalizeString(req.body?.approvalState) || "pending_first_send_approval") as
          | "not_required"
          | "pending_first_send_approval"
          | "approved"
          | "blocked",
      notes: normalizeString(req.body?.notes) || null,
    });
    return res.status(201).json({ ok: true, channelAccount });
  } catch (error) {
    logger.error({ err: error }, "Failed to upsert city launch channel account");
    return res.status(500).json({ error: "Failed to upsert city launch channel account" });
  }
});

router.post("/city-launch/ledgers/send-actions", requireOps, async (req, res) => {
  try {
    const city = normalizeString(req.body?.city);
    const lane = normalizeString(req.body?.lane);
    const actionType = normalizeString(req.body?.actionType);
    const channelLabel = normalizeString(req.body?.channelLabel);
    const targetLabel = normalizeString(req.body?.targetLabel);
    const assetKey = normalizeString(req.body?.assetKey);
    if (!city || !lane || !actionType || !channelLabel || !targetLabel || !assetKey) {
      return res.status(400).json({
        error: "city, lane, actionType, channelLabel, targetLabel, and assetKey are required",
      });
    }

    const sendAction = await upsertCityLaunchSendAction({
      id: normalizeString(req.body?.id) || undefined,
      city,
      launchId: normalizeString(req.body?.launchId) || null,
      lane:
        lane as
          | "warehouse-facility-direct"
          | "buyer-linked-site"
          | "professional-capturer"
          | "public-commercial-community",
      actionType: actionType as "direct_outreach" | "community_post",
      channelAccountId: normalizeString(req.body?.channelAccountId) || null,
      channelLabel,
      targetLabel,
      assetKey,
      ownerAgent: normalizeString(req.body?.ownerAgent) || null,
      recipientEmail: normalizeString(req.body?.recipientEmail) || null,
      emailSubject: normalizeString(req.body?.emailSubject) || null,
      emailBody: normalizeString(req.body?.emailBody) || null,
      status:
        (normalizeString(req.body?.status) || "draft") as
          | "draft"
          | "ready_to_send"
          | "sent"
          | "blocked",
      approvalState:
        (normalizeString(req.body?.approvalState) || "pending_first_send_approval") as
          | "not_required"
          | "pending_first_send_approval"
          | "approved"
          | "blocked",
      responseIngestState:
        (normalizeString(req.body?.responseIngestState) || "awaiting_response") as
          | "awaiting_response"
          | "response_recorded"
          | "routed"
          | "closed",
      issueId: normalizeString(req.body?.issueId) || null,
      notes: normalizeString(req.body?.notes) || null,
      sentAtIso: normalizeIsoOrNull(req.body?.sentAtIso),
      firstResponseAtIso: normalizeIsoOrNull(req.body?.firstResponseAtIso),
    });
    return res.status(201).json({ ok: true, sendAction });
  } catch (error) {
    logger.error({ err: error }, "Failed to upsert city launch send action");
    return res.status(500).json({ error: "Failed to upsert city launch send action" });
  }
});

router.post("/city-launch/send-actions/:sendActionId/execute-email-send", requireOps, async (req, res) => {
  try {
    const sendActionId = normalizeString(req.params.sendActionId);
    const existing = await readCityLaunchSendAction(sendActionId);
    if (!existing) {
      return res.status(404).json({ error: "City launch send action not found" });
    }
    if (existing.actionType !== "direct_outreach") {
      return res.status(400).json({ error: "Only direct_outreach actions can use email execution" });
    }
    if (existing.approvalState !== "approved" && existing.approvalState !== "not_required") {
      return res.status(400).json({ error: "Send action must be approved before email execution" });
    }

    const recipientEmail = normalizeString(req.body?.recipientEmail) || existing.recipientEmail || "";
    const emailSubject = normalizeString(req.body?.emailSubject) || existing.emailSubject || "";
    const emailBody = normalizeString(req.body?.emailBody) || existing.emailBody || "";

    if (!recipientEmail || !emailSubject || !emailBody) {
      return res.status(400).json({
        error: "recipientEmail, emailSubject, and emailBody are required to execute an email send",
      });
    }

    const emailStatus = getEmailTransportStatus();
    if (!emailStatus.configured) {
      return res.status(500).json({ error: "Email transport is not configured" });
    }

    const result = await sendEmail({
      to: recipientEmail,
      subject: emailSubject,
      text: emailBody,
      sendGridCategories: ["city_launch", "city_opening", existing.lane],
      sendGridCustomArgs: {
        bp_city: existing.citySlug,
        bp_send_action_id: existing.id,
        bp_lane: existing.lane,
      },
    });

    if (!result.sent) {
      return res.status(500).json({
        error: result.error instanceof Error ? result.error.message : "Failed to send email",
      });
    }

    const sentAtIso = new Date().toISOString();
    const sendAction = await upsertCityLaunchSendAction({
      ...existing,
      recipientEmail,
      emailSubject,
      emailBody,
      status: "sent",
      sentAtIso,
      notes: [
        existing.notes,
        `Email executed via ${emailStatus.provider} by ${await operatorEmail(res)} at ${sentAtIso}.`,
      ]
        .filter(Boolean)
        .join("\n\n"),
    });

    const touch = await recordCityLaunchTouch({
      city: existing.city,
      launchId: existing.launchId,
      referenceType: "general",
      referenceId: null,
      touchType: "first_touch",
      channel: "email",
      status: "sent",
      campaignId: null,
      issueId: existing.issueId,
      notes: `City-opening direct email sent to ${recipientEmail}.`,
      researchProvenance: null,
    });

    return res.json({ ok: true, sendAction, touch });
  } catch (error) {
    logger.error({ err: error }, "Failed to execute city launch email send");
    return res.status(500).json({ error: "Failed to execute city launch email send" });
  }
});

router.post("/city-launch/channel-accounts/:channelAccountId/mark-created", requireOps, async (req, res) => {
  try {
    const channelAccountId = normalizeString(req.params.channelAccountId);
    const existing = await readCityLaunchChannelAccount(channelAccountId);
    if (!existing) {
      return res.status(404).json({ error: "City launch channel account not found" });
    }
    const channelAccount = await upsertCityLaunchChannelAccount({
      ...existing,
      status: "created",
      approvalState:
        normalizeString(req.body?.approvalState) === "approved"
          ? "approved"
          : existing.approvalState,
      notes: [existing.notes, normalizeString(req.body?.note) || "Marked created in admin ops."]
        .filter(Boolean)
        .join("\n\n"),
    });
    return res.json({ ok: true, channelAccount });
  } catch (error) {
    logger.error({ err: error }, "Failed to mark city launch channel account created");
    return res.status(500).json({ error: "Failed to mark city launch channel account created" });
  }
});

router.post("/city-launch/send-actions/:sendActionId/approve-live-send", requireOps, async (req, res) => {
  try {
    const sendActionId = normalizeString(req.params.sendActionId);
    const existing = await readCityLaunchSendAction(sendActionId);
    if (!existing) {
      return res.status(404).json({ error: "City launch send action not found" });
    }
    const sendAction = await upsertCityLaunchSendAction({
      ...existing,
      approvalState: "approved",
      status: existing.status === "draft" ? "ready_to_send" : existing.status,
      notes: [
        existing.notes,
        `First live send approved by ${await operatorEmail(res)}.`,
        normalizeString(req.body?.note),
      ]
        .filter(Boolean)
        .join("\n\n"),
    });
    return res.json({ ok: true, sendAction });
  } catch (error) {
    logger.error({ err: error }, "Failed to approve city launch live send");
    return res.status(500).json({ error: "Failed to approve city launch live send" });
  }
});

router.post("/city-launch/send-actions/:sendActionId/mark-sent", requireOps, async (req, res) => {
  try {
    const sendActionId = normalizeString(req.params.sendActionId);
    const existing = await readCityLaunchSendAction(sendActionId);
    if (!existing) {
      return res.status(404).json({ error: "City launch send action not found" });
    }
    if (existing.approvalState !== "approved" && existing.approvalState !== "not_required") {
      return res.status(400).json({
        error: "Send action must be approved before it can be marked sent",
      });
    }

    const sentAtIso = normalizeIsoOrNull(req.body?.sentAtIso) || new Date().toISOString();
    const sendAction = await upsertCityLaunchSendAction({
      ...existing,
      status: "sent",
      approvalState: existing.approvalState,
      sentAtIso,
      notes: [
        existing.notes,
        `Marked sent by ${await operatorEmail(res)} at ${sentAtIso}.`,
        normalizeString(req.body?.note),
      ]
        .filter(Boolean)
        .join("\n\n"),
    });
    return res.json({ ok: true, sendAction });
  } catch (error) {
    logger.error({ err: error }, "Failed to mark city launch send action sent");
    return res.status(500).json({ error: "Failed to mark city launch send action sent" });
  }
});

router.post("/city-launch/send-actions/:sendActionId/block", requireOps, async (req, res) => {
  try {
    const sendActionId = normalizeString(req.params.sendActionId);
    const existing = await readCityLaunchSendAction(sendActionId);
    if (!existing) {
      return res.status(404).json({ error: "City launch send action not found" });
    }

    const sendAction = await upsertCityLaunchSendAction({
      ...existing,
      status: "blocked",
      approvalState: normalizeString(req.body?.approvalState) === "blocked" ? "blocked" : existing.approvalState,
      notes: [
        existing.notes,
        normalizeString(req.body?.reason) || "Blocked in admin ops.",
      ]
        .filter(Boolean)
        .join("\n\n"),
    });
    return res.json({ ok: true, sendAction });
  } catch (error) {
    logger.error({ err: error }, "Failed to block city launch send action");
    return res.status(500).json({ error: "Failed to block city launch send action" });
  }
});

router.post("/city-launch/send-actions/:sendActionId/ingest-response", requireOps, async (req, res) => {
  try {
    const sendActionId = normalizeString(req.params.sendActionId);
    const existing = await readCityLaunchSendAction(sendActionId);
    if (!existing) {
      return res.status(404).json({ error: "City launch send action not found" });
    }

    const responseType = normalizeString(req.body?.responseType);
    const responseSummary = normalizeString(req.body?.responseSummary);
    const routingTarget = normalizeString(req.body?.routingTarget);
    if (!responseType || !responseSummary || !routingTarget) {
      return res.status(400).json({
        error: "responseType, responseSummary, and routingTarget are required",
      });
    }

    let prospectId: string | null = null;
    let buyerTargetId: string | null = null;
    if (
      existing.lane === "professional-capturer"
      || existing.lane === "public-commercial-community"
      || routingTarget === "supply_qualification"
      || routingTarget === "site_operator_partnership"
    ) {
      const prospect = await upsertCityLaunchProspect({
        city: existing.city,
        launchId: existing.launchId,
        sourceBucket: existing.lane,
        channel: existing.channelLabel,
        name: normalizeString(req.body?.name) || existing.targetLabel,
        email: normalizeString(req.body?.email) || null,
        status: normalizeString(req.body?.prospectStatus) === "qualified" ? "qualified" : "responded",
        ownerAgent:
          routingTarget === "supply_qualification"
            ? "intake-agent"
            : routingTarget === "site_operator_partnership"
              ? "site-operator-partnership-agent"
              : existing.ownerAgent,
        notes: responseSummary,
        firstContactedAt: existing.sentAtIso,
        lastContactedAt: new Date().toISOString(),
        siteAddress: normalizeString(req.body?.siteAddress) || null,
        locationSummary: normalizeString(req.body?.locationSummary) || null,
        lat: normalizeNumber(req.body?.lat),
        lng: normalizeNumber(req.body?.lng),
        siteCategory: normalizeString(req.body?.siteCategory) || null,
        workflowFit: normalizeString(req.body?.workflowFit) || null,
        priorityNote: normalizeString(req.body?.priorityNote) || null,
        researchProvenance: null,
      });
      prospectId = prospect.id;
    }

    if (
      existing.lane === "warehouse-facility-direct"
      || existing.lane === "buyer-linked-site"
      || routingTarget === "buyer_target"
    ) {
      const buyerTarget = await upsertCityLaunchBuyerTarget({
        city: existing.city,
        launchId: existing.launchId,
        companyName: normalizeString(req.body?.companyName) || existing.targetLabel,
        contactName: normalizeString(req.body?.contactName) || null,
        contactEmail: normalizeString(req.body?.contactEmail) || existing.recipientEmail || null,
        status: normalizeString(req.body?.buyerStatus) === "engaged" ? "engaged" : "contacted",
        workflowFit: normalizeString(req.body?.workflowFit) || null,
        proofPath: isCityLaunchBuyerProofPath(normalizeString(req.body?.proofPath) || null)
          ? (normalizeString(req.body?.proofPath) as "exact_site" | "adjacent_site" | "scoped_follow_up")
          : null,
        ownerAgent:
          routingTarget === "buyer_target"
            ? "buyer-solutions-agent"
            : existing.ownerAgent,
        notes: responseSummary,
        sourceBucket: existing.lane,
        researchProvenance: null,
      });
      buyerTargetId = buyerTarget.id;
    }

    const responseRecordedAt = normalizeIsoOrNull(req.body?.responseRecordedAt) || new Date().toISOString();
    const nextFollowUpDueAtIso = normalizeIsoOrNull(req.body?.nextFollowUpDueAt);
    const replyConversion = await upsertCityLaunchReplyConversion({
      city: existing.city,
      launchId: existing.launchId,
      sendActionId: existing.id,
      lane: existing.lane,
      responseType: responseType as "buyer_reply" | "operator_reply" | "capturer_reply" | "community_reply" | "referral",
      responseSummary,
      routingTarget: routingTarget as "site_operator_partnership" | "buyer_target" | "supply_qualification" | "blocked" | "no_fit",
      nextOwner:
        normalizeString(req.body?.nextOwner)
        || (routingTarget === "site_operator_partnership"
          ? "site-operator-partnership-agent"
          : routingTarget === "buyer_target"
            ? "buyer-solutions-agent"
            : routingTarget === "supply_qualification"
              ? "intake-agent"
              : existing.ownerAgent),
      nextFollowUpDueAtIso,
      prospectId,
      buyerTargetId,
      status:
        routingTarget === "blocked"
          ? "blocked"
          : routingTarget === "no_fit"
            ? "closed"
            : "routed",
      notes: normalizeString(req.body?.notes) || null,
    });

    const sendAction = await upsertCityLaunchSendAction({
      ...existing,
      responseIngestState:
        routingTarget === "blocked" || routingTarget === "no_fit"
          ? "closed"
          : "routed",
      firstResponseAtIso: responseRecordedAt,
      notes: [
        existing.notes,
        `Response ingested by ${await operatorEmail(res)} at ${responseRecordedAt}.`,
        responseSummary,
      ]
        .filter(Boolean)
        .join("\n\n"),
    });

    const touch = await recordCityLaunchTouch({
      city: existing.city,
      launchId: existing.launchId,
      referenceType: buyerTargetId ? "buyer_target" : prospectId ? "prospect" : "general",
      referenceId: buyerTargetId || prospectId || null,
      touchType: "follow_up",
      channel: existing.channelLabel,
      status: "replied",
      campaignId: null,
      issueId: existing.issueId,
      notes: responseSummary,
      researchProvenance: null,
    });

    return res.status(201).json({
      ok: true,
      sendAction,
      replyConversion,
      touch,
      prospectId,
      buyerTargetId,
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to ingest city launch response");
    return res.status(500).json({ error: "Failed to ingest city launch response" });
  }
});

router.get("/city-launch/ledgers", requireOps, async (req, res) => {
  try {
    const city = normalizeString(req.query.city) || "Austin, TX";
    return res.json({
      ok: true,
      activation: await readCityLaunchActivation(city),
      summary: await summarizeCityLaunchLedgers(city),
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to summarize city launch ledgers");
    return res.status(500).json({ error: "Failed to summarize city launch ledgers" });
  }
});

router.get("/city-launch/records", requireOps, async (req, res) => {
  try {
    const city = normalizeString(req.query.city) || "Austin, TX";
    return res.json({
      ok: true,
      activation: await readCityLaunchActivation(city),
      prospects: await listCityLaunchProspects(city),
      buyerTargets: await listCityLaunchBuyerTargets(city),
      touches: await listCityLaunchTouches(city),
      budgetEvents: await listCityLaunchBudgetEvents(city),
      channelAccounts: await listCityLaunchChannelAccounts(city),
      sendActions: await listCityLaunchSendActions(city),
      replyConversions: await listCityLaunchReplyConversions(city),
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to list city launch records");
    return res.status(500).json({ error: "Failed to list city launch records" });
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
