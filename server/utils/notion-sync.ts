import { Client } from "@notionhq/client";
import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { getConfiguredEnvValue } from "../config/env";

type SyncCounts = { created: number; updated: number; errors: number };

function getNotionClient() {
  const apiKey = getConfiguredEnvValue("NOTION_API_KEY");
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

  return {
    processedCount: toNotion.created + toNotion.updated + toFirestore.updated,
    failedCount: toNotion.errors + toFirestore.errors,
  };
}
