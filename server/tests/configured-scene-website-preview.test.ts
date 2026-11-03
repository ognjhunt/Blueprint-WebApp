// @vitest-environment node
import { expect, it } from "vitest";
import fixture from "./fixtures/pipeline-configured-scene-offering.v1.json";
import { configuredSceneOfferingSchema } from "../utils/configuredSceneOfferingContract";
import { canonicalArtifactDigest } from "../utils/taskCandidateContract";
function preview() {
  const value: any = structuredClone(fixture);
  delete value.public_display;
  const status = "prepared_scene_ungraded", warning = "Generated task-object preview; scene appearance ungraded";
  Object.assign(value.presentation, { appearance_review_status: status, selected_from_exact_reviewed_frame_count: 0, warning_label: warning });
  Object.assign(value.presentation.selection, { appearance_review_status: status,
    reviewer: {kind: "system", identity: "website-task-object-preview", runtime: "retained_artifact_selection", model: "none"} });
  Object.assign(value.proof_boundary, {appearance_review_status: status, appearance_visual_review_completed: false,
    appearance_quality_graded: false, appearance_warning_label: warning});
  value.offering_digest = canonicalArtifactDigest(value, "offering_digest");
  return value;
}
it("accepts a private generated object preview without claiming scene review", () => {
  const value = configuredSceneOfferingSchema.parse(preview());
  expect(value.proof_boundary.appearance_visual_review_completed).toBe(false);
  expect(value.presentation.warning_label).toContain("scene appearance ungraded");
});
it.each(["review", "count", "warning", "reviewer", "public"])("rejects preview evidence upgrade: %s", (fault) => {
  const value = preview();
  if (fault === "review") value.proof_boundary.appearance_quality_graded = true;
  if (fault === "count") value.presentation.selected_from_exact_reviewed_frame_count = 8;
  if (fault === "warning") delete value.presentation.warning_label;
  if (fault === "reviewer") value.presentation.selection.reviewer.kind = "ai";
  if (fault === "public") value.public_display = {};
  value.offering_digest = canonicalArtifactDigest(value, "offering_digest");
  expect(configuredSceneOfferingSchema.safeParse(value).success).toBe(false);
});

function pipelineBinding(change?: (binding: any) => void) {
  // The binding as the Pipeline sends it (task_evaluation_scene_configuration_publication.py).
  const value: any = preview();
  Object.assign(value.evaluation_preparation_binding, {
    artifact_purpose: "evaluation_preparation",
    robot_evaluation_performed: false,
    robot_setup_requirements: [
      { display_name: "Franka Panda", action_space: { dim: 7, representation: "7d_delta_end_effector_pose" },
        claim_boundary: "setup_requirements_and_profile_configuration_not_execution_evidence" },
    ],
  });
  change?.(value.evaluation_preparation_binding);
  value.offering_digest = canonicalArtifactDigest(value, "offering_digest");
  return value;
}
it("accepts the Pipeline's evaluation preparation binding with its robot setup requirements", () => {
  const value = configuredSceneOfferingSchema.parse(pipelineBinding());
  expect(value.evaluation_preparation_binding.robot_evaluation_performed).toBe(false);
  expect(value.evaluation_preparation_binding.robot_setup_requirements).toHaveLength(1);
});
it.each([
  ["evaluation claimed", (b: any) => { b.robot_evaluation_performed = true; }],
  ["other purpose", (b: any) => { b.artifact_purpose = "robot_evaluation"; }],
  ["requirement not an object", (b: any) => { b.robot_setup_requirements = ["Franka Panda"]; }],
  ["empty requirements", (b: any) => { b.robot_setup_requirements = []; }],
  ["unknown key", (b: any) => { b.robot_evaluation_result = {}; }],
])("rejects a changed evaluation preparation binding: %s", (_name, change) => {
  expect(configuredSceneOfferingSchema.safeParse(pipelineBinding(change)).success).toBe(false);
});
