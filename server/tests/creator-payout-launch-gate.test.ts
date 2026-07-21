// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer } from "http";
import type { Server } from "node:http";

const state = vi.hoisted(() => ({
  creatorCaptures: new Map<string, Record<string, unknown>>(),
  betaCohortAdmissions: new Map<string, Record<string, unknown>>(),
}));

vi.mock("../utils/accounting", async () => {
  const actual = await vi.importActual<typeof import("../utils/accounting")>(
    "../utils/accounting",
  );
  const listCreatorPayouts = vi.fn(async (creatorId: string) =>
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
  );
  return {
    listCreatorPayouts,
    mapCreatorPayoutStatusForLedger: vi.fn((status: string) =>
      status === "paid" ? "paid" : "pending",
    ),
    summarizeCreatorEarnings: actual.summarizeCreatorEarnings,
    readCreatorEarningsAggregate: vi.fn(async (creatorId: string) =>
      actual.buildCreatorEarningsAggregateFromEntries(
        creatorId,
        (await listCreatorPayouts(creatorId)) as unknown as Parameters<
          typeof actual.buildCreatorEarningsAggregateFromEntries
        >[1],
      ),
    ),
  };
});

vi.mock("../../client/src/lib/firebaseAdmin", () => {
  const collectionStore = (name: string) => {
    if (name === "creatorCaptures") {
      return state.creatorCaptures;
    }
    if (name === "betaCohortAdmissions") {
      return state.betaCohortAdmissions;
    }
    return new Map<string, Record<string, unknown>>();
  };
  const queryDocs = (name: string, field: string, value: unknown) =>
    Array.from(collectionStore(name).entries())
      .filter(([, payload]) => payload[field] === value)
      .map(([id, payload]) => ({
        id,
        data: () => payload,
      }));

  const collection = (name: string) => ({
    where: (field: string, _op: string, value: unknown) => ({
      get: async () => ({
        docs: queryDocs(name, field, value),
      }),
    }),
    doc: (id: string) => ({
      get: async () => ({
        exists: collectionStore(name).has(id),
        data: () => collectionStore(name).get(id),
      }),
      set: async (payload: Record<string, unknown>, options?: { merge?: boolean }) => {
        const store = collectionStore(name);
        const current = store.get(id) || {};
        store.set(id, options?.merge ? { ...current, ...payload } : payload);
      },
      create: async (payload: Record<string, unknown>) => {
        const store = collectionStore(name);
        if (store.has(id)) {
          throw Object.assign(new Error("ALREADY_EXISTS"), { code: 6 });
        }
        store.set(id, payload);
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
  state.betaCohortAdmissions.clear();
  delete process.env.BLUEPRINT_CAPTURE_CLIENT_KILL_SWITCH;
  delete process.env.BLUEPRINT_CAPTURE_MIN_IOS_VERSION;
  delete process.env.BLUEPRINT_CAPTURE_MIN_IOS_BUILD;
});

describe("creator payout launch gate", () => {
  it("blocks native capture preflight when the capture client kill switch is active", async () => {
    process.env.BLUEPRINT_CAPTURE_CLIENT_KILL_SWITCH = "1";
    const { server, baseUrl } = await startServer();

    try {
      const response = await fetch(`${baseUrl}/v1/creator/captures/preflight`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Blueprint-Creator-Id": "creator-123",
          "X-Blueprint-Native-Client": "ios",
          "X-Blueprint-App-Version": "1.0.0",
          "X-Blueprint-App-Build": "100",
        },
        body: JSON.stringify({
          id: "capture-preflight-kill",
          region_id: "austin",
        }),
      });

      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toMatchObject({
        ok: false,
        status: "capture_client_policy_blocked",
        code: "capture_client_kill_switch_active",
        capture_client_policy: {
          kill_switch_active: true,
          platform: "ios",
        },
      });
    } finally {
      await stopServer(server);
    }
  });

  it("requires the configured minimum iOS build before capture intake", async () => {
    process.env.BLUEPRINT_CAPTURE_MIN_IOS_BUILD = "120";
    process.env.BLUEPRINT_CAPTURE_MIN_IOS_VERSION = "1.2.0";
    const { server, baseUrl } = await startServer();

    try {
      const preflight = await fetch(`${baseUrl}/v1/creator/captures/preflight`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Blueprint-Creator-Id": "creator-123",
          "X-Blueprint-Native-Client": "ios",
          "X-Blueprint-App-Version": "1.2.0",
          "X-Blueprint-App-Build": "119",
        },
        body: JSON.stringify({
          id: "capture-old-client",
          region_id: "austin",
        }),
      });

      expect(preflight.status).toBe(426);
      await expect(preflight.json()).resolves.toMatchObject({
        ok: false,
        code: "capture_client_upgrade_required",
        capture_client_policy: {
          min_ios_build: 120,
          min_ios_version: "1.2.0",
          app_build: "119",
        },
      });

      const registration = await fetch(`${baseUrl}/v1/creator/captures`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Blueprint-Creator-Id": "creator-123",
          "X-Blueprint-Native-Client": "ios",
          "X-Blueprint-App-Version": "1.2.0",
          "X-Blueprint-App-Build": "119",
        },
        body: JSON.stringify({
          id: "capture-old-client",
          target_address: "100 Main St",
          captured_at: "2026-03-20T13:00:00.000Z",
        }),
      });

      expect(registration.status).toBe(426);
      expect(state.creatorCaptures.has("capture-old-client")).toBe(false);
    } finally {
      await stopServer(server);
    }
  });

  it(
    "keeps payout state server-owned: client registers, backend approves and pays",
    async () => {
      process.env.BLUEPRINT_BETA_INVITE_CAP = "10";
      process.env.BLUEPRINT_BETA_COHORT_DAILY_LIMIT = "10";
      const { server, baseUrl } = await startServer();

      try {
        const headers = {
          "Content-Type": "application/json",
          "X-Blueprint-Creator-Id": "creator-123",
          "X-Blueprint-Native-Client": "ios",
          "X-Blueprint-App-Version": "1.2.3",
          "X-Blueprint-App-Build": "123",
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
        // Registration never grants earnings: the payout amount the client
        // quoted lands only in non-authoritative client_reported context.
        const created = state.creatorCaptures.get("capture-123")!;
        expect(created.status).toBe("submitted");
        expect(created.estimated_payout_cents).toBeNull();
        expect(created).toMatchObject({
          client_metadata: {
            platform: "ios",
            app_version: "1.2.3",
            app_build: "123",
          },
          capture_client_policy: {
            platform: "ios",
            app_version: "1.2.3",
            app_build: "123",
          },
        });

        const submittedEarnings = await fetch(`${baseUrl}/v1/creator/earnings`, {
          headers: {
            "X-Blueprint-Creator-Id": "creator-123",
          },
        });
        await expect(submittedEarnings.json()).resolves.toMatchObject({
          total_earned_cents: 0,
          scans_completed: 0,
        });

        // A client replay that self-asserts "approved" changes nothing: the
        // route acknowledges idempotently and preserves server-owned state.
        const selfApproval = await fetch(`${baseUrl}/v1/creator/captures`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            id: "capture-123",
            status: "approved",
            estimated_payout_cents: 999999,
          }),
        });
        expect(selfApproval.status).toBe(200);
        await expect(selfApproval.json()).resolves.toMatchObject({
          replay: true,
          status: "submitted",
        });
        expect(state.creatorCaptures.get("capture-123")!.status).toBe("submitted");

        // Backend review (Admin SDK) approves the capture and sets the
        // authoritative payout amount + earnings.
        state.creatorCaptures.set("capture-123", {
          ...state.creatorCaptures.get("capture-123")!,
          status: "approved",
          estimated_payout_cents: 6500,
          earnings: { total_payout_cents: 6500 },
        });

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

        // Backend settlement marks the payout paid; the client cannot.
        state.creatorCaptures.set("capture-123", {
          ...state.creatorCaptures.get("capture-123")!,
          status: "paid",
        });

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
        delete process.env.BLUEPRINT_BETA_INVITE_CAP;
        delete process.env.BLUEPRINT_BETA_COHORT_DAILY_LIMIT;
        await stopServer(server);
      }
    },
    15000,
  );
});
