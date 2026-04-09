import crypto from "node:crypto";

import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import type { RuntimeEventRecord, RuntimeEventStatus } from "./types";

const RUNTIME_EVENT_COLLECTION = "agentRuntimeEvents";

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

export async function recordRuntimeEvent(params: {
  id?: string;
  session_id: string;
  run_id?: string | null;
  checkpoint_id?: string | null;
  kind: string;
  status?: RuntimeEventStatus;
  summary: string;
  detail?: string | null;
  metadata?: Record<string, unknown>;
}) {
  if (!db) {
    return null;
  }

  const record: RuntimeEventRecord = {
    id: params.id || crypto.randomUUID(),
    session_id: params.session_id,
    run_id: params.run_id || null,
    checkpoint_id: params.checkpoint_id || null,
    kind: params.kind,
    status: params.status || "info",
    summary: params.summary,
    detail: params.detail || null,
    metadata: params.metadata || {},
    created_at: nowTimestamp(),
  };

  try {
    await db.collection(RUNTIME_EVENT_COLLECTION).doc(record.id).set(stripUndefinedDeep(record));
  } catch (error) {
    logger.warn(
      {
        err: error,
        sessionId: record.session_id,
        runId: record.run_id,
        kind: record.kind,
      },
      "Failed to persist runtime event",
    );
    return null;
  }

  return record;
}

export async function listRuntimeEvents(params: {
  sessionId?: string | null;
  runId?: string | null;
  limit?: number;
}) {
  if (!db) {
    return [];
  }

  let query: FirebaseFirestore.Query = db.collection(RUNTIME_EVENT_COLLECTION);
  if (params.sessionId) {
    query = query.where("session_id", "==", params.sessionId);
  }
  if (params.runId) {
    query = query.where("run_id", "==", params.runId);
  }

  const snapshot = await query
    .orderBy("created_at", "desc")
    .limit(Math.max(1, Math.min(params.limit ?? 200, 400)))
    .get();

  return snapshot.docs.map((doc) => doc.data() as RuntimeEventRecord);
}
