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
it("ADVISORY-PRODUCER-001 a new publication creates no advisory intent: the assessment ended (owner decision 2026-11-11)", async () => {
  await publishBrowserPending(pending);
  expect(state.docs.get(`captureUploadSessions/${pending.capture_id}`)?.browser_pending_delivery).toMatchObject({ state: "published" });
  expect([...state.docs.keys()].filter(key => key.startsWith("siteAssessmentJobs/"))).toHaveLength(0);
  expect(state.docs.get(`inboundRequests/${pending.request_id}`)?.site_advisory).toBeUndefined();
  expect(wakeSpy).not.toHaveBeenCalled();
});

/** The job and pointer the ended producer used to write, for jobs left at cutover. */
async function publishWithLegacyJob(source: BrowserPending = pending) {
  await publishBrowserPending(source);
  const raw = state.docs.get(`inboundRequests/${source.request_id}`)!, brief = state.docs.get(`siteTaskBriefs/${source.request_id}`) ?? null;
  const sourceKey = browserPendingDecisionKey(source), contextDigest = advisoryContextDigest(raw, brief);
  const id = advisoryJobId(source.request_id, sourceKey, contextDigest), suffix = id.slice("advisory-".length);
  const job = { schema_version: "site_assessment_job.v1", request_id: source.request_id, capture_id: source.capture_id,
    source_key: sourceKey, context_digest: contextDigest, scene_id: source.scene_id, state: "queued",
    run_id: `site-assessment-${suffix}`, claim_id: null, packet_sha256: null, correlation_id: `bp-advisory-${suffix.slice(0, 16)}`, created_at_ms: 1 };
  state.docs.set(`siteAssessmentJobs/${id}`, job);
  raw.site_advisory = { job_id: id, capture_id: source.capture_id, source_key: sourceKey, context_digest: contextDigest, state: "queued" };
}

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
  await publishWithLegacyJob();
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
it("closes a job queued at cutover without a model call, and still publishes a result retained before it", async () => {
  const { reconcileSiteAssessments } = await import("../utils/siteAssessmentQueue");
  await publishWithLegacyJob();
  const [key, initial] = selectedJob(), id = key.split("/")[1];
  await reconcileSiteAssessments();
  expect(seams.run).not.toHaveBeenCalled();
  expect(state.docs.get(key)).toMatchObject({ state: "retired", claim_id: null, packet_sha256: null });
  expect(state.docs.get(`inboundRequests/${pending.request_id}`)?.site_advisory).toMatchObject({ state: "retired" });
  // A private result persisted before cutover, with a lost queue acknowledgment.
  state.docs.set(key, { ...initial, state: "running", claim_id: "cutover-claim", started_at_ms: 0 });
  state.docs.get(`inboundRequests/${pending.request_id}`)!.site_advisory.state = "running";
  state.docs.set(`agentRuns/${initial.run_id}`, storedPacket(id, initial));
  await reconcileSiteAssessments(); await reconcileSiteAssessments();
  expect(state.docs.get(key)).toMatchObject({ state: "completed", packet_sha256: hash(storedPacket(id, initial).artifacts.site_assessment_packet) });
  expect(state.docs.get(`inboundRequests/${pending.request_id}`)?.site_advisory).toMatchObject({ state: "completed" });
  expect(seams.run).not.toHaveBeenCalled();
});
it("keeps unknown interrupted provider work for review instead of redispatching", async () => {
  const { reconcileSiteAssessments, describeSiteAssessmentRetry } = await import("../utils/siteAssessmentQueue");
  await publishWithLegacyJob();const [key, job] = selectedJob();
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
    // The owner retry ended with the assessment (owner decision 2026-11-11).
    expect((await describeSiteAssessmentRetry(pending.request_id, () => true)).available, progress).toBe(false);
    expect(await sharedFakeFirestore.runTransaction(tx => hasRecentAssessmentProgress(tx, { requestId: pending.request_id,
      jobId: id, captureId: pending.capture_id, previousRunId: job.run_id, previousClaimId: "retained-claim", sourceKey: job.source_key,
      contextDigest: job.context_digest, startedAtMs: started, request: raw, brief: null })), progress).toBe(recent);
    if (progress === "stale") {
      expect(state.docs.get(runPath)).toMatchObject({ status: "cancelled", error: "site_assessment_process_interrupted",
        advisory_abandonment: { schema_version: "site_assessment_abandonment.v1", admission_token: admission.receipt.admission_token } });
      expect([...state.docs.entries()].filter(([path]) => path.startsWith("captureCoverageReviews/"))).toEqual(before.filter(([path]) => path !== runPath));
    } else if (!["foreign-run", "future"].includes(progress)) expect([...state.docs.entries()].filter(([path]) => path.startsWith("captureCoverageReviews/") || path === runPath)).toEqual(before);
    else {
      // No proper abandonment was possible, and no call of the run's own shows
      // activity within a lease (here, none of its own, or one dated ahead): the retirement sweep closes it (2026-11-11) so it
      // can never hold the video reading's budget.
      expect(state.docs.get(runPath), progress).toMatchObject({ status: "cancelled", error: "site_assessment_retired" });
      expect([...state.docs.entries()].filter(([path]) => path.startsWith("captureCoverageReviews/"))).toEqual(before.filter(([path]) => path !== runPath));
    }
    expect(state.docs.get(callPath)?.state, progress).toBe(progress === "recorded" ? "recorded" : progress === "unknown" ? "unknown" : "admitted");
    expect(seams.run).not.toHaveBeenCalled();
  }
});
it("withdrawal wins over a retained completed packet", async () => {
  const { reconcileSiteAssessments } = await import("../utils/siteAssessmentQueue");
  await publishWithLegacyJob();const [key, job] = selectedJob(), id=key.split("/")[1];
  state.docs.set(`agentRuns/${job.run_id}`, storedPacket(id, job));
  state.docs.get(`inboundRequests/${pending.request_id}`)!.consent_revoked = true;
  await reconcileSiteAssessments();
  expect(state.docs.get(key)?.state).toBe("authority_ended");expect(seams.run).not.toHaveBeenCalled();
  expect(state.docs.get(`inboundRequests/${pending.request_id}`)?.site_advisory).toMatchObject({ state: "authority_ended" });
});
it("does not dispatch the older pending source during a newer durable upload", async () => {
  const { reconcileSiteAssessments } = await import("../utils/siteAssessmentQueue");
  await publishWithLegacyJob();const [key] = selectedJob();
  state.docs.get(`captureUploadSessions/${pending.capture_id}`)!.browser_stored_upload = { video: { generation: "90071992547409999" } };
  await reconcileSiteAssessments();
  expect(state.docs.get(key)?.state).toBe("authority_ended");expect(seams.run).not.toHaveBeenCalled();
});
it("does not backfill already-published sources or publish an in-memory-only answer", async () => {
  const { reconcileSiteAssessments } = await import("../utils/siteAssessmentQueue");
  state.docs.set(`captureUploadSessions/${pending.capture_id}`, { browser_pending_delivery: { ...pending, state: "published" } });
  await publishBrowserPending(pending);expect(selectedJob()).toBeUndefined();
  state.docs.set(`captureUploadSessions/${pending.capture_id}`, { browser_pending_delivery: pending });
  await publishWithLegacyJob();const [key] = selectedJob();
  await reconcileSiteAssessments();expect(state.docs.get(key)?.state).toBe("retired");
  expect(state.docs.get(key)?.packet_sha256).toBeNull();expect(seams.run).not.toHaveBeenCalled();
});

async function completedBriefAssessment(summary = "Move a rigid carton to the shelf", confirmed = true) {
  const { draftBrief } = await import("../utils/siteTaskBrief");
  const brief = { ...draftBrief({ requestId: pending.request_id, summary, proposed: [], captureMode: "self_capture" }),
    confirmedAtIso: confirmed ? "2026-10-08T00:00:00Z" : null, confirmedBy: confirmed ? "fixture-owner" : null,
    operatorAnswers: confirmed ? {} : null };
  state.docs.set(`siteTaskBriefs/${pending.request_id}`, brief);
  await publishWithLegacyJob();
  const [path, initial] = selectedJob(), job = { ...initial, state: "completed" };
  state.docs.set(path, job);
  state.docs.get(`inboundRequests/${pending.request_id}`)!.site_advisory.state = "completed";
  state.docs.set(`agentRuns/${job.run_id}`, storedPacket(path.split("/")[1], job));
  return { brief, path, job };
}

it("an unchanged confirmation keeps completed assessment, pending spend and coverage untouched", async () => {
  const { confirmBrief } = await import("../utils/siteTaskBrief");
  const { projectWebsiteTaskContext } = await import("../utils/websiteTaskContext");
  const previous = await completedBriefAssessment();
  const raw = state.docs.get(`inboundRequests/${pending.request_id}`)!;
  raw.site_task_brief_confirmed_at = previous.brief.confirmedAtIso;
  raw.capture_coverage_request = { state: "completed" };
  raw.capture_coverage_pending = false;
  state.docs.set("captureCoverageReviews/retained-unknown-budget", {
    exposure_usd: 4, pending_token: "unknown-call", calls: 1,
  });
  const before = structuredClone([...state.docs.entries()]);
  const result = (await confirmBrief({ requestId: pending.request_id, confirmedBy: "fixture-owner" }))!;
  expect(projectWebsiteTaskContext(result.brief)).toEqual(projectWebsiteTaskContext(previous.brief));
  expect([...state.docs.entries()]).toEqual(before);
  expect(seams.run).not.toHaveBeenCalled();
});

it("an owner correction queues no new assessment and leaves the finished result, its run and spend as they were", async () => {
  const { confirmBrief } = await import("../utils/siteTaskBrief");
  const { humanDecisionDigest } = await import("../utils/human-reply-admission");
  const previous = await completedBriefAssessment();
  const retained = structuredClone(state.docs.get(`agentRuns/${previous.job.run_id}`));
  const pointer = structuredClone(state.docs.get(`inboundRequests/${pending.request_id}`)!.site_advisory);
  const budgetPath = `captureCoverageReviews/budget-${humanDecisionDigest({ capture_id: pending.capture_id })}`;
  const budget = { capture_id: pending.capture_id, exposure_usd: 3, calls: 1, pending_token: "unknown-retained-call" };
  state.docs.set(budgetPath, budget);
  await confirmBrief({ requestId: pending.request_id, confirmedBy: "fixture-owner", summary: "Fold towels into stacks" });
  expect([...state.docs.keys()].filter(path => path.startsWith("siteAssessmentJobs/"))).toEqual([previous.path]);
  expect(state.docs.get(`inboundRequests/${pending.request_id}`)!.site_advisory).toEqual(pointer);
  expect(state.docs.get(previous.path)).toEqual(previous.job);
  expect(state.docs.get(`agentRuns/${previous.job.run_id}`)).toEqual(retained);
  expect(state.docs.get(budgetPath)).toEqual(budget);
  const { reconcileSiteAssessments } = await import("../utils/siteAssessmentQueue");
  await reconcileSiteAssessments(); await reconcileSiteAssessments();
  expect(state.docs.get(previous.path)).toEqual(previous.job);
  expect(seams.run).not.toHaveBeenCalled();
});

it("a source-bound footage correction queues nothing new and obeys Firestore read-before-write", async () => {
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
    expect(pointer).toMatchObject({ state: "completed", job_id: previous.path.split("/")[1] });
    await mergeBriefProposals(input);
    expect([...state.docs.keys()].filter(path => path.startsWith("siteAssessmentJobs/"))).toHaveLength(1);
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

// Owner decision 2026-11-11: the screen stops gating the simulation for jobs
// whose video arrives after the change; publication is that marker.
it("stamps the screen-gate cutover marker once, on the original video's first publication only", async () => {
  await publishBrowserPending(pending);
  const marker = state.docs.get(`inboundRequests/${pending.request_id}`)?.scene_screen_gate_ended;
  expect(marker).toMatchObject({ schema_version: "scene_screen_gate_ended.v1", decision: "owner_2026_11_11", capture_id: pending.capture_id });
  expect(Number.isFinite(Date.parse(marker.published_at_iso))).toBe(true);
  await publishBrowserPending(pending);
  expect(state.docs.get(`inboundRequests/${pending.request_id}`)?.scene_screen_gate_ended).toEqual(marker);
});

it("does not stamp a job whose video was already published before the change", async () => {
  state.docs.set(`captureUploadSessions/${pending.capture_id}`, { browser_pending_delivery: { ...pending, state: "published" } });
  await publishBrowserPending(pending);
  expect(state.docs.get(`inboundRequests/${pending.request_id}`)).not.toHaveProperty("scene_screen_gate_ended");
});
