// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { OpenAIProvider, setTracingDisabled } from "@openai/agents";
import OpenAI from "openai";
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
const objects = vi.hoisted(() => new Map<string, { generation: string; body: Buffer }>());
vi.mock("../../client/src/lib/firebaseAdmin", async () => ({
  default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP" } } },
  dbAdmin: (await import("./helpers/fake-firestore")).sharedFakeFirestore,
  storageAdmin: { bucket: () => ({ name: "synthetic-bucket", file: (name: string, options?: { generation?: string }) => {
    const read = () => { const row = objects.get(name); if (!row || row.generation !== options?.generation) throw Error("unexpected_object_read"); return row; };
    return { getMetadata: async () => [{ generation: read().generation, size: String(read().body.length), crc32c: "AAAAAA==", contentType: "video/mp4" }],
      download: async () => [read().body], getSignedUrl: async () => ["https://example.invalid/not-fetched"] };
  } }) },
}));
vi.mock("../config/env", async () => ({ ...await vi.importActual("../config/env"), isSiteVideoEvidenceEnabled: () => true }));
vi.mock("../utils/websiteBrowserUploadStatus", () => ({ verifiedPendingManifest: async () => true, verifiedPendingMarker: async () => true }));
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
import { runSiteAssessmentTask } from "../agents/adapters/site-assessment";
import { browserPendingDecisionKey, type BrowserPending } from "../utils/websiteBrowserPending";
import { RECORDING_CONSENT_VERSION } from "../utils/recordingConsent";
import { humanDecisionDigest } from "../utils/human-reply-admission";
import type { NormalizedAgentTask } from "../agents/types";
const runId = "synthetic-error-run", requestId = "synthetic-error";
const task = { provider: "openai_responses", runtime: "openai_agents_sdk", model: "gpt-6.1-sol", kind: "site_assessment",
  input: { message: "Observe movement", context: { request_id: requestId } }, tool_policy: { mode: "api", allowed_actions: ["analyze_site_video"],
    allowed_domains: [], isolated_runtime_required: false } } as unknown as NormalizedAgentTask;
const host = { runId, assertActive: async () => {}, assertCostAllowed: async () => {} };
beforeEach(() => {
  setTracingDisabled(true); vi.stubEnv("OPENAI_API_KEY", "synthetic-no-provider");
  state.docs.clear(); objects.clear();
  const prefix = `scenes/site-${requestId}/captures/walkthrough-${requestId}/raw/`;
  const manifest = Buffer.from(JSON.stringify({ request_id: requestId, scene_id: `site-${requestId}`, capture_id: `walkthrough-${requestId}`,
    video_uri: prefix + "walkthrough.mp4", duration_seconds: 10,
    capture_rights: { derived_scene_generation_allowed: true, consent_status: "granted", consent_revoked: false } }));
  const video = Buffer.from("synthetic-video");
  const pending: BrowserPending = { schema_version: "website_browser_pending.v1", request_id: requestId, scene_id: `site-${requestId}`,
    capture_id: `walkthrough-${requestId}`, state: "published", completed_at_iso: "2026-10-08T00:00:00.000Z",
    video: { object_name: prefix + "walkthrough.mp4", generation: "1", size_bytes: video.length, crc32c: "AAAAAA==" },
    manifest: { object_name: prefix + "manifest.json", generation: "2", size_bytes: manifest.length, crc32c: "AAAAAA==",
      sha256: `sha256:${createHash("sha256").update(manifest).digest("hex")}` } };
  objects.set(pending.video.object_name, { generation: "1", body: video }); objects.set(pending.manifest.object_name, { generation: "2", body: manifest });
  state.docs.set(`captureUploadSessions/${pending.capture_id}`, { browser_pending_delivery: pending });
  state.docs.set(`agentRuns/${runId}`, { task_kind: "site_assessment", status: "running", input: { input: task.input } });
  state.docs.set(`inboundRequests/${requestId}`, { contact: { email: "synthetic@example.invalid", company: "Synthetic" }, request: { buyerType: "site_operator", taskDescription: "Observe movement",
    consent_attestation: { granted: true, statement_version: RECORDING_CONSENT_VERSION, recorded_at_iso: "2026-10-08T00:00:00.000Z" } },
    capture_privacy_source_bound_decision: { proceeded: true, eligibility: "unscreened", capture_id: pending.capture_id,
      producer_source: { kind: "browser_pending", key: browserPendingDecisionKey(pending) } } });
  vi.spyOn(globalThis, "fetch").mockImplementation(async () => { throw Error("unexpected_external_network"); });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
async function failProvider(error: unknown, extraHost: Record<string, any> = {}) {
  const dispatch = vi.fn(async () => { throw error; });
  vi.spyOn(OpenAIProvider.prototype, "getModel").mockResolvedValue({ getResponse: dispatch,
    async *getStreamedResponse() { throw Error("unexpected_stream"); } } as any);
  const result = await runSiteAssessmentTask(task, { ...host, ...extraHost });
  expect(dispatch, JSON.stringify(result)).toHaveBeenCalledExactlyOnceWith(expect.anything());
  expect(result.artifacts?.capture_inference_reservations).toHaveLength(1);
  expect(result.artifacts?.site_assessment_partial_evidence?.tool_receipts).toEqual([]);
  expect(result.artifacts?.provider_responses).toMatchObject([{ provider: "openai", usage: null, response: null, cost_usd: null }]);
  const budgetPath = `captureCoverageReviews/budget-${humanDecisionDigest({ capture_id: `walkthrough-${requestId}` })}`;
  const pendingToken = state.docs.get(budgetPath)?.pending_token;
  expect(pendingToken).toBeTruthy();
  const calls = [...state.docs].filter(([key]) => key.startsWith(`${budgetPath}/calls/`)).map(([, value]) => value);
  expect(calls).toMatchObject([{ state: "admitted", admission_token: pendingToken, cost_estimate_usd: null, run_id: runId, request_id: requestId }]);
  expect(calls[0].reserved_usd).toBeGreaterThan(0);
  return result;
}
it("retains only safe API exception metadata after the actual SDK reservation, without retry or refund", async () => {
  const error = new OpenAI.RateLimitError(429, { code: "rate_limit_exceeded", message: "PRIVATE prompt https://secret.invalid sk-private" },
    undefined, { "x-request-id": `req_${"a".repeat(32)}`, "x-private": "PRIVATE" });
  const result = await failProvider(error);
  expect(result.error).toBe("site_assessment_failed");
  expect(result.artifacts?.site_assessment_error).toEqual({ schema_version: "site_assessment_error.v1", correlation_id: runId,
    exception_class: "RateLimitError", http_status: 429, provider_error_code: "rate_limit_exceeded", provider_request_id: `req_${"a".repeat(32)}` });
  expect(JSON.stringify(result)).not.toMatch(/PRIVATE|secret.invalid|sk-private|x-private/);
});
it("preserves a useful builtin serialization exception classification without its message or stack", async () => {
  const result = await failProvider(new TypeError("PRIVATE circular source https://secret.invalid"));
  expect(result.artifacts?.site_assessment_error).toMatchObject({ exception_class: "TypeError", http_status: null, provider_error_code: null, provider_request_id: null });
  expect(JSON.stringify(result)).not.toMatch(/PRIVATE|secret.invalid|circular/);
});
it("rejects arbitrary prefixed error prose and metadata values", async () => {
  const error = Object.assign(new Error("site_assessment_PRIVATE secret body"), { name: "PRIVATE", status: "429", code: "sk-private",
    request_id: "req_sk-private", headers: { "x-request-id": `req_${"a".repeat(32)}`, authorization: "PRIVATE" }, cause: { message: "PRIVATE" } });
  const result = await failProvider(error);
  expect(result.error).toBe("site_assessment_failed");
  expect(result.artifacts?.site_assessment_error).toMatchObject({ exception_class: "Error", http_status: null, provider_error_code: null, provider_request_id: null });
  expect(JSON.stringify(result)).not.toMatch(/PRIVATE|sk-private|authorization|headers|stack|cause/);
});
it.each(["site_assessment_cancelled", "site_assessment_context_changed"])("preserves exact trusted guard %s", async code => {
  const result = await runSiteAssessmentTask(task, { ...host, assertActive: async () => { throw Error(code); } });
  expect(result.error).toBe(code); expect(result.status).toBe(code === "site_assessment_cancelled" ? "cancelled" : "failed");
  expect(result.artifacts?.capture_inference_reservations).toEqual([]);
});

it("ignores diagnostic getters and invalid bounds without replacing the original failure", async () => {
  const error = new Error("PRIVATE original");
  let reads = 0;
  for (const key of ["status", "code", "request_id"]) Object.defineProperty(error, key, { configurable: true,
    get() { reads++; throw Error("PRIVATE diagnostic getter"); } });
  const result = await failProvider(error);
  expect(reads).toBe(0);
  expect(result.artifacts?.site_assessment_error).toEqual({ schema_version: "site_assessment_error.v1", correlation_id: runId,
    exception_class: "Error", http_status: null, provider_error_code: null, provider_request_id: null });
  expect(result.error).toBe("site_assessment_failed"); expect(JSON.stringify(result)).not.toContain("PRIVATE");
});
it.each([99, 600, 429.5])("rejects out-of-range/fractional HTTP status %s", async status => {
  const result = await failProvider(Object.assign(new Error("PRIVATE"), { status, code: { private: "PRIVATE" }, request_id: `req_${"a".repeat(65)}` }));
  expect(result.artifacts?.site_assessment_error).toMatchObject({ http_status: null, provider_error_code: null, provider_request_id: null });
  expect(JSON.stringify(result)).not.toContain("PRIVATE");
});

it("keeps original SDK failure and reservations when an experiment diagnostics sink throws", async () => {
  const { reserveCaptureCoverageInference } = await import("../utils/captureCoverageInferenceBudget");
  const recordError = vi.fn(() => { throw Error("PRIVATE diagnostic failure"); });
  const result = await failProvider(new TypeError("PRIVATE original failure"), { experiment: { mode: "fresh-video",
    prepare: async () => [], reserve: reserveCaptureCoverageInference, record_error: recordError } });
  expect(recordError).toHaveBeenCalledTimes(1);
  expect(result.artifacts?.site_assessment_error).toMatchObject({ exception_class: "TypeError" });
  expect(JSON.stringify(result)).not.toContain("PRIVATE");
});
