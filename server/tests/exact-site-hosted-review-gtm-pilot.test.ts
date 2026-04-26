// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  auditExactSiteHostedReviewGtmLedger,
  type ExactSiteGtmPilotLedger,
} from "../utils/exactSiteHostedReviewGtmPilot";

function baseLedger(overrides: Partial<ExactSiteGtmPilotLedger> = {}): ExactSiteGtmPilotLedger {
  return {
    schema: "blueprint/exact-site-hosted-review-gtm-ledger/v1",
    pilot: {
      name: "Blueprint uses Blueprint to sell Blueprint",
      wedge: "Exact-Site Hosted Review",
      startDate: "2026-04-27",
      endDate: "2026-05-10",
      status: "active",
      dailyTouchTargetMin: 20,
      dailyTouchTargetMax: 50,
      paidScaleAllowed: false,
      defaultTrack: "proof_ready_outreach",
    },
    targets: [],
    dailyActivity: [],
    ...overrides,
  };
}

describe("Exact-Site Hosted Review GTM pilot ledger audit", () => {
  it("accepts recipient-backed, proof-led outbound inside the controlled touch cap", () => {
    const result = auditExactSiteHostedReviewGtmLedger(baseLedger({
      targets: [
        {
          id: "target-1",
          track: "proof_ready_outreach",
          organizationName: "Warehouse Robotics Team",
          buyerSegment: "AMR deployment team",
          city: "Austin, TX",
          workflowNeed: "Review an exact warehouse aisle workflow before field rollout.",
          intentSignals: ["Hiring for simulation evaluation on warehouse navigation workflows."],
          evidence: {
            summary: "Public role and product notes indicate active exact-site evaluation need.",
            sourceUrls: ["https://example.org/source-note"],
          },
          artifact: {
            type: "exact_site_hosted_review",
            status: "review_ready",
            path: "ops/paperclip/playbooks/example-proof-pack.md",
            siteWorldId: "siteworld-proof-ready",
            hostedReviewPath: "/site-worlds/siteworld-proof-ready/start",
          },
          recipient: {
            name: "Buyer Contact",
            role: "Deployment lead",
            email: "buyer@warehouse-robotics.invalid",
            evidenceSource: "Explicit public contact page captured in research notes.",
            evidenceType: "explicit_research",
          },
          outbound: {
            status: "sent",
            messagePath: "ops/paperclip/playbooks/example-message.md",
            sendLedgerPath: "ops/paperclip/playbooks/example-send-ledger.md",
            sentAt: "2026-04-27T14:00:00.000Z",
          },
          contentLoop: [
            {
              channel: "linkedin",
              draftPath: "ops/paperclip/playbooks/example-linkedin-draft.md",
              proofArtifactPath: "ops/paperclip/playbooks/example-proof-pack.md",
              status: "draft",
            },
          ],
        },
      ],
      dailyActivity: [
        {
          date: "2026-04-27",
          draftedTouches: 25,
          approvedTouches: 20,
          sentTouches: 20,
          replies: 0,
          hostedReviewStarts: 0,
          qualifiedCalls: 0,
          contentDrafts: 1,
          paidSpendCents: 0,
        },
      ],
    }));

    expect(result.ok).toBe(true);
    expect(result.summary.sentTargets).toBe(1);
    expect(result.findings.filter((finding) => finding.severity === "error")).toHaveLength(0);
  });

  it("blocks live outbound when the recipient email is missing explicit evidence", () => {
    const result = auditExactSiteHostedReviewGtmLedger(baseLedger({
      targets: [
        {
          id: "target-1",
          track: "proof_ready_outreach",
          organizationName: "Robot Team",
          buyerSegment: "Autonomy team",
          workflowNeed: "Exact-site review.",
          intentSignals: ["Pilot signal."],
          evidence: { summary: "Real signal." },
          artifact: {
            type: "exact_site_hosted_review",
            status: "review_ready",
            path: "ops/paperclip/playbooks/brief.md",
            siteWorldId: "siteworld-proof-ready",
          },
          recipient: {
            email: "hello@example.com",
          },
          outbound: {
            status: "human_approved",
          },
        },
      ],
    }));

    expect(result.ok).toBe(false);
    expect(result.findings.map((finding) => finding.message)).toEqual(
      expect.arrayContaining([
        "Placeholder or fake recipient emails are disallowed.",
        "Recipient email requires explicit evidence source and evidence type.",
      ]),
    );
  });

  it("blocks proof-ready outbound before the hosted-review artifact exists", () => {
    const result = auditExactSiteHostedReviewGtmLedger(baseLedger({
      targets: [
        {
          id: "target-1",
          track: "proof_ready_outreach",
          organizationName: "Robot Team",
          buyerSegment: "Simulation team",
          workflowNeed: "Evaluate a site workflow.",
          intentSignals: ["Asked for digital twin proof."],
          evidence: { summary: "Signal came from a public technical post." },
          artifact: {
            type: "exact_site_hosted_review",
            status: "missing",
          },
          outbound: {
            status: "draft_ready",
          },
        },
      ],
    }));

    expect(result.ok).toBe(false);
    expect(result.findings.map((finding) => finding.message)).toContain(
      "Proof-ready outreach requires a review_ready or delivered hosted-review artifact.",
    );
  });

  it("allows demand-sourced capture outreach before a hosted-review artifact exists", () => {
    const result = auditExactSiteHostedReviewGtmLedger(baseLedger({
      targets: [
        {
          id: "target-1",
          track: "demand_sourced_capture",
          organizationName: "Robot Team",
          buyerSegment: "Simulation team",
          workflowNeed: "Identify which warehouse site should be captured for evaluation.",
          intentSignals: ["Hiring for exact-site digital-twin evaluation."],
          evidence: { summary: "Signal came from a public technical role." },
          artifact: {
            type: "city_site_opportunity_brief",
            status: "missing",
          },
          captureAsk: {
            requestedSiteType: "warehouse aisle and receiving dock",
            requestedCity: "Austin, TX",
            buyerQuestion: "Which site would help your team test AMR route review?",
            status: "not_started",
          },
          recipient: {
            email: "buyer@robot-team.invalid",
            evidenceSource: "Human-supplied pilot contact from founder research notes.",
            evidenceType: "human_supplied",
          },
          outbound: {
            status: "human_approved",
            messagePath: "ops/paperclip/playbooks/demand-sourced-capture-message.md",
          },
        },
      ],
    }));

    expect(result.ok).toBe(true);
    expect(result.summary.demandSourcedTargets).toBe(1);
    expect(result.findings.filter((finding) => finding.severity === "error")).toHaveLength(0);
  });

  it("blocks demand-sourced capture targets without a capture ask", () => {
    const result = auditExactSiteHostedReviewGtmLedger(baseLedger({
      targets: [
        {
          id: "target-1",
          track: "demand_sourced_capture",
          organizationName: "Robot Team",
          buyerSegment: "Simulation team",
          workflowNeed: "Find a site to capture.",
          intentSignals: ["Asked for exact-site test environments."],
          evidence: { summary: "Real signal." },
          artifact: {
            type: "city_site_opportunity_brief",
            status: "missing",
          },
          outbound: {
            status: "draft_ready",
          },
        },
      ],
    }));

    expect(result.ok).toBe(false);
    expect(result.findings.map((finding) => finding.message)).toContain(
      "Demand-sourced capture targets require a captureAsk object.",
    );
  });

  it("blocks paid scale before organic signal and enforces the daily touch cap", () => {
    const result = auditExactSiteHostedReviewGtmLedger(baseLedger({
      dailyActivity: [
        {
          date: "2026-04-27",
          draftedTouches: 100,
          approvedTouches: 75,
          sentTouches: 75,
          replies: 0,
          hostedReviewStarts: 0,
          qualifiedCalls: 0,
          contentDrafts: 0,
          paidSpendCents: 50000,
        },
      ],
    }));

    expect(result.ok).toBe(false);
    expect(result.findings.map((finding) => finding.message)).toEqual(
      expect.arrayContaining([
        "Daily sent touches exceed the pilot cap.",
        "Paid spend is blocked until the pilot explicitly allows scale.",
        "Paid scale requires organic replies, hosted reviews, or qualified calls first.",
      ]),
    );
  });
});
