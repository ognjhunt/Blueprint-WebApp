/**
 * CLI reconciliation report over the append-only Stripe ledger journal
 * (SCALE2-01). Sums the journal for a period and cross-checks creator
 * settlement totals against creatorEarningsAggregates, flagging drift.
 *
 * Usage:
 *   npm run stripe:reconcile                      # last 30 days
 *   npm run stripe:reconcile -- --from 2026-06-01T00:00:00Z --to 2026-07-01T00:00:00Z
 *
 * Exit code 1 when drift is detected so this can run in a cron/ops lane and
 * page through the usual failure path.
 */
import { buildStripeLedgerReconciliationReport } from "../server/utils/stripeLedgerReconciliation";

function argValue(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  if (index < 0 || index + 1 >= process.argv.length) {
    return null;
  }
  return process.argv[index + 1];
}

async function main() {
  const toIso = argValue("--to") || new Date().toISOString();
  const fromIso =
    argValue("--from") ||
    new Date(new Date(toIso).getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const report = await buildStripeLedgerReconciliationReport({ fromIso, toIso });
  console.log(JSON.stringify(report, null, 2));

  if (report.drift_creator_count > 0) {
    console.error(
      `DRIFT: ${report.drift_creator_count}/${report.checked_creator_count} creators show journal/aggregate drift — investigate before trusting either source.`,
    );
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(2);
});
