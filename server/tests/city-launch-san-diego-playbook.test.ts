// @vitest-environment node
import { promises as fs } from "node:fs";

import { describe, expect, it } from "vitest";

import { parseCityLaunchResearchArtifact } from "../utils/cityLaunchResearchParser";

describe("San Diego city-launch playbook", () => {
  it("contains a valid machine-readable activation payload", async () => {
    const artifactPath =
      "/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/playbooks/city-launch-san-diego-ca-deep-research.md";
    const markdown = await fs.readFile(artifactPath, "utf8");

    const parsed = parseCityLaunchResearchArtifact({
      city: "San Diego, CA",
      artifactPath,
      markdown,
    });

    expect(parsed.activationPayload).not.toBeNull();
    expect(parsed.errors).toEqual([]);
    expect(parsed.warnings.join("\n")).not.toContain("Contract violation");
  });
});
