// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer } from "http";
import type { Server } from "node:http";

const state = vi.hoisted(() => ({
  docs: new Map<string, Record<string, unknown>>(),
  slackMessages: [] as string[],
}));

vi.mock("../utils/slack", () => ({
  sendSlackMessage: vi.fn(async (message: string) => {
    state.slackMessages.push(message);
    return { ok: true };
  }),
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
      doc: (id: string) => ({
        get: async () => {
          const data = state.docs.get(`${name}/${id}`);
          return {
            exists: Boolean(data),
            data: () => data,
          };
        },
        set: async (data: Record<string, unknown>, options?: { merge?: boolean }) => {
          const key = `${name}/${id}`;
          const previous = state.docs.get(key) || {};
          state.docs.set(key, options?.merge ? { ...previous, ...data } : data);
        },
      }),
      where: () => ({
        get: async () => ({ docs: [] }),
      }),
    }),
  },
}));

async function startCreatorServer() {
  const { default: creatorRouter } = await import("../routes/creator");
  const app = express();
  app.use(express.json());
  app.use((_, res, next) => {
    res.locals.firebaseUser = { uid: "creator-auth-123" };
    next();
  });
  app.use("/v1/creator", creatorRouter);
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
  state.docs.clear();
  state.slackMessages = [];
});

describe("creator client telemetry", () => {
  it("stores mobile crash telemetry and opens a beta ops alert", async () => {
    const { server, baseUrl } = await startCreatorServer();
    try {
      const response = await fetch(`${baseUrl}/v1/creator/client-telemetry`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          event_id: "event-123",
          event_type: "cached_uncaught_exception",
          severity: "critical",
          operation: "NSInvalidArgumentException",
          status: "flushed_after_launch",
          occurred_at: "2026-07-08T12:00:00Z",
          capture_id: "cap-123",
          session_id: "session-123",
          metadata: {
            capture_id: "cap-123",
            reason: "unexpected nil",
          },
          breadcrumbs: [
            {
              name: "capture_recording_started",
              status: "av_capture",
              occurred_at: "2026-07-08T11:59:00Z",
              metadata: {
                thermal_state: "nominal",
              },
            },
          ],
        }),
      });

      expect(response.status).toBe(202);
      await expect(response.json()).resolves.toMatchObject({
        accepted: true,
        event_id: "event-123",
        alert_recorded: true,
        alert_opened: true,
      });

      expect(state.docs.get("creatorClientTelemetry/creator-auth-123__event-123")).toMatchObject({
        creator_id: "creator-auth-123",
        event_type: "cached_uncaught_exception",
        severity: "critical",
        capture_id: "cap-123",
        beta_alert_candidate: true,
      });
      expect(state.docs.get("opsAlertSignals/mobile_capture_client_crash:cap-123")).toMatchObject({
        kind: "mobile_capture_client_crash",
        scope_id: "cap-123",
        event_count: 1,
      });
      expect(state.docs.get("opsAlerts/mobile_capture_client_crash:cap-123")).toMatchObject({
        status: "open",
        source: "webapp_beta_ops_failure_signal",
        requires_human_review: true,
      });
      expect(state.slackMessages).toHaveLength(1);
    } finally {
      await stopServer(server);
    }
  });
});
