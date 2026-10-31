import { crossRuntimeArtifactDigest, crossRuntimeDigest } from "../../utils/crossRuntimeCanonical";
import { projectWebsiteCaptureRights, projectWebsiteTaskContext } from "../../utils/websiteTaskContext";
import type { SiteTaskBriefRecord } from "../../utils/siteTaskBrief";
import type { BetaPolicyScreeningPublication } from "../../utils/betaPolicyScreeningContract";
import type { BetaCandidateSelection } from "../../utils/betaCandidateSelection";
import allCandidatePublication from "./pipeline-beta-policy-screening-all-candidates.v2.json";
export const screeningSha = (character: string) => `sha256:${character.repeat(64)}`;
export function sealScreening(value: any): BetaPolicyScreeningPublication {
  return { ...value, publication_digest: crossRuntimeArtifactDigest(value, "publication_digest") };
}
export function screeningFixture(proposed = false) {
  const brief = { requestId: "job-one", summary: "Move the rigid part to its tray", confirmedAtIso: proposed ? null : "2026-10-26T12:00:00Z",
    operatorAnswers: {}, unresolved: [] } as unknown as SiteTaskBriefRecord;
  const job: Record<string, any> = { request: { buyerType: "site_operator", consent_attestation: {
    granted: true, statement_version: "2026-09-18.v1", recorded_at_iso: "2026-10-26T11:00:00Z" } } };
  const context = projectWebsiteTaskContext(brief, projectWebsiteCaptureRights(job), proposed ? { purpose: "scene_preparation" } : undefined);
  job.website_scene_sponsorship = { task_context_digest: context.context_digest, capture_id: context.capture_id,
    ...(proposed ? { purpose: "scene_preparation" } : {}),
    owner: { user_id: "blueprint", organization_id: "blueprint-operations" } };
  const request = { submission_id: context.capture_id, owner: job.website_scene_sponsorship.owner,
    task: { task_id: `website-${context.context_digest.slice(7, 27)}` } };
  const receipt = { schema_version: "task_evaluation_scene_intake_receipt.v1", status: "accepted",
    intent_id: "scene-one", intent_digest: screeningSha("a"), request_digest: crossRuntimeDigest(request),
    provider_mutation_performed_inside_http_request: false };
  const status = { schema_version: "task_evaluation_scene_intent_status.v1", status: "completed", phase: "scene_prepared",
    intent_id: receipt.intent_id, intent_digest: receipt.intent_digest, request_digest: receipt.request_digest,
    owner: request.owner, result_reference: { uri: "gs://fixture/revision/configured_scene_revision.v1.json", digest: screeningSha("e"), size_bytes: 300 } };
  const intake = { website_request_id: brief.requestId, source_session_id: context.capture_id, state: "completed", request, request_digest: crossRuntimeDigest(request),
    receipt: { ...receipt, receipt_digest: crossRuntimeDigest(receipt) }, pipeline_status: { ...status, status_digest: crossRuntimeDigest(status) } };
  const publication = sealScreening({ schema_version: "beta_policy_screening_publication.v2", campaign_id: "campaign-one",
    site_id: context.scene_id, revision: 1, plan_digest: screeningSha("b"), catalog_digest: screeningSha("c"), scenario_plan_digest: screeningSha("d"),
    source: { scene_intent_id: receipt.intent_id, scene_intent_digest: receipt.intent_digest, capture_id: context.capture_id,
      task_id: request.task.task_id, task_context_digest: context.context_digest, scene_revision_digest: screeningSha("e") },
    status: "queued", purpose: "job_evaluation", execution_operator: { kind: "blueprint" },
    claim_ceiling: "simulation_estimate",
    candidates: Array.from({ length: 36 }, (_, index) => ({ candidate_id: `candidate-${index}`, display_name: `Candidate ${index}`,
      configuration_digest: screeningSha("f"), status: "pending", blockers: [], episodes_planned: 3, episodes_scored: 0,
      episodes_succeeded: 0, episodes_failed: 0, episodes_void: 0, success_rate: null, session_result_digest: null })),
    budget: { currency: "USD", limit_usd: "15.00", committed_upper_bound_usd: "0", spent_upper_bound_usd: "0", reserved_usd: "0" },
    generated_at: "2026-10-26T12:10:00Z" });
  return { publication, job, brief, context, intake };
}

export function familyScreeningFixture() {
  const fixture = screeningFixture();
  const task = { ...fixture.intake.request.task, strategy: "button_press",
    task_success_contract_digest: screeningSha("1"), native_runtime_contract_digest: screeningSha("2"),
    task_family_runtime_selection: { runtime_id: "qualified-button-runtime", runtime_catalog_digest: screeningSha("3") } };
  const reference = { schema_version: "website_task_family_preparation_result.v1", path: "/retained/family/preparation-result.json",
    sha256: screeningSha("4"), size_bytes: 500, digest: fixture.publication.source.scene_revision_digest,
    task_family: task.strategy, task_success_contract_digest: task.task_success_contract_digest,
    native_runtime_contract_digest: task.native_runtime_contract_digest,
    task_family_runtime_selection: task.task_family_runtime_selection,
    native_application_claimed: false, policy_episode_claimed: false, pre_policy_site_qualification_required: true };
  const request = { ...fixture.intake.request, task, execution: { purpose: "scene_preparation", policy_candidates: [] } };
  const requestDigest = crossRuntimeDigest(request);
  const receipt = { ...fixture.intake.receipt, request_digest: requestDigest };
  const status = { ...fixture.intake.pipeline_status, phase: "family_native_prepared", request_digest: requestDigest,
    result_reference: reference };
  return { ...fixture, intake: { ...fixture.intake, request, request_digest: requestDigest,
    receipt: { ...receipt, receipt_digest: crossRuntimeArtifactDigest(receipt, "receipt_digest") },
    pipeline_status: { ...status, status_digest: crossRuntimeArtifactDigest(status, "status_digest") } } };
}

/** Real Python coordinator rows, with development-only WebApp source lineage. */
export function allCandidateFamilyScreeningFixture() {
  const fixture = familyScreeningFixture();
  const seed = allCandidatePublication.candidates.find(row => row.candidate_id === "pi05_droid")!;
  const request = { ...fixture.intake.request, task: { ...fixture.intake.request.task,
    policy_selection: { candidate_id: seed.candidate_id, catalog_digest: screeningSha("c"),
      configuration_digest: seed.configuration_digest } } };
  const requestDigest = crossRuntimeDigest(request);
  const receipt = { ...fixture.intake.receipt, request_digest: requestDigest };
  const status = { ...fixture.intake.pipeline_status, request_digest: requestDigest };
  return { ...fixture, publication: sealScreening({ ...allCandidatePublication,
    campaign_id: fixture.publication.campaign_id, site_id: fixture.publication.site_id,
    source: fixture.publication.source }),
    intake: { ...fixture.intake, request, request_digest: requestDigest,
      receipt: { ...receipt, receipt_digest: crossRuntimeArtifactDigest(receipt, "receipt_digest") },
      pipeline_status: { ...status, status_digest: crossRuntimeArtifactDigest(status, "status_digest") } } };
}

export function sealSelection(value: any): BetaCandidateSelection {
  return { ...value, selection_digest: crossRuntimeArtifactDigest(value, "selection_digest") };
}

/** The Pipeline rule's record for a terminal publication, with a recorded deployment row for the choice. */
export function selectionFixture(publication: BetaPolicyScreeningPublication, chosen: Record<string, unknown> = {}) {
  const eligible = publication.candidates.map((row, index) => ({ row, index })).filter(({ row }) => row.status === "completed"
    && row.episodes_scored > 0 && row.execution_evidence_kind !== "scripted_simulator_state_baseline")
    .sort((left, right) => right.row.success_rate! - left.row.success_rate! || right.row.episodes_scored - left.row.episodes_scored
      || left.row.episodes_void - right.row.episodes_void || left.index - right.index).map(({ row }) => row);
  const best = eligible[0]?.episodes_succeeded ? eligible[0] : undefined;
  return sealSelection({ schema_version: "website_candidate_selection.v1", campaign_id: publication.campaign_id,
    site_id: publication.site_id, plan_digest: publication.plan_digest, publication_digest: publication.publication_digest,
    publication_revision: publication.revision, result_status: publication.status, catalog_digest: publication.catalog_digest,
    catalog_basis: "campaign_catalog", rule: "success_rate_then_scored_then_void_then_priority_then_identifier.v1",
    decided_by: "deterministic_rule_no_human_input",
    status: best ? "chosen" : eligible.length ? "no_successful_candidate" : "no_evaluated_candidate",
    chosen: best ? { candidate_id: best.candidate_id, configuration_digest: best.configuration_digest, display_name: best.display_name,
      success_rate: best.success_rate, episodes_scored: best.episodes_scored, episodes_succeeded: best.episodes_succeeded,
      configuration_id: "fanuc_m710ic_45m", policy_route_id: "planning_endpoint",
      deployment_companies: ["Jacobi Robotics", "Delta Technology"], relationship: "company_deployment",
      evidence_url: "https://jacobirobotics.com/platform", related_teams: ["Jacobi Robotics", "Delta Technology"],
      partner_blockers: [], ...chosen } : null,
    tied_with: [], claim_ceiling: "simulation_estimate",
    candidates: publication.candidates.map((row, index) => ({ candidate_id: row.candidate_id, display_name: row.display_name,
      priority_rank: index + 1, plan_status: row.blockers.includes("candidate_infeasible_measured_geometry") ? "infeasible"
        : ["unavailable", "deferred"].includes(row.status) ? row.status : "selected",
      result_status: row.status, blockers: row.blockers, episodes_planned: row.episodes_planned, episodes_scored: row.episodes_scored,
      episodes_succeeded: row.episodes_succeeded, episodes_failed: row.episodes_failed, episodes_void: row.episodes_void,
      success_rate: row.success_rate, session_result_digest: row.session_result_digest,
      choice_blocker: eligible.includes(row) ? null : row.status === "completed" ? "no_scored_episodes" : "not_evaluated",
      ...(eligible.includes(row) ? { result_rank: eligible.indexOf(row) + 1 } : {}) })) });
}

/** A finished 36-candidate run: two scored, one measured out of reach, the rest stopped by the site budget. */
export function finishedScreening(publication: BetaPolicyScreeningPublication, revision = 2) {
  return sealScreening({ ...publication, revision, status: "completed", candidates: publication.candidates.map((row, index) =>
    index < 2 ? { ...row, status: "completed", episodes_scored: 3, episodes_succeeded: 2 - index, episodes_failed: 1 + index,
      success_rate: (2 - index) / 3, session_result_digest: screeningSha(index ? "7" : "6") }
      : index === 2 ? { ...row, status: "unavailable", blockers: ["candidate_infeasible_measured_geometry", "team_embodiment_station_out_of_reach"] }
        : { ...row, status: "blocked", blockers: ["beta_screening_site_budget_exhausted"] }) });
}
