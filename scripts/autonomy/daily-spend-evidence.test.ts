// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { collectOpenAiCosts } from "./collect-spend-snapshot.js";
import { openAiDailyEvidence, verifiedOpenAiZero } from "./daily-spend-evidence.js";

const start = 1790812800;
const payload = (amount: unknown = "2.5", currency: unknown = "usd") => ({
  data: [{ start_time: start, end_time: start + 86400, results: [{ amount: { value: amount, currency }, project_id: "proj_test", line_item: "model" }] }],
  has_more: false, next_page: null,
});
const window = { start_unix: start, end_unix: start + 3600 };
const project = (body: unknown) => openAiDailyEvidence(body, "2026-10-01T12:00:00Z", undefined, window);
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("already received OpenAI daily cost evidence", () => {
  it("preserves the received UTC interval, dimensions, signed amounts and collection time", () => {
    const result = project(payload(-0.5));
    expect(result.amount_usd_current_period).toBe(-0.5);
    expect(result.rows[0]).toMatchObject({ start_time: start, end_time: start + 86400, amount: -0.5, currency: "USD", project_id: "proj_test", line_item: "model", reporting_day: null, source_timezone: "UTC", provider_freshness: "unknown" });
  });
  it.each([[null, "usd"], [true, "usd"], ["NaN", "usd"], ["", "usd"], [5, null], [5, "eur"], [5, ""]])("keeps invalid amount/currency unknown (%s %s)", (amount, currency) => {
    const result = project(payload(amount, currency));
    expect(result.amount_usd_current_period).toBeNull();
    expect(result.observed_usd_subtotal).toBeNull();
    expect(result.rows[0].billed_cost).toBeNull();
    expect(result.rows[0].partial).toBe(true);
  });
  it("keeps incomplete and unknown pagination partial without fetching more pages", () => {
    const result = project({ ...payload(), has_more: true, next_page: "opaque-token" });
    expect(result.amount_usd_current_period).toBeNull();
    expect(result.coverage.pages_received).toBe(1);
    expect(JSON.stringify(result)).not.toContain("opaque-token");
    expect(result.coverage.partial).toBe(true);
  });
  it("deduplicates exact rows and nulls conflicting amounts/billed costs", () => {
    const body = payload();
    body.data[0].results.push(body.data[0].results[0]);
    expect(project(body).amount_usd_current_period).toBe(2.5);
    body.data[0].results.push({ ...body.data[0].results[0], amount: { value: "3", currency: "usd" } });
    const result = project(body);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ amount: null, billed_cost: null, partial: true });
    expect(result.amount_usd_current_period).toBeNull();
  });
  it("changes revision but preserves key on credits/corrections", () => {
    const first = project(payload());
    const second = project(payload("-1"));
    expect(first.rows[0].source_key).toBe(second.rows[0].source_key);
    expect(first.rows[0].revision_id).not.toBe(second.rows[0].revision_id);
  });
  it("never treats offsetting credits as proof of no positive API spend", () => {
    const body = payload("5");
    body.data[0].results.push({ amount: { value: "-5", currency: "usd" }, project_id: "proj_test", line_item: "credit" });
    const evidence = project(body);
    expect(evidence.amount_usd_current_period).toBe(0);
    expect(evidence.gross_positive_usd).toBe(5);
    expect(evidence.credit_adjustments_usd).toBe(-5);
    expect(verifiedOpenAiZero({ status: "live_billing_verified", amount_usd_current_period: 0, summary: { daily_evidence: evidence } })).toBe(false);
    expect(verifiedOpenAiZero({ status: "live_billing_verified", amount_usd_current_period: 0 })).toBe(false);
    expect(verifiedOpenAiZero({ status: "live_billing_verified", amount_usd_current_period: 0, summary: { daily_evidence: project(payload(0)) } })).toBe(true);
  });
  it("does not claim the period when buckets have gaps or no requested window", () => {
    expect(openAiDailyEvidence(payload(), "2026-10-01").amount_usd_current_period).toBeNull();
    const body = payload();
    body.data[0].start_time += 3600;
    expect(project(body).coverage.gaps).toContain("requested_window_coverage_unknown");
  });
  it("retains exactly the old single request scope, limit and query; hashes received bytes", async () => {
    const body = JSON.stringify(payload());
    const fetch = vi.fn().mockResolvedValue(new Response(body, { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    vi.stubEnv("OPENAI_ADMIN_KEY", "sk-admin-test-secret");
    const result = await collectOpenAiCosts({ id: "openai", label: "OpenAI", provider: "openai", ownerSystem: "openai", budgetLine: "api", adapter: "openai_costs", proofKind: "billing" }, {
      key: "month_to_date", start_iso: "2026-10-01T00:00:00Z", end_iso: "2026-10-01T01:00:00Z", ...window,
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    const url = new URL(fetch.mock.calls[0][0]);
    expect(Object.fromEntries(url.searchParams)).toEqual({ start_time: String(start), end_time: String(start + 86400), bucket_width: "1d", limit: "31" });
    expect(result.amount_usd_current_period).toBe(2.5);
    const evidence = result.summary?.daily_evidence as ReturnType<typeof project>;
    expect(evidence.rows[0].response_digest).toBe(`sha256:${createHash("sha256").update(body).digest("hex")}`);
    expect(JSON.stringify(result)).not.toContain("sk-admin-test-secret");
  });
  it("redacts arbitrary or credential-shaped response identity fields", () => {
    const body = payload();
    body.data[0].results[0].project_id = "sk-admin-sensitive-secret";
    (body as any).authorization = "Bearer secret";
    expect(JSON.stringify(project(body))).not.toContain("sensitive-secret");
    expect(JSON.stringify(project(body))).not.toContain("Bearer secret");
  });
});
