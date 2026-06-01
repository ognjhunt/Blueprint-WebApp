// @vitest-environment node
import { describe, expect, it } from "vitest";

import { buildBudgetLiveActionGate, gateExitCode } from "./verify-budget-live-action-gate";

const recommendations = {
  budget_cap_usd: 500,
  projected_target_total_usd: 500,
  human_approval_required: false,
  recommendations: [
    {
      id: "no_reallocation_improve_proof_first",
      action: "no_reallocation",
      approval_required: false,
      live_mutation_attempted: false,
      proof_level: "missing",
    },
  ],
};

const liveProofValidation = {
  proof_ready_to_count_as_live_billing: false,
  totals: {
    accepted_for_manual_review: 0,
    missing_submission: 2,
    rejected: 0,
  },
  items: [
    {
      id: "deepseek-openrouter-usage-export",
      validation_status: "missing_submission",
      live_mutation_allowed: false,
    },
  ],
};

function delegation(overrides: Partial<Parameters<typeof buildBudgetLiveActionGate>[0]["delegationPacket"]> = {}) {
  return {
    schema: "blueprint/autonomous-budget-delegation-packet/v1",
    state: "awaiting_human_decision",
    budget_cap_usd: 500,
    target_total_usd: 500,
    codex_oauth_pro_excluded_from_budget: true,
    openai_api_target_usd: 0,
    no_live_mutation_authorized: true,
    live_billing_verified: false,
    allocator: {
      spend_affecting_recommendation_count: 0,
      human_approval_required: false,
      live_mutation_attempted: false,
    },
    proof_gate: {
      proof_ready_to_count_as_live_billing: false,
      missing_submission: 2,
      rejected: 0,
    },
    work_orders: [
      {
        goal_command: "/goal Build a live-billing evidence packet for the $500 budget without mutating providers",
        can_spend_without_human_approval: false,
        can_mutate_live_systems: false,
        live_mutation_allowed: false,
        requires_human_approval_before_live_action: true,
      },
    ],
    required_checks_before_any_live_action: [
      "npm run autonomy:budget:live-proof:validate -- --require-complete",
      "npm run autonomy:budget:delegate",
      "npm run autonomy:budget:control-suite",
    ],
    live_delegation_blockers: ["deepseek-openrouter-usage-export: missing_submission"],
    ...overrides,
  };
}

describe("autonomous budget live action gate", () => {
  it("passes validation while blocking live action when proof and approval are missing", () => {
    const gate = buildBudgetLiveActionGate({
      delegationPacket: delegation(),
      liveProofValidation,
      recommendations,
      now: new Date("2026-06-01T12:00:00.000Z"),
    });

    expect(gate).toMatchObject({
      schema: "blueprint/autonomous-budget-live-action-gate/v1",
      state: "live_action_blocked",
      validation_pass: true,
      live_action_allowed: false,
      repo_local_work_allowed: true,
      budget_cap_usd: 500,
      codex_oauth_pro_excluded_from_budget: true,
      openai_api_target_usd: 0,
    });
    expect(gate.blockers.join("\n")).toContain("live_billing_verified");
    expect(gate.blockers.join("\n")).toContain("approval_artifact_required");
    expect(gateExitCode(gate)).toBe(0);
  });

  it("fails strict mode while live action remains blocked", () => {
    const gate = buildBudgetLiveActionGate({
      delegationPacket: delegation(),
      liveProofValidation,
      recommendations,
      strictLiveActionReadyRequired: true,
      now: new Date("2026-06-01T12:00:00.000Z"),
    });

    expect(gate.live_action_allowed).toBe(false);
    expect(gateExitCode(gate)).toBe(1);
  });

  it("fails validation if any work order allows live mutation or spend without approval", () => {
    const gate = buildBudgetLiveActionGate({
      delegationPacket: delegation({
        work_orders: [
          {
            goal_command: "/goal Unsafe",
            can_spend_without_human_approval: true,
            can_mutate_live_systems: true,
            live_mutation_allowed: true,
            requires_human_approval_before_live_action: false,
          },
        ],
      }),
      liveProofValidation,
      recommendations,
      now: new Date("2026-06-01T12:00:00.000Z"),
    });

    expect(gate.validation_pass).toBe(false);
    expect(gate.errors.join("\n")).toContain("work_orders_safe");
    expect(gate.errors.join("\n")).toContain("work_orders_human_gated");
    expect(gateExitCode(gate)).toBe(1);
  });
});
