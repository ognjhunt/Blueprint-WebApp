import crypto from "crypto";

import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";

export function cacheKey(blueprintId: string, question: string) {
  const normalized = question.trim().toLowerCase().replace(/\s+/g, " ");
  const hash = crypto.createHash("sha1").update(normalized).digest("hex").slice(0, 24);
  return `${blueprintId}:${hash}`;
}

export async function getCachedAnswer(key: string) {
  if (!db) {
    return null;
  }

  try {
    const snapshot = await db.collection("answer_cache").doc(key).get();
    if (!snapshot.exists) {
      return null;
    }

    const data = snapshot.data();
    if (!data) {
      return null;
    }

    const expiresAt = data.expiresAt as admin.firestore.Timestamp | Date | number | undefined;
    if (expiresAt) {
      const expiryTime =
        expiresAt instanceof Date
          ? expiresAt.getTime()
          : typeof expiresAt === "number"
            ? expiresAt
            : expiresAt.toMillis();
      if (Date.now() > expiryTime) {
        void db.collection("answer_cache").doc(key).delete().catch(() => undefined);
        return null;
      }
    }

    return data.payload ?? null;
  } catch (error) {
    logger.warn({ key, err: error }, "Failed to read answer cache entry");
    return null;
  }
}

export async function putCachedAnswer(key: string, payload: unknown, ttlMinutes = 1440) {
  if (!db) {
    return;
  }

  const expiresAt = new Date(Date.now() + Math.max(1, ttlMinutes) * 60_000);

  try {
    await db.collection("answer_cache").doc(key).set(
      {
        payload,
        expiresAt,
        createdAt: admin?.firestore?.FieldValue?.serverTimestamp?.() ?? new Date(),
        updatedAt: admin?.firestore?.FieldValue?.serverTimestamp?.() ?? new Date(),
      },
      { merge: true },
    );
  } catch (error) {
    logger.warn({ key, err: error }, "Failed to store answer cache entry");
  }
}
