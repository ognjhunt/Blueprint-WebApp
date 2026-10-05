// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer } from "http";
import type { Server } from "node:http";
import { outreachDraft, passingOutreachChecks } from "./fixtures/outreach-review";
import { reviewOutreachDraft } from "../agents/outreach-review";

const approveActionMock = vi.hoisted(() => vi.fn());
const rejectActionMock = vi.hoisted(() => vi.fn());
const retryFailedActionMock = vi.hoisted(() => vi.fn());
const reviseDraftMock = vi.hoisted(() => vi.fn());
const mirrorGmailMock = vi.hoisted(() => vi.fn());
const gmailPortsMock = vi.hoisted(() => vi.fn(() => ({ manualApprovedCopy: true })));

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
  {
    id: "ledger-3",
    data: {
      status: "sent",
      lane: "inbound",
      action_type: "send_email",
      source_collection: "inboundRequests",
      source_doc_id: "request-1",
      action_tier: 1,
      idempotency_key: "inbound:request-1",
      auto_approve_reason: "policy_auto_approved",
      approval_reason: null,
      approved_by: null,
      approved_at: null,
      rejected_by: null,
      rejected_reason: null,
      execution_attempts: 1,
      last_execution_error: null,
      created_at: "2026-03-29T12:07:00.000Z",
      updated_at: "2026-03-29T12:08:00.000Z",
      sent_at: "2026-03-29T12:08:00.000Z",
      last_execution_at: "2026-03-29T12:08:00.000Z",
      action_payload: {
        to: "buyer@robotics.co",
        subject: "Next step for your Blueprint request",
        body: "Blueprint can route this into a package path after one missing detail.",
      },
      draft_output: {
        recommendation: "needs_more_evidence",
        confidence: 0.91,
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

vi.mock("../agents/communications-draft-revision", async importOriginal => ({
  ...await importOriginal<typeof import("../agents/communications-draft-revision")>(),
  reviseCommunicationsDraft: reviseDraftMock,
}));
vi.mock("../agents/communications-gmail-draft", async importOriginal => ({
  ...await importOriginal<typeof import("../agents/communications-gmail-draft")>(),
  mirrorCommunicationsGmailDraft: mirrorGmailMock, configuredGmailDraftPorts: gmailPortsMock,
}));

async function startServer(admin = true): Promise<{ server: Server; baseUrl: string }> {
  const { default: router } = await import("../routes/admin-leads");
  const app = express();
  app.use(express.json());
  app.use((_, res, next) => {
    res.locals.firebaseUser = {
      uid: "admin-user",
      email: "ops@tryblueprint.io",
      admin,
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
  reviseDraftMock.mockReset();
  mirrorGmailMock.mockReset(); gmailPortsMock.mockClear(); vi.unstubAllEnvs();
  vi.resetModules();
});

describe("admin action queue", () => {
  it("uses the explicit manual copy path only for the configured authenticated owner", async () => {
    vi.stubEnv("BLUEPRINT_COMMUNICATIONS_GMAIL_OAUTH_OWNER_UID","admin-user");
    vi.stubEnv("BLUEPRINT_COMMUNICATIONS_GMAIL_DRAFTS_ENABLED","false");
    mirrorGmailMock.mockResolvedValue({state:"verified",sent:false,approved:false});
    const {server,baseUrl}=await startServer();
    try {
      const body={expectedReviewDigest:"a".repeat(64),expectedRevisionId:"b".repeat(64),mode:"write"};
      const response=await fetch(`${baseUrl}/action-queue/communications_${"c".repeat(64)}/gmail-draft`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      expect(response.status).toBe(200);expect(await response.json()).toMatchObject({sent:false,approved:false});
      expect(gmailPortsMock).toHaveBeenCalledExactlyOnceWith(undefined,"manual_approved_copy");
      expect(mirrorGmailMock).toHaveBeenCalledExactlyOnceWith(expect.any(Object),`communications_${"c".repeat(64)}`,"ops@tryblueprint.io",body,{manualApprovedCopy:true});
      expect(approveActionMock).not.toHaveBeenCalled();
      expect(process.env.BLUEPRINT_COMMUNICATIONS_GMAIL_DRAFTS_ENABLED).toBe("false");
    } finally {await stopServer(server);}
  });
  it.each(["different-owner",""])("does not give another admin or missing owner a manual copy path (%s)",async owner=>{
    vi.stubEnv("BLUEPRINT_COMMUNICATIONS_GMAIL_OAUTH_OWNER_UID",owner);
    const {server,baseUrl}=await startServer();
    try {
      const response=await fetch(`${baseUrl}/action-queue/communications_${"c".repeat(64)}/gmail-draft`,{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});
      expect(response.status).toBe(403);expect(await response.json()).toMatchObject({error:"gmail_draft_owner_required"});
      expect(mirrorGmailMock).not.toHaveBeenCalled();expect(gmailPortsMock).not.toHaveBeenCalled();
    } finally {await stopServer(server);}
  });
  it("revises only through authenticated admin identity and returns actionable validation errors", async () => {
    const { CommunicationsDraftRevisionError } = await import("../agents/communications-draft-revision");
    reviseDraftMock.mockRejectedValue(new CommunicationsDraftRevisionError("Repair the named draft fields and revalidate", 400,
      [{ path: "/requiresHumanReview", message: "Must remain true" }]));
    const { server, baseUrl } = await startServer();
    const body = { expectedReviewDigest: "a".repeat(64), output: { body: "Revised draft" }, requestedBy: "invented@example.com" };
    try {
      const response = await fetch(`${baseUrl}/action-queue/communications_saved/revise`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ error: "Repair the named draft fields and revalidate", issues: [{ path: "/requiresHumanReview" }] });
      expect(reviseDraftMock).toHaveBeenCalledWith(expect.any(Object), "communications_saved", "ops@tryblueprint.io", body);
    } finally { await stopServer(server); }
  });

  it("refuses non-admin draft revisions before reaching the service", async () => {
    const { server, baseUrl } = await startServer(false);
    try {
      const response = await fetch(`${baseUrl}/action-queue/communications_saved/revise`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      expect(response.status).toBe(403); expect(reviseDraftMock).not.toHaveBeenCalled();
    } finally { await stopServer(server); }
  });
  it("keeps interrupted communications sends visible for receipt-only recovery", async () => {
    const original = ledgerRows[0];
    ledgerRows[0] = { ...original, data: { ...original.data, status: "executing" } };
    Object.assign(ledgerRows[0].data.action_payload, { communications: { version: "invalid_marker_fails_closed" } });
    const { server, baseUrl } = await startServer();
    try {
      const response = await fetch(`${baseUrl}/action-queue?limit=25`);
      const data = await response.json();
      expect(data.items.find((item: { id: string }) => item.id === original.id).status).toBe("executing");
      delete (ledgerRows[0].data.action_payload as any).communications;
      const generic = await (await fetch(`${baseUrl}/action-queue?limit=25`)).json();
      expect(generic.items.some((item: { id: string }) => item.id === original.id)).toBe(false);
    } finally { delete (original.data.action_payload as any).communications; ledgerRows[0] = original; await stopServer(server); }
  });
  it("returns the current outreach review digest and checklist for a stored prospect draft", async () => {
    const original = ledgerRows[0];
    ledgerRows[0] = { ...original, data: { ...original.data, lane: "outbound_prospect", source_collection: "outboundProspects",
      action_payload: { to: outreachDraft.to, subject: outreachDraft.subject, body: outreachDraft.body },
    } };
    Object.assign(ledgerRows[0].data.action_payload, { outreachContract: outreachDraft.contract, outreachContext: outreachDraft.context });
    const { server, baseUrl } = await startServer();
    try {
      const response = await fetch(`${baseUrl}/action-queue?limit=25`);
      const data = await response.json();
      const item = data.items.find((row: { id: string }) => row.id === "ledger-1");
      expect(item.outreach_review).toEqual(reviewOutreachDraft(outreachDraft));
    } finally { ledgerRows[0] = original; await stopServer(server); }
  });

  it("exposes an outreach-ready hypothesis draft's tier, send authority and draft-only reason", async () => {
    const original = ledgerRows[0];
    ledgerRows[0] = { ...original, data: { ...original.data, lane: "outbound_prospect", source_collection: "outboundProspects",
      approval_reason: "outreach_ready_hypothesis_draft_only", qualification_tier: "outreach_ready", send_authority: "none",
      action_payload: { to: "sortingops@hypothesis-operator.example", subject: "About sorting", body: "Synthetic draft body" } } as any };
    const { server, baseUrl } = await startServer();
    try {
      const data = await (await fetch(`${baseUrl}/action-queue?limit=25`)).json();
      expect(data.items.find((row: { id: string }) => row.id === "ledger-1")).toMatchObject({ qualification_tier: "outreach_ready",
        send_authority: "none", approval_reason: "outreach_ready_hypothesis_draft_only" });
      // Other rows keep their exact shape: the fields appear only on a hypothesis draft.
      expect(data.items.find((row: { id: string }) => row.id === "ledger-2")).not.toHaveProperty("qualification_tier");
      expect(data.items.find((row: { id: string }) => row.id === "ledger-2")).not.toHaveProperty("send_authority");
    } finally { ledgerRows[0] = original; await stopServer(server); }
  });

  it("forwards the separate semantic attestation using the authenticated operator identity", async () => {
    const review = { digest: reviewOutreachDraft(outreachDraft).digest, checks: passingOutreachChecks };
    approveActionMock.mockResolvedValue({ state: "pending_approval", tier: 3, ledgerDocId: "outreach-1" });
    const { server, baseUrl } = await startServer();
    try {
      const response = await fetch(`${baseUrl}/action-queue/outreach-1/approve`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outreachSemanticReview: review, operatorEmail: "invented@sender.co" }),
      });
      expect(response.status).toBe(200);
      expect(approveActionMock).toHaveBeenCalledWith("outreach-1", "ops@tryblueprint.io", review);
    } finally { await stopServer(server); }
  });

  it("lists pending and failed ledger items", async () => {
    const { server, baseUrl } = await startServer();
    try {
      const response = await fetch(`${baseUrl}/action-queue?limit=25`);
      expect(response.status).toBe(200);

      const payload = (await response.json()) as {
        items: Array<{ id: string; status: string; lane: string }>;
        summary: { total: number; pending_approval: number; failed: number; sent: number };
      };

      expect(payload.items.map((item) => item.id)).toEqual(["ledger-2", "ledger-1"]);
      expect(payload.summary).toEqual({
        total: 2,
        pending_approval: 1,
        failed: 1,
        sent: 0,
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
      expect(approveActionMock).toHaveBeenCalledWith("ledger-1", "ops@tryblueprint.io", undefined);

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

  it("can list sent intake actions for delivery telemetry", async () => {
    const { server, baseUrl } = await startServer();
    try {
      const response = await fetch(`${baseUrl}/action-queue?status=sent&lane=inbound&limit=25`);
      expect(response.status).toBe(200);

      const payload = (await response.json()) as {
        items: Array<{ id: string; status: string; lane: string; sent_at: string | null }>;
        summary: { total: number; sent: number };
      };

      expect(payload.items).toEqual([
        expect.objectContaining({
          id: "ledger-3",
          status: "sent",
          lane: "inbound",
          sent_at: "2026-03-29T12:08:00.000Z",
        }),
      ]);
      expect(payload.summary.sent).toBe(1);
    } finally {
      await stopServer(server);
    }
  });
});
