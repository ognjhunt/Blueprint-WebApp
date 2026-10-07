// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { bindBrowserAssessmentSource, SiteAssessmentBudget } from "../agents/adapters/site-assessment";
import { browserPendingDecisionKey, type BrowserPending } from "../utils/websiteBrowserPending";
import { RECORDING_CONSENT_VERSION } from "../utils/recordingConsent";
import { extractAgentCostTelemetry } from "../utils/agentCostTelemetry";

afterEach(() => vi.unstubAllEnvs());
const pending: BrowserPending = {
  schema_version: "website_browser_pending.v1", request_id: "one", scene_id: "site-one", capture_id: "walkthrough-one",
  state: "published", completed_at_iso: "2026-10-07T00:00:00Z",
  video: { object_name: "scenes/site-one/captures/walkthrough-one/raw/walkthrough.mp4", generation: "1", size_bytes: 32, crc32c: "AAAAAA==" },
  manifest: { object_name: "scenes/site-one/captures/walkthrough-one/raw/manifest.json", generation: "2", size_bytes: 1024,
    crc32c: "AAAAAA==", sha256: `sha256:${"a".repeat(64)}` },
};
const manifest = { request_id: "one", scene_id: "site-one", capture_id: "walkthrough-one", video_uri: pending.video.object_name,
  duration_seconds: 30.1, capture_rights: { derived_scene_generation_allowed: true, consent_status: "granted", consent_revoked: false } };
const record = () => ({ request: { consent_attestation: { granted: true, statement_version: RECORDING_CONSENT_VERSION,
  recorded_at_iso: "2026-10-01T00:00:00Z" } }, capture_privacy_source_bound_decision: { proceeded: true,
  eligibility: "unscreened", capture_id: "walkthrough-one", producer_source: { kind: "browser_pending", key: browserPendingDecisionKey(pending) } } });
const telemetry = (budget: SiteAssessmentBudget) => extractAgentCostTelemetry({ id: "one", task_kind: "site_assessment",
  provider: "openai_responses", model: "gpt-6.1-sol", artifacts: budget.artifacts() });

describe("site assessment integration boundaries", () => {
  it("admits only the current published browser source with both original and current rights", () => {
    expect(bindBrowserAssessmentSource("one", record(), pending, manifest).duration_seconds).toBe(30.1);
    expect(() => bindBrowserAssessmentSource("two", record(), pending, manifest)).toThrow("source_not_admitted");
    expect(() => bindBrowserAssessmentSource("one", { ...record(), future_processing_allowed: false }, pending, manifest)).toThrow("source_not_admitted");
    expect(() => bindBrowserAssessmentSource("one", record(), { ...pending, state: "held" }, manifest)).toThrow("source_not_admitted");
    expect(() => bindBrowserAssessmentSource("one", record(), pending, { ...manifest, capture_rights: null })).toThrow("source_not_admitted");
    expect(() => bindBrowserAssessmentSource("one", record(), { ...pending, video: { ...pending.video, generation: "3" } }, manifest)).toThrow("source_not_admitted");
  });
  it("accounts known Sol/Flash usage and retains mixed pending reservations in existing telemetry", () => {
    const budget = new SiteAssessmentBudget();
    budget.authorize("openai", "gpt-6.1-sol", {});
    budget.record("openai", "gpt-6.1-sol", { usage: { input_tokens: 1000, output_tokens: 100 } });
    expect(telemetry(budget).conservative_spend_usd).toBeCloseTo(0.003);
    budget.authorize("openai", "gpt-6.1-sol", {});
    budget.record("openai", "gpt-6.1-sol", { output: [], usage: null });
    budget.authorize("gemini", "gemini-3.8-flash");
    budget.record("gemini", "gemini-3.8-flash", { text: "Incomplete", usage: null });
    const row = telemetry(budget);
    expect(row.spend_accounting_status).toBe("reserved_unknown");
    expect(row.spend_reservation?.unknown_calls).toBe(2);
    expect(row.conservative_spend_usd).toBeCloseTo(0.003 + budget.calls[1].reserved_usd + budget.calls[2].reserved_usd);
    expect(budget.artifacts().provider_responses[2].response).toEqual({ text: "Incomplete", usage: null });
  });
  it("stops ambiguous requests, unpriced models and cap overruns before provider calls", () => {
    vi.stubEnv("BLUEPRINT_OPENAI_AGENT_MAX_INFERENCE_COST_USD", "0.4");
    const budget = new SiteAssessmentBudget();
    expect(() => budget.authorize("gemini", "gemini-3-pro")).toThrow("model_not_admitted");
    expect(() => budget.authorize("gemini", "gemini-3.8-flash")).toThrow("inference_cost_cap");
    budget.authorize("openai", "gpt-6.1-sol", {});
    expect(() => budget.authorize("openai", "gpt-6.1-sol", {})).toThrow("cost_unresolved");
    expect(budget.calls).toHaveLength(1);
    expect(telemetry(budget).conservative_spend_usd).toBeCloseTo(budget.calls[0].reserved_usd);
  });
});
