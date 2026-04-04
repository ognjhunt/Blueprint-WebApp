// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer } from "http";
import type { Server } from "node:http";

const state = vi.hoisted(() => ({
  requestDocData: {} as Record<string, unknown>,
  requestUpdate: vi.fn().mockResolvedValue(undefined),
  captureJobSet: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  default: {
    firestore: {
      FieldValue: {
        serverTimestamp: () => "SERVER_TIMESTAMP",
      },
    },
  },
  dbAdmin: {
    collection: (name: string) => ({
      doc: (id?: string) => {
        if (name === "capture_jobs") {
          return {
            id: id || "capture-job-id",
            set: state.captureJobSet,
          };
        }
        return {
          id: id || "request-id",
          get: async () => ({
            exists: true,
            data: () => state.requestDocData,
            ref: {
              update: state.requestUpdate,
            },
          }),
          update: state.requestUpdate,
          collection: () => ({
            add: vi.fn().mockResolvedValue(undefined),
          }),
        };
      },
    }),
    storageAdmin: null,
  },
  storageAdmin: null,
}));

vi.mock("../utils/field-encryption", () => ({
  decryptFieldValue: async (value: string) => value,
  decryptInboundRequestForAdmin: async (value: Record<string, unknown>) => value,
  encryptFieldValue: async (value: string) => value,
}));

vi.mock("../utils/request-review-auth", () => ({
  createRequestReviewToken: () => "review-token",
}));

async function startServer() {
  const { default: router } = await import("../routes/admin-leads");
  const app = express();
  app.use(express.json());
  app.use((_, res, next) => {
    res.locals.firebaseUser = {
      uid: "admin-user",
      email: "ops@tryblueprint.io",
      admin: true,
    };
    next();
  });
  app.use("/", router);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind test server");
  }
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function stopServer(server: Server) {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

afterEach(() => {
  state.requestDocData = {};
  state.requestUpdate.mockReset();
  state.requestUpdate.mockResolvedValue(undefined);
  state.captureJobSet.mockReset();
  state.captureJobSet.mockResolvedValue(undefined);
});

describe("admin capture job publication", () => {
  it("rejects marketplace publication when a request has no valid coordinates", async () => {
    state.requestDocData = {
      requestId: "req-1",
      site_submission_id: "req-1",
      status: "qualified_ready",
      qualification_state: "qualified_ready",
      opportunity_state: "handoff_ready",
      request: {
        requestedLanes: ["qualification"],
        buyerType: "site_operator",
        siteName: "Site 1",
        siteLocation: "100 Main St",
        taskStatement: "Inspect aisle",
      },
      ops: {
        rights_status: "verified",
        capture_policy_tier: "approved_capture",
      },
      enrichment: {},
    };

    const { server, baseUrl } = await startServer();
    try {
      const response = await fetch(`${baseUrl}/req-1/capture-job`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      expect(response.status).toBe(409);
      expect(state.captureJobSet).not.toHaveBeenCalled();
    } finally {
      await stopServer(server);
    }
  });

  it("publishes claimable jobs only when valid coordinates are provided", async () => {
    state.requestDocData = {
      requestId: "req-2",
      site_submission_id: "req-2",
      status: "qualified_ready",
      qualification_state: "qualified_ready",
      opportunity_state: "handoff_ready",
      request: {
        requestedLanes: ["preview_simulation"],
        buyerType: "robot_team",
        siteName: "Site 2",
        siteLocation: "200 Main St",
        taskStatement: "Inspect shelf",
      },
      ops: {
        rights_status: "verified",
        capture_policy_tier: "approved_capture",
      },
      enrichment: {},
    };

    const { server, baseUrl } = await startServer();
    try {
      const response = await fetch(`${baseUrl}/req-2/capture-job`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lat: 37.7749,
          lng: -122.4194,
          availability_starts_at: "2026-03-21T09:00:00.000Z",
          availability_ends_at: "2026-03-21T18:00:00.000Z",
        }),
      });

      expect(response.status).toBe(200);
      expect(state.captureJobSet).toHaveBeenCalledWith(
        expect.objectContaining({
          lat: 37.7749,
          lng: -122.4194,
          marketplace_state: "claimable",
          capture_job_state: "claimable",
          rights_status: "verified",
          capture_policy_tier: "approved_capture",
          requested_outputs: ["preview_simulation"],
          availability_window: {
            starts_at: "2026-03-21T09:00:00.000Z",
            ends_at: "2026-03-21T18:00:00.000Z",
          },
        }),
        { merge: true },
      );
    } finally {
      await stopServer(server);
    }
  });

  it("defaults robot-team submissions without requested lanes to hosted evaluation", async () => {
    state.requestDocData = {
      requestId: "req-3",
      site_submission_id: "req-3",
      status: "qualified_ready",
      qualification_state: "qualified_ready",
      opportunity_state: "handoff_ready",
      request: {
        buyerType: "robot_team",
        siteName: "Site 3",
        siteLocation: "300 Main St",
        taskStatement: "Inspect storage",
      },
      ops: {
        rights_status: "verified",
        capture_policy_tier: "approved_capture",
      },
      enrichment: {},
    };

    const { server, baseUrl } = await startServer();
    try {
      const response = await fetch(`${baseUrl}/req-3/capture-job`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lat: 37.7749,
          lng: -122.4194,
        }),
      });

      expect(response.status).toBe(200);
      expect(state.captureJobSet).toHaveBeenCalledWith(
        expect.objectContaining({
          requested_outputs: ["deeper_evaluation"],
          special_task_type: "buyer_requested_evaluation",
        }),
        { merge: true },
      );
    } finally {
      await stopServer(server);
    }
  });
});
