import { createHash } from "node:crypto";
import OpenAI from "openai";
import { OpenAIProvider } from "@openai/agents";
import { dbAdmin as db, storageAdmin } from "../../../client/src/lib/firebaseAdmin";
import { decryptInboundRequestForAdmin } from "../../utils/field-encryption";
import { browserPendingDecisionKey, loadBrowserPending, type BrowserPending } from "../../utils/websiteBrowserPending";
import { projectWebsiteCaptureRights } from "../../utils/websiteTaskContext";
import { toSiteRequirement } from "../../utils/siteMatchRun";
import { getBrief } from "../../utils/siteTaskBrief";
import { isSiteVideoEvidenceEnabled } from "../../config/env";
import { hydrateAgentEvidence, requiresMutationReconciliation } from "../private-evidence";
import { getCompanyHistoryAccess } from "../operator-tools";
import { getGeminiVideoModel, getOpenAiMaxOutputTokens, getOpenAiTimeoutMs } from "../provider-config";
import { createSiteAssessmentAgent, SITE_ASSESSMENT_MODEL, type SiteAssessmentInput } from "../site-assessment";
import { siteAssessmentTaskInput } from "../tasks/site-assessment";
import type { AgentResult, NormalizedAgentTask } from "../types";
import type { InboundRequest } from "../../types/inbound-request";

const sha = (value: Buffer | string) => createHash("sha256").update(value).digest("hex");
const digest = (value: unknown) => sha(JSON.stringify(value));
const requestFacts = (record: Record<string, any>) => Object.fromEntries([
  "buyerType", "taskDescription", "whatGoesWrong", "taskStatement", "details", "operatingConstraints",
  "siteTaskSpec", "siteTaskGates", "siteLocation", "siteLocationMetadata", "capture_region",
].map(key => [key, record.request?.[key] ?? null]));

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

type Call = { provider: "openai" | "gemini"; model: string; reserved_usd: number;
  usage: unknown; response: unknown; cost_usd: number | null; input_tokens: number | null; output_tokens: number | null };
const counter = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
const configuredPositive = (value: string | undefined, fallback: number, maximum: number) => {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
};

/** Reuses the existing inference cap; unknown paid calls retain their exposure. */
export class SiteAssessmentBudget {
  readonly calls: Call[] = [];
  readonly cap = configuredPositive(process.env.BLUEPRINT_OPENAI_AGENT_MAX_INFERENCE_COST_USD, 5, 100);
  readonly inputCeiling = Math.floor(configuredPositive(process.env.BLUEPRINT_OPENAI_AGENT_MAX_INPUT_TOKENS, 100000, 100000));
  readonly maxOutput = Math.min(8192, getOpenAiMaxOutputTokens());
  authorize(provider: "openai" | "gemini", model: string, request?: unknown) {
    if (this.calls.some(call => call.response === null)) throw new Error("site_assessment_cost_unresolved");
    if ((provider === "openai" && model !== SITE_ASSESSMENT_MODEL)
      || (provider === "gemini" && (model !== getGeminiVideoModel() || model !== "gemini-3.8-flash"))) {
      throw new Error("site_assessment_model_not_admitted");
    }
    // UTF-8 bytes upper-bound visible text tokens; reserve room for SDK schemas.
    if (provider === "openai" && Buffer.byteLength(JSON.stringify(request ?? {})) + 4096 > this.inputCeiling) {
      throw new Error("site_assessment_input_budget_exceeded");
    }
    // Sol: uncached input plus a conservative cache-write ceiling. Flash:
    // full 1,048,576-token context and 32768 output at its announced post-2026 ceiling.
    // Pricing sources are retained below; these are estimates, never invoices.
    const reserved = provider === "openai" ? (this.inputCeiling * 2.5 + this.maxOutput * 10) / 1e6
      : (1_048_576 * 1.5 + 32768 * 7.5) / 1e6;
    if (this.calls.reduce((sum, call) => sum + (call.cost_usd ?? call.reserved_usd), 0) + reserved > this.cap) {
      throw new Error("site_assessment_inference_cost_cap");
    }
    this.calls.push({ provider, model, reserved_usd: reserved, usage: null, response: null, cost_usd: null, input_tokens: null, output_tokens: null });
  }
  record(provider: "openai" | "gemini", model: string, response: any) {
    const call = this.calls.at(-1);
    if (!call || call.provider !== provider || call.model !== model || call.response !== null) throw new Error("site_assessment_accounting_mismatch");
    call.response = response; call.usage = response?.usage ?? null;
    const input = counter(provider === "openai" ? response?.usage?.input_tokens : response?.usage?.promptTokenCount);
    const visibleOutput = counter(provider === "openai" ? response?.usage?.output_tokens : response?.usage?.candidatesTokenCount);
    const thoughts = provider === "openai" ? 0 : counter(response?.usage?.thoughtsTokenCount ?? 0);
    const output = visibleOutput !== null && thoughts !== null ? visibleOutput + thoughts : null;
    call.input_tokens = input; call.output_tokens = output;
    if (input !== null && output !== null) {
      const flashInputRate = Date.now() < Date.parse("2027-01-01T00:00:00Z") ? 0.75 : 1.5;
      const flashOutputRate = flashInputRate * 5;
      // Missing cache-write detail retains the highest admitted input rate.
      // Never release this exposure at the cheaper ordinary-input rate.
      call.cost_usd = (input * (provider === "openai" ? 2.5 : flashInputRate) + output * (provider === "openai" ? 10 : flashOutputRate)) / 1e6;
      if (call.cost_usd > call.reserved_usd) throw new Error("site_assessment_actual_cost_exceeds_reservation");
    }
  }
  artifacts() {
    const known = this.calls.every(call => call.cost_usd !== null);
    const total = (key: "input_tokens" | "output_tokens") => this.calls.every(call => call[key] !== null)
      ? this.calls.reduce((sum, call) => sum + call[key]!, 0) : null;
    const reportedCost = this.calls.filter(call => call.cost_usd !== null).reduce((sum, call) => sum + call.cost_usd!, 0);
    const unknown = this.calls.filter(call => call.cost_usd === null);
    return { provider_responses: this.calls, usage_samples: this.calls.map(call => ({ provider: call.provider, model: call.model,
      input_tokens: call.input_tokens, output_tokens: call.output_tokens, estimated_total_cost_usd: call.cost_usd,
      reserved_max_cost_usd: call.reserved_usd, raw_usage: call.usage })),
      known_usage_subtotals: { estimated_total_cost_usd: reportedCost }, usage_detail_status: "partial",
      usage: { calls: this.calls.length, prompt_tokens: total("input_tokens"), completion_tokens: total("output_tokens"),
        cost_usd: known ? reportedCost : null, estimated_total_cost_usd: known ? reportedCost : null },
      cost_status: known ? "reported_usage_pricing_estimate" : "usage_missing",
      inference_reservation: { hard_cost_cap_usd: this.cap, known_reported_cost_usd: reportedCost,
        reconciled_cost_status: known ? "reported_usage_pricing_estimate" : "includes_worst_case_reservations",
        projected_max_cost_per_call_usd: Math.max(0, ...unknown.map(call => call.reserved_usd)),
        unknown_usage_reserved_cost_usd: this.calls.filter(call => call.cost_usd === null).reduce((sum, call) => sum + call.reserved_usd, 0),
        reconciled_cost_usd: this.calls.reduce((sum, call) => sum + (call.cost_usd ?? call.reserved_usd), 0),
        pricing_sources: ["https://openai.com/index/introducing-gpt-6-1-sol/", "https://ai.google.dev/gemini-api/docs/pricing"],
        pricing_basis: "2026-10-07; Sol standard rates, Flash promotional rates through 2026 then announced standard rates; no cache savings assumed" },
    };
  }
}

export async function runSiteAssessmentTask(task: NormalizedAgentTask, host: { runId: string; assertActive: () => Promise<void>; assertCostAllowed: () => Promise<void> }): Promise<AgentResult> {
  const base = { provider: task.provider, runtime: task.runtime, model: task.model, tool_mode: task.tool_policy.mode,
    requires_human_review: true, requires_approval: false };
  const budget = new SiteAssessmentBudget();
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
    const manifestBytes = await readPinned(pending.manifest, 65536);
    if (`sha256:${sha(manifestBytes.body)}` !== pending.manifest.sha256) throw new Error("site_assessment_manifest_changed");
    const bound = bindBrowserAssessmentSource(input.context.request_id, raw, pending, JSON.parse(manifestBytes.body.toString("utf8")));
    const video = await readPinned(pending.video, 64 * 1024 * 1024);
    const videoRef = `gs://${bucket.name}/${pending.video.object_name}#generation=${pending.video.generation}`;
    const videoSha = sha(video.body);
    sourceAdmission = { schema_version: "site_assessment_source.v1", request_id: pending.request_id, capture_id: pending.capture_id,
      source_key: bound.source_key, video_ref: videoRef, video_sha256: videoSha, video_bytes: video.body.length,
      duration_seconds: bound.duration_seconds, manifest: pending.manifest, rights: projectWebsiteCaptureRights(raw),
      privacy_eligibility: privacy.eligibility, privacy_proceeded: privacy.proceeded };
    const [url] = await video.file.getSignedUrl({ action: "read", expires: Date.now() + 30 * 60 * 1000,
      queryParams: { generation: pending.video.generation } });
    const assertSourceCurrent = async () => {
      const current = (await ref.get()).data(), currentPending = await loadBrowserPending(pending.capture_id);
      if (!current || !currentPending || digest(requestFacts(current)) !== digest(requestFacts(raw))
        || browserPendingDecisionKey(currentPending) !== bound.source_key) throw new Error("site_assessment_source_changed");
      bindBrowserAssessmentSource(input.context.request_id, current, currentPending, JSON.parse(manifestBytes.body.toString("utf8")));
    };
    const messages: SiteAssessmentInput["operator_messages"] = [];
    let priorPacket: Record<string, any> | undefined;
    for (const field of ["taskDescription", "whatGoesWrong", "taskStatement", "operatingConstraints", "details"] as const) {
      const text = request.request[field];
      if (typeof text === "string" && text.trim()) messages.push({ id: `site:${field}`, text,
        source_ref: `inboundRequests/${input.context.request_id}/request/${field}` });
    }
    const brief = await getBrief(input.context.request_id).catch(() => null);
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
      for (const source of packet.sources ?? []) if (source.kind === "operator" && source.canonical_ref.startsWith("agentRuns/")) {
        messages.push({ id: source.source_id.replace(/^operator:/, ""), text: source.content, source_ref: source.canonical_ref });
      }
    }
    messages.push({ id: `conversation:${host.runId}`, text: `Supplied operator conversation (speaker identity unverified): ${input.message}`,
      source_ref: `agentRuns/${host.runId}/input/input/message` });
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, baseURL: "https://api.openai.com/v1", maxRetries: 0, timeout: getOpenAiTimeoutMs() });
    const provider = new OpenAIProvider({ useResponses: true,
      openAIClient: client as unknown as NonNullable<ConstructorParameters<typeof OpenAIProvider>[0]>["openAIClient"] });
    instance = await createSiteAssessmentAgent({ request_id: input.context.request_id, operator_messages: messages,
      prior_assessment: priorPacket?.assessment,
      video: { source_id: pending.capture_id, source_ref: videoRef,
        url, sha256: videoSha, duration_seconds: bound.duration_seconds }, site_requirement: toSiteRequirement(request) }, {
      history_access: await getCompanyHistoryAccess(task), model: task.model, model_provider: provider,
      video_bytes: { body: video.body, byteLength: video.body.length, contentType: video.contentType },
      max_output_tokens: budget.maxOutput, allowed_tools: task.tool_policy.allowed_actions,
      retained_video_sources: (priorPacket?.sources ?? []).filter((source: any) => source.kind === "video"
        && source.sha256 === videoSha && source.canonical_ref === videoRef),
      authorize_model_call: async (kind, model, request) => {
        await host.assertActive(); await assertSourceCurrent(); await host.assertCostAllowed(); budget.authorize(kind, model, request);
      },
      record_model_response: async (kind, model, response) => { budget.record(kind, model, response); },
    });
    const packet = await instance.run();
    await host.assertActive();
    await assertSourceCurrent();
    return { ...base, status: "completed", output: packet.assessment,
      artifacts: { site_assessment_packet: packet, site_assessment_packet_sha256: digest(packet), source_admission: sourceAdmission, ...budget.artifacts() } };
  } catch (error) {
    const message = error instanceof Error && /^site_assessment_/.test(error.message) ? error.message.split(":")[0] : "site_assessment_failed";
    return { ...base, status: message === "site_assessment_cancelled" ? "cancelled" : "failed", error: message,
      artifacts: { site_assessment_partial_evidence: instance?.evidence() ?? null, source_admission: sourceAdmission, ...budget.artifacts() } };
  }
}
