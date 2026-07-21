import { Request, Response, Router } from "express";
import admin, { dbAdmin as db, storageAdmin } from "../../client/src/lib/firebaseAdmin";
import {
  DERIVED_ASSET_KEYS,
  DERIVED_ASSET_STATUSES,
  OPPORTUNITY_STATES,
  QUALIFICATION_STATES,
} from "../../client/src/lib/requestTaxonomy";
import { logger } from "../logger";
import {
  appendOperatingGraphEvent,
  buildCityProgramId,
  buildPackageRunId,
} from "../utils/operatingGraph";
import {
  parsePipelineAttachmentSyncPayload,
  type PipelineAttachmentSyncPayload,
} from "../utils/pipelineAttachmentContract";
import {
  resolveCreatorIdForCapture,
  upsertCreatorPayoutFromPipeline,
} from "../utils/accounting";
import { ensureCreatorStripeAccountId } from "../utils/stripeConnectAccounts";
import {
  computePipelineStateTransition,
  checkHostedReviewReadiness,
  growthEventsForStamps,
  buildRobotEvalCardArtifactUris,
  robotEvalPublicationPackageComplete,
} from "../utils/pipelineStateMachine";
import { logGrowthEvent } from "../utils/growth-events";
import type {
  DerivedAssetEntry,
  DerivedAssetsAttachment,
  EvaluationReadinessSummary,
  OpportunityState,
  PipelineAttachment,
  PipelineArtifacts,
  QualificationState,
  ProofPathMilestones,
} from "../types/inbound-request";
import { ZodError } from "zod";
import type { OperatingGraphStage } from "../utils/operatingGraphTypes";
import {
  buildBuyerOperatingGraphMetadata,
  deriveCityContext,
  deriveStablePackageId,
} from "../utils/buyerOutcomes";
import {
  createPipelineSyncRateLimiter,
  validatePipelineArtifactUris,
  verifyPipelineSyncRequest,
} from "../utils/pipelineSyncSecurity";
import { recordBetaOpsFailureSignal } from "../utils/ops-alerts";
import { effectiveEntitlementAccessState } from "../utils/entitlementExpiry";
import { dispatchTransactionalNotification } from "../utils/transactional-notifications";

const router = Router();
const pipelineSyncRateLimiter = createPipelineSyncRateLimiter();

const AUTO_CREATED_CONTACT = {
  firstName: "Pipeline",
  lastName: "Sync",
  email: "pipeline-sync@tryblueprint.io",
  roleTitle: "Automation",
  company: "Blueprint",
} as const;

const SIGNED_BUYER_ARTIFACT_URL_TTL_MS = 15 * 60 * 1000;
const BUYER_ARTIFACT_DIRECT_FIELDS = [
  "artifact_uri",
  "artifactUri",
  "delivery_artifact_uri",
  "deliveryArtifactUri",
  "package_uri",
  "packageUri",
  "canonical_package_uri",
  "canonicalPackageUri",
  "post_training_data_package_uri",
  "postTrainingDataPackageUri",
  "manifest_uri",
  "manifestUri",
] as const;
const BUYER_ARTIFACT_MAP_FIELDS = [
  "artifact_uris",
  "artifactUris",
  "artifacts",
  "delivery_artifacts",
  "deliveryArtifacts",
] as const;
const BUYER_ARTIFACT_NESTED_FIELDS = [
  "delivery",
  "package",
  "pipeline",
  "site_package",
  "sitePackage",
] as const;
const PREFERRED_BUYER_ARTIFACT_KEYS = [
  "post_training_data_package_uri",
  "postTrainingDataPackageUri",
  "package_uri",
  "packageUri",
  "canonical_package_uri",
  "canonicalPackageUri",
  "manifest_uri",
  "manifestUri",
  "robot_eval_dataset_manifest_uri",
] as const;

type BuyerArtifactCandidate = {
  key: string;
  uri: string;
  source: string;
};
type EntitlementRecord = {
  id: string;
  data: Record<string, unknown>;
  ref: {
    update: (payload: Record<string, unknown>) => Promise<unknown>;
  };
};

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function stringList(value: unknown): string[] {
  if (typeof value === "string") {
    return value.trim() ? [value.trim()] : [];
  }
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeArtifactKey(value: string): string {
  return value.trim().replace(/[-_\s]/g, "").toLowerCase();
}

function parseGsUri(uri: string): { bucket: string; objectPath: string } {
  const match = /^gs:\/\/([^/]+)\/(.+)$/.exec(uri.trim());
  if (!match || !match[1] || !match[2]) {
    throw new Error("artifact_uri_must_be_gs_uri");
  }
  return { bucket: match[1], objectPath: match[2] };
}

function addBuyerArtifactCandidate(
  candidates: BuyerArtifactCandidate[],
  key: string,
  uri: unknown,
  source: string,
) {
  const normalizedUri = stringValue(uri);
  if (!normalizedUri.startsWith("gs://")) {
    return;
  }
  candidates.push({ key, uri: normalizedUri, source });
}

function collectBuyerArtifactCandidates(
  value: Record<string, unknown>,
  source: string,
): BuyerArtifactCandidate[] {
  const candidates: BuyerArtifactCandidate[] = [];

  for (const field of BUYER_ARTIFACT_DIRECT_FIELDS) {
    addBuyerArtifactCandidate(candidates, field, value[field], source);
  }

  for (const field of BUYER_ARTIFACT_MAP_FIELDS) {
    const artifactMap = value[field];
    if (!isRecord(artifactMap)) {
      continue;
    }
    for (const [key, uri] of Object.entries(artifactMap)) {
      addBuyerArtifactCandidate(candidates, key, uri, source);
    }
  }

  for (const field of BUYER_ARTIFACT_NESTED_FIELDS) {
    const nested = value[field];
    if (isRecord(nested)) {
      candidates.push(...collectBuyerArtifactCandidates(nested, `${source}.${field}`));
    }
  }

  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const dedupeKey = `${normalizeArtifactKey(candidate.key)}:${candidate.uri}`;
    if (seen.has(dedupeKey)) {
      return false;
    }
    seen.add(dedupeKey);
    return true;
  });
}

function fieldFromBodyOrIds(
  body: Record<string, unknown>,
  ids: Record<string, unknown>,
  fields: string[],
): string {
  for (const field of fields) {
    const value = stringValue(body[field]) || stringValue(ids[field]);
    if (value) {
      return value;
    }
  }
  return "";
}

function selectBuyerArtifactCandidate(params: {
  candidates: BuyerArtifactCandidate[];
  artifactKey?: string;
  artifactUri?: string;
}): BuyerArtifactCandidate | null {
  const artifactUri = stringValue(params.artifactUri);
  if (artifactUri) {
    return params.candidates.find((candidate) => candidate.uri === artifactUri) || null;
  }

  const artifactKey = normalizeArtifactKey(stringValue(params.artifactKey));
  if (artifactKey) {
    return (
      params.candidates.find(
        (candidate) => normalizeArtifactKey(candidate.key) === artifactKey,
      ) || null
    );
  }

  for (const preferredKey of PREFERRED_BUYER_ARTIFACT_KEYS) {
    const candidate = params.candidates.find(
      (entry) => normalizeArtifactKey(entry.key) === normalizeArtifactKey(preferredKey),
    );
    if (candidate) {
      return candidate;
    }
  }

  return params.candidates[0] || null;
}

async function loadPublishedMarketplaceItem(sku: string): Promise<Record<string, unknown> | null> {
  if (!db || !sku) {
    return null;
  }
  for (const collectionName of ["publishedMarketplaceInventory", "marketplace_items"]) {
    const snapshot = await db.collection(collectionName).doc(sku).get();
    if (snapshot.exists) {
      return {
        id: snapshot.id || sku,
        ...((snapshot.data() || {}) as Record<string, unknown>),
      };
    }
  }
  return null;
}

async function findProvisionedEntitlement(params: {
  entitlementId?: string;
  sku?: string;
}): Promise<Record<string, unknown> | null> {
  if (!db) {
    return null;
  }

  const entitlementId = stringValue(params.entitlementId);
  if (entitlementId) {
    const snapshot = await db.collection("marketplaceEntitlements").doc(entitlementId).get();
    if (!snapshot.exists) {
      return null;
    }
    return {
      id: snapshot.id || entitlementId,
      ...((snapshot.data() || {}) as Record<string, unknown>),
    };
  }

  const sku = stringValue(params.sku);
  if (!sku) {
    return null;
  }
  const query = db
    .collection("marketplaceEntitlements")
    .where("sku", "==", sku)
    .where("access_state", "==", "provisioned")
    .limit(1);
  const snapshot = await query.get();
  const first = snapshot.docs?.[0];
  if (!first) {
    return null;
  }
  return {
    id: first.id || "",
    ...((first.data() || {}) as Record<string, unknown>),
  };
}

async function findEntitlementRecordById(entitlementId: string): Promise<EntitlementRecord | null> {
  if (!db || !entitlementId) {
    return null;
  }
  const ref = db.collection("marketplaceEntitlements").doc(entitlementId);
  const snapshot = await ref.get();
  if (!snapshot.exists) {
    return null;
  }
  return {
    id: snapshot.id || entitlementId,
    data: {
      id: snapshot.id || entitlementId,
      ...((snapshot.data() || {}) as Record<string, unknown>),
    },
    ref,
  };
}

async function queryEntitlementRecords(field: string, value: string): Promise<EntitlementRecord[]> {
  if (!db || !value) {
    return [];
  }
  const snapshot = await db
    .collection("marketplaceEntitlements")
    .where(field, "==", value)
    .limit(50)
    .get();
  return (snapshot.docs || []).map((doc) => ({
    id: doc.id || stringValue(doc.data()?.id),
    data: {
      id: doc.id || stringValue(doc.data()?.id),
      ...((doc.data() || {}) as Record<string, unknown>),
    },
    ref: doc.ref,
  }));
}

async function collectRevocationEntitlements(params: {
  body: Record<string, unknown>;
  webappIds: Record<string, unknown>;
  upstreamIds: Record<string, unknown>;
}): Promise<EntitlementRecord[]> {
  const entitlementIds = new Set<string>();
  for (const source of [params.body, params.webappIds, params.upstreamIds]) {
    for (const field of [
      "entitlement_id",
      "entitlementId",
      "marketplace_entitlement_id",
      "marketplaceEntitlementId",
      "buyer_artifact_id",
      "buyerArtifactId",
    ]) {
      const value = stringValue(source[field]);
      if (value) {
        entitlementIds.add(value);
      }
    }
    for (const value of [
      ...stringList(source.entitlement_ids),
      ...stringList(source.entitlementIds),
      ...stringList(source.marketplace_entitlement_ids),
      ...stringList(source.marketplaceEntitlementIds),
    ]) {
      entitlementIds.add(value);
    }
  }

  const records = new Map<string, EntitlementRecord>();
  for (const entitlementId of entitlementIds) {
    const record = await findEntitlementRecordById(entitlementId);
    if (record) {
      records.set(record.id, record);
    }
  }

  const sceneId = stringValue(params.body.scene_id || params.body.sceneId);
  const captureId = stringValue(params.body.capture_id || params.body.captureId);
  const queryFields: Array<[string, string]> = [
    ["scene_id", sceneId],
    ["sceneId", sceneId],
    ["capture_id", captureId],
    ["captureId", captureId],
    ["site_submission_id", stringValue(params.upstreamIds.site_submission_id || params.webappIds.site_submission_id)],
    ["siteSubmissionId", stringValue(params.upstreamIds.siteSubmissionId || params.webappIds.siteSubmissionId)],
    ["buyer_request_id", stringValue(params.upstreamIds.buyer_request_id || params.webappIds.buyer_request_id)],
    ["buyerRequestId", stringValue(params.upstreamIds.buyerRequestId || params.webappIds.buyerRequestId)],
    ["capture_job_id", stringValue(params.upstreamIds.capture_job_id || params.webappIds.capture_job_id)],
    ["captureJobId", stringValue(params.upstreamIds.captureJobId || params.webappIds.captureJobId)],
  ];
  for (const [field, value] of queryFields) {
    if (!value) {
      continue;
    }
    for (const record of await queryEntitlementRecords(field, value)) {
      records.set(record.id, record);
    }
  }

  return Array.from(records.values());
}

function artifactUriMapFromPipeline(pipeline: PipelineAttachment): Record<string, string> {
  const artifacts = isRecord(pipeline.artifacts) ? pipeline.artifacts : {};
  const candidates = collectBuyerArtifactCandidates(artifacts, "pipeline_artifacts");
  return Object.fromEntries(candidates.map((candidate) => [candidate.key, candidate.uri]));
}

async function syncBuyerEntitlementArtifacts(params: {
  body: Record<string, unknown>;
  pipeline: PipelineAttachment;
  sku?: string | null;
  siteSubmissionId?: string | null;
}): Promise<{
  status: "synced" | "skipped";
  entitlement_ids: string[];
  artifact_keys: string[];
}> {
  if (!db) {
    return { status: "skipped", entitlement_ids: [], artifact_keys: [] };
  }

  const artifactUris = artifactUriMapFromPipeline(params.pipeline);
  const artifactKeys = Object.keys(artifactUris);
  if (artifactKeys.length === 0) {
    return { status: "skipped", entitlement_ids: [], artifact_keys: [] };
  }

  const body = params.body;
  const ids = isRecord(body.webapp_response_ids) ? body.webapp_response_ids : {};
  const entitlementIds = new Set<string>();
  for (const source of [body, ids]) {
    for (const field of [
      "entitlement_id",
      "entitlementId",
      "marketplace_entitlement_id",
      "marketplaceEntitlementId",
      "buyer_artifact_id",
      "buyerArtifactId",
    ]) {
      const value = stringValue(source[field]);
      if (value) {
        entitlementIds.add(value);
      }
    }
    for (const value of [
      ...stringList(source.entitlement_ids),
      ...stringList(source.entitlementIds),
      ...stringList(source.marketplace_entitlement_ids),
      ...stringList(source.marketplaceEntitlementIds),
    ]) {
      entitlementIds.add(value);
    }
  }

  const records = new Map<string, EntitlementRecord>();
  for (const entitlementId of entitlementIds) {
    const record = await findEntitlementRecordById(entitlementId);
    if (record) {
      records.set(record.id, record);
    }
  }

  const queryFields: Array<[string, string]> = [
    ["sku", stringValue(params.sku)],
    ["capture_id", stringValue(params.pipeline.capture_id)],
    ["captureId", stringValue(params.pipeline.capture_id)],
    ["site_submission_id", stringValue(params.siteSubmissionId || body.site_submission_id)],
    ["siteSubmissionId", stringValue(params.siteSubmissionId || body.site_submission_id)],
    ["buyer_request_id", stringValue(body.buyer_request_id || params.pipeline.buyer_request_id)],
    ["buyerRequestId", stringValue(body.buyer_request_id || params.pipeline.buyer_request_id)],
  ];
  for (const [field, value] of queryFields) {
    if (!value) {
      continue;
    }
    for (const record of await queryEntitlementRecords(field, value)) {
      records.set(record.id, record);
    }
  }

  const directArtifactFields: Record<string, string> = {};
  for (const field of BUYER_ARTIFACT_DIRECT_FIELDS) {
    const uri = artifactUris[field];
    if (uri) {
      directArtifactFields[field] = uri;
    }
  }
  const syncedIds: string[] = [];
  for (const record of records.values()) {
    if (effectiveEntitlementAccessState(record.data) !== "provisioned") {
      continue;
    }
    const existingArtifacts = isRecord(record.data.artifact_uris)
      ? record.data.artifact_uris
      : {};
    await record.ref.update({
      ...directArtifactFields,
      artifact_uris: {
        ...existingArtifacts,
        ...artifactUris,
      },
      artifact_delivery: {
        status: "artifact_ready",
        source: "pipeline_attachment_sync",
        synced_at: admin.firestore.FieldValue.serverTimestamp(),
      },
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });
    await dispatchTransactionalNotification({
      eventType: "delivery_ready",
      recipientType: "buyer",
      recipientUserId: stringValue(record.data.buyer_user_id || record.data.buyerUserId),
      recipientEmail: stringValue(record.data.buyer_email || record.data.buyerEmail),
      subjectId: record.id,
      sourceEventId: `delivery-ready:${record.id}:${artifactKeys.join(",")}`,
      sourceCollection: "marketplaceEntitlements",
      sourceDocId: record.id,
      title: "Blueprint delivery is ready",
      body: `${stringValue(record.data.title || record.data.sku) || "Your Blueprint package"} is ready for buyer artifact access.`,
      emailSubject: "Your Blueprint delivery is ready",
      emailText: `${stringValue(record.data.title || record.data.sku) || "Your Blueprint package"} is ready for buyer artifact access.`,
      preferenceKey: "account",
      data: {
        entitlement_id: record.id,
        sku: stringValue(record.data.sku),
        artifact_keys: artifactKeys.join(","),
      },
    });
    syncedIds.push(record.id);
  }

  return {
    status: syncedIds.length > 0 ? "synced" : "skipped",
    entitlement_ids: syncedIds,
    artifact_keys: artifactKeys,
  };
}

function allowPipelinePlaceholderRequests() {
  if (process.env.NODE_ENV === "production") {
    return false;
  }
  const normalized = String(process.env.PIPELINE_SYNC_ALLOW_PLACEHOLDER_REQUESTS || "")
    .trim()
    .toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function missingPipelineUpstreamLinks(body: Record<string, unknown>) {
  const requiredFields = [
    "site_submission_id",
    "request_id",
    "buyer_request_id",
    "capture_job_id",
  ] as const;
  return requiredFields.filter((field) => !String(body[field] || "").trim());
}

function inferDefaultOpportunityState(
  qualificationState: QualificationState
): OpportunityState {
  if (
    qualificationState === "qualified_ready" ||
    qualificationState === "qualified_risky"
  ) {
    return "handoff_ready";
  }
  return "not_applicable";
}

function isQualificationState(value: string): value is QualificationState {
  return (QUALIFICATION_STATES as readonly string[]).includes(value);
}

function isOpportunityState(value: string): value is OpportunityState {
  return (OPPORTUNITY_STATES as readonly string[]).includes(value);
}

function isDerivedAssetStatus(
  value: string
): value is DerivedAssetEntry["status"] {
  return (DERIVED_ASSET_STATUSES as readonly string[]).includes(value);
}

function requirePipelineToken(req: Request, res: Response, next: () => void) {
  const result = verifyPipelineSyncRequest(req);
  if (!result.ok) {
    return res.status(result.status).json({
      error: result.message,
      code: result.code,
    });
  }
  next();
}

function buildPipelineAttachment(
  body: Record<string, unknown>,
  current?: PipelineAttachment
): PipelineAttachment {
  const artifacts = body.artifacts && typeof body.artifacts === "object" ? body.artifacts : {};
  return {
    buyer_request_id: String(body.buyer_request_id || current?.buyer_request_id || ""),
    capture_job_id: String(body.capture_job_id || current?.capture_job_id || ""),
    scene_id: String(body.scene_id || current?.scene_id || ""),
    capture_id: String(body.capture_id || current?.capture_id || ""),
    pipeline_prefix: String(body.pipeline_prefix || current?.pipeline_prefix || ""),
    artifacts: {
      ...(current?.artifacts || {}),
      ...(artifacts as PipelineArtifacts),
    },
    synced_at: admin.firestore.FieldValue.serverTimestamp() as never,
  };
}

function buildDerivedAssets(
  body: Record<string, unknown>,
  current?: DerivedAssetsAttachment
): DerivedAssetsAttachment | undefined {
  const derivedAssets = body.derived_assets;
  if (!derivedAssets || typeof derivedAssets !== "object") {
    return current;
  }

  const next: DerivedAssetsAttachment = {
    ...(current || {}),
  };

  for (const key of DERIVED_ASSET_KEYS) {
    const rawEntry = (derivedAssets as Record<string, unknown>)[key];
    if (rawEntry == null) {
      continue;
    }

    if (typeof rawEntry !== "object") {
      throw new Error(`derived_assets.${key} must be an object`);
    }

    const status = String((rawEntry as Record<string, unknown>).status || "").trim();
    if (!isDerivedAssetStatus(status)) {
      throw new Error(`derived_assets.${key}.status is invalid`);
    }

    const previousEntry = current?.[key];
    const rawUpdatedAt = (rawEntry as Record<string, unknown>).updated_at;
    next[key] = {
      ...(previousEntry || {}),
      ...(rawEntry as DerivedAssetEntry),
      status,
      ...(rawUpdatedAt !== undefined ? { updated_at: rawUpdatedAt as never } : {}),
    };
  }

  next.synced_at = admin.firestore.FieldValue.serverTimestamp() as never;
  return next;
}

function buildEvaluationReadiness(
  body: Record<string, unknown>,
  current?: EvaluationReadinessSummary
): EvaluationReadinessSummary | undefined {
  const readiness = body.evaluation_readiness;
  if (!readiness || typeof readiness !== "object") {
    return current;
  }
  return {
    ...(current || {}),
    ...(readiness as EvaluationReadinessSummary),
  };
}

const PIPELINE_FAILURE_STATUSES = new Set([
  "aborted",
  "blocked",
  "cancelled",
  "canceled",
  "crashed",
  "error",
  "errored",
  "failed",
  "failure",
  "timed_out",
  "timeout",
]);

function pipelineFailureStatus(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return PIPELINE_FAILURE_STATUSES.has(normalized) ? normalized : null;
}

function pipelineFailureRecord(
  record: Record<string, unknown> | undefined,
  fields: string[],
): { field: string; status: string } | null {
  if (!record) {
    return null;
  }
  for (const field of fields) {
    const status = pipelineFailureStatus(record[field]);
    if (status) {
      return { field, status };
    }
  }
  return null;
}

function alertScopeForPipelineSync(
  parsedBody: PipelineAttachmentSyncPayload,
  fallbackDocId: string,
) {
  return (
    String(parsedBody.capture_job_id || "").trim() ||
    String(parsedBody.capture_id || "").trim() ||
    String(parsedBody.request_id || "").trim() ||
    String(parsedBody.site_submission_id || "").trim() ||
    fallbackDocId
  );
}

function collectPackageFailureReasons(params: {
  derivedAssets?: DerivedAssetsAttachment;
  evaluationReadiness?: EvaluationReadinessSummary;
}) {
  const reasons: Array<Record<string, unknown>> = [];
  const derivedAssets = params.derivedAssets || {};
  for (const key of ["dataset_package", "validation_package"] as const) {
    const entry = derivedAssets[key];
    if (!isRecord(entry)) {
      continue;
    }
    const status = pipelineFailureStatus(entry.status);
    if (!status) {
      continue;
    }
    reasons.push({
      surface: `derived_assets.${key}`,
      status,
      manifest_uri: entry.manifest_uri || null,
      artifact_uri: entry.artifact_uri || null,
    });
  }

  const readiness = params.evaluationReadiness;
  const datasetSummary = isRecord(readiness?.robot_eval_dataset_summary)
    ? readiness.robot_eval_dataset_summary
    : undefined;
  const datasetFailure = pipelineFailureRecord(datasetSummary, [
    "status",
    "dataset_state",
    "required_artifact_status",
    "package_status",
    "publication_status",
    "delivery_status",
  ]);
  if (datasetFailure) {
    reasons.push({
      surface: `evaluation_readiness.robot_eval_dataset_summary.${datasetFailure.field}`,
      status: datasetFailure.status,
      manifest_uri: datasetSummary?.manifest_uri || null,
      missing_required_artifacts: datasetSummary?.missing_required_artifacts || null,
    });
  }

  return reasons;
}

async function recordPipelineSyncFailureSignals(params: {
  docId: string;
  parsedBody: PipelineAttachmentSyncPayload;
  packageId: string;
  derivedAssets?: DerivedAssetsAttachment;
  evaluationReadiness?: EvaluationReadinessSummary;
}) {
  const signals: Array<Parameters<typeof recordBetaOpsFailureSignal>[0]> = [];
  const scopeId = alertScopeForPipelineSync(params.parsedBody, params.docId);
  const readiness = params.evaluationReadiness;
  const providerRun = isRecord(readiness?.provider_run)
    ? readiness.provider_run
    : undefined;
  const providerFailure =
    pipelineFailureRecord(providerRun, ["status", "state", "provider_status"]) ||
    (pipelineFailureStatus(readiness?.preview_status)
      ? { field: "preview_status", status: pipelineFailureStatus(readiness?.preview_status)! }
      : null);
  const previewSimulation = params.derivedAssets?.preview_simulation;
  const previewFailureStatus = isRecord(previewSimulation)
    ? pipelineFailureStatus(previewSimulation.status)
    : null;

  if (providerFailure || previewFailureStatus) {
    signals.push({
      kind: "provider_run_failure",
      scopeId:
        String(providerRun?.provider_run_id || "").trim() ||
        String(params.parsedBody.capture_job_id || "").trim() ||
        scopeId,
      severity: "critical",
      summary: "Pipeline provider run failed during attachment sync.",
      details: {
        request_id: params.parsedBody.request_id || params.docId,
        site_submission_id: params.parsedBody.site_submission_id || null,
        buyer_request_id: params.parsedBody.buyer_request_id || null,
        capture_job_id: params.parsedBody.capture_job_id || null,
        capture_id: params.parsedBody.capture_id || null,
        scene_id: params.parsedBody.scene_id || null,
        provider_name: providerRun?.provider_name || null,
        provider_model: providerRun?.provider_model || null,
        provider_run_id: providerRun?.provider_run_id || null,
        status_field: providerFailure?.field || "derived_assets.preview_simulation.status",
        status: providerFailure?.status || previewFailureStatus,
        failure_reason: providerRun?.failure_reason || null,
        preview_manifest_uri: providerRun?.preview_manifest_uri || null,
      },
    });
  }

  const packageFailures = collectPackageFailureReasons({
    derivedAssets: params.derivedAssets,
    evaluationReadiness: readiness,
  });
  if (packageFailures.length > 0) {
    signals.push({
      kind: "package_generation_failure",
      scopeId: params.packageId || scopeId,
      severity: "critical",
      summary: "Pipeline package generation failed during attachment sync.",
      details: {
        request_id: params.parsedBody.request_id || params.docId,
        site_submission_id: params.parsedBody.site_submission_id || null,
        buyer_request_id: params.parsedBody.buyer_request_id || null,
        capture_job_id: params.parsedBody.capture_job_id || null,
        capture_id: params.parsedBody.capture_id || null,
        scene_id: params.parsedBody.scene_id || null,
        package_id: params.packageId || null,
        failures: packageFailures,
      },
    });
  }

  for (const signal of signals) {
    await recordBetaOpsFailureSignal(signal).catch((err: unknown) => {
      logger.warn(
        { err, kind: signal.kind, scopeId: signal.scopeId },
        "Failed to record pipeline sync ops alert signal",
      );
    });
  }
}

function buildPlaceholderInboundRequest(params: {
  requestId: string;
  siteSubmissionId: string;
  buyerRequestId?: string;
  qualificationState: QualificationState;
  opportunityState: OpportunityState;
  sceneId?: string;
  captureId?: string;
}) {
  const siteLabel =
    String(params.siteSubmissionId || params.sceneId || params.requestId).trim() ||
    params.requestId;
  const sceneLabel = String(params.sceneId || "").trim();
  const captureLabel = String(params.captureId || "").trim();
  const locationDetail = sceneLabel ? `Scene ${sceneLabel}` : "Location pending";
  const taskDetail = captureLabel
    ? `Pipeline-backed site world from capture ${captureLabel}.`
    : "Pipeline-backed site world awaiting request details.";

  return {
    requestId: params.requestId,
    site_submission_id: params.siteSubmissionId,
    buyer_request_id: params.buyerRequestId || null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    status: params.qualificationState,
    qualification_state: params.qualificationState,
    opportunity_state: params.opportunityState,
    priority: "normal",
    owner: {},
    contact: AUTO_CREATED_CONTACT,
    request: {
      budgetBucket: "Undecided/Unsure",
      requestedLanes: ["deeper_evaluation"],
      helpWith: [],
      buyerType: "robot_team",
      siteName: `Pipeline site ${siteLabel}`,
      siteLocation: locationDetail,
      taskStatement: taskDetail,
      workflowContext: null,
      operatingConstraints: null,
      privacySecurityConstraints: null,
      knownBlockers: null,
      targetRobotTeam: null,
      captureRights: null,
      derivedScenePermission: null,
      datasetLicensingPermission: null,
      payoutEligibility: null,
      details:
        "Auto-created by /api/internal/pipeline/attachments because no inbound request record existed yet.",
    },
    context: {
      sourcePageUrl: "pipeline://attachments",
      referrer: null,
      utm: {},
      userAgent: "internal-pipeline",
      timezoneOffset: null,
      locale: null,
      ipHash: null,
    },
    enrichment: {
      companyDomain: "tryblueprint.io",
      companySize: null,
      geo: null,
      notes:
        "Placeholder request seeded automatically from pipeline artifact sync.",
    },
    events: {
      confirmationEmailSentAt: null,
      slackNotifiedAt: null,
      crmSyncedAt: null,
    },
    ops: {
      assigned_region_id: null,
      rights_status: "unknown",
      capture_policy_tier: "review_required",
      capture_status: "not_requested",
      recapture_reason: null,
      quote_status: "not_started",
      next_step:
        "Review the auto-created pipeline-backed request and backfill customer metadata if needed.",
      last_buyer_ready_at: null,
      proof_path: {
        exact_site_requested_at: null,
        qualified_inbound_at: null,
        proof_pack_delivered_at: null,
        proof_pack_reviewed_at: null,
        hosted_review_ready_at: null,
        hosted_review_started_at: null,
        hosted_review_follow_up_at: null,
        artifact_handoff_delivered_at: null,
        artifact_handoff_accepted_at: null,
        human_commercial_handoff_at: null,
      },
    },
    debug: {
      schemaVersion: 2,
      autoCreatedByPipeline: true,
    },
  };
}

function marketplaceSkuFromPipeline(params: {
  requestId: string;
  captureId?: string | null;
  sceneId?: string | null;
}) {
  const raw = String(params.captureId || params.sceneId || params.requestId || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `robot-eval-${raw || "package"}`;
}

async function publishQualifiedMarketplaceInventory(params: {
  requestId: string;
  currentData?: Record<string, unknown>;
  pipeline: PipelineAttachment;
  qualificationState: QualificationState;
  evaluationReadiness?: EvaluationReadinessSummary;
}) {
  if (!db) {
    return null;
  }
  if (
    params.qualificationState !== "qualified_ready" ||
    !robotEvalPublicationPackageComplete(params.pipeline.artifacts)
  ) {
    return null;
  }

  const request = params.currentData?.request as Record<string, unknown> | undefined;
  const context = params.currentData?.context as Record<string, unknown> | undefined;
  const siteName = String(request?.siteName || params.pipeline.scene_id || params.requestId).trim();
  const siteLocation = String(request?.siteLocation || context?.demandCity || "").trim();
  const sku = marketplaceSkuFromPipeline({
    requestId: params.requestId,
    captureId: params.pipeline.capture_id,
    sceneId: params.pipeline.scene_id,
  });
  const artifactUris = buildRobotEvalCardArtifactUris(params.pipeline.artifacts);
  const record = {
    sku,
    type: "training",
    itemType: "training",
    title: `${siteName} robot evaluation package`,
    description:
      "Qualified captured-site robot evaluation artifact package. Publication means required dataset card artifacts are present; it is not a deployment approval or physical-robot safety validation.",
    locationType: siteLocation || "Captured site",
    objectTags: ["robot-evaluation", "captured-site", "qualified-ready"],
    policySlugs: [],
    tags: ["robot-evaluation", "capture-backed"],
    deliverables: ["dataset cards", "proof boundaries", "rights packet"],
    dataFormat: "Blueprint robot evaluation package",
    trajectoryLength: "Captured-site artifact package",
    sensorModalities: ["rgb", "metadata"],
    price: 0,
    inStock: true,
    status: "published",
    delivery_mode: "buyer_artifact_access",
    fulfillment_status: "artifact_ready",
    rights_status: "publishable_artifact_packet_present",
    source: "pipeline_state_machine",
    request_id: params.requestId,
    site_submission_id:
      String(params.currentData?.site_submission_id || params.requestId).trim() || params.requestId,
    buyer_request_id:
      String(params.pipeline.buyer_request_id || params.currentData?.buyer_request_id || "").trim() || null,
    capture_job_id: String(params.pipeline.capture_job_id || "").trim() || null,
    scene_id: String(params.pipeline.scene_id || "").trim() || null,
    capture_id: String(params.pipeline.capture_id || "").trim() || null,
    pipeline_prefix: String(params.pipeline.pipeline_prefix || "").trim() || null,
    artifact_uris: artifactUris,
    evaluation_readiness: params.evaluationReadiness || null,
    published_at: admin.firestore.FieldValue.serverTimestamp(),
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
  };

  await Promise.all([
    db.collection("publishedMarketplaceInventory").doc(sku).set(record, { merge: true }),
    db.collection("marketplace_items").doc(sku).set(record, { merge: true }),
  ]);
  return { sku };
}

async function upsertCaptureCreatorLinkage(params: {
  requestId: string;
  currentData?: Record<string, unknown>;
  pipeline: PipelineAttachment;
  parsedBody: Record<string, unknown>;
  rawBody?: Record<string, unknown>;
}) {
  if (!db) {
    return null;
  }
  const captureId = String(params.pipeline.capture_id || params.parsedBody.capture_id || "").trim();
  if (!captureId) {
    return null;
  }

  const captureRef = db.collection("capture_submissions").doc(captureId) as FirebaseFirestore.DocumentReference & {
    get?: () => Promise<FirebaseFirestore.DocumentSnapshot>;
  };
  let creatorId = "";
  try {
    const existing = typeof captureRef.get === "function" ? await captureRef.get() : null;
    creatorId =
      String(existing?.data()?.creator_id || params.rawBody?.creator_id || "").trim();
  } catch {
    creatorId = String(params.rawBody?.creator_id || "").trim();
  }

  const siteSubmissionId =
    String(
      params.parsedBody.site_submission_id ||
        params.currentData?.site_submission_id ||
        params.requestId ||
        "",
    ).trim() || params.requestId;
  const payload = {
    capture_id: captureId,
    ...(creatorId ? { creator_id: creatorId } : {}),
    scene_id: String(params.pipeline.scene_id || params.parsedBody.scene_id || "").trim() || null,
    site_submission_id: siteSubmissionId,
    buyer_request_id:
      String(params.pipeline.buyer_request_id || params.parsedBody.buyer_request_id || "").trim() || null,
    capture_job_id:
      String(params.pipeline.capture_job_id || params.parsedBody.capture_job_id || "").trim() || null,
    pipeline_prefix: String(params.pipeline.pipeline_prefix || "").trim() || null,
    lifecycle: {
      pipeline_handoff_published_at: admin.firestore.FieldValue.serverTimestamp(),
    },
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
  };

  await captureRef.set(payload, { merge: true });
  if (creatorId) {
    await db.collection("creatorProfiles").doc(creatorId).set(
      {
        creator_id: creatorId,
        uid: creatorId,
        last_capture_id: captureId,
        last_site_submission_id: siteSubmissionId,
        native_capture_identity: {
          source: "pipeline_sync",
          linked_at: admin.firestore.FieldValue.serverTimestamp(),
          last_capture_id: captureId,
        },
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }
  return { capture_id: captureId, creator_id: creatorId || null };
}

router.post(
  "/attachments",
  pipelineSyncRateLimiter,
  requirePipelineToken,
  async (req: Request, res: Response) => {
  try {
    if (!db) {
      return res.status(500).json({ error: "Database not available" });
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const parsedBody = parsePipelineAttachmentSyncPayload(body);
    const artifactUriViolations = validatePipelineArtifactUris(parsedBody);
    if (artifactUriViolations.length > 0) {
      return res.status(400).json({
        error: "Pipeline artifact URIs must resolve under the configured Blueprint GCS bucket prefix.",
        code: "invalid_pipeline_artifact_uri",
        violations: artifactUriViolations,
      });
    }
    const siteSubmissionId = String(parsedBody.site_submission_id || "").trim();
    const requestId = String(parsedBody.request_id || "").trim();
    const missingUpstreamLinks = missingPipelineUpstreamLinks(parsedBody);
    const authoritativeStateUpdate = parsedBody.authoritative_state_update === true;
    const qualificationState = String(parsedBody.qualification_state || "").trim();
    const opportunityState = String(parsedBody.opportunity_state || "").trim();
    const readinessQualificationState = String(
      parsedBody.evaluation_readiness?.qualification_state || "",
    ).trim();
    const readinessOpportunityState = String(
      parsedBody.evaluation_readiness?.opportunity_state || "",
    ).trim();

    if (!siteSubmissionId && !requestId) {
      return res.status(400).json({ error: "site_submission_id or request_id is required" });
    }
    if (missingUpstreamLinks.length > 0) {
      return res.status(400).json({
        error:
          "Pipeline sync requires upstream request, site submission, buyer request, and capture job links.",
        code: "missing_pipeline_upstream_link",
        missing_fields: missingUpstreamLinks,
        request_id: requestId || null,
        site_submission_id: siteSubmissionId || null,
      });
    }

    let docRef: FirebaseFirestore.DocumentReference | null = null;
    let currentData: Record<string, unknown> | null = null;
    let shouldCreate = false;
    if (siteSubmissionId) {
      const snapshot = await db
        .collection("inboundRequests")
        .where("site_submission_id", "==", siteSubmissionId)
        .limit(1)
        .get();
      const matchedDoc = snapshot.docs[0];
      docRef = matchedDoc?.ref ?? null;
      currentData = (matchedDoc?.data?.() as Record<string, unknown>) ?? null;
    }
    if (!docRef && requestId) {
      const fallbackRef = db.collection("inboundRequests").doc(requestId);
      const doc = await fallbackRef.get();
      if (doc.exists) {
        docRef = fallbackRef;
        currentData = (doc.data() as Record<string, unknown>) ?? null;
      }
    }
    if (!docRef) {
      if (!allowPipelinePlaceholderRequests()) {
        return res.status(409).json({
          error: "Inbound request bootstrap is required before pipeline attachment sync.",
          code: "missing_inbound_request_bootstrap",
          request_id: requestId || null,
          site_submission_id: siteSubmissionId || null,
        });
      }
      logger.warn(
        { requestId: requestId || null, siteSubmissionId: siteSubmissionId || null },
        "Using non-production pipeline placeholder request fallback",
      );
      const targetDocId = requestId || siteSubmissionId;
      docRef = db.collection("inboundRequests").doc(targetDocId);
      shouldCreate = true;
    }

    const nextQualificationStateSource =
      qualificationState || readinessQualificationState;
    const nextOpportunityStateSource =
      opportunityState || readinessOpportunityState;

    if (authoritativeStateUpdate && !isQualificationState(nextQualificationStateSource)) {
      return res.status(400).json({ error: "Valid qualification_state is required" });
    }

    if (nextOpportunityStateSource && !isOpportunityState(nextOpportunityStateSource)) {
      return res.status(400).json({ error: "Invalid opportunity_state" });
    }

    const pipeline = buildPipelineAttachment(parsedBody, currentData?.pipeline as PipelineAttachment);
    const derivedAssets = buildDerivedAssets(
      parsedBody,
      currentData?.derived_assets as DerivedAssetsAttachment | undefined
    );
    const evaluationReadiness = buildEvaluationReadiness(
      parsedBody,
      currentData?.evaluation_readiness as EvaluationReadinessSummary | undefined
    );
    const nextQualificationState = authoritativeStateUpdate
      ? (nextQualificationStateSource as QualificationState)
      : String(
          currentData?.qualification_state || currentData?.status || "submitted"
        ).trim() as QualificationState;
    const nextOpportunityState = (
      authoritativeStateUpdate
        ? nextOpportunityStateSource ||
          currentData?.opportunity_state ||
          inferDefaultOpportunityState(nextQualificationState)
        : currentData?.opportunity_state ||
          inferDefaultOpportunityState(nextQualificationState)
    ) as OpportunityState;
    const currentBuyerType =
      shouldCreate
        ? "robot_team"
        : String(
            (currentData?.request as Record<string, unknown> | undefined)?.buyerType || "",
          ).trim();
    const currentOps =
      currentData?.ops && typeof currentData.ops === "object"
        ? (currentData.ops as Record<string, unknown>)
        : {};
    const currentProofPath: ProofPathMilestones =
      currentOps.proof_path && typeof currentOps.proof_path === "object"
        ? (currentOps.proof_path as ProofPathMilestones)
        : {
            exact_site_requested_at: null,
            qualified_inbound_at: null,
            proof_pack_delivered_at: null,
            proof_pack_reviewed_at: null,
            hosted_review_ready_at: null,
            hosted_review_started_at: null,
            hosted_review_follow_up_at: null,
            artifact_handoff_delivered_at: null,
            artifact_handoff_accepted_at: null,
            human_commercial_handoff_at: null,
          };

    // Use the pipeline state machine for comprehensive state transition
    const stateTransition = computePipelineStateTransition({
      artifacts: pipeline.artifacts,
      derivedAssets: derivedAssets || (currentData?.derived_assets as DerivedAssetsAttachment | undefined),
      evaluationReadiness: evaluationReadiness || (currentData?.evaluation_readiness as EvaluationReadinessSummary | undefined),
      authoritativeStateUpdate,
      explicitQualificationState: parsedBody.qualification_state,
      explicitOpportunityState: parsedBody.opportunity_state,
      currentQualificationState: nextQualificationState as QualificationState | undefined,
      currentOpportunityState: nextOpportunityState as OpportunityState | undefined,
      currentProofPath,
      currentOps,
      currentDerivedAssets: currentData?.derived_assets as DerivedAssetsAttachment | undefined,
      currentEvaluationReadiness: currentData?.evaluation_readiness as EvaluationReadinessSummary | undefined,
    });

    const finalQualificationState = authoritativeStateUpdate
      ? stateTransition.qualificationState
      : nextQualificationState;
    const finalOpportunityState = authoritativeStateUpdate
      ? stateTransition.opportunityState
      : nextOpportunityState;

    const updatePayload: Record<string, unknown> = {
      pipeline,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (siteSubmissionId && !currentData?.site_submission_id) {
      updatePayload.site_submission_id = siteSubmissionId;
    }

    if (parsedBody.buyer_request_id) {
      updatePayload.buyer_request_id = String(parsedBody.buyer_request_id || "").trim();
    }

    if (derivedAssets) {
      updatePayload.derived_assets = derivedAssets;
    }

    if (stateTransition.evaluationReadiness) {
      updatePayload.evaluation_readiness = stateTransition.evaluationReadiness;
    } else if (evaluationReadiness) {
      updatePayload.evaluation_readiness = evaluationReadiness;
    }

    const payoutRecommendationSource =
      (stateTransition.evaluationReadiness || evaluationReadiness) && typeof (stateTransition.evaluationReadiness || evaluationReadiness) === "object"
        ? ((stateTransition.evaluationReadiness || evaluationReadiness) as Record<string, unknown>)
        : null;
    const payoutRecommendation =
      payoutRecommendationSource &&
      typeof payoutRecommendationSource.capturer_payout_recommendation === "object"
        ? (payoutRecommendationSource.capturer_payout_recommendation as Record<string, unknown>)
        : null;
    if (parsedBody.capture_id && payoutRecommendation) {
      const creatorId = await resolveCreatorIdForCapture(
        String(parsedBody.capture_id || ""),
      );
      const stripeConnectAccountId = creatorId
        ? await ensureCreatorStripeAccountId(creatorId)
        : null;
      await upsertCreatorPayoutFromPipeline({
        captureId: String(parsedBody.capture_id || ""),
        sceneId: String(parsedBody.scene_id || "") || null,
        captureJobId: String(parsedBody.capture_job_id || "") || null,
        buyerRequestId: String(parsedBody.buyer_request_id || "") || null,
        siteSubmissionId:
          String(parsedBody.site_submission_id || parsedBody.request_id || "") || null,
        qualificationState: String(parsedBody.qualification_state || "") || null,
        opportunityState: String(parsedBody.opportunity_state || "") || null,
        recommendation: payoutRecommendation,
        recommendationUri:
          typeof parsedBody.artifacts?.capturer_payout_recommendation_uri === "string"
            ? parsedBody.artifacts.capturer_payout_recommendation_uri
            : null,
        stripeConnectAccountId,
      });
    }

    if (authoritativeStateUpdate) {
      updatePayload.status = finalQualificationState;
      updatePayload.qualification_state = finalQualificationState;
      updatePayload.opportunity_state = finalOpportunityState;
    }

    // Update ops envelope from state machine (includes proof path milestones)
    const updatedOps = {
      ...currentOps,
      proof_path: stateTransition.proofPathUpdate.proofPath,
      ...(stateTransition.opsUpdate.capturePolicyTier ? {
        capture_policy_tier: stateTransition.opsUpdate.capturePolicyTier,
      } : {}),
      ...(stateTransition.opsUpdate.rightsStatus ? {
        rights_status: stateTransition.opsUpdate.rightsStatus,
      } : {}),
      ...(stateTransition.opsUpdate.captureStatus ? {
        capture_status: stateTransition.opsUpdate.captureStatus,
      } : {}),
      ...(stateTransition.opsUpdate.quoteStatus ? {
        quote_status: stateTransition.opsUpdate.quoteStatus,
      } : {}),
      ...(stateTransition.opsUpdate.nextStep ? {
        next_step: stateTransition.opsUpdate.nextStep,
      } : {}),
    };
    updatePayload.ops = updatedOps;

    if (shouldCreate) {
      const placeholderRecord = buildPlaceholderInboundRequest({
        requestId: docRef.id,
        siteSubmissionId: siteSubmissionId || docRef.id,
        buyerRequestId: String(parsedBody.buyer_request_id || "").trim() || undefined,
        qualificationState: nextQualificationState,
        opportunityState: nextOpportunityState,
        sceneId: pipeline.scene_id,
        captureId: pipeline.capture_id,
      });
      await docRef.set(
        {
          ...placeholderRecord,
          ...updatePayload,
          ...(updatePayload.ops
            ? {
                ops: {
                  ...(placeholderRecord.ops || {}),
                  ...(updatePayload.ops as Record<string, unknown>),
                },
              }
            : {}),
        },
        { merge: true }
      );
    } else {
      await docRef.update(updatePayload);
    }

    const captureCreatorLinkage = await upsertCaptureCreatorLinkage({
      requestId: docRef.id,
      currentData: currentData || undefined,
      pipeline,
      parsedBody,
      rawBody: body,
    });

    const marketplacePublication = await publishQualifiedMarketplaceInventory({
      requestId: docRef.id,
      currentData: currentData || undefined,
      pipeline,
      qualificationState: finalQualificationState,
      evaluationReadiness,
    });
    const buyerEntitlementArtifactSync = await syncBuyerEntitlementArtifacts({
      body: {
        ...body,
        ...parsedBody,
      },
      pipeline,
      sku: marketplacePublication?.sku || null,
      siteSubmissionId: siteSubmissionId || requestId || docRef.id,
    });
    const responsePackageId = deriveStablePackageId({
      captureId: pipeline?.capture_id || null,
      sceneId: pipeline?.scene_id || null,
      siteSubmissionId: siteSubmissionId || requestId || docRef.id,
      buyerRequestId:
        String(parsedBody.buyer_request_id || pipeline?.buyer_request_id || currentData?.buyer_request_id || "")
          .trim()
        || null,
      requestId: docRef.id,
    });
    await recordPipelineSyncFailureSignals({
      docId: docRef.id,
      parsedBody,
      packageId: responsePackageId,
      derivedAssets,
      evaluationReadiness,
    });

    // Emit growth events for newly stamped milestones and stall detection
    const requestIdForEvent = docRef.id;
    const cityForEvent =
      (currentData?.context as Record<string, unknown> | undefined)?.demandCity as string | null ?? null;
    const buyerSegmentForEvent =
      ((currentData?.contact as Record<string, unknown> | undefined)?.roleTitle as string | null) ?? null;

    const milestoneEvents = growthEventsForStamps(
      stateTransition.proofPathUpdate.stampedThisSync
    );
    for (const event of milestoneEvents) {
      await logGrowthEvent({
        event,
        source: "server:pipeline_state_machine",
        properties: {
          request_id: requestIdForEvent,
          city: cityForEvent,
          buyer_segment: buyerSegmentForEvent,
          pipeline_sync: true,
        },
      }).catch((err: unknown) => {
        logger.warn({ err, event }, "Failed to emit pipeline growth event");
      });
    }

    // Emit proof_motion_stalled when pipeline detects a stall
    if (stateTransition.proofMotionStalled) {
      await logGrowthEvent({
        event: "proof_motion_stalled",
        source: "server:pipeline_state_machine",
        properties: {
          request_id: requestIdForEvent,
          city: cityForEvent,
          blocker_reason: stateTransition.stallReason,
          buyer_segment: buyerSegmentForEvent,
          pipeline_sync: true,
        },
      }).catch((err: unknown) => {
        logger.warn({ err, event: "proof_motion_stalled" }, "Failed to emit pipeline growth event");
      });

      // Emit Sacramento proof-motion contract instrumented event if city is Sacramento
      if (cityForEvent === "sacramento-ca") {
        await logGrowthEvent({
          event: "sacramento_proof_motion_contract_instrumented",
          source: "server:pipeline_state_machine",
          properties: {
            request_id: requestIdForEvent,
            city: cityForEvent,
            pipeline_sync: true,
          },
        }).catch((err: unknown) => {
          logger.warn({ err, event: "sacramento_proof_motion_contract_instrumented" }, "Failed to emit Sacramento contract event");
        });
      }
    }

    if (cityForEvent) {
      const hostedReviewReadiness = checkHostedReviewReadiness({
        artifacts: pipeline?.artifacts,
        derivedAssets,
      });
      const cityContext = deriveCityContext({
        city: cityForEvent,
      });
      const packageId = responsePackageId;
      const graphStage: OperatingGraphStage = hostedReviewReadiness.ready
        ? "hosted_review_ready"
        : stateTransition.qualificationState === "qualified_ready"
          || stateTransition.qualificationState === "qualified_risky"
          ? "package_ready"
          : "pipeline_packaging";
      const captureIdForSync =
        String(pipeline?.capture_id || parsedBody.capture_id || "").trim() || null;
      if (captureIdForSync) {
        await db.collection("capture_submissions").doc(captureIdForSync).set(
          {
            capture_id: captureIdForSync,
            scene_id: String(pipeline?.scene_id || parsedBody.scene_id || "").trim() || null,
            site_submission_id: siteSubmissionId || requestId || docRef.id,
            buyer_request_id:
              String(parsedBody.buyer_request_id || pipeline?.buyer_request_id || currentData?.buyer_request_id || "")
                .trim()
              || null,
            capture_job_id: String(pipeline?.capture_job_id || parsedBody.capture_job_id || "").trim() || null,
            city_context: {
              city: cityForEvent,
              city_slug: cityContext.citySlug,
            },
            lifecycle: {
              pipeline_handoff_published_at: admin.firestore.FieldValue.serverTimestamp(),
            },
          },
          { merge: true },
        );
      }
      await appendOperatingGraphEvent({
        eventKey: `pipeline_sync:${docRef.id}:${String(pipeline?.capture_id || pipeline?.scene_id || docRef.id)}`,
        entityId: buildCityProgramId({
          citySlug: cityContext.citySlug,
        }),
        city: cityForEvent,
        citySlug: cityContext.citySlug,
        stage: graphStage,
        summary: `Pipeline sync updated ${cityForEvent} to ${graphStage.replaceAll("_", " ")}.`,
        sourceRepo: "Blueprint-WebApp",
        sourceKind: "pipeline_sync",
        origin: {
          repo: "Blueprint-WebApp",
          project: "blueprint-webapp",
          sourceCollection: "inboundRequests",
          sourceDocId: docRef.id,
          route: "/api/internal/pipeline/attachments",
        },
        nextActions: [
          {
            id: `pipeline_request:${docRef.id}`,
            summary: stateTransition.recommendedAction,
            owner: stateTransition.requiresHumanReview ? "ops-lead" : "webapp-codex",
            status: stateTransition.requiresHumanReview
              ? "awaiting_human_decision"
              : "ready_to_execute",
            sourceRef: docRef.id,
          },
        ],
        metadata: {
          ...buildBuyerOperatingGraphMetadata({
            cityProgramId: cityContext.cityProgramId,
            siteSubmissionId: siteSubmissionId || requestId || docRef.id,
            captureId: pipeline?.capture_id || null,
            sceneId: pipeline?.scene_id || null,
            buyerRequestId:
              String(parsedBody.buyer_request_id || pipeline?.buyer_request_id || currentData?.buyer_request_id || "")
                .trim()
              || null,
            captureJobId: pipeline?.capture_job_id || null,
            packageId,
          }),
          qualificationState: nextQualificationState,
          opportunityState: nextOpportunityState,
          hostedReviewReady: hostedReviewReadiness.ready,
        },
      }).catch(() => null);

      if (packageId) {
        await appendOperatingGraphEvent({
          eventKey: `pipeline_sync:package:${docRef.id}:${packageId}:${graphStage}`,
          entityType: "package_run",
          entityId: buildPackageRunId({
            packageId,
          }),
          city: cityForEvent,
          citySlug: cityContext.citySlug,
          stage: graphStage,
          summary: `Package run ${packageId} updated to ${graphStage.replaceAll("_", " ")}.`,
          sourceRepo: "Blueprint-WebApp",
          sourceKind: "pipeline_sync",
          origin: {
            repo: "Blueprint-WebApp",
            project: "blueprint-webapp",
            sourceCollection: "inboundRequests",
            sourceDocId: docRef.id,
            route: "/api/internal/pipeline/attachments",
          },
          nextActions: [
            {
              id: `package_run:${packageId}:next_action`,
              summary: stateTransition.recommendedAction,
              owner: stateTransition.requiresHumanReview ? "ops-lead" : "webapp-codex",
              status: stateTransition.requiresHumanReview
                ? "awaiting_human_decision"
                : "ready_to_execute",
              sourceRef: docRef.id,
            },
          ],
          metadata: {
            ...buildBuyerOperatingGraphMetadata({
              cityProgramId: cityContext.cityProgramId,
              siteSubmissionId: siteSubmissionId || requestId || docRef.id,
              captureId: pipeline?.capture_id || null,
              sceneId: pipeline?.scene_id || null,
              buyerRequestId:
                String(parsedBody.buyer_request_id || pipeline?.buyer_request_id || currentData?.buyer_request_id || "")
                  .trim()
                || null,
              captureJobId: pipeline?.capture_job_id || null,
              packageId,
            }),
            qualificationState: nextQualificationState,
            opportunityState: nextOpportunityState,
            hostedReviewReady: hostedReviewReadiness.ready,
          },
        }).catch(() => null);
      }
    }

    return res.json({
      ok: true,
      requestId: docRef.id,
      site_submission_id: siteSubmissionId || requestId,
      listing_id: marketplacePublication?.sku || null,
      artifact_id: responsePackageId || null,
      capture_job_id: pipeline?.capture_job_id || null,
      qualification_state: finalQualificationState,
      opportunity_state: finalOpportunityState,
      capture_creator_linkage: captureCreatorLinkage,
      marketplace_publication: marketplacePublication,
      buyer_entitlement_artifact_sync: buyerEntitlementArtifactSync,
      pipeline,
      derived_assets: derivedAssets,
      evaluation_readiness: evaluationReadiness,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ error: "Invalid pipeline attachment payload" });
    }
    logger.error({ error }, "Failed to attach pipeline metadata");
    return res.status(500).json({ error: "Failed to attach pipeline metadata" });
  }
  },
);

/**
 * POST /api/internal/pipeline/buyer-artifact-access-check
 *
 * Pipeline calls this after WebApp sync when buyer artifact delivery is required.
 * The route is HMAC-protected by the same Pipeline sync token, then verifies a
 * provisioned marketplace entitlement and mints a short-lived artifact URL. It
 * returns a 200 with buyer_accessible=false for entitlement/artifact misses so
 * Pipeline records a business blocker instead of a transport failure.
 */
router.post(
  "/buyer-artifact-access-check",
  pipelineSyncRateLimiter,
  requirePipelineToken,
  async (req: Request, res: Response) => {
    try {
      if (!db) {
        return res.status(503).json({
          ok: false,
          buyer_accessible: false,
          blocker: "database_not_available",
        });
      }
      if (!storageAdmin) {
        return res.status(503).json({
          ok: false,
          buyer_accessible: false,
          blocker: "storage_not_available",
        });
      }

      const body = isRecord(req.body) ? req.body : {};
      const ids = isRecord(body.webapp_response_ids) ? body.webapp_response_ids : {};
      const entitlementId = fieldFromBodyOrIds(body, ids, [
        "entitlement_id",
        "entitlementId",
        "marketplace_entitlement_id",
        "marketplaceEntitlementId",
        "buyer_artifact_id",
        "buyerArtifactId",
      ]);
      const sku = fieldFromBodyOrIds(body, ids, [
        "sku",
        "listing_id",
        "listingId",
        "marketplace_sku",
        "marketplaceSku",
      ]);
      const artifactKey = fieldFromBodyOrIds(body, ids, [
        "artifact_key",
        "artifactKey",
        "artifact",
      ]);
      const artifactUri = fieldFromBodyOrIds(body, ids, [
        "artifact_uri",
        "artifactUri",
      ]);

      const entitlement = await findProvisionedEntitlement({
        entitlementId,
        sku,
      });
      if (!entitlement) {
        await recordBetaOpsFailureSignal({
          kind: "buyer_artifact_access_failure",
          scopeId: entitlementId || sku || "buyer-artifact-access",
          severity: "critical",
          summary: "Buyer artifact access check could not find a provisioned entitlement.",
          details: {
            entitlement_id: entitlementId || null,
            sku: sku || null,
            blocker: "provisioned_marketplace_entitlement_not_found",
          },
        });
        return res.status(200).json({
          ok: false,
          accessible: false,
          buyer_accessible: false,
          buyer_access_checked: true,
          entitlement_verified: false,
          blocker: "provisioned_marketplace_entitlement_not_found",
          status: "blocked",
        });
      }

      const entitlementAccessState = effectiveEntitlementAccessState(entitlement);
      const buyerUserId = stringValue(entitlement.buyer_user_id || entitlement.buyerUserId);
      if (entitlementAccessState !== "provisioned" || !buyerUserId) {
        const blocker =
          entitlementAccessState === "provisioned"
            ? "marketplace_entitlement_missing_buyer_user_id"
            : entitlementAccessState === "expired"
              ? "marketplace_entitlement_expired"
            : entitlementAccessState === "revoked"
              ? "marketplace_entitlement_revoked_by_consent_takedown"
              : "marketplace_entitlement_not_provisioned";
        await recordBetaOpsFailureSignal({
          kind: "buyer_artifact_access_failure",
          scopeId: String(entitlement.id || entitlementId || sku || "buyer-artifact-access"),
          severity: "critical",
          summary: "Buyer artifact access check found an entitlement that cannot mint access.",
          details: {
            entitlement_id: String(entitlement.id || entitlementId || ""),
            sku: sku || stringValue(entitlement.sku) || null,
            access_state: entitlementAccessState || null,
            blocker,
          },
        });
        return res.status(200).json({
          ok: false,
          accessible: false,
          buyer_accessible: false,
          buyer_access_checked: true,
          entitlement_verified: false,
          blocker,
          status: "blocked",
        });
      }

      const resolvedSku = sku || stringValue(entitlement.sku);
      const marketplaceItem = await loadPublishedMarketplaceItem(resolvedSku);
      const candidates = [
        ...collectBuyerArtifactCandidates(entitlement, "marketplace_entitlement"),
        ...(marketplaceItem
          ? collectBuyerArtifactCandidates(marketplaceItem, "published_marketplace_item")
          : []),
      ];
      const selected = selectBuyerArtifactCandidate({
        candidates,
        artifactKey,
        artifactUri,
      });
      if (!selected) {
        await recordBetaOpsFailureSignal({
          kind: "buyer_artifact_access_failure",
          scopeId: String(entitlement.id || entitlementId || resolvedSku || "buyer-artifact-access"),
          severity: "critical",
          summary: "Buyer artifact access check found no configured artifact URI.",
          details: {
            entitlement_id: String(entitlement.id || entitlementId || ""),
            sku: resolvedSku || null,
            artifact_key: artifactKey || null,
            artifact_uri: artifactUri || null,
            blocker: "buyer_artifact_uri_not_configured",
            available_artifact_keys: candidates.map((candidate) => candidate.key),
          },
        });
        return res.status(200).json({
          ok: false,
          accessible: false,
          buyer_accessible: false,
          buyer_access_checked: true,
          entitlement_verified: true,
          blocker: "buyer_artifact_uri_not_configured",
          status: "blocked",
          available_artifact_keys: candidates.map((candidate) => candidate.key),
        });
      }

      const { bucket, objectPath } = parseGsUri(selected.uri);
      const expiresAt = new Date(Date.now() + SIGNED_BUYER_ARTIFACT_URL_TTL_MS);
      const [signedUrl] = await storageAdmin.bucket(bucket).file(objectPath).getSignedUrl({
        action: "read",
        expires: expiresAt.getTime(),
      });

      return res.status(200).json({
        ok: true,
        accessible: true,
        buyer_accessible: true,
        buyer_access_checked: true,
        entitlement_verified: true,
        status: "signed_url_minted",
        entitlement_id: String(entitlement.id || entitlementId || ""),
        buyer_user_id: buyerUserId,
        sku: resolvedSku || null,
        artifact_key: selected.key,
        artifact_uri: selected.uri,
        artifact_source: selected.source,
        signed_url: signedUrl,
        signed_url_expires_at: expiresAt.toISOString(),
        claim_boundary:
          "Internal Pipeline buyer-access check proves a provisioned WebApp entitlement can mint a short-lived signed artifact URL. It is not proof of package semantic success or payment settlement.",
      });
    } catch (error) {
      logger.error({ error }, "Failed to check buyer artifact access");
      await recordBetaOpsFailureSignal({
        kind: "buyer_artifact_access_failure",
        scopeId: "buyer-artifact-access-check",
        severity: "critical",
        summary: "Buyer artifact access check threw before minting a signed URL.",
        details: {
          blocker: "buyer_artifact_access_check_failed",
          error: error instanceof Error ? error.message : String(error),
        },
      });
      return res.status(500).json({
        ok: false,
        buyer_accessible: false,
        buyer_access_checked: true,
        entitlement_verified: false,
        blocker: "buyer_artifact_access_check_failed",
      });
    }
  },
);

/**
 * POST /api/internal/pipeline/rights-privacy-revocation
 *
 * Pipeline calls this with an explicit consent-revocation verdict from
 * consent_takedown.py. The route revokes matching marketplace entitlements so
 * buyer-artifact signed URL minting fails closed on the existing access_state
 * check.
 */
router.post(
  "/rights-privacy-revocation",
  pipelineSyncRateLimiter,
  requirePipelineToken,
  async (req: Request, res: Response) => {
    try {
      if (!db) {
        return res.status(503).json({
          ok: false,
          webapp_takedown_executed: false,
          blocker: "database_not_available",
        });
      }

      const body = isRecord(req.body) ? req.body : {};
      const verdict = stringValue(body.verdict).toLowerCase();
      if (verdict !== "revoked") {
        return res.status(400).json({
          ok: false,
          webapp_takedown_executed: false,
          blocker: "explicit_revoked_verdict_required",
        });
      }

      const webappIds = isRecord(body.webapp_response_ids) ? body.webapp_response_ids : {};
      const upstreamIds = isRecord(body.upstream_ids) ? body.upstream_ids : {};
      const records = await collectRevocationEntitlements({ body, webappIds, upstreamIds });
      const now = new Date().toISOString();
      const revokedAt = stringValue(body.consent_revoked_at) || now;
      const revokedEntitlementIds: string[] = [];
      const alreadyRevokedEntitlementIds: string[] = [];

      for (const record of records) {
        if (stringValue(record.data.access_state) === "revoked") {
          alreadyRevokedEntitlementIds.push(record.id);
          continue;
        }
        await record.ref.update({
          access_state: "revoked",
          revoked_at: revokedAt,
          revocation_reason: "consent_revoked",
          rights_privacy_takedown: {
            status: "blocked_consent_revoked_takedown_required",
            verdict: "revoked",
            scene_id: stringValue(body.scene_id || body.sceneId) || null,
            capture_id: stringValue(body.capture_id || body.captureId) || null,
            consent_revoked_at: revokedAt,
            required_actions: stringList(body.required_actions),
            pipeline_signal_received_at: now,
          },
          updated_at: admin.firestore.FieldValue.serverTimestamp(),
        });
        await dispatchTransactionalNotification({
          eventType: "consent_revocation",
          recipientType: "buyer",
          recipientUserId: stringValue(record.data.buyer_user_id || record.data.buyerUserId),
          recipientEmail: stringValue(record.data.buyer_email || record.data.buyerEmail),
          subjectId: record.id,
          sourceEventId: `consent-revocation:${record.id}:${revokedAt}`,
          sourceCollection: "marketplaceEntitlements",
          sourceDocId: record.id,
          title: "Blueprint access revoked",
          body:
            "Access to a Blueprint artifact was revoked because a rights or consent signal changed.",
          emailSubject: "Blueprint artifact access was revoked",
          emailText:
            "Access to a Blueprint artifact was revoked because a rights or consent signal changed.",
          preferenceKey: "account",
          data: {
            entitlement_id: record.id,
            sku: stringValue(record.data.sku),
            scene_id: stringValue(body.scene_id || body.sceneId),
            capture_id: stringValue(body.capture_id || body.captureId),
            consent_revoked_at: revokedAt,
          },
        });
        revokedEntitlementIds.push(record.id);
      }

      const executed = revokedEntitlementIds.length > 0 || alreadyRevokedEntitlementIds.length > 0;
      return res.status(200).json({
        ok: executed,
        status: executed ? "revocation_applied" : "blocked_no_matching_entitlement",
        webapp_takedown_executed: executed,
        revoked_entitlement_ids: revokedEntitlementIds,
        already_revoked_entitlement_ids: alreadyRevokedEntitlementIds,
        matched_entitlement_count: records.length,
        blocker: executed ? null : "matching_marketplace_entitlement_not_found",
        claim_boundary:
          "WebApp revocation marks entitlement access_state=revoked and blocks new signed URL minting; it does not prove already-minted URL expiry before its configured TTL.",
      });
    } catch (error) {
      logger.error({ error }, "Failed to apply rights/privacy revocation");
      return res.status(500).json({
        ok: false,
        webapp_takedown_executed: false,
        blocker: "rights_privacy_revocation_failed",
      });
    }
  },
);

/**
 * GET /api/internal/pipeline/status/:requestId
 *
 * Inspect the current pipeline bridge state for a request: artifact inventory,
 * milestone status, hosted review readiness, and recommended next action.
 */
router.get(
  "/status/:requestId",
  pipelineSyncRateLimiter,
  requirePipelineToken,
  async (req: Request, res: Response) => {
  try {
    if (!db) {
      return res.status(500).json({ error: "Database not available" });
    }

    const doc = await db.collection("inboundRequests").doc(req.params.requestId).get();
    if (!doc.exists) {
      return res.status(404).json({ error: "Request not found", requestId: req.params.requestId });
    }

    const data = doc.data() as Record<string, unknown> | undefined;
    if (!data) {
      return res.status(404).json({ error: "Request has no data", requestId: req.params.requestId });
    }

    const pipeline = data.pipeline as (PipelineAttachment | undefined);
    const derivedAssets = data.derived_assets as (DerivedAssetsAttachment | undefined);
    const evaluationReadiness = data.evaluation_readiness as (EvaluationReadinessSummary | undefined);
    const ops = data.ops as (Record<string, unknown> | undefined);

    const hostedReviewReadiness = checkHostedReviewReadiness({
      artifacts: pipeline?.artifacts,
      derivedAssets,
    });

    const stateTransition = computePipelineStateTransition({
      artifacts: pipeline?.artifacts,
      derivedAssets,
      evaluationReadiness,
      authoritativeStateUpdate: false,
      currentQualificationState: data.qualification_state as QualificationState | undefined,
      currentOpportunityState: data.opportunity_state as OpportunityState | undefined,
      currentProofPath: (ops?.proof_path as ProofPathMilestones | undefined) ?? {
        exact_site_requested_at: null,
        qualified_inbound_at: null,
        proof_pack_delivered_at: null,
        proof_pack_reviewed_at: null,
        hosted_review_ready_at: null,
        hosted_review_started_at: null,
        hosted_review_follow_up_at: null,
        artifact_handoff_delivered_at: null,
        artifact_handoff_accepted_at: null,
        human_commercial_handoff_at: null,
      },
      currentOps: ops,
      currentEvaluationReadiness: evaluationReadiness,
    });

    return res.json({
      ok: true,
      requestId: doc.id,
      artifacts: {
        total: stateTransition.artifactCount.total,
        core: stateTransition.artifactCount.core,
        inventory: pipeline?.artifacts ?? {},
      },
      milestones: stateTransition.proofPathUpdate.proofPath,
      hostedReviewReadiness,
      state: {
        qualification: stateTransition.qualificationState,
        opportunity: stateTransition.opportunityState,
        recommendedAction: stateTransition.recommendedAction,
        requiresHumanReview: stateTransition.requiresHumanReview,
      },
      ops: stateTransition.opsUpdate.opsAutomation,
      evaluation_readiness: stateTransition.evaluationReadiness,
      pipelineSyncedAt: pipeline?.synced_at,
    });
  } catch (error) {
    logger.error({ error }, "Failed to retrieve pipeline status");
    return res.status(500).json({ error: "Failed to retrieve pipeline status" });
  }
  },
);

/**
 * GET /api/internal/pipeline/hosted-readiness/:siteSubmissionId
 *
 * Check whether a site has sufficient pipeline outputs for buyer-facing
 * hosted review. Used by the marketing/sales-facing surfaces to know when
 * a site world is "live" for demos.
 */
router.get("/hosted-readiness/:siteSubmissionId", requirePipelineToken, async (req: Request, res: Response) => {
  try {
    if (!db) {
      return res.status(500).json({ error: "Database not available" });
    }

    const snapshot = await db
      .collection("inboundRequests")
      .where("site_submission_id", "==", req.params.siteSubmissionId)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res.status(404).json({ error: "Site submission not found" });
    }

    const data = snapshot.docs[0].data();
    const pipeline = data?.pipeline as (PipelineAttachment | undefined);
    const derivedAssets = data?.derived_assets as (DerivedAssetsAttachment | undefined);

    const readiness = checkHostedReviewReadiness({
      artifacts: pipeline?.artifacts,
      derivedAssets,
    });

    return res.json({
      ok: true,
      siteSubmissionId: req.params.siteSubmissionId,
      ...readiness,
      pipeline: pipeline ? {
        scene_id: pipeline.scene_id,
        capture_id: pipeline.capture_id,
        pipeline_prefix: pipeline.pipeline_prefix,
        synced_at: pipeline.synced_at,
      } : null,
    });
  } catch (error) {
    logger.error({ error }, "Failed to check hosted readiness");
    return res.status(500).json({ error: "Failed to check hosted readiness" });
  }
});

export default router;
