import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { SiteAssessmentBudget } from "./adapters/site-assessment-budget";
import type { SiteAssessmentExperiment } from "./adapters/site-assessment";
import { admitInferenceProgramme, inferenceProgrammeAuthorityDigest, validateInferenceProgramme } from "../utils/inferenceProgrammeAdmission";
import { humanDecisionDigest } from "../utils/human-reply-admission";
import { getGeminiVideoModel } from "./provider-config";

export const experimentHash = (value: unknown) => createHash("sha256").update(JSON.stringify(value ?? null)).digest("hex");
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const providerLimit = z.object({ cap_usd: z.number().finite().nonnegative().max(100), max_calls: z.number().int().min(0).max(100) }).strict();
const experimentApproval = z.object({
  allocation_id: z.string().regex(/^assessment-experiment-[A-Za-z0-9._-]{1,80}$/),
  purpose: z.literal("site-assessment-iteration"),
  providers: z.object({ openai: providerLimit, gemini: providerLimit }).strict(),
  retention: z.object({ local_evidence_allowed: z.literal(true), authority_ref: z.string().min(1), expires_at_ms: z.number().int().positive() }).strict(),
}).strict();

/** Uses the existing programme slots and model reservations, not a second pricing/budget implementation. */
export function validateExperimentAllocation(value: unknown) {
  const programme = validateInferenceProgramme(value);
  const approval = experimentApproval.parse(programme.experiment);
  if (approval.retention.expires_at_ms <= Date.now()) throw Error("experiment_retention_expired");
  if (programme.expires_at_ms <= Date.now()) throw Error("inference_programme_expired");
  for (const provider of ["openai", "gemini"] as const) {
    const slots = programme.slots.filter(slot => slot.provider === provider);
    if (slots.length > approval.providers[provider].max_calls || slots.reduce((sum, slot) => sum + slot.reserved_micro_usd, 0)
      > Math.floor(approval.providers[provider].cap_usd * 1e6)) throw Error("experiment_provider_allocation_exceeds_approval");
  }
  return { programme, approval };
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
  if (typeof value === "string") return value
    .replace(/https?:\/\/[^\s"<>]+/g, url => { try { const parsed = new URL(url); parsed.search = ""; parsed.hash = ""; parsed.username = ""; parsed.password = ""; return parsed.toString(); } catch { return "[redacted-url]"; } })
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(/\b(?:sk|AIza)[-_A-Za-z0-9]{16,}\b/g, "[redacted-key]");
  if (Array.isArray(value)) return value.filter(item => !(item && typeof item === "object" && (item.type === "reasoning" || item.thought === true))).map(sanitizeExperiment);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([key]) =>
    !/^(authorization|cookie|headers|api.?key|secret|token|encrypted_content|reasoning|thought|signed.?url|url)$/i.test(key))
    .map(([key, item]) => [key, sanitizeExperiment(item)]));
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
  retention: experimentApproval.shape.retention,
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

/** Local persistence of existing inference_program.v1; no customer capture-budget or agentRuns writes. */
export function openExperimentAllocation(file: string, requestId: string, runId: string, mode: SiteAssessmentExperiment["mode"]) {
  const absolute = fs.realpathSync(file), lock = `${absolute}.lock`;
  const fd = fs.openSync(lock, "wx", 0o600); fs.writeFileSync(fd, runId); fs.fsyncSync(fd); fs.closeSync(fd);
  let bound: Record<string, any> | undefined, stop: string | undefined;
  try {
    const { programme, approval } = validateExperimentAllocation(JSON.parse(fs.readFileSync(absolute, "utf8")));
    if (programme.request_id !== requestId) throw Error("experiment_request_mismatch");
    if (programme.slots.some(slot => slot.state === "unknown" || slot.state === "admitted")) throw Error("experiment_charge_unresolved");
    if (mode === "saved-evidence" && !programme.slots.some(slot => slot.provider === "openai" && slot.state === "held")) throw Error("experiment_sol_allowance_required");
    const authority = inferenceProgrammeAuthorityDigest(programme), approvalDigest = experimentHash(approval);
    const read = () => {
      const checked = validateExperimentAllocation(JSON.parse(fs.readFileSync(absolute, "utf8")));
      if (inferenceProgrammeAuthorityDigest(checked.programme) !== authority || experimentHash(checked.approval) !== approvalDigest) throw Error("experiment_authority_changed");
      return checked.programme;
    };
    return {
      approval,
      bind(source: Record<string, any>) {
        if (programme.capture_id !== source.capture_id || programme.video_sha256 !== source.video_sha256
          || programme.context_digest !== source.experiment_context_digest
          || programme.producer_source_digest !== humanDecisionDigest(source.producer_source)) throw Error("experiment_source_binding_changed");
        bound = source;
      },
      pause(reason: string) { stop = reason; },
      assertActive() { if (stop) throw Error(stop); read(); },
      status: () => ({ pause_reason: stop ?? null, slots: read().slots }),
      reserve: (async (model: string, metadata: Record<string, unknown> = {}, provider = "gemini", request?: unknown) => {
        if (!bound || stop) throw Error(stop ?? "experiment_source_not_bound");
        if (mode === "saved-evidence" && provider === "gemini") throw Error("experiment_saved_evidence_miss");
        const current = read();
        if (current.slots.some(slot => slot.state === "unknown" || slot.state === "admitted")) throw Error("experiment_charge_unresolved");
        const exposure = current.slots.filter(slot => slot.state !== "held").reduce((sum, slot) => sum + slot.reserved_micro_usd / 1e6, 0);
        const budget = new SiteAssessmentBudget(exposure); budget.authorize(provider, model, request);
        const reserved = budget.calls[0].reserved_usd, token = randomUUID();
        const admitted = admitInferenceProgramme(current, { requestId, captureId: bound.capture_id,
          contextDigest: bound.experiment_context_digest, videoSha256: bound.video_sha256,
          sourceDigest: humanDecisionDigest(bound.producer_source), provider, model, reservedMicroUsd: Math.ceil(reserved * 1e6), token, runId });
        writeExperimentJson(absolute, { ...current, slots: admitted.slots });
        const receipt = { provider, allocation_id: approval.allocation_id, slot_id: admitted.slotId, reserved_usd: reserved,
          cap_usd: approval.providers[provider].cap_usd, capture_exposure_usd: exposure + reserved, persistence: "local_inference_program.v1" };
        const assertSlot = () => {
          const value = read(), slot = value.slots.find(row => row.id === admitted.slotId);
          if (!slot || slot.state !== "admitted" || slot.admission_token !== token || slot.run_id !== runId) throw Error("experiment_admission_changed");
          return value;
        };
        return { receipt, async assertDispatchAllowed() { assertSlot(); }, async record(usage: unknown) {
          budget.record(provider, model, { usage });
          const value = assertSlot(), cost = budget.calls[0].cost_usd;
          writeExperimentJson(absolute, { ...value, slots: value.slots.map(slot => slot.id === admitted.slotId
            ? { ...slot, state: cost === null ? "unknown" : "recorded", usage_estimate_micro_usd: cost === null ? null : Math.ceil(cost * 1e6), usage: sanitizeExperiment(usage) } : slot) });
        } };
      }) as SiteAssessmentExperiment["reserve"],
      close() { fs.unlinkSync(lock); },
    };
  } catch (error) { fs.unlinkSync(lock); throw error; }
}

export function experimentCostStatus(run: any): string {
  if (run.allocation_read_error || run.allocation_close_error) return "experiment_ledger_reconciliation_required";
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
      allocation: run.allocation ?? null, usage: run.result?.artifacts?.usage ?? null, wall_ms: run.wall_ms };
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
