// @vitest-environment node
import { describe, expect, it } from "vitest";
import { parseBetaPolicyScreeningPublication, screeningPublicationTransition } from "../utils/betaPolicyScreeningContract";
import { encodeTaskEvaluationRunPublication, publicationFromResultRecord } from "../utils/taskEvaluationRunPublicationStorage";
import { projectManagedJobEvidence } from "../utils/jobManagedEvaluation";
import { taskScreeningEvidence } from "../utils/taskScreeningEvidence";
import { renderSourceBoundAssessment, type SiteAssessment } from "../agents/site-assessment";
import { sealScreening, screeningSha } from "./fixtures/beta-policy-screening";
import scriptedFixture from "./fixtures/pipeline-beta-policy-screening-scripted-publication.v2.json";
import legacyFixture from "./fixtures/pipeline-beta-policy-screening-publication.v2.json";

function projection() {
  const publication = parseBetaPolicyScreeningPublication(scriptedFixture)!;
  const scope = { requestId: "job-1", briefDigest: screeningSha("1"), captureId: publication.source.capture_id };
  const run = { run_id: publication.campaign_id, run_kind: "beta_policy_screening", state: "completed", result_record_id: "result-one",
    job_evidence_binding: { job_id: scope.requestId, brief_digest: scope.briefDigest },
    job_task_context_digest: publication.source.task_context_digest, job_source_fingerprint: screeningSha("2"),
    configuration_digest: publication.plan_digest, source_scene_intent_id: publication.source.scene_intent_id,
    source_scene_revision_digest: publication.source.scene_revision_digest, publication_digest: publication.publication_digest,
    publication_revision: publication.revision };
  const record = { record_id: "result-one", publication_storage: encodeTaskEvaluationRunPublication(publication) };
  const row = projectManagedJobEvidence(run.run_id, run, record, scope.requestId, scope.briefDigest,
    publication.source.task_context_digest, screeningSha("2"))!;
  return { publication, scope, record, row, readback: taskScreeningEvidence(scope, [row], "2026-10-30T00:00:00Z") };
}

describe("typed scripted simulation publication", () => {
  it("roundtrips the real Python publication through compressed storage and task readback", () => {
    const { publication, record, row, readback } = projection();
    expect(publicationFromResultRecord(record)).toEqual(scriptedFixture);
    expect(row.current).toBe(true);
    const candidate = readback.runs[0].candidates[0];
    expect(candidate).toMatchObject({ scored: 3, succeeded: 2, failed: 1, void: 7,
      executionEvidence: { execution_evidence_kind: "scripted_simulator_state_baseline", action_source: "scripted_simulator_state",
        scripted_rollout_count: 10, learned_policy_rollout_count: 0, scripted_controller_invoked: true, candidate_policy_queried: false } });
    expect(readback.runs[0].provenance?.publication_digest).toBe(publication.publication_digest);
    expect(row.limitations.join(" ")).toContain("do not establish learned-policy or vendor-policy performance");
  });

  it("keeps scripted scope in complete citations and refuses measured learned-policy promotion", () => {
    const { readback } = projection(), source = readback.evidence_source!;
    const assessment: SiteAssessment = { status: "assessment", job: [], objects_motions_conditions_variations: [],
      operator_success: [], known: [{ text: "A vendor learned policy has proven physical success", basis: "published", evidence: [{
        source_id: source.source_id, at_seconds: null, selector: { kind: "qualified_field", observation_index: null,
          field_path: ["candidate_statements", "campaign-1:candidate-000"] } }] }], estimates: [], missing: [], approaches: [], questions: [],
      next_action: { kind: "research", action: "Review the task result", why: { text: "", basis: "unknown", evidence: [] } } };
    const sources = new Map([[source.source_id, source]]);
    const result = renderSourceBoundAssessment(assessment, sources, null).assessment.known[0];
    expect(result.text).toContain("scripted simulator-state baseline");
    expect(result.text).toContain("0 learned-policy rollouts");
    expect(result.text).toContain("do not establish learned-policy or vendor-policy performance");
    expect(result.text).not.toContain("proven physical success");
    assessment.known[0].basis = "measured";
    expect(renderSourceBoundAssessment(assessment, sources, null).assessment.known[0].basis).toBe("unknown");
  });

  it.each([{ learned_policy_rollout_count: 1 }, { candidate_policy_queried: true }, { action_source: "learned_policy" },
    { scripted_controller_invoked: false }, { scripted_rollout_count: 2 }, { scripted_rollout_count: undefined }])(
    "rejects scripted provenance or count mismatch %j", change => {
      expect(parseBetaPolicyScreeningPublication(sealScreening({ ...scriptedFixture,
        candidates: [JSON.parse(JSON.stringify({ ...scriptedFixture.candidates[0], ...change }))] }))).toBeNull();
    });

  it("does not infer invocation from retained prestart failures", () => {
    const value = sealScreening({ ...scriptedFixture, candidates: [{ ...scriptedFixture.candidates[0],
      episodes_scored: 0, episodes_succeeded: 0, episodes_failed: 0, episodes_void: 10,
      success_rate: null, scripted_controller_invoked: false }] });
    expect(parseBetaPolicyScreeningPublication(value)?.candidates[0]).toMatchObject({
      scripted_rollout_count: 10, scripted_controller_invoked: false, learned_policy_rollout_count: 0 });
  });

  it.each(["scripted_simulator_state_baseline", "learned_policy"])("requires a retained record for a %s invocation", kind => {
    const value = sealScreening({ ...scriptedFixture, candidates: [{ ...scriptedFixture.candidates[0],
      episodes_scored: 0, episodes_succeeded: 0, episodes_failed: 0, episodes_void: 10, success_rate: null,
      execution_evidence_kind: kind, action_source: kind === "learned_policy" ? "learned_policy" : "scripted_simulator_state",
      scripted_rollout_count: 0, learned_policy_rollout_count: 0,
      scripted_controller_invoked: kind !== "learned_policy", candidate_policy_queried: kind === "learned_policy" }] });
    expect(parseBetaPolicyScreeningPublication(value)).toBeNull();
  });

  it("binds execution kind before any outcome and refuses relabelling within a campaign", () => {
    const pending = sealScreening({ ...scriptedFixture, revision: 1, status: "queued", candidates: [{ ...scriptedFixture.candidates[0],
      status: "pending", episodes_scored: 0, episodes_succeeded: 0, episodes_failed: 0, episodes_void: 0,
      success_rate: null, session_result_digest: null, scripted_rollout_count: 0, scripted_controller_invoked: false }] });
    const changed = sealScreening({ ...pending, revision: 2, candidates: [{ ...pending.candidates[0],
      execution_evidence_kind: "learned_policy", action_source: "learned_policy" }] });
    expect(parseBetaPolicyScreeningPublication(pending)).not.toBeNull();
    expect(parseBetaPolicyScreeningPublication(changed)).not.toBeNull();
    expect(() => screeningPublicationTransition(pending, changed)).toThrow("screening_campaign_identity_conflict");
  });

  it("keeps retained publication bytes and unspecified execution provenance unchanged", () => {
    const legacy = parseBetaPolicyScreeningPublication(legacyFixture)!;
    expect(legacy).toEqual(legacyFixture);
    expect(legacy.candidates[0].execution_evidence_kind).toBeUndefined();
  });
});
