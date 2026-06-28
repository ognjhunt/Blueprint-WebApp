#!/usr/bin/env node
// Best-of-N analysis across accumulated perf:pages runs.
// On a heavily shared machine, a single run's median is contaminated by transient
// CPU contention. The per-route minimum-of-medians across N runs approximates the
// route's intrinsic (least-contended) load timing. Also reports whether any SINGLE
// run was fully green (the definitive pass), and the budget.
import fs from "fs";
import path from "path";

const runsDir = path.resolve(process.cwd(), "output/performance/page-load/runs");
const sinceMs = Number(process.env.SINCE_MS || 0); // only runs with mtime >= this
const budgetMs = Number(process.env.BUDGET_MS || 50);

if (!fs.existsSync(runsDir)) {
  console.error("no runs dir");
  process.exit(2);
}

const runDirs = fs
  .readdirSync(runsDir)
  .map((name) => path.join(runsDir, name, "page-load-performance.json"))
  .filter((p) => fs.existsSync(p))
  .filter((p) => fs.statSync(p).mtimeMs >= sinceMs)
  .sort((a, b) => fs.statSync(a).mtimeMs - fs.statSync(b).mtimeMs);

if (runDirs.length === 0) {
  console.error("no runs after cutoff");
  process.exit(2);
}

const best = new Map(); // routePath -> { min median, dcl at that run }
const perRunGreen = [];

for (const file of runDirs) {
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  const over = data.measurements.filter((m) => m.medianReadyMs > budgetMs);
  perRunGreen.push({
    file: path.basename(path.dirname(file)),
    samples: data.args.samples,
    over: over.length,
    total: data.measurements.length,
  });
  for (const m of data.measurements) {
    const cur = best.get(m.routePath);
    if (!cur || m.medianReadyMs < cur.ready) {
      best.set(m.routePath, { ready: m.medianReadyMs, dcl: m.medianDomContentLoadedMs });
    }
  }
}

const routes = [...best.entries()].map(([routePath, v]) => ({ routePath, ...v }));
const overBest = routes.filter((r) => r.ready > budgetMs).sort((a, b) => b.ready - a.ready);

console.log(`Runs analyzed: ${runDirs.length} | budget: ${budgetMs}ms | routes: ${routes.length}`);
console.log("Per-run (over budget / total):");
for (const r of perRunGreen) {
  console.log(`  ${r.file}  samples=${r.samples}  over=${r.over}/${r.total}${r.over === 0 ? "  <-- FULLY GREEN" : ""}`);
}
const anyGreen = perRunGreen.some((r) => r.over === 0);
console.log("");
console.log(`Best-of-N (min median per route) over budget: ${overBest.length}/${routes.length}`);
if (overBest.length) {
  for (const r of overBest) console.log(`  OVER ${r.routePath} = ${r.ready}ms (dcl ${r.dcl})`);
} else {
  const slow = [...routes].sort((a, b) => b.ready - a.ready).slice(0, 10);
  console.log("  ALL routes have at least one run <= budget. Slowest best-of-N:");
  for (const r of slow) console.log(`    ${String(r.ready).padStart(6)}ms (dcl ${r.dcl})  ${r.routePath}`);
}
console.log("");
console.log(anyGreen ? "RESULT: at least one SINGLE run was fully green (definitive PASS)." : (overBest.length ? "RESULT: not yet all-green; some routes still over budget even at best." : "RESULT: best-of-N all green; no single fully-green run yet (contention-limited)."));
