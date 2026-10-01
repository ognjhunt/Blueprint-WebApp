import { createHash } from "node:crypto";

const digest = (value: unknown) => `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const money = (value: unknown) => (typeof value === "number" || (typeof value === "string" && value.trim() !== "")) && Number.isFinite(Number(value)) ? Number(value) : null;
// Only identity fields from received costs are retained; arbitrary response metadata is never published.
const identity = (value: unknown) => typeof value === "string" && /^[a-zA-Z0-9 _.:/-]{1,160}$/.test(value)
  && !/(?:sk-|token|bearer|secret|password|@)/i.test(value) ? value : null;

/** Pure offline projection. UTC cost buckets cannot establish Chicago usage days. */
export function openAiDailyEvidence(payload: unknown, collectedAt: string, responseDigest?: string, requestedWindow?: { start_unix: number; end_unix: number }) {
  const body = record(payload);
  const rows: Array<Record<string, unknown>> = [];
  const seen = new Map<string, Record<string, unknown>>();
  const gaps = new Set<string>();
  if (!Array.isArray(body.data)) gaps.add("cost_buckets_missing");
  if (body.has_more !== false) gaps.add("pagination_incomplete_or_unknown");
  if (body.has_more === false && body.next_page != null) gaps.add("pagination_conflicting");
  const intervals: Array<[number, number]> = [];
  for (const bucketValue of Array.isArray(body.data) ? body.data : []) {
    const bucket = record(bucketValue);
    const start = typeof bucket.start_time === "number" && Number.isSafeInteger(bucket.start_time) && bucket.start_time >= 0 ? bucket.start_time : null;
    const end = typeof bucket.end_time === "number" && Number.isSafeInteger(bucket.end_time) && bucket.end_time >= 0 ? bucket.end_time : null;
    const intervalValid = start !== null && end !== null && end > start;
    if (intervalValid) intervals.push([start, end]);
    if (!intervalValid) gaps.add("bucket_interval_invalid");
    if (!Array.isArray(bucket.results)) gaps.add("bucket_results_missing");
    for (const resultValue of Array.isArray(bucket.results) ? bucket.results : []) {
      const result = record(resultValue);
      const amount = record(result.amount);
      const value = money(amount.value);
      const currency = typeof amount.currency === "string" && /^[A-Za-z]{3}$/.test(amount.currency) ? amount.currency.toUpperCase() : null;
      if (value === null || currency !== "USD") gaps.add("amount_or_usd_currency_unknown");
      const project = identity(result.project_id);
      const lineItem = identity(result.line_item);
      if ((result.project_id != null && project === null) || (result.line_item != null && lineItem === null)) gaps.add("identity_redacted_or_invalid");
      const key = digest(["openai", start, end, project ?? digest(result.project_id ?? null), lineItem ?? digest(result.line_item ?? null)]);
      const revision = digest([key, value, currency]);
      const prior = seen.get(key);
      if (prior) {
        if (prior.revision_id !== revision) { gaps.add("conflicting_bucket_rows"); prior.amount = null; prior.billed_cost = null; prior.partial = true; }
        continue;
      }
      const row = {
        source_key: key, revision_id: revision, provider: "openai", account: null, project,
        service: lineItem, project_id: project, line_item: lineItem, kind: "actual",
        amount: value, currency, start_time: start, end_time: end, source_timezone: "UTC",
        reporting_timezone: "America/Chicago", reporting_day: null,
        allocation_gap: "UTC_bucket_cannot_be_exactly_allocated_to_Chicago_days",
        source_observed_at: null, collected_at: collectedAt, provider_freshness: "unknown",
        response_digest: responseDigest ?? digest(payload), digest_basis: responseDigest ? "received_bytes" : "parsed_json",
        billed_cost: value !== null && currency === "USD" && intervalValid ? value : null,
        partial: !intervalValid || value === null || currency !== "USD",
      };
      rows.push(row);
      seen.set(key, row);
    }
  }
  intervals.sort((a, b) => a[0] - b[0]);
  if (!requestedWindow || intervals.length === 0 || intervals[0][0] !== requestedWindow.start_unix
    || intervals.at(-1)![1] < requestedWindow.end_unix
    || intervals.some((interval, index) => index > 0 && interval[0] !== intervals[index - 1][1])) gaps.add("requested_window_coverage_unknown");
  const complete = gaps.size === 0;
  const subtotal = rows.some((row) => row.partial) ? null : rows.reduce((sum, row) => sum + Number(row.amount), 0);
  const grossPositiveUsd = subtotal === null ? null : rows.reduce((sum, row) => sum + Math.max(0, Number(row.amount)), 0);
  const creditAdjustmentsUsd = subtotal === null ? null : rows.reduce((sum, row) => sum + Math.min(0, Number(row.amount)), 0);
  return {
    schema: "blueprint/daily-spend-evidence/v1", collected_at: collectedAt,
    rows, coverage: {
      pages_received: 1, has_more: typeof body.has_more === "boolean" ? body.has_more : null,
      next_page_digest: typeof body.next_page === "string" ? digest(body.next_page) : null,
      provider_daily_coverage: complete ? "received_scope_complete" : "partial",
      chicago_daily_coverage: "unknown", gaps: [...gaps], partial: !complete,
      requested_window: requestedWindow ?? null,
    },
    observed_usd_subtotal: subtotal,
    gross_positive_usd: grossPositiveUsd, credit_adjustments_usd: creditAdjustmentsUsd,
    amount_usd_current_period: complete ? subtotal : null,
  };
}

export function verifiedOpenAiZero(source: { status?: string; amount_usd_current_period?: number | null; summary?: Record<string, unknown> } | undefined) {
  const evidence = record(source?.summary?.daily_evidence);
  return source?.status === "live_billing_verified" && source.amount_usd_current_period === 0
    && record(evidence.coverage).partial === false && evidence.gross_positive_usd === 0;
}
