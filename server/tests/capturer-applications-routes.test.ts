// @vitest-environment node
import express from "express";
import { createServer } from "http";
import type { Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const userDocs = new Map<string, Record<string, unknown>>();

const hasAnyRoleMock = vi.hoisted(() => vi.fn(async () => true));

vi.mock("../utils/access-control", () => ({
  hasAnyRole: hasAnyRoleMock,
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
    collection(name: string) {
      if (name !== "users") {
        throw new Error(`Unexpected collection in test: ${name}`);
      }

      return {
        where(field: string, op: string, value: unknown) {
          return {
            limit(count: number) {
              return {
                async get() {
                  if (field !== "capturerApplicationStatus" || op !== "==") {
                    throw new Error(`Unexpected query in test: ${field} ${op}`);
                  }
                  return {
                    docs: [...userDocs.entries()]
                      .filter(([, data]) => data.capturerApplicationStatus === value)
                      .slice(0, count)
                      .map(([id, data]) => ({ id, data: () => data })),
                  };
                },
              };
            },
          };
        },
        doc(id: string) {
          return {
            async get() {
              return {
                exists: userDocs.has(id),
                id,
                data: () => userDocs.get(id),
              };
            },
            async update(payload: Record<string, unknown>) {
              if (!userDocs.has(id)) {
                throw new Error("No document to update");
              }
              userDocs.set(id, { ...(userDocs.get(id) || {}), ...payload });
            },
          };
        },
      };
    },
  },
  storageAdmin: null,
}));

type TestUser = { uid: string; email: string } | null;

async function startServer(
  firebaseUser: TestUser = { uid: "ops-admin-uid", email: "ops@tryblueprint.io" },
): Promise<{ server: Server; baseUrl: string }> {
  const { default: router } = await import("../routes/capturer-applications");
  const app = express();
  app.use(express.json());
  app.use((_, res, next) => {
    if (firebaseUser) {
      res.locals.firebaseUser = firebaseUser;
    }
    next();
  });
  app.use("/api/admin/capturer-applications", router);

  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind test server");
  }
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
}

async function stopServer(server: Server) {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function seedPendingApplication(uid: string, overrides: Record<string, unknown> = {}) {
  userDocs.set(uid, {
    uid,
    email: `${uid}@example.com`,
    displayName: `Capturer ${uid}`,
    name: `Capturer ${uid}`,
    capturerApplicationStatus: "pending_review",
    capturerMarket: "Durham, NC",
    capturerEquipment: ["iPhone 15 Pro"],
    capturerAvailability: "weekends",
    capturerReferralSource: "friend",
    createdDate: "2026-07-01T12:00:00.000Z",
    ...overrides,
  });
}

beforeEach(() => {
  hasAnyRoleMock.mockImplementation(async () => true);
});

afterEach(() => {
  userDocs.clear();
  hasAnyRoleMock.mockReset();
  vi.resetModules();
});

describe("capturer application routes", () => {
  it("returns 401 when no authenticated user is present", async () => {
    const { server, baseUrl } = await startServer(null);
    try {
      const response = await fetch(`${baseUrl}/api/admin/capturer-applications`);
      expect(response.status).toBe(401);
    } finally {
      await stopServer(server);
    }
  });

  it("returns 403 for authenticated non-admin users", async () => {
    hasAnyRoleMock.mockImplementation(async () => false);
    const { server, baseUrl } = await startServer({
      uid: "capturer-uid",
      email: "capturer@example.com",
    });
    try {
      const listResponse = await fetch(`${baseUrl}/api/admin/capturer-applications`);
      expect(listResponse.status).toBe(403);

      const decisionResponse = await fetch(
        `${baseUrl}/api/admin/capturer-applications/capturer-uid/decision`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision: "approved" }),
        },
      );
      expect(decisionResponse.status).toBe(403);
    } finally {
      await stopServer(server);
    }
  });

  it("lists applications from stored fields with pending first", async () => {
    seedPendingApplication("pending-1", {
      createdDate: "2026-07-02T12:00:00.000Z",
    });
    userDocs.set("approved-1", {
      uid: "approved-1",
      email: "approved-1@example.com",
      displayName: "Approved Capturer",
      capturerApplicationStatus: "approved",
      capturerMarket: "Austin, TX",
      capturerEquipment: ["Pixel 9 Pro"],
      capturerAvailability: "flexible",
      createdDate: "2026-07-05T12:00:00.000Z",
      capturerReviewedAt: "2026-07-06T12:00:00.000Z",
      capturerReviewedBy: "ops-admin-uid",
      capturerReviewNote: "Strong market fit",
    });
    // Users without an application never show up (no status field).
    userDocs.set("buyer-1", { uid: "buyer-1", email: "buyer@example.com" });

    const { server, baseUrl } = await startServer();
    try {
      const response = await fetch(`${baseUrl}/api/admin/capturer-applications`);
      expect(response.status).toBe(200);
      const payload = (await response.json()) as {
        ok: boolean;
        applications: Array<Record<string, unknown>>;
      };

      expect(payload.ok).toBe(true);
      expect(payload.applications).toHaveLength(2);
      // Pending first even though approved-1 applied later.
      expect(payload.applications[0]).toMatchObject({
        uid: "pending-1",
        displayName: "Capturer pending-1",
        email: "pending-1@example.com",
        market: "Durham, NC",
        equipment: ["iPhone 15 Pro"],
        availability: "weekends",
        status: "pending_review",
        appliedAt: "2026-07-02T12:00:00.000Z",
        reviewedAt: null,
        reviewedBy: null,
      });
      expect(payload.applications[1]).toMatchObject({
        uid: "approved-1",
        status: "approved",
        reviewedAt: "2026-07-06T12:00:00.000Z",
        reviewedBy: "ops-admin-uid",
        reviewNote: "Strong market fit",
      });
    } finally {
      await stopServer(server);
    }
  });

  it("records an approval with reviewer, server timestamp, and note", async () => {
    seedPendingApplication("pending-1");

    const { server, baseUrl } = await startServer();
    try {
      const response = await fetch(
        `${baseUrl}/api/admin/capturer-applications/pending-1/decision`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision: "approved", note: "Great equipment" }),
        },
      );

      expect(response.status).toBe(200);
      const payload = (await response.json()) as {
        ok: boolean;
        application: Record<string, unknown>;
      };
      expect(payload.ok).toBe(true);
      expect(payload.application).toMatchObject({
        uid: "pending-1",
        status: "approved",
        reviewedBy: "ops-admin-uid",
        reviewNote: "Great equipment",
      });

      const stored = userDocs.get("pending-1");
      expect(stored).toMatchObject({
        capturerApplicationStatus: "approved",
        capturerReviewedAt: "SERVER_TIMESTAMP",
        capturerReviewedBy: "ops-admin-uid",
        capturerReviewNote: "Great equipment",
      });
    } finally {
      await stopServer(server);
    }
  });

  it("records a rejection without a note", async () => {
    seedPendingApplication("pending-2");

    const { server, baseUrl } = await startServer();
    try {
      const response = await fetch(
        `${baseUrl}/api/admin/capturer-applications/pending-2/decision`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision: "rejected" }),
        },
      );

      expect(response.status).toBe(200);
      const stored = userDocs.get("pending-2");
      expect(stored).toMatchObject({
        capturerApplicationStatus: "rejected",
        capturerReviewedAt: "SERVER_TIMESTAMP",
        capturerReviewedBy: "ops-admin-uid",
      });
      expect(stored?.capturerReviewNote).toBeUndefined();
    } finally {
      await stopServer(server);
    }
  });

  it("rejects invalid decision values with 400", async () => {
    seedPendingApplication("pending-1");

    const { server, baseUrl } = await startServer();
    try {
      const response = await fetch(
        `${baseUrl}/api/admin/capturer-applications/pending-1/decision`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision: "maybe" }),
        },
      );

      expect(response.status).toBe(400);
      // Nothing was written.
      expect(userDocs.get("pending-1")?.capturerApplicationStatus).toBe(
        "pending_review",
      );
    } finally {
      await stopServer(server);
    }
  });

  it("returns 404 for an unknown uid", async () => {
    const { server, baseUrl } = await startServer();
    try {
      const response = await fetch(
        `${baseUrl}/api/admin/capturer-applications/no-such-user/decision`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision: "approved" }),
        },
      );
      expect(response.status).toBe(404);
    } finally {
      await stopServer(server);
    }
  });

  it("returns 404 for a user with no capturer application on record", async () => {
    userDocs.set("buyer-1", { uid: "buyer-1", email: "buyer@example.com" });

    const { server, baseUrl } = await startServer();
    try {
      const response = await fetch(
        `${baseUrl}/api/admin/capturer-applications/buyer-1/decision`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision: "rejected" }),
        },
      );
      expect(response.status).toBe(404);
      expect(userDocs.get("buyer-1")?.capturerApplicationStatus).toBeUndefined();
    } finally {
      await stopServer(server);
    }
  });
});
