// @vitest-environment node
import { describe, expect, it } from "vitest";
import { parseBetaPolicyScreeningPublication, screeningPublicationTransition } from "../utils/betaPolicyScreeningContract";
import { assertScreeningSceneSource } from "../utils/betaPolicyScreeningIngest";
import { managedJobTask, projectManagedJobEvidence } from "../utils/jobManagedEvaluation";
import { scientificBriefDigest } from "../utils/jobEvidenceContract";
import { crossRuntimeDigest } from "../utils/crossRuntimeCanonical";
import { screeningFixture, screeningSha, sealScreening } from "./fixtures/beta-policy-screening";
import producerPublication from "./fixtures/pipeline-beta-policy-screening-publication.v1.json";

describe("many-candidate diagnostic screening", () => {
  it("screens the retained proposed preparation task without weakening agreed-task evaluation", () => {
    const { publication, intake, brief, job } = screeningFixture(true);
    const binding = { job_id: brief.requestId, brief_digest: scientificBriefDigest(brief) };
    expect(() => managedJobTask({ binding, record: job, brief })).toThrow("job_brief_not_agreed");
    const scope = managedJobTask({ binding, record: job, brief, allowProposedScreening: true });
    expect(() => assertScreeningSceneSource(publication, intake, scope)).not.toThrow();
    expect(() => managedJobTask({ binding, record: { ...job, website_scene_sponsorship: { ...job.website_scene_sponsorship, purpose: undefined } },
      brief, allowProposedScreening: true })).toThrow("job_brief_not_agreed");
    expect(() => managedJobTask({ binding, record: job, brief: { ...brief, confirmedAtIso: "2026-10-26T13:00:00Z" },
      allowProposedScreening: true })).toThrow("job_scene_task_changed");
  });
  it("verifies the real Python coordinator's fractional scores and exact decimal budget", () => {
    const value = parseBetaPolicyScreeningPublication(producerPublication);
    expect(value).not.toBeNull();
    expect(value?.candidates[0].success_rate).toBe(2 / 3);
    expect(value?.budget.spent_upper_bound_usd).toBe("4.25");
  });
  it("accepts dozens of candidates with a sealed, diagnostic-only contract", () => {
    const { publication } = screeningFixture();
    expect(parseBetaPolicyScreeningPublication(publication)?.candidates).toHaveLength(36);
    expect(parseBetaPolicyScreeningPublication({ ...publication, status: "completed" })).toBeNull();
    expect(parseBetaPolicyScreeningPublication(sealScreening({ ...publication, status: "running" }))).toBeNull();
    for (const change of [{ recommendation_eligible: true }, { claim_ceiling: "qualified" }, { endpoint: "https://private.invalid" }])
      expect(parseBetaPolicyScreeningPublication(sealScreening({ ...publication, ...change }))).toBeNull();
  });

  it("rejects overspend, missing reservations, altered counts, duplicate candidates and forged digests", () => {
    const { publication } = screeningFixture();
    for (const budget of [
      { ...publication.budget, committed_upper_bound_usd: "15.000001", reserved_usd: "15.000001" },
      { ...publication.budget, committed_upper_bound_usd: "2", spent_upper_bound_usd: "1", reserved_usd: "0" },
      { ...publication.budget, limit_usd: "20" }, { ...publication.budget, reserved_usd: "NaN" },
    ]) expect(parseBetaPolicyScreeningPublication(sealScreening({ ...publication, budget }))).toBeNull();
    expect(parseBetaPolicyScreeningPublication(sealScreening({ ...publication, candidates: [publication.candidates[0], publication.candidates[0]] }))).toBeNull();
    expect(parseBetaPolicyScreeningPublication(sealScreening({ ...publication, candidates: [{ ...publication.candidates[0], episodes_scored: 1 }] }))).toBeNull();
    expect(parseBetaPolicyScreeningPublication({ ...publication, publication_digest: screeningSha("0") })).toBeNull();
  });

  it("binds immutable intake receipts, capture and current job scope without trusting supplied job IDs", () => {
    const { publication, intake, brief, job } = screeningFixture();
    const scope = managedJobTask({ binding: { job_id: brief.requestId, brief_digest: scientificBriefDigest(brief) }, record: job, brief });
    expect(() => assertScreeningSceneSource(publication, intake, scope)).not.toThrow();
    for (const source of [{ ...publication.source, capture_id: publication.site_id },
      { ...publication.source, scene_intent_digest: screeningSha("1") }, { ...publication.source, task_context_digest: screeningSha("2") }])
      expect(() => assertScreeningSceneSource({ ...publication, source }, intake, scope)).toThrow("screening_scene_source_mismatch");
    expect(() => assertScreeningSceneSource({ ...publication, site_id: "site-other" }, intake, scope)).toThrow();
    expect(() => assertScreeningSceneSource(publication, { ...intake, revocation_requested: true }, scope)).toThrow();
    expect(() => assertScreeningSceneSource(publication, { ...intake, state: "accepted" }, scope)).toThrow();
    expect(() => assertScreeningSceneSource({ ...publication, source: { ...publication.source, scene_revision_digest: screeningSha("7") } }, intake, scope)).toThrow();
    expect(() => assertScreeningSceneSource(publication, intake, { ...scope, sourceCaptureSessionId: "new-capture", taskIds: [] })).toThrow();
    expect(() => assertScreeningSceneSource(publication, { ...intake, request: { ...intake.request, task: { task_id: "other" } } }, scope)).toThrow();
  });

  it("allows recovery and idempotent delivery, refuses revised terminal evidence and campaign identity", () => {
    const { publication } = screeningFixture();
    const running = sealScreening({ ...publication, status: "running", revision: 2,
      candidates: publication.candidates.map((row, index) => index ? row : { ...row, status: "running" }) });
    expect(screeningPublicationTransition(publication, running)).toBe("updated");
    expect(screeningPublicationTransition(running, running)).toBe("replayed");
    expect(screeningPublicationTransition(running, publication)).toBe("superseded");
    expect(() => screeningPublicationTransition(running, sealScreening({ ...publication, revision: 3 }))).toThrow("screening_progress_regression");
    const waiting = sealScreening({ ...running, revision: 3, candidates: running.candidates.map((row, index) => index ? row
      : { ...row, status: "preparing", blockers: ["beta_screening_waiting_for_capacity"] }) });
    expect(parseBetaPolicyScreeningPublication(waiting)).not.toBeNull();
    expect(screeningPublicationTransition(running, waiting)).toBe("updated");
    expect(() => screeningPublicationTransition(running, sealScreening({ ...waiting, candidates: waiting.candidates.map(row => ({ ...row, blockers: [] })) })))
      .toThrow("screening_progress_regression");
    expect(() => screeningPublicationTransition(running, sealScreening({ ...running, status: "reconciliation_required" }))).toThrow("screening_revision_conflict");
    expect(() => screeningPublicationTransition(running, sealScreening({ ...running, revision: 3, plan_digest: screeningSha("9") }))).toThrow("screening_campaign_identity_conflict");
    const completed = sealScreening({ ...running, revision: 3, status: "completed", candidates: running.candidates.map(row => ({ ...row,
      status: "completed", episodes_scored: 3, episodes_succeeded: 2, episodes_failed: 1, success_rate: 2 / 3, session_result_digest: screeningSha("8") })) });
    expect(parseBetaPolicyScreeningPublication(completed)).not.toBeNull();
    expect(screeningPublicationTransition(running, completed)).toBe("updated");
    expect(screeningPublicationTransition(completed, sealScreening({ ...completed, revision: 4,
      budget: { ...completed.budget, reserved_usd: "1", committed_upper_bound_usd: "1" } }))).toBe("updated");
    expect(() => screeningPublicationTransition(completed, sealScreening({ ...completed, revision: 4, status: "running" }))).toThrow("screening_revision_conflict");
  });

  it("projects diagnostic outcomes only, and retains stale source as historical", () => {
    const { publication, brief, job } = screeningFixture();
    const binding = { job_id: brief.requestId, brief_digest: scientificBriefDigest(brief) };
    const scope = managedJobTask({ binding, record: job, brief });
    const run = { run_id: publication.campaign_id, run_kind: "beta_policy_screening", state: "queued", result_record_id: "result-one",
      job_evidence_binding: binding, job_task_context_digest: scope.taskContextDigest, job_source_fingerprint: scope.sourceFingerprint,
      configuration_digest: publication.plan_digest, source_scene_intent_id: publication.source.scene_intent_id,
      source_scene_revision_digest: publication.source.scene_revision_digest, publication_digest: publication.publication_digest, publication_revision: 1 };
    const result = { record_id: "result-one", publication };
    const project = (fingerprint = scope.sourceFingerprint) => projectManagedJobEvidence(publication.campaign_id, run, result,
      brief.requestId, binding.brief_digest, scope.taskContextDigest, fingerprint)!;
    expect(project().screening?.candidates).toHaveLength(36);
    expect(project().resultDigest).toBeNull();
    expect(project().limitations.join(" ")).toMatch(/does not declare a winner/);
    expect(project(crossRuntimeDigest("changed source")).current).toBe(false);
  });
});
