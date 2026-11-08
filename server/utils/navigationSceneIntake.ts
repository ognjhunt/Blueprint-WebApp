/** A navigation job's website scene intake: the robot walks to a goal in a scene kept as filmed.
 *
 * The Pipeline sends it once the job's navigation record exists (its `website_navigation_intake`):
 * the record's task-spec, compiled-spec, success-contract, runtime-contract and scene-revision digests,
 * and no subject, support or destination, because nothing in the scene is placed, removed or moved.
 * Owner, 2026-11-07: a navigation intake reserves $0 and grants no construction allowance, because a
 * scene kept as filmed needs neither. It binds the job's real consent and rights exactly as a rigid
 * intake does, and requires the site's confirmed brief.
 *
 * When the job's Atlas result is published again after its intake, its scene half is derived again and
 * the Pipeline sends that intake re-issued for the same capture, under its own submission
 * (websitePreparationRevision.websiteNavigationReissue): the same consent, rights, owner and $0.
 */
import { z } from "zod";
import { WEBSITE_NAVIGATION_REISSUE } from "./websitePreparationRevision";

const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/);
const digest = z.string().regex(/^sha256:[0-9a-f]{64}$/);

export const NAVIGATION_STRATEGY = "goal_region_navigation";
/** The phase a completed navigation intent reports (the Pipeline's `RESULT_PHASE`). */
export const NAVIGATION_PREPARED_PHASE = "navigation_scene_prepared";

export const navigationIntakeTask = z.object({
  task_id: identifier,
  strategy: z.literal(NAVIGATION_STRATEGY),
  geometry_origin: z.literal("kept_as_filmed"),
  navigation_task_spec_digest: digest,
  compiled_task_spec_digest: digest,
  task_success_contract_digest: digest,
  runtime_contract_digest: digest,
  scene_revision_digest: digest,
  // The intake re-issued for the same capture once its scene half was derived from a later Atlas
  // result (websitePreparationRevision.websiteNavigationReissue binds it to the submission).
  [WEBSITE_NAVIGATION_REISSUE]: z.object({
    capture_id: identifier,
    parent_submission_id: identifier,
    atlas_result_digest: digest,
  }).strict().optional(),
}).strict();

export type NavigationIntakeTask = z.infer<typeof navigationIntakeTask>;

/** The completed navigation intent's result: its digest is the navigation record's scene revision. */
export const navigationPreparationReference = z.object({
  schema_version: z.literal("website_navigation_preparation_result.v1"),
  digest,
  task_kind: z.literal(NAVIGATION_STRATEGY),
  navigation_task_spec_digest: digest,
  compiled_task_spec_digest: digest,
  task_success_contract_digest: digest,
  runtime_contract_digest: digest,
  native_application_claimed: z.literal(false),
  policy_episode_claimed: z.literal(false),
  paid_construction_performed: z.literal(false),
}).strict();

export function isNavigationStrategy(value: unknown): value is typeof NAVIGATION_STRATEGY {
  return value === NAVIGATION_STRATEGY;
}

export function navigationPreparationMatchesTask(reference: unknown, task: unknown): boolean {
  const prepared = navigationPreparationReference.safeParse(reference);
  const selected = navigationIntakeTask.safeParse(task);
  return prepared.success && selected.success
    && prepared.data.digest === selected.data.scene_revision_digest
    && prepared.data.navigation_task_spec_digest === selected.data.navigation_task_spec_digest
    && prepared.data.compiled_task_spec_digest === selected.data.compiled_task_spec_digest
    && prepared.data.task_success_contract_digest === selected.data.task_success_contract_digest
    && prepared.data.runtime_contract_digest === selected.data.runtime_contract_digest;
}

/** A completed navigation preparation for exactly this request: preparation only, no policies. */
export function navigationPreparationPhaseMatches(request: Record<string, any> | undefined,
  status: Record<string, any> | undefined): boolean {
  return status?.phase === NAVIGATION_PREPARED_PHASE && request?.execution?.purpose === "scene_preparation"
    && request.execution.policy_candidates?.length === 0
    && navigationPreparationMatchesTask(status.result_reference, request.task);
}
