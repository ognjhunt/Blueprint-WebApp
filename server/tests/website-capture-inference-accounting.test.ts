// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../agents/private-evidence", () => ({ hydrateAgentEvidence: vi.fn(async record => record) }));

import { hydrateAgentEvidence } from "../agents/private-evidence";
import { websiteCaptureInferenceAccounting } from "../utils/websiteCaptureInferenceAccounting";
import { humanDecisionDigest as digest } from "../utils/human-reply-admission";
import { advisoryJobId } from "../utils/siteAssessmentContext";
import { browserPendingDecisionKey } from "../utils/websiteBrowserPending";
import { SiteAssessmentBudget } from "../agents/adapters/site-assessment-budget";

const requestId = "req1", captureId = "walkthrough-req1", sha = (c: string) => `sha256:${c.repeat(64)}`;
const budgetId = `budget-${digest({ capture_id: captureId })}`;
const firstToken = "11111111-1111-4111-8111-111111111111", secondToken = "22222222-2222-4222-8222-222222222222";

function fixture() {
  const pending: any = { schema_version: "website_browser_pending.v1", request_id: requestId, scene_id: `site-${requestId}`,
    capture_id: captureId, state: "published", completed_at_iso: "2026-10-27T13:00:00Z",
    video: { object_name: "video.mov", generation: "123" }, manifest: { object_name: "manifest.json", generation: "124" } };
  const sourceKey = browserPendingDecisionKey(pending), context = "a".repeat(64), jobId = advisoryJobId(requestId, sourceKey, context);
  const runId = `site-assessment-${jobId.slice(9)}`;
  const record: any = { website_scene_sponsorship: { assessment_preparation_proposal: {
    request_id: requestId, capture_id: captureId, job_id: jobId, run_id: runId, source_key: sourceKey, context_digest: context } },
    capture_privacy_source_bound_decision: { capture_id: captureId, producer_source: { kind: "browser_pending", key: sourceKey },
      outcome: "not_reviewed", detail: "private content must never leave" } };
  const budget = new SiteAssessmentBudget();
  const openai = { input_tokens: 1000, output_tokens: 100, total_tokens: 1100 };
  const gemini = { promptTokenCount: 2000, candidatesTokenCount: 50, thoughtsTokenCount: 10, totalTokenCount: 2060 };
  budget.authorize("openai", "gpt-6.1-sol"); budget.record("openai", "gpt-6.1-sol", { usage: openai });
  budget.authorize("gemini", "gemini-3.8-flash"); budget.record("gemini", "gemini-3.8-flash", { usage: gemini });
  const artifacts = budget.artifacts();
  const calls: any[] = artifacts.provider_responses.map((response, index) => ({ id: index ? secondToken : firstToken, value: {
    schema_version: "capture_inference_call.v1", admission_token: index ? secondToken : firstToken,
    request_id: requestId, capture_id: captureId, run_id: runId, provider: response.provider, model: response.model,
    source_digest: digest({ kind: "browser_pending", key: sourceKey }), context_digest: context,
    state: "recorded", cost_estimate_usd: response.cost_usd, raw_usage: response.usage,
    recorded_at_ms: response.priced_at_ms, reserved_usd: response.reserved_usd,
  } }));
  const rows = new Map<string, any>([
    [`captureCoverageReviews/${budgetId}`, { capture_id: captureId, calls: 2, exposure_usd: 999, cap_usd: 10 }],
    [`captureUploadSessions/${captureId}`, { browser_pending_delivery: pending }],
    [`siteAssessmentJobs/${jobId}`, { schema_version: "site_assessment_job.v1", request_id: requestId, capture_id: captureId,
      source_key: sourceKey, context_digest: context, run_id: runId }],
    [`agentRuns/${runId}`, { task_kind: "site_assessment", status: "completed", provider: "openai", model: "gpt-6.1-sol",
      metadata: { capture_id: captureId }, artifacts: { ...artifacts,
        source_admission: { request_id: requestId, capture_id: captureId, advisory_job_id: jobId, source_key: sourceKey,
          context_digest: context, video_sha256: "5".repeat(64) },
        capture_inference_reservations: [{ admission_token: firstToken }, { admission_token: secondToken }] } }],
  ]);
  const reader = { document: vi.fn(async (collection: string, id: string) => structuredClone(rows.get(`${collection}/${id}`) ?? null)),
    calls: vi.fn(async (_budget: string, limit: number) => structuredClone(calls.slice(0, limit))) };
  const read = () => websiteCaptureInferenceAccounting({ requestId, captureId, sourceVideoDigest: sha("5"), record, reader });
  return { rows, calls, reader, read, record, runId, jobId, sourceKey };
}

beforeEach(() => vi.clearAllMocks());

describe("fixed-capture retained inference accounting", () => {
  it("reprices retained usage once and identifies overlapping run aggregates by exact call IDs", async () => {
    const f = fixture(), value = await f.read();
    expect(value).toMatchObject({ ledger_status: "complete", known_usage_cost_usd: .005225,
      bounded_unknown_cost_usd: 0, unbounded_unknown_call_count: 0,
      linked_assessment: { status: "verified", known_usage_cost_usd: .005225, ledger_overlap: "matched_call_ids" },
      privacy: { status: "source_bound_not_reviewed", historical_cost_status: "unknown" }, preparation_ledger_overlap: "not_established" });
    expect(value.calls).toHaveLength(2);
    expect(new Set(value.calls.map(call => call.call_digest)).size).toBe(2);
    expect(value.calls.every(call => call.usage_digest && call.bounded_unknown_cost_usd === null)).toBe(true);
    expect(f.reader.calls).toHaveBeenCalledWith(budgetId, 65);
    expect(JSON.stringify(value)).not.toContain("private content");
    expect(JSON.stringify(value)).not.toContain(firstToken);
    expect(vi.mocked(hydrateAgentEvidence)).toHaveBeenCalledWith(expect.anything(), { collection: "agentRuns", id: f.runId });
    expect(f.reader.document.mock.calls).toEqual([
      ["captureCoverageReviews", budgetId], ["captureUploadSessions", captureId],
      ["siteAssessmentJobs", f.jobId], ["agentRuns", f.runId],
    ]);
  });

  it("keeps missing Sol usage unbounded despite finite caps, exposure and reservation estimates", async () => {
    const f = fixture(); Object.assign(f.calls[0].value, { raw_usage: null, cost_estimate_usd: .33192, reserved_usd: .33192 });
    const value = await f.read();
    expect(value).toMatchObject({ ledger_status: "complete", known_usage_cost_usd: .001725,
      bounded_unknown_cost_usd: 0, unbounded_unknown_call_count: 1 });
    expect(value.calls.find(call => call.provider === "openai")).toMatchObject({ recorded_cost_usd: null,
      bounded_unknown_cost_usd: null, usage_digest: null });
    const run = f.rows.get(`agentRuns/${f.runId}`); run.artifacts.usage_samples[0].raw_usage = null;
    expect((await f.read()).linked_assessment.known_usage_cost_usd).toBeNull();
  });

  it("does not count a finite linked aggregate with forged sample pricing or unknown overlap", async () => {
    const f = fixture(), run = f.rows.get(`agentRuns/${f.runId}`);
    run.artifacts.usage_samples[0].estimated_total_cost_usd = 9;
    run.artifacts.capture_inference_reservations = [{ admission_token: firstToken }];
    expect((await f.read()).linked_assessment).toMatchObject({ status: "verified", known_usage_cost_usd: null, ledger_overlap: "unknown" });
  });

  it.each(["missing", "wrong_capture", "duplicate", "unreconciled", "too_many"])("retains explicit unknowns for %s journals", async kind => {
    const f = fixture();
    if (kind === "missing") f.rows.delete(`captureCoverageReviews/${budgetId}`);
    if (kind === "wrong_capture") f.calls[0].value.capture_id = "another-capture";
    if (kind === "duplicate") f.calls[1] = structuredClone(f.calls[0]);
    if (kind === "unreconciled") f.rows.get(`captureCoverageReviews/${budgetId}`).historical_usage_status = "unreconciled";
    if (kind === "too_many") { f.rows.get(`captureCoverageReviews/${budgetId}`).calls = 65;
      while (f.calls.length < 65) { const next = structuredClone(f.calls[0]);
        next.id = `${f.calls.length.toString(16).padStart(8, "0")}-1111-4111-8111-111111111111`;
        next.value.admission_token = next.id; f.calls.push(next); } }
    const value = await f.read();
    expect(value.ledger_status).toBe(kind === "missing" ? "missing" : ["wrong_capture", "duplicate"].includes(kind) ? "invalid" : "incomplete");
    expect(value.unbounded_unknown_call_count).toBeGreaterThan(0);
    expect(value.calls.length).toBeLessThanOrEqual(64);
  });

  it("does not hydrate a cross-capture, oversized or source-mismatched linked run", async () => {
    const f = fixture(), job = f.rows.get(`siteAssessmentJobs/${f.jobId}`), run = f.rows.get(`agentRuns/${f.runId}`);
    job.capture_id = "another-capture";
    expect((await f.read()).linked_assessment.status).toBe("mismatch");
    expect(hydrateAgentEvidence).not.toHaveBeenCalled();
    job.capture_id = captureId; run.agent_evidence_ref = { bytes: 2_097_153 };
    expect((await f.read()).linked_assessment.status).toBe("mismatch");
    expect(hydrateAgentEvidence).not.toHaveBeenCalled();
    delete run.agent_evidence_ref; run.artifacts.source_admission.video_sha256 = "6".repeat(64);
    expect((await f.read()).linked_assessment).toMatchObject({ status: "mismatch", known_usage_cost_usd: null });
    f.record.capture_privacy_source_bound_decision.capture_id = "another-capture";
    expect((await f.read()).privacy.status).toBe("unknown");
  });

  it("leaves failed reads and offloaded accounting failures unknown", async () => {
    const f = fixture(); f.reader.calls.mockRejectedValueOnce(new Error("unavailable"));
    vi.mocked(hydrateAgentEvidence).mockRejectedValueOnce(new Error("bound evidence unavailable"));
    const value = await f.read();
    expect(value).toMatchObject({ ledger_status: "unavailable", unbounded_unknown_call_count: 1,
      known_usage_cost_usd: 0, linked_assessment: { status: "unavailable", known_usage_cost_usd: null } });
  });
});
