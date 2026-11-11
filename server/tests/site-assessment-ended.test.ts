// @vitest-environment node
/**
 * The per-job site assessment ended for new jobs (owner decision 2026-11-11).
 *
 * Nothing starts one: a published video, a brief correction and a customer
 * reply queue nothing, and the sweep never claims or runs one. A job already
 * queued at cutover is closed with a typed terminal state, so it cannot show
 * "processing" for ever. The sweep still retires a run in flight, so the
 * capture's video reading is never blocked behind it, and old finished
 * results stay as they were.
 */
import { beforeEach, expect, it, vi } from "vitest";
const seams = vi.hoisted(() => ({ enabled: true, run: vi.fn(), manifest: vi.fn(), marker: vi.fn() }));
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
vi.mock("../../client/src/lib/firebaseAdmin", async () => ({
  default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => undefined } } },
  dbAdmin: (await import("./helpers/fake-firestore")).sharedFakeFirestore,
  storageAdmin: { bucket: () => ({ file: () => ({ getMetadata: async () => { throw Error("synthetic_object_missing"); } }) }) },
}));
vi.mock("../config/env", async () => ({ ...await vi.importActual("../config/env"), isSiteVideoEvidenceEnabled: () => seams.enabled }));
vi.mock("../agents/runtime", () => ({ runAgentTask: seams.run }));
vi.mock("../utils/captureCoverageQueue", () => ({ isCoverageReviewActive: () => false }));
vi.mock("../utils/websiteBrowserUploadStatus", async () => ({ ...await vi.importActual("../utils/websiteBrowserUploadStatus"),
  verifiedPendingManifest: seams.manifest, verifiedPendingMarker: seams.marker }));
vi.mock("../logger", () => ({ attachRequestMeta: (x: any) => x, logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
import { publishBrowserPending, browserPendingDecisionKey, type BrowserPending } from "../utils/websiteBrowserPending";
import { advisoryContextDigest, advisoryJobId } from "../utils/siteAssessmentContext";
import { RECORDING_CONSENT_VERSION } from "../utils/recordingConsent";
import * as queue from "../utils/siteAssessmentQueue";

const pending: BrowserPending = { schema_version: "website_browser_pending.v1", request_id: "ended-fixture", scene_id: "site-ended-fixture",
  capture_id: "walkthrough-ended-fixture", state: "held", completed_at_iso: "2026-11-10T00:00:00.000Z",
  video: { object_name: "scenes/site-ended-fixture/captures/walkthrough-ended-fixture/raw/walkthrough.mp4", generation: "90071992547409931", size_bytes: 7, crc32c: "AAAAAA==" },
  manifest: { object_name: "scenes/site-ended-fixture/captures/walkthrough-ended-fixture/raw/manifest.json", generation: "90071992547409932", size_bytes: 500, crc32c: "AAAAAA==", sha256: `sha256:${"a".repeat(64)}` } };
const request = () => ({ request: { buyerType: "site_operator", capture_mode: "self_capture", taskDescription: "Move a bin",
  consent_attestation: { granted: true, statement_version: RECORDING_CONSENT_VERSION, recorded_at_iso: "2026-11-10T00:00:00.000Z" } },
  capture_privacy_source_bound_decision: { capture_id: pending.capture_id, proceeded: true, eligibility: "unscreened",
    producer_source: { kind: "browser_pending", key: browserPendingDecisionKey(pending) } } });
const jobs = () => [...state.docs.keys()].filter(key => key.startsWith("siteAssessmentJobs/"));

/** A job exactly as the ended producer used to leave it at cutover. */
function legacyJob(overrides: Record<string, unknown> = {}) {
  const sourceKey = browserPendingDecisionKey(pending), contextDigest = advisoryContextDigest(request(), null);
  const id = advisoryJobId(pending.request_id, sourceKey, contextDigest), suffix = id.slice("advisory-".length);
  const job = { schema_version: "site_assessment_job.v1", request_id: pending.request_id, capture_id: pending.capture_id,
    scene_id: pending.scene_id, source_key: sourceKey, context_digest: contextDigest, state: "queued",
    run_id: `site-assessment-${suffix}`, claim_id: null, packet_sha256: null, correlation_id: `bp-advisory-${suffix.slice(0, 16)}`,
    created_at_ms: 1, ...overrides } as Record<string, any>;
  state.docs.set(`siteAssessmentJobs/${id}`, job);
  state.docs.get(`inboundRequests/${pending.request_id}`)!.site_advisory = { job_id: id, capture_id: pending.capture_id,
    source_key: sourceKey, context_digest: contextDigest, state: job.state };
  state.docs.set(`captureUploadSessions/${pending.capture_id}`, { browser_pending_delivery: { ...pending, state: "published" } });
  return { id, path: `siteAssessmentJobs/${id}`, job };
}

beforeEach(() => {
  seams.enabled = true; seams.run.mockReset();
  seams.manifest.mockReset().mockResolvedValue(JSON.stringify({ capture_rights: { derived_scene_generation_allowed: true, consent_status: "granted", consent_revoked: false } }));
  seams.marker.mockReset().mockResolvedValue(true);
  state.docs.clear(); state.docs.set(`inboundRequests/${pending.request_id}`, request());
  state.docs.set(`captureUploadSessions/${pending.capture_id}`, { browser_pending_delivery: pending });
});

it("a newly published video queues no assessment and leaves no pointer to one", async () => {
  await publishBrowserPending(pending);
  expect(state.docs.get(`captureUploadSessions/${pending.capture_id}`)?.browser_pending_delivery).toMatchObject({ state: "published" });
  expect(jobs()).toEqual([]);
  expect(state.docs.get(`inboundRequests/${pending.request_id}`)?.site_advisory).toBeUndefined();
  expect(seams.run).not.toHaveBeenCalled();
});

it("a brief correction and a customer reply queue nothing new", async () => {
  const { sharedFakeFirestore } = await import("./helpers/fake-firestore");
  const { id } = legacyJob({ state: "completed" });
  const record = state.docs.get(`inboundRequests/${pending.request_id}`)!;
  await sharedFakeFirestore.runTransaction(async tx => {
    expect(await queue.prepareBriefContextSiteAssessment(tx, pending.request_id, record, { summary: "Fold towels" })).toBeNull();
    const reply = await queue.prepareCustomerReplySiteAssessment(sharedFakeFirestore as any, tx, pending.request_id, record,
      [{ statement_id: "a".repeat(64), digest: "b".repeat(64) }] as any);
    expect(reply.state).toBe("disabled");
    reply.commit();
  });
  expect(jobs()).toEqual([`siteAssessmentJobs/${id}`]);
  expect(state.docs.get(`inboundRequests/${pending.request_id}`)?.site_advisory.job_id).toBe(id);
});

it("closes a job still queued at cutover with a typed terminal state, without a model call", async () => {
  const { path, job } = legacyJob();
  await queue.reconcileSiteAssessments(); await queue.reconcileSiteAssessments();
  expect(seams.run).not.toHaveBeenCalled();
  expect(state.docs.get(path)).toMatchObject({ state: "retired", claim_id: null, run_id: job.run_id, packet_sha256: null,
    retired: { schema_version: "site_assessment_retired.v1", reason: "site_assessment_ended" } });
  expect(state.docs.get(`inboundRequests/${pending.request_id}`)?.site_advisory).toMatchObject({ state: "retired" });
  expect(state.docs.has(`agentRuns/${job.run_id}`)).toBe(false);
});

it("still publishes a result that finished before cutover, and still retires a stale run in flight", async () => {
  const { path, id, job } = legacyJob({ state: "running", claim_id: "cutover-claim", started_at_ms: 0 });
  state.docs.set(`agentRuns/${job.run_id}`, { task_kind: "site_assessment", status: "running", artifacts: { usage: null } });
  await queue.reconcileSiteAssessments();
  expect(state.docs.get(path)?.state).toBe("needs_review");
  expect(seams.run).not.toHaveBeenCalled();
  // No automatic retry and no owner retry follow it.
  await queue.reconcileSiteAssessments();
  expect(state.docs.get(path)).toMatchObject({ state: "needs_review", run_id: job.run_id });
  expect(state.docs.get(path)?.retry_history).toBeUndefined();
  expect(await queue.describeSiteAssessmentRetry(pending.request_id, () => true)).toEqual({ available: false, job_id: null, run_id: null });
  expect(id).toMatch(/^advisory-/);
});

it("no longer exports the owner retry or the automatic retry", () => {
  expect(Object.keys(queue)).not.toContain("retrySiteAssessment");
  expect(Object.keys(queue)).not.toContain("AUTOMATIC_ASSESSMENT_RETRIES");
  expect(Object.keys(queue)).not.toContain("transientAssessmentFailure");
});

it("the agent runtime refuses a site assessment run", async () => {
  const runtime = await vi.importActual<typeof import("../agents/runtime")>("../agents/runtime");
  await expect(runtime.runAgentTask({ kind: "site_assessment", session_key: "site_advisory:ended",
    input: { message: "Assess", context: { request_id: pending.request_id } } } as any)).rejects.toThrow("site_assessment_retired");
});
