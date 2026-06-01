// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  buildBudgetControlStatus,
  renderMarkdown,
  statusExitCode,
} from "./summarize-budget-control-status";

const summary = {
  state_claimed: "awaiting_human_decision",
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
  live_proof_gaps: ["Render billing", "DeepSeek direct usage export"],
};

const audit = {
  state_claimed_for_live_budget_truth: "awaiting_human_decision",
  live_mutation_attempted: false,
  completion_summary: {
    repo_local_budget_controls_complete: true,
    live_billing_truth_complete: false,
    goal_can_be_marked_complete_without_billing_exports: false,
  },
};

const verification = {
  pass: true,
  computed: {
    declared_agent_budget_usd: 173,
    active_routines: 26,
    paused_routines: 36,
    budget_ledger_target_total_usd: 500,
    spend_registry_target_total_usd: 500,
    next_goal_queue_items: 5,
    budget_delegation_work_orders: 5,
    budget_delegation_spend_without_approval_items: 0,
    live_action_gate_blocker_count: 5,
    live_action_allowed: false,
  },
  proof_boundary: {
    repo_local_controls_verified: true,
    live_billing_verified: false,
    live_mutation_attempted: false,
    goal_complete_without_billing_exports: false,
  },
};

const delegation = {
  state: "awaiting_human_decision",
  budget_cap_usd: 500,
  target_total_usd: 500,
  live_billing_verified: false,
  no_live_mutation_authorized: true,
  proof_gate: {
    proof_ready_to_count_as_live_billing: false,
    missing_submission: 2,
    rejected: 0,
  },
  work_orders: [
    {
      can_spend_without_human_approval: false,
      can_mutate_live_systems: false,
      live_mutation_allowed: false,
      requires_human_approval_before_live_action: true,
    },
  ],
  required_checks_before_any_live_action: [
    "npm run autonomy:budget:live-action-gate -- --require-live-action-ready",
  ],
  live_delegation_blockers: ["Render billing"],
};

const liveActionGate = {
  state: "live_action_blocked",
  validation_pass: true,
  live_action_allowed: false,
  repo_local_work_allowed: true,
  blocker_count: 5,
  error_count: 0,
  mode: {
    no_live_provider_calls_made: true,
    no_live_mutation_attempted: true,
    secrets_persisted: false,
  },
  blockers: ["live_billing_verified"],
  errors: [],
  required_before_live_action: [
    "npm run autonomy:budget:live-proof:validate -- --require-complete",
    "npm run autonomy:budget:live-action-gate -- --require-live-action-ready",
  ],
};

describe("budget control status", () => {
  it("allows repo-local allocation and delegation while blocking live spend", () => {
    const status = buildBudgetControlStatus({
      summary,
      audit,
      verification,
      delegation,
      liveActionGate,
      now: new Date("2026-06-01T12:00:00.000Z"),
    });

    expect(status).toMatchObject({
      schema: "blueprint/autonomous-budget-control-status/v1",
      state: "repo_local_controls_ready_live_action_blocked",
      validation_pass: true,
      can_allocate_repo_local: true,
      can_delegate_repo_local: true,
      can_mutate_live_spend: false,
      can_claim_live_budget_complete: false,
      can_claim_operational_launch_ready: false,
      codex_oauth_pro_excluded_from_budget: true,
      openai_api_target_usd: 0,
      delegation_spend_without_approval_items: 0,
      delegation_live_mutation_allowed_items: 0,
    });
    expect(status.blockers.join("\n")).toContain("live_billing_complete");
    expect(statusExitCode(status)).toBe(0);
  });

  it("fails strict mode while live action is still blocked", () => {
    const status = buildBudgetControlStatus({
      summary,
      audit,
      verification,
      delegation,
      liveActionGate,
      strictLiveActionReadyRequired: true,
      now: new Date("2026-06-01T12:00:00.000Z"),
    });

    expect(status.can_mutate_live_spend).toBe(false);
    expect(statusExitCode(status)).toBe(1);
  });

  it("fails validation when delegation allows spend without approval", () => {
    const status = buildBudgetControlStatus({
      summary,
      audit,
      verification,
      delegation: {
        ...delegation,
        work_orders: [
          {
            can_spend_without_human_approval: true,
            can_mutate_live_systems: true,
            live_mutation_allowed: true,
            requires_human_approval_before_live_action: false,
          },
        ],
      },
      liveActionGate,
      now: new Date("2026-06-01T12:00:00.000Z"),
    });

    expect(status.validation_pass).toBe(false);
    expect(status.errors.join("\n")).toContain("delegation_safe");
    expect(statusExitCode(status)).toBe(1);
  });

  it("renders the operational answer agents need", () => {
    const status = buildBudgetControlStatus({
      summary,
      audit,
      verification,
      delegation,
      liveActionGate,
      now: new Date("2026-06-01T12:00:00.000Z"),
    });

    const markdown = renderMarkdown(status);

    expect(markdown).toContain("Repo-local allocation allowed: yes");
    expect(markdown).toContain("Live spend mutation allowed: no");
    expect(markdown).toContain("npm run autonomy:budget:live-action-gate -- --require-live-action-ready");
  });
});
