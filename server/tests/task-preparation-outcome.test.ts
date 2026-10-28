// @vitest-environment node
import { describe, expect, it } from "vitest";
import { projectAtlasPreparationOutcome, projectPreparationOutcome, preparationOutcomeSchema } from "../utils/taskPreparationOutcome";
import { selectWebsiteAtlasPreview } from "../utils/websiteAtlasPreview";
import { crossRuntimeArtifactDigest } from "../utils/crossRuntimeCanonical";
import { projectTaskStatus } from "../utils/taskStatusProjection";
import retainedStop from "./fixtures/floor-ball-atlas-preparation-stop.json";

const sha = `sha256:${"a".repeat(64)}`;
const base = { briefDrafted: true, briefConfirmed: false, hasStoredCapture: true,
  stage: null, coversScene: null, missingViews: [], supplementWouldFinish: false };
function atlas(state = "failed", reason: string | null = "atlas_scene_planner_requires_reconciliation", capture = "walkthrough-r1") {
  const value = { schema_version: "website_atlas_preview.v1", capture_id: capture, revision: 2,
    state, reason, updated_at_epoch: 1793109960, bundle: null,
    splat_available: false, mesh_available: false, claim_ceiling: "development_only",
    scale_status: "unscaled_provider_world_units" };
  return { ...value, preview_digest: crossRuntimeArtifactDigest(value, "preview_digest") };
}
function current(value = atlas(), capture = "walkthrough-r1") {
  return selectWebsiteAtlasPreview({ website_atlas_previews: { [value.capture_id]: value } }, capture);
}

describe("source-bound preparation closeout", () => {
  it("verifies and replays the exact saved production receipt without a provider or model call", () => {
    const preview = selectWebsiteAtlasPreview({website_atlas_previews: {[retainedStop.capture_id]: retainedStop}}, retainedStop.capture_id);
    expect(preview?.preview_digest).toBe("sha256:b5dd634e35a7fbd792d5cea5ce0e8134f856bfd4d352aacebb729a9d6789fadc");
    expect(projectAtlasPreparationOutcome(preview)).toMatchObject({category: "processing_failure", basis: "execution_failure"});
  });
  it("replays the retained production refusal as our processing failure, without confirming the brief", () => {
    const outcome = projectAtlasPreparationOutcome(current());
    const projected = projectTaskStatus({ ...base, preparationOutcome: outcome });
    expect(projected).toMatchObject({ decision: "processing_failure", operatorAction: null,
      outcome: { category: "processing_failure", basis: "execution_failure", actionOwner: "blueprint" } });
    expect(outcome!.nextStep).toMatch(/do not need to record or upload it again/);
    expect(JSON.stringify(projected)).not.toMatch(/requires_reconciliation|confirm.*brief|unsuitable for all/i);
  });
  it("distinguishes a coverage gap from a processing refusal without demanding a new video", () => {
    const missing = projectAtlasPreparationOutcome(current(atlas("needs_input", "atlas_task_and_scene_coverage_gap")));
    expect(missing).toMatchObject({category: "insufficient_evidence", basis: "missing_evidence"});
    expect(missing!.nextStep).toMatch(/exact missing measurement, view or task fact/);
    const technical = projectAtlasPreparationOutcome(current(atlas("needs_input", "website_atlas_api_key_missing")));
    expect(technical!.category).toBe("processing_failure");
  });
  it("never treats a planner abstention or an assumed desk height as robot incompatibility", () => {
    expect(projectAtlasPreparationOutcome(current(atlas("needs_input", "atlas_scene_planner_abstained")))!.category)
      .toBe("insufficient_evidence");
    expect(preparationOutcomeSchema.safeParse({ category: "robot_incompatibility", reason: "desk_too_high",
      basis: "verified", robot_id: "franka_panda", evidence_digest: sha }).success).toBe(false);
  });
  it("keeps a no-object scene preservation refusal separate from a robot verdict", () => {
    const outcome = projectAtlasPreparationOutcome(current(atlas("needs_input", "atlas_scene_requires_preserved_capture")));
    expect(outcome).toMatchObject({category: "insufficient_evidence", basis: "missing_evidence", actionOwner: "blueprint"});
    expect(outcome!.reason).toMatch(/preserve the captured objects/);
    expect(outcome!.evidence[0].digest).toBe(atlas("needs_input", "atlas_scene_requires_preserved_capture").preview_digest);
    expect(projectTaskStatus({...base, preparationOutcome: outcome}).decision).toBe("insufficient_evidence");
    expect(projectAtlasPreparationOutcome(current({...atlas("needs_input", "atlas_scene_requires_preserved_capture"),
      preview_digest: sha}))).toBeNull();
  });
  it("retains a conservative robot refusal's scope and evidence without claiming impossibility", () => {
    const outcome = projectPreparationOutcome(preparationOutcomeSchema.parse({ category: "robot_incompatibility",
      reason: "robot_carry_path_rejected", basis: "conservative_configuration_check",
      robot_id: "franka_panda", evidence_digest: sha }));
    const projected = projectTaskStatus({ ...base, preparationStatus: { state: "awaiting_inputs", correlationId: null, outcome } });
    expect(projected.decision).toBe("robot_incompatibility");
    expect(outcome.scope).toMatch(/Conservative rejection/);
    expect(outcome.scope).toMatch(/not proof.*impossible.*every robot.*physically/);
    expect(outcome.evidence[0].digest).toBe(sha);
  });
  it.each(["atlas_preserved_completion_no_exportable_geometry", "atlas_generated_view_registration_unresolved",
    "atlas_source_visibility_uncertain"])("keeps unresolved geometry separate from robot incompatibility: %s", (reason) => {
    const receipt = atlas("needs_input", reason);
    const outcome = projectAtlasPreparationOutcome(current(receipt));
    expect(outcome).toMatchObject({category: "insufficient_evidence", actionOwner: "blueprint"});
    expect(outcome!.reason).toMatch(/registered geometry/);
    expect(outcome!.evidence[0].digest).toBe(receipt.preview_digest);
    expect(projectTaskStatus({...base, preparationOutcome: outcome}).decision).toBe("insufficient_evidence");
  });
  it("asks Blueprint to use already saved source views without asking for another upload", () => {
    const receipt = atlas("needs_input", "atlas_recorded_source_views_must_be_recovered_before_generation");
    const outcome = projectAtlasPreparationOutcome(current(receipt));
    expect(outcome).toMatchObject({category: "processing_failure", actionOwner: "blueprint"});
    expect(outcome!.reason).toMatch(/useful views in your saved video/);
    expect(outcome!.nextStep).toMatch(/no new upload is required/);
    expect(outcome!.scope).toMatch(/No robot pass, failure or physical-world validation/);
  });
  it("rejects cross-capture and tampered receipts, and clears a stop on a newer processing state", () => {
    expect(current(atlas("failed", "atlas_preview_expired", "walkthrough-other"))).toBeNull();
    expect(current({...atlas(), reason: "forged_reason"})).toBeNull();
    expect(projectAtlasPreparationOutcome(current(atlas("processing", null)))).toBeNull();
  });
  it("lets withdrawal, native handoff and actual evaluations supersede an old preview failure", () => {
    const preparationOutcome = projectAtlasPreparationOutcome(current());
    expect(projectTaskStatus({ ...base, preparationOutcome, consentRevoked: true }).outcome).toBeUndefined();
    expect(projectTaskStatus({ ...base, preparationOutcome,
      preparationStatus: {state: "handed_off", correlationId: null} }).outcome).toBeUndefined();
    expect(projectTaskStatus({ ...base, preparationOutcome, scenePreviewReady: true }).outcome).toBeUndefined();
    for (const runs of [{queued: 1, running: 0, reported: 0, noResult: 0},
      {queued: 0, running: 0, reported: 1, noResult: 0}, {queued: 0, running: 0, reported: 0, noResult: 1}]) {
      expect(projectTaskStatus({ ...base, preparationOutcome, screening: {teams: 1, ...runs} }).outcome).toBeUndefined();
    }
  });
});
