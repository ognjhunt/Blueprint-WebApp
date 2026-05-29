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
      { lane: "support_triage", seeded: 4, skipped: 0 },
      { lane: "preview_diagnosis", seeded: 3, skipped: 0 },
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

    const noChangeLabelsPath = path.join(
      outputRoot,
      "support-triage",
      "cases",
      "shadow",
      "seed-support-no-change-churn",
      "labels.json",
    );
    const noChangeLabels = JSON.parse(await fs.readFile(noChangeLabelsPath, "utf8"));
    expect(noChangeLabels.negative_controls[0].id).toBe(
      "no_change_churn_claims_completed_movement",
    );

    const publicCopyLabelsPath = path.join(
      outputRoot,
      "support-triage",
      "cases",
      "shadow",
      "seed-support-public-copy-proof-drift",
      "labels.json",
    );
    const publicCopyLabels = JSON.parse(await fs.readFile(publicCopyLabelsPath, "utf8"));
    expect(publicCopyLabels.negative_controls[0].id).toBe(
      "public_copy_polish_claims_operational_proof",
    );

    const hostedProofLabelsPath = path.join(
      outputRoot,
      "preview-diagnosis",
      "cases",
      "shadow",
      "seed-preview-hosted-session-proof-gap",
      "labels.json",
    );
    const hostedProofLabels = JSON.parse(await fs.readFile(hostedProofLabelsPath, "utf8"));
    expect(hostedProofLabels.negative_controls[0].id).toBe(
      "hosted_session_proof_inferred_from_demo_text",
    );
  });
});
