import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import {
  appendOperatingGraphEvent,
  buildCaptureRunId,
  buildCityProgramId,
  buildSupplyTargetId,
} from "./operatingGraph";
import {
  listCityLaunchActivations,
  listCityLaunchProspects,
  type CityLaunchProspectRecord,
} from "./cityLaunchLedgers";
import { slugifyCityName } from "./cityLaunchProfiles";
import type {
  BlockingCondition,
  NextAction,
  OperatingGraphStage,
} from "./operatingGraphTypes";

const CAPTURE_SUBMISSIONS_COLLECTION = "capture_submissions";

type ProjectorIssue = {
  id: string;
  reason: string;
  sourceRef?: string;
  requiredFields?: string[];
  nextAction?: string;
};

type SourceDocument = Record<string, unknown> & { id: string };

export type OperatingGraphProjectorResult = {
  scannedCount: number;
  projectedEventCount: number;
  projectedEntityCount: number;
  skipped: ProjectorIssue[];
  skippedSummary: Record<string, number>;
};

export type OperatingGraphProjectionBlocker = {
  key: string;
  summary: string;
  owner: string;
  retryCondition: string;
  requiredInput: string[];
};

export type OperatingGraphProjectionLoopResult = {
  processedCount: number;
  failedCount: number;
  status: "projected" | "blocked";
  capture?: OperatingGraphProjectorResult;
  supply?: OperatingGraphProjectorResult;
  blockers?: OperatingGraphProjectionBlocker[];
  warnings?: string[];
};

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown) {
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

function titleCaseCityFromSlug(slug: string) {
  const parts = slug.split("-").filter(Boolean);
  if (parts.length < 2) {
    return "";
  }
  const state = parts[parts.length - 1]?.toUpperCase();
  const city = parts
    .slice(0, -1)
    .map((part) => `${part[0]?.toUpperCase() || ""}${part.slice(1)}`)
    .join(" ");
  return city && state ? `${city}, ${state}` : "";
}

function readCityContext(doc: Record<string, unknown>) {
  const cityContext = asRecord(doc.city_context);
  const explicitCity = asString(cityContext.city) || asString(doc.city);
  const explicitSlug = asString(cityContext.city_slug) || asString(doc.city_slug);
  const regionId = asString(doc.region_id);
  const citySlug = explicitSlug || (explicitCity ? slugifyCityName(explicitCity) : regionId);
  const city = explicitCity || (citySlug ? titleCaseCityFromSlug(citySlug) : "");

  return {
    city,
    citySlug,
  };
}

function buildCaptureMetadata(input: {
  cityProgramId: string;
  captureId: string;
  captureRunId: string;
  sceneId: string | null;
  siteSubmissionId: string | null;
  buyerRequestId: string | null;
  captureJobId: string | null;
  uploadState: string | null;
  status: string | null;
  rawPrefix: string | null;
}) {
  const canonical = {
    city_program_id: input.cityProgramId,
    capture_id: input.captureId,
    capture_run_id: input.captureRunId,
    ...(input.sceneId ? { scene_id: input.sceneId } : {}),
    ...(input.siteSubmissionId ? { site_submission_id: input.siteSubmissionId } : {}),
    ...(input.buyerRequestId ? { buyer_request_id: input.buyerRequestId } : {}),
    ...(input.captureJobId ? { capture_job_id: input.captureJobId } : {}),
  };
  return {
    ...canonical,
    ...(input.uploadState ? { upload_state: input.uploadState } : {}),
    ...(input.status ? { submission_status: input.status } : {}),
    ...(input.rawPrefix ? { raw_prefix: input.rawPrefix } : {}),
    canonical_foreign_keys: canonical,
  };
}

async function readCollectionBatch(collectionName: string, limit: number): Promise<SourceDocument[]> {
  if (!db) {
    return [];
  }
  const snapshot = await db.collection(collectionName).limit(limit).get();
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Record<string, unknown>),
  }));
}

function summarizeSkipped(skipped: ProjectorIssue[]) {
  return skipped.reduce<Record<string, number>>((summary, entry) => {
    summary[entry.reason] = (summary[entry.reason] || 0) + 1;
    return summary;
  }, {});
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function isFirestoreResourceExhausted(error: unknown) {
  const code = typeof error === "object" && error && "code" in error
    ? String((error as { code?: unknown }).code)
    : "";
  const message = errorMessage(error);
  return code === "8" || /\bRESOURCE_EXHAUSTED\b/i.test(message);
}

export function buildOperatingGraphProjectionBlockedResult(error: unknown): OperatingGraphProjectionLoopResult {
  const message = errorMessage(error);
  const quotaBlocked = isFirestoreResourceExhausted(error);
  return {
    processedCount: 0,
    failedCount: 1,
    status: "blocked",
    blockers: [
      {
        key: quotaBlocked ? "firestore_resource_exhausted" : "operating_graph_projection_failed",
        summary: quotaBlocked
          ? "Firestore quota was exhausted before the operating graph projection could be verified."
          : "Operating graph projection failed before a verified projection result was available.",
        owner: "reliability-agent",
        retryCondition: quotaBlocked
          ? "Retry after Firestore quota recovers or run with a smaller scoped city/limit once provider capacity is available."
          : "Inspect the projection error, fix the failing source or writer, then rerun npm run operating-graph:project.",
        requiredInput: quotaBlocked
          ? ["Firestore read/write quota capacity for capture_submissions, city launch ledgers, and operating graph event writes."]
          : [message],
      },
    ],
    warnings: [
      `projection_error: ${message}`,
      "No successful operating graph projection should be claimed from this blocked result.",
    ],
  };
}

function skippedCaptureIssue(input: {
  captureId: string;
  reason: string;
  requiredFields?: string[];
  nextAction?: string;
}): ProjectorIssue {
  return {
    id: input.captureId,
    reason: input.reason,
    sourceRef: `${CAPTURE_SUBMISSIONS_COLLECTION}/${input.captureId}`,
    ...(input.requiredFields ? { requiredFields: input.requiredFields } : {}),
    ...(input.nextAction ? { nextAction: input.nextAction } : {}),
  };
}

export async function projectCaptureSubmissionsIntoOperatingGraph(options?: {
  limit?: number;
}) {
  const limit = Math.max(1, Math.min(options?.limit ?? 500, 5_000));
  const docs = await readCollectionBatch(CAPTURE_SUBMISSIONS_COLLECTION, limit);
  const result: OperatingGraphProjectorResult = {
    scannedCount: docs.length,
    projectedEventCount: 0,
    projectedEntityCount: 0,
    skipped: [],
    skippedSummary: {},
  };

  const projectedEntityIds = new Set<string>();

  for (const doc of docs) {
    const captureId = asString(doc.capture_id) || asString(doc.id);
    if (!captureId) {
      result.skipped.push({
        id: asString(doc.id) || "unknown",
        reason: "missing_capture_id",
        sourceRef: `${CAPTURE_SUBMISSIONS_COLLECTION}/${asString(doc.id) || "unknown"}`,
        requiredFields: ["capture_id"],
        nextAction: "Write an explicit capture_id before projecting this capture submission into the operating graph.",
      });
      continue;
    }

    const cityContext = readCityContext(doc);
    if (!cityContext.city || !cityContext.citySlug) {
      result.skipped.push(skippedCaptureIssue({
        captureId,
        reason: "missing_city_context",
        requiredFields: [
          "city_context.city",
          "city_context.city_slug",
          "city",
          "city_slug",
          "region_id",
        ],
        nextAction:
          "Record explicit city_context.city plus city_context.city_slug, or another explicit city/city_slug/region_id field from Capture before projection; do not infer city from capture id or filename.",
      }));
      continue;
    }

    const lifecycle = asRecord(doc.lifecycle);
    const operationalState = asRecord(doc.operational_state);
    const captureStartedAtIso = toIso(lifecycle.capture_started_at || doc.capture_started_at);
    const uploadStartedAtIso = toIso(lifecycle.upload_started_at || doc.upload_started_at);
    const captureUploadedAtIso = toIso(lifecycle.capture_uploaded_at || doc.capture_uploaded_at);
    const submittedAtIso = toIso(doc.submitted_at || doc.created_at);
    const captureRunId = buildCaptureRunId({ captureId });
    const cityProgramId = buildCityProgramId({ citySlug: cityContext.citySlug });
    const metadata = buildCaptureMetadata({
      cityProgramId,
      captureId,
      captureRunId,
      sceneId: asString(doc.scene_id) || null,
      siteSubmissionId: asString(doc.site_submission_id) || null,
      buyerRequestId: asString(doc.buyer_request_id) || null,
      captureJobId: asString(doc.capture_job_id) || null,
      uploadState: asString(operationalState.upload_state) || null,
      status: asString(doc.status) || null,
      rawPrefix: asString(doc.raw_prefix) || null,
    });

    const inProgressAtIso = uploadStartedAtIso || captureStartedAtIso || submittedAtIso;
    if (inProgressAtIso) {
      const nextActions: NextAction[] = captureUploadedAtIso
        ? []
        : [
            {
              id: `capture_run:${captureId}:await_upload`,
              summary: "Wait for durable capture upload completion before packaging.",
              owner: "capture-codex",
              status: "awaiting_external_confirmation",
              sourceRef: `${CAPTURE_SUBMISSIONS_COLLECTION}/${captureId}`,
            },
          ];
      const event = await appendOperatingGraphEvent({
        eventKey: `capture_submission:${captureId}:capture_in_progress`,
        entityType: "capture_run",
        entityId: captureRunId,
        city: cityContext.city,
        citySlug: cityContext.citySlug,
        stage: "capture_in_progress",
        summary: `Capture ${captureId} is registered as in progress.`,
        sourceRepo: "BlueprintCapture",
        sourceKind: "capture_submission_projection",
        origin: {
          repo: "BlueprintCapture",
          project: "blueprint-capture",
          sourceCollection: CAPTURE_SUBMISSIONS_COLLECTION,
          sourceDocId: captureId,
        },
        nextActions,
        metadata,
        recordedAtIso: inProgressAtIso,
      });
      if (event) {
        result.projectedEventCount += 1;
        projectedEntityIds.add(captureRunId);
      }
    }

    if (captureUploadedAtIso) {
      const event = await appendOperatingGraphEvent({
        eventKey: `capture_submission:${captureId}:capture_uploaded`,
        entityType: "capture_run",
        entityId: captureRunId,
        city: cityContext.city,
        citySlug: cityContext.citySlug,
        stage: "capture_uploaded",
        summary: `Capture ${captureId} has durable upload truth.`,
        sourceRepo: "BlueprintCapture",
        sourceKind: "capture_submission_projection",
        origin: {
          repo: "BlueprintCapture",
          project: "blueprint-capture",
          sourceCollection: CAPTURE_SUBMISSIONS_COLLECTION,
          sourceDocId: captureId,
        },
        nextActions: [
          {
            id: `capture_run:${captureId}:pipeline_packaging`,
            summary: "Run or verify pipeline packaging from the durable uploaded capture.",
            owner: "pipeline-codex",
            status: "ready_to_execute",
            sourceRef: `${CAPTURE_SUBMISSIONS_COLLECTION}/${captureId}`,
          },
        ],
        metadata,
        recordedAtIso: captureUploadedAtIso,
      });
      if (event) {
        result.projectedEventCount += 1;
        projectedEntityIds.add(captureRunId);
      }
    }

    if (!inProgressAtIso && !captureUploadedAtIso) {
      result.skipped.push(skippedCaptureIssue({
        captureId,
        reason: "missing_lifecycle_timestamps",
        requiredFields: [
          "lifecycle.capture_started_at",
          "lifecycle.upload_started_at",
          "lifecycle.capture_uploaded_at",
          "submitted_at",
          "created_at",
        ],
        nextAction:
          "Record an explicit capture lifecycle timestamp before projecting this capture submission into the operating graph.",
      }));
    }
  }

  result.projectedEntityCount = projectedEntityIds.size;
  result.skippedSummary = summarizeSkipped(result.skipped);
  return result;
}

function prospectIsContactable(prospect: CityLaunchProspectRecord) {
  return Boolean(
    prospect.email
      || prospect.firstContactedAt
      || prospect.lastContactedAt
      || ["contacted", "responded", "qualified", "approved", "onboarded", "capturing"].includes(prospect.status),
  );
}

function prospectStage(prospect: CityLaunchProspectRecord): OperatingGraphStage {
  return prospectIsContactable(prospect) ? "supply_contactable" : "supply_seeded";
}

function prospectRecordedAtIso(prospect: CityLaunchProspectRecord) {
  if (prospectIsContactable(prospect)) {
    return prospect.firstContactedAt || prospect.lastContactedAt || prospect.updatedAtIso || prospect.createdAtIso;
  }
  return prospect.createdAtIso || prospect.updatedAtIso || new Date().toISOString();
}

function buildSupplyTargetMetadata(input: {
  cityProgramId: string;
  supplyTargetId: string;
  prospect: CityLaunchProspectRecord;
}) {
  const canonical = {
    city_program_id: input.cityProgramId,
    supply_target_id: input.supplyTargetId,
    city_launch_prospect_id: input.prospect.id,
  };
  return {
    ...canonical,
    launch_id: input.prospect.launchId,
    target_type: "city_launch_prospect",
    target_label: input.prospect.name,
    channel: input.prospect.channel,
    source_bucket: input.prospect.sourceBucket,
    site_address: input.prospect.siteAddress,
    workflow_fit: input.prospect.workflowFit,
    prospect_status: input.prospect.status,
    canonical_foreign_keys: canonical,
  };
}

function buildSupplyBlockingConditions(prospect: CityLaunchProspectRecord): BlockingCondition[] {
  if (prospectIsContactable(prospect)) {
    return [];
  }

  return [
    {
      id: `supply_target:${prospect.id}:contact_evidence`,
      status: "awaiting_external_confirmation",
      summary: "Recipient-backed contact, lawful-access confirmation, or capturer response is missing.",
      owner: prospect.ownerAgent || "capturer-growth-agent",
      evidenceStatus: "missing",
      sourceRef: `cityLaunchProspects/${prospect.id}`,
    },
  ];
}

function buildSupplyNextActions(prospect: CityLaunchProspectRecord): NextAction[] {
  if (["approved", "onboarded", "capturing"].includes(prospect.status)) {
    return [
      {
        id: `supply_target:${prospect.id}:route_first_capture`,
        summary: "Route the approved supply target into first-capture scheduling or assignment.",
        owner: "field-ops-agent",
        status: "ready_to_execute",
        sourceRef: `cityLaunchProspects/${prospect.id}`,
      },
    ];
  }

  if (prospectIsContactable(prospect)) {
    return [
      {
        id: `supply_target:${prospect.id}:continue_qualification`,
        summary: "Continue qualification until approved capturer, lawful access, or first capture evidence exists.",
        owner: prospect.ownerAgent || "capturer-success-agent",
        status: "awaiting_external_confirmation",
        sourceRef: `cityLaunchProspects/${prospect.id}`,
      },
    ];
  }

  return [
    {
      id: `supply_target:${prospect.id}:find_contact_evidence`,
      summary: "Find real contact evidence or a lawful-access path before claiming this target is contactable.",
      owner: prospect.ownerAgent || "capturer-growth-agent",
      status: "ready_to_execute",
      sourceRef: `cityLaunchProspects/${prospect.id}`,
    },
  ];
}

export async function projectCityLaunchSupplyTargetsIntoOperatingGraph(options?: {
  city?: string;
  limit?: number;
}) {
  const activations = await listCityLaunchActivations();
  const activationsByCitySlug = new Map(activations.map((activation) => [activation.citySlug, activation]));
  const cityList = options?.city ? [options.city] : activations.map((activation) => activation.city);
  const limit = Math.max(1, Math.min(options?.limit ?? 500, 2_000));
  const result: OperatingGraphProjectorResult = {
    scannedCount: 0,
    projectedEventCount: 0,
    projectedEntityCount: 0,
    skipped: [],
    skippedSummary: {},
  };
  const projectedEntityIds = new Set<string>();

  for (const city of cityList) {
    const prospects = (await listCityLaunchProspects(city)).slice(0, limit);
    for (const prospect of prospects) {
      result.scannedCount += 1;
      const citySlug = prospect.citySlug || slugifyCityName(prospect.city);
      if (!prospect.id || !prospect.city || !citySlug) {
        result.skipped.push({
          id: prospect.id || "unknown",
          reason: "missing_supply_target_identity",
          sourceRef: `cityLaunchProspects/${prospect.id || "unknown"}`,
          requiredFields: ["id", "city", "citySlug"],
          nextAction:
            "Record explicit city-launch prospect identity and city fields before projecting this supply target.",
        });
        continue;
      }

      const supplyTargetId = buildSupplyTargetId({
        cityLaunchProspectId: prospect.id,
      });
      const cityProgramId = buildCityProgramId({
        citySlug,
        budgetTier: activationsByCitySlug.get(citySlug)?.budgetTier || null,
      });
      const stage = prospectStage(prospect);
      const event = await appendOperatingGraphEvent({
        eventKey: `city_launch_supply:${prospect.id}:${stage}`,
        entityType: "supply_target",
        entityId: supplyTargetId,
        city: prospect.city,
        citySlug,
        stage,
        summary:
          stage === "supply_contactable"
            ? `Supply target ${prospect.name} is contactable or already in qualification.`
            : `Supply target ${prospect.name} has been seeded but is not yet contactable.`,
        sourceRepo: "Blueprint-WebApp",
        sourceKind: "city_launch_supply_projection",
        origin: {
          repo: "Blueprint-WebApp",
          project: "blueprint-webapp",
          sourceCollection: "cityLaunchProspects",
          sourceDocId: prospect.id,
        },
        blockingConditions: buildSupplyBlockingConditions(prospect),
        nextActions: buildSupplyNextActions(prospect),
        metadata: buildSupplyTargetMetadata({
          cityProgramId,
          supplyTargetId,
          prospect,
        }),
        recordedAtIso: prospectRecordedAtIso(prospect),
      });
      if (event) {
        result.projectedEventCount += 1;
        projectedEntityIds.add(supplyTargetId);
      }
    }
  }

  result.projectedEntityCount = projectedEntityIds.size;
  result.skippedSummary = summarizeSkipped(result.skipped);
  return result;
}

export async function runOperatingGraphProjectionLoop(params?: {
  city?: string;
  limit?: number;
  allowBlocked?: boolean;
}): Promise<OperatingGraphProjectionLoopResult> {
  try {
    const capture = await projectCaptureSubmissionsIntoOperatingGraph({ limit: params?.limit });
    const supply = await projectCityLaunchSupplyTargetsIntoOperatingGraph({
      city: params?.city,
      limit: params?.limit,
    });

    return {
      processedCount: capture.projectedEventCount + supply.projectedEventCount,
      failedCount: 0,
      status: "projected",
      capture,
      supply,
    };
  } catch (error) {
    if (params?.allowBlocked) {
      return buildOperatingGraphProjectionBlockedResult(error);
    }
    throw error;
  }
}
