import { crossRuntimeArtifactDigest } from "../../utils/crossRuntimeCanonical";
import type { SiteTaskQualificationReceipt } from "../../utils/siteTaskQualificationReceipt";

const sha = (character: string) => `sha256:${character.repeat(64)}`;
type Binding = SiteTaskQualificationReceipt["binding"];
type Overrides = Partial<Omit<SiteTaskQualificationReceipt,
  "binding" | "qualification" | "registration_receipt" | "fidelity_review_receipt" | "receipt_digest">> & {
  binding?: Partial<Binding>;
};

/** Synthetic local evidence only. Never publish this fixture to a live system. */
export function qualifiedReceipt(overrides: Overrides = {}): SiteTaskQualificationReceipt {
  const binding: Binding = {
    scene_request_id: "job_scoring", site_id: "site-scoring", task_id: "task-scoring",
    capture_id: "capture-scoring", source_capture_digest: sha("c"),
    testbed_digest_sha256: sha("d"), scene_revision_digest: sha("2"),
    task_spec_digest: sha("e"), success_contract_digest: sha("1"),
    robot_model_digest: sha("f"), policy_interface_id: "blueprint_policy_https.v1",
    ...overrides.binding,
  };
  const common = {
    binding, request_digest: overrides.request_digest ?? sha("a"),
    profile_digest: overrides.profile_digest ?? sha("b"),
    source_measurement_digest: sha("6"), simulator_measurement_digest: sha("7"),
  };
  const check = (dimension: string) => ({
    id: `check.${dimension}`, dimension, unit: "m", sample_count: 3,
    max_abs_error: 0.01, rms_error: 0.005, maximum_absolute_error: 0.05, maximum_rms_error: 0.02,
  });
  const registration = {
    schema_version: "blueprint.site_task_registration.v1", ...common,
    checks: ["scale", "registration", "collision"].map(check), receipt_digest: "",
  };
  registration.receipt_digest = crossRuntimeArtifactDigest(registration, "receipt_digest");
  const fidelity = {
    schema_version: "blueprint.site_task_fidelity_review.v1", ...common,
    checks: ["task_state", "observation", "task_dynamics"].map(check), receipt_digest: "",
  };
  fidelity.receipt_digest = crossRuntimeArtifactDigest(fidelity, "receipt_digest");
  const sourceDigests = { capture: sha("c"), scene: sha("2"), testbed: sha("d"), task_spec: sha("e"),
    success_contract: sha("1"), robot_model: binding.robot_model_digest, measurement: sha("6"), simulator_measurement: sha("7") };
  const receipt = {
    schema_version: "blueprint.site_task_simulation_qualification.v1", evidence_scope: "simulation",
    qualification: { evidence_scope: "simulation", capture_id: binding.capture_id,
      scene_revision_digest: binding.scene_revision_digest,
      registration_receipt_digest: registration.receipt_digest, fidelity_review_receipt_digest: fidelity.receipt_digest },
    registration_receipt: registration, fidelity_review_receipt: fidelity,
    source_artifacts: Object.entries(sourceDigests).map(([role, digest]) => ({
      role, uri: `gs://synthetic-test-only/${role}.json`, sha256: digest, size_bytes: 100,
    })),
    request_digest: common.request_digest, profile_digest: common.profile_digest,
    review_digest: sha("8"), authority_digest: sha("9"), reviewed_by: "synthetic-independent-reviewer",
    reviewed_at_iso: "2026-10-18T00:00:00Z", expires_at_iso: "2099-10-18T00:00:00Z",
    physical_performance_claimed: false, adp_qualified_evidence_eligible: false,
    ...overrides, binding,
    receipt_digest: "",
  };
  receipt.receipt_digest = crossRuntimeArtifactDigest(receipt, "receipt_digest");
  return receipt as SiteTaskQualificationReceipt;
}
