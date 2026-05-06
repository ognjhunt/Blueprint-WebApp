// @vitest-environment node
import express from "express";
import { createServer } from "http";
import type { Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";

const getActiveExperimentRollouts = vi.hoisted(() => vi.fn());

vi.mock("../utils/experiment-ops", () => ({
  getActiveExperimentRollouts,
}));

async function startServer() {
  const { default: experimentsRouter } = await import("../routes/experiments");
  const app = express();
  app.use("/api/experiments", experimentsRouter);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Experiments test server failed to bind.");
  }

  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
}

async function stopServer(server: Server) {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe("experiments route", () => {
  it("returns active rollout assignments", async () => {
    getActiveExperimentRollouts.mockResolvedValue({
      home_robot_team_conversion_v1: "proof_first",
    });

    const { server, baseUrl } = await startServer();
    try {
      const response = await fetch(`${baseUrl}/api/experiments/assignments`);
      const payload = (await response.json()) as {
        assignments: Record<string, string>;
        sourceStatus: { experimentRollouts: string; warnings: string[] };
      };

      expect(response.status).toBe(200);
      expect(payload.assignments).toEqual({
        home_robot_team_conversion_v1: "proof_first",
      });
      expect(payload.sourceStatus).toEqual({
        experimentRollouts: "ready",
        warnings: [],
      });
    } finally {
      await stopServer(server);
    }
  });

  it("fails closed when rollout storage is unavailable", async () => {
    getActiveExperimentRollouts.mockRejectedValue(
      new Error("8 RESOURCE_EXHAUSTED: Quota exceeded."),
    );

    const { server, baseUrl } = await startServer();
    try {
      const response = await fetch(`${baseUrl}/api/experiments/assignments`);
      const payload = (await response.json()) as {
        assignments: Record<string, string>;
        sourceStatus: { experimentRollouts: string; warnings: string[] };
      };

      expect(response.status).toBe(200);
      expect(payload.assignments).toEqual({});
      expect(payload.sourceStatus.experimentRollouts).toBe("unavailable");
      expect(payload.sourceStatus.warnings.join("\n")).toContain(
        "RESOURCE_EXHAUSTED",
      );
    } finally {
      await stopServer(server);
    }
  });
});
