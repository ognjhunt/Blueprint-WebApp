import { createHash } from "node:crypto";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import type { OutboxEntry } from "./captureOutbox";
import { decryptFieldValue } from "./field-encryption";
import { buildTaskLifecycleNotification } from "./taskLifecycleNotifications";

export function pilotRecommendationEventId(recommendationId: string, recipient: string): string {
  // Bind each authorized notification to both the recommendation and its
  // current recipient without putting contact details in a document name.
  return `${recommendationId}.${createHash("sha256").update(recipient.trim()).digest("hex")}`;
}

export function buildPilotRecommendationNotification(params: {
  requestId: string;
  recommendation: { id: string; teamName: string; purpose: string };
  to: string;
  captureUrl: string;
}) {
  return buildTaskLifecycleNotification({
    requestId: params.requestId,
    milestone: "pilot_recommended",
    eventId: pilotRecommendationEventId(params.recommendation.id, params.to),
    detail: `${params.recommendation.teamName}, to ${params.recommendation.purpose.replace(/[.\s]+$/, "")}`,
    to: params.to,
    captureUrl: params.captureUrl,
  });
}

/** Called inside the final dispatch transaction, before any writes. Source
 * errors propagate: inability to verify authority is never permission to send. */
export async function pilotRecommendationNotificationIsCurrent(
  entry: OutboxEntry,
  transaction: FirebaseFirestore.Transaction,
): Promise<boolean> {
  if (entry.kind !== "pilot_recommended") return true;
  if (!db) throw new Error("Recommendation notification store unavailable");
  const snapshot = await transaction.get(db.collection("inboundRequests").doc(entry.requestId));
  const record = snapshot.data();
  const recommendation = record?.pilot_recommendation;
  if (!snapshot.exists || record?.pilot_booking || typeof recommendation?.id !== "string") return false;
  const to = String(await decryptFieldValue(record?.contact?.email ?? "")).trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) || to !== entry.to) return false;
  const expectedKey = `${entry.requestId}:pilot_recommended:${pilotRecommendationEventId(recommendation.id, to)}`;
  // Legacy queued rows are accepted only if their exact current event and
  // recipient still match. No old event is upgraded into a new recommendation.
  return entry.idempotencyKey === expectedKey
    || entry.idempotencyKey === `${entry.requestId}:pilot_recommended:${recommendation.id}`;
}
