// @vitest-environment node
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildBudgetRecommendations,
  verifyDynamicBudgetAllocation,
  type AllocationPolicy,
  type BudgetRecommendations,
  type OutcomeSnapshot,
  type SpendSnapshotLike,
} from "./dynamic-budget-allocator-core";

const fixtureRoot = path.resolve("scripts/autonomy/fixtures/dynamic-budget");

function readFixture<T>(name: string): T {
  return JSON.parse(fs.readFileSync(path.join(fixtureRoot, name), "utf8")) as T;
}

function readPolicy(): AllocationPolicy {
  return readFixture<AllocationPolicy>("policy.json");
}

function readSpendSnapshot(): SpendSnapshotLike {
  return readFixture<SpendSnapshotLike>("spend-snapshot.json");
}

function recommend(outcomeFixture: string) {
  return buildBudgetRecommendations({
    policy: readPolicy(),
    spendSnapshot: readSpendSnapshot(),
    outcomeSnapshot: readFixture<OutcomeSnapshot>(outcomeFixture),
    budgetSummary: readFixture("budget-summary.json"),
  });
}

describe("dynamic autonomous budget allocator", () => {
  it("recommends a bounded move from a low-proof P1/P2 line to high-performing hosted review evidence", () => {
    const result = recommend("outcomes-high-performing-hosted-review.json");

    const move = result.recommendations.find((entry) => entry.action === "reallocate");

    expect(move).toMatchObject({
      from_budget_line: "Search / research APIs",
      to_budget_line: "Recipient evidence enrichment",
      amount_usd: 40,
      approval_required: true,
      live_mutation_attempted: false,
      proof_level: "repo-local-export",
    });
    expect(move?.evidence_refs).toContain(
      "scripts/autonomy/fixtures/dynamic-budget/outcomes-high-performing-hosted-review.json#exact_site_hosted_review",
    );
    expect(result.projected_target_total_usd).toBeLessThanOrEqual(500);
  });

  it("emits no reallocation when outcome proof is missing", () => {
    const result = recommend("outcomes-missing-proof.json");

    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0]).toMatchObject({
      action: "no_reallocation",
      approval_required: false,
      reason_code: "improve_proof_first",
    });
  });

  it("emits no reallocation when otherwise useful proof is stale", () => {
    const result = recommend("outcomes-stale-proof.json");

    expect(result.recommendations[0]).toMatchObject({
      action: "no_reallocation",
      reason_code: "improve_proof_first",
    });
    expect(result.recommendations[0]?.missing_proof).toEqual(
      expect.arrayContaining(["fresh allocation-grade outcome evidence"]),
    );
  });

  it("keeps OpenAI API target at zero without an approval artifact", () => {
    const result = recommend("outcomes-openai-high-signal.json");

    expect(result.projected_budget_lines["OpenAI API costs (approval-only guardrail)"]).toBe(0);
    expect(result.recommendations.every((entry) => entry.to_budget_line !== "OpenAI API costs (approval-only guardrail)")).toBe(true);
  });

  it("marks paid city and ads recommendations as human-approval required", () => {
    const result = recommend("outcomes-paid-city-ads-current.json");

    const move = result.recommendations.find((entry) => entry.to_budget_line === "Paid city/launch experiments");

    expect(move).toMatchObject({
      action: "reallocate",
      approval_required: true,
      human_gate: "budget_vendor_or_live_spend_change",
      live_mutation_attempted: false,
    });
  });

  it("keeps live provider mutation impossible in default local mode", () => {
    const result = recommend("outcomes-high-performing-hosted-review.json");

    expect(result.mode).toMatchObject({
      default_local_only: true,
      live_read_enabled: false,
      live_mutation_attempted: false,
    });
    expect(result.recommendations.every((entry) => entry.live_mutation_attempted === false)).toBe(true);
  });

  it("protects P0 product, proof, intake, support, and reliability minimums", () => {
    const result = recommend("outcomes-p0-low-proof.json");

    expect(result.recommendations.every((entry) => entry.from_budget_line !== "Paperclip agent/runtime envelope")).toBe(true);
    expect(result.projected_budget_lines["Paperclip agent/runtime envelope"]).toBeGreaterThanOrEqual(173);
  });

  it("verifier blocks fixture proof being treated as live performance proof", () => {
    const bad: BudgetRecommendations = {
      ...recommend("outcomes-high-performing-hosted-review.json"),
      recommendations: [
        {
          id: "bad_fixture_live_claim",
          action: "reallocate",
          reason_code: "allocation_grade_signal",
          from_budget_line: "Search / research APIs",
          to_budget_line: "Recipient evidence enrichment",
          amount_usd: 40,
          approval_required: true,
          human_gate: "budget_vendor_or_live_spend_change",
          proof_level: "fixture",
          confidence: 0.82,
          evidence_refs: ["fixture://exact-site"],
          missing_proof: [],
          advisory_only: false,
          live_mutation_attempted: false,
          summary: "Invalid fixture proof claim.",
        },
      ],
    };

    const verification = verifyDynamicBudgetAllocation({
      recommendations: bad,
      policy: readPolicy(),
    });

    expect(verification.pass).toBe(false);
    expect(verification.errors.join("\n")).toContain("fixture proof cannot justify spend-affecting recommendations");
  });
});
