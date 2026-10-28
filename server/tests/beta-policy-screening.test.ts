// @vitest-environment node
import { describe, expect, it } from "vitest";
import { parseBetaPolicyScreeningPublication, screeningPublicationTransition } from "../utils/betaPolicyScreeningContract";
import { assertScreeningSceneSource } from "../utils/betaPolicyScreeningIngest";
import { managedJobTask, projectManagedJobEvidence } from "../utils/jobManagedEvaluation";
import { scientificBriefDigest } from "../utils/jobEvidenceContract";
import { crossRuntimeArtifactDigest, crossRuntimeDigest } from "../utils/crossRuntimeCanonical";
import { familyScreeningFixture, screeningFixture, screeningSha, sealScreening } from "./fixtures/beta-policy-screening";
import producerPublication from "./fixtures/pipeline-beta-policy-screening-publication.v1.json";
import producerFamilyStatus from "./fixtures/pipeline-family-prepared-status.v1.json";

describe("many-candidate diagnostic screening", () => {
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
  it.each(["valid", "catalog", "configuration", "candidate", "extra"])("honors an explicitly selected family policy identity (%s)", fault => {
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
    if (fault === "catalog") publication.catalog_digest = screeningSha("9");
    if (fault === "configuration") publication.candidates[0].configuration_digest = screeningSha("9");
    if (fault === "candidate") publication.candidates[0].candidate_id = "another-candidate";
    if (fault === "extra") publication.candidates.push(fixture.publication.candidates[1]);
    const scope = managedJobTask({ binding: { job_id: fixture.brief.requestId, brief_digest: scientificBriefDigest(fixture.brief) },
      record: fixture.job, brief: fixture.brief });
    const check = () => assertScreeningSceneSource(publication, intake, scope);
    if (fault === "valid") expect(check).not.toThrow();
    else expect(check).toThrow("screening_scene_source_mismatch");
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
