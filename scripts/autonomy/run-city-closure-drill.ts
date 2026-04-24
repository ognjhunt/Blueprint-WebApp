import { promises as fs } from "node:fs";
import path from "node:path";

import { buildCompanyScoreboard } from "../../server/utils/companyScoreboard";
import { collectCompanyMetricsSnapshot } from "../../server/utils/companyMetrics";
import { readCityLaunchActivation } from "../../server/utils/cityLaunchLedgers";
import { runOperatingGraphProjectionLoop } from "../../server/utils/operatingGraphEvidenceProjectors";
import type { OperatingGraphStage } from "../../server/utils/operatingGraphTypes";

const REPO_ROOT = process.cwd();

function argValue(name: string) {
  const prefix = `${name}=`;
  const inline = process.argv.find((entry) => entry.startsWith(prefix));
  if (inline) {
    return inline.slice(prefix.length).trim();
  }
  const index = process.argv.indexOf(name);
  if (index >= 0) {
    return process.argv[index + 1]?.trim() || "";
  }
  return "";
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function stableTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function stageLabel(stage: OperatingGraphStage) {
  return stage.replace(/_/g, " ");
}

function nextActionLabel(stage: "next_action_open") {
  return stage.replace(/_/g, " ");
}

function includesStage(stages: OperatingGraphStage[], stage: OperatingGraphStage) {
  return stages.includes(stage);
}

function routineRecommendations(input: {
  missingStages: OperatingGraphStage[];
  wideningReasons: string[];
}) {
  const recommendations = new Map<string, string>();
  const missing = new Set(input.missingStages);
  const wideningText = input.wideningReasons.join("\n").toLowerCase();

  if (missing.has("city_selected") || missing.has("supply_seeded")) {
    recommendations.set(
      "city-launch-weekly",
      "City-launch state or seeded supply truth is missing; the launch lane needs a weekly proof-bearing closeout.",
    );
  }
  if (missing.has("supply_contactable") || wideningText.includes("first_approved_capturer")) {
    recommendations.set(
      "capturer-growth-weekly",
      "Supply is not proven as contactable/approved enough to support autonomous first capture.",
    );
  }
  if (wideningText.includes("first_lawful_access_path")) {
    recommendations.set(
      "site-operator-partnership-weekly",
      "Lawful-access proof is still a tracked blocker, so the site-operator lane should run.",
    );
  }
  if (missing.has("hosted_review_started") || missing.has("buyer_outcome_recorded")) {
    recommendations.set(
      "robot-team-growth-weekly",
      "Demand-side hosted-review usage or buyer outcome truth is not closed yet.",
    );
  }

  return [...recommendations.entries()].map(([routine, reason]) => ({
    routine,
    reason,
  }));
}

async function main() {
  const cityArg = argValue("--city");
  const projection = await runOperatingGraphProjectionLoop({
    city: cityArg || undefined,
    limit: Number(argValue("--limit") || 500),
  });
  const snapshot = await collectCompanyMetricsSnapshot();
  const scoreboard = buildCompanyScoreboard(snapshot);
  const city =
    cityArg
    || scoreboard.ceoOperatingScreen.activeCity?.city
    || snapshot.cityLaunchLedgers[0]?.city
    || "";

  if (!city) {
    throw new Error("No city supplied and no active city was available in company state.");
  }

  const citySlug = slugify(city);
  const activation = await readCityLaunchActivation(city);
  const cityStates = snapshot.operatingGraphStates.filter(
    (state) => state.citySlug === citySlug || slugify(state.city) === citySlug,
  );
  const cityEvents = snapshot.operatingGraphEvents.filter(
    (event) => event.city_slug === citySlug || slugify(event.city) === citySlug,
  );
  const captureSubmissions = snapshot.captureSubmissions.filter(
    (submission) => submission.citySlug === citySlug || slugify(submission.city || "") === citySlug,
  );
  const buyerOutcomes = snapshot.buyerOutcomes.filter(
    (outcome) =>
      Boolean(outcome.cityProgramId?.includes(citySlug))
      || cityEvents.some(
        (event) =>
          event.stage === "buyer_outcome_recorded"
          && event.metadata?.buyer_outcome_id === outcome.buyerOutcomeId,
      ),
  );

  const evidence = {
    city_selected: cityEvents.filter((event) => event.stage === "city_selected").length,
    supply_seeded: cityStates.filter(
      (state) =>
        state.entityType === "supply_target"
        && includesStage(state.stagesSeen, "supply_seeded"),
    ).length,
    supply_contactable: cityStates.filter(
      (state) =>
        state.entityType === "supply_target"
        && includesStage(state.stagesSeen, "supply_contactable"),
    ).length,
    capture_uploaded:
      cityStates.filter(
        (state) =>
          state.entityType === "capture_run"
          && includesStage(state.stagesSeen, "capture_uploaded"),
      ).length
      + captureSubmissions.filter((submission) => Boolean(submission.captureUploadedAtIso)).length,
    package_ready: cityStates.filter(
      (state) =>
        state.entityType === "package_run"
        && (
          includesStage(state.stagesSeen, "package_ready")
          || includesStage(state.stagesSeen, "hosted_review_ready")
        ),
    ).length,
    hosted_review_started: cityStates.filter(
      (state) =>
        state.entityType === "hosted_review_run"
        && includesStage(state.stagesSeen, "hosted_review_started"),
    ).length,
    buyer_outcome_recorded:
      buyerOutcomes.length
      + cityEvents.filter((event) => event.stage === "buyer_outcome_recorded").length,
    next_action_open:
      cityEvents.filter((event) => event.stage === "next_action_open").length
      + cityStates.reduce((sum, state) => sum + state.nextActions.length, 0),
  } satisfies Record<
    | "city_selected"
    | "supply_seeded"
    | "supply_contactable"
    | "capture_uploaded"
    | "package_ready"
    | "hosted_review_started"
    | "buyer_outcome_recorded"
    | "next_action_open",
    number
  >;

  const orderedStages: OperatingGraphStage[] = [
    "city_selected",
    "supply_seeded",
    "supply_contactable",
    "capture_uploaded",
    "package_ready",
    "hosted_review_started",
    "buyer_outcome_recorded",
  ];
  const stageResults = orderedStages.map((stage) => ({
    stage,
    status: evidence[stage as keyof typeof evidence] > 0 ? "present" : "missing",
    evidenceCount: evidence[stage as keyof typeof evidence],
  }));
  const missingStages = stageResults
    .filter((entry) => entry.status === "missing")
    .map((entry) => entry.stage);
  const openNextActionCount = evidence.next_action_open;
  const recommendations = routineRecommendations({
    missingStages,
    wideningReasons: activation?.wideningGuard?.reasons || [],
  });
  const generatedAt = new Date().toISOString();
  const runDir = path.join(
    REPO_ROOT,
    "ops/paperclip/reports/autonomy-closure-drills",
    citySlug,
    stableTimestamp(),
  );
  await fs.mkdir(runDir, { recursive: true });

  const report = {
    generatedAt,
    city,
    citySlug,
    status: missingStages.length === 0 && openNextActionCount === 0 ? "closed" : "blocked",
    openNextActionCount,
    projection,
    activeCity: scoreboard.ceoOperatingScreen.activeCity,
    lifecycle: [
      ...stageResults,
      {
        stage: "next_action_open",
        status: openNextActionCount > 0 ? "open" : "clear",
        evidenceCount: openNextActionCount,
      },
    ],
    missingStages,
    routineRecommendations: recommendations,
    activation: activation
      ? {
          status: activation.status,
          budgetTier: activation.budgetTier,
          wideningAllowed: activation.wideningGuard.wideningAllowed,
          wideningReasons: activation.wideningGuard.reasons,
        }
      : null,
  };

  const jsonPath = path.join(runDir, "closure-drill.json");
  const mdPath = path.join(runDir, "closure-drill.md");
  await fs.writeFile(jsonPath, JSON.stringify(report, null, 2));
  await fs.writeFile(
    mdPath,
    [
      `# ${city} Autonomy Closure Drill`,
      "",
      `- generated_at: ${generatedAt}`,
      `- status: ${report.status}`,
      `- projection_events: ${projection.processedCount}`,
      "",
      "## Lifecycle",
      "",
      "| Stage | Status | Evidence count |",
      "| --- | --- | --- |",
      ...stageResults.map((entry) => `| ${stageLabel(entry.stage)} | ${entry.status} | ${entry.evidenceCount} |`),
      `| ${nextActionLabel("next_action_open")} | ${openNextActionCount > 0 ? "open" : "clear"} | ${openNextActionCount} |`,
      "",
      "## Routine Recommendations",
      "",
      recommendations.length
        ? recommendations.map((entry) => `- ${entry.routine}: ${entry.reason}`).join("\n")
        : "- none",
      "",
      "## Widening Reasons",
      "",
      ...(activation?.wideningGuard?.reasons || ["No activation widening guard found."]).map(
        (reason) => `- ${reason}`,
      ),
      "",
    ].join("\n"),
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        status: report.status,
        city,
        citySlug,
        missingStages,
        routineRecommendations: recommendations,
        jsonPath,
        mdPath,
      },
      null,
      2,
    ),
  );
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
