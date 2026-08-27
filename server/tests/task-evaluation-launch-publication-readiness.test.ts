// @vitest-environment node
import express from "express";
import { createServer, type Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  records: new Map<string, Record<string, any>>(),
  writes: 0,
}));

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  dbAdmin: {
    collection: () => ({
      doc: (id: string) => ({
        get: async () => {
          const record = state.records.get(id);
          return {
            exists: Boolean(record),
            data: () => record && structuredClone(record),
          };
        },
        set: async () => {
          state.writes += 1;
        },
      }),
    }),
  },
}));

vi.mock("../utils/pipelineSyncSecurity", () => ({
  createPipelineSyncRateLimiter: () => (
    _req: unknown,
    _res: unknown,
    next: () => void,
  ) => next(),
  verifyPipelineSyncRequest: () => ({
    ok: true,
    status: 200,
    code: "ok",
    message: "ok",
  }),
}));

const digest = `sha256:${"a".repeat(64)}`;

function readinessRequest() {
  return {
    schema_version: "task_evaluation_launch_publication_readiness_request.v1",
    launch_id: "launch-001",
    run_id: "run-001",
    request_digest: digest,
    team_namespace: "robot-team-001",
    expected_terminal_receipt_schema_version: "task_evaluation_launch_receipt.v1",
    expected_web_sync_receipt_schema_version:
      "task_evaluation_launch_web_sync_receipt.v1",
    expected_configured_scene_offering_schema_version:
      "task_evaluation_configured_scene_offering.v1",
  };
}

async function startServer(): Promise<{ server: Server; url: string }> {
  const { default: router } = await import(
    "../routes/internal-task-evaluation-launches"
  );
  const app = express();
  app.use(express.json());
  app.use(router);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server_start_failed");
  return { server, url: `http://127.0.0.1:${address.port}` };
}

describe("Task Evaluation launch publication readiness", () => {
  beforeEach(() => {
    state.records.clear();
    state.writes = 0;
    state.records.set("launch-001", {
      launch_id: "launch-001",
      run_id: "run-001",
      request_digest: digest,
      team_namespace: "robot-team-001",
      configured_scene_context: {
        run_mode: "scene_configuration",
        team_namespace: "robot-team-001",
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("advertises exact terminal schemas and team binding without a write", async () => {
    const { server, url } = await startServer();
    try {
      const response = await fetch(
        `${url}/task-evaluation-launch-publication-readiness`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(readinessRequest()),
        },
      );
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        schema_version: "task_evaluation_launch_publication_readiness_receipt.v1",
        status: "ready",
        launch_id: "launch-001",
        run_id: "run-001",
        request_digest: digest,
        team_namespace: "robot-team-001",
        terminal_receipt_schema_version: "task_evaluation_launch_receipt.v1",
        web_sync_receipt_schema_version:
          "task_evaluation_launch_web_sync_receipt.v1",
        configured_scene_offering_schema_version:
          "task_evaluation_configured_scene_offering.v1",
        launch_record_read_succeeded: true,
        team_namespace_binding_passed: true,
        firestore_mutation_performed: false,
      });
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(state.writes).toBe(0);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("refuses a team namespace mismatch without a write", async () => {
    const { server, url } = await startServer();
    try {
      const response = await fetch(
        `${url}/task-evaluation-launch-publication-readiness`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ...readinessRequest(),
            team_namespace: "other-team",
          }),
        },
      );
      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toMatchObject({
        code: "task_evaluation_launch_publication_binding_mismatch",
      });
      expect(state.writes).toBe(0);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("refuses callers that expect a different offering schema", async () => {
    const { server, url } = await startServer();
    try {
      const response = await fetch(
        `${url}/task-evaluation-launch-publication-readiness`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ...readinessRequest(),
            expected_configured_scene_offering_schema_version:
              "task_evaluation_configured_scene_offering.v2",
          }),
        },
      );
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        code: "task_evaluation_launch_publication_readiness_request_invalid",
      });
      expect(state.writes).toBe(0);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
