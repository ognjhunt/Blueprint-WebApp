// @vitest-environment node
import { execFile as execFileCallback } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFile = promisify(execFileCallback);

describe("GTM first-send approval template CLI", () => {
  it("reports recipient, proof, reply-durability, and approval blockers in dry-run output", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-gtm-approval-"));
    const ledgerPath = path.join(tempDir, "ledger.json");
    const outputPath = path.join(tempDir, "approval.template.json");
    const packetPath = path.join(tempDir, "approval-packet.md");
    const ledger = {
      schema: "blueprint/exact-site-hosted-review-gtm-ledger/v1",
      pilot: {
        name: "Blueprint uses Blueprint to sell Blueprint",
        wedge: "Exact-Site Hosted Review",
        startDate: "2026-04-27",
        endDate: "2026-05-10",
        status: "active",
        dailyTouchTargetMin: 1,
        dailyTouchTargetMax: 50,
        paidScaleAllowed: false,
      },
      targets: [
        {
          id: "target-1",
          track: "proof_ready_outreach",
          organizationName: "Robot Team",
          buyerSegment: "Warehouse autonomy team",
          workflowNeed: "Inspect an exact warehouse route before deployment planning.",
          intentSignals: ["Public deployment signal."],
          evidence: { summary: "Real target evidence." },
          artifact: {
            type: "exact_site_hosted_review",
            status: "review_ready",
            path: "client/public/samples/sample-hosted-review-report.md",
            hostedReviewPath: "/sample-evaluation",
            siteWorldId: "site-world-1",
          },
          recipient: {
            email: "buyer@robotteam.co",
            evidenceSource: "Human-supplied target sheet with explicit recipient evidence.",
            evidenceType: "human_supplied",
          },
          outbound: {
            status: "draft_ready",
            approvalState: "pending_first_send_approval",
            messagePath: "ops/paperclip/playbooks/exact-site-hosted-review-first-touch-drafts.md",
          },
          blockers: [
            {
              id: "gtm-blocker-buyer-reply-durability",
              status: "blocked",
              summary: "Buyer sends and replies cannot be treated as production-durable.",
              owner: "growth-lead",
              nextAction: "Set sender verification and Gmail watcher credentials before counting live replies as durable.",
              paperclipIssueIdentifier: "BLU-5393",
            },
          ],
          paperclipIssues: [
            {
              identifier: "BLU-5393",
              status: "blocked",
              blockerIds: ["gtm-blocker-buyer-reply-durability"],
            },
          ],
        },
      ],
      dailyActivity: [],
    };

    await fs.writeFile(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");

    try {
      const { stdout } = await execFile(
        path.join(process.cwd(), "node_modules/.bin/tsx"),
        [
          path.join(process.cwd(), "scripts/gtm/write-first-send-approval-template.ts"),
          "--ledger",
          ledgerPath,
          "--output",
          outputPath,
          "--packet-output",
          packetPath,
        ],
        { cwd: process.cwd(), maxBuffer: 1024 * 1024 },
      );

      expect(stdout).toContain("- mode: dry_run");
      expect(stdout).toContain("- approval_rows: 1");
      expect(stdout).toContain("- recipient_backed_targets: 1");
      expect(stdout).toContain("- proof_ready_outreach_rows: 1");
      expect(stdout).toContain("- demand_sourced_capture_rows: 0");
      expect(stdout).toContain("- proof_source_rows: 1");
      expect(stdout).toContain("- reply_durability_blockers: 1");
      expect(stdout).toContain("- approval_blockers: 1");
      expect(stdout).toContain("blocked until founder decisions are recorded and reply durability passes");
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });
});
