// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  applyExactSiteFirstSendApprovals,
  type ExactSiteFirstSendApprovalPacket,
} from "../utils/gtmFirstSendApprovals";
import type { ExactSiteGtmPilotLedger } from "../utils/exactSiteHostedReviewGtmPilot";

function ledger(): ExactSiteGtmPilotLedger {
  return {
    schema: "blueprint/exact-site-hosted-review-gtm-ledger/v1",
    pilot: {
      name: "Blueprint uses Blueprint to sell Blueprint",
      wedge: "Exact-Site Hosted Review",
      startDate: "2026-04-26",
      endDate: "2026-05-10",
      status: "active",
      dailyTouchTargetMin: 20,
      dailyTouchTargetMax: 50,
      paidScaleAllowed: false,
    },
    targets: [
      {
        id: "target-1",
        track: "proof_ready_outreach",
        organizationName: "Robot Team One",
        buyerSegment: "Deployment team",
        workflowNeed: "Inspect a warehouse aisle before deployment planning.",
        intentSignals: ["Public deployment role references warehouse autonomy."],
        evidence: { summary: "Relevant exact-site buying signal." },
        artifact: {
          type: "exact_site_hosted_review",
          status: "review_ready",
          path: "client/public/samples/sample-hosted-review-report.md",
        },
        recipient: {
          email: "buyer@robotteamone.co",
          evidenceSource: "Human supplied CRM export row.",
          evidenceType: "human_supplied",
        },
        outbound: {
          status: "draft_ready",
          approvalState: "pending_first_send_approval",
          messagePath: "ops/paperclip/playbooks/exact-site-hosted-review-first-touch-drafts.md",
        },
      },
      {
        id: "target-2",
        track: "demand_sourced_capture",
        organizationName: "Robot Team Two",
        buyerSegment: "Simulation team",
        workflowNeed: "Choose which staging workflow should be captured first.",
        intentSignals: ["Public product notes reference exact-site evaluation."],
        evidence: { summary: "Relevant demand-sourced capture signal." },
        artifact: {
          type: "city_site_opportunity_brief",
          status: "draft",
          path: "ops/paperclip/playbooks/exact-site-hosted-review-first-target-brief.md",
        },
        outbound: {
          status: "draft_ready",
          approvalState: "pending_first_send_approval",
          messagePath: "ops/paperclip/playbooks/exact-site-hosted-review-first-touch-drafts.md",
        },
      },
    ],
    dailyActivity: [],
  };
}

describe("GTM first-send approval application", () => {
  it("requires explicit reviewer identity before approving recipient-backed drafts", () => {
    const result = applyExactSiteFirstSendApprovals({
      ledger: ledger(),
      now: "2026-05-07T16:30:00.000Z",
      packet: {
        approvals: [
          {
            targetId: "target-1",
            decision: "approve",
          },
        ],
      },
    });

    expect(result.summary.approved).toBe(0);
    expect(result.summary.errors).toBe(1);
    expect(result.errors.join("\n")).toContain("approve decision requires approvedBy");
    expect(result.ledger.targets[0].outbound.status).toBe("draft_ready");
  });

  it("approves only recipient-backed drafts and leaves live sends durability-gated", () => {
    const result = applyExactSiteFirstSendApprovals({
      ledger: ledger(),
      now: "2026-05-07T16:30:00.000Z",
      packet: {
        approvals: [
          {
            targetId: "target-1",
            decision: "approve",
            approvedBy: "Nijel Hunt",
          },
        ],
      },
    });

    expect(result.errors).toEqual([]);
    expect(result.summary.approved).toBe(1);
    expect(result.ledger.targets[0].outbound.status).toBe("human_approved");
    expect(result.ledger.targets[0].outbound.approvalState).toBe("approved");
    expect(result.ledger.targets[0].outbound.approvedBy).toBe("Nijel Hunt");
    expect(result.ledger.targets[0].outbound.approvedAt).toBe("2026-05-07T16:30:00.000Z");
    expect(result.ledger.targets[0].sales?.nextAction).toContain("reply durability passes");
  });

  it("rejects unevidenced approvals instead of inventing recipient readiness", () => {
    const result = applyExactSiteFirstSendApprovals({
      ledger: ledger(),
      now: "2026-05-07T16:30:00.000Z",
      packet: {
        approvals: [
          {
            targetId: "target-2",
            decision: "approve",
            approvedBy: "Nijel Hunt",
          },
        ],
      },
    });

    expect(result.summary.approved).toBe(0);
    expect(result.summary.errors).toBe(1);
    expect(result.errors.join("\n")).toContain("without explicit recipient-backed evidence");
    expect(result.ledger.targets[1].outbound.status).toBe("draft_ready");
    expect(result.ledger.targets[1].outbound.approvalState).toBe("pending_first_send_approval");
  });

  it("records edit and reject decisions without making rows send-eligible", () => {
    const packet: ExactSiteFirstSendApprovalPacket = {
      approvals: [
        {
          targetId: "target-1",
          decision: "edit",
          approvalNote: "Tighten the capture ask.",
        },
        {
          targetId: "target-1",
          decision: "reject",
          approvalNote: "Wrong buyer segment.",
        },
      ],
    };
    const result = applyExactSiteFirstSendApprovals({
      ledger: ledger(),
      now: "2026-05-07T16:30:00.000Z",
      packet,
    });

    expect(result.summary.editRequested).toBe(1);
    expect(result.summary.rejected).toBe(1);
    expect(result.ledger.targets[0].outbound.status).toBe("draft_ready");
    expect(result.ledger.targets[0].outbound.approvalState).toBe("blocked");
    expect(result.ledger.targets[0].blockers?.[0]?.id).toBe("gtm-blocker-founder-rejected-target-1");
    expect(result.ledger.targets[0].sales?.nextAction).toBe("Wrong buyer segment.");
  });
});
