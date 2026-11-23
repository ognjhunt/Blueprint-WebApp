// @vitest-environment node
/**
 * /health/ready fails a deploy only on what protects it. The beta cohort check is gone: no code admitted or refused a
 * site by it, and its "kill switch" paused nothing; it only failed deploys.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("launch readiness checks", () => {
  it("keeps every deploy check and has no beta cohort check", async () => {
    const { buildLaunchReadinessSnapshot } = await import("../utils/launch-readiness");
    const before = buildLaunchReadinessSnapshot();
    expect(Object.keys(before.checks).sort()).toEqual(
      ["email", "fieldEncryption", "firebaseAdmin", "pipelineSync", "redis", "server", "siteVideoEvidence", "slackOpsAlerts"],
    );
    expect(before.dependencies).not.toHaveProperty("betaCohortPolicy");

    vi.stubEnv("BLUEPRINT_BETA_KILL_SWITCH", "1");
    vi.stubEnv("BLUEPRINT_BETA_INVITE_CAP", "0");
    const after = buildLaunchReadinessSnapshot();
    expect(after.status).toBe(before.status);
    expect(after.blockers).toEqual(before.blockers);
  });
});
