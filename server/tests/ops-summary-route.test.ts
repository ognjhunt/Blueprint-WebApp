// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer } from "http";
import type { Server } from "node:http";

// Firestore fixture rows per collection. Each row is { id, data }.
const collectionData = vi.hoisted(
  () =>
    ({
      operatorAlerts: [
        {
          id: "alert-1",
          data: {
            class: "payout_failed",
            severity: "critical",
            message: "Creator payout disbursement failed",
            acknowledged: false,
            created_at_iso: "2026-07-08T10:00:00.000Z",
          },
        },
        {
          id: "alert-2",
          data: {
            class: "spend_alert",
            severity: "warning",
            message: "Hosted runtime approaching ceiling",
            acknowledged: true,
            created_at_iso: "2026-07-08T09:00:00.000Z",
          },
        },
      ],
      inboundRequests: [
        {
          id: "req-open",
          data: {
            requestId: "req-open",
            qualification_state: "in_review",
            priority: "high",
            ops: { rights_status: "verified", capture_status: "under_review" },
            createdAt: "2026-07-08T08:00:00.000Z",
          },
        },
        {
          id: "req-blocked",
          data: {
            requestId: "req-blocked",
            qualification_state: "submitted",
            priority: "normal",
            ops: { rights_status: "blocked", capture_policy_tier: "not_allowed" },
            createdAt: "2026-07-08T07:00:00.000Z",
          },
        },
        {
          id: "req-done",
          data: {
            requestId: "req-done",
            qualification_state: "qualified_ready",
            priority: "low",
            ops: { rights_status: "verified" },
            createdAt: "2026-07-07T07:00:00.000Z",
          },
        },
      ],
      creatorPayouts: [
        {
          id: "payout-hold",
          data: {
            creator_id: "creator-1",
            status: "on_hold",
            approved_amount_cents: 15000,
            failure_reason: null,
            created_at: "2026-07-08T06:00:00.000Z",
          },
        },
        {
          id: "payout-failed",
          data: {
            creator_id: "creator-2",
            status: "disbursement_failed",
            base_payout_cents: 6500,
            failure_reason: "transfer_failed",
            created_at: "2026-07-08T05:00:00.000Z",
          },
        },
        {
          id: "payout-paid",
          data: {
            creator_id: "creator-3",
            status: "paid",
            approved_amount_cents: 9000,
            created_at: "2026-07-07T05:00:00.000Z",
          },
        },
      ],
      capture_submissions: [
        {
          id: "cap-stuck",
          data: {
            capture_id: "cap-stuck",
            status: "under_review",
            lifecycle: { upload_started_at: "2026-07-08T04:00:00.000Z" },
            created_at: "2026-07-08T04:00:00.000Z",
          },
        },
        {
          id: "cap-done",
          data: {
            capture_id: "cap-done",
            status: "approved",
            lifecycle: {
              upload_started_at: "2026-07-07T04:00:00.000Z",
              capture_uploaded_at: "2026-07-07T04:30:00.000Z",
            },
            created_at: "2026-07-07T04:00:00.000Z",
          },
        },
      ],
      buyerOrders: [
        {
          id: "order-failed",
          data: {
            status: "payment_failed",
            payment_status: "failed",
            fulfillment_status: "awaiting_payment",
            failure_reason: "card_declined",
            created_at: "2026-07-08T03:00:00.000Z",
          },
        },
        {
          id: "order-ok",
          data: {
            status: "fulfilled",
            payment_status: "paid",
            fulfillment_status: "provisioned",
            created_at: "2026-07-07T03:00:00.000Z",
          },
        },
      ],
    }) as Record<string, Array<{ id: string; data: Record<string, unknown> }>>,
);

// users docs keyed by uid, used by access-control role resolution.
const userDocs = vi.hoisted(
  () => ({}) as Record<string, { roles?: string[]; admin?: boolean; ops?: boolean }>,
);

function makeDoc(row: { id: string; data: Record<string, unknown> }) {
  return { id: row.id, data: () => row.data };
}

function makeCollection(name: string) {
  if (name === "users") {
    return {
      doc: (uid: string) => ({
        get: async () => {
          const record = userDocs[uid];
          return record
            ? { exists: true, data: () => record }
            : { exists: false, data: () => undefined };
        },
      }),
    };
  }

  const docs = (collectionData[name] || []).map(makeDoc);
  const builder: Record<string, unknown> = {
    orderBy: () => builder,
    limit: () => builder,
    where: () => builder,
    get: async () => ({ docs }),
    doc: () => ({ get: async () => ({ exists: false, data: () => undefined }) }),
  };
  return builder;
}

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  default: {
    firestore: {
      FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP" },
    },
  },
  dbAdmin: {
    collection: (name: string) => makeCollection(name),
  },
  authAdmin: null,
  storageAdmin: null,
}));

type FirebaseUserLike =
  | { uid: string; email?: string; admin?: boolean; ops?: boolean }
  | undefined;

async function startServer(firebaseUser: FirebaseUserLike): Promise<{
  server: Server;
  baseUrl: string;
}> {
  const { default: router } = await import("../routes/ops-summary");
  const app = express();
  app.use(express.json());
  app.use((_req, res, next) => {
    if (firebaseUser) {
      res.locals.firebaseUser = firebaseUser;
    }
    next();
  });
  app.use("/", router);

  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind ops-summary test server");
  }
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function stopServer(server: Server) {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}

afterEach(() => {
  for (const key of Object.keys(userDocs)) {
    delete userDocs[key];
  }
  vi.resetModules();
});

describe("GET /api/ops/summary auth gate", () => {
  it("returns 401 when there is no authenticated user", async () => {
    const { server, baseUrl } = await startServer(undefined);
    try {
      const response = await fetch(`${baseUrl}/`);
      expect(response.status).toBe(401);
    } finally {
      await stopServer(server);
    }
  });

  it("returns 403 when the user has no admin/ops role", async () => {
    const { server, baseUrl } = await startServer({
      uid: "buyer-1",
      email: "buyer@example.com",
    });
    try {
      const response = await fetch(`${baseUrl}/`);
      expect(response.status).toBe(403);
    } finally {
      await stopServer(server);
    }
  });

  it("allows an ops-role user resolved from the users doc", async () => {
    userDocs["ops-doc-user"] = { roles: ["ops"] };
    const { server, baseUrl } = await startServer({
      uid: "ops-doc-user",
      email: "ops-doc@example.com",
    });
    try {
      const response = await fetch(`${baseUrl}/`);
      expect(response.status).toBe(200);
    } finally {
      await stopServer(server);
    }
  });
});

describe("GET /api/ops/summary real data mapping", () => {
  it("maps real Firestore collections into the ops panels for an admin", async () => {
    const { server, baseUrl } = await startServer({
      uid: "admin-1",
      email: "ops@tryblueprint.io",
      admin: true,
    });
    try {
      const response = await fetch(`${baseUrl}/`);
      expect(response.status).toBe(200);
      const payload = (await response.json()) as {
        ok: boolean;
        operatorEmail: string | null;
        panels: {
          alerts: any;
          queue: any;
          payouts: any;
          captures: any;
          orders: any;
        };
        notWired: Array<{ key: string }>;
      };

      expect(payload.ok).toBe(true);
      expect(payload.operatorEmail).toBe("ops@tryblueprint.io");

      // operatorAlerts (R037): one unacknowledged critical, one acknowledged.
      expect(payload.panels.alerts.wired).toBe(true);
      expect(payload.panels.alerts.unacknowledged).toBe(1);
      expect(payload.panels.alerts.bySeverity.critical).toBe(1);
      expect(payload.panels.alerts.recent).toHaveLength(1);
      expect(payload.panels.alerts.recent[0].id).toBe("alert-1");

      // inboundRequests: in_review + submitted are in-flight; one is blocked.
      expect(payload.panels.queue.wired).toBe(true);
      expect(payload.panels.queue.open).toBe(2);
      expect(payload.panels.queue.blocked).toBe(1);
      // No PII (site name/contact) leaks into the row shape.
      expect(payload.panels.queue.recent[0]).not.toHaveProperty("site");
      expect(payload.panels.queue.recent.map((r: { id: string }) => r.id)).toContain(
        "req-blocked",
      );

      // creatorPayouts: on_hold + disbursement_failed are exceptions; paid is not.
      expect(payload.panels.payouts.wired).toBe(true);
      expect(payload.panels.payouts.exceptions).toBe(2);
      expect(payload.panels.payouts.onHold).toBe(1);
      expect(payload.panels.payouts.failed).toBe(1);
      const holdRow = payload.panels.payouts.recent.find(
        (row: { id: string }) => row.id === "payout-hold",
      );
      expect(holdRow.amountCents).toBe(15000);

      // capture_submissions: upload started but not uploaded = stuck.
      expect(payload.panels.captures.wired).toBe(true);
      expect(payload.panels.captures.stuck).toBe(1);
      expect(payload.panels.captures.underReview).toBe(1);

      // buyerOrders: one payment failure.
      expect(payload.panels.orders.wired).toBe(true);
      expect(payload.panels.orders.paymentFailed).toBe(1);
      expect(payload.panels.orders.exceptions).toBe(1);

      // Panels with no real source yet are listed, not faked.
      expect(payload.notWired.map((p) => p.key)).toContain("spendCategories");
    } finally {
      await stopServer(server);
    }
  });
});
