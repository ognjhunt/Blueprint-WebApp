// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer } from "http";
import type { Server } from "node:http";

const approveActionMock = vi.hoisted(() => vi.fn());
const rejectActionMock = vi.hoisted(() => vi.fn());
const retryFailedActionMock = vi.hoisted(() => vi.fn());

const ledgerRows = vi.hoisted(() => [
  {
    id: "ledger-1",
    data: {
      status: "pending_approval",
      lane: "waitlist",
      action_type: "send_email",
      source_collection: "waitlistSubmissions",
      source_doc_id: "submission-1",
      action_tier: 3,
      idempotency_key: "waitlist:submission-1",
      auto_approve_reason: null,
      approval_reason: "requires_human_review",
      approved_by: null,
      approved_at: null,
      rejected_by: null,
      rejected_reason: null,
      execution_attempts: 0,
      last_execution_error: null,
      created_at: "2026-03-29T12:00:00.000Z",
      updated_at: "2026-03-29T12:05:00.000Z",
      action_payload: {
        to: "ada@example.com",
        subject: "Invite now",
        body: "Please join the capturer beta.",
      },
      draft_output: {
        recommendation: "invite_now",
        confidence: 0.91,
      },
    },
  },
  {
    id: "ledger-2",
    data: {
      status: "failed",
      lane: "support",
      action_type: "send_email",
      source_collection: "contactRequests",
      source_doc_id: "contact-1",
      action_tier: 1,
      idempotency_key: "support:contact-1",
      auto_approve_reason: "policy_auto_approved",
      approval_reason: null,
      approved_by: "ops@tryblueprint.io",
      approved_at: "2026-03-29T12:03:00.000Z",
      rejected_by: null,
      rejected_reason: null,
      execution_attempts: 2,
      last_execution_error: "SMTP timeout",
      created_at: "2026-03-29T11:50:00.000Z",
      updated_at: "2026-03-29T12:06:00.000Z",
      sent_at: null,
      last_execution_at: "2026-03-29T12:06:00.000Z",
      action_payload: {
        to: "support@example.com",
        subject: "Support reply",
        body: "We can help with that.",
      },
      draft_output: {
        category: "general_support",
        confidence: 0.87,
      },
    },
  },
]);

function makeLedgerDoc(row: (typeof ledgerRows)[number]) {
  return {
    id: row.id,
    data: () => row.data,
  };
}

function createLedgerQuery(status?: string) {
  const query = {
    where: vi.fn((field: string, op: string, value: string) => {
      if (field === "status" && op === "==") {
        return createLedgerQuery(value);
      }
      return query;
    }),
    orderBy: vi.fn(() => query),
    limit: vi.fn((limit: number) => ({
      get: async () => {
        const rows = ledgerRows
          .filter((row) => !status || row.data.status === status)
          .map(makeLedgerDoc)
          .slice(0, limit);
        return { docs: rows };
      },
    })),
    get: async () => ({
      docs: ledgerRows
        .filter((row) => !status || row.data.status === status)
        .map(makeLedgerDoc),
    }),
  };

  return query;
}

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  default: {
    firestore: {
      FieldValue: {
        serverTimestamp: () => "SERVER_TIMESTAMP",
      },
    },
  },
  dbAdmin: {
    collection: (name: string) => {
      if (name === "users") {
        return {
          doc: () => ({
            get: async () => ({ exists: false }),
          }),
        };
      }
      if (name === "action_ledger") {
        return {
          where: vi.fn((field: string, op: string, value: string) => {
            if (field === "status" && op === "==") {
              return createLedgerQuery(value);
            }
            return createLedgerQuery();
          }),
          doc: vi.fn(),
        };
      }
      return {
        doc: vi.fn(),
        where: vi.fn(() => createLedgerQuery()),
      };
    },
  },
  storageAdmin: null,
  authAdmin: null,
}));

vi.mock("../utils/waitlistAutomation", () => ({
  runWaitlistAutomationLoop: vi.fn(),
}));

vi.mock("../agents/action-executor", () => ({
  approveAction: approveActionMock,
  rejectAction: rejectActionMock,
  retryFailedAction: retryFailedActionMock,
}));

async function startServer(): Promise<{ server: Server; baseUrl: string }> {
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
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
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
  approveActionMock.mockReset();
  rejectActionMock.mockReset();
  retryFailedActionMock.mockReset();
  vi.resetModules();
});

describe("admin action queue", () => {
  it("lists pending and failed ledger items", async () => {
    const { server, baseUrl } = await startServer();
    try {
      const response = await fetch(`${baseUrl}/action-queue?limit=25`);
      expect(response.status).toBe(200);

      const payload = (await response.json()) as {
        items: Array<{ id: string; status: string; lane: string }>;
        summary: { total: number; pending_approval: number; failed: number };
      };

      expect(payload.items.map((item) => item.id)).toEqual(["ledger-2", "ledger-1"]);
      expect(payload.summary).toEqual({
        total: 2,
        pending_approval: 1,
        failed: 1,
      });
    } finally {
      await stopServer(server);
    }
  });

  it("approves, rejects, and retries queue items through the executor", async () => {
    approveActionMock.mockResolvedValue({ state: "sent", tier: 3, ledgerDocId: "ledger-1" });
    rejectActionMock.mockResolvedValue({ state: "rejected", tier: 3, ledgerDocId: "ledger-1" });
    retryFailedActionMock.mockResolvedValue({ state: "sent", tier: 1, ledgerDocId: "ledger-2" });

    const { server, baseUrl } = await startServer();

    try {
      const approveResponse = await fetch(`${baseUrl}/action-queue/ledger-1/approve`, {
        method: "POST",
      });
      expect(approveResponse.status).toBe(200);
      expect(approveActionMock).toHaveBeenCalledWith("ledger-1", "ops@tryblueprint.io");

      const rejectResponse = await fetch(`${baseUrl}/action-queue/ledger-1/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Needs human review" }),
      });
      expect(rejectResponse.status).toBe(200);
      expect(rejectActionMock).toHaveBeenCalledWith(
        "ledger-1",
        "ops@tryblueprint.io",
        "Needs human review",
      );

      const retryResponse = await fetch(`${baseUrl}/action-queue/ledger-2/retry`, {
        method: "POST",
      });
      expect(retryResponse.status).toBe(200);
      expect(retryFailedActionMock).toHaveBeenCalledWith("ledger-2");
    } finally {
      await stopServer(server);
    }
  });
});
