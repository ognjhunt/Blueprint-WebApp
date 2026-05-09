// @vitest-environment node
import fs from "node:fs/promises";
import type { ExecFileException } from "node:child_process";
import { afterEach, describe, expect, it, vi } from "vitest";

const execFileMock = vi.hoisted(() => vi.fn());

vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  return {
    ...actual,
    execFile: execFileMock,
  };
});

afterEach(() => {
  delete process.env.CODEX_LOCAL_COMMAND;
  delete process.env.CODEX_LOCAL_WORKDIR;
  delete process.env.CODEX_TIMEOUT_MS;
  delete process.env.PAPERCLIP_GOAL_PROMPT_ENABLED;
  execFileMock.mockReset();
  vi.resetModules();
});

describe("Codex local goal closeout contract", () => {
  it("adds Paperclip-grade closeout requirements to goal-style Codex prompts", async () => {
    process.env.CODEX_LOCAL_COMMAND = "codex-test";
    process.env.CODEX_LOCAL_WORKDIR = process.cwd();
    process.env.CODEX_TIMEOUT_MS = "45000";

    execFileMock.mockImplementation(
      (
        _command: string,
        args: string[],
        _options: Record<string, unknown>,
        callback: (error: ExecFileException | null) => void,
      ) => {
        const outputFile = args[args.indexOf("--output-last-message") + 1];
        fs.writeFile(
          outputFile,
          JSON.stringify({
            reply: "State: done",
            summary: "Closed with evidence.",
            suggested_actions: [],
            requires_human_review: false,
          }),
        ).then(() => callback(null), callback);
      },
    );

    const { runCodexLocalTask } = await import("../agents/adapters/codex-local");
    const { operatorThreadTask } = await import("../agents/tasks/operator-thread");

    const result = await runCodexLocalTask({
      kind: "operator_thread",
      input: {
        message: "Goal: tighten WebApp closeouts",
      },
      provider: "codex_local",
      runtime: "codex_local",
      model: "gpt-5.4-mini",
      metadata: {
        paperclipGoalPromptEnabled: true,
        paperclipIssueId: "BLU-123",
        paperclipRunId: "run-456",
      },
      tool_policy: {
        mode: "mixed",
        prefer_direct_api: true,
        browser_fallback_allowed: false,
        isolated_runtime_required: false,
        allowed_mcp_servers: [],
        allowed_domains: [],
        allowed_actions: [],
      },
      approval_policy: {
        require_human_approval: false,
        sensitive_actions: [],
        allow_preapproval: false,
      },
      session_policy: {
        dispatch_mode: "collect",
        lane: "session",
        max_concurrent: 1,
      },
      outcome_contract: {
        objective: "Tighten WebApp closeouts.",
        success_criteria: ["Closeout fields are preserved."],
        self_checks: ["Check exact field labels."],
        proof_requirements: ["Adapter prompt carries the closeout contract."],
        pass_threshold: 0.8,
      },
      definition: operatorThreadTask,
    });

    const args = execFileMock.mock.calls[0][1] as string[];
    const prompt = args.at(-1) || "";

    expect(prompt).toContain("Paperclip goal closeout contract");
    expect(prompt).toContain("Goal objective:");
    expect(prompt).toContain("Issue/run id:");
    expect(prompt).toContain("Budget/timeout context:");
    expect(prompt).toContain("Stage reached:");
    expect(prompt).toContain("State claimed:");
    expect(prompt).toContain("Proof paths:");
    expect(prompt).toContain("Command outputs:");
    expect(prompt).toContain("Next action:");
    expect(prompt).toContain("Retry condition:");
    expect(prompt).toContain("Residual risk:");
    expect(prompt).toContain("State claimed must be exactly one of: done, blocked, awaiting_human_decision.");
    expect(prompt).toContain("Issue/run context: issue=BLU-123; run=run-456");
    expect(prompt).toContain("Budget/timeout context: 45000ms timeout");
    expect(result.artifacts).toMatchObject({
      codex_timeout_ms: 45000,
      paperclip_goal_closeout_contract: {
        enabled: true,
        required_fields: [
          "Goal objective:",
          "Issue/run id:",
          "Budget/timeout context:",
          "Stage reached:",
          "State claimed:",
          "Proof paths:",
          "Command outputs:",
          "Next action:",
          "Retry condition:",
          "Residual risk:",
        ],
        allowed_states: ["done", "blocked", "awaiting_human_decision"],
      },
    });
    expect(result.logs).toContainEqual(
      expect.objectContaining({
        event_type: "provider.goal_closeout_contract.attached",
        status: "info",
      }),
    );
  });
});
