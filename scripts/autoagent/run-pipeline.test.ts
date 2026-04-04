import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { countGeneratedTasks } from "./run-pipeline.ts";

const tempRoots: string[] = [];

async function makeTempDir() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-autoagent-pipeline-"));
  tempRoots.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("autoagent pipeline helpers", () => {
  it("counts generated Harbor tasks by lane and split", async () => {
    const root = await makeTempDir();
    const dirs = [
      ["waitlist-triage", "dev", "case-1"],
      ["waitlist-triage", "holdout", "case-2"],
      ["support-triage", "shadow", "case-3"],
    ] as const;

    for (const [laneDir, split, caseId] of dirs) {
      await fs.mkdir(path.join(root, laneDir, split, caseId), { recursive: true });
    }

    const counts = await countGeneratedTasks(root, [
      "waitlist_triage",
      "support_triage",
      "preview_diagnosis",
    ]);

    expect(counts.waitlist_triage).toEqual({
      dev: 1,
      holdout: 1,
      shadow: 0,
    });
    expect(counts.support_triage).toEqual({
      dev: 0,
      holdout: 0,
      shadow: 1,
    });
    expect(counts.preview_diagnosis).toEqual({
      dev: 0,
      holdout: 0,
      shadow: 0,
    });
  });
});
