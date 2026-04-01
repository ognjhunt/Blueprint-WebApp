import { applicationDefault, cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp, type Firestore } from "firebase-admin/firestore";

export type FounderQueueAlert = {
  queue: "inboundRequests" | "contactRequests" | "waitlistSubmissions" | "capture_jobs" | "creatorPayouts";
  count: number;
  oldestAgeHours: number | null;
  countThreshold: number;
  ageThresholdHours: number;
  detail: string;
  lane: "Ops" | "Buyer" | "Capturer" | "Risk";
};

type QueueSnapshot = {
  openCount: number;
  oldestAgeHours: number | null;
};

const APP_NAME = "blueprint-paperclip-founder-visibility";
const MAX_DOCS_PER_QUEUE = 1000;

type QueueThresholdConfig = {
  countThreshold: number;
  ageThresholdHours: number;
  lane: FounderQueueAlert["lane"];
};

const QUEUE_THRESHOLDS: Record<FounderQueueAlert["queue"], QueueThresholdConfig> = {
  inboundRequests: { countThreshold: 12, ageThresholdHours: 24, lane: "Buyer" },
  contactRequests: { countThreshold: 10, ageThresholdHours: 24, lane: "Ops" },
  waitlistSubmissions: { countThreshold: 25, ageThresholdHours: 72, lane: "Capturer" },
  capture_jobs: { countThreshold: 8, ageThresholdHours: 48, lane: "Ops" },
  creatorPayouts: { countThreshold: 5, ageThresholdHours: 24 * 7, lane: "Risk" },
};

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === "object" && typeof (value as { toDate?: () => Date }).toDate === "function") {
    try {
      return (value as { toDate: () => Date }).toDate();
    } catch {
      return null;
    }
  }
  return null;
}

function hoursSince(value: unknown, now: Date) {
  const date = toDate(value);
  if (!date) return null;
  return Math.max(0, Math.round((((now.getTime() - date.getTime()) / 36e5) + Number.EPSILON) * 10) / 10);
}

function isWaitlistOpen(data: Record<string, unknown>) {
  const status = asString(data.status) ?? "";
  const automation = asRecord(data.ops_automation);
  const automationStatus = asString(automation?.status) ?? "";
  return ["new", "pending"].includes(status) || ["pending", "failed", "blocked"].includes(automationStatus);
}

function isInboundOpen(data: Record<string, unknown>) {
  const qualification = asString(data.qualification_state) ?? asString(data.status) ?? "";
  const opportunity = asString(data.opportunity_state) ?? "";
  if (data.human_review_required === true) return true;
  return !["qualified_ready", "qualified_risky", "not_ready_yet"].includes(qualification)
    && !["closed_won", "closed_lost"].includes(opportunity);
}

function isContactOpen(data: Record<string, unknown>) {
  const automation = asRecord(data.ops_automation);
  const automationStatus = asString(automation?.status);
  if (data.human_review_required === true) return true;
  return !automationStatus || ["pending", "failed", "blocked"].includes(automationStatus);
}

function isCaptureJobOpen(data: Record<string, unknown>) {
  const status = asString(data.status) ?? "";
  const fieldOps = asRecord(data.field_ops);
  const capturerAssignment = asRecord(fieldOps?.capturer_assignment);
  const siteAccess = asRecord(data.site_access);
  const overdueReview = asRecord(siteAccess?.overdue_review);
  if (["cancelled", "completed", "paid", "approved"].includes(status)) return false;
  return !capturerAssignment || overdueReview?.active === true || ["scheduled", "capture_requested", "dispatch_review"].includes(status);
}

function isPayoutOpen(data: Record<string, unknown>) {
  const status = asString(data.status) ?? "";
  const financeReview = asRecord(data.finance_review);
  const reviewStatus = asString(financeReview?.review_status) ?? "";
  const overdueReview = asRecord(financeReview?.overdue_review);
  return ["review_required", "pending_approval", "failed"].includes(status)
    || ["pending", "investigating", "needs_review"].includes(reviewStatus)
    || overdueReview?.active === true;
}

function createdAtForQueue(queue: FounderQueueAlert["queue"], data: Record<string, unknown>) {
  switch (queue) {
    case "waitlistSubmissions":
      return data.created_at ?? data.updated_at;
    case "inboundRequests":
      return data.createdAt ?? data.updatedAt;
    case "contactRequests":
      return data.createdAt;
    case "capture_jobs":
      return data.createdAt ?? data.updatedAt;
    case "creatorPayouts":
      return data.createdAt ?? data.updatedAt;
    default:
      return null;
  }
}

async function loadQueueRows(db: Firestore, collectionName: string) {
  const snapshot = await db.collection(collectionName).limit(MAX_DOCS_PER_QUEUE).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, data: (doc.data() ?? {}) as Record<string, unknown> }));
}

function summarizeQueue(
  queue: FounderQueueAlert["queue"],
  rows: Array<{ id: string; data: Record<string, unknown> }>,
  now: Date,
): QueueSnapshot {
  const isOpen =
    queue === "waitlistSubmissions"
      ? isWaitlistOpen
      : queue === "inboundRequests"
        ? isInboundOpen
        : queue === "contactRequests"
          ? isContactOpen
          : queue === "capture_jobs"
            ? isCaptureJobOpen
            : isPayoutOpen;

  const openRows = rows.filter((row) => isOpen(row.data));
  let oldestAgeHours: number | null = null;
  for (const row of openRows) {
    const ageHours = hoursSince(createdAtForQueue(queue, row.data), now);
    if (ageHours === null) continue;
    if (oldestAgeHours === null || ageHours > oldestAgeHours) {
      oldestAgeHours = ageHours;
    }
  }

  return {
    openCount: openRows.length,
    oldestAgeHours,
  };
}

function formatQueueDetail(queue: FounderQueueAlert["queue"], snapshot: QueueSnapshot, threshold: QueueThresholdConfig) {
  const oldest = snapshot.oldestAgeHours === null ? "unknown" : `${snapshot.oldestAgeHours.toFixed(1)}h`;
  return `${queue} has ${snapshot.openCount} open item(s); oldest open age is ${oldest}. Thresholds are >${threshold.countThreshold} items or >${threshold.ageThresholdHours}h.`;
}

function resolveFirestore(): Firestore | null {
  try {
    if (!getApps().some((app) => app.name === APP_NAME)) {
      const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
      if (serviceAccountJson) {
        initializeApp(
          {
            credential: cert(JSON.parse(serviceAccountJson)),
          },
          APP_NAME,
        );
      } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        initializeApp(
          {
            credential: applicationDefault(),
          },
          APP_NAME,
        );
      } else {
        return null;
      }
    }

    return getFirestore(getApp(APP_NAME));
  } catch {
    return null;
  }
}

export async function collectFounderQueueAlerts(nowIso: string): Promise<FounderQueueAlert[]> {
  const db = resolveFirestore();
  if (!db) return [];

  const now = new Date(nowIso);
  const queues = Object.keys(QUEUE_THRESHOLDS) as FounderQueueAlert["queue"][];
  const alerts: FounderQueueAlert[] = [];

  for (const queue of queues) {
    const rows = await loadQueueRows(db, queue);
    const snapshot = summarizeQueue(queue, rows, now);
    const threshold = QUEUE_THRESHOLDS[queue];
    const ageExceeded = snapshot.oldestAgeHours !== null && snapshot.oldestAgeHours > threshold.ageThresholdHours;
    const countExceeded = snapshot.openCount > threshold.countThreshold;
    if (!ageExceeded && !countExceeded) continue;

    alerts.push({
      queue,
      count: snapshot.openCount,
      oldestAgeHours: snapshot.oldestAgeHours,
      countThreshold: threshold.countThreshold,
      ageThresholdHours: threshold.ageThresholdHours,
      lane: threshold.lane,
      detail: formatQueueDetail(queue, snapshot, threshold),
    });
  }

  return alerts;
}
