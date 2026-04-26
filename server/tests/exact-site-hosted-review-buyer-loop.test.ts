// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildExactSiteHostedReviewBuyerLoopReport } from "../utils/exactSiteHostedReviewBuyerLoop";
import {
  auditExactSiteHostedReviewGtmLedger,
  type ExactSiteGtmPilotLedger,
} from "../utils/exactSiteHostedReviewGtmPilot";

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
      decisionTouchGoal: 100,
      proofArtifactGoal: 3,
      paidScaleAllowed: false,
    },
    targets: [
      {
        id: "target-1",
        track: "proof_ready_outreach",
        organizationName: "Robot Team One",
        buyerSegment: "Deployment team",
        city: "Durham, NC",
        workflowNeed: "Inspect a warehouse aisle before deployment planning.",
        intentSignals: ["Public deployment role references warehouse autonomy."],
        evidence: { summary: "Relevant exact-site buying signal." },
        artifact: {
          type: "exact_site_hosted_review",
          status: "review_ready",
          path: "client/public/samples/sample-hosted-review-report.md",
          siteWorldId: "sample-public-capture-cedar-market-aisle-loop",
        },
        recipient: {
          email: "buyer@robotteamone.invalid",
          evidenceSource: "Human-supplied founder target sheet.",
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
        city: "Durham, NC",
        workflowNeed: "Choose which staging workflow should be captured first.",
        intentSignals: ["Public product notes reference exact-site evaluation."],
        evidence: { summary: "Relevant demand-sourced capture signal." },
        artifact: {
          type: "city_site_opportunity_brief",
          status: "missing",
        },
        captureAsk: {
          requestedSiteType: "warehouse staging lane",
          requestedCity: "Durham, NC",
          buyerQuestion: "Which workflow is most useful to capture first?",
          status: "not_started",
        },
        outbound: {
          status: "not_ready",
        },
      },
    ],
    dailyActivity: [],
  };
}

describe("Exact-Site Hosted Review buyer loop report", () => {
  it("turns the GTM ledger into the daily city-launch buyer dashboard", () => {
    const pilotLedger = ledger();
    const audit = auditExactSiteHostedReviewGtmLedger(pilotLedger);
    const report = buildExactSiteHostedReviewBuyerLoopReport({
      ledger: pilotLedger,
      audit,
      ledgerPath: "/repo/ops/paperclip/playbooks/exact-site-hosted-review-gtm-ledger.json",
      city: "Durham, NC",
      reportDate: "2026-04-28",
      durability: null,
    });

    expect(report.summary.targetRows).toBe(2);
    expect(report.summary.recipientBackedTargets).toBe(1);
    expect(report.summary.founderApprovalNeededTargets).toBe(1);
    expect(report.summary.captureAsks).toBe(1);
    expect(report.summary.decisionTouchGap).toBe(100);
    expect(report.markdown).toContain("## Founder First Send Batch");
    expect(report.markdown).toContain("Robot-team pages should drive exactly two buyer actions");
    expect(report.markdown).toContain("After 100 touches or at day 14");
  });
});
