import { inferenceProgrammeContextDigest } from "../../utils/inferenceProgrammeAdmission";
import { reserveCaptureCoverageInference } from "../../utils/captureCoverageInferenceBudget";
import { createHash } from "node:crypto";
import OpenAI from "openai";
import { OpenAIProvider } from "@openai/agents";
import { dbAdmin as db, storageAdmin } from "../../../client/src/lib/firebaseAdmin";
import { decryptInboundRequestForAdmin, isEncryptedField } from "../../utils/field-encryption";
import { browserPendingDecisionKey, loadBrowserPending, type BrowserPending } from "../../utils/websiteBrowserPending";
import { projectWebsiteCaptureRights } from "../../utils/websiteTaskContext";
import { toSiteRequirement } from "../../utils/siteMatchRun";
import { getBrief } from "../../utils/siteTaskBrief";
import { advisoryContextDigest, assertAdvisoryJobBinding } from "../../utils/siteAssessmentContext";
import { verifiedPendingManifest, verifiedPendingMarker } from "../../utils/websiteBrowserUploadStatus";
import { isSiteVideoEvidenceEnabled } from "../../config/env";
import { hydrateAgentEvidence, requiresMutationReconciliation } from "../private-evidence";
import { getCompanyHistoryAccess } from "../operator-tools";
import { getGeminiVideoModel, getOpenAiTimeoutMs } from "../provider-config";
import { createSiteAssessmentAgent, SITE_ASSESSMENT_MODEL, type SiteAssessmentInput, type SiteAssessmentOptions, videoAnalysisOperatorDigest } from "../site-assessment";
import { siteAssessmentTaskInput } from "../tasks/site-assessment";
import type { AgentResult, NormalizedAgentTask } from "../types";
import type { InboundRequest } from "../../types/inbound-request";

const sha = (value: Buffer | string) => createHash("sha256").update(value).digest("hex");
const digest = (value: unknown) => sha(JSON.stringify(value));
const requestFacts = (record: Record<string, any>) => Object.fromEntries([
  "buyerType", "taskDescription", "whatGoesWrong", "taskStatement", "details", "operatingConstraints",
  "siteTaskSpec", "siteTaskGates", "siteLocation", "siteLocationMetadata", "capture_region",
].map(key => [key, record.request?.[key] ?? null]));

// Exception prose is untrusted; only existing host codes and bounded provider
// metadata belong in the canonical private result. Never inspect headers/body.
const assessmentErrorCodes = new Set([
  "site_assessment_failed", "site_assessment_cancelled", "site_assessment_run_not_active", "site_assessment_runtime_cost_stop",
  "site_assessment_source_not_admitted", "site_assessment_lane_unavailable", "site_assessment_runtime_not_admitted",
  "site_assessment_video_read_not_allowed", "site_assessment_provider_domain_not_allowed", "site_assessment_request_not_found",
  "site_assessment_browser_capture_required", "site_assessment_source_changed", "site_assessment_context_changed",
  "site_assessment_capture_size_invalid", "site_assessment_capture_identity_changed", "site_assessment_capture_size_changed",
  "site_assessment_current_source_unverified", "site_assessment_manifest_changed", "site_assessment_advisory_binding_changed",
  "site_assessment_conversation_binding_invalid", "site_assessment_conversation_request_mismatch", "site_assessment_video_evidence_missing",
  "site_assessment_deadline_exceeded", "site_assessment_exposure_invalid", "site_assessment_cost_unresolved",
  "site_assessment_model_not_admitted", "site_assessment_input_budget_exceeded", "site_assessment_inference_cost_cap",
  "site_assessment_accounting_mismatch", "site_assessment_actual_cost_exceeds_reservation",
]);
const providerErrorCodes = new Set(["invalid_request_error", "rate_limit_exceeded", "context_length_exceeded", "invalid_api_key",
  "insufficient_quota", "server_error", "model_not_found", "ETIMEDOUT", "ECONNRESET", "ENOTFOUND", "EAI_AGAIN"]);
const sdkErrorClasses = new Set(["SystemError", "MaxTurnsExceededError", "ModelBehaviorError", "InvalidToolInputError", "UserError",
  "GuardrailExecutionError", "ToolCallError", "InputGuardrailTripwireTriggered", "OutputGuardrailTripwireTriggered",
  "ToolInputGuardrailTripwireTriggered", "ToolOutputGuardrailTripwireTriggered"]);
function errorField(error: unknown, key: string): unknown {
  // Own data properties only: a diagnostic getter must not replace the failure.
  try { return error && typeof error === "object" ? Object.getOwnPropertyDescriptor(error, key)?.value : undefined; }
  catch { return undefined; }
}
function assessmentExceptionDiagnostic(error: unknown, runId: string) {
  const apiClasses = ["APIConnectionTimeoutError", "APIConnectionError", "APIUserAbortError", "BadRequestError", "AuthenticationError",
    "PermissionDeniedError", "NotFoundError", "ConflictError", "UnprocessableEntityError", "RateLimitError", "InternalServerError", "APIError"] as const;
  const apiClass = apiClasses.find(name => error instanceof OpenAI[name]);
  const name = errorField(error, "name"), status = errorField(error, "status"), code = errorField(error, "code"), requestId = errorField(error, "request_id");
  const exceptionClass = apiClass ?? (error instanceof TypeError ? "TypeError" : error instanceof RangeError ? "RangeError"
    : error instanceof SyntaxError ? "SyntaxError" : error instanceof Error
      ? typeof name === "string" && sdkErrorClasses.has(name) ? name : "Error" : null);
  return { schema_version: "site_assessment_error.v1", correlation_id: runId, exception_class: exceptionClass,
    http_status: typeof status === "number" && Number.isInteger(status) && status >= 100 && status <= 599 ? status : null,
    provider_error_code: typeof code === "string" && providerErrorCodes.has(code) ? code : null,
    provider_request_id: typeof requestId === "string" && /^req_[a-f0-9]{16,64}$/.test(requestId) ? requestId : null };
}

/** Admission uses stored source identity, not URLs/durations in model input. */
export function bindBrowserAssessmentSource(requestId: string, record: Record<string, any>, pending: BrowserPending,
  manifest: Record<string, any>) {
  const privacy = record.capture_privacy_source_bound_decision;
  const prefix = `scenes/${pending.scene_id}/captures/${pending.capture_id}/raw/`;
  if (!projectWebsiteCaptureRights(record).derived_scene_generation_allowed
    || pending.request_id !== requestId || pending.scene_id !== `site-${requestId}` || pending.state !== "published"
    || !/^(walkthrough-|supplement-)[A-Za-z0-9._-]+$/.test(pending.capture_id)
    || ![`${prefix}walkthrough.mp4`, `${prefix}walkthrough.mov`].includes(pending.video.object_name)
    || pending.manifest.object_name !== `${prefix}manifest.json`
    || !privacy?.proceeded || !["approved", "unscreened"].includes(privacy.eligibility)
    || privacy.capture_id !== pending.capture_id || privacy.producer_source?.kind !== "browser_pending"
    || privacy.producer_source.key !== browserPendingDecisionKey(pending)
    || manifest.request_id !== requestId || manifest.scene_id !== pending.scene_id || manifest.capture_id !== pending.capture_id
    || manifest.video_uri !== pending.video.object_name
    || manifest.capture_rights?.derived_scene_generation_allowed !== true
    || manifest.capture_rights?.consent_status !== "granted" || manifest.capture_rights?.consent_revoked !== false
    || !Number.isFinite(manifest.duration_seconds) || manifest.duration_seconds <= 0) {
    throw new Error("site_assessment_source_not_admitted");
  }
  return { duration_seconds: Number(manifest.duration_seconds), source_key: browserPendingDecisionKey(pending) };
}

export { SiteAssessmentBudget } from "./site-assessment-budget";
import { SiteAssessmentBudget } from "./site-assessment-budget";

/** Trusted local host substitutes persistence, with optional explicit context omission. All live source checks remain below. */
export interface SiteAssessmentExperiment {
  mode: "saved-evidence" | "fresh-video";
  model_context?: "video-only";
  prepare: (source: Record<string, any>) => Promise<NonNullable<SiteAssessmentOptions["retained_video_sources"]>>;
  reserve: (...args: Parameters<typeof reserveCaptureCoverageInference>) => Promise<{
    receipt: Record<string, unknown>; assertDispatchAllowed(): Promise<void>; record(usage: unknown): Promise<void>;
  }>;
  analyze_video?: SiteAssessmentOptions["analyze_video"];
  record_error?: (error: unknown) => void;
}
/** Diagnostic suppression only: never changes admitted video, identity, rights or stored context. */
export function assessmentModelContext(input: SiteAssessmentInput, context?: "video-only"): SiteAssessmentInput {
  if (context === undefined) return input;
  if (context !== "video-only") throw new Error("experiment_model_context_invalid");
  return { ...input, operator_messages: [], prior_assessment: undefined, task_instruction: undefined,
    site_requirement: { spec: {}, serviceArea: null,
      location: { label: null, city: null, state: null, country: null }, taskFamily: null } };
}
export async function runSiteAssessmentTask(task: NormalizedAgentTask, host: { runId: string; assertActive: () => Promise<void>; assertCostAllowed: () => Promise<void>;
  experiment?: SiteAssessmentExperiment }): Promise<AgentResult> {
  const base = { provider: task.provider, runtime: task.runtime, model: task.model, tool_mode: task.tool_policy.mode,
    requires_human_review: true, requires_approval: false };
  const budget = new SiteAssessmentBudget();
  let captureAdmission: Awaited<ReturnType<SiteAssessmentExperiment["reserve"]>> | undefined;
  const captureReservations: unknown[] = [];
  let instance: Awaited<ReturnType<typeof createSiteAssessmentAgent>> | undefined;
  let sourceAdmission: Record<string, unknown> | null = null;
  try {
    const input = siteAssessmentTaskInput.parse(task.input);
    if (!db || !storageAdmin || !isSiteVideoEvidenceEnabled()) throw new Error("site_assessment_lane_unavailable");
    if (task.provider !== "openai_responses" || task.model !== SITE_ASSESSMENT_MODEL || task.tool_policy.mode === "none"
      || task.tool_policy.isolated_runtime_required || requiresMutationReconciliation(task)) throw new Error("site_assessment_runtime_not_admitted");
    if (!task.tool_policy.allowed_actions.includes("analyze_site_video")) throw new Error("site_assessment_video_read_not_allowed");
    if (task.tool_policy.allowed_domains.length && ["api.openai.com", "generativelanguage.googleapis.com", "storage.googleapis.com"]
      .some(domain => !task.tool_policy.allowed_domains.some(allowed => domain === allowed || domain.endsWith(`.${allowed}`)))) {
      throw new Error("site_assessment_provider_domain_not_allowed");
    }
    const ref = db.collection("inboundRequests").doc(input.context.request_id);
    const raw = (await ref.get()).data();
    if (!raw || raw.request?.buyerType !== "site_operator") throw new Error("site_assessment_request_not_found");
    const request = await decryptInboundRequestForAdmin(raw as any) as InboundRequest;
    const privacy = raw.capture_privacy_source_bound_decision;
    const pending = privacy?.capture_id ? await loadBrowserPending(privacy.capture_id) : null;
    if (!pending) throw new Error("site_assessment_browser_capture_required");
    const brief = await getBrief(input.context.request_id);
    const contextDigest = advisoryContextDigest(raw, brief);
    const assertAdvisoryClaim = async (current: Record<string, any>, selected: BrowserPending, currentBrief: Record<string, any> | null) => {
      if (!input.context.advisory_job_id) return;
      const job = (await db!.collection("siteAssessmentJobs").doc(input.context.advisory_job_id).get()).data();
      assertAdvisoryJobBinding(job, { jobId: input.context.advisory_job_id, requestId: input.context.request_id,
        sourceKey: browserPendingDecisionKey(selected), contextDigest: advisoryContextDigest(current, currentBrief),
        runId: host.runId, claimId: input.context.advisory_claim_id! });
    };
    const assertCurrentSession = async (selected: BrowserPending) => {
      const session = (await db!.collection("captureUploadSessions").doc(selected.capture_id).get()).data();
      const current = session?.browser_pending_delivery as BrowserPending | undefined;
      if (!current || current.state !== "published" || session?.browser_upload_reservation || session?.browser_stored_upload
        || browserPendingDecisionKey(current) !== browserPendingDecisionKey(selected)) {
        throw new Error("site_assessment_source_changed");
      }
    };
    await assertCurrentSession(pending);
    await assertAdvisoryClaim(raw, pending, brief);
    const bucket = storageAdmin.bucket(process.env.BLUEPRINT_CAPTURE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET || "blueprint-8c1ca.appspot.com");
    const readPinned = async (object: BrowserPending["video"], maxBytes: number) => {
      if (!/^[1-9][0-9]{0,19}$/.test(object.generation) || !Number.isSafeInteger(object.size_bytes)
        || object.size_bytes < 1 || object.size_bytes > maxBytes) throw new Error("site_assessment_capture_size_invalid");
      const file = bucket.file(object.object_name, { generation: object.generation });
      const [metadata] = await file.getMetadata();
      if (String(metadata.generation) !== object.generation || Number(metadata.size) !== object.size_bytes
        || metadata.crc32c !== object.crc32c) throw new Error("site_assessment_capture_identity_changed");
      const [body] = await file.download({ validation: "crc32c" });
      if (body.length !== object.size_bytes) throw new Error("site_assessment_capture_size_changed");
      return { file, body, contentType: String(metadata.contentType || "video/mp4") };
    };
    // Path/scope admission precedes ANY Storage read. The manifest is checked
    // again with its real duration after reading its immutable generation.
    bindBrowserAssessmentSource(input.context.request_id, raw, pending, { request_id: pending.request_id,
      scene_id: pending.scene_id, capture_id: pending.capture_id, video_uri: pending.video.object_name, duration_seconds: 1,
      capture_rights: projectWebsiteCaptureRights(raw) });
    if (!(await verifiedPendingManifest(pending)) || !(await verifiedPendingMarker(pending))) {
      throw new Error("site_assessment_current_source_unverified");
    }
    const manifestBytes = await readPinned(pending.manifest, 65536);
    if (`sha256:${sha(manifestBytes.body)}` !== pending.manifest.sha256) throw new Error("site_assessment_manifest_changed");
    const bound = bindBrowserAssessmentSource(input.context.request_id, raw, pending, JSON.parse(manifestBytes.body.toString("utf8")));
    const video = await readPinned(pending.video, 64 * 1024 * 1024);
    const videoRef = `gs://${bucket.name}/${pending.video.object_name}#generation=${pending.video.generation}`;
    const videoSha = sha(video.body);
    sourceAdmission = { schema_version: "site_assessment_source.v1", request_id: pending.request_id, capture_id: pending.capture_id,
      source_key: bound.source_key, context_digest: contextDigest, advisory_job_id: input.context.advisory_job_id ?? null, video_ref: videoRef, video_sha256: videoSha, video_bytes: video.body.length,
      duration_seconds: bound.duration_seconds, manifest: pending.manifest, rights: projectWebsiteCaptureRights(raw),
      privacy_eligibility: privacy.eligibility, privacy_proceeded: privacy.proceeded };
    // Bytes are already pinned and verified; experiments never mint an access URL.
    const url = host.experiment ? "" : (await video.file.getSignedUrl({ action: "read", expires: Date.now() + 30 * 60 * 1000,
      queryParams: { generation: pending.video.generation } }))[0];

    const assertSourceCurrent = async () => {
      const current = (await ref.get()).data(), currentPending = await loadBrowserPending(pending.capture_id);
      if (!current || !currentPending || digest(requestFacts(current)) !== digest(requestFacts(raw))
        || browserPendingDecisionKey(currentPending) !== bound.source_key) throw new Error("site_assessment_source_changed");
      await assertCurrentSession(currentPending);
      const currentBrief = await getBrief(input.context.request_id);
      if (advisoryContextDigest(current, currentBrief) !== contextDigest) throw new Error("site_assessment_context_changed");
      bindBrowserAssessmentSource(input.context.request_id, current, currentPending, JSON.parse(manifestBytes.body.toString("utf8")));
      if (!(await verifiedPendingManifest(currentPending)) || !(await verifiedPendingMarker(currentPending))) {
        throw new Error("site_assessment_current_source_unverified");
      }
      await assertAdvisoryClaim(current, currentPending, currentBrief);
    };
    const messages: SiteAssessmentInput["operator_messages"] = [];
    let priorPacket: Record<string, any> | undefined;
    for (const field of ["taskDescription", "whatGoesWrong", "taskStatement", "operatingConstraints", "details"] as const) {
      const text = request.request[field], stored = raw.request?.[field];
      // Decryption may add display defaults; only stored assertions are evidence.
      const recorded = typeof stored === "string" ? Boolean(stored.trim()) : isEncryptedField(stored);
      if (recorded && typeof text === "string" && text.trim()) messages.push({ id: `site:${field}`, text,
        source_ref: `inboundRequests/${input.context.request_id}/request/${field}` });
    }
    for (const field of ["operatorTaskDetails", "successCriteria", "operatorAnswers"] as const) {
      if (brief?.[field]) messages.push({ id: `brief:${field}`, text: JSON.stringify({ basis: "owner_stated_unverified", [field]: brief[field] }),
        source_ref: `siteTaskBriefs/${input.context.request_id}/${field}` });
    }
    if (task.resume_from_run_id) {
      const priorRef = db.collection("agentRuns").doc(task.resume_from_run_id), prior = (await priorRef.get()).data();
      if (!prior || prior.session_id !== task.session_id || prior.task_kind !== "site_assessment" || prior.status !== "completed") throw new Error("site_assessment_conversation_binding_invalid");
      const retained = await hydrateAgentEvidence(prior, { collection: "agentRuns", id: priorRef.id });
      const packet = retained.artifacts?.site_assessment_packet;
      if (packet?.request_id !== input.context.request_id) throw new Error("site_assessment_conversation_request_mismatch");
      priorPacket = packet;
    }
    const modelInput = assessmentModelContext({ request_id: input.context.request_id, operator_messages: messages,
      task_instruction: input.message, prior_assessment: priorPacket?.assessment,
      video: { source_id: pending.capture_id, source_ref: videoRef,
        url, sha256: videoSha, duration_seconds: bound.duration_seconds }, site_requirement: toSiteRequirement(request) }, host.experiment?.model_context);
    const experimentSources = host.experiment ? await host.experiment.prepare({ ...sourceAdmission,
      experiment_context_digest: inferenceProgrammeContextDigest(raw, brief), producer_source: privacy.producer_source,
      model_context: host.experiment.model_context ?? "production",
      operator_messages_sha256: videoAnalysisOperatorDigest(modelInput.operator_messages) }) : undefined;
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, baseURL: "https://api.openai.com/v1", maxRetries: 0, timeout: getOpenAiTimeoutMs() });
    const provider = new OpenAIProvider({ useResponses: true,
      openAIClient: client as unknown as NonNullable<ConstructorParameters<typeof OpenAIProvider>[0]>["openAIClient"] });
    instance = await createSiteAssessmentAgent(modelInput, {
      history_access: await (async () => {
        const access = await getCompanyHistoryAccess(task);
        // Experiments authorize Sol/Gemini only. Preserve read scope, suppress optional paid embeddings.
        return access && host.experiment ? { ...access, embeddingAuthority: { enabled: false,
          model: "text-embedding-3-small", dimensions: 1536, maxInputCharacters: 1 } } : access;
      })(), model: task.model, model_provider: provider,
      video_bytes: { body: video.body, byteLength: video.body.length, contentType: video.contentType },
      allowed_tools: task.tool_policy.allowed_actions,
      assert_video_processing_allowed: async () => {
        await host.assertActive(); await assertSourceCurrent();
      },
      analyze_video: host.experiment?.analyze_video,
      retained_video_sources: experimentSources ?? (priorPacket?.sources ?? []).filter((source: any) => source.kind === "video"
        && source.sha256 === videoSha && source.canonical_ref === videoRef),
      authorize_model_call: async (kind, model, request) => {
        await host.assertActive(); await assertSourceCurrent(); budget.authorize(kind, model, request);
        captureAdmission = await (host.experiment?.reserve ?? reserveCaptureCoverageInference)(model, { capture_id: pending.capture_id,
          assessment_run_id: host.runId, assessment_request_id: input.context.request_id,
          assessment_video_sha256: videoSha,
          assessment_source: raw.capture_privacy_source_bound_decision?.producer_source }, kind, request);
        captureReservations.push(captureAdmission.receipt);
        // Admission may await storage, rights and durable accounting. Verify
        // authority again at the dispatch boundary; retained reservations are
        // not refunded merely because a later source fence denies dispatch.
        await host.assertActive(); await assertSourceCurrent();
        await captureAdmission.assertDispatchAllowed();
      },
      record_model_response: async (kind, model, response) => { budget.record(kind, model, response);
        await captureAdmission?.record((response as any)?.usage); captureAdmission = undefined; },
    });
    const packet = await instance.run();
    if (!packet.sources.some(source => source.kind === "video" && source.sha256 === videoSha
      && source.canonical_ref === videoRef)) throw new Error("site_assessment_video_evidence_missing");
    await host.assertActive();
    await assertSourceCurrent();
    return { ...base, status: "completed", output: packet.assessment,
      artifacts: { site_assessment_packet: packet, site_assessment_packet_sha256: digest(packet), source_admission: sourceAdmission, capture_inference_reservations: captureReservations, ...budget.artifacts() } };
  } catch (error) {
    // Diagnostics must never replace the original result or its retained reservations.
    try { host.experiment?.record_error?.(error); } catch {}
    const code = errorField(error, "message");
    const message = error instanceof Error && typeof code === "string" && assessmentErrorCodes.has(code) ? code : "site_assessment_failed";
    return { ...base, status: message === "site_assessment_cancelled" ? "cancelled" : "failed", error: message,
      artifacts: { site_assessment_error: assessmentExceptionDiagnostic(error, host.runId), site_assessment_partial_evidence: instance?.evidence() ?? null, source_admission: sourceAdmission, capture_inference_reservations: captureReservations, ...budget.artifacts() } };
  }
}
