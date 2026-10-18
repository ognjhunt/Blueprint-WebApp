import { noResultObservationText, type NoResultObservation } from "./runNoResultObservation";
/**
 * Durable, deduplicated notices for every real event on a site's task.
 *
 * The site hears from us when something happens, not on a timer: its task
 * was received, its footage landed, its scene was built, its card went live,
 * a robot team picked it up, a result came in, a team asked about a pilot.
 * The scheduled check-in that used to fill the gaps between these is retired.
 * Waiting is an event too: the job opening to robot teams, and every
 * evaluation so far finishing without a pass, each send their own notice.
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
import { formatPilotContact, type PilotContact } from "./pilotContactExchange";

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
  | "awaiting_evaluations"
  | "no_team_passed"
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

/** The site's job in its workspace, where run results open once the site is claimed. */
function workspaceTaskUrl(requestId: string): string {
  const origin = (process.env.VITE_PUBLIC_APP_URL?.trim() || process.env.APP_URL?.trim() || "https://tryblueprint.io")
    .replace(/\/+$/, "");
  return `${origin}/app/tasks/${encodeURIComponent(requestId)}`;
}

/**
 * Where a site sees its runs. Results open in the site's account, so a
 * claimed site is sent there; an unclaimed one is told first that its job page
 * will ask it to save the site to an account (audit N12).
 */
function whereRunsAre(url: string, workspaceUrl: string | null, action: string): string {
  return workspaceUrl
    ? `${action} in your workspace:\n${workspaceUrl}`
    : `Run results open in your Blueprint account. ${action} there: open your job and save this site to your account; your private link keeps working.\n\nOpen your job:\n${url}`;
}

const copy: Record<TaskLifecycleMilestone, { subject: string; body: (url: string, detail: string, counterpart: string, workspaceUrl: string | null) => string }> = {
  preparation_needs_attention: {
    subject: "An update on your Blueprint job preparation",
    body: (url, detail) => `Job preparation needs our team's review. Keep your original recording. Open your job to see the latest status and next step.${detail ? ` ${detail}` : ""}\n\nOpen your job:\n${url}`,
  },
  task_received: {
    subject: "We have your Blueprint job — here is your link",
    body: (url) => `Thanks for sending us your job. This private link shows the same job and lets you correct details when needed. You can also reply to a job conversation without completing another form. You can add footage later, once you have recording permission. It opens your site's job without a password, so please don't forward it.\n\nOpen your job:\n${url}\n\nBlueprint will follow through with meaningful findings and questions that need your input.`,
  },
  video_received: {
    subject: "We received your Blueprint walkthrough",
    body: (url) => `Your walkthrough arrived safely. Blueprint will investigate the observed task and prepare a recommendation or concrete next step. Reconstruction and evaluation are used when they help that decision. We will ask only when a missing fact, permission or real commitment blocks progress.\n\nOpen your job:\n${url}`,
  },
  scene_ready: {
    subject: "Your Blueprint scene is ready to view",
    body: (url) => `Your scene is ready: a 3D reconstruction of the work area you filmed. You can look around it on your job page.\n\nOpen your job:\n${url}`,
  },
  listing_live: {
    subject: "Your job card is in the robot-team library",
    // The link below is the owner's job page, which carries the listing control.
    // A site that came in by link alone may have no account, so the account
    // workspace is not the way to hide it.
    body: (url) => `Robot teams approved for the beta can now see the job card you approved. It shows only the text and image you reviewed; your contact details, footage and scene stay private. You can hide it at any time: open your job from the link below and untick "Show this card in the job library". If the link has expired, the page will send you a fresh one.\n\nOpen your job:\n${url}`,
  },
  screening_cleared: {
    subject: "Your job cleared our screen",
    body: (url, detail) => `The reviewed information now clears the recorded assessment blocker. Blueprint can continue the useful, authorized investigation${detail ? ` ${detail}` : ""}.\n\nOpen your job:\n${url}`,
  },
  screening_not_now: {
    subject: "An update on your Blueprint job",
    body: (url) => `The reviewed information leaves a consequential assessment blocker unresolved. Your job page shows the reason and what is needed. Blueprint owns the follow-through; reply in your job conversation with a correction or use the optional job page when that information changes.\n\nOpen your job:\n${url}`,
  },
  screening_started: {
    subject: "A robot team picked up your job",
    body: (url) => `A robot team has started an evaluation run against your scene. We will email you again when it reports a result.\n\nOpen your job:\n${url}`,
  },
  results_ready: {
    subject: "Results are in from a robot team",
    body: (url, detail, _counterpart, workspaceUrl) => `A robot team's evaluation run against your scene has finished${detail ? `: ${detail}` : ""}. This is a simulation result for one team's robot, not a physical test or a recommendation.\n\n${whereRunsAre(url, workspaceUrl, "See the run")}`,
  },
  run_no_result: {
    subject: "A robot team's run ended without a result",
    body: (url, detail, _counterpart, workspaceUrl) => `A robot team's run against your scene ended without a complete scored result. ${detail || noResultObservationText()} Reply if you need help understanding what happened.\n\n${whereRunsAre(url, workspaceUrl, "Review the run")}`,
  },
  awaiting_evaluations: {
    subject: "Robot teams can now evaluate your job",
    body: (url) => `Your job is open to robot teams approved for the beta. They see only its anonymized card, and each can request a free evaluation in a simplified simulation of your task, informed by your footage. No team has started one yet. We will email you when a team starts and when it reports a result. Nothing is needed from you.\n\nOpen your job:\n${url}`,
  },
  no_team_passed: {
    subject: "No robot team's evaluation has passed yet",
    body: (url, _detail, _counterpart, workspaceUrl) => `Every evaluation of your job so far has finished, and none passed, so there is no pilot to recommend yet. A recommendation needs one team's evaluation on your job to pass. While your job card stays published, robot teams approved for the beta can still evaluate it, and we will email you when one starts. Nothing is needed from you.\n\n${whereRunsAre(url, workspaceUrl, "See each run")}`,
  },
  pilot_request: {
    subject: "A robot team asked to evaluate your site for a pilot",
    body: (url) => `A robot team asked to evaluate your site for a pilot. Your details stay private, and there is nothing for you to do. We review every team that shows interest and send you one recommended pilot when the evidence supports it.\n\nOpen your job:\n${url}`,
  },
  pilot_recommended: {
    subject: "Your recommended pilot is ready",
    body: (url, detail) => `We have one recommended pilot for your job${detail ? `: ${detail}` : ""}. Your job page shows the robot team, what the pilot tests, what you provide, the pilot's cost (paid to the robot team, not to Blueprint), proposed timing and what is still uncertain. If it looks right, book it there in one step; booking costs nothing during the beta. When you book, you and the robot team receive each other's contact details and agree the pilot's dates and terms directly. If it does not look right, reply and tell us why.\n\nOpen your job:\n${url}`,
  },
  pilot_booked: {
    subject: "Your pilot is booked",
    // A booking made before the free beta keeps whatever terms were accepted
    // then; this email does not restate or waive them. The free-beta sentence
    // is the one the job page shows beside the booking button. The site and the
    // team agree the pilot directly (owner decision 2026-10-15), so the email
    // carries the team's contact; dispatch re-checks both consents.
    body: (url, detail, counterpart) => `Your booking is recorded. You and the robot team agree the pilot's dates and terms directly. No date is reserved yet.${counterpart ? `\n\nRobot team contact:\n${counterpart}` : ""}\n\n${detail === "invited_beta_free" ? "Blueprint charges nothing during the beta; the pilot's cost is agreed with the robot team." : "Your previously accepted commercial terms remain on file."}\n\nOpen your job:\n${url}`,
  },
  pilot_scheduled: {
    subject: "Your pilot is scheduled",
    body: (url) => `The provider and site agreement, date and preparation responsibilities have been recorded and checked against the calendar. Open your job for the agreed date and responsibilities.\n\nOpen your job:\n${url}`,
  },
};

/**
 * `video_received` for a site whose drafted brief is still unconfirmed. Same
 * event, same outbox key, so still one email when the footage lands; it names
 * the step that is the site's own, because robot teams can evaluate a job only
 * once its brief is confirmed (`teamJobAccess`).
 */
const VIDEO_RECEIVED_CONFIRM_BRIEF = {
  subject: "We received your walkthrough. Next, confirm your job brief",
  body: (url: string) => `Your walkthrough arrived safely. One step is yours: confirm your job brief. Robot teams can evaluate your job only after you confirm it. Open your job, check the summary and the answers we drafted from what you sent, correct anything that is wrong, and confirm it.\n\nOpen your job:\n${url}`,
};

/** A drafted brief the site has not confirmed. Read only for `video_received`. */
async function briefAwaitsConfirmation(requestId: string, record: Record<string, any> | undefined): Promise<boolean> {
  if (record?.request?.buyerType !== "site_operator" || record.site_task_brief_confirmed_at) return false;
  const { getBrief } = await import("./siteTaskBrief");
  const brief = await getBrief(requestId);
  return Boolean(brief && !brief.confirmedAtIso);
}

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
  runProgress?: NoResultObservation;
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
  const briefConfirmationNeeded = params.milestone === "video_received"
    && await briefAwaitsConfirmation(requestId, snapshot.data());
  // Run results open in the site's account; only a claimed site has one.
  const workspaceUrl = typeof snapshot.data()?.account_owner_uid === "string" && snapshot.data()?.account_owner_uid
    ? workspaceTaskUrl(requestId) : null;
  return enqueueOutbox(buildTaskLifecycleNotification({ ...params, requestId, to, briefConfirmationNeeded, workspaceUrl }));
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
  /** `pilot_booked` only: the robot team's contact, shared at booking. */
  counterpart?: PilotContact | null;
  runProgress?: NoResultObservation;
  /** `video_received` only: the drafted brief still awaits the site's confirmation. */
  briefConfirmationNeeded?: boolean;
  /** The job in the site's workspace, when the site is claimed. Run notices send it there. */
  workspaceUrl?: string | null;
}): Parameters<typeof enqueueOutbox>[0] {
  const requestId = params.requestId.trim();
  if (params.milestone === "preparation_needs_attention" && !/^sha256:[a-f0-9]{64}$/.test(params.eventId || "")) {
    throw new Error("website_preparation_event_invalid");
  }
  const message = params.milestone === "video_received" && params.briefConfirmationNeeded
    ? VIDEO_RECEIVED_CONFIRM_BRIEF : copy[params.milestone];
  const url = params.captureUrl ?? captureUploadUrlFor(requestId, "owner");
  const eventId = params.eventId?.trim().replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120);
  return {
    idempotencyKey: `${requestId}:${params.milestone}${eventId ? `:${eventId}` : ""}`,
    requestId,
    kind: params.milestone,
    ...(params.milestone === "preparation_needs_attention" ? {preparationEventId: params.eventId} : {}),
    to: params.to,
    subject: message.subject,
    body: `${message.body(url, params.milestone === "run_no_result" ? noResultObservationText(params.runProgress) : params.milestone === "preparation_needs_attention"
      ? /^bp-prep-[a-f0-9]{16}$/.test(params.correlationId || "") ? `Reference: ${params.correlationId}.` : ""
      : params.detail?.trim() ?? "", params.milestone === "pilot_booked" && params.counterpart ? formatPilotContact(params.counterpart) : "",
      params.workspaceUrl ?? null)}\n\n${EMAIL_SIGN_OFF}`,
    replyTo: "hello@tryblueprint.io",
  };
}

/**
 * Tell the site, once, that robot teams can now request an evaluation of its
 * job and none has. Read from the stored record by the same predicate the job
 * library uses, so it is sent only when it is true. Callers that may have just
 * opened a job (a Pipeline sync, a published card) call this; it is a no-op
 * otherwise, and the outbox key keeps it to one email per job.
 */
export async function notifyIfOpenForEvaluations(requestId: string): Promise<{ enqueued: boolean }> {
  if (!(await openAndAwaitingEvaluations(requestId))) return { enqueued: false };
  return enqueueTaskLifecycleNotification({ requestId, milestone: "awaiting_evaluations" });
}

/** True while the job is open to evaluation requests and no team has requested one. Read again at dispatch. */
export async function openAndAwaitingEvaluations(requestId: string): Promise<boolean> {
  if (!db) return false;
  const snapshot = await db.collection("inboundRequests").doc(requestId).get();
  const { teamJobAccess } = await import("./teamJobAccess");
  if (!snapshot.exists || !teamJobAccess(snapshot.data()).evaluationAvailable) return false;
  const { loadSceneScreening } = await import("./agentEvalRuns");
  return (await loadSceneScreening(requestId)).teams === 0;
}

/**
 * After a site evaluation concludes: when nothing is in flight, nothing passed
 * the job's pass mark and no pilot is recommended, tell the site no team has
 * passed yet. Keyed by the run that concluded, so each run is at most one.
 */
export async function notifyIfNoTeamPassed(requestId: string, concludedRunId: string): Promise<{ enqueued: boolean }> {
  if (!(await noTeamHasPassed(requestId))) return { enqueued: false };
  return enqueueTaskLifecycleNotification({ requestId, milestone: "no_team_passed", eventId: concludedRunId });
}

/** True while every site evaluation has concluded, none passed and no pilot is recommended. Read again at dispatch. */
export async function noTeamHasPassed(requestId: string): Promise<boolean> {
  if (!db) return false;
  const snapshot = await db.collection("inboundRequests").doc(requestId).get();
  const record = snapshot.data();
  if (!snapshot.exists || !record || record.pilot_recommendation) return false;
  const [{ getBrief }, { passMarkForJob }, { loadSceneScreening }] = await Promise.all([
    import("./siteTaskBrief"), import("./pilotRecommendationEvidence"), import("./agentEvalRuns")]);
  const screening = await loadSceneScreening(requestId, passMarkForJob(record, await getBrief(requestId) as never));
  return screening.queued + screening.running === 0 && screening.reported > 0 && screening.noResult === 0
    && screening.passed === 0 && (screening.ineligible ?? 0) === 0;
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
