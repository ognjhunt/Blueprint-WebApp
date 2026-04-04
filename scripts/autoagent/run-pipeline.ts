import fs from "node:fs/promises";
import path from "node:path";

import { runBuild } from "./build-harbor-tasks.ts";
import { runExport } from "./export-historical-cases.ts";
import { seedCanonicalCases } from "./seed-canonical-cases.ts";

type ExportLane = "waitlist_triage" | "support_triage" | "preview_diagnosis";
type DatasetSplit = "dev" | "holdout" | "shadow";

type PipelineOptions = {
  lanes: ExportLane[];
  fixtureRoot: string;
  harborRoot: string;
  maxPerLane: number;
  overwrite: boolean;
  since?: string | null;
  sampleCount: number;
  seedKnown: boolean;
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
  const exportSummaries = await runExport({
    lanes: options.lanes,
    outputRoot: options.fixtureRoot,
    maxPerLane: options.maxPerLane,
    overwrite: options.overwrite,
    since: options.since ?? null,
  });

  const lanesNeedingSeeds = options.seedKnown
    ? exportSummaries
        .filter((summary) => summary.exported === 0)
        .map((summary) => summary.lane)
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
  const samples = await sampleTaskDirectories(
    options.harborRoot,
    options.lanes,
    options.sampleCount,
  );

  return {
    exportSummaries,
    seedSummaries,
    buildSummaries,
    counts,
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

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const result = await runPipeline(options);

  console.log("Export summaries:");
  for (const summary of result.exportSummaries) {
    console.log(
      `- ${summary.lane}: scanned=${summary.scanned} exported=${summary.exported} skipped=${summary.skipped}`,
    );
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
