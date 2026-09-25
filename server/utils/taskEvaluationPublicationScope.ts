import { configuredSceneOfferingSchema } from "./configuredSceneOfferingContract";
import type { PipelinePolicyCanaryPublication } from "./policyCanaryWebappSyncContract";
import { confirmedTaskSuccessContractSchema } from "./articulatedTaskSuccessContract";
import { stableJson } from "./taskCandidateContract";

export function normalOwnerControlOmissionMatches(
  policyRun: Record<string, any>, publication: PipelinePolicyCanaryPublication,
) {
  if (!publication.policy_canary_result.control_omission) return true;
  const savedTask = confirmedTaskSuccessContractSchema.safeParse(policyRun.task_success_contract);
  return savedTask.success
    && (!("controls" in savedTask.data.criteria)
      || savedTask.data.criteria.controls?.mode !== "required_per_cell")
    && policyRun.task_success_contract_digest === savedTask.data.contract_digest
    && stableJson(savedTask.data) === stableJson(publication.policy_canary_result.task_success_contract);
}

export function configuredOfferingForTerminalSync(record: Record<string, any>) {
  const parsed = configuredSceneOfferingSchema.safeParse(record.configured_scene_offering);
  if (
    !parsed.success
    || record.configured_scene_offering_digest !== parsed.data.offering_digest
  ) return null;
  return parsed.data;
}

export function offeringScope(
  policyRun: Record<string, any>,
  offering: { team_namespace: string },
) {
  const ownerUserId = String(policyRun.owner_user_id || "").trim();
  const organizationId = offering.team_namespace;
  return {
    ownerUserId,
    organizationId,
    accessVisibility: organizationId === `user:${ownerUserId}`
      ? "owner_only" as const
      : "organization_members" as const,
  };
}

export function policyRunBelongsToOffering(
  policyRun: Record<string, any>,
  offering: { offering_digest: string; team_namespace: string },
  sourceLaunchId: string,
) {
  return Boolean(String(policyRun.owner_user_id || "").trim())
    && policyRun.source_launch_id === sourceLaunchId
    && policyRun.scene_controls_status_at_submission === "configured_controls_pending"
    && /^sha256:[0-9a-f]{64}$/.test(String(policyRun.offering_digest || ""))
    && policyRun.team_namespace === offering.team_namespace;
}
