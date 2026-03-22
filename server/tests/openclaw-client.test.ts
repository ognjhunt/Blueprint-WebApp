// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  delete process.env.OPENCLAW_BASE_URL;
  delete process.env.OPENCLAW_AGENT_PATH;
  delete process.env.OPENCLAW_AGENT_WAIT_PATH;
  delete process.env.OPENCLAW_AUTH_TOKEN;
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("openclaw client", () => {
  it("submits an action session and parses the accepted response", async () => {
    process.env.OPENCLAW_BASE_URL = "https://openclaw.internal";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            accepted: true,
            openclaw_session_id: "session-1",
            openclaw_run_id: "run-1",
            status: "running",
          }),
          { status: 200 },
        ),
      ),
    );

    const { startActionSession } = await import("../integrations/openclaw/client");
    const result = await startActionSession({
      request_id: "req-1",
      session_key: "session:test",
      task_type: "operator_thread",
      mode: "interactive",
      inputs: { message: "Status?" },
      startup_context: null,
      policy: {
        risk_level: "low",
        requires_approval: false,
        allowed_domains: [],
        allowed_tools: ["mixed"],
        allowed_skill_ids: [],
        forbidden_actions: [],
        artifact_retention_policy: {
          retain_logs: true,
          retain_artifacts: true,
          retention_days: 30,
        },
      },
      artifacts_config: {
        artifact_targets: ["json_result"],
        include_logs: true,
        include_screenshots: false,
      },
    });

    expect(result.accepted).toBe(true);
    expect(result.openclaw_run_id).toBe("run-1");
    expect(global.fetch).toHaveBeenCalledWith(
      "https://openclaw.internal/agent",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("waits on an existing run and parses the completed response", async () => {
    process.env.OPENCLAW_BASE_URL = "https://openclaw.internal";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            accepted: true,
            openclaw_session_id: "session-1",
            openclaw_run_id: "run-1",
            status: "completed",
            result: {
              reply: "Done.",
            },
          }),
          { status: 200 },
        ),
      ),
    );

    const { waitForActionResult } = await import("../integrations/openclaw/client");
    const result = await waitForActionResult({
      openclaw_run_id: "run-1",
      wait_timeout_ms: 1_000,
    });

    expect(result.status).toBe("completed");
    expect(result.result).toEqual({ reply: "Done." });
    expect(global.fetch).toHaveBeenCalledWith(
      "https://openclaw.internal/agent/wait",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
