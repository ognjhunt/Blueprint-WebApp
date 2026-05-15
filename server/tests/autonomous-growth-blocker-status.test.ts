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
  const buyerLoopDir = path.join(
    repoRoot,
    "ops/paperclip/reports/exact-site-hosted-review-buyer-loop/global/2026-05-05",
  );
  const playbooksDir = path.join(repoRoot, "ops/paperclip/playbooks");
  const companyDir = path.join(repoRoot, "ops/paperclip/blueprint-company");
  await fs.mkdir(runDir, { recursive: true });
  await fs.mkdir(buyerLoopDir, { recursive: true });
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
  await fs.writeFile(
    path.join(buyerLoopDir, "buyer-loop-manifest.json"),
    JSON.stringify(
      {
        schema: "blueprint/exact-site-hosted-review-buyer-loop/v1",
        reportDate: "2026-05-05",
        city: null,
        ledgerPath: "ops/paperclip/playbooks/exact-site-hosted-review-gtm-ledger.json",
        summary: {
          targetRows: 12,
          recipientBackedTargets: 0,
          approvalReadyTargets: 0,
          sentTargets: 0,
          replies: 0,
          hostedReviewStarts: 0,
          openBlockers: 26,
          paperclipLinkedBlockers: 26,
          loopStatus: "blocked",
          durabilityStatus: "blocked",
        },
        auditStatus: "blocked",
        auditFindings: [
          {
            severity: "error",
            path: "targets.recipient",
            message: "Active pilot has target rows but no recipient-backed contacts; live sends remain blocked on explicit contact evidence.",
          },
        ],
      },
      null,
      2,
    ),
  );
  await fs.writeFile(
    path.join(buyerLoopDir, "buyer-loop.md"),
    "# Exact-Site Hosted Review Buyer Loop\n\n| Recipient-backed targets | 0 |\n",
  );
  await fs.writeFile(
    path.join(repoRoot, "ops/paperclip/reports/human-blocker-exact-site-recipient-evidence-2026-05-05.md"),
    [
      "# Blocker Title",
      "",
      "Exact-Site buyer loop recipient evidence is missing.",
      "",
      "# Blocker Id",
      "",
      "`human-blocker:exact-site-recipient-evidence:2026-05-05`",
    ].join("\n"),
  );

  return repoRoot;
}

describe("autonomous growth blocker status", () => {
  it("keeps the Paperclip bridge issue blocked when the report is blocked", async () => {
    const {
      autonomousGrowthBridgeIssueStatus,
      shouldRefreshAutonomousGrowthBridgeIssue,
    } = await import("../utils/autonomousGrowthBlockerStatus");

    expect(autonomousGrowthBridgeIssueStatus("blocked")).toBe("blocked");
    expect(autonomousGrowthBridgeIssueStatus("gated")).toBe("todo");
    expect(autonomousGrowthBridgeIssueStatus("clear")).toBe("todo");
    expect(
      shouldRefreshAutonomousGrowthBridgeIssue({
        existingIssue: { id: "issue-1", status: "blocked" },
        desiredStatus: "blocked",
      }),
    ).toBe(false);
    expect(
      shouldRefreshAutonomousGrowthBridgeIssue({
        existingIssue: { id: "issue-1", status: "blocked" },
        desiredStatus: "blocked",
        force: true,
      }),
    ).toBe(true);
    expect(
      shouldRefreshAutonomousGrowthBridgeIssue({
        existingIssue: { id: "issue-1", status: "todo" },
        desiredStatus: "blocked",
      }),
    ).toBe(true);
    expect(
      shouldRefreshAutonomousGrowthBridgeIssue({
        existingIssue: {
          id: "issue-1",
          status: "blocked",
          description: "- blocker_fingerprint: old",
        },
        desiredStatus: "blocked",
        desiredFingerprint: "new",
      }),
    ).toBe(true);
    expect(
      shouldRefreshAutonomousGrowthBridgeIssue({
        existingIssue: {
          id: "issue-1",
          status: "blocked",
          description: "- blocker_fingerprint: new",
        },
        desiredStatus: "blocked",
        desiredFingerprint: "new",
      }),
    ).toBe(false);
  });

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
        const url = new URL(href);
        if (url.searchParams.has("q")) {
          return Response.json([
            {
              id: "new-bridge-issue",
              identifier: "BLU-691",
              title: "Autonomous growth blocker bridge: Durham, NC",
              status: "blocked",
              createdAt: "2026-05-06T00:05:21.882Z",
            },
            {
              id: "bridge-issue",
              identifier: "BLU-46",
              title: "Autonomous growth blocker bridge: Durham, NC",
              status: "blocked",
              createdAt: "2026-04-24T14:57:27.166Z",
            },
          ]);
        }
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
    expect(report.paperclip.publicBridgeIssue?.identifier).toBe("BLU-46");
    expect(report.blockers.find((entry) => entry.key === "buyer_recipient_evidence")?.status)
      .toBe("human_gated");
    const exactSiteBlocker = report.blockers.find((entry) => entry.key === "exact_site_buyer_loop_recipient_evidence");
    expect(exactSiteBlocker?.status).toBe("blocked");
    expect(report.blockers[0]?.key).toBe("exact_site_buyer_loop_recipient_evidence");
    expect(exactSiteBlocker?.stageReached).toContain("recipientBackedTargets=0");
    expect(exactSiteBlocker?.nextAction).toContain("BLUEPRINT_GTM_HUMAN_RECIPIENT_EVIDENCE_PATH");
    expect(exactSiteBlocker?.nextAction).toContain("--human-recipient-evidence-path");
    expect(exactSiteBlocker?.evidence).toEqual(
      expect.arrayContaining([
        expect.stringContaining("buyer-loop-manifest.json"),
        expect.stringContaining("human-blocker-exact-site-recipient-evidence-2026-05-05.md"),
        expect.stringContaining("targets.recipient"),
      ]),
    );
    expect(report.blockers.find((entry) => entry.key === "city_live_signal")?.status)
      .toBe("external_gated");
  });

  it("does not treat parked contact-enrichment rows as launch-ready buyer recipient evidence", async () => {
    const repoRoot = await writeFixtureRepo();
    const playbooksDir = path.join(repoRoot, "ops/paperclip/playbooks");
    await fs.writeFile(
      path.join(playbooksDir, "city-launch-durham-nc-contact-enrichment.json"),
      JSON.stringify(
        {
          status: "enriched",
          recovered_buyer_target_contacts: 2,
          unresolved_buyer_targets: [],
          buyer_target_candidates: [
            {
              company_name: "BotBuilt",
              contact_email: "info@botbuilt.com",
              notes: "Keep as a researched buyer candidate only until recipient-backed contact and exact site demand are verified.",
            },
            {
              company_name: "ROI Industries",
              contact_email: "info@roiindustries.com",
              notes: "Do not treat the generic ROI inbox as launch-ready buyer evidence.",
            },
          ],
        },
        null,
        2,
      ),
    );
    const { buildAutonomousGrowthBlockerStatus } = await import("../utils/autonomousGrowthBlockerStatus");
    const report = await buildAutonomousGrowthBlockerStatus({
      repoRoot,
      city: "Durham, NC",
      publicPaperclipApiUrl: "https://public.example",
      localPaperclipApiUrl: "https://local.example",
      fetchImpl: vi.fn(async () => Response.json([])) as unknown as typeof fetch,
    });

    const buyerBlocker = report.blockers.find((entry) => entry.key === "buyer_recipient_evidence");
    expect(buyerBlocker?.status).toBe("blocked");
    expect(buyerBlocker?.stageReached).toContain("launchReadyBuyerTargetContacts=0");
    expect(buyerBlocker?.stageReached).toContain("artifactRecoveredBuyerTargetContacts=2");
    expect(buyerBlocker?.stageReached).toContain("unresolvedBuyerTargets=2");
    expect(buyerBlocker?.why).toContain("explicit launch-ready recipient evidence");
  });

  it("renders blocker reports with retry conditions and proof paths in the dashboard table", async () => {
    const repoRoot = await writeFixtureRepo();
    const {
      buildAutonomousGrowthBlockerStatus,
      renderAutonomousGrowthBlockerMarkdown,
    } = await import("../utils/autonomousGrowthBlockerStatus");
    const report = await buildAutonomousGrowthBlockerStatus({
      repoRoot,
      city: "Durham, NC",
      publicPaperclipApiUrl: "https://public.example",
      localPaperclipApiUrl: "https://local.example",
      fetchImpl: vi.fn(async () => Response.json([])) as unknown as typeof fetch,
    });

    const markdown = renderAutonomousGrowthBlockerMarkdown(report);

    expect(markdown).toContain("| Blocker | Status | Owner | Retry / resume condition | Proof paths | Next action |");
    expect(markdown).toContain("Retry after `npm run gtm:recipient-evidence:validate");
    expect(markdown).toContain("buyer-loop-manifest.json");
    expect(markdown).toContain("- retry_resume_condition:");
    expect(markdown).toContain("- proof_paths:");
  });
});
