/** Fixed product copy only: never echo host exceptions, paths, endpoints or credential names. */
const groups: Array<[string[], string]> = [
  [["beta_screening_hosted_credential_not_private"], "The hosted policy connection still needs secure access configuration."],
  [["commercial_use_not_admitted", "commercial_license_not_admitted", "license_review_pending"], "Permission to use this model still needs to be established."],
  [["prepared_robot_policy_registration_missing", "no_runnable_embodiment_with_matching_camera_rig", "complete_licensed_robot_assets_missing"], "The matching robot, tools and camera setup still need preparation."],
  [["checkpoint_bytes_not_downloaded_and_verified", "checkpoint_bytes_not_verified", "checkpoint_normalization_and_action_mapping_missing"], "The model files and robot control mapping still need verification."],
  [["embodiment_specific_checkpoint_not_supplied", "robot_specific_policy_endpoint_or_checkpoint_missing", "task_trained_checkpoint_or_policy_endpoint_missing", "ur5e_task_trained_checkpoint_or_policy_endpoint_missing"], "A policy trained for this robot or task has not been supplied."],
  [["dream_account_model_identity_unverified", "pi_api_account_and_exact_checkpoint_access_missing", "provider_account_access_unverified", "praxis_partner_access_missing", "jacobi_planner_api_entitlement_missing"], "Access to the provider's model or service has not been verified."],
  [["hosted_data_disclosure_and_billing_not_bound", "provider_inference_terms_and_data_use_not_reviewed"], "The provider's data-use terms and billing limits still need to be established."],
  [["proprietary_gmr_ai_policy_access_missing", "proprietary_luna_policy_access_missing", "vendor_controller_access_missing"], "The deployment company's private policy or controller is not available to this test."],
  [["finishing_tool_and_controller_required", "palletizing_controller_adapter_missing", "vacuum_tool_and_palletizing_controller_required", "robot_specific_controller_not_supplied", "task_policy_required_beyond_control_api"], "This route still needs its task tools and controller."],
  [["second_exterior_camera_not_in_policy_views"], "The policy needs an additional camera view."],
  [["skill_trace_artifact_not_supplied", "skill_trace_replay_adapter_not_bound"], "A usable recorded skill and replay connection still need preparation."],
  [["trlc_offline_tokenizer_access_unverified"], "Access to a required model component still needs verification."],
];
const known = new Map(groups.flatMap(([codes, note]) => codes.map(code => [code, note] as const)));
export function candidatePreparationNotes(reasons: string[]): string[] {
  return [...new Set(reasons.map(reason => known.get(reason) ?? "This configuration still needs an integration check."))];
}
