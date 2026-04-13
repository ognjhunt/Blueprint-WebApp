// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  CITY_LAUNCH_RESEARCH_SCHEMA_VERSION,
  parseCityLaunchResearchArtifact,
} from "../utils/cityLaunchResearchParser";

describe("city launch research parser", () => {
  it("extracts structured launch records from the deep-research appendix", () => {
    const markdown = [
      "# Austin, TX Launch Playbook",
      "",
      "## Structured launch data appendix",
      "",
      "```city-launch-records",
      JSON.stringify(
        {
          schema_version: CITY_LAUNCH_RESEARCH_SCHEMA_VERSION,
          generated_at: "2026-04-12T12:00:00.000Z",
          capture_location_candidates: [
            {
              name: "Del Valle Logistics Hub",
              source_bucket: "industrial_warehouse",
              channel: "operator_intro",
              status: "qualified",
              site_address: "100 Logistics Way, Austin, TX",
              location_summary: "Del Valle warehouse corridor",
              lat: 30.1672,
              lng: -97.6214,
              site_category: "warehouse",
              workflow_fit: "dock handoff",
              priority_note: "Strong first exact-site hosted review candidate.",
              source_urls: ["https://example.com/logistics"],
              explicit_fields: ["name", "site_address", "workflow_fit"],
              inferred_fields: ["lat", "lng"],
            },
          ],
          buyer_target_candidates: [
            {
              company_name: "Warehouse Robotics Co",
              status: "researched",
              workflow_fit: "dock handoff",
              notes: "Current warehouse autonomy fit.",
              source_bucket: "warehouse_robotics",
              source_urls: ["https://example.com/buyer"],
              explicit_fields: ["company_name", "workflow_fit"],
              inferred_fields: [],
            },
          ],
          first_touch_candidates: [
            {
              reference_type: "buyer_target",
              reference_name: "Warehouse Robotics Co",
              channel: "email",
              touch_type: "first_touch",
              status: "queued",
              notes: "Lead with hosted review proof.",
              source_urls: ["https://example.com/buyer"],
              explicit_fields: ["reference_name", "channel"],
              inferred_fields: [],
            },
          ],
          budget_recommendations: [
            {
              category: "outbound",
              amount_usd: 250,
              note: "Small outbound test budget.",
              source_urls: ["https://example.com/budget"],
              explicit_fields: ["category", "amount_usd"],
              inferred_fields: [],
            },
          ],
        },
        null,
        2,
      ),
      "```",
    ].join("\n");

    const result = parseCityLaunchResearchArtifact({
      city: "Austin, TX",
      artifactPath: "/tmp/city-launch-austin.md",
      markdown,
    });

    expect(result.captureCandidates).toHaveLength(1);
    expect(result.captureCandidates[0]).toMatchObject({
      stableKey: "prospect_austin-tx_industrial-warehouse-del-valle-logistics-hub-100-logistics-way-austin-tx",
      name: "Del Valle Logistics Hub",
      workflowFit: "dock handoff",
      provenance: expect.objectContaining({
        sourceKey: "capture_location_candidates[0]",
        inferredFields: ["lat", "lng"],
      }),
    });
    expect(result.buyerTargets[0]?.companyName).toBe("Warehouse Robotics Co");
    expect(result.firstTouches[0]?.referenceName).toBe("Warehouse Robotics Co");
    expect(result.budgetRecommendations[0]?.amountUsd).toBe(250);
    expect(result.warnings).toEqual([]);
  });

  it("returns a warning when the structured appendix is absent", () => {
    const result = parseCityLaunchResearchArtifact({
      city: "Austin, TX",
      artifactPath: "/tmp/city-launch-austin.md",
      markdown: "# Austin, TX\n\nNo structured appendix yet.",
    });

    expect(result.captureCandidates).toEqual([]);
    expect(result.warnings[0]).toContain("No structured city-launch research appendix");
  });
});
