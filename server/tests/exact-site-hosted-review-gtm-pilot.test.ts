// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  auditExactSiteHostedReviewGtmLedger,
  renderExactSiteHostedReviewGtmFounderReviewMarkdown,
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
  it("blocks an active pilot with zero target rows", () => {
    const result = auditExactSiteHostedReviewGtmLedger(baseLedger());

    expect(result.ok).toBe(false);
    expect(result.findings.map((finding) => finding.message)).toContain(
      "The pilot cannot be marked ready with zero target rows; add real robot-team targets or pause the pilot.",
    );
  });

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
            email: "buyer@warehouse-robotics.co",
            evidenceSource: "Explicit public contact page captured in research notes.",
            evidenceType: "explicit_research",
          },
          outbound: {
            status: "sent",
            approvalState: "approved",
            messagePath: "ops/paperclip/playbooks/example-message.md",
            sendLedgerPath: "ops/paperclip/playbooks/example-send-ledger.md",
            sentAt: "2026-04-27T14:00:00.000Z",
          },
          sales: {
            nextAction: "Watch for durable reply and route to hosted-review start or qualified call.",
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
    expect(result.summary.recipientBackedTargets).toBe(1);
    expect(result.summary.targetsMissingRecipientEvidence).toBe(0);
    expect(result.summary.closureStateTargets).toBe(1);
    expect(result.summary.targetsMissingClosureState).toBe(0);
    expect(result.summary.latestDay.contactDensityGap).toBe(0);
    expect(result.findings.filter((finding) => finding.severity === "error")).toHaveLength(0);
  });

  it("blocks live outbound and does not count recipient progress when the email is missing explicit evidence", () => {
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
            email: "hello@robotteam.co",
          },
          outbound: {
            status: "human_approved",
            approvalState: "approved",
          },
        },
      ],
    }));

    expect(result.ok).toBe(false);
    expect(result.summary.recipientBackedTargets).toBe(0);
    expect(result.summary.targetsMissingRecipientEvidence).toBe(1);
    expect(result.summary.approvalNeededTargets).toBe(0);
    expect(result.findings.map((finding) => finding.message)).toEqual(
      expect.arrayContaining([
        "Recipient email requires explicit evidence source and evidence type.",
      ]),
    );
  });

  it("blocks reserved test-domain recipient emails", () => {
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
            email: "buyer@robotteam.invalid",
            evidenceSource: "Reserved test-domain address supplied in a fixture.",
            evidenceType: "human_supplied",
          },
          enrichment: {
            status: "blocked",
            providerRuns: [
              {
                providerKey: "manual_human_supplied",
                status: "blocked",
                searchedAt: "2026-01-01T00:00:00.000Z",
              },
            ],
            recipientCandidates: [],
          },
          outbound: {
            status: "human_approved",
            approvalState: "approved",
          },
        },
      ],
    }));

    expect(result.ok).toBe(false);
    expect(result.summary.recipientBackedTargets).toBe(0);
    expect(result.summary.targetsMissingRecipientEvidence).toBe(1);
    expect(result.summary.staleEnrichmentTargets).toBe(1);
    expect(result.findings.map((finding) => finding.message)).toContain(
      "Placeholder or fake recipient emails are disallowed.",
    );
    expect(result.findings.map((finding) => finding.message)).toContain(
      "Latest enrichment run is older than 30 days and no selected recipient exists.",
    );
  });

  it("keeps reserved or unevidenced recipients out of the founder approval packet", () => {
    const pilotLedger = baseLedger({
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
            email: "buyer@robotteam.invalid",
            evidenceSource: "Reserved test-domain address supplied in a fixture.",
            evidenceType: "human_supplied",
          },
          outbound: {
            status: "draft_ready",
            approvalState: "pending_first_send_approval",
            messagePath: "ops/paperclip/playbooks/message.md",
          },
        },
      ],
    });
    const result = auditExactSiteHostedReviewGtmLedger(pilotLedger);
    const markdown = renderExactSiteHostedReviewGtmFounderReviewMarkdown(
      pilotLedger,
      result,
      "/repo/ops/paperclip/playbooks/exact-site-hosted-review-gtm-ledger.json",
      "2026-04-28",
    );

    expect(markdown).toContain("Supply or approve recipient-backed contacts for 1 target(s)");
    expect(markdown).toContain("## Targets Needing Recipient Evidence");
    expect(markdown).toContain("- target-1: Robot Team / Autonomy team / Exact-site review.");
    expect(markdown).toContain("## Targets Needing Approval\n\n- none");
    expect(markdown).not.toContain("Approve, edit, or reject 1 recipient-backed draft target(s)");
    expect(markdown).not.toContain("buyer@robotteam.invalid (human_supplied)");
  });

  it("blocks when an active pilot has targets but no recipient-backed contacts", () => {
    const result = auditExactSiteHostedReviewGtmLedger(baseLedger({
      targets: [
        {
          id: "target-1",
          track: "proof_ready_outreach",
          organizationName: "Robot Team",
          buyerSegment: "Deployment team",
          workflowNeed: "Inspect one exact public site before picking a deployment workflow.",
          intentSignals: ["Public product positioning references deployment-site evaluation."],
          evidence: { summary: "Target account is relevant, but recipient contact is not yet backed." },
          artifact: {
            type: "exact_site_hosted_review",
            status: "review_ready",
            path: "client/public/samples/sample-hosted-review-report.md",
            siteWorldId: "sample-public-capture-cedar-market-aisle-loop",
          },
          outbound: {
            status: "draft_ready",
            messagePath: "ops/paperclip/playbooks/exact-site-hosted-review-first-touch-drafts.md",
          },
        },
      ],
    }));

    expect(result.ok).toBe(false);
    expect(result.findings.map((finding) => finding.message)).toEqual(
      expect.arrayContaining([
        "Active pilot has target rows but no recipient-backed contacts; live sends remain blocked on explicit contact evidence.",
        "Active pilot has no sent targets yet; daily progress is still target research until a send ledger exists.",
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
            email: "buyer@robot-team.co",
            evidenceSource: "Human-supplied pilot contact from founder research notes.",
            evidenceType: "human_supplied",
          },
          outbound: {
            status: "human_approved",
            approvalState: "approved",
            messagePath: "ops/paperclip/playbooks/demand-sourced-capture-message.md",
          },
          sales: {
            nextAction: "Send first capture-ask touch after provider configuration is durable.",
          },
        },
      ],
    }));

    expect(result.ok).toBe(true);
    expect(result.summary.demandSourcedTargets).toBe(1);
    expect(result.summary.draftReadyTargets).toBe(0);
    expect(result.summary.humanApprovedTargets).toBe(1);
    expect(result.summary.approvalNeededTargets).toBe(0);
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

  it("requires Paperclip issue linkage for open target blockers", () => {
    const result = auditExactSiteHostedReviewGtmLedger(baseLedger({
      targets: [
        {
          id: "target-1",
          track: "proof_ready_outreach",
          organizationName: "Robot Team",
          buyerSegment: "Deployment team",
          workflowNeed: "Inspect one exact public site before picking a deployment workflow.",
          intentSignals: ["Public product positioning references deployment-site evaluation."],
          evidence: { summary: "Real exact-site buying signal." },
          artifact: {
            type: "exact_site_hosted_review",
            status: "review_ready",
            path: "client/public/samples/sample-hosted-review-report.md",
            siteWorldId: "sample-public-capture-cedar-market-aisle-loop",
          },
          outbound: {
            status: "draft_ready",
            messagePath: "ops/paperclip/playbooks/exact-site-hosted-review-first-touch-drafts.md",
          },
          sales: {
            nextAction: "Resolve the contact-discovery blocker before first-send approval.",
          },
          blockers: [
            {
              id: "gtm-blocker-contact-discovery",
              status: "blocked",
              summary: "Governed public contact discovery is not configured.",
              owner: "growth-lead",
              nextAction: "Set the governed contact discovery allowlist or provide explicit recipient evidence.",
            },
          ],
        },
      ],
    }));

    expect(result.ok).toBe(false);
    expect(result.summary.openTargetBlockers).toBe(1);
    expect(result.summary.paperclipLinkedTargetBlockers).toBe(0);
    expect(result.findings.map((finding) => finding.message)).toContain(
      "Open target blockers must link to a Paperclip issue id or identifier.",
    );
  });

  it("blocks target rows that have no next action, recipient state, send state, or blocker", () => {
    const result = auditExactSiteHostedReviewGtmLedger(baseLedger({
      targets: [
        {
          id: "target-1",
          track: "proof_ready_outreach",
          organizationName: "Robot Team",
          buyerSegment: "Deployment team",
          workflowNeed: "Inspect one exact public site before picking a deployment workflow.",
          intentSignals: ["Public product positioning references deployment-site evaluation."],
          evidence: { summary: "Real exact-site buying signal." },
          artifact: {
            type: "exact_site_hosted_review",
            status: "review_ready",
            path: "client/public/samples/sample-hosted-review-report.md",
            siteWorldId: "sample-public-capture-cedar-market-aisle-loop",
          },
          outbound: {
            status: "not_ready",
          },
        },
      ],
    }));

    expect(result.ok).toBe(false);
    expect(result.summary.closureStateTargets).toBe(0);
    expect(result.summary.targetsMissingClosureState).toBe(1);
    expect(result.findings.map((finding) => finding.message)).toContain(
      "Every target must record a next action, recipient evidence state, send/reply state, or explicit blocker.",
    );
  });

  it("counts Paperclip-linked target blockers without creating fake recipient progress or readiness", () => {
    const result = auditExactSiteHostedReviewGtmLedger(baseLedger({
      targets: [
        {
          id: "target-1",
          track: "proof_ready_outreach",
          organizationName: "Robot Team",
          buyerSegment: "Deployment team",
          workflowNeed: "Inspect one exact public site before picking a deployment workflow.",
          intentSignals: ["Public product positioning references deployment-site evaluation."],
          evidence: { summary: "Real exact-site buying signal." },
          artifact: {
            type: "exact_site_hosted_review",
            status: "review_ready",
            path: "client/public/samples/sample-hosted-review-report.md",
            siteWorldId: "sample-public-capture-cedar-market-aisle-loop",
          },
          outbound: {
            status: "draft_ready",
            messagePath: "ops/paperclip/playbooks/exact-site-hosted-review-first-touch-drafts.md",
          },
          sales: {
            nextAction: "Resolve the contact-discovery blocker before first-send approval.",
          },
          blockers: [
            {
              id: "gtm-blocker-contact-discovery",
              status: "blocked",
              summary: "Governed public contact discovery is not configured.",
              owner: "growth-lead",
              nextAction: "Set the governed contact discovery allowlist or provide explicit recipient evidence.",
              paperclipIssueIdentifier: "BLU-5400",
            },
          ],
          paperclipIssues: [
            {
              id: "issue-1",
              identifier: "BLU-5400",
              title: "Configure governed GTM contact discovery",
              status: "blocked",
              blockerIds: ["gtm-blocker-contact-discovery"],
            },
          ],
        },
      ],
    }));

    expect(result.ok).toBe(false);
    expect(result.summary.openTargetBlockers).toBe(1);
    expect(result.summary.paperclipLinkedTargetBlockers).toBe(1);
    expect(result.summary.recipientBackedTargets).toBe(0);
    expect(result.summary.closureStateTargets).toBe(1);
    expect(result.summary.targetsMissingClosureState).toBe(0);
    expect(result.findings.map((finding) => finding.message)).toContain(
      "Active pilot has target rows but no recipient-backed contacts; live sends remain blocked on explicit contact evidence.",
    );
  });
});
