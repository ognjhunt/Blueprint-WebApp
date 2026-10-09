import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { SiteAssessmentBudget } from "./adapters/site-assessment-budget";
import type { SiteAssessmentExperiment } from "./adapters/site-assessment";
import { getGeminiVideoModel } from "./provider-config";
import { factSchema as capabilityFactSchema, publicUrl } from "../research-learning/prior-research";

export const experimentHash = (value: unknown) => createHash("sha256").update(JSON.stringify(value ?? null)).digest("hex");
/** Map only exact configuration failures owned by this repo; arbitrary exception prose stays private. */
export function experimentErrorCode(message: unknown) {
  if (message === "KMS key name is required for KMS decryption.") return "experiment_kms_configuration_missing";
  if (message === "FIELD_ENCRYPTION_MASTER_KEY is required when KMS is not configured.") return "experiment_local_encryption_key_missing";
  if (message === "FIELD_ENCRYPTION_MASTER_KEY must be 32 bytes base64.") return "experiment_local_encryption_key_invalid";
  return typeof message === "string" && /^(experiment_|inference_programme_|site_assessment_|assessment_|gemini_video_)[a-z0-9_]+$/.test(message)
    ? message : "experiment_failed";
}

const inspectableExceptionClasses = new Set([
  "Error", "SyntaxError", "TypeError", "ZodError", "OpenAIError", "APIError", "APIConnectionError", "APIConnectionTimeoutError",
  "APIUserAbortError", "BadRequestError", "AuthenticationError", "PermissionDeniedError", "NotFoundError", "ConflictError",
  "UnprocessableEntityError", "RateLimitError", "InternalServerError", "AgentsError", "SystemError", "UserError", "ModelBehaviorError",
  "InvalidToolInputError", "ToolCallError", "GuardrailExecutionError", "InputGuardrailTripwireTriggered", "OutputGuardrailTripwireTriggered", "MaxTurnsExceededError",
]);
function exceptionClass(error: unknown) {
  try {
    const constructor = error && typeof error === "object"
      ? Object.getOwnPropertyDescriptor(Object.getPrototypeOf(error), "constructor")?.value : undefined;
    const name = typeof constructor === "function" ? Object.getOwnPropertyDescriptor(constructor, "name")?.value : undefined;
    if (typeof name === "string" && inspectableExceptionClasses.has(name)) return name;
  } catch {}
  return "Error";
}
function schemaIssues(value: unknown) {
  try {
    if (!Array.isArray(value)) return undefined;
    return Object.entries(Object.getOwnPropertyDescriptors(value)).flatMap(([index, descriptor]) => {
      try {
        if (!/^\d+$/.test(index) || !("value" in descriptor) || !descriptor.value || typeof descriptor.value !== "object") return [];
        const path = Object.getOwnPropertyDescriptor(descriptor.value, "path")?.value;
        const code = Object.getOwnPropertyDescriptor(descriptor.value, "code")?.value;
        if (!Array.isArray(path) || !Object.values(z.ZodIssueCode).includes(code)) return [];
        const parts = Object.getOwnPropertyDescriptors(path) as Record<string, PropertyDescriptor>;
        const entries = Object.entries(parts).filter(([key]) => /^\d+$/.test(key));
        if (entries.length !== parts.length?.value || entries.some(([, part]) => !("value" in part)
          || !(typeof part.value === "string" || typeof part.value === "number" && Number.isFinite(part.value)))) return [];
        return [{ path: entries.map(([, part]) => part.value), code }];
      } catch { return []; }
    });
  } catch { return undefined; }
}

/** Keep repairable provider/SDK identity, never private exception prose, headers, state or stack. */
export function experimentFailure(error: unknown, includeCause = true) {
  const own = (key: string) => { try { return error && typeof error === "object" ? Object.getOwnPropertyDescriptor(error, key)?.value : undefined; } catch { return undefined; } };
  const status = own("status"), code = own("code"), cause = own("cause");
  const kind = exceptionClass(error);
  // Never retain arbitrary exception prose/stack/body. Owned codes and schema paths are enough to repair input.
  const ownMessage = own("message");
  const message = experimentErrorCode(ownMessage);
  const providerCode = typeof code === "string" && /^(gemini_video_[a-z0-9_]+|invalid_request_error|rate_limit_exceeded|context_length_exceeded|invalid_api_key|insufficient_quota|server_error|model_not_found|ETIMEDOUT|ECONNRESET|ENOTFOUND|EAI_AGAIN)$/.test(code) ? code : null;
  return { code: message, provider_error_code: providerCode,
    http_status: typeof status === "number" && Number.isInteger(status) && status >= 100 && status <= 599 ? status : null,
    ...(includeCause && cause && cause !== error ? { cause: experimentFailure(cause, false) } : {}),
    exception_class: kind,
    issues: kind === "ZodError" ? schemaIssues(own("issues")) : undefined,
    system_code: ["ENOENT", "EEXIST", "EACCES"].includes(code) ? code : undefined };
}

const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const experimentRetention = z.object({ local_evidence_allowed: z.literal(true),
  authority_ref: z.string().min(1), expires_at_ms: z.number().int().positive() }).strict();
export function validateExperimentRetention(value: unknown) {
  const retention = experimentRetention.parse(value);
  if (retention.expires_at_ms <= Date.now()) throw Error("experiment_retention_expired");
  return retention;
}

/** Atomic, private and durable before dispatch. A crashed process leaves its admitted slot consumed. */
export function writeExperimentJson(file: string, value: unknown) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  const fd = fs.openSync(temporary, "wx", 0o600);
  try { fs.writeFileSync(fd, JSON.stringify(value, null, 2) + "\n"); fs.fsyncSync(fd); }
  finally { fs.closeSync(fd); }
  fs.renameSync(temporary, file);
  const directory = fs.openSync(path.dirname(file), "r");
  try { fs.fsyncSync(directory); } finally { fs.closeSync(directory); }
}

/** No signed access URLs, credentials, personal contacts or hidden reasoning in run records. */
export function sanitizeExperiment(value: unknown): any {
  return sanitizeExperimentValue(value);
}

function sanitizeExperimentValue(value: unknown, publicEvidenceSource = false): any {
  if (typeof value === "string") return value
    .replace(/https?:\/\/[^\s"<>]+/g, url => { try { const parsed = new URL(url); parsed.search = ""; parsed.hash = ""; parsed.username = ""; parsed.password = ""; return parsed.toString(); } catch { return "[redacted-url]"; } })
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(/\b(?:sk|AIza)[-_A-Za-z0-9]{16,}\b/g, "[redacted-key]");
  if (Array.isArray(value)) return value.filter(item => !(item && typeof item === "object"
    && (/^(reasoning|thinking|thought|chain_of_thought)$/i.test(item.type ?? "") || item.thought === true))).map(item => sanitizeExperimentValue(item));
  if (value && typeof value === "object") {
    const fields = value as Record<string, unknown>;
    if ((typeof fields.type === "string" && /^(reasoning|thinking|thought|chain_of_thought)$/i.test(fields.type)) || fields.thought === true) return null;
    // Capability facts require their public citation URLs for qualification.
    // Preserve only sources of a schema-valid fact; other URL fields stay excluded.
    const capabilityFact = capabilityFactSchema.safeParse(fields).success;
    return Object.fromEntries(Object.entries(fields).filter(([key]) =>
      !/^(authorization|cookie|headers|api.?key|secret|token|encrypted_content|reasoning|reasoning_content|chain_of_thought|thinking|thought|signed.?url|url)$/i.test(key)
      || key === "url" && publicEvidenceSource && publicUrl.safeParse(fields.url).success
        && typeof fields.url === "string" && !/\b(?:sk|AIza)[-_A-Za-z0-9]{16,}\b/.test(fields.url))
      .map(([key, item]) => [key, key === "url" && publicEvidenceSource ? item
        : key === "sources" && capabilityFact && Array.isArray(item)
          ? item.map(source => sanitizeExperimentValue(source, true)) : sanitizeExperimentValue(item)]));
  }
  return value;
}

/** Assessment-only prompt edits do not invalidate video evidence. Any perception implementation change does. */
export function experimentVersions(root: string) {
  const core = fs.readFileSync(path.join(root, "server/agents/site-assessment.ts"), "utf8");
  const between = (start: string, end: string) => {
    const first = core.indexOf(start), last = core.indexOf(end, first + start.length);
    if (first < 0 || last < 0) throw Error("experiment_analysis_version_unavailable");
    return core.slice(first, last);
  };
  const analysis = between("const videoObservationSchema", "type VideoAnalysis")
    + between("const readVideo =", "const tools =")
    + between("tool({ name: \"analyze_site_video\"", "tool({ name: \"search_robot_knowledge\"")
    + fs.readFileSync(path.join(root, "server/agents/adapters/gemini-video.ts"), "utf8");
  return { analysis_sha256: sha(analysis), assessment_core_sha256: sha(core),
    adapter_sha256: sha(fs.readFileSync(path.join(root, "server/agents/adapters/site-assessment.ts"))),
    task_sha256: sha(fs.readFileSync(path.join(root, "server/agents/tasks/site-assessment.ts"))),
    dependencies_sha256: sha(fs.readFileSync(path.join(root, "package-lock.json"))) };
}

const savedEvidence = z.object({
  schema_version: z.literal("site_assessment_saved_evidence.v1"), origin: z.literal("fresh-video-production-adapter"),
  source: z.object({ request_id: z.string().min(1), capture_id: z.string().min(1), source_key: z.string().min(1),
    video_ref: z.string().startsWith("gs://"), video_sha256: hash, video_bytes: z.number().int().positive(), duration_seconds: z.number().positive() }).strict(),
  operator_messages_sha256: hash, analysis_sha256: hash, model_requested: z.string().min(1), model_versions: z.array(z.string().min(1)),
  started_at: z.string().datetime(), completed_at: z.string().datetime(),
  retention: experimentRetention,
  sources: z.array(z.any()).min(1), responses: z.array(z.any()).min(1), content_sha256: hash,
}).strict();
type Evidence = z.infer<typeof savedEvidence>;
const sourceBinding = (source: Record<string, any>): Evidence["source"] => Object.fromEntries(
  ["request_id", "capture_id", "source_key", "video_ref", "video_sha256", "video_bytes", "duration_seconds"].map(key => [key, source[key]])) as Evidence["source"];

export async function validateSavedEvidence(value: unknown, admitted: Record<string, any>, versions: ReturnType<typeof experimentVersions>) {
  const evidence = savedEvidence.parse(value);
  const { content_sha256, ...content } = evidence;
  if (experimentHash(content) !== content_sha256) throw Error("experiment_evidence_digest_changed");
  if (experimentHash(evidence.source) !== experimentHash(sourceBinding(admitted))) throw Error("experiment_evidence_source_mismatch");
  if (evidence.operator_messages_sha256 !== admitted.operator_messages_sha256) throw Error("experiment_analysis_context_changed");
  if (evidence.analysis_sha256 !== versions.analysis_sha256 || evidence.model_requested !== getGeminiVideoModel()) throw Error("experiment_fresh_evidence_required");
  if (evidence.retention.expires_at_ms <= Date.now() || Date.parse(evidence.completed_at) < Date.parse(evidence.started_at)) throw Error("experiment_evidence_retention_invalid");
  const { validateVideoObservations } = await import("./site-assessment");
  for (const source of evidence.sources) {
    const receipt = source.content?.receipt;
    const raw = evidence.responses.find(response => response?.provider === "gemini" && response.model === evidence.model_requested
      && typeof response.response?.text === "string" && experimentHash(response.response.text) === receipt?.analysis_sha256);
    if (source.kind !== "video" || source.sha256 !== admitted.video_sha256 || source.canonical_ref !== admitted.video_ref
      || receipt?.source_sha256 !== admitted.video_sha256 || receipt?.bytes !== admitted.video_bytes
      || receipt?.model_requested !== evidence.model_requested || !raw
      || receipt?.operator_messages_sha256 !== evidence.operator_messages_sha256
      || receipt?.question !== source.content.question || !/^[a-f0-9]{64}$/.test(receipt?.prompt_sha256 ?? "")
      || experimentHash(receipt?.inspection) !== experimentHash({ processing: source.content.processing, sampling_fps: source.content.sampling_fps })
      || experimentHash(receipt?.processing) !== experimentHash(raw.response.processing)
      || experimentHash(source.content.evidence) !== experimentHash(validateVideoObservations(source.content.evidence, admitted.duration_seconds))
      || experimentHash(validateVideoObservations(JSON.parse(raw.response.text), admitted.duration_seconds))
        !== experimentHash(validateVideoObservations(source.content.evidence, admitted.duration_seconds))
      || !["auto", "static", "agentic"].includes(source.content.processing) || ![1, 2, 4].includes(source.content.sampling_fps)
      || typeof source.content.question !== "string" || !source.content.question.trim()) throw Error("experiment_evidence_provenance_invalid");
    const effectiveMode = source.content.processing === "auto" ? admitted.duration_seconds <= 300 ? "static" : "agentic" : source.content.processing;
    if (raw.response.processing?.mode !== effectiveMode || (effectiveMode === "static"
      && raw.response.processing?.sampling_fps_requested !== source.content.sampling_fps)) throw Error("experiment_evidence_provenance_invalid");
    const expected = `video:${admitted.capture_id}:${experimentHash({ question: source.content.question,
      processing: source.content.processing, sampling_fps: source.content.sampling_fps }).slice(0, 12)}`;
    if (source.source_id !== expected) throw Error("experiment_evidence_provenance_invalid");
  }
  return evidence.sources;
}

export async function captureSavedEvidence(result: any, source: Record<string, any>, versions: ReturnType<typeof experimentVersions>,
  retention: Evidence["retention"], startedAt: string): Promise<Evidence | null> {
  const packet = result.artifacts?.site_assessment_packet ?? result.artifacts?.site_assessment_partial_evidence;
  const sources = (packet?.sources ?? []).filter((item: any) => item.kind === "video");
  const responses = (result.artifacts?.provider_responses ?? []).filter((item: any) => item.provider === "gemini" && item.response?.text);
  if (!sources.length || !responses.length) return null;
  const clean = sanitizeExperiment({ sources, responses });
  // Redacted evidence cannot silently become a new provider response. Retain only a non-reusable report in that case.
  if (sources.some((item: any, i: number) => experimentHash(item.content.evidence) !== experimentHash(clean.sources[i].content.evidence))
    || responses.some((item: any, i: number) => item.response.text !== clean.responses[i].response.text)) return null;
  const content = { schema_version: "site_assessment_saved_evidence.v1" as const, origin: "fresh-video-production-adapter" as const,
    source: sourceBinding(source), operator_messages_sha256: source.operator_messages_sha256, analysis_sha256: versions.analysis_sha256, model_requested: getGeminiVideoModel(),
    model_versions: [...new Set<string>(responses.map((row: any) => row.response.processing?.model_version).filter(Boolean))],
    started_at: startedAt, completed_at: new Date().toISOString(), retention, sources: clean.sources, responses: clean.responses };
  const evidence = { ...content, content_sha256: experimentHash(content) };
  await validateSavedEvidence(evidence, source, versions);
  return evidence;
}

/** Run-local accounting I/O only. No approval file, dollar cap, call allowance or spending denial. */
export function openExperimentLedger(file: string, requestId: string, runId: string, mode: SiteAssessmentExperiment["mode"], retention: unknown) {
  const permission = validateExperimentRetention(retention);
  let bound: Record<string, any> | undefined, stop: string | undefined;
  const state: { schema_version: string; request_id: string; run_id: string; source_digest: string | null; slots: any[] } = {
    schema_version: "site_assessment_accounting.v1", request_id: requestId, run_id: runId, source_digest: null, slots: [] };
  if (fs.existsSync(file)) throw Error("experiment_accounting_exists");
  writeExperimentJson(file, state);
  const read = () => {
    const current = JSON.parse(fs.readFileSync(file, "utf8"));
    if (current.schema_version !== state.schema_version || current.request_id !== requestId || current.run_id !== runId
      || current.source_digest !== state.source_digest || experimentHash(current.slots) !== experimentHash(state.slots)) throw Error("experiment_accounting_changed");
    return current;
  };
  return {
    retention: permission,
    bind(source: Record<string, any>) {
      read();
      if (source.request_id !== requestId || (bound && experimentHash(bound) !== experimentHash(source))) throw Error("experiment_source_binding_changed");
      bound = source; state.source_digest = experimentHash(source); writeExperimentJson(file, state);
    },
    pause(reason: string) { stop = reason; },
    assertActive() { if (stop) throw Error(stop); read(); validateExperimentRetention(permission); },
    status: () => ({ pause_reason: stop ?? null, spending_gates: false, ...read() }),
    reserve: (async (model: string, metadata: Record<string, unknown> = {}, provider = "gemini", request?: unknown) => {
      if (!bound || stop) throw Error(stop ?? "experiment_source_not_bound");
      if (mode === "saved-evidence" && provider === "gemini") throw Error("experiment_saved_evidence_miss");
      read(); validateExperimentRetention(permission);
      const accounting = new SiteAssessmentBudget(); accounting.authorize(provider, model, request);
      const reserved = accounting.calls[0].reserved_usd, token = randomUUID();
      const slot = { id: token, provider, model, state: "admitted", reserved_call_micro_usd: Math.ceil(reserved * 1e6),
        reservation_is_upper_bound: accounting.calls[0].output_ceiling !== null,
        output_token_cap: accounting.calls[0].output_ceiling,
        usage_estimate_micro_usd: null, usage: null, metadata: sanitizeExperiment(metadata) };
      state.slots.push(slot); writeExperimentJson(file, state);
      const receipt = { provider, run_id: runId, slot_id: token, reserved_usd: reserved,
        spending_gates: false, persistence: "local_run_accounting" };
      const assertSlot = () => {
        const value = read(), current = value.slots.find((row: any) => row.id === token);
        if (!current || current.state !== "admitted") throw Error("experiment_accounting_changed");
      };
      return { receipt, async assertDispatchAllowed() { assertSlot(); validateExperimentRetention(permission); }, async record(usage: unknown) {
        assertSlot(); accounting.record(provider, model, { usage });
        const cost = accounting.calls[0].cost_usd;
        Object.assign(slot, { state: cost === null ? "unknown" : "recorded",
          usage_estimate_micro_usd: cost === null ? null : Math.ceil(cost * 1e6), usage: sanitizeExperiment(usage),
          usage_pricing_status: accounting.calls[0].usage_pricing_status ?? "unknown",
          above_estimate: accounting.calls[0].above_estimate ?? false, priced_at_ms: accounting.calls[0].priced_at_ms ?? null });
        writeExperimentJson(file, state);
      } };
    }) as SiteAssessmentExperiment["reserve"],
    close() { read(); },
  };
}

export function experimentCostStatus(run: any): string {
  if (run.accounting_read_error || run.accounting_close_error || run.allocation_read_error || run.allocation_close_error) return "experiment_ledger_reconciliation_required";
  return run.result?.artifacts?.cost_status ?? (run.provider_call_may_have_happened
    ? "provider_usage_or_charge_unresolved" : "no_new_provider_dispatch");
}

export function compareAssessmentRuns(before: any, after: any) {
  const projection = (run: any) => {
    const packet = run.result?.artifacts?.site_assessment_packet;
    const assessment = packet?.assessment;
    return { mode: run.mode, status: run.status ?? run.result?.status, assessment_status: run.result?.status ?? null, assessment: assessment ?? null,
      verification: packet?.verification ?? null, source_binding: run.source ?? null, versions: run.versions,
      cost_status: experimentCostStatus(run), cost: run.result?.artifacts?.inference_reservation ?? null,
      accounting: run.accounting ?? run.allocation ?? null, usage: run.result?.artifacts?.usage ?? null, wall_ms: run.wall_ms };
  };
  const left = projection(before), right = projection(after);
  const sections = ["status", "job", "objects_motions_conditions_variations", "operator_success", "known", "estimates", "missing", "approaches", "next_action", "questions"];
  return { schema_version: "site_assessment_comparison.v1", quality_verdict: "unverified_requires_operator_ground_truth",
    changed_runtime_status: left.status !== right.status,
    same_source: Boolean(left.source_binding && right.source_binding) && experimentHash(left.source_binding) === experimentHash(right.source_binding),
    same_analysis_version: Boolean(left.versions?.analysis_sha256 && right.versions?.analysis_sha256) && left.versions.analysis_sha256 === right.versions.analysis_sha256,
    changed_sections: sections.filter(key => experimentHash(left.assessment?.[key]) !== experimentHash(right.assessment?.[key])),
    before: left, after: right };
}
