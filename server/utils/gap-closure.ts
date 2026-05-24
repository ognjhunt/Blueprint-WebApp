import crypto from "node:crypto";
import type { DocumentReference, DocumentSnapshot } from "firebase-admin/firestore";
import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import {
  buildLaunchReadinessSnapshot,
  listActiveReadinessFindings,
} from "./launch-readiness";
import { sendSlackMessage } from "./slack";

const COLLECTION = "opsWorkItems";

export type OpsWorkItemKind =
  | "readiness"
  | "automation_worker"
  | "automation_queue"
  | "external";
export type OpsWorkItemStatus = "open" | "delegated" | "completed";

export type AutomationGapFindingType = "worker_failure" | "stuck_queue";

export type AutomationWorkerGapFinding = {
  stableId: string;
  kind: Extract<OpsWorkItemKind, "automation_worker" | "automation_queue">;
  findingType: AutomationGapFindingType;
  workerKey: string;
  queueKey?: string | null;
  collection?: string | null;
  sourceRef?: string | null;
  title: string;
  detail: string;
  severity: "operational";
};

export type AutomationSnapshotDoc = {
  id: string;
  data: Record<string, unknown>;
};

export type AutomationQueueSnapshotDoc = AutomationSnapshotDoc & {
  collection: string;
};

export type AutomationQueueMonitor = {
  collection: string;
  workerKey: string;
  queueKey: string;
  statusPath?: string;
  queueKeyPaths?: string[];
  staleStatuses?: string[];
  queuedAtPaths?: string[];
  progressAtPaths?: string[];
};

export type AutomationQueueThresholds = {
  staleQueueMs?: number;
  noProgressMs?: number;
  minBacklogCount?: number;
};

export const DEFAULT_AUTOMATION_QUEUE_THRESHOLDS = {
  staleQueueMs: 60 * 60 * 1000,
  noProgressMs: 30 * 60 * 1000,
  minBacklogCount: 1,
} satisfies Required<AutomationQueueThresholds>;

const DEFAULT_AUTOMATION_QUEUE_MONITORS: AutomationQueueMonitor[] = [
  {
    collection: "inboundRequests",
    workerKey: "inbound_qualification",
    queueKey: "inbound_request_review",
    statusPath: "ops_automation.status",
    queueKeyPaths: ["queue_key", "ops_automation.queue"],
    queuedAtPaths: ["createdAt", "created_at", "ops_automation.last_attempt_at"],
    progressAtPaths: ["ops_automation.processed_at"],
  },
  {
    collection: "inboundRequests",
    workerKey: "inbound_qualification",
    queueKey: "exact_site_hosted_review_queue",
    statusPath: "ops_automation.status",
    queueKeyPaths: ["queue_key", "ops_automation.queue"],
    queuedAtPaths: ["createdAt", "created_at", "ops_automation.last_attempt_at"],
    progressAtPaths: ["ops_automation.processed_at"],
  },
  {
    collection: "contactRequests",
    workerKey: "support_triage",
    queueKey: "support_triage",
    statusPath: "ops_automation.status",
    queueKeyPaths: ["ops_automation.queue", "queue"],
    queuedAtPaths: ["createdAt", "created_at", "ops_automation.last_attempt_at"],
    progressAtPaths: ["ops_automation.processed_at"],
  },
];

type OpsWorkItemDoc = {
  stable_id: string;
  kind: OpsWorkItemKind;
  status: OpsWorkItemStatus;
  title: string;
  detail: string;
  severity: string;
  suggested_owner: string;
  source?: string | null;
  repo?: string | null;
  project?: string | null;
  failure_family?: string | null;
  source_ref?: string | null;
  detected_at: string;
  updated_at: unknown;
  last_escalation_at: string | null;
  escalation_level: number;
  delegation: {
    slack_notified_at: string | null;
    webhook_posted_at: string | null;
  };
  completion: {
    completed_at: string | null;
    reason: string | null;
  };
};

const FIRST_ESCALATION_HOURS = 24;
const ESCALATION_MULTIPLIER = 2;
const MAX_ESCALATION_LEVEL = 5;

function suggestedOwnerForFinding(
  kind: OpsWorkItemKind,
  source?: string | null,
  repo?: string | null,
): string {
  if (kind === "automation_queue") {
    return "ops-lead";
  }
  const normalizedRepo = String(repo || "").toLowerCase();
  if (normalizedRepo.includes("capture")) {
    return "capture-codex";
  }
  if (normalizedRepo.includes("pipeline")) {
    return "pipeline-codex";
  }
  if (normalizedRepo.includes("webapp")) {
    return "webapp-codex";
  }
  if (kind === "external") {
    const lane = String(source || "").toLowerCase();
    if (lane.includes("eng") || lane.includes("code") || lane.includes("ci")) {
      return "blueprint-cto";
    }
    if (lane.includes("growth") || lane.includes("marketing")) {
      return "growth-lead";
    }
    if (lane.includes("ops") || lane.includes("buyer") || lane.includes("capturer")) {
      return "ops-lead";
    }
  }
  return "blueprint-chief-of-staff";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function getPathValue(data: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((current, part) => {
    const record = asRecord(current);
    return record ? record[part] : undefined;
  }, data);
}

function firstStringAtPath(data: Record<string, unknown>, paths: string[]): string | null {
  for (const path of paths) {
    const value = getPathValue(data, path);
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function timestampToMillis(value: unknown): number | null {
  if (value instanceof Date) {
    const millis = value.getTime();
    return Number.isFinite(millis) ? millis : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const millis = Date.parse(value);
    return Number.isFinite(millis) ? millis : null;
  }
  const record = asRecord(value);
  if (!record) {
    return null;
  }
  if (typeof record.toMillis === "function") {
    const millis = record.toMillis();
    return typeof millis === "number" && Number.isFinite(millis) ? millis : null;
  }
  if (typeof record.toDate === "function") {
    return timestampToMillis(record.toDate());
  }
  const seconds =
    typeof record.seconds === "number"
      ? record.seconds
      : typeof record._seconds === "number"
        ? record._seconds
        : null;
  if (seconds !== null) {
    const nanos =
      typeof record.nanoseconds === "number"
        ? record.nanoseconds
        : typeof record._nanoseconds === "number"
          ? record._nanoseconds
          : 0;
    return seconds * 1000 + Math.floor(nanos / 1_000_000);
  }
  return null;
}

function firstTimestampAtPath(data: Record<string, unknown>, paths: string[]): number | null {
  for (const path of paths) {
    const millis = timestampToMillis(getPathValue(data, path));
    if (millis !== null) {
      return millis;
    }
  }
  return null;
}

function clampPositiveNumber(value: unknown, fallback: number): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : fallback;
}

function formatDuration(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.round((minutes / 60) * 10) / 10;
  return `${hours}h`;
}

function normalizeThresholds(
  thresholds?: AutomationQueueThresholds,
): Required<AutomationQueueThresholds> {
  return {
    staleQueueMs: clampPositiveNumber(
      thresholds?.staleQueueMs,
      DEFAULT_AUTOMATION_QUEUE_THRESHOLDS.staleQueueMs,
    ),
    noProgressMs: clampPositiveNumber(
      thresholds?.noProgressMs,
      DEFAULT_AUTOMATION_QUEUE_THRESHOLDS.noProgressMs,
    ),
    minBacklogCount: Math.max(
      1,
      Math.floor(
        clampPositiveNumber(
          thresholds?.minBacklogCount,
          DEFAULT_AUTOMATION_QUEUE_THRESHOLDS.minBacklogCount,
        ),
      ),
    ),
  };
}

function thresholdsFromEnv(): Required<AutomationQueueThresholds> {
  return normalizeThresholds({
    staleQueueMs:
      process.env.BLUEPRINT_STUCK_QUEUE_STALE_MS !== undefined
        ? Number(process.env.BLUEPRINT_STUCK_QUEUE_STALE_MS)
        : undefined,
    noProgressMs:
      process.env.BLUEPRINT_STUCK_QUEUE_NO_PROGRESS_MS !== undefined
        ? Number(process.env.BLUEPRINT_STUCK_QUEUE_NO_PROGRESS_MS)
        : undefined,
    minBacklogCount:
      process.env.BLUEPRINT_STUCK_QUEUE_MIN_BACKLOG !== undefined
        ? Number(process.env.BLUEPRINT_STUCK_QUEUE_MIN_BACKLOG)
        : undefined,
  });
}

function humanizeWorkerKey(value: string): string {
  return value.replace(/_/g, " ");
}

function humanizeQueueKey(value: string): string {
  return value.replace(/_/g, " ");
}

export function listAutomationWorkerFindingsFromSnapshots(params: {
  now?: Date | string | number;
  workerStatusDocs: AutomationSnapshotDoc[];
  queueDocs?: AutomationQueueSnapshotDoc[];
  queueMonitors?: AutomationQueueMonitor[];
  thresholds?: AutomationQueueThresholds;
}): AutomationWorkerGapFinding[] {
  const nowMs = timestampToMillis(params.now ?? new Date()) ?? Date.now();
  const thresholds = normalizeThresholds(params.thresholds);
  const findings: AutomationWorkerGapFinding[] = [];
  const workerDataByKey = new Map<string, Record<string, unknown>>();

  for (const doc of params.workerStatusDocs) {
    const data = doc.data || {};
    workerDataByKey.set(doc.id, data);
    const status = typeof data.status === "string" ? data.status : "";
    const lastError = typeof data.last_error === "string" ? data.last_error.trim() : "";
    if (status === "failed" || lastError) {
      findings.push({
        stableId: `automation_worker:${doc.id}`,
        kind: "automation_worker",
        findingType: "worker_failure",
        workerKey: doc.id,
        title: `Automation worker failure: ${humanizeWorkerKey(doc.id)}`,
        detail: lastError || `Worker status is "${status || "unknown"}".`,
        severity: "operational",
      });
    }
  }

  const queueDocs = params.queueDocs ?? [];
  const monitors = params.queueMonitors ?? DEFAULT_AUTOMATION_QUEUE_MONITORS;
  for (const monitor of monitors) {
    const statusPath = monitor.statusPath ?? "ops_automation.status";
    const staleStatuses = new Set(monitor.staleStatuses ?? ["pending", "failed"]);
    const queueKeyPaths = monitor.queueKeyPaths ?? ["ops_automation.queue", "queue", "queue_key"];
    const queuedAtPaths = monitor.queuedAtPaths ?? [
      "createdAt",
      "created_at",
      "ops_automation.last_attempt_at",
    ];
    const progressAtPaths = monitor.progressAtPaths ?? ["ops_automation.processed_at"];
    const backlog = queueDocs
      .filter((doc) => doc.collection === monitor.collection)
      .map((doc) => {
        const queueKey = firstStringAtPath(doc.data, queueKeyPaths);
        const status = firstStringAtPath(doc.data, [statusPath]);
        const queuedAtMs = firstTimestampAtPath(doc.data, queuedAtPaths);
        const progressAtMs = firstTimestampAtPath(doc.data, progressAtPaths);
        return {
          id: doc.id,
          queueKey,
          status,
          queuedAtMs,
          progressAtMs,
        };
      })
      .filter((doc) => doc.queueKey === monitor.queueKey)
      .filter((doc) => !doc.status || staleStatuses.has(doc.status))
      .filter((doc) => doc.queuedAtMs !== null)
      .filter((doc) => doc.progressAtMs === null || doc.progressAtMs < doc.queuedAtMs!);

    if (backlog.length < thresholds.minBacklogCount) {
      continue;
    }

    backlog.sort((left, right) => left.queuedAtMs! - right.queuedAtMs!);
    const oldest = backlog[0];
    const oldestAgeMs = nowMs - oldest.queuedAtMs!;
    if (oldestAgeMs < thresholds.staleQueueMs) {
      continue;
    }

    const workerData = workerDataByKey.get(monitor.workerKey) || {};
    const lastCompletedAtMs = firstTimestampAtPath(workerData, [
      "last_run_completed_at_iso",
      "last_run_completed_at",
    ]);
    const lastStartedAtMs = firstTimestampAtPath(workerData, [
      "last_run_started_at_iso",
      "last_run_started_at",
    ]);
    const lastProcessedCount =
      typeof workerData.last_processed_count === "number"
        ? workerData.last_processed_count
        : null;
    const lastProgressAtMs =
      lastProcessedCount !== null && lastProcessedCount > 0 ? lastCompletedAtMs : null;
    if (lastProgressAtMs !== null && nowMs - lastProgressAtMs < thresholds.noProgressMs) {
      continue;
    }
    const noProgressAnchor = lastProgressAtMs ?? lastCompletedAtMs ?? lastStartedAtMs;
    const noProgressAgeMs = noProgressAnchor === null ? oldestAgeMs : nowMs - noProgressAnchor;
    if (noProgressAgeMs < thresholds.noProgressMs) {
      continue;
    }

    findings.push({
      stableId: `automation_queue:${monitor.collection}:${monitor.queueKey}`,
      kind: "automation_queue",
      findingType: "stuck_queue",
      workerKey: monitor.workerKey,
      queueKey: monitor.queueKey,
      collection: monitor.collection,
      sourceRef: `${monitor.collection}/${oldest.id}`,
      title: `Stuck automation queue: ${humanizeQueueKey(monitor.queueKey)}`,
      detail: [
        `Queue "${monitor.queueKey}" in ${monitor.collection} has ${backlog.length} pending or failed item(s).`,
        `Oldest item "${oldest.id}" has waited ${formatDuration(oldestAgeMs)} since ${new Date(oldest.queuedAtMs!).toISOString()}.`,
        `Worker "${monitor.workerKey}" shows no progress for ${formatDuration(noProgressAgeMs)}; last processed count is ${lastProcessedCount ?? "unknown"}.`,
        `Thresholds: stale queue ${formatDuration(thresholds.staleQueueMs)}, no progress ${formatDuration(thresholds.noProgressMs)}, minimum backlog ${thresholds.minBacklogCount}.`,
      ].join(" "),
      severity: "operational",
    });
  }

  return findings;
}

export async function listAutomationWorkerFindings(): Promise<AutomationWorkerGapFinding[]> {
  if (!db) {
    return [];
  }

  const snap = await db.collection("opsAutomationWorkerStatus").limit(250).get();
  const queueDocs = new Map<string, AutomationQueueSnapshotDoc>();

  for (const monitor of DEFAULT_AUTOMATION_QUEUE_MONITORS) {
    try {
      const querySnap = await db
        .collection(monitor.collection)
        .where(
          monitor.statusPath ?? "ops_automation.status",
          "in",
          monitor.staleStatuses ?? ["pending", "failed"],
        )
        .limit(250)
        .get();
      for (const doc of querySnap.docs) {
        queueDocs.set(`${monitor.collection}:${doc.id}`, {
          collection: monitor.collection,
          id: doc.id,
          data: doc.data() as Record<string, unknown>,
        });
      }
    } catch (err) {
      logger.warn(
        { err, collection: monitor.collection, queueKey: monitor.queueKey },
        "automation stuck-queue snapshot failed",
      );
    }
  }

  return listAutomationWorkerFindingsFromSnapshots({
    workerStatusDocs: snap.docs.map((doc) => ({
      id: doc.id,
      data: doc.data() as Record<string, unknown>,
    })),
    queueDocs: [...queueDocs.values()],
    thresholds: thresholdsFromEnv(),
  });
}

function hoursBetween(isoA: string, isoB: string): number {
  return (Date.parse(isoB) - Date.parse(isoA)) / 3_600_000;
}

async function postDelegationWebhook(payload: Record<string, unknown>) {
  const url = String(process.env.BLUEPRINT_GAP_DELEGATION_WEBHOOK_URL || "").trim();
  if (!url) {
    return;
  }
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "gap.delegated", ...payload }),
      signal: AbortSignal.timeout(8000),
    });
  } catch (err) {
    logger.warn({ err }, "gap-closure delegation webhook failed");
  }
}

async function notifyNewGap(item: OpsWorkItemDoc) {
  const lines = [
    ":clipboard: *Gap registry — new item (delegated)*",
    `*${item.title}*`,
    item.detail.slice(0, 1500) + (item.detail.length > 1500 ? "…" : ""),
    `Suggested Paperclip owner: \`${item.suggested_owner}\``,
    `Stable id: \`${item.stable_id}\``,
  ];
  await sendSlackMessage(lines.join("\n"));
  await postDelegationWebhook({
    stable_id: item.stable_id,
    kind: item.kind,
    title: item.title,
    detail: item.detail,
    severity: item.severity,
    suggested_owner: item.suggested_owner,
  });
}

async function notifyEscalation(item: OpsWorkItemDoc, level: number) {
  const lines = [
    ":warning: *Gap registry — escalation*",
    `Level ${level} · *${item.title}*`,
    `Stable id: \`${item.stable_id}\``,
    `Owner hint: \`${item.suggested_owner}\``,
  ];
  await sendSlackMessage(lines.join("\n"));
  await postDelegationWebhook({
    event: "gap.escalated",
    stable_id: item.stable_id,
    escalation_level: level,
    title: item.title,
    suggested_owner: item.suggested_owner,
  });
}

function buildWorkItemPayload(params: {
  stableId: string;
  kind: OpsWorkItemKind;
  title: string;
  detail: string;
  severity: string;
  source?: string | null;
  repo?: string | null;
  project?: string | null;
  failureFamily?: string | null;
  sourceRef?: string | null;
  previous: DocumentSnapshot | null;
}): { doc: OpsWorkItemDoc; shouldDelegate: boolean; shouldReopen: boolean } {
  const now = new Date().toISOString();
  const suggested_owner = suggestedOwnerForFinding(
    params.kind,
    params.source,
    params.repo,
  );
  const prev = params.previous?.exists ? (params.previous.data() as OpsWorkItemDoc) : null;
  const wasCompleted = prev?.status === "completed";
  const shouldReopen = Boolean(wasCompleted);
  const alreadyNotified = Boolean(prev?.delegation?.slack_notified_at);

  const shouldDelegate = !prev || shouldReopen || !alreadyNotified;

  const doc: OpsWorkItemDoc = {
    stable_id: params.stableId,
    kind: params.kind,
    status: "delegated",
    title: params.title,
    detail: params.detail,
    severity: params.severity,
    source: params.source ?? null,
    repo: params.repo ?? prev?.repo ?? null,
    project: params.project ?? prev?.project ?? null,
    failure_family: params.failureFamily ?? prev?.failure_family ?? null,
    source_ref: params.sourceRef ?? prev?.source_ref ?? null,
    suggested_owner,
    detected_at: prev?.detected_at && !shouldReopen ? prev.detected_at : now,
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
    last_escalation_at: shouldReopen ? null : prev?.last_escalation_at ?? null,
    escalation_level: shouldReopen ? 0 : prev?.escalation_level ?? 0,
    delegation: {
      slack_notified_at: shouldDelegate ? now : (prev?.delegation?.slack_notified_at ?? null),
      webhook_posted_at: shouldDelegate ? now : (prev?.delegation?.webhook_posted_at ?? null),
    },
    completion: {
      completed_at: null,
      reason: null,
    },
  };

  return { doc, shouldDelegate, shouldReopen };
}

async function persistAndMaybeDelegate(
  ref: DocumentReference,
  payload: OpsWorkItemDoc,
  shouldDelegate: boolean,
) {
  await ref.set(payload, { merge: false });
  if (shouldDelegate) {
    await notifyNewGap(payload);
  }
}

async function markCompleted(
  ref: DocumentReference,
  reason: string,
  prior: OpsWorkItemDoc,
) {
  const now = new Date().toISOString();
  await ref.set(
    {
      status: "completed" as const,
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
      completion: {
        completed_at: now,
        reason,
      },
    },
    { merge: true },
  );
  await sendSlackMessage(
    [
      ":white_check_mark: *Gap registry — auto-resolved*",
      `*${prior.title}*`,
      `Stable id: \`${prior.stable_id}\``,
      `Reason: ${reason}`,
    ].join("\n"),
  );
}

async function maybeEscalate(ref: DocumentReference, doc: OpsWorkItemDoc) {
  if (doc.status === "completed") {
    return;
  }
  const level = doc.escalation_level ?? 0;
  if (level >= MAX_ESCALATION_LEVEL) {
    return;
  }
  const now = new Date().toISOString();
  const thresholdHours = FIRST_ESCALATION_HOURS * ESCALATION_MULTIPLIER ** level;
  const anchor =
    doc.last_escalation_at
    || doc.delegation?.slack_notified_at
    || doc.detected_at;
  if (!anchor) {
    return;
  }
  if (hoursBetween(anchor, now) < thresholdHours) {
    return;
  }

  const nextLevel = level + 1;
  await ref.set(
    {
      escalation_level: nextLevel,
      last_escalation_at: now,
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  await notifyEscalation({ ...doc, escalation_level: nextLevel, last_escalation_at: now }, nextLevel);
}

/**
 * Detects launch-readiness blockers, automation worker failures, and merges external reports;
 * upserts Firestore work items; delegates via Slack + optional webhook; escalates stale items;
 * auto-completes readiness/worker items when underlying signals recover.
 *
 * This is the operational "closure loop" — it does not prove humans finished work, only that
 * automated detectors no longer see the failure and that routing/escalation happened.
 */
export async function runGapClosureLoop(params?: { limit?: number }): Promise<{
  processedCount: number;
  failedCount: number;
  activeFindingCount: number;
}> {
  if (!db) {
    throw new Error("Database not available");
  }

  const limit = Math.max(1, Math.min(params?.limit ?? 100, 500));
  let processedCount = 0;
  let failedCount = 0;

  try {
    const snapshot = buildLaunchReadinessSnapshot();
    const readinessFindings = listActiveReadinessFindings(snapshot);
    const workerFindings = await listAutomationWorkerFindings();

    const activeIds = new Set<string>();
    for (const f of readinessFindings) {
      activeIds.add(f.stableId);
    }
    for (const f of workerFindings) {
      activeIds.add(f.stableId);
    }

    for (const f of readinessFindings.slice(0, limit)) {
      try {
        const ref = db.collection(COLLECTION).doc(f.stableId);
        const prev = await ref.get();
        const { doc, shouldDelegate } = buildWorkItemPayload({
          stableId: f.stableId,
          kind: "readiness",
          title: f.title,
          detail: f.detail,
          severity: f.severity,
          previous: prev,
        });
        await persistAndMaybeDelegate(ref, doc, shouldDelegate);
        processedCount += 1;
        await maybeEscalate(ref, doc);
      } catch (err) {
        failedCount += 1;
        logger.error({ err, stableId: f.stableId }, "gap-closure readiness item failed");
      }
    }

    for (const f of workerFindings.slice(0, limit)) {
      try {
        const ref = db.collection(COLLECTION).doc(f.stableId);
        const prev = await ref.get();
        const { doc, shouldDelegate } = buildWorkItemPayload({
          stableId: f.stableId,
          kind: f.kind,
          title: f.title,
          detail: f.detail,
          severity: f.severity,
          source: f.findingType,
          failureFamily: f.findingType,
          sourceRef: f.sourceRef,
          previous: prev,
        });
        await persistAndMaybeDelegate(ref, doc, shouldDelegate);
        processedCount += 1;
        await maybeEscalate(ref, doc);
      } catch (err) {
        failedCount += 1;
        logger.error({ err, stableId: f.stableId }, "gap-closure worker item failed");
      }
    }

    const openSnap = await db
      .collection(COLLECTION)
      .where("status", "in", ["open", "delegated"])
      .limit(500)
      .get();

    for (const docSnap of openSnap.docs) {
      try {
        const data = docSnap.data() as OpsWorkItemDoc;
        const kind = data.kind;
        const sid = data.stable_id || docSnap.id;

        if (
          kind === "readiness"
          || kind === "automation_worker"
          || kind === "automation_queue"
        ) {
          if (!activeIds.has(sid)) {
            await markCompleted(docSnap.ref, "underlying_signal_cleared", data);
            processedCount += 1;
            continue;
          }
        }

        if (data.status !== "completed") {
          await maybeEscalate(docSnap.ref, data);
        }
        processedCount += 1;
      } catch (err) {
        failedCount += 1;
        logger.error({ err, id: docSnap.id }, "gap-closure open-item sweep failed");
      }
    }

    return {
      processedCount,
      failedCount,
      activeFindingCount: activeIds.size,
    };
  } catch (err) {
    logger.error({ err }, "gap-closure loop failed");
    throw err;
  }
}

export function stableIdForExternalReport(params: {
  stable_id?: string | null;
  source: string;
  title: string;
  detail?: string | null;
  repo?: string | null;
  failure_family?: string | null;
}): string {
  const explicit = String(params.stable_id || "").trim();
  if (explicit) {
    return explicit.slice(0, 400);
  }
  const h = crypto
    .createHash("sha256")
    .update(
      [
        params.repo || "",
        params.failure_family || "",
        params.source.trim(),
        params.title.trim(),
        String(params.detail || "").trim(),
      ].join("|"),
    )
    .digest("hex")
    .slice(0, 24);
  return `external:${h}`;
}

export async function recordExternalGapReport(params: {
  source: string;
  title: string;
  detail?: string | null;
  severity?: "info" | "warn" | "blocker";
  suggested_owner?: string | null;
  stable_id?: string | null;
  repo?: "Blueprint-WebApp" | "BlueprintCapture" | "BlueprintPipeline";
  project?: string | null;
  failure_family?: string | null;
  source_ref?: string | null;
}): Promise<{ stable_id: string; is_new: boolean }> {
  if (!db) {
    throw new Error("Database not available");
  }

  const stable_id = stableIdForExternalReport({
    stable_id: params.stable_id,
    source: params.source,
    title: params.title,
    detail: params.detail,
    repo: params.repo,
    failure_family: params.failure_family,
  });
  const ref = db.collection(COLLECTION).doc(stable_id);
  const prev = await ref.get();
  const is_new = !prev.exists;
  const severity = params.severity ?? "warn";
  const title = params.title.trim();
  const detail = String(params.detail || "").trim() || "(no detail)";
  const suggested_owner =
    String(params.suggested_owner || "").trim()
    || suggestedOwnerForFinding("external", params.source, params.repo);

  const now = new Date().toISOString();
  const { doc, shouldDelegate } = buildWorkItemPayload({
    stableId: stable_id,
    kind: "external",
    title,
    detail,
    severity,
    source: params.source,
    repo: params.repo,
    project: params.project,
    failureFamily: params.failure_family,
    sourceRef: params.source_ref,
    previous: prev,
  });
  doc.suggested_owner = suggested_owner;

  await persistAndMaybeDelegate(ref, doc, shouldDelegate);
  return { stable_id, is_new };
}

export async function resolveExternalGapReport(stableId: string): Promise<boolean> {
  if (!db) {
    throw new Error("Database not available");
  }
  const ref = db.collection(COLLECTION).doc(stableId);
  const snap = await ref.get();
  if (!snap.exists) {
    return false;
  }
  const data = snap.data() as OpsWorkItemDoc;
  if (data.kind !== "external") {
    return false;
  }
  await markCompleted(ref, "external_resolve_api", data);
  return true;
}
