import { describe, expect, it } from "vitest";
import {
  captureGroundedBlockedClaims,
  captureGroundedPublicCopy,
  captureGroundedRequiredSignals,
  captureGroundedTruthLabels,
} from "@/lib/captureGroundedLanguage";

describe("captureGroundedLanguage", () => {
  it("defines ground truth from capture and owner-system evidence", () => {
    const definition = captureGroundedPublicCopy.groundTruthDefinition.toLowerCase();

    for (const signal of captureGroundedRequiredSignals) {
      const normalizedSignal = signal
        .replace("timestamps and poses", "timestamps, poses")
        .replace("runtime artifacts when available", "runtime artifacts")
        .toLowerCase();
      expect(definition).toContain(normalizedSignal);
    }

    expect(definition).toContain("raw capture evidence");
    expect(definition).toContain("rights and privacy records");
    expect(definition).toContain("package artifacts");
    expect(definition).toContain("runtime artifacts");
  });

  it("keeps support signals out of operational proof", () => {
    const boundary = captureGroundedPublicCopy.supportSignalBoundary.toLowerCase();

    expect(boundary).toContain("samples");
    expect(boundary).toContain("generated previews");
    expect(boundary).toContain("dry-run commerce");
    expect(boundary).toContain("support signals");
    for (const claim of captureGroundedBlockedClaims) {
      expect(boundary).toContain(claim.toLowerCase());
    }
  });

  it("preserves Public Launch Ready posture without apology language", () => {
    expect(captureGroundedPublicCopy.publicLaunchReadyBoundary).toContain("polished and present-tense");
    expect(captureGroundedPublicCopy.publicLaunchReadyBoundary).toContain("confirmed per site/request");
    expect(captureGroundedPublicCopy.publicLaunchReadyBoundary).not.toMatch(/coming soon|not launched|not ready|placeholder/i);
  });

  it("names machine-readable truth labels used by public agent surfaces", () => {
    expect(captureGroundedTruthLabels).toEqual(
      expect.arrayContaining(["capture_grounded", "provider_derived", "generated", "sample_demo", "request_gated"]),
    );
  });
});
