// @vitest-environment node
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const upsertCityLaunchProspect = vi.hoisted(() => vi.fn());
const upsertCityLaunchBuyerTarget = vi.hoisted(() => vi.fn());
const recordCityLaunchTouch = vi.hoisted(() => vi.fn());
const recordCityLaunchBudgetEvent = vi.hoisted(() => vi.fn());

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
  it("writes idempotent ledger records from a structured playbook", async () => {
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
});
