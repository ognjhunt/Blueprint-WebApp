/**
 * Durable, deduplicated notices for every real event on a site's task.
 *
 * The site hears from us when something happens, not on a timer: its task
 * was received, its footage landed, its scene was built, its card went live,
 * a robot team picked it up, a result came in, a team asked about a pilot.
 * The scheduled check-in that used to fill the gaps between these is retired.
 * Per-run and per-request events carry an `eventId`, so each one is its own
 * email and a retry of the same event is not.
 */
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { captureUploadUrlFor } from "./captureUploadToken";
import { enqueueOutbox, CAPTURE_OUTBOX_COLLECTION, type OutboxKind } from "./captureOutbox";
import { decryptFieldValue } from "./field-encryption";
import { EMAIL_SIGN_OFF } from "./emailLayout";

export type TaskLifecycleMilestone = Extract<
  OutboxKind,
  | "task_received"
  | "video_received"
  | "scene_ready"
  | "listing_live"
  | "screening_cleared"
  | "screening_not_now"
  | "screening_started"
  | "results_ready"
  | "run_no_result"
  | "pilot_request"
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

const copy: Record<TaskLifecycleMilestone, { subject: string; body: (url: string, detail: string) => string }> = {
  task_received: {
    subject: "We have your Blueprint task — here is your link",
    body: (url) => `Thanks for sending us your task. This private link is where you film the work area on your phone, review the task brief, and follow everything that happens next. It opens your site's task without a password, so please don't forward it.\n\nOpen your task:\n${url}\n\nWe will email you each time something happens on your task.`,
  },
  video_received: {
    subject: "We received your Blueprint walkthrough",
    body: (url) => `Your walkthrough arrived safely. Next we check that it covers the work area and that nothing private is in view, then we build the scene. We will email you when that is done.\n\nOpen your task:\n${url}`,
  },
  scene_ready: {
    subject: "Your Blueprint scene is ready to view",
    body: (url) => `Your scene is ready: a 3D reconstruction of the work area you filmed. You can look around it on your task page.\n\nOpen your task:\n${url}`,
  },
  listing_live: {
    subject: "Your task card is in the robot-team library",
    body: (url) => `Robot teams on Blueprint can now see the task card you approved. It shows only the text and image you reviewed; your contact details, footage and scene stay private. You can hide it at any time from your Blueprint account: https://tryblueprint.io/app/tasks\n\nOpen your task:\n${url}`,
  },
  screening_cleared: {
    subject: "Your task cleared our screen",
    body: (url, detail) => `Thanks for the call. Your task now clears our screen, so we will build your scene from your recording${detail ? ` ${detail}` : ""}.\n\nOpen your task:\n${url}`,
  },
  screening_not_now: {
    subject: "An update on your Blueprint task",
    body: (url) => `Thanks for the call. One answer still means a robot evaluation would not hold up at your site today, so we are not building a scene yet. Your task page shows what is in the way. When it changes, edit your answers there and we will screen the task again.\n\nOpen your task:\n${url}`,
  },
  screening_started: {
    subject: "A robot team picked up your task",
    body: (url) => `A robot team has started an evaluation run against your scene. We will email you again when it reports a result.\n\nOpen your task:\n${url}`,
  },
  results_ready: {
    subject: "Results are in from a robot team",
    body: (url, detail) => `A robot team's evaluation run against your scene has finished${detail ? `: ${detail}` : ""}. This is a simulation result for one team's robot, not a physical test or a recommendation.\n\nSee it on your task page:\n${url}`,
  },
  run_no_result: {
    subject: "A robot team's run ended without a result",
    body: (url) => `A robot team's run against your scene ended before any episode was observed, so there is no result to show from it. Nothing is needed from you.\n\nOpen your task:\n${url}`,
  },
  pilot_request: {
    subject: "A robot team asked to evaluate your site for a pilot",
    body: (url) => `A robot team asked to evaluate your site for a pilot. Your details stay private. If you would like to talk to them, reply to this email and we will introduce you; if not, there is nothing to do.\n\nOpen your task:\n${url}`,
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
  /** Distinguishes repeated events of one kind: a run id, a request id. */
  eventId?: string;
  /** One clause of event detail for the body, e.g. "12 of 50 episodes succeeded". */
  detail?: string;
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
  const eventId = params.eventId?.trim().replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120);
  return enqueueOutbox({
    idempotencyKey: `${requestId}:${params.milestone}${eventId ? `:${eventId}` : ""}`,
    requestId,
    kind: params.milestone,
    to,
    subject: message.subject,
    body: `${message.body(url, params.detail?.trim() ?? "")}\n\n${EMAIL_SIGN_OFF}`,
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
