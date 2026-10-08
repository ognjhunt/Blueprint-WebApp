// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState } from "./helpers/fake-firestore";
vi.mock("../../client/src/lib/firebaseAdmin", async () => ({ dbAdmin: (await import("./helpers/fake-firestore")).sharedFakeFirestore, storageAdmin: null }));
import { reserveCaptureCoverageInference } from "../utils/captureCoverageInferenceBudget";
import { humanDecisionDigest } from "../utils/human-reply-admission";
import { RECORDING_CONSENT_VERSION } from "../utils/recordingConsent";
import { SITE_ASSESSMENT_MODEL } from "../agents/provider-config";

const source = { kind: "browser_pending", key: "source-one" }, brief = { summary: "Move racks" };
const metadata = { capture_id: "walkthrough-one", review_id: "a".repeat(64), coverage_claim_token: "owned-claim" };
const path = `captureCoverageReviews/${metadata.review_id}`;
const usage = { promptTokenCount: 100, candidatesTokenCount: 10, thoughtsTokenCount: 0 };
function seed() {
  sharedFakeFirestoreState.docs.set(path, { state: "running", attempts: 1, claim_token: "owned-claim", captureId: metadata.capture_id,
    requestId: "one", binding: { source, brief_digest: humanDecisionDigest(brief) } });
  sharedFakeFirestoreState.docs.set("siteTaskBriefs/one", brief);
  sharedFakeFirestoreState.docs.set("inboundRequests/one", { request: { consent_attestation: { granted: true,
    statement_version: RECORDING_CONSENT_VERSION, recorded_at_iso: "2026-10-01T00:00:00Z" } },
    capture_privacy_source_bound_decision: { proceeded: true, capture_id: metadata.capture_id, producer_source: source } });
}
beforeEach(() => { sharedFakeFirestoreState.docs.clear(); vi.stubEnv("BLUEPRINT_OPENAI_AGENT_MAX_INFERENCE_COST_USD", "5"); seed(); });
describe("normal coverage durable inference allowance", () => {
  const assessmentMetadata = { capture_id: metadata.capture_id, assessment_run_id: "assessment-one",
    assessment_request_id: "one", assessment_source: source };
  function seedAssessment(id = "assessment-one") {
    sharedFakeFirestoreState.docs.set(`agentRuns/${id}`, { task_kind: "site_assessment", status: "running",
      input: { input: { context: { request_id: "one" } } } });
  }
  it("shares one cap between coverage and SDK calls, including a new SDK run", async () => {
    const coverage = await reserveCaptureCoverageInference("gemini-3.8-flash", metadata);
    await coverage.record(usage);
    seedAssessment();
    const sol = await reserveCaptureCoverageInference(SITE_ASSESSMENT_MODEL, assessmentMetadata, "openai", {});
    expect(sol.receipt.capture_exposure_usd).toBeCloseTo(1.818624 + 0.33192);
    await sol.record({ input_tokens: 100, output_tokens: 10 });
    const probe = await reserveCaptureCoverageInference("gemini-3.8-flash", assessmentMetadata);
    await probe.record(usage);
    seedAssessment("assessment-two");
    await expect(reserveCaptureCoverageInference("gemini-3.8-flash",
      { ...assessmentMetadata, assessment_run_id: "assessment-two" })).rejects.toThrow("inference_cost_cap");
  });
  it("holds uncertain SDK exposure against coverage and rejects inactive SDK runs", async () => {
    seedAssessment();
    sharedFakeFirestoreState.docs.set(path, { ...sharedFakeFirestoreState.docs.get(path), attempts: 0 });
    const sol = await reserveCaptureCoverageInference(SITE_ASSESSMENT_MODEL, assessmentMetadata, "openai", {});
    await sol.record(undefined);
    await expect(reserveCaptureCoverageInference("gemini-3.8-flash", metadata)).rejects.toThrow("cost_unresolved");
    sharedFakeFirestoreState.docs.set("agentRuns/assessment-one", { task_kind: "site_assessment", status: "completed" });
    await expect(reserveCaptureCoverageInference(SITE_ASSESSMENT_MODEL, assessmentMetadata, "openai", {})).rejects.toThrow("claim_changed");
  });
  it("fails closed on historical SDK exposure before admitting first coverage", async () => {
    seedAssessment();
    await expect(reserveCaptureCoverageInference("gemini-3.8-flash", metadata)).rejects.toThrow("historical_exposure_unresolved");
  });
  it("does not treat offloaded historical SDK input as absent exposure", async () => {
    sharedFakeFirestoreState.docs.set("agentRuns/offloaded", { task_kind: "site_assessment", status: "completed",
      input: null, agent_evidence_ref: { version: 1 } });
    await expect(reserveCaptureCoverageInference("gemini-3.8-flash", metadata)).rejects.toThrow("agent_evidence_reference_invalid");
  });
  it("shares reservations across corrections, retries, and changed briefs", async () => {
    const first = await reserveCaptureCoverageInference("gemini-3.8-flash", metadata);
    await first.record(usage);
    const changed = { summary: "Changed brief" };
    sharedFakeFirestoreState.docs.set("siteTaskBriefs/one", changed);
    sharedFakeFirestoreState.docs.set(path, { ...sharedFakeFirestoreState.docs.get(path), binding: { source, brief_digest: humanDecisionDigest(changed) } });
    const second = await reserveCaptureCoverageInference("gemini-3.8-flash", metadata);
    expect(second.receipt.capture_exposure_usd).toBeCloseTo(2 * 1.818624);
    await second.record(usage);
    await expect(reserveCaptureCoverageInference("gemini-3.8-flash", metadata)).rejects.toThrow("inference_cost_cap");
  });
  it("does not reset uncertain exposure after restart", async () => {
    const first = await reserveCaptureCoverageInference("gemini-3.8-flash", metadata);
    await first.record(undefined);
    await expect(reserveCaptureCoverageInference("gemini-3.8-flash", metadata)).rejects.toThrow("cost_unresolved");
  });
  it("rejects stale claims and changed consent before reservation", async () => {
    await expect(reserveCaptureCoverageInference("gemini-3.8-flash", { ...metadata, coverage_claim_token: "other" })).rejects.toThrow("claim_changed");
    sharedFakeFirestoreState.docs.set("inboundRequests/one", {});
    await expect(reserveCaptureCoverageInference("gemini-3.8-flash", metadata)).rejects.toThrow("source_changed");
    expect([...sharedFakeFirestoreState.docs.keys()].filter(key => key.includes("/budget-"))).toHaveLength(0);
  });
  it("fails closed on historical pre-budget attempts", async () => {
    sharedFakeFirestoreState.docs.set(path, { ...sharedFakeFirestoreState.docs.get(path), attempts: 2 });
    await expect(reserveCaptureCoverageInference("gemini-3.8-flash", metadata)).rejects.toThrow("historical_exposure_unresolved");
  });
  it("fails closed on a paid run from before the durable queue", async () => {
    sharedFakeFirestoreState.docs.set("agentRuns/legacy", { task_kind: "capture_coverage", status: "completed",
      metadata: { capture_id: metadata.capture_id }, artifacts: { usage: { prompt_tokens: 100 } } });
    await expect(reserveCaptureCoverageInference("gemini-3.8-flash", metadata)).rejects.toThrow("historical_exposure_unresolved");
  });
  it("requires the durable review claim instead of an untracked direct call", async () => {
    await expect(reserveCaptureCoverageInference("gemini-3.8-flash", {})).rejects.toThrow("claim_required");
  });
});
