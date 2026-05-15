// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { ExactSiteGtmPilotLedger } from "../utils/exactSiteHostedReviewGtmPilot";
import { executeGtmSends } from "../utils/gtmSendExecutor";

function ledger(): ExactSiteGtmPilotLedger {
  return {
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
        workflowNeed: "Inspect a reviewable warehouse route.",
        intentSignals: ["Public deployment signal."],
        evidence: { summary: "Real target evidence." },
        artifact: {
          type: "exact_site_hosted_review",
          status: "review_ready",
          path: "ops/paperclip/playbooks/proof.md",
          siteWorldId: "site-world-1",
        },
        recipient: {
          email: "buyer@robotteam.co",
          evidenceSource: "Recipient sourced from explicit public contact evidence.",
          evidenceType: "explicit_research",
        },
        enrichment: {
          status: "contact_found",
          providerRuns: [],
          recipientCandidates: [],
          selectedRecipientEvidence: {
            providerKey: "repo_artifact",
            selectedAt: "2026-04-27T12:00:00.000Z",
            evidenceSource: "Recipient sourced from explicit public contact evidence.",
          },
        },
        outbound: {
          status: "draft_ready",
          approvalState: "approved",
          messagePath: "ops/paperclip/playbooks/message.md",
        },
        sales: {
          nextAction: "Dry-run send before live dispatch.",
        },
      },
    ],
    dailyActivity: [],
  };
}

describe("GTM send executor", () => {
  it("creates dry-run receipts without mutating target send state", async () => {
    const pilotLedger = ledger();
    const result = await executeGtmSends({
      ledger: pilotLedger,
      dryRun: true,
      skipDurability: true,
    });

    expect(result.errors).toHaveLength(0);
    expect(result.summary.eligible).toBe(1);
    expect(result.summary.dryRun).toBe(1);
    expect(result.summary.sent).toBe(0);
    expect(result.receipts).toHaveLength(0);
    expect(pilotLedger.targets[0].outbound.status).toBe("draft_ready");
  });

  it("reports missing recipient evidence before downstream durability gaps when no sends are eligible", async () => {
    const pilotLedger = ledger();
    pilotLedger.targets[0].recipient = undefined;
    pilotLedger.targets[0].enrichment = {
      status: "blocked",
      providerRuns: [],
      recipientCandidates: [],
      blockers: ["Governed contact discovery is not configured."],
    };
    pilotLedger.targets[0].outbound = {
      status: "draft_ready",
      approvalState: "blocked",
      messagePath: "ops/paperclip/playbooks/message.md",
    };
    pilotLedger.targets[0].sales = {
      nextAction: "Find explicit recipient-backed contact evidence before first-send approval.",
    };

    const result = await executeGtmSends({
      ledger: pilotLedger,
      dryRun: true,
      targetIds: [],
    });

    expect(result.summary.eligible).toBe(0);
    expect(result.summary.skippedNoRecipient).toBe(1);
    expect(result.summary.skippedApproval).toBe(1);
    expect(result.errors.join("\n")).toContain("GTM ledger audit has errors");
    expect(result.errors.join("\n")).toContain("no recipient-backed contacts");
    expect(result.errors.join("\n")).not.toContain("Outbound reply durability is blocked");
  });

  it("points approval-blocked dry-runs to the first-send approval workflow", async () => {
    const pilotLedger = ledger();
    pilotLedger.targets[0].outbound.approvalState = "pending_first_send_approval";

    const result = await executeGtmSends({
      ledger: pilotLedger,
      dryRun: true,
      skipDurability: true,
    });

    expect(result.summary.eligible).toBe(0);
    expect(result.summary.skippedApproval).toBe(1);
    expect(result.errors.join("\n")).toContain("npm run gtm:first-send-approval:template -- --write");
    expect(result.errors.join("\n")).toContain("npm run gtm:first-send-approval:apply -- --write");
    expect(result.errors.join("\n")).toContain("recipient evidence/draft angle/CTA/objection plan");
  });

  it("counts emails without explicit evidence as missing recipient-backed evidence", async () => {
    const pilotLedger = ledger();
    pilotLedger.targets[0].recipient = {
      email: "buyer@robotteam.co",
    };

    const result = await executeGtmSends({
      ledger: pilotLedger,
      dryRun: true,
      skipDurability: true,
    });

    expect(result.summary.skippedNoRecipient).toBe(1);
    expect(result.summary.skippedNoMessage).toBe(0);
    expect(result.errors.join("\n")).toContain("Recipient email requires explicit evidence source and evidence type");
  });
});
