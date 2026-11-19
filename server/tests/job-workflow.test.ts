// @vitest-environment node
import express from "express";
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
import type { JobMarketplaceWorkflow } from "../../client/src/types/jobMarketplace";
import { screeningFixture } from "./fixtures/beta-policy-screening";

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
/**
 * The job's evidence records (`/api/job-workflow`): read-only for the site, evidence questions for staff. The site's
 * planning details and Blueprint's options review were removed on 2026-11-19; a stored `job_marketplace` field is
 * neither read nor written.
 */
describe("job workflow authority and durable decisions", () => {
  it("shows no early trial run to the site or to staff, even with its outcome stored", async () => {
    const { publication, job, brief, intake, launch } = screeningFixture();
    state.docs.set(launch.path, launch.record);
    state.docs.set("inboundRequests/job-one", job);
    state.docs.set("siteTaskBriefs/job-one", brief);
    state.docs.set("taskEvaluationSceneIntakes/intake-one", intake);
    // A campaign record as an earlier release stored it, bound to this job.
    state.docs.set(`taskEvaluationPolicyRuns/${publication.campaign_id}`, { run_id: publication.campaign_id,
      run_kind: "beta_policy_screening", state: "completed", screening_outcome: "estimate", result_record_id: "result-one",
      job_evidence_binding: { job_id: "job-one" }, website_request_id: "job-one" });
    const view = await api(`/owner/${token("job-one")}`);
    expect(view.status).toBe(200);
    expect(view.body.managedEvidence).toEqual([]);
    expect(view.body).not.toHaveProperty("candidateReadiness");
    expect(view.body).not.toHaveProperty("proposals");
    const staff = await api("/admin/job-one", "GET", undefined, "ops-token");
    expect(staff.body.managedEvidence).toEqual([]);
  });

  it("rejects anonymous/nonstaff admin access, forged and film-only links", async () => {
    expect((await api("/admin/job-1")).status).toBe(401);
    expect((await api("/admin/job-1", "GET", undefined, "ordinary-token")).status).toBe(403);
    expect((await api("/owner/forged")).status).toBe(403);
    expect((await api(`/owner/${token("job-1", "film")}`)).status).toBe(403);
  });

  it("answers the site's link with its evidence only, never private record fields", async () => {
    const view = await owner();
    expect(view.status).toBe(200);
    expect(view.headers.get("cache-control")).toBe("no-store");
    expect(view.body).toMatchObject({ schemaVersion: "job_marketplace.v1", jobId: "job-1", briefAgreed: true, managedEvidence: [] });
    expect(JSON.stringify(view.body)).not.toMatch(/PRIVATE_|updatedBy|contact|Every shift|planning/);
    state.docs.set("siteTaskBriefs/job-1", { ...state.docs.get("siteTaskBriefs/job-1"), confirmedAtIso: null });
    expect((await owner()).body.briefAgreed).toBe(false);
  });

  it("offers no planning details, options review, proposal, selection, agreement or outcome route", async () => {
    const body = JSON.stringify({ proposalId: "proposal-1", expectedRevision: "0".repeat(64), authorized: true,
      disposition: "options_identified", summary: "A fixed arm can do it.", nextAction: "Check delivery.", ongoingBudget: "1000" });
    const status = async (path: string, method: string, auth?: string) => (await fetch(`${base}${path}`, { method, body,
      headers: { ...csrf, "content-type": "application/json", ...(auth ? { authorization: `Bearer ${auth}` } : {}) } })).status;
    for (const [path, method] of [["/requirements", "PATCH"], ["/select", "POST"], ["/outcome", "POST"]]) {
      expect(await status(`/owner/${token()}${path}`, method)).toBe(404);
    }
    for (const [path, method] of [["/review", "POST"], ["/proposals", "POST"], ["/proposals/proposal-1", "PUT"],
      ["/proposals/proposal-1/withdraw", "POST"], ["/agreement", "POST"]]) {
      expect(await status(`/admin/job-1${path}`, method, "ops-token")).toBe(404);
    }
    expect(state.docs.get("inboundRequests/job-1")?.job_marketplace).toBeUndefined();
  });

  it("leaves a stored planning, review or proposal record untouched and never shows it", async () => {
    const stored = { schemaVersion: "job_marketplace.v1", proposals: [{ id: "legacy-proposal" }],
      requirements: { installationBudget: "Stored budget", purchaseReadiness: "planning" },
      review: { disposition: "options_identified", summary: "Stored review", nextAction: "Stored next action",
        reviewedAtIso: "2026-10-21T12:00:00.000Z", scopeRevision: "a".repeat(64) },
      agreement: { proposalId: "legacy-proposal" }, outcome: { summary: "Legacy owner report" } };
    const record: any = state.docs.get("inboundRequests/job-1");
    state.docs.set("inboundRequests/job-1", { ...record, job_marketplace: stored });
    for (const view of [await owner(), await admin()]) {
      for (const field of ["requirements", "review", "stage", "nextAction", "proposals", "agreement", "outcome"]) expect(view.body).not.toHaveProperty(field);
      expect(JSON.stringify(view.body)).not.toMatch(/Stored budget|Stored review|legacy-proposal|Legacy owner report/);
    }
    expect((state.docs.get("inboundRequests/job-1") as any).job_marketplace).toEqual(stored);
  });

  it("blocks revoked jobs", async () => {
    const record: any = state.docs.get("inboundRequests/job-1");
    state.docs.set("inboundRequests/job-1", { ...record, consent_revoked: true });
    expect((await owner()).body.code).toBe("capture_processing_not_authorized");
    expect((await admin()).status).toBe(409);
  });
});
