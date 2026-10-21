// @vitest-environment node
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
import { sharedUploadBucket } from "./helpers/fake-upload-bucket";
const staff = vi.hoisted(() => ({ active: true, disabled: false, onRead: null as null | (() => Promise<void>) }));
vi.mock("../../client/src/lib/firebaseAdmin", async () => ({
  dbAdmin: (await import("./helpers/fake-firestore")).sharedFakeFirestore,
  storageAdmin: { bucket: () => (awaitBucket()) },
  authAdmin: { getUser: async () => { await staff.onRead?.(); return { disabled: staff.disabled, customClaims: { ops: staff.active } }; } },
}));
// The mock is evaluated after module imports; bucket bytes stay in this test's store.
function awaitBucket() { return sharedUploadBucket.bucket; }
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
const { buildJobEvidenceRequest } = await import("../utils/jobEvidenceContract");
const { scientificBriefDigest, jobEvidenceTaskInventoryDigest } = await import("../utils/jobEvidenceContract");
const { crossRuntimeArtifactDigest } = await import("../utils/crossRuntimeCanonical");
const { jobEvidenceDeliveryIntent, jobEvidenceQueueMarker, deliverJobEvidenceRequest,
  processJobEvidenceForwardQueue, queueJobEvidenceAction, assertJobEvidenceVideo } = await import("../utils/jobEvidenceForwardWorker");
const { acceptJobEvidencePublication, readJobEvidence, assertJobEvidenceRequestActive } = await import("../utils/jobEvidenceStore");
const examples = JSON.parse(readFileSync(new URL("./fixtures/job-evidence-producer-examples.v1.json", import.meta.url), "utf8"));
const now = Date.parse("2026-10-21T16:00:00Z");
const brief = { requestId: "job-1", summary: "Move the specified part", confirmedAtIso: "2026-10-20T10:00:00Z" };
const record = { request: { buyerType: "site_operator", consent_attestation: { granted: true,
  statement_version: "2026-09-18.v1", recorded_at_iso: "2026-10-20T11:00:00Z" } } };
const request = buildJobEvidenceRequest({ jobId: "job-1", idempotencyKey: "saved-question", uid: "ops-user",
  question: examples.description_request.question, brief, record, session: null });
const path = `inboundRequests/job-1/jobEvidenceRequests/${request.request_id}`;
const publication = { ...examples.description_publication, request_id: request.request_id, job_id: request.job_id,
  brief_digest: request.brief_digest, request_digest: request.request_digest, question: request.question };
publication.publication_digest = crossRuntimeArtifactDigest(publication, "publication_digest");
const forward = () => vi.fn(async () => ({ ok: true as const, publication }));
beforeEach(async () => {
  staff.active = true; staff.disabled = false; staff.onRead = null;
  state.docs.clear(); sharedUploadBucket.clear();
  const intent = jobEvidenceDeliveryIntent("submit", "ops-user", now);
  state.docs.set("inboundRequests/job-1", { ...structuredClone(record), ...jobEvidenceQueueMarker(intent.deliveryId, now) });
  state.docs.set("siteTaskBriefs/job-1", structuredClone(brief));
  state.docs.set(path, { request: structuredClone(request), sequence: -1, createdAtIso: new Date(now).toISOString(), ...intent });
  await sharedUploadBucket.bucket.file("scenes/site-job-1/captures/walkthrough-job-1/raw/walkthrough.mov").save(Buffer.from("retained fixture recording"));
});
describe("durable existing job-evidence delivery", () => {
  it("resumes a persisted request after restart, leases concurrent workers and does not duplicate delivery", async () => {
    const transport = forward();
    await Promise.all([processJobEvidenceForwardQueue(10, { forwarder: transport, nowMs: now }),
      processJobEvidenceForwardQueue(10, { forwarder: transport, nowMs: now })]);
    expect(transport).toHaveBeenCalledTimes(1);
    expect(transport.mock.calls[0][0]).toEqual(request);
    expect(state.docs.get(path)?.deliveryState).toBe("delivered");
    expect(state.docs.get("inboundRequests/job-1")?.job_evidence_forward_pending).toBe(false);
    await processJobEvidenceForwardQueue(10, { forwarder: transport, nowMs: now + 60_000 });
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it("reconciles an expired in-flight lease by GET before replaying an uncertain submit", async () => {
    state.docs.set(path, { ...state.docs.get(path), deliveryState: "delivering", deliveryAttempts: 1,
      deliveryLeaseId: "crashed-worker", deliveryLeaseUntilMs: now - 1 });
    const transport = forward();
    await deliverJobEvidenceRequest("job-1", request.request_id, { forwarder: transport, nowMs: now });
    expect(transport).toHaveBeenCalledExactlyOnceWith({}, `/${request.request_id}`, "GET");
    expect(state.docs.get(path)?.latestPublicationDigest).toBe(publication.publication_digest);
    expect(state.docs.get(path)?.deliveryState).toBe("delivered");
  });
  it("waits for failed reconciliation and never POSTs when previous acceptance is unknown", async () => {
    state.docs.set(path, { ...state.docs.get(path), deliveryAttempts: 1 });
    const transport = vi.fn(async () => ({ ok: false as const, reason: "Temporary read timeout" }));
    await deliverJobEvidenceRequest("job-1", request.request_id, { forwarder: transport, nowMs: now });
    expect(transport).toHaveBeenCalledExactlyOnceWith({}, `/${request.request_id}`, "GET");
    expect(state.docs.get(path)).toMatchObject({ deliveryState: "retry_pending", deliveryAttempts: 2, deliveryNextAtMs: now + 60_000 });
    await deliverJobEvidenceRequest("job-1", request.request_id, { forwarder: transport, nowMs: now + 1 });
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it("reuses the exact submit identity only after Pipeline confirms it is absent", async () => {
    state.docs.set(path, { ...state.docs.get(path), deliveryAttempts: 1 });
    const transport = vi.fn().mockResolvedValueOnce({ ok: false, status: 404, reason: "Not yet received" })
      .mockResolvedValueOnce({ ok: true, publication });
    await deliverJobEvidenceRequest("job-1", request.request_id, { forwarder: transport, nowMs: now });
    expect(transport).toHaveBeenNthCalledWith(1, {}, `/${request.request_id}`, "GET");
    expect(transport).toHaveBeenNthCalledWith(2, request, "");
    expect(state.docs.get(path)?.deliveryState).toBe("delivered");
  });
  it.each(["revoked", "changed", "missing_video", "expired"])("does not send future work when %s", async reason => {
    if (reason === "revoked") state.docs.set("inboundRequests/job-1", { ...record, consent_revoked: true });
    if (reason === "changed") state.docs.set("siteTaskBriefs/job-1", { ...brief, summary: "A different physical task" });
    if (reason === "missing_video") sharedUploadBucket.clear();
    if (reason === "expired") state.docs.set(path, { ...state.docs.get(path), deliveryCreatedAtMs: now - 86_400_001 });
    const transport = forward();
    await deliverJobEvidenceRequest("job-1", request.request_id, { forwarder: transport, nowMs: now });
    expect(transport).not.toHaveBeenCalled(); expect(state.docs.get(path)?.deliveryState).toBe("terminal_blocked");
  });
  it("retains cancellation before its external effect and rejects late non-cancelled publication", async () => {
    await queueJobEvidenceAction("job-1", request.request_id, "cancel", "ops-user");
    expect(state.docs.get(path)?.cancellationRequested).toBe(true);
    await expect(acceptJobEvidencePublication(publication)).rejects.toThrow("cancelled");
    await expect(queueJobEvidenceAction("job-1", request.request_id, "execute", "ops-user")).rejects.toThrow("cancelled");
    const cancelled = { ...publication, state: "cancelled", sequence: 1 };
    cancelled.publication_digest = crossRuntimeArtifactDigest(cancelled, "publication_digest");
    // Withdrawing future work remains possible after the operator loses access.
    staff.active = false; staff.disabled = true;
    const transport = vi.fn().mockResolvedValueOnce({ ok: true, publication }).mockResolvedValueOnce({ ok: true, publication: cancelled });
    await deliverJobEvidenceRequest("job-1", request.request_id, { forwarder: transport, nowMs: Date.now() });
    expect(transport).toHaveBeenNthCalledWith(2, { request_digest: request.request_digest, cancelled_by: "ops-user" }, `/${request.request_id}/cancel`);
    expect(state.docs.get(path)).toMatchObject({ deliveryState: "delivered", cancellationRequested: true, summary: { state: "cancelled" } });
  });
  it("does not revive a cancellation when an older in-flight submit returns", async () => {
    let resolve!: (value: any) => void;
    const transport = vi.fn(() => new Promise<any>(done => { resolve = done; }));
    const pending = deliverJobEvidenceRequest("job-1", request.request_id, { forwarder: transport, nowMs: now });
    await vi.waitFor(() => expect(transport).toHaveBeenCalledTimes(1));
    await queueJobEvidenceAction("job-1", request.request_id, "cancel", "ops-user");
    resolve({ ok: true, publication }); await pending;
    expect(state.docs.get(path)).toMatchObject({ deliveryAction: "cancel", deliveryState: "pending", cancellationRequested: true });
    expect(state.docs.get(path)?.latestPublicationDigest).toBeUndefined();
  });
  it("confirms exact Pipeline absence without submitting a request or fabricating a scientific publication", async () => {
    await queueJobEvidenceAction("job-1", request.request_id, "cancel", "ops-user");
    state.docs.set("inboundRequests/job-1", { ...state.docs.get("inboundRequests/job-1"), consent_revoked: true });
    const transport = vi.fn(async () => ({ ok: false as const, status: 404, code: "job_evidence_not_found", reason: "Not received" }));
    await deliverJobEvidenceRequest("job-1", request.request_id, { forwarder: transport });
    expect(transport).toHaveBeenCalledExactlyOnceWith({}, `/${request.request_id}`, "GET");
    expect(state.docs.get(path)).toMatchObject({ cancellationRequested: true, cancellationResolution: "not_submitted", deliveryState: "delivered" });
    expect((await readJobEvidence("job-1", brief)).evidence[0]).toMatchObject({ state: "cancelled", current: false, publicationDigest: null });
    expect([...state.docs.keys()].filter(key => key.includes("/jobEvidencePublications/"))).toHaveLength(0);
    await expect(queueJobEvidenceAction("job-1", request.request_id, "submit", "ops-user")).rejects.toThrow("cancelled");
  });
  it("does not treat an unrelated HTTP404 as verified Pipeline absence", async () => {
    await queueJobEvidenceAction("job-1", request.request_id, "cancel", "ops-user");
    const transport = vi.fn(async () => ({ ok: false as const, status: 404, reason: "Proxy route unavailable" }));
    await deliverJobEvidenceRequest("job-1", request.request_id, { forwarder: transport });
    expect(transport).toHaveBeenCalledExactlyOnceWith({}, `/${request.request_id}`, "GET");
    expect(state.docs.get(path)?.cancellationConfirmedAtIso).toBeUndefined();
    expect((await readJobEvidence("job-1", brief)).evidence[0].state).toBe("unavailable");
  });
  it.each(["inspect", "cancel_race"])("retains the exact completed result and acknowledges cancellation after %s", async mode => {
    const native = examples.native_request;
    const nativePath = `inboundRequests/job-1/jobEvidenceRequests/${native.request_id}`;
    const terminal = examples.native_result;
    state.docs.delete(path);
    state.docs.set(nativePath, { request: structuredClone(native), sequence: -1, createdAtIso: new Date(now).toISOString(),
      ...jobEvidenceDeliveryIntent("submit", "ops-user") });
    await queueJobEvidenceAction("job-1", native.request_id, "cancel", "ops-user");
    const transport = mode === "inspect" ? vi.fn().mockResolvedValue({ ok: true, publication: terminal })
      : vi.fn().mockResolvedValueOnce({ ok: true, publication: examples.native_planned }).mockResolvedValueOnce({ ok: true, publication: terminal });
    await deliverJobEvidenceRequest("job-1", native.request_id, { forwarder: transport });
    expect(transport).toHaveBeenCalledTimes(mode === "inspect" ? 1 : 2);
    if (mode === "cancel_race") expect(transport).toHaveBeenLastCalledWith({ request_digest: native.request_digest, cancelled_by: "ops-user" }, `/${native.request_id}/cancel`);
    expect(state.docs.get(nativePath)).toMatchObject({ cancellationRequested: true, cancellationResolution: "already_terminal", deliveryState: "delivered", summary: { state: "abstention" } });
    const retained = state.docs.get(`inboundRequests/job-1/jobEvidencePublications/${terminal.publication_digest.slice(7)}`);
    expect(retained?.publication).toEqual(terminal);
    expect((await readJobEvidence("job-1", brief)).evidence[0]).toMatchObject({ state: "cancelled", current: false, publicationDigest: terminal.publication_digest });
    await expect(assertJobEvidenceRequestActive("job-1", native.request_id, native.request_digest)).rejects.toThrow("cancelled");
  });
  it("refuses a terminal cancellation result bound to another request", async () => {
    await queueJobEvidenceAction("job-1", request.request_id, "cancel", "ops-user");
    const wrong = { ...examples.native_result, request_id: request.request_id };
    wrong.publication_digest = crossRuntimeArtifactDigest(wrong, "publication_digest");
    const transport = vi.fn(async () => ({ ok: true as const, publication: wrong }));
    await deliverJobEvidenceRequest("job-1", request.request_id, { forwarder: transport });
    expect(state.docs.get(path)?.cancellationConfirmedAtIso).toBeUndefined();
    expect(state.docs.get(path)).toMatchObject({ deliveryState: "terminal_blocked" });
    expect([...state.docs.keys()].filter(key => key.includes("/jobEvidencePublications/"))).toHaveLength(0);
  });
  it("acknowledges a verified terminal result after permission withdrawal without retaining new scientific content", async () => {
    const native = examples.native_request;
    const nativePath = `inboundRequests/job-1/jobEvidenceRequests/${native.request_id}`;
    state.docs.delete(path);
    state.docs.set(nativePath, { request: structuredClone(native), sequence: -1, createdAtIso: new Date(now).toISOString(),
      ...jobEvidenceDeliveryIntent("submit", "ops-user") });
    await queueJobEvidenceAction("job-1", native.request_id, "cancel", "ops-user");
    state.docs.set("inboundRequests/job-1", { ...state.docs.get("inboundRequests/job-1"), consent_revoked: true });
    const transport = vi.fn(async () => ({ ok: true as const, publication: examples.native_result }));
    await deliverJobEvidenceRequest("job-1", native.request_id, { forwarder: transport });
    expect(transport).toHaveBeenCalledExactlyOnceWith({}, `/${native.request_id}`, "GET");
    expect(state.docs.get(nativePath)).toMatchObject({ cancellationRequested: true, cancellationResolution: "already_terminal", deliveryState: "delivered" });
    expect(state.docs.get(nativePath)?.summary).toBeUndefined();
    expect(state.docs.get(nativePath)?.latestPublicationDigest).toBeUndefined();
    expect([...state.docs.keys()].filter(key => key.includes("/jobEvidencePublications/"))).toHaveLength(0);
    expect((await readJobEvidence("job-1", brief)).evidence[0]).toMatchObject({ state: "cancelled", current: false, publicationDigest: null });
    await expect(acceptJobEvidencePublication(examples.native_result)).rejects.toThrow("permission was withdrawn");
  });
  it("waits for a superseded action's lease before confirming absence and never replays it", async () => {
    const queuedAt = Date.now();
    state.docs.set(path, { ...state.docs.get(path), deliveryState: "delivering", deliveryLeaseId: "old-worker", deliveryLeaseUntilMs: queuedAt + 90_000 });
    await queueJobEvidenceAction("job-1", request.request_id, "cancel", "ops-user");
    const transport = vi.fn(async () => ({ ok: false as const, status: 404, code: "job_evidence_not_found", reason: "Not received" }));
    await deliverJobEvidenceRequest("job-1", request.request_id, { forwarder: transport, nowMs: queuedAt + 1 });
    expect(transport).not.toHaveBeenCalled();
    await deliverJobEvidenceRequest("job-1", request.request_id, { forwarder: transport, nowMs: queuedAt + 90_001 });
    expect(transport).toHaveBeenCalledExactlyOnceWith({}, `/${request.request_id}`, "GET");
    expect(state.docs.get(path)).toMatchObject({ cancellationResolution: "not_submitted", deliveryState: "delivered" });
  });
  it("does not forward execution when cancellation supersedes the lease during the final authority read", async () => {
    await queueJobEvidenceAction("job-1", request.request_id, "execute", "ops-user");
    let reads = 0;
    staff.onRead = async () => { if (++reads === 2) await queueJobEvidenceAction("job-1", request.request_id, "cancel", "ops-user"); };
    const transport = forward();
    await deliverJobEvidenceRequest("job-1", request.request_id, { forwarder: transport });
    expect(transport).toHaveBeenCalledExactlyOnceWith({}, `/${request.request_id}`, "GET");
    expect(state.docs.get(path)).toMatchObject({ deliveryAction: "cancel", deliveryState: "pending", cancellationRequested: true });
  });
  it("keeps retries bounded and never invents a completion", async () => {
    state.docs.set(path, { ...state.docs.get(path), deliveryAttempts: 7 });
    const transport = vi.fn(async () => ({ ok: false as const, status: 503, reason: "Unavailable" }));
    await deliverJobEvidenceRequest("job-1", request.request_id, { forwarder: transport, nowMs: now });
    expect(state.docs.get(path)).toMatchObject({ deliveryState: "terminal_blocked", deliveryAttempts: 8 });
    await deliverJobEvidenceRequest("job-1", request.request_id, { forwarder: transport, nowMs: now + 900_000 });
    expect(transport).toHaveBeenCalledTimes(1); expect(state.docs.get(path)?.summary).toBeUndefined();
  });
  it("rechecks the original operator's current execution role before forwarding read-only execution", async () => {
    await queueJobEvidenceAction("job-1", request.request_id, "execute", "ops-user");
    const failure = { ...publication, sequence: publication.sequence + 1, state: "failed", summary: "The fixture evidence execution failed." };
    failure.publication_digest = crossRuntimeArtifactDigest(failure, "publication_digest");
    const transport = vi.fn().mockResolvedValueOnce({ ok: true, publication }).mockResolvedValueOnce({ ok: true, publication: failure });
    await deliverJobEvidenceRequest("job-1", request.request_id, { forwarder: transport });
    expect(transport).toHaveBeenNthCalledWith(2, { request_digest: request.request_digest,
      authorized_by: { role: "human", identity: "ops-user" } }, `/${request.request_id}/execute`);
    expect(state.docs.get(path)).toMatchObject({ deliveryState: "delivered", summary: { state: "failed" } });
  });
  it.each(["revoked", "disabled"])("does not execute when the queued operator is %s", async reason => {
    await queueJobEvidenceAction("job-1", request.request_id, "execute", "ops-user");
    staff.active = reason !== "revoked"; staff.disabled = reason === "disabled";
    const transport = forward();
    await deliverJobEvidenceRequest("job-1", request.request_id, { forwarder: transport });
    expect(transport).not.toHaveBeenCalled();
    expect(state.docs.get(path)).toMatchObject({ deliveryState: "terminal_blocked", forwardingReason: expect.stringMatching(/authority is no longer active/) });
  });
  it("keeps a different ready request discoverable while an older question is in backoff", async () => {
    state.docs.set(path, { ...state.docs.get(path), deliveryState: "retry_pending", deliveryNextAtMs: now + 60_000 });
    const nextRequest = buildJobEvidenceRequest({ jobId: "job-1", idempotencyKey: "second-question", uid: "ops-user",
      question: request.question, brief, record, session: null });
    const intent = jobEvidenceDeliveryIntent("submit", "ops-user", now);
    state.docs.set(`inboundRequests/job-1/jobEvidenceRequests/${nextRequest.request_id}`,
      { request: nextRequest, sequence: -1, ...intent });
    const nextPublication = { ...publication, request_id: nextRequest.request_id, request_digest: nextRequest.request_digest };
    nextPublication.publication_digest = crossRuntimeArtifactDigest(nextPublication, "publication_digest");
    const transport = vi.fn(async () => ({ ok: true as const, publication: nextPublication }));
    await processJobEvidenceForwardQueue(1, { forwarder: transport, nowMs: now });
    expect(transport).toHaveBeenCalledExactlyOnceWith(nextRequest, "");
    expect(state.docs.get("inboundRequests/job-1")?.job_evidence_forward_next_at_ms).toBe(now + 60_000);
  });
  it("reuses a bound native video receipt, while rejecting a bare session ID or a mesh submission", async () => {
    sharedUploadBucket.clear();
    const native = examples.native_request;
    const binding = { schema_version: "job_evidence_source_binding.v1", job_id: "job-1", capture_session_id: "native-session",
      intake_id: native.intake_id, source_capture_digest: native.testbed.source_capture_bundles[0].digest,
      brief_digest: scientificBriefDigest(brief), task_inventory_digest: jobEvidenceTaskInventoryDigest(brief, null),
      command_request_id: "task-command", approved_task_digest: native.approved_task_digest };
    const sourceRecord = { ...record, job_evidence_source: binding };
    const digest = binding.source_capture_digest;
    const session = { session_id: binding.capture_session_id,
      request: { intake_id: native.intake_id, original_file: { media_type: "video/mp4", size_bytes: 1024 } },
      job_evidence_source_binding: binding, content_addressing: { raw_input_content_addressed: true, sha256: digest },
      approved_task_definition: { approved_task_digest: native.approved_task_digest }, pipeline_site_task_testbed: {
        job_id: "job-1", brief_digest: binding.brief_digest, approved_task_digest: native.approved_task_digest,
        testbed: native.testbed, decision_evidence_request: native.decision_evidence_request,
        testbed_canonical_json: native.testbed_canonical_json, decision_request_canonical_json: native.decision_request_canonical_json,
        compiled_card_canonical_json: native.compiled_card_canonical_json,
      }, pipeline_capture_intake_receipt: { schema_version: "capture_upload_intake_receipt.v1", capture_session_id: binding.capture_session_id,
        intake_id: native.intake_id, request_digest: digest, envelope_digest: digest, capture_digest: digest,
        size_bytes: 1024, admission_status: "accepted", state: "capture_accepted", claim_ceiling: {},
        artifact_reference: { uri: "gs://fixture-retained/native-envelope", envelope_digest: digest },
        malware_content_validation: { status: "passed", scanner: "fixture" }, capture_qa_report: {}, already_exists: false,
        proof_boundary: { server_sha256_verified: true, raw_input_content_addressed: true, capture_qa_completed: true,
          task_success_established: false, physical_task_success_established: false, deployment_or_safety_approved: false,
          comparative_policy_ranking_verdict: "thesis_not_supported" } } };
    await expect(assertJobEvidenceVideo("job-1", sourceRecord, brief, session)).resolves.toBeUndefined();
    await expect(assertJobEvidenceVideo("job-1", sourceRecord, brief, { ...session, pipeline_capture_intake_receipt: null })).rejects.toThrow("Upload or record");
    await expect(assertJobEvidenceVideo("job-1", sourceRecord, brief, { ...session,
      request: { ...session.request, original_file: { ...session.request.original_file, media_type: "model/usd" } } })).rejects.toThrow("Upload or record");
  });
});
