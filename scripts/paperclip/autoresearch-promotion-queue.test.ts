import { describe, expect, it } from "vitest";
import {
  buildAutoResearchPromotionQueue,
  buildAutoResearchPromotionQueueMarkdown,
  type AutoResearchPromotionQueueItem,
} from "./autoresearch-promotion-queue.ts";

function expectRequiredQueueFields(item: AutoResearchPromotionQueueItem) {
  expect(item.owner).toBeTruthy();
  expect(item.targetFile).toBeTruthy();
  expect(item.expectedNegativeControl).toBeTruthy();
  expect(item.validationCommand).toBeTruthy();
  expect(item.promotionThreshold).toBeTruthy();
  expect(item.rollbackCondition).toBeTruthy();
  expect(item.residualRisk).toBeTruthy();
}

describe("autoresearch promotion queue", () => {
  it("turns classified failures into deterministic queue items with required promotion gates", () => {
    const queue = buildAutoResearchPromotionQueue({
      paperclipApiUrl: "http://127.0.0.1:3100",
      clusters: [
        {
          signature: {
            key: "generic:unclassified-agent-loop",
            title: "Unclassified agent loop",
            category: "unknown",
          },
          count: 1,
          agentKeys: ["analytics-agent"],
          runIds: ["run-generic"],
          issueIdentifiers: ["BLU-404"],
        },
        {
          signature: {
            key: "paperclip_runs_probe_invalid_jq_issue_bound",
            title: "Issue-bound wake widened into /api/runs probing and failed on invalid jq",
            category: "shared_prompt_guardrail",
          },
          count: 3,
          agentKeys: ["notion-manager-agent", "blueprint-chief-of-staff"],
          runIds: ["run-1", "run-2", "run-3"],
          issueIdentifiers: ["BLU-100", "BLU-101"],
        },
        {
          signature: {
            key: "openrouter_provider_auth_unavailable",
            title: "OpenRouter provider auth blocked Hermes runs",
            category: "auth_or_env",
            blockerId: "paperclip-provider-auth-openrouter",
          },
          count: 2,
          agentKeys: ["growth-lead"],
          runIds: ["run-auth-1", "run-auth-2"],
        },
        {
          signature: {
            key: "provider_quota_or_rate_limit_marked_succeeded",
            title: "Provider quota/rate-limit failure was recorded as succeeded",
            category: "runtime_capacity",
          },
          count: 2,
          agentKeys: ["blueprint-chief-of-staff"],
          runIds: ["run-quota-1", "run-quota-2"],
        },
      ],
    });

    expect(queue.map((item) => item.sourceFailureFamily)).toEqual([
      "paperclip_runs_probe_invalid_jq_issue_bound",
      "openrouter_provider_auth_unavailable",
      "provider_quota_or_rate_limit_marked_succeeded",
      "generic:unclassified-agent-loop",
    ]);

    for (const item of queue) {
      expectRequiredQueueFields(item);
      expect(item.proofPaths).toContain("source=http://127.0.0.1:3100");
      expect(item.blockedClaims.join(" ")).not.toContain("ready to launch");
    }

    expect(queue[0]).toMatchObject({
      lane: "prompt_patch",
      owner: "blueprint-chief-of-staff",
      targetFile: "ops/paperclip/blueprint-company/hermes-profiles/orchestrator-task-template.md",
    });
    expect(queue[1]).toMatchObject({
      lane: "policy_patch",
      owner: "blueprint-cto",
      targetFile: "docs/ai-skills-governance-2026-04-07.md",
    });
    expect(queue[2]).toMatchObject({
      lane: "closeout_rule_patch",
      owner: "webapp-codex",
      targetFile: "server/agents/goal-closeout-contract.ts",
    });
    expect(queue[3]).toMatchObject({
      lane: "autoagent_eval",
      owner: "webapp-codex",
      targetFile: "labs/autoagent/tasks/agent-failure-promotion/CASE_FORMAT.md",
    });
  });

  it("renders a repo-local markdown queue without authorizing production behavior", () => {
    const queue = buildAutoResearchPromotionQueue({
      clusters: [
        {
          signature: {
            key: "stalled_run_without_output",
            title: "Queued or running run produced no useful output",
            category: "runtime_capacity",
          },
          count: 1,
          agentKeys: ["ops-lead"],
          runIds: ["run-stalled"],
        },
      ],
    });

    const markdown = buildAutoResearchPromotionQueueMarkdown({
      generatedAt: "2026-05-28T12:00:00.000Z",
      queue,
    });

    expect(markdown).toContain("Repo-local candidate queue only");
    expect(markdown).toContain("Expected negative control");
    expect(markdown).toContain("Validation command");
    expect(markdown).toContain("Promotion threshold");
    expect(markdown).toContain("Rollback condition");
    expect(markdown).toContain("Residual risk");
    expect(markdown).toContain("does not authorize live sends");
    expect(markdown).toContain("production Paperclip mutation");
  });
});
