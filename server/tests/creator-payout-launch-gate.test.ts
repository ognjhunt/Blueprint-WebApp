// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer } from "http";
import type { Server } from "node:http";

const state = vi.hoisted(() => ({
  creatorCaptures: new Map<string, Record<string, unknown>>(),
}));

vi.mock("../utils/accounting", () => ({
  listCreatorPayouts: vi.fn(async (creatorId: string) =>
    Array.from(state.creatorCaptures.values())
      .filter((payload) => payload.creator_id === creatorId)
      .map((payload) => ({
        id: String(payload.id || ""),
        scene_id: String(payload.capture_job_id || payload.site_submission_id || payload.id || ""),
        approved_amount_cents:
          typeof payload.estimated_payout_cents === "number" ? payload.estimated_payout_cents : 0,
        status: String(payload.status || "submitted"),
        approved_at: String(payload.captured_at || ""),
        paid_at: String(payload.status || "") === "paid" ? String(payload.captured_at || "") : null,
        updated_at: String(payload.captured_at || ""),
      })),
  ),
  mapCreatorPayoutStatusForLedger: vi.fn((status: string) =>
    status === "paid" ? "paid" : "pending",
  ),
}));

vi.mock("../../client/src/lib/firebaseAdmin", () => {
  const queryDocs = (field: string, value: unknown) =>
    Array.from(state.creatorCaptures.entries())
      .filter(([, payload]) => payload[field] === value)
      .map(([id, payload]) => ({
        id,
        data: () => payload,
      }));

  const collection = (name: string) => ({
    where: (field: string, _op: string, value: unknown) => ({
      get: async () => ({
        docs:
          name === "creatorCaptures"
            ? queryDocs(field, value)
            : [],
      }),
    }),
    doc: (id: string) => ({
      get: async () => ({
        exists: state.creatorCaptures.has(id),
        data: () => state.creatorCaptures.get(id),
      }),
      set: async (payload: Record<string, unknown>, options?: { merge?: boolean }) => {
        const current = state.creatorCaptures.get(id) || {};
        state.creatorCaptures.set(id, options?.merge ? { ...current, ...payload } : payload);
      },
    }),
  });

  return {
    default: {
      firestore: {
        FieldValue: {
          serverTimestamp: () => "SERVER_TIMESTAMP",
        },
      },
    },
    dbAdmin: {
      collection,
    },
  };
});

async function startServer() {
  const { default: creatorRouter } = await import("../routes/creator");
  const app = express();
  app.use(express.json());
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
  state.creatorCaptures.clear();
});

describe("creator payout launch gate", () => {
  it(
    "moves a capture from upload through approved payout-pending into paid ledger state",
    async () => {
      const { server, baseUrl } = await startServer();

      try {
        const headers = {
          "Content-Type": "application/json",
          "X-Blueprint-Creator-Id": "creator-123",
        };

        const submitted = await fetch(`${baseUrl}/v1/creator/captures`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            id: "capture-123",
            capture_job_id: "job-123",
            buyer_request_id: "buyer-request-123",
            site_submission_id: "site-submission-123",
            target_address: "100 Main St",
            quoted_payout_cents: 6500,
            requested_outputs: ["qualification", "preview_simulation"],
            rights_profile: "documented",
            status: "submitted",
            captured_at: "2026-03-20T13:00:00.000Z",
          }),
        });

        expect(submitted.status).toBe(201);

        const submittedEarnings = await fetch(`${baseUrl}/v1/creator/earnings`, {
          headers: {
            "X-Blueprint-Creator-Id": "creator-123",
          },
        });
        await expect(submittedEarnings.json()).resolves.toMatchObject({
          total_earned_cents: 0,
          scans_completed: 0,
        });

        const approved = await fetch(`${baseUrl}/v1/creator/captures`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            id: "capture-123",
            capture_job_id: "job-123",
            buyer_request_id: "buyer-request-123",
            site_submission_id: "site-submission-123",
            target_address: "100 Main St",
            estimated_payout_cents: 6500,
            requested_outputs: ["qualification", "preview_simulation"],
            rights_profile: "documented",
            status: "approved",
            captured_at: "2026-03-20T13:00:00.000Z",
          }),
        });

        expect(approved.status).toBe(201);

        const detailAfterApproval = await fetch(`${baseUrl}/v1/creator/captures/capture-123`, {
          headers: {
            "X-Blueprint-Creator-Id": "creator-123",
          },
        });
        await expect(detailAfterApproval.json()).resolves.toMatchObject({
          id: "capture-123",
          status: "approved",
          earnings: {
            total_payout_cents: 6500,
          },
        });

        const pendingLedger = await fetch(`${baseUrl}/v1/creator/payouts/ledger`, {
          headers: {
            "X-Blueprint-Creator-Id": "creator-123",
          },
        });
        await expect(pendingLedger.json()).resolves.toEqual([
          expect.objectContaining({
            id: "capture-123",
            amount_cents: 6500,
            status: "pending",
            description: "Capture payout for job-123",
          }),
        ]);

        const paid = await fetch(`${baseUrl}/v1/creator/captures`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            id: "capture-123",
            capture_job_id: "job-123",
            buyer_request_id: "buyer-request-123",
            site_submission_id: "site-submission-123",
            target_address: "100 Main St",
            estimated_payout_cents: 6500,
            requested_outputs: ["qualification", "preview_simulation"],
            rights_profile: "documented",
            status: "paid",
            captured_at: "2026-03-20T13:00:00.000Z",
          }),
        });

        expect(paid.status).toBe(201);

        const paidLedger = await fetch(`${baseUrl}/v1/creator/payouts/ledger`, {
          headers: {
            "X-Blueprint-Creator-Id": "creator-123",
          },
        });
        await expect(paidLedger.json()).resolves.toEqual([
          expect.objectContaining({
            id: "capture-123",
            amount_cents: 6500,
            status: "paid",
          }),
        ]);
      } finally {
        await stopServer(server);
      }
    },
    15000,
  );
});
