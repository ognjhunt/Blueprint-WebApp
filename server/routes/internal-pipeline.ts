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
import { parsePipelineAttachmentSyncPayload } from "../utils/pipelineAttachmentContract";
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
import {
  ingestConsentRevocationTakedown,
  type ConsentRevocationNotice,
} from "../utils/consentRevocationTakedown";
import { emitOperatorAlert } from "../utils/operator-alerts";

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
// R031: fields the package-delivery ingestion route persists onto an entitlement.
const BUYER_DELIVERY_BASE_URI_FIELDS = [
  "package_delivery_base_uri",
  "packageDeliveryBaseUri",
] as const;
const BUYER_DELIVERY_OBJECT_KEYS_FIELDS = [
  "package_object_keys",
  "packageObjectKeys",
] as const;
const BUYER_PACKAGE_ARCHIVE_PATTERN = /\.(zip|tar|tgz|tar\.gz|tar\.zst|7z)$/i;

type BuyerArtifactCandidate = {
  key: string;
  uri: string;
  source: string;
};

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
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

/**
 * R031: build signed-URL candidates from the pipeline-delivered GCS package
 * source persisted on the entitlement (`package_delivery_base_uri` +
 * `package_object_keys`). Mirrors the buyer mint route so the pipeline's own
 * buyer-access check sees the same delivery source it wrote.
 */
function collectBuyerDeliveryPackageCandidates(
  record: Record<string, unknown>,
  source: string,
): BuyerArtifactCandidate[] {
  let baseUri = "";
  for (const field of BUYER_DELIVERY_BASE_URI_FIELDS) {
    baseUri = stringValue(record[field]);
    if (baseUri) {
      break;
    }
  }
  let objectKeys: string[] = [];
  for (const field of BUYER_DELIVERY_OBJECT_KEYS_FIELDS) {
    const value = record[field];
    if (Array.isArray(value)) {
      objectKeys = value.map((entry) => stringValue(entry)).filter(Boolean);
      break;
    }
  }
  if (!baseUri.startsWith("gs://") || objectKeys.length === 0) {
    return [];
  }

  let bucket = "";
  let basePrefix = "";
  try {
    const parsed = parseGsUri(baseUri);
    bucket = parsed.bucket;
    basePrefix = parsed.objectPath.replace(/\/+$/, "");
  } catch {
    return [];
  }

  const perObject: BuyerArtifactCandidate[] = [];
  const seen = new Set<string>();
  for (const rawKey of objectKeys) {
    const objectKey = rawKey.replace(/^\/+/, "");
    if (!objectKey || seen.has(objectKey)) {
      continue;
    }
    seen.add(objectKey);
    const relPath = objectKey.startsWith(`${basePrefix}/`)
      ? objectKey.slice(basePrefix.length + 1)
      : objectKey.split("/").pop() || objectKey;
    perObject.push({ key: relPath, uri: `gs://${bucket}/${objectKey}`, source });
  }
  if (perObject.length === 0) {
    return [];
  }

  const primary =
    perObject.find((candidate) => BUYER_PACKAGE_ARCHIVE_PATTERN.test(candidate.key)) ||
    perObject[0];
  return [
    { key: "post_training_data_package_uri", uri: primary.uri, source },
    ...perObject,
  ];
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

function allowPipelinePlaceholderRequests() {
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
      assigned_region_id: "managed-alpha",
      rights_status: "unknown",
      capture_policy_tier: "review_required",
      capture_status: "approved",
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

      const entitlementAccessState = stringValue(entitlement.access_state);
      const buyerUserId = stringValue(entitlement.buyer_user_id || entitlement.buyerUserId);
      // R027: a consent-revoked entitlement must never mint a signed URL. Block
      // explicitly (and audit) instead of relying only on the provisioned gate.
      if (entitlementAccessState === "revoked") {
        const takedown = isRecord(entitlement.takedown) ? entitlement.takedown : {};
        logger.warn(
          {
            entitlement_id: String(entitlement.id || entitlementId || ""),
            capture_id: stringValue(takedown.capture_id) || null,
            scene_id: stringValue(takedown.scene_id) || null,
            source_notice_id: stringValue(takedown.source_notice_id) || null,
          },
          "Blocked buyer artifact access for consent-revoked entitlement",
        );
        return res.status(200).json({
          ok: false,
          accessible: false,
          buyer_accessible: false,
          buyer_access_checked: true,
          entitlement_verified: false,
          blocker: "marketplace_entitlement_revoked_by_consent_takedown",
          status: "blocked",
        });
      }
      if (entitlementAccessState !== "provisioned" || !buyerUserId) {
        return res.status(200).json({
          ok: false,
          accessible: false,
          buyer_accessible: false,
          buyer_access_checked: true,
          entitlement_verified: false,
          blocker: entitlementAccessState === "provisioned"
            ? "marketplace_entitlement_missing_buyer_user_id"
            : "marketplace_entitlement_not_provisioned",
          status: "blocked",
        });
      }

      const resolvedSku = sku || stringValue(entitlement.sku);
      const marketplaceItem = await loadPublishedMarketplaceItem(resolvedSku);
      const candidates = [
        // R031: the pipeline-delivered GCS package source is authoritative.
        ...collectBuyerDeliveryPackageCandidates(entitlement, "marketplace_entitlement_package_delivery"),
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
 * POST /api/internal/pipeline/package-delivery
 *
 * R031: consume the Pipeline `arena_package_delivery_gcs` delivery manifest's
 * `webapp_ingestion` block (`{ entitlement_id, delivery_base_uri, object_keys,
 * requires_webapp_entitlement_and_consent_check }`) and persist the delivered
 * GCS package source onto the matching marketplace entitlement so the buyer
 * signed-URL mint path (marketplace-entitlements `artifact-access`) has a gs://
 * source to sign. HMAC-protected by the same Pipeline sync token.
 *
 * This route is delivery-source plumbing ONLY: it never provisions, un-revokes,
 * or approves the entitlement. The access-state provisioned gate and the
 * consent-revocation refusal remain authoritative at mint time.
 */
router.post(
  "/package-delivery",
  pipelineSyncRateLimiter,
  requirePipelineToken,
  async (req: Request, res: Response) => {
    try {
      if (!db) {
        return res.status(503).json({
          ok: false,
          package_delivery_recorded: false,
          code: "database_not_available",
        });
      }

      const body = isRecord(req.body) ? req.body : {};
      const ingestion = isRecord(body.webapp_ingestion)
        ? (body.webapp_ingestion as Record<string, unknown>)
        : body;

      const entitlementId = fieldFromBodyOrIds(ingestion, {}, [
        "entitlement_id",
        "entitlementId",
        "marketplace_entitlement_id",
        "marketplaceEntitlementId",
      ]);
      const deliveryBaseUri = fieldFromBodyOrIds(ingestion, {}, [
        "delivery_base_uri",
        "deliveryBaseUri",
        "package_delivery_base_uri",
        "packageDeliveryBaseUri",
      ]);
      const rawObjectKeys =
        ingestion.object_keys ?? ingestion.objectKeys ?? ingestion.package_object_keys;
      const objectKeys = Array.isArray(rawObjectKeys)
        ? rawObjectKeys.map((entry) => stringValue(entry)).filter(Boolean)
        : [];

      if (!entitlementId) {
        return res.status(400).json({
          ok: false,
          package_delivery_recorded: false,
          code: "missing_entitlement_id",
        });
      }
      if (!deliveryBaseUri.startsWith("gs://")) {
        return res.status(400).json({
          ok: false,
          package_delivery_recorded: false,
          code: "invalid_delivery_base_uri",
        });
      }
      if (objectKeys.length === 0) {
        return res.status(400).json({
          ok: false,
          package_delivery_recorded: false,
          code: "missing_object_keys",
        });
      }

      let bucket = "";
      try {
        bucket = parseGsUri(deliveryBaseUri).bucket;
      } catch {
        return res.status(400).json({
          ok: false,
          package_delivery_recorded: false,
          code: "invalid_delivery_base_uri",
        });
      }

      // Enforce the same allowed-GCS-prefix policy as the attachment sync so the
      // pipeline cannot point buyer delivery at an arbitrary bucket.
      const objectUris = objectKeys.map(
        (key) => `gs://${bucket}/${key.replace(/^\/+/, "")}`,
      );
      const uriViolations = validatePipelineArtifactUris({
        artifacts: {
          package_delivery_base_uri: deliveryBaseUri,
          package_delivery_object_uris: objectUris,
        },
      });
      if (uriViolations.length > 0) {
        return res.status(400).json({
          ok: false,
          package_delivery_recorded: false,
          code: "invalid_pipeline_artifact_uri",
          violations: uriViolations,
        });
      }

      const snapshot = await db
        .collection("marketplaceEntitlements")
        .doc(entitlementId)
        .get();
      if (!snapshot.exists) {
        return res.status(404).json({
          ok: false,
          package_delivery_recorded: false,
          code: "marketplace_entitlement_not_found",
          entitlement_id: entitlementId,
        });
      }
      const entitlement = (snapshot.data() || {}) as Record<string, unknown>;
      const accessState = stringValue(entitlement.access_state);

      await db
        .collection("marketplaceEntitlements")
        .doc(entitlementId)
        .set(
          {
            package_delivery_base_uri: deliveryBaseUri,
            package_object_keys: objectKeys,
            package_delivery_object_count: objectKeys.length,
            package_delivery_source: "pipeline_arena_package_delivery_gcs",
            package_delivery_synced_at:
              admin.firestore.FieldValue.serverTimestamp(),
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true },
        );

      return res.status(200).json({
        ok: true,
        package_delivery_recorded: true,
        entitlement_id: entitlementId,
        delivery_base_uri: deliveryBaseUri,
        object_count: objectKeys.length,
        access_state: accessState || null,
        // Truthful: recording the source does not flip the gate. A buyer can only
        // mint a signed URL once the entitlement is provisioned and not revoked.
        buyer_download_ready: accessState === "provisioned",
        claim_boundary:
          "Recording a delivered GCS package source onto an entitlement makes the buyer signed-URL source real. It does not provision, un-revoke, or approve the entitlement, and it is not proof of package semantic success or deployment approval.",
      });
    } catch (error) {
      logger.error({ error }, "Failed to record pipeline package delivery");
      // R037: a failed package-delivery ingestion means a buyer's delivered
      // package source was not recorded — a core beta failure class.
      void emitOperatorAlert({
        class: "package_failed",
        severity: "critical",
        message: "Failed to record pipeline package delivery ingestion.",
        context: {
          error: error instanceof Error ? error.message : String(error),
          route: "POST /api/internal/pipeline/package-delivery",
        },
      });
      return res.status(500).json({
        ok: false,
        package_delivery_recorded: false,
        code: "package_delivery_recording_failed",
      });
    }
  },
);

/**
 * POST /api/internal/pipeline/consent-revocation-takedown
 *
 * R027 enforcement: consume a Pipeline `webapp_rights_privacy_takedown_notice`
 * (emitted when a capture's consent is revoked) and flip every marketplace
 * entitlement linked to the revoked capture/scene/site to
 * `access_state="revoked"`. This is what makes consent revocation self-enforcing
 * across the delivery chain: once revoked, the signed-URL mint paths refuse the
 * entitlement. HMAC-protected by the same Pipeline sync token as the other
 * internal sync routes.
 */
router.post(
  "/consent-revocation-takedown",
  pipelineSyncRateLimiter,
  requirePipelineToken,
  async (req: Request, res: Response) => {
    try {
      if (!db) {
        return res.status(503).json({
          ok: false,
          webapp_takedown_executed: false,
          code: "database_not_available",
        });
      }

      const body = isRecord(req.body) ? req.body : {};
      const result = await ingestConsentRevocationTakedown(
        body as ConsentRevocationNotice,
      );

      if (!result.ok) {
        const status = result.code === "database_not_available" ? 503 : 400;
        return res.status(status).json({
          ...result,
          webapp_takedown_executed: false,
        });
      }

      return res.status(200).json({
        ...result,
        webapp_takedown_executed: true,
        claim_boundary:
          "WebApp entitlement revocation flips affected provisioned entitlements to access_state=revoked and blocks future signed-URL minting. It is not proof of hosted-session teardown or downstream training deletion.",
      });
    } catch (error) {
      logger.error({ error }, "Failed to ingest consent revocation takedown");
      return res.status(500).json({
        ok: false,
        webapp_takedown_executed: false,
        code: "consent_revocation_takedown_failed",
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
