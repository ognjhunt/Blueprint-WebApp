// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer } from "http";
import type { Server } from "node:http";

const state = vi.hoisted(() => ({
  docs: new Map<string, Record<string, unknown>>(),
  sendEmail: vi.fn(async () => ({ sent: true })),
}));

vi.mock("../utils/email", () => ({
  sendEmail: state.sendEmail,
}));

vi.mock("../utils/idempotency", () => ({
  buildIdempotencyKey: vi.fn(() => ({ key: "waitlist-idempotency-1", ttlMs: 60_000 })),
  fetchIdempotencyResponse: vi.fn(async () => null),
  storeIdempotencyResponse: vi.fn(async () => undefined),
}));

vi.mock("../utils/cityLaunchLedgers", () => ({
  listCityLaunchActivations: vi.fn(async () => []),
  upsertCityLaunchProspect: vi.fn(async () => undefined),
}));

vi.mock("../utils/highIntentLeadEnrichment", () => ({
  runWaitlistLeadSignalRouting: vi.fn(async () => undefined),
}));

vi.mock("../utils/lifecycle-cadence", () => ({
  createLifecycleCadenceForWaitlistSubmission: vi.fn(async () => undefined),
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
      where: (field: string, _op: string, value: unknown) => ({
        get: async () => ({
          docs: Array.from(state.docs.entries())
            .filter(([key, data]) => key.startsWith(`${name}/`) && data[field] === value)
            .map(([key, data]) => ({
              id: key.split("/")[1],
              data: () => data,
            })),
        }),
      }),
      doc: (id: string) => ({
        get: async () => ({
          exists: state.docs.has(`${name}/${id}`),
          data: () => state.docs.get(`${name}/${id}`),
        }),
        set: async (payload: Record<string, unknown>, options?: { merge?: boolean }) => {
          const key = `${name}/${id}`;
          const previous = state.docs.get(key) || {};
          state.docs.set(key, options?.merge ? { ...previous, ...payload } : payload);
        },
        update: async (payload: Record<string, unknown>) => {
          const key = `${name}/${id}`;
          const previous = state.docs.get(key) || {};
          state.docs.set(key, { ...previous, ...payload });
        },
      }),
    }),
  },
}));

async function startWaitlistServer() {
  const { default: waitlistHandler } = await import("../routes/waitlist");
  const app = express();
  app.use(express.json());
  app.post("/api/waitlist", waitlistHandler);
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
  delete process.env.BLUEPRINT_BETA_KILL_SWITCH;
  state.docs.clear();
  state.sendEmail.mockClear();
});

describe("waitlist capturer applications", () => {
  it("answers 410 for a capturer request and stores and sends nothing, whatever the beta flags say", async () => {
    for (const killSwitch of [undefined, "1"]) {
      if (killSwitch) process.env.BLUEPRINT_BETA_KILL_SWITCH = killSwitch;
      const { server, baseUrl } = await startWaitlistServer();
      try {
        const response = await fetch(`${baseUrl}/api/waitlist`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "capturer@example.com", locationType: "warehouse", role: "Capturer", market: "Austin" }),
        });
        expect(response.status).toBe(410);
        await expect(response.json()).resolves.toEqual({ error: "capturer_applications_closed" });
        expect(state.sendEmail).not.toHaveBeenCalled();
        expect(Array.from(state.docs.keys())).toEqual([]);
      } finally {
        await stopServer(server);
      }
    }
  });
});
