import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";

type GrowthEventRecord = Record<string, unknown>;

export interface ExperimentVariantMetrics {
  exposures: number;
  contactStarts: number;
  contactSubmissions: number;
  contactCompleted: number;
}

export interface ExperimentEvaluation {
  experimentKey: string;
  status: "active" | "monitoring" | "inconclusive";
  winningVariant: string | null;
  primaryMetric: "contactCompleted" | "contactSubmissions" | "contactStarts";
  evaluatedAt: string;
  exposuresByVariant: Record<string, number>;
  metricsByVariant: Record<string, ExperimentVariantMetrics>;
  conversionRates: Record<string, number>;
  rationale: string;
}

export interface EvaluateExperimentParams {
  experimentKey: string;
  variantMetrics: Record<string, ExperimentVariantMetrics>;
  minExposuresPerVariant: number;
  minRelativeLift: number;
}

function parseGrowthEventTimestamp(value: unknown) {
  const timestamp = value as { toDate?: () => Date } | string | null | undefined;
  if (!timestamp) return null;
  if (typeof timestamp === "string") {
    const date = new Date(timestamp);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const resolved = timestamp.toDate?.();
  return resolved && !Number.isNaN(resolved.getTime()) ? resolved : null;
}

function normalizeMetrics(input?: Partial<ExperimentVariantMetrics> | null): ExperimentVariantMetrics {
  return {
    exposures: Number(input?.exposures || 0),
    contactStarts: Number(input?.contactStarts || 0),
    contactSubmissions: Number(input?.contactSubmissions || 0),
    contactCompleted: Number(input?.contactCompleted || 0),
  };
}

function conversionMetricForVariant(metrics: ExperimentVariantMetrics) {
  if (metrics.contactCompleted > 0) return "contactCompleted" as const;
  if (metrics.contactSubmissions > 0) return "contactSubmissions" as const;
  return "contactStarts" as const;
}

function conversionValue(metrics: ExperimentVariantMetrics, metric: ExperimentEvaluation["primaryMetric"]) {
  if (!metrics.exposures) {
    return 0;
  }

  switch (metric) {
    case "contactCompleted":
      return metrics.contactCompleted / metrics.exposures;
    case "contactSubmissions":
      return metrics.contactSubmissions / metrics.exposures;
    case "contactStarts":
    default:
      return metrics.contactStarts / metrics.exposures;
  }
}

export function evaluateExperimentWinner(params: EvaluateExperimentParams): ExperimentEvaluation {
  const normalizedEntries = Object.entries(params.variantMetrics)
    .map(([variant, metrics]) => [variant, normalizeMetrics(metrics)] as const)
    .filter(([variant]) => variant.trim().length > 0);

  const exposuresByVariant = Object.fromEntries(
    normalizedEntries.map(([variant, metrics]) => [variant, metrics.exposures]),
  );
  const metricsByVariant = Object.fromEntries(
    normalizedEntries.map(([variant, metrics]) => [variant, metrics]),
  );
  const evaluatedAt = new Date().toISOString();

  if (normalizedEntries.length < 2) {
    return {
      experimentKey: params.experimentKey,
      status: "monitoring",
      winningVariant: null,
      primaryMetric: "contactStarts",
      evaluatedAt,
      exposuresByVariant,
      metricsByVariant,
      conversionRates: {},
      rationale: "Need at least two variants before rollout can be evaluated.",
    };
  }

  const primaryMetric = normalizedEntries.reduce<ExperimentEvaluation["primaryMetric"]>(
    (selected, [, metrics]) => {
      const candidate = conversionMetricForVariant(metrics);
      const rank = {
        contactCompleted: 3,
        contactSubmissions: 2,
        contactStarts: 1,
      };
      return rank[candidate] > rank[selected] ? candidate : selected;
    },
    "contactStarts",
  );

  const conversionRates = Object.fromEntries(
    normalizedEntries.map(([variant, metrics]) => [
      variant,
      conversionValue(metrics, primaryMetric),
    ]),
  );

  const exposureQualified = normalizedEntries.filter(
    ([, metrics]) => metrics.exposures >= params.minExposuresPerVariant,
  );

  if (exposureQualified.length < 2) {
    return {
      experimentKey: params.experimentKey,
      status: "monitoring",
      winningVariant: null,
      primaryMetric,
      evaluatedAt,
      exposuresByVariant,
      metricsByVariant,
      conversionRates,
      rationale: `Waiting for at least two variants to reach ${params.minExposuresPerVariant} exposures.`,
    };
  }

  const ranked = exposureQualified
    .map(([variant, metrics]) => ({
      variant,
      metrics,
      conversionRate: conversionValue(metrics, primaryMetric),
    }))
    .sort((left, right) => {
      if (right.conversionRate !== left.conversionRate) {
        return right.conversionRate - left.conversionRate;
      }
      return right.metrics.exposures - left.metrics.exposures;
    });

  const winner = ranked[0];
  const runnerUp = ranked[1];
  const runnerRate = runnerUp?.conversionRate || 0;
  const relativeLift =
    runnerRate > 0
      ? (winner.conversionRate - runnerRate) / runnerRate
      : winner.conversionRate > 0
        ? 1
        : 0;

  if (winner.conversionRate <= runnerRate || relativeLift < params.minRelativeLift) {
    return {
      experimentKey: params.experimentKey,
      status: "inconclusive",
      winningVariant: null,
      primaryMetric,
      evaluatedAt,
      exposuresByVariant,
      metricsByVariant,
      conversionRates,
      rationale:
        runnerRate > 0
          ? `Top variant lift ${Math.round(relativeLift * 100)}% is below the required ${Math.round(params.minRelativeLift * 100)}% threshold.`
          : "No variant has established a meaningful conversion advantage yet.",
    };
  }

  return {
    experimentKey: params.experimentKey,
    status: "active",
    winningVariant: winner.variant,
    primaryMetric,
    evaluatedAt,
    exposuresByVariant,
    metricsByVariant,
    conversionRates,
    rationale: `${winner.variant} leads ${runnerUp.variant} on ${primaryMetric} conversion with ${Math.round(relativeLift * 100)}% relative lift.`,
  };
}

function experimentAssignmentsFromEvent(data: GrowthEventRecord) {
  const assignments =
    data.experiments && typeof data.experiments === "object"
      ? (data.experiments as Record<string, unknown>)
      : {};

  return Object.entries(assignments)
    .filter(([, variant]) => typeof variant === "string" && variant.trim().length > 0)
    .map(([experimentKey, variant]) => [experimentKey, String(variant)] as const);
}

function metricMutationForEvent(event: string) {
  switch (event) {
    case "contact_request_completed":
      return "contactCompleted" as const;
    case "contact_request_submitted":
      return "contactSubmissions" as const;
    case "contact_request_started":
      return "contactStarts" as const;
    default:
      return null;
  }
}

export async function runExperimentAutorollout(params?: {
  lookbackDays?: number;
  minExposuresPerVariant?: number;
  minRelativeLift?: number;
  limit?: number;
}) {
  if (!db) {
    throw new Error("Database not available");
  }

  const lookbackDays = Math.max(7, Math.min(params?.lookbackDays ?? 30, 180));
  const minExposuresPerVariant = Math.max(10, params?.minExposuresPerVariant ?? 50);
  const minRelativeLift = Math.max(0.01, params?.minRelativeLift ?? 0.1);
  const limit = Math.max(100, Math.min(params?.limit ?? 5000, 10000));

  const from = new Date();
  from.setDate(from.getDate() - lookbackDays);

  const snapshot = await db
    .collection("growth_events")
    .where("created_at", ">=", from)
    .orderBy("created_at", "desc")
    .limit(limit)
    .get();

  const experimentMetrics = new Map<string, Record<string, ExperimentVariantMetrics>>();

  for (const doc of snapshot.docs) {
    const data = doc.data() as GrowthEventRecord;
    const event = typeof data.event === "string" ? data.event : "";

    if (event === "experiment_exposure") {
      const properties =
        data.properties && typeof data.properties === "object"
          ? (data.properties as Record<string, unknown>)
          : {};
      const experimentKey =
        typeof properties.experiment_key === "string" ? properties.experiment_key.trim() : "";
      const variant =
        typeof properties.variant === "string" ? properties.variant.trim() : "";
      if (!experimentKey || !variant) {
        continue;
      }
      const existing = experimentMetrics.get(experimentKey) || {};
      const current = normalizeMetrics(existing[variant]);
      current.exposures += 1;
      existing[variant] = current;
      experimentMetrics.set(experimentKey, existing);
      continue;
    }

    const mutation = metricMutationForEvent(event);
    if (!mutation) {
      continue;
    }

    for (const [experimentKey, variant] of experimentAssignmentsFromEvent(data)) {
      const existing = experimentMetrics.get(experimentKey) || {};
      const current = normalizeMetrics(existing[variant]);
      current[mutation] += 1;
      existing[variant] = current;
      experimentMetrics.set(experimentKey, existing);
    }
  }

  const evaluations = [...experimentMetrics.entries()].map(([experimentKey, variantMetrics]) =>
    evaluateExperimentWinner({
      experimentKey,
      variantMetrics,
      minExposuresPerVariant,
      minRelativeLift,
    }),
  );

  for (const evaluation of evaluations) {
    await db.collection("experiment_rollouts").doc(evaluation.experimentKey).set(
      {
        experiment_key: evaluation.experimentKey,
        status: evaluation.status,
        winning_variant: evaluation.winningVariant,
        primary_metric: evaluation.primaryMetric,
        exposures_by_variant: evaluation.exposuresByVariant,
        metrics_by_variant: evaluation.metricsByVariant,
        conversion_rates: evaluation.conversionRates,
        rationale: evaluation.rationale,
        lookback_days: lookbackDays,
        evaluated_at_iso: evaluation.evaluatedAt,
        evaluated_at: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }

  return {
    count: evaluations.length,
    evaluations,
  };
}

export async function getActiveExperimentRollouts() {
  if (!db) {
    return {};
  }

  const snapshot = await db
    .collection("experiment_rollouts")
    .where("status", "==", "active")
    .get();

  return Object.fromEntries(
    snapshot.docs
      .map((doc) => {
        const data = doc.data() as Record<string, unknown>;
        const experimentKey =
          typeof data.experiment_key === "string" ? data.experiment_key : doc.id;
        const variant =
          typeof data.winning_variant === "string" ? data.winning_variant : null;
        return variant ? [experimentKey, variant] : null;
      })
      .filter((entry): entry is [string, string] => Boolean(entry)),
  );
}
