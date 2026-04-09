import crypto from "node:crypto";

import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import type { AgentCheckpointRecord } from "./types";

const CHECKPOINT_COLLECTION = "agentCheckpoints";

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

export async function createAgentCheckpoint(params: {
  session_id: string;
  run_id?: string | null;
  session_key?: string | null;
  label: string;
  trigger: string;
  replayable?: boolean;
  snapshot: Record<string, unknown>;
}) {
  if (!db) {
    return null;
  }

  const record: AgentCheckpointRecord = {
    id: crypto.randomUUID(),
    session_id: params.session_id,
    run_id: params.run_id || null,
    session_key: params.session_key || null,
    label: params.label,
    trigger: params.trigger,
    replayable: params.replayable !== false,
    snapshot: params.snapshot,
    created_at: nowTimestamp(),
  };

  try {
    await db.collection(CHECKPOINT_COLLECTION).doc(record.id).set(stripUndefinedDeep(record));
  } catch (error) {
    logger.warn(
      {
        err: error,
        sessionId: record.session_id,
        runId: record.run_id,
        trigger: record.trigger,
      },
      "Failed to persist agent checkpoint",
    );
    return null;
  }

  return record;
}

export async function listAgentCheckpoints(params: {
  sessionId: string;
  limit?: number;
}) {
  if (!db) {
    return [];
  }

  const snapshot = await db
    .collection(CHECKPOINT_COLLECTION)
    .where("session_id", "==", params.sessionId)
    .orderBy("created_at", "desc")
    .limit(Math.max(1, Math.min(params.limit ?? 100, 200)))
    .get();

  return snapshot.docs.map((doc) => doc.data() as AgentCheckpointRecord);
}

export async function getAgentCheckpoint(checkpointId: string) {
  if (!db || !checkpointId) {
    return null;
  }

  const doc = await db.collection(CHECKPOINT_COLLECTION).doc(checkpointId).get();
  if (!doc.exists) {
    return null;
  }
  return doc.data() as AgentCheckpointRecord;
}
