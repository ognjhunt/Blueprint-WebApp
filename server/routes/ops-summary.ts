import { Request, Response, Router } from "express";

import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { hasAnyRole, resolveAccessContext } from "../utils/access-control";

/**
 * R036: authenticated backing route for the operator console (/ops/*).
 *
 * The ops console surfaces were previously mock-only and publicly routed. This
 * route is the server-side gate + real-data source for the highest-value ops
 * panels. It is mounted behind `verifyFirebaseToken` and additionally enforces
 * an admin/ops role here (`requireOps`) so client-only hiding can never expose
 * operational state — a non-admin caller gets 401/403, never data.
 *
 * Every panel reads a real Firestore collection that already exists in the
 * stack (operatorAlerts from R037, inboundRequests, creatorPayouts,
 * capture_submissions, buyerOrders). Each panel is independently guarded: a
 * query failure degrades that panel to `wired: false` with a reason instead of
 * failing the whole response or fabricating numbers. Panels with no real source
 * yet are reported in `notWired` so the UI can label them honestly rather than
 * show fake operational state (repo rule: no fabricated readiness/supply).
 */

const router = Router();

// Recent-doc scan caps. We read a bounded batch and categorize in memory rather
// than relying on composite indexes / `in` filters, which keeps the queries
// cheap, index-free, and simple to reason about.
const ALERTS_SCAN_LIMIT = 200;
const REQUESTS_SCAN_LIMIT = 200;
const PAYOUTS_SCAN_LIMIT = 200;
const CAPTURES_SCAN_LIMIT = 300;
const ORDERS_SCAN_LIMIT = 200;
const RECENT_ROWS = 8;

type FirestoreDoc =
  | FirebaseFirestore.QueryDocumentSnapshot
  | FirebaseFirestore.DocumentSnapshot;

async function requireOps(_req: Request, res: Response, next: () => void) {
  const user = res.locals.firebaseUser;
  if (!user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  if (!(await hasAnyRole(res, ["admin", "ops"]))) {
    logger.warn(
      { email: user.email, uid: user.uid },
      "Non-admin/ops user attempted to access the operator console data route",
    );
    return res.status(403).json({ error: "Ops access required" });
  }
  next();
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

/** Normalize Firestore Timestamp | ISO string | Date to an ISO string or null. */
function toIso(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  const maybeTimestamp = value as { toDate?: () => Date };
  if (typeof maybeTimestamp.toDate === "function") {
    const date = maybeTimestamp.toDate();
    return date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  return null;
}

/**
 * Read a bounded batch ordered by `orderField` (desc). If the ordered read
 * fails (e.g. missing field/index), fall back to an unordered bounded read so a
 * panel still degrades gracefully rather than throwing.
 */
async function readRecentDocs(
  collection: string,
  orderField: string,
  limit: number,
): Promise<FirestoreDoc[]> {
  const firestore = db;
  if (!firestore) {
    return [];
  }
  try {
    const snapshot = await firestore
      .collection(collection)
      .orderBy(orderField, "desc")
      .limit(limit)
      .get();
    return snapshot.docs;
  } catch {
    const snapshot = await firestore.collection(collection).limit(limit).get();
    return snapshot.docs;
  }
}

type PanelBase = { wired: boolean; reason?: string };

const UNAVAILABLE: PanelBase = { wired: false, reason: "firestore_unavailable" };

async function buildAlertsPanel() {
  try {
    const docs = await readRecentDocs("operatorAlerts", "created_at", ALERTS_SCAN_LIMIT);
    let critical = 0;
    let warning = 0;
    let info = 0;
    let unacknowledged = 0;
    const recent = docs.map((doc) => {
      const data = asRecord(doc.data());
      const severity = asString(data.severity) || "critical";
      const acknowledged = data.acknowledged === true;
      if (!acknowledged) {
        unacknowledged += 1;
        if (severity === "critical") critical += 1;
        else if (severity === "warning") warning += 1;
        else info += 1;
      }
      return {
        id: doc.id,
        class: asString(data.class) || "unknown",
        severity,
        message: asString(data.message),
        acknowledged,
        createdAtIso: asString(data.created_at_iso) || toIso(data.created_at),
      };
    });
    return {
      wired: true as const,
      total: docs.length,
      unacknowledged,
      bySeverity: { critical, warning, info },
      recent: recent.filter((row) => !row.acknowledged).slice(0, RECENT_ROWS),
    };
  } catch (error) {
    logger.error({ error }, "ops-summary alerts panel failed");
    return { ...UNAVAILABLE, reason: "query_failed" as const };
  }
}

const IN_FLIGHT_REQUEST_STATES = new Set([
  "submitted",
  "in_review",
  "capture_requested",
  "qa_passed",
  "needs_more_evidence",
  "needs_refresh",
]);

async function buildQueuePanel() {
  try {
    const docs = await readRecentDocs("inboundRequests", "createdAt", REQUESTS_SCAN_LIMIT);
    let open = 0;
    let blocked = 0;
    const rows: Array<{
      id: string;
      status: string;
      priority: string;
      rightsStatus: string;
      captureStatus: string;
      createdAtIso: string | null;
    }> = [];
    for (const doc of docs) {
      const data = asRecord(doc.data());
      const ops = asRecord(data.ops);
      const state =
        asString(data.qualification_state) || asString(data.status) || "submitted";
      const rightsStatus = asString(ops.rights_status) || "unknown";
      const policyTier = asString(ops.capture_policy_tier);
      const isBlocked = rightsStatus === "blocked" || policyTier === "not_allowed";
      if (IN_FLIGHT_REQUEST_STATES.has(state)) {
        open += 1;
      }
      if (isBlocked) {
        blocked += 1;
      }
      rows.push({
        // requestId only — no encrypted PII (site name/contact) is surfaced here.
        id: asString(data.requestId) || doc.id,
        status: state,
        priority: asString(data.priority) || "normal",
        rightsStatus,
        captureStatus: asString(ops.capture_status) || "not_requested",
        createdAtIso: toIso(data.createdAt),
      });
    }
    return {
      wired: true as const,
      scanned: docs.length,
      open,
      blocked,
      recent: rows.slice(0, RECENT_ROWS),
    };
  } catch (error) {
    logger.error({ error }, "ops-summary queue panel failed");
    return { ...UNAVAILABLE, reason: "query_failed" as const };
  }
}

// Creator payout states that need an operator: funds on hold, disbursement
// failed, or held for manual review / ineligibility.
const PAYOUT_EXCEPTION_STATES = new Set([
  "on_hold",
  "disbursement_failed",
  "review_required",
  "ineligible",
]);

async function buildPayoutsPanel() {
  try {
    const docs = await readRecentDocs("creatorPayouts", "created_at", PAYOUTS_SCAN_LIMIT);
    let onHold = 0;
    let failed = 0;
    let reviewRequired = 0;
    let ineligible = 0;
    const recent: Array<{
      id: string;
      creatorId: string;
      status: string;
      amountCents: number;
      failureReason: string | null;
      updatedAtIso: string | null;
    }> = [];
    for (const doc of docs) {
      const data = asRecord(doc.data());
      const status = asString(data.status);
      if (!PAYOUT_EXCEPTION_STATES.has(status)) {
        continue;
      }
      if (status === "on_hold") onHold += 1;
      else if (status === "disbursement_failed") failed += 1;
      else if (status === "review_required") reviewRequired += 1;
      else if (status === "ineligible") ineligible += 1;
      recent.push({
        id: doc.id,
        creatorId: asString(data.creator_id),
        status,
        amountCents:
          asNumber(data.approved_amount_cents) || asNumber(data.base_payout_cents),
        failureReason: asString(data.failure_reason) || null,
        updatedAtIso: toIso(data.updated_at) || toIso(data.created_at),
      });
    }
    return {
      wired: true as const,
      exceptions: onHold + failed + reviewRequired + ineligible,
      onHold,
      failed,
      reviewRequired,
      ineligible,
      recent: recent.slice(0, RECENT_ROWS),
    };
  } catch (error) {
    logger.error({ error }, "ops-summary payouts panel failed");
    return { ...UNAVAILABLE, reason: "query_failed" as const };
  }
}

// Capture submission statuses that need operator attention.
const CAPTURE_ATTENTION_STATES = new Set([
  "needs_recapture",
  "under_review",
  "blocked",
  "rejected",
]);

async function buildCapturesPanel() {
  try {
    const docs = await readRecentDocs(
      "capture_submissions",
      "created_at",
      CAPTURES_SCAN_LIMIT,
    );
    let stuck = 0;
    let underReview = 0;
    let needsRecapture = 0;
    const recent: Array<{
      id: string;
      status: string;
      uploaded: boolean;
      submittedAtIso: string | null;
    }> = [];
    for (const doc of docs) {
      const data = asRecord(doc.data());
      const status = asString(data.status);
      const lifecycle = asRecord(data.lifecycle);
      const startedAtIso =
        toIso(lifecycle.upload_started_at) ||
        toIso(lifecycle.capture_started_at) ||
        toIso(data.submitted_at) ||
        toIso(data.created_at);
      const uploadedAtIso =
        toIso(lifecycle.capture_uploaded_at) || toIso(data.capture_uploaded_at);
      // "Stuck" = an upload/capture began but never reached a durable upload.
      const isStuck = Boolean(startedAtIso) && !uploadedAtIso;
      if (isStuck) stuck += 1;
      if (status === "under_review") underReview += 1;
      if (status === "needs_recapture") needsRecapture += 1;
      if (isStuck || CAPTURE_ATTENTION_STATES.has(status)) {
        recent.push({
          id: asString(data.capture_id) || doc.id,
          status: status || (isStuck ? "awaiting_upload" : "unknown"),
          uploaded: Boolean(uploadedAtIso),
          submittedAtIso: startedAtIso,
        });
      }
    }
    return {
      wired: true as const,
      scanned: docs.length,
      stuck,
      underReview,
      needsRecapture,
      recent: recent.slice(0, RECENT_ROWS),
    };
  } catch (error) {
    logger.error({ error }, "ops-summary captures panel failed");
    return { ...UNAVAILABLE, reason: "query_failed" as const };
  }
}

async function buildOrdersPanel() {
  try {
    const docs = await readRecentDocs("buyerOrders", "created_at", ORDERS_SCAN_LIMIT);
    let paymentFailed = 0;
    let manualReview = 0;
    const recent: Array<{
      id: string;
      status: string;
      paymentStatus: string;
      fulfillmentStatus: string;
      failureReason: string | null;
    }> = [];
    for (const doc of docs) {
      const data = asRecord(doc.data());
      const paymentStatus = asString(data.payment_status);
      const fulfillmentStatus = asString(data.fulfillment_status);
      const isPaymentFailed = paymentStatus === "failed";
      const isManualReview = fulfillmentStatus === "manual_review_required";
      if (!isPaymentFailed && !isManualReview) {
        continue;
      }
      if (isPaymentFailed) paymentFailed += 1;
      if (isManualReview) manualReview += 1;
      recent.push({
        id: doc.id,
        status: asString(data.status),
        paymentStatus,
        fulfillmentStatus,
        failureReason: asString(data.failure_reason) || null,
      });
    }
    return {
      wired: true as const,
      exceptions: paymentFailed + manualReview,
      paymentFailed,
      manualReview,
      recent: recent.slice(0, RECENT_ROWS),
    };
  } catch (error) {
    logger.error({ error }, "ops-summary orders panel failed");
    return { ...UNAVAILABLE, reason: "query_failed" as const };
  }
}

// Panels the /ops console renders that do NOT yet have a real backend source.
// Surfaced so the UI labels them "not yet wired" instead of showing mock numbers
// as if they were live operational state.
const NOT_WIRED_PANELS = [
  { key: "capturerRoster", label: "Capture supply roster", surface: "/ops/supply" },
  { key: "cityLaunchPipeline", label: "City launch pipeline", surface: "/ops/city-launch" },
  { key: "evidenceFrames", label: "Evidence review board", surface: "/ops/evidence" },
  { key: "buyerHandoffPackage", label: "Buyer handoff package", surface: "/ops/handoff" },
  { key: "spendCategories", label: "Spend category ceilings", surface: "/ops/spend" },
];

router.get("/", requireOps, async (_req: Request, res: Response) => {
  try {
    const access = await resolveAccessContext(res);

    if (!db) {
      return res.json({
        ok: true,
        degraded: true,
        generatedAt: new Date().toISOString(),
        operatorEmail: access.email || null,
        panels: {
          alerts: UNAVAILABLE,
          queue: UNAVAILABLE,
          payouts: UNAVAILABLE,
          captures: UNAVAILABLE,
          orders: UNAVAILABLE,
        },
        notWired: NOT_WIRED_PANELS,
      });
    }

    const [alerts, queue, payouts, captures, orders] = await Promise.all([
      buildAlertsPanel(),
      buildQueuePanel(),
      buildPayoutsPanel(),
      buildCapturesPanel(),
      buildOrdersPanel(),
    ]);

    return res.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      operatorEmail: access.email || null,
      panels: { alerts, queue, payouts, captures, orders },
      notWired: NOT_WIRED_PANELS,
    });
  } catch (error) {
    logger.error({ error }, "Failed to build ops summary");
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to build ops summary",
    });
  }
});

export default router;
