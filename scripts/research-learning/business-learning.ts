#!/usr/bin/env -S npx tsx
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { dbAdmin } from "../../client/src/lib/firebaseAdmin";
import { BusinessHistoryStore, validateBusinessHistory } from "../../server/research-learning/business-history";
import { recordTerminalRun, runDailyBusinessAnalysis } from "../../server/research-learning/business-learning-loop";

/** Trusted operator/runner entrypoint using existing Admin authorization.
 * Inputs/context are private host files, never model-selected tool arguments.
 * Explicit modes append only owned business records; no source/control/mail,
 * model/budget/security/destination changes. No scheduler is installed here. */
async function main() {
  const [mode, inputFlag, inputPath, outputFlag, outputPath] = process.argv.slice(2);
  if (!['capture', 'summarize-run', 'aggregate'].includes(mode) || inputFlag !== '--input' || outputFlag !== '--output'
    || !inputPath || !outputPath || process.argv.length !== 7) throw new Error('business_learning_cli_arguments_invalid');
  const target = resolve(outputPath);
  if (existsSync(target)) throw new Error('business_learning_output_exists');
  if (!dbAdmin) throw new Error('business_learning_existing_admin_unavailable');
  const input = JSON.parse(readFileSync(inputPath, 'utf8'));
  let result: unknown;
  if (mode === 'capture') {
    const event = validateBusinessHistory(input.event);
    result = { version: 'blueprint.business-capture-receipt.v1', eventId: event.eventId,
      recordRef: `blueprintResearchLearning/default/businessHistoryEvents/${event.eventId}`,
      append: await new BusinessHistoryStore(dbAdmin).append(event, input.trustedContext), paidModelCalls: 0 };
  } else if (mode === 'summarize-run') result = await recordTerminalRun(dbAdmin, input);
  else result = await runDailyBusinessAnalysis(dbAdmin, input);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, JSON.stringify(result, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  console.log(JSON.stringify({ mode, output: target, paidModelCalls: 0, sourceWrites: 0, sends: 0, schedulerChanges: 0 }));
}
main().catch(() => { console.error('business_learning_failed; preserve the input/job key and inspect authorized source/scope without logging private messages'); process.exitCode = 1; });
