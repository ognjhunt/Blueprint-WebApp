// @vitest-environment node
/**
 * Round 2 of the cross-repo contract review (2026-11-24): each code the Pipeline sends is said as only what is true.
 *
 * - `atlas_insufficient_sharp_static_views` is a new-video ask; `atlas_scale_review_unresolved` no longer is.
 * - The account's monthly spend check (`account_monthly_spend_*`, scene wait `account_limit_wait`) is a money wait.
 * - A stop the Pipeline runs again by itself is titled as still being worked on.
 * - Blueprint's own setup and a rights refusal never ask the site for permission it has no control to give.
 * - The retries-spent outcome's category is known; every Atlas reason with no words is alerted.
 */
import { describe, expect, it, vi } from "vitest";
import { crossRuntimeArtifactDigest } from "../utils/crossRuntimeCanonical";

vi.mock("../../client/src/lib/firebaseAdmin", () => ({ default: {}, dbAdmin: null, storageAdmin: null }));
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock("../utils/unknownPipelineCode", () => ({ noteUnknownPipelineCode: vi.fn(async () => true),
  noteUnknownPipelineCodes: vi.fn(async () => undefined) }));

const outcome = await import("../utils/taskPreparationOutcome");
const { unknownPreparationCodes } = await import("../utils/websitePreparationStatus");
const { projectTaskStatus } = await import("../utils/taskStatusProjection");
const { sceneWaitMessage } = await import("../utils/sceneIntentOutcome");
const { creatorCaptureControlRefusal } = await import("../routes/internal-capture-worlds");
const { accountLimitReason, accountLimitStop } = await import("../utils/jobConsoleData");

const digest = `sha256:${"a".repeat(64)}`;
const preview = (state: string, reason: string | null) => {
  const value = { schema_version: "website_atlas_preview.v1", capture_id: "walkthrough-x", revision: 2, state, reason,
    updated_at_epoch: 1, bundle: null, splat_available: false, mesh_available: false, claim_ceiling: "development_only",
    scale_status: "unscaled_provider_world_units" };
  return { ...value, preview_digest: crossRuntimeArtifactDigest(value, "preview_digest") } as never;
};
const card = (state: string, reason: string | null) => outcome.projectAtlasPreparationOutcome(preview(state, reason))!;

describe("U1: too few sharp, still frames", () => {
  it("asks for a new video, filmed slowly in even light, as the site's step", () => {
    const ask = card("needs_input", "atlas_insufficient_sharp_static_views");
    expect(ask).toMatchObject({ title: outcome.RECAPTURE_TITLE, actionOwner: "site",
      reason: "Too few of the frames in your video are sharp enough for us to rebuild your space: they are too blurred, or too bright or too dark.",
      nextStep: "Please film again slowly, in even light. Then send us the new video." });
    expect(outcome.isRecaptureReason("atlas_insufficient_sharp_static_views")).toBe(true);
  });
});

describe("U2: a room whose size was not measured", () => {
  it("is not a new-video ask: the size is not measured, and a new video is the site's choice", () => {
    expect(outcome.isRecaptureReason("atlas_scale_review_unresolved")).toBe(false);
    const said = card("needs_input", "atlas_scale_review_unresolved");
    expect(said).toMatchObject({ title: "The size of the simulation of your site is not measured", actionOwner: "none" });
    expect(said.nextStep.startsWith("Nothing is needed from you.")).toBe(true);
    expect(said.nextStep).toContain("object of known size");
    expect(`${said.title} ${said.reason} ${said.nextStep}`).not.toMatch(/please film again/i);
  });

  it("a size review waiting on its provider says it is not measured yet, and asks nothing", () => {
    expect(card("needs_input", "atlas_scale_review_waiting_on_provider"))
      .toMatchObject({ title: "We haven't measured the size of the simulation of your site yet", actionOwner: "none" });
  });
});

describe("a video file turned by an angle no phone writes", () => {
  it("asks for the video as the phone recorded it", () => {
    expect(card("needs_input", "atlas_source_rotation_unsupported")).toMatchObject({
      reason: "Your video file is turned at an angle we cannot read.",
      nextStep: "Please film again with your phone and leave the file as it was recorded, without rotating or editing it. Then send us the new video." });
  });
});

describe("money: the account's monthly spend check", () => {
  it.each(["account_monthly_spend_limit_reached", "account_monthly_spend_journal_unreadable", "account_monthly_spend_report_stale",
    "account_monthly_spend_limit_not_configured", "account_monthly_spend_a_later_check", "gcp_monthly_budget_admission_blocked",
    "gcp_monthly_budget_report_missing_or_invalid"])("%s is a money wait the site need not act on", reason => {
    for (const state of ["needs_input", "failed"]) expect(card(state, reason)).toMatchObject({
      title: "Your job is paused on our side", reason: "Your job is paused on our side for a spending limit.",
      nextStep: "It resumes by itself; nothing is needed from you.", actionOwner: "none" });
  });

  it("the scene's account_limit_wait is said the same, under either wait kind", () => {
    for (const kind of ["setup_repair", "awaiting_site"] as const)
      expect(sceneWaitMessage({ kind, reasonCode: "account_limit_wait" })).toEqual({ operatorAction: null,
        headline: "Your job is paused on our side for a spending limit. It resumes by itself; nothing is needed from you." });
  });

  it("staff see it as a money stop, from the scene wait or the Atlas preview", () => {
    const record = { website_atlas_previews: { "walkthrough-x": preview("needs_input", "account_monthly_spend_report_stale") } };
    expect(accountLimitReason(record, "walkthrough-x", null)).toBe("account_monthly_spend_report_stale");
    expect(accountLimitStop("account_monthly_spend_report_stale")).toMatchObject({ key: "money-account_limit", whose: "blueprint",
      text: "Paid work on this job waits: the account's spend report is out of date, so its monthly limit refuses new spend." });
    const scene = { state: "waiting", sceneOutcome: { kind: "setup_repair", terminal: false, reasonCode: "account_limit_wait", digest } } as never;
    expect(accountLimitReason({}, "walkthrough-x", scene)).toBe("account_limit_wait");
    expect(accountLimitStop("account_monthly_spend_new_code").text).toContain("account monthly spend new code");
    expect(accountLimitReason({ website_atlas_previews: { "walkthrough-x": preview("needs_input", "atlas_context_field_of_view_lost") } },
      "walkthrough-x", null)).toBeNull();
  });
});

describe("a stop the Pipeline runs again by itself is titled as still being worked on", () => {
  it("an Atlas job parked on a reason with no words and no wall: reopened by the clock", () => {
    expect(card("needs_input", "atlas_context_field_of_view_lost")).toMatchObject({ title: "We're still working on your job",
      reason: "A step on our side stopped before it finished. We will try it again by ourselves." });
  });

  it("an Atlas job ended failed, or parked on a wall, is said as stopped", () => {
    expect(card("failed", "atlas_preview_expired").title).toBe(outcome.PROCESSING_FAILURE_SENTENCES.title);
    expect(card("needs_input", "website_atlas_some_consent_gate").title).toBe(outcome.PROCESSING_FAILURE_SENTENCES.title);
  });

  const base = { stage: null, missingViews: [], briefDrafted: true, briefConfirmed: true, hasStoredCapture: true } as never;
  const status = (state: string, extra: Record<string, unknown> = {}) => ({ state, terminalReason: null, outcome: null, question: null,
    robotFit: null, robotFitPrecheck: null, correlationId: null, ...extra });

  it("a preparation failed_retryable reads as still being worked on; failed_terminal as stopped", () => {
    expect(projectTaskStatus({ ...base as object, preparationStatus: status("failed_retryable") } as never).outcome?.title)
      .toBe("We're still working on your job");
    expect(projectTaskStatus({ ...base as object, preparationStatus: status("failed_terminal") } as never).outcome?.title)
      .toBe(outcome.PROCESSING_FAILURE_SENTENCES.title);
  });

  it("a parked Atlas card becomes final once the preparation has ended", () => {
    const parked = card("needs_input", "atlas_context_field_of_view_lost");
    expect(projectTaskStatus({ ...base as object, preparationStatus: status("failed_retryable"), preparationOutcome: parked } as never)
      .outcome?.title).toBe("We're still working on your job");
    expect(projectTaskStatus({ ...base as object, preparationStatus: status("failed_terminal"), preparationOutcome: parked } as never)
      .outcome?.title).toBe(outcome.PROCESSING_FAILURE_SENTENCES.title);
  });
});

describe("nothing asks the site for permission it has no control to give", () => {
  it("Blueprint's own setup is said as ours; a rights refusal as not covered", () => {
    for (const reason of ["website_atlas_consent_unconfigured", "website_scene_grant_policy_unconfigured", "provider_terms_not_configured_or_changed",
      "website_atlas_reservation_summary_too_large", "website_atlas_accounting_response_too_large",
      // Round 3: the scene planner's review refused by the part that failed; the old combined code too.
      "atlas_scene_planner_unsafe_frames_invalid", "atlas_scene_planner_required_views_outside_selection",
      "atlas_scene_planner_required_view_unsafe", "atlas_scene_planner_anchor_not_required",
      "atlas_scene_planner_task_or_room_coverage_missing", "atlas_scene_planner_coverage_or_privacy_invalid",
      // Round 4: the generated gap views' review, and the record that the job went on without them.
      "atlas_completion_visual_review_required", "atlas_completion_floor_record_invalid",
      // Round 5: a step ended past its time limit each time it was tried.
      "atlas_preview_step_interrupted"])
      expect(card("needs_input", reason)).toMatchObject({ title: "Building the simulation of your site is paused on our side", actionOwner: "blueprint" });
    for (const reason of ["website_atlas_source_consent_required", "website_atlas_planner_consent_required", "website_atlas_consent_expired"])
      expect(card("needs_input", reason)).toMatchObject({ reason: "The permission on record for your video does not cover this step.", actionOwner: "none" });
  });

  it("the scene's waits on consent and on the description ask nothing of the site", () => {
    for (const reasonCode of ["site_consent_required", "task_brief_required"]) {
      const wait = sceneWaitMessage({ kind: "awaiting_site", reasonCode })!;
      expect(wait.operatorAction).toBeNull();
      expect(wait.headline).not.toMatch(/confirm permission|waiting for a description|waiting for you/i);
    }
  });
});

describe("codes", () => {
  it("the retries-spent outcome's category is known: no false unknown-category alert", () => {
    const spent = { reason: "website_preparation_retries_spent", category: "processing_failure", basis: "execution_failure",
      robot_id: null, evidence_digest: digest };
    expect(unknownPreparationCodes({ schema_version: "website_preparation_status.v7", state: "failed_retryable", terminal_reason: null,
      outcome: spent, question: null, robot_fit: null, robot_fit_precheck: null } as never)).toEqual([]);
  });

  it("a step ended past its time limit each time it was tried is ours, also once the job has ended", () => {
    const ended = card("failed", "atlas_preview_step_interrupted");
    expect(ended).toMatchObject({ title: "Building the simulation of your site is paused on our side", actionOwner: "blueprint",
      nextStep: "Nothing is needed from you. Your video is saved." });
    // Only that code is said as ours once ended: another pause's code on an ended job keeps the general card.
    expect(card("failed", "atlas_scene_planner_unsafe_frames_invalid").title).not.toBe(ended.title);
  });

  it("an Atlas reason is known only when it has words of its own", () => {
    for (const reason of ["atlas_insufficient_sharp_static_views", "atlas_scale_review_unresolved", "account_monthly_spend_limit_reached",
      "website_atlas_consent_unconfigured", "website_task_not_named", "atlas_scene_planner_abstained", "spending_cap_reached", null,
      "atlas_source_rotation_unsupported", "gcp_monthly_budget_admission_blocked", "website_atlas_accounting_response_too_large",
      "atlas_scene_planner_task_or_room_coverage_missing", "atlas_scene_planner_coverage_or_privacy_invalid",
      "atlas_completion_visual_review_required", "atlas_completion_floor_record_invalid", "atlas_preview_step_interrupted",
      // The sweep of the Pipeline's codes (2026-11-24): the worker's own end is said with the general card on purpose.
      "atlas_preview_expired"])
      expect(outcome.atlasPreviewReasonKnown(reason)).toBe(true);
    // Raised in the Atlas lane but on none of the lists the Pipeline sends (`contracts/pipeline/website-pipeline-codes.v1.json`):
    // said with the general card, and alerted.
    for (const reason of ["atlas_context_field_of_view_lost", "atlas_context_pixel_axes_changed", "atlas_a_code_no_release_sends"])
      expect(outcome.atlasPreviewReasonKnown(reason)).toBe(false);
  });

  it("an owner's closing of the run answers 409 on the creator-capture control route, never 503", () => {
    for (const code of ["website_run_closed_by_owner", "website_run_capture_superseded", "website_atlas_consent_unconfigured",
      "website_scene_grant_policy_unconfigured"])
      expect(creatorCaptureControlRefusal(code)).toEqual({ status: 409, code });
    expect(creatorCaptureControlRefusal("anything_else")).toEqual({ status: 503, code: "website_scene_sponsorship_unavailable" });
  });
});
