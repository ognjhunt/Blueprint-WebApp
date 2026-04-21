import {
  COMPANY_METRIC_DEFINITIONS,
  COMPANY_METRICS_CONTRACT_VERSION,
  type CompanyMetricsSnapshot,
  collectCompanyMetricsSnapshot,
  buildMetricsWindow,
  projectCompanyMetricsView,
} from "./companyMetrics";

export const COMPANY_SCOREBOARD_VERSION = "2026-04-20.company-scoreboard.v1";

export type CompanyScoreboard = {
  generatedAt: string;
  contract: {
    version: string;
    metrics: typeof COMPANY_METRIC_DEFINITIONS;
  };
  views: {
    daily: ReturnType<typeof projectCompanyMetricsView>;
    weekly: ReturnType<typeof projectCompanyMetricsView>;
  };
};

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

  return {
    generatedAt,
    contract: {
      version: COMPANY_METRICS_CONTRACT_VERSION,
      metrics: COMPANY_METRIC_DEFINITIONS,
    },
    views: {
      daily: projectCompanyMetricsView(snapshot, dailyWindow),
      weekly: projectCompanyMetricsView(snapshot, weeklyWindow),
    },
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
