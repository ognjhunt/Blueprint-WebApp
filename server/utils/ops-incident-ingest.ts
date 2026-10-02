import { createHash } from "node:crypto";
import { dbAdmin } from "../../client/src/lib/firebaseAdmin";

const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
export function compareSlackTs(a: string, b: string) {
  const [as, af] = a.split("."), [bs, bf] = b.split(".");
  if (BigInt(as) !== BigInt(bs)) return BigInt(as) < BigInt(bs) ? -1 : 1;
  const width = Math.max(af.length, bf.length);
  return af.padEnd(width, "0").localeCompare(bf.padEnd(width, "0"));
}
export type OpsEnvelope = { team_id?: string; api_app_id?: string; event_id?: string; event?: Record<string, unknown> };
export type OpsIncidentConfig = { enabled: boolean; teamId: string; appId: string; channelId: string; ownBotId: string; sourceBotIds: string[]; owner: string };

export function opsIncidentConfig(): OpsIncidentConfig {
  return { enabled: process.env.BLUEPRINT_OPS_SLACK_INGEST_ENABLED === "true",
    teamId: text(process.env.BLUEPRINT_OPS_SLACK_TEAM_ID), appId: text(process.env.BLUEPRINT_OPS_SLACK_APP_ID),
    channelId: text(process.env.BLUEPRINT_OPS_SLACK_CHANNEL_ID), ownBotId: text(process.env.BLUEPRINT_OPS_SLACK_OWN_BOT_ID),
    sourceBotIds: text(process.env.BLUEPRINT_OPS_SLACK_SOURCE_BOT_IDS).split(",").map(text).filter(Boolean),
    owner: text(process.env.BLUEPRINT_OPS_SLACK_OWNER) };
}

/** Slack is untrusted evidence. A report never creates deploy/spend/send authority.
 * Signed event delivery and the missed-event reader share this exact admission. */
export function projectOpsIncident(envelope: OpsEnvelope, config: OpsIncidentConfig) {
  if (!config.enabled) return { accepted: false as const, reason: "ops_ingest_stopped" };
  if (!config.teamId || !config.appId || !config.channelId || !config.ownBotId || !config.owner || !config.sourceBotIds.length)
    return { accepted: false as const, reason: "ops_source_binding_missing" };
  if (envelope.team_id !== config.teamId || envelope.api_app_id !== config.appId)
    return { accepted: false as const, reason: "ops_workspace_or_app_mismatch" };
  const event = envelope.event ?? {}, bot = text(event.bot_id), body = text(event.text);
  const rawText = typeof event.text === "string" ? event.text : "";
  if (event.type !== "message" || event.channel !== config.channelId || !/^\d+\.\d+$/.test(text(event.ts))
    || !body || (event.subtype && event.subtype !== "bot_message"))
    return { accepted: false as const, reason: "ops_report_type_ignored" };
  if (bot === config.ownBotId || !config.sourceBotIds.includes(bot))
    return { accepted: false as const, reason: "ops_echo_or_unbound_source" };
  const metadata = event.metadata as { event_type?: string; event_payload?: Record<string, unknown> } | undefined;
  const report = metadata?.event_type === "blueprint_ops_report" ? metadata.event_payload ?? {} : {};
  // Existing generic Pipeline alerts stay one incident even before the corrected
  // notifier is installed. Their missing blocker detail remains an explicit gap.
  const manifest = body.match(/manifest=(\/var\/lib\/blueprint\/[A-Za-z0-9_./-]+)/)?.[1];
  const workflow = text(report.workflow) || (manifest ? "live_pipeline_control_plane" : "");
  const scope = text(report.run_id) || manifest || "";
  if (!workflow || !scope) return { accepted: false as const, reason: "ops_incident_identity_missing" };
  const incidentId = hash([config.teamId, config.channelId, workflow, scope]);
  const eventId = hash([config.teamId, config.channelId, text(event.ts)]);
  const blockers = Array.isArray(report.blockers) ? report.blockers.filter((v): v is string => typeof v === "string") : null;
  // The source's fingerprint is evidence; material fields still determine the
  // company fingerprint when a stale or incorrect source digest is repeated.
  const reportedFingerprint = text(report.fingerprint) || null;
  const fingerprint = hash({ body, blockers, reportedFingerprint, sourceVersion: text(report.source_version) || null,
    severity: text(report.severity) || "warning", error: text(report.error) || body, evidenceRef: text(report.evidence_ref) || manifest || null });
  return { accepted: true as const, incidentId, eventId, fingerprint, payload: {
    schema: "blueprint.ops-incident-event.v1", incidentId, eventId, workflow, runId: scope,
    sourceVersion: text(report.source_version) || null, error: text(report.error) || body,
    severity: ["warning", "critical", "info"].includes(text(report.severity)) ? text(report.severity) : "warning",
    blockers, evidenceRef: text(report.evidence_ref) || manifest || null,
    sourceMessageTs: text(event.ts), sourceThreadTs: text(event.thread_ts) || text(event.ts),
    channelId: config.channelId, sourceBotId: bot, owner: config.owner, fingerprint, reportedFingerprint,
    missingDetail: blockers === null ? ["structured_blockers_unavailable"] : [],
    authority: "evidence_only", rawText, rawDigest: hash(rawText), envelopeDigest: hash(envelope) } };
}

export async function ingestSlackOpsIncident(envelope: OpsEnvelope, dependencies: { db?: FirebaseFirestore.Firestore | null; config?: OpsIncidentConfig } = {}) {
  const projected = projectOpsIncident(envelope, dependencies.config ?? opsIncidentConfig());
  if (!projected.accepted) return { ingested: false, reason: projected.reason };
  const db = dependencies.db === undefined ? dbAdmin : dependencies.db;
  if (!db) throw new Error("ops_incident_store_unavailable");
  const root = db.collection("blueprintOpsIncidents").doc("default");
  const eventRef = root.collection("events").doc(projected.eventId), incidentRef = root.collection("incidents").doc(projected.incidentId);
  return db.runTransaction(async tx => {
    const event = await tx.get(eventRef), prior = await tx.get(incidentRef);
    if (event.exists) {
      // Events API and history replay have different envelopes. Compare the
      // complete admitted semantic payload, not transport-only envelope fields.
      const { envelopeDigest: _transport, owner: _configuration, ...semantic } = projected.payload;
      if (event.data()?.semanticDigest !== hash(semantic))
        throw new Error("ops_event_identity_conflict");
      return { ingested: false, reason: "duplicate", incidentId: projected.incidentId };
    }
    const saved = prior.data() ?? {}, changed = saved.fingerprint !== projected.fingerprint;
    // Event timestamps determine occurrence; arrival order cannot erase first
    // occurrence or move last occurrence backwards during missed-event replay.
    const ts = projected.payload.sourceMessageTs;
    const firstTs = typeof saved.firstTs === "string" && compareSlackTs(saved.firstTs, ts) < 0 ? saved.firstTs : ts;
    const lastTs = typeof saved.lastTs === "string" && compareSlackTs(saved.lastTs, ts) > 0 ? saved.lastTs : ts;
    const newest = lastTs === ts;
    const { envelopeDigest: _transport, owner: _configuration, ...semantic } = projected.payload;
    tx.create(eventRef, { ...projected.payload, semanticDigest: hash(semantic), observedAt: new Date().toISOString() });
    tx.set(incidentRef, { ...saved, schema: "blueprint.ops-incident.v1", incidentId: projected.incidentId,
      owner: saved.owner || projected.payload.owner, firstTs, lastTs, occurrences: Number(saved.occurrences ?? 0) + 1,
      sourceThreadTs: saved.sourceThreadTs || projected.payload.sourceThreadTs, channelId: projected.payload.channelId,
      ...(newest ? { fingerprint: projected.fingerprint, latestEventId: projected.eventId } : {}),
      status: saved.status === "resolved" && changed && newest ? "reopened" : saved.status || "open",
      requiresAttention: Boolean(saved.requiresAttention) || (changed && newest),
      // No Slack text is interpreted as an acknowledgment or resolution.
      lastObservedAt: new Date().toISOString() });
    return { ingested: true, reason: changed && newest ? "material_change" : "unchanged_recurrence", incidentId: projected.incidentId };
  });
}

/** Called only by an authenticated company operator, never from Slack text.
 * An evidence link and optimistic fingerprint protect stale resolutions. */
export async function recordOpsIncidentDecision(input: { incidentId: string; commandId: string; actor: string;
  action: "acknowledge" | "assign" | "resolve"; evidenceRef: string; expectedFingerprint: string; owner?: string }, db = dbAdmin) {
  if (!db || !input.actor || !input.commandId || !input.evidenceRef || !/^[a-f0-9]{64}$/.test(input.incidentId))
    throw new Error("ops_decision_identity_or_evidence_missing");
  if (!["acknowledge", "assign", "resolve"].includes(input.action) || (input.action === "assign" && !input.owner))
    throw new Error("ops_decision_invalid");
  const root = db.collection("blueprintOpsIncidents").doc("default"), ref = root.collection("incidents").doc(input.incidentId);
  const command = root.collection("decisions").doc(hash([input.actor, input.commandId]));
  return db.runTransaction(async tx => {
    const receipt = await tx.get(command), incident = await tx.get(ref), prior = incident.data();
    if (receipt.exists) {
      if (receipt.data()?.digest !== hash(input)) throw new Error("ops_decision_identity_conflict");
      return { recorded: false, reason: "duplicate" };
    }
    if (!prior || prior.fingerprint !== input.expectedFingerprint) throw new Error("ops_decision_stale_or_missing");
    tx.create(command, { ...input, digest: hash(input), observedAt: new Date().toISOString(), schema: "blueprint.ops-decision.v1" });
    tx.set(ref, { ...prior, ...(input.action === "assign" ? { owner: input.owner } : {}),
      ...(input.action === "resolve" ? { status: "resolved", requiresAttention: false } : {}),
      ...(input.action === "acknowledge" ? { acknowledgedBy: input.actor, requiresAttention: false } : {}),
      lastDecisionId: command.id });
    return { recorded: true, reason: input.action };
  });
}

/** Operator-controlled replay of already received events. No new owner or
 * model job, and no Slack POST. A failed page does not advance its watermark. */
export async function reconcileSlackOpsEvents(envelopes: OpsEnvelope[], dependencies: { db?: FirebaseFirestore.Firestore | null; config?: OpsIncidentConfig } = {}) {
  const results: Awaited<ReturnType<typeof ingestSlackOpsIncident>>[] = [];
  for (const envelope of envelopes) results.push(await ingestSlackOpsIncident(envelope, dependencies));
  return results;
}
