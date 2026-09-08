import { rigidTaskSuccessContractSchema } from "./rigidTaskSuccessContract";
import type { VerifiedPolicyCanaryScoreCorrectionSidecar } from "./policyCanaryScoreCorrectionContract";
import { stableJson } from "./taskCandidateContract";

/** A verified rescore can explain its criteria; it is not the original execution authorization. */
export function projectCorrectedScoringContract(
  publication: Record<string, any>,
  sidecar: VerifiedPolicyCanaryScoreCorrectionSidecar | null,
) {
  if (!sidecar || sidecar.correction.source_run_id !== publication.run_id
    || sidecar.source_binding.source_projection_digest !== publication.policy_canary_result?.projection_digest
    || sidecar.source_binding.source_delivery_digest !== publication.result_delivery?.delivery_digest) return null;
  const updates = sidecar.correction.score_updates;
  if (updates.length !== 20) return null;
  const parsed = updates.map((update) => rigidTaskSuccessContractSchema.safeParse(update.new_score.task_success_contract));
  if (parsed.some((value) => !value.success)) return null;
  const contract = parsed[0].success ? parsed[0].data : null;
  if (!contract || updates.some((update, index) => !parsed[index].success
    || update.success_contract_digest !== contract.contract_digest
    || update.new_score.task_success_contract_digest !== contract.contract_digest
    || stableJson(update.new_score.task_success_contract) !== stableJson(contract))) return null;
  return {
    schema_version: "task_evaluation_corrected_scoring_contract_projection.v1" as const,
    source_correction_digest: sidecar.correction.correction_digest,
    source_projection_digest: sidecar.source_binding.source_projection_digest,
    source_delivery_digest: sidecar.source_binding.source_delivery_digest,
    original_request_authorization: false as const,
    team_confirmation_recorded: contract.provenance.confirmation_status === "confirmed"
      && Boolean(contract.provenance.confirmed_by_team_id),
    contract,
  };
}
