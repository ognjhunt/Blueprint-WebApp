// @vitest-environment node
/**
 * Footage review switched on with no Gemini key would hold every upload in
 * privacy review forever. That configuration has to fail readiness, so a
 * deploy carrying it never replaces a healthy one.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { describeSiteVideoEvidenceConfig } from "../utils/siteVideoEvidenceConfig";

const GEMINI_KEYS = ["GEMINI_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY", "GOOGLE_AI_STUDIO_API_KEY"];

function clearGeminiKeys() {
  for (const key of GEMINI_KEYS) vi.stubEnv(key, "");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("site footage review configuration", () => {
  it("is ready when the lane is off, whatever the keys", () => {
    vi.stubEnv("BLUEPRINT_SITE_VIDEO_EVIDENCE_ENABLED", "");
    clearGeminiKeys();
    expect(describeSiteVideoEvidenceConfig()).toMatchObject({ enabled: false, ready: true });
  });

  it("is not ready when the lane is on and no Gemini key is set, and says what to set", () => {
    vi.stubEnv("BLUEPRINT_SITE_VIDEO_EVIDENCE_ENABLED", "true");
    clearGeminiKeys();
    const config = describeSiteVideoEvidenceConfig();
    expect(config).toMatchObject({ enabled: true, keyed: false, ready: false });
    expect(config.detail).toMatch(/GEMINI_API_KEY/);
  });

  it.each(GEMINI_KEYS)("is ready when the lane is on and %s is set", (key) => {
    vi.stubEnv("BLUEPRINT_SITE_VIDEO_EVIDENCE_ENABLED", "true");
    clearGeminiKeys();
    vi.stubEnv(key, "test-key");
    expect(describeSiteVideoEvidenceConfig()).toMatchObject({ enabled: true, keyed: true, ready: true });
  });

  it("fails the launch readiness snapshot with a named blocker", async () => {
    vi.stubEnv("BLUEPRINT_SITE_VIDEO_EVIDENCE_ENABLED", "true");
    clearGeminiKeys();
    const { buildLaunchReadinessSnapshot } = await import("../utils/launch-readiness");
    const snapshot = buildLaunchReadinessSnapshot();
    expect(snapshot.checks.siteVideoEvidence).toBe(false);
    expect(snapshot.status).toBe("not_ready");
    expect(snapshot.blockers.join("\n")).toMatch(/no Gemini key is set/);
  });

  it("adds no blocker when the lane is off", async () => {
    vi.stubEnv("BLUEPRINT_SITE_VIDEO_EVIDENCE_ENABLED", "");
    const { buildLaunchReadinessSnapshot } = await import("../utils/launch-readiness");
    const snapshot = buildLaunchReadinessSnapshot();
    expect(snapshot.checks.siteVideoEvidence).toBe(true);
    expect(snapshot.blockers.join("\n")).not.toMatch(/Gemini/);
  });
});
