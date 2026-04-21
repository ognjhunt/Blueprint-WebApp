// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("city launch recipient evidence", () => {
  it("recovers recipient-backed emails from repo artifact evidence", async () => {
    const { resolveRepoArtifactRecipientEvidence } = await import("../utils/cityLaunchRecipientEvidence");
    const matches = await resolveRepoArtifactRecipientEvidence({
      targets: ["Raymond West", "Lineage Logistics"],
    });

    expect(matches.get("raymondwest")?.recipientEmail).toBe("sales@raymondwest.com");
    expect(matches.get("lineagelogistics")?.recipientEmail).toBe("mbeer@sir-robotics.com");
    expect(matches.get("raymondwest")?.source).toContain("issue-updates/");
  });
});
