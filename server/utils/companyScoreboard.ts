import {
  COMPANY_METRIC_DEFINITIONS,
  COMPANY_METRICS_CONTRACT_VERSION,
  type CompanyMetricsSnapshot,
  collectCompanyMetricsSnapshot,
  buildMetricsWindow,
  projectCompanyMetricsView,
} from "./companyMetrics";
import type {
  BlockingCondition,
  NextAction,
  OperatingGraphEvent,
  OperatingGraphStage,
  OperatingGraphState,
} from "./operatingGraphTypes";

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

const CAPTURE_TO_HOSTED_REVIEW_STAGES = [
  "capture_uploaded",
  "pipeline_packaging",
  "package_ready",
  "hosted_review_ready",
  "hosted_review_started",
] as const satisfies readonly OperatingGraphStage[];

type CaptureToHostedReviewStage = (typeof CAPTURE_TO_HOSTED_REVIEW_STAGES)[number];

function isCaptureToHostedReviewStage(stage: OperatingGraphStage): stage is CaptureToHostedReviewStage {
  return CAPTURE_TO_HOSTED_REVIEW_STAGES.includes(stage as CaptureToHostedReviewStage);
}

function readMetadataString(
  metadata: Record<string, unknown> | undefined,
  keys: string[],
) {
  if (!metadata) return "";

  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  const nested = metadata.canonical_foreign_keys;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    const nestedRecord = nested as Record<string, unknown>;
    for (const key of keys) {
      const value = nestedRecord[key];
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
  }

  return "";
}

function eventMatchesAnyMetadata(
  event: OperatingGraphEvent,
  keyGroups: string[][],
  candidates: Set<string>,
) {
  return keyGroups.some((keys) => {
    const value = readMetadataString(event.metadata, keys);
    return Boolean(value && candidates.has(value));
  });
}

function latestIso(values: Array<string | null | undefined>) {
  return values
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => timestampMs(right) - timestampMs(left))[0] || null;
}

function buildLifecycleNextAction(input: {
  captureId: string;
  nextMissingStage: CaptureToHostedReviewStage | null;
  sourceRef: string;
}): NextAction | null {
  if (!input.nextMissingStage) {
    return null;
  }

  const nextActionByStage: Record<CaptureToHostedReviewStage, Omit<NextAction, "id" | "sourceRef"> | null> = {
    capture_uploaded: null,
    pipeline_packaging: {
      summary: "Run or verify pipeline packaging from the durable uploaded capture.",
      owner: "pipeline-codex",
      status: "ready_to_execute",
    },
    package_ready: {
      summary: "Wait for package_ready pipeline sync evidence from the uploaded capture.",
      owner: "pipeline-codex",
      status: "awaiting_external_confirmation",
    },
    hosted_review_ready: {
      summary: "Verify hosted-review prerequisites in WebApp state without overstating readiness.",
      owner: "webapp-codex",
      status: "ready_to_execute",
    },
    hosted_review_started: {
      summary: "Start buyer-facing hosted review from the ready package and write runtime evidence.",
      owner: "buyer-success-agent",
      status: "ready_to_execute",
    },
  };
  const action = nextActionByStage[input.nextMissingStage];
  if (!action) return null;

  return {
    id: `capture_to_hosted_review:${input.captureId}:${input.nextMissingStage}`,
    sourceRef: input.sourceRef,
    ...action,
  };
}

function buildCaptureToHostedReviewLifecycle(snapshot: CompanyMetricsSnapshot) {
  const uploadedCaptures = snapshot.captureSubmissions.filter((submission) =>
    Boolean(submission.captureUploadedAtIso),
  );
  const rows = uploadedCaptures.map((submission) => {
    const captureId = submission.captureId || submission.id;
    const identityCandidates = new Set(
      [
        captureId,
        submission.siteSubmissionId,
        submission.buyerRequestId,
      ].filter((value): value is string => Boolean(value)),
    );
    const packageEvents = snapshot.operatingGraphEvents.filter(
      (event) =>
        event.entity_type === "package_run"
        && eventMatchesAnyMetadata(
          event,
          [
            ["capture_id", "captureId"],
            ["site_submission_id", "siteSubmissionId"],
            ["buyer_request_id", "buyerRequestId"],
          ],
          identityCandidates,
        ),
    );
    const packageIds = new Set(
      packageEvents
        .map((event) => readMetadataString(event.metadata, ["package_id", "packageId"]))
        .filter(Boolean),
    );
    const hostedReviewEvents = snapshot.operatingGraphEvents.filter((event) => {
      if (event.entity_type !== "hosted_review_run") {
        return false;
      }
      if (
        eventMatchesAnyMetadata(
          event,
          [
            ["capture_id", "captureId"],
            ["site_submission_id", "siteSubmissionId"],
            ["buyer_request_id", "buyerRequestId"],
          ],
          identityCandidates,
        )
      ) {
        return true;
      }
      return packageIds.size > 0
        && eventMatchesAnyMetadata(
          event,
          [["package_id", "packageId"]],
          packageIds,
        );
    });
    const lifecycleEvents = [...packageEvents, ...hostedReviewEvents].filter((event) =>
      isCaptureToHostedReviewStage(event.stage),
    );
    const completedStageSet = new Set<CaptureToHostedReviewStage>(["capture_uploaded"]);
    for (const event of lifecycleEvents) {
      if (isCaptureToHostedReviewStage(event.stage)) {
        completedStageSet.add(event.stage);
      }
    }
    const completedStages = CAPTURE_TO_HOSTED_REVIEW_STAGES.filter((stage) =>
      completedStageSet.has(stage),
    );
    const currentStage = completedStages[completedStages.length - 1];
    const currentStageIndex = CAPTURE_TO_HOSTED_REVIEW_STAGES.indexOf(currentStage);
    const nextMissingStage =
      CAPTURE_TO_HOSTED_REVIEW_STAGES
        .slice(currentStageIndex + 1)
        .find((stage) => !completedStageSet.has(stage)) || null;
    const evidenceEvents = sortByNewest(
      lifecycleEvents,
      (event) => event.recorded_at_iso,
    );
    const evidenceRefs = [
      `capture_submissions/${submission.id || captureId}`,
      ...evidenceEvents.map((event) => `operatingGraphEvents/${event.id}`),
    ];

    return {
      captureId,
      city: submission.city,
      citySlug: submission.citySlug,
      currentStage,
      completedStages,
      nextMissingStage,
      latestEvidenceAtIso: latestIso([
        submission.captureUploadedAtIso,
        ...evidenceEvents.map((event) => event.recorded_at_iso),
      ]),
      sourceRepos: Array.from(
        new Set([
          "BlueprintCapture",
          ...evidenceEvents.map((event) => event.source_repo),
        ]),
      ),
      evidenceRefs,
      packageRunIds: Array.from(new Set(packageEvents.map((event) => event.entity_id))),
      hostedReviewRunIds: Array.from(new Set(hostedReviewEvents.map((event) => event.entity_id))),
      nextAction: buildLifecycleNextAction({
        captureId,
        nextMissingStage,
        sourceRef: evidenceRefs[0],
      }),
    };
  });
  const stageCounts = CAPTURE_TO_HOSTED_REVIEW_STAGES.reduce(
    (acc, stage) => {
      acc[stage] = rows.filter((row) => row.currentStage === stage).length;
      return acc;
    },
    {} as Record<CaptureToHostedReviewStage, number>,
  );

  return {
    summary: {
      uploadedCaptures: rows.length,
      packageReadyCaptures: rows.filter(
        (row) => row.completedStages.includes("package_ready"),
      ).length,
      hostedReviewReadyCaptures: rows.filter(
        (row) => row.completedStages.includes("hosted_review_ready"),
      ).length,
      hostedReviewStartedCaptures: rows.filter((row) =>
        row.completedStages.includes("hosted_review_started"),
      ).length,
      currentStageCounts: stageCounts,
    },
    rows,
  };
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
    (thread) =>
      thread.gateMode === "universal_founder_inbox"
      && timestampMs(thread.createdAtIso) >= sinceMs,
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
  const captureToHostedReviewLifecycle = buildCaptureToHostedReviewLifecycle(snapshot);

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
    captureToHostedReviewLifecycle,
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
