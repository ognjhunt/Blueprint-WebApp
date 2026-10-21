// @vitest-environment node
import express from "express";
import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState as state, sharedFakeFirestore } from "./helpers/fake-firestore";
import { sharedUploadBucket } from "./helpers/fake-upload-bucket";
vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore } = await import("./helpers/fake-firestore");
  const { sharedUploadBucket } = await import("./helpers/fake-upload-bucket");
  return { dbAdmin: sharedFakeFirestore, storageAdmin: { bucket: () => sharedUploadBucket.bucket }, authAdmin: { verifyIdToken: async () => ({ uid: "ops-user", role: "ops" }) }, default: {} };
});
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock("express-rate-limit", () => ({ default: () => (_req: unknown, _res: unknown, next: () => void) => next() }));
vi.mock("../utils/pipelineSyncSecurity", async importOriginal => ({ ...await importOriginal<typeof import("../utils/pipelineSyncSecurity")>(),
  createPipelineSyncRateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next() }));
const { crossRuntimeArtifactDigest } = await import("../utils/crossRuntimeCanonical");
const { scientificBriefDigest, jobEvidenceTaskInventoryDigest, jobEvidenceRequestSchema, verifyJobEvidencePublication, buildJobEvidenceRequest } = await import("../utils/jobEvidenceContract");
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
beforeEach(async () => {
  state.docs.clear();
  sharedUploadBucket.clear();
  vi.stubEnv("PIPELINE_SYNC_TOKEN", "local-sync-key"); vi.stubEnv("JOB_EVIDENCE_PIPELINE_URL", "");
  vi.stubEnv("ROBOT_EVAL_JOB_REQUEST_FORWARD_URL", ""); vi.stubEnv("TASK_EVALUATION_RUN_PLAN_URL", "");
  state.docs.set("inboundRequests/job-1", { request: { buyerType: "site_operator", consent_attestation: { granted: true,
    statement_version: "2026-09-18.v1", recorded_at_iso: "2026-10-20T11:00:00Z" } }, PRIVATE_CONTACT: "must-stay-private" });
  state.docs.set("siteTaskBriefs/job-1", brief);
  await sharedUploadBucket.bucket.file("scenes/site-job-1/captures/walkthrough-job-1/raw/walkthrough.mov").save(Buffer.from("retained-fixture-video-bytes"));
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
  it("binds admitted task items without turning proposed items or commercial metadata into task truth", () => {
    const inventory = { requestId: "job-1", updatedAtIso: "2026-10-20T11:00:00Z", items: [{ itemId: "part-1", label: "Rigid part", locationNote: null, quantityHint: null, basis: "operator_added", images: [], coverageStatus: "needs_images", assetStatus: "pending" }] } as any;
    const digest = jobEvidenceTaskInventoryDigest(brief, inventory);
    expect(digest).not.toBe(jobEvidenceTaskInventoryDigest(brief, null));
    expect(digest).toBe(jobEvidenceTaskInventoryDigest({ ...brief, confirmedAtIso: "later", pilotIntent: { start: "later" } }, { ...inventory, updatedAtIso: "later", items: [{ ...inventory.items[0], assetStatus: "ready" }] }));
    expect(digest).not.toBe(jobEvidenceTaskInventoryDigest(brief, { ...inventory, items: [{ ...inventory.items[0], label: "Different handled object" }] }));
    expect(jobEvidenceTaskInventoryDigest(brief, { ...inventory, items: [{ ...inventory.items[0], basis: "suggested" }] })).toBe(jobEvidenceTaskInventoryDigest(brief, null));
  });
  it("accepts actual Python-produced plan/result bytes after JavaScript JSON transport without rewriting native digests", () => {
    const roundTrip = JSON.parse(JSON.stringify(examples.native_result));
    expect(verifyJobEvidencePublication(roundTrip).decision_envelope?.decision_envelope_digest).toBe(examples.native_result.decision_envelope.decision_envelope_digest);
    const tampered = structuredClone(roundTrip); tampered.decision_envelope_canonical_json += " ";
    tampered.publication_digest = crossRuntimeArtifactDigest(tampered, "publication_digest");
    expect(() => verifyJobEvidencePublication(tampered)).toThrow("decision_envelope_binding_mismatch");
  });
  it("receives the actual producer capability gap without manufacturing a run or a verdict", async () => {
    const source = jobEvidenceRequestSchema.parse(examples.capability_gap_request);
    expect(verifyJobEvidencePublication(examples.capability_gap_publication)).toMatchObject({
      state: "blocked", run_id: null, plan_digest: null, evidence_plan: null, decision_envelope: null,
    });
    // Bind only the commercial wrapper to this test's brief. Retain Python's
    // exact native request/testbed objects and canonical bytes unchanged.
    const request = { ...source, brief_digest: scientificBriefDigest(brief) };
    request.request_digest = crossRuntimeArtifactDigest(request, "request_digest");
    const binding = { schema_version: "job_evidence_source_binding.v1", job_id: "job-1", capture_session_id: request.capture_session_id,
      intake_id: request.intake_id, source_capture_digest: source.testbed!.source_capture_bundles[0].digest,
      brief_digest: request.brief_digest, task_inventory_digest: jobEvidenceTaskInventoryDigest(brief, null),
      command_request_id: "gap-task-command", approved_task_digest: request.approved_task_digest };
    state.docs.set("inboundRequests/job-1", { ...state.docs.get("inboundRequests/job-1"), job_evidence_source: binding });
    state.docs.set(`captureUploadSessions/${request.capture_session_id}`, { session_id: request.capture_session_id,
      request: { intake_id: request.intake_id }, job_evidence_source_binding: binding,
      approved_task_definition: { approved_task_digest: request.approved_task_digest }, pipeline_site_task_testbed: {
        job_id: "job-1", brief_digest: request.brief_digest, approved_task_digest: request.approved_task_digest,
        testbed: source.testbed, decision_evidence_request: source.decision_evidence_request,
        testbed_canonical_json: source.testbed_canonical_json, decision_request_canonical_json: source.decision_request_canonical_json,
        compiled_card_canonical_json: source.compiled_card_canonical_json,
      } });
    state.docs.set(`inboundRequests/job-1/jobEvidenceRequests/${request.request_id}`,
      { request, createdAtIso: "2026-10-21T10:00:00Z", sequence: -1 });
    const publication = { ...structuredClone(examples.capability_gap_publication), brief_digest: request.brief_digest,
      request_digest: request.request_digest };
    publication.publication_digest = crossRuntimeArtifactDigest(publication, "publication_digest");
    const endpoint = "/api/internal/job-evidence-publications";
    expect((await api(endpoint, "POST", publication, signed(publication))).body.status).toBe("published");
    expect((await api(endpoint, "POST", publication, signed(publication))).body.status).toBe("replayed");
    const workflow = (await api(`/api/job-workflow/owner/${token()}`)).body;
    expect(workflow.evidence[0]).toMatchObject({ requestId: request.request_id, current: true, state: "blocked",
      runId: null, decisionDigest: null, planDigest: null, testbedDigest: source.testbed!.testbed_digest, claims: [],
      summary: publication.summary, nextAction: publication.next_action, limitations: publication.limitations });
    expect(workflow.evidence[0].limitations.join(" ")).toContain("Capability gap for task family 'laundry_folding'");
    expect(workflow.selection).toBeNull(); expect(workflow.proposals).toEqual([]);
    expect([...state.docs.keys()].filter(key => key.includes("/jobEvidencePublications/"))).toHaveLength(1);
    expect([...state.docs.keys()].some(key => /taskEvaluationPolicyRuns|taskEvaluationLaunches/.test(key))).toBe(false);
    expect(request.decision_request_canonical_json).toBe(examples.capability_gap_request.decision_request_canonical_json);
    expect(request.testbed_canonical_json).toBe(examples.capability_gap_request.testbed_canonical_json);
  });
  it("retains a recorded job's question without fabricating scientific context and safely reuses its identity", async () => {
    const path = "/api/job-workflow/admin/job-1/evidence";
    const headers = { authorization: "Bearer ops", "Idempotency-Key": "question-key" };
    const first = await api(path, "POST", { question: "Which observation would change the choice?" }, headers);
    const retry = await api(path, "POST", { question: "Which observation would change the choice?" }, headers);
    expect(first.status).toBe(200); expect(retry.status).toBe(200);
    expect(first.body.evidence[0].state).toBe("unavailable"); expect(first.body.evidence[0].runId).toBeNull();
    expect(first.body.evidence[0].serviceMessage).toMatch(/not configured/);
    const owner = await api(`/api/job-workflow/owner/${token()}`);
    expect(owner.body.evidence[0].summary).toBe("Your question is saved. Blueprint will resume it when evidence processing is available.");
    expect(owner.body.evidence[0].serviceMessage).toBeUndefined();
    expect(JSON.stringify(owner.body.evidence[0])).not.toMatch(/not configured|forwardingReason|deliveryActor/);
    expect([...state.docs.keys()].filter(key => key.includes("/jobEvidenceRequests/"))).toHaveLength(1);
    expect([...state.docs.keys()].some(key => /captureUploadSessions|taskEvaluationPolicyRuns|taskEvaluationLaunches/.test(key))).toBe(false);
    const conflict = await api(path, "POST", { question: "Different question" }, headers);
    expect(conflict.status).toBe(409);
  });
  it("cannot start an evidence assessment from a written brief without retained video", async () => {
    sharedUploadBucket.clear();
    const result = await api("/api/job-workflow/admin/job-1/evidence", "POST", { question: "Assess this job" },
      { authorization: "Bearer ops", "Idempotency-Key": "missing-video" });
    expect(result.status).toBe(409); expect(result.body.code).toBe("video_required");
    expect([...state.docs.keys()].some(key => key.includes("/jobEvidenceRequests/"))).toBe(false);
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
  it("shows cancellation pending before its receipt, preserves history and blocks new proposal selection", async () => {
    const publication = boundPublication(); const endpoint = "/api/internal/job-evidence-publications";
    expect((await api(endpoint, "POST", publication, signed(publication))).status).toBe(200);
    const adminPath = "/api/job-workflow/admin/job-1";
    const ownerPath = `/api/job-workflow/owner/${token()}`;
    const quoted = { providerName: "Fixture Integrator", scope: "The agreed task only", equipment: "Declared fixed arm", software: "Declared controller",
      deliveryCommitment: "A supplier-scoped physical pilot", installationCostUsd: null, monthlyCostUsd: null, currency: "USD",
      exclusions: "Site electrical work", sitePreparation: "Provide agreed access", humanAssistance: "Replenish supply",
      timing: "Dates remain to be agreed", support: "Supplier-supported pilot", acceptanceCriteria: "Agreed placement criteria",
      recommendationReason: null, evidence: [{ level: "unverified", summary: "Physical performance remains unknown.",
        reference: { requestId: publication.request_id, publicationDigest: publication.publication_digest } }] };
    const created = await api(`${adminPath}/proposals`, "POST", quoted, { authorization: "Bearer ops", "Idempotency-Key": "cancelled-quote" });
    expect(created.status).toBe(201); const proposal = created.body.proposals[0];
    expect((await api(`${adminPath}/evidence/${publication.request_id}/cancel`, "POST", {}, { authorization: "Bearer ops" })).status).toBe(200);
    const pending = (await api(ownerPath)).body;
    expect(pending.evidence[0]).toMatchObject({ state: "unavailable", current: false,
      summary: "Cancellation was requested. Blueprint is awaiting confirmation that this question has stopped." });
    expect(pending.proposals[0].status).toBe("review_required");
    expect((await api(`${ownerPath}/select`, "POST", { proposalId: proposal.id, expectedRevision: proposal.revision, authorized: true })).body.code).toBe("evidence_cancelled");
    const stored = state.docs.get(`inboundRequests/job-1/jobEvidenceRequests/${publication.request_id}`)!;
    expect((stored.summary as any).state).toBe(publication.state);
    expect((await api(endpoint, "POST", publication, signed(publication))).body.status).toBe("replayed");
    const late = { ...publication, sequence: publication.sequence + 1, summary: "Late processing result" };
    late.publication_digest = crossRuntimeArtifactDigest(late, "publication_digest");
    expect((await api(endpoint, "POST", late, signed(late))).body.code).toBe("evidence_cancelled");
    const historical = await fetch(`${base}${ownerPath}/evidence/${encodeURIComponent(publication.publication_digest)}`);
    expect(historical.status).toBe(200); expect(await historical.text()).toContain("Historical evidence:");
    const cancelled = { ...publication, sequence: publication.sequence + 1, state: "cancelled", summary: "Cancellation confirmed." };
    cancelled.publication_digest = crossRuntimeArtifactDigest(cancelled, "publication_digest");
    expect((await api(endpoint, "POST", cancelled, signed(cancelled))).status).toBe(200);
    expect((await api(ownerPath)).body.evidence[0]).toMatchObject({ state: "cancelled", current: false, summary: "Cancellation confirmed." });
    expect([...state.docs.keys()].filter(key => key.includes("/jobEvidencePublications/"))).toHaveLength(2);
  });
  it("follows the real source session pointer and preserves its exact compiled request", async () => {
    const source = examples.native_request;
    const binding = { schema_version: "job_evidence_source_binding.v1", job_id: "job-1", capture_session_id: "native-random-session-42",
      intake_id: source.intake_id, source_capture_digest: source.testbed.source_capture_bundles[0].digest,
      brief_digest: scientificBriefDigest(brief), task_inventory_digest: jobEvidenceTaskInventoryDigest(brief, null), command_request_id: "real-task-command-1", approved_task_digest: source.approved_task_digest };
    const record = { request: { buyerType: "site_operator", consent_attestation: { granted: true, statement_version: "2026-09-18.v1", recorded_at_iso: "2026-10-20T11:00:00Z" } }, job_evidence_source: binding };
    state.docs.set("inboundRequests/job-1", record);
    state.docs.set(`captureUploadSessions/${binding.capture_session_id}`, { session_id: binding.capture_session_id,
      request: { intake_id: source.intake_id }, job_evidence_source_binding: binding,
      approved_task_definition: { approved_task_digest: source.approved_task_digest }, pipeline_site_task_testbed: {
        job_id: "job-1", brief_digest: binding.brief_digest, approved_task_digest: source.approved_task_digest,
        testbed: source.testbed, decision_evidence_request: source.decision_evidence_request,
        testbed_canonical_json: source.testbed_canonical_json, decision_request_canonical_json: source.decision_request_canonical_json,
        compiled_card_canonical_json: source.compiled_card_canonical_json,
      } });
    const current = await api("/api/job-workflow/admin/job-1", "GET", undefined, { authorization: "Bearer ops" });
    expect(current.body.evidenceContext.question).toBe(source.question);
    const created = await api("/api/job-workflow/admin/job-1/evidence", "POST", { question: source.question }, { authorization: "Bearer ops", "Idempotency-Key": "real-source-question" });
    expect(created.status).toBe(200);
    const saved = [...state.docs.entries()].find(([key]) => key.includes("/jobEvidenceRequests/"))![1].request as any;
    expect(saved.capture_session_id).toBe(binding.capture_session_id); expect(saved.intake_id).toBe(source.intake_id);
    expect(saved.decision_evidence_request.request_digest).toBe(source.decision_evidence_request.request_digest);
    expect(saved.decision_request_canonical_json).toBe(source.decision_request_canonical_json);
    expect(state.docs.has("captureUploadSessions/walkthrough-job-1")).toBe(false);
    const publication = { ...structuredClone(examples.native_result), request_id: saved.request_id,
      request_digest: saved.request_digest, brief_digest: binding.brief_digest };
    publication.publication_digest = crossRuntimeArtifactDigest(publication, "publication_digest");
    expect((await api("/api/internal/job-evidence-publications", "POST", publication, signed(publication))).status).toBe(200);
    const quoted = { providerName: "Fixture Integrator", scope: "The agreed task only", equipment: "Declared fixed arm", software: "Declared controller",
      deliveryCommitment: "A supplier-scoped physical pilot", installationCostUsd: null, monthlyCostUsd: null, currency: "USD",
      exclusions: "Site electrical work", sitePreparation: "Provide agreed access", humanAssistance: "Replenish supply",
      timing: "Dates remain to be agreed", support: "Supplier-supported pilot", acceptanceCriteria: "Agreed placement criteria",
      recommendationReason: null, evidence: [{ level: "unverified", summary: "Fixture method abstained; physical performance remains unknown.",
        reference: { requestId: saved.request_id, publicationDigest: publication.publication_digest } }] };
    const adminPath = "/api/job-workflow/admin/job-1";
    const ownerPath = `/api/job-workflow/owner/${token()}`;
    // A source can change after preliminary validation without changing the brief.
    // Revalidate the reference in the same transaction that publishes the quote.
    const originalTransaction = sharedFakeFirestore.runTransaction.bind(sharedFakeFirestore);
    const transactionRace = vi.spyOn(sharedFakeFirestore, "runTransaction").mockImplementationOnce(async callback => {
      state.docs.set("inboundRequests/job-1", { ...record, job_evidence_source: { ...binding, source_capture_digest: `sha256:${"c".repeat(64)}` } });
      return originalTransaction(callback);
    });
    const raced = await api(`${adminPath}/proposals`, "POST", quoted, { authorization: "Bearer ops", "Idempotency-Key": "source-race-quote" });
    transactionRace.mockRestore();
    expect(raced.status).toBe(409);
    expect(raced.body.code).toBe("evidence_scope_changed");
    expect((state.docs.get("inboundRequests/job-1") as any).job_marketplace?.proposals ?? []).toHaveLength(0);
    state.docs.set("inboundRequests/job-1", record);
    const first = (await api(`${adminPath}/proposals`, "POST", quoted, { authorization: "Bearer ops", "Idempotency-Key": "reference-quote-a" })).body.proposals[0];
    expect((await api(`${adminPath}/proposals`, "POST", quoted, { authorization: "Bearer ops", "Idempotency-Key": "reference-quote-b" })).status).toBe(201);
    const choose = (proposal: any) => ({ proposalId: proposal.id, expectedRevision: proposal.revision, authorized: true });
    expect((await api(`${ownerPath}/select`, "POST", choose(first))).status).toBe(200);
    const agreement = (proposal: any) => ({ proposalId: proposal.id, expectedRevision: proposal.revision, agreedAtIso: "2026-10-20T12:00:00Z",
      plannedStartIso: null, siteAgreementReference: "Fixture site agreement", providerAgreementReference: "Fixture supplier agreement" });
    const latestRecord = state.docs.get("inboundRequests/job-1")!;
    const mismatched = { ...latestRecord, job_evidence_source: { ...binding, approved_task_digest: `sha256:${"f".repeat(64)}` } };
    state.docs.set("inboundRequests/job-1", mismatched);
    const stale = (await api("/api/job-workflow/admin/job-1", "GET", undefined, { authorization: "Bearer ops" })).body;
    expect(stale.evidenceContext.question).toBeNull(); expect(stale.evidence[0].current).toBe(false);
    expect(stale.proposals.map((proposal: any) => proposal.status)).toEqual(["review_required", "review_required"]);
    expect(stale.stage).toBe("brief_agreed");
    expect((await api(`${ownerPath}/select`, "POST", choose(first))).body.code).toBe("evidence_scope_changed");
    expect((await api(`${adminPath}/agreement`, "POST", agreement(first), { authorization: "Bearer ops" })).body.code).toBe("evidence_scope_changed");
    const reviewed = { ...quoted, evidence: [{ level: "unverified", summary: "No current performance evidence. The written offer retains explicit pilot acceptance criteria." }] };
    const repaired = await api(`${adminPath}/proposals/${first.id}`, "PUT", { ...reviewed, expectedRevision: first.revision }, { authorization: "Bearer ops" });
    expect(repaired.status).toBe(200); expect(repaired.body.selection).toBeNull();
    expect(repaired.body.proposals[0].status).toBe("available"); expect(repaired.body.proposals[1].status).toBe("review_required");
    expect((await api(`${ownerPath}/select`, "POST", choose(repaired.body.proposals[0]))).status).toBe(200);
    const agreed = await api(`${adminPath}/agreement`, "POST", agreement(repaired.body.proposals[0]), { authorization: "Bearer ops" });
    expect(agreed.status).toBe(200); expect(agreed.body.stage).toBe("pilot_agreed");
    const execution = await api(`/api/job-workflow/admin/job-1/evidence/${saved.request_id}/execute`, "POST", {}, { authorization: "Bearer ops" });
    expect(execution.status).toBe(409); expect(execution.body.code).toBe("evidence_scope_changed");
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
