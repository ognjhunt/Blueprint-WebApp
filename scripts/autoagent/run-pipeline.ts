import fs from "node:fs/promises";
import path from "node:path";

import { runBuild } from "./build-harbor-tasks.ts";
import { evaluateLocalFixtures, type LocalEvalSummary } from "./local-evaluator.ts";
import { seedCanonicalCases } from "./seed-canonical-cases.ts";

type ExportLane = "waitlist_triage" | "support_triage" | "preview_diagnosis";
type DatasetSplit = "dev" | "holdout" | "shadow";
type ExportMode = "offline_seed" | "live_export";

type ExportSummary = {
  lane: ExportLane;
  scanned: number;
  exported: number;
  skipped: number;
  skipReasons: Record<string, number>;
};

type PipelineOptions = {
  lanes: ExportLane[];
  fixtureRoot: string;
  harborRoot: string;
  maxPerLane: number;
  overwrite: boolean;
  since?: string | null;
  sampleCount: number;
  seedKnown: boolean;
  exportLive?: boolean;
};

const DEFAULT_FIXTURE_ROOT = path.resolve(
  "/Users/nijelhunt_1/workspace/Blueprint-WebApp/labs/autoagent/tasks",
);
const DEFAULT_HARBOR_ROOT = path.resolve(
  "/Users/nijelhunt_1/workspace/Blueprint-WebApp/labs/autoagent/harbor",
);

function parseArgs(argv: string[]): PipelineOptions {
  const options: PipelineOptions = {
    lanes: ["waitlist_triage", "support_triage", "preview_diagnosis"],
    fixtureRoot: DEFAULT_FIXTURE_ROOT,
    harborRoot: DEFAULT_HARBOR_ROOT,
    maxPerLane: 250,
    overwrite: true,
    since: null,
    sampleCount: 3,
    seedKnown: true,
    exportLive: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    switch (arg) {
      case "--lanes":
        if (!next) throw new Error("--lanes requires a comma-separated value");
        options.lanes = next
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean)
          .map((entry) => {
            if (
              entry === "waitlist_triage"
              || entry === "support_triage"
              || entry === "preview_diagnosis"
            ) {
              return entry;
            }
            throw new Error(`Unsupported lane: ${entry}`);
          });
        index += 1;
        break;
      case "--fixture-root":
        if (!next) throw new Error("--fixture-root requires a path");
        options.fixtureRoot = path.resolve(next);
        index += 1;
        break;
      case "--harbor-root":
        if (!next) throw new Error("--harbor-root requires a path");
        options.harborRoot = path.resolve(next);
        index += 1;
        break;
      case "--max-per-lane":
        if (!next) throw new Error("--max-per-lane requires a number");
        options.maxPerLane = Math.max(1, Number.parseInt(next, 10) || options.maxPerLane);
        index += 1;
        break;
      case "--since":
        if (!next) throw new Error("--since requires an ISO timestamp");
        options.since = next;
        index += 1;
        break;
      case "--sample":
        if (!next) throw new Error("--sample requires a number");
        options.sampleCount = Math.max(0, Number.parseInt(next, 10) || 0);
        index += 1;
        break;
      case "--no-overwrite":
        options.overwrite = false;
        break;
      case "--no-seed-known":
        options.seedKnown = false;
        break;
      case "--export-live":
        options.exportLive = true;
        break;
      case "--offline":
      case "--skip-export":
        options.exportLive = false;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function laneToFixtureDir(lane: ExportLane) {
  switch (lane) {
    case "waitlist_triage":
      return "waitlist-triage";
    case "support_triage":
      return "support-triage";
    case "preview_diagnosis":
      return "preview-diagnosis";
  }
}

type LaneSplitCounts = Record<ExportLane, Record<DatasetSplit, number>>;

export async function countGeneratedTasks(
  harborRoot: string,
  lanes: ExportLane[],
): Promise<LaneSplitCounts> {
  const counts = {} as LaneSplitCounts;

  for (const lane of lanes) {
    const laneDir = path.join(harborRoot, laneToFixtureDir(lane));
    counts[lane] = { dev: 0, holdout: 0, shadow: 0 };

    for (const split of ["dev", "holdout", "shadow"] as DatasetSplit[]) {
      try {
        const splitDir = path.join(laneDir, split);
        const entries = await fs.readdir(splitDir, { withFileTypes: true });
        counts[lane][split] = entries.filter((entry) => entry.isDirectory()).length;
      } catch {
        counts[lane][split] = 0;
      }
    }
  }

  return counts;
}

async function sampleTaskDirectories(
  harborRoot: string,
  lanes: ExportLane[],
  sampleCount: number,
) {
  const samples: string[] = [];
  if (sampleCount <= 0) {
    return samples;
  }

  for (const lane of lanes) {
    const laneDir = path.join(harborRoot, laneToFixtureDir(lane));
    for (const split of ["dev", "holdout", "shadow"] as DatasetSplit[]) {
      try {
        const splitDir = path.join(laneDir, split);
        const entries = await fs.readdir(splitDir, { withFileTypes: true });
        for (const entry of entries.filter((item) => item.isDirectory()).slice(0, sampleCount)) {
          samples.push(path.join(splitDir, entry.name));
          if (samples.length >= sampleCount) {
            return samples;
          }
        }
      } catch {
        // ignore missing split directories
      }
    }
  }

  return samples;
}

export async function runPipeline(options: PipelineOptions) {
  await fs.mkdir(options.fixtureRoot, { recursive: true });

  const exportMode: ExportMode = options.exportLive ? "live_export" : "offline_seed";
  const exportSummaries: ExportSummary[] = [];

  if (options.exportLive) {
    const { runExport } = await import("./export-historical-cases.ts");
    exportSummaries.push(
      ...(await runExport({
        lanes: options.lanes,
        outputRoot: options.fixtureRoot,
        maxPerLane: options.maxPerLane,
        overwrite: options.overwrite,
        since: options.since ?? null,
      })),
    );
  } else {
    for (const lane of options.lanes) {
      exportSummaries.push({
        lane,
        scanned: 0,
        exported: 0,
        skipped: 0,
        skipReasons: {
          live_export_skipped_offline: 1,
        },
      });
    }
  }

  const lanesNeedingSeeds = options.seedKnown
    ? options.exportLive
      ? exportSummaries
        .filter((summary) => summary.exported === 0)
        .map((summary) => summary.lane)
      : options.lanes
    : [];

  const seedSummaries = lanesNeedingSeeds.length > 0
    ? await seedCanonicalCases({
        lanes: lanesNeedingSeeds,
        outputRoot: options.fixtureRoot,
      })
    : [];

  const buildSummaries = await runBuild({
    lanes: options.lanes,
    inputRoot: options.fixtureRoot,
    outputRoot: options.harborRoot,
    overwrite: options.overwrite,
  });

  const counts = await countGeneratedTasks(options.harborRoot, options.lanes);
  const localEval = await evaluateLocalFixtures({
    fixtureRoot: options.fixtureRoot,
    lanes: options.lanes,
    sampleCount: options.sampleCount,
  });
  const samples = await sampleTaskDirectories(
    options.harborRoot,
    options.lanes,
    options.sampleCount,
  );

  return {
    exportMode,
    exportSummaries,
    seedSummaries,
    buildSummaries,
    counts,
    localEval,
    samples,
  };
}

function printCounts(counts: LaneSplitCounts) {
  console.log("Generated Harbor task counts:");
  for (const [lane, laneCounts] of Object.entries(counts)) {
    console.log(
      `- ${lane}: dev=${laneCounts.dev} holdout=${laneCounts.holdout} shadow=${laneCounts.shadow}`,
    );
  }
}

function printSamples(samples: string[]) {
  if (samples.length === 0) {
    console.log("No sample task directories available.");
    return;
  }
  console.log("Sample generated task directories:");
  for (const sample of samples) {
    console.log(`- ${sample}`);
  }
}

function formatReward(value: number | null) {
  return value === null ? "n/a" : value.toFixed(2);
}

function printLocalEvalSummary(summary: LocalEvalSummary) {
  console.log("Local eval summaries (offline schema + fixture scoring, no provider calls):");
  for (const lane of summary.lanes) {
    const laneSummary = summary.laneSummaries[lane];
    console.log(
      `- ${lane}: cases=${laneSummary.totalCases} pass=${laneSummary.passed} fail=${laneSummary.failed} min_reward=${formatReward(laneSummary.minReward)} avg_reward=${formatReward(laneSummary.averageReward)} negative_controls_blocked=${laneSummary.negativeControlsBlocked}/${laneSummary.negativeControls} splits dev=${laneSummary.splits.dev} holdout=${laneSummary.splits.holdout} shadow=${laneSummary.splits.shadow}`,
    );
    for (const failure of laneSummary.failures.slice(0, 3)) {
      const schema = failure.schemaErrors.length > 0
        ? ` schema_errors=${failure.schemaErrors.join("; ")}`
        : "";
      const fields = failure.failures.map((item) => item.field).join(",");
      const penalties = failure.penalties.map((item) => item.reason).join(",");
      console.log(
        `  - failed ${failure.split}/${failure.caseId}: reward=${failure.reward.toFixed(2)} fields=${fields || "none"} penalties=${penalties || "none"}${schema}`,
      );
    }
  }
  console.log(
    `Local eval overall: cases=${summary.totalCases} pass=${summary.totalPassed} fail=${summary.totalFailed} negative_controls_blocked=${summary.totalNegativeControlsBlocked}/${summary.totalNegativeControls}`,
  );

  if (summary.samples.length > 0) {
    console.log("Local eval sample cases:");
    for (const sample of summary.samples) {
      console.log(
        `- ${sample.lane}/${sample.split}/${sample.caseId}: ${sample.passed ? "PASS" : "FAIL"} reward=${sample.reward.toFixed(2)} source=${sample.candidateSource}`,
      );
    }
  }
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const result = await runPipeline(options);

  console.log(
    result.exportMode === "live_export"
      ? "Export mode: live_export (Firestore historical export requested)."
      : "Export mode: offline_seed (live Firestore export skipped; using existing and canonical seed fixtures).",
  );

  console.log("Export summaries:");
  for (const summary of result.exportSummaries) {
    console.log(
      `- ${summary.lane}: scanned=${summary.scanned} exported=${summary.exported} skipped=${summary.skipped}`,
    );
    for (const [reason, count] of Object.entries(summary.skipReasons || {})) {
      console.log(`  - ${reason}: ${count}`);
    }
  }

  console.log("Build summaries:");
  for (const summary of result.buildSummaries) {
    console.log(
      `- ${summary.lane}: generated=${summary.generated} skipped=${summary.skipped}`,
    );
  }

  if (result.seedSummaries.length > 0) {
    console.log("Seed summaries:");
    for (const summary of result.seedSummaries) {
      console.log(
        `- ${summary.lane}: seeded=${summary.seeded} skipped=${summary.skipped}`,
      );
    }
  }

  printCounts(result.counts);
  printLocalEvalSummary(result.localEval);
  printSamples(result.samples);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
const currentPath = path.resolve(new URL(import.meta.url).pathname);

if (invokedPath && currentPath === invokedPath) {
  main().catch((error) => {
    console.error(
      `[autoagent-pipeline] failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  });
}
