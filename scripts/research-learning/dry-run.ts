import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { dryRunMigration } from "../../server/research-learning/migration";

const args = process.argv.slice(2);
if (args.length !== 2 || args.some(arg => arg.startsWith("--"))) {
  console.error("Usage: npx tsx scripts/research-learning/dry-run.ts <normalized-input.json> <report.json>");
  process.exitCode = 2;
} else {
  try {
    const source = resolve(args[0]), target = resolve(args[1]);
    if (source === target) throw new Error("input_output_paths_must_differ");
    const report = dryRunMigration(JSON.parse(await readFile(source, "utf8")));
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, JSON.stringify(report, null, 2) + "\n", { flag: "wx", mode: 0o600 });
    console.log(JSON.stringify({ readyForStagedAppend: report.readyForStagedAppend, readyForCutover: false,
      snapshotId: report.snapshot.snapshotId, counts: report.counts, errors: report.errors }));
    if (!report.readyForStagedAppend) process.exitCode = 1;
  } catch {
    // Do not print invalid input values (which may contain private source data).
    console.error("learning_dry_run_invalid_input_or_output_exists");
    process.exitCode = 1;
  }
}
