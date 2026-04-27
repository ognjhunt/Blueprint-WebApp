// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { ExactSiteGtmPilotLedger } from "../utils/exactSiteHostedReviewGtmPilot";
import {
  runGtmEnrichmentWaterfall,
  type GtmEnrichmentProvider,
} from "../utils/gtmEnrichmentProviders";

function ledger(): ExactSiteGtmPilotLedger {
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
    },
    targets: [
      {
        id: "target-1",
        track: "demand_sourced_capture",
        organizationName: "Robot Team",
        buyerSegment: "Warehouse autonomy team",
        workflowNeed: "Pick the warehouse workflow worth capturing first.",
        intentSignals: ["Public deployment signal."],
        evidence: { summary: "Real target evidence." },
        artifact: {
          type: "city_site_opportunity_brief",
          status: "draft",
        },
        captureAsk: {
          requestedSiteType: "warehouse pick aisle",
          status: "not_started",
        },
        outbound: {
          status: "draft_ready",
          approvalState: "blocked",
        },
      },
    ],
    dailyActivity: [],
  };
}

describe("GTM enrichment waterfall", () => {
  it("records provider runs and selects a recipient only from normalized evidence", async () => {
    const provider: GtmEnrichmentProvider = {
      key: "repo_artifact",
      async enrich() {
        return {
          run: {
            providerKey: "repo_artifact",
            status: "contact_found",
            searchedAt: "2026-04-27T12:00:00.000Z",
            candidateCount: 1,
          },
          candidates: [
            {
              email: "buyer@robotteam.invalid",
              evidenceSource: "Recipient sourced from explicit public contact evidence at https://robotteam.invalid/contact.",
              evidenceType: "explicit_research",
              providerKey: "repo_artifact",
              confidence: "high",
              discoveredAt: "2026-04-27T12:00:00.000Z",
            },
          ],
        };
      },
    };

    const result = await runGtmEnrichmentWaterfall({
      ledger: ledger(),
      providers: [provider],
      selectRecipients: true,
    });

    const target = result.ledger.targets[0];
    expect(result.summary.candidatesAdded).toBe(1);
    expect(result.summary.selectedRecipients).toBe(1);
    expect(target.recipient?.email).toBe("buyer@robotteam.invalid");
    expect(target.outbound.approvalState).toBe("pending_first_send_approval");
    expect(target.enrichment?.status).toBe("contact_found");
    expect(target.enrichment?.providerRuns).toHaveLength(1);
    expect(target.enrichment?.recipientCandidates).toHaveLength(1);
  });

  it("keeps placeholder candidates out of the ledger", async () => {
    const provider: GtmEnrichmentProvider = {
      key: "repo_artifact",
      async enrich() {
        return {
          run: {
            providerKey: "repo_artifact",
            status: "contact_found",
            searchedAt: "2026-04-27T12:00:00.000Z",
            candidateCount: 1,
          },
          candidates: [
            {
              email: "person@example.com",
              evidenceSource: "Invalid placeholder evidence.",
              evidenceType: "explicit_research",
              providerKey: "repo_artifact",
              confidence: "high",
              discoveredAt: "2026-04-27T12:00:00.000Z",
            },
          ],
        };
      },
    };

    const result = await runGtmEnrichmentWaterfall({
      ledger: ledger(),
      providers: [provider],
      selectRecipients: true,
    });

    expect(result.ledger.targets[0].recipient).toBeUndefined();
    expect(result.ledger.targets[0].enrichment?.recipientCandidates).toHaveLength(0);
    expect(result.ledger.targets[0].enrichment?.status).toBe("exhausted");
  });
});
