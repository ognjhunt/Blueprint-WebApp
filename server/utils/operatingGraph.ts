import crypto from "node:crypto";

import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import {
  projectOperatingGraphState,
  serializeOperatingGraphState,
} from "./operatingGraphProjectors";
import type {
  BlockingCondition,
  ExternalConfirmation,
  NextAction,
  OperatingGraphEntityType,
  OperatingGraphEvent,
  OperatingGraphOriginRef,
  OperatingGraphRepo,
  OperatingGraphStage,
} from "./operatingGraphTypes";

const COLLECTION = "operatingGraphEvents";
const STATE_COLLECTION = "operatingGraphState";

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeArray<T>(value: T[] | null | undefined) {
  return Array.isArray(value) ? value : [];
}

function dedupeById<T extends { id: string }>(values: T[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    if (!value.id || seen.has(value.id)) {
      return false;
    }
    seen.add(value.id);
    return true;
  });
}

export function buildCityProgramId(input: {
  citySlug: string;
  budgetTier?: string | null;
}) {
  const suffix = normalizeString(input.budgetTier) || "unscoped";
  return `city_program:${input.citySlug}:${suffix}`;
}

function buildPrefixedEntityId(prefix: string, stableId: string) {
  const normalizedId = normalizeString(stableId);
  if (!normalizedId) {
    throw new Error(`Missing stable id for ${prefix}`);
  }
  return `${prefix}:${normalizedId}`;
}

export function buildCaptureRunId(input: {
  captureRunId?: string | null;
  captureId?: string | null;
}) {
  return buildPrefixedEntityId(
    "capture_run",
    normalizeString(input.captureRunId) || normalizeString(input.captureId),
  );
}

export function buildPackageRunId(input: {
  packageRunId?: string | null;
  packageId?: string | null;
}) {
  return buildPrefixedEntityId(
    "package_run",
    normalizeString(input.packageRunId) || normalizeString(input.packageId),
  );
}

export function buildHostedReviewRunId(input: { hostedReviewRunId: string }) {
  return buildPrefixedEntityId("hosted_review_run", input.hostedReviewRunId);
}

export function buildBuyerOutcomeId(input: { buyerOutcomeId: string }) {
  return buildPrefixedEntityId("buyer_outcome", input.buyerOutcomeId);
}

export function buildOperatingGraphStateKey(input: {
  entityType: OperatingGraphEntityType;
  entityId: string;
}) {
  const entityId = normalizeString(input.entityId);
  if (!entityId) {
    throw new Error(`Missing stable id for ${input.entityType}`);
  }
  const prefix = `${input.entityType}:`;
  return entityId.startsWith(prefix) ? entityId : `${prefix}${entityId}`;
}

export function buildOperatingGraphEventId(input: {
  eventKey: string;
  stage: OperatingGraphStage;
  recordedAtIso: string;
}) {
  return crypto
    .createHash("sha256")
    .update(`${input.eventKey}|${input.stage}|${input.recordedAtIso}`)
    .digest("hex")
    .slice(0, 32);
}

export async function appendOperatingGraphEvent(input: {
  eventKey: string;
  entityType?: OperatingGraphEntityType;
  entityId: string;
  city: string;
  citySlug: string;
  stage: OperatingGraphStage;
  summary: string;
  sourceRepo: OperatingGraphRepo;
  sourceKind: string;
  origin: OperatingGraphOriginRef;
  blockingConditions?: BlockingCondition[];
  externalConfirmations?: ExternalConfirmation[];
  nextActions?: NextAction[];
  metadata?: Record<string, unknown>;
  recordedAtIso?: string;
}) {
  if (!db) {
    return null;
  }

  const recordedAtIso = normalizeString(input.recordedAtIso) || new Date().toISOString();
  const event: OperatingGraphEvent = {
    id: buildOperatingGraphEventId({
      eventKey: input.eventKey,
      stage: input.stage,
      recordedAtIso,
    }),
    event_key: input.eventKey,
    entity_type: input.entityType || "city_program",
    entity_id: input.entityId,
    city: input.city,
    city_slug: input.citySlug,
    stage: input.stage,
    summary: input.summary.trim(),
    source_repo: input.sourceRepo,
    source_kind: input.sourceKind.trim(),
    origin: input.origin,
    blocking_conditions: dedupeById(normalizeArray(input.blockingConditions)),
    external_confirmations: dedupeById(normalizeArray(input.externalConfirmations)),
    next_actions: dedupeById(normalizeArray(input.nextActions)),
    metadata: input.metadata || {},
    recorded_at_iso: recordedAtIso,
    recorded_at: recordedAtIso,
  };

  await db.collection(COLLECTION).doc(event.id).set(
    {
      ...event,
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  const eventsCollection = db.collection(COLLECTION) as FirebaseFirestore.CollectionReference | {
    where?: (...args: unknown[]) => { get: () => Promise<{ docs: Array<{ data: () => unknown }> }> };
  };
  if (typeof eventsCollection.where === "function") {
    const snapshot = await eventsCollection.where("entity_id", "==", event.entity_id).get();
    const entityEvents = snapshot.docs
      .map((doc) => doc.data() as OperatingGraphEvent)
      .filter(
        (candidate) =>
          candidate.entity_id === event.entity_id && candidate.entity_type === event.entity_type,
      );
    const projection = projectOperatingGraphState(
      entityEvents,
      event.entity_type,
      event.entity_id,
    );
    if (projection) {
      await db.collection(STATE_COLLECTION).doc(projection.stateKey).set(
        {
          ...serializeOperatingGraphState(projection),
          updated_at: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }
  }

  return event;
}
