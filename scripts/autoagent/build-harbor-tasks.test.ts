import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { runBuild } from "./build-harbor-tasks.ts";

const tempRoots: string[] = [];

async function makeTempDir() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-harbor-build-"));
  tempRoots.push(dir);
  return dir;
}

async function writeCaseFixture(
  root: string,
  laneDir: string,
  split: string,
  caseId: string,
  files: Record<string, unknown>,
) {
  const caseDir = path.join(root, laneDir, "cases", split, caseId);
  await fs.mkdir(caseDir, { recursive: true });
  for (const [name, payload] of Object.entries(files)) {
    await fs.writeFile(path.join(caseDir, name), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  }
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("build harbor tasks", () => {
  it("generates Harbor task directories from exported fixtures", async () => {
    const inputRoot = await makeTempDir();
    const outputRoot = await makeTempDir();

    await writeCaseFixture(inputRoot, "waitlist-triage", "dev", "waitlist_triage-case-1", {
      "input.json": { submission: { id: "case-1" }, market_context: {} },
      "expected.json": {
        automation_status: "completed",
        recommendation: "invite_now",
        recommended_queue: "capturer_beta_invite_review",
        requires_human_review: false,
      },
      "labels.json": {
        risk_tier: "low",
      },
      "source.json": {
        collection: "waitlistSubmissions",
      },
    });

    const summaries = await runBuild({
      inputRoot,
      outputRoot,
      lanes: ["waitlist_triage"],
      overwrite: true,
    });

    expect(summaries[0]).toEqual({
      lane: "waitlist_triage",
      generated: 1,
      skipped: 0,
    });

    const taskRoot = path.join(
      outputRoot,
      "waitlist-triage",
      "dev",
      "waitlist_triage-case-1",
    );
    const instruction = await fs.readFile(path.join(taskRoot, "instruction.md"), "utf8");
    const verifier = await fs.readFile(path.join(taskRoot, "tests", "test.py"), "utf8");
    const taskToml = await fs.readFile(path.join(taskRoot, "task.toml"), "utf8");
    const inputCopy = await fs.readFile(path.join(taskRoot, "files", "input.json"), "utf8");

    expect(instruction).toContain("result.json");
    expect(verifier).toContain("REQUIRED_FIELDS");
    expect(verifier).toContain("unsafe_auto_clear");
    expect(verifier).toContain("wrong_queue");
    expect(verifier).toContain("weighted_checks");
    expect(taskToml).toContain("blueprint/waitlist_triage/dev/waitlist_triage-case-1");
    expect(JSON.parse(inputCopy)).toEqual({ submission: { id: "case-1" }, market_context: {} });
  });
});
