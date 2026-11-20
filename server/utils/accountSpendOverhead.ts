/**
 * The WebApp's own paid agent runs as named overhead (owner decision 2026-11-20).
 *
 * The first look, brief reading and the WebApp's other agent runs stay outside every job's $40 cap (they are never
 * a row on a job's ledger, `websiteJobSpend`). Each one is recorded here instead, one document per run in
 * `accountSpendOverhead`, keyed by its UTC month, so the account's monthly count is complete: the Pipeline's
 * capacity tick reads the month (`POST /api/internal/pipeline/account-spend-overhead`) and its meter keys it as
 * `overhead:<name>`, beside the jobs, in the reconciliation of each provider's bill.
 *
 * A run's cost is the one the runtime already computed for it (`metadata.cost_telemetry`): its priced usage, else
 * its conservative reservation. A run with neither is counted as a run with no recorded cost, never as zero.
 * Recording never fails or delays a run. No price is stated to anyone; these are Blueprint's own costs.
 */
import type { AgentCostTelemetryRecord } from "./agentCostTelemetry";
import { logger } from "../logger";

export const ACCOUNT_SPEND_OVERHEAD_COLLECTION = "accountSpendOverhead";
export const ACCOUNT_SPEND_OVERHEAD_ROW_SCHEMA = "blueprint.account_spend_overhead_row.v1";
export const ACCOUNT_SPEND_OVERHEAD_SCHEMA = "blueprint.account_spend_overhead.v1";
/** One month's read stays bounded; past it the answer says it is incomplete rather than under-count silently. */
export const ACCOUNT_SPEND_OVERHEAD_MAX_ROWS = 5000;

const MONTH = /^[0-9]{4}-(0[1-9]|1[0-2])$/;
const NAME = /^[a-z][a-z0-9_.-]{0,79}$/;

/** The bill a run's provider lands on. Local harnesses (`codex_local`, `openclaw`, `acp_harness`) bill nothing here. */
export function overheadProvider(provider: unknown): string | null {
  const value = typeof provider === "string" ? provider.trim().toLowerCase() : "";
  if (value.startsWith("openai")) return "openai";
  if (value.startsWith("gemini") || value.startsWith("google")) return "gemini";
  if (value.startsWith("anthropic")) return "anthropic";
  if (value.startsWith("deepseek")) return "deepseek";
  return null;
}

export function overheadName(taskKind: unknown): string | null {
  const name = `webapp.${typeof taskKind === "string" ? taskKind.trim().toLowerCase() : ""}`;
  return NAME.test(name) && name !== "webapp." ? name : null;
}

export function utcMonth(epochMs: number): string {
  return new Date(epochMs).toISOString().slice(0, 7);
}

type Telemetry = Pick<AgentCostTelemetryRecord, "cost_estimate_usd" | "conservative_spend_usd" | "spend_accounting_status">;

/** The overhead row for one finished run, or null when its provider bills nothing or its kind cannot be named. */
export function agentRunOverheadRow(input: { runId: string; taskKind: unknown; provider: unknown; model: unknown;
  telemetry: Telemetry | null | undefined; nowMs: number; requestId?: unknown }) {
  const provider = overheadProvider(input.provider), name = overheadName(input.taskKind);
  if (!provider || !name || !input.runId) return null;
  const figure = input.telemetry?.cost_estimate_usd ?? input.telemetry?.conservative_spend_usd ?? null;
  const cost = typeof figure === "number" && Number.isFinite(figure) && figure >= 0 ? figure : null;
  return {
    schema_version: ACCOUNT_SPEND_OVERHEAD_ROW_SCHEMA, month: utcMonth(input.nowMs), name, provider,
    model: typeof input.model === "string" ? input.model : null, run_id: input.runId,
    task_kind: String(input.taskKind), cost_usd: cost,
    cost_status: input.telemetry?.spend_accounting_status ?? "unresolved",
    // Which job the run read, where it read one: never a charge to that job.
    request_id: typeof input.requestId === "string" ? input.requestId : null,
    recorded_at_ms: input.nowMs,
  };
}

type Store = { collection(name: string): any };

/** Records one finished run's overhead. Best effort: a failure is logged and the run carries on. */
export async function recordAgentRunOverhead(store: Store | null | undefined,
  input: Parameters<typeof agentRunOverheadRow>[0]): Promise<void> {
  try {
    const row = agentRunOverheadRow(input);
    if (!store || !row) return;
    await store.collection(ACCOUNT_SPEND_OVERHEAD_COLLECTION).doc(row.run_id).set(row);
  } catch (error) {
    logger.warn({ err: error, runId: input.runId }, "Agent run overhead was not recorded; the account month reads it as missing");
  }
}

/** The month per run kind and provider: what the runs with a recorded cost cost, and how many had none. */
export async function accountSpendOverheadMonth(store: Store, month: string, nowMs = Date.now()) {
  if (!MONTH.test(month)) throw new Error("account_spend_overhead_month_invalid");
  const snapshot = await store.collection(ACCOUNT_SPEND_OVERHEAD_COLLECTION).where("month", "==", month)
    .limit(ACCOUNT_SPEND_OVERHEAD_MAX_ROWS + 1).get();
  const docs = snapshot.docs.slice(0, ACCOUNT_SPEND_OVERHEAD_MAX_ROWS);
  const groups = new Map<string, { name: string; provider: string; micros: number; runs: number; unpriced_runs: number }>();
  let unreadable = 0;
  for (const doc of docs) {
    const row = doc.data() ?? {};
    if (row.schema_version !== ACCOUNT_SPEND_OVERHEAD_ROW_SCHEMA || row.month !== month || !NAME.test(row.name)
      || !NAME.test(row.provider)) { unreadable += 1; continue; }
    const key = `${row.name}\u001f${row.provider}`;
    const group = groups.get(key) ?? { name: row.name, provider: row.provider, micros: 0, runs: 0, unpriced_runs: 0 };
    group.runs += 1;
    if (typeof row.cost_usd === "number" && Number.isFinite(row.cost_usd) && row.cost_usd >= 0)
      group.micros += Math.ceil(row.cost_usd * 1_000_000);
    else group.unpriced_runs += 1;
    groups.set(key, group);
  }
  const rows = [...groups.values()].sort((a, b) => a.name.localeCompare(b.name) || a.provider.localeCompare(b.provider))
    .map(({ micros, ...group }) => ({ ...group, usd: micros / 1_000_000 }));
  return { schema_version: ACCOUNT_SPEND_OVERHEAD_SCHEMA, month, generated_at: new Date(nowMs).toISOString(), rows,
    // Every document of the month was read and understood.
    complete: snapshot.docs.length <= ACCOUNT_SPEND_OVERHEAD_MAX_ROWS && unreadable === 0,
    unreadable_rows: unreadable };
}
