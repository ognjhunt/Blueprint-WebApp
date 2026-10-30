// @vitest-environment node
import { describe, expect, it } from "vitest";
import { noEstimateReason, parseBetaPolicyScreeningPublication, screeningPublicationTransition } from "../utils/betaPolicyScreeningContract";
import { assertScreeningSceneSource } from "../utils/betaPolicyScreeningIngest";
import { managedJobTask, projectManagedJobEvidence } from "../utils/jobManagedEvaluation";
import { scientificBriefDigest } from "../utils/jobEvidenceContract";
import { crossRuntimeArtifactDigest, crossRuntimeDigest } from "../utils/crossRuntimeCanonical";
import { allCandidateFamilyScreeningFixture, familyScreeningFixture, finishedScreening, screeningFixture, screeningSha, sealScreening,
  sealSelection, selectionFixture } from "./fixtures/beta-policy-screening";
import { parseBetaCandidateSelection, selectionMatchesPublication } from "../utils/betaCandidateSelection";
import producerSelection from "./fixtures/pipeline-website-candidate-selection.v1.json";
import producerPublication from "./fixtures/pipeline-beta-policy-screening-publication.v2.json";
import retainedProducerPublication from "./fixtures/pipeline-beta-policy-screening-publication.v1.json";
import producerFamilyStatus from "./fixtures/pipeline-family-prepared-status.v1.json";
import allCandidatePublication from "./fixtures/pipeline-beta-policy-screening-all-candidates.v2.json";

describe("automatic many-candidate job evaluation", () => {
  it("accepts a screening source emitted by the actual Python family handoff and canonical progression", () => {
    const { publication, brief, job } = screeningFixture();
    const source = producerFamilyStatus.source;
    const scope = { ...managedJobTask({ binding: { job_id: brief.requestId, brief_digest: scientificBriefDigest(brief) }, record: job, brief }),
      sourceWebsiteCaptureId: source.capture_id, sourceCaptureSessionId: null, taskContextDigest: source.task_context_digest,
      taskIds: [source.task_id], teamNamespace: producerFamilyStatus.request.owner.organization_id };
    const intake = { website_request_id: "req1", source_session_id: source.capture_id, state: "completed",
      request: producerFamilyStatus.request, request_digest: producerFamilyStatus.status.request_digest,
      receipt: producerFamilyStatus.receipt, pipeline_status: producerFamilyStatus.status };
    expect(() => assertScreeningSceneSource({ ...publication, site_id: producerFamilyStatus.site_id, source }, intake, scope)).not.toThrow();
  });
  it.each(["unchanged", "catalog", "configuration", "candidate", "extra"])("reuses a family compilation seed for an independently planned candidate set (%s)", change => {
    const fixture = familyScreeningFixture();
    const candidate = fixture.publication.candidates[0];
    const request = { ...fixture.intake.request, task: { ...fixture.intake.request.task,
      policy_selection: { candidate_id: candidate.candidate_id, catalog_digest: fixture.publication.catalog_digest,
        configuration_digest: candidate.configuration_digest } } };
    const requestDigest = crossRuntimeDigest(request);
    const receipt = { ...fixture.intake.receipt, request_digest: requestDigest };
    const status = { ...fixture.intake.pipeline_status, request_digest: requestDigest };
    const intake = { ...fixture.intake, request, request_digest: requestDigest,
      receipt: { ...receipt, receipt_digest: crossRuntimeArtifactDigest(receipt, "receipt_digest") },
      pipeline_status: { ...status, status_digest: crossRuntimeArtifactDigest(status, "status_digest") } };
    const publication = { ...fixture.publication, candidates: [structuredClone(candidate)] };
    if (change === "catalog") publication.catalog_digest = screeningSha("9");
    if (change === "configuration") publication.candidates[0].configuration_digest = screeningSha("9");
    if (change === "candidate") publication.candidates[0].candidate_id = "another-candidate";
    if (change === "extra") publication.candidates.push(fixture.publication.candidates[1]);
    const scope = managedJobTask({ binding: { job_id: fixture.brief.requestId, brief_digest: scientificBriefDigest(fixture.brief) },
      record: fixture.job, brief: fixture.brief });
    expect(() => assertScreeningSceneSource(publication, intake, scope)).not.toThrow();
  });
  it("accepts all 84 Python coordinator outcomes without changing their identities or reasons", () => {
    const parsed = parseBetaPolicyScreeningPublication(allCandidatePublication)!;
    expect(parsed).not.toBeNull();
    expect(parsed.candidates).toHaveLength(84);
    expect(parsed.candidates).toEqual(allCandidatePublication.candidates);
    const { publication, intake, brief, job } = allCandidateFamilyScreeningFixture();
    const scope = managedJobTask({ binding: { job_id: brief.requestId, brief_digest: scientificBriefDigest(brief) }, record: job, brief });
    expect(publication.catalog_digest).not.toBe(intake.request.task.policy_selection.catalog_digest);
    expect(() => assertScreeningSceneSource(publication, intake, scope)).not.toThrow();
  });

  it.each(["scene_intent_id", "scene_intent_digest", "capture_id", "task_id", "task_context_digest", "scene_revision_digest"] as const)(
    "rejects a changed %s for an 84-candidate family publication", field => {
      const { publication, intake, brief, job } = allCandidateFamilyScreeningFixture();
      publication.source[field] = field.endsWith("_digest") ? screeningSha("9") : "another-source";
      const scope = managedJobTask({ binding: { job_id: brief.requestId, brief_digest: scientificBriefDigest(brief) }, record: job, brief });
      expect(() => assertScreeningSceneSource(publication, intake, scope)).toThrow("screening_scene_source_mismatch");
    });

  it("keeps the original compilation seed bound to its immutable request", () => {
    const { publication, intake, brief, job } = allCandidateFamilyScreeningFixture();
    intake.request.task.policy_selection.candidate_id = "rewritten-seed";
    const scope = managedJobTask({ binding: { job_id: brief.requestId, brief_digest: scientificBriefDigest(brief) }, record: job, brief });
    expect(() => assertScreeningSceneSource(publication, intake, scope)).toThrow("screening_scene_source_mismatch");
  });
  it("accepts a source-bound CPU family preparation without claiming native application or policy execution", () => {
    const { publication, intake, brief, job } = familyScreeningFixture();
    const scope = managedJobTask({ binding: { job_id: brief.requestId, brief_digest: scientificBriefDigest(brief) }, record: job, brief });
    expect(() => assertScreeningSceneSource(publication, intake, scope)).not.toThrow();
    expect(intake.pipeline_status.result_reference.native_application_claimed).toBe(false);
    expect(intake.pipeline_status.result_reference.policy_episode_claimed).toBe(false);
  });

  it.each(["phase", "legacy_phase", "success", "native", "runtime", "catalog", "application", "episode", "qualification", "family", "source", "context", "revoke"])("refuses a re-sealed family preparation %s mismatch", fault => {
    const { publication, intake, brief, job } = familyScreeningFixture();
    const scope = managedJobTask({ binding: { job_id: brief.requestId, brief_digest: scientificBriefDigest(brief) }, record: job, brief });
    const reference = intake.pipeline_status.result_reference;
    if (fault === "phase") intake.pipeline_status.phase = "awaiting_execution";
    if (fault === "legacy_phase") intake.pipeline_status.phase = "scene_prepared";
    if (fault === "success") reference.task_success_contract_digest = screeningSha("5");
    if (fault === "native") reference.native_runtime_contract_digest = screeningSha("5");
    if (fault === "runtime") reference.task_family_runtime_selection = { ...reference.task_family_runtime_selection, runtime_id: "another-runtime" };
    if (fault === "catalog") reference.task_family_runtime_selection = { ...reference.task_family_runtime_selection, runtime_catalog_digest: screeningSha("5") };
    if (fault === "application") reference.native_application_claimed = true;
    if (fault === "episode") reference.policy_episode_claimed = true;
    if (fault === "qualification") reference.pre_policy_site_qualification_required = false;
    if (fault === "family") reference.task_family = "insertion";
    if (fault === "source") reference.digest = screeningSha("5");
    if (fault === "context") publication.source.task_context_digest = screeningSha("5");
    if (fault === "revoke") Object.assign(intake, { revocation_requested: true });
    intake.pipeline_status.status_digest = crossRuntimeArtifactDigest(intake.pipeline_status, "status_digest");
    expect(() => assertScreeningSceneSource(publication, intake, scope)).toThrow("screening_scene_source_mismatch");
  });

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
  it.each([["v2", producerPublication], ["retained v1", retainedProducerPublication]])(
    "verifies the real Python coordinator's fractional scores and exact decimal budget (%s)", (_version, fixture) => {
      const value = parseBetaPolicyScreeningPublication(fixture);
      expect(value).not.toBeNull();
      expect(value?.candidates[0].success_rate).toBe(2 / 3);
      expect(value?.budget.spent_upper_bound_usd).toBe("4.25");
    });
  it("accepts a retained v1 result republished as v2 at a new revision, never as a same-revision rewrite", () => {
    const previous = parseBetaPolicyScreeningPublication(retainedProducerPublication)!;
    const { schema_version: _v, purpose: _p, claim_ceiling: _c, recommendation_eligible: _r, publication_digest: _d, ...rest } = previous as any;
    const upgraded = { ...rest, schema_version: "beta_policy_screening_publication.v2", purpose: "job_evaluation", claim_ceiling: "simulation_estimate" };
    const sameRevision = parseBetaPolicyScreeningPublication(sealScreening(upgraded))!;
    expect(sameRevision).not.toBeNull();
    expect(() => screeningPublicationTransition(previous, sameRevision)).toThrow("screening_revision_conflict");
    const next = parseBetaPolicyScreeningPublication(sealScreening({ ...upgraded, revision: previous.revision + 1 }))!;
    expect(screeningPublicationTransition(previous, next)).toBe("updated");
  });
  it("accepts dozens of candidates with a sealed simulation-estimate contract", () => {
    const { publication } = screeningFixture();
    expect(parseBetaPolicyScreeningPublication(publication)?.candidates).toHaveLength(36);
    expect(parseBetaPolicyScreeningPublication({ ...publication, status: "completed" })).toBeNull();
    expect(parseBetaPolicyScreeningPublication(sealScreening({ ...publication, status: "running" }))).toBeNull();
    for (const change of [{ recommendation_eligible: false }, { claim_ceiling: "qualified" }, { claim_ceiling: "diagnostic_policy_execution" },
      { purpose: "screening" }, { endpoint: "https://private.invalid" }])
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

  it("sorts a run with no estimate by who can fix it", () => {
    const row = (status: string, blockers: string[]) => ({ status, blockers });
    expect(noEstimateReason([row("blocked", ["task_kind_not_supported_by_candidate"]),
      row("unavailable", ["candidate_disabled"]), row("blocked", ["commercial_use_not_admitted"])])).toBe("held");
    // Any candidate a fix or approval could still run keeps the job in progress.
    expect(noEstimateReason([row("blocked", ["task_kind_not_supported_by_candidate"]),
      row("deferred", ["site_screening_budget_insufficient"])])).toBe("budget");
    expect(noEstimateReason([row("blocked", ["task_kind_not_supported_by_candidate"]),
      row("blocked", ["runtime_candidate_binding_missing"])])).toBe("setup");
    expect(noEstimateReason([row("completed", []), row("blocked", ["task_kind_not_supported_by_candidate"])])).toBe("setup");
    expect(noEstimateReason([row("blocked", [])])).toBe("setup");
    // Measured out of reach, alone or beside capability gaps, is a plain "no match".
    expect(noEstimateReason([row("infeasible", ["candidate_infeasible_measured_geometry"]),
      row("blocked", ["task_kind_not_supported_by_candidate"])])).toBe("no_match");
    expect(noEstimateReason([row("unavailable", ["candidate_infeasible_measured_geometry"])])).toBe("no_match");
    expect(noEstimateReason([row("infeasible", ["candidate_infeasible_measured_geometry"]),
      row("deferred", ["site_screening_budget_insufficient"])])).toBe("budget");
    expect(noEstimateReason([row("infeasible", ["candidate_infeasible_measured_geometry"]),
      row("blocked", ["runtime_candidate_binding_missing"])])).toBe("setup");
  });

  it("shows held when no candidate Blueprint can run supports the job", () => {
    const { publication, brief, job } = screeningFixture();
    const binding = { job_id: brief.requestId, brief_digest: scientificBriefDigest(brief) };
    const scope = managedJobTask({ binding, record: job, brief });
    const held = sealScreening({ ...publication, revision: 2, status: "blocked", candidates: publication.candidates.map(row =>
      ({ ...row, status: "blocked", blockers: ["task_kind_not_supported_by_candidate"] })) });
    const run = { run_id: held.campaign_id, run_kind: "beta_policy_screening", state: "blocked", result_record_id: "result-one",
      job_evidence_binding: binding, job_task_context_digest: scope.taskContextDigest, job_source_fingerprint: scope.sourceFingerprint,
      configuration_digest: held.plan_digest, source_scene_intent_id: held.source.scene_intent_id,
      source_scene_revision_digest: held.source.scene_revision_digest, publication_digest: held.publication_digest, publication_revision: 2 };
    const projected = projectManagedJobEvidence(held.campaign_id, run, { record_id: "result-one", publication: held },
      brief.requestId, binding.brief_digest, scope.taskContextDigest, scope.sourceFingerprint)!;
    expect(projected.state).toBe("held");
    expect(projected.summary).toBe("Held: we can't simulate this kind of job yet. It counts as demand for what we build next.");
    expect(projected.nextAction).toMatch(/^Nothing is needed from the site/);
    expect(projected.resultDigest).toBe(held.publication_digest);
  });

  it("shows no estimate for a completed run whose candidates scored no episode", () => {
    const { publication, brief, job } = screeningFixture();
    const binding = { job_id: brief.requestId, brief_digest: scientificBriefDigest(brief) };
    const scope = managedJobTask({ binding, record: job, brief });
    const voided = sealScreening({ ...publication, revision: 2, status: "completed", candidates: publication.candidates.map((row, index) => index > 0
      ? { ...row, status: "blocked", blockers: ["beta_screening_site_budget_exhausted"] }
      : { ...row, status: "completed", episodes_scored: 0, episodes_succeeded: 0, episodes_failed: 0, episodes_void: 3, success_rate: null, session_result_digest: screeningSha("9") }) });
    const run = { run_id: voided.campaign_id, run_kind: "beta_policy_screening", state: "completed", result_record_id: "result-one",
      job_evidence_binding: binding, job_task_context_digest: scope.taskContextDigest, job_source_fingerprint: scope.sourceFingerprint,
      configuration_digest: voided.plan_digest, source_scene_intent_id: voided.source.scene_intent_id,
      source_scene_revision_digest: voided.source.scene_revision_digest, publication_digest: voided.publication_digest, publication_revision: 2 };
    const projected = projectManagedJobEvidence(voided.campaign_id, run, { record_id: "result-one", publication: voided },
      brief.requestId, binding.brief_digest, scope.taskContextDigest, scope.sourceFingerprint)!;
    // The other candidates hit the site budget, so this waits on the owner, not on the site.
    expect(projected.state).toBe("awaiting_spend_approval");
    expect(projected.summary).toMatch(/^Simulation evaluation in progress/);
    expect(projected.nextAction).toMatch(/^Owner approval needed/);
    expect(projected.limitations.join(" ")).not.toMatch(/estimate from 0 scored/);
    expect(projected.limitations.join(" ")).toMatch(/does not certify physical performance or safety/);
  });

  it("projects the run as the job's simulation estimate, and retains stale source as historical", () => {
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
    expect(project().limitations.join(" ")).toMatch(/does not certify physical performance or safety/);
    expect(project(crossRuntimeDigest("changed source")).current).toBe(false);
    const completed = sealScreening({ ...publication, revision: 2, status: "completed", candidates: publication.candidates.map((row, index) => index > 1
      ? { ...row, status: "blocked", blockers: ["beta_screening_site_budget_exhausted"] }
      : { ...row, status: "completed", episodes_scored: 3, episodes_succeeded: 2, episodes_failed: 1, success_rate: 2 / 3, session_result_digest: screeningSha("8") }) });
    const finished = projectManagedJobEvidence(completed.campaign_id, { ...run, state: "completed", publication_digest: completed.publication_digest,
      publication_revision: 2 }, { record_id: "result-one", publication: completed }, brief.requestId, binding.brief_digest,
      scope.taskContextDigest, scope.sourceFingerprint)!;
    // A finished run within the allowance is the job's result, visible and referenceable.
    expect(finished.resultDigest).toBe(completed.publication_digest);
    expect(finished.summary).toBe("Your job's simulation estimate: 2 of 36 candidates ran, with 6 episodes scored against the job's success criteria.");
    expect(finished.nextAction).toMatch(/recommend the next step/);
    expect(finished.limitations).toEqual([expect.stringMatching(/^A bounded simulation estimate from 6 scored episodes across 2 candidates, for this job's recorded task and simulated conditions only\.$/),
      "A simulation result is a bounded estimate. It does not certify physical performance or safety.",
      "34 candidates did not run; each row lists why."]);
  });
});

it("evaluates the named task of a job whose preparation grant was issued before the task was named", () => {
  const { brief, job } = screeningFixture(true);
  const binding = { job_id: brief.requestId, brief_digest: scientificBriefDigest(brief) };
  // The retained grant was bound to the placeholder brief's context when the video arrived.
  const placeholderEra = { ...job, website_scene_sponsorship: { ...job.website_scene_sponsorship,
    task_context_digest: `sha256:${"9".repeat(64)}`, authority_digest: `sha256:${"8".repeat(64)}` } };
  expect(() => managedJobTask({ binding, record: placeholderEra, brief, allowProposedScreening: true })).toThrow("job_scene_task_changed");
  const marked = { ...placeholderEra, website_scene_sponsorship_unnamed_task: placeholderEra.website_scene_sponsorship.authority_digest };
  expect(managedJobTask({ binding, record: marked, brief, allowProposedScreening: true }))
    .toEqual(managedJobTask({ binding, record: job, brief, allowProposedScreening: true }));
});

describe("measured infeasible candidates and the rule's choice", () => {
  const project = (publication: ReturnType<typeof finishedScreening>, candidateSelection?: unknown) => {
    const { brief, job } = screeningFixture();
    const binding = { job_id: brief.requestId, brief_digest: scientificBriefDigest(brief) };
    const scope = managedJobTask({ binding, record: job, brief });
    const run = { run_id: publication.campaign_id, run_kind: "beta_policy_screening", state: "completed", result_record_id: "result-one",
      job_evidence_binding: binding, job_task_context_digest: scope.taskContextDigest, job_source_fingerprint: scope.sourceFingerprint,
      configuration_digest: publication.plan_digest, source_scene_intent_id: publication.source.scene_intent_id,
      source_scene_revision_digest: publication.source.scene_revision_digest, publication_digest: publication.publication_digest,
      publication_revision: publication.revision, ...(candidateSelection ? { candidate_selection: candidateSelection } : {}) };
    return projectManagedJobEvidence(publication.campaign_id, run, { record_id: "result-one", publication },
      brief.requestId, binding.brief_digest, scope.taskContextDigest, scope.sourceFingerprint)!;
  };

  it("accepts infeasible as a terminal state and shows the Pipeline's current unavailable form as infeasible", () => {
    const finished = finishedScreening(screeningFixture().publication);
    const native = sealScreening({ ...finished, candidates: finished.candidates.map((row, index) => index === 2
      ? { ...row, status: "infeasible", blockers: ["team_embodiment_station_out_of_reach"] } : row) });
    expect(parseBetaPolicyScreeningPublication(native)?.candidates[2].status).toBe("infeasible");
    // A measured refusal is final: a later revision of a running campaign cannot reopen it.
    const running = sealScreening({ ...native, status: "running", candidates: native.candidates.map((row, index) => index === 1
      ? { ...row, status: "running", episodes_scored: 0, episodes_succeeded: 0, episodes_failed: 0, success_rate: null, session_result_digest: null } : row) });
    expect(parseBetaPolicyScreeningPublication(running)).not.toBeNull();
    expect(() => screeningPublicationTransition(running, sealScreening({ ...running, revision: 3, candidates: running.candidates.map((row, index) =>
      index === 2 ? { ...row, status: "unavailable" } : row) }))).toThrow("screening_terminal_candidate_conflict");
    for (const publication of [finished, native]) {
      const projected = project(publication);
      expect(projected.screening?.candidates[2].state).toBe("infeasible");
      expect(projected.screening?.candidates[3].state).toBe("blocked");
      expect(projected.limitations).toContain("34 candidates did not run; each row lists why.");
    }
  });

  it("verifies the Python rule's record against the Python publication it was chosen from", () => {
    const selection = parseBetaCandidateSelection(producerSelection)!;
    expect(selection).not.toBeNull();
    expect(selection.chosen?.partner_blockers).toEqual(["catalog_row_unavailable"]);
    expect(selectionMatchesPublication(selection, parseBetaPolicyScreeningPublication(producerPublication)!)).toBe(true);
    expect(parseBetaCandidateSelection({ ...producerSelection, selection_digest: screeningSha("0") })).toBeNull();
  });

  it("refuses a choice its rows or the accepted result do not support, and never a partner without a recorded company", () => {
    const finished = finishedScreening(screeningFixture().publication);
    const selection = selectionFixture(finished);
    expect(parseBetaCandidateSelection(selection)).not.toBeNull();
    expect(selectionMatchesPublication(selection, finished)).toBe(true);
    const { selection_digest: _digest, ...body } = selection;
    for (const forged of [
      { ...body, chosen: { ...body.chosen!, deployment_companies: [], partner_blockers: [] } },
      { ...body, chosen: { ...body.chosen!, candidate_id: "candidate-1", display_name: "Candidate 1" } },
      { ...body, chosen: { ...body.chosen!, success_rate: 1 } },
      { ...body, status: "no_successful_candidate", chosen: null },
      { ...body, tied_with: ["candidate-3"] },
      { ...body, candidates: body.candidates.map((row, index) => index === 3 ? { ...row, choice_blocker: null, result_rank: 3 } : row) },
    ]) expect(parseBetaCandidateSelection(sealSelection(forged))).toBeNull();
    const altered = sealSelection({ ...body, candidates: body.candidates.map((row, index) => index === 1 ? { ...row, episodes_succeeded: 2,
      episodes_failed: 1, success_rate: 2 / 3 } : row) });
    expect(parseBetaCandidateSelection(altered)).not.toBeNull();
    expect(selectionMatchesPublication(altered, finished)).toBe(false);
    expect(selectionMatchesPublication(selectionFixture(sealScreening({ ...finished, plan_digest: screeningSha("9") })), finished)).toBe(false);
  });

  it("projects the choice, its recorded companies and every candidate's outcome while it restates the result", () => {
    const finished = finishedScreening(screeningFixture().publication);
    const stored = { record: selectionFixture(finished), registry_teams: [{ id: "jacobi", name: "Jacobi Robotics" }] };
    const selection = project(finished, stored).screening?.selection;
    expect(selection).toMatchObject({ status: "chosen", tiedWith: [], chosen: { candidateId: "candidate-0", successRate: 2 / 3,
      deploymentCompanies: ["Jacobi Robotics", "Delta Technology"], partnerBlockers: [], registryTeams: [{ id: "jacobi", name: "Jacobi Robotics" }] } });
    expect(selection?.candidates.slice(0, 4)).toEqual([
      { candidateId: "candidate-0", resultRank: 1, choiceBlocker: null }, { candidateId: "candidate-1", resultRank: 2, choiceBlocker: null },
      { candidateId: "candidate-2", resultRank: null, choiceBlocker: "not_evaluated" }, { candidateId: "candidate-3", resultRank: null, choiceBlocker: "not_evaluated" }]);
    // A later budget-only revision keeps the choice; a changed result drops it.
    const budget = sealScreening({ ...finished, revision: 3, budget: { ...finished.budget, reserved_usd: "1", committed_upper_bound_usd: "1" } });
    expect(project(budget, stored).screening?.selection?.selectionDigest).toBe(stored.record.selection_digest);
    const rerun = sealScreening({ ...finished, revision: 3, candidates: finished.candidates.map((row, index) => index ? row
      : { ...row, episodes_succeeded: 3, episodes_failed: 0, success_rate: 1 }) });
    expect(project(rerun, stored).screening?.selection).toBeUndefined();
    expect(project(finished, { ...stored, record: { ...stored.record, selection_digest: screeningSha("0") } }).screening?.selection).toBeUndefined();
  });
});
