// @vitest-environment node
import { describe, expect, it } from "vitest";
import { projectAtlasPreparationOutcome, projectPreparationOutcome, preparationOutcomeSchema,
  preparationOutcomeV6Schema, preparationOutcomeV7Schema, RECAPTURE_SENTENCES } from "../utils/taskPreparationOutcome";
import { selectWebsiteAtlasPreview } from "../utils/websiteAtlasPreview";
import { crossRuntimeArtifactDigest } from "../utils/crossRuntimeCanonical";
import { projectTaskStatus } from "../utils/taskStatusProjection";
import retainedStop from "./fixtures/floor-ball-atlas-preparation-stop.json";

const sha = `sha256:${"a".repeat(64)}`;
const base = { briefDrafted: true, briefConfirmed: false, hasStoredCapture: true,
  stage: null, coversScene: null, missingViews: [], supplementWouldFinish: false };
function atlas(state = "failed", reason: string | null = "atlas_scene_planner_requires_reconciliation", capture = "walkthrough-r1") {
  const value = { schema_version: "website_atlas_preview.v1", capture_id: capture, revision: 2,
    state, reason, updated_at_epoch: 1793109960,
    bundle: state === "ready" ? { digest: sha, size_bytes: 1, filename: "retained.zip" } : null,
    splat_available: false, mesh_available: false, claim_ceiling: "development_only",
    scale_status: "unscaled_provider_world_units" };
  return { ...value, preview_digest: crossRuntimeArtifactDigest(value, "preview_digest") };
}
function current(value = atlas(), capture = "walkthrough-r1") {
  return selectWebsiteAtlasPreview({ website_atlas_previews: { [value.capture_id]: value } }, capture);
}

describe("source-bound preparation closeout", () => {
  it.each(["failed", "ready"])("shows a spending cap closeout with a %s preview", (state) => {
    const preparationOutcome = projectAtlasPreparationOutcome(current(atlas(state, "spending_cap_reached")));
    const projected = projectTaskStatus({ ...base, preparationOutcome, scenePreviewReady: state === "ready", visualReconstructionReady: state === "ready" });
    expect(projected.outcome).toMatchObject({
      // A money word other than "Free for sites." never reaches a site: the cap stays internal (launch copy, 2026-11-20).
      reason: "We stopped building the simulation of your site before it was finished.",
      nextStep: "Nothing is needed from you.", actionOwner: "none",
    });
  });
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
    expect(outcome!.nextStep).toBe("Nothing is needed from you. Your video is saved; you don't need to send it again.");
    expect(JSON.stringify(projected)).not.toMatch(/requires_reconciliation|confirm.*brief|unsuitable for all/i);
  });
  it.each(Object.keys(RECAPTURE_SENTENCES))("asks the site for a new video, saying what to film, for %s", reason => {
    // The same video gives the same answer, so only a new one clears it; the old copy said none was needed.
    const outcome = projectAtlasPreparationOutcome(current(atlas("needs_input", reason)));
    const sentences = RECAPTURE_SENTENCES[reason as keyof typeof RECAPTURE_SENTENCES];
    expect(outcome).toMatchObject({ category: "insufficient_evidence", basis: "missing_evidence", actionOwner: "site",
      title: "We need a new video to build the simulation of your site", reason: sentences.reason, nextStep: sentences.nextStep });
    expect(outcome!.nextStep).toMatch(/^Please film again.*Then send us the new video\.$/);
    expect(JSON.stringify(outcome)).not.toMatch(/no repeat upload|do not need to (record|send)|atlas_|robot (cannot|could not)/i);
    expect(projectTaskStatus({ ...base, preparationOutcome: outcome }).decision).toBe("insufficient_evidence");
  });
  it.each(["website_front_normal_undetermined", "website_registration_ambiguous", "website_registration_poor_fit",
    "website_registration_conflicts_provider_anchor", "website_registration_anchor_deviation",
    "website_registration_ground_plane_inconsistent"])("asks the site to film the object again for preparation stop %s", reason => {
    const outcome = projectPreparationOutcome(preparationOutcomeV7Schema.parse({ category: "insufficient_evidence", reason,
      basis: "missing_evidence", robot_id: null, evidence_digest: sha }));
    const sentences = RECAPTURE_SENTENCES[reason as keyof typeof RECAPTURE_SENTENCES];
    expect(outcome).toMatchObject({ actionOwner: "site", reason: sentences.reason, nextStep: sentences.nextStep,
      title: "We need a new video to build the simulation of your site", evidence: [{ digest: sha }] });
    expect(outcome.nextStep).toMatch(reason === "website_front_normal_undetermined" ? /front of the object/
      : /clear of clutter, resting where the job starts.*several sides/);
    const projected = projectTaskStatus({ ...base, preparationStatus: { state: "awaiting_inputs", correlationId: null, outcome } });
    expect(projected).toMatchObject({ decision: "insufficient_evidence", operatorAction: sentences.nextStep });
    // A replacement video becomes the job's active capture: its own status replaces this ask.
    expect(projectTaskStatus({ ...base, preparationStatus: { state: "preparing", correlationId: null, outcome: null } })
      .operatorAction).not.toBe(sentences.nextStep);
  });
  it("distinguishes a coverage gap from a processing refusal", () => {
    const missing = projectAtlasPreparationOutcome(current(atlas("needs_input", "atlas_task_and_scene_coverage_gap")));
    expect(missing).toMatchObject({category: "insufficient_evidence", basis: "missing_evidence"});
    const technical = projectAtlasPreparationOutcome(current(atlas("needs_input", "website_atlas_api_key_missing")));
    expect(technical!.category).toBe("processing_failure");
  });
  it("never treats a planner abstention or an assumed desk height as robot incompatibility", () => {
    // Rewritten (review, 2026-11-12): a card with no promise; the preparation status's own outcome takes its place
    // when it has one. Never a robot verdict.
    expect(projectAtlasPreparationOutcome(current(atlas("needs_input", "atlas_scene_planner_abstained")))).toMatchObject({
      category: "insufficient_evidence", title: "Your video didn't show enough of the job",
      reason: "The views in your video did not show enough of the work area for this job.",
      nextStep: "Nothing is needed from you now. Your video stays saved." });
    // A reason this release does not know is read, not refused (review, 2026-11-12), and it is never a robot verdict:
    // it reads as the general "stopped" sentence.
    const desk = preparationOutcomeSchema.safeParse({ category: "robot_incompatibility", reason: "desk_too_high",
      basis: "verified", robot_id: "franka_panda", evidence_digest: sha });
    expect(desk.success).toBe(true);
    expect(projectPreparationOutcome(desk.data as never)).toMatchObject({ category: "insufficient_evidence",
      title: "The preparation of your simulation stopped" });
  });
  it("keeps a no-object scene preservation refusal separate from a robot verdict", () => {
    const outcome = projectAtlasPreparationOutcome(current(atlas("needs_input", "atlas_scene_requires_preserved_capture")));
    expect(outcome).toMatchObject({category: "insufficient_evidence", basis: "missing_evidence", actionOwner: "blueprint"});
    // Not a new-video ask, so the reason never blames the video.
    expect(outcome!.reason).toBe("We could not rebuild the work area and the object clearly enough to build the simulation.");
    expect(outcome!.scope).toBe("");
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
    expect(outcome.title).toBe("The robot arm we checked has no clear path for this job");
    expect(outcome.reason).not.toMatch(/Franka|collision-free|stations|policy evaluation|Paid construction/);
    expect(outcome.scope).toBe("This is an estimate. It does not mean no robot could do the job.");
    expect(outcome.evidence[0].digest).toBe(sha);
  });
  // Blueprint runs no robot software (owner, 2026-11-14): only the reach cause is said; the others name the robots checked.
  it.each([
    ["reach", "None of the 5 robots we checked fits this job. The main reason: the spot where the object is picked up or put down is farther than their arms can reach."],
    ["task_kind", "None of the 5 robots we checked fits this job."],
    ["gpu_memory", "None of the 5 robots we checked fits this job."],
    ["no_candidate_available", "None of the 5 robots we checked fits this job."],
  ])("holds a job no robot we checked fits, in plain words, for cause %s", (cause, sentence) => {
    const receipt = preparationOutcomeV6Schema.parse({ category: "robot_incompatibility", reason: "robot_fit_none",
      basis: "conservative_pre_spend_fit_check", robot_id: null, evidence_digest: sha });
    const outcome = projectPreparationOutcome(receipt, { holdReason: `website_robot_fit_none:${cause}`, precheckDigest: sha,
      counts: { fit: 0, noFit: 3, unknown: 0, unavailable: 2 } });
    expect(outcome.title).toBe("The simulation is on hold: none of the robots we checked fits this job");
    expect(outcome.reason).toBe(sentence);
    expect(outcome.reason).not.toMatch(/software|graphics|GPU|rent|setups|licensed|switched off/i);
    expect(outcome.scope).toBe("This is an estimate from your video. It does not mean no robot could do the job.");
    expect(outcome.nextStep).toBe("Nothing is needed from you. Your first look stays on your job page, and your video is saved.");
    const projected = projectTaskStatus({ ...base, preparationStatus: { state: "awaiting_inputs", correlationId: null, outcome } });
    expect(projected).toMatchObject({ decision: "robot_incompatibility", headline: outcome.title, operatorAction: null });
    // A precheck bound to other evidence lends the hold no cause.
    expect(projectPreparationOutcome(receipt, { holdReason: `website_robot_fit_none:${cause}`,
      precheckDigest: `sha256:${"b".repeat(64)}`, counts: { fit: 0, noFit: 3, unknown: 0, unavailable: 2 } }).reason)
      .toBe("None of the robots we checked fits this job.");
  });
  it("keeps the robot fit hold out of the v3-v5 vocabulary", () => {
    const value = { category: "robot_incompatibility", reason: "robot_fit_none", basis: "conservative_pre_spend_fit_check",
      robot_id: null, evidence_digest: sha };
    expect(preparationOutcomeSchema.safeParse(value).success).toBe(false);
    expect(preparationOutcomeV6Schema.safeParse(value).success).toBe(true);
    expect(preparationOutcomeV6Schema.safeParse({ ...value, robot_id: "franka_panda" }).success).toBe(false);
  });
  it.each(["atlas_preserved_completion_no_exportable_geometry", "atlas_generated_view_registration_unresolved",
    "atlas_source_visibility_uncertain"])("keeps unresolved geometry separate from robot incompatibility: %s", (reason) => {
    const receipt = atlas("needs_input", reason);
    const outcome = projectAtlasPreparationOutcome(current(receipt));
    expect(outcome).toMatchObject({category: "insufficient_evidence", actionOwner: "blueprint"});
    expect(outcome!.reason).toBe("We could not rebuild the work area and the object clearly enough to build the simulation.");
    expect(outcome!.evidence[0].digest).toBe(receipt.preview_digest);
    expect(projectTaskStatus({...base, preparationOutcome: outcome}).decision).toBe("insufficient_evidence");
  });
  it("asks Blueprint to use already saved source views without asking for another upload", () => {
    const receipt = atlas("needs_input", "atlas_recorded_source_views_must_be_recovered_before_generation");
    const outcome = projectAtlasPreparationOutcome(current(receipt));
    expect(outcome).toMatchObject({category: "processing_failure", actionOwner: "blueprint"});
    expect(outcome!.title).toBe("We haven't finished building the simulation from your video");
    expect(outcome!.reason).toBe("Part of your video still needs to go into the simulation.");
    expect(outcome!.nextStep).toBe("Nothing is needed from you. Your video is saved.");
    expect(outcome!.scope).toBe("");
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
