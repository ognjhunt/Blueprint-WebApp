import type { SiteAssessment } from "../../agents/site-assessment";

// Synthetic completed provider bytes, never a model/robot accuracy label.
export function failedDescriptionAssessment(binding = {
  request_id: "description-fixture", capture_id: "walkthrough-description-fixture",
  source_key: "synthetic-source", context_digest: "synthetic-context", advisory_job_id: "synthetic-job",
}) {
  const video = { source_id: "video:fixture", kind: "video", canonical_ref: "synthetic/video#generation=1",
    sha256: "a".repeat(64), checked_at: null, content: { evidence: { summary: "A visible object",
      observations: [{ category: "object", finding: "An object is on a surface", basis: "observed",
        start_seconds: 0, end_seconds: 1, uncertainty: "Metric dimensions unknown" }], not_observable: ["Robot suitability"] } } };
  const registry = { source_id: "robotTeam:fixture", kind: "robot_registry", canonical_ref: "robotTeams/fixture",
    sha256: "b".repeat(64), checked_at: null, content: { capability: {}, fieldProvenance: {},
      capabilityDescription: "A research lead; deployment fit and reach are unknown." } };
  const raw: SiteAssessment = { status: "assessment", job: [{ text: "The object is visible", basis: "observed", evidence: [
    { source_id: video.source_id, at_seconds: 0, selector: { kind: "video_observation", observation_index: 0, field_path: null } },
  ] }], objects_motions_conditions_variations: [], operator_success: [], known: [{ text: "Unsupported model interpretation",
    basis: "published", evidence: [{ source_id: registry.source_id, at_seconds: null,
      selector: { kind: "qualified_field", observation_index: null, field_path: ["capabilityDescription"] } }] }],
    estimates: [], missing: [], approaches: [{ approach: "Investigate a fixed arm", disposition: "plausible",
      reasons: [{ text: "Task capability needs checking", basis: "estimate", evidence: [] }], remaining_checks: ["Check reach"] }],
    next_action: { kind: "research", action: "Check capability", why: { text: "Reach unknown", basis: "unknown", evidence: [] } }, questions: [] };
  const source = { ...binding, duration_seconds: 2, video_sha256: video.sha256, video_ref: video.canonical_ref };
  const run = { id: "synthetic-run", task_kind: "site_assessment", status: "failed", model: "gpt-6.1-sol",
    error: "site_assessment_failed", artifacts: { source_admission: source,
      site_assessment_partial_evidence: { sources: [video, registry], tool_receipts: [] },
      provider_responses: [{ provider: "openai", model: "gpt-6.1-sol", cost_usd: 0.1, usage: { input_tokens: 10, output_tokens: 10 },
        response: { id: "resp_synthetic", status: "completed", error: null, incomplete_details: null,
          output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(raw) }] }] } }],
      usage: { cost_usd: 0.1 }, capture_inference_reservations: [{ reserved_usd: 0.3 }] } };
  return { run, raw, sources: [video, registry], binding };
}
