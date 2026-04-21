import { describe, expect, it } from "vitest";
import {
  classifyFailureSignature,
  clusterRunFailures,
  isLogicalFailureSucceededRun,
  resolveSinceTimestamp,
  splitRecoveredCandidates,
} from "./sweep-agent-run-failures.ts";

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
        {"type":"item.started","item":{"id":"item_1","type":"command_execution","command":"curl -fsS -H \\"Authorization: Bearer $PAPERCLIP_API_KEY\\" \\"http://127.0.0.1:3100/api/runs?agentId=abc&limit=5\\" | jq '.sort_by| .[-5:] | .[] | {id: .id}'","aggregated_output":"","exit_code":null,"status":"in_progress"}}
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
      logText: `{"type":"item.started","item":{"id":"item_1","type":"command_execution","command":"curl http://127.0.0.1:3100/api/runs?agentId=abc | jq '.sort_by'","aggregated_output":"","exit_code":null,"status":"in_progress"}} [exit 3]`,
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

  it("does not misclassify source-file mentions of /api/runs as live probing", () => {
    const signature = classifyFailureSignature({
      run: {
        id: "run-doc-mention",
        agentId: "agent-doc",
        companyId: "company-1",
        status: "failed",
        contextSnapshot: { issueId: "issue-1" },
      },
      logText: `
        {"type":"item.completed","item":{"id":"item_1","type":"command_execution","command":"sed -n '1,120p' scripts/paperclip/sweep-agent-run-failures.test.ts","aggregated_output":"scripts/paperclip/sweep-agent-run-failures.test.ts:21: curl -fsS -H \\"Authorization: Bearer $PAPERCLIP_API_KEY\\" \\"http://127.0.0.1:3100/api/runs?agentId=abc&limit=5\\" | jq '.sort_by| .[-5:] | .[] | {id: .id}'","exit_code":0,"status":"completed"}}
      `,
    });

    expect(signature.key).not.toBe("paperclip_runs_probe_issue_bound");
    expect(signature.key).not.toBe("paperclip_runs_probe_invalid_jq_issue_bound");
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

  it("classifies Codex local exec tooling loss as a shared tooling family", () => {
    const signature = classifyFailureSignature({
      run: {
        id: "run-tool-runtime",
        agentId: "agent-tool-runtime",
        companyId: "company-1",
        status: "failed",
        errorCode: "tool_runtime_unavailable",
        exitCode: 0,
      },
      logText: `
        ERROR codex_core::tools::router: error=exec_command failed for /bin/bash -lc "pwd": CreateProcess { message: "Rejected(\\"Failed to create unified exec process: No such file or directory (os error 2)\\")" }
        {"type":"turn.completed","usage":{"input_tokens":1,"cached_input_tokens":0,"output_tokens":1}}
      `,
    });

    expect(signature.key).toBe("codex_local_exec_tooling_unavailable");
    expect(signature.category).toBe("tooling_gap");
  });

  it("detects succeeded runs that only contain terminal provider failures", () => {
    const run = {
      id: "run-succeeded-rate-limit",
      agentId: "agent-rate-limit",
      companyId: "company-1",
      status: "succeeded",
    };
    const logText = `
      [hermes] Starting Hermes Agent (1/11, model=arcee-ai/trinity-large-preview:free, provider=openrouter [adapterConfig], timeout=1800s)
      Max retries (3) exhausted - trying fallback...
      Final error: HTTP 429: Rate limit exceeded: free-models-per-min.
      API call failed after 3 retries: HTTP 429: Rate limit exceeded: free-models-per-min.
      [hermes] Exit code: 0, timed out: false
    `;

    expect(isLogicalFailureSucceededRun({ run, logText })).toBe(true);
    expect(classifyFailureSignature({ run, logText }).key).toBe("provider_quota_or_rate_limit_marked_succeeded");
  });

  it("does not misclassify explicit 429 ladder failures as timeouts", () => {
    const signature = classifyFailureSignature({
      run: {
        id: "run-failed-429",
        agentId: "agent-429",
        companyId: "company-1",
        status: "failed",
      },
      logText: `
        [hermes] Starting Hermes Agent (1/6, model=openai/gpt-oss-120b:free, provider=openrouter [modelInference], timeout=1800s)
        Error: HTTP 429: Rate limit exceeded: free-models-per-day-high-balance.
        API call failed after 3 retries: HTTP 429: Rate limit exceeded: free-models-per-day-high-balance.
      `,
    });

    expect(signature.key).toBe("provider_quota_or_rate_limit");
    expect(signature.title).toBe("Provider quota/rate-limit interrupted the run");
  });

  it("treats succeeded 402 provider-credit failures as the same runtime-capacity family", () => {
    const signature = classifyFailureSignature({
      run: {
        id: "run-succeeded-402",
        agentId: "agent-402",
        companyId: "company-1",
        status: "succeeded",
      },
      logText: `
        [hermes] Starting Hermes Agent (model=z-ai/glm-5.1, provider=openrouter [adapterConfig], timeout=1800s)
        Error: HTTP 402: Insufficient credits. Add more using https://openrouter.ai/settings/credits
        Non-retryable client error (HTTP 402). Aborting.
        [hermes] Exit code: 0, timed out: false
      `,
    });

    expect(signature.key).toBe("provider_quota_or_rate_limit_marked_succeeded");
    expect(signature.category).toBe("runtime_capacity");
  });

  it("classifies succeeded runs with dead model ids as provider/model contract failures", () => {
    const signature = classifyFailureSignature({
      run: {
        id: "run-succeeded-404",
        agentId: "agent-404",
        companyId: "company-1",
        status: "succeeded",
      },
      logText: `
        [hermes] Starting Hermes Agent (1/11, model=stepfun/step-3.5-flash:free, provider=openrouter [adapterConfig], timeout=1800s)
        Error: HTTP 404: No endpoints found for stepfun/step-3.5-flash:free.
        Non-retryable client error (HTTP 404). Aborting.
        [hermes] Exit code: 0, timed out: false
      `,
    });

    expect(signature.key).toBe("provider_model_contract_failure_marked_succeeded");
    expect(signature.category).toBe("route_contract");
  });

  it("resolves --since-hours into an ISO cutoff", () => {
    expect(
      resolveSinceTimestamp({
        sinceHours: 6,
        now: new Date("2026-04-10T12:00:00.000Z"),
      }),
    ).toBe("2026-04-10T06:00:00.000Z");
  });

  it("suppresses quota failures that already have a later recovered retry on the same task", () => {
    const signature = classifyFailureSignature({
      run: {
        id: "run-quota-failed",
        agentId: "agent-1",
        companyId: "company-1",
        status: "failed",
        contextSnapshot: {
          issueId: "issue-1",
          taskId: "issue-1",
          taskKey: "issue-1",
        },
      },
      logText: "API call failed after 3 retries: HTTP 429: Rate limit exceeded: free-models-per-min.",
    });

    const split = splitRecoveredCandidates(
      [
        {
          run: {
            id: "run-quota-failed",
            agentId: "agent-1",
            companyId: "company-1",
            status: "failed",
            createdAt: "2026-04-13T12:00:00.000Z",
            contextSnapshot: {
              issueId: "issue-1",
              taskId: "issue-1",
              taskKey: "issue-1",
            },
          },
          agent: { id: "agent-1", name: "Ops Lead", urlKey: "ops-lead" },
          issues: [{ id: "issue-1", identifier: "BLU-1" }],
          bestText: "HTTP 429: Rate limit exceeded: free-models-per-min.",
          signature,
          stalled: false,
        },
      ],
      [
        {
          id: "run-quota-failed",
          agentId: "agent-1",
          companyId: "company-1",
          status: "failed",
          createdAt: "2026-04-13T12:00:00.000Z",
          contextSnapshot: {
            issueId: "issue-1",
            taskId: "issue-1",
            taskKey: "issue-1",
          },
        },
        {
          id: "run-quota-retry",
          agentId: "agent-1",
          companyId: "company-1",
          status: "running",
          createdAt: "2026-04-13T12:05:00.000Z",
          startedAt: "2026-04-13T12:05:00.000Z",
          contextSnapshot: {
            issueId: "issue-1",
            taskId: "issue-1",
            taskKey: "issue-1",
            wakeReason: "quota_fallback_to_codex_local_after_shared_openrouter_free_pool_limit",
          },
        },
      ],
      20,
    );

    expect(split.visibleCandidates).toHaveLength(0);
    expect(split.suppressedRecoveredCandidates).toHaveLength(1);
  });

  it("suppresses tool-runtime failed runs that still completed the turn cleanly", () => {
    const signature = classifyFailureSignature({
      run: {
        id: "run-tool-runtime-completed",
        agentId: "agent-tool-runtime",
        companyId: "company-1",
        status: "failed",
        errorCode: "tool_runtime_unavailable",
        exitCode: 0,
      },
      logText: `
        ERROR codex_core::tools::router: error=exec_command failed for /bin/bash -lc "pwd": CreateProcess { message: "Rejected(\\"Failed to create unified exec process: No such file or directory (os error 2)\\")" }
        {"type":"item.completed","item":{"type":"agent_message","text":"Completed the work."}}
        {"type":"turn.completed","usage":{"input_tokens":1,"cached_input_tokens":0,"output_tokens":1}}
      `,
    });

    const split = splitRecoveredCandidates(
      [
        {
          run: {
            id: "run-tool-runtime-completed",
            agentId: "agent-tool-runtime",
            companyId: "company-1",
            status: "failed",
            createdAt: "2026-04-16T17:00:00.000Z",
            errorCode: "tool_runtime_unavailable",
            exitCode: 0,
          },
          agent: { id: "agent-tool-runtime", name: "Blueprint CTO", urlKey: "blueprint-cto" },
          issues: [{ id: "issue-1", identifier: "BLU-1" }],
          bestText: "Codex lost access to its local exec tooling during the run.",
          logText: `
            ERROR codex_core::tools::router: error=exec_command failed for /bin/bash -lc "pwd": CreateProcess { message: "Rejected(\\"Failed to create unified exec process: No such file or directory (os error 2)\\")" }
            {"type":"item.completed","item":{"type":"agent_message","text":"Completed the work."}}
            {"type":"turn.completed","usage":{"input_tokens":1,"cached_input_tokens":0,"output_tokens":1}}
          `,
          signature,
          stalled: false,
        },
      ],
      [
        {
          id: "run-tool-runtime-completed",
          agentId: "agent-tool-runtime",
          companyId: "company-1",
          status: "failed",
          createdAt: "2026-04-16T17:00:00.000Z",
          errorCode: "tool_runtime_unavailable",
          exitCode: 0,
        },
      ],
      20,
    );

    expect(split.visibleCandidates).toHaveLength(0);
    expect(split.suppressedRecoveredCandidates).toHaveLength(1);
  });

  it("suppresses failure candidates whose related issues are already resolved", () => {
    const signature = classifyFailureSignature({
      run: {
        id: "run-tool-runtime-resolved-issue",
        agentId: "agent-tool-runtime",
        companyId: "company-1",
        status: "failed",
        errorCode: "tool_runtime_unavailable",
        exitCode: 1,
      },
      logText: `
        ERROR codex_core::tools::router: error=exec_command failed for /bin/bash -lc "pwd": CreateProcess { message: "Rejected(\\"Failed to create unified exec process: No such file or directory (os error 2)\\")" }
      `,
    });

    const split = splitRecoveredCandidates(
      [
        {
          run: {
            id: "run-tool-runtime-resolved-issue",
            agentId: "agent-tool-runtime",
            companyId: "company-1",
            status: "failed",
            createdAt: "2026-04-20T23:18:57.340Z",
            errorCode: "tool_runtime_unavailable",
            exitCode: 1,
            contextSnapshot: {
              issueId: "issue-1",
              taskId: "issue-1",
              taskKey: "issue-1",
            },
          },
          agent: { id: "agent-tool-runtime", name: "Blueprint CTO", urlKey: "blueprint-cto" },
          issues: [{ id: "issue-1", identifier: "BLU-2123", status: "done" }],
          bestText: "Codex lost access to its local exec tooling during the run.",
          logText: `
            ERROR codex_core::tools::router: error=exec_command failed for /bin/bash -lc "pwd": CreateProcess { message: "Rejected(\\"Failed to create unified exec process: No such file or directory (os error 2)\\")" }
          `,
          signature,
          stalled: false,
        },
      ],
      [
        {
          id: "run-tool-runtime-resolved-issue",
          agentId: "agent-tool-runtime",
          companyId: "company-1",
          status: "failed",
          createdAt: "2026-04-20T23:18:57.340Z",
          errorCode: "tool_runtime_unavailable",
          exitCode: 1,
          contextSnapshot: {
            issueId: "issue-1",
            taskId: "issue-1",
            taskKey: "issue-1",
          },
        },
      ],
      20,
    );

    expect(split.visibleCandidates).toHaveLength(0);
    expect(split.suppressedRecoveredCandidates).toHaveLength(1);
  });

  it("suppresses non-quota failures when a later same-scope recovery run is already active", () => {
    const signature = classifyFailureSignature({
      run: {
        id: "run-hermes-start-failed",
        agentId: "agent-hermes",
        companyId: "company-1",
        status: "failed",
        contextSnapshot: {
          issueId: "issue-1",
          taskId: "issue-1",
          taskKey: "issue-1",
        },
      },
      logText: 'Failed to start command "hermes" in "/tmp/project". Verify adapter command, working directory, and PATH.',
    });

    const split = splitRecoveredCandidates(
      [
        {
          run: {
            id: "run-hermes-start-failed",
            agentId: "agent-hermes",
            companyId: "company-1",
            status: "failed",
            createdAt: "2026-04-21T00:15:20.189Z",
            contextSnapshot: {
              issueId: "issue-1",
              taskId: "issue-1",
              taskKey: "issue-1",
            },
          },
          agent: { id: "agent-hermes", name: "Ops Lead", urlKey: "ops-lead", adapterType: "hermes_local" },
          issues: [{ id: "issue-1", identifier: "BLU-4260", status: "open" }],
          bestText: 'Failed to start command "hermes" in "/tmp/project". Verify adapter command, working directory, and PATH.',
          signature,
          stalled: false,
        },
      ],
      [
        {
          id: "run-hermes-start-failed",
          agentId: "agent-hermes",
          companyId: "company-1",
          status: "failed",
          createdAt: "2026-04-21T00:15:20.189Z",
          contextSnapshot: {
            issueId: "issue-1",
            taskId: "issue-1",
            taskKey: "issue-1",
          },
        },
        {
          id: "run-hermes-recovery",
          agentId: "agent-hermes",
          companyId: "company-1",
          status: "running",
          createdAt: "2026-04-21T00:30:12.541Z",
          startedAt: "2026-04-21T00:30:12.541Z",
          contextSnapshot: {
            issueId: "issue-1",
            taskId: "issue-1",
            taskKey: "issue-1",
          },
        },
      ],
      20,
    );

    expect(split.visibleCandidates).toHaveLength(0);
    expect(split.suppressedRecoveredCandidates).toHaveLength(1);
  });

  it("suppresses quota failures after the agent has already been switched off Hermes", () => {
    const signature = classifyFailureSignature({
      run: {
        id: "run-quota-before-switch",
        agentId: "agent-chief-of-staff",
        companyId: "company-1",
        status: "failed",
        createdAt: "2026-04-16T17:30:30.000Z",
      },
      logText: "API call failed after 3 retries: HTTP 429: Rate limit exceeded: free-models-per-min.",
    });

    const split = splitRecoveredCandidates(
      [
        {
          run: {
            id: "run-quota-before-switch",
            agentId: "agent-chief-of-staff",
            companyId: "company-1",
            status: "failed",
            createdAt: "2026-04-16T17:30:30.000Z",
            contextSnapshot: {
              issueId: "issue-1",
              taskId: "issue-1",
              taskKey: "issue-1",
            },
          },
          agent: {
            id: "agent-chief-of-staff",
            name: "Chief of Staff",
            urlKey: "blueprint-chief-of-staff",
            adapterType: "codex_local",
            updatedAt: "2026-04-16T17:36:48.000Z",
          },
          issues: [{ id: "issue-1", identifier: "BLU-14" }],
          bestText: "HTTP 429: Rate limit exceeded: free-models-per-min.",
          signature,
          stalled: false,
        },
      ],
      [
        {
          id: "run-quota-before-switch",
          agentId: "agent-chief-of-staff",
          companyId: "company-1",
          status: "failed",
          createdAt: "2026-04-16T17:30:30.000Z",
          contextSnapshot: {
            issueId: "issue-1",
            taskId: "issue-1",
            taskKey: "issue-1",
          },
        },
      ],
      20,
      new Map([
        [
          "agent-chief-of-staff",
          {
            id: "agent-chief-of-staff",
            name: "Chief of Staff",
            urlKey: "blueprint-chief-of-staff",
            adapterType: "codex_local",
            updatedAt: "2026-04-16T17:36:48.000Z",
          },
        ],
      ]),
    );

    expect(split.visibleCandidates).toHaveLength(0);
    expect(split.suppressedRecoveredCandidates).toHaveLength(1);
  });

  it("keeps quota failures visible when no later recovery run exists", () => {
    const signature = classifyFailureSignature({
      run: {
        id: "run-quota-failed",
        agentId: "agent-1",
        companyId: "company-1",
        status: "failed",
        contextSnapshot: {
          issueId: "issue-1",
          taskId: "issue-1",
          taskKey: "issue-1",
        },
      },
      logText: "API call failed after 3 retries: HTTP 429: Rate limit exceeded: free-models-per-min.",
    });

    const split = splitRecoveredCandidates(
      [
        {
          run: {
            id: "run-quota-failed",
            agentId: "agent-1",
            companyId: "company-1",
            status: "failed",
            createdAt: "2026-04-13T12:00:00.000Z",
            contextSnapshot: {
              issueId: "issue-1",
              taskId: "issue-1",
              taskKey: "issue-1",
            },
          },
          agent: { id: "agent-1", name: "Ops Lead", urlKey: "ops-lead" },
          issues: [{ id: "issue-1", identifier: "BLU-1" }],
          bestText: "HTTP 429: Rate limit exceeded: free-models-per-min.",
          signature,
          stalled: false,
        },
      ],
      [
        {
          id: "run-quota-failed",
          agentId: "agent-1",
          companyId: "company-1",
          status: "failed",
          createdAt: "2026-04-13T12:00:00.000Z",
          contextSnapshot: {
            issueId: "issue-1",
            taskId: "issue-1",
            taskKey: "issue-1",
          },
        },
      ],
      20,
    );

    expect(split.visibleCandidates).toHaveLength(1);
    expect(split.suppressedRecoveredCandidates).toHaveLength(0);
  });
});
