/**
 * Plain words for the codes a job evaluation records (F-03). A site never
 * reads a raw code: every known code has a label, and an unknown one falls
 * back to its category or to a general sentence, never to the code itself.
 * Operations views show the raw codes instead.
 */
import type { JobManagedEvidenceSummary } from "@/types/jobMarketplace";

const own = (map: Record<string, string>, key: string) => Object.prototype.hasOwnProperty.call(map, key);

const MEASURED = "Measured out of reach from the robot position planned in your scene.";
const NOT_SET_UP = "Not set up in our simulator yet.";
const NOT_RUN = "Not run in this evaluation.";
/** Held back at the job's limit (owner decision 2026-11-11): ours to look at, never the site's step. */
const JOB_LIMIT_NOT_RUN = "Not run: this job reached a limit on our side. Nothing is needed from you.";
/**
 * The Pipeline's harness failures: the candidate ran in our simulator (it was
 * set up), but the run gave nothing that could be scored. Ours to fix, and the
 * Pipeline plans it again once a fix is deployed.
 */
const NO_USABLE_RESULT = "Ran in our simulator, but the run returned no usable result. This is ours to fix, and it will run again after the fix.";
/** The untyped fallback for a closed run with no result: not a typed harness failure, so nothing plans it again by itself. */
const NO_RESULT_UNTYPED = "Ran in our simulator, but the run returned no usable result. This is ours to fix.";

const REASONS: Record<string, string> = {
  candidate_infeasible_measured_geometry: MEASURED,
  team_embodiment_station_out_of_reach: MEASURED,
  task_kind_not_supported_by_candidate: "Not built for this kind of task.",
  // A try the Pipeline did not count because the AI robot's software was not running (`policy_server_unavailable`).
  policy_server_unavailable: "Not counted: the AI robot's software was not running.",
  task_kind_support_unverified: "Not yet shown to handle this kind of task.",
  candidate_disabled: "Switched off in our simulator for now.",
  commercial_use_not_admitted: "Not yet licensed for this use.",
  prepared_robot_policy_registration_missing: NOT_SET_UP,
  runtime_candidate_binding_missing: NOT_SET_UP,
  site_screening_budget_insufficient: NOT_RUN,
  beta_screening_site_budget_exhausted: NOT_RUN,
  website_job_ceiling_insufficient: JOB_LIMIT_NOT_RUN,
  beta_screening_waiting_for_capacity: "Waiting for room in our simulator.",
  // Waits on our side that need nothing from the site (review, 2026-11-12).
  beta_screening_work_disk_wait: "In line for processing on our side.",
  account_monthly_spend_job_start_wait: "In line for processing on our side.",
  beta_screening_waiting_for_control: "Waiting to confirm this job can still run.",
  beta_screening_transport_retry_cap_exhausted: "Not run: we could not confirm this job can still run. This is ours to fix.",
  beta_screening_static_preflight_blocked: "Could not start in our simulator. This is ours to fix.",
  beta_screening_replanned_for_new_implementation: "Continued in a newer run.",
  beta_screening_native_result_missing_or_invalid: NO_USABLE_RESULT,
  beta_screening_native_result_missing: NO_RESULT_UNTYPED,
  beta_screening_native_result_invalid: NO_USABLE_RESULT,
  g1_beta_native_result_missing_or_invalid: NO_USABLE_RESULT,
  // Any stage (`:runtime_open`, `:observation_gate`, `:policy_load`): a cell stopped before its policy ran.
  policy_canary_session_setup_failed: NO_USABLE_RESULT,
  // Held unspent while another candidate's failed run in the same evaluation waits for its fix.
  beta_screening_held_after_launch_failure: "Not run yet: it is waiting for a fix to another run in this evaluation first. This is ours to fix.",
  beta_screening_control_unavailable_timeout: "Stopped: we could not confirm in time that this job could still run. This is ours to fix.",
  beta_screening_authority_expired: "Stopped: the time allowed for this job's simulation ran out before it finished.",
};
/** Codes the Pipeline adds later still say something true, by category. */
const CATEGORIES: Array<[RegExp, string]> = [
  [/infeasible|out_of_reach|unreachable/, MEASURED],
  [/budget|ceiling/, NOT_RUN],
  [/native_result/, NO_USABLE_RESULT],
  [/capacity/, REASONS.beta_screening_waiting_for_capacity],
  [/replanned/, REASONS.beta_screening_replanned_for_new_implementation],
  [/licen[cs]e|commercial|entitlement|terms/, REASONS.commercial_use_not_admitted],
  [/^task_kind/, REASONS.task_kind_not_supported_by_candidate],
  [/disabled/, REASONS.candidate_disabled],
  [/preflight|launch|session|gpu|render/, REASONS.beta_screening_static_preflight_blocked],
  [/missing|not_bound|not_supplied|unverified|not_verified|not_pinned|checkpoint|adapter|controller|endpoint|access|registration|binding/, NOT_SET_UP],
];

/** Why a candidate did not run, in plain words. */
export function screeningReasonLabel(code: string): string {
  const base = code.split(":")[0];
  if (own(REASONS, base)) return REASONS[base];
  return CATEGORIES.find(([pattern]) => pattern.test(base))?.[1] ?? "Limited by something our simulator recorded.";
}

/**
 * The Pipeline records the capacity wait beside a control wait only because the
 * website accepts a return to preparing with that code. The control wait is the reason.
 */
const base = (code: string) => code.split(":")[0];
const reasonCodes = (codes: readonly string[]) => codes.some(code => base(code) === "beta_screening_waiting_for_control")
  ? codes.filter(code => base(code) !== "beta_screening_waiting_for_capacity") : codes;

/** Each distinct plain reason once, in the order first recorded. */
export const screeningReasonLabels = (codes: readonly string[]) => [...new Set(reasonCodes(codes).map(screeningReasonLabel))];

const STATES: Record<string, string> = {
  pending: "Waiting to run", waitlisted: "Waiting to run", preparing: "Getting ready", launching: "Getting ready",
  running: "Running", reconciliation_required: "Being checked", completed: "Finished", blocked: "Did not run",
  unavailable: "Did not run", deferred: "Did not run", infeasible: "Out of reach",
};
export const screeningCandidateStateLabel = (state: string) => own(STATES, state) ? STATES[state] : "Recorded";

const CHOICES: Record<string, string> = {
  not_evaluated: "it did not run in this evaluation",
  no_scored_episodes: "none of its episodes could be scored",
  scripted_baseline_reference_only: "a scripted reference baseline, not a learned policy",
  development_only_reference: "a development check, not ranked against the other candidates",
};
export const screeningChoiceLabel = (code: string) => own(CHOICES, code) ? `Not chosen: ${CHOICES[code]}` : "Not chosen";

const PARTNERS: Record<string, string> = {
  catalog_row_unavailable: "Our catalog has no deployment record for this configuration.",
  no_recorded_deployment_partner_for_configuration: "No deployment partner is recorded for this configuration.",
};
export const screeningPartnerLabel = (code: string) => own(PARTNERS, code) ? PARTNERS[code]
  : "A partner detail we could not confirm.";

const RELATIONSHIPS: Record<string, string> = {
  publisher_demonstrated: "demonstrated by the publisher", company_deployment: "a company deployment",
  public_controller_integration: "a public controller integration", planning_candidate: "a planning candidate",
};
export const screeningRelationshipLabel = (relationship: string) => own(RELATIONSHIPS, relationship)
  ? RELATIONSHIPS[relationship] : null;

const OUTCOMES: Record<string, string> = {
  estimate: "Simulation estimate", reference_only: "Reference baselines only", held_capability: "Held", held_unprepared: "Held",
  infeasible: "Held", no_match: "No match", held_setup: "Held", held_budget: "Held", held_scene_check: "Held",
  awaiting_spend_approval: "In progress", setup_repair: "In progress",
  superseded: "Continued in a newer run",
};
const RUN_STATES: Record<string, string> = {
  queued: "In progress", running: "In progress", preparing: "In progress", reconciliation_required: "Being checked",
  completed: "Finished", held: "Held", blocked: "Stopped", failed: "Stopped", cancelled: "Stopped", closed: "Closed",
};
/** A short plain heading for a run in the site's history. */
export function managedRunLabel(item: Pick<JobManagedEvidenceSummary, "outcome" | "state">): string {
  if (item.outcome && own(OUTCOMES, item.outcome)) return OUTCOMES[item.outcome];
  return own(RUN_STATES, item.state) ? RUN_STATES[item.state] : "Recorded run";
}
