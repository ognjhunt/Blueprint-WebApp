/** Durable, deduplicated notices for observed task milestones. */
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { captureUploadUrlFor } from "./captureUploadToken";
import { enqueueOutbox, CAPTURE_OUTBOX_COLLECTION, type OutboxKind } from "./captureOutbox";
import { decryptFieldValue } from "./field-encryption";

export type TaskLifecycleMilestone = Extract<
  OutboxKind,
  "video_received" | "scene_ready" | "screening_started"
>;

/** A ready label without viewable assets is not a scene-ready milestone. */
export function reconstructionIsViewable(record: {
  state?: string | null;
  worldId?: string | null;
  assets?: {
    launchUrl?: string | null;
    panoUrl?: string | null;
    thumbnailUrl?: string | null;
    spzUrlsByDetail?: Record<string, string> | null;
  } | null;
}): boolean {
  if (record.state !== "ready" || !record.worldId || !record.assets) return false;
  return [record.assets.launchUrl, record.assets.panoUrl].some(value => {
    if (!value) return false;
    try {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password;
    } catch { return false; }
  });
}

const copy: Record<TaskLifecycleMilestone, { subject: string; body: (url: string) => string }> = {
  video_received: {
    subject: "We received your Blueprint walkthrough",
    body: (url) => `Your walkthrough is stored. We are reviewing privacy and coverage before deriving a scene; this message does not mean that review has cleared.\n\nFollow the task here:\n${url}`,
  },
  scene_ready: {
    subject: "Your Blueprint scene is ready to view",
    body: (url) => `The reconstructed scene is persisted and ready to view on your task page.\n\nOpen your task:\n${url}`,
  },
  screening_started: {
    subject: "Your task was picked up for robot evaluation",
    body: (url) => `The Pipeline picked up a robot evaluation for your scene. This confirms worker pickup, not an observed episode or result; the task page will show observed evidence when it is reported.\n\nOpen your task:\n${url}`,
  },
};

/**
 * Resolve the owner from the authoritative encrypted request and enqueue one
 * message per request and milestone. Calling this again repairs a missed
 * enqueue while the outbox document id prevents a duplicate delivery intent.
 */
export async function enqueueTaskLifecycleNotification(params: {
  requestId: string;
  milestone: TaskLifecycleMilestone;
}): Promise<{ enqueued: boolean; reason?: "store_unavailable" | "request_missing" | "contact_missing" }> {
  if (!db) return { enqueued: false, reason: "store_unavailable" };
  const requestId = params.requestId.trim();
  const snapshot = await db.collection("inboundRequests").doc(requestId).get();
  if (!snapshot.exists) return { enqueued: false, reason: "request_missing" };
  const to = String(await decryptFieldValue(snapshot.data()?.contact?.email ?? "")).trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return { enqueued: false, reason: "contact_missing" };
  }
  const message = copy[params.milestone];
  const url = captureUploadUrlFor(requestId, "owner");
  return enqueueOutbox({
    idempotencyKey: `${requestId}:${params.milestone}`,
    requestId,
    kind: params.milestone,
    to,
    subject: message.subject,
    body: message.body(url),
    replyTo: "ops@tryblueprint.io",
  });
}


/** Recover scene notices even when the controller stops polling a ready world. */
export async function reconcileSceneReadyNotifications(limit = 20): Promise<void> {
  if (!db) return;
  const pending = await db.collection("captureUploadSessions")
    .where("scene_notification_pending", "==", true).limit(limit).get();
  for (const session of pending.docs) {
    const record = session.data();
    const requestId = String(record.notification_request_id ?? "").trim();
    const world = record.world_reconstruction;
    if (!requestId || !reconstructionIsViewable({ ...world, worldId: world?.world_id })) continue;
    await enqueueTaskLifecycleNotification({ requestId, milestone: "scene_ready" });
    // enqueueOutbox reports a duplicate and a transient failure as false. Only
    // durable existence allows clearing the pending marker.
    const intent = await db.collection(CAPTURE_OUTBOX_COLLECTION).doc(`${requestId}:scene_ready`).get();
    if (intent.exists) await session.ref.set({ scene_notification_pending: false }, { merge: true });
  }
}
