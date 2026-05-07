import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  type ExactSiteGtmPilotLedger,
  type ExactSiteGtmTarget,
  loadExactSiteHostedReviewGtmLedger,
} from "../../server/utils/exactSiteHostedReviewGtmPilot";
import { resolveMarketSignalProvider } from "../../server/utils/marketSignalProviders";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DEFAULT_LEDGER_PATH = path.join(
  REPO_ROOT,
  "ops/paperclip/playbooks/exact-site-hosted-review-gtm-ledger.json",
);
const DEFAULT_SEED_PATH = path.join(REPO_ROOT, "ops/paperclip/playbooks/gtm-target-seeds.json");
const DEFAULT_REPORT_ROOT = path.join(REPO_ROOT, "ops/paperclip/reports/gtm-target-expansion");

type TargetSeed = {
  organizationName: string;
  buyerSegment: string;
  workflowNeed: string;
  intentSignals: string[];
  sourceUrls?: string[];
  city?: string;
  track?: "proof_ready_outreach" | "demand_sourced_capture";
  requestedSiteType?: string;
  requestedCity?: string;
  buyerQuestion?: string;
};

function parseArgs(argv: string[]) {
  const args = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const entry = argv[index];
    if (!entry.startsWith("--")) continue;
    const key = entry.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      args.set(key, next);
      index += 1;
    } else {
      args.set(key, "1");
    }
  }
  return args;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

async function readSeedFile(seedPath: string): Promise<TargetSeed[]> {
  const raw = await fs.readFile(seedPath, "utf8").catch(() => "");
  if (!raw.trim()) return [];
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error(`Target seed file must be a JSON array: ${seedPath}`);
  }
  return parsed.map((entry) => entry as TargetSeed);
}

function validateSeed(seed: TargetSeed) {
  return Boolean(
    seed.organizationName
      && seed.buyerSegment
      && seed.workflowNeed
      && Array.isArray(seed.intentSignals)
      && seed.intentSignals.length > 0,
  );
}

function targetFromSeed(seed: TargetSeed, index: number): ExactSiteGtmTarget {
  const track = seed.track || "demand_sourced_capture";
  const id = `gtm-${slugify(seed.organizationName)}-${slugify(seed.workflowNeed) || index}`;
  return {
    id,
    track,
    organizationName: seed.organizationName,
    buyerSegment: seed.buyerSegment,
    city: seed.city,
    workflowNeed: seed.workflowNeed,
    intentSignals: seed.intentSignals,
    evidence: {
      summary: `Target created from reusable GTM target expansion seed for ${seed.organizationName}.`,
      sourceUrls: seed.sourceUrls,
    },
    artifact: track === "proof_ready_outreach"
      ? {
          type: "exact_site_hosted_review",
          status: "missing",
        }
      : {
          type: "city_site_opportunity_brief",
          status: "draft",
          path: "ops/paperclip/playbooks/exact-site-hosted-review-first-target-brief.md",
        },
    captureAsk: track === "demand_sourced_capture"
      ? {
          requestedSiteType: seed.requestedSiteType || seed.workflowNeed,
          requestedCity: seed.requestedCity || seed.city,
          buyerQuestion: seed.buyerQuestion || "Which exact site or workflow would be useful enough for Blueprint to capture and host next?",
          status: "not_started",
        }
      : undefined,
    enrichment: {
      status: "not_started",
      providerRuns: [],
      recipientCandidates: [],
      blockers: [],
    },
    outbound: {
      status: "draft_ready",
      approvalState: "blocked",
    },
    sales: {
      nextAction: "Run the GTM enrichment waterfall to find explicit recipient-backed contact evidence.",
      nextActionOwner: "growth-lead",
    },
  };
}

async function marketSignalSeeds(topic: string, limit: number): Promise<TargetSeed[]> {
  const provider = resolveMarketSignalProvider();
  if (!provider) return [];
  const result = await provider.fetchSignals(topic, { limit });
  return result.signals
    .filter((signal) => signal.title && signal.summary && signal.url)
    .map((signal): TargetSeed => ({
      organizationName: signal.source && signal.source !== "unknown"
        ? signal.source
        : signal.title,
      buyerSegment: "Robot-team demand signal",
      workflowNeed: signal.summary,
      intentSignals: [signal.title],
      sourceUrls: signal.url ? [signal.url] : [],
      track: "demand_sourced_capture",
      buyerQuestion: "Does this signal point to an exact site, facility type, or workflow Blueprint should capture next?",
    }));
}

function addTargetsToLedger(ledger: ExactSiteGtmPilotLedger, targets: ExactSiteGtmTarget[]) {
  const existingIds = new Set(ledger.targets.map((target) => target.id));
  const existingNames = new Set(ledger.targets.map((target) => target.organizationName.toLowerCase()));
  const added: ExactSiteGtmTarget[] = [];

  for (const target of targets) {
    let id = target.id;
    let suffix = 2;
    while (existingIds.has(id)) {
      id = `${target.id}-${suffix}`;
      suffix += 1;
    }
    if (existingNames.has(target.organizationName.toLowerCase())) {
      continue;
    }
    const nextTarget = { ...target, id };
    ledger.targets.push(nextTarget);
    existingIds.add(id);
    existingNames.add(target.organizationName.toLowerCase());
    added.push(nextTarget);
  }

  if (added.length > 0) {
    const today = todayIso();
    const existingDay = ledger.dailyActivity.find((day) => day.date === today);
    if (existingDay) {
      existingDay.targetsAdded = (existingDay.targetsAdded || 0) + added.length;
    } else {
      ledger.dailyActivity.push({
        date: today,
        targetsAdded: added.length,
        draftedTouches: 0,
        approvedTouches: 0,
        sentTouches: 0,
        replies: 0,
        hostedReviewStarts: 0,
        qualifiedCalls: 0,
        contentDrafts: 0,
        paidSpendCents: 0,
      });
    }
  }
  const targetFloor = ledger.pilot.targetAccountGoalMin || 30;
  if (ledger.targets.length >= targetFloor) {
    const floorBlocker = ledger.blockers?.find((blocker) => blocker.id === "gtm-blocker-target-ledger-floor");
    if (floorBlocker && floorBlocker.status !== "resolved") {
      const now = new Date().toISOString();
      floorBlocker.status = "resolved";
      floorBlocker.summary = `The active pilot now has ${ledger.targets.length} target rows, meeting the ${targetFloor}-account floor.`;
      floorBlocker.nextAction = "Keep expanding toward the upper target range only when new rows come from explicit robot-team buying or workflow signals.";
      floorBlocker.updatedAt = now;
      floorBlocker.resolvedAt = now;
    }
  }
  return added;
}

function renderReport(input: {
  ledgerPath: string;
  write: boolean;
  added: ExactSiteGtmTarget[];
  skippedSeeds: number;
}) {
  return [
    "# GTM Target Expansion",
    "",
    `- ledger: ${path.relative(process.cwd(), input.ledgerPath) || input.ledgerPath}`,
    `- mode: ${input.write ? "write" : "dry_run"}`,
    `- added_targets: ${input.added.length}`,
    `- skipped_invalid_seeds: ${input.skippedSeeds}`,
    "",
    "## Added Targets",
    "",
    ...(input.added.length > 0
      ? input.added.map((target) => `- ${target.id}: ${target.organizationName} / ${target.buyerSegment}`)
      : ["- none"]),
    "",
  ].join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const ledgerPath = path.resolve(args.get("ledger") ?? DEFAULT_LEDGER_PATH);
  const seedPath = path.resolve(args.get("seed-file") ?? DEFAULT_SEED_PATH);
  const write = args.get("write") === "1";
  const marketTopic = args.get("market-topic") || "";
  const marketLimit = Number(args.get("market-limit") || "10");
  const ledger = await loadExactSiteHostedReviewGtmLedger(ledgerPath);
  const fileSeeds = await readSeedFile(seedPath);
  const signalSeeds = marketTopic ? await marketSignalSeeds(marketTopic, marketLimit) : [];
  const seeds = [...fileSeeds, ...signalSeeds];
  const validSeeds = seeds.filter(validateSeed);
  const targets = validSeeds.map(targetFromSeed);
  const added = addTargetsToLedger(ledger, targets);
  const report = renderReport({
    ledgerPath,
    write,
    added,
    skippedSeeds: seeds.length - validSeeds.length,
  });

  if (write) {
    await fs.writeFile(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");
    const reportDir = path.join(DEFAULT_REPORT_ROOT, todayIso());
    await fs.mkdir(reportDir, { recursive: true });
    await fs.writeFile(path.join(reportDir, "target-expansion.md"), report, "utf8");
    await fs.writeFile(
      path.join(reportDir, "target-expansion-manifest.json"),
      `${JSON.stringify({
        schema: "blueprint/gtm-target-expansion/v1",
        generatedAt: new Date().toISOString(),
        ledgerPath: path.relative(process.cwd(), ledgerPath),
        seedPath: path.relative(process.cwd(), seedPath),
        marketTopic: marketTopic || null,
        addedTargetIds: added.map((target) => target.id),
      }, null, 2)}\n`,
      "utf8",
    );
  }

  process.stdout.write(report);
  if (added.length === 0 && args.get("allow-empty") !== "1") {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
