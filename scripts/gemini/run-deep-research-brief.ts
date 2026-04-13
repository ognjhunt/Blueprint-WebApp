import { promises as fs } from "node:fs";
import {
  runDeepResearchBrief,
} from "../../server/utils/deepResearchBriefHarness";

function getFlagValue(args: string[], flag: string) {
  const index = args.indexOf(flag);
  if (index === -1) {
    return null;
  }
  return args[index + 1] || null;
}

function getCsvFlagValues(args: string[], flag: string) {
  const rawValue = getFlagValue(args, flag);
  if (!rawValue) {
    return undefined;
  }

  const values = rawValue
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return values.length > 0 ? values : undefined;
}

async function readBrief(args: string[]) {
  const brief = getFlagValue(args, "--brief");
  if (brief) {
    return brief;
  }

  const briefFile = getFlagValue(args, "--brief-file");
  if (briefFile) {
    return fs.readFile(briefFile, "utf8");
  }

  throw new Error("Provide either --brief or --brief-file.");
}

async function main() {
  const args = process.argv.slice(2);
  const title = getFlagValue(args, "--title");
  if (!title) {
    throw new Error("Provide --title for the deep research brief.");
  }

  const brief = await readBrief(args);
  const owner = getFlagValue(args, "--owner");
  const businessLane = getFlagValue(args, "--business-lane") as
    | "Executive"
    | "Ops"
    | "Growth"
    | "Buyer"
    | "Capturer"
    | "Experiment"
    | "Risk"
    | null;
  const system = getFlagValue(args, "--system") as
    | "Cross-System"
    | "WebApp"
    | "Capture"
    | "Pipeline"
    | "Validation"
    | null;
  const critiqueRounds = Number(getFlagValue(args, "--critique-rounds") || "1");
  const fileSearchStoreNames = getCsvFlagValues(args, "--file-search-store");

  const result = await runDeepResearchBrief({
    title,
    brief,
    owner,
    businessLane: businessLane || undefined,
    system: system || undefined,
    fileSearchStoreNames,
    critiqueRounds: Number.isFinite(critiqueRounds) ? critiqueRounds : 1,
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        title: result.title,
        slug: result.slug,
        runDirectory: result.runDirectory,
        finalArtifactPath: result.finalArtifactPath,
        notionKnowledgePageUrl: result.notion?.knowledgePageUrl || null,
        notionWorkQueuePageUrl: result.notion?.workQueuePageUrl || null,
        latestInteractionId: result.stages[result.stages.length - 1]?.interactionId || null,
      },
      null,
      2,
    ),
  );
}

void main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
});
