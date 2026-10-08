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
import { taskLifecycleNotificationIsCurrent } from "./taskLifecycleNotificationAuthority";
import { drainPendingWebsitePreparationNotifications } from "./websitePreparationStatus";

export type TaskLifecycleMilestone = Extract<
  OutboxKind,
  | "task_received"
  | "video_received"
  | "scene_ready"
  | "preparation_needs_attention"
  | "listing_live"
  | "screening_cleared"
  | "screening_not_now"
  | "screening_started"
  | "results_ready"
  | "run_no_result"
  | "pilot_request"
  | "pilot_recommended"
  | "pilot_booked"
  | "pilot_scheduled"
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
  preparation_needs_attention: {
    subject: "An update on your Blueprint job preparation",
    body: (url, detail) => `Job preparation needs our team's review. Keep your original recording. Open your job to see the latest status and next step.${detail ? ` ${detail}` : ""}\n\nOpen your job:\n${url}`,
  },
  task_received: {
    subject: "We have your Blueprint job — here is your link",
    body: (url) => `Thanks for sending us your job. This private link is where you review your job brief and follow everything that happens next. You can add footage later, once you have recording permission. It opens your site's job without a password, so please don't forward it.\n\nOpen your job:\n${url}\n\nWe will email you each time something happens on your job.`,
  },
  video_received: {
    subject: "We received your Blueprint walkthrough",
    body: (url) => `Your walkthrough arrived safely. Next we check that it covers the work area and that nothing private is in view, then we build the scene. We will email you when that is done.\n\nOpen your job:\n${url}`,
  },
  scene_ready: {
    subject: "Your Blueprint scene is ready to view",
    body: (url) => `Your scene is ready: a 3D reconstruction of the work area you filmed. You can look around it on your job page.\n\nOpen your job:\n${url}`,
  },
  listing_live: {
    subject: "Your job card is in the robot-team library",
    body: (url) => `Robot teams on Blueprint can now see the job card you approved. It shows only the text and image you reviewed; your contact details, footage and scene stay private. You can hide it at any time from your Blueprint account: https://tryblueprint.io/app/tasks\n\nOpen your job:\n${url}`,
  },
  screening_cleared: {
    subject: "Your job cleared our screen",
    body: (url, detail) => `Thanks for the call. Your job now clears our screen, so we will build your scene from your recording${detail ? ` ${detail}` : ""}.\n\nOpen your job:\n${url}`,
  },
  screening_not_now: {
    subject: "An update on your Blueprint job",
    body: (url) => `Thanks for the call. One answer still means a robot evaluation would not hold up at your site today, so we are not building a scene yet. Your job page shows what is in the way. When it changes, edit your answers there and we will screen the job again.\n\nOpen your job:\n${url}`,
  },
  screening_started: {
    subject: "A robot team picked up your job",
    body: (url) => `A robot team has started an evaluation run against your scene. We will email you again when it reports a result.\n\nOpen your job:\n${url}`,
  },
  results_ready: {
    subject: "Results are in from a robot team",
    body: (url, detail) => `A robot team's evaluation run against your scene has finished${detail ? `: ${detail}` : ""}. This is a simulation result for one team's robot, not a physical test or a recommendation.\n\nSee it on your job page:\n${url}`,
  },
  run_no_result: {
    subject: "A robot team's run ended without a result",
    body: (url) => `A robot team's run against your scene ended before any episode was observed, so there is no result to show from it. Nothing is needed from you.\n\nOpen your job:\n${url}`,
  },
  pilot_request: {
    subject: "A robot team asked to evaluate your site for a pilot",
    body: (url) => `A robot team asked to evaluate your site for a pilot. Your details stay private, and there is nothing for you to do. We review every team that shows interest and send you one recommended pilot when the evidence supports it.\n\nOpen your job:\n${url}`,
  },
  pilot_recommended: {
    subject: "Your recommended pilot is ready",
    body: (url, detail) => `We have one recommended pilot for your job${detail ? `: ${detail}` : ""}. Your job page shows the robot team, what the pilot tests, what you provide, the cost basis, proposed timing and what is still uncertain. If it looks right, accept the proposal there. Provider and site agreement, the date and preparation responsibilities still need coordination. If not, reply and tell us why.\n\nOpen your job:\n${url}`,
  },
  pilot_booked: {
    subject: "Your pilot proposal is accepted",
    body: (url, detail) => `Your acceptance is recorded. The pilot is awaiting coordination: provider and site agreement, a confirmed date and agreed preparation responsibilities are still needed. No date is reserved yet. Blueprint owns that next step. ${detail === "invited_beta_free" ? "Blueprint beta coordination is free. Provider costs remain subject to the applicable proposal and agreement." : "Your previously agreed Blueprint fee remains due when the pilot is booked."}\n\nOpen your job:\n${url}`,
  },
  pilot_scheduled: {
    subject: "Your pilot is scheduled",
    body: (url) => `The provider and site agreement, date and preparation responsibilities have been recorded and checked against the calendar. Open your job for the agreed date and responsibilities.\n\nOpen your job:\n${url}`,
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
  correlationId?: string;
}): Promise<{ enqueued: boolean; reason?: "store_unavailable" | "request_missing" | "contact_missing" | "consent_withdrawn" }> {
  if (!db) return { enqueued: false, reason: "store_unavailable" };
  const requestId = params.requestId.trim();
  const snapshot = await db.collection("inboundRequests").doc(requestId).get();
  if (!snapshot.exists) return { enqueued: false, reason: "request_missing" };
  // New private-link notices bind recipient admission as well as source.
  // Older notice kinds retain their existing ordering and authority behavior.
  let preparationRecipient: string | undefined;
  if (params.milestone === "preparation_needs_attention") {
    try { preparationRecipient = String(await decryptFieldValue(snapshot.data()?.contact?.email ?? "")).trim(); }
    catch { throw new Error("website_preparation_recipient_unavailable"); }
  }
  if (!(await taskLifecycleNotificationIsCurrent({ requestId, kind: params.milestone,
    ...(params.milestone === "preparation_needs_attention" ? {preparationEventId: params.eventId, to: preparationRecipient} : {}) }))) {
    return { enqueued: false, reason: "consent_withdrawn" };
  }
  const to = preparationRecipient ?? String(await decryptFieldValue(snapshot.data()?.contact?.email ?? "")).trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return { enqueued: false, reason: "contact_missing" };
  }
  return enqueueOutbox(buildTaskLifecycleNotification({ ...params, requestId, to }));
}

/** Build the existing notice without a database write or delivery. Atomic
 * request writers can put this intent beside their business mutation. Supply
 * captureUrl when a transaction retry must reuse the exact signed link. */
export function buildTaskLifecycleNotification(params: {
  requestId: string;
  milestone: TaskLifecycleMilestone;
  to: string;
  eventId?: string;
  detail?: string;
  correlationId?: string;
  captureUrl?: string;
}): Parameters<typeof enqueueOutbox>[0] {
  const requestId = params.requestId.trim();
  if (params.milestone === "preparation_needs_attention" && !/^sha256:[a-f0-9]{64}$/.test(params.eventId || "")) {
    throw new Error("website_preparation_event_invalid");
  }
  const message = copy[params.milestone];
  const url = params.captureUrl ?? captureUploadUrlFor(requestId, "owner");
  const eventId = params.eventId?.trim().replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120);
  return {
    idempotencyKey: `${requestId}:${params.milestone}${eventId ? `:${eventId}` : ""}`,
    requestId,
    kind: params.milestone,
    ...(params.milestone === "preparation_needs_attention" ? {preparationEventId: params.eventId} : {}),
    to: params.to,
    subject: message.subject,
    body: `${message.body(url, params.milestone === "preparation_needs_attention"
      ? /^bp-prep-[a-f0-9]{16}$/.test(params.correlationId || "") ? `Reference: ${params.correlationId}.` : ""
      : params.detail?.trim() ?? "")}\n\n${EMAIL_SIGN_OFF}`,
    replyTo: "ops@tryblueprint.io",
  };
}

/** Existing outbox tick repairs a lost enqueue; fresh readback gates dispatch again. */
export async function reconcileWebsitePreparationNotifications(limit = 1): Promise<void> {
  if (!db) return;
  const store = db;
  await drainPendingWebsitePreparationNotifications(async intent => {
    const result = await enqueueTaskLifecycleNotification({...intent, milestone: "preparation_needs_attention"});
    if (result.enqueued) return "enqueued";
    const key = `${intent.requestId}:preparation_needs_attention:${intent.eventId.replace(/[^A-Za-z0-9._-]/g, "_")}`;
    return (await store.collection(CAPTURE_OUTBOX_COLLECTION).doc(key).get()).exists ? "duplicate" : "unavailable";
  }, undefined, Math.max(1, Math.min(limit, 1)));
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
