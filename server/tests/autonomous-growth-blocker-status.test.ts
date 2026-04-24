// @vitest-environment node
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const tempDirs: string[] = [];

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(
    tempDirs.splice(0, tempDirs.length).map((dir) =>
      fs.rm(dir, { recursive: true, force: true }),
    ),
  );
});

async function writeFixtureRepo() {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "autonomous-growth-blockers-"));
  tempDirs.push(repoRoot);
  const runDir = path.join(
    repoRoot,
    "ops/paperclip/reports/city-launch-execution/durham-nc/2026-04-22T21-47-28.818Z",
  );
  const playbooksDir = path.join(repoRoot, "ops/paperclip/playbooks");
  const companyDir = path.join(repoRoot, "ops/paperclip/blueprint-company");
  await fs.mkdir(runDir, { recursive: true });
  await fs.mkdir(playbooksDir, { recursive: true });
  await fs.mkdir(companyDir, { recursive: true });

  await fs.writeFile(
    path.join(companyDir, ".paperclip.yaml"),
    [
      "routines:",
      "  community-updates-weekly:",
      "    status: paused",
      "  city-launch-weekly:",
      "    status: paused",
      "  demand-intel-weekly:",
      "    triggers: []",
      "  robot-team-growth-weekly:",
      "    triggers: []",
      "  site-operator-partnership-weekly:",
      "    triggers: []",
      "  city-demand-weekly:",
      "    triggers: []",
    ].join("\n"),
  );

  await fs.writeFile(
    path.join(runDir, "manifest.json"),
    JSON.stringify(
      {
        city: "Durham, NC",
        citySlug: "durham-nc",
        status: "founder_approved_activation_ready",
        outboundReadiness: {
          directOutreachActions: { sent: 2 },
        },
      },
      null,
      2,
    ),
  );
  await fs.writeFile(
    path.join(playbooksDir, "city-opening-durham-nc-no-signal-scorecard.md"),
    [
      "| Signal | Count / value |",
      "| --- | --- |",
      "| sent direct outreach | 2 |",
      "| sent direct outreach with recipient evidence | 2 |",
      "| recorded responses | 0 |",
      "| routed responses | 0 |",
      "| live supply responses | 0 |",
      "| live buyer/operator engagements | 0 |",
      "| approved capturers | 0 |",
    ].join("\n"),
  );
  await fs.writeFile(
    path.join(playbooksDir, "city-launch-durham-nc-contact-enrichment.json"),
    JSON.stringify(
      {
        status: "enriched",
        recovered_buyer_target_contacts: 2,
        unresolved_buyer_targets: [],
        buyer_target_candidates: [
          { company_name: "BotBuilt", contact_email: "info@botbuilt.com" },
          { company_name: "ROI Industries", contact_email: "info@roiindustries.com" },
        ],
      },
      null,
      2,
    ),
  );

  return repoRoot;
}

describe("autonomous growth blocker status", () => {
  it("downgrades public Paperclip mismatch when a bridge issue exists and keeps buyer sends human-gated", async () => {
    const repoRoot = await writeFixtureRepo();
    const { buildAutonomousGrowthBlockerStatus } = await import("../utils/autonomousGrowthBlockerStatus");
    const fetchImpl = vi.fn(async (url: string | URL) => {
      const href = String(url);
      if (href.includes("public.example") && href.endsWith("/api/companies")) {
        return Response.json([
          { id: "public-company", name: "Blueprint Autonomous Operations", issueCounter: 45 },
        ]);
      }
      if (href.includes("local.example") && href.endsWith("/api/companies")) {
        return Response.json([
          { id: "local-company", name: "Blueprint Autonomous Operations", issueCounter: 4352 },
        ]);
      }
      if (href.includes("/api/companies/public-company/issues?")) {
        return Response.json([]);
      }
      if (href.includes("/api/companies/public-company/issues")) {
        return Response.json([
          {
            id: "bridge-issue",
            identifier: "BLU-46",
            title: "Autonomous growth blocker bridge: Durham, NC",
          },
        ]);
      }
      return Response.json([]);
    }) as unknown as typeof fetch;

    const report = await buildAutonomousGrowthBlockerStatus({
      repoRoot,
      city: "Durham, NC",
      publicPaperclipApiUrl: "https://public.example",
      localPaperclipApiUrl: "https://local.example",
      fetchImpl,
    });

    expect(report.blockers.find((entry) => entry.key === "paperclip_state_sync")?.status)
      .toBe("warning");
    expect(report.blockers.find((entry) => entry.key === "buyer_recipient_evidence")?.status)
      .toBe("human_gated");
    expect(report.blockers.find((entry) => entry.key === "city_live_signal")?.status)
      .toBe("external_gated");
  });
});

