// @vitest-environment node
import { describe, expect, it } from "vitest";

import fixture from "./fixtures/pipeline-configured-scene-offering.v1.json";
import { configuredSceneOfferingSchema } from "../utils/configuredSceneOfferingContract";
import { canonicalArtifactDigest } from "../utils/taskCandidateContract";

const SUBJECT_INSTANCE = "219";
const SUPPORT_INSTANCE = "223";

/**
 * A pick-and-place whose place target is a marked region on a supporting
 * instance rather than a destination probe object. The pipeline has shipped
 * this shape for scene 840938; the contract modelled only the probe, so the
 * offering was refused and its sealed digest could not even be recomputed,
 * because .strict() dropped task.surface_target before the digest check.
 */
function surfaceTargetOffering() {
  const value: any = structuredClone(fixture);
  value.task.strategy = "pick_and_place";
  value.task.subject_identity = {
    id: `interiorgs-840938-object-${SUBJECT_INSTANCE}`,
    version: "v1",
  };
  value.task.surface_target = {
    schema_version: "task_evaluation_surface_target.v1",
    shape: "flat_green_disc",
    visible_label: "green spot",
    radius_m: 0.07,
    surface_position_world_m: [-2.56, 2.01, 0.748959423],
    support_prim_path: "/Root/bcp_instance_56f4da26ed956730",
    support_source_instance_id: SUPPORT_INSTANCE,
    non_colliding: true,
    stable_seconds: 1,
    maximum_linear_speed_m_s: 0.02,
    maximum_angular_speed_rad_s: 0.1,
    maximum_tilt_rad: 0.2617993877991494,
    target_digest: `sha256:${"7".repeat(64)}`,
  };
  return reseal(value);
}

function reseal(value: any) {
  if (value.task.surface_target) value.task.surface_target.target_digest = canonicalArtifactDigest(value.task.surface_target, "target_digest");
  value.offering_digest = canonicalArtifactDigest(value, "offering_digest");
  return value;
}

describe("pick-and-place place target", () => {
  it("admits a surface target as a place target and keeps it inside the sealed digest", () => {
    const offering = surfaceTargetOffering();
    const parsed = configuredSceneOfferingSchema.safeParse(offering);
    expect(parsed.success).toBe(true);
    // The key must survive parsing, or the offering_digest check above it could
    // only ever pass by accident.
    expect(parsed.success && parsed.data.task.surface_target?.support_source_instance_id)
      .toBe(SUPPORT_INSTANCE);
  });

  it("refuses a surface target that sits on the subject it is placing", () => {
    const offering = surfaceTargetOffering();
    offering.task.surface_target.support_source_instance_id = SUBJECT_INSTANCE;
    const parsed = configuredSceneOfferingSchema.safeParse(reseal(offering));
    expect(parsed.success).toBe(false);
    expect(parsed.success ? [] : parsed.error.issues.map((issue) => issue.message)).toContain(
      "pick-and-place offering requires a place target distinct from its subject",
    );
  });

  it("refuses a pick-and-place carrying no place target at all", () => {
    const offering = surfaceTargetOffering();
    delete offering.task.surface_target;
    const parsed = configuredSceneOfferingSchema.safeParse(reseal(offering));
    expect(parsed.success).toBe(false);
    expect(parsed.success ? [] : parsed.error.issues.map((issue) => issue.message)).toContain(
      "pick-and-place offering requires a place target distinct from its subject",
    );
  });

  it("refuses a colliding surface target", () => {
    const offering = surfaceTargetOffering();
    offering.task.surface_target.non_colliding = false;
    expect(configuredSceneOfferingSchema.safeParse(reseal(offering)).success).toBe(false);
  });

  it("leaves non-pick-and-place strategies free of a place target", () => {
    const offering: any = structuredClone(fixture);
    expect(offering.task.strategy).not.toBe("pick_and_place");
    expect(configuredSceneOfferingSchema.safeParse(offering).success).toBe(true);
  });
});
