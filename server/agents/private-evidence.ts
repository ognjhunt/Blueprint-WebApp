import { createHash } from "node:crypto";
import { resolveBundleStorage, type BundleStorage } from "../utils/siteCaptureBundleStorage";

// Leave ample room for Firestore names, timestamps, indexes and merged controls.
export const AGENT_DOCUMENT_BYTE_BUDGET = 512_000;
export type EvidenceCollection = "agentRuns" | "agentSessions" | "agentCheckpoints" | "agentRuntimeEvents";
const payloadFields: Record<EvidenceCollection, string[]> = {
  agentRuns: ["input", "output", "raw_output_text", "artifacts", "logs", "metadata", "outcome_contract", "outcome_evaluation", "error", "approval_reason"],
  agentSessions: ["metadata", "title"],
  agentCheckpoints: ["snapshot", "label"],
  agentRuntimeEvents: ["metadata", "summary", "detail"],
};
type RecordData = Record<string, any>;
type Scope = { collection: EvidenceCollection; id: string };
type Reference = { version: 1; collection: EvidenceCollection; id: string; bucket: string; object: string; sha256: string; bytes: number; generation: string; fields: string[] };
type Document = { get(): Promise<{ exists: boolean; data(): any }>; set(value: any, options?: { merge?: boolean }): Promise<any> };
const digest = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");
const byteSize = (value: unknown) => Buffer.byteLength(JSON.stringify(value), "utf8");
const plain = (value: any): value is RecordData => value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype;

function snapshotDigest(value: unknown): string {
  const sorted = (entry: any): any => Array.isArray(entry) ? entry.map(sorted)
    : plain(entry) ? Object.fromEntries(Object.keys(entry).sort().map(key => [key, sorted(entry[key])])) : entry;
  return digest(JSON.stringify(sorted(JSON.parse(JSON.stringify(value)))));
}

export class AgentEvidenceError extends Error {
  constructor(readonly code: string, readonly scope: Scope, readonly evidenceReference?: Reference, readonly recovery?: { sourceDigest: string; metadata: RecordData; accountingIdentity?: RecordData }) {
    super(`${code}: ${scope.collection}/${scope.id}`);
    this.name = "AgentEvidenceError";
  }
}

function objectName(scope: Scope, sha256: string) {
  if (typeof scope.id !== "string" || !scope.id) throw new AgentEvidenceError("agent_evidence_scope_invalid", scope);
  // Legacy Firestore IDs may contain spaces, dots or Unicode. Bind the exact
  // original ID in the bundle while keeping the object path fixed and safe.
  return `agent-runtime-evidence/v1/${scope.collection}/${digest(scope.id)}/${sha256}.json`;
}

// Never infer safety from missing replay. This compact control is independent
// of the large private payload and survives failed evidence writes/hydration.
export function requiresMutationReconciliation(record: RecordData): boolean {
  const candidates = [record, record.metadata, record.artifacts, record.continuation_state,
    record.snapshot?.result?.artifacts, record.snapshot?.result?.continuation_state];
  if (candidates.some(value => value?.mutation_reconciliation_required === true)) return true;
  const replay = record.metadata?.openai_replay_input ?? record.continuation_state?.openai_replay_input;
  return Array.isArray(replay) && replay.some((item: any) => {
    if (item?.type !== "function_call_output" || typeof item.output !== "string") return false;
    try { return JSON.parse(item.output)?.status === "reconciliation_required"; } catch { return false; }
  });
}

export async function projectAgentEvidence(record: RecordData, scope: Scope, storage = resolveBundleStorage()): Promise<RecordData> {
  const projected = { ...record, agent_evidence_ref: null, agent_evidence_accounting_sha256: null, agent_evidence_accounting_identity: null,
    mutation_reconciliation_required: requiresMutationReconciliation(record) };
  if (byteSize(projected) <= AGENT_DOCUMENT_BYTE_BUDGET) return projected;
  if (!storage) throw new AgentEvidenceError("agent_evidence_storage_unavailable", scope);
  const fields = payloadFields[scope.collection].filter(field => record[field] !== undefined);
  const payload = Object.fromEntries(fields.map(field => [field, record[field]]));
  const content = JSON.stringify({ version: 1, ...scope, payload });
  const sha256 = digest(content);
  const object = objectName(scope, sha256);
  try {
    await storage.createOnly(object, content, "application/json");
    // Both newly written and previously existing objects must verify. A create
    // timeout is reconciled by readback; no overwrite or business-tool retry.
  } catch {
    // The immutable object may have been created before the transport failed.
  }
  let info;
  try { info = await storage.info(object); } catch { throw new AgentEvidenceError("agent_evidence_metadata_unavailable", scope); }
  if (!info?.generation) throw new AgentEvidenceError("agent_evidence_metadata_unavailable", scope);
  const reference: Reference = { version: 1, ...scope, bucket: storage.bucketName,
    object, sha256, bytes: Buffer.byteLength(content, "utf8"), generation: info.generation, fields };
  await verifiedPayload(reference, scope, storage);
  const result: RecordData = { ...projected, agent_evidence_ref: reference, agent_evidence_accounting_sha256: sha256 };
  for (const field of fields) result[field] = null;
  // Accounting remains queryable without downloading private evidence.
  if (scope.collection === "agentRuns") result.metadata = {
    ...Object.fromEntries(["capture_id", "scene_id", "source_packet_digest"]
      .filter(field => record.metadata?.[field] !== undefined).map(field => [field, record.metadata[field]])),
    ...(record.metadata?.cost_telemetry ? { cost_telemetry: record.metadata.cost_telemetry } : {}),
    ...(record.metadata?.cost_guardrail ? { cost_guardrail: record.metadata.cost_guardrail } : {}),
  };
  if (scope.collection === "agentRuns") result.agent_evidence_accounting_identity = {
    run_id: scope.id, session_id: record.session_id ?? null, task_kind: record.task_kind ?? null,
    provider: record.provider ?? null, requested_model: record.model ?? null,
    resolved_model: typeof record.artifacts?.openrouter_model === "string" ? record.artifacts.openrouter_model : record.model ?? null,
    sha256,
  };
  if (byteSize(result) > AGENT_DOCUMENT_BYTE_BUDGET) throw new AgentEvidenceError("agent_evidence_controls_too_large", scope);
  return result;
}

async function verifiedPayload(ref: Reference, scope: Scope, storage: BundleStorage | null) {
  if (!storage || ref.version !== 1 || ref.collection !== scope.collection || ref.id !== scope.id
    || ref.bucket !== storage.bucketName || !/^[a-f0-9]{64}$/.test(ref.sha256)
    || ref.object !== objectName(scope, ref.sha256) || !Array.isArray(ref.fields)
    || new Set(ref.fields).size !== ref.fields.length
    || typeof ref.generation !== "string" || !ref.generation
    || ref.fields.some(field => !payloadFields[scope.collection].includes(field))) {
    throw new AgentEvidenceError("agent_evidence_reference_invalid", scope);
  }
  try {
    const info = await storage.info(ref.object);
    if (!info) throw new AgentEvidenceError("agent_evidence_object_missing", scope);
    if (info.generation !== ref.generation || info.size !== ref.bytes) throw new AgentEvidenceError("agent_evidence_integrity_failed", scope);
  } catch (error) {
    if (error instanceof AgentEvidenceError) throw error;
    throw new AgentEvidenceError("agent_evidence_metadata_unavailable", scope);
  }
  let content: string | null;
  try { content = await storage.readText(ref.object); }
  catch { throw new AgentEvidenceError("agent_evidence_read_unavailable", scope); }
  if (content === null) throw new AgentEvidenceError("agent_evidence_object_missing", scope);
  if (Buffer.byteLength(content, "utf8") !== ref.bytes || digest(content) !== ref.sha256) {
    throw new AgentEvidenceError("agent_evidence_integrity_failed", scope);
  }
  let bundle: any;
  try { bundle = JSON.parse(content); } catch { throw new AgentEvidenceError("agent_evidence_json_invalid", scope); }
  if (bundle.version !== 1 || bundle.collection !== scope.collection || bundle.id !== scope.id
    || !plain(bundle.payload) || Object.keys(bundle.payload).length !== ref.fields.length
    || ref.fields.some(field => !Object.hasOwn(bundle.payload, field))
    || Object.keys(bundle.payload).some(field => !ref.fields.includes(field))) {
    throw new AgentEvidenceError("agent_evidence_provenance_invalid", scope);
  }
  return bundle.payload as RecordData;
}

export async function hydrateAgentEvidence<T>(record: T, scope: Scope, storage = resolveBundleStorage()): Promise<T> {
  const data = record as RecordData;
  if (!data.agent_evidence_ref) return record;
  const payload = await verifiedPayload(data.agent_evidence_ref, scope, storage);
  const hydrated: RecordData = { ...data, ...payload };
  // Compact controls always win; an old payload cannot clear quarantine or
  // overwrite accounting/control changes made after bundle creation.
  for (const field of ["error", "outcome_evaluation", "approval_reason"]) {
    if (data[field] !== null && data[field] !== undefined) hydrated[field] = data[field];
  }
  if (plain(data.metadata)) {
    const controls = { ...data.metadata };
    if (data.agent_evidence_accounting_sha256 !== data.agent_evidence_ref.sha256) {
      delete controls.cost_telemetry; delete controls.cost_guardrail;
    }
    hydrated.metadata = { ...(plain(hydrated.metadata) ? hydrated.metadata : {}), ...controls };
  }
  if (data.mutation_reconciliation_required === true && (scope.collection === "agentRuns" || scope.collection === "agentSessions")) {
    hydrated.metadata = { ...(hydrated.metadata || {}), mutation_reconciliation_required: true };
  }
  return hydrated as T;
}

export async function inspectAgentEvidence<T>(record: T, scope: Scope): Promise<T> {
  try { return await hydrateAgentEvidence(record, scope); }
  catch (error) { return { ...record, agent_evidence_error: error instanceof AgentEvidenceError ? error.message : "agent_evidence_read_unavailable" }; }
}

export async function persistAgentEvidence(document: Document, scope: Scope, updates: RecordData, database?: { runTransaction: (...args: any[]) => Promise<any> }, options?: { preserveCancelledSession?: boolean }) {
  let verifiedReference: Reference | undefined;
  let recovery: { sourceDigest: string; metadata: RecordData; accountingIdentity?: RecordData } | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    const snapshot = await document.get();
    const rawPrior = snapshot.exists ? snapshot.data() : {};
    const prior = snapshot.exists ? await hydrateAgentEvidence(rawPrior, scope) : {};
    // A late SDK result may retain paid evidence, but cannot resurrect the
    // operator's cancelled assessment. The source check below is atomic.
    if (scope.collection === "agentRuns" && prior.task_kind === "site_assessment" && prior.status === "cancelled") {
      updates = { ...updates, status: "cancelled", error: prior.error ?? "site_assessment_cancelled" };
      delete updates.completed_at;
    }
    if (scope.collection === "agentSessions" && options?.preserveCancelledSession && prior.status === "cancelled") {
      updates = { ...updates, status: "cancelled" };
    }
    const merged = { ...prior, ...updates };
    if (plain(prior.metadata) && plain(updates.metadata)) merged.metadata = { ...prior.metadata, ...updates.metadata };
    if (requiresMutationReconciliation(prior) || requiresMutationReconciliation(updates)) merged.mutation_reconciliation_required = true;
    if (typeof database?.runTransaction !== "function") {
      // Small legacy test transports can retain native merge behavior. Never
      // synthesize false controls or attempt a non-atomic evidence migration.
      if (rawPrior.agent_evidence_ref || byteSize(merged) > AGENT_DOCUMENT_BYTE_BUDGET) throw new AgentEvidenceError("agent_evidence_atomic_writer_unavailable", scope);
      await document.set(updates, { merge: true });
      return;
    }
    const projection = await projectAgentEvidence(merged, scope);
    verifiedReference = projection.agent_evidence_ref ?? undefined;
    const priorDigest = snapshotDigest(rawPrior);
    recovery = { sourceDigest: priorDigest, metadata: projection.metadata || {}, accountingIdentity: projection.agent_evidence_accounting_identity || undefined };
    let committed;
    try { committed = await database.runTransaction(async (transaction: any) => {
      const latest = await transaction.get(document);
      if (snapshotDigest(latest.exists ? latest.data() : {}) !== priorDigest) return false;
      // Replace only after checking the complete source snapshot atomically.
      // Recursive merge would retain private fields that were offloaded.
      transaction.set(document, projection);
      return true;
    }); } catch { throw new AgentEvidenceError("agent_evidence_firestore_commit_failed", scope, verifiedReference, recovery); }
    if (committed) return;
  }
  throw new AgentEvidenceError("agent_evidence_concurrent_update", scope, verifiedReference, recovery);
}

// A completed provider response must remain discoverable even if its initial
// manifest transaction fails. Fence this compact recovery link against the
// exact source snapshot; never replace a concurrently newer canonical bundle.
export async function persistAgentEvidenceFailure(document: Document, scope: Scope, updates: RecordData,
  error: unknown, database?: { runTransaction: (...args: any[]) => Promise<any> }) {
  const proof = error instanceof AgentEvidenceError && error.scope.collection === scope.collection && error.scope.id === scope.id ? error : null;
  if (proof?.evidenceReference && proof.recovery && typeof database?.runTransaction === "function") {
    try {
      const linked = await database.runTransaction(async (transaction: any) => {
        const current = await transaction.get(document);
        const data = current.exists ? current.data() : {};
        const sameVerifiedProof = Boolean(data.agent_evidence_ref) && snapshotDigest(data.agent_evidence_ref) === snapshotDigest(proof.evidenceReference);
        if (!sameVerifiedProof && snapshotDigest(data) !== proof.recovery!.sourceDigest) return false;
        transaction.set(document, { ...updates,
          ...(data.status === "cancelled" ? { status: "cancelled" } : {}),
          agent_evidence_ref: proof.evidenceReference,
          agent_evidence_accounting_sha256: proof.evidenceReference!.sha256,
          metadata: proof.recovery!.metadata, ...(proof.recovery!.accountingIdentity ? { agent_evidence_accounting_identity: proof.recovery!.accountingIdentity } : {}), agent_accounting_incomplete: false,
        }, { merge: true });
        return true;
      });
      if (linked) return true;
    } catch { /* Keep compact controls and returned verified proof below. */ }
  }
  await document.set({ ...updates, agent_accounting_incomplete: true }, { merge: true });
  return false;
}
