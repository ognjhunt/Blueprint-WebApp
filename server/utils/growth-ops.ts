import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import {
  executeAction,
} from "../agents/action-executor";
import {
  GROWTH_CAMPAIGN_POLICY,
  LIFECYCLE_POLICY,
  SUPPORT_POLICY,
} from "../agents/action-policies";
import { getConfiguredEnvValue } from "../config/env";
import { getEmailTransportStatus } from "./email";
import { logGrowthEvent } from "./growth-events";
import {
  createNitrosendCampaignDraft,
  getNitrosendStatus,
  listNitrosendCampaigns,
} from "./nitrosend";
import { buildGrowthIntegrationSummary } from "./provider-status";

function serverTimestampValue() {
  return admin?.firestore?.FieldValue?.serverTimestamp?.() ?? new Date();
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeRecipientEmails(value: unknown) {
  const rawValues = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[\n,]+/)
      : [];

  return rawValues
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry, index, items) => entry.includes("@") && items.indexOf(entry) === index);
}

function lifecycleStageForDays(daysSinceGrant: number) {
  if (daysSinceGrant >= 90) {
    return {
      key: "renewal_planning",
      nextStageDays: null,
      subjectPrefix: "Renewal and next-site planning",
      intro:
        "Your team should now know whether the current exact-site package covered the deployment question or whether the next step is another hosted review, another site, or a deeper rights-safe package.",
      cta:
        "If a renewal review or the next exact-site package would help, book here",
    };
  }

  if (daysSinceGrant >= 60) {
    return {
      key: "expansion_follow_up",
      nextStageDays: 90,
      subjectPrefix: "Expansion follow-up",
      intro:
        "Teams at this point often need a second hosted review, a broader site package, or a tighter articulation of what remains blocked in the real facility.",
      cta:
        "If a second hosted review or a broader exact-site package would help, book here",
    };
  }

  if (daysSinceGrant >= 30) {
    return {
      key: "adoption_review",
      nextStageDays: 60,
      subjectPrefix: "Adoption review",
      intro:
        "This is the point where Blueprint should help your team translate the package into an actual deployment decision, not just leave the site artifacts sitting in a folder.",
      cta:
        "If a hosted review would help narrow the next deployment step, book here",
    };
  }

  return {
    key: "activation_check_in",
    nextStageDays: 30,
    subjectPrefix: "Activation check-in",
    intro:
      "Early follow-up should focus on whether the buyer actually opened the package, found the capture provenance they needed, and knows what question the hosted review should answer.",
    cta:
      "If you want Blueprint to walk through the exact site with your team, book here",
  };
}

function buildLifecycleEmail(params: {
  sku: string;
  bookingUrl: string;
  daysSinceGrant: number;
}) {
  const stage = lifecycleStageForDays(params.daysSinceGrant);
  const subject = `${stage.subjectPrefix} for your ${params.sku} access`;
  const body = [
    "Hi,",
    "",
    `You have had access to ${params.sku} for ${params.daysSinceGrant} days.`,
    "",
    stage.intro,
    "",
    "Blueprint stays capture-first here: the goal is to help your team get more value from the exact-site package, provenance record, and hosted-review path tied to the same real facility.",
    "",
    `${stage.cta}: ${params.bookingUrl}`,
    "",
    "If email is easier, reply with the exact site question or blocker and Blueprint can route it to the right operator.",
    "",
    "Best,",
    "Blueprint",
  ].join("\n");

  return {
    stage,
    subject,
    body,
  };
}

function normalizeCampaignEventType(value: unknown) {
  const raw = normalizeString(value).toLowerCase().replace(/[\s-]+/g, "_");
  if (!raw) return "unknown";

  if (["sent", "send", "accepted", "queued", "processed"].includes(raw)) return "sent";
  if (["delivered", "delivery"].includes(raw)) return "delivered";
  if (["open", "opened"].includes(raw)) return "opened";
  if (["click", "clicked"].includes(raw)) return "clicked";
  if (["reply", "replied"].includes(raw)) return "replied";
  if (["bounce", "bounced", "hard_bounce", "soft_bounce"].includes(raw)) return "bounced";
  if (["complaint", "spam_report", "spam_complaint"].includes(raw)) return "complained";
  if (["unsubscribe", "unsubscribed"].includes(raw)) return "unsubscribed";
  return raw;
}

const RENEWAL_COLLECTION = "renewal_tracking";

type RenewalStatus = "not_due" | "outreach_sent" | "at_risk" | "renewed" | "churned";

type RenewalOutreach = {
  type: "renewal_intro" | "renewal_reminder" | "at_risk_escalation";
  sentAt: string;
  channel: "email" | "ops_email";
  emailSubject?: string;
};

type RenewalTracker = {
  entitlementId: string;
  orderId: string;
  buyerEmail: string;
  skuName: string;
  licenseTier: string;
  grantedAt: string;
  renewalWindowOpensAt: string;
  renewalDeadline: string;
  status: RenewalStatus;
  outreachHistory: RenewalOutreach[];
};

async function latestCreativeRunContext() {
  if (!db) {
    return null;
  }

  const snapshot = await db
    .collection("creative_factory_runs")
    .orderBy("created_at", "desc")
    .limit(5)
    .get();

  for (const doc of snapshot.docs) {
    const data = doc.data() as Record<string, unknown>;
    const remotionReel =
      data.remotion_reel && typeof data.remotion_reel === "object"
        ? (data.remotion_reel as Record<string, unknown>)
        : {};
    const storageUri = normalizeString(remotionReel.storage_uri);
    if (!storageUri) {
      continue;
    }

    return {
      creative_run_id: doc.id,
      sku_name: normalizeString(data.sku_name) || null,
      created_at_iso: normalizeString(data.created_at_iso) || null,
      rollout_variant: normalizeString(data.rollout_variant) || null,
      research_topic: normalizeString(data.research_topic) || null,
      storage_uri: storageUri,
    };
  }

  return null;
}

export async function listGrowthCampaigns() {
  if (!db) {
    throw new Error("Database not available");
  }

  const localCampaignsSnapshot = await db
    .collection("growthCampaigns")
    .orderBy("created_at", "desc")
    .limit(50)
    .get();
  const localCampaigns = localCampaignsSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  const nitrosendCampaigns = getNitrosendStatus().configured
    ? await listNitrosendCampaigns().catch(() => [])
    : [];

  return {
    localCampaigns,
    nitrosendCampaigns,
  };
}

export async function createGrowthCampaignDraft(params: {
  name: string;
  subject: string;
  body: string;
  audienceQuery?: string | null;
  channel?: string | null;
  recipientEmails?: string[] | null;
  audienceId?: string | null;
  sequenceId?: string | null;
}) {
  if (!db) {
    throw new Error("Database not available");
  }

  const recipientEmails = normalizeRecipientEmails(params.recipientEmails || []);
  const creativeContext = await latestCreativeRunContext();
  let nitrosendCampaignId: string | null = null;
  const channel = params.channel || "sendgrid";
  if (channel === "nitrosend" && getNitrosendStatus().configured) {
    const nitrosendCampaign = await createNitrosendCampaignDraft({
      name: params.name,
      audienceId: params.audienceId,
      sequenceId: params.sequenceId,
      content: {
        subject: params.subject,
        body: params.body,
      },
    });
    nitrosendCampaignId = nitrosendCampaign.id;
  }

  const ref = await db.collection("growthCampaigns").add({
    name: params.name,
    subject: params.subject,
    body: params.body,
    audience_query: params.audienceQuery || null,
    channel,
    recipient_emails: recipientEmails,
    recipient_count: recipientEmails.length,
    delivery_provider:
      channel === "nitrosend" && nitrosendCampaignId
        ? "nitrosend"
        : getEmailTransportStatus().provider || "sendgrid",
    audience_id: params.audienceId || null,
    sequence_id: params.sequenceId || null,
    nitrosend_campaign_id: nitrosendCampaignId,
    creative_context: creativeContext,
    send_status: "draft",
    event_counts: {
      sent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      replied: 0,
      bounced: 0,
      complained: 0,
      unsubscribed: 0,
    },
    response_tracking: {
      last_event_type: null,
      last_event_at: null,
      last_recipient: null,
    },
    created_at: admin.firestore.FieldValue.serverTimestamp(),
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
  });

  return {
    id: ref.id,
    nitrosendCampaignId,
  };
}

export async function queueGrowthCampaignSend(params: {
  campaignId: string;
  operatorEmail: string;
}) {
  if (!db) {
    throw new Error("Database not available");
  }

  const doc = await db.collection("growthCampaigns").doc(params.campaignId).get();
  if (!doc.exists) {
    throw new Error("Campaign not found");
  }

  const campaign = doc.data() as Record<string, unknown>;
  const channel = normalizeString(campaign.channel) || "sendgrid";
  const recipientEmails = normalizeRecipientEmails(campaign.recipient_emails);
  const creativeContext =
    campaign.creative_context && typeof campaign.creative_context === "object"
      ? (campaign.creative_context as Record<string, unknown>)
      : null;

  if (recipientEmails.length > 0) {
    const result = await executeAction({
      sourceCollection: "growthCampaigns",
      sourceDocId: params.campaignId,
      actionType: "send_campaign_emails",
      actionPayload: {
        type: "send_campaign_emails",
        recipients: recipientEmails,
        subject: normalizeString(campaign.subject),
        body: normalizeString(campaign.body),
        campaignId: params.campaignId,
        approvedBy: params.operatorEmail,
        collection: "growthCampaigns",
        docId: params.campaignId,
        creativeContext,
      },
      safetyPolicy: GROWTH_CAMPAIGN_POLICY,
      draftOutput: {
        recommendation: "send_campaign",
        confidence: 0.99,
        requires_human_review: true,
        category: "growth_campaign",
        creative_asset_uri:
          typeof creativeContext?.storage_uri === "string"
            ? creativeContext.storage_uri
            : null,
      },
      idempotencyKey: `growth_campaign_send:${params.campaignId}`,
    });

    await db.collection("growthCampaigns").doc(params.campaignId).set(
      {
        send_status:
          result.state === "pending_approval" ? "pending_approval" : result.state,
        last_ledger_doc_id: result.ledgerDocId,
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return result;
  }

  if (channel === "nitrosend" && normalizeString(campaign.nitrosend_campaign_id)) {
    const result = await executeAction({
      sourceCollection: "growthCampaigns",
      sourceDocId: params.campaignId,
      actionType: "send_nitrosend_campaign",
      actionPayload: {
        type: "send_nitrosend_campaign",
        campaignId: normalizeString(campaign.nitrosend_campaign_id),
        approvedBy: params.operatorEmail,
        approvalNote: "Queued from growth campaign automation",
        collection: "growthCampaigns",
        docId: params.campaignId,
        creativeContext,
      },
      safetyPolicy: GROWTH_CAMPAIGN_POLICY,
      draftOutput: {
        recommendation: "send_campaign",
        confidence: 0.99,
        requires_human_review: true,
        category: "growth_campaign",
        creative_asset_uri:
          typeof creativeContext?.storage_uri === "string"
            ? creativeContext.storage_uri
            : null,
      },
      idempotencyKey: `growth_campaign_send:${params.campaignId}`,
    });

    await db.collection("growthCampaigns").doc(params.campaignId).set(
      {
        send_status:
          result.state === "pending_approval" ? "pending_approval" : result.state,
        last_ledger_doc_id: result.ledgerDocId,
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return result;
  }

  throw new Error("Campaign has no recipients configured for SendGrid delivery.");
}

export async function runBuyerLifecycleCheck(params: {
  daysSinceGrant: number;
  limit?: number;
}) {
  if (!db) {
    throw new Error("Database not available");
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - params.daysSinceGrant);

  const entitlementsSnapshot = await db
    .collection("marketplaceEntitlements")
    .where("access_state", "==", "provisioned")
    .get();

  const results: Array<Record<string, unknown>> = [];
  const bookingUrl =
    getConfiguredEnvValue("BLUEPRINT_VOICE_BOOKING_URL") ||
    "https://calendly.com/blueprintar/30min";
  const maxResults = Math.max(1, Math.min(params.limit ?? Number.POSITIVE_INFINITY, 100));

  for (const doc of entitlementsSnapshot.docs) {
    if (results.length >= maxResults) {
      break;
    }

    const data = doc.data() as Record<string, unknown>;
    const grantedAt =
      typeof data.granted_at === "string" ? new Date(data.granted_at) : null;
    const buyerEmail = normalizeString(data.buyer_email);
    if (!grantedAt || Number.isNaN(grantedAt.getTime()) || grantedAt > cutoff || !buyerEmail) {
      continue;
    }

    const sku = normalizeString(data.sku) || "Blueprint package";
    const lifecycleEmail = buildLifecycleEmail({
      sku,
      bookingUrl,
      daysSinceGrant: params.daysSinceGrant,
    });
    const action = await executeAction({
      sourceCollection: "marketplaceEntitlements",
      sourceDocId: doc.id,
      actionType: "send_email",
      actionPayload: {
        type: "send_email",
        to: buyerEmail,
        subject: lifecycleEmail.subject,
        body: lifecycleEmail.body,
        lifecycleStage: lifecycleEmail.stage.key,
        lifecycleDaysSinceGrant: params.daysSinceGrant,
      },
      safetyPolicy: LIFECYCLE_POLICY,
      draftOutput: {
        recommendation: "lifecycle_check_in",
        confidence: 0.95,
        requires_human_review: true,
        category: "retention",
        stage: lifecycleEmail.stage.key,
      },
      idempotencyKey: `buyer_lifecycle:${doc.id}:${params.daysSinceGrant}`,
    });

    await db.collection("marketplaceEntitlements").doc(doc.id).set(
      {
        buyer_success: {
          lifecycle: {
            last_stage: lifecycleEmail.stage.key,
            last_days_since_grant: params.daysSinceGrant,
            last_status: action.state,
            last_ledger_doc_id: action.ledgerDocId,
            last_buyer_email: buyerEmail,
            last_subject: lifecycleEmail.subject,
            last_queued_at: new Date().toISOString(),
            next_stage_days: lifecycleEmail.stage.nextStageDays,
          },
        },
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    results.push({
      entitlementId: doc.id,
      buyerEmail,
      lifecycleStage: lifecycleEmail.stage.key,
      ledgerDocId: action.ledgerDocId,
      state: action.state,
    });
  }

  await runRenewalOutreach({ limit: maxResults }).catch(() => null);

  return {
    results,
    count: results.length,
  };
}

export async function initRenewalTracking(params: {
  entitlementId: string;
  orderId: string;
  buyerEmail: string;
  skuName: string;
  licenseTier: string;
  grantedAt: string;
}): Promise<void> {
  if (!db || !params.entitlementId || !params.buyerEmail) {
    return;
  }

  const ref = db.collection(RENEWAL_COLLECTION).doc(params.entitlementId);
  const existing = await ref.get();
  if (existing.exists) {
    return;
  }

  const grantedAtMs = new Date(params.grantedAt).getTime();
  await ref.set({
    entitlementId: params.entitlementId,
    orderId: params.orderId,
    buyerEmail: params.buyerEmail,
    skuName: params.skuName,
    licenseTier: params.licenseTier,
    grantedAt: params.grantedAt,
    renewalWindowOpensAt: new Date(grantedAtMs + 75 * 86_400_000).toISOString(),
    renewalDeadline: new Date(grantedAtMs + 365 * 86_400_000).toISOString(),
    status: "not_due" as RenewalStatus,
    outreachHistory: [],
    created_at: serverTimestampValue(),
    updated_at: serverTimestampValue(),
  });
}

export async function runRenewalOutreach(params?: {
  limit?: number;
}): Promise<{ processedCount: number; failedCount: number }> {
  if (!db) {
    throw new Error("Database not available");
  }

  const limit = params?.limit || 25;
  const snapshot = await db
    .collection(RENEWAL_COLLECTION)
    .where("status", "in", ["not_due", "outreach_sent"])
    .limit(limit)
    .get();

  let processedCount = 0;
  let failedCount = 0;
  const supportEmail = getConfiguredEnvValue("BLUEPRINT_SUPPORT_EMAIL") || "ops@tryblueprint.io";

  for (const doc of snapshot.docs) {
    const data = doc.data() as RenewalTracker;
    const grantedAtMs = new Date(data.grantedAt).getTime();
    if (!Number.isFinite(grantedAtMs)) {
      continue;
    }

    const daysSinceGrant = Math.floor((Date.now() - grantedAtMs) / 86_400_000);

    try {
      if (daysSinceGrant >= 85 && data.status === "outreach_sent") {
        const subject = `Renewal at risk for ${data.skuName}`;
        const body = [
          `${data.buyerEmail} has reached day ${daysSinceGrant} on ${data.skuName} without a recorded renewal.`,
          "",
          `Entitlement: ${data.entitlementId}`,
          `Order: ${data.orderId}`,
          "",
          "This is an operator escalation so the team can decide whether the next step is renewal, upsell, or a manual save conversation.",
        ].join("\n");

        await executeAction({
          sourceCollection: RENEWAL_COLLECTION,
          sourceDocId: data.entitlementId,
          actionType: "send_email",
          actionPayload: {
            type: "send_email",
            to: supportEmail,
            subject,
            body,
          },
          safetyPolicy: SUPPORT_POLICY,
          draftOutput: {
            recommendation: "renewal_at_risk",
            confidence: 0.98,
            category: "general_support",
            priority: "normal",
            requires_human_review: false,
          },
          idempotencyKey: `renewal:at-risk:${data.entitlementId}`,
        });

        await doc.ref.set(
          {
            status: "at_risk" as RenewalStatus,
            outreachHistory: [
              ...(Array.isArray(data.outreachHistory) ? data.outreachHistory : []),
              {
                type: "at_risk_escalation",
                sentAt: new Date().toISOString(),
                channel: "ops_email",
                emailSubject: subject,
              },
            ],
            updated_at: serverTimestampValue(),
          },
          { merge: true },
        );
        processedCount += 1;
        continue;
      }

      if (daysSinceGrant >= 75 && data.status === "not_due") {
        const renewalUrl = `https://www.tryblueprint.io/checkout?renewal_of=${encodeURIComponent(
          data.orderId,
        )}&sku=${encodeURIComponent(data.skuName)}&tier=${encodeURIComponent(
          data.licenseTier,
        )}`;
        const subject = `Renew your ${data.skuName}`;
        const body = [
          `${data.skuName} is now in its renewal window.`,
          "",
          "Blueprint keeps the commercial path tied to the same exact-site package instead of forcing the team to restart the workflow from scratch.",
          "",
          `Renew here: ${renewalUrl}`,
          "",
          "If the next need is broader than a straight renewal, reply with the deployment question and Blueprint will route the expansion conversation.",
        ].join("\n");

        await executeAction({
          sourceCollection: RENEWAL_COLLECTION,
          sourceDocId: data.entitlementId,
          actionType: "send_email",
          actionPayload: {
            type: "send_email",
            to: data.buyerEmail,
            subject,
            body,
          },
          safetyPolicy: SUPPORT_POLICY,
          draftOutput: {
            recommendation: "renewal_intro",
            confidence: 0.95,
            category: "general_support",
            priority: "normal",
            requires_human_review: false,
          },
          idempotencyKey: `renewal:intro:${data.entitlementId}`,
        });

        await doc.ref.set(
          {
            status: "outreach_sent" as RenewalStatus,
            outreachHistory: [
              ...(Array.isArray(data.outreachHistory) ? data.outreachHistory : []),
              {
                type: "renewal_intro",
                sentAt: new Date().toISOString(),
                channel: "email",
                emailSubject: subject,
              },
            ],
            updated_at: serverTimestampValue(),
          },
          { merge: true },
        );
        processedCount += 1;
      }
    } catch {
      failedCount += 1;
    }
  }

  return { processedCount, failedCount };
}

export async function verifyGrowthIntegrations() {
  const analyticsResult = await logGrowthEvent({
    event: "integration_verify_event",
    source: "admin_verify",
    properties: {
      verified: true,
    },
    }).catch((error) => ({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }));
  const summary = buildGrowthIntegrationSummary({
    analyticsResult,
  });
  const verifiedAtIso = new Date().toISOString();

  if (db) {
    const verificationRef = await db.collection("growthIntegrationVerifications").add({
      verified_at_iso: verifiedAtIso,
      verified_at: admin.firestore.FieldValue.serverTimestamp(),
      summary,
    });

    return {
      ...summary,
      verificationId: verificationRef.id,
      verifiedAt: verifiedAtIso,
    };
  }

  return {
    ...summary,
    verificationId: null,
    verifiedAt: verifiedAtIso,
  };
}

export async function ingestNitrosendWebhook(payload: unknown) {
  if (!db) {
    throw new Error("Database not available");
  }

  const body = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const externalCampaignId =
    normalizeString(body.campaignId) ||
    normalizeString(body.campaign_id) ||
    null;
  const eventType = normalizeCampaignEventType(
    body.event || body.eventType || body.type || body.status,
  );
  const recipient =
    normalizeString(body.email) ||
    normalizeString(body.recipient) ||
    normalizeString(body.contactEmail) ||
    null;
  const receivedAtIso = new Date().toISOString();

  let localCampaignId: string | null = null;
  if (externalCampaignId) {
    const snapshot = await db
      .collection("growthCampaigns")
      .where("nitrosend_campaign_id", "==", externalCampaignId)
      .limit(1)
      .get();
    localCampaignId = snapshot.empty ? null : snapshot.docs[0].id;
  }

  await db.collection("growth_campaign_events").add({
    campaign_id: localCampaignId || externalCampaignId || "unknown",
    local_campaign_id: localCampaignId,
    nitrosend_campaign_id: externalCampaignId,
    event_type: eventType,
    recipient,
    payload: body,
    received_at_iso: receivedAtIso,
    received_at: admin.firestore.FieldValue.serverTimestamp(),
    source: "nitrosend",
  });

  if (localCampaignId) {
    await db.collection("growthCampaigns").doc(localCampaignId).set(
      {
        event_counts: {
          [eventType]: admin.firestore.FieldValue.increment(1),
        },
        response_tracking: {
          last_event_type: eventType,
          last_event_at: receivedAtIso,
          last_recipient: recipient,
        },
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }

  return {
    localCampaignId,
    nitrosendCampaignId: externalCampaignId,
    eventType,
    recipient,
  };
}

export async function ingestSendGridWebhook(payload: unknown) {
  if (!db) {
    throw new Error("Database not available");
  }

  const events = Array.isArray(payload) ? payload : [payload];
  const results: Array<Record<string, unknown>> = [];

  for (const item of events) {
    const event = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const localCampaignId =
      normalizeString(event.bp_campaign_id) ||
      normalizeString(event.campaign_id) ||
      null;
    const eventType = normalizeCampaignEventType(event.event);
    const recipient = normalizeString(event.email);
    const receivedAtIso =
      typeof event.timestamp === "number"
        ? new Date(event.timestamp * 1000).toISOString()
        : new Date().toISOString();

    await db.collection("growth_campaign_events").add({
      campaign_id: localCampaignId || "unknown",
      local_campaign_id: localCampaignId,
      sendgrid_message_id: normalizeString(event.sg_message_id),
      event_type: eventType,
      recipient,
      payload: event,
      received_at_iso: receivedAtIso,
      received_at: admin.firestore.FieldValue.serverTimestamp(),
      source: "sendgrid",
    });

    if (localCampaignId) {
      await db.collection("growthCampaigns").doc(localCampaignId).set(
        {
          event_counts: {
            [eventType]: admin.firestore.FieldValue.increment(1),
          },
          response_tracking: {
            last_event_type: eventType,
            last_event_at: receivedAtIso,
            last_recipient: recipient,
          },
          updated_at: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }

    results.push({
      localCampaignId,
      eventType,
      recipient,
    });
  }

  return {
    count: results.length,
    results,
  };
}
