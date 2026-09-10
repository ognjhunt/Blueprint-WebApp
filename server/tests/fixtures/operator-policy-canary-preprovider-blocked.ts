import { createHash } from "node:crypto";
import type { OperatorPolicyCanaryRegistration } from "../../utils/operatorPolicyCanaryRegistration";
import { crossRuntimeArtifactDigest } from "../../utils/crossRuntimeCanonical";

const sha = (value: string) => `sha256:${value.repeat(64)}`;

export function bindNoAllocationSource(payload: Record<string, any>, receipt: Record<string, any>) {
  // Retain a native Python numeric spelling that JSON.parse cannot preserve.
  const rawJson = JSON.stringify(receipt, null, 2).replace('"provider_instance_charge_usd": 0,', '"provider_instance_charge_usd": 0.0,') + "\n";
  payload.no_allocation_closeout = {
    raw_json: rawJson,
    sha256: `sha256:${createHash("sha256").update(rawJson).digest("hex")}`,
    size_bytes: Buffer.byteLength(rawJson),
  };
  payload.payload_digest = crossRuntimeArtifactDigest(payload, "payload_digest");
  return payload;
}

export function operatorPreproviderBlocked(registration: Pick<OperatorPolicyCanaryRegistration,
  "run_id" | "capture_session_id" | "intake_id" | "registration_digest" | "request_digest" | "configuration_digest" | "team_namespace">) {
  const blockers = ["no_vast_offer_with_known_supported_isaac_driver_at_or_below_max_hourly_rate"];
  const receipt = {
    schema_version: "operator_policy_no_allocation_closeout.v1",
    run_id: registration.run_id,
    status: "blocked_without_provider_allocation",
    provider_allocation_performed: false,
    provider_instance_charge_usd: 0,
    provider_instance_charge_not_applicable: true,
    inner_adapter_sha256: sha("a"),
    provider_create_attempted: false,
    vast_side_effects_may_have_occurred: false,
    vast_instance_ids: [],
    provider_attempt_classification: {
      schema_version: "provider_attempt_classification.v1",
      classification: "pre_execution_provider_null",
      provider_bundle_started: false,
      provider_entrypoint_started: false,
      provider_output_returned: false,
      scientific_attempt_consumed: false,
      pre_execution_requeue_eligible_in_principle: true,
      automatic_requeue_authorized: false,
      automatic_requeue_executed: false,
      maximum_automatic_requeues: 0,
      authority_required_for_next_provider_mutation: true,
      blockers,
    },
    all_staged_objects_absent: true,
    continuing_spend_from_this_run: false,
    watchdog_status: "cancelled_no_allocation",
    provider_zero_verified: true,
    legacy_no_allocation_predicate_passed: false,
    legacy_predicate_gap: "provider_mutations_performed counter absent; direct adapter creation and side-effect fields retained instead",
    receipt_digest: sha("b"),
  };
  return bindNoAllocationSource({
    schema_version: "task_evaluation_operator_policy_canary_preprovider_blocked.v1",
    run_id: registration.run_id,
    capture_session_id: registration.capture_session_id,
    intake_id: registration.intake_id,
    operator_registration_digest: registration.registration_digest,
    request_digest: registration.request_digest,
    configuration_digest: registration.configuration_digest,
    team_namespace: registration.team_namespace,
    firebase_tenant_id: null,
    run_kind: "internal_policy_canary",
    claim_ceiling: "diagnostic_policy_execution",
    result_status: "blocked",
    provider_allocation_performed: false,
    automatic_retry_performed: false,
    blockers,
  }, receipt);
}
