import { describe, expect, it } from "vitest";
import { crossRuntimeArtifactDigest } from "../utils/crossRuntimeCanonical";
import { parsePipelineOperatorPolicyCanaryPreproviderBlocked } from "../utils/policyCanaryWebappSyncContract";
import { bindNoAllocationSource, operatorPreproviderBlocked } from "./fixtures/operator-policy-canary-preprovider-blocked";

const digest = `sha256:${"1".repeat(64)}`;
const fixture = () => operatorPreproviderBlocked({
  run_id: "operator-null-attempt", capture_session_id: "capture-operator-null-attempt",
  intake_id: "intake-operator-null-attempt", registration_digest: digest,
  request_digest: digest, configuration_digest: digest, team_namespace: "team:operator",
});

describe("operator policy canary pre-provider contract", () => {
  it("retains exact producer bytes and the failed legacy predicate without inventing a counter", () => {
    const body = fixture();
    const parsed = parsePipelineOperatorPolicyCanaryPreproviderBlocked(body);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error("fixture rejected");
    expect(parsed.payload.no_allocation_closeout.raw_json).toBe(body.no_allocation_closeout.raw_json);
    expect(parsed.payload.no_allocation_closeout.raw_json).toContain('"provider_instance_charge_usd": 0.0');
    const retained = JSON.parse(parsed.payload.no_allocation_closeout.raw_json);
    expect(retained.legacy_no_allocation_predicate_passed).toBe(false);
    expect(retained).not.toHaveProperty("provider_mutations_performed");
    expect(parsed.payload).not.toHaveProperty("activation_id");
    expect(parsed.payload).not.toHaveProperty("result_delivery");
  });

  it.each([
    ["provider_create_attempted", true], ["vast_side_effects_may_have_occurred", true],
    ["vast_instance_ids", [123]], ["provider_allocation_performed", true],
    ["provider_instance_charge_usd", 0.01], ["provider_instance_charge_not_applicable", false],
    ["all_staged_objects_absent", false], ["continuing_spend_from_this_run", true],
    ["watchdog_status", "active"], ["provider_zero_verified", false],
    ["legacy_no_allocation_predicate_passed", true], ["provider_mutations_performed", 0],
  ])("rejects contradictory or invented no-allocation evidence: %s", (field, value) => {
    const body = fixture();
    const receipt = JSON.parse(body.no_allocation_closeout.raw_json);
    receipt[field as string] = value;
    bindNoAllocationSource(body, receipt);
    expect(parsePipelineOperatorPolicyCanaryPreproviderBlocked(body)).toMatchObject({
      ok: false, blockers: ["operator_policy_canary_no_allocation_proof_invalid"],
    });
  });

  it.each(["provider_bundle_started", "provider_entrypoint_started", "provider_output_returned",
    "scientific_attempt_consumed", "automatic_requeue_authorized", "automatic_requeue_executed"])(
    "rejects started execution or retry authority: %s", (field) => {
      const body = fixture();
      const receipt = JSON.parse(body.no_allocation_closeout.raw_json);
      receipt.provider_attempt_classification[field] = true;
      bindNoAllocationSource(body, receipt);
      expect(parsePipelineOperatorPolicyCanaryPreproviderBlocked(body).ok).toBe(false);
    },
  );

  it.each(["run_id", "blockers"])("binds the original closeout %s to the publication", (field) => {
    const body = fixture();
    body[field] = field === "run_id" ? "different-run" : ["different_reason"];
    body.payload_digest = crossRuntimeArtifactDigest(body, "payload_digest");
    expect(parsePipelineOperatorPolicyCanaryPreproviderBlocked(body)).toMatchObject({
      ok: false, blockers: ["operator_policy_canary_no_allocation_binding_mismatch"],
    });
  });

  it.each(["payload_digest", "sha256", "size_bytes", "raw_json"])("rejects tampered %s", (field) => {
    const body = fixture();
    if (field === "payload_digest") body.payload_digest = digest;
    else {
      body.no_allocation_closeout[field] = field === "sha256" ? digest
        : field === "size_bytes" ? body.no_allocation_closeout.size_bytes + 1 : "{}";
      body.payload_digest = crossRuntimeArtifactDigest(body, "payload_digest");
    }
    expect(parsePipelineOperatorPolicyCanaryPreproviderBlocked(body).ok).toBe(false);
  });

  it.each([
    ["activation_id", "fabricated-activation"], ["result_delivery", {}],
    ["firebase_tenant_id", "other-tenant"], ["provider_allocation_performed", true],
    ["automatic_retry_performed", true], ["claim_ceiling", "qualified_evaluation"],
  ])("rejects incompatible publication fields: %s", (field, value) => {
    const body = fixture();
    body[field as string] = value;
    body.payload_digest = crossRuntimeArtifactDigest(body, "payload_digest");
    expect(parsePipelineOperatorPolicyCanaryPreproviderBlocked(body).ok).toBe(false);
  });
});
