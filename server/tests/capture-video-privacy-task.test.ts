import { describe, expect, it } from "vitest";
import { captureVideoPrivacyOutputSchema, captureVideoPrivacyTask } from "../agents/tasks/capture-video-privacy";
import { siteVideoEvidenceTask } from "../agents/tasks/site-video-evidence";
import { captureCoverageTask } from "../agents/tasks/capture-coverage";

describe("upload-time video privacy task", () => {
  it("asks only the privacy question with static video and no person descriptions", () => {
    expect(captureVideoPrivacyTask.video_processing_mode).toBe("STATIC");
    const prompt = captureVideoPrivacyTask.build_prompt({ taskVideoUrl: "https://example.com/video.mov" });
    expect(prompt).toContain("identifiable people");
    expect(prompt).toContain("uncertain");
    expect(prompt).not.toContain("cycleTime");
    expect(prompt).not.toContain("gateOptions");
  });

  it("keeps the later interpretation and coverage schemas while avoiding agentic tool exhaustion", () => {
    expect(siteVideoEvidenceTask.video_processing_mode).toBe("STATIC");
    expect(siteVideoEvidenceTask.video_sampling_fps).toBe(2);
    expect(captureCoverageTask.video_processing_mode).toBe("STATIC");
    expect(captureCoverageTask.video_sampling_fps).toBe(2);
    expect(siteVideoEvidenceTask.output_schema).not.toBe(captureVideoPrivacyOutputSchema);
  });

  it("requires a bounded explicit decision and rejects unsupported claims", () => {
    expect(captureVideoPrivacyOutputSchema.safeParse({ decision: "clear", evidence_seconds: [] }).success).toBe(true);
    expect(captureVideoPrivacyOutputSchema.safeParse({ decision: "clear" }).success).toBe(false);
    expect(captureVideoPrivacyOutputSchema.safeParse({ decision: "clear", evidence_seconds: [],
      person_name: "private" }).success).toBe(false);
  });
});
