import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import {
  listCityLaunchActivations,
  listCityLaunchBudgetEvents,
  summarizeCityLaunchLedgers,
} from "./cityLaunchLedgers";
import {
  projectHostedReviewRunState,
  projectPackageRunState,
} from "./operatingGraphProjectors";
import type {
  HostedReviewRunProjection,
  OperatingGraphEvent,
  OperatingGraphState,
  PackageRunProjection,
} from "./operatingGraphTypes";

export const COMPANY_METRICS_CONTRACT_VERSION = "2026-04-20.company-metrics.v1";

export type CompanyMetricKey =
  | "capture_fill_rate_by_city"
  | "capture_to_upload_success_rate"
  | "upload_to_package_success_rate"
  | "package_ready_latency"
  | "hosted_review_ready_rate"
  | "hosted_review_start_rate"
  | "buyer_outcome_conversion_rate"
  | "commercial_handoff_rate"
  | "city_launch_cac"
  | "city_launch_payback_estimate"
  | "blocker_recurrence_rate"
  | "human_interrupt_rate";

export type CompanyMetricStatus = "truthful" | "partial" | "blocked";
export type CompanyMetricUnit = "ratio" | "hours" | "usd" | "count_per_week";

export type CompanyMetricDefinition = {
  key: CompanyMetricKey;
  label: string;
  unit: CompanyMetricUnit;
  owner: string;
  description: string;
  sourceNotes: string[];
};

export type CompanyMetricCityValue = {
  city: string;
  value: number | null;
  numerator: number | null;
  denominator: number | null;
};

export type CompanyMetricResult = {
  key: CompanyMetricKey;
  label: string;
  unit: CompanyMetricUnit;
  status: CompanyMetricStatus;
  value: number | null;
  numerator: number | null;
  denominator: number | null;
  note: string | null;
  cityValues?: CompanyMetricCityValue[];
};

export type CompanyMetricsWindow = {
  key: "daily" | "weekly";
  lookbackDays: number;
  startAt: string;
  endAt: string;
};

export type CompanyMetricsView = {
  window: CompanyMetricsWindow;
  metrics: CompanyMetricResult[];
  summary: {
    truthfulCount: number;
    partialCount: number;
    blockedCount: number;
  };
};

export type CompanyMetricsSnapshot = {
  generatedAt: string;
  cityLaunchLedgers: Array<{
    city: string;
    trackedSupplyProspectsContacted: number;
    onboardedCapturers: number;
  }>;
  budgetEvents: Array<{
    city: string;
    amountUsd: number;
    eventType: string | null;
    createdAtIso: string | null;
  }>;
  captureSubmissions: Array<{
    id: string;
    captureId: string;
    sceneId: string | null;
    siteSubmissionId: string | null;
    buyerRequestId: string | null;
    captureJobId: string | null;
    city: string | null;
    citySlug: string | null;
    submittedAtIso: string | null;
    captureStartedAtIso: string | null;
    captureUploadedAtIso: string | null;
    uploadState: string | null;
    status: string | null;
  }>;
  operatingGraphEvents: OperatingGraphEvent[];
  operatingGraphStates: OperatingGraphState[];
  buyerOutcomes: Array<{
    id: string;
    buyerOutcomeId: string;
    cityProgramId: string | null;
    siteSubmissionId: string | null;
    captureId: string | null;
    hostedReviewRunId: string | null;
    buyerAccountId: string | null;
    outcomeType: string | null;
    outcomeStatus: string | null;
    recordedAtIso: string | null;
    commercialValueUsd: number | null;
  }>;
  humanBlockerThreads: Array<{
    id: string;
    blockerId: string;
    title: string | null;
    channel: string | null;
    gateMode: string | null;
    createdAtIso: string | null;
    reportPaths: string[];
  }>;
  humanBlockerDispatches: Array<{
    id: string;
    blockerId: string | null;
    createdAtIso: string | null;
    city?: string | null;
    title?: string | null;
    reportPaths?: string[];
  }>;
};

export const COMPANY_METRIC_DEFINITIONS: CompanyMetricDefinition[] = [
  {
    key: "capture_fill_rate_by_city",
    label: "Capture fill rate by city",
    unit: "ratio",
    owner: "analytics-agent",
    description:
      "Share of active city supply targets that have at least one linked capture reaching upload truth.",
    sourceNotes: ["cityLaunchLedgers", "capture_submissions"],
  },
  {
    key: "capture_to_upload_success_rate",
    label: "Capture-to-upload success rate",
    unit: "ratio",
    owner: "analytics-agent",
    description:
      "Share of capture runs entering capture_in_progress that later reach capture_uploaded.",
    sourceNotes: ["capture_submissions.lifecycle.capture_started_at", "capture_submissions.lifecycle.capture_uploaded_at"],
  },
  {
    key: "upload_to_package_success_rate",
    label: "Upload-to-package success rate",
    unit: "ratio",
    owner: "analytics-agent",
    description:
      "Share of uploaded captures that later reach package_ready through pipeline sync.",
    sourceNotes: ["capture_submissions", "operatingGraphEvents.package_run"],
  },
  {
    key: "package_ready_latency",
    label: "Package ready latency",
    unit: "hours",
    owner: "analytics-agent",
    description:
      "Median hours from capture_uploaded to package_ready with p90 called out in the note.",
    sourceNotes: ["capture_submissions.lifecycle.capture_uploaded_at", "operatingGraphEvents.package_run"],
  },
  {
    key: "hosted_review_ready_rate",
    label: "Hosted-review ready rate",
    unit: "ratio",
    owner: "analytics-agent",
    description:
      "Share of package runs that truthfully reach hosted_review_ready.",
    sourceNotes: ["operatingGraphEvents.package_run"],
  },
  {
    key: "hosted_review_start_rate",
    label: "Hosted-review start rate",
    unit: "ratio",
    owner: "analytics-agent",
    description:
      "Share of hosted-review-ready package flows that later reach hosted_review_started.",
    sourceNotes: ["operatingGraphEvents.package_run", "operatingGraphEvents.hosted_review_run"],
  },
  {
    key: "buyer_outcome_conversion_rate",
    label: "Buyer outcome conversion rate",
    unit: "ratio",
    owner: "analytics-agent",
    description:
      "Share of hosted-review-started flows that later reach a recorded positive buyer outcome.",
    sourceNotes: ["operatingGraphEvents.hosted_review_run", "buyerOutcomes"],
  },
  {
    key: "commercial_handoff_rate",
    label: "Commercial handoff rate",
    unit: "ratio",
    owner: "analytics-agent",
    description:
      "Share of buyer-engaged hosted-review flows that produce a durable follow-up or handoff state.",
    sourceNotes: ["operatingGraphEvents.hosted_review_run"],
  },
  {
    key: "city_launch_cac",
    label: "City-launch CAC",
    unit: "usd",
    owner: "analytics-agent",
    description:
      "Current spend per city program reaching buyer-ready package truth, excluding unattributed labor cost.",
    sourceNotes: ["cityLaunchBudgetEvents", "operatingGraphEvents.package_run"],
  },
  {
    key: "city_launch_payback_estimate",
    label: "City-launch payback estimate",
    unit: "ratio",
    owner: "analytics-agent",
    description:
      "Current cost-to-recorded-value payback estimate from launch spend and positive buyer outcome value.",
    sourceNotes: ["cityLaunchBudgetEvents", "buyerOutcomes"],
  },
  {
    key: "blocker_recurrence_rate",
    label: "Blocker recurrence rate",
    unit: "ratio",
    owner: "analytics-agent",
    description:
      "Repeated blocker fingerprints over total blocker dispatches in the selected window.",
    sourceNotes: ["humanBlockerDispatches"],
  },
  {
    key: "human_interrupt_rate",
    label: "Human-interrupt rate",
    unit: "count_per_week",
    owner: "analytics-agent",
    description:
      "Founder-inbox interrupt threads per city, weeklyized over the selected window.",
    sourceNotes: ["humanBlockerThreads"],
  },
] as const;

function coerceString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toIso(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  if (typeof value === "object" && value && "toDate" in value && typeof value.toDate === "function") {
    const date = value.toDate();
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
  }
  return null;
}

function toNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isWithinWindow(iso: string | null, window: CompanyMetricsWindow) {
  if (!iso) return false;
  const time = Date.parse(iso);
  return !Number.isNaN(time)
    && time >= Date.parse(window.startAt)
    && time <= Date.parse(window.endAt);
}

function computeRate(numerator: number, denominator: number) {
  if (denominator <= 0) return null;
  return numerator / denominator;
}

function computeAverage(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function computeMedian(values: number[]) {
  if (!values.length) return null;
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 0
    ? (ordered[middle - 1] + ordered[middle]) / 2
    : ordered[middle];
}

function computePercentile(values: number[], percentile: number) {
  if (!values.length) return null;
  const ordered = [...values].sort((left, right) => left - right);
  const index = Math.min(
    ordered.length - 1,
    Math.max(0, Math.ceil((percentile / 100) * ordered.length) - 1),
  );
  return ordered[index];
}

function titleCaseFromSlug(slug: string) {
  return slug
    .split("-")
    .map((part) =>
      part.length <= 2
        ? part.toUpperCase()
        : `${part[0]?.toUpperCase() || ""}${part.slice(1)}`,
    )
    .join(" ");
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildMetric(
  key: CompanyMetricKey,
  input: Omit<CompanyMetricResult, "key" | "label" | "unit">,
): CompanyMetricResult {
  const definition = COMPANY_METRIC_DEFINITIONS.find((metric) => metric.key === key);
  if (!definition) {
    throw new Error(`Unknown metric key: ${key}`);
  }
  return {
    key,
    label: definition.label,
    unit: definition.unit,
    ...input,
  };
}

function buildMetricsWindow(input: {
  key: "daily" | "weekly";
  lookbackDays: number;
  endAt?: string;
}) {
  const endAt = toIso(input.endAt) || new Date().toISOString();
  const endTime = Date.parse(endAt);
  const startAt = new Date(endTime - input.lookbackDays * 86_400_000).toISOString();
  return {
    key: input.key,
    lookbackDays: input.lookbackDays,
    startAt,
    endAt,
  } satisfies CompanyMetricsWindow;
}

function deriveDispatchCity(
  item: {
    blockerId?: string | null;
    title?: string | null;
    city?: string | null;
    reportPaths?: string[];
  },
  knownCities: Map<string, string>,
) {
  const explicitCity = coerceString(item.city);
  if (explicitCity) {
    return explicitCity;
  }

  const haystacks = [
    coerceString(item.blockerId),
    coerceString(item.title),
    ...(item.reportPaths || []).map((value) => coerceString(value)),
  ]
    .filter(Boolean)
    .map((value) => value.toLowerCase());

  for (const [slug, label] of knownCities.entries()) {
    if (haystacks.some((value) => value.includes(slug))) {
      return label;
    }
  }

  const fallbackSource = haystacks.find(Boolean) || "";
  const fallbackMatch = fallbackSource.match(/([a-z]+(?:-[a-z]+)*-[a-z]{2})/);
  return fallbackMatch ? titleCaseFromSlug(fallbackMatch[1]) : "Unknown";
}

function groupOperatingGraphEvents(snapshot: CompanyMetricsSnapshot) {
  const grouped = new Map<string, OperatingGraphEvent[]>();
  for (const event of snapshot.operatingGraphEvents) {
    const key = `${event.entity_type}:${event.entity_id}`;
    const existing = grouped.get(key) || [];
    existing.push(event);
    grouped.set(key, existing);
  }
  return grouped;
}

function buildOperatingGraphStateKeyFromDoc(doc: Record<string, unknown>) {
  return coerceString(doc.state_key) || coerceString(doc.id);
}

function normalizeOperatingGraphStateDoc(doc: Record<string, unknown>): OperatingGraphState | null {
  const stateKey = buildOperatingGraphStateKeyFromDoc(doc);
  const entityType = coerceString(doc.entity_type) as OperatingGraphState["entityType"];
  const entityId = coerceString(doc.entity_id);
  if (!stateKey || !entityType || !entityId) {
    return null;
  }

  const canonicalForeignKeys =
    doc.canonical_foreign_keys && typeof doc.canonical_foreign_keys === "object"
      ? (doc.canonical_foreign_keys as Record<string, unknown>)
      : {};

  return {
    stateKey,
    entityType,
    entityId,
    city: coerceString(doc.city),
    citySlug: coerceString(doc.city_slug),
    currentStage: coerceString(doc.current_stage) as OperatingGraphState["currentStage"],
    stagesSeen: Array.isArray(doc.stages_seen)
      ? (doc.stages_seen.filter((value): value is string => typeof value === "string") as OperatingGraphState["stagesSeen"])
      : [],
    blockingConditions: Array.isArray(doc.blocking_conditions)
      ? (doc.blocking_conditions as OperatingGraphState["blockingConditions"])
      : [],
    externalConfirmations: Array.isArray(doc.external_confirmations)
      ? (doc.external_confirmations as OperatingGraphState["externalConfirmations"])
      : [],
    nextActions: Array.isArray(doc.next_actions)
      ? (doc.next_actions as OperatingGraphState["nextActions"])
      : [],
    latestSummary: coerceString(doc.latest_summary),
    latestSourceRepo: coerceString(doc.latest_source_repo) as OperatingGraphState["latestSourceRepo"],
    latestEventId: coerceString(doc.latest_event_id),
    latestEventAtIso: coerceString(doc.latest_event_at_iso),
    canonicalForeignKeys: {
      cityProgramId: coerceString(canonicalForeignKeys.city_program_id) || null,
      captureId: coerceString(canonicalForeignKeys.capture_id) || null,
      captureRunId: coerceString(canonicalForeignKeys.capture_run_id) || null,
      siteSubmissionId: coerceString(canonicalForeignKeys.site_submission_id) || null,
      sceneId: coerceString(canonicalForeignKeys.scene_id) || null,
      buyerRequestId: coerceString(canonicalForeignKeys.buyer_request_id) || null,
      captureJobId: coerceString(canonicalForeignKeys.capture_job_id) || null,
      packageId: coerceString(canonicalForeignKeys.package_id) || null,
      packageRunId: coerceString(canonicalForeignKeys.package_run_id) || null,
      hostedReviewRunId: coerceString(canonicalForeignKeys.hosted_review_run_id) || null,
      buyerOutcomeId: coerceString(canonicalForeignKeys.buyer_outcome_id) || null,
      buyerAccountId: coerceString(canonicalForeignKeys.buyer_account_id) || null,
    },
  };
}

function buildPackageProjections(snapshot: CompanyMetricsSnapshot) {
  if (snapshot.operatingGraphStates.length > 0) {
    return snapshot.operatingGraphStates
      .filter((state): state is OperatingGraphState => state.entityType === "package_run")
      .map((state) => ({
        ...state,
        entityType: "package_run" as const,
        packageRunId: state.entityId,
        packageId: state.canonicalForeignKeys.packageId ?? null,
        captureId: state.canonicalForeignKeys.captureId ?? null,
        siteSubmissionId: state.canonicalForeignKeys.siteSubmissionId ?? null,
        sceneId: state.canonicalForeignKeys.sceneId ?? null,
        buyerRequestId: state.canonicalForeignKeys.buyerRequestId ?? null,
        captureJobId: state.canonicalForeignKeys.captureJobId ?? null,
      }));
  }

  const grouped = groupOperatingGraphEvents(snapshot);
  const projections: PackageRunProjection[] = [];
  for (const [key, events] of grouped.entries()) {
    if (!key.startsWith("package_run:")) {
      continue;
    }
    const projection = projectPackageRunState(events, events[0]?.entity_id || "");
    if (projection) {
      projections.push(projection);
    }
  }
  return projections;
}

function buildHostedReviewProjections(snapshot: CompanyMetricsSnapshot) {
  if (snapshot.operatingGraphStates.length > 0) {
    return snapshot.operatingGraphStates
      .filter((state): state is OperatingGraphState => state.entityType === "hosted_review_run")
      .map((state) => ({
        ...state,
        entityType: "hosted_review_run" as const,
        hostedReviewRunId: state.entityId,
        packageId: state.canonicalForeignKeys.packageId ?? null,
        captureId: state.canonicalForeignKeys.captureId ?? null,
        siteSubmissionId: state.canonicalForeignKeys.siteSubmissionId ?? null,
        buyerRequestId: state.canonicalForeignKeys.buyerRequestId ?? null,
        buyerAccountId: state.canonicalForeignKeys.buyerAccountId ?? null,
      }));
  }

  const grouped = groupOperatingGraphEvents(snapshot);
  const projections: HostedReviewRunProjection[] = [];
  for (const [key, events] of grouped.entries()) {
    if (!key.startsWith("hosted_review_run:")) {
      continue;
    }
    const projection = projectHostedReviewRunState(events, events[0]?.entity_id || "");
    if (projection) {
      projections.push(projection);
    }
  }
  return projections;
}

function findFirstStageAt(
  events: OperatingGraphEvent[],
  entityType: OperatingGraphEvent["entity_type"],
  entityId: string,
  stage: OperatingGraphEvent["stage"],
) {
  const matching = events
    .filter(
      (event) =>
        event.entity_type === entityType
        && event.entity_id === entityId
        && event.stage === stage,
    )
    .sort(
      (left, right) =>
        Date.parse(left.recorded_at_iso) - Date.parse(right.recorded_at_iso),
    );
  return matching[0]?.recorded_at_iso || null;
}

function outcomeIsPositive(outcomeType: string | null) {
  return outcomeType === "won" || outcomeType === "pilot_requested" || outcomeType === "hosted_review_only";
}

async function readCollectionDocs(
  collectionName: string,
  pageSize = 500,
  maxDocs = 25_000,
) {
  if (!db) {
    return [] as Array<Record<string, unknown>>;
  }

  const collectionRef = db.collection(collectionName) as FirebaseFirestore.CollectionReference | {
    orderBy?: (...args: unknown[]) => {
      limit: (value: number) => {
        get: () => Promise<{ docs: Array<{ id: string; data: () => Record<string, unknown> }> }>;
        startAfter?: (doc: unknown) => {
          get: () => Promise<{ docs: Array<{ id: string; data: () => Record<string, unknown> }> }>;
        };
      };
    };
    limit?: (value: number) => {
      get: () => Promise<{ docs: Array<{ id: string; data: () => Record<string, unknown> }> }>;
    };
  };

  if (typeof collectionRef.orderBy !== "function") {
    const snapshot = await collectionRef.limit?.(maxDocs).get();
    return snapshot?.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Record<string, unknown>),
    })) || [];
  }

  const docIdFieldPath = admin.firestore.FieldPath?.documentId?.();
  const ordered = docIdFieldPath
    ? collectionRef.orderBy(docIdFieldPath)
    : collectionRef.orderBy("__name__");

  const results: Array<Record<string, unknown>> = [];
  let cursor: unknown = null;

  while (results.length < maxDocs) {
    const batchLimit = Math.min(pageSize, maxDocs - results.length);
    let query = ordered.limit(batchLimit);
    if (cursor && typeof query.startAfter === "function") {
      query = query.startAfter(cursor);
    }
    const snapshot = await query.get();
    if (!snapshot.docs.length) {
      break;
    }
    results.push(
      ...snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Record<string, unknown>),
      })),
    );
    cursor = snapshot.docs[snapshot.docs.length - 1];
    if (snapshot.docs.length < batchLimit) {
      break;
    }
  }

  return results;
}

export function projectCompanyMetricsView(
  snapshot: CompanyMetricsSnapshot,
  window: CompanyMetricsWindow,
): CompanyMetricsView {
  const knownCities = new Map(
    snapshot.cityLaunchLedgers.map((entry) => [slugify(entry.city), entry.city]),
  );
  const packageRuns = buildPackageProjections(snapshot);
  const hostedReviewRuns = buildHostedReviewProjections(snapshot);

  const captureCityValues = snapshot.cityLaunchLedgers
    .map((entry) => {
      const uploadedCaptures = snapshot.captureSubmissions.filter(
        (submission) =>
          submission.city
          && slugify(submission.city) === slugify(entry.city)
          && Boolean(submission.captureUploadedAtIso),
      ).length;
      const hasCaptureLinkage = snapshot.captureSubmissions.some(
        (submission) => submission.city && slugify(submission.city) === slugify(entry.city),
      );
      return {
        city: entry.city,
        numerator: hasCaptureLinkage ? uploadedCaptures : null,
        denominator: entry.trackedSupplyProspectsContacted || null,
        value:
          hasCaptureLinkage
          && entry.trackedSupplyProspectsContacted > 0
            ? computeRate(uploadedCaptures, entry.trackedSupplyProspectsContacted)
            : null,
      };
    })
    .sort((left, right) => left.city.localeCompare(right.city));

  const uploadedCaptures = snapshot.captureSubmissions.filter((submission) =>
    isWithinWindow(submission.captureUploadedAtIso, window),
  );
  const capturesWithStart = snapshot.captureSubmissions.filter((submission) =>
    isWithinWindow(submission.captureStartedAtIso, window),
  );

  const packageReadyByCaptureKey = new Set(
    packageRuns
      .filter((projection) => projection.stagesSeen.includes("package_ready"))
      .flatMap((projection) =>
        [projection.captureId, projection.siteSubmissionId].filter(Boolean) as string[],
      ),
  );

  const uploadedWithPackageReady = uploadedCaptures.filter((submission) =>
    Boolean(
      packageReadyByCaptureKey.has(submission.captureId)
      || (submission.siteSubmissionId && packageReadyByCaptureKey.has(submission.siteSubmissionId)),
    ),
  );

  const packageReadyLatencies = uploadedCaptures
    .map((submission) => {
      const projection = packageRuns.find(
        (candidate) =>
          candidate.captureId === submission.captureId
          || (submission.siteSubmissionId && candidate.siteSubmissionId === submission.siteSubmissionId),
      );
      if (!projection || !submission.captureUploadedAtIso) {
        return null;
      }
      const packageReadyAt =
        findFirstStageAt(
          snapshot.operatingGraphEvents,
          "package_run",
          projection.entityId,
          "package_ready",
        )
        || findFirstStageAt(
          snapshot.operatingGraphEvents,
          "package_run",
          projection.entityId,
          "hosted_review_ready",
        );
      if (!packageReadyAt) {
        return null;
      }
      const start = Date.parse(submission.captureUploadedAtIso);
      const end = Date.parse(packageReadyAt);
      return Number.isNaN(start) || Number.isNaN(end) || end < start
        ? null
        : (end - start) / 3_600_000;
    })
    .filter((value): value is number => value !== null);

  const packageReadyRuns = packageRuns.filter((projection) =>
    isWithinWindow(
      findFirstStageAt(
        snapshot.operatingGraphEvents,
        "package_run",
        projection.entityId,
        "package_ready",
      ),
      window,
    ),
  );
  const hostedReviewReadyRuns = packageRuns.filter((projection) =>
    isWithinWindow(
      findFirstStageAt(
        snapshot.operatingGraphEvents,
        "package_run",
        projection.entityId,
        "hosted_review_ready",
      ),
      window,
    ),
  );
  const hostedReviewStartedRuns = hostedReviewRuns.filter((projection) =>
    isWithinWindow(
      findFirstStageAt(
        snapshot.operatingGraphEvents,
        "hosted_review_run",
        projection.entityId,
        "hosted_review_started",
      ),
      window,
    ),
  );
  const buyerFollowUpRuns = hostedReviewRuns.filter(
    (projection) =>
      projection.stagesSeen.includes("buyer_follow_up_in_progress")
      && isWithinWindow(
        findFirstStageAt(
          snapshot.operatingGraphEvents,
          "hosted_review_run",
          projection.entityId,
          "buyer_follow_up_in_progress",
        ),
        window,
      ),
  );

  const positiveOutcomes = snapshot.buyerOutcomes.filter(
    (outcome) =>
      isWithinWindow(outcome.recordedAtIso, window)
      && outcomeIsPositive(outcome.outcomeType),
  );
  const positiveOutcomeRunIds = new Set(
    positiveOutcomes.map((outcome) => outcome.hostedReviewRunId).filter(Boolean) as string[],
  );

  const actualBudgetSpendUsd = snapshot.budgetEvents
    .filter(
      (entry) =>
        (entry.eventType || "actual") !== "recommended"
        && isWithinWindow(entry.createdAtIso, window),
    )
    .reduce((sum, entry) => sum + entry.amountUsd, 0);
  const buyerReadyCities = new Set(
    packageRuns
      .filter(
        (projection) =>
          projection.stagesSeen.includes("package_ready")
          || projection.stagesSeen.includes("hosted_review_ready"),
      )
      .map((projection) => projection.city)
      .filter(Boolean),
  );
  const recordedOutcomeValueUsd = positiveOutcomes.reduce(
    (sum, outcome) => sum + (outcome.commercialValueUsd || 0),
    0,
  );

  const dispatchesInWindow = snapshot.humanBlockerDispatches.filter((entry) =>
    isWithinWindow(entry.createdAtIso, window),
  );
  const blockerCounts = new Map<string, number>();
  for (const dispatch of dispatchesInWindow) {
    const blockerId = coerceString(dispatch.blockerId) || dispatch.id;
    blockerCounts.set(blockerId, (blockerCounts.get(blockerId) || 0) + 1);
  }
  const repeatedDispatchCount = Array.from(blockerCounts.values()).reduce(
    (sum, count) => sum + Math.max(0, count - 1),
    0,
  );

  const founderThreadsInWindow = snapshot.humanBlockerThreads.filter(
    (thread) =>
      thread.gateMode === "universal_founder_inbox"
      && thread.channel === "email"
      && isWithinWindow(thread.createdAtIso, window),
  );
  const weeksCovered = window.lookbackDays / 7;
  const humanInterruptCityValues = Array.from(
    founderThreadsInWindow.reduce((acc, thread) => {
      const city = deriveDispatchCity(
        {
          blockerId: thread.blockerId,
          title: thread.title,
          reportPaths: thread.reportPaths,
        },
        knownCities,
      );
      acc.set(city, (acc.get(city) || 0) + 1);
      return acc;
    }, new Map<string, number>()),
  )
    .map(([city, count]) => ({
      city,
      numerator: count,
      denominator: weeksCovered || 1,
      value: weeksCovered > 0 ? count / weeksCovered : count,
    }))
    .sort((left, right) => left.city.localeCompare(right.city));

  const metrics: CompanyMetricResult[] = [
    buildMetric("capture_fill_rate_by_city", {
      status: captureCityValues.every((entry) => entry.value !== null) ? "truthful" : "partial",
      value: null,
      numerator: null,
      denominator: null,
      note:
        captureCityValues.every((entry) => entry.value !== null)
          ? "City supply fill is linked to uploaded capture truth for every tracked city."
          : "Some tracked cities still lack capture-to-city linkage, so those city rows remain partial.",
      cityValues: captureCityValues,
    }),
    buildMetric("capture_to_upload_success_rate", {
      status: capturesWithStart.length > 0 ? "truthful" : "blocked",
      value:
        capturesWithStart.length > 0
          ? computeRate(
            capturesWithStart.filter((submission) => Boolean(submission.captureUploadedAtIso)).length,
            capturesWithStart.length,
          )
          : null,
      numerator:
        capturesWithStart.length > 0
          ? capturesWithStart.filter((submission) => Boolean(submission.captureUploadedAtIso)).length
          : null,
      denominator: capturesWithStart.length || null,
      note:
        capturesWithStart.length > 0
          ? "Computed from capture lifecycle rows carrying both capture start and upload completion."
          : "capture_in_progress is not yet mirrored into WebApp for this window.",
    }),
    buildMetric("upload_to_package_success_rate", {
      status: uploadedCaptures.length > 0 ? "truthful" : "blocked",
      value:
        uploadedCaptures.length > 0
          ? computeRate(uploadedWithPackageReady.length, uploadedCaptures.length)
          : null,
      numerator: uploadedCaptures.length > 0 ? uploadedWithPackageReady.length : null,
      denominator: uploadedCaptures.length || null,
      note:
        uploadedCaptures.length > 0
          ? "Linked uploaded captures to package-run stage transitions using capture or site-submission ids."
          : "No uploaded captures were recorded in the selected window.",
    }),
    buildMetric("package_ready_latency", {
      status: packageReadyLatencies.length > 0 ? "truthful" : "blocked",
      value: computeMedian(packageReadyLatencies),
      numerator:
        packageReadyLatencies.length > 0
          ? computeAverage(packageReadyLatencies)
          : null,
      denominator: packageReadyLatencies.length || null,
      note:
        packageReadyLatencies.length > 0
          ? `Median upload-to-package latency; p90=${computePercentile(packageReadyLatencies, 90)?.toFixed(2) || "n/a"}h.`
          : "No upload-to-package pairs with both timestamps were available in the selected window.",
    }),
    buildMetric("hosted_review_ready_rate", {
      status: packageReadyRuns.length > 0 ? "truthful" : "blocked",
      value:
        packageReadyRuns.length > 0
          ? computeRate(hostedReviewReadyRuns.length, packageReadyRuns.length)
          : null,
      numerator: packageReadyRuns.length > 0 ? hostedReviewReadyRuns.length : null,
      denominator: packageReadyRuns.length || null,
      note:
        packageReadyRuns.length > 0
          ? "Computed from package-run stage transitions."
          : "No package-ready runs were recorded in the selected window.",
    }),
    buildMetric("hosted_review_start_rate", {
      status: hostedReviewReadyRuns.length > 0 ? "truthful" : "blocked",
      value:
        hostedReviewReadyRuns.length > 0
          ? computeRate(hostedReviewStartedRuns.length, hostedReviewReadyRuns.length)
          : null,
      numerator: hostedReviewReadyRuns.length > 0 ? hostedReviewStartedRuns.length : null,
      denominator: hostedReviewReadyRuns.length || null,
      note:
        hostedReviewReadyRuns.length > 0
          ? "Counts only hosted-review start events written from real buyer/runtime access."
          : "No hosted-review-ready package runs were recorded in the selected window.",
    }),
    buildMetric("buyer_outcome_conversion_rate", {
      status: hostedReviewStartedRuns.length > 0 || snapshot.buyerOutcomes.length > 0 ? "truthful" : "blocked",
      value:
        hostedReviewStartedRuns.length > 0
          ? computeRate(
            hostedReviewStartedRuns.filter((projection) =>
              positiveOutcomeRunIds.has(
                coerceString(projection.canonicalForeignKeys.hostedReviewRunId) || projection.hostedReviewRunId,
              ),
            ).length,
            hostedReviewStartedRuns.length,
          )
          : null,
      numerator:
        hostedReviewStartedRuns.length > 0
          ? hostedReviewStartedRuns.filter((projection) =>
            positiveOutcomeRunIds.has(
              coerceString(projection.canonicalForeignKeys.hostedReviewRunId) || projection.hostedReviewRunId,
            ),
          ).length
          : null,
      denominator: hostedReviewStartedRuns.length || null,
      note:
        hostedReviewStartedRuns.length > 0 || snapshot.buyerOutcomes.length > 0
          ? "Computed from explicit buyer outcomes linked to hosted-review runs."
          : "No hosted-review starts or explicit buyer outcomes were recorded in the selected window.",
    }),
    buildMetric("commercial_handoff_rate", {
      status: hostedReviewStartedRuns.length > 0 ? "truthful" : "blocked",
      value:
        hostedReviewStartedRuns.length > 0
          ? computeRate(buyerFollowUpRuns.length, hostedReviewStartedRuns.length)
          : null,
      numerator: hostedReviewStartedRuns.length > 0 ? buyerFollowUpRuns.length : null,
      denominator: hostedReviewStartedRuns.length || null,
      note:
        hostedReviewStartedRuns.length > 0
          ? "Uses durable hosted-review follow-up and commercial handoff events."
          : "No hosted-review starts were recorded in the selected window.",
    }),
    buildMetric("city_launch_cac", {
      status: buyerReadyCities.size > 0 ? "partial" : "blocked",
      value: buyerReadyCities.size > 0 ? computeRate(actualBudgetSpendUsd, buyerReadyCities.size) : null,
      numerator: buyerReadyCities.size > 0 ? actualBudgetSpendUsd : null,
      denominator: buyerReadyCities.size || null,
      note:
        buyerReadyCities.size > 0
          ? "Uses actual launch spend over cities reaching buyer-ready package truth; labor attribution is still missing."
          : "No buyer-ready city programs were recorded in the selected window.",
    }),
    buildMetric("city_launch_payback_estimate", {
      status: actualBudgetSpendUsd > 0 && recordedOutcomeValueUsd > 0 ? "partial" : "blocked",
      value:
        actualBudgetSpendUsd > 0 && recordedOutcomeValueUsd > 0
          ? actualBudgetSpendUsd / recordedOutcomeValueUsd
          : null,
      numerator:
        actualBudgetSpendUsd > 0 && recordedOutcomeValueUsd > 0
          ? actualBudgetSpendUsd
          : null,
      denominator:
        actualBudgetSpendUsd > 0 && recordedOutcomeValueUsd > 0
          ? recordedOutcomeValueUsd
          : null,
      note:
        actualBudgetSpendUsd > 0 && recordedOutcomeValueUsd > 0
          ? "Current partial estimate: launch spend divided by recorded positive buyer outcome value."
          : "Both launch spend and recorded positive buyer outcome value are required for payback.",
    }),
    buildMetric("blocker_recurrence_rate", {
      status: dispatchesInWindow.length > 0 ? "truthful" : "blocked",
      value:
        dispatchesInWindow.length > 0
          ? computeRate(repeatedDispatchCount, dispatchesInWindow.length)
          : null,
      numerator: dispatchesInWindow.length > 0 ? repeatedDispatchCount : null,
      denominator: dispatchesInWindow.length || null,
      note:
        dispatchesInWindow.length > 0
          ? "Computed from repeated blocker ids in the dispatch ledger."
          : "No blocker dispatches were recorded in the selected window.",
    }),
    buildMetric("human_interrupt_rate", {
      status: founderThreadsInWindow.length > 0 || snapshot.humanBlockerThreads.length > 0 ? "truthful" : "blocked",
      value: null,
      numerator: null,
      denominator: null,
      note:
        founderThreadsInWindow.length > 0 || snapshot.humanBlockerThreads.length > 0
          ? "Computed from universal founder inbox email threads only."
          : "No founder inbox threads were recorded in the selected window.",
      cityValues: humanInterruptCityValues,
    }),
  ];

  return {
    window,
    metrics,
    summary: {
      truthfulCount: metrics.filter((metric) => metric.status === "truthful").length,
      partialCount: metrics.filter((metric) => metric.status === "partial").length,
      blockedCount: metrics.filter((metric) => metric.status === "blocked").length,
    },
  };
}

export async function collectCompanyMetricsSnapshot(): Promise<CompanyMetricsSnapshot> {
  const generatedAt = new Date().toISOString();
  const activations = await listCityLaunchActivations();
  const cities = Array.from(new Set(activations.map((entry) => entry.city).filter(Boolean)));

  const [
    ledgerSummaries,
    budgetEventLists,
    captureSubmissionDocs,
    operatingGraphEventDocs,
    operatingGraphStateDocs,
    buyerOutcomeDocs,
    humanBlockerThreadDocs,
    dispatchDocs,
  ] = await Promise.all([
    Promise.all(
      cities.map(async (city) => {
        const summary = await summarizeCityLaunchLedgers(city);
        return {
          city,
          trackedSupplyProspectsContacted: summary.trackedSupplyProspectsContacted,
          onboardedCapturers: summary.onboardedCapturers,
        };
      }),
    ),
    Promise.all(cities.map((city) => listCityLaunchBudgetEvents(city))),
    readCollectionDocs("capture_submissions"),
    readCollectionDocs("operatingGraphEvents"),
    readCollectionDocs("operatingGraphState"),
    readCollectionDocs("buyerOutcomes"),
    readCollectionDocs("humanBlockerThreads"),
    readCollectionDocs("humanBlockerDispatches"),
  ]);

  const budgetEvents = budgetEventLists.flat().map((event) => ({
    city: event.city,
    amountUsd: event.amountUsd,
    eventType: event.eventType || null,
    createdAtIso: event.createdAtIso || null,
  }));

  return {
    generatedAt,
    cityLaunchLedgers: ledgerSummaries,
    budgetEvents,
    captureSubmissions: captureSubmissionDocs.map((doc) => {
      const lifecycle =
        doc.lifecycle && typeof doc.lifecycle === "object"
          ? (doc.lifecycle as Record<string, unknown>)
          : {};
      const operationalState =
        doc.operational_state && typeof doc.operational_state === "object"
          ? (doc.operational_state as Record<string, unknown>)
          : {};
      const cityContext =
        doc.city_context && typeof doc.city_context === "object"
          ? (doc.city_context as Record<string, unknown>)
          : {};
      return {
        id: String(doc.id || ""),
        captureId: coerceString(doc.capture_id) || String(doc.id || ""),
        sceneId: coerceString(doc.scene_id) || null,
        siteSubmissionId: coerceString(doc.site_submission_id) || null,
        buyerRequestId: coerceString(doc.buyer_request_id) || null,
        captureJobId: coerceString(doc.capture_job_id) || null,
        city: coerceString(cityContext.city) || null,
        citySlug: coerceString(cityContext.city_slug) || null,
        submittedAtIso: toIso(doc.submitted_at || doc.created_at),
        captureStartedAtIso: toIso(lifecycle.capture_started_at),
        captureUploadedAtIso: toIso(lifecycle.capture_uploaded_at || doc.capture_uploaded_at),
        uploadState: coerceString(operationalState.upload_state) || null,
        status: coerceString(doc.status) || null,
      };
    }),
    operatingGraphEvents: operatingGraphEventDocs.map((doc) => doc as unknown as OperatingGraphEvent),
    operatingGraphStates: operatingGraphStateDocs
      .map((doc) => normalizeOperatingGraphStateDoc(doc))
      .filter((doc): doc is OperatingGraphState => doc !== null),
    buyerOutcomes: buyerOutcomeDocs.map((doc) => ({
      id: String(doc.id || ""),
      buyerOutcomeId: coerceString(doc.buyer_outcome_id) || String(doc.id || ""),
      cityProgramId: coerceString(doc.city_program_id) || null,
      siteSubmissionId: coerceString(doc.site_submission_id) || null,
      captureId: coerceString(doc.capture_id) || null,
      hostedReviewRunId: coerceString(doc.hosted_review_run_id) || null,
      buyerAccountId: coerceString(doc.buyer_account_id) || null,
      outcomeType: coerceString(doc.outcome_type) || null,
      outcomeStatus: coerceString(doc.outcome_status) || null,
      recordedAtIso: toIso(doc.recorded_at),
      commercialValueUsd: toNumber(doc.commercial_value_usd),
    })),
    humanBlockerThreads: humanBlockerThreadDocs.map((doc) => {
      const recordOfTruth =
        doc.record_of_truth && typeof doc.record_of_truth === "object"
          ? (doc.record_of_truth as Record<string, unknown>)
          : {};
      const decisionContext =
        doc.decision_context && typeof doc.decision_context === "object"
          ? (doc.decision_context as Record<string, unknown>)
          : {};
      return {
        id: String(doc.id || ""),
        blockerId: coerceString(doc.blocker_id) || String(doc.id || ""),
        title: coerceString(doc.title) || null,
        channel: coerceString(doc.channel) || null,
        gateMode: coerceString(decisionContext.gate_mode) || null,
        createdAtIso: toIso(doc.created_at || doc.updated_at),
        reportPaths: Array.isArray(recordOfTruth.report_paths)
          ? recordOfTruth.report_paths.filter((value): value is string => typeof value === "string")
          : [],
      };
    }),
    humanBlockerDispatches: dispatchDocs.map((doc) => ({
      id: String(doc.id || ""),
      blockerId: coerceString(doc.blocker_id) || null,
      createdAtIso: toIso(doc.created_at || doc.updated_at),
      city: coerceString(doc.city) || null,
      title: coerceString(doc.title) || null,
      reportPaths: Array.isArray(doc.report_paths)
        ? doc.report_paths.filter((value): value is string => typeof value === "string")
        : [],
    })),
  };
}

export { buildMetricsWindow };
