/** Pipeline-owned scientific contracts stay in its exact source registry bytes.
 * WebApp forwards their immutable identity without rewriting numeric evidence.
 * A family selection grants no runtime, provider or spending authority.
 */
import { z } from "zod";

const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/);
const digest = z.string().regex(/^sha256:[0-9a-f]{64}$/);
export const taskFamilyNames = ["pouring", "wiping", "insertion", "stacking", "button_press", "cloth_folding", "multi_step"] as const;

export const taskFamilyIntakeTask = z.object({
  task_id: identifier,
  strategy: z.enum(taskFamilyNames),
  task_success_contract_digest: digest,
  native_runtime_contract_digest: digest,
  task_family_runtime_selection: z.object({ runtime_id: identifier, runtime_catalog_digest: digest }).strict(),
  policy_selection: z.object({ candidate_id: identifier, catalog_digest: digest, configuration_digest: digest }).strict().optional(),
}).strict();

export type TaskFamilyIntakeTask = z.infer<typeof taskFamilyIntakeTask>;
export const familyNativePreparationReference = z.object({
  schema_version: z.literal("website_task_family_preparation_result.v1"),
  path: z.string().min(2).max(2000).refine(value => value.startsWith("/") && !value.split("/").includes("..")),
  sha256: digest, size_bytes: z.number().int().positive(), digest,
  task_family: z.enum(taskFamilyNames), task_success_contract_digest: digest, native_runtime_contract_digest: digest,
  task_family_runtime_selection: taskFamilyIntakeTask.shape.task_family_runtime_selection,
  native_application_claimed: z.literal(false), policy_episode_claimed: z.literal(false),
  pre_policy_site_qualification_required: z.literal(true),
}).strict();

export function familyPreparationMatchesTask(reference: unknown, task: unknown): boolean {
  const prepared = familyNativePreparationReference.safeParse(reference);
  const selected = taskFamilyIntakeTask.safeParse(task);
  return prepared.success && selected.success
    && prepared.data.task_family === selected.data.strategy
    && prepared.data.task_success_contract_digest === selected.data.task_success_contract_digest
    && prepared.data.native_runtime_contract_digest === selected.data.native_runtime_contract_digest
    && prepared.data.task_family_runtime_selection.runtime_id === selected.data.task_family_runtime_selection.runtime_id
    && prepared.data.task_family_runtime_selection.runtime_catalog_digest === selected.data.task_family_runtime_selection.runtime_catalog_digest;
}

export function isTaskFamilyStrategy(value: unknown): value is typeof taskFamilyNames[number] {
  return taskFamilyNames.some(family => family === value);
}

/** Shared by publication admission and later evidence applicability reads. */
export function preparationPhaseMatchesTask(request: Record<string, any> | undefined,
  status: Record<string, any> | undefined): boolean {
  return isTaskFamilyStrategy(request?.task?.strategy)
    ? status?.phase === "family_native_prepared" && request?.execution?.purpose === "scene_preparation"
      && request.execution.policy_candidates?.length === 0
      && familyPreparationMatchesTask(status.result_reference, request.task)
    : status?.phase === "scene_prepared" && status.result_reference?.schema_version !== "website_task_family_preparation_result.v1";
}

/** Bind the prepared source to the existing capture/task sponsorship.
 * Pipeline reopens these identities against the full native contract, exact
 * source assets, task context and operator-qualified runtime before execution.
 */
export function websiteFamilySourceBinding(task: unknown, authority: {
  request_id: string; scene_id: string; capture_id: string; task_context_digest: string;
}): TaskFamilyIntakeTask {
  const parsed = taskFamilyIntakeTask.safeParse(task);
  if (!parsed.success || !digest.safeParse(authority.task_context_digest).success
    || !identifier.safeParse(authority.request_id).success
    || authority.scene_id !== `site-${authority.request_id}`
    || !identifier.safeParse(authority.capture_id).success
    || parsed.data.task_id !== `website-${authority.task_context_digest.slice(7, 27)}`)
    throw new Error("website_scene_sponsorship_family_binding_invalid");
  return parsed.data;
}
