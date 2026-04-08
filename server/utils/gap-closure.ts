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

export type OpsWorkItemKind = "readiness" | "automation_worker" | "external";
export type OpsWorkItemStatus = "open" | "delegated" | "completed";

export type AutomationWorkerGapFinding = {
  stableId: string;
  workerKey: string;
  title: string;
  detail: string;
  severity: "operational";
};

type OpsWorkItemDoc = {
  stable_id: string;
  kind: OpsWorkItemKind;
  status: OpsWorkItemStatus;
  title: string;
  detail: string;
  severity: string;
  suggested_owner: string;
  source?: string | null;
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
): string {
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

export async function listAutomationWorkerFindings(): Promise<AutomationWorkerGapFinding[]> {
  if (!db) {
    return [];
  }

  const snap = await db.collection("opsAutomationWorkerStatus").limit(250).get();
  const out: AutomationWorkerGapFinding[] = [];

  for (const doc of snap.docs) {
    const data = doc.data() as Record<string, unknown>;
    const status = typeof data.status === "string" ? data.status : "";
    const lastError = typeof data.last_error === "string" ? data.last_error.trim() : "";
    if (status === "failed" || lastError) {
      out.push({
        stableId: `automation_worker:${doc.id}`,
        workerKey: doc.id,
        title: `Automation worker failure: ${doc.id.replace(/_/g, " ")}`,
        detail: lastError || `Worker status is "${status || "unknown"}".`,
        severity: "operational",
      });
    }
  }

  return out;
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
  previous: DocumentSnapshot | null;
}): { doc: OpsWorkItemDoc; shouldDelegate: boolean; shouldReopen: boolean } {
  const now = new Date().toISOString();
  const suggested_owner = suggestedOwnerForFinding(params.kind, params.source);
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
          kind: "automation_worker",
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

        if (kind === "readiness" || kind === "automation_worker") {
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
}): string {
  const explicit = String(params.stable_id || "").trim();
  if (explicit) {
    return explicit.slice(0, 400);
  }
  const h = crypto
    .createHash("sha256")
    .update(
      `${params.source.trim()}|${params.title.trim()}|${String(params.detail || "").trim()}`,
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
}): Promise<{ stable_id: string; is_new: boolean }> {
  if (!db) {
    throw new Error("Database not available");
  }

  const stable_id = stableIdForExternalReport({
    stable_id: params.stable_id,
    source: params.source,
    title: params.title,
    detail: params.detail,
  });
  const ref = db.collection(COLLECTION).doc(stable_id);
  const prev = await ref.get();
  const is_new = !prev.exists;
  const severity = params.severity ?? "warn";
  const title = params.title.trim();
  const detail = String(params.detail || "").trim() || "(no detail)";
  const suggested_owner =
    String(params.suggested_owner || "").trim()
    || suggestedOwnerForFinding("external", params.source);

  const now = new Date().toISOString();
  const { doc, shouldDelegate } = buildWorkItemPayload({
    stableId: stable_id,
    kind: "external",
    title,
    detail,
    severity,
    source: params.source,
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
