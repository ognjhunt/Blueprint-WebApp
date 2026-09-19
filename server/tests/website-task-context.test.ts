// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import express from "express";
import { createServer } from "node:http";
import { projectWebsiteTaskContext } from "../utils/websiteTaskContext";
import type { SiteTaskBriefRecord } from "../utils/siteTaskBrief";

const state = vi.hoisted(() => ({ authorized: true, brief: null as SiteTaskBriefRecord | null }));
vi.mock("../utils/siteTaskBrief", () => ({ getBrief: async () => state.brief }));
vi.mock("../../client/src/lib/firebaseAdmin", () => ({ default: {}, dbAdmin: null }));
vi.mock("../utils/captureFootageReview", () => ({ buildCaptureFootageReviewer: vi.fn() }));
vi.mock("../utils/taskLifecycleNotifications", () => ({ enqueueTaskLifecycleNotification: vi.fn(), reconstructionIsViewable: vi.fn() }));
vi.mock("../utils/worldReconstruction", () => ({ startWorldReconstruction: vi.fn(), advanceWorldReconstruction: vi.fn() }));
vi.mock("../utils/pipelineSyncSecurity", () => ({
  createPipelineSyncRateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  verifyPipelineSyncRequest: () => state.authorized ? { ok: true } : { ok: false, status: 401, code: "unauthorized" },
}));

function brief(confirmed: boolean): SiteTaskBriefRecord {
  return { requestId: "req1", summary: "Move the carton onto the pallet", proposed: [], unresolved: ["cycle"],
    captureMode: "site_walkthrough" as SiteTaskBriefRecord["captureMode"], draftedAtIso: "2026-09-19T00:00:00Z",
    draftedFrom: ["description"], confirmedAtIso: confirmed ? "2026-09-19T01:00:00Z" : null,
    confirmedBy: "private owner identity", operatorAnswers: confirmed ? { item_rigidity: "rigid" } : null,
    operatorUnknown: confirmed ? ["cycle"] : null };
}
afterEach(() => { state.authorized = true; state.brief = null; });

it("binds task content and confirmation without disclosing owner identity", () => {
  const draft = projectWebsiteTaskContext(brief(false));
  const confirmed = projectWebsiteTaskContext(brief(true));
  expect(draft.confirmed).toBe(false);
  expect(confirmed.context_digest).not.toBe(draft.context_digest);
  expect(confirmed.operator_answers).toEqual({ item_rigidity: "rigid" });
  expect(JSON.stringify(confirmed)).not.toContain("private owner identity");
});

it("reads confirmation after upload and rejects unsigned or mismatched capture requests", async () => {
  const { default: router } = await import("../routes/internal-capture-worlds");
  const app = express(); app.use(express.json()); app.use(router);
  const server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address(); if (!address || typeof address === "string") throw new Error("bind failed");
  const post = (capture = "walkthrough-req1") => fetch(`http://127.0.0.1:${address.port}/creator-captures/${capture}/task-context`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ request_id: "req1", scene_id: "site-req1" }),
  });
  try {
    expect((await post()).status).toBe(404);
    state.brief = brief(false);
    expect(await (await post()).json()).toMatchObject({ confirmed: false });
    state.brief = brief(true);
    const response = await post();
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ confirmed: true, capture_id: "walkthrough-req1" });
    expect((await post("walkthrough-other")).status).toBe(409);
    const reconstruction = await fetch(`http://127.0.0.1:${address.port}/creator-captures/walkthrough-req1/world/reconstruct`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ frames_prefix_uri: "gs://capture/unedited/frames" }),
    });
    expect(reconstruction.status).toBe(409);
    expect(await reconstruction.json()).toMatchObject({ code: "website_reconstruction_pipeline_owned" });
    state.authorized = false;
    expect((await post()).status).toBe(401);
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});
