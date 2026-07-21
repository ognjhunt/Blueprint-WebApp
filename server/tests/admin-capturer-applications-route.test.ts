// @vitest-environment node
import express from "express";
import { createServer } from "node:http";
import type { Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  users: new Map<string, Record<string, unknown>>(),
  notifications: [] as Array<Record<string, unknown>>,
}));

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP" } } },
  dbAdmin: {
    collection: (name: string) => ({
      doc: (id: string) => ({
        get: async () => ({ exists: name === "users" && state.users.has(id), data: () => state.users.get(id) }),
        set: async (payload: Record<string, unknown>, options?: { merge?: boolean }) => {
          state.users.set(id, { ...(options?.merge ? state.users.get(id) || {} : {}), ...payload });
        },
      }),
      where: () => ({
        limit: () => ({
          get: async () => ({
            docs: [...state.users.entries()]
              .filter(([, user]) => user.role === "capturer")
              .map(([id, user]) => ({ id, data: () => user })),
          }),
        }),
      }),
    }),
  },
}));

vi.mock("../utils/access-control", () => ({
  hasAnyRole: async (res: express.Response) => res.locals.firebaseUser?.admin === true,
  resolveAccessContext: async () => ({ email: "reviewer@tryblueprint.io" }),
}));

vi.mock("../utils/transactional-notifications", () => ({
  dispatchTransactionalNotification: async (input: Record<string, unknown>) => {
    state.notifications.push(input);
    return { ok: true };
  },
}));

vi.mock("../utils/field-ops-automation", () => ({
  assignCapturerToCaptureJob: vi.fn(),
  discoverSiteAccessContacts: vi.fn(),
  listCapturerCandidates: vi.fn(),
  listFieldOpsCaptureJobs: vi.fn(),
  listFinanceQueue: vi.fn(),
  listRescheduleQueue: vi.fn(),
  processSimpleReschedule: vi.fn(),
  runCapturerReminderLoop: vi.fn(),
  runManualReviewWatchdogLoop: vi.fn(),
  saveSiteAccessContact: vi.fn(),
  sendCapturerCommunication: vi.fn(),
  sendSiteAccessOutreach: vi.fn(),
  updateFinanceReview: vi.fn(),
  updateSiteAccessStatus: vi.fn(),
}));

async function startRoute(): Promise<{ server: Server; baseUrl: string }> {
  const { default: router } = await import("../routes/admin-field-ops");
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    res.locals.firebaseUser = req.headers.authorization === "Bearer admin" ? { uid: "admin", admin: true } : null;
    next();
  });
  app.use("/api/admin/field-ops", router);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server failed to bind");
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function stopServer(server: Server) {
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

afterEach(() => {
  state.users.clear();
  state.notifications.length = 0;
  vi.resetModules();
});

describe("capturer application review routes", () => {
  it("lists the real application records for an operator", async () => {
    state.users.set("capturer-1", {
      role: "capturer",
      name: "Applicant One",
      email: "applicant@example.com",
      capturerApplicationStatus: "pending_review",
    });
    state.users.set("buyer-1", { role: "buyer", name: "Not an applicant" });
    const { server, baseUrl } = await startRoute();
    try {
      const response = await fetch(`${baseUrl}/api/admin/field-ops/capturer-applications`, {
        headers: { Authorization: "Bearer admin" },
      });
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        count: 1,
        applications: [expect.objectContaining({ id: "capturer-1", application_status: "pending_review" })],
      });
    } finally {
      await stopServer(server);
    }
  });

  it("does not invent pending review when an application state is missing", async () => {
    state.users.set("capturer-without-state", {
      role: "capturer",
      name: "Unlinked Capturer",
    });
    const { server, baseUrl } = await startRoute();
    try {
      const response = await fetch(`${baseUrl}/api/admin/field-ops/capturer-applications`, {
        headers: { Authorization: "Bearer admin" },
      });
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        count: 1,
        applications: [
          expect.objectContaining({
            id: "capturer-without-state",
            application_status: null,
          }),
        ],
      });
    } finally {
      await stopServer(server);
    }
  });

  it("approves a capturer and emits the account notification", async () => {
    state.users.set("capturer-1", { role: "capturer", email: "applicant@example.com" });
    const { server, baseUrl } = await startRoute();
    try {
      const response = await fetch(`${baseUrl}/api/admin/field-ops/capturer-applications/capturer-1`, {
        method: "PATCH",
        headers: { Authorization: "Bearer admin", "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved", review_note: "Ready for assignment" }),
      });
      expect(response.status).toBe(200);
      expect(state.users.get("capturer-1")).toEqual(expect.objectContaining({
        capturerApplicationStatus: "approved",
        capturerReviewedBy: "reviewer@tryblueprint.io",
      }));
      expect(state.notifications).toEqual([
        expect.objectContaining({ eventType: "capturer_application_approved", recipientUserId: "capturer-1" }),
      ]);
    } finally {
      await stopServer(server);
    }
  });

  it("denies review access without an ops identity", async () => {
    const { server, baseUrl } = await startRoute();
    try {
      const response = await fetch(`${baseUrl}/api/admin/field-ops/capturer-applications`);
      expect(response.status).toBe(401);
    } finally {
      await stopServer(server);
    }
  });
});
