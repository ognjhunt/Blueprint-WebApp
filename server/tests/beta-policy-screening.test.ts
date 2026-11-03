// @vitest-environment node
import { describe, expect, it } from "vitest";
import { noEstimateReason as screeningNoEstimateReason, parseBetaPolicyScreeningPublication, screeningOutcome, screeningOutcomeSentence,
  screeningPublicationTransition, SCREENING_OUTCOMES } from "../utils/betaPolicyScreeningContract";
import { assertScreeningSceneSource } from "../utils/betaPolicyScreeningIngest";
import { managedJobTask, preparedSceneRevisionDigest, projectManagedJobEvidence } from "../utils/jobManagedEvaluation";
import { configuredSceneOfferingSchema } from "../utils/configuredSceneOfferingContract";
import { scientificBriefDigest } from "../utils/jobEvidenceContract";
import { crossRuntimeArtifactDigest, crossRuntimeDigest } from "../utils/crossRuntimeCanonical";
import { allCandidateFamilyScreeningFixture, familyScreeningFixture, finishedScreening, outcomePublication, PUBLISHED_SCREENING_OUTCOMES, screeningFixture,
  screeningRevisionLaunch, screeningSha, scriptedBaselineRow, sealScreening, sealSelection, selectionFixture } from "./fixtures/beta-policy-screening";
import { parseBetaCandidateSelection, selectionMatchesPublication } from "../utils/betaCandidateSelection";
import producerSelection from "./fixtures/pipeline-website-candidate-selection.v1.json";
import producerPublication from "./fixtures/pipeline-beta-policy-screening-publication.v2.json";
import retainedProducerPublication from "./fixtures/pipeline-beta-policy-screening-publication.v1.json";
import producerFamilyStatus from "./fixtures/pipeline-family-prepared-status.v1.json";
import allCandidatePublication from "./fixtures/pipeline-beta-policy-screening-all-candidates.v2.json";
import jobCeilingPublication from "./fixtures/pipeline-beta-policy-screening-job-ceiling.v2.json";

/** The stored offering that binds the fixture intake's revision file to its self-digest. */
const revisionOfferings = [screeningFixture().launch.record.configured_scene_offering];
describe("a configured scene's revision: the file the status names and the self-digest the source names", () => {
  it("binds the source's revision digest through the stored offering, never to the revision file's digest", () => {
    const { publication, intake, brief, job, launch } = screeningFixture();
    const reference = intake.pipeline_status.result_reference;
    const offering = launch.record.configured_scene_offering;
    // The Pipeline's two kinds of digest (capture-447: bc92b811... and ae2703d0...) are never equal.
    expect(reference.digest).not.toBe(publication.source.scene_revision_digest);
    expect(configuredSceneOfferingSchema.safeParse(offering).success).toBe(true);
    expect(offering.evaluation_preparation_binding).toMatchObject({ configured_scene_revision: reference,
      configured_scene_revision_digest: publication.source.scene_revision_digest });
    const scope = managedJobTask({ binding: { job_id: brief.requestId, brief_digest: scientificBriefDigest(brief) }, record: job, brief });
    expect(preparedSceneRevisionDigest(intake.pipeline_status, [offering])).toBe(publication.source.scene_revision_digest);
    expect(() => assertScreeningSceneSource(publication, intake, scope, [offering])).not.toThrow();
    // No stored offering for this file: the publication sync has not reached the website.
    expect(() => assertScreeningSceneSource(publication, intake, scope, [])).toThrow("screening_scene_revision_unbound");
    // An offering for another file (uri, bytes or size) says nothing about this one.
    for (const change of [{ uri: "gs://fixture/revision/other.json" }, { digest: screeningSha("9") }, { size_bytes: 301 }]) {
      const other = screeningRevisionLaunch({ ...reference, ...change }).record.configured_scene_offering;
      expect(() => assertScreeningSceneSource(publication, intake, scope, [other])).toThrow("screening_scene_revision_unbound");
    }
    // This file bound to another revision is a different scene; disagreeing offerings bind nothing.
    const rebound = screeningRevisionLaunch(reference, screeningSha("8")).record.configured_scene_offering;
    expect(() => assertScreeningSceneSource(publication, intake, scope, [rebound])).toThrow("screening_scene_source_mismatch");
    expect(() => assertScreeningSceneSource(publication, intake, scope, [offering, rebound])).toThrow("screening_scene_revision_unbound");
    expect(() => assertScreeningSceneSource(publication, intake, scope, [offering, offering])).not.toThrow();
    expect(() => assertScreeningSceneSource(publication, intake, scope, [{ ...offering, evaluation_preparation_binding: {
      ...offering.evaluation_preparation_binding, configured_scene_revision: { ...reference, extra: true } } }]))
      .toThrow("screening_scene_revision_unbound");
  });
  it("reads a family preparation's own revision digest without any offering", () => {
    const { publication, intake } = familyScreeningFixture();
    expect(intake.pipeline_status.result_reference.digest).toBe(publication.source.scene_revision_digest);
    expect(preparedSceneRevisionDigest(intake.pipeline_status, [])).toBe(publication.source.scene_revision_digest);
  });
});

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
    expect(() => assertScreeningSceneSource({ ...publication, site_id: producerFamilyStatus.site_id, source }, intake, scope, revisionOfferings)).not.toThrow();
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
    expect(() => assertScreeningSceneSource(publication, intake, scope, revisionOfferings)).not.toThrow();
  });
  it("accepts all 84 Python coordinator outcomes without changing their identities or reasons", () => {
    const parsed = parseBetaPolicyScreeningPublication(allCandidatePublication)!;
    expect(parsed).not.toBeNull();
    expect(parsed.candidates).toHaveLength(84);
    expect(parsed.candidates).toEqual(allCandidatePublication.candidates);
    const { publication, intake, brief, job } = allCandidateFamilyScreeningFixture();
    const scope = managedJobTask({ binding: { job_id: brief.requestId, brief_digest: scientificBriefDigest(brief) }, record: job, brief });
    expect(publication.catalog_digest).not.toBe(intake.request.task.policy_selection.catalog_digest);
    expect(() => assertScreeningSceneSource(publication, intake, scope, revisionOfferings)).not.toThrow();
  });

  it.each(["scene_intent_id", "scene_intent_digest", "capture_id", "task_id", "task_context_digest", "scene_revision_digest"] as const)(
    "rejects a changed %s for an 84-candidate family publication", field => {
      const { publication, intake, brief, job } = allCandidateFamilyScreeningFixture();
      publication.source[field] = field.endsWith("_digest") ? screeningSha("9") : "another-source";
      const scope = managedJobTask({ binding: { job_id: brief.requestId, brief_digest: scientificBriefDigest(brief) }, record: job, brief });
      expect(() => assertScreeningSceneSource(publication, intake, scope, revisionOfferings)).toThrow("screening_scene_source_mismatch");
    });

  it("keeps the original compilation seed bound to its immutable request", () => {
    const { publication, intake, brief, job } = allCandidateFamilyScreeningFixture();
    intake.request.task.policy_selection.candidate_id = "rewritten-seed";
    const scope = managedJobTask({ binding: { job_id: brief.requestId, brief_digest: scientificBriefDigest(brief) }, record: job, brief });
    expect(() => assertScreeningSceneSource(publication, intake, scope, revisionOfferings)).toThrow("screening_scene_source_mismatch");
  });
  it("accepts a source-bound CPU family preparation without claiming native application or policy execution", () => {
    const { publication, intake, brief, job } = familyScreeningFixture();
    const scope = managedJobTask({ binding: { job_id: brief.requestId, brief_digest: scientificBriefDigest(brief) }, record: job, brief });
    expect(() => assertScreeningSceneSource(publication, intake, scope, revisionOfferings)).not.toThrow();
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
    expect(() => assertScreeningSceneSource(publication, intake, scope, revisionOfferings)).toThrow("screening_scene_source_mismatch");
  });

  it("screens the retained proposed preparation task without weakening agreed-task evaluation", () => {
    const { publication, intake, brief, job } = screeningFixture(true);
    const binding = { job_id: brief.requestId, brief_digest: scientificBriefDigest(brief) };
    expect(() => managedJobTask({ binding, record: job, brief })).toThrow("job_brief_not_agreed");
    const scope = managedJobTask({ binding, record: job, brief, allowProposedScreening: true });
    expect(() => assertScreeningSceneSource(publication, intake, scope, revisionOfferings)).not.toThrow();
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
    expect(() => assertScreeningSceneSource(publication, intake, scope, revisionOfferings)).not.toThrow();
    for (const source of [{ ...publication.source, capture_id: publication.site_id },
      { ...publication.source, scene_intent_digest: screeningSha("1") }, { ...publication.source, task_context_digest: screeningSha("2") }])
      expect(() => assertScreeningSceneSource({ ...publication, source }, intake, scope, revisionOfferings)).toThrow("screening_scene_source_mismatch");
    expect(() => assertScreeningSceneSource({ ...publication, site_id: "site-other" }, intake, scope, revisionOfferings)).toThrow();
    expect(() => assertScreeningSceneSource(publication, { ...intake, revocation_requested: true }, scope, revisionOfferings)).toThrow();
    expect(() => assertScreeningSceneSource(publication, { ...intake, state: "accepted" }, scope, revisionOfferings)).toThrow();
    expect(() => assertScreeningSceneSource({ ...publication, source: { ...publication.source, scene_revision_digest: screeningSha("7") } }, intake, scope, revisionOfferings)).toThrow();
    expect(() => assertScreeningSceneSource(publication, intake, { ...scope, sourceCaptureSessionId: "new-capture", taskIds: [] }, revisionOfferings)).toThrow();
    expect(() => assertScreeningSceneSource(publication, { ...intake, request: { ...intake.request, task: { task_id: "other" } } }, scope, revisionOfferings)).toThrow();
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

  it("funds a waitlisted candidate from released money without reopening a closed one", () => {
    const { publication } = screeningFixture();
    const at = (base: typeof publication, revision: number, statuses: Record<number, [string, string[]]>) => sealScreening({
      ...base, revision, generated_at: new Date(Date.parse(base.generated_at) + revision * 1000).toISOString(),
      candidates: base.candidates.map((row, index) => statuses[index] ? { ...row, status: statuses[index][0], blockers: statuses[index][1] } : row) });
    const waiting = at(publication, 2, { 0: ["blocked", ["beta_screening_static_preflight_blocked"]], 1: ["waitlisted", ["site_screening_budget_insufficient"]] });
    expect(parseBetaPolicyScreeningPublication(waiting)?.status).toBe("queued");
    // Only waitlisted rows left still read as queued, not as a finished run.
    const onlyWaiting = sealScreening({ ...waiting, candidates: waiting.candidates.map((row, index) => index > 1
      ? { ...row, status: "blocked", blockers: ["beta_screening_static_preflight_blocked"] } : row) });
    expect(parseBetaPolicyScreeningPublication(onlyWaiting)?.status).toBe("queued");
    expect(parseBetaPolicyScreeningPublication(sealScreening({ ...onlyWaiting, status: "blocked" }))).toBeNull();
    const funded = at(waiting, 3, { 1: ["pending", []] });
    expect(screeningPublicationTransition(waiting, funded)).toBe("updated");
    expect(screeningPublicationTransition(funded, at(funded, 4, { 1: ["waitlisted", ["site_screening_budget_insufficient"]] }))).toBe("updated");
    expect(screeningPublicationTransition(waiting, at(waiting, 3, { 1: ["deferred", ["beta_screening_site_budget_exhausted"]] }))).toBe("updated");
    const preparing = at(funded, 4, { 1: ["preparing", []] });
    expect(() => screeningPublicationTransition(preparing, at(preparing, 5, { 1: ["waitlisted", ["site_screening_budget_insufficient"]] })))
      .toThrow("screening_progress_regression");
    const closed = at(waiting, 3, { 1: ["deferred", ["beta_screening_site_budget_exhausted"]] });
    expect(() => screeningPublicationTransition(closed, at(closed, 4, { 1: ["pending", []] }))).toThrow("screening_terminal_candidate_conflict");
  });

  it("sorts a run with no estimate by who can fix it", () => {
    const row = (status: string, blockers: string[]) => ({ status, blockers });
    const spent = { spent_upper_bound_usd: "4" };
    const noEstimateReason = (rows: Array<{ status: string; blockers: string[] }>, budget = spent) => screeningNoEstimateReason(rows, budget);
    expect(noEstimateReason([row("blocked", ["task_kind_not_supported_by_candidate"]),
      row("unavailable", ["candidate_disabled"]), row("blocked", ["commercial_use_not_admitted"])])).toBe("held");
    // Any candidate a fix or approval could still run keeps the job in progress.
    expect(noEstimateReason([row("blocked", ["task_kind_not_supported_by_candidate"]),
      row("deferred", ["site_screening_budget_insufficient"])])).toBe("budget");
    expect(noEstimateReason([row("blocked", ["task_kind_not_supported_by_candidate"]),
      row("blocked", ["runtime_candidate_binding_missing"])])).toBe("setup");
    expect(noEstimateReason([row("completed", []), row("blocked", ["task_kind_not_supported_by_candidate"])])).toBe("setup");
    expect(noEstimateReason([row("blocked", [])])).toBe("setup");
    // Measured out of reach beside capability gaps is a plain "no match".
    expect(noEstimateReason([row("infeasible", ["candidate_infeasible_measured_geometry"]),
      row("blocked", ["task_kind_not_supported_by_candidate"])])).toBe("no_match");
    // Every candidate measured out of reach, in either published form, is held with that reason.
    expect(noEstimateReason([row("unavailable", ["candidate_infeasible_measured_geometry"])])).toBe("infeasible");
    expect(noEstimateReason([row("infeasible", ["team_embodiment_station_out_of_reach"]),
      row("unavailable", ["candidate_infeasible_measured_geometry", "team_embodiment_station_out_of_reach"])])).toBe("infeasible");
    expect(noEstimateReason([row("infeasible", ["candidate_infeasible_measured_geometry"]),
      row("deferred", ["site_screening_budget_insufficient"])])).toBe("budget");
    expect(noEstimateReason([row("infeasible", ["candidate_infeasible_measured_geometry"]),
      row("blocked", ["runtime_candidate_binding_missing"])])).toBe("setup");
    // Catalog rows never selected because nothing is prepared for them yet wait on what we build.
    const unprepared = row("unavailable", ["prepared_robot_policy_registration_missing", "runtime_candidate_binding_missing"]);
    expect(noEstimateReason([unprepared, row("unavailable", ["candidate_disabled", "runtime_candidate_binding_missing"])])).toBe("held");
    expect(noEstimateReason([unprepared, row("infeasible", ["candidate_infeasible_measured_geometry"])])).toBe("no_match");
    // Budget-deferred rows with nothing spent were left unfunded because the funded
    // candidates failed before spend: ours to fix, never an owner approval.
    const unspent = { spent_upper_bound_usd: "0" };
    expect(noEstimateReason([unprepared, row("blocked", ["beta_screening_static_preflight_blocked:no_offer"]),
      row("deferred", ["site_screening_budget_insufficient"])], unspent)).toBe("setup");
    expect(noEstimateReason([unprepared, row("infeasible", ["candidate_infeasible_measured_geometry"]),
      row("deferred", ["site_screening_budget_insufficient"])], unspent)).toBe("setup");
    expect(noEstimateReason([unprepared, row("deferred", ["beta_screening_site_budget_exhausted"])])).toBe("budget");
    // The job's one dollar ceiling (all of its spending) left too little for any quote: the
    // Pipeline defers every runnable candidate before any screening spend. Only the owner can
    // raise it, so it waits on the owner's money decision, never on a setup repair.
    const ceiling = row("deferred", ["website_job_ceiling_insufficient"]);
    expect(noEstimateReason([ceiling, ceiling], unspent)).toBe("budget");
    expect(noEstimateReason([ceiling, unprepared, row("infeasible", ["candidate_infeasible_measured_geometry"])], unspent)).toBe("budget");
    expect(noEstimateReason([row("blocked", ["beta_screening_static_preflight_blocked"]), ceiling])).toBe("budget");
    // A candidate that failed for a reason that is ours to fix, with nothing spent, stays ours.
    expect(noEstimateReason([row("blocked", ["beta_screening_static_preflight_blocked"]), ceiling], unspent)).toBe("setup");
    expect(noEstimateReason([row("completed", []), ceiling], unspent)).toBe("setup");
  });

  it("reads the Pipeline's real job-ceiling deferral as awaiting the owner's spend approval, never a repair", () => {
    const parsed = parseBetaPolicyScreeningPublication(jobCeilingPublication)!;
    expect(parsed).not.toBeNull();
    expect(parsed.budget.spent_upper_bound_usd).toBe("0");
    expect(parsed.candidates.every(row => row.status === "deferred" && row.blockers.join() === "website_job_ceiling_insufficient")).toBe(true);
    expect(screeningOutcome(parsed)).toBe("awaiting_spend_approval");
    const { publication, brief, job } = screeningFixture();
    const binding = { job_id: brief.requestId, brief_digest: scientificBriefDigest(brief) };
    const scope = managedJobTask({ binding, record: job, brief });
    const value = sealScreening({ ...publication, revision: 2, status: parsed.status, budget: parsed.budget,
      candidates: publication.candidates.map(row => ({ ...row, ...parsed.candidates[0], candidate_id: row.candidate_id })) });
    const run = { run_id: value.campaign_id, run_kind: "beta_policy_screening", state: "blocked", result_record_id: "result-one",
      job_evidence_binding: binding, job_task_context_digest: scope.taskContextDigest, job_source_fingerprint: scope.sourceFingerprint,
      configuration_digest: value.plan_digest, source_scene_intent_id: value.source.scene_intent_id,
      source_scene_revision_digest: value.source.scene_revision_digest, publication_digest: value.publication_digest, publication_revision: 2 };
    const projected = projectManagedJobEvidence(value.campaign_id, run, { record_id: "result-one", publication: value },
      brief.requestId, binding.brief_digest, scope.taskContextDigest, scope.sourceFingerprint)!;
    expect(projected).toMatchObject({ state: "awaiting_spend_approval", outcome: "awaiting_spend_approval",
      summary: "Your job's simulation is waiting on an approval inside Blueprint before it can continue.",
      nextAction: "Nothing is needed from you." });
    expect(projected.opsNextAction).toBe("Owner approval needed: this job's dollar ceiling, shared by all of its spending, has too little left "
      + "to run its candidates. Raising it is the owner's money decision. Nothing is needed from the site.");
    expect(projected.opsNextAction).not.toMatch(/setup blockers|rerun/);
  });

  it("shows each scored candidate's success estimate with its Wilson range", () => {
    const { publication, brief, job } = screeningFixture();
    const binding = { job_id: brief.requestId, brief_digest: scientificBriefDigest(brief) };
    const scope = managedJobTask({ binding, record: job, brief });
    const scored = (row: any, succeeded: number, scoredCount: number, voided = 0) => ({ ...row, status: "completed", episodes_planned: scoredCount + voided,
      episodes_scored: scoredCount, episodes_succeeded: succeeded, episodes_failed: scoredCount - succeeded, episodes_void: voided,
      success_rate: succeeded / scoredCount, session_result_digest: screeningSha("6") });
    const value = sealScreening({ ...publication, revision: 2, status: "completed", candidates: publication.candidates.map((row, index) =>
      index === 0 ? scored(row, 7, 10) : index === 1 ? scored(row, 0, 10, 2) : index === 2 ? scored(row, 10, 10)
        : index === 3 ? { ...row, status: "completed", episodes_planned: 3, episodes_void: 3, session_result_digest: screeningSha("7") }
          : { ...row, status: "deferred", blockers: ["site_screening_budget_insufficient"] }) });
    const run = { run_id: value.campaign_id, run_kind: "beta_policy_screening", state: "completed", result_record_id: "result-one",
      job_evidence_binding: binding, job_task_context_digest: scope.taskContextDigest, job_source_fingerprint: scope.sourceFingerprint,
      configuration_digest: value.plan_digest, source_scene_intent_id: value.source.scene_intent_id,
      source_scene_revision_digest: value.source.scene_revision_digest, publication_digest: value.publication_digest, publication_revision: 2 };
    const projected = projectManagedJobEvidence(value.campaign_id, run, { record_id: "result-one", publication: value },
      brief.requestId, binding.brief_digest, scope.taskContextDigest, scope.sourceFingerprint)!;
    expect(projected.outcome).toBe("estimate");
    const rows = projected.screening!.candidates;
    // 7 of 10: "likely between 40% and 89%" (95% Wilson, successRateConfidence).
    expect(rows[0].successRange).toEqual({ lowerPercent: 40, upperPercent: 89, confidencePercent: 95 });
    expect(rows[1].successRange).toEqual({ lowerPercent: 0, upperPercent: 28, confidencePercent: 95 });
    expect(rows[2].successRange).toEqual({ lowerPercent: 72, upperPercent: 100, confidencePercent: 95 });
    // Nothing scored, nothing to bound.
    expect(rows[3]).not.toHaveProperty("successRange");
    expect(rows[4]).not.toHaveProperty("successRange");
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
    expect(projected.outcome).toBe("held_capability");
    expect(projected.summary).toBe("Held: we can't simulate this kind of job yet. It counts as demand for what we build next.");
    expect(projected.nextAction).toMatch(/^Nothing is needed from you/);
    expect(projected.resultDigest).toBe(held.publication_digest);
  });

  it("shows held with the measured reason when every candidate is out of reach, never a setup fix", () => {
    const { publication, brief, job } = screeningFixture();
    const binding = { job_id: brief.requestId, brief_digest: scientificBriefDigest(brief) };
    const scope = managedJobTask({ binding, record: job, brief });
    const project = (blockers: (index: number) => { status: "unavailable" | "infeasible" | "blocked"; blockers: string[] }) => {
      const value = sealScreening({ ...publication, revision: 2, status: "blocked",
        candidates: publication.candidates.map((row, index) => ({ ...row, ...blockers(index) })) });
      const run = { run_id: value.campaign_id, run_kind: "beta_policy_screening", state: "blocked", result_record_id: "result-one",
        job_evidence_binding: binding, job_task_context_digest: scope.taskContextDigest, job_source_fingerprint: scope.sourceFingerprint,
        configuration_digest: value.plan_digest, source_scene_intent_id: value.source.scene_intent_id,
        source_scene_revision_digest: value.source.scene_revision_digest, publication_digest: value.publication_digest, publication_revision: 2 };
      return projectManagedJobEvidence(value.campaign_id, run, { record_id: "result-one", publication: value },
        brief.requestId, binding.brief_digest, scope.taskContextDigest, scope.sourceFingerprint)!;
    };
    // The Pipeline's current form (unavailable plus the measured blocker) and the native status read the same.
    const outOfReach = project(index => index === 0
      ? { status: "unavailable", blockers: ["candidate_infeasible_measured_geometry", "team_embodiment_station_out_of_reach"] }
      : { status: "infeasible", blockers: ["team_embodiment_station_out_of_reach"] });
    expect(outOfReach.state).toBe("held");
    expect(outOfReach.summary).toBe("Held: from the robot position planned in the scene built from your video, none of the robots we can simulate could reach this task.");
    expect(outOfReach.outcome).toBe("infeasible");
    expect(outOfReach.nextAction).toBe("Nothing is needed from you. Each row lists the measured reason or why it could not run.");
    expect(`${outOfReach.summary} ${outOfReach.nextAction}`).not.toMatch(/setup blockers|rerun/);
    // Measured from the scene's planned robot position only: no task-level or site-wide verdict.
    expect(outOfReach.summary).toMatch(/^Held: from the robot position planned in the scene/);
    expect(outOfReach.summary).not.toMatch(/can't do|cannot do|anywhere/);
    expect(outOfReach.screening!.candidates.every(row => row.state === "infeasible")).toBe(true);
    // Measured out of reach beside a capability gap: the site is told plainly there is no match
    // (owner decision 2026-10-30), never the generic "can't simulate" hold.
    const mixed = project(index => index === 0 ? { status: "infeasible", blockers: ["team_embodiment_station_out_of_reach"] }
      : { status: "blocked", blockers: ["task_kind_not_supported_by_candidate"] });
    expect(mixed.state).toBe("held");
    expect(mixed.outcome).toBe("no_match");
    expect(mixed.summary).toBe("No match: none of the robots we can simulate matched this job. At least one was measured out of reach from the robot position planned in the scene built from your video.");
    expect(mixed.summary).not.toMatch(/can't simulate|can't do|cannot do|anywhere/);
  });

  it("shows no estimate for a completed run whose candidates scored no episode", () => {
    const { publication, brief, job } = screeningFixture();
    const binding = { job_id: brief.requestId, brief_digest: scientificBriefDigest(brief) };
    const scope = managedJobTask({ binding, record: job, brief });
    const voided = sealScreening({ ...publication, revision: 2, status: "completed",
      budget: { ...publication.budget, committed_upper_bound_usd: "4", spent_upper_bound_usd: "4" }, candidates: publication.candidates.map((row, index) => index > 0
      ? { ...row, status: "blocked", blockers: ["beta_screening_site_budget_exhausted"] }
      : { ...row, status: "completed", episodes_scored: 0, episodes_succeeded: 0, episodes_failed: 0, episodes_void: 3, success_rate: null, session_result_digest: screeningSha("9") }) });
    const run = { run_id: voided.campaign_id, run_kind: "beta_policy_screening", state: "completed", result_record_id: "result-one",
      job_evidence_binding: binding, job_task_context_digest: scope.taskContextDigest, job_source_fingerprint: scope.sourceFingerprint,
      configuration_digest: voided.plan_digest, source_scene_intent_id: voided.source.scene_intent_id,
      source_scene_revision_digest: voided.source.scene_revision_digest, publication_digest: voided.publication_digest, publication_revision: 2 };
    const projected = projectManagedJobEvidence(voided.campaign_id, run, { record_id: "result-one", publication: voided },
      brief.requestId, binding.brief_digest, scope.taskContextDigest, scope.sourceFingerprint)!;
    // The other candidates hit the site's allowance after money was spent, and nothing reserves more:
    // held by name, never "in progress" with no rerun coming.
    expect([projected.state, projected.outcome]).toEqual(["held", "held_budget"]);
    expect(projected.summary).toMatch(/^Held: your job reached the most the free beta can simulate for one job/);
    expect(projected.summary).toMatch(/won't restart by itself\. Our team has been told/);
    // Spending past it is the owner's to decide: the site reads no instruction and no budget.
    expect(projected.nextAction).toBe("Nothing is needed from you. Each row lists why it stopped.");
    expect(`${projected.summary} ${projected.nextAction}`).not.toMatch(/budget|owner approval|\$/i);
    expect(projected.opsNextAction).toMatch(/^Held: the site's simulation allowance is spent/);
    expect(projected.limitations.join(" ")).not.toMatch(/estimate from 0 scored/);
    expect(projected.limitations.join(" ")).toMatch(/does not certify physical performance or safety/);
  });

  it("never asks for owner approval when budget-deferred candidates are unfunded and nothing was spent", () => {
    const { publication, brief, job } = screeningFixture();
    const binding = { job_id: brief.requestId, brief_digest: scientificBriefDigest(brief) };
    const scope = managedJobTask({ binding, record: job, brief });
    const unspent = sealScreening({ ...publication, revision: 2, status: "blocked", candidates: publication.candidates.map((row, index) => ({
      ...row, ...(index === 0 ? { status: "blocked", blockers: ["beta_screening_static_preflight_blocked"] }
        : index === 1 ? { status: "deferred", blockers: ["site_screening_budget_insufficient"] }
          : { status: "unavailable", blockers: ["prepared_robot_policy_registration_missing", "runtime_candidate_binding_missing"] }) })) });
    const run = { run_id: unspent.campaign_id, run_kind: "beta_policy_screening", state: "blocked", result_record_id: "result-one",
      job_evidence_binding: binding, job_task_context_digest: scope.taskContextDigest, job_source_fingerprint: scope.sourceFingerprint,
      configuration_digest: unspent.plan_digest, source_scene_intent_id: unspent.source.scene_intent_id,
      source_scene_revision_digest: unspent.source.scene_revision_digest, publication_digest: unspent.publication_digest, publication_revision: 2 };
    const projected = projectManagedJobEvidence(unspent.campaign_id, run, { record_id: "result-one", publication: unspent },
      brief.requestId, binding.brief_digest, scope.taskContextDigest, scope.sourceFingerprint)!;
    // Nothing reruns a blocked campaign by itself: held on our side, by name.
    expect([projected.state, projected.outcome]).toEqual(["held", "held_setup"]);
    expect(projected.nextAction).not.toMatch(/Owner approval|setup blockers|rerun/);
    expect(projected.opsNextAction).toMatch(/^Held on our side: fix the cause in each candidate's blockers, then rerun/);
    // Only rows refused for code a deploy changed are planned again by the Pipeline: still in progress.
    const commitChanged = sealScreening({ ...unspent, revision: 3, candidates: unspent.candidates.map((row, index) => index === 0
      ? { ...row, blockers: ["beta_screening_implementation_commit_changed"] } : row) });
    expect(screeningOutcome(commitChanged)).toBe("setup_repair");
    // With nothing funded at all, every row waits on what we build: held.
    const held = sealScreening({ ...unspent, revision: 3, candidates: unspent.candidates.map(row => ({ ...row, status: "unavailable",
      blockers: ["prepared_robot_policy_registration_missing", "runtime_candidate_binding_missing"] })) });
    const heldProjection = projectManagedJobEvidence(held.campaign_id, { ...run, publication_digest: held.publication_digest, publication_revision: 3 },
      { record_id: "result-one", publication: held }, brief.requestId, binding.brief_digest, scope.taskContextDigest, scope.sourceFingerprint)!;
    expect(heldProjection.state).toBe("held");
    expect(heldProjection.outcome).toBe("held_unprepared");
    expect(heldProjection.summary).toBe("Held: the robots that could do this job aren't set up in our simulator yet. It counts as demand for what we build next.");
    // A run whose rows were planned again in a newer run points there and cannot be cited.
    const replanned = sealScreening({ ...unspent, revision: 4, candidates: unspent.candidates.map((row, index) => index === 1
      ? { ...row, status: "blocked", blockers: ["beta_screening_replanned_for_new_implementation"] } : row) });
    const replannedProjection = projectManagedJobEvidence(replanned.campaign_id, { ...run, publication_digest: replanned.publication_digest,
      publication_revision: 4 }, { record_id: "result-one", publication: replanned }, brief.requestId, binding.brief_digest,
    scope.taskContextDigest, scope.sourceFingerprint)!;
    expect(replannedProjection.state).toBe("superseded");
    expect(replannedProjection.resultDigest).toBeNull();
    expect(replannedProjection.summary).toMatch(/^Continued in a newer run/);
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
    expect(finished.outcome).toBe("estimate");
    expect(finished.summary).toBe("Your simulation estimate is ready. It is an estimate from a simulation of your site, not a certified result. In the simulation, 2 of 36 candidates ran, with 6 episodes scored against the job's success criteria.");
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

describe("one outcome per run, in one plain sentence (F-03)", () => {
  const project = (publication: ReturnType<typeof finishedScreening>) => {
    const { brief, job } = screeningFixture();
    const binding = { job_id: brief.requestId, brief_digest: scientificBriefDigest(brief) };
    const scope = managedJobTask({ binding, record: job, brief });
    const run = { run_id: publication.campaign_id, run_kind: "beta_policy_screening", state: publication.status, result_record_id: "result-one",
      job_evidence_binding: binding, job_task_context_digest: scope.taskContextDigest, job_source_fingerprint: scope.sourceFingerprint,
      configuration_digest: publication.plan_digest, source_scene_intent_id: publication.source.scene_intent_id,
      source_scene_revision_digest: publication.source.scene_revision_digest, publication_digest: publication.publication_digest,
      publication_revision: publication.revision };
    return projectManagedJobEvidence(publication.campaign_id, run, { record_id: "result-one", publication },
      brief.requestId, binding.brief_digest, scope.taskContextDigest, scope.sourceFingerprint)!;
  };
  const operatorWords = /rerun|setup blocker|owner approval|budget|\$|development only/i;

  it.each(PUBLISHED_SCREENING_OUTCOMES)("names %s once and says its sentence first, with no operator instruction for the site", outcome => {
    const publication = outcomePublication(screeningFixture().publication, outcome);
    expect(parseBetaPolicyScreeningPublication(publication)).not.toBeNull();
    expect(screeningOutcome(publication)).toBe(outcome);
    const projected = project(publication);
    expect(projected.outcome).toBe(outcome);
    expect(projected.summary.startsWith(screeningOutcomeSentence(outcome))).toBe(true);
    expect(`${projected.summary} ${projected.nextAction}`).not.toMatch(operatorWords);
  });

  it("gives every outcome its own sentence, and only an estimate is called one", () => {
    const sentences = SCREENING_OUTCOMES.map(screeningOutcomeSentence);
    // A wait on Blueprint's money decision says so; a re-plan after a deploy is in progress.
    expect(new Set(sentences).size).toBe(SCREENING_OUTCOMES.length);
    expect(screeningOutcomeSentence("awaiting_spend_approval")).toMatch(/waiting on an approval inside Blueprint/);
    for (const outcome of SCREENING_OUTCOMES) {
      if (outcome !== "estimate") expect(screeningOutcomeSentence(outcome)).not.toMatch(/estimate is ready/);
      if (outcome !== "held_capability") expect(screeningOutcomeSentence(outcome)).not.toBe(screeningOutcomeSentence("held_capability"));
    }
    expect(screeningOutcome(screeningFixture().publication)).toBeNull();
  });

  it("calls a run where only scripted reference baselines were scored reference-only, never an estimate", () => {
    const publication = outcomePublication(screeningFixture().publication, "reference_only");
    const projected = project(publication);
    expect(projected.state).toBe("reference_only");
    expect(projected.summary).toBe("No estimate yet: only scripted reference baselines were scored, and no learned policy could be evaluated on your job yet.");
    expect(projected.limitations.join(" ")).not.toMatch(/bounded simulation estimate from/);
    expect(projected.limitations.join(" ")).toMatch(/do not establish learned-policy or vendor-policy performance/);
    // A learned policy that ran but scored nothing still leaves only the reference.
    const voided = sealScreening({ ...publication, candidates: publication.candidates.map((row, index) => index === 1
      ? { ...row, status: "completed", blockers: [], episodes_void: 3, session_result_digest: screeningSha("7") } : row) });
    expect(screeningOutcome(voided)).toBe("reference_only");
    // One scored learned policy beside the baseline is an estimate, from the learned rows only.
    const mixed = sealScreening({ ...publication, candidates: publication.candidates.map((row, index) => index === 1
      ? { ...row, status: "completed", blockers: [], episodes_scored: 3, episodes_succeeded: 1, episodes_failed: 2,
        success_rate: 1 / 3, session_result_digest: screeningSha("7") } : row) });
    expect(screeningOutcome(mixed)).toBe("estimate");
    expect(project(mixed).limitations).toContain("A bounded simulation estimate from 3 scored episodes across 1 candidate, for this job's recorded task and simulated conditions only.");
    // Rows that never recorded an execution kind keep reading as the estimate they always were.
    const legacy = sealScreening({ ...publication, candidates: publication.candidates.map((row, index) => index === 0
      ? Object.fromEntries(Object.entries(row).filter(([key]) => !(key in scriptedBaselineRow))) : row) });
    expect(screeningOutcome(legacy)).toBe("estimate");
  });
});
