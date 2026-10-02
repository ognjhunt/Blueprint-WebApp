import { createHash } from "node:crypto";
import { dbAdmin } from "../../client/src/lib/firebaseAdmin";
import { opsIncidentConfig, type OpsIncidentConfig } from "./ops-incident-ingest";
import { existingSlackApi, type SlackCall } from "./ops-incident-reconciliation";

/** One thread per source incident; no repair-agent creation or permissions
 * inferred from Slack. Unknown POST acknowledgments are read-reconciled only. */
export async function runOpsIncidentDelivery(dependencies: { db?: FirebaseFirestore.Firestore | null;
  config?: OpsIncidentConfig; api?: SlackCall } = {}) {
  const config = dependencies.config ?? opsIncidentConfig();
  if (!config.enabled || process.env.BLUEPRINT_OPS_SLACK_DELIVERY_ENABLED !== "true")
    return { processedCount: 0, failedCount: 0, reason: "ops_delivery_stopped" };
  const db = dependencies.db === undefined ? dbAdmin : dependencies.db;
  if (!db) throw new Error("ops_incident_store_unavailable");
  const api = dependencies.api ?? existingSlackApi, identity = await api("auth.test", {});
  if (identity.team_id !== config.teamId || identity.bot_id !== config.ownBotId) throw new Error("ops_delivery_identity_mismatch");
  const root = db.collection("blueprintOpsIncidents").doc("default");
  const due = await root.collection("incidents").where("requiresAttention", "==", true).limit(25).get();
  let processedCount = 0;
  for (const incident of due.docs) {
    const saved = incident.data(), event = (await root.collection("events").doc(saved.latestEventId).get()).data();
    if (!event || event.incidentId !== incident.id || saved.channelId !== config.channelId || !saved.owner)
      throw new Error("ops_delivery_source_binding_invalid");
    const key = createHash("sha256").update(JSON.stringify([incident.id, saved.fingerprint])).digest("hex");
    const delivery = root.collection("deliveries").doc(key);
    const admission = await db.runTransaction(async tx => {
      const prior = (await tx.get(delivery)).data(), latest = (await tx.get(incident.ref)).data();
      if (!latest || latest.fingerprint !== saved.fingerprint || latest.requiresAttention !== true) return "stale";
      if (prior?.status === "confirmed") return "confirmed";
      if (prior) return "unknown";
      tx.create(delivery, { schema: "blueprint.ops-delivery.v1", incidentId: incident.id, fingerprint: saved.fingerprint,
        key, status: "post_unknown", attemptedAt: new Date().toISOString(), sourceThreadTs: saved.sourceThreadTs });
      return "send";
    });
    if (admission === "stale") continue;
    let messageTs: string | null = null;
    const readConfirmation = async () => {
      let cursor = ""; const seen = new Set<string>();
      let confirmedTs: string | null = null;
      do {
        const page = await api("conversations.replies", { channel: config.channelId, ts: saved.sourceThreadTs, include_all_metadata: "true", limit: "100", ...(cursor ? { cursor } : {}) });
        if (!Array.isArray(page.messages)) throw new Error("ops_delivery_reconciliation_missing");
        for (const message of page.messages) {
          if (message.bot_id === config.ownBotId && message.metadata?.event_type === "blueprint_ops_status"
            && message.metadata?.event_payload?.delivery_key === key) confirmedTs = message.ts;
        }
        cursor = typeof page.response_metadata?.next_cursor === "string" ? page.response_metadata.next_cursor : "";
        if ((!cursor && page.has_more !== false) || (cursor && seen.has(cursor))) throw new Error("ops_delivery_reconciliation_incomplete");
        if (cursor) seen.add(cursor);
      } while (cursor);
      return confirmedTs;
    };
    if (admission === "send") {
      const clientId = `${key.slice(0, 8)}-${key.slice(8, 12)}-${key.slice(12, 16)}-${key.slice(16, 20)}-${key.slice(20, 32)}`;
      const result = await api("chat.postMessage", { channel: config.channelId, thread_ts: saved.sourceThreadTs,
        client_msg_id: clientId, unfurl_links: false, unfurl_media: false,
        text: `Blueprint incident ${incident.id}\nOwner: ${saved.owner}\nWorkflow/run: ${event.workflow} / ${event.runId}\nSource: ${event.sourceVersion ?? "unknown"}\nSeverity: ${event.severity}\nFirst/last: ${saved.firstTs} / ${saved.lastTs}; occurrences: ${saved.occurrences}\nResult: ${event.error}\nEvidence: ${event.evidenceRef ?? "unknown"}\nBlockers: ${event.blockers?.join(", ") ?? "structured detail unavailable"}\nFingerprint: ${saved.fingerprint}`,
        metadata: { event_type: "blueprint_ops_status", event_payload: { incident_id: incident.id, delivery_key: key } } }, true);
      if (typeof result.ts !== "string" || result.channel !== config.channelId) throw new Error("ops_delivery_acknowledgment_invalid");
      await delivery.set({ acceptedTs: result.ts, acceptedAt: new Date().toISOString() }, { merge: true });
    }
    if (admission !== "confirmed") {
      messageTs = await readConfirmation();
      if (!messageTs) continue; // Never repeat an ambiguous POST; API acceptance is not readback.
    }
    await db.runTransaction(async tx => {
      const latest = (await tx.get(incident.ref)).data();
      tx.set(delivery, { status: "confirmed", ...(messageTs ? { messageTs } : {}), verifiedAt: new Date().toISOString() }, { merge: true });
      if (latest?.fingerprint === saved.fingerprint) tx.set(incident.ref, { requiresAttention: false, lastDeliveryKey: key }, { merge: true });
    });
    processedCount++;
  }
  return { processedCount, failedCount: 0, reason: null };
}
