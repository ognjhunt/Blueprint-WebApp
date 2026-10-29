// @vitest-environment node
/**
 * Owner decision 2026-10-29: a site that only uploads a video gets its job drafted
 * from the footage. Only when the footage showed no job is the site asked for one
 * line, and that line can name an unnamed job only.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer } from "node:http";
import type { Server } from "node:http";

import { sharedFakeFirestoreState } from "./helpers/fake-firestore";

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE } = await import("./helpers/fake-firestore");
  return {
    default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => FAKE_FIELD_DELETE,
      increment: (n: number) => ({ __increment: n }) } } },
    dbAdmin: sharedFakeFirestore,
    storageAdmin: null,
  };
});
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock("../utils/captureOutbox", () => ({
  enqueueOutbox: vi.fn(async () => ({ enqueued: true })),
  deliverOutbox: vi.fn(async () => ({ examined: 0, sent: 0, failed: 0, exhausted: 0 })),
}));

const briefRouter = (await import("../routes/site-task-brief")).default;
const { createCaptureUploadToken } = await import("../utils/captureUploadToken");
const { draftBrief, saveBrief, getBrief, PLACEHOLDER_TASK_SUMMARY } = await import("../utils/siteTaskBrief");

let server: Server;
let baseUrl: string;
const token = (scope: "owner" | "film" = "owner") =>
  createCaptureUploadToken({ requestId: "req-1", captureId: "walkthrough-req-1", sceneId: "site-req-1", scope });
const name = (summary: string, scope: "owner" | "film" = "owner") => fetch(`${baseUrl}/api/site-task-brief/${token(scope)}/task-statement`, {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ summary }) });
const read = async () => (await fetch(`${baseUrl}/api/site-task-brief/${token()}`)).json();

beforeEach(async () => {
  sharedFakeFirestoreState.docs.clear();
  const app = express();
  app.use(express.json());
  app.use("/api/site-task-brief", briefRouter);
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  sharedFakeFirestoreState.docs.set("inboundRequests/req-1", {
    requestId: "req-1", request: { buyerType: "site_operator", capture_mode: "self_capture", capture_region: "us" },
  });
  await saveBrief(draftBrief({ requestId: "req-1", captureMode: "self_capture", summary: PLACEHOLDER_TASK_SUMMARY, proposed: [] }));
});
afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("naming the job in one line", () => {
  it("asks only after the footage was read and showed no job", async () => {
    expect((await read()).taskStatementNeeded).toBe(false);
    const request = sharedFakeFirestoreState.docs.get("inboundRequests/req-1") as Record<string, unknown>;
    request.capture_task_statement_draft = { capture_id: "walkthrough-req-1", state: "none_seen", reviewed_at_iso: "2026-10-29T00:00:00Z" };
    expect((await read()).taskStatementNeeded).toBe(true);
  });

  it("lets the owner name an unnamed job once, never a film-only link or an empty line", async () => {
    expect((await name("Pick up the vase", "film")).status).toBe(403);
    expect((await name("   ")).status).toBe(400);
    const named = await name("Pick up the glass vase and place it at the other end of the table");
    expect(named.status).toBe(200);
    expect((await named.json()).brief.summary).toBe("Pick up the glass vase and place it at the other end of the table");
    expect(await getBrief("req-1")).toMatchObject({ taskFamily: "rigid_pick_and_place", confirmedAtIso: null });
    expect((await name("Move the bins")).status).toBe(409);
    expect((await read()).taskStatementNeeded).toBe(false);
  });
});
