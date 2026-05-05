// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  CITY_LAUNCH_RESEARCH_SCHEMA_VERSION,
  parseCityLaunchResearchArtifact,
} from "../utils/cityLaunchResearchParser";
import {
  CITY_LAUNCH_ACTIVATION_PAYLOAD_SCHEMA_VERSION,
  CITY_LAUNCH_MACHINE_POLICY_VERSION,
} from "../utils/cityLaunchDoctrine";

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
              contact_email: "siteops@delvallelogistics.com",
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
              explicit_fields: ["name", "contact_email", "site_address", "workflow_fit"],
              inferred_fields: ["lat", "lng"],
            },
          ],
          buyer_target_candidates: [
            {
              company_name: "Warehouse Robotics Co",
              contact_email: "ops@warehouserobotics.com",
              status: "researched",
              workflow_fit: "dock handoff",
              proof_path: "exact_site",
              notes: "Current warehouse autonomy fit.",
              source_bucket: "warehouse_robotics",
              source_urls: ["https://example.com/buyer"],
              explicit_fields: ["company_name", "contact_email", "workflow_fit"],
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
      "",
      "```city-launch-activation-payload",
      JSON.stringify(
        {
          schema_version: CITY_LAUNCH_ACTIVATION_PAYLOAD_SCHEMA_VERSION,
          machine_policy_version: CITY_LAUNCH_MACHINE_POLICY_VERSION,
          city: "Austin, TX",
          city_slug: "austin-tx",
          city_thesis: "Run one proof-led warehouse wedge.",
          primary_site_lane: "industrial_warehouse",
          primary_workflow_lane: "dock handoff",
          primary_buyer_proof_path: "exact_site",
          lawful_access_modes: ["buyer_requested_site", "site_operator_intro"],
          preferred_lawful_access_mode: "buyer_requested_site",
          rights_path: {
            summary: "Private controlled interiors require explicit authorization.",
            private_controlled_interiors_require_authorization: true,
            validation_required: false,
            source_urls: ["https://example.com/rights"],
          },
          validation_blockers: [
            {
              key: "stack-fit",
              summary: "Verify export compatibility.",
              severity: "high",
              owner_lane: "buyer-solutions-agent",
              validation_required: true,
              source_urls: [],
            },
          ],
          required_approvals: [
            { lane: "founder", reason: "go/no-go" },
          ],
          owner_lanes: [
            "city-launch-agent",
            "buyer-solutions-agent",
            "analytics-agent",
          ],
          issue_seeds: [
            {
              key: "lock-access",
              title: "Lock lawful access",
              phase: "founder_gates",
              owner_lane: "city-launch-agent",
              human_lane: "growth-lead",
              summary: "Pick the first lawful access mode.",
              dependency_keys: [],
              success_criteria: ["Lawful access path is named."],
              metrics_dependencies: ["first_lawful_access_path"],
              validation_required: false,
            },
          ],
          metrics_dependencies: [
            {
              key: "robot_team_inbound_captured",
              kind: "event",
              status: "required_tracked",
              owner_lane: "analytics-agent",
            },
            {
              key: "proof_path_assigned",
              kind: "event",
              status: "required_tracked",
              owner_lane: "analytics-agent",
            },
            {
              key: "proof_pack_delivered",
              kind: "event",
              status: "required_tracked",
              owner_lane: "analytics-agent",
            },
            {
              key: "hosted_review_ready",
              kind: "event",
              status: "required_tracked",
              owner_lane: "analytics-agent",
            },
            {
              key: "hosted_review_started",
              kind: "event",
              status: "required_tracked",
              owner_lane: "analytics-agent",
            },
            {
              key: "hosted_review_follow_up_sent",
              kind: "event",
              status: "required_tracked",
              owner_lane: "analytics-agent",
            },
            {
              key: "human_commercial_handoff_started",
              kind: "event",
              status: "required_tracked",
              owner_lane: "analytics-agent",
            },
            {
              key: "proof_motion_stalled",
              kind: "event",
              status: "required_tracked",
              owner_lane: "analytics-agent",
            },
          ],
          named_claims: [
            {
              subject: "Warehouse Robotics Co",
              claim_type: "company",
              claim: "Warehouse Robotics Co is a named buyer target.",
              validation_required: false,
              source_urls: ["https://example.com/buyer"],
            },
          ],
          launch_surface_coverage: [
            {
              surface_key: "city_thesis_and_wedge",
              owner_lane: "city-launch-agent",
              human_lane: "growth-lead",
              artifact: "ops/paperclip/playbooks/city-launch-austin-tx-deep-research.md",
              evidence_standard: "City thesis, wedge, and proof path are explicitly named.",
              completion_gate: "Activation payload and final playbook agree on the selected wedge.",
              delegation_task_key: "city-opening-distribution",
              blocker_behavior: "ready_to_execute",
              validation_required: true,
              source_urls: [],
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
    expect(result.buyerTargets[0]?.proofPath).toBe("exact_site");
    expect(result.firstTouches[0]?.referenceName).toBe("Warehouse Robotics Co");
    expect(result.budgetRecommendations[0]?.amountUsd).toBe(250);
    expect(result.activationPayload?.cityThesis).toBe("Run one proof-led warehouse wedge.");
    expect(result.activationPayload?.issueSeeds[0]?.ownerLane).toBe("city-launch-agent");
    expect(result.activationPayload?.launchSurfaceCoverage[0]).toMatchObject({
      surfaceKey: "city_thesis_and_wedge",
      ownerLane: "city-launch-agent",
      delegationTaskKey: "city-opening-distribution",
    });
    expect(result.warnings).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it("parses schema-prefixed activation payload fences", () => {
    const markdown = [
      "# Austin, TX Launch Playbook",
      "",
      "```city-launch-records",
      JSON.stringify(
        {
          schema_version: CITY_LAUNCH_RESEARCH_SCHEMA_VERSION,
          generated_at: "2026-04-12T12:00:00.000Z",
          capture_location_candidates: [],
          buyer_target_candidates: [],
          first_touch_candidates: [],
          budget_recommendations: [],
        },
        null,
        2,
      ),
      "```",
      "",
      "```city-launch-activation-payload with schema \"2026-04-13.city-launch-activation-payload.v1\" and machine_policy_version \"2026-04-13.city-launch-doctrine.v1\"",
      JSON.stringify(
        {
          schema_version: CITY_LAUNCH_ACTIVATION_PAYLOAD_SCHEMA_VERSION,
          machine_policy_version: CITY_LAUNCH_MACHINE_POLICY_VERSION,
          city: "Austin, TX",
          city_slug: "austin-tx",
          city_thesis: "Run one proof-led warehouse wedge.",
          primary_site_lane: "industrial_warehouse",
          primary_workflow_lane: "dock handoff",
          primary_buyer_proof_path: "exact_site",
          lawful_access_modes: ["buyer_requested_site"],
          preferred_lawful_access_mode: "buyer_requested_site",
          rights_path: {
            summary: "Private controlled interiors require explicit authorization.",
            private_controlled_interiors_require_authorization: true,
            validation_required: false,
            source_urls: [],
          },
          validation_blockers: [],
          required_approvals: [],
          owner_lanes: ["city-launch-agent"],
          issue_seeds: [],
          metrics_dependencies: [],
          named_claims: [],
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

    expect(result.activationPayload).not.toBeNull();
    expect(result.activationPayload?.city).toBe("Austin, TX");
    expect(result.warnings).not.toContain(
      "Machine-readable city-launch activation payload was present but could not be parsed as valid JSON.",
    );
  });

  it("rejects placeholder or unsourced contact_email values as recipient evidence", () => {
    const markdown = [
      "# Austin, TX Launch Playbook",
      "",
      "```city-launch-records",
      JSON.stringify(
        {
          schema_version: CITY_LAUNCH_RESEARCH_SCHEMA_VERSION,
          generated_at: "2026-04-12T12:00:00.000Z",
          buyer_target_candidates: [
            {
              company_name: "Placeholder Robotics",
              contact_email: "ops@example.com",
              status: "researched",
              workflow_fit: "dock handoff",
              proof_path: "exact_site",
              source_urls: [],
              explicit_fields: ["company_name", "contact_email"],
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
      skipActivationReadyDirectOutreachValidation: true,
    });

    expect(result.buyerTargets[0]?.contactEmail).toBeNull();
    expect(result.errors.join("\n")).toContain("placeholder or non-deliverable email domain");
  });

  it("returns a warning when the structured appendix is absent", () => {
    const result = parseCityLaunchResearchArtifact({
      city: "Austin, TX",
      artifactPath: "/tmp/city-launch-austin.md",
      markdown: "# Austin, TX\n\nNo structured appendix yet.",
    });

    expect(result.captureCandidates).toEqual([]);
    expect(result.warnings[0]).toContain("No structured city-launch research appendix");
    expect(result.errors).toEqual([]);
    expect(result.activationPayload).toBeNull();
  });

  it("normalizes legacy proof-path and budget enums into current contract values", () => {
    const markdown = [
      "# Austin, TX Launch Playbook",
      "",
      "```city-launch-records",
      JSON.stringify(
        {
          schema_version: CITY_LAUNCH_RESEARCH_SCHEMA_VERSION,
          generated_at: "2026-04-12T12:00:00.000Z",
          buyer_target_candidates: [
            {
              company_name: "Warehouse Robotics Co",
              status: "researched",
              proof_path: "hosted_review",
              source_urls: ["https://example.com/buyer"],
              explicit_fields: ["company_name"],
              inferred_fields: [],
            },
          ],
          budget_recommendations: [
            {
              category: "proptech_processing",
              amount_usd: 250,
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

    expect(result.errors).toEqual([]);
    expect(result.buyerTargets).toHaveLength(1);
    expect(result.buyerTargets[0]?.proofPath).toBe("scoped_follow_up");
    expect(result.budgetRecommendations).toHaveLength(1);
    expect(result.budgetRecommendations[0]?.category).toBe("other");
    expect(result.warnings.join("\n")).toContain('normalized legacy "proof_path" value "hosted_review"');
    expect(result.warnings.join("\n")).toContain('normalized legacy budget category "proptech_processing" to "other"');
  });

  it("rejects activation-ready direct outreach when first-wave contacts omit contact_email", () => {
    const markdown = [
      "# Sacramento, CA Launch Playbook",
      "",
      "## Structured launch data appendix",
      "",
      "```city-launch-records",
      JSON.stringify(
        {
          schema_version: CITY_LAUNCH_RESEARCH_SCHEMA_VERSION,
          generated_at: "2026-04-17T12:00:00.000Z",
          capture_location_candidates: [
            {
              name: "Northgate Logistics",
              source_bucket: "industrial_warehouse",
              channel: "professional_outreach",
              status: "qualified",
              workflow_fit: "dock handoff",
              source_urls: ["https://example.com/capture"],
              explicit_fields: ["name", "workflow_fit"],
              inferred_fields: [],
            },
          ],
          buyer_target_candidates: [
            {
              company_name: "Capital Robotics",
              contact_name: "Taylor Buyer",
              status: "researched",
              workflow_fit: "dock handoff",
              proof_path: "exact_site",
              source_urls: ["https://example.com/buyer"],
              explicit_fields: ["company_name", "contact_name", "workflow_fit"],
              inferred_fields: [],
            },
          ],
          first_touch_candidates: [
            {
              reference_type: "buyer_target",
              reference_name: "Capital Robotics",
              channel: "email",
              touch_type: "first_touch",
              status: "queued",
              source_urls: ["https://example.com/buyer"],
              explicit_fields: ["reference_name", "channel"],
              inferred_fields: [],
            },
          ],
        },
        null,
        2,
      ),
      "```",
      "",
      "## Machine-readable activation payload",
      "",
      "```city-launch-activation-payload",
      JSON.stringify(
        {
          schema_version: CITY_LAUNCH_ACTIVATION_PAYLOAD_SCHEMA_VERSION,
          machine_policy_version: CITY_LAUNCH_MACHINE_POLICY_VERSION,
          city: "Sacramento, CA",
          city_slug: "sacramento-ca",
          city_thesis: "Run one proof-led warehouse wedge.",
          primary_site_lane: "industrial_warehouse",
          primary_workflow_lane: "dock handoff",
          primary_buyer_proof_path: "exact_site",
          lawful_access_modes: ["buyer_requested_site"],
          preferred_lawful_access_mode: "buyer_requested_site",
          rights_path: {
            summary: "Private controlled interiors require explicit authorization.",
            private_controlled_interiors_require_authorization: true,
            validation_required: false,
            source_urls: ["https://example.com/rights"],
          },
          validation_blockers: [],
          required_approvals: [{ lane: "founder", reason: "go/no-go" }],
          owner_lanes: ["city-launch-agent", "capturer-growth-agent", "analytics-agent"],
          issue_seeds: [
            {
              key: "city-opening-first-wave-pack",
              title: "Assemble first-wave pack",
              phase: "supply",
              owner_lane: "capturer-growth-agent",
              human_lane: "growth-lead",
              summary: "Prepare first-wave outreach and posting assets.",
              dependency_keys: [],
              success_criteria: ["First-wave pack is ready."],
              metrics_dependencies: ["first_lawful_access_path"],
              validation_required: false,
            },
          ],
          metrics_dependencies: [
            { key: "robot_team_inbound_captured", kind: "event", status: "required_tracked", owner_lane: "analytics-agent" },
            { key: "proof_path_assigned", kind: "event", status: "required_tracked", owner_lane: "analytics-agent" },
            { key: "proof_pack_delivered", kind: "event", status: "required_tracked", owner_lane: "analytics-agent" },
            { key: "hosted_review_ready", kind: "event", status: "required_tracked", owner_lane: "analytics-agent" },
            { key: "hosted_review_started", kind: "event", status: "required_tracked", owner_lane: "analytics-agent" },
            { key: "hosted_review_follow_up_sent", kind: "event", status: "required_tracked", owner_lane: "analytics-agent" },
            { key: "human_commercial_handoff_started", kind: "event", status: "required_tracked", owner_lane: "analytics-agent" },
            { key: "proof_motion_stalled", kind: "event", status: "required_tracked", owner_lane: "analytics-agent" },
          ],
          named_claims: [
            {
              subject: "Capital Robotics",
              claim_type: "company",
              claim: "Capital Robotics is a named buyer target.",
              validation_required: false,
              source_urls: ["https://example.com/buyer"],
            },
          ],
        },
        null,
        2,
      ),
      "```",
    ].join("\n");

    const result = parseCityLaunchResearchArtifact({
      city: "Sacramento, CA",
      artifactPath: "/tmp/city-launch-sacramento.md",
      markdown,
    });

    expect(result.errors.join("\n")).toContain(
      "Activation-ready direct outreach requires 1-3 recipient-backed first-wave contacts with explicit contact_email evidence.",
    );
  });
});
