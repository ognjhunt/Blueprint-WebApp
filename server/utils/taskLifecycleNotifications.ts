import { noResultObservationText, type NoResultObservation } from "./runNoResultObservation";
/**
 * Durable, deduplicated notices for every real event on a site's task.
 *
 * The site hears from us when something happens, not on a timer: its task
 * was received, its footage landed, its scene was built, its card went live,
 * an evaluation started, a result came in, a partner asked about a pilot.
 * Blueprint runs the candidates itself (owner, 2026-10-26), so the notices
 * speak of evaluations and candidates, not of robot teams picking a job up.
 * The scheduled check-in that used to fill the gaps between these is retired.
 * Waiting is an event too: the job opening for evaluation, and every
 * evaluation so far finishing without a pass, each send their own notice.
 * Per-run and per-request events carry an `eventId`, so each one is its own
 * email and a retry of the same event is not.
 */
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { captureUploadUrlFor } from "./captureUploadToken";
import { enqueueOutbox, CAPTURE_OUTBOX_COLLECTION, type OutboxKind } from "./captureOutbox";
import { automationBatch } from "./automationBatch";
import { logger } from "../logger";
import { footageArrivedBeforeAccount } from "./siteWalkthrough";
import { decryptFieldValue } from "./field-encryption";
import { EMAIL_SIGN_OFF } from "./emailLayout";
import { taskLifecycleNotificationIsCurrent } from "./taskLifecycleNotificationAuthority";
import { drainPendingWebsitePreparationNotifications } from "./websitePreparationStatus";
import { formatPilotContact, type PilotContact } from "./pilotContactExchange";
import { preparationEndedSentence } from "./taskStatusProjection";

export type TaskLifecycleMilestone = Extract<
  OutboxKind,
  | "task_received"
  | "video_received"
  | "scene_ready"
  | "scene_tests_started"
  | "preparation_needs_attention"
  | "preparation_ended"
  | "listing_live"
  | "screening_not_now"
  | "results_ready"
  | "run_no_result"
  | "awaiting_evaluations"
  | "no_team_passed"
  | "no_qualified_evaluation"
  | "footage_before_account"
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
 * A claimed site may use its workspace. The private owner link shows the
 * same job results without adding an account step.
 */
function whereRunsAre(url: string, workspaceUrl: string | null, action: string): string {
  return workspaceUrl
    ? `${action} in your workspace:\n${workspaceUrl}`
    : `${action} on your private job page:\n${url}`;
}

const copy: Record<TaskLifecycleMilestone, { subject: string; body: (url: string, detail: string, counterpart: string, workspaceUrl: string | null) => string }> = {
  preparation_needs_attention: {
    subject: "An update on your Blueprint job preparation",
    body: (url, detail) => `Job preparation needs our team's review. Keep your original recording. Open your job to see the latest status and next step.${detail ? ` ${detail}` : ""}\n\nOpen your job:\n${url}`,
  },
  // One per terminal transition. The detail is only a fixed reason sentence and a reference.
  preparation_ended: {
    subject: "We stopped preparing your Blueprint scene",
    body: (url, detail) => `We could not finish building the scene preview for your job, and we have stopped trying.${detail ? ` ${detail}` : ""} Nothing more is needed from you. This needs our team's review. Keep your original recording. Your job page shows the latest status.\n\nOpen your job:\n${url}`,
  },
  task_received: {
    subject: "We have your Blueprint job — here is your link",
    body: (url) => `Thanks for sending us your job. This private link shows the same job and lets you correct details if you choose. Once your video arrives, Blueprint handles reconstruction and evaluation and updates this job with the results and any delivery proposal. If your video is not uploaded yet, use your job page to record or upload it after arranging filming permission. It opens your site's job without a password, so please don't forward it.\n\nOpen your job:\n${url}`,
  },
  video_received: {
    subject: "We received your Blueprint walkthrough",
    body: (url) => `Your walkthrough arrived safely. Blueprint handles reconstruction and evaluation from the recording. Your job page will show the reconstruction, results and any delivery proposal as they become available. You can review or correct job details at any time.\n\nOpen your job:\n${url}`,
  },
  scene_ready: {
    subject: "Your Blueprint scene is ready to view",
    body: (url) => `Your scene is ready: a 3D reconstruction of the work area you filmed. You can look around it on your job page.\n\nOpen your job:\n${url}`,
  },
  // Owner decision 2026-10-22: "ready" only once the task objects are in and
  // our first internal test has started, never when the room alone is built.
  scene_tests_started: {
    subject: "Your Blueprint scene is ready",
    body: (url) => `Your scene is ready: a simulation of the work area you filmed, with your task's objects in place. We are running our first tests on it now. Nothing is needed from you for these tests, and we will email you at the next step.\n\nOpen your job:\n${url}`,
  },
  listing_live: {
    subject: "Your job card is in the partner job library",
    // The link below is the owner's job page, which carries the listing control.
    // A site that came in by link alone may have no account, so the account
    // workspace is not the way to hide it.
    body: (url) => `Partners approved for the beta can now see the job card you approved. It shows only the text and image you reviewed; your contact details, footage and scene stay private. You can hide it at any time: open your job from the link below and untick "Show this card in the job library". If the link has expired, the page will send you a fresh one.\n\nOpen your job:\n${url}`,
  },
  screening_not_now: {
    subject: "An update on your Blueprint job",
    body: (url) => `The reviewed information leaves a consequential assessment blocker unresolved. Your job page shows the reason and what is needed. Blueprint owns the follow-through; reply in your job conversation with a correction or use the optional job page when that information changes.\n\nOpen your job:\n${url}`,
  },
  results_ready: {
    subject: "Results are in from an evaluation of your job",
    body: (url, detail, _counterpart, workspaceUrl) => `An evaluation run of one candidate against your scene has finished${detail ? `: ${detail}` : ""}. This is a bounded simulation estimate for one candidate, not a physical test; it never certifies physical performance or safety.\n\n${whereRunsAre(url, workspaceUrl, "See the run")}`,
  },
  run_no_result: {
    subject: "An evaluation run ended without a result",
    body: (url, detail, _counterpart, workspaceUrl) => `An evaluation run against your scene ended without a complete scored result. ${detail || noResultObservationText()} Reply if you need help understanding what happened.\n\n${whereRunsAre(url, workspaceUrl, "Review the run")}`,
  },
  awaiting_evaluations: {
    subject: "Your job is ready for evaluation",
    body: (url) => `Your job is ready for evaluation in a simplified simulation of your task, informed by your footage. Next, Blueprint evaluates candidate robots and policies against it, and approved partners, who see only its anonymized card, can ask for their systems to be evaluated too. Your job page shows where the evaluations stand. Nothing is needed from you.\n\nOpen your job:\n${url}`,
  },
  no_team_passed: {
    subject: "No evaluation of your job has passed yet",
    // `detail` is what would change that (`qualifiedGap`), as /beta promises.
    body: (url, detail, _counterpart, workspaceUrl) => `Every simulation evaluation of your job so far has finished, and none passed. ${detail || "We need stronger evidence for this tested configuration."} Blueprint will assess what further evidence or another candidate would help the decision, and while your job card stays published, approved partners can still ask for their systems to be evaluated. Nothing is needed from you for these completed runs.\n\n${whereRunsAre(url, workspaceUrl, "See each run")}`,
  },
  no_qualified_evaluation: {
    subject: "Your job's evaluations finished, with no result that counts yet",
    // Never a failure: diagnostic, unqualified or unscored runs count neither way.
    body: (url, _detail, _counterpart, workspaceUrl) => `The evaluations of your job so far have finished, but none can support a recommendation yet: they were diagnostic runs, ran before your scene was qualified for scored evaluations, could not be scored against your job's pass mark, or ended without an observed episode. So none counts as a pass or a failure. Nothing is needed from you. We email you when a qualified evaluation finishes.\n\n${whereRunsAre(url, workspaceUrl, "See each run")}`,
  },
  footage_before_account: {
    subject: "Your video arrived before your job was saved to an account",
    // Owner decision 2026-10-18: said once, plainly. A re-upload cannot help on
    // Pipeline main, so it is never asked for.
    body: (url, _detail, _counterpart, workspaceUrl) => `Your video arrived before this job was saved to an account, so we can't use it to build your scene yet. Blueprint needs to review this older recording. You don't need to send it again. Follow the same job:\n${workspaceUrl || url}\n\nWe email you when that changes.`,
  },
  pilot_request: {
    subject: "A partner asked to have its system evaluated on your job",
    body: (url) => `An approved partner asked to have its system evaluated on your job for a possible pilot. Your details stay private, and there is nothing for you to do for this request. We review the partner's fit, evidence and delivery capabilities before including its system or presenting it as an option. You choose the deployment company and agree any physical pilot directly with them.\n\nOpen your job:\n${url}`,
  },
  pilot_recommended: {
    subject: "Your recommended pilot is ready",
    body: (url, detail) => `A recommended delivery option is ready for your review${detail ? `: ${detail}` : ""}. Your job page shows the provider, supporting evidence, what the pilot tests, what you provide, the pilot's cost (paid to the deployment company, not to Blueprint), proposed timing and what is still uncertain. Review the scope, total cost and support before choosing. Blueprint's coordination is free during the beta. If you choose this option, contact details are shared under the recorded permissions so you and the provider can agree the pilot's scope, price, dates and acceptance criteria directly. Selection does not itself sign a contract or reserve a date. If it does not look right, reply and tell us why.\n\nOpen your job:\n${url}`,
  },
  pilot_booked: {
    subject: "Your pilot selection is recorded",
    // A booking made before the free beta keeps whatever terms were accepted
    // then; this email does not restate or waive them. The free-beta sentence
    // is the one the job page shows beside the booking button. The site and the
    // team agree the pilot directly (owner decision 2026-10-15), so the email
    // carries the team's contact; dispatch re-checks both consents.
    body: (url, detail, counterpart) => `Your selection is recorded. You and the deployment company agree the physical pilot's scope, price, dates and acceptance criteria directly. No contract is signed or date reserved by this selection.${counterpart ? `\n\nDeployment company contact:\n${counterpart}` : ""}\n\n${detail === "invited_beta_free" ? "Blueprint charges nothing during the beta and takes no cut; the pilot's cost is agreed with the deployment company." : "Your previously accepted commercial terms remain on file."}\n\nOpen your job:\n${url}`,
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
/** Source/context-bound preparation notices: an exact event id and current recipient are required. */
export function isWebsitePreparationNotice(milestone: string): milestone is "preparation_needs_attention" | "preparation_ended" {
  return milestone === "preparation_needs_attention" || milestone === "preparation_ended";
}

export async function enqueueTaskLifecycleNotification(params: {
  requestId: string;
  milestone: TaskLifecycleMilestone;
  /** Distinguishes repeated events of one kind: a run id, a request id. */
  eventId?: string;
  /** One clause of event detail for the body, e.g. "12 of 50 episodes succeeded". */
  detail?: string;
  correlationId?: string;
  runProgress?: NoResultObservation;
  /** `preparation_ended` only: the Pipeline's typed reason; unknown values add nothing. */
  terminalReason?: string | null;
}): Promise<{ enqueued: boolean; reason?: "store_unavailable" | "request_missing" | "contact_missing" | "consent_withdrawn" }> {
  if (!db) return { enqueued: false, reason: "store_unavailable" };
  const requestId = params.requestId.trim();
  const snapshot = await db.collection("inboundRequests").doc(requestId).get();
  if (!snapshot.exists) return { enqueued: false, reason: "request_missing" };
  // New private-link notices bind recipient admission as well as source.
  // Older notice kinds retain their existing ordering and authority behavior.
  let preparationRecipient: string | undefined;
  if (isWebsitePreparationNotice(params.milestone)) {
    try { preparationRecipient = String(await decryptFieldValue(snapshot.data()?.contact?.email ?? "")).trim(); }
    catch { throw new Error("website_preparation_recipient_unavailable"); }
  }
  if (!(await taskLifecycleNotificationIsCurrent({ requestId, kind: params.milestone,
    ...(isWebsitePreparationNotice(params.milestone) ? {preparationEventId: params.eventId, to: preparationRecipient} : {}) }))) {
    return { enqueued: false, reason: "consent_withdrawn" };
  }
  const to = preparationRecipient ?? String(await decryptFieldValue(snapshot.data()?.contact?.email ?? "")).trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return { enqueued: false, reason: "contact_missing" };
  }
  // Run results open in the site's account; only a claimed site has one.
  const workspaceUrl = typeof snapshot.data()?.account_owner_uid === "string" && snapshot.data()?.account_owner_uid
    ? workspaceTaskUrl(requestId) : null;
  return enqueueOutbox(buildTaskLifecycleNotification({ ...params, requestId, to, workspaceUrl }));
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
  /** `pilot_booked` only: the deployment company's contact, shared at booking. */
  counterpart?: PilotContact | null;
  runProgress?: NoResultObservation;
  /** `preparation_ended` only: rendered through a fixed sentence per known reason. */
  terminalReason?: string | null;
  /** The job in the site's workspace, when the site is claimed. Run notices send it there. */
  workspaceUrl?: string | null;
}): Parameters<typeof enqueueOutbox>[0] {
  const requestId = params.requestId.trim();
  if (isWebsitePreparationNotice(params.milestone) && !/^sha256:[a-f0-9]{64}$/.test(params.eventId || "")) {
    throw new Error("website_preparation_event_invalid");
  }
  const message = copy[params.milestone];
  const url = params.captureUrl ?? captureUploadUrlFor(requestId, "owner");
  const eventId = params.eventId?.trim().replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120);
  // Preparation notices never carry caller text: only a validated reference and,
  // for an ending, the fixed sentence for its reason.
  const reference = /^bp-prep-[a-f0-9]{16}$/.test(params.correlationId || "") ? `Reference: ${params.correlationId}.` : "";
  const preparationDetail = params.milestone === "preparation_ended"
    ? [preparationEndedSentence(params.terminalReason), reference].filter(Boolean).join(" ") : reference;
  return {
    idempotencyKey: `${requestId}:${params.milestone}${eventId ? `:${eventId}` : ""}`,
    requestId,
    kind: params.milestone,
    ...(isWebsitePreparationNotice(params.milestone) ? {preparationEventId: params.eventId} : {}),
    to: params.to,
    subject: message.subject,
    body: `${message.body(url, params.milestone === "run_no_result" ? noResultObservationText(params.runProgress)
      : isWebsitePreparationNotice(params.milestone) ? preparationDetail
      : params.detail?.trim() ?? "", params.milestone === "pilot_booked" && params.counterpart ? formatPilotContact(params.counterpart) : "",
      params.workspaceUrl ?? null)}\n\n${EMAIL_SIGN_OFF}`,
    replyTo: "hello@tryblueprint.io",
  };
}

/**
 * Tell the site, once, that its job is open for evaluation and no evaluation
 * has been requested yet. Read from the stored record by the same predicate the job
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
 * After a site evaluation concludes, when nothing is in flight, nothing passed
 * the job's pass mark and no pilot is recommended:
 *
 * - every concluded run qualified and fell short: tell the site no team has
 *   passed yet, and what would change that (the closest run's gap). Keyed by
 *   the run that concluded, so each run is at most one;
 * - no reported run can count either way (diagnostic, unqualified or
 *   unscored): tell the site once that none can support a recommendation yet.
 *   Never "no team passed": that would call it a failure.
 */
export async function notifyIfNoTeamPassed(requestId: string, concludedRunId: string): Promise<{ enqueued: boolean }> {
  const settled = await settledWithoutPass(requestId);
  if (settled?.state === "no_team_passed") {
    const { qualifiedGap } = await import("./taskStatusProjection");
    const gap = qualifiedGap(settled.screening.closestQualified);
    return enqueueTaskLifecycleNotification({ requestId, milestone: "no_team_passed", eventId: concludedRunId,
      detail: gap.shortfall ? `${gap.shortfall} To pass in this simulation, a candidate needs to ${gap.requirement}.` : undefined });
  }
  if (settled?.state === "no_qualified_evaluation") {
    return enqueueTaskLifecycleNotification({ requestId, milestone: "no_qualified_evaluation" });
  }
  return { enqueued: false };
}

/** The job's runs against its own pass mark, or null while a recommendation stands or the job is missing. */
async function settledScreening(requestId: string) {
  if (!db) return null;
  const snapshot = await db.collection("inboundRequests").doc(requestId).get();
  const record = snapshot.data();
  if (!snapshot.exists || !record || record.pilot_recommendation) return null;
  const [{ getBrief }, { passMarkForJob }, { loadSceneScreening }] = await Promise.all([
    import("./siteTaskBrief"), import("./pilotRecommendationEvidence"), import("./agentEvalRuns")]);
  return loadSceneScreening(requestId, passMarkForJob(record, await getBrief(requestId) as never));
}

/** Which settled state the job is in, if any. The same rules as the job page (`projectTaskStatus`). */
async function settledWithoutPass(requestId: string) {
  const screening = await settledScreening(requestId);
  if (!screening || screening.queued + screening.running > 0 || screening.passed !== 0) return null;
  const ineligible = screening.ineligible ?? 0;
  if (screening.reported > 0 && screening.noResult === 0 && ineligible === 0)
    return { state: "no_team_passed" as const, screening };
  // Runs that only ended without an observed episode each sent their own
  // run_no_result notice; the page still shows this state for them.
  if (ineligible > 0 && screening.reported - ineligible === 0)
    return { state: "no_qualified_evaluation" as const, screening };
  return null;
}

/** True while every site evaluation has concluded, none passed and no pilot is recommended. Read again at dispatch. */
export async function noTeamHasPassed(requestId: string): Promise<boolean> {
  return (await settledWithoutPass(requestId))?.state === "no_team_passed";
}

/** True while every site evaluation has concluded and none can support a recommendation. Read again at dispatch. */
export async function noQualifiedEvaluationYet(requestId: string): Promise<boolean> {
  return (await settledWithoutPass(requestId))?.state === "no_qualified_evaluation";
}

/** Existing outbox tick repairs a lost enqueue; fresh readback gates dispatch again. */
export async function reconcileWebsitePreparationNotifications(limit = 1): Promise<void> {
  if (!db) return;
  const store = db;
  await drainPendingWebsitePreparationNotifications(async intent => {
    const result = await enqueueTaskLifecycleNotification({...intent, milestone: intent.milestone});
    if (result.enqueued) return "enqueued";
    const key = `${intent.requestId}:${intent.milestone}:${intent.eventId.replace(/[^A-Za-z0-9._-]/g, "_")}`;
    return (await store.collection(CAPTURE_OUTBOX_COLLECTION).doc(key).get()).exists ? "duplicate" : "unavailable";
  }, undefined, Math.max(1, Math.min(limit, 1)));
}


/**
 * Whether the job page shows `footage_before_account` right now, from the same
 * projection and the same inputs the job pages use (owner decision
 * 2026-10-18). The notice is queued and sent only while this holds, so it
 * never tells a site its video cannot be used once a scope verdict, a step of
 * its own, a scene preview or an evaluation says something truer.
 */
export async function footageBeforeAccountShown(requestId: string): Promise<boolean> {
  if (!db) return false;
  const snapshot = await db.collection("inboundRequests").doc(requestId).get();
  const record = snapshot.data();
  if (!snapshot.exists || !record || await footageArrivedBeforeAccount(requestId, record) !== true) return false;
  const [{ getBrief }, { passMarkForJob }, { loadSceneScreening }, { teamJobAccess }, { projectWebsiteCaptureRights },
    { projectTaskStatus, taskStatusInputFrom }] = await Promise.all([
    import("./siteTaskBrief"), import("./pilotRecommendationEvidence"), import("./agentEvalRuns"), import("./teamJobAccess"),
    import("./websiteTaskContext"), import("./taskStatusProjection")]);
  const [brief, session] = await Promise.all([getBrief(requestId),
    db.collection("captureUploadSessions").doc(`walkthrough-${requestId}`).get()]);
  const consentRevoked = projectWebsiteCaptureRights(record).consent_revoked;
  const reconstruction = session.data()?.world_reconstruction;
  const status = projectTaskStatus(taskStatusInputFrom({
    active_capture_id: typeof record.active_capture_id === "string" ? record.active_capture_id : null,
    site_task_brief_confirmed_at: record.site_task_brief_confirmed_at,
    capture_coverage: record.capture_coverage ?? null,
    briefDrafted: Boolean(brief),
    // The `video_received` notice footageArrivedBeforeAccount read is the receipt.
    hasStoredCapture: true,
    footageBeforeAccount: true,
    consentRevoked,
    scenePreviewReady: !consentRevoked && reconstructionIsViewable({ ...reconstruction, worldId: reconstruction?.world_id }),
    scenePreparationFailed: reconstruction?.state === "failed",
    // The job pages never read preparation for this capture, which cannot be prepared.
    preparationStatus: null,
    stage: null,
    screening: consentRevoked ? null
      : await loadSceneScreening(requestId, passMarkForJob(record as never, brief as never)).catch(() => null),
    site_task_triage: record.site_task_triage ?? null,
    site_task_scope: record.site_task_scope ?? null,
    account_owner_uid: typeof record.account_owner_uid === "string" && record.account_owner_uid ? record.account_owner_uid : null,
    jobAccess: teamJobAccess(record),
    recommended: Boolean(record.pilot_recommendation),
  }));
  return status.decision === "footage_before_account";
}

/**
 * One honest email for each job whose video arrived before it was saved to an
 * account (owner decision 2026-10-18), including jobs saved before this
 * existed. Footage now waits for a saved job, so no new job joins them; the
 * scan turns through the footage notices a few at a time and queues only
 * while the job page shows `footage_before_account` (re-checked at dispatch),
 * and the outbox key keeps it to one email per job.
 */
export async function reconcileFootageBeforeAccountNotices(limit = 5): Promise<void> {
  if (!db) return;
  const store = db;
  const query = store.collection(CAPTURE_OUTBOX_COLLECTION).where("kind", "==", "video_received");
  let rows = await automationBatch(store, query, "footage_before_account_notices", limit);
  if (!rows.docs.length) rows = await automationBatch(store, query, "footage_before_account_notices", limit);
  for (const row of rows.docs) {
    const requestId = String(row.data()?.requestId ?? "").trim();
    if (!requestId) continue;
    try {
      if ((await store.collection(CAPTURE_OUTBOX_COLLECTION).doc(`${requestId}:footage_before_account`).get()).exists) continue;
      if (!(await footageBeforeAccountShown(requestId))) continue;
      await enqueueTaskLifecycleNotification({ requestId, milestone: "footage_before_account" });
    } catch (error) {
      logger.warn({ error, requestId }, "Could not queue the footage-before-account notice");
    }
  }
}

/**
 * Tell the site, once, that its scene is ready and our first test on it has
 * started. Read from the same progression the job page shows, so it is sent
 * only when the page says so; dispatch reads it again, and the outbox key keeps
 * it to one email per job. Callers that may have just started a test (a scene
 * status poll, an accepted policy run) call this; it is a no-op otherwise.
 */
export async function notifyIfSceneTestsStarted(requestId: string): Promise<{ enqueued: boolean }> {
  if (!(await sceneTestsStarted(requestId))) return { enqueued: false };
  return enqueueTaskLifecycleNotification({ requestId, milestone: "scene_tests_started" });
}

/** True while the job page shows its scene ready and under its first tests. Read again at dispatch. */
export async function sceneTestsStarted(requestId: string): Promise<boolean> {
  const [{ readWebsiteSceneProgression }, { siteWalkthroughIdentity }] = await Promise.all([
    import("./websiteSceneProgression"), import("./siteWalkthrough")]);
  return (await readWebsiteSceneProgression(requestId, siteWalkthroughIdentity(requestId).captureId))?.state === "testing";
}

/**
 * Repair a lost `scene_tests_started` enqueue: turn through finished website
 * scene intakes a few at a time and queue only what the job page shows.
 */
export async function reconcileSceneTestsStartedNotices(limit = 5): Promise<void> {
  if (!db) return;
  const store = db;
  const { SCENE_INTAKE_COLLECTION } = await import("./taskEvaluationSceneIntake");
  const query = store.collection(SCENE_INTAKE_COLLECTION).where("state", "==", "completed");
  let rows = await automationBatch(store, query, "scene_tests_started_notices", limit);
  if (!rows.docs.length) rows = await automationBatch(store, query, "scene_tests_started_notices", limit);
  for (const row of rows.docs) {
    const requestId = String(row.data()?.website_request_id ?? "").trim();
    if (!requestId) continue;
    try {
      if ((await store.collection(CAPTURE_OUTBOX_COLLECTION).doc(`${requestId}:scene_tests_started`).get()).exists) continue;
      await notifyIfSceneTestsStarted(requestId);
    } catch (error) {
      logger.warn({ error, requestId }, "Could not queue the scene-tests notice");
    }
  }
}

/**
 * The website job whose configured scene a policy run used, if any: the
 * launch's task is a website scene intake's task, in the same team.
 */
export async function notifySceneTestsStartedForLaunch(launchId: string): Promise<void> {
  if (!db) return;
  const launch = (await db.collection("taskEvaluationLaunches").doc(launchId).get()).data();
  const offering = launch?.configured_scene_offering;
  const taskId = offering?.task?.identity?.id;
  if (typeof taskId !== "string" || !/^website-[a-f0-9]{20}(?:-development)?$/.test(taskId)) return;
  const [{ SCENE_INTAKE_COLLECTION }, { queryPages }] = await Promise.all([
    import("./taskEvaluationSceneIntake"), import("./websiteSceneProgression")]);
  const requestIds = new Set<string>();
  for await (const rows of queryPages(db.collection(SCENE_INTAKE_COLLECTION).where("request.task.task_id", "==", taskId))) {
    for (const row of rows.map(value => value.data())) {
      if (row?.request?.owner?.organization_id === offering.team_namespace && typeof row.website_request_id === "string")
        requestIds.add(row.website_request_id);
    }
  }
  for (const requestId of requestIds) await notifyIfSceneTestsStarted(requestId);
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
