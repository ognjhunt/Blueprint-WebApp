import {
  COMPANY_METRIC_DEFINITIONS,
  COMPANY_METRICS_CONTRACT_VERSION,
  type CompanyMetricsSnapshot,
  collectCompanyMetricsSnapshot,
  buildMetricsWindow,
  projectCompanyMetricsView,
} from "./companyMetrics";
import type { BlockingCondition, NextAction, OperatingGraphState } from "./operatingGraphTypes";

export const COMPANY_SCOREBOARD_VERSION = "2026-04-20.company-scoreboard.v1";

export type CompanyScoreboard = {
  generatedAt: string;
  contract: {
    version: string;
    metrics: typeof COMPANY_METRIC_DEFINITIONS;
  };
  ceoOperatingScreen: ReturnType<typeof buildCeoOperatingScreen>;
  views: {
    daily: ReturnType<typeof projectCompanyMetricsView>;
    weekly: ReturnType<typeof projectCompanyMetricsView>;
  };
};

function timestampMs(value: string | null | undefined) {
  const parsed = Date.parse(value || "");
  return Number.isNaN(parsed) ? 0 : parsed;
}

function sortByNewest<T>(items: T[], readIso: (item: T) => string | null | undefined) {
  return [...items].sort((left, right) => timestampMs(readIso(right)) - timestampMs(readIso(left)));
}

function isCityProgramState(state: OperatingGraphState) {
  return state.entityType === "city_program";
}

function summarizeMetricHealth(view: ReturnType<typeof projectCompanyMetricsView>) {
  const blocked = view.metrics
    .filter((metric) => metric.status === "blocked")
    .map((metric) => ({
      key: metric.key,
      label: metric.label,
      note: metric.note,
    }));
  const partial = view.metrics
    .filter((metric) => metric.status === "partial")
    .map((metric) => ({
      key: metric.key,
      label: metric.label,
      note: metric.note,
    }));
  return {
    truthful: view.summary.truthfulCount,
    partial: view.summary.partialCount,
    blocked: view.summary.blockedCount,
    blockedMetrics: blocked.slice(0, 6),
    partialMetrics: partial.slice(0, 6),
  };
}

function readCityClosureHint(
  snapshot: CompanyMetricsSnapshot,
  activeCity: OperatingGraphState | null,
) {
  if (!activeCity) {
    return null;
  }

  const cityEvents = snapshot.operatingGraphEvents.filter(
    (event) => event.city_slug === activeCity.citySlug,
  );
  const buyerOutcomes = snapshot.buyerOutcomes.filter(
    (outcome) =>
      outcome.cityProgramId === activeCity.entityId
      || outcome.cityProgramId === activeCity.canonicalForeignKeys.cityProgramId,
  );

  return {
    city: activeCity.city,
    citySlug: activeCity.citySlug,
    graphEventCount: cityEvents.length,
    supplyTargetCount: snapshot.operatingGraphStates.filter(
      (state) => state.entityType === "supply_target" && state.citySlug === activeCity.citySlug,
    ).length,
    captureRunCount: snapshot.operatingGraphStates.filter(
      (state) => state.entityType === "capture_run" && state.citySlug === activeCity.citySlug,
    ).length,
    packageRunCount: snapshot.operatingGraphStates.filter(
      (state) => state.entityType === "package_run" && state.citySlug === activeCity.citySlug,
    ).length,
    hostedReviewRunCount: snapshot.operatingGraphStates.filter(
      (state) => state.entityType === "hosted_review_run" && state.citySlug === activeCity.citySlug,
    ).length,
    buyerOutcomeCount: buyerOutcomes.length,
  };
}

function buildCeoOperatingScreen(
  snapshot: CompanyMetricsSnapshot,
  views: {
    daily: ReturnType<typeof projectCompanyMetricsView>;
    weekly: ReturnType<typeof projectCompanyMetricsView>;
  },
  generatedAt: string,
) {
  const cityStates = sortByNewest(
    snapshot.operatingGraphStates.filter(isCityProgramState),
    (state) => state.latestEventAtIso,
  );
  const activeCity = cityStates[0] || null;
  const activeCityBlockers = (activeCity?.blockingConditions || []) as BlockingCondition[];
  const activeCityNextActions = (activeCity?.nextActions || []) as NextAction[];
  const sinceMs = timestampMs(generatedAt) - 24 * 60 * 60 * 1000;
  const recentEvents = snapshot.operatingGraphEvents.filter(
    (event) => timestampMs(event.recorded_at_iso) >= sinceMs,
  );
  const recentBuyerOutcomes = snapshot.buyerOutcomes.filter(
    (outcome) => timestampMs(outcome.recordedAtIso) >= sinceMs,
  );
  const recentHumanThreads = snapshot.humanBlockerThreads.filter(
    (thread) => timestampMs(thread.createdAtIso) >= sinceMs,
  );

  const needsFounder = [
    ...recentHumanThreads.map((thread) => ({
      id: thread.blockerId || thread.id,
      title: thread.title || thread.blockerId,
      reason: "founder_inbox_thread",
      source: thread.channel || "email",
    })),
    ...activeCityBlockers
      .filter((blocker) => blocker.status === "awaiting_human_decision")
      .map((blocker) => ({
        id: blocker.id,
        title: blocker.summary,
        reason: "awaiting_human_decision",
        source: blocker.sourceRef || activeCity?.stateKey || null,
      })),
  ].slice(0, 8);

  const readyActions = activeCityNextActions
    .filter((action) => action.status === "ready_to_execute")
    .slice(0, 8)
    .map((action) => ({
      id: action.id,
      owner: action.owner,
      summary: action.summary,
      sourceRef: action.sourceRef || null,
    }));

  const waitingActions = activeCityNextActions
    .filter(
      (action) =>
        action.status === "awaiting_external_confirmation"
        || action.status === "awaiting_human_decision",
    )
    .slice(0, 8)
    .map((action) => ({
      id: action.id,
      owner: action.owner,
      status: action.status || null,
      summary: action.summary,
      sourceRef: action.sourceRef || null,
    }));

  const recentChangeSummary = {
    operatingGraphEvents: recentEvents.length,
    buyerOutcomes: recentBuyerOutcomes.length,
    founderThreads: recentHumanThreads.length,
    latestEvents: sortByNewest(recentEvents, (event) => event.recorded_at_iso)
      .slice(0, 6)
      .map((event) => ({
        id: event.id,
        city: event.city,
        stage: event.stage,
        summary: event.summary,
        sourceRepo: event.source_repo,
        recordedAtIso: event.recorded_at_iso,
      })),
  };

  const activeCityClosure = readCityClosureHint(snapshot, activeCity);

  return {
    generatedAt,
    activeCity: activeCity
      ? {
          city: activeCity.city,
          citySlug: activeCity.citySlug,
          currentStage: activeCity.currentStage,
          latestSummary: activeCity.latestSummary,
          latestEventAtIso: activeCity.latestEventAtIso,
          blockers: activeCityBlockers,
          nextActionCount: activeCityNextActions.length,
        }
      : null,
    lifecycleStop: activeCity
      ? {
          stage: activeCity.currentStage,
          summary: activeCity.latestSummary,
          blockers: activeCityBlockers.slice(0, 8),
          waitingActions,
        }
      : {
          stage: "no_active_city",
          summary: "No city program state is projected into the operating graph.",
          blockers: [],
          waitingActions: [],
        },
    needsFounder,
    nextAutonomousActions: readyActions,
    recentChangeSummary,
    metricHealth: {
      daily: summarizeMetricHealth(views.daily),
      weekly: summarizeMetricHealth(views.weekly),
    },
    activeCityClosure,
  };
}

export function buildCompanyScoreboard(
  snapshot: CompanyMetricsSnapshot,
  options?: {
    generatedAt?: string;
    dailyLookbackDays?: number;
    weeklyLookbackDays?: number;
  },
): CompanyScoreboard {
  const generatedAt = options?.generatedAt || snapshot.generatedAt || new Date().toISOString();
  const dailyWindow = buildMetricsWindow({
    key: "daily",
    lookbackDays: options?.dailyLookbackDays ?? 1,
    endAt: generatedAt,
  });
  const weeklyWindow = buildMetricsWindow({
    key: "weekly",
    lookbackDays: options?.weeklyLookbackDays ?? 7,
    endAt: generatedAt,
  });

  const views = {
    daily: projectCompanyMetricsView(snapshot, dailyWindow),
    weekly: projectCompanyMetricsView(snapshot, weeklyWindow),
  };

  return {
    generatedAt,
    contract: {
      version: COMPANY_METRICS_CONTRACT_VERSION,
      metrics: COMPANY_METRIC_DEFINITIONS,
    },
    ceoOperatingScreen: buildCeoOperatingScreen(snapshot, views, generatedAt),
    views,
  };
}

export async function collectCompanyScoreboard(options?: {
  dailyLookbackDays?: number;
  weeklyLookbackDays?: number;
}) {
  const snapshot = await collectCompanyMetricsSnapshot();
  return buildCompanyScoreboard(snapshot, {
    generatedAt: snapshot.generatedAt,
    dailyLookbackDays: options?.dailyLookbackDays,
    weeklyLookbackDays: options?.weeklyLookbackDays,
  });
}
