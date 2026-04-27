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
          email: "buyer@robotteam.invalid",
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
});
