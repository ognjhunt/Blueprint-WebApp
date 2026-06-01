// @vitest-environment node
import { describe, expect, it } from "vitest";

import { buildNextGoalQueue, renderMarkdown } from "./generate-budget-next-goal-queue";

describe("autonomous budget next-goal queue", () => {
  it("emits exactly five ranked local goals with budget and live-mutation guardrails", () => {
    const report = buildNextGoalQueue(new Date("2026-06-01T12:00:00.000Z"));

    expect(report).toMatchObject({
      schema: "blueprint/autonomous-budget-next-goal-queue/v1",
      state: "awaiting_human_decision",
      budget_cap_usd: 500,
      paperclip_declared_envelope_usd: 173,
      deepseek_direct_model_reserve_usd: 80,
      no_live_mutation_authorized: true,
      codex_oauth_pro_excluded_from_budget: true,
      openai_api_target_usd: 0,
    });
    expect(report.queue).toHaveLength(5);
    expect(report.queue.map((item) => item.rank)).toEqual([1, 2, 3, 4, 5]);
    expect(report.queue.every((item) => item.goal_command.startsWith("/goal "))).toBe(true);
    expect(report.queue.every((item) => item.safe_commands.length > 0)).toBe(true);
    expect(report.queue.every((item) => item.success_criteria.length > 0)).toBe(true);
    expect(report.queue.every((item) => item.blocked_claims.length > 0)).toBe(true);
    expect(report.queue.every((item) => item.requires_human_approval_before_live_action)).toBe(true);
    expect(report.queue.every((item) => item.live_mutation_allowed === false)).toBe(true);
    expect(report.queue.every((item) => item.live_mutation_allowed_without_human_approval === false)).toBe(true);
    expect(report.queue.every((item) => item.codex_oauth_pro_budget_treatment === "excluded_from_500_budget")).toBe(true);
    expect(report.queue.every((item) => item.openai_api_budget_treatment === "target_zero_unless_approved")).toBe(true);
  });

  it("renders the Codex/OAuth exclusion and OpenAI API zero-spend guardrail", () => {
    const markdown = renderMarkdown(buildNextGoalQueue(new Date("2026-06-01T12:00:00.000Z")));

    expect(markdown).toContain("Codex OAuth/Pro is excluded from the $500 budget");
    expect(markdown).toContain("OpenAI API target remains $0 unless explicitly approved");
    expect(markdown).toContain("No live mutation is authorized");
  });
});
