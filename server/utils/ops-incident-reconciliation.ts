import { dbAdmin } from "../../client/src/lib/firebaseAdmin";
import { ingestSlackOpsIncident, opsIncidentConfig, type OpsIncidentConfig, type OpsEnvelope } from "./ops-incident-ingest";

export type SlackCall = (method: string, params: Record<string, any>, write?: boolean) => Promise<Record<string, any>>;
export async function existingSlackApi(method: string, params: Record<string, any>, write = false) {
  const token = process.env.SLACK_BOT_TOKEN?.trim();
  if (!token) throw new Error("ops_existing_slack_token_missing");
  const url = new URL(`https://slack.com/api/${method}`);
  if (!write) for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  const response = await fetch(url, { method: write ? "POST" : "GET", headers: { Authorization: `Bearer ${token}`,
    ...(write ? { "Content-Type": "application/json" } : {}) }, ...(write ? { body: JSON.stringify(params) } : {}), signal: AbortSignal.timeout(15000) });
  const payload = await response.json();
  if (!response.ok || payload.ok !== true) throw new Error(`ops_slack_read_failed:${String(payload.error || response.status)}`);
  return payload;
}

/** The existing leader scheduler invokes this only after explicit resumption.
 * Read-only Slack calls; no second triage owner, provider job, or Slack POST. */
export async function runOpsIncidentReconciliation(dependencies: { db?: FirebaseFirestore.Firestore | null;
  config?: OpsIncidentConfig; read?: SlackCall; now?: Date } = {}) {
  const config = dependencies.config ?? opsIncidentConfig();
  if (!config.enabled || process.env.BLUEPRINT_OPS_SLACK_RECONCILE_ENABLED !== "true")
    return { processedCount: 0, failedCount: 0, reason: "ops_reconciliation_stopped" };
  const db = dependencies.db === undefined ? dbAdmin : dependencies.db;
  if (!db) throw new Error("ops_incident_store_unavailable");
  if (!config.teamId || !config.appId || !config.channelId || !config.ownBotId || !config.owner || !config.sourceBotIds.length)
    throw new Error("ops_source_binding_missing");
  const read = dependencies.read ?? existingSlackApi;
  const identity = await read("auth.test", {});
  if (identity.team_id !== config.teamId || identity.bot_id !== config.ownBotId)
    throw new Error("ops_reader_identity_mismatch");
  const state = db.collection("blueprintOpsIncidents").doc("default").collection("reconciliation").doc(config.channelId);
  const saved = (await state.get()).data() ?? {}, now = dependencies.now ?? new Date();
  const latest = String(Math.floor(now.getTime() / 1000));
  // Startup scope is explicit, so no full-channel scan silently expands access.
  const floor = process.env.BLUEPRINT_OPS_SLACK_RECONCILE_START_TS?.trim();
  if (!floor || !/^\d+(\.\d+)?$/.test(floor)) throw new Error("ops_reconciliation_start_missing");
  const oldest = String(Math.max(Number(floor), Number(saved.latestTs ?? floor) - 300));
  let cursor = "", processedCount = 0;
  const cursors = new Set<string>();
  do {
    const page = await read("conversations.history", { channel: config.channelId, oldest, latest, inclusive: "true", include_all_metadata: "true", limit: "100", ...(cursor ? { cursor } : {}) });
    if (!Array.isArray(page.messages)) throw new Error("ops_reconciliation_messages_missing");
    for (const event of page.messages) {
      const envelope: OpsEnvelope = { team_id: config.teamId, api_app_id: config.appId, event: { ...event, type: "message", channel: config.channelId } };
      const result = await ingestSlackOpsIncident(envelope, { db, config });
      if (result.ingested) processedCount++;
    }
    cursor = typeof page.response_metadata?.next_cursor === "string" ? page.response_metadata.next_cursor : "";
    if ((!cursor && page.has_more !== false) || (cursor && cursors.has(cursor))) throw new Error("ops_reconciliation_pagination_incomplete");
    if (cursor) cursors.add(cursor);
  } while (cursor);
  // Only complete scans move the watermark; interrupted scans replay idempotently.
  await db.runTransaction(async tx => {
    const prior = (await tx.get(state)).data() ?? {};
    tx.set(state, { ...prior, latestTs: String(Math.max(Number(prior.latestTs ?? floor), Number(latest))),
      observedAt: now.toISOString(), schema: "blueprint.ops-reconciliation.v1", channelId: config.channelId });
  });
  return { processedCount, failedCount: 0, reason: null };
}
