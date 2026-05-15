import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { seedCanonicalCases } from "./seed-canonical-cases.ts";

const tempRoots: string[] = [];

async function makeTempDir() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-autoagent-seed-"));
  tempRoots.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("seed canonical cases", () => {
  it("writes curated baseline fixtures for requested lanes", async () => {
    const outputRoot = await makeTempDir();
    const summaries = await seedCanonicalCases({
      lanes: ["waitlist_triage", "support_triage", "preview_diagnosis"],
      outputRoot,
    });

    expect(summaries).toEqual([
      { lane: "waitlist_triage", seeded: 2, skipped: 0 },
      { lane: "support_triage", seeded: 2, skipped: 0 },
      { lane: "preview_diagnosis", seeded: 2, skipped: 0 },
    ]);

    const expectedPath = path.join(
      outputRoot,
      "waitlist-triage",
      "cases",
      "dev",
      "seed-waitlist-strong-fit",
      "expected.json",
    );
    const expected = JSON.parse(await fs.readFile(expectedPath, "utf8"));
    expect(expected.recommendation).toBe("invite_now");

    const previewExpectedPath = path.join(
      outputRoot,
      "preview-diagnosis",
      "cases",
      "dev",
      "seed-preview-provider-escalation",
      "expected.json",
    );
    const previewExpected = JSON.parse(await fs.readFile(previewExpectedPath, "utf8"));
    expect(previewExpected.disposition).toBe("provider_escalation");
  });
});
