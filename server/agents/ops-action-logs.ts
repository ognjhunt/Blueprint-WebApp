import crypto from "node:crypto";

import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import type { PersistedOpsActionLog } from "./types";

const ACTION_LOG_COLLECTION = "opsActionLogs";

function nowTimestamp() {
  return admin.firestore.FieldValue.serverTimestamp();
}

function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .filter((entry) => entry !== undefined)
      .map((entry) => stripUndefinedDeep(entry)) as T;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .map(([key, entry]) => [key, stripUndefinedDeep(entry)]),
    ) as T;
  }

  return value;
}

export async function recordOpsActionLog(
  params: Omit<PersistedOpsActionLog, "id" | "created_at"> & { id?: string },
) {
  if (!db) {
    return null;
  }

  const record: PersistedOpsActionLog = {
    id: params.id || crypto.randomUUID(),
    session_id: params.session_id || null,
    run_id: params.run_id || null,
    session_key: params.session_key || null,
    action_key: params.action_key,
    status: params.status,
    summary: params.summary || null,
    provider: params.provider || null,
    runtime: params.runtime || null,
    task_kind: params.task_kind || null,
    risk_level: params.risk_level,
    reversible: params.reversible,
    requires_approval: params.requires_approval,
    latency_ms: params.latency_ms ?? null,
    metadata: params.metadata || {},
    created_at: nowTimestamp(),
  };

  try {
    await db.collection(ACTION_LOG_COLLECTION).doc(record.id).set(stripUndefinedDeep(record));
  } catch (error) {
    logger.warn(
      {
        err: error,
        actionKey: record.action_key,
        sessionId: record.session_id,
        runId: record.run_id,
      },
      "Failed to persist ops action log",
    );
    return null;
  }

  return record;
}

export async function listOpsActionLogs(params?: {
  sessionId?: string | null;
  runId?: string | null;
  limit?: number;
}) {
  if (!db) {
    return [];
  }

  let query: FirebaseFirestore.Query = db.collection(ACTION_LOG_COLLECTION);

  if (params?.sessionId) {
    query = query.where("session_id", "==", params.sessionId);
  }

  if (params?.runId) {
    query = query.where("run_id", "==", params.runId);
  }

  const snapshot = await query
    .orderBy("created_at", "desc")
    .limit(Math.max(1, Math.min(params?.limit ?? 100, 200)))
    .get();

  return snapshot.docs.map((doc) => doc.data() as PersistedOpsActionLog);
}
