// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { parseAgentCliArgs, runAgentCli } from "./blueprint-agent-cli";

describe("Blueprint agent CLI", () => {
  it("parses nested catalog and session commands", () => {
    expect(parseAgentCliArgs(["catalog", "list", "--limit", "3"])).toMatchObject({
      command: "catalog:list",
      options: { limit: 3 },
    });
    expect(parseAgentCliArgs(["session", "create", "--site-world-id", "demo", "--robot-profile-id", "g1", "--task-id", "task", "--scenario-id", "scenario", "--start-state-id", "start"])).toMatchObject({
      command: "session:create",
      options: {
        siteWorldId: "demo",
        robotProfileId: "g1",
        taskId: "task",
        scenarioId: "scenario",
        startStateId: "start",
      },
    });
    expect(parseAgentCliArgs(["session", "batch", "session-1", "--num-episodes", "2"])).toMatchObject({
      command: "session:batch",
      sessionId: "session-1",
      options: { numEpisodes: 2 },
    });
  });

  it("uses BLUEPRINT_API_BASE_URL and bearer auth when fetching protected flows", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ sessionId: "session-1" }), {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    );
    const writes: string[] = [];

    await runAgentCli(
      [
        "session",
        "create",
        "--site-world-id",
        "siteworld-f5fd54898cfb",
        "--robot-profile-id",
        "other_sample",
        "--task-id",
        "task-1",
        "--scenario-id",
        "scenario-1",
        "--start-state-id",
        "start-1",
      ],
      {
        env: {
          BLUEPRINT_API_BASE_URL: "https://agent.example",
          BLUEPRINT_AGENT_AUTH_TOKEN: "token-123",
        },
        fetchImpl: fetchMock,
        stdout: (line) => writes.push(line),
      },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://agent.example/api/site-worlds/sessions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Bearer token-123",
          "content-type": "application/json",
        }),
      }),
    );
    expect(JSON.parse(writes.join("\n"))).toEqual({ sessionId: "session-1" });
  });

  it("omits auth for public demo read-only commands when no token is set", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await runAgentCli(["catalog", "list"], {
      env: { BLUEPRINT_API_BASE_URL: "http://localhost:5000" },
      fetchImpl: fetchMock,
      stdout: () => undefined,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:5000/api/site-worlds?limit=24",
      expect.objectContaining({
        method: "GET",
        headers: expect.not.objectContaining({ authorization: expect.any(String) }),
      }),
    );
  });
});
