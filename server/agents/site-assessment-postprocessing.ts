import { createHash } from "node:crypto";
import { requiresMutationReconciliation } from "./private-evidence";
import { renderSourceBoundAssessment, siteAssessmentSchema, validateVideoObservations,
  SITE_ASSESSMENT_MAX_PACKET_BYTES, SITE_ASSESSMENT_MAX_PACKET_SOURCES } from "./site-assessment";

/** Recover only the now-understood description qualification failure. No SDK,
 * provider, budget reservation or synthetic output is invoked by this function.
 * The caller must hydrate verified evidence and recheck current source authority.
 */
export function recoverSiteAssessmentPostprocessing(run: Record<string, any>, binding: {
  request_id: string; capture_id: string; source_key: string; context_digest: string; advisory_job_id: string;
}) {
  try {
    if (run.status !== "failed" || run.task_kind !== "site_assessment" || run.error !== "site_assessment_failed"
      || requiresMutationReconciliation(run)) return null;
    const artifacts = run.artifacts, source = artifacts?.source_admission;
    if (!source || Object.entries(binding).some(([key, value]) => source[key] !== value)
      || !Number.isFinite(source.duration_seconds) || source.duration_seconds <= 0) return null;
    const partial = artifacts.site_assessment_partial_evidence, calls = artifacts.provider_responses;
    if (!Array.isArray(partial?.sources) || !Array.isArray(partial.tool_receipts)
      || !partial.sources.length || partial.sources.length > SITE_ASSESSMENT_MAX_PACKET_SOURCES
      || !Array.isArray(calls) || !calls.length || calls.some((call: any) =>
        typeof call.cost_usd !== "number" || !Number.isFinite(call.cost_usd) || call.cost_usd < 0)) return null;
    const last = calls.at(-1), response = last.response;
    if (last.provider !== "openai" || last.model !== run.model || response?.status !== "completed"
      || response.error != null || response.incomplete_details != null || typeof response.id !== "string"
      || !Array.isArray(response.output) || response.output.some((item: any) =>
        !["reasoning", "message"].includes(item.type))) return null;
    const messages = response.output.filter((item: any) => item.type === "message");
    if (messages.length !== 1 || !Array.isArray(messages[0].content) || messages[0].content.length !== 1
      || messages[0].content[0].type !== "output_text" || typeof messages[0].content[0].text !== "string") return null;
    const raw = siteAssessmentSchema.parse(JSON.parse(messages[0].content[0].text));
    const sources = new Map<string, any>(partial.sources.map((item: any) => [item.source_id, item]));
    const videos = partial.sources.filter((item: any) => item.kind === "video"
      && item.sha256 === source.video_sha256 && item.canonical_ref === source.video_ref);
    if (sources.size !== partial.sources.length || !videos.length) return null;
    for (const video of videos) validateVideoObservations(video.content?.evidence, source.duration_seconds);
    const rendered = renderSourceBoundAssessment(raw, sources, source.duration_seconds);
    if (!rendered.verification.unqualified_registry_context_claims) return null;
    const recovery = { schema_version: "site_assessment_postprocessing_recovery.v1",
      previous_status: run.status, previous_error: run.error,
      previous_evidence_ref: run.agent_evidence_ref ?? null,
      retained_response_id: response.id,
      retained_output_sha256: createHash("sha256").update(messages[0].content[0].text).digest("hex"),
      provider_calls: 0, spending_reservations_created: 0,
      claim_boundary: "Retained model output re-rendered as advisory evidence; no new model execution or robot qualification." };
    const packet = { schema_version: "site_assessment.v2", request_id: binding.request_id,
      ...rendered, raw_model_assessment: raw, sources: partial.sources, tool_receipts: partial.tool_receipts,
      model_requested: last.model, usage: calls.filter((call: any) => call.provider === "openai").map((call: any) => call.usage),
      postprocessing_recovery: recovery };
    if (Buffer.byteLength(JSON.stringify(packet)) > SITE_ASSESSMENT_MAX_PACKET_BYTES) return null;
    return { packet, recovery };
  } catch { return null; }
}
