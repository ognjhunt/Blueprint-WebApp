// @vitest-environment node
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const upsertCityLaunchProspect = vi.hoisted(() => vi.fn());
const upsertCityLaunchBuyerTarget = vi.hoisted(() => vi.fn());
const recordCityLaunchTouch = vi.hoisted(() => vi.fn());
const recordCityLaunchBudgetEvent = vi.hoisted(() => vi.fn());
const resolveCityLaunchPlanningState = vi.hoisted(() => vi.fn());

vi.mock("../utils/cityLaunchLedgers", async () => {
  const actual = await vi.importActual("../utils/cityLaunchLedgers");
  return {
    ...actual,
    upsertCityLaunchProspect,
    upsertCityLaunchBuyerTarget,
    recordCityLaunchTouch,
    recordCityLaunchBudgetEvent,
  };
});

vi.mock("../utils/cityLaunchPlanningState", () => ({
  resolveCityLaunchPlanningState,
}));

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0, tempDirs.length).map((dir) =>
      fs.rm(dir, { recursive: true, force: true }),
    ),
  );
  vi.clearAllMocks();
});

describe("city launch research materializer", () => {
  it("reports planning_in_progress when deep research has partial artifacts only", async () => {
    resolveCityLaunchPlanningState.mockResolvedValue({
      city: "Testopolis, ZZ",
      citySlug: "testopolis-zz",
      status: "in_progress",
      reportsRoot: "/tmp/reports",
      cityReportsRoot: "/tmp/reports/testopolis-zz",
      canonicalPlaybookPath: "/tmp/reports/canonical.md",
      runDirectory: "/tmp/reports/testopolis-zz/run-1",
      manifestPath: null,
      latestArtifactPath: "/tmp/reports/testopolis-zz/run-1/10-critique-round-1.md",
      completedArtifactPath: null,
      latestRunTimestamp: "run-1",
      warnings: ["City-launch planning has partial artifacts but no final playbook yet."],
    });

    const { materializeCityLaunchResearch } = await import("../utils/cityLaunchResearchMaterializer");
    const result = await materializeCityLaunchResearch({
      city: "Testopolis, ZZ",
      launchId: "launch-1",
      budgetPolicy: {
        tier: "zero_budget",
        label: "Zero Budget",
        maxTotalApprovedUsd: 0,
        operatorAutoApproveUsd: 0,
        allowPaidAcquisition: false,
        allowReferralRewards: false,
        allowTravelReimbursement: false,
        founderApprovalRequiredAboveUsd: 0,
        founderApprovalTriggers: [],
        operatorLane: "growth-lead",
      },
    });

    expect(result.status).toBe("planning_in_progress");
    expect(result.sourceArtifactPath).toContain("10-critique-round-1.md");
    expect(result.warnings[0]).toContain("still in progress");
  });

  it("writes idempotent ledger records from a structured playbook", async () => {
    resolveCityLaunchPlanningState.mockResolvedValue({
      city: "Austin, TX",
      citySlug: "austin-tx",
      status: "completed",
      reportsRoot: "/tmp/reports",
      cityReportsRoot: "/tmp/reports/austin-tx",
      canonicalPlaybookPath: "/tmp/reports/canonical.md",
      runDirectory: "/tmp/reports/austin-tx/run-1",
      manifestPath: null,
      latestArtifactPath: "/tmp/reports/austin-tx/run-1/99-final-playbook.md",
      completedArtifactPath: "/tmp/reports/austin-tx/run-1/99-final-playbook.md",
      latestRunTimestamp: "run-1",
      warnings: [],
    });
    upsertCityLaunchProspect.mockImplementation(async (input: { id: string }) => ({ id: input.id }));
    upsertCityLaunchBuyerTarget.mockImplementation(async (input: { id: string }) => ({ id: input.id }));
    recordCityLaunchTouch.mockResolvedValue({ ok: true });
    recordCityLaunchBudgetEvent.mockResolvedValue({ ok: true });

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "city-launch-materializer-"));
    tempDirs.push(tempDir);

    const artifactPath = path.join(tempDir, "city-launch-austin.md");
    const outputPath = path.join(tempDir, "materialization.json");
    await fs.writeFile(
      artifactPath,
      [
        "# Austin, TX",
        "",
        "## Machine-readable activation payload",
        "",
        "```city-launch-activation-payload",
        JSON.stringify(
          {
            schema_version: "2026-04-13.city-launch-activation-payload.v1",
            machine_policy_version: "2026-04-13.city-launch-doctrine.v1",
            city: "Austin, TX",
            city_slug: "austin-tx",
            city_thesis: "Run one proof-led warehouse wedge.",
            primary_site_lane: "industrial_warehouse",
            primary_workflow_lane: "dock handoff",
            primary_buyer_proof_path: "exact_site",
            lawful_access_modes: ["buyer_requested_site"],
            preferred_lawful_access_mode: "buyer_requested_site",
            rights_path: {
              summary: "Private controlled interiors require authorization.",
              private_controlled_interiors_require_authorization: true,
              validation_required: false,
              source_urls: ["https://example.com/rights"],
            },
            validation_blockers: [],
            required_approvals: [{ lane: "founder", reason: "go/no-go" }],
            owner_lanes: ["city-launch-agent", "analytics-agent"],
            issue_seeds: [
              {
                key: "lock-access",
                title: "Lock access",
                phase: "founder_gates",
                owner_lane: "city-launch-agent",
                human_lane: "growth-lead",
                summary: "Lock the first lawful access path.",
                dependency_keys: [],
                success_criteria: ["Lawful access path is named."],
                metrics_dependencies: ["first_lawful_access_path"],
                validation_required: false,
              },
            ],
            metrics_dependencies: [
              { key: "robot_team_inbound_captured", kind: "event", status: "required_not_tracked", owner_lane: "analytics-agent" },
              { key: "proof_path_assigned", kind: "event", status: "required_not_tracked", owner_lane: "analytics-agent" },
              { key: "proof_pack_delivered", kind: "event", status: "required_not_tracked", owner_lane: "analytics-agent" },
              { key: "hosted_review_ready", kind: "event", status: "required_not_tracked", owner_lane: "analytics-agent" },
              { key: "hosted_review_started", kind: "event", status: "required_not_tracked", owner_lane: "analytics-agent" },
              { key: "hosted_review_follow_up_sent", kind: "event", status: "required_not_tracked", owner_lane: "analytics-agent" },
              { key: "human_commercial_handoff_started", kind: "event", status: "required_not_tracked", owner_lane: "analytics-agent" },
              { key: "proof_motion_stalled", kind: "event", status: "required_not_tracked", owner_lane: "analytics-agent" },
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
          },
          null,
          2,
        ),
        "```",
        "",
        "```city-launch-records",
        JSON.stringify(
          {
            schema_version: "2026-04-12.city-launch-research.v1",
            generated_at: "2026-04-12T12:00:00.000Z",
            capture_location_candidates: [
              {
                name: "Dock One",
                source_bucket: "industrial_warehouse",
                channel: "operator_intro",
                status: "qualified",
                site_address: "100 Logistics Way, Austin, TX",
                lat: 30.1,
                lng: -97.6,
                workflow_fit: "dock handoff",
                source_urls: ["https://example.com/location"],
                explicit_fields: ["name"],
                inferred_fields: [],
              },
            ],
            buyer_target_candidates: [
              {
                company_name: "Warehouse Robotics Co",
                status: "researched",
                workflow_fit: "dock handoff",
                proof_path: "exact_site",
                source_urls: ["https://example.com/buyer"],
                explicit_fields: ["company_name"],
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
                source_urls: ["https://example.com/buyer"],
                explicit_fields: ["reference_name"],
                inferred_fields: [],
              },
            ],
            budget_recommendations: [
              {
                category: "outbound",
                amount_usd: 125,
                note: "Intro budget",
                source_urls: ["https://example.com/budget"],
                explicit_fields: ["amount_usd"],
                inferred_fields: [],
              },
            ],
          },
          null,
          2,
        ),
        "```",
      ].join("\n"),
      "utf8",
    );

    const { materializeCityLaunchResearch } = await import("../utils/cityLaunchResearchMaterializer");
    const result = await materializeCityLaunchResearch({
      city: "Austin, TX",
      launchId: "launch-1",
      budgetPolicy: {
        tier: "low_budget",
        label: "Low Budget",
        maxTotalApprovedUsd: 500,
        operatorAutoApproveUsd: 100,
        allowPaidAcquisition: true,
        allowReferralRewards: false,
        allowTravelReimbursement: true,
        founderApprovalRequiredAboveUsd: 100,
        founderApprovalTriggers: [],
        operatorLane: "growth-lead",
      },
      artifactPath,
      outputPath,
    });

    expect(result.status).toBe("materialized");
    expect(upsertCityLaunchProspect).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.stringContaining("prospect_austin-tx"),
        city: "Austin, TX",
        workflowFit: "dock handoff",
      }),
    );
    expect(upsertCityLaunchBuyerTarget).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.stringContaining("buyer_target_austin-tx"),
        companyName: "Warehouse Robotics Co",
      }),
    );
    expect(recordCityLaunchTouch).toHaveBeenCalledWith(
      expect.objectContaining({
        referenceType: "buyer_target",
        channel: "email",
      }),
    );
    expect(recordCityLaunchBudgetEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "recommended",
        amountUsd: 125,
      }),
    );

    const persisted = JSON.parse(await fs.readFile(outputPath, "utf8")) as { status: string };
    expect(persisted.status).toBe("materialized");
  });

  it("fails loudly when the structured appendix uses unsupported contract values", async () => {
    resolveCityLaunchPlanningState.mockResolvedValue({
      city: "Austin, TX",
      citySlug: "austin-tx",
      status: "completed",
      reportsRoot: "/tmp/reports",
      cityReportsRoot: "/tmp/reports/austin-tx",
      canonicalPlaybookPath: "/tmp/reports/canonical.md",
      runDirectory: "/tmp/reports/austin-tx/run-1",
      manifestPath: null,
      latestArtifactPath: "/tmp/reports/austin-tx/run-1/99-final-playbook.md",
      completedArtifactPath: "/tmp/reports/austin-tx/run-1/99-final-playbook.md",
      latestRunTimestamp: "run-1",
      warnings: [],
    });

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "city-launch-materializer-invalid-"));
    tempDirs.push(tempDir);

    const artifactPath = path.join(tempDir, "city-launch-austin-invalid.md");
    await fs.writeFile(
      artifactPath,
      [
        "# Austin, TX",
        "",
        "```city-launch-activation-payload",
        JSON.stringify(
          {
            schema_version: "2026-04-13.city-launch-activation-payload.v1",
            machine_policy_version: "2026-04-13.city-launch-doctrine.v1",
            city: "Austin, TX",
            city_slug: "austin-tx",
            city_thesis: "Run one proof-led warehouse wedge.",
            primary_site_lane: "industrial_warehouse",
            primary_workflow_lane: "dock handoff",
            primary_buyer_proof_path: "exact_site",
            lawful_access_modes: ["buyer_requested_site"],
            preferred_lawful_access_mode: "buyer_requested_site",
            rights_path: {
              summary: "Private controlled interiors require authorization.",
              private_controlled_interiors_require_authorization: true,
              validation_required: false,
              source_urls: ["https://example.com/rights"],
            },
            validation_blockers: [],
            required_approvals: [{ lane: "founder", reason: "go/no-go" }],
            owner_lanes: ["city-launch-agent", "analytics-agent"],
            issue_seeds: [
              {
                key: "lock-access",
                title: "Lock access",
                phase: "founder_gates",
                owner_lane: "city-launch-agent",
                human_lane: "growth-lead",
                summary: "Lock the first lawful access path.",
                dependency_keys: [],
                success_criteria: ["Lawful access path is named."],
                metrics_dependencies: ["first_lawful_access_path"],
                validation_required: false,
              },
            ],
            metrics_dependencies: [
              { key: "robot_team_inbound_captured", kind: "event", status: "required_not_tracked", owner_lane: "analytics-agent" },
              { key: "proof_path_assigned", kind: "event", status: "required_not_tracked", owner_lane: "analytics-agent" },
              { key: "proof_pack_delivered", kind: "event", status: "required_not_tracked", owner_lane: "analytics-agent" },
              { key: "hosted_review_ready", kind: "event", status: "required_not_tracked", owner_lane: "analytics-agent" },
              { key: "hosted_review_started", kind: "event", status: "required_not_tracked", owner_lane: "analytics-agent" },
              { key: "hosted_review_follow_up_sent", kind: "event", status: "required_not_tracked", owner_lane: "analytics-agent" },
              { key: "human_commercial_handoff_started", kind: "event", status: "required_not_tracked", owner_lane: "analytics-agent" },
              { key: "proof_motion_stalled", kind: "event", status: "required_not_tracked", owner_lane: "analytics-agent" },
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
          },
          null,
          2,
        ),
        "```",
        "",
        "```city-launch-records",
        JSON.stringify(
          {
            schema_version: "2026-04-12.city-launch-research.v1",
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
                amount_usd: 125,
                source_urls: ["https://example.com/budget"],
                explicit_fields: ["amount_usd"],
                inferred_fields: [],
              },
            ],
          },
          null,
          2,
        ),
        "```",
      ].join("\n"),
      "utf8",
    );

    const { materializeCityLaunchResearch } = await import("../utils/cityLaunchResearchMaterializer");
    const result = await materializeCityLaunchResearch({
      city: "Austin, TX",
      launchId: "launch-1",
      budgetPolicy: {
        tier: "low_budget",
        label: "Low Budget",
        maxTotalApprovedUsd: 500,
        operatorAutoApproveUsd: 100,
        allowPaidAcquisition: true,
        allowReferralRewards: false,
        allowTravelReimbursement: true,
        founderApprovalRequiredAboveUsd: 100,
        founderApprovalTriggers: [],
        operatorLane: "growth-lead",
      },
      artifactPath,
    });

    expect(result.status).toBe("failed");
    expect(result.warnings.join("\n")).toContain("Contract violation");
    expect(result.warnings.join("\n")).toContain('unsupported "proof_path" value "hosted_review"');
    expect(result.warnings.join("\n")).toContain('unsupported "category" value "proptech_processing"');
    expect(upsertCityLaunchProspect).not.toHaveBeenCalled();
    expect(upsertCityLaunchBuyerTarget).not.toHaveBeenCalled();
    expect(recordCityLaunchTouch).not.toHaveBeenCalled();
    expect(recordCityLaunchBudgetEvent).not.toHaveBeenCalled();
  });
});
