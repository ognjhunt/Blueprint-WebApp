import {
  buildOperatingGraphStateKey,
} from "./operatingGraph";
import type {
  BuyerOutcomeProjection,
  CaptureRunProjection,
  CityProgramProjection,
  BlockingCondition,
  ExternalConfirmation,
  HostedReviewRunProjection,
  NextAction,
  OperatingGraphCanonicalForeignKeys,
  OperatingGraphEntityType,
  OperatingGraphEvent,
  OperatingGraphRepo,
  OperatingGraphState,
  OperatingGraphStage,
  PackageRunProjection,
} from "./operatingGraphTypes";

const STAGE_ORDER: Record<OperatingGraphStage, number> = {
  city_selected: 1,
  supply_seeded: 2,
  supply_contactable: 3,
  capture_in_progress: 4,
  capture_uploaded: 5,
  pipeline_packaging: 6,
  package_ready: 7,
  hosted_review_ready: 8,
  hosted_review_started: 9,
  buyer_follow_up_in_progress: 10,
  buyer_outcome_recorded: 11,
  next_action_open: 12,
};

const CANONICAL_FOREIGN_KEY_METADATA_KEYS: Array<
  [keyof OperatingGraphCanonicalForeignKeys, string[]]
> = [
  ["cityProgramId", ["city_program_id", "cityProgramId"]],
  ["captureId", ["capture_id", "captureId"]],
  ["captureRunId", ["capture_run_id", "captureRunId"]],
  ["siteSubmissionId", ["site_submission_id", "siteSubmissionId"]],
  ["sceneId", ["scene_id", "sceneId"]],
  ["buyerRequestId", ["buyer_request_id", "buyerRequestId"]],
  ["captureJobId", ["capture_job_id", "captureJobId"]],
  ["packageId", ["package_id", "packageId"]],
  ["packageRunId", ["package_run_id", "packageRunId"]],
  ["hostedReviewRunId", ["hosted_review_run_id", "hostedReviewRunId"]],
  ["buyerOutcomeId", ["buyer_outcome_id", "buyerOutcomeId"]],
  ["buyerAccountId", ["buyer_account_id", "buyerAccountId"]],
];

function dedupeById<T extends { id: string }>(values: T[]) {
  const byId = new Map<string, T>();
  for (const value of values) {
    if (!value.id) {
      continue;
    }
    byId.set(value.id, value);
  }
  return [...byId.values()];
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readMetadataString(metadata: Record<string, unknown> | undefined, keys: string[]) {
  if (!metadata) {
    return "";
  }

  for (const key of keys) {
    const value = readString(metadata[key]);
    if (value) {
      return value;
    }
  }

  const nested = metadata.canonical_foreign_keys;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    const nestedRecord = nested as Record<string, unknown>;
    for (const key of keys) {
      const value = readString(nestedRecord[key]);
      if (value) {
        return value;
      }
    }
  }

  return "";
}

function mergeCanonicalForeignKeys(
  current: OperatingGraphCanonicalForeignKeys,
  metadata: Record<string, unknown> | undefined,
) {
  const next: OperatingGraphCanonicalForeignKeys = { ...current };
  for (const [field, keys] of CANONICAL_FOREIGN_KEY_METADATA_KEYS) {
    const value = readMetadataString(metadata, keys);
    if (value) {
      next[field] = value;
    }
  }
  return next;
}

function compareOperatingGraphEvents(left: OperatingGraphEvent, right: OperatingGraphEvent) {
  const timeDiff =
    new Date(left.recorded_at_iso).getTime() - new Date(right.recorded_at_iso).getTime();
  if (timeDiff !== 0) {
    return timeDiff;
  }

  const stageDiff = compareOperatingGraphStages(left.stage, right.stage);
  if (stageDiff !== 0) {
    return stageDiff;
  }

  return left.id.localeCompare(right.id);
}

function projectEntityState(
  events: OperatingGraphEvent[],
  entityType: OperatingGraphEntityType,
  entityId: string,
): OperatingGraphState | null {
  const relevant = events.filter(
    (event) => event.entity_type === entityType && event.entity_id === entityId,
  );

  if (relevant.length === 0) {
    return null;
  }

  const ordered = [...relevant].sort(compareOperatingGraphEvents);
  const latest = ordered[ordered.length - 1];

  const stagesSeen = [...new Set(ordered.map((entry) => entry.stage))].sort(
    compareOperatingGraphStages,
  );
  const canonicalForeignKeys = ordered.reduce(
    (acc, entry) => mergeCanonicalForeignKeys(acc, entry.metadata),
    {} as OperatingGraphCanonicalForeignKeys,
  );

  return {
    stateKey: buildOperatingGraphStateKey({
      entityType,
      entityId: latest.entity_id,
    }),
    entityType,
    entityId: latest.entity_id,
    city: latest.city,
    citySlug: latest.city_slug,
    currentStage: latest.stage,
    stagesSeen,
    blockingConditions: dedupeById(
      ordered.flatMap((entry) => entry.blocking_conditions || []),
    ) as BlockingCondition[],
    externalConfirmations: dedupeById(
      ordered.flatMap((entry) => entry.external_confirmations || []),
    ) as ExternalConfirmation[],
    nextActions: dedupeById(ordered.flatMap((entry) => entry.next_actions || [])) as NextAction[],
    latestSummary: latest.summary,
    latestSourceRepo: latest.source_repo as OperatingGraphRepo,
    latestEventId: latest.id,
    latestEventAtIso: latest.recorded_at_iso,
    canonicalForeignKeys,
  };
}

export function compareOperatingGraphStages(
  left: OperatingGraphStage,
  right: OperatingGraphStage,
) {
  return STAGE_ORDER[left] - STAGE_ORDER[right];
}

export function projectOperatingGraphState(
  events: OperatingGraphEvent[],
  entityType: OperatingGraphEntityType,
  entityId: string,
): OperatingGraphState | null {
  return projectEntityState(events, entityType, entityId);
}

export function serializeOperatingGraphState(state: OperatingGraphState) {
  return {
    state_key: state.stateKey,
    entity_type: state.entityType,
    entity_id: state.entityId,
    city: state.city,
    city_slug: state.citySlug,
    current_stage: state.currentStage,
    stages_seen: state.stagesSeen,
    blocking_conditions: state.blockingConditions,
    external_confirmations: state.externalConfirmations,
    next_actions: state.nextActions,
    latest_summary: state.latestSummary,
    latest_source_repo: state.latestSourceRepo,
    latest_event_id: state.latestEventId,
    latest_event_at_iso: state.latestEventAtIso,
    canonical_foreign_keys: state.canonicalForeignKeys,
  };
}

export function projectCityProgramState(
  events: OperatingGraphEvent[],
  entityId: string,
): CityProgramProjection | null {
  const state = projectEntityState(events, "city_program", entityId);
  if (!state) {
    return null;
  }

  return {
    ...state,
    entityType: "city_program",
    cityProgramId: state.entityId,
    canonicalForeignKeys: {
      ...state.canonicalForeignKeys,
      cityProgramId: state.entityId,
    },
  };
}

export function projectCaptureRunState(
  events: OperatingGraphEvent[],
  entityId: string,
): CaptureRunProjection | null {
  const state = projectEntityState(events, "capture_run", entityId);
  if (!state) {
    return null;
  }

  const canonicalForeignKeys = state.canonicalForeignKeys;
  return {
    ...state,
    entityType: "capture_run",
    captureRunId: state.entityId,
    captureId: canonicalForeignKeys.captureId ?? null,
    siteSubmissionId: canonicalForeignKeys.siteSubmissionId ?? null,
    sceneId: canonicalForeignKeys.sceneId ?? null,
    buyerRequestId: canonicalForeignKeys.buyerRequestId ?? null,
    captureJobId: canonicalForeignKeys.captureJobId ?? null,
  };
}

export function projectPackageRunState(
  events: OperatingGraphEvent[],
  entityId: string,
): PackageRunProjection | null {
  const state = projectEntityState(events, "package_run", entityId);
  if (!state) {
    return null;
  }

  const canonicalForeignKeys = state.canonicalForeignKeys;
  return {
    ...state,
    entityType: "package_run",
    packageRunId: state.entityId,
    packageId: canonicalForeignKeys.packageId ?? null,
    captureId: canonicalForeignKeys.captureId ?? null,
    siteSubmissionId: canonicalForeignKeys.siteSubmissionId ?? null,
    sceneId: canonicalForeignKeys.sceneId ?? null,
    buyerRequestId: canonicalForeignKeys.buyerRequestId ?? null,
    captureJobId: canonicalForeignKeys.captureJobId ?? null,
  };
}

export function projectHostedReviewRunState(
  events: OperatingGraphEvent[],
  entityId: string,
): HostedReviewRunProjection | null {
  const state = projectEntityState(events, "hosted_review_run", entityId);
  if (!state) {
    return null;
  }

  const canonicalForeignKeys = state.canonicalForeignKeys;
  return {
    ...state,
    entityType: "hosted_review_run",
    hostedReviewRunId: state.entityId,
    packageId: canonicalForeignKeys.packageId ?? null,
    captureId: canonicalForeignKeys.captureId ?? null,
    siteSubmissionId: canonicalForeignKeys.siteSubmissionId ?? null,
    buyerRequestId: canonicalForeignKeys.buyerRequestId ?? null,
    buyerAccountId: canonicalForeignKeys.buyerAccountId ?? null,
  };
}

export function projectBuyerOutcomeState(
  events: OperatingGraphEvent[],
  entityId: string,
): BuyerOutcomeProjection | null {
  const state = projectEntityState(events, "buyer_outcome", entityId);
  if (!state) {
    return null;
  }

  const canonicalForeignKeys = state.canonicalForeignKeys;
  return {
    ...state,
    entityType: "buyer_outcome",
    buyerOutcomeId: state.entityId,
    hostedReviewRunId: canonicalForeignKeys.hostedReviewRunId ?? null,
    packageId: canonicalForeignKeys.packageId ?? null,
    captureId: canonicalForeignKeys.captureId ?? null,
    buyerAccountId: canonicalForeignKeys.buyerAccountId ?? null,
  };
}
