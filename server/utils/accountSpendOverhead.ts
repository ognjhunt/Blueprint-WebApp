/**
 * The WebApp's own paid agent runs as named overhead (owner decision 2026-11-20).
 *
 * The WebApp's agent runs are not on the Pipeline's job ledgers, so the account's monthly count needs them: the
 * Pipeline's capacity tick reads the month (`POST /api/internal/pipeline/account-spend-overhead`) and its meter keys it
 * as `overhead:<name>`, beside the jobs, in the reconciliation of each provider's bill. Owner decision 2026-11-20
 * (Pipeline `docs/architecture/metered-spend.md`, "Every paid AI call against its job"): every paid AI call counts
 * against its job, except the first look (the robot-fit ranking) and the brief reading, which stay outside the $40 cap
 * as named overhead. So the other runs made for a job (the follow-up picker, the free-text pass) and the video
 * readings are also held against that job's cap on the WebApp's own ledgers (`jobLaneSpend.ts`, the video readings'
 * ledger), while the first look and the brief reading are held against none. A hold is a stop on the job, not a second
 * count: the month still reads each run once, here.
 *
 * The month is read from the runs' own records (`agentRuns`), the one place a run's cost is written: each run's cost
 * is the one the runtime computed and stored with the run (`metadata.cost_telemetry`), its priced usage, else its
 * conservative reservation. A run is in the month by its cost record's start time
 * (`metadata.cost_telemetry.created_at_ms`, a number on every run with a cost record), or by its own `created_at`
 * where that is a timestamp or an ISO string. Most stored runs lost their `created_at` (an empty map, 2026-11-20),
 * so it alone found none of November's 47 priced runs. A finished run with no recorded cost is counted as such,
 * never as zero; a record whose accounting is incomplete makes the month incomplete. No price is stated to anyone;
 * these are Blueprint's own costs.
 */

export const ACCOUNT_SPEND_OVERHEAD_SCHEMA = "blueprint.account_spend_overhead.v1";
/** One month's read stays bounded; past it the answer says it is incomplete rather than under-count silently. */
export const ACCOUNT_SPEND_OVERHEAD_MAX_ROWS = 5000;

const MONTH = /^[0-9]{4}-(0[1-9]|1[0-2])$/;
const NAME = /^[a-z][a-z0-9_.-]{0,79}$/;
/** A run in one of these states has finished: with no cost on its record it counts as unpriced. */
const FINISHED = new Set(["completed", "failed", "cancelled"]);

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

/** The cost the runtime stored with a run: priced usage, else its conservative reservation; null when neither. */
function runCost(run: Record<string, any>): number | null {
  const telemetry = run.metadata?.cost_telemetry;
  const figure = telemetry?.cost_estimate_usd ?? telemetry?.conservative_spend_usd ?? null;
  return typeof figure === "number" && Number.isFinite(figure) && figure >= 0 ? figure : null;
}

type Store = { collection(name: string): any };

/** The month per run kind and provider: what the runs with a recorded cost cost, and how many had none. */
export async function accountSpendOverheadMonth(store: Store, month: string, nowMs = Date.now()) {
  if (!MONTH.test(month)) throw new Error("account_spend_overhead_month_invalid");
  const [year, index] = month.split("-").map(Number);
  const start = new Date(Date.UTC(year, index - 1, 1)), end = new Date(Date.UTC(year, index, 1));
  const runs = store.collection("agentRuns");
  const reads = await Promise.all([
    runs.where("metadata.cost_telemetry.created_at_ms", ">=", start.getTime())
      .where("metadata.cost_telemetry.created_at_ms", "<", end.getTime()),
    runs.where("created_at", ">=", start).where("created_at", "<", end),
    runs.where("created_at", ">=", start.toISOString()).where("created_at", "<", end.toISOString()),
  ].map((query) => query.limit(ACCOUNT_SPEND_OVERHEAD_MAX_ROWS + 1).get()));
  const byId = new Map<string, { id: string; data(): unknown }>();
  for (const snapshot of reads) for (const doc of snapshot.docs) byId.set(doc.id, doc);
  const truncated = reads.some((snapshot) => snapshot.docs.length > ACCOUNT_SPEND_OVERHEAD_MAX_ROWS)
    || byId.size > ACCOUNT_SPEND_OVERHEAD_MAX_ROWS;
  const docs = [...byId.values()].slice(0, ACCOUNT_SPEND_OVERHEAD_MAX_ROWS);
  const groups = new Map<string, { name: string; provider: string; micros: number; runs: number; unpriced_runs: number }>();
  let unreadable = 0;
  for (const doc of docs) {
    const run = (doc.data() ?? {}) as Record<string, any>;
    const provider = overheadProvider(run.provider);
    if (!provider) continue; // a local harness: no provider bill
    const name = overheadName(run.task_kind);
    if (!name || run.agent_accounting_incomplete === true) { unreadable += 1; continue; }
    const cost = runCost(run);
    if (cost === null && !FINISHED.has(String(run.status))) continue; // still in flight: counted once it finishes
    const key = `${name}\u001f${provider}`;
    const group = groups.get(key) ?? { name, provider, micros: 0, runs: 0, unpriced_runs: 0 };
    group.runs += 1;
    if (cost === null) group.unpriced_runs += 1;
    else group.micros += Math.ceil(cost * 1_000_000);
    groups.set(key, group);
  }
  const rows = [...groups.values()].sort((a, b) => a.name.localeCompare(b.name) || a.provider.localeCompare(b.provider))
    .map(({ micros, ...group }) => ({ ...group, usd: micros / 1_000_000 }));
  return { schema_version: ACCOUNT_SPEND_OVERHEAD_SCHEMA, month, generated_at: new Date(nowMs).toISOString(), rows,
    // Every run record of the month was read and understood.
    complete: !truncated && unreadable === 0,
    unreadable_rows: unreadable };
}
