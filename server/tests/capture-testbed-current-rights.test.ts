// @vitest-environment node
// Current callback/readback rights regressions. All stores, providers and identities are fixtures.
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer, request, type Server } from "node:http";
import { createRequire } from "node:module";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState as store } from "./helpers/fake-firestore";
import { scientificBriefDigest, jobEvidenceTaskInventoryDigest, scientificContext } from "../utils/jobEvidenceContract";
import { projectWebsiteCaptureRights } from "../utils/websiteTaskContext";
import { canonicalArtifactDigest } from "../utils/taskCandidateContract";
const express = createRequire(new URL("../../package.json", import.meta.url))("express");

const seams = vi.hoisted(() => ({ reads: [] as string[], writes: [] as string[],
  providerCalls: [] as string[], uid: "fixture-owner", beforeTransaction: null as null | (() => void) }));
vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore } = await import("./helpers/fake-firestore");
  return { default: {}, storageAdmin: null, dbAdmin: { ...sharedFakeFirestore,
    runTransaction: async (fn: any) => {
      seams.beforeTransaction?.(); seams.beforeTransaction = null;
      return sharedFakeFirestore.runTransaction(async tx => fn({ ...tx,
        get: async (ref: any) => { seams.reads.push(ref.path); return tx.get(ref); },
        set: (ref: any, data: any, options: any) => { seams.writes.push(ref.path); tx.set(ref, data, options); },
        create: (ref: any, data: any) => { seams.writes.push(ref.path); tx.create(ref, data); },
      }));
    } } };
});
vi.mock("../utils/pipelineSyncSecurity", async original => ({
  ...await original<typeof import("../utils/pipelineSyncSecurity")>(),
  createPipelineSyncRateLimiter: () => (_req: any, _res: any, next: any) => next(),
}));
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock("../utils/storage-provider", () => {
  const blocked = (...args: unknown[]) => { seams.providerCalls.push("storage"); throw new Error("unexpected storage invocation"); };
  return { resolveStorageProviderName: () => "backblaze", safeStorageFileName: blocked,
    authorizeBackblazeCapturePart: blocked, cancelBackblazeResumableCapture: blocked,
    createBackblazeCaptureDownloadGrant: blocked, deleteBackblazeCaptureFile: blocked,
    finishBackblazeResumableCapture: blocked, getBackblazeCaptureFileInfo: blocked,
    listBackblazeCaptureParts: blocked, startBackblazeResumableCapture: blocked, uploadSmallBackblazeCapture: blocked };
});
vi.mock("../utils/taskCandidateForwarding", () => ({
  forwardTaskCandidateDecisionToPipeline: () => { seams.providerCalls.push("task"); throw new Error("unexpected forwarding"); },
}));
vi.mock("../utils/captureUploadForwarding", () => ({
  captureUploadIntakeForwardingReadiness: () => { throw new Error("unexpected readiness call"); },
  forwardCaptureUploadToPipeline: () => { seams.providerCalls.push("intake"); throw new Error("unexpected forwarding"); },
}));
vi.mock("../utils/captureLifecycleForwarding", () => {
  const blocked = () => { seams.providerCalls.push("lifecycle"); throw new Error("unexpected forwarding"); };
  return { applyCompletedCaptureLifecycleToPipeline: blocked, inspectCompletedCaptureLifecycleInPipeline: blocked,
    recordCaptureExternalRevocationEvidenceInPipeline: blocked };
});
vi.mock("../utils/taskEvaluationRunForwarding", () => {
  const blocked = () => { seams.providerCalls.push("evaluation"); throw new Error("unexpected forwarding"); };
  return { forwardTaskEvaluationRunAuthorizationToPipeline: blocked, forwardTaskEvaluationRunExecutionToPipeline: blocked,
    forwardTaskEvaluationRunPlanToPipeline: blocked };
});
vi.mock("../utils/reconstructionForwarding", async original => {
  const blocked = () => { seams.providerCalls.push("reconstruction"); throw new Error("unexpected forwarding"); };
  return { ...await original<typeof import("../utils/reconstructionForwarding")>(),
    forwardReconstructionPlanToPipeline: blocked, forwardReconstructionAuthorizationToPipeline: blocked,
    forwardReconstructionExecutionToPipeline: blocked, forwardTestbedCompilationToPipeline: blocked,
    inspectReconstructionInPipeline: blocked };
});

let server: Server, port: number;
beforeEach(async () => {
  store.docs.clear(); seams.reads = []; seams.writes = []; seams.providerCalls = [];
  seams.uid = "fixture-owner"; seams.beforeTransaction = null;
  vi.stubEnv("PIPELINE_SYNC_TOKEN", "fixture-only-not-a-real-key");
  vi.spyOn(globalThis, "fetch").mockImplementation(async () => { throw new Error("external fetch forbidden in probe"); });
  const [{ default: callback }, { default: owner }] = await Promise.all([
    import("../routes/internal-capture-testbeds"),
    import("../routes/capture-uploads"),
  ]);
  const app = express();
  app.use(express.json({ verify: (req, _res, bytes) => { (req as any).rawBody = bytes.toString("utf8"); } }));
  app.use("/api/internal/pipeline", callback);
  // The existing test convention supplies a local verified identity. Firebase token verification itself is not under test.
  app.use("/api/capture-uploads", (_req, res, next) => { res.locals.firebaseUser = { uid: seams.uid }; next(); }, owner);
  server = createServer(app);
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  port = (server.address() as { port: number }).port;
});
afterEach(async () => {
  expect(seams.providerCalls).toEqual([]);
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  vi.restoreAllMocks(); vi.unstubAllEnvs();
});

async function wire(path: string, body?: any, badSignature = false) {
  const raw = body === undefined ? "" : JSON.stringify(body), timestamp = new Date().toISOString();
  const signature = createHmac("sha256", "fixture-only-not-a-real-key").update(`${timestamp}.${raw}`).digest("hex");
  return new Promise<{ status: number; body: any }>((resolve, reject) => {
    const req = request({ host: "127.0.0.1", port, path, method: body === undefined ? "GET" : "POST",
      headers: { "content-type": "application/json", "content-length": Buffer.byteLength(raw),
        "x-blueprint-pipeline-timestamp": timestamp, "x-blueprint-pipeline-signature": badSignature ? "sha256=00" : `sha256=${signature}` } }, res => {
      const chunks: Buffer[] = []; res.on("data", chunk => chunks.push(Buffer.from(chunk)));
      res.on("end", () => resolve({ status: res.statusCode!, body: JSON.parse(Buffer.concat(chunks).toString("utf8")) }));
    }); req.once("error", reject); req.setTimeout(5000, () => req.destroy(new Error("bounded local probe timeout"))); req.end(raw);
  });
}
function seed() {
  const body = JSON.parse(readFileSync(new URL("./fixtures/pipeline-testbed-publication-v2.json", import.meta.url), "utf8"));
  const jobId = "fixture-aut15-revocation-job";
  const brief: any = { requestId: jobId, summary: "Move the fixture object", captureMode: "self_capture",
    confirmedAtIso: "2026-09-29T00:00:00Z", operatorAnswers: {}, operatorUnknown: [], unresolved: [] };
  const pointer = { schema_version: "job_evidence_source_binding.v1", job_id: jobId,
    capture_session_id: body.capture_session_id, intake_id: body.intake_id,
    source_capture_digest: body.testbed.source_capture_bundles[0].digest, brief_digest: scientificBriefDigest(brief),
    task_inventory_digest: jobEvidenceTaskInventoryDigest(brief), command_request_id: "fixture-task-command", approved_task_digest: body.approved_task_digest };
  body.job_id = jobId; body.brief_digest = pointer.brief_digest;
  const inbound: any = { request: { buyerType: "site_operator", consent_attestation: { granted: true,
    statement_version: "2026-09-18.v1", recorded_at_iso: "2026-09-29T00:00:00Z" } }, job_evidence_source: pointer };
  const session: any = { session_id: body.capture_session_id, owner_user_id: "fixture-owner", status: "uploaded_verification_pending",
    request: { intake_id: body.intake_id, scene_id: `site-${jobId}` },
    approved_task_definition: { approval_status: "approved", approved_task_digest: body.approved_task_digest },
    latest_task_decision_command: { command_request_id: pointer.command_request_id, pipeline_approval_status: "approved" },
    job_evidence_source_binding: pointer };
  store.docs.set(`inboundRequests/${jobId}`, structuredClone(inbound));
  store.docs.set(`siteTaskBriefs/${jobId}`, structuredClone(brief));
  store.docs.set(`captureUploadSessions/${body.capture_session_id}`, structuredClone(session));
  return { body, brief, inbound, session, jobId };
}
const path = (f: ReturnType<typeof seed>) => `captureUploadSessions/${f.body.capture_session_id}`;
const currentSession = (f: ReturnType<typeof seed>) => store.docs.get(path(f)) as any;
const currentInbound = (f: ReturnType<typeof seed>) => store.docs.get(`inboundRequests/${f.jobId}`) as any;
const callbackPath = "/api/internal/pipeline/capture-testbeds";

it("healthy signed publication and actual owner readback retain exact scientific bindings", async () => {
  const f = seed(), post = await wire(callbackPath, f.body);
  expect(post.status).toBe(201);
  const get = await wire(`/api/capture-uploads/${f.body.capture_session_id}/testbed`);
  expect(get.status).toBe(200); expect(get.body.testbed.testbed_digest).toBe(f.body.testbed_digest);
  expect(scientificContext(currentSession(f), { brief: f.brief, record: currentInbound(f) })).not.toBeNull();
});
it("signature and retained source mismatch still refuse publication and unrelated user readback", async () => {
  const f = seed(); expect((await wire(callbackPath, f.body, true)).status).toBe(401);
  expect(seams.writes).toEqual([]);
  const changed = currentSession(f); changed.job_evidence_source_binding.source_capture_digest = `sha256:${"f".repeat(64)}`;
  store.docs.set(path(f), changed);
  expect((await wire(callbackPath, f.body)).status).toBe(409); expect(seams.writes).toEqual([]);
  store.docs.set(path(f), f.session); expect((await wire(callbackPath, f.body)).status).toBe(201);
  seams.uid = "unrelated-fixture-user";
  expect((await wire(`/api/capture-uploads/${f.body.capture_session_id}/testbed`)).status).toBe(404);
});

it.each(["future_processing_denied", "completed_lifecycle", "inbound_consent_revoked"])(
  "does not promote a new current testbed after %s at callback transaction entry", async reason => {
    const f = seed();
    seams.beforeTransaction = () => {
      const s = currentSession(f), inbound = currentInbound(f);
      if (reason === "future_processing_denied") s.capture_access = { future_processing_allowed: false };
      if (reason === "completed_lifecycle") {
        s.capture_access = { future_processing_allowed: false, serve_allowed: false };
        s.completed_capture_lifecycle = { schema_version: "completed_capture_lifecycle_record.v1", status: "revocation_in_progress", action: "consent_revoked" };
        s.status = "revocation_in_progress";
      }
      if (reason === "inbound_consent_revoked") inbound.request.consent_attestation.revoked_at_iso = "2026-10-28T00:00:00Z";
      store.docs.set(path(f), s); store.docs.set(`inboundRequests/${f.jobId}`, inbound);
    };
    const post = await wire(callbackPath, f.body), s = currentSession(f);
    const get = await wire(`/api/capture-uploads/${f.body.capture_session_id}/testbed`);
    const lifecycle = await wire(`/api/capture-uploads/${f.body.capture_session_id}/lifecycle`);
    const currentScience = scientificContext(s, { brief: f.brief, record: currentInbound(f) });
    expect(currentScience).toBeNull(); // Existing job reader independently prevents current reuse.
    const observed = { reason, callbackStatus: post.status, ownerGetStatus: get.status, ownerGetState: get.body.status ?? null,
      currentProjectionAdvanced: s.pipeline_testbed_state === "testbed_ready", lifecycleState: lifecycle.body.state,
      webappAccessDenied: lifecycle.body.webapp_access_denied ?? false,
      inboundRights: projectWebsiteCaptureRights(currentInbound(f)).derived_scene_generation_allowed,
      jobReaderRejectsCurrentReuse: currentScience === null, callbackTransactionReads: [...seams.reads],
      currentSessionWrites: seams.writes.filter(p => p === path(f)).length,
      historicalRecordRetained: [...store.docs.keys()].some(p => p.startsWith("captureSiteTaskTestbeds/")) };
    // A historical receipt may remain. The current/new-published projection must not be advanced after authority ends.
    expect(post.status).toBe(410);
    expect(get.status).toBe(410);
    expect(get.body.testbed).toBeUndefined();
    expect(observed.currentProjectionAdvanced).toBe(false);
    expect(observed.currentSessionWrites).toBe(0);
    expect(observed.historicalRecordRetained).toBe(false);
  },
);

it("an exact late replay may retain history without refreshing a revoked current projection", async () => {
  const f = seed(); expect((await wire(callbackPath, f.body)).status).toBe(201);
  const s = currentSession(f); s.capture_access = { future_processing_allowed: false, serve_allowed: false };
  s.completed_capture_lifecycle = { status: "revoked", action: "consent_revoked" };
  s.pipeline_testbed_projection_updated_at_iso = "2026-09-29T00:00:00Z"; store.docs.set(path(f), s);
  seams.writes = [];
  const replay = await wire(callbackPath, f.body);
  expect(replay.status).toBe(410); // Retained history remains; current-ready acceptance is not refreshed.
  expect([...store.docs.keys()].filter(p => p.startsWith("captureSiteTaskTestbeds/"))).toHaveLength(1);
  expect(seams.writes.filter(p => p === path(f))).toHaveLength(0);
  expect(currentSession(f).pipeline_testbed_projection_updated_at_iso).toBe("2026-09-29T00:00:00Z");
  expect((await wire(`/api/capture-uploads/${f.body.capture_session_id}/testbed`)).status).toBe(410);
});

it.each(["v1", "v2"])("rechecks an explicitly bound session's inbound rights when %s omits optional job fields", async version => {
  const f = seed(); delete f.body.job_id; delete f.body.brief_digest;
  if (version === "v1") {
    f.body.schema_version = "site_task_testbed_publication.v1";
    const cards = f.body.testbed.compiled_cards;
    const replacements = new Map<string, string>();
    for (const card of [cards.site_card, ...cards.task_cards, ...cards.scenario_cards, ...cards.eval_cards])
      replacements.set(card.card_digest, canonicalArtifactDigest(card, "card_digest"));
    f.body.testbed = JSON.parse(JSON.stringify(f.body.testbed), (_key, value) =>
      typeof value === "string" ? replacements.get(value) ?? value : value);
    f.body.testbed.testbed_digest = canonicalArtifactDigest(f.body.testbed, "testbed_digest");
    f.body.testbed_digest = f.body.testbed.testbed_digest;
    f.body.artifact_reference.digest = f.body.testbed_digest;
    f.body.decision_evidence_request.testbed_digest = f.body.testbed_digest;
    f.body.decision_evidence_request.request_digest = canonicalArtifactDigest(f.body.decision_evidence_request, "request_digest");
    delete f.body.testbed_canonical_json; delete f.body.decision_request_canonical_json;
    delete f.body.compiled_card_canonical_json;
  }
  const inbound = currentInbound(f);
  inbound.future_processing_allowed = false; store.docs.set(`inboundRequests/${f.jobId}`, inbound);
  const result = await wire(callbackPath, f.body);
  expect(result.status).toBe(410);
  expect(seams.writes).toEqual([]);
  expect(seams.reads).toContain(`inboundRequests/${f.jobId}`);
});

it.each(["malformed_pointer", "missing_job", "current_pointer", "brief", "inventory"])(
  "refuses %s before any new current or immutable record", async change => {
    const f = seed();
    const session = currentSession(f), inbound = currentInbound(f);
    if (change === "malformed_pointer") session.job_evidence_source_binding = { job_id: f.jobId };
    if (change === "missing_job") store.docs.delete(`inboundRequests/${f.jobId}`);
    if (change === "current_pointer") inbound.job_evidence_source.source_capture_digest = `sha256:${"f".repeat(64)}`;
    if (change === "brief") (store.docs.get(`siteTaskBriefs/${f.jobId}`) as any).summary += " then do another job";
    if (change === "inventory") store.docs.set(`siteTaskItemInventories/${f.jobId}`, { items: [{
      itemId: "different", label: "Different object", locationNote: "tray", quantityHint: 1, basis: "owner_stated", images: [] }] });
    store.docs.set(path(f), session);
    if (change !== "missing_job") store.docs.set(`inboundRequests/${f.jobId}`, inbound);
    expect((await wire(callbackPath, f.body)).status).toBe(409);
    expect(seams.writes).toEqual([]);
  });

it.each([null, false, 0, ""])("refuses the explicit malformed source pointer %s even without publication job fields", async pointer => {
  const f = seed(); delete f.body.job_id; delete f.body.brief_digest;
  currentSession(f).job_evidence_source_binding = pointer;
  expect((await wire(callbackPath, f.body)).status).toBe(409);
  expect(seams.writes).toEqual([]);
});

it("does not serve a retained ready projection after its current inbound source pointer changes", async () => {
  const f = seed(); expect((await wire(callbackPath, f.body)).status).toBe(201);
  const before = structuredClone(currentSession(f));
  currentInbound(f).job_evidence_source.command_request_id = "another-current-command";
  seams.writes = [];
  const result = await wire(`/api/capture-uploads/${f.body.capture_session_id}/testbed`);
  expect(result.status).toBe(409); expect(result.body.testbed).toBeUndefined();
  expect(seams.writes).toEqual([]); expect(currentSession(f)).toEqual(before);
});

it.each(["serve_only", "inbound_withdrawal", "native_at_read"])(
  "denies current owner testbed read after %s and leaves lifecycle/history readable", async change => {
    const f = seed(); expect((await wire(callbackPath, f.body)).status).toBe(201);
    const before = structuredClone(currentSession(f));
    const history = [...store.docs.entries()].filter(([key]) => key.startsWith("captureSiteTaskTestbeds/"));
    if (change === "serve_only") currentSession(f).capture_access = { serve_allowed: false };
    if (change === "inbound_withdrawal") currentInbound(f).request.consent_attestation.withdrawn_at_iso = "2026-10-28T00:00:00Z";
    if (change === "native_at_read") seams.beforeTransaction = () => {
      currentSession(f).capture_access = { future_processing_allowed: false };
    };
    seams.writes = [];
    const result = await wire(`/api/capture-uploads/${f.body.capture_session_id}/testbed`);
    expect(result.status).toBe(410); expect(result.body.testbed).toBeUndefined();
    expect((await wire(`/api/capture-uploads/${f.body.capture_session_id}/lifecycle`)).status).toBe(200);
    expect(seams.writes).toEqual([]);
    expect(currentSession(f).pipeline_site_task_testbed).toEqual(before.pipeline_site_task_testbed);
    expect(currentSession(f).pipeline_testbed_projection_updated_at_iso).toBe(before.pipeline_testbed_projection_updated_at_iso);
    expect([...store.docs.entries()].filter(([key]) => key.startsWith("captureSiteTaskTestbeds/"))).toEqual(history);
    seams.uid = "unrelated-fixture-user";
    expect((await wire(`/api/capture-uploads/${f.body.capture_session_id}/testbed`)).status).toBe(404);
  });
