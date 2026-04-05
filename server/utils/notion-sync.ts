import { Client } from "@notionhq/client";
import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { getConfiguredEnvValue } from "../config/env";
import { buildGrowthIntegrationSummary } from "./provider-status";

type SyncCounts = { created: number; updated: number; errors: number };

function getNotionClient() {
  const apiKey = getConfiguredEnvValue("NOTION_API_KEY", "NOTION_API_TOKEN");
  if (!apiKey) {
    return null;
  }
  return new Client({ auth: apiKey });
}

function titleProperty(content: string) {
  return {
    title: [{ text: { content } }],
  };
}

function richTextProperty(content: string) {
  return {
    rich_text: [{ text: { content } }],
  };
}

function selectProperty(content: string) {
  return {
    select: { name: content || "unknown" },
  };
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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

function normalizeDateTime(value: unknown) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? trimmed : parsed.toISOString();
  }

  if (typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  if (typeof value === "object" && typeof (value as { toDate?: () => Date }).toDate === "function") {
    const parsed = (value as { toDate: () => Date }).toDate();
    return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : null;
  }

  return null;
}

function summarizeParts(parts: Array<string | null | undefined>) {
  return parts
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean)
    .join(" • ");
}

const GROWTH_MIRROR_DB_ID = "f83b6c53-a33a-4790-9ca4-786dddadad46";

type GrowthMirrorSourceAuthority = "app/API" | "Paperclip" | "Repo" | "External";

type GrowthMirrorEntry = {
  title: string;
  system: "Cross-System" | "WebApp" | "Capture" | "Pipeline" | "Validation";
  businessLane: "Growth";
  lifecycleStage: string;
  workType: "Refresh";
  priority: "P0" | "P1" | "P2" | "P3";
  substage: string;
  outputLocation: "Notion";
  executionSurface: "Repo";
  sourceAuthority: GrowthMirrorSourceAuthority;
  sourceCollection: string;
  sourceId: string;
  naturalKey: string;
  needsFounder?: boolean;
  lastStatusChange?: string | null;
  dueDate?: string | null;
};

type GrowthMirrorCounts = SyncCounts & {
  skipped: number;
  syncedAt: string | null;
  databaseId: string | null;
  sourceCounts: Record<string, number>;
};

function buildGrowthMirrorProperties(entry: GrowthMirrorEntry, syncedAt: string) {
  const properties: Record<string, unknown> = {
    Title: titleProperty(entry.title),
    Priority: selectProperty(entry.priority),
    System: selectProperty(entry.system),
    "Business Lane": selectProperty(entry.businessLane),
    "Lifecycle Stage": selectProperty(entry.lifecycleStage),
    "Work Type": selectProperty(entry.workType),
    Substage: richTextProperty(entry.substage),
    "Output Location": selectProperty(entry.outputLocation),
    "Execution Surface": selectProperty(entry.executionSurface),
    "Source Authority": selectProperty(entry.sourceAuthority),
    "Last Synced At": {
      date: {
        start: syncedAt,
      },
    },
  };

  if (entry.needsFounder !== undefined) {
    properties["Needs Founder"] = {
      checkbox: entry.needsFounder,
    };
  }

  if (entry.lastStatusChange) {
    properties["Last Status Change"] = {
      date: {
        start: entry.lastStatusChange,
      },
    };
  }

  if (entry.dueDate) {
    properties["Due Date"] = {
      date: {
        start: entry.dueDate,
      },
    };
  }

  return properties;
}

async function ensureGrowthMirrorSchema(notion: any, databaseId: string) {
  const database = await notion.databases.retrieve({ database_id: databaseId });
  const properties = (database?.properties || {}) as Record<string, unknown>;
  const schemaUpdate: Record<string, unknown> = {};

  if (!properties["Source Authority"]) {
    schemaUpdate["Source Authority"] = {
      select: {
        options: [
          { name: "app/API", color: "blue" },
          { name: "Paperclip", color: "purple" },
          { name: "Repo", color: "green" },
          { name: "External", color: "gray" },
        ],
      },
    };
  }

  if (!properties["Last Synced At"]) {
    schemaUpdate["Last Synced At"] = { date: {} };
  }

  if (Object.keys(schemaUpdate).length > 0) {
    await notion.databases.update({
      database_id: databaseId,
      properties: schemaUpdate,
    });
  }
}

async function queryMirrorPage(
  notion: any,
  databaseId: string,
  entry: GrowthMirrorEntry,
) {
  const response = await notion.databases.query({
    database_id: databaseId,
    filter: {
      and: [
        { property: "Title", title: { equals: entry.title } },
        { property: "System", select: { equals: entry.system } },
        { property: "Work Type", select: { equals: entry.workType } },
        { property: "Source Authority", select: { equals: entry.sourceAuthority } },
      ],
    },
    page_size: 5,
  });

  return Array.isArray(response.results) ? response.results : [];
}

async function upsertGrowthMirrorPage(
  notion: any,
  databaseId: string,
  entry: GrowthMirrorEntry,
  syncedAt: string,
) {
  const matches = await queryMirrorPage(notion, databaseId, entry);
  const properties = buildGrowthMirrorProperties(entry, syncedAt);

  if (matches.length > 0) {
    const response = await notion.pages.update({
      page_id: matches[0].id,
      properties,
    });
    return { pageId: response.id, status: "updated" as const };
  }

  const response = await notion.pages.create({
    parent: { database_id: databaseId },
    properties,
  });
  return { pageId: response.id, status: "created" as const };
}

function getGrowthMirrorDatabaseId() {
  return getConfiguredEnvValue("NOTION_GROWTH_MIRROR_DB_ID") || GROWTH_MIRROR_DB_ID;
}

async function queryRecentDocs(collection: string, orderField: string, limit: number) {
  if (!db) {
    return [];
  }

  try {
    const snapshot = await db
      .collection(collection)
      .orderBy(orderField, "desc")
      .limit(limit)
      .get();
    return snapshot.docs;
  } catch {
    const snapshot = await db.collection(collection).limit(limit).get();
    return snapshot.docs;
  }
}

function toGrowthMirrorEntryFromCampaign(
  doc: { id: string; data: () => Record<string, unknown> },
): GrowthMirrorEntry | null {
  const data = doc.data();
  const status = normalizeString(data.send_status || data.status || "draft");
  if (status !== "draft") {
    return null;
  }

  const channel = normalizeString(data.channel || "sendgrid");
  const recipientCount =
    typeof data.recipient_count === "number"
      ? `${data.recipient_count} recipients`
      : "";
  const provider = normalizeString(data.delivery_provider || channel);
  const name = normalizeString(data.name);
  const createdAt = normalizeDateTime(data.created_at || data.createdAt || null);
  const updatedAt = normalizeDateTime(data.updated_at || null);

  return {
    title: `Campaign draft: ${doc.id}`,
    system: "WebApp",
    businessLane: "Growth",
    lifecycleStage: "Open",
    workType: "Refresh",
    priority: "P2",
    substage: summarizeParts([
      "Source authority: app/API",
      name ? `Name: ${name}` : null,
      `Status: ${status}`,
      `Channel: ${channel}`,
      provider ? `Delivery provider: ${provider}` : null,
      recipientCount || null,
    ]),
    outputLocation: "Notion",
    executionSurface: "Repo",
    sourceAuthority: "app/API",
    sourceCollection: "growthCampaigns",
    sourceId: doc.id,
    naturalKey: `growthCampaigns::${doc.id}`,
    lastStatusChange: updatedAt || createdAt,
  };
}

function toGrowthMirrorEntryFromActionLedger(
  doc: { id: string; data: () => Record<string, unknown> },
): GrowthMirrorEntry | null {
  const data = doc.data();
  const lane = normalizeString(data.lane);
  const status = normalizeString(data.status || "pending_approval");
  const actionType = normalizeString(data.action_type);
  if (lane !== "growth_campaign") {
    return null;
  }
  if (!["pending_approval", "failed"].includes(status)) {
    return null;
  }
  if (!["send_campaign_emails", "send_nitrosend_campaign"].includes(actionType)) {
    return null;
  }

  const payload = data.action_payload && typeof data.action_payload === "object"
    ? (data.action_payload as Record<string, unknown>)
    : {};
  const draftOutput = data.draft_output && typeof data.draft_output === "object"
    ? (data.draft_output as Record<string, unknown>)
    : {};
  const campaignId = normalizeString(payload.campaignId || payload.docId || data.source_doc_id);
  const subject = normalizeString(payload.subject);
  const approvedBy = normalizeString(data.approved_by);
  const reason =
    normalizeString(data.approval_reason) ||
    normalizeString(data.auto_approve_reason) ||
    normalizeString(data.last_execution_error) ||
    normalizeString(draftOutput.recommendation);
  const updatedAt = normalizeDateTime(data.updated_at || null);
  const createdAt = normalizeDateTime(data.created_at || null);

  return {
    title: `Ship-broadcast approval: ${doc.id}`,
    system: "WebApp",
    businessLane: "Growth",
    lifecycleStage: status === "failed" ? "Blocked" : "Waiting on Founder",
    workType: "Refresh",
    priority: status === "failed" ? "P0" : "P1",
    substage: summarizeParts([
      "Source authority: app/API",
      campaignId ? `Campaign: ${campaignId}` : null,
      subject ? `Subject: ${subject}` : null,
      `Status: ${status}`,
      approvedBy ? `Approved by: ${approvedBy}` : null,
      reason ? `Reason: ${reason}` : null,
    ]),
    outputLocation: "Notion",
    executionSurface: "Repo",
    sourceAuthority: "app/API",
    sourceCollection: "action_ledger",
    sourceId: doc.id,
    naturalKey: `action_ledger::${doc.id}`,
    needsFounder: true,
    lastStatusChange: updatedAt || createdAt,
  };
}

function toGrowthMirrorEntryFromCreativeRun(
  doc: { id: string; data: () => Record<string, unknown> },
): GrowthMirrorEntry | null {
  const data = doc.data();
  const skuName = normalizeString(data.sku_name || doc.id);
  const status = normalizeString(data.status || "unknown");
  const generatedImages = Array.isArray(data.image_batch) ? data.image_batch.length : 0;
  const remotionReel =
    data.remotion_reel && typeof data.remotion_reel === "object"
      ? (data.remotion_reel as Record<string, unknown>)
      : {};
  const reelStatus = normalizeString(remotionReel.status);
  const reelError = normalizeString(remotionReel.error);
  const createdAt = normalizeDateTime(data.created_at || null);

  return {
    title: `Creative run: ${doc.id}`,
    system: "WebApp",
    businessLane: "Growth",
    lifecycleStage: reelStatus === "failed" || status === "failed" ? "Blocked" : "Done",
    workType: "Refresh",
    priority: reelStatus === "failed" || status === "failed" ? "P1" : "P2",
    substage: summarizeParts([
      "Source authority: app/API",
      skuName ? `SKU: ${skuName}` : null,
      status ? `Status: ${status}` : null,
      generatedImages ? `Images: ${generatedImages}` : null,
      reelStatus ? `Reel: ${reelStatus}` : null,
      reelError ? `Error: ${reelError}` : null,
    ]),
    outputLocation: "Notion",
    executionSurface: "Repo",
    sourceAuthority: "app/API",
    sourceCollection: "creative_factory_runs",
    sourceId: doc.id,
    naturalKey: `creative_factory_runs::${doc.id}`,
    lastStatusChange: createdAt || normalizeDateTime(data.created_at_iso || null),
  };
}

function summarizeIntegrationSnapshot(summary: Record<string, unknown> | undefined) {
  const configuredLabel = (value: unknown) => (value ? "configured" : "missing");
  const analytics = summary?.analytics && typeof summary.analytics === "object"
    ? (summary.analytics as Record<string, unknown>)
    : {};
  const nitrosend = summary?.nitrosend && typeof summary.nitrosend === "object"
    ? (summary.nitrosend as Record<string, unknown>)
    : {};
  const runway = summary?.runway && typeof summary.runway === "object"
    ? (summary.runway as Record<string, unknown>)
    : {};
  const elevenlabs = summary?.elevenlabs && typeof summary.elevenlabs === "object"
    ? (summary.elevenlabs as Record<string, unknown>)
    : {};
  const telephony = summary?.telephony && typeof summary.telephony === "object"
    ? (summary.telephony as Record<string, unknown>)
    : {};
  const sendgrid = summary?.sendgrid && typeof summary.sendgrid === "object"
    ? (summary.sendgrid as Record<string, unknown>)
    : {};
  const googleImage = summary?.googleImage && typeof summary.googleImage === "object"
    ? (summary.googleImage as Record<string, unknown>)
    : {};

  return summarizeParts([
    "Source authority: app/API",
    analytics?.alignment && typeof analytics.alignment === "object"
      ? normalizeString((analytics.alignment as Record<string, unknown>).note)
      : null,
    `SendGrid: ${configuredLabel(sendgrid.configured)}`,
    `Nitrosend: ${configuredLabel(nitrosend.configured)}`,
    `Runway: ${configuredLabel(runway.configured)}`,
    `ElevenLabs: ${configuredLabel(elevenlabs.configured)}`,
    `Telephony: ${configuredLabel(telephony.configured)}`,
    `Google creative: ${normalizeString(googleImage.executionState || "unknown")}`,
  ]);
}

function toGrowthMirrorEntryFromIntegrationVerification(
  doc: { id: string; data: () => Record<string, unknown> },
): GrowthMirrorEntry | null {
  const data = doc.data();
  const verifiedAt = normalizeDateTime(data.verified_at || null);
  const verifiedAtIso = normalizeString(data.verified_at_iso);
  const summary = data.summary && typeof data.summary === "object"
    ? (data.summary as Record<string, unknown>)
    : buildGrowthIntegrationSummary();

  return {
    title: `Integration verification: ${doc.id}`,
    system: "WebApp",
    businessLane: "Growth",
    lifecycleStage: "Done",
    workType: "Refresh",
    priority: "P3",
    substage: summarizeIntegrationSnapshot(summary) || "Source authority: app/API",
    outputLocation: "Notion",
    executionSurface: "Repo",
    sourceAuthority: "app/API",
    sourceCollection: "growthIntegrationVerifications",
    sourceId: doc.id,
    naturalKey: `growthIntegrationVerifications::${doc.id}`,
    lastStatusChange: verifiedAt || verifiedAtIso || normalizeDateTime(data.updated_at || null),
  };
}

function toGrowthMirrorEntryFromContentReview(
  doc: { id: string; data: () => Record<string, unknown> },
): GrowthMirrorEntry | null {
  const data = doc.data();
  const title = normalizeString(data.title || data.name || data.subject) || doc.id;
  const status = normalizeString(data.status || data.review_status || data.outcome || data.result);
  const summary = normalizeString(data.summary || data.notes || data.recommendation || data.feedback);
  const reviewedAt =
    normalizeDateTime(data.reviewed_at || null) ||
    normalizeDateTime(data.updated_at || null) ||
    normalizeDateTime(data.created_at || null);

  return {
    title: `Content review: ${doc.id}`,
    system: "WebApp",
    businessLane: "Growth",
    lifecycleStage:
      /reject|fail|block/i.test(status) ? "Blocked" : /done|approve|pass/i.test(status) ? "Done" : "In Progress",
    workType: "Refresh",
    priority: /reject|fail|block/i.test(status) ? "P1" : "P2",
    substage: summarizeParts([
      "Source authority: app/API",
      title ? `Title: ${title}` : null,
      status ? `Status: ${status}` : null,
      summary ? `Summary: ${summary}` : null,
    ]),
    outputLocation: "Notion",
    executionSurface: "Repo",
    sourceAuthority: "app/API",
    sourceCollection: "content_outcome_reviews",
    sourceId: doc.id,
    naturalKey: `content_outcome_reviews::${doc.id}`,
    lastStatusChange: reviewedAt,
  };
}

export async function syncGrowthStudioToNotion(params?: { limit?: number }): Promise<GrowthMirrorCounts> {
  const notion = getNotionClient() as any;
  if (!notion || !db) {
    return {
      created: 0,
      updated: 0,
      errors: 0,
      skipped: 0,
      syncedAt: null,
      databaseId: null,
      sourceCounts: {},
    };
  }

  const databaseId = getGrowthMirrorDatabaseId();
  const limit = Math.max(1, Math.min(params?.limit || 25, 50));
  const syncedAt = new Date().toISOString();

  try {
    await ensureGrowthMirrorSchema(notion, databaseId);
  } catch {
    // Keep syncing even if schema reconciliation fails. Existing properties may still work.
  }

  const [approvalDocs, campaignDocs, creativeDocs, verificationDocs, contentReviewDocs] =
    await Promise.all([
      queryRecentDocs("action_ledger", "updated_at", limit),
      queryRecentDocs("growthCampaigns", "created_at", limit),
      queryRecentDocs("creative_factory_runs", "created_at", limit),
      queryRecentDocs("growthIntegrationVerifications", "verified_at", limit),
      queryRecentDocs("content_outcome_reviews", "created_at", limit),
    ]);

  const sourceCounts = {
    shipBroadcastApprovals: 0,
    campaignDrafts: 0,
    creativeRuns: 0,
    integrationVerifications: 0,
    contentReviews: 0,
  };

  const entries: GrowthMirrorEntry[] = [];

  for (const doc of approvalDocs) {
    const entry = toGrowthMirrorEntryFromActionLedger(doc as { id: string; data: () => Record<string, unknown> });
    if (entry) {
      entries.push(entry);
      sourceCounts.shipBroadcastApprovals += 1;
    }
  }

  for (const doc of campaignDocs) {
    const entry = toGrowthMirrorEntryFromCampaign(doc as { id: string; data: () => Record<string, unknown> });
    if (entry) {
      entries.push(entry);
      sourceCounts.campaignDrafts += 1;
    }
  }

  for (const doc of creativeDocs) {
    const entry = toGrowthMirrorEntryFromCreativeRun(doc as { id: string; data: () => Record<string, unknown> });
    if (entry) {
      entries.push(entry);
      sourceCounts.creativeRuns += 1;
    }
  }

  for (const doc of verificationDocs) {
    const entry = toGrowthMirrorEntryFromIntegrationVerification(
      doc as { id: string; data: () => Record<string, unknown> },
    );
    if (entry) {
      entries.push(entry);
      sourceCounts.integrationVerifications += 1;
    }
  }

  for (const doc of contentReviewDocs) {
    const entry = toGrowthMirrorEntryFromContentReview(doc as { id: string; data: () => Record<string, unknown> });
    if (entry) {
      entries.push(entry);
      sourceCounts.contentReviews += 1;
    }
  }

  let created = 0;
  let updated = 0;
  let errors = 0;
  let skipped = 0;

  for (const entry of entries) {
    try {
      const result = await upsertGrowthMirrorPage(notion, databaseId, entry, syncedAt);
      if (result.status === "created") {
        created += 1;
      } else {
        updated += 1;
      }
    } catch {
      errors += 1;
    }
  }

  skipped = Math.max(0, approvalDocs.length + campaignDocs.length + creativeDocs.length + verificationDocs.length + contentReviewDocs.length - entries.length);

  return {
    created,
    updated,
    errors,
    skipped,
    syncedAt,
    databaseId,
    sourceCounts,
  };
}

export async function syncFirestoreToNotion(params?: { limit?: number }): Promise<SyncCounts> {
  const notion = getNotionClient() as any;
  if (!notion || !db) {
    return { created: 0, updated: 0, errors: 0 };
  }

  const limit = params?.limit || 50;
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

  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const config of configs) {
    const databaseId = getConfiguredEnvValue(config.envKey);
    if (!databaseId) {
      continue;
    }

    try {
      const snapshot = await db.collection(config.collection).limit(limit).get();
      for (const doc of snapshot.docs) {
        try {
          const properties = config.map(doc.id, doc.data() as Record<string, unknown>);
          const existing = await notion.databases.query({
            database_id: databaseId,
            filter: {
              property: "external_id",
              rich_text: { equals: doc.id },
            },
            page_size: 1,
          });

          if (Array.isArray(existing.results) && existing.results.length > 0) {
            await notion.pages.update({
              page_id: existing.results[0].id,
              properties,
            });
            updated += 1;
          } else {
            await notion.pages.create({
              parent: { database_id: databaseId },
              properties,
            });
            created += 1;
          }
        } catch {
          errors += 1;
        }
      }
    } catch {
      errors += 1;
    }
  }

  return { created, updated, errors };
}

export async function syncNotionToFirestore(params?: { limit?: number }): Promise<SyncCounts> {
  const notion = getNotionClient() as any;
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
    const response = await notion.databases.query({
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
}): Promise<{ processedCount: number; failedCount: number }> {
  const toNotion = await syncFirestoreToNotion(params);
  const toFirestore = await syncNotionToFirestore(params);
  const growthMirror = await syncGrowthStudioToNotion(params);

  return {
    processedCount:
      toNotion.created +
      toNotion.updated +
      toFirestore.updated +
      growthMirror.created +
      growthMirror.updated,
    failedCount: toNotion.errors + toFirestore.errors + growthMirror.errors,
  };
}
