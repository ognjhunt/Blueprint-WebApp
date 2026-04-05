import { Client } from "@notionhq/client";
import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { getConfiguredEnvValue } from "../config/env";
import {
  type ContentOutcomeReviewRecord,
  listContentOutcomeReviews,
} from "./content-ops";
import { verifyGrowthIntegrations } from "./growth-ops";

type SyncCounts = { created: number; updated: number; errors: number };

type GrowthStudioSyncResult = {
  shipBroadcastApprovalQueue: SyncCounts;
  campaignDrafts: SyncCounts;
  creativeRuns: SyncCounts;
  integrationChecks: SyncCounts;
  contentOutcomeReviews: SyncCounts;
  processedCount: number;
  failedCount: number;
};

type NotionClientAny = Client & {
  dataSources?: {
    query: (params: Record<string, unknown>) => Promise<{ results?: Array<Record<string, any>> }>;
  };
  databases: {
    query: (params: Record<string, unknown>) => Promise<{ results?: Array<Record<string, any>> }>;
  };
  pages: {
    create: (params: Record<string, unknown>) => Promise<{ id: string }>;
    update: (params: Record<string, unknown>) => Promise<{ id: string }>;
  };
};

const NOTION_TEXT_LIMIT = 1800;

function getNotionClient() {
  const apiKey = getConfiguredEnvValue("NOTION_API_KEY", "NOTION_API_TOKEN");
  if (!apiKey) {
    return null;
  }
  return new Client({ auth: apiKey });
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map((entry) => normalizeString(entry)).filter(Boolean)
    : [];
}

function isValidEmail(value: string | null | undefined) {
  return Boolean(value && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value));
}

function truncateText(value: string, limit = NOTION_TEXT_LIMIT) {
  const normalized = normalizeString(value);
  if (normalized.length <= limit) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(limit - 1, 1)).trimEnd()}…`;
}

function joinList(value: unknown) {
  return truncateText(normalizeStringArray(value).join("\n"));
}

function joinNotes(...values: Array<string | null | undefined>) {
  return truncateText(
    values
      .map((value) => normalizeString(value))
      .filter(Boolean)
      .join("\n"),
  );
}

function titleProperty(content: string) {
  return {
    title: [{ text: { content: truncateText(content || "Untitled") } }],
  };
}

function richTextProperty(content: string | null | undefined) {
  const normalized = truncateText(content || "");
  return {
    rich_text: normalized
      ? [{ text: { content: normalized } }]
      : [],
  };
}

function selectProperty(content: string | null | undefined) {
  const normalized = normalizeString(content);
  return {
    select: normalized ? { name: normalized } : null,
  };
}

function numberProperty(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value);
  return {
    number: Number.isFinite(numeric) ? numeric : null,
  };
}

function dateProperty(value: string | null | undefined) {
  const normalized = normalizeString(value);
  return {
    date: normalized ? { start: normalized } : null,
  };
}

function checkboxProperty(value: unknown) {
  return {
    checkbox: value === true,
  };
}

function emailProperty(value: string | null | undefined) {
  const normalized = normalizeString(value);
  return {
    email: isValidEmail(normalized) ? normalized : null,
  };
}

function multiSelectProperty(values: string[]) {
  const unique = [...new Set(values.map((value) => normalizeString(value)).filter(Boolean))];
  return {
    multi_select: unique.map((value) => ({ name: value })),
  };
}

function extractRichText(property: unknown) {
  if (!property || typeof property !== "object") {
    return "";
  }
  const richText = (property as { rich_text?: Array<{ plain_text?: string }> }).rich_text;
  return richText?.[0]?.plain_text || "";
}

function extractSelect(property: unknown) {
  if (!property || typeof property !== "object") {
    return "";
  }
  return (property as { select?: { name?: string } }).select?.name || "";
}

function extractTimestampFromFirestore(value: unknown) {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && typeof (value as { toDate?: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return null;
}

function normalizeCampaignSendStatus(value: unknown) {
  const raw = normalizeString(value).toLowerCase();
  switch (raw) {
    case "draft":
    case "pending_approval":
    case "approved":
    case "rejected":
    case "queued":
    case "sent":
    case "failed":
    case "auto_approved":
    case "operator_approved":
    case "executing":
      return raw;
    default:
      return raw ? "draft" : "draft";
  }
}

function normalizeCreativeRunStatus(value: unknown) {
  const raw = normalizeString(value).toLowerCase();
  switch (raw) {
    case "prompt_pack_generated":
    case "assets_generated":
    case "rendered":
    case "failed":
    case "skipped_existing":
      return raw;
    default:
      return "unknown";
  }
}

function normalizeContentAssetType(value: unknown) {
  const raw = normalizeString(value).toLowerCase();
  switch (raw) {
    case "ship_broadcast":
    case "landing_page":
    case "email":
    case "reel":
      return raw;
    default:
      return "other";
  }
}

function normalizeReviewChannels(values: unknown) {
  const allowed = new Set(["sendgrid", "landing_page", "hosted_review", "web"]);
  const normalized = normalizeStringArray(values).map((value) => value.toLowerCase());
  if (normalized.length === 0) {
    return ["other"];
  }

  const mapped = normalized.map((value) => (allowed.has(value) ? value : "other"));
  return [...new Set(mapped)];
}

async function queryExistingPageByRichText(params: {
  notion: NotionClientAny;
  databaseId: string;
  propertyName: string;
  value: string;
}) {
  const queryPayload = {
    filter: {
      property: params.propertyName,
      rich_text: { equals: params.value },
    },
    page_size: 1,
  };
  const response = params.notion.dataSources?.query
    ? await params.notion.dataSources.query({
        data_source_id: params.databaseId,
        ...queryPayload,
      })
    : await params.notion.databases.query({
        database_id: params.databaseId,
        ...queryPayload,
      });

  return Array.isArray(response.results) && response.results.length > 0
    ? response.results[0]
    : null;
}

async function queryExistingPageByTitle(params: {
  notion: NotionClientAny;
  databaseId: string;
  propertyName: string;
  value: string;
}) {
  const queryPayload = {
    filter: {
      property: params.propertyName,
      title: { equals: params.value },
    },
    page_size: 1,
  };
  const response = params.notion.dataSources?.query
    ? await params.notion.dataSources.query({
        data_source_id: params.databaseId,
        ...queryPayload,
      })
    : await params.notion.databases.query({
        database_id: params.databaseId,
        ...queryPayload,
      });

  return Array.isArray(response.results) && response.results.length > 0
    ? response.results[0]
    : null;
}

async function upsertPageByRichText(params: {
  notion: NotionClientAny;
  databaseId: string;
  propertyName: string;
  value: string;
  properties: Record<string, unknown>;
}) {
  const useDataSourceParent = Boolean(params.notion.dataSources);
  const existing = await queryExistingPageByRichText(params);

  if (existing?.id) {
    await params.notion.pages.update({
      page_id: existing.id,
      properties: params.properties,
    });
    return "updated" as const;
  }

  await params.notion.pages.create({
    parent: useDataSourceParent
      ? { data_source_id: params.databaseId }
      : { database_id: params.databaseId },
    properties: params.properties,
  });
  return "created" as const;
}

async function upsertPageByTitle(params: {
  notion: NotionClientAny;
  databaseId: string;
  titlePropertyName: string;
  titleValue: string;
  properties: Record<string, unknown>;
}) {
  const useDataSourceParent = Boolean(params.notion.dataSources);
  const existing = await queryExistingPageByTitle({
    notion: params.notion,
    databaseId: params.databaseId,
    propertyName: params.titlePropertyName,
    value: params.titleValue,
  });

  if (existing?.id) {
    await params.notion.pages.update({
      page_id: existing.id,
      properties: params.properties,
    });
    return "updated" as const;
  }

  await params.notion.pages.create({
    parent: useDataSourceParent
      ? { data_source_id: params.databaseId }
      : { database_id: params.databaseId },
    properties: params.properties,
  });
  return "created" as const;
}

function incrementCounts(counts: SyncCounts, status: "created" | "updated" | "errors") {
  counts[status] += 1;
}

function sumSyncCounts(...counts: SyncCounts[]) {
  return counts.reduce(
    (total, current) => ({
      created: total.created + current.created,
      updated: total.updated + current.updated,
      errors: total.errors + current.errors,
    }),
    { created: 0, updated: 0, errors: 0 },
  );
}

async function syncLegacyFirestoreToNotion(params?: { limit?: number }): Promise<SyncCounts> {
  const notion = getNotionClient() as NotionClientAny | null;
  if (!notion || !db) {
    return { created: 0, updated: 0, errors: 0 };
  }
  const firestore = db;

  const limit = params?.limit || 50;
  const counts: SyncCounts = { created: 0, updated: 0, errors: 0 };
  const configs = [
    {
      collection: "growthCampaigns",
      envKey: "NOTION_CAMPAIGNS_DB_ID",
      map: (id: string, data: Record<string, unknown>) => ({
        Name: titleProperty(String(data.name || id)),
        external_id: richTextProperty(id),
        status: selectProperty(String(data.send_status || data.status || "draft")),
        channel: richTextProperty(String(data.channel || "")),
      }),
    },
    {
      collection: "creative_factory_runs",
      envKey: "NOTION_CREATIVE_RUNS_DB_ID",
      map: (id: string, data: Record<string, unknown>) => ({
        Name: titleProperty(String(data.sku_name || id)),
        external_id: richTextProperty(id),
        status: selectProperty(String(data.status || "created")),
        research_topic: richTextProperty(String(data.research_topic || "")),
      }),
    },
    {
      collection: "agent_graduation_status",
      envKey: "NOTION_GRADUATION_DB_ID",
      map: (id: string, data: Record<string, unknown>) => ({
        Name: titleProperty(String(data.lane || id)),
        external_id: richTextProperty(id),
        phase: richTextProperty(String(data.currentPhase || 1)),
        recommendation: selectProperty(String(data.recommendation || "hold")),
      }),
    },
    {
      collection: "sla_tracking",
      envKey: "NOTION_SLA_DB_ID",
      map: (id: string, data: Record<string, unknown>) => ({
        Name: titleProperty(String(data.requestId || id)),
        external_id: richTextProperty(id),
        stage: selectProperty(String(data.currentStage || "scoping")),
        status: selectProperty(String(data.status || "on_track")),
        buyer_email: richTextProperty(String(data.buyerEmail || "")),
      }),
    },
  ] as const;

  for (const config of configs) {
    const databaseId = getConfiguredEnvValue(config.envKey);
    if (!databaseId) {
      continue;
    }

    try {
      const snapshot = await firestore.collection(config.collection).limit(limit).get();
      for (const doc of snapshot.docs) {
        try {
          const status = await upsertPageByRichText({
            notion,
            databaseId,
            propertyName: "external_id",
            value: doc.id,
            properties: config.map(doc.id, doc.data() as Record<string, unknown>),
          });
          incrementCounts(counts, status);
        } catch {
          incrementCounts(counts, "errors");
        }
      }
    } catch {
      incrementCounts(counts, "errors");
    }
  }

  return counts;
}

async function syncShipBroadcastApprovalQueue(params: {
  notion: NotionClientAny;
  databaseId: string;
  limit: number;
  syncedAtIso: string;
}) {
  if (!db) {
    return { created: 0, updated: 0, errors: 0 };
  }
  const firestore = db;
  const counts: SyncCounts = { created: 0, updated: 0, errors: 0 };
  const sourceLimit = Math.min(Math.max(params.limit * 10, 100), 500);

  const snapshot = await firestore
    .collection("growthCampaigns")
    .orderBy("created_at", "desc")
    .limit(sourceLimit)
    .get();

  const shipBroadcastDocs = snapshot.docs
    .filter((doc) => {
      const data = doc.data() as Record<string, unknown>;
      const automationContext =
        data.automation_context && typeof data.automation_context === "object"
          ? (data.automation_context as Record<string, unknown>)
          : {};
      const assetKey = normalizeString(automationContext.asset_key).toLowerCase();
      const assetType = normalizeString(automationContext.asset_type).toLowerCase();
      return assetType === "ship_broadcast" || assetKey.startsWith("ship-broadcast:");
    })
    .slice(0, params.limit);

  for (const doc of shipBroadcastDocs) {
    try {
      const data = doc.data() as Record<string, unknown>;
      const automationContext =
        data.automation_context && typeof data.automation_context === "object"
          ? (data.automation_context as Record<string, unknown>)
          : {};

      const status = await upsertPageByRichText({
        notion: params.notion,
        databaseId: params.databaseId,
        propertyName: "Campaign ID",
        value: doc.id,
        properties: {
          Name: titleProperty(normalizeString(data.name) || `Ship broadcast ${doc.id}`),
          "Campaign ID": richTextProperty(doc.id),
          "Ledger ID": richTextProperty(normalizeString(data.last_ledger_doc_id)),
          "Asset Key": richTextProperty(normalizeString(automationContext.asset_key)),
          "Asset Type": selectProperty("ship_broadcast"),
          "Send Status": selectProperty(normalizeCampaignSendStatus(data.send_status)),
          "Recipient Count": numberProperty(data.recipient_count),
          "Source Issue IDs": richTextProperty(joinList(automationContext.source_issue_ids)),
          "Proof Links": richTextProperty(joinList(automationContext.proof_links)),
          "Approval Reason": richTextProperty(normalizeString(data.approval_reason)),
          "Last Synced At": dateProperty(params.syncedAtIso),
          "Authoritative Source": selectProperty("Paperclip / WebApp API"),
          Notes: richTextProperty(
            joinNotes(
              normalizeString(data.rejected_reason),
              normalizeString(data.last_execution_error),
            ),
          ),
        },
      });
      incrementCounts(counts, status);
    } catch {
      incrementCounts(counts, "errors");
    }
  }

  return counts;
}

async function syncCampaignDrafts(params: {
  notion: NotionClientAny;
  databaseId: string;
  limit: number;
  syncedAtIso: string;
}) {
  if (!db) {
    return { created: 0, updated: 0, errors: 0 };
  }
  const firestore = db;
  const counts: SyncCounts = { created: 0, updated: 0, errors: 0 };
  const snapshot = await firestore
    .collection("growthCampaigns")
    .orderBy("created_at", "desc")
    .limit(params.limit)
    .get();

  for (const doc of snapshot.docs) {
    try {
      const data = doc.data() as Record<string, unknown>;
      const automationContext =
        data.automation_context && typeof data.automation_context === "object"
          ? (data.automation_context as Record<string, unknown>)
          : {};
      const creativeContext =
        data.creative_context && typeof data.creative_context === "object"
          ? (data.creative_context as Record<string, unknown>)
          : {};
      const responseTracking =
        data.response_tracking && typeof data.response_tracking === "object"
          ? (data.response_tracking as Record<string, unknown>)
          : {};

      const status = await upsertPageByRichText({
        notion: params.notion,
        databaseId: params.databaseId,
        propertyName: "Campaign ID",
        value: doc.id,
        properties: {
          Name: titleProperty(normalizeString(data.name) || doc.id),
          "Campaign ID": richTextProperty(doc.id),
          Subject: richTextProperty(normalizeString(data.subject)),
          Channel: selectProperty(normalizeString(data.channel) || "sendgrid"),
          "Send Status": selectProperty(normalizeCampaignSendStatus(data.send_status)),
          "Recipient Count": numberProperty(data.recipient_count),
          "Creative Run ID": richTextProperty(normalizeString(creativeContext.creative_run_id)),
          "Asset Key": richTextProperty(normalizeString(automationContext.asset_key)),
          "Created At": dateProperty(normalizeString(data.created_at_iso)),
          "Last Event Type": richTextProperty(normalizeString(responseTracking.last_event_type)),
          "Last Recipient": emailProperty(normalizeString(responseTracking.last_recipient)),
          "Last Synced At": dateProperty(params.syncedAtIso),
          "Authoritative Source": selectProperty("WebApp API / SendGrid"),
        },
      });
      incrementCounts(counts, status);
    } catch {
      incrementCounts(counts, "errors");
    }
  }

  return counts;
}

async function syncCreativeRuns(params: {
  notion: NotionClientAny;
  databaseId: string;
  limit: number;
  syncedAtIso: string;
}) {
  if (!db) {
    return { created: 0, updated: 0, errors: 0 };
  }
  const firestore = db;
  const counts: SyncCounts = { created: 0, updated: 0, errors: 0 };
  const snapshot = await firestore
    .collection("creative_factory_runs")
    .orderBy("created_at", "desc")
    .limit(params.limit)
    .get();

  for (const doc of snapshot.docs) {
    try {
      const data = doc.data() as Record<string, unknown>;
      const remotionReel =
        data.remotion_reel && typeof data.remotion_reel === "object"
          ? (data.remotion_reel as Record<string, unknown>)
          : {};

      const status = await upsertPageByRichText({
        notion: params.notion,
        databaseId: params.databaseId,
        propertyName: "Creative Run ID",
        value: doc.id,
        properties: {
          Name: titleProperty(normalizeString(data.sku_name) || `Creative run ${doc.id}`),
          "Creative Run ID": richTextProperty(doc.id),
          "SKU Name": richTextProperty(normalizeString(data.sku_name)),
          "Research Topic": richTextProperty(normalizeString(data.research_topic)),
          "Rollout Variant": richTextProperty(normalizeString(data.rollout_variant)),
          Status: selectProperty(normalizeCreativeRunStatus(data.status)),
          "Generated Images": numberProperty(Array.isArray(data.image_batch) ? data.image_batch.length : 0),
          "Buyer Objections": richTextProperty(joinList(data.buyer_objections)),
          "Reel URL / Storage URI": richTextProperty(
            normalizeString(remotionReel.storage_uri)
            || normalizeString(remotionReel.output_path),
          ),
          "Created At": dateProperty(normalizeString(data.created_at_iso)),
          "Last Synced At": dateProperty(params.syncedAtIso),
          "Authoritative Source": selectProperty("WebApp API / Storage"),
        },
      });
      incrementCounts(counts, status);
    } catch {
      incrementCounts(counts, "errors");
    }
  }

  return counts;
}

async function syncIntegrationChecks(params: {
  notion: NotionClientAny;
  databaseId: string;
  limit: number;
  syncedAtIso: string;
}) {
  if (!db) {
    return { created: 0, updated: 0, errors: 0 };
  }
  const firestore = db;
  const counts: SyncCounts = { created: 0, updated: 0, errors: 0 };
  const snapshot = await firestore
    .collection("growthIntegrationVerifications")
    .orderBy("verified_at", "desc")
    .limit(params.limit)
    .get();

  for (const doc of snapshot.docs) {
    try {
      const data = doc.data() as Record<string, unknown>;
      const summary =
        data.summary && typeof data.summary === "object"
          ? (data.summary as Record<string, any>)
          : {};
      const analytics =
        summary.analytics && typeof summary.analytics === "object"
          ? (summary.analytics as Record<string, any>)
          : {};
      const runway =
        summary.runway && typeof summary.runway === "object"
          ? (summary.runway as Record<string, any>)
          : {};
      const elevenlabs =
        summary.elevenlabs && typeof summary.elevenlabs === "object"
          ? (summary.elevenlabs as Record<string, any>)
          : {};
      const telephony =
        summary.telephony && typeof summary.telephony === "object"
          ? (summary.telephony as Record<string, any>)
          : {};
      const researchOutbound =
        summary.researchOutbound && typeof summary.researchOutbound === "object"
          ? (summary.researchOutbound as Record<string, any>)
          : {};
      const sendgrid =
        summary.sendgrid && typeof summary.sendgrid === "object"
          ? (summary.sendgrid as Record<string, any>)
          : {};
      const sendgridWebhook =
        summary.sendgridWebhook && typeof summary.sendgridWebhook === "object"
          ? (summary.sendgridWebhook as Record<string, any>)
          : {};
      const googleImage =
        summary.googleImage && typeof summary.googleImage === "object"
          ? (summary.googleImage as Record<string, any>)
          : {};

      const title = `Growth Studio verification ${doc.id}`;
      const status = await upsertPageByTitle({
        notion: params.notion,
        databaseId: params.databaseId,
        titlePropertyName: "Name",
        titleValue: title,
        properties: {
          Name: titleProperty(title),
          "Checked At": dateProperty(
            normalizeString(data.verified_at_iso) || extractTimestampFromFirestore(data.verified_at),
          ),
          "SendGrid Configured": checkboxProperty(sendgrid.configured === true),
          "SendGrid Webhook Configured": checkboxProperty(sendgridWebhook.configured === true),
          "Google Image Configured": checkboxProperty(googleImage.configured === true),
          "Google Image State": selectProperty(normalizeString(googleImage.executionState) || "not_configured"),
          "Runway Configured": checkboxProperty(runway.configured === true),
          "ElevenLabs Configured": checkboxProperty(elevenlabs.configured === true),
          "Telephony Configured": checkboxProperty(telephony.configured === true),
          "Research Outbound Configured": checkboxProperty(researchOutbound.configured === true),
          "Analytics Ingest Enabled": checkboxProperty(analytics.firstPartyIngest?.enabled === true),
          "GA4 Configured": checkboxProperty(analytics.ga4?.configured === true),
          "PostHog Configured": checkboxProperty(analytics.posthog?.configured === true),
          Notes: richTextProperty(
            joinNotes(
              `verification_id:${doc.id}`,
              normalizeString(analytics.alignment?.note),
              normalizeString(googleImage.note),
              normalizeString(googleImage.lastError),
              `last_synced_at:${params.syncedAtIso}`,
            ),
          ),
          "Authoritative Source": selectProperty("WebApp API / Runtime config"),
        },
      });
      incrementCounts(counts, status);
    } catch {
      incrementCounts(counts, "errors");
    }
  }

  return counts;
}

async function syncContentOutcomeReviews(params: {
  notion: NotionClientAny;
  databaseId: string;
  limit: number;
}) {
  const counts: SyncCounts = { created: 0, updated: 0, errors: 0 };
  const reviews = await listContentOutcomeReviews({ limit: params.limit });

  for (const review of reviews) {
    try {
      const title = truncateText(
        `${review.assetKey || "review"} @ ${normalizeString(review.recordedAt) || "unknown-time"}`,
      );
      const properties = {
        Name: titleProperty(title),
        "Asset Key": richTextProperty(review.assetKey),
        "Issue ID": richTextProperty(review.issueId),
        "Asset Type": selectProperty(normalizeContentAssetType(review.assetType)),
        Channels: multiSelectProperty(normalizeReviewChannels(review.channels)),
        Summary: richTextProperty(review.summary),
        "What Worked": richTextProperty(truncateText(review.whatWorked.join("\n"))),
        "What Did Not": richTextProperty(truncateText(review.whatDidNot.join("\n"))),
        "Next Recommendation": richTextProperty(review.nextRecommendation),
        "Evidence Source": richTextProperty(review.evidenceSource),
        Confidence: numberProperty(review.confidence),
        "Recorded At": dateProperty(review.recordedAt),
        "Recorded By": richTextProperty(review.recordedBy),
        "Authoritative Source": selectProperty("Operator review mirror"),
      };

      const status = review.issueId
        ? await upsertPageByRichText({
            notion: params.notion,
            databaseId: params.databaseId,
            propertyName: "Issue ID",
            value: review.issueId,
            properties,
          })
        : await upsertPageByTitle({
            notion: params.notion,
            databaseId: params.databaseId,
            titlePropertyName: "Name",
            titleValue: title,
            properties,
          });
      incrementCounts(counts, status);
    } catch {
      incrementCounts(counts, "errors");
    }
  }

  return counts;
}

export async function syncGrowthStudioToNotion(params?: {
  limit?: number;
  refreshIntegrationSnapshot?: boolean;
}): Promise<GrowthStudioSyncResult> {
  const notion = getNotionClient() as NotionClientAny | null;
  const emptyCounts: SyncCounts = { created: 0, updated: 0, errors: 0 };

  if (!notion || !db) {
    return {
      shipBroadcastApprovalQueue: emptyCounts,
      campaignDrafts: emptyCounts,
      creativeRuns: emptyCounts,
      integrationChecks: emptyCounts,
      contentOutcomeReviews: emptyCounts,
      processedCount: 0,
      failedCount: 0,
    };
  }

  const limit = Math.max(1, Math.min(params?.limit ?? 50, 200));
  const syncedAtIso = new Date().toISOString();

  if (params?.refreshIntegrationSnapshot) {
    await verifyGrowthIntegrations().catch(() => null);
  }

  const shipBroadcastApprovalQueueDbId = getConfiguredEnvValue("NOTION_GROWTH_STUDIO_SHIP_BROADCAST_DB_ID");
  const campaignDraftsDbId = getConfiguredEnvValue("NOTION_GROWTH_STUDIO_CAMPAIGN_DRAFTS_DB_ID");
  const creativeRunsDbId = getConfiguredEnvValue("NOTION_GROWTH_STUDIO_CREATIVE_RUNS_DB_ID");
  const integrationChecksDbId = getConfiguredEnvValue("NOTION_GROWTH_STUDIO_INTEGRATION_CHECKS_DB_ID");
  const contentReviewsDbId = getConfiguredEnvValue("NOTION_GROWTH_STUDIO_CONTENT_REVIEWS_DB_ID");

  const shipBroadcastApprovalQueue = shipBroadcastApprovalQueueDbId
    ? await syncShipBroadcastApprovalQueue({
        notion,
        databaseId: shipBroadcastApprovalQueueDbId,
        limit,
        syncedAtIso,
      }).catch(() => ({ created: 0, updated: 0, errors: 1 }))
    : emptyCounts;

  const campaignDrafts = campaignDraftsDbId
    ? await syncCampaignDrafts({
        notion,
        databaseId: campaignDraftsDbId,
        limit,
        syncedAtIso,
      }).catch(() => ({ created: 0, updated: 0, errors: 1 }))
    : emptyCounts;

  const creativeRuns = creativeRunsDbId
    ? await syncCreativeRuns({
        notion,
        databaseId: creativeRunsDbId,
        limit,
        syncedAtIso,
      }).catch(() => ({ created: 0, updated: 0, errors: 1 }))
    : emptyCounts;

  const integrationChecks = integrationChecksDbId
    ? await syncIntegrationChecks({
        notion,
        databaseId: integrationChecksDbId,
        limit,
        syncedAtIso,
      }).catch(() => ({ created: 0, updated: 0, errors: 1 }))
    : emptyCounts;

  const contentOutcomeReviews = contentReviewsDbId
    ? await syncContentOutcomeReviews({
        notion,
        databaseId: contentReviewsDbId,
        limit,
      }).catch(() => ({ created: 0, updated: 0, errors: 1 }))
    : emptyCounts;

  const totals = sumSyncCounts(
    shipBroadcastApprovalQueue,
    campaignDrafts,
    creativeRuns,
    integrationChecks,
    contentOutcomeReviews,
  );

  return {
    shipBroadcastApprovalQueue,
    campaignDrafts,
    creativeRuns,
    integrationChecks,
    contentOutcomeReviews,
    processedCount: totals.created + totals.updated,
    failedCount: totals.errors,
  };
}

export async function syncFirestoreToNotion(params?: { limit?: number }): Promise<SyncCounts> {
  return syncLegacyFirestoreToNotion(params);
}

export async function syncNotionToFirestore(params?: { limit?: number }): Promise<SyncCounts> {
  const notion = getNotionClient() as NotionClientAny | null;
  if (!notion || !db) {
    return { created: 0, updated: 0, errors: 0 };
  }

  const databaseId = getConfiguredEnvValue("NOTION_TASKS_DB_ID");
  if (!databaseId) {
    return { created: 0, updated: 0, errors: 0 };
  }

  let updated = 0;
  let errors = 0;

  try {
    const response = notion.dataSources?.query
      ? await notion.dataSources.query({
          data_source_id: databaseId,
          page_size: params?.limit || 50,
          sorts: [{ timestamp: "last_edited_time", direction: "descending" }],
        })
      : await notion.databases.query({
          database_id: databaseId,
          page_size: params?.limit || 50,
          sorts: [{ timestamp: "last_edited_time", direction: "descending" }],
        });

    for (const page of response.results || []) {
      try {
        const properties = (page as { properties: Record<string, unknown> }).properties || {};
        const externalId = extractRichText(properties.external_id);
        const targetCollection =
          extractRichText(properties.target_collection) || "inboundRequests";
        const approvedBy = extractRichText(properties.approved_by);
        const priorityOverride = extractSelect(properties.priority_override);
        const notes = extractRichText(properties.notes);

        if (!externalId || (!approvedBy && !priorityOverride && !notes)) {
          continue;
        }

        await db.collection(targetCollection).doc(externalId).set(
          {
            notion_override: {
              approved_by: approvedBy || null,
              priority_override: priorityOverride || null,
              notes: notes || null,
              source_page_id: page.id,
              synced_at: new Date().toISOString(),
            },
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
        updated += 1;
      } catch {
        errors += 1;
      }
    }
  } catch {
    errors += 1;
  }

  return { created: 0, updated, errors };
}

export async function runNotionBidirectionalSync(params?: {
  limit?: number;
  refreshIntegrationSnapshot?: boolean;
}): Promise<{ processedCount: number; failedCount: number }> {
  const toNotion = await syncFirestoreToNotion(params);
  const growthStudio = await syncGrowthStudioToNotion({
    ...params,
    refreshIntegrationSnapshot: params?.refreshIntegrationSnapshot ?? true,
  });
  const toFirestore = await syncNotionToFirestore(params);

  return {
    processedCount:
      toNotion.created +
      toNotion.updated +
      growthStudio.processedCount +
      toFirestore.updated,
    failedCount:
      toNotion.errors +
      growthStudio.failedCount +
      toFirestore.errors,
  };
}

export type { SyncCounts };
