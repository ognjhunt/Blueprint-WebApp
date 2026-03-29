// @vitest-environment node
import express from "express";
import { createServer } from "http";
import type { Server } from "http";
import { afterEach, describe, expect, it, vi } from "vitest";

const processSimpleReschedule = vi.hoisted(() => vi.fn());

const bookings = new Map<string, Record<string, unknown>>();
const queuedRequests = new Map<string, Record<string, unknown>>();

function resetState() {
  bookings.clear();
  queuedRequests.clear();
}

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  default: {
    firestore: {
      FieldValue: {
        serverTimestamp: () => "timestamp",
      },
    },
  },
  dbAdmin: {
    collection(name: string) {
      if (name === "bookings") {
        return {
          where: (_field: string, _op: string, value: unknown) => ({
            limit: (_count: number) => ({
              get: async () => ({
                docs: Array.from(bookings.entries())
                  .filter(([, data]) => data.email === value)
                  .map(([id, data]) => ({
                    id,
                    data: () => data,
                  })),
              }),
            }),
          }),
        };
      }

      if (name === "contactRequests") {
        return {
          doc(id: string) {
            return {
              async set(payload: Record<string, unknown>) {
                queuedRequests.set(id, payload);
              },
            };
          },
        };
      }

      throw new Error(`Unexpected collection ${name}`);
    },
  },
}));

vi.mock("../utils/field-ops-automation", () => ({
  processSimpleReschedule,
}));

async function startServer(): Promise<{ server: Server; baseUrl: string }> {
  const { default: helpRouter } = await import("../routes/help");
  const app = express();
  app.use(express.json());
  app.use(helpRouter);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind help test server");
  }
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
}

async function stopServer(server: Server) {
  if ("closeAllConnections" in server && typeof server.closeAllConnections === "function") {
    server.closeAllConnections();
  }
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

afterEach(() => {
  processSimpleReschedule.mockReset();
  resetState();
  vi.resetModules();
});

describe("help reschedule route", () => {
  it("routes directly to booking automation when a single booking matches", async () => {
    bookings.set("booking-1", {
      email: "buyer@example.com",
      businessName: "Durham Facility",
    });
    processSimpleReschedule.mockResolvedValue({
      state: "sent",
      tier: 1,
      ledgerDocId: "ledger-1",
    });

    const { server, baseUrl } = await startServer();
    try {
      const response = await fetch(`${baseUrl}/reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Ada Lovelace",
          email: "buyer@example.com",
          businessName: "Durham Facility",
          requested_date: "2026-04-02",
          requested_time: "3:00 PM",
          reason: "schedule_conflict",
        }),
      });

      expect(response.status).toBe(200);
      expect(processSimpleReschedule).toHaveBeenCalledWith(
        expect.objectContaining({
          bookingId: "booking-1",
          requestedBy: "buyer",
        }),
      );
    } finally {
      await stopServer(server);
    }
  });

  it("falls back to the support queue when no single booking matches", async () => {
    const { server, baseUrl } = await startServer();
    try {
      const response = await fetch(`${baseUrl}/reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Ada Lovelace",
          email: "buyer@example.com",
          businessName: "Durham Facility",
          requested_date: "2026-04-02",
          requested_time: "3:00 PM",
          reason: "schedule_conflict",
        }),
      });

      expect(response.status).toBe(202);
      expect(processSimpleReschedule).not.toHaveBeenCalled();
      expect(queuedRequests.size).toBe(1);
    } finally {
      await stopServer(server);
    }
  });
});
