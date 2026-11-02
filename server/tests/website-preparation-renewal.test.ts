// @vitest-environment node
/**
 * A completed preparation re-issued under a renewed grant keeps its capture.
 *
 * capture-447ae4f4 (2026-11-02): the sponsor renewed an expired grant after a
 * revoked intent. The Pipeline re-issues the completed preparation under a new,
 * deterministic submission id; this side must read the identical identity
 * (shared vector) so the new intake stays in the capture's job and limits.
 */
import { describe, expect, it } from "vitest";
import vector from "./fixtures/website-preparation-renewal.v1.json";
import { websitePreparationCaptureId, websitePreparationRenewal, websitePreparationRevision,
  WEBSITE_PREPARATION_RENEWAL, WEBSITE_PREPARATION_REVISION } from "../utils/websitePreparationRevision";

describe("renewed preparation identity", () => {
  it("reads the exact Python identity and keeps the original capture", () => {
    expect(websitePreparationRenewal(vector.original)).toBeNull();
    expect(websitePreparationRenewal(vector.renewed)).toEqual({ capture_id: vector.original.submission_id,
      parent_submission_id: vector.original.submission_id });
    expect(websitePreparationRenewal(vector.renewed_again)?.parent_submission_id).toBe(vector.renewed.submission_id);
    expect(websitePreparationCaptureId(vector.renewed)).toBe(vector.original.submission_id);
    expect(websitePreparationCaptureId(vector.renewed_again)).toBe(vector.original.submission_id);
    expect(websitePreparationRevision(vector.renewed)).toBeNull();
  });
  it.each(["capture_id", "parent", "submission_id", "purpose", "policies", "prefix_without_field", "extra_key",
    "with_revision"])("refuses a changed %s", forgery => {
    const value: any = structuredClone(vector.renewed);
    const field = value.task.subject[WEBSITE_PREPARATION_RENEWAL];
    if (forgery === "capture_id") field.capture_id = "other-capture";
    else if (forgery === "parent") field.parent_submission_id = "someone-else";
    else if (forgery === "submission_id") value.submission_id = `website-renewal-${"0".repeat(64)}`;
    else if (forgery === "purpose") value.execution.purpose = "evaluation";
    else if (forgery === "policies") value.execution.policy_candidates = ["policy-a"];
    else if (forgery === "prefix_without_field") delete value.task.subject[WEBSITE_PREPARATION_RENEWAL];
    else if (forgery === "extra_key") field.note = "x";
    else value.task.subject[WEBSITE_PREPARATION_REVISION] = { capture_id: field.capture_id,
      corrections_digest: `sha256:${"a".repeat(64)}` };
    expect(() => websitePreparationCaptureId(value)).toThrow(/website_scene_preparation_(renewal|revision)_invalid/);
  });
});
