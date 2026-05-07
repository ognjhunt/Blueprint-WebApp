import { promises as fs } from "node:fs";
import path from "node:path";

import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import {
  buildCityLaunchGtm72hArtifactPaths,
  CITY_LAUNCH_GTM_CHECKPOINT_HOURS,
  CITY_LAUNCH_GTM_EVIDENCE_SOURCES,
} from "./cityLaunchExecutionHarness";
import {
  collectCityLaunchScorecard,
  type CityLaunchScorecard,
  type CityLaunchScorecardQueryLimits,
  resolveCityLaunchScorecardQueryLimits,
} from "./cityLaunchScorecard";
import { resolveCityLaunchProfile, slugifyCityName } from "./cityLaunchProfiles";

export const CITY_LAUNCH_SCORECARD_WINDOW_SCHEMA_VERSION =
  "2026-05-06.city-launch-scorecard-window-closeout.v1";

export type CityLaunchScorecardCheckpointHour =
  (typeof CITY_LAUNCH_GTM_CHECKPOINT_HOURS)[number];

export type CityLaunchScorecardWindowStatus =
  | "complete"
  | "scheduled_not_due"
  | "early_snapshot"
  | "blocked";

export type CityLaunchScorecardWindowCloseoutArtifacts = {
  runDirectory: string | null;
  jsonPath: string;
  markdownPath: string;
  manifestPath: string;
};

export type CityLaunchScorecardWindowQueryDiagnostic = {
  collection: string;
  queryName: string;
  expectedQuery: string;
  diagnosticQuery: string;
  status: "covered_by_scorecard_query" | "verified_accessible" | "blocked" | "not_run";
  error: string | null;
};

export type CityLaunchScorecardWindowCloseout = {
  schemaVersion: typeof CITY_LAUNCH_SCORECARD_WINDOW_SCHEMA_VERSION;
  city: string;
  citySlug: string;
  generatedAt: string;
  checkpointHour: CityLaunchScorecardCheckpointHour;
  checkpointKey: `${CityLaunchScorecardCheckpointHour}h`;
  status: CityLaunchScorecardWindowStatus;
  windowStartIso: string | null;
  windowEndIso: string | null;
  dueAtIso: string | null;
  allowBeforeWindow: boolean;
  queryLimits: CityLaunchScorecardQueryLimits;
  blockers: string[];
  warnings: string[];
  artifacts: CityLaunchScorecardWindowCloseoutArtifacts;
  evidenceSources: typeof CITY_LAUNCH_GTM_EVIDENCE_SOURCES;
  queryDiagnostics: CityLaunchScorecardWindowQueryDiagnostic[];
  scorecard: CityLaunchScorecard | null;
};

export type CityLaunchScorecardWindowDeps = {
  collectScorecard: typeof collectCityLaunchScorecard;
  readFile: typeof fs.readFile;
  writeFile: typeof fs.writeFile;
  mkdir: typeof fs.mkdir;
  runQueryDiagnostics: (timeoutMs?: number) => Promise<CityLaunchScorecardWindowQueryDiagnostic[]>;
};

const defaultDeps: CityLaunchScorecardWindowDeps = {
  collectScorecard: collectCityLaunchScorecard,
  readFile: fs.readFile,
  writeFile: fs.writeFile,
  mkdir: fs.mkdir,
  runQueryDiagnostics: runCityLaunchScorecardQueryDiagnostics,
};

function timestampForFile(date = new Date()) {
  return date.toISOString().replaceAll(":", "-");
}

function asIso(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function metricRows(title: string, metrics: CityLaunchScorecard["supply"]) {
  return [
    `## ${title}`,
    "",
    "| Metric | Status | Actual | Target min | Target max | Note |",
    "| --- | --- | ---: | ---: | --- | --- |",
    ...metrics.map((metric) =>
      [
        metric.label,
        metric.status,
        metric.actual === null ? "not tracked" : String(metric.actual),
        String(metric.targetMin),
        metric.targetMax === null ? "none" : String(metric.targetMax),
        metric.note || "",
      ].map((value) => String(value).replace(/\|/g, "/")).join(" | "),
    ).map((row) => `| ${row} |`),
  ];
}

function diagnosticRows(
  status: CityLaunchScorecardWindowQueryDiagnostic["status"],
  error: string | null,
) {
  return CITY_LAUNCH_GTM_EVIDENCE_SOURCES.map((source) => ({
    collection: source.collection,
    queryName: source.query_name,
    expectedQuery: source.query,
    diagnosticQuery: `collection("${source.collection}").limit(1)`,
    status,
    error,
  })) satisfies CityLaunchScorecardWindowQueryDiagnostic[];
}

export async function runCityLaunchScorecardQueryDiagnostics(timeoutMs = 2_500) {
  if (!db) {
    return diagnosticRows("blocked", "Database not available");
  }
  const firestore = db;

  return Promise.all(CITY_LAUNCH_GTM_EVIDENCE_SOURCES.map(async (source) => {
    const diagnosticQuery = `collection("${source.collection}").limit(1)`;
    try {
      await Promise.race([
        firestore.collection(source.collection).limit(1).get(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Timed out after ${timeoutMs}ms`)), timeoutMs),
        ),
      ]);
      return {
        collection: source.collection,
        queryName: source.query_name,
        expectedQuery: source.query,
        diagnosticQuery,
        status: "verified_accessible",
        error: null,
      } satisfies CityLaunchScorecardWindowQueryDiagnostic;
    } catch (error) {
      return {
        collection: source.collection,
        queryName: source.query_name,
        expectedQuery: source.query,
        diagnosticQuery,
        status: "blocked",
        error: error instanceof Error ? error.message : String(error),
      } satisfies CityLaunchScorecardWindowQueryDiagnostic;
    }
  }));
}

export function resolveCityLaunchScorecardCheckpointHour(
  value: unknown,
): CityLaunchScorecardCheckpointHour {
  const parsed = Number(String(value || "").trim());
  if (CITY_LAUNCH_GTM_CHECKPOINT_HOURS.includes(parsed as CityLaunchScorecardCheckpointHour)) {
    return parsed as CityLaunchScorecardCheckpointHour;
  }
  throw new Error("Required: --checkpoint-hour 24|48|72");
}

export function buildCityLaunchScorecardWindowCloseoutPaths(input: {
  city: string;
  checkpointHour: CityLaunchScorecardCheckpointHour;
  reportsRoot?: string | null;
  timestamp?: string | null;
}) {
  const profile = resolveCityLaunchProfile(input.city);
  const runDirectory = input.reportsRoot
    ? path.join(
        input.reportsRoot,
        profile.key,
        input.timestamp?.trim() || timestampForFile(),
      )
    : null;
  const gtmPaths = buildCityLaunchGtm72hArtifactPaths(
    profile,
    runDirectory || path.join(
      process.cwd(),
      "ops/paperclip/reports/city-launch-execution",
      profile.key,
      "scorecards",
    ),
  );
  const checkpointKey = `${input.checkpointHour}h` as const;
  const markdownPath = runDirectory
    ? gtmPaths.run.scorecardPaths[checkpointKey]
    : gtmPaths.canonical.scorecardPaths[checkpointKey];
  const jsonPath = markdownPath.replace(/\.md$/, ".json");

  return {
    runDirectory,
    jsonPath,
    markdownPath,
    manifestPath: gtmPaths.canonical.scorecardManifestPath,
  } satisfies CityLaunchScorecardWindowCloseoutArtifacts;
}

async function readWindowFromManifest(input: {
  manifestPath: string;
  checkpointHour: CityLaunchScorecardCheckpointHour;
  deps: CityLaunchScorecardWindowDeps;
}) {
  try {
    const manifest = JSON.parse(await input.deps.readFile(input.manifestPath, "utf8")) as {
      scorecard_windows?: Array<Record<string, unknown>>;
    };
    return manifest.scorecard_windows?.find(
      (window) => Number(window.checkpoint_hour) === input.checkpointHour,
    ) || null;
  } catch {
    return null;
  }
}

export async function buildCityLaunchScorecardWindowCloseout(input: {
  city: string;
  checkpointHour: CityLaunchScorecardCheckpointHour;
  reportsRoot?: string | null;
  timestamp?: string | null;
  nowIso?: string | null;
  allowBeforeWindow?: boolean | null;
  queryLimits?: Partial<CityLaunchScorecardQueryLimits> | null;
  runQueryDiagnostics?: boolean | null;
  queryTimeoutMs?: number | null;
  scorecardManifestPath?: string | null;
  deps?: Partial<CityLaunchScorecardWindowDeps>;
}): Promise<CityLaunchScorecardWindowCloseout> {
  const deps = { ...defaultDeps, ...(input.deps || {}) };
  const profile = resolveCityLaunchProfile(input.city);
  const checkpointKey = `${input.checkpointHour}h` as const;
  const artifacts = buildCityLaunchScorecardWindowCloseoutPaths({
    city: profile.city,
    checkpointHour: input.checkpointHour,
    reportsRoot: input.reportsRoot,
    timestamp: input.timestamp,
  });
  const manifestPath = input.scorecardManifestPath || artifacts.manifestPath;
  const window = await readWindowFromManifest({
    manifestPath,
    checkpointHour: input.checkpointHour,
    deps,
  });
  const windowStartIso = asIso(window?.window_start_iso);
  const windowEndIso = asIso(window?.window_end_iso);
  const nowIso = input.nowIso || new Date().toISOString();
  const queryLimits = resolveCityLaunchScorecardQueryLimits(input.queryLimits);
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!window) {
    blockers.push(`No scorecard window manifest entry found for ${checkpointKey} at ${manifestPath}.`);
  }

  const due = windowEndIso ? new Date(nowIso).getTime() >= new Date(windowEndIso).getTime() : false;
  if (windowEndIso && !due) {
    warnings.push(
      `${checkpointKey} window is not due until ${windowEndIso}; this closeout cannot be used as performance proof yet.`,
    );
  }

  let scorecard: CityLaunchScorecard | null = null;
  let queryDiagnostics: CityLaunchScorecardWindowQueryDiagnostic[] = diagnosticRows(
    "not_run",
    null,
  );
  try {
    scorecard = await deps.collectScorecard(profile.city, {
      queryLimits,
    });
    queryDiagnostics = diagnosticRows("covered_by_scorecard_query", null);
  } catch (error) {
    const scorecardError = error instanceof Error ? error.message : String(error);
    blockers.push(
      `Unable to query first-party city-launch scorecard evidence: ${scorecardError}`,
    );
    queryDiagnostics = input.runQueryDiagnostics === true
      ? await deps.runQueryDiagnostics(input.queryTimeoutMs || undefined)
      : diagnosticRows("blocked", scorecardError);
  }

  const status: CityLaunchScorecardWindowStatus = blockers.length > 0
    ? "blocked"
    : due
      ? "complete"
      : input.allowBeforeWindow
        ? "early_snapshot"
        : "scheduled_not_due";

  return {
    schemaVersion: CITY_LAUNCH_SCORECARD_WINDOW_SCHEMA_VERSION,
    city: profile.city,
    citySlug: slugifyCityName(profile.city),
    generatedAt: nowIso,
    checkpointHour: input.checkpointHour,
    checkpointKey,
    status,
    windowStartIso,
    windowEndIso,
    dueAtIso: windowEndIso,
    allowBeforeWindow: input.allowBeforeWindow === true,
    queryLimits,
    blockers,
    warnings,
    artifacts: {
      ...artifacts,
      manifestPath,
    },
    evidenceSources: CITY_LAUNCH_GTM_EVIDENCE_SOURCES,
    queryDiagnostics,
    scorecard,
  };
}

export function renderCityLaunchScorecardWindowCloseoutMarkdown(
  closeout: CityLaunchScorecardWindowCloseout,
) {
  const scorecard = closeout.scorecard;
  const lines = [
    `# ${closeout.city} ${closeout.checkpointKey} City Launch Scorecard Closeout`,
    "",
    `- status: ${closeout.status}`,
    `- city_slug: ${closeout.citySlug}`,
    `- checkpoint_hour: ${closeout.checkpointHour}`,
    `- generated_at: ${closeout.generatedAt}`,
    `- window_start_iso: ${closeout.windowStartIso || "missing"}`,
    `- window_end_iso: ${closeout.windowEndIso || "missing"}`,
    `- query_limits: growth_events=${closeout.queryLimits.growthEvents}, inboundRequests=${closeout.queryLimits.inboundRequests}, users=${closeout.queryLimits.users}, waitlistSubmissions=${closeout.queryLimits.waitlistSubmissions}`,
    `- manifest_path: ${closeout.artifacts.manifestPath}`,
    `- json_path: ${closeout.artifacts.jsonPath}`,
    `- markdown_path: ${closeout.artifacts.markdownPath}`,
    "",
    "## Evidence Boundary",
    closeout.status === "complete"
      ? "This checkpoint may be used as closeout evidence only for the first-party collections and query names listed below."
      : "This checkpoint is not proof of launch performance unless its status is `complete` and the first-party collections below were queried successfully.",
    "",
    "## Blockers",
    ...(closeout.blockers.length > 0 ? closeout.blockers.map((entry) => `- ${entry}`) : ["- none"]),
    "",
    "## Warnings",
    ...(closeout.warnings.length > 0 ? closeout.warnings.map((entry) => `- ${entry}`) : ["- none"]),
    "",
    "## Firestore/Admin Evidence Sources",
    "| Collection | Query name | Query | Purpose |",
    "| --- | --- | --- | --- |",
    ...closeout.evidenceSources.map((source) =>
      `| ${source.collection} | ${source.query_name} | \`${source.query}\` | ${source.purpose.replace(/\|/g, "/")} |`,
    ),
    "",
    "## Query Diagnostics",
    "| Collection | Query name | Status | Diagnostic query | Error |",
    "| --- | --- | --- | --- | --- |",
    ...closeout.queryDiagnostics.map((diagnostic) =>
      [
        diagnostic.collection,
        diagnostic.queryName,
        diagnostic.status,
        `\`${diagnostic.diagnosticQuery}\``,
        diagnostic.error || "",
      ].map((value) => String(value).replace(/\|/g, "/")).join(" | "),
    ).map((row) => `| ${row} |`),
    "",
  ];

  if (scorecard) {
    lines.push(
      "## Activation",
      "",
      `- activation_status: ${scorecard.activation.status || "missing"}`,
      `- founder_approved: ${scorecard.activation.founderApproved}`,
      `- root_issue_id: ${scorecard.activation.rootIssueId || "missing"}`,
      `- widening_allowed: ${scorecard.activation.wideningAllowed}`,
      `- source_activation_payload_path: ${scorecard.activation.sourceActivationPayloadPath || "missing"}`,
      "",
      "## Budget",
      "",
      `- budget_tier: ${scorecard.budget.tier || "missing"}`,
      `- total_recorded_spend_usd: ${scorecard.budget.totalRecordedSpendUsd}`,
      `- within_policy_spend_usd: ${scorecard.budget.withinPolicySpendUsd}`,
      `- outside_policy_spend_usd: ${scorecard.budget.outsidePolicySpendUsd}`,
      "",
      ...metricRows("Supply Metrics", scorecard.supply),
      "",
      ...metricRows("City-Opening Metrics", scorecard.cityOpening),
      "",
      ...metricRows("Demand Metrics", scorecard.demand),
      "",
      "## Scorecard Warnings",
      ...(scorecard.warnings.length > 0 ? scorecard.warnings.map((entry) => `- ${entry}`) : ["- none"]),
      "",
      "## Scorecard Data Sources",
      ...scorecard.dataSources.map((entry) => `- ${entry}`),
    );
  } else {
    lines.push("## Scorecard", "", "- first-party scorecard query failed; see blockers");
  }

  return lines.join("\n");
}

export async function writeCityLaunchScorecardWindowCloseout(input: {
  city: string;
  checkpointHour: CityLaunchScorecardCheckpointHour;
  reportsRoot?: string | null;
  timestamp?: string | null;
  nowIso?: string | null;
  allowBeforeWindow?: boolean | null;
  queryLimits?: Partial<CityLaunchScorecardQueryLimits> | null;
  runQueryDiagnostics?: boolean | null;
  queryTimeoutMs?: number | null;
  scorecardManifestPath?: string | null;
  deps?: Partial<CityLaunchScorecardWindowDeps>;
}) {
  const deps = { ...defaultDeps, ...(input.deps || {}) };
  const closeout = await buildCityLaunchScorecardWindowCloseout({
    ...input,
    deps,
  });
  await deps.mkdir(path.dirname(closeout.artifacts.markdownPath), { recursive: true });
  await deps.writeFile(
    closeout.artifacts.jsonPath,
    JSON.stringify(closeout, null, 2),
    "utf8",
  );
  await deps.writeFile(
    closeout.artifacts.markdownPath,
    renderCityLaunchScorecardWindowCloseoutMarkdown(closeout),
    "utf8",
  );
  return closeout;
}
