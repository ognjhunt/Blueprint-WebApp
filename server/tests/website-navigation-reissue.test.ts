// @vitest-environment node
/**
 * A navigation intake re-issued for the same capture keeps its capture.
 *
 * The library-aisle job (capture-5b067498, 2026-11-08): its splat was rebuilt, so the Pipeline derived its
 * scene half again from the new Atlas result. This route and the Pipeline intake keep one intake per
 * submission, so the new scene half's intake is the capture's intake re-issued under its own, deterministic
 * submission. This side must read the identical identity (shared vector) so the new intake stays in the
 * capture's job and limits.
 */
import { describe, expect, it } from "vitest";
import vector from "./fixtures/website-navigation-reissue.v1.json";
import { crossRuntimeDigest } from "../utils/crossRuntimeCanonical";
import { navigationIntakeTask } from "../utils/navigationSceneIntake";
import { websiteNavigationReissue, websitePreparationCaptureId, websitePreparationRenewal, websitePreparationRevision,
  WEBSITE_NAVIGATION_REISSUE, WEBSITE_PREPARATION_REVISION } from "../utils/websitePreparationRevision";

describe("re-issued navigation intake identity", () => {
  it("reads the exact Python identity and keeps the original capture", () => {
    expect(websiteNavigationReissue(vector.original)).toBeNull();
    expect(websiteNavigationReissue(vector.reissued)).toEqual({ capture_id: vector.original.submission_id,
      parent_submission_id: vector.original.submission_id, atlas_result_digest: `sha256:${"a".repeat(64)}` });
    expect(websiteNavigationReissue(vector.reissued_again)?.parent_submission_id).toBe(vector.reissued.submission_id);
    expect(websitePreparationCaptureId(vector.original)).toBe(vector.original.submission_id);
    expect(websitePreparationCaptureId(vector.reissued)).toBe(vector.original.submission_id);
    expect(websitePreparationCaptureId(vector.reissued_again)).toBe(vector.original.submission_id);
    expect(websitePreparationRevision(vector.reissued)).toBeNull();
    expect(websitePreparationRenewal(vector.reissued)).toBeNull();
    const { submission_id: _submission, ...body } = vector.reissued;
    expect(vector.reissued.submission_id).toBe(`website-reissue-${crossRuntimeDigest(body).slice(7)}`);
    // The strict navigation task accepts the marker, and only as the identity shapes it.
    expect(navigationIntakeTask.safeParse(vector.reissued.task).success).toBe(true);
    expect(navigationIntakeTask.safeParse({ ...vector.reissued.task,
      [WEBSITE_NAVIGATION_REISSUE]: { ...vector.reissued.task[WEBSITE_NAVIGATION_REISSUE], note: "x" } }).success).toBe(false);
    // The re-issue keeps the capture's consent: a confirmed brief, exactly as the original carries it.
    expect(vector.reissued.consent).toEqual(vector.original.consent);
    expect(vector.reissued.execution).toEqual(vector.original.execution);
  });
  it.each(["capture_id", "parent", "submission_id", "purpose", "policies", "atlas_result", "prefix_without_field",
    "extra_key", "rigid_task", "with_revision", "changed_scene", "null_marker"])("refuses a changed %s", forgery => {
    const value: any = structuredClone(vector.reissued);
    const field = value.task[WEBSITE_NAVIGATION_REISSUE];
    if (forgery === "capture_id") field.capture_id = "other-capture";
    else if (forgery === "parent") field.parent_submission_id = "someone-else";
    else if (forgery === "submission_id") value.submission_id = `website-reissue-${"0".repeat(64)}`;
    else if (forgery === "purpose") value.execution.purpose = "evaluation";
    else if (forgery === "policies") value.execution.policy_candidates = ["policy-a"];
    else if (forgery === "atlas_result") field.atlas_result_digest = "atlas-result";
    else if (forgery === "prefix_without_field") delete value.task[WEBSITE_NAVIGATION_REISSUE];
    else if (forgery === "extra_key") field.note = "x";
    else if (forgery === "rigid_task") value.task.strategy = "pick_and_place";
    else if (forgery === "with_revision") value.task.subject = { [WEBSITE_PREPARATION_REVISION]: {
      capture_id: field.capture_id, corrections_digest: `sha256:${"a".repeat(64)}` } };
    else if (forgery === "changed_scene") value.task.scene_revision_digest = `sha256:${"9".repeat(64)}`;
    else value.task[WEBSITE_NAVIGATION_REISSUE] = null;
    expect(() => websitePreparationCaptureId(value)).toThrow(/website_scene_(navigation_reissue|preparation_revision)_invalid/);
  });
});
