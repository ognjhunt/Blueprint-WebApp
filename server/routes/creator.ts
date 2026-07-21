import { Request, Response, Router } from "express";
import { randomUUID } from "crypto";
import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import {
  listCreatorPayouts,
  mapCreatorPayoutStatusForLedger,
  readCreatorEarningsAggregate,
  summarizeCreatorEarnings,
} from "../utils/accounting";
import {
  recordBetaOpsFailureSignal,
  type BetaOpsFailureKind,
} from "../utils/ops-alerts";
import {
  betaDecisionForResponse,
  evaluateBetaCohortGate,
  recordBetaCohortAdmission,
} from "../utils/beta-cohort-policy";
import {
  buildCityLaunchCaptureTargetFeed,
  buildCityLaunchUnderReviewFeed,
  buildCreatorLaunchStatus,
  buildUnavailableCreatorLaunchStatus,
} from "../utils/cityLaunchCaptureTargets";
import { reviewCityLaunchCandidateBatch } from "../utils/cityLaunchCandidateReview";
import { dispatchCityLaunchCandidatePaperclipHandoff } from "../utils/cityLaunchCandidatePaperclipHandoff";
import { intakeCityLaunchCandidateSignals } from "../utils/cityLaunchLedgers";
import { deriveCreatedAtShard } from "../utils/captureShard";
import { creatorIdFromRequest } from "../utils/creatorIdentity";
import { clientVersionSatisfiesMinimum } from "../utils/client-runtime-config";
import { loadClientRuntimeConfig } from "./client-runtime-config";

const router = Router();

// Bounded read windows for per-creator queries (backed by the creator_id +
// created_at / updated_at composite indexes in firestore.indexes.json).
const QC_RECENT_CAPTURE_LIMIT = 500;
const PAYOUT_LEDGER_FETCH_LIMIT = 200;

const TELEMETRY_RETENTION_DAYS = Math.max(
  1,
  Math.trunc(Number(process.env.BLUEPRINT_CREATOR_TELEMETRY_RETENTION_DAYS) || 90),
);

const DEFAULT_NOTIFICATION_PREFERENCES = {
  nearby_jobs: true,
  reservations: true,
  capture_status: true,
  payouts: true,
  account: true,
} as const;

function toIso(value: unknown) {
  const raw = value as { toDate?: () => Date } | string | Date | null | undefined;
  if (!raw) {
    return null;
  }
  if (typeof raw === "string") {
    return raw;
  }
  if (raw instanceof Date) {
    return raw.toISOString();
  }
  return raw.toDate?.()?.toISOString?.() || null;
}

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Telemetry redaction: capture-client telemetry must never persist secrets or
 * personal data. Values are truncated AND scrubbed of credential material,
 * contact details, precise coordinates, filesystem paths, and URL query
 * strings before storage or ops alerting.
 */
const TELEMETRY_REDACTION_RULES: Array<[RegExp, string]> = [
  [/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [redacted]"],
  [/(authorization|bearer|token|secret|password|passwd|api[-_]?key|signature)\s*[:=]\s*[^\s,;]+/gi, "$1=[redacted]"],
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[redacted-email]"],
  // 9+ digits with separators (phone-shaped); short digit runs like ISO dates
  // (8 digits) and version/build numbers survive.
  [/\+?\d(?:[\s().-]{0,3}\d){8,}/g, "[redacted-number]"],
  [/-?\d{1,3}\.\d{4,}\s*,\s*-?\d{1,3}\.\d{4,}/g, "[redacted-coordinates]"],
  [/(?:\/(?:Users|home|var|private|data|storage|Documents|Library)\/)[^\s"']*/g, "[redacted-path]"],
  [/\?[^\s"']{8,}/g, "?[redacted-query]"],
];

function redactTelemetryValue(value: string): string {
  let out = value;
  for (const [pattern, replacement] of TELEMETRY_REDACTION_RULES) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

function telemetryString(value: unknown, fallback = "unknown", maxLength = 240) {
  if (typeof value === "string") {
    const trimmed = redactTelemetryValue(value.trim());
    return (trimmed || fallback).slice(0, maxLength);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).slice(0, maxLength);
  }
  return fallback;
}

function telemetryOptionalString(value: unknown, maxLength = 240) {
  if (value === null || value === undefined) {
    return null;
  }
  const normalized = telemetryString(value, "", maxLength);
  return normalized || null;
}

function telemetryMetadata(raw: unknown) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const entries = Object.entries(raw as Record<string, unknown>)
    .slice(0, 20)
    .map(([key, value]) => [
      telemetryString(key, "unknown_key", 80).replace(/[^a-zA-Z0-9._:-]/g, "_"),
      telemetryString(value, "", 240),
    ])
    .filter(([, value]) => value);
  return Object.fromEntries(entries);
}

function telemetryBreadcrumbs(raw: unknown) {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.slice(-24).map((breadcrumb) => ({
    name: telemetryString((breadcrumb as Record<string, unknown>)?.name, "unknown", 120),
    status: telemetryString((breadcrumb as Record<string, unknown>)?.status, "unknown", 120),
    occurred_at: telemetryString((breadcrumb as Record<string, unknown>)?.occurred_at, new Date().toISOString(), 80),
    metadata: telemetryMetadata((breadcrumb as Record<string, unknown>)?.metadata),
  }));
}

function telemetryStatusIndicatesFailure(status: string) {
  const normalized = status.toLowerCase();
  return normalized.includes("fail")
    || normalized.includes("error")
    || normalized.includes("expired")
    || normalized.includes("blocked")
    || normalized.includes("crash");
}

function alertKindForClientTelemetry(eventType: string, severity: string): BetaOpsFailureKind {
  const normalized = eventType.toLowerCase();
  if (
    severity === "critical"
    || normalized.includes("crash")
    || normalized.includes("uncaught")
  ) {
    return "mobile_capture_client_crash";
  }
  return "mobile_capture_client_error";
}

function requestString(req: Request, bodyKeys: string[], headerName?: string) {
  const headerValue = headerName ? req.get(headerName) : undefined;
  const candidates = [
    headerValue,
    ...bodyKeys.map((key) => (req.body as Record<string, unknown> | undefined)?.[key]),
  ];
  for (const candidate of candidates) {
    const value = typeof candidate === "string" || typeof candidate === "number"
      ? String(candidate).trim()
      : "";
    if (value) {
      return value.slice(0, 120);
    }
  }
  return "";
}

function parsePositiveInt(value: string | undefined) {
  const parsed = Number(String(value || "").trim());
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : null;
}

function compareDottedVersions(a: string, b: string) {
  const left = a.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const right = b.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const max = Math.max(left.length, right.length);
  for (let index = 0; index < max; index += 1) {
    const delta = (left[index] || 0) - (right[index] || 0);
    if (delta !== 0) {
      return delta;
    }
  }
  return 0;
}

function captureClientPolicyDecision(req: Request) {
  const platform = requestString(req, ["client_platform", "platform"], "X-Blueprint-Native-Client")
    .toLowerCase();
  const appVersion = requestString(req, ["client_version", "app_version"], "X-Blueprint-App-Version");
  const appBuild = requestString(req, ["client_build", "app_build"], "X-Blueprint-App-Build");
  const minIosVersion = String(process.env.BLUEPRINT_CAPTURE_MIN_IOS_VERSION || "").trim();
  const minIosBuild = parsePositiveInt(process.env.BLUEPRINT_CAPTURE_MIN_IOS_BUILD);
  const clientKillSwitchActive = ["1", "true", "yes", "on"].includes(
    String(process.env.BLUEPRINT_CAPTURE_CLIENT_KILL_SWITCH || "").trim().toLowerCase(),
  );
  const policy = {
    platform: platform || "unknown",
    app_version: appVersion || null,
    app_build: appBuild || null,
    min_ios_version: minIosVersion || null,
    min_ios_build: minIosBuild,
    kill_switch_active: clientKillSwitchActive,
  };

  if (clientKillSwitchActive) {
    return {
      allowed: false,
      statusCode: 503,
      code: "capture_client_kill_switch_active",
      message: "Blueprint capture intake is temporarily paused for native clients.",
      policy,
    };
  }

  if (platform === "ios" || platform === "blueprint-capture") {
    if (minIosBuild !== null) {
      const parsedBuild = parsePositiveInt(appBuild);
      if (parsedBuild === null || parsedBuild < minIosBuild) {
        return {
          allowed: false,
          statusCode: 426,
          code: "capture_client_upgrade_required",
          message: "Update Blueprint Capture before submitting beta captures.",
          policy,
        };
      }
    }
    if (minIosVersion && (!appVersion || compareDottedVersions(appVersion, minIosVersion) < 0)) {
      return {
        allowed: false,
        statusCode: 426,
        code: "capture_client_upgrade_required",
        message: "Update Blueprint Capture before submitting beta captures.",
        policy,
      };
    }
  }

  return {
    allowed: true,
    statusCode: 200,
    code: "allowed",
    message: "Capture client version is allowed.",
    policy,
  };
}

function clientMetadataFromRequest(req: Request) {
  return {
    platform: requestString(req, ["client_platform", "platform"], "X-Blueprint-Native-Client") || null,
    app_version: requestString(req, ["client_version", "app_version"], "X-Blueprint-App-Version") || null,
    app_build: requestString(req, ["client_build", "app_build"], "X-Blueprint-App-Build") || null,
    os_version: requestString(req, ["client_os_version", "os_version"], "X-Blueprint-OS-Version") || null,
    device_model: requestString(req, ["client_device_model", "device_model"], "X-Blueprint-Device-Model") || null,
  };
}

router.use((req: Request, res: Response, next) => {
  const authenticatedUid = String(res.locals.firebaseUser?.uid || "").trim();
  if (!authenticatedUid) {
    return next();
  }

  const requestedCreatorId = creatorIdFromRequest(req);
  if (requestedCreatorId && requestedCreatorId !== authenticatedUid) {
    return res.status(403).json({
      error: "Creator identity does not match authenticated user",
    });
  }

  if (req.method === "GET" || req.method === "DELETE") {
    if (!String(req.query.creator_id || "").trim()) {
      (req.query as Record<string, unknown>).creator_id = authenticatedUid;
    }
  } else {
    const nextBody =
      req.body && typeof req.body === "object"
        ? { ...(req.body as Record<string, unknown>) }
        : {};
    if (typeof nextBody.creator_id !== "string" || !nextBody.creator_id.trim()) {
      nextBody.creator_id = authenticatedUid;
    }
    req.body = nextBody;
  }

  next();
});

function serializeCapture(doc: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot) {
  const data = (doc.data() || {}) as Record<string, unknown>;
  const clientReported =
    data.client_reported && typeof data.client_reported === "object"
      ? (data.client_reported as Record<string, unknown>)
      : {};
  return {
    id: String(data.id || doc.id),
    target_address: String(data.target_address || "Submitted space"),
    captured_at: toIso(data.captured_at) || new Date().toISOString(),
    status: String(data.status || "submitted"),
    // Server-quoted estimate wins; the client's own pre-registration estimate
    // is display fallback only and never a payable amount (payouts come from
    // the payout ledger, not this field).
    estimated_payout_cents:
      typeof data.estimated_payout_cents === "number"
        ? data.estimated_payout_cents
        : typeof clientReported.estimated_payout_cents === "number"
          ? clientReported.estimated_payout_cents
          : null,
    thumbnail_url: typeof data.thumbnail_url === "string" ? data.thumbnail_url : null,
  };
}

router.get("/profile", async (req: Request, res: Response) => {
  if (!db) {
    return res.status(500).json({ error: "Database not available" });
  }

  const creatorId = creatorIdFromRequest(req);
  if (!creatorId) {
    return res.status(400).json({ error: "Missing creator id" });
  }

  const profileDoc = await db.collection("creatorProfiles").doc(creatorId).get();
  const data = (profileDoc.data() || {}) as Record<string, unknown>;
  return res.json({
    full_name: typeof data.full_name === "string" ? data.full_name : "",
    email: typeof data.email === "string" ? data.email : "",
    phone_number: typeof data.phone_number === "string" ? data.phone_number : "",
    company: typeof data.company === "string" ? data.company : "",
  });
});

router.put("/profile", async (req: Request, res: Response) => {
  if (!db) {
    return res.status(500).json({ error: "Database not available" });
  }

  const creatorId = creatorIdFromRequest(req);
  if (!creatorId) {
    return res.status(400).json({ error: "Missing creator id" });
  }

  const payload = {
    full_name: String(req.body?.full_name || ""),
    email: String(req.body?.email || ""),
    phone_number: String(req.body?.phone_number || ""),
    company: String(req.body?.company || ""),
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
  };

  await db.collection("creatorProfiles").doc(creatorId).set(payload, { merge: true });
  return res.json(payload);
});

router.get("/earnings", async (req: Request, res: Response) => {
  if (!db) {
    return res.status(500).json({ error: "Database not available" });
  }

  const creatorId = creatorIdFromRequest(req);
  if (!creatorId) {
    return res.status(400).json({ error: "Missing creator id" });
  }

  // Lifetime totals come from the maintained earnings aggregate (lazily
  // backfilled on first read) instead of scanning the full payout history.
  const aggregate = await readCreatorEarningsAggregate(creatorId);
  const earnings = summarizeCreatorEarnings(aggregate);

  return res.json({
    total_earned_cents: earnings.totalEarnedCents,
    pending_payout_cents: earnings.pendingPayoutCents,
    scans_completed: earnings.scansCompleted,
  });
});

router.get("/captures", async (req: Request, res: Response) => {
  if (!db) {
    return res.status(500).json({ error: "Database not available" });
  }

  const creatorId = creatorIdFromRequest(req);
  if (!creatorId) {
    return res.status(400).json({ error: "Missing creator id" });
  }

  // Bounded, index-backed read (creator_id + created_at composite) instead of
  // scanning the creator's full capture history per request.
  const limit = Math.min(Math.max(Math.trunc(toNumber(req.query.limit) ?? 50), 1), 200);
  const snapshot = await db
    .collection("creatorCaptures")
    .where("creator_id", "==", creatorId)
    .orderBy("created_at", "desc")
    .limit(limit)
    .get();
  const captures = snapshot.docs
    .map((doc) => serializeCapture(doc))
    .sort((a, b) => new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime());

  return res.json(captures);
});

/**
 * Creator capture registration is client EVIDENCE, never client AUTHORITY.
 *
 * The server owns: authoritative status, payout amounts and earnings, QA
 * outcome/rejection, rights clearance, and the review timeline. The client may
 * only submit narrow registration evidence (capture identity, linkage, capture
 * timestamp, device/app context) plus explicitly non-authoritative
 * client-reported context (its own payout estimate and rights selection),
 * which is stored under `client_reported` and never promoted to the
 * authoritative fields backend review writes.
 */
const CAPTURE_REGISTRATION_ALLOWED_FIELDS = new Set([
  "id",
  "capture_id",
  "creator_id",
  "capture_job_id",
  "buyer_request_id",
  "site_submission_id",
  "target_address",
  "captured_at",
  "market",
  "region_id",
  "site_type",
  "location_type",
  "intended_space_type",
  "requested_outputs",
  "thumbnail_url",
  "raw_prefix",
  "platform",
  "app_version",
  "app_build",
  // Known legacy client fields, accepted for mobile compatibility but stored
  // only as non-authoritative client_reported context (or ignored entirely
  // when they are authoritative-only, like status).
  "status",
  "estimated_payout_cents",
  "quoted_payout_cents",
  "rights_profile",
]);

// Fields older clients may send that shape money/QA/review outcomes. They are
// never persisted from a client payload — not even under client_reported.
const CAPTURE_REGISTRATION_IGNORED_PRIVILEGED_FIELDS = new Set([
  "status",
  "rejection_reason",
  "quality",
  "device_multiplier",
  "bonuses",
  "earnings",
  "timeline",
  "beta_cohort_policy",
]);

function optionalTrimmedString(value: unknown, maxLength = 400): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}
router.post("/captures", async (req: Request, res: Response) => {
  if (!db) {
    return res.status(500).json({ error: "Database not available" });
  }

  const creatorId = creatorIdFromRequest(req);
  if (!creatorId) {
    return res.status(400).json({ error: "Missing creator id" });
  }

  const body =
    req.body && typeof req.body === "object" && !Array.isArray(req.body)
      ? (req.body as Record<string, unknown>)
      : null;
  if (!body) {
    return res.status(400).json({ error: "Request body must be a JSON object", code: "invalid_request" });
  }
  const unknownFields = Object.keys(body).filter(
    (key) =>
      !CAPTURE_REGISTRATION_ALLOWED_FIELDS.has(key)
      && !CAPTURE_REGISTRATION_IGNORED_PRIVILEGED_FIELDS.has(key),
  );
  if (unknownFields.length > 0) {
    return res.status(400).json({
      error: "Unsupported capture registration fields",
      code: "invalid_fields",
      fields: unknownFields.slice(0, 20).sort(),
    });
  }

  const captureId = String(body.id || body.capture_id || "").trim();
  if (!captureId || captureId.length > 200 || /[/\\#?]/.test(captureId)) {
    return res.status(400).json({ error: "Missing or invalid capture id", code: "invalid_capture_id" });
  }

  const market = optionalTrimmedString(body.market) || optionalTrimmedString(body.region_id);
  const siteType =
    optionalTrimmedString(body.site_type)
    || optionalTrimmedString(body.location_type)
    || optionalTrimmedString(body.intended_space_type);

  const docRef = db.collection("creatorCaptures").doc(captureId);

  const replayOrConflictResponse = (existing: Record<string, unknown>) => {
    if (String(existing.creator_id || "") !== creatorId) {
      // Capture IDs are immutable and creator-bound; a colliding ID from a
      // different authenticated creator must never overwrite the original.
      return res.status(409).json({ error: "Capture id conflict", code: "capture_id_conflict" });
    }
    // Idempotent replay from the same creator: acknowledge without regressing
    // any authoritative state the backend may already have written.
    return res.status(200).json({
      ok: true,
      id: captureId,
      replay: true,
      status: String(existing.status || "submitted"),
    });
  };

  // Replay is resolved BEFORE the beta cohort gate: the original successful
  // registration already consumed capacity, so a mobile/network retry of the
  // same capture must stay idempotent even after the cohort closes or fills.
  const existingDoc = await docRef.get();
  if (existingDoc.exists) {
    return replayOrConflictResponse((existingDoc.data() || {}) as Record<string, unknown>);
  }

  const captureClientPolicy = captureClientPolicyDecision(req);
  if (!captureClientPolicy.allowed) {
    return res.status(captureClientPolicy.statusCode).json({
      ok: false,
      status: "capture_client_policy_blocked",
      code: captureClientPolicy.code,
      error: captureClientPolicy.message,
      capture_client_policy: captureClientPolicy.policy,
    });
  }
  const betaCohortDecision = await evaluateBetaCohortGate({
    gate: "capture_intake",
    creatorId,
    market,
    siteType,
    source: "creator_capture_registration",
  });
  if (!betaCohortDecision.allowed) {
    return res.status(betaCohortDecision.statusCode).json({
      ok: false,
      error: betaCohortDecision.message,
      code: betaCohortDecision.reason,
      beta_cohort_policy: betaDecisionForResponse(betaCohortDecision),
    });
  }

  const capturedAtRaw = body.captured_at ? new Date(String(body.captured_at)) : new Date();
  const capturedAt = Number.isNaN(capturedAtRaw.getTime()) ? new Date() : capturedAtRaw;

  const clientReported = {
    estimated_payout_cents:
      typeof body.estimated_payout_cents === "number" && Number.isFinite(body.estimated_payout_cents)
        ? Math.max(0, Math.trunc(body.estimated_payout_cents))
        : typeof body.quoted_payout_cents === "number" && Number.isFinite(body.quoted_payout_cents)
          ? Math.max(0, Math.trunc(body.quoted_payout_cents))
          : null,
    rights_profile: optionalTrimmedString(
      typeof body.rights_profile === "string" ? body.rights_profile : null,
      200,
    ),
    platform: optionalTrimmedString(body.platform, 40),
    app_version: optionalTrimmedString(body.app_version, 80),
    app_build: optionalTrimmedString(body.app_build, 80),
  };

  const payload = {
    id: captureId,
    creator_id: creatorId,
    capture_job_id: optionalTrimmedString(body.capture_job_id, 200),
    buyer_request_id: optionalTrimmedString(body.buyer_request_id, 200),
    site_submission_id: optionalTrimmedString(body.site_submission_id, 200),
    target_address: optionalTrimmedString(body.target_address) || "Submitted space",
    captured_at: capturedAt.toISOString(),
    raw_prefix: optionalTrimmedString(body.raw_prefix, 500),
    // Authoritative fields are server-owned from the very first write: a newly
    // registered capture is always "submitted"; payout, QA, and rights values
    // exist only once backend review writes them.
    status: "submitted",
    estimated_payout_cents: null,
    rejection_reason: null,
    quality: null,
    earnings: null,
    rights_clearance: null,
    client_reported: clientReported,
    requested_outputs: Array.isArray(body.requested_outputs)
      ? body.requested_outputs.slice(0, 20).map((item) => String(item).slice(0, 120))
      : [],
    client_metadata: clientMetadataFromRequest(req),
    capture_client_policy: captureClientPolicy.policy,
    thumbnail_url: optionalTrimmedString(body.thumbnail_url, 800),
    beta_cohort_policy: betaDecisionForResponse(betaCohortDecision),
    timeline: [
      { label: "Capture uploaded", completed_at: capturedAt.toISOString(), state: "completed" },
      { label: "Review queued", completed_at: null, state: "completed" },
      { label: "Payout", completed_at: null, state: "pending" },
    ],
    created_at: admin.firestore.FieldValue.serverTimestamp(),
    // Additive Firestore hotspot-guard field: deterministic capture-id hash
    // shard (sha256 mod 16) so created_at queries can migrate to the sharded
    // composite indexes without a write-time hotspot. See captureShard.ts.
    createdAtShard: deriveCreatedAtShard(captureId),
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
  };

  // Atomic create: the earlier read only short-circuits the common replay
  // path. Two concurrent registrations racing past that read are decided at
  // write time — create() fails on an existing document instead of
  // overwriting it, and the loser is re-resolved as replay or conflict.
  try {
    await docRef.create(payload);
  } catch (error) {
    const racedDoc = await docRef.get();
    if (racedDoc.exists) {
      return replayOrConflictResponse((racedDoc.data() || {}) as Record<string, unknown>);
    }
    throw error;
  }
  await recordBetaCohortAdmission({
    gate: "capture_intake",
    admissionId: `capture:${captureId}`,
    decision: betaCohortDecision,
    creatorId,
    market,
    siteType,
    source: "creator_capture_registration",
  });
  return res.status(201).json({
    ok: true,
    id: captureId,
    status: "submitted",
    beta_cohort_policy: betaDecisionForResponse(betaCohortDecision),
    capture_client_policy: captureClientPolicy.policy,
  });
});

/**
 * Pre-upload policy gate for the mobile capture clients. Read-only: validates
 * auth + creator identity, the beta cohort policy, the runtime kill switch,
 * and the minimum-version policy BEFORE the client spends bandwidth on a raw
 * upload. Never mutates captures, uploads, or admissions.
 */
router.post("/captures/preflight", async (req: Request, res: Response) => {
  const creatorId = creatorIdFromRequest(req);
  if (!creatorId) {
    return res.status(400).json({ error: "Missing creator id", code: "invalid_request" });
  }

  const captureClientPolicy = captureClientPolicyDecision(req);
  if (!captureClientPolicy.allowed) {
    return res.status(captureClientPolicy.statusCode).json({
      ok: false,
      allowed: false,
      status: "capture_client_policy_blocked",
      code: captureClientPolicy.code,
      error: captureClientPolicy.message,
      capture_client_policy: captureClientPolicy.policy,
    });
  }

  const body =
    req.body && typeof req.body === "object" && !Array.isArray(req.body)
      ? (req.body as Record<string, unknown>)
      : {};

  const platform = optionalTrimmedString(body.platform, 40);
  const appVersion = optionalTrimmedString(body.app_version, 80);
  const appBuild = optionalTrimmedString(body.app_build, 80);
  const market = optionalTrimmedString(body.market) || optionalTrimmedString(body.region_id);
  const siteType =
    optionalTrimmedString(body.site_type)
    || optionalTrimmedString(body.location_type)
    || optionalTrimmedString(body.intended_space_type);

  const { config: runtimeConfig } = await loadClientRuntimeConfig();
  const policyForResponse = {
    min_supported_version: runtimeConfig.minSupportedVersion,
    kill_switch: runtimeConfig.killSwitch,
    maintenance_mode: runtimeConfig.maintenanceMode,
    message: runtimeConfig.message,
  };

  if (runtimeConfig.killSwitch) {
    return res.status(503).json({
      ok: false,
      allowed: false,
      code: "capture_client_kill_switch_active",
      error: runtimeConfig.message || "Capture intake is temporarily disabled.",
      policy: policyForResponse,
    });
  }
  if (runtimeConfig.maintenanceMode) {
    return res.status(503).json({
      ok: false,
      allowed: false,
      code: "capture_client_maintenance",
      error: runtimeConfig.message || "Capture intake is in maintenance.",
      policy: policyForResponse,
    });
  }
  if (!clientVersionSatisfiesMinimum(appVersion, runtimeConfig.minSupportedVersion)) {
    return res.status(426).json({
      ok: false,
      allowed: false,
      code: "client_update_required",
      error:
        runtimeConfig.message
        || `This client version is no longer supported. Update to ${runtimeConfig.minSupportedVersion} or newer.`,
      policy: policyForResponse,
    });
  }

  const betaCohortDecision = await evaluateBetaCohortGate({
    gate: "capture_intake",
    creatorId,
    market,
    siteType,
    source: "creator_capture_preflight",
  });
  if (!betaCohortDecision.allowed) {
    return res.status(betaCohortDecision.statusCode).json({
      ok: false,
      allowed: false,
      code: betaCohortDecision.reason,
      error: betaCohortDecision.message,
      policy: policyForResponse,
      capture_client_policy: captureClientPolicy.policy,
      beta_cohort_policy: betaDecisionForResponse(betaCohortDecision),
    });
  }

  return res.status(200).json({
    ok: true,
    allowed: true,
    code: "allowed",
    policy: policyForResponse,
    capture_client_policy: captureClientPolicy.policy,
    beta_cohort_policy: betaDecisionForResponse(betaCohortDecision),
    client: { platform, app_version: appVersion, app_build: appBuild },
  });
});

router.get("/captures/:captureId", async (req: Request, res: Response) => {
  if (!db) {
    return res.status(500).json({ error: "Database not available" });
  }

  const creatorId = creatorIdFromRequest(req);
  if (!creatorId) {
    return res.status(400).json({ error: "Missing creator id" });
  }

  const doc = await db.collection("creatorCaptures").doc(req.params.captureId).get();
  if (!doc.exists) {
    return res.status(404).end();
  }

  const data = doc.data() as Record<string, unknown>;
  if (String(data.creator_id || "") !== creatorId) {
    return res.status(404).end();
  }

  return res.json({
    id: String(data.id || req.params.captureId),
    target_address: String(data.target_address || "Submitted space"),
    captured_at: toIso(data.captured_at),
    status: String(data.status || "submitted"),
    quality: data.quality || null,
    earnings: data.earnings || null,
    rejection_reason: data.rejection_reason || null,
    timeline: Array.isArray(data.timeline) ? data.timeline : [],
  });
});

router.put("/devices/current", async (req: Request, res: Response) => {
  if (!db) {
    return res.status(500).json({ error: "Database not available" });
  }

  const creatorId = creatorIdFromRequest(req);
  if (!creatorId) {
    return res.status(400).json({ error: "Missing creator id" });
  }

  const payload = {
    creator_id: creatorId,
    platform: String(req.body?.platform || ""),
    fcm_token: String(req.body?.fcm_token || ""),
    authorization_status: String(req.body?.authorization_status || "unknown"),
    app_version: String(req.body?.app_version || ""),
    last_seen_at: req.body?.last_seen_at || new Date().toISOString(),
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
  };

  await db
    .collection("creatorProfiles")
    .doc(creatorId)
    .set(
      {
        notification_device: payload,
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

  return res.json({ ok: true });
});

router.get("/notifications/preferences", async (req: Request, res: Response) => {
  if (!db) {
    return res.status(500).json({ error: "Database not available" });
  }

  const creatorId = creatorIdFromRequest(req);
  if (!creatorId) {
    return res.status(400).json({ error: "Missing creator id" });
  }

  const profileDoc = await db.collection("creatorProfiles").doc(creatorId).get();
  const data = (profileDoc.data() || {}) as Record<string, unknown>;
  const stored =
    data.notification_preferences &&
    typeof data.notification_preferences === "object"
      ? (data.notification_preferences as Record<string, unknown>)
      : {};

  return res.json({
    nearby_jobs:
      typeof stored.nearby_jobs === "boolean"
        ? stored.nearby_jobs
        : DEFAULT_NOTIFICATION_PREFERENCES.nearby_jobs,
    reservations:
      typeof stored.reservations === "boolean"
        ? stored.reservations
        : DEFAULT_NOTIFICATION_PREFERENCES.reservations,
    capture_status:
      typeof stored.capture_status === "boolean"
        ? stored.capture_status
        : DEFAULT_NOTIFICATION_PREFERENCES.capture_status,
    payouts:
      typeof stored.payouts === "boolean"
        ? stored.payouts
        : DEFAULT_NOTIFICATION_PREFERENCES.payouts,
    account:
      typeof stored.account === "boolean"
        ? stored.account
        : DEFAULT_NOTIFICATION_PREFERENCES.account,
  });
});

router.put("/notifications/preferences", async (req: Request, res: Response) => {
  if (!db) {
    return res.status(500).json({ error: "Database not available" });
  }

  const creatorId = creatorIdFromRequest(req);
  if (!creatorId) {
    return res.status(400).json({ error: "Missing creator id" });
  }

  const payload = {
    nearby_jobs: Boolean(req.body?.nearby_jobs),
    reservations: Boolean(req.body?.reservations),
    capture_status: Boolean(req.body?.capture_status),
    payouts: Boolean(req.body?.payouts),
    account: Boolean(req.body?.account),
  };

  await db
    .collection("creatorProfiles")
    .doc(creatorId)
    .set(
      {
        notification_preferences: payload,
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

  return res.json(payload);
});

router.post("/client-telemetry", async (req: Request, res: Response) => {
  if (!db) {
    return res.status(500).json({ error: "Database not available" });
  }

  const creatorId = creatorIdFromRequest(req);
  if (!creatorId) {
    return res.status(400).json({ error: "Missing creator id" });
  }

  const eventId = telemetryString(req.body?.event_id, randomUUID(), 120)
    .replace(/[^a-zA-Z0-9._:-]/g, "-");
  // The idempotency key is namespaced by the authenticated creator so one
  // user's caller-chosen event id can never overwrite (or replay-mutate)
  // another user's telemetry document in the shared collection.
  const telemetryDocId = `${creatorId}__${eventId}`.slice(0, 400);
  const eventType = telemetryString(req.body?.event_type, "unknown", 80);
  const severity =
    telemetryString(req.body?.severity, "warning", 20).toLowerCase() === "critical"
      ? "critical"
      : "warning";
  const operation = telemetryString(req.body?.operation, "unknown", 120);
  const status = telemetryString(req.body?.status, "unknown", 80);
  const occurredAt = telemetryString(req.body?.occurred_at, new Date().toISOString(), 80);
  const metadata = telemetryMetadata(req.body?.metadata);
  const breadcrumbs = telemetryBreadcrumbs(req.body?.breadcrumbs);
  const captureId = telemetryOptionalString(req.body?.capture_id, 120)
    || metadata.capture_id
    || null;
  const sessionId = telemetryOptionalString(req.body?.session_id, 120);
  const payload = {
    id: eventId,
    creator_id: creatorId,
    event_type: eventType,
    severity,
    operation,
    status,
    occurred_at: occurredAt,
    session_id: sessionId,
    capture_id: captureId,
    app_version: telemetryOptionalString(req.body?.app_version, 80),
    app_build: telemetryOptionalString(req.body?.app_build, 80),
    os_version: telemetryOptionalString(req.body?.os_version, 120),
    device_model: telemetryOptionalString(req.body?.device_model, 120),
    metadata,
    breadcrumbs,
    source: "blueprint_capture_native_client",
    beta_alert_candidate: true,
    received_at: admin.firestore.FieldValue.serverTimestamp(),
    // Operational exhaust, not capture truth: expires via the Firestore TTL
    // policy on creatorClientTelemetry.expires_at
    // (scripts/apply_firestore_ttl_policies.sh).
    expires_at: new Date(Date.now() + TELEMETRY_RETENTION_DAYS * 24 * 60 * 60 * 1000),
  };

  const telemetryRef = db.collection("creatorClientTelemetry").doc(telemetryDocId);
  const existingEvent = await telemetryRef.get();
  if (existingEvent.exists) {
    // Replay of an already-recorded event: acknowledge idempotently without
    // rewriting the stored document or re-opening ops alerts.
    return res.status(202).json({
      accepted: true,
      duplicate: true,
      event_id: eventId,
      alert_recorded: false,
      alert_opened: false,
    });
  }
  await telemetryRef.set(payload);

  const shouldAlert =
    severity === "critical"
    || eventType.toLowerCase().includes("crash")
    || eventType.toLowerCase().includes("uncaught")
    || telemetryStatusIndicatesFailure(status);
  const alertResult = shouldAlert
    ? await recordBetaOpsFailureSignal({
        kind: alertKindForClientTelemetry(eventType, severity),
        severity,
        scopeId: captureId || operation || creatorId,
        summary: `Mobile capture client ${eventType}: ${operation}`,
        // Bounded, redacted scope only — the free-form metadata map stays in
        // the telemetry record and out of ops alerts.
        details: {
          creator_id: creatorId,
          event_id: eventId,
          operation,
          status,
          capture_id: captureId,
          session_id: sessionId,
        },
        occurredAt,
      })
    : { recorded: false, alertOpened: false };

  return res.status(202).json({
    accepted: true,
    event_id: eventId,
    alert_recorded: Boolean(alertResult.recorded),
    alert_opened: Boolean(alertResult.alertOpened),
  });
});

router.get("/city-launch/targets", async (req: Request, res: Response) => {
  const lat = toNumber(req.query.lat);
  const lng = toNumber(req.query.lng);
  if (lat === null || lng === null) {
    return res.status(400).json({ error: "lat and lng are required" });
  }

  const radiusMeters = Math.min(
    Math.max(toNumber(req.query.radius_m) ?? 16_093, 100),
    80_467,
  );
  const limit = Math.min(Math.max(Math.trunc(toNumber(req.query.limit) ?? 12), 1), 50);

  return res.json(
    await buildCityLaunchCaptureTargetFeed({
      lat,
      lng,
      radiusMeters,
      limit,
    }),
  );
});

router.get("/launch-status", async (req: Request, res: Response) => {
  const city = String(req.query.city || "").trim();
  const stateCode = String(req.query.state_code || "").trim() || null;
  const resolvedCity = city ? { city, stateCode } : null;

  try {
    return res.json(
      await buildCreatorLaunchStatus({
        resolvedCity,
      }),
    );
  } catch (error) {
    return res.json(
      buildUnavailableCreatorLaunchStatus({
        resolvedCity,
        warning: `creatorLaunchStatus:${error instanceof Error ? error.message : String(error)}`,
      }),
    );
  }
});

router.post("/city-launch/candidate-signals", async (req: Request, res: Response) => {
  const creatorId = creatorIdFromRequest(req);
  if (!creatorId) {
    return res.status(400).json({ error: "Missing creator id" });
  }

  const rawCandidates = Array.isArray(req.body?.candidates) ? req.body.candidates : [];
  const candidates = rawCandidates
    .map((candidate) => ({
      creatorId,
      city: String(candidate?.city || "").trim(),
      name: String(candidate?.name || "").trim(),
      address: candidate?.address ? String(candidate.address).trim() : null,
      lat: Number(candidate?.lat),
      lng: Number(candidate?.lng),
      provider: String(candidate?.provider || "unknown").trim(),
      providerPlaceId: candidate?.provider_place_id ? String(candidate.provider_place_id).trim() : null,
      types: Array.isArray(candidate?.types) ? candidate.types.map(String) : [],
      sourceContext: String(candidate?.source_context || "app_open_scan").trim() as
        | "signup_scan"
        | "app_open_scan"
        | "manual_refresh"
        | "agent_public_candidate_research",
    }))
    .filter((candidate) =>
      candidate.city
      && candidate.name
      && Number.isFinite(candidate.lat)
      && Number.isFinite(candidate.lng),
    );

  if (!candidates.length) {
    return res.status(400).json({ error: "At least one valid candidate is required" });
  }

  const result = await intakeCityLaunchCandidateSignals(candidates);
  const review = await reviewCityLaunchCandidateBatch({
    candidateIds: result.map((candidate) => candidate.id),
    limit: result.length,
    dryRun: false,
    reviewedBy: "public-space-review-agent",
  });
  void dispatchCityLaunchCandidatePaperclipHandoff({
    candidates: result,
    review,
    source: "creator_city_launch_candidate_signals",
  }).then((handoff) => {
    if (handoff.error) {
      logger.error(
        {
          event: "city_launch_candidate_paperclip_handoff_failed",
          source: "creator_city_launch_candidate_signals",
          candidateCount: result.length,
          err: handoff.error,
        },
        "City launch candidate Paperclip handoff failed",
      );
    }
  });
  return res.status(201).json({ candidates: result, review });
});

router.get("/city-launch/review-candidates", async (req: Request, res: Response) => {
  const lat = toNumber(req.query.lat);
  const lng = toNumber(req.query.lng);
  if (lat === null || lng === null) {
    return res.status(400).json({ error: "lat and lng are required" });
  }

  const radiusMeters = Math.min(
    Math.max(toNumber(req.query.radius_m) ?? 16_093, 100),
    80_467,
  );
  const limit = Math.min(Math.max(Math.trunc(toNumber(req.query.limit) ?? 12), 1), 50);

  return res.json(
    await buildCityLaunchUnderReviewFeed({
      lat,
      lng,
      radiusMeters,
      limit,
    }),
  );
});

router.get("/qc", async (req: Request, res: Response) => {
  if (!db) {
    return res.status(500).json({ error: "Database not available" });
  }

  const creatorId = creatorIdFromRequest(req);
  if (!creatorId) {
    return res.status(400).json({ error: "Missing creator id" });
  }

  // QC stats are advisory: compute them over a bounded recent window instead
  // of the creator's unbounded capture history.
  const snapshot = await db
    .collection("creatorCaptures")
    .where("creator_id", "==", creatorId)
    .orderBy("created_at", "desc")
    .limit(QC_RECENT_CAPTURE_LIMIT)
    .get();

  let pendingCount = 0;
  let needsFixCount = 0;
  let approvedCount = 0;

  snapshot.docs.forEach((doc) => {
    const status = String(doc.data().status || "");
    if (["submitted", "under_review"].includes(status)) pendingCount += 1;
    if (["needs_recapture", "needs_fix", "rejected"].includes(status)) needsFixCount += 1;
    if (["approved", "paid"].includes(status)) approvedCount += 1;
  });

  // Average turnaround is computed from this creator's actually reviewed
  // captures (submission -> recorded review completion). When no reviewed
  // capture carries both timestamps the value is null — never a hardcoded
  // customer-facing operational metric.
  const turnaroundSamples: number[] = [];
  snapshot.docs.forEach((doc) => {
    const data = (doc.data() || {}) as Record<string, unknown>;
    const submittedAt = toIso(data.captured_at) || toIso(data.created_at);
    const reviewedAt = toIso(data.review_completed_at) || toIso(data.reviewed_at);
    if (!submittedAt || !reviewedAt) {
      return;
    }
    const elapsedMs = new Date(reviewedAt).getTime() - new Date(submittedAt).getTime();
    if (Number.isFinite(elapsedMs) && elapsedMs > 0) {
      turnaroundSamples.push(elapsedMs / 3_600_000);
    }
  });
  const averageTurnaroundHours = turnaroundSamples.length
    ? Math.round(
        (turnaroundSamples.reduce((sum, hours) => sum + hours, 0) / turnaroundSamples.length) * 10,
      ) / 10
    : null;

  return res.json({
    pending_count: pendingCount,
    needs_fix_count: needsFixCount,
    approved_count: approvedCount,
    average_turnaround_hours: averageTurnaroundHours,
    last_updated: new Date().toISOString(),
  });
});

router.get("/payouts/ledger", async (req: Request, res: Response) => {
  if (!db) {
    return res.status(500).json({ error: "Database not available" });
  }

  const creatorId = creatorIdFromRequest(req);
  if (!creatorId) {
    return res.status(400).json({ error: "Missing creator id" });
  }

  const entries = (await listCreatorPayouts(creatorId, { limit: PAYOUT_LEDGER_FETCH_LIMIT }))
    .filter((entry) => entry.approved_amount_cents > 0)
    .slice(0, 50)
    .map((entry) => ({
      id: entry.id,
      scheduled_for:
        entry.paid_at || entry.approved_at || entry.updated_at || new Date().toISOString(),
      amount_cents: entry.approved_amount_cents,
      status: mapCreatorPayoutStatusForLedger(entry.status),
      description: entry.scene_id
        ? `Capture payout for ${entry.scene_id}`
        : "Capture payout",
    }));

  return res.json(entries);
});

export default router;
