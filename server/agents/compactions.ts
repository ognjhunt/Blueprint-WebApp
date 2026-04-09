import crypto from "node:crypto";

import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import type { AgentCompactionRecord, AgentThreadPhase } from "./types";

const COMPACTION_COLLECTION = "agentCompactions";

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

export async function createAgentCompaction(params: {
  source_session_id: string;
  source_run_id?: string | null;
  target_session_id?: string | null;
  target_run_id?: string | null;
  phase?: AgentThreadPhase | null;
  reason: string;
  status?: "created" | "continued" | "failed";
  handoff_prompt: string;
  summary: string;
  metadata?: Record<string, unknown>;
}) {
  if (!db) {
    return null;
  }

  const record: AgentCompactionRecord = {
    id: crypto.randomUUID(),
    source_session_id: params.source_session_id,
    source_run_id: params.source_run_id || null,
    target_session_id: params.target_session_id || null,
    target_run_id: params.target_run_id || null,
    phase: params.phase || null,
    reason: params.reason,
    status: params.status || "created",
    handoff_prompt: params.handoff_prompt,
    summary: params.summary,
    metadata: params.metadata || {},
    created_at: nowTimestamp(),
    updated_at: nowTimestamp(),
  };

  try {
    await db.collection(COMPACTION_COLLECTION).doc(record.id).set(stripUndefinedDeep(record));
  } catch (error) {
    logger.warn(
      {
        err: error,
        sourceSessionId: record.source_session_id,
        sourceRunId: record.source_run_id,
      },
      "Failed to persist agent compaction record",
    );
    return null;
  }

  return record;
}

export async function updateAgentCompaction(
  compactionId: string,
  patch: Partial<AgentCompactionRecord>,
) {
  if (!db) {
    return null;
  }
  await db.collection(COMPACTION_COLLECTION).doc(compactionId).set(
    stripUndefinedDeep({
      ...patch,
      updated_at: nowTimestamp(),
    }),
    { merge: true },
  );
  const doc = await db.collection(COMPACTION_COLLECTION).doc(compactionId).get();
  return doc.exists ? (doc.data() as AgentCompactionRecord) : null;
}

export async function listAgentCompactions(params: {
  sessionId: string;
  limit?: number;
}) {
  if (!db) {
    return [];
  }
  const snapshot = await db
    .collection(COMPACTION_COLLECTION)
    .where("source_session_id", "==", params.sessionId)
    .orderBy("created_at", "desc")
    .limit(Math.max(1, Math.min(params.limit ?? 100, 200)))
    .get();
  return snapshot.docs.map((doc) => doc.data() as AgentCompactionRecord);
}

export async function getAgentCompaction(compactionId: string) {
  if (!db || !compactionId) {
    return null;
  }
  const doc = await db.collection(COMPACTION_COLLECTION).doc(compactionId).get();
  return doc.exists ? (doc.data() as AgentCompactionRecord) : null;
}
