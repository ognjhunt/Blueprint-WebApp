// @vitest-environment node
import express from "express";
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
import type { JobMarketplaceWorkflow } from "../../client/src/types/jobMarketplace";
import { screeningFixture } from "./fixtures/beta-policy-screening";

const captures = vi.hoisted(() => ({ received: true as boolean | null }));
vi.mock("../utils/siteWalkthrough", () => ({
  siteWalkthroughIdentity: (requestId: string) => ({ requestId, sceneId: `site-${requestId}`, captureId: `walkthrough-${requestId}` }),
  savedWalkthrough: async () => captures.received === null ? null : { received: captures.received },
}));
vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore } = await import("./helpers/fake-firestore");
  return { dbAdmin: sharedFakeFirestore, storageAdmin: null,
    authAdmin: { verifyIdToken: async (token: string) => {
      if (token === "ops-token") return { uid: "ops-user", email: "ops@example.test", role: "ops" };
      if (token === "ordinary-token") return { uid: "ordinary-user", email: "buyer@example.test" };
      throw new Error("invalid token");
    } }, default: {} };
});
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock("express-rate-limit", () => ({ default: () => (_req: unknown, _res: unknown, next: () => void) => next() }));

const { createCaptureUploadToken } = await import("../utils/captureUploadToken");
const { projectJobMarketplace } = await import("../utils/jobMarketplaceWorkflow");
const router = (await import("../routes/job-workflow")).default;
const { csrfProtection } = await import("../middleware/csrf");
const token = (requestId = "job-1", scope: "owner" | "film" = "owner") => createCaptureUploadToken({ requestId,
  captureId: `walkthrough-${requestId}`, sceneId: `site-${requestId}`, scope });
const csrf = { cookie: "csrf_token=workflow-test", "x-csrf-token": "workflow-test" };
let server: Server, base = "";
beforeAll(async () => {
  const app = express(); app.use(express.json()); app.use("/api/job-workflow", csrfProtection, router);
  server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/job-workflow`;
});
afterAll(async () => { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); });
beforeEach(() => {
  captures.received = true;
  state.docs.clear();
  for (const id of ["job-1", "job-2"]) {
    state.docs.set(`inboundRequests/${id}`, { request: { buyerType: "site_operator", siteTaskSpec: { jobFrequency: "Every shift", purchaseReadiness: "planning" } },
      contact: { email: "PRIVATE_EMAIL", phone: "PRIVATE_PHONE" }, account_owner_uid: "PRIVATE_UID" });
    state.docs.set(`siteTaskBriefs/${id}`, { requestId: id, summary: "Move sealed cases into trays", confirmedAtIso: "2026-10-20T10:00:00.000Z", confirmedBy: "Site owner" });
  }
});
async function api(path: string, method = "GET", body?: unknown, auth?: string, extra: Record<string, string> = {}) {
  const response = await fetch(`${base}${path}`, { method, headers: { ...csrf, "content-type": "application/json", ...(auth ? { authorization: `Bearer ${auth}` } : {}), ...extra },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, headers: response.headers, body: await response.json() as JobMarketplaceWorkflow & { code?: string; error?: string } };
}
const admin = (path = "", method = "GET", body?: unknown, extra?: Record<string, string>) => api(`/admin/job-1${path}`, method, body, "ops-token", extra);
const owner = (path = "", method = "GET", body?: unknown) => api(`/owner/${token()}${path}`, method, body);
const review = { disposition: "options_identified" as const, summary: "A fixed arm can do the scoped transfer.", nextAction: "Blueprint is checking delivery for the approach that worked." };

describe("job workflow authority and durable decisions", () => {
  it("shows diagnostic screening on a proposed preparation task without assessing options early", async () => {
    const { publication, job, brief, intake } = screeningFixture(true);
    state.docs.set("inboundRequests/job-one", job);
    state.docs.set("siteTaskBriefs/job-one", brief);
    state.docs.set("taskEvaluationSceneIntakes/intake-one", intake);
    const { ingestBetaPolicyScreening } = await import("../utils/betaPolicyScreeningIngest");
    await ingestBetaPolicyScreening(publication);
    const view = await api(`/owner/${token("job-one")}`);
    expect(view.status).toBe(200);
    expect(view.body.briefAgreed).toBe(false);
    expect(view.body.managedEvidence?.[0]).toMatchObject({ current: true, state: "queued", resultDigest: null });
    expect(view.body.managedEvidence?.[0].screening?.candidates).toHaveLength(36);
    const refused = await api("/admin/job-one/review", "POST", review, "ops-token");
    expect(refused.status).toBe(409);
    expect(refused.body.code).toBe("brief_not_agreed");
  });
  it("rejects anonymous/nonstaff admin access, forged and film-only links, and missing CSRF", async () => {
    expect((await api("/admin/job-1")).status).toBe(401);
    expect((await api("/admin/job-1", "GET", undefined, "ordinary-token")).status).toBe(403);
    expect((await api("/owner/forged")).status).toBe(403);
    expect((await api(`/owner/${token("job-1", "film")}`)).status).toBe(403);
    const response = await fetch(`${base}/owner/${token()}/requirements`, { method: "PATCH", headers: { "content-type": "application/json" }, body: "{}" });
    expect(response.status).toBe(403);
    expect(state.docs.get("inboundRequests/job-1")?.job_marketplace).toBeUndefined();
  });

  it("retains optional stated requirements without leaking private record fields", async () => {
    const initial = await owner();
    expect(initial.body.requirements.jobFrequency).toBe("Every shift");
    expect(initial.body.requirements.purchaseReadiness).toBe("planning");
    expect(initial.body.stage).toBe("brief_agreed");
    expect(initial.headers.get("cache-control")).toBe("no-store");
    expect(JSON.stringify(initial.body)).not.toMatch(/PRIVATE_|updatedBy|contact/);
    const saved = await owner("/requirements", "PATCH", { ongoingBudget: "Not sure yet", purchaseReadiness: "exploring" });
    expect(saved.status).toBe(200);
    expect(saved.body.requirements.ongoingBudget).toBe("Not sure yet");
    expect(saved.body).not.toHaveProperty("proposals");
    expect((await owner("/requirements", "PATCH", { purchaseReadiness: "funded_automatically" })).status).toBe(400);
    expect((await owner("/requirements", "PATCH", { installationBudget: "x".repeat(501) })).status).toBe(400);
    expect(state.docs.get("inboundRequests/job-1")?.pilot_booking).toBeUndefined();
  });

  it("offers no proposal, selection, agreement or outcome route", async () => {
    const body = JSON.stringify({ proposalId: "proposal-1", expectedRevision: "0".repeat(64), authorized: true });
    const status = async (path: string, method: string, auth?: string) => (await fetch(`${base}${path}`, { method, body,
      headers: { ...csrf, "content-type": "application/json", ...(auth ? { authorization: `Bearer ${auth}` } : {}) } })).status;
    for (const path of ["/select", "/outcome"]) expect(await status(`/owner/${token()}${path}`, "POST")).toBe(404);
    for (const [path, method] of [["/proposals", "POST"], ["/proposals/proposal-1", "PUT"], ["/proposals/proposal-1/withdraw", "POST"], ["/agreement", "POST"]]) {
      expect(await status(`/admin/job-1${path}`, method, "ops-token")).toBe(404);
    }
    expect(state.docs.get("inboundRequests/job-1")?.job_marketplace).toBeUndefined();
  });

  it("leaves stored legacy proposal records untouched and never projects them", async () => {
    const legacy = { schemaVersion: "job_marketplace.v1", proposals: [{ id: "legacy-proposal" }],
      selection: { proposalId: "legacy-proposal", proposalRevision: "0".repeat(64), selectedAtIso: "2026-10-20T12:00:00.000Z" },
      agreement: { proposalId: "legacy-proposal" }, outcome: { summary: "Legacy owner report" } };
    const record: any = state.docs.get("inboundRequests/job-1");
    state.docs.set("inboundRequests/job-1", { ...record, job_marketplace: legacy });
    const view = await owner();
    for (const field of ["proposals", "selection", "agreement", "outcome"]) expect(view.body).not.toHaveProperty(field);
    const saved = await owner("/requirements", "PATCH", { ongoingBudget: "Not sure yet" });
    expect(saved.status).toBe(200);
    const stored: any = state.docs.get("inboundRequests/job-1");
    expect(stored.job_marketplace).toMatchObject({ proposals: legacy.proposals, selection: legacy.selection, agreement: legacy.agreement, outcome: legacy.outcome,
      requirements: { ongoingBudget: "Not sure yet" } });
    expect(JSON.stringify(saved.body)).not.toMatch(/legacy-proposal|Legacy owner report/);
  });

  it("assesses options against the confirmed brief and asks for re-review when it changes", async () => {
    const assessed = await admin("/review", "POST", review);
    expect(assessed.status).toBe(200);
    expect(assessed.body).toMatchObject({ stage: "options_assessed", optionsAssessed: true, actionOwner: "blueprint", nextAction: review.nextAction });
    // Who confirmed the same brief does not change its scope.
    state.docs.set("siteTaskBriefs/job-1", { ...state.docs.get("siteTaskBriefs/job-1"),
      confirmedAtIso: "2026-10-21T10:00:00.000Z", confirmedBy: "Another authorized site owner" });
    expect((await owner()).body.stage).toBe("options_assessed");
    const changed = await owner("/requirements", "PATCH", { requiredOutput: "Now requires twice the original output" });
    expect(changed.body).toMatchObject({ reviewRequired: true, stage: "brief_agreed", review: null });
    const event = [...state.docs.entries()].find(([path]) => path.includes("jobWorkflowEvents/"))![1];
    expect(event).toHaveProperty("previousState"); expect(event).toHaveProperty("nextState");
    state.docs.set("siteTaskBriefs/job-1", { summary: "A changed unconfirmed job", confirmedAtIso: null });
    expect((await owner()).body.stage).toBe("job_submitted");
  });

  it("blocks revoked jobs", async () => {
    const record: any = state.docs.get("inboundRequests/job-1");
    state.docs.set("inboundRequests/job-1", { ...record, consent_revoked: true });
    expect((await owner()).body.code).toBe("capture_processing_not_authorized");
    expect((await admin()).status).toBe(409);
    expect((await owner("/requirements", "PATCH", { ongoingBudget: "1000" })).status).toBe(409);
  });

  it("does not advance from unconfirmed or malformed stored downstream facts", () => {
    const record = { request: { buyerType: "site_operator" }, job_marketplace: { schemaVersion: "job_marketplace.v1",
      proposals: [], selection: { proposalId: "made-up", proposalRevision: "0".repeat(64), selectedAtIso: "2026-10-20T12:00:00.000Z" },
      agreement: { proposalId: "made-up" }, outcome: { metCriteria: true } } };
    const projected = projectJobMarketplace(record, null);
    expect(projected.stage).toBe("job_submitted");
    for (const field of ["proposals", "selection", "agreement", "outcome"]) expect(projected).not.toHaveProperty(field);
  });

  it("requires a retained video before advancing a written brief to assessment", async () => {
    captures.received = false;
    const record = state.docs.get("inboundRequests/job-1")!;
    state.docs.set("inboundRequests/job-1", { ...record, request: { ...record.request, hasExistingFootage: true } });
    const draft = await owner();
    expect(draft.body.stage).toBe("job_submitted");
    expect(draft.body.briefAgreed).toBe(false);
    expect(draft.body.nextAction).toMatch(/Record or upload a video/);
    expect((await admin("/review", "POST", { disposition: "options_identified", summary: "Written scope", nextAction: "Compare options" })).body.code).toBe("video_required");
    expect(state.docs.get("inboundRequests/job-1")?.job_marketplace).toBeUndefined();
    captures.received = null;
    expect((await admin("/review", "POST", { disposition: "more_information", summary: "Video status unknown", nextAction: "Retry" })).status).toBe(503);
    expect((await owner()).body.nextAction).toMatch(/could not read your recording status/);
  });
});
