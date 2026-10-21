// @vitest-environment node
import express from "express";
import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore } = await import("./helpers/fake-firestore");
  return { dbAdmin: sharedFakeFirestore, storageAdmin: null, authAdmin: { verifyIdToken: async () => ({ uid: "ops-user", role: "ops" }) }, default: {} };
});
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock("express-rate-limit", () => ({ default: () => (_req: unknown, _res: unknown, next: () => void) => next() }));
vi.mock("../utils/pipelineSyncSecurity", async importOriginal => ({ ...await importOriginal<typeof import("../utils/pipelineSyncSecurity")>(),
  createPipelineSyncRateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next() }));
const { crossRuntimeArtifactDigest } = await import("../utils/crossRuntimeCanonical");
const { scientificBriefDigest, verifyJobEvidencePublication, buildJobEvidenceRequest } = await import("../utils/jobEvidenceContract");
const { createCaptureUploadToken } = await import("../utils/captureUploadToken");
const { buildPipelineSyncSignature } = await import("../utils/pipelineSyncSecurity");
const { csrfProtection } = await import("../middleware/csrf");
const router = (await import("../routes/job-workflow")).default;
const internal = (await import("../routes/internal-job-evidence")).default;
const examples = JSON.parse(readFileSync(new URL("./fixtures/job-evidence-producer-examples.v1.json", import.meta.url), "utf8"));
const brief = { requestId: "job-1", summary: "Move the specified part", confirmedAtIso: "2026-10-20T10:00:00Z" };
const csrf = { cookie: "csrf_token=job-evidence", "x-csrf-token": "job-evidence" };
let server: Server, base: string;
beforeAll(async () => {
  const app = express(); app.use(express.json({ limit: "2mb" })); app.use("/api/job-workflow", csrfProtection, router); app.use("/api/internal", internal);
  server = createServer(app); await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterAll(async () => { vi.unstubAllEnvs(); await new Promise<void>(resolve => server.close(() => resolve())); });
beforeEach(() => {
  state.docs.clear();
  vi.stubEnv("PIPELINE_SYNC_TOKEN", "local-sync-key"); vi.stubEnv("JOB_EVIDENCE_PIPELINE_URL", "");
  vi.stubEnv("ROBOT_EVAL_JOB_REQUEST_FORWARD_URL", ""); vi.stubEnv("TASK_EVALUATION_RUN_PLAN_URL", "");
  state.docs.set("inboundRequests/job-1", { request: { buyerType: "site_operator" }, PRIVATE_CONTACT: "must-stay-private" });
  state.docs.set("siteTaskBriefs/job-1", brief);
});
const token = () => createCaptureUploadToken({ requestId: "job-1", captureId: "walkthrough-job-1", sceneId: "site-job-1", scope: "owner" });
async function api(path: string, method = "GET", body?: unknown, headers: Record<string, string> = {}) {
  const response = await fetch(`${base}${path}`, { method, headers: { "Content-Type": "application/json", ...csrf, ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, body: await response.json() as any };
}
function boundPublication() {
  const request = { ...structuredClone(examples.description_request), brief_digest: scientificBriefDigest(brief) };
  request.request_digest = crossRuntimeArtifactDigest(request, "request_digest");
  state.docs.set(`inboundRequests/job-1/jobEvidenceRequests/${request.request_id}`, { request, createdAtIso: "2026-10-21T10:00:00Z", sequence: -1 });
  const publication = { ...structuredClone(examples.description_publication), brief_digest: request.brief_digest, request_digest: request.request_digest };
  publication.publication_digest = crossRuntimeArtifactDigest(publication, "publication_digest");
  return publication;
}
function signed(body: unknown) {
  const timestamp = new Date().toISOString();
  return { "X-Blueprint-Pipeline-Timestamp": timestamp, "X-Blueprint-Pipeline-Signature": `sha256=${buildPipelineSyncSignature({ secret: "local-sync-key", timestamp, body: JSON.stringify(body) })}` };
}
describe("job evidence producer and commercial boundary", () => {
  it("keeps evidence applicable through reconfirmation and quote planning while preserving technical edits", () => {
    expect(scientificBriefDigest(brief)).toBe(scientificBriefDigest({ ...brief, confirmedAtIso: "2026-10-22T10:00:00Z", confirmedBy: "Another operator", draftedAtIso: "later", pilotIntent: { start: "later" }, installationBudget: "different" }));
    expect(scientificBriefDigest(brief)).not.toBe(scientificBriefDigest({ ...brief, successCriteria: { cycleTimeSeconds: 8 } }));
    expect(scientificBriefDigest(brief)).not.toBe(scientificBriefDigest({ ...brief, summary: "Different physical task" }));
  });
  it("accepts actual Python-produced plan/result bytes after JavaScript JSON transport without rewriting native digests", () => {
    const roundTrip = JSON.parse(JSON.stringify(examples.native_result));
    expect(verifyJobEvidencePublication(roundTrip).decision_envelope?.decision_envelope_digest).toBe(examples.native_result.decision_envelope.decision_envelope_digest);
    const tampered = structuredClone(roundTrip); tampered.decision_envelope_canonical_json += " ";
    tampered.publication_digest = crossRuntimeArtifactDigest(tampered, "publication_digest");
    expect(() => verifyJobEvidencePublication(tampered)).toThrow("decision_envelope_binding_mismatch");
  });
  it("saves a description-only question without fabricated capture or run and safely reuses its identity", async () => {
    const path = "/api/job-workflow/admin/job-1/evidence";
    const headers = { authorization: "Bearer ops", "Idempotency-Key": "question-key" };
    const first = await api(path, "POST", { question: "Which observation would change the choice?" }, headers);
    const retry = await api(path, "POST", { question: "Which observation would change the choice?" }, headers);
    expect(first.status).toBe(200); expect(retry.status).toBe(200);
    expect(first.body.evidence[0].state).toBe("unavailable"); expect(first.body.evidence[0].runId).toBeNull();
    expect([...state.docs.keys()].filter(key => key.includes("/jobEvidenceRequests/"))).toHaveLength(1);
    expect([...state.docs.keys()].some(key => /captureUploadSessions|taskEvaluationPolicyRuns|taskEvaluationLaunches/.test(key))).toBe(false);
    const conflict = await api(path, "POST", { question: "Different question" }, headers);
    expect(conflict.status).toBe(409);
  });
  it("retains signed publications immutably and returns owner-safe historical applicability independently of budgets", async () => {
    const publication = boundPublication(); const endpoint = "/api/internal/job-evidence-publications";
    expect((await api(endpoint, "POST", publication)).status).toBe(401);
    expect((await api(endpoint, "POST", publication, signed(publication))).body.status).toBe("published");
    expect((await api(endpoint, "POST", publication, signed(publication))).body.status).toBe("replayed");
    const ownerPath = `/api/job-workflow/owner/${token()}`;
    const initial = (await api(ownerPath)).body;
    expect(initial.evidence[0].current).toBe(true); expect(initial.selection).toBeNull();
    expect(JSON.stringify(initial)).not.toMatch(/PRIVATE_CONTACT|authorization_candidates|decision_envelope|requested_by|ops-user/);
    await api(`${ownerPath}/requirements`, "PATCH", { installationBudget: "$40,000 planning ceiling" });
    expect((await api(ownerPath)).body.evidence[0].current).toBe(true);
    state.docs.set("siteTaskBriefs/job-1", { ...brief, summary: "Changed physical task" });
    expect((await api(ownerPath)).body.evidence[0].current).toBe(false);
    const linked = await fetch(`${base}${ownerPath}/evidence/${encodeURIComponent(publication.publication_digest)}`);
    const html = await linked.text();
    expect(linked.status).toBe(200); expect(html).toContain("Historical evidence:"); expect(html).toContain(publication.publication_digest);
    expect(html).not.toContain("PRIVATE_CONTACT");
    expect([...state.docs.keys()].filter(key => key.includes("/jobEvidencePublications/"))).toHaveLength(1);
  });
  it("rejects a wrong task binding, altered payload and stale publication sequence", async () => {
    const publication = boundPublication(); const endpoint = "/api/internal/job-evidence-publications";
    const wrong = { ...publication, approved_task_digest: `sha256:${"b".repeat(64)}` };
    wrong.publication_digest = crossRuntimeArtifactDigest(wrong, "publication_digest");
    expect((await api(endpoint, "POST", wrong, signed(wrong))).body.code).toBe("evidence_binding_mismatch");
    const altered = { ...publication, summary: "Fabricated pass" };
    expect((await api(endpoint, "POST", altered, signed(altered))).status).toBe(400);
    await api(endpoint, "POST", publication, signed(publication));
    const stale = { ...publication, summary: "Earlier publication" };
    stale.publication_digest = crossRuntimeArtifactDigest(stale, "publication_digest");
    expect((await api(endpoint, "POST", stale, signed(stale))).body.code).toBe("evidence_sequence_conflict");
  });
  it("does not relabel a prior unbound scientific context as a current brief", () => {
    const source = examples.native_request;
    const request = buildJobEvidenceRequest({ jobId: "job-1", uid: "ops", idempotencyKey: "current-key", question: source.question,
      brief, record: { request: { buyerType: "site_operator" } }, session: { session_id: "real-session", request: { intake_id: "real-intake" },
        pipeline_site_task_testbed: { testbed: source.testbed, decision_evidence_request: source.decision_evidence_request,
          testbed_canonical_json: source.testbed_canonical_json, decision_request_canonical_json: source.decision_request_canonical_json } } });
    expect(request.testbed).toBeNull(); expect(request.decision_evidence_request).toBeNull(); expect(request.capture_session_id).toBeNull();
  });
});
