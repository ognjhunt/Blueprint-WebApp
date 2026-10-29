// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
const seams = vi.hoisted(() => ({ objects: new Map<string, any>(), enabled: true, coverageActive: false, run: vi.fn(), manifest: vi.fn(), marker: vi.fn() }));
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
// Test video bytes are not real video: strip sound with the in-process fake.
vi.mock("../agents/adapters/video-audio-strip", async (importOriginal) =>
  (await import("./helpers/fake-ffmpeg")).withFakeFfmpeg(await importOriginal()));
vi.mock("../../client/src/lib/firebaseAdmin", async () => ({
 default: { firestore: {FieldValue: {serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => undefined}}},
 dbAdmin: (await import("./helpers/fake-firestore")).sharedFakeFirestore,
 storageAdmin: {bucket: (name = "blueprint-8c1ca.appspot.com") => ({name, file: (object: string, options?: any) => {
   const get = () => {const row=seams.objects.get(object);if(!row || options?.generation && options.generation!==row.generation) throw Error("synthetic_object_missing");return row;};
   return {getMetadata: async()=>[{name:object,...get(),size:String(get().bytes.length)}], download: async()=>[get().bytes], exists: async()=>[seams.objects.has(object)],
    getSignedUrl: async()=>["https://example.invalid/scripted-no-fetch"], save: async()=>{throw Error("unexpected_object_write")}, delete: async()=>{throw Error("unexpected_object_delete")}};
 }})}
}));
vi.mock("../config/env", async () => ({ ...await vi.importActual("../config/env"), isSiteVideoEvidenceEnabled: () => seams.enabled }));
vi.mock("../agents/runtime", () => ({ runAgentTask: seams.run }));
vi.mock("../utils/captureCoverageQueue", () => ({ isCoverageReviewActive: () => seams.coverageActive }));
vi.mock("../utils/websiteBrowserUploadStatus", async () => ({ ...await vi.importActual("../utils/websiteBrowserUploadStatus"), verifiedPendingManifest: seams.manifest, verifiedPendingMarker: seams.marker }));
vi.mock("../logger", () => ({ attachRequestMeta: (x:any)=>x, logger: { info:vi.fn(), warn: vi.fn(), error:vi.fn(), debug:vi.fn() } }));
import { publishBrowserPending, browserPendingDecisionKey, type BrowserPending } from "../utils/websiteBrowserPending";
import { advisoryContextDigest, advisoryJobId } from "../utils/siteAssessmentContext";
import { RECORDING_CONSENT_VERSION } from "../utils/recordingConsent";
import { failedDescriptionAssessment } from "./fixtures/site-assessment-postprocessing";
let wakeSpy: ReturnType<typeof vi.spyOn>;
afterEach(() => { wakeSpy?.mockRestore(); });
const pending: BrowserPending = { schema_version: "website_browser_pending.v1", request_id: "advisory-fixture", scene_id: "site-advisory-fixture",
  capture_id: "walkthrough-advisory-fixture", state: "held", completed_at_iso: "2026-10-08T00:00:00.000Z",
  video: { object_name: "scenes/site-advisory-fixture/captures/walkthrough-advisory-fixture/raw/walkthrough.mp4", generation: "90071992547409931", size_bytes: 7, crc32c: "AAAAAA==" },
  manifest: { object_name: "scenes/site-advisory-fixture/captures/walkthrough-advisory-fixture/raw/manifest.json", generation: "90071992547409932", size_bytes: 500, crc32c: "AAAAAA==", sha256: `sha256:${"a".repeat(64)}` } };
const request = () => ({ request: { buyerType: "site_operator", capture_mode: "self_capture", taskDescription: "Move a bin; success remains unknown",
  consent_attestation: { granted: true, statement_version: RECORDING_CONSENT_VERSION, recorded_at_iso: "2026-10-08T00:00:00.000Z" } },
  capture_privacy_source_bound_decision: { capture_id: pending.capture_id, proceeded: true, eligibility: "unscreened",
    producer_source: { kind: "browser_pending", key: browserPendingDecisionKey(pending) } } });
beforeEach(async () => {
  wakeSpy=vi.spyOn(await import("../utils/siteAssessmentQueue"),"tickSiteAssessments").mockResolvedValue();
  seams.enabled = true; seams.coverageActive = false; seams.run.mockReset(); seams.manifest.mockReset().mockResolvedValue(JSON.stringify({capture_rights:{derived_scene_generation_allowed:true,consent_status:"granted",consent_revoked:false}})); seams.marker.mockReset().mockResolvedValue(true); seams.objects.clear(); state.docs.clear(); state.docs.set(`inboundRequests/${pending.request_id}`, request());
  state.docs.set(`captureUploadSessions/${pending.capture_id}`, { browser_pending_delivery: pending }); });
it("ADVISORY-PRODUCER-001 normal new publication durably creates one source-bound advisory intent", async () => {
  await publishBrowserPending(pending);
  const sourceKey = browserPendingDecisionKey(pending), contextDigest = advisoryContextDigest(request(), null);
  const id = advisoryJobId(pending.request_id, sourceKey, contextDigest);
  expect(state.docs.get(`captureUploadSessions/${pending.capture_id}`)?.browser_pending_delivery).toMatchObject({ state: "published" });
  expect(state.docs.get(`siteAssessmentJobs/${id}`)).toMatchObject({ schema_version: "site_assessment_job.v1", request_id: pending.request_id,
    source_key: sourceKey, context_digest: contextDigest, state: "queued" });
  expect(state.docs.get(`inboundRequests/${pending.request_id}`)?.site_advisory).toMatchObject({ job_id: id, source_key: sourceKey, context_digest: contextDigest, state: "queued" });
  await publishBrowserPending(pending);
  expect([...state.docs.keys()].filter(key => key.startsWith("siteAssessmentJobs/"))).toHaveLength(1);
});

it("an old unfinished original cannot select itself over the owner's newer recording", async () => {
  const current = `supplement-${"f".repeat(40)}`;
  state.docs.get(`inboundRequests/${pending.request_id}`)!.active_capture_id = current;
  await expect(publishBrowserPending(pending)).rejects.toThrow("capture_update_superseded");
  expect(state.docs.get(`inboundRequests/${pending.request_id}`)!.active_capture_id).toBe(current);
  expect(state.docs.get(`captureUploadSessions/${pending.capture_id}`)!.browser_pending_delivery.state).toBe("held");
  expect([...state.docs.keys()].some(key => key.startsWith("siteAssessmentJobs/"))).toBe(false);
});

it("an unfinished original cannot publish after its recording authority is withdrawn", async () => {
  state.docs.get(`inboundRequests/${pending.request_id}`)!.consent_revoked = true;
  await expect(publishBrowserPending(pending)).rejects.toThrow("capture_processing_not_authorized");
  expect(state.docs.get(`captureUploadSessions/${pending.capture_id}`)!.browser_pending_delivery.state).toBe("held");
  expect([...state.docs.keys()].some(key => key.startsWith("siteAssessmentJobs/"))).toBe(false);
});

it("publication starts the website preparation watch once, in the same commit (beta L3/L6)", async () => {
  const before = Date.now();
  await publishBrowserPending(pending);
  const session = state.docs.get(`captureUploadSessions/${pending.capture_id}`) as Record<string, any>;
  expect(session.website_preparation_watch).toMatchObject({ kind: "awaiting_first_status", request_id: pending.request_id,
    capture_id: pending.capture_id, alerted_at_iso: null });
  expect(session.website_preparation_watch_due_at_ms).toBeGreaterThanOrEqual(before + 2 * 60 * 60 * 1000);
  const first = session.website_preparation_watch;
  await publishBrowserPending(pending);
  expect((state.docs.get(`captureUploadSessions/${pending.capture_id}`) as Record<string, any>).website_preparation_watch).toEqual(first);
});

const hash = (packet: unknown) => createHash("sha256").update(JSON.stringify(packet)).digest("hex");
const selectedJob = () => [...state.docs].find(([key]) => key.startsWith("siteAssessmentJobs/"))!;
const storedPacket = (id: string, job: any) => {
  const packet = { schema_version: "site_assessment.v2", request_id: pending.request_id, assessment: { status: "needs_operator_input" }, sources: [] };
  return { task_kind: "site_assessment", status: "completed", artifacts: { site_assessment_packet: packet, site_assessment_packet_sha256: hash(packet),
    source_admission: { request_id: pending.request_id, capture_id: pending.capture_id, source_key: job.source_key, context_digest: job.context_digest,
      advisory_job_id: id } } };
};

async function retainedDescriptionFailure() {
  await publishBrowserPending(pending);
  const [key, initial] = selectedJob(), id = key.split("/")[1];
  const job = { ...initial, state: "needs_review", claim_id: "completed-response-claim" };
  state.docs.set(key, job);
  const record = state.docs.get(`inboundRequests/${pending.request_id}`)!;
  record.site_advisory.state = "needs_review";
  const { run } = failedDescriptionAssessment({ request_id: job.request_id, capture_id: job.capture_id,
    source_key: job.source_key, context_digest: job.context_digest, advisory_job_id: id });
  run.id = job.run_id;
  state.docs.set(`agentRuns/${job.run_id}`, run);
  return { key, job: structuredClone(job), run };
}

it("reprocesses an already paid completed response atomically without redispatch or allowance changes", async () => {
  const { key, job, run } = await retainedDescriptionFailure();
  const usage = structuredClone(run.artifacts.usage), reservations = structuredClone(run.artifacts.capture_inference_reservations);
  await (await import("../utils/siteAssessmentQueue")).reconcileSiteAssessments();
  const saved = state.docs.get(`agentRuns/${job.run_id}`)!;
  expect(saved).toMatchObject({ status: "completed", error: null,
    artifacts: { postprocessing_recovery: { previous_status: "failed", provider_calls: 0, spending_reservations_created: 0 } } });
  expect(saved.artifacts.usage).toEqual(usage);
  expect(saved.artifacts.capture_inference_reservations).toEqual(reservations);
  expect(state.docs.get(key)?.packet_sha256).toBe(saved.artifacts.site_assessment_packet_sha256);
  expect(state.docs.get(`inboundRequests/${pending.request_id}`)?.site_advisory.state).toBe("completed");
  expect(seams.run).not.toHaveBeenCalled();
  expect([...state.docs.keys()].some(k => k.startsWith("captureInferenceBudgets/"))).toBe(false);
});

it.each(["cancel", "revoke", "new_job"])("preserves a concurrent %s during free postprocessing", async mode => {
  const { key, job } = await retainedDescriptionFailure();
  const evidence = await import("../agents/private-evidence"), project = evidence.projectAgentEvidence;
  const spy = vi.spyOn(evidence, "projectAgentEvidence").mockImplementationOnce(async (...args) => {
    if (mode === "cancel") state.docs.get(`agentRuns/${job.run_id}`)!.status = "cancelled";
    if (mode === "revoke") state.docs.get(`inboundRequests/${pending.request_id}`)!.request.consent_attestation.granted = false;
    if (mode === "new_job") state.docs.get(key)!.run_id = "newer-owner-run";
    return project(...args);
  });
  try { await (await import("../utils/siteAssessmentQueue")).reconcileSiteAssessments(); }
  finally { spy.mockRestore(); }
  expect(state.docs.get(`agentRuns/${job.run_id}`)?.status).toBe(mode === "cancel" ? "cancelled" : "failed");
  expect(state.docs.get(key)?.state).toBe("needs_review");
  expect(seams.run).not.toHaveBeenCalled();
});
it("dispatches the committed claim once and reconciles canonical completion after a queue restart", async () => {
  const { reconcileSiteAssessments } = await import("../utils/siteAssessmentQueue");
  await publishBrowserPending(pending);
  const [key, initial] = selectedJob(), id = key.split("/")[1];
  seams.run.mockImplementationOnce(async (task, options) => {
    const claimed = state.docs.get(key)!;
    expect(claimed).toMatchObject({ state: "running", run_id: options.runId });
    expect(task.input.context).toEqual({ request_id: pending.request_id, advisory_job_id: id, advisory_claim_id: claimed.claim_id });
    state.docs.set(`agentRuns/${options.runId}`, storedPacket(id, claimed));
    return { status: "completed" }; // The queue must reopen the stored record.
  });
  await reconcileSiteAssessments();
  expect(state.docs.get(key)).toMatchObject({ state: "completed", packet_sha256: hash(storedPacket(id, initial).artifacts.site_assessment_packet) });
  expect(state.docs.get(`inboundRequests/${pending.request_id}`)?.site_advisory).toMatchObject({ state: "completed" });
  // Preserve the actual private result, emulate a lost queue acknowledgment.
  state.docs.set(key, { ...state.docs.get(key), state: "running", started_at_ms: 0 });
  await reconcileSiteAssessments(); await reconcileSiteAssessments();
  expect(state.docs.get(key)?.state).toBe("completed"); expect(seams.run).toHaveBeenCalledTimes(1);
});
it("keeps a queued advisory waiting with a typed spend blocker while today's model budget has no room", async () => {
  const { reconcileSiteAssessments } = await import("../utils/siteAssessmentQueue");
  await publishBrowserPending(pending);
  const [key] = selectedJob(), id = key.split("/")[1];
  vi.stubEnv("BLUEPRINT_SITE_ASSESSMENT_DAILY_USD_CAP", "1"); // below one Gemini video reservation
  try {
    await reconcileSiteAssessments(); await reconcileSiteAssessments();
    expect(seams.run).not.toHaveBeenCalled();
    expect(state.docs.get(key)).toMatchObject({ state: "queued", claim_id: null,
      spend_blocker: { schema_version: "site_assessment_spend_blocker.v1", reason: "daily_usd_cap_reached", cap_usd: 1, reserved_usd: 0 } });
    expect(state.docs.get(`inboundRequests/${pending.request_id}`)?.site_advisory).toMatchObject({ state: "queued" });
  } finally { vi.unstubAllEnvs(); }
  seams.run.mockImplementationOnce(async (_task, options) => {
    state.docs.set(`agentRuns/${options.runId}`, storedPacket(id, state.docs.get(key)));
    return { status: "completed" };
  });
  await reconcileSiteAssessments();
  expect(seams.run).toHaveBeenCalledTimes(1);
  expect(state.docs.get(key)).toMatchObject({ state: "completed", spend_blocker: null });
});
it("keeps unknown interrupted provider work for review instead of redispatching", async () => {
  const { reconcileSiteAssessments, describeSiteAssessmentRetry } = await import("../utils/siteAssessmentQueue");
  await publishBrowserPending(pending);const [key, job] = selectedJob();
  state.docs.set(key, { ...job, state: "running", claim_id: "retained-claim", started_at_ms: 0 });
  state.docs.set(`agentRuns/${job.run_id}`, { task_kind: "site_assessment", status: "running", artifacts: { usage: null } });
  await reconcileSiteAssessments();await reconcileSiteAssessments();
  expect(state.docs.get(key)?.state).toBe("needs_review"); expect(seams.run).not.toHaveBeenCalled();
  // Total run age alone cannot retire a current claim that is still making
  // durable inference progress. These are isolated phases of this control.
  const { reserveCaptureCoverageInference, hasRecentAssessmentProgress } = await import("../utils/captureCoverageInferenceBudget");
  const { sharedFakeFirestore } = await import("./helpers/fake-firestore");
  for (const progress of ["admitted", "recorded", "unknown", "already-review", "stale", "foreign-run", "foreign-source", "foreign-claim", "future"] as const) {
    state.docs.clear();
    const raw = request(), id = key.split("/")[1], started = Date.now() - 40 * 60_000;
    state.docs.set(`inboundRequests/${pending.request_id}`, { ...raw, site_advisory: { job_id: id, source_key: job.source_key, context_digest: job.context_digest, state: "running" } });
    state.docs.set(`captureUploadSessions/${pending.capture_id}`, { browser_pending_delivery: { ...pending, state: "published" } });
    state.docs.set(key, { ...job, state: "running", claim_id: "retained-claim", started_at_ms: started });
    const runPath = `agentRuns/${job.run_id}`;
    state.docs.set(runPath, { task_kind: "site_assessment", status: "running", metadata: { capture_id: pending.capture_id, advisory_job_id: id },
      input: { input: { context: { request_id: pending.request_id, advisory_job_id: id, advisory_claim_id: "retained-claim" } } }, artifacts: { usage: null } });
    const admission = await reserveCaptureCoverageInference("gpt-6.1-sol", { capture_id: pending.capture_id,
      assessment_run_id: job.run_id, assessment_request_id: pending.request_id, assessment_video_sha256: "a".repeat(64),
      assessment_source: { kind: "browser_pending", key: job.source_key } }, "openai", {});
    if (progress === "recorded" || progress === "unknown") await admission.record(progress === "recorded" ? { input_tokens: 20, output_tokens: 10 } : null);
    const [callPath, call] = [...state.docs.entries()].find(([path]) => path.endsWith(`/calls/${admission.receipt.admission_token}`))!;
    if (["recorded", "unknown", "stale"].includes(progress)) call.created_at_ms = started + 1_000;
    if (progress === "foreign-run") call.run_id = "other-run";
    if (progress === "foreign-source") call.source_digest = "f".repeat(64);
    if (progress === "foreign-claim") state.docs.get(runPath)!.input.input.context.advisory_claim_id = "other-claim";
    if (progress === "future") call.created_at_ms = Date.now() + 60_000;
    if (progress === "already-review") state.docs.get(key)!.state = "needs_review";
    const recent = ["admitted", "recorded", "unknown", "already-review"].includes(progress);
    const before = structuredClone([...state.docs.entries()].filter(([path]) => path.startsWith("captureCoverageReviews/") || path === runPath));
    await reconcileSiteAssessments(); await reconcileSiteAssessments();
    expect(state.docs.get(key)?.state, progress).toBe(recent && progress !== "already-review" ? "running" : "needs_review");
    expect((await describeSiteAssessmentRetry(pending.request_id, () => true)).available, progress).toBe(progress === "stale");
    expect(await sharedFakeFirestore.runTransaction(tx => hasRecentAssessmentProgress(tx, { requestId: pending.request_id,
      jobId: id, captureId: pending.capture_id, previousRunId: job.run_id, previousClaimId: "retained-claim", sourceKey: job.source_key,
      contextDigest: job.context_digest, startedAtMs: started, request: raw, brief: null })), progress).toBe(recent);
    if (progress === "stale") {
      expect(state.docs.get(runPath)).toMatchObject({ status: "cancelled", error: "site_assessment_process_interrupted",
        advisory_abandonment: { schema_version: "site_assessment_abandonment.v1", admission_token: admission.receipt.admission_token } });
      expect([...state.docs.entries()].filter(([path]) => path.startsWith("captureCoverageReviews/"))).toEqual(before.filter(([path]) => path !== runPath));
    } else expect([...state.docs.entries()].filter(([path]) => path.startsWith("captureCoverageReviews/") || path === runPath)).toEqual(before);
    expect(state.docs.get(callPath)?.state, progress).toBe(progress === "recorded" ? "recorded" : progress === "unknown" ? "unknown" : "admitted");
    expect(seams.run).not.toHaveBeenCalled();
  }
});
it("waits for this worker's active coverage pass without requiring its verdict", async () => {
  const { reconcileSiteAssessments } = await import("../utils/siteAssessmentQueue");
  await publishBrowserPending(pending);const [key] = selectedJob();
  seams.coverageActive = true;await reconcileSiteAssessments();
  expect(state.docs.get(key)?.state).toBe("queued");expect(seams.run).not.toHaveBeenCalled();
  seams.coverageActive = false;await reconcileSiteAssessments();await reconcileSiteAssessments();
  expect(seams.run).toHaveBeenCalledTimes(1);
});
it("withdrawal wins over a retained completed packet", async () => {
  const { reconcileSiteAssessments } = await import("../utils/siteAssessmentQueue");
  await publishBrowserPending(pending);const [key, job] = selectedJob(), id=key.split("/")[1];
  state.docs.set(`agentRuns/${job.run_id}`, storedPacket(id, job));
  state.docs.get(`inboundRequests/${pending.request_id}`)!.consent_revoked = true;
  await reconcileSiteAssessments();
  expect(state.docs.get(key)?.state).toBe("authority_ended");expect(seams.run).not.toHaveBeenCalled();
  expect(state.docs.get(`inboundRequests/${pending.request_id}`)?.site_advisory).toMatchObject({ state: "authority_ended" });
});
it("does not dispatch the older pending source during a newer durable upload", async () => {
  const { reconcileSiteAssessments } = await import("../utils/siteAssessmentQueue");
  await publishBrowserPending(pending);const [key] = selectedJob();
  state.docs.get(`captureUploadSessions/${pending.capture_id}`)!.browser_stored_upload = { video: { generation: "90071992547409999" } };
  await reconcileSiteAssessments();
  expect(state.docs.get(key)?.state).toBe("authority_ended");expect(seams.run).not.toHaveBeenCalled();
});
it("does not backfill already-published sources or publish an in-memory-only answer", async () => {
  const { reconcileSiteAssessments } = await import("../utils/siteAssessmentQueue");
  state.docs.set(`captureUploadSessions/${pending.capture_id}`, { browser_pending_delivery: { ...pending, state: "published" } });
  await publishBrowserPending(pending);expect(selectedJob()).toBeUndefined();
  state.docs.set(`captureUploadSessions/${pending.capture_id}`, { browser_pending_delivery: pending });
  await publishBrowserPending(pending);const [key] = selectedJob();
  seams.run.mockResolvedValueOnce({ status: "completed", artifacts: { site_assessment_packet: { fake: true } } });
  await reconcileSiteAssessments();expect(state.docs.get(key)?.state).toBe("needs_review");
  expect(state.docs.get(key)?.packet_sha256).toBeNull();
});

it.each(["ordinary", "programme-bound"])("ADVISORY-PRODUCER-001 joined actual SDK persistence and authorized owner publication (scripted providers, %s)", async (mode) => {
  const { OpenAIProvider, Usage, setTracingDisabled } = await import("@openai/agents");
  setTracingDisabled(true); // No provider telemetry for this offline joined control.
  const gemini = await import("../agents/adapters/gemini-video");
  const { buildBrowserDelivery } = await import("../utils/websiteCaptureDelivery");
  const { projectWebsiteCaptureRights } = await import("../utils/websiteTaskContext");
  const joined = structuredClone(pending);
  const raw = {...request(), contact:{firstName:"Synthetic",lastName:"Fixture",email:"synthetic@example.invalid",roleTitle:"Owner",company:"Synthetic fixture"}};
  const bytes = Buffer.from(JSON.stringify({request_id: joined.request_id, scene_id:joined.scene_id, capture_id:joined.capture_id,
    video_uri:joined.video.object_name,duration_seconds:10,capture_source:"browser_self_capture",capture_rights:projectWebsiteCaptureRights(raw)}));
  joined.manifest.size_bytes=bytes.length;joined.manifest.sha256=`sha256:${createHash("sha256").update(bytes).digest("hex")}`;
  raw.capture_privacy_source_bound_decision.producer_source.key=browserPendingDecisionKey(joined);
  state.docs.set(`inboundRequests/${joined.request_id}`,raw);
  state.docs.set(`captureUploadSessions/${joined.capture_id}`,{browser_pending_delivery:joined});
  if (mode === "programme-bound") {
    const { inferenceProgrammeContextDigest } = await import("../utils/inferenceProgrammeAdmission");
    state.docs.get(`inboundRequests/${joined.request_id}`)!.inference_program_id = "synthetic-programme";
    state.docs.set("inferencePrograms/synthetic-programme", {
      schema_version: "inference_program.v1", status: "active", authority_ref: "synthetic-offline-authority",
      ledger_sha256: `sha256:${"f".repeat(64)}`, request_id: joined.request_id, capture_id: joined.capture_id,
      context_digest: inferenceProgrammeContextDigest(raw, null),
      video_sha256: createHash("sha256").update(Buffer.from("video-1")).digest("hex"),
      expires_at_ms: Date.now() + 60_000, cap_micro_usd: 5_000_000,
      slots: [
        { id: "original-gemini", provider: "gemini", model: "gemini-3.8-flash", reserved_micro_usd: 1_818_624, state: "unknown" },
        { id: "original-sol-1", provider: "openai", model: "gpt-6.1-sol", reserved_micro_usd: 331_920, state: "recorded" },
        ...[2, 3, 4].map(n => ({ id: `original-sol-${n}`, provider: "openai", model: "gpt-6.1-sol", reserved_micro_usd: 331_920, state: "held" })),
        { id: "amended-gemini", provider: "gemini", model: "gemini-3.8-flash", reserved_micro_usd: 1_818_624, state: "held" },
      ],
    });
  }
  const historicalProgramme = structuredClone(state.docs.get("inferencePrograms/synthetic-programme"));
  const put=(name:string,generation:string,body:Buffer,contentType="application/json")=>seams.objects.set(name,{generation,crc32c:"AAAAAA==",bytes:body,contentType});
  put(joined.video.object_name,joined.video.generation,Buffer.from("video-1"),"video/mp4");put(joined.manifest.object_name,joined.manifest.generation,bytes);
  const delivery=buildBrowserDelivery({requestId:joined.request_id,sceneId:joined.scene_id,captureId:joined.capture_id,
    rawPrefix:joined.video.object_name.slice(0,joined.video.object_name.lastIndexOf("/")),video:joined.video,manifest:joined.manifest,completedAtIso:joined.completed_at_iso});
  put(`${delivery.record.raw_prefix}/capture_upload_complete.json`,"30",delivery.markerBytes);put(delivery.objectName,"31",delivery.recordBytes);
  const realUpload=await vi.importActual<typeof import("../utils/websiteBrowserUploadStatus")>("../utils/websiteBrowserUploadStatus");
  seams.manifest.mockImplementation(realUpload.verifiedPendingManifest);seams.marker.mockImplementation(realUpload.verifiedPendingMarker);
  vi.stubEnv("OPENAI_API_KEY","synthetic-no-provider");vi.stubEnv("GEMINI_API_KEY","synthetic-no-provider");
  let calls=0;
  const modelSpy=vi.spyOn(OpenAIProvider.prototype,"getModel").mockResolvedValue({
    async getResponse(input:any) {
      calls++;
      const source=JSON.stringify(input.input).match(/video:walkthrough-advisory-fixture:[a-f0-9]{12}/)?.[0];
      const packet={status:"needs_operator_input",job:[{text:"PRIVATE fabricated robot success",basis:"observed",evidence:[{source_id:source,at_seconds:2,selector:{kind:"video_observation",observation_index:0,field_path:null}}]}],
        objects_motions_conditions_variations:[],operator_success:[],known:[],estimates:[],missing:[],approaches:[],questions:[],
        next_action:{kind:"ask_operator",action:"Clarify success",why:{text:"Success criteria unknown",basis:"unknown",evidence:[]}}};
      return {output:calls===1?[{type:"function_call",callId:"joined-video-call",name:"analyze_site_video",arguments:JSON.stringify({question:"What moves?",processing:"auto",sampling_fps:2})}]:[{type:"message",role:"assistant",status:"completed",content:[{type:"output_text",text:JSON.stringify(packet)}]}],usage:new Usage(),providerData:{usage:{input_tokens:20,output_tokens:10}}} as any;
    },async *getStreamedResponse(){throw Error("unexpected_stream");}
  } as any);
  const videoSpy=vi.spyOn(gemini,"analyseAgenticVideo").mockResolvedValue({text:JSON.stringify({summary:"Carton movement",observations:[{category:"motion",finding:"A carton moves",basis:"observed",start_seconds:1,end_seconds:3,uncertainty:"Hands partly occluded"}],not_observable:["weight"]}),
    usage:{promptTokenCount:20,candidatesTokenCount:10,thoughtsTokenCount:0,totalTokenCount:30},processing:{mode:"static",sampling_fps_requested:2,media_tool_calls:0,media_tool_responses:0}} as any);
  let server:any;
  const originalFetch=globalThis.fetch;
  const fetchGuard=vi.spyOn(globalThis,"fetch").mockImplementation((url,options)=> {
    if(new URL(String(url)).hostname!=="127.0.0.1") throw Error("unexpected_external_network");
    return originalFetch(url,options);
  });
  let sdkException: string | null = null;
  try {
    seams.run.mockImplementation(async(task,options)=>{
      try { return await (await vi.importActual<typeof import("../agents/runtime")>("../agents/runtime")).runAgentTask(task,options); }
      catch(error) { sdkException=error instanceof SyntaxError ? "SyntaxError" : error instanceof TypeError ? "TypeError" : error instanceof Error ? "Error" : "non_error_exception";throw error; }
    });
    wakeSpy.mockRestore();
    const queue=await import("../utils/siteAssessmentQueue");
    wakeSpy=vi.spyOn(queue,"tickSiteAssessments");
    await publishBrowserPending(joined);
    await vi.waitFor(() => expect(wakeSpy).toHaveBeenCalledExactlyOnceWith(1));
    await wakeSpy.mock.results[0].value;
    const {reconcileSiteAssessments}=queue;
    const [key,job]=selectedJob();
    expect(job.state,JSON.stringify({run:state.docs.get(`agentRuns/${job.run_id}`),sdkException,
      runtimeCalls:seams.run.mock.calls.length,manifestCalls:seams.manifest.mock.calls.length,markerCalls:seams.marker.mock.calls.length})).toBe("completed");
    expect(calls).toBe(2);expect(videoSpy).toHaveBeenCalledTimes(1);
    const run=state.docs.get(`agentRuns/${job.run_id}`)!;
    expect(run.artifacts.source_admission).toMatchObject({advisory_job_id:key.split("/")[1],context_digest:job.context_digest,source_key:browserPendingDecisionKey(joined),video_sha256:createHash("sha256").update(Buffer.from("video-1")).digest("hex")});
    expect(run.artifacts.capture_inference_reservations).toHaveLength(3);
    if (mode === "programme-bound") {
      const programme = state.docs.get("inferencePrograms/synthetic-programme")!;
      expect(programme.slots.find((slot:any) => slot.id === "original-gemini").state).toBe("unknown");
      expect(programme.slots.find((slot:any) => slot.id === "original-sol-1").state).toBe("recorded");
      expect(programme.slots.filter((slot:any) => slot.state === "held")).toHaveLength(4);
      expect(programme).toEqual(historicalProgramme);
      const newCalls = [...state.docs.entries()].filter(([key, value]) => key.includes("/calls/") && value.run_id === job.run_id);
      expect(newCalls).toHaveLength(3);
      expect(newCalls.every(([,value]) => ["recorded", "unknown"].includes(value.state))).toBe(true);
      expect(run.artifacts.capture_inference_reservations.every((row:any) => row.spending_gated === true && row.daily_cap_usd === 50)).toBe(true);
      expect(programme.slots.reduce((total:number, slot:any) => total + slot.reserved_micro_usd, 0)).toBe(4_964_928);
    }
    const express=(await import("express")).default;const {createServer}=await import("node:http");
    const app=express();app.use(express.json());app.use("/api/site-task-brief",(await import("../routes/site-task-brief")).default);
    server=createServer(app);await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
    const {createCaptureUploadToken}=await import("../utils/captureUploadToken");
    const token=createCaptureUploadToken({requestId:joined.request_id,sceneId:joined.scene_id,captureId:joined.capture_id});
    const read=()=>fetch(`http://127.0.0.1:${server.address().port}/api/site-task-brief/${token}/status`);
    const response=await read();expect(response.status).toBe(200);const body=await response.json();
    expect(body.siteAdvisory?.state).toBe("ready");expect(body.siteAdvisory.sections).toEqual([]);expect(JSON.stringify(body.siteAdvisory)).not.toContain("A carton moves");
    expect(JSON.stringify(body.siteAdvisory)).not.toMatch(/PRIVATE|fabricated|gs:\/\/|signed-no-fetch|raw_model_assessment/);
    const {renderToStaticMarkup}=await import("react-dom/server");const {createElement}=await import("react");
    const {SiteAdvisoryReport}=await import("../../client/src/components/site/SiteAdvisoryReport");
    const html=renderToStaticMarkup(createElement(SiteAdvisoryReport,{advisory:body.siteAdvisory}));expect(html).not.toContain("A carton moves");expect(html).not.toContain("Full assessment and evidence");
    await reconcileSiteAssessments();expect(calls).toBe(2);
    // The actual private SDK result survived, but the final job/pointer commit
    // was lost. Ordinary owner polling must recover it without paid replay.
    state.docs.set(key,{...state.docs.get(key),state:"running",packet_sha256:null});
    state.docs.get(`inboundRequests/${joined.request_id}`)!.site_advisory.state="running";
    const wakesBeforeReturn=wakeSpy.mock.calls.length;
    const returning=await(await read()).json();expect(returning.siteAdvisory.state).toBe("running");
    await vi.waitFor(()=>expect(wakeSpy.mock.calls.length).toBeGreaterThan(wakesBeforeReturn));
    // The existing rotating scan may wrap its retained cursor on this poll;
    // follow ordinary status polling until its next bounded pass reads the row.
    await vi.waitFor(async()=> {
      await Promise.all(wakeSpy.mock.results.map(result=>result.value));
      expect((await(await read()).json()).siteAdvisory.state).toBe("ready");
    });
    expect(state.docs.get(key)?.state).toBe("completed");expect(calls).toBe(2);expect(videoSpy).toHaveBeenCalledTimes(1);
    const wakesBeforeWithdrawal=wakeSpy.mock.calls.length;
    state.docs.get(`inboundRequests/${joined.request_id}`)!.consent_revoked=true;
    const withdrawn=await(await read()).json();expect(withdrawn.siteAdvisory.state).toBe("authority_ended");expect(withdrawn.siteAdvisory.sections).toEqual([]);
    await Promise.resolve();expect(wakeSpy.mock.calls.length).toBe(wakesBeforeWithdrawal);expect(calls).toBe(2);
  } finally {
    modelSpy.mockRestore();videoSpy.mockRestore();fetchGuard.mockRestore();vi.unstubAllEnvs();
    if(server)await new Promise<void>(resolve=>server.close(()=>resolve()));
  }
},30000);

async function completedBriefAssessment(summary = "Move a rigid carton to the shelf", confirmed = true) {
  const { draftBrief } = await import("../utils/siteTaskBrief");
  const brief = { ...draftBrief({ requestId: pending.request_id, summary, proposed: [], captureMode: "self_capture" }),
    confirmedAtIso: confirmed ? "2026-10-08T00:00:00Z" : null, confirmedBy: confirmed ? "fixture-owner" : null,
    operatorAnswers: confirmed ? {} : null };
  state.docs.set(`siteTaskBriefs/${pending.request_id}`, brief);
  await publishBrowserPending(pending);
  const [path, initial] = selectedJob(), job = { ...initial, state: "completed" };
  state.docs.set(path, job);
  state.docs.get(`inboundRequests/${pending.request_id}`)!.site_advisory.state = "completed";
  state.docs.set(`agentRuns/${job.run_id}`, storedPacket(path.split("/")[1], job));
  return { brief, path, job };
}

it("an owner correction atomically queues its current context without reusing a stale result or resetting spend", async () => {
  const { confirmBrief } = await import("../utils/siteTaskBrief");
  const { humanDecisionDigest } = await import("../utils/human-reply-admission");
  const previous = await completedBriefAssessment();
  const retained = structuredClone(state.docs.get(`agentRuns/${previous.job.run_id}`));
  const budgetPath = `captureCoverageReviews/budget-${humanDecisionDigest({ capture_id: pending.capture_id })}`;
  const budget = { capture_id: pending.capture_id, exposure_usd: 3, calls: 1, pending_token: "unknown-retained-call" };
  state.docs.set(budgetPath, budget);
  await confirmBrief({ requestId: pending.request_id, confirmedBy: "fixture-owner", summary: "Fold towels into stacks" });
  const raw = state.docs.get(`inboundRequests/${pending.request_id}`)!;
  const brief = state.docs.get(`siteTaskBriefs/${pending.request_id}`)!;
  const id = advisoryJobId(pending.request_id, previous.job.source_key, advisoryContextDigest(raw, brief));
  expect(id).not.toBe(previous.path.split("/")[1]);
  expect(raw.site_advisory).toMatchObject({ job_id: id, state: "queued", context_digest: advisoryContextDigest(raw, brief) });
  expect(state.docs.get(`siteAssessmentJobs/${id}`)).toMatchObject({ state: "queued", source_key: previous.job.source_key });
  expect(state.docs.get(previous.path)).toEqual(previous.job);
  expect(state.docs.get(`agentRuns/${previous.job.run_id}`)).toEqual(retained);
  expect(state.docs.get(budgetPath)).toEqual(budget);
  await confirmBrief({ requestId: pending.request_id, confirmedBy: "fixture-owner", summary: "Fold towels into stacks" });
  expect([...state.docs.keys()].filter(path => path.startsWith("siteAssessmentJobs/"))).toHaveLength(2);
  expect(state.docs.get(`inboundRequests/${pending.request_id}`)!.site_advisory.job_id).toBe(id);
  expect(seams.run).not.toHaveBeenCalled();
  // The existing worker, not confirmation, runs the distinct input once.
  const { reconcileSiteAssessments } = await import("../utils/siteAssessmentQueue");
  seams.run.mockImplementationOnce(async (_task, options) => {
    state.docs.set(`agentRuns/${options.runId}`, storedPacket(id, state.docs.get(`siteAssessmentJobs/${id}`)));
    return { status: "completed" };
  });
  await reconcileSiteAssessments(); await reconcileSiteAssessments();
  expect(state.docs.get(`siteAssessmentJobs/${id}`)?.state).toBe("completed");
  expect(seams.run).toHaveBeenCalledTimes(1);
  expect(state.docs.get(budgetPath)).toEqual(budget);
});

it("a source-bound footage correction queues the newly described task and obeys Firestore read-before-write", async () => {
  const { mergeBriefProposals, PLACEHOLDER_TASK_SUMMARY } = await import("../utils/siteTaskBrief");
  const { humanDecisionDigest } = await import("../utils/human-reply-admission");
  const { sharedFakeFirestore } = await import("./helpers/fake-firestore");
  const previous = await completedBriefAssessment(PLACEHOLDER_TASK_SUMMARY, false);
  const runTransaction = sharedFakeFirestore.runTransaction.bind(sharedFakeFirestore);
  const strict = vi.spyOn(sharedFakeFirestore, "runTransaction").mockImplementation(async callback => runTransaction(async tx => {
    let wrote = false;
    const guarded = new Proxy(tx, { get(target, name) {
      if (name === "get") return (...args: any[]) => { if (wrote) throw Error("read_after_write"); return (target.get as any)(...args); };
      if (name === "set" || name === "update" || name === "delete") return (...args: any[]) => {
        wrote = true; return (target[name] as any)(...args);
      };
      return (target as any)[name];
    } });
    return callback(guarded);
  }));
  try {
    const input = { requestId: pending.request_id, proposals: [], observedSummary: "Pick up the carton and place it on the shelf",
      source: { capture_id: pending.capture_id, evidence_digest: "fixture-reading", brief_digest: humanDecisionDigest(previous.brief) } };
    const next = await mergeBriefProposals(input);
    const pointer = state.docs.get(`inboundRequests/${pending.request_id}`)!.site_advisory;
    expect(next).toMatchObject({ summary: input.observedSummary, taskFamily: "rigid_pick_and_place" });
    expect(pointer).toMatchObject({ state: "queued", context_digest: advisoryContextDigest(request(), next) });
    expect(pointer.job_id).not.toBe(previous.path.split("/")[1]);
    await mergeBriefProposals(input);
    expect([...state.docs.keys()].filter(path => path.startsWith("siteAssessmentJobs/"))).toHaveLength(2);
    expect(seams.run).not.toHaveBeenCalled();
  } finally { strict.mockRestore(); }
});

it.each(["withdrawn", "source_changed", "privacy_blocked", "disabled", "not_registered"])(
  "a brief correction does not create new assessment authority when %s", async reason => {
    const { confirmBrief } = await import("../utils/siteTaskBrief");
    const previous = await completedBriefAssessment();
    const raw = state.docs.get(`inboundRequests/${pending.request_id}`)!;
    if (reason === "withdrawn") raw.consent_revoked = true;
    if (reason === "privacy_blocked") raw.capture_privacy_source_bound_decision.proceeded = false;
    if (reason === "source_changed") state.docs.get(`captureUploadSessions/${pending.capture_id}`)!.browser_pending_delivery.video.generation = "different";
    if (reason === "disabled") seams.enabled = false;
    if (reason === "not_registered") delete raw.site_advisory;
    await confirmBrief({ requestId: pending.request_id, confirmedBy: "fixture-owner", summary: "Fold towels" });
    expect([...state.docs.keys()].filter(path => path.startsWith("siteAssessmentJobs/"))).toHaveLength(1);
    expect(state.docs.get(previous.path)).toEqual(previous.job);
    expect(seams.run).not.toHaveBeenCalled();
  },
);

it.each(["never_started", "completed", "uncertain"])(
  "returning to a superseded context safely resumes %s evidence without replaying uncertain paid work", async retained => {
    const { confirmBrief } = await import("../utils/siteTaskBrief");
    const { reconcileSiteAssessments } = await import("../utils/siteAssessmentQueue");
    const previous = await completedBriefAssessment();
    const raw = state.docs.get(`inboundRequests/${pending.request_id}`)!;
    const oldRunPath = `agentRuns/${previous.job.run_id}`;
    const stateBefore = retained === "never_started" ? "queued" : "running";
    const previousJob = { ...previous.job, state: stateBefore,
      ...(retained !== "never_started" ? { claim_id: "retained-claim", started_at_ms: Date.now() } : {}) };
    state.docs.set(previous.path, previousJob); raw.site_advisory.state = stateBefore;
    if (retained === "never_started") state.docs.delete(oldRunPath);
    if (retained === "uncertain") state.docs.set(oldRunPath, { ...state.docs.get(oldRunPath), status: "running" });
    const budgetPath = "captureCoverageReviews/retained-unknown-budget";
    const budget = { exposure_usd: 4, pending_token: "unknown-call", calls: 1 };
    state.docs.set(budgetPath, budget);
    await confirmBrief({ requestId: pending.request_id, confirmedBy: "fixture-owner", summary: "Fold towels" });
    seams.coverageActive = true; await reconcileSiteAssessments(); seams.coverageActive = false;
    expect(state.docs.get(previous.path)?.state).toBe("authority_ended");
    await confirmBrief({ requestId: pending.request_id, confirmedBy: "fixture-owner", summary: previous.brief.summary });
    expect(state.docs.get(`inboundRequests/${pending.request_id}`)!.site_advisory.job_id).toBe(previous.path.split("/")[1]);
    expect(state.docs.get(previous.path)).toMatchObject({ run_id: previousJob.run_id, claim_id: previousJob.claim_id,
      state: retained === "uncertain" ? "needs_review" : "queued" });
    expect(state.docs.get(budgetPath)).toEqual(budget);
    expect(seams.run).not.toHaveBeenCalled();
    if (retained === "completed") {
      // The existing rotating queue scan may wrap its retained cursor first.
      await vi.waitFor(async () => {
        await reconcileSiteAssessments();
        expect(state.docs.get(previous.path)?.state).toBe("completed");
      });
      expect(seams.run).not.toHaveBeenCalled();
    }
  },
);
