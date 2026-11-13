/**
 * What a stored model run, session, runtime event, checkpoint, compaction or action log keeps after its job is
 * withdrawn.
 *
 * Content is replaced in place by the form `persist_content: "redacted"` already writes (`{ redacted, chars,
 * sha256 }`): every string of the record is redacted unless it sits under a key that only ever holds a code, an
 * id, a model or provider name, a status or a time, AND it looks like one (KEPT_STRING: no space, no `@`, no
 * `://`, at most 200 characters). Numbers, booleans and Firestore timestamps are kept, so cost, usage, tokens,
 * timings, status, model, provider, runtime, failover and ids survive exactly, and every money reader gives the
 * same answer after as before (tests: website-job-model-run-redaction.test.ts). A field this file does not know
 * is redacted: a new field can only be redacted too much, never kept by accident.
 */
import crypto from "node:crypto";

export const WITHDRAWAL_REDACTION_FIELD = "withdrawal_redaction";
export const WITHDRAWAL_REDACTION_SCHEMA = "website_withdrawal_content_redaction.v1";

export type WithdrawalRedactionMarker = { schema_version: typeof WITHDRAWAL_REDACTION_SCHEMA; request_id: string; redacted_at_iso: string };

/** A string that is a code, id, digest, model name or time: kept only under the keys below, never free text. */
const KEPT_STRING = /^[A-Za-z0-9][A-Za-z0-9._:\/+-]{0,199}$/;
/**
 * A phone number's shape (only digits, spaces, `+ - . ( )`, with 7 to 15 digits) is never kept, whatever its key, except
 * under this key, which holds a numeric id by construction:
 *   - instance_id   a Vast.ai GPU instance id (digits only; websiteSceneSponsorship.ts checks /^[1-9][0-9]{0,17}$/)
 * (Cloud Storage generations are digits too, but only inside `agent_evidence_ref`, which a redacted row replaces.)
 */
const NUMERIC_ID_KEYS = new Set(["instance_id"]);
const phoneShaped = (value: string) => /^[\d\s+\-.()]+$/.test(value)
  && (value.match(/\d/g)?.length ?? 0) >= 7 && (value.match(/\d/g)?.length ?? 0) <= 15;
const keptString = (value: string, key = "") => KEPT_STRING.test(value) && !value.includes("://")
  && !(phoneShaped(value) && !NUMERIC_ID_KEYS.has(key));
/** Route labels chain providers with `>` ("openai>default"); otherwise the same rule. */
const ROUTE_KEYS = new Set(["route", "provider_route", "upstream_provider", "openrouter_provider"]);
const ROUTE_STRING = /^[A-Za-z0-9][A-Za-z0-9._:\/+>-]{0,199}$/;
const keptFor = (key: string, value: string) =>
  ROUTE_KEYS.has(key) ? ROUTE_STRING.test(value) && !value.includes("://") && !phoneShaped(value) : keptString(value, key);

/** Fields of a row kept as they are (ids, controls, timings, the marker); a string among them must still look like a code. */
const KEPT_FIELDS = new Set([
  "id", "session_id", "session_key", "run_id", "checkpoint_id", "parent_run_id", "resume_from_run_id", "last_run_id",
  "latest_checkpoint_id", "source_session_id", "source_run_id", "target_session_id", "openclaw_session_id", "openclaw_run_id",
  "task_kind", "kind", "provider", "runtime", "model", "status", "dispatch_mode", "trigger", "replayable",
  "requires_human_review", "requires_approval", "dedupe_fingerprint", "privacy_request_binding",
  "agent_profile_id", "environment_profile_id", "action_key", "risk_level", "reversible", "latency_ms",
  "mutation_reconciliation_required", "agent_accounting_incomplete", "agent_evidence_accounting_sha256",
  "agent_evidence_accounting_identity", "created_at", "updated_at", "started_at", "completed_at", "cancelled_at",
  WITHDRAWAL_REDACTION_FIELD,
]);

/** Subtrees that are money and usage records: their code-like strings are kept whatever their key. */
const ACCOUNTING_KEYS = new Set([
  "usage", "usage_samples", "inference_reservation", "inference_reservations", "known_usage_subtotals",
  "cost_telemetry", "cost_guardrail", "provider_failover", "provider_error", "capture_inference_reservations",
  "coverage_inference_reservations", "cache_policy", "raw_usage", "usage_details",
]);

/**
 * Keys whose string value is a code, id or name by construction (kept when it also passes KEPT_STRING). Each holds
 * only a value the code or a provider SDK chooses, never what a person or a model wrote:
 */
const CODE_KEYS = new Set([
  "id", "kind", "type", "provider", "runtime", "model", "status", "phase", "mode", "tool_mode", "event_type", "trigger",
  "error_class", "error_code", "error_type", "code", "sdk", "from_provider", "to_provider", "from_model", "to_model",
  "requested_model", "resolved_model", "served_model", "currency", "schema_version", "version", "task_kind",
  "action_key", "risk_level", "reason", "stop_reason",
  // Money readers (agentCostTelemetry.ts, websiteCaptureInferenceAccounting.ts):
  "cost_status", "spend_accounting_status", "reconciled_cost_status", // a closed set of accounting states
  "route", "provider_route", "upstream_provider",                     // the adapter's own route labels
  "cache_family", "prompt_contract_version", "cache_decision",        // the prompt-cache policy's names
  "cache_decision_reason", "privacy_scope", "processing_region",      // the same policy's codes and regions
  "usage_detail_status",                                              // a closed set: complete, partial, unknown
  "agent_key",                                                        // a built-in agent profile's key
  "source_key",                                                       // a digest of the browser upload identity
  "admission_token",                                                  // a UUID the reservation issued
]);
const CODE_SUFFIX = /(_id|Id|_ids|_at|_iso|_ms|_sha256|_digest|_version|_model|_provider)$/;

export function contentDigest(value: string) {
  return { redacted: true, chars: value.length, sha256: crypto.createHash("sha256").update(value).digest("hex") };
}

const plain = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype;

/** Exactly the three keys the redacted form writes; anything else shaped like it is redacted as usual. */
function alreadyDigest(value: Record<string, unknown>) {
  const keys = Object.keys(value);
  return keys.length === 3 && value.redacted === true && typeof value.sha256 === "string" && /^[a-f0-9]{64}$/.test(value.sha256)
    && typeof value.chars === "number";
}

function redactValue(value: unknown, key: string, accounting: boolean): unknown {
  if (typeof value === "string") {
    return (accounting || CODE_KEYS.has(key) || CODE_SUFFIX.test(key)) && keptFor(key, value) ? value : contentDigest(value);
  }
  if (Array.isArray(value)) return value.map((entry) => redactValue(entry, key, accounting));
  if (plain(value)) {
    if (alreadyDigest(value)) return value;
    return Object.fromEntries(Object.entries(value).map(([entryKey, entry]) =>
      [entryKey, redactValue(entry, entryKey, accounting || ACCOUNTING_KEYS.has(entryKey))]));
  }
  // Numbers, booleans, null and Firestore values (timestamps, sentinels) carry no text.
  return value;
}

function keptField(value: unknown, key = ""): unknown {
  // A kept field's own strings must still look like codes: an admin can choose a session key freely.
  if (typeof value === "string") return keptString(value, key) ? value : contentDigest(value);
  if (Array.isArray(value)) return value.map((entry) => keptField(entry, key));
  if (plain(value)) return Object.fromEntries(Object.entries(value).map(([entryKey, entry]) => [entryKey, keptField(entry, entryKey)]));
  return value;
}

/** The record with its content redacted and the marker set; kept fields are returned as they are. */
export function redactWithdrawnRecord<T extends Record<string, unknown>>(record: T, marker: WithdrawalRedactionMarker): T {
  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    redacted[key] = key === WITHDRAWAL_REDACTION_FIELD ? value
      : KEPT_FIELDS.has(key) ? keptField(value, key) : redactValue(value, key, ACCOUNTING_KEYS.has(key));
  }
  redacted[WITHDRAWAL_REDACTION_FIELD] = (record as Record<string, unknown>)[WITHDRAWAL_REDACTION_FIELD] ?? marker;
  return redacted as T;
}

/**
 * The fields of ANOTHER run of a session that carry the session's earlier turns (which can include a withdrawn job's
 * conversation): the replay input the runtime copies into a task (`input.metadata.openai_replay_input`) and stores on
 * the run (`metadata.openai_replay_input`), and the adapter's continuation copy (`continuation_state.openai_replay_input`).
 * Only those are redacted; the run's own content stays.
 */
export const REPLAY_COPY_PATHS = [["input", "metadata", "openai_replay_input"], ["metadata", "openai_replay_input"],
  ["continuation_state", "openai_replay_input"]] as const;
export function redactReplayCopies<T extends Record<string, unknown>>(record: T): { record: T; changed: boolean } {
  let changed = false;
  const next: Record<string, unknown> = { ...record };
  for (const path of REPLAY_COPY_PATHS) {
    let parent: Record<string, unknown> = next;
    let ok = true;
    for (const segment of path.slice(0, -1)) {
      const child = parent[segment];
      if (!plain(child)) { ok = false; break; }
      parent[segment] = { ...child };
      parent = parent[segment] as Record<string, unknown>;
    }
    const last = path[path.length - 1];
    if (!ok || parent[last] === undefined || parent[last] === null) continue;
    const redacted = redactValue(parent[last], last, false);
    if (JSON.stringify(redacted) !== JSON.stringify(parent[last])) { parent[last] = redacted; changed = true; }
  }
  return { record: next as T, changed };
}

/** Firestore's limits for a stored row: depth, no nested arrays, size. */
const MAX_DEPTH = 20;
const MAX_BYTES = 900_000;
function shape(value: unknown, depth = 0): { depth: number; nested: boolean } {
  const children = Array.isArray(value) ? value : plain(value) ? Object.values(value) : [];
  return children.reduce<{ depth: number; nested: boolean }>((acc, child) => {
    const next = shape(child, depth + 1);
    return { depth: Math.max(acc.depth, next.depth), nested: acc.nested || next.nested || (Array.isArray(value) && Array.isArray(child)) };
  }, { depth, nested: false });
}
export function fitsStore(record: unknown) {
  const { depth, nested } = shape(record);
  return depth <= MAX_DEPTH && !nested && Buffer.byteLength(JSON.stringify(record) ?? "", "utf8") <= MAX_BYTES;
}

const holdsAccounting = (value: unknown): boolean => Array.isArray(value) ? value.some(holdsAccounting)
  : plain(value) ? Object.entries(value).some(([key, entry]) => ACCOUNTING_KEYS.has(key) || holdsAccounting(entry)) : false;

/** One digest of a subtree, except the money and usage records inside it, which stay as they are. */
function digestExceptAccounting(value: unknown): unknown {
  if (!holdsAccounting(value)) return contentDigest(JSON.stringify(value) ?? "");
  if (Array.isArray(value)) return value.map(digestExceptAccounting);
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, entry]) =>
    [key, ACCOUNTING_KEYS.has(key) ? entry : digestExceptAccounting(entry)]));
}

/**
 * Makes a redacted record storable whatever its shape: any subtree that breaks a limit becomes one digest of itself,
 * deepest and largest first, until the record fits. Kept fields and money and usage records (ACCOUNTING_KEYS) are
 * never collapsed: a record that cannot fit with them kept throws, and the caller counts the row as remaining.
 */
export function collapseToFit<T extends Record<string, unknown>>(record: T): T {
  const next: Record<string, unknown> = { ...record };
  const collapse = (value: unknown, depth: number): unknown => {
    if (Array.isArray(value)) {
      if ((value.some(Array.isArray) || depth >= MAX_DEPTH - 1) && !holdsAccounting(value)) return contentDigest(JSON.stringify(value));
      return value.map((entry) => collapse(entry, depth + 1));
    }
    if (plain(value)) {
      if (alreadyDigest(value)) return value;
      if (depth >= MAX_DEPTH - 1 && !holdsAccounting(value)) return contentDigest(JSON.stringify(value));
      return Object.fromEntries(Object.entries(value).map(([key, entry]) =>
        [key, ACCOUNTING_KEYS.has(key) ? entry : collapse(entry, depth + 1)]));
    }
    return value;
  };
  for (const key of Object.keys(next)) if (!KEPT_FIELDS.has(key) && !ACCOUNTING_KEYS.has(key)) next[key] = collapse(next[key], 1);
  // Still too large: digest the largest fields whole, all but their money and usage records.
  const fields = Object.keys(next).filter((key) => !KEPT_FIELDS.has(key) && !ACCOUNTING_KEYS.has(key))
    .sort((a, b) => Buffer.byteLength(JSON.stringify(next[b]) ?? "") - Buffer.byteLength(JSON.stringify(next[a]) ?? ""));
  for (const key of fields) {
    if (fitsStore(next)) break;
    next[key] = digestExceptAccounting(next[key]);
  }
  if (!fitsStore(next)) throw Object.assign(new Error("row_cannot_fit_with_accounting"), { code: "row_cannot_fit_with_accounting" });
  return next as T;
}

export function withdrawalRedactionOf(record: unknown): WithdrawalRedactionMarker | null {
  const marker = plain(record) ? record[WITHDRAWAL_REDACTION_FIELD] : null;
  return plain(marker) && marker.schema_version === WITHDRAWAL_REDACTION_SCHEMA ? marker as WithdrawalRedactionMarker : null;
}
