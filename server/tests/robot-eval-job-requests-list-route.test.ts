// @vitest-environment node
//
// P1-D: buyer-scoped run list + extended buyer run detail. Verifies the
// GET /api/robot-eval/job-requests list route only ever returns the
// authenticated buyer's own robotEvalJobRequests records, and that the
// buyer detail route exposes the stored site/task and entitlement linkage.
import express from "express";
import { createServer } from "node:http";
import type { Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sharedFakeFirestoreState } from "./helpers/fake-firestore";

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore } = await import("./helpers/fake-firestore");
  return {
    default: {
      firestore: {
        FieldValue: {
          serverTimestamp: () => "SERVER_TIMESTAMP",
        },
      },
    },
    dbAdmin: sharedFakeFirestore,
    // Treat the Bearer token as the uid; "invalid" throws (rejected token).
    authAdmin: {
      verifyIdToken: async (token: string) => {
        if (token === "invalid") throw new Error("invalid token");
        return { uid: token, admin: token === "admin-user" };
      },
    },
  };
});

async function startRoute(): Promise<{ server: Server; baseUrl: string }> {
  const { default: router } = await import("../routes/robot-eval-job-requests");
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use("/api/robot-eval/job-requests", router);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("server failed to bind");
  }
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function stopServer(server: Server) {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function seedJob(jobId: string, data: Record<string, unknown>) {
  sharedFakeFirestoreState.docs.set(`robotEvalJobRequests/${jobId}`, data);
}

beforeEach(() => {
  sharedFakeFirestoreState.docs.clear();
});

// No vi.resetModules() here: the vi.mock factory and the test body must keep
// observing the same fake-firestore module instance (module-level singleton).
afterEach(() => {
  sharedFakeFirestoreState.docs.clear();
});

describe("buyer-scoped robot eval run list route", () => {
  it("rejects an unauthenticated list request (401)", async () => {
    seedJob("job-1", { status: "queued_for_pipeline", buyer_user_id: "buyer-1" });
    const { server, baseUrl } = await startRoute();
    try {
      const response = await fetch(`${baseUrl}/api/robot-eval/job-requests`);
      expect(response.status).toBe(401);
    } finally {
      await stopServer(server);
    }
  });

  it("returns only the signed-in buyer's runs, newest first, with stored fields", async () => {
    seedJob("job-older", {
      status: "completed",
      pipeline_status: "completed",
      buyer_user_id: "buyer-1",
      site_slug: "atlanta-cafe",
      site_submission_id: "scene-1:capture-1",
      capture_job_id: "capture-job-1",
      capture_id: "capture-1",
      entitlement_proof: {
        entitlement_id: "ent-1",
        sku: "atlanta-cafe-robot-eval-run",
      },
      created_at_iso: "2026-07-01T00:00:00.000Z",
      updated_at_iso: "2026-07-01T06:00:00.000Z",
    });
    seedJob("job-newer", {
      status: "queued_for_pipeline",
      buyer_user_id: "buyer-1",
      site_slug: "atlanta-cafe",
      created_at_iso: "2026-07-02T00:00:00.000Z",
      updated_at_iso: "2026-07-02T00:00:00.000Z",
    });
    seedJob("job-other-buyer", {
      status: "completed",
      buyer_user_id: "buyer-2",
      site_slug: "denver-warehouse",
      created_at_iso: "2026-07-03T00:00:00.000Z",
    });
    const { server, baseUrl } = await startRoute();

    try {
      const response = await fetch(`${baseUrl}/api/robot-eval/job-requests`, {
        headers: { Authorization: "Bearer buyer-1" },
      });
      expect(response.status).toBe(200);
      const payload = (await response.json()) as {
        ok: boolean;
        count: number;
        job_requests: Array<Record<string, unknown>>;
      };
      expect(payload.ok).toBe(true);
      expect(payload.count).toBe(2);
      expect(payload.job_requests.map((run) => run.job_id)).toEqual([
        "job-newer",
        "job-older",
      ]);
      expect(payload.job_requests[1]).toEqual({
        job_id: "job-older",
        status: "completed",
        pipeline_status: "completed",
        site_slug: "atlanta-cafe",
        site_submission_id: "scene-1:capture-1",
        capture_job_id: "capture-job-1",
        capture_id: "capture-1",
        error: null,
        entitlement_id: "ent-1",
        entitlement_sku: "atlanta-cafe-robot-eval-run",
        created_at_iso: "2026-07-01T00:00:00.000Z",
        updated_at_iso: "2026-07-01T06:00:00.000Z",
      });
      // Never leak another buyer's run.
      const ids = payload.job_requests.map((run) => run.job_id);
      expect(ids).not.toContain("job-other-buyer");
    } finally {
      await stopServer(server);
    }
  });

  it("returns an empty list when the buyer has no runs", async () => {
    seedJob("job-other-buyer", { status: "completed", buyer_user_id: "buyer-2" });
    const { server, baseUrl } = await startRoute();
    try {
      const response = await fetch(`${baseUrl}/api/robot-eval/job-requests`, {
        headers: { Authorization: "Bearer buyer-1" },
      });
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        ok: true,
        count: 0,
        job_requests: [],
      });
    } finally {
      await stopServer(server);
    }
  });
});

describe("buyer run detail (status route summary fields)", () => {
  it("includes stored site/task and entitlement linkage for the owning buyer", async () => {
    seedJob("job-1", {
      status: "queued_for_pipeline",
      pipeline_status: "staged_for_control_plane",
      buyer_user_id: "buyer-1",
      site_slug: "atlanta-cafe",
      site_submission_id: "scene-1:capture-1",
      capture_job_id: "capture-job-1",
      capture_id: "capture-1",
      entitlement_proof: {
        entitlement_id: "ent-1",
        sku: "atlanta-cafe-robot-eval-run",
      },
      created_at_iso: "2026-07-02T00:00:00.000Z",
      updated_at_iso: "2026-07-02T00:00:00.000Z",
      proof_boundary: { simulator_execution_proven: false },
    });
    const { server, baseUrl } = await startRoute();

    try {
      const response = await fetch(
        `${baseUrl}/api/robot-eval/job-requests/job-1/status`,
        { headers: { Authorization: "Bearer buyer-1" } },
      );
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual(
        expect.objectContaining({
          ok: true,
          job_id: "job-1",
          status: "queued_for_pipeline",
          pipeline_status: "staged_for_control_plane",
          site_slug: "atlanta-cafe",
          site_submission_id: "scene-1:capture-1",
          capture_job_id: "capture-job-1",
          capture_id: "capture-1",
          entitlement_id: "ent-1",
          entitlement_sku: "atlanta-cafe-robot-eval-run",
          proof_boundary: expect.objectContaining({
            simulator_execution_proven: false,
          }),
        }),
      );
    } finally {
      await stopServer(server);
    }
  });

  it("still forbids a non-owner buyer from reading run detail (403)", async () => {
    seedJob("job-1", {
      status: "completed",
      buyer_user_id: "buyer-1",
      site_slug: "atlanta-cafe",
    });
    const { server, baseUrl } = await startRoute();
    try {
      const response = await fetch(
        `${baseUrl}/api/robot-eval/job-requests/job-1/status`,
        { headers: { Authorization: "Bearer buyer-2" } },
      );
      expect(response.status).toBe(403);
    } finally {
      await stopServer(server);
    }
  });
});
