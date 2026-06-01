// @vitest-environment node
import { describe, expect, it } from "vitest";

import { buildBudgetDelegationPacket, renderMarkdown } from "./generate-budget-delegation-packet";

const summary = {
  budget_cap_usd: 500,
  target_total_usd: 500,
  proof_scope: {
    repo_local_controls_implemented: true,
    live_billing_verified: false,
    live_mutation_attempted: false,
    operational_launch_ready_claimed: false,
  },
  paperclip_compression: {
    declared_agent_budget_after_usd: 173,
    active_routines_after: 26,
    paused_routines_after: 36,
  },
  budget_ledger: [
    {
      line: "Paperclip agent/runtime envelope",
      target_usd: 173,
      owner_system: "Paperclip company config",
      proof_level: "repo-local",
    },
    {
      line: "Codex OAuth / Pro subscription seat",
      target_usd: 0,
      owner_system: "Human OpenAI subscription billing",
      proof_level: "estimate",
    },
    {
      line: "OpenAI API costs (approval-only guardrail)",
      target_usd: 0,
      owner_system: "OpenAI organization billing",
      proof_level: "live-verified",
    },
    {
      line: "DeepSeek direct model reserve",
      target_usd: 80,
      owner_system: "DeepSeek API account",
      proof_level: "estimate",
    },
    {
      line: "Paid city/launch experiments",
      target_usd: 50,
      owner_system: "Meta/ads/provider accounts",
      proof_level: "estimate",
    },
  ],
  live_proof_gaps: ["DeepSeek direct usage export", "Ad account spend proof"],
};

const recommendations = {
  budget_cap_usd: 500,
  projected_target_total_usd: 500,
  projected_budget_lines: {
    "Paperclip agent/runtime envelope": 173,
    "OpenAI API costs (approval-only guardrail)": 0,
    "DeepSeek direct model reserve": 80,
    "Paid city/launch experiments": 50,
  },
  human_approval_required: false,
  live_proof_gaps: ["fresh allocation-grade outcome evidence"],
  recommendations: [
    {
      id: "no_reallocation_improve_proof_first",
      action: "no_reallocation",
      from_budget_line: null,
      to_budget_line: null,
      amount_usd: 0,
      approval_required: false,
      proof_level: "missing",
      evidence_refs: [],
      missing_proof: ["fresh allocation-grade outcome evidence"],
      advisory_only: true,
      live_mutation_attempted: false,
    },
  ],
};

const nextGoalQueue = {
  queue: [
    {
      rank: 1,
      goal_command: "/goal Build a live-billing evidence packet for the $500 budget without mutating providers",
      lane: "billing-proof",
      owner: "finance-support-agent",
      budget_boundary_usd: 500,
      safe_commands: ["npm run autonomy:budget:verify"],
      success_criteria: ["Proof attached."],
      blocked_claims: ["No live spend is verified until proof is accepted."],
      requires_human_approval_before_live_action: true,
      live_mutation_allowed: false,
    },
    {
      rank: 2,
      goal_command: "/goal Build the one-city launch proof packet under a $10 paid-test ceiling",
      lane: "city-launch-proof",
      owner: "city-launch-agent",
      budget_boundary_usd: 10,
      safe_commands: ["npm run city-launch:preflight -- --city \"<city>\""],
      success_criteria: ["Approval packet exists."],
      blocked_claims: ["No ad activation claim."],
      requires_human_approval_before_live_action: true,
      live_mutation_allowed: false,
    },
  ],
};

const liveProofValidation = {
  proof_ready_to_count_as_live_billing: false,
  totals: {
    total_items: 2,
    accepted_for_manual_review: 0,
    missing_submission: 2,
    rejected: 0,
  },
  items: [
    {
      id: "deepseek-openrouter-usage-export",
      validation_status: "missing_submission",
      target_usd: 80,
      approval_required_before_live_spend_change: true,
      live_mutation_allowed: false,
    },
    {
      id: "ad-spend-paused-draft-proof",
      validation_status: "missing_submission",
      target_usd: 50,
      approval_required_before_live_spend_change: true,
      live_mutation_allowed: false,
    },
  ],
};

describe("autonomous budget delegation packet", () => {
  it("delegates owner work without authorizing live spend or mutation", () => {
    const packet = buildBudgetDelegationPacket({
      summary,
      recommendations,
      nextGoalQueue,
      liveProofValidation,
      now: new Date("2026-06-01T12:00:00.000Z"),
    });

    expect(packet).toMatchObject({
      schema: "blueprint/autonomous-budget-delegation-packet/v1",
      state: "awaiting_human_decision",
      budget_cap_usd: 500,
      target_total_usd: 500,
      paperclip_declared_envelope_usd: 173,
      codex_oauth_pro_excluded_from_budget: true,
      openai_api_target_usd: 0,
      no_live_mutation_authorized: true,
      live_billing_verified: false,
    });
    expect(packet.allocator).toMatchObject({
      recommendation_state: "no_reallocation_improve_proof_first",
      spend_affecting_recommendation_count: 0,
      projected_target_total_usd: 500,
      live_mutation_attempted: false,
    });
    expect(packet.work_orders).toHaveLength(2);
    expect(packet.work_orders.every((order) => order.can_spend_without_human_approval === false)).toBe(true);
    expect(packet.work_orders.every((order) => order.can_mutate_live_systems === false)).toBe(true);
    expect(packet.work_orders.every((order) => order.live_mutation_allowed === false)).toBe(true);
  });

  it("assigns budget lines to owners and keeps blocked spend as approval-packet-only", () => {
    const packet = buildBudgetDelegationPacket({
      summary,
      recommendations,
      nextGoalQueue,
      liveProofValidation,
      now: new Date("2026-06-01T12:00:00.000Z"),
    });

    const deepseek = packet.budget_line_delegations.find((line) => line.budget_line === "DeepSeek direct model reserve");
    const codex = packet.budget_line_delegations.find((line) => line.budget_line === "Codex OAuth / Pro subscription seat");
    const city = packet.budget_line_delegations.find((line) => line.budget_line === "Paid city/launch experiments");

    expect(codex).toMatchObject({
      authority: "observe_and_report",
      spend_release_status: "not_spendable",
    });
    expect(deepseek).toMatchObject({
      owner: "finance-support-agent",
      authority: "prepare_approval_packet",
      spend_release_status: "approval_packet_only",
    });
    expect(city).toMatchObject({
      owner: "city-launch-agent",
      authority: "prepare_approval_packet",
      spend_release_status: "approval_packet_only",
    });
  });

  it("renders live action boundaries", () => {
    const packet = buildBudgetDelegationPacket({
      summary,
      recommendations,
      nextGoalQueue,
      liveProofValidation,
      now: new Date("2026-06-01T12:00:00.000Z"),
    });

    const markdown = renderMarkdown(packet);

    expect(markdown).toContain("does not authorize live spend");
    expect(markdown).toContain("Live mutation allowed: no");
    expect(markdown).toContain("Required Checks Before Any Live Action");
    expect(markdown).toContain("npm run autonomy:budget:live-action-gate -- --require-live-action-ready");
  });
});
