// @vitest-environment node
import { describe, expect, it } from "vitest";
import vector from "./fixtures/website-preparation-revision.v1.json";
import { websitePreparationRevision, websitePreparationCaptureId } from "../utils/websitePreparationRevision";

describe("same-job prepared derivative identity", () => {
  it("reads the exact Python identity and retains the original capture", () => {
    expect(websitePreparationRevision(vector.original)).toBeNull();
    expect(websitePreparationCaptureId(vector.corrected)).toBe(vector.original.submission_id);
    expect(websitePreparationRevision(vector.corrected)?.corrections_digest).toBe(`sha256:${"a".repeat(64)}`);
    expect(vector.corrected.execution).toEqual(vector.original.execution);
    expect(vector.corrected.consent).toEqual(vector.original.consent);
  });
  it.each(["capture_id", "corrections_digest", "purpose", "submission_id"])("refuses a changed %s", field => {
    const value: any = structuredClone(vector.corrected);
    if (field === "purpose") delete value.execution.purpose;
    else if (field === "submission_id") value.submission_id = "forged";
    else value.task.subject.website_preparation_revision[field] = "forged";
    expect(() => websitePreparationRevision(value)).toThrow("website_scene_preparation_revision_invalid");
  });
});
