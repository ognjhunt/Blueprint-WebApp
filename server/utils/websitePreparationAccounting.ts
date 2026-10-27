/** Bounded accounting facts for the signed, non-authorizing configuration read. */
import { z } from "zod";
import { crossRuntimeDigest as digest } from "./crossRuntimeCanonical";

const sha = z.string().regex(/^sha256:[a-f0-9]{64}$/);
const admission = z.object({
  allocation_binding_digest: sha, task_context_digest: sha,
  provider: z.enum(["meta", "google", "openai", "world_labs", "world_labs_atlas", "vast"]),
  maximum_cost_usd: z.number().finite().positive().max(1000),
  request_count: z.number().int().min(1).max(32),
  source_video_digest: sha.optional(), atlas_authorization_digest: sha.optional(),
});
const settlement = z.object({ actual_cost_usd: z.number().finite().nonnegative().max(1000) });
const micros = (cost: number) => Math.ceil(cost * 1_000_000);

export function websitePreparationAccounting(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("website_atlas_reservation_accounting_invalid");
  const entries = Object.entries(value);
  // Refuse rather than silently omit held rows or exceed the signed transport's bound.
  if (entries.length > 128) throw new Error("website_atlas_reservation_summary_too_large");
  const rows = entries.sort(([a], [b]) => a.localeCompare(b)).map(([key, raw]) => {
    const parsed = admission.safeParse(raw?.admission);
    const settled = raw?.settlement === undefined ? null : settlement.safeParse(raw.settlement);
    if (!parsed.success || parsed.data.allocation_binding_digest !== `sha256:${key}`
      || settled && (!settled.success || settled.data.actual_cost_usd > parsed.data.maximum_cost_usd))
      throw new Error("website_atlas_reservation_accounting_invalid");
    const row = parsed.data;
    const settledCost = settled?.success ? settled.data.actual_cost_usd : null;
    return {
      allocation_binding_digest: row.allocation_binding_digest, provider: row.provider,
      maximum_cost_usd: row.maximum_cost_usd, settled_cost_usd: settledCost,
      accounted_cost_usd: micros(settledCost ?? row.maximum_cost_usd) / 1_000_000,
      request_count: row.request_count, status: settledCost === null ? "held" as const : "settled" as const,
      task_context_digest: row.task_context_digest, source_video_digest: row.source_video_digest ?? null,
      atlas_authorization_digest: row.atlas_authorization_digest ?? null,
      settlement_digest: settledCost === null ? null : digest(raw.settlement),
    };
  });
  const summarize = (atlas: boolean) => {
    // Match the admission ledger exactly: historical Atlas grants remain encumbered.
    const reservations = rows.filter(row => (row.provider === "world_labs_atlas"
      || row.atlas_authorization_digest !== null) === atlas);
    const settledMicros = reservations.reduce((sum, row) => sum + micros(row.settled_cost_usd ?? 0), 0);
    const heldMicros = reservations.reduce((sum, row) => sum + (row.status === "held" ? micros(row.maximum_cost_usd) : 0), 0);
    return {
      schema_version: atlas ? "website_atlas_allowance_accounting.v1" : "website_native_preparation_accounting.v1",
      source_scope: atlas ? "request_atlas_allowance" : "request_native_preparation_ledger",
      settled_cost_usd: settledMicros / 1_000_000, held_cost_usd: heldMicros / 1_000_000,
      reserved_or_settled_cost_usd: (settledMicros + heldMicros) / 1_000_000,
      request_count: reservations.reduce((sum, row) => sum + row.request_count, 0), reservations,
      // A settlement is a retained ledger debit, not independently verified billing.
      external_capture_assessment_costs: "not_in_preparation_ledger",
    };
  };
  return { allowance_accounting: summarize(true), native_preparation_accounting: summarize(false) };
}
