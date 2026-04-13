// @vitest-environment node
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0, tempDirs.length).map((dir) =>
      fs.rm(dir, { recursive: true, force: true }),
    ),
  );
});

describe("city launch planning state", () => {
  it("reports in_progress when partial artifacts exist without a final playbook", async () => {
    const reportsRoot = await fs.mkdtemp(path.join(os.tmpdir(), "city-launch-planning-state-"));
    tempDirs.push(reportsRoot);

    const runDirectory = path.join(
      reportsRoot,
      "testopolis-zz",
      "2026-04-13T15-16-09.890Z",
    );
    await fs.mkdir(runDirectory, { recursive: true });
    await fs.writeFile(path.join(runDirectory, "01-initial-research.md"), "# partial", "utf8");

    const { resolveCityLaunchPlanningState } = await import("../utils/cityLaunchPlanningState");
    const result = await resolveCityLaunchPlanningState({
      city: "Testopolis, ZZ",
      reportsRoot,
    });

    expect(result.status).toBe("in_progress");
    expect(result.latestArtifactPath).toContain("01-initial-research.md");
    expect(result.completedArtifactPath).toBeNull();
  });
});
