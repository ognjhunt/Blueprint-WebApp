import { describe, expect, it } from "vitest";
import { classifyFailureSignature, clusterRunFailures } from "./sweep-agent-run-failures.ts";

describe("sweep agent run failures", () => {
  it("classifies the invalid jq /api/runs failure as a shared prompt guardrail gap", () => {
    const signature = classifyFailureSignature({
      run: {
        id: "run-1",
        agentId: "agent-1",
        companyId: "company-1",
        status: "failed",
        contextSnapshot: { issueId: "issue-1" },
        error: null,
      },
      logText: `
        curl -fsS -H "Authorization: Bearer $PAPERCLIP_API_KEY" "http://127.0.0.1:3100/api/runs?agentId=abc&limit=5" | jq '.sort_by| .[-5:] | .[] | {id: .id}'
        jq: error: sort_by/0 is not defined at <top-level>, line 1:
      `,
    });

    expect(signature.key).toBe("paperclip_runs_probe_invalid_jq_issue_bound");
    expect(signature.category).toBe("shared_prompt_guardrail");
  });

  it("classifies Paperclip auth failures separately", () => {
    const signature = classifyFailureSignature({
      run: {
        id: "run-2",
        agentId: "agent-2",
        companyId: "company-1",
        status: "failed",
        error: "401 Unauthorized for /api/agents/me/inbox-lite",
      },
    });

    expect(signature.key).toBe("paperclip_auth_or_env_missing");
    expect(signature.category).toBe("auth_or_env");
  });

  it("clusters matching signatures across different agents", () => {
    const sharedSignature = classifyFailureSignature({
      run: {
        id: "run-1",
        agentId: "agent-1",
        companyId: "company-1",
        status: "failed",
        contextSnapshot: { issueId: "issue-1" },
      },
      logText: `curl http://127.0.0.1:3100/api/runs?agentId=abc | jq '.sort_by' [exit 3]`,
    });

    const clusters = clusterRunFailures([
      {
        run: {
          id: "run-1",
          agentId: "agent-1",
          companyId: "company-1",
          status: "failed",
        },
        agent: { id: "agent-1", name: "Notion Manager Agent", urlKey: "notion-manager-agent" },
        issues: [{ id: "issue-1", identifier: "BLU-3619" }],
        bestText: "jq: error: sort_by/0 is not defined",
        signature: sharedSignature,
        stalled: false,
      },
      {
        run: {
          id: "run-2",
          agentId: "agent-2",
          companyId: "company-1",
          status: "timed_out",
        },
        agent: { id: "agent-2", name: "Notion Reconciler", urlKey: "notion-reconciler" },
        issues: [{ id: "issue-2", identifier: "BLU-3620" }],
        bestText: "jq: error: sort_by/0 is not defined",
        signature: sharedSignature,
        stalled: false,
      },
    ]);

    expect(clusters).toHaveLength(1);
    expect(clusters[0]?.count).toBe(2);
    expect(clusters[0]?.agentKeys).toContain("notion-manager-agent");
    expect(clusters[0]?.agentKeys).toContain("notion-reconciler");
    expect(clusters[0]?.issueIdentifiers).toContain("BLU-3619");
    expect(clusters[0]?.issueIdentifiers).toContain("BLU-3620");
  });

  it("classifies provider timeouts and process loss into actionable runtime families", () => {
    const timeoutSignature = classifyFailureSignature({
      run: {
        id: "run-timeout",
        agentId: "agent-timeout",
        companyId: "company-1",
        status: "timed_out",
      },
      logText: "Hermes timed out while running arcee-ai/trinity-large-preview:free via openrouter.",
    });

    const processLossSignature = classifyFailureSignature({
      run: {
        id: "run-process-loss",
        agentId: "agent-loss",
        companyId: "company-1",
        status: "failed",
      },
      logText: "Process lost -- server may have restarted",
    });

    expect(timeoutSignature.key).toBe("provider_or_model_timeout");
    expect(processLossSignature.key).toBe("process_loss_or_service_restart");
  });
});
