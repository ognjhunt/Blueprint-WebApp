// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer } from "http";
import type { Server } from "http";

const runAgentTask = vi.hoisted(() => vi.fn());

vi.mock("../agents", () => ({
  runAgentTask,
}));

async function startServer(): Promise<{ server: Server; baseUrl: string }> {
  const { default: route } = await import("../routes/process-waitlist");
  const app = express();
  app.use(express.json());
  app.post("/", route);

  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind waitlist test server");
  }
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
}

async function stopServer(server: Server) {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

afterEach(() => {
  runAgentTask.mockReset();
  vi.resetModules();
});

describe("process waitlist route", () => {
  it("routes through the canonical waitlist_triage task", async () => {
    runAgentTask.mockResolvedValue({
      status: "completed",
      provider: "openclaw",
      runtime: "openclaw",
      model: "openai/gpt-5.4",
      tool_mode: "api",
      requires_human_review: false,
      requires_approval: false,
      output: {
        automation_status: "completed",
        block_reason_code: null,
        retryable: false,
        recommendation: "invite_now",
        confidence: 0.92,
        market_fit_score: 87,
        device_fit_score: 91,
        invite_readiness_score: 90,
        recommended_queue: "capturer_beta_invite_review",
        next_action: "Send invite",
        rationale: "Strong fit.",
        market_summary: "Strong Durham demand.",
        requires_human_review: false,
        draft_email: {
          subject: "Invite",
          body: "Welcome",
        },
      },
    });

    const { server, baseUrl } = await startServer();

    try {
      const response = await fetch(baseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Ada Lovelace",
          email: "ada@example.com",
          company: "Analytical Engines",
          city: "Durham",
          state: "NC",
          offWaitlistUrl: "https://tryblueprint.io/off-waitlist-signup",
        }),
      });

      expect(response.status).toBe(200);
      expect(runAgentTask).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "waitlist_triage",
        }),
      );
    } finally {
      await stopServer(server);
    }
  });
});
