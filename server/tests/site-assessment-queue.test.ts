// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
const seams = vi.hoisted(() => ({ enabled: true, run: vi.fn(), manifest: vi.fn(), marker: vi.fn() }));
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
vi.mock("../../client/src/lib/firebaseAdmin", async () => ({ dbAdmin: (await import("./helpers/fake-firestore")).sharedFakeFirestore, storageAdmin: null }));
vi.mock("../config/env", () => ({ isSiteVideoEvidenceEnabled: () => seams.enabled }));
vi.mock("../agents/runtime", () => ({ runAgentTask: seams.run }));
vi.mock("../utils/websiteBrowserUploadStatus", () => ({ verifiedPendingManifest: seams.manifest, verifiedPendingMarker: seams.marker, originalManifestConsent: () => true }));
vi.mock("../logger", () => ({ logger: { warn: vi.fn() } }));
import { publishBrowserPending, browserPendingDecisionKey, type BrowserPending } from "../utils/websiteBrowserPending";
import { advisoryContextDigest, advisoryJobId } from "../utils/siteAssessmentContext";
import { RECORDING_CONSENT_VERSION } from "../utils/recordingConsent";
const pending: BrowserPending = { schema_version: "website_browser_pending.v1", request_id: "advisory-fixture", scene_id: "site-advisory-fixture",
  capture_id: "walkthrough-advisory-fixture", state: "held", completed_at_iso: "2026-10-08T00:00:00.000Z",
  video: { object_name: "scenes/site-advisory-fixture/captures/walkthrough-advisory-fixture/raw/walkthrough.mp4", generation: "90071992547409931", size_bytes: 7, crc32c: "AAAAAA==" },
  manifest: { object_name: "scenes/site-advisory-fixture/captures/walkthrough-advisory-fixture/raw/manifest.json", generation: "90071992547409932", size_bytes: 500, crc32c: "AAAAAA==", sha256: `sha256:${"a".repeat(64)}` } };
const request = () => ({ request: { buyerType: "site_operator", capture_mode: "self_capture", taskDescription: "Move a bin; success remains unknown",
  consent_attestation: { granted: true, statement_version: RECORDING_CONSENT_VERSION, recorded_at_iso: "2026-10-08T00:00:00.000Z" } },
  capture_privacy_source_bound_decision: { capture_id: pending.capture_id, proceeded: true, eligibility: "unscreened",
    producer_source: { kind: "browser_pending", key: browserPendingDecisionKey(pending) } } });
beforeEach(() => { seams.enabled = true; seams.run.mockReset(); seams.manifest.mockReset().mockResolvedValue("synthetic-manifest"); seams.marker.mockReset().mockResolvedValue(true); state.docs.clear(); state.docs.set(`inboundRequests/${pending.request_id}`, request());
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

const hash = (packet: unknown) => createHash("sha256").update(JSON.stringify(packet)).digest("hex");
const selectedJob = () => [...state.docs].find(([key]) => key.startsWith("siteAssessmentJobs/"))!;
const storedPacket = (id: string, job: any) => {
  const packet = { schema_version: "site_assessment.v2", request_id: pending.request_id, assessment: { status: "needs_operator_input" }, sources: [] };
  return { task_kind: "site_assessment", status: "completed", artifacts: { site_assessment_packet: packet, site_assessment_packet_sha256: hash(packet),
    source_admission: { request_id: pending.request_id, capture_id: pending.capture_id, source_key: job.source_key, context_digest: job.context_digest,
      advisory_job_id: id } } };
};
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
it("keeps unknown interrupted provider work for review instead of redispatching", async () => {
  const { reconcileSiteAssessments } = await import("../utils/siteAssessmentQueue");
  await publishBrowserPending(pending);const [key, job] = selectedJob();
  state.docs.set(key, { ...job, state: "running", claim_id: "retained-claim", started_at_ms: 0 });
  state.docs.set(`agentRuns/${job.run_id}`, { task_kind: "site_assessment", status: "running", artifacts: { usage: null } });
  await reconcileSiteAssessments();await reconcileSiteAssessments();
  expect(state.docs.get(key)?.state).toBe("needs_review"); expect(seams.run).not.toHaveBeenCalled();
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
