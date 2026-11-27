/**
 * The job's outlook: ONE decision over everything that can end a job, used by the job page (through the status
 * route), the sharing routes and every answer email, so none of them works out "is a test still coming?" on its own
 * (independent review, 2026-11-11).
 *
 * Phases:
 * - `reading`: the video is being read.
 * - `building`: on the way to a simulation and no ending recorded (before the Pipeline's first status, preparing,
 *   waiting on capacity, awaiting inputs, a retryable failure, handed off, a scene built with no run yet, and any
 *   state that is unknown or unreadable).
 * - `simulation_ready`: the simulation of the site is ready, and no ending recorded: the scene is ready, or the job's
 *   simulation package is delivered to the website (`storedCompanySimulation`, the same stored fact that gives an
 *   approved deployment company "Download the simulation"), a room package without the job's object included. There is no "testing" or "result"
 *   phase: Blueprint runs no robot software in the simulation (dropped 2026-11-14; ledger AL29).
 * - `no_test`: an ending is recorded and no result exists; the paper check is the answer, with `sentence`.
 * - `ended_by_site`: the site withdrew recording permission or closed the run; never building, never an answer email.
 *
 * Holds that retry by themselves are not endings (a scene outcome that is a wait). The job window bounds `building`: once
 * its ending is recorded the job is `no_test`, unless its simulation package was already delivered, which stays
 * `simulation_ready` (companies can still download it).
 */
import { RUN_ENDED_WITHOUT_RESULT, testNotRunLine, type SimulationProof } from "../../client/src/lib/simulationProof";
import { REASON_UNSIZED, type SiteAnswer } from "../../client/src/lib/siteAnswer";
// Static, as every other store reader: a dynamic import of this module can bind its admin handle before it is set.
import { dbAdmin } from "../../client/src/lib/firebaseAdmin";
import type { PublicWebsitePreparationStatus } from "./websitePreparationStatus";
import type { TaskSceneProgression } from "./taskStatusProjection";
import type { SiteTaskBriefRecord } from "./siteTaskBrief";

export { OUTLOOK_SENTENCES, type JobOutlook, type JobOutlookReason, type JobPhase } from "../../client/src/lib/jobOutlook";
import { OUTLOOK_SENTENCES, type JobOutlook, type JobOutlookReason, type JobPhase } from "../../client/src/lib/jobOutlook";

export interface JobOutlookInput {
  consentRevoked: boolean;
  closedByOwner: boolean;
  /** The composed answer's state, and whether its reason is the unsized video. */
  answer: { state: "reading" | "ready" | "cannot_assess"; unsized: boolean; reason: string | null } | null;
  /** The window sweep recorded the job window's ending. */
  windowEnded: boolean;
  /** The no-grant sweep recorded the end of the job's wait for a grant. */
  noGrantEnded: boolean;
  /** The Pipeline's preparation status, as verified. */
  preparation: { state: string; geometryOnlyEnd: boolean; terminalReason?: string | null } | null;
  /** The scene's progression after hand-off; `attemptFailed` when a build attempt failed and another is coming. */
  scene: { state: string; attemptFailed?: boolean; endingKind?: string } | null;
  /**
   * The job's simulation package is stored for its current capture and verifies (`storedCompanySimulation`), as a
   * company's page reads it before offering the download. A room package counts: nothing more may be built for the job.
   */
  simulationDelivered?: boolean;
  /** The verified preview for this capture ended at the job's cap before a native scene was built. */
  atlasSpendingCapReached?: boolean;
  /** The job's simulation proof (`projectSimulationProof`), or null when there is no evaluation to read. */
  proof: SimulationProof | null;
  /** Something the decision needs could not be read. An unknown is never an ending, and never hides a recorded one. */
  uncertain?: boolean;
  /** When the job's grant window ended, if it has (`websiteJobWorkWindow`); null while it is open or with no grant. */
  windowEndedAtEpoch?: number | null;
  /** The current run's own record says the window's end stopped it (`beta_screening_authority_expired`). */
  runStoppedByWindow?: boolean;
  /** The job's results could not be read: a result may exist. */
  resultUnknown?: boolean;
  /** The time the decision is made, for tests; now otherwise. */
  nowEpoch?: number;
  /** The Pipeline says the job has no sentence to prepare from, and the site has not given one since. */
  awaitsSiteSentence?: boolean;
}

/**
 * How long after the job's window ends a run record that still says "running" counts as live. The Pipeline stops a
 * run at that deadline (`beta_screening_authority_expired`, its screening control); past this grace the record is
 * stale, and the window's ending applies like any other.
 */
export const LIVE_RUN_GRACE_SECONDS = 6 * 60 * 60;

/**
 * The outlook from what the job's records say. Pure.
 *
 * Rule (review, 2026-11-11): when unsure, the job is still being worked on. Only a positively recorded ending gives
 * the site its answer (the paper check, the button, the paper email). Every other state, missing value, unreadable
 * record or state name never seen before is `building` or `simulation_ready`. The recorded endings, and only these:
 * - recording permission withdrawn; the run closed by the owner (the site's own: `ended_by_site`);
 * - a finished evaluation: a result when it scored an AI robot, else "no AI robot could be scored";
 * - an evaluation record in a terminal state, or held (`could_not_run`);
 * - a scene outcome recorded as final (`held`, `ended`);
 * - preparation `failed_terminal`, and the Pipeline's `authority_ended`;
 * - the job window's ending, and the no-grant wait's ending, each written by its sweep, whatever the job's kind;
 * - a robot-fit-only end recorded by the Pipeline;
 * - the video reader's final "cannot size this job".
 */
export function jobOutlook(input: JobOutlookInput): JobOutlook {
  const outlook = (phase: JobPhase, reason: JobOutlookReason | null = null, sentence?: string | null): JobOutlook =>
    ({ phase, reason, sentence: sentence !== undefined ? sentence : reason && reason in OUTLOOK_SENTENCES
      ? OUTLOOK_SENTENCES[reason as keyof typeof OUTLOOK_SENTENCES] : null });
  // The site's own endings come first: never building, never an answer.
  if (input.consentRevoked === true) return outlook("ended_by_site", "permission_withdrawn");
  if (input.closedByOwner === true) return outlook("ended_by_site", "closed_by_owner");
  const working = (): JobOutlook => input.scene?.state === "ready" || input.simulationDelivered === true ? outlook("simulation_ready")
    : outlook("building", input.preparation?.state === "failed_retryable" || input.scene?.attemptFailed ? "step_failed" : null);
  // Ordered by where each fact lives (review, 2026-11-11): the facts recorded on the website's side first (above, the
  // site's own endings; then every recorded ending). A read that failed elsewhere (`uncertain`) never hides one of
  // them; it only keeps a job with none of them working.
  const ending = recordedEndingOf(input);
  if (ending?.reason === "spending_cap_reached") return ending;
  // A package already delivered outlives the job's time running out: it stays stored and approved companies can still
  // download it, so the site reads that its simulation is ready, not that time ran out (outreach audit D4, 2026-11-27).
  if (input.simulationDelivered === true && ending?.reason && TIME_ENDINGS.has(ending.reason)) return outlook("simulation_ready");
  // Once the job's time has run out nothing reads its video any more (`captureCoverageQueue.ts` ends the reading), so
  // "We're watching your video." would not be true: the ending is said instead.
  if (ending?.reason === "window_expired" || ending?.reason === "no_grant") return ending;
  if (!input.answer || input.answer.state === "reading") return outlook("reading");
  // Waiting for the site to name its job: neither building nor an ending.
  return ending ?? (input.awaitsSiteSentence === true ? outlook("waiting_on_site", "task_not_named") : working());
}

/** Endings that say only that the job's time or authority ran out: none of them takes back a delivered package. */
const TIME_ENDINGS: ReadonlySet<JobOutlookReason> = new Set(["window_expired", "authority_ended", "job_ended", "no_grant",
  "window_ended_during_test"]);

/**
 * A run is live only on positive evidence: a run record in a running state (or queued with its plan), and never past
 * the job's window plus the grace the Pipeline takes to stop it. A stored scene that says "testing" with no run record
 * is not evidence.
 */
const liveRun = (input: JobOutlookInput) => {
  const running = input.proof?.state === "running" || (input.proof?.state === "preparing" && input.proof.options.entered > 0);
  const now = input.nowEpoch ?? Date.now() / 1000;
  const stale = typeof input.windowEndedAtEpoch === "number" && now > input.windowEndedAtEpoch + LIVE_RUN_GRACE_SECONDS;
  return running && !stale;
};

/**
 * The job's recorded ending, or null, whatever the answer's state: each test is a positive record, and nothing
 * missing is ever read as one. The answer emails use it to give the ending's reason once a reading ran out.
 */
export function recordedEndingOf(input: JobOutlookInput): JobOutlook | null {
  if (liveRun(input)) return null;
  return recordedEnding(input, (phase, reason = null, sentence) => ({ phase, reason,
    sentence: sentence !== undefined ? sentence : reason && reason in OUTLOOK_SENTENCES
      ? OUTLOOK_SENTENCES[reason as keyof typeof OUTLOOK_SENTENCES] : null }));
}

/** The job's recorded ending, or null. Each test is a positive record; nothing missing is ever read as one. */
function recordedEnding(input: JobOutlookInput,
  outlook: (phase: JobPhase, reason?: JobOutlookReason | null, sentence?: string | null) => JobOutlook): JobOutlook | null {
  const { proof, answer } = input;
  if (proof?.state === "done") return outlook("no_test", "no_ai_robot_scored", testNotRunLine(proof) ?? undefined);
  if (proof?.state === "could_not_run") {
    const ended = proof.headline === RUN_ENDED_WITHOUT_RESULT;
    // Only the run's own record that the window's end stopped it says so; anything else gives the run's own line.
    if (ended && input.runStoppedByWindow === true) return outlook("no_test", "window_ended_during_test");
    return outlook("no_test", ended ? "run_ended" : "run_held", testNotRunLine(proof));
  }
  if (input.scene?.state === "held") return outlook("no_test", "scene_held");
  if (input.scene?.state === "ended" && input.scene.endingKind === "spending_cap_reached"
    || input.atlasSpendingCapReached === true && input.preparation?.state !== "handed_off")
    return outlook("no_test", "spending_cap_reached");
  // An ending whose kind this release does not know (`stopped`): it says only that the simulation stopped.
  if (input.scene?.state === "ended") return outlook("no_test", input.scene.endingKind === "stopped" ? "simulation_stopped" : "scene_stopped");
  // `capacity_blocked` covers every cause the Pipeline sends it for (its disk or staging stayed short; the job waited
  // for room until its grant ran out): all ours, so it is said as ours.
  if (input.preparation?.state === "failed_terminal")
    return outlook("no_test", input.preparation.terminalReason === "capacity_blocked" ? "not_processed_in_time" : "preparation_failed");
  // The Pipeline's status names no reason for an ended authority. A revoked source is the site's own withdrawal,
  // decided above; a job whose window ending is recorded says its time ran out; anything else says only that it ended.
  if (input.preparation?.state === "authority_ended") return outlook("no_test", input.windowEnded === true ? "authority_ended" : "job_ended");
  if (input.windowEnded === true) return outlook("no_test", "window_expired");
  if (input.noGrantEnded === true) return outlook("no_test", "no_grant");
  if (input.preparation?.geometryOnlyEnd === true) return outlook("no_test", "robot_fit_only");
  if (answer?.state === "cannot_assess" && answer.unsized) return outlook("no_test", "unsized");
  return null;
}

export { outlookHasAnswer } from "../../client/src/lib/jobOutlook";
const RECORDED_PHASES: ReadonlySet<string> = new Set(["ended_by_site", "no_test"]);

/** The answer's part of the outlook input. */
export const outlookAnswerOf = (answer: SiteAnswer | null | undefined): JobOutlookInput["answer"] => answer
  ? { state: answer.state, unsized: answer.state === "cannot_assess" && answer.reason === REASON_UNSIZED, reason: answer.reason ?? null } : null;

/**
 * What a caller has already read for this job, so the outlook does not read it again (the status route: one Pipeline
 * preparation read per status request). Each value is as the standalone loader would have read it; a promise is
 * awaited, and one that rejects counts as a read that failed, exactly as it does there.
 */
export interface JobOutlookKnownReads {
  /** `inboundRequests/{id}` as stored. */
  record: Record<string, any>;
  /** The capture the caller read under; the reads are used only when it is the job's current capture. */
  captureId: string;
  /** `captureUploadSessions/{captureId}` as read (undefined when the document does not exist). */
  session: Record<string, any> | undefined;
  /** The Pipeline's verified preparation status, read when the session holds a website preparation. */
  preparationStatus: PublicWebsitePreparationStatus | null;
  /** The scene's progression, read when the preparation is handed off. */
  sceneProgression: TaskSceneProgression | null | PromiseLike<TaskSceneProgression | null>;
  /** The job's answer as composed from its records; null, or a rejection, when it could not be composed. */
  answer: SiteAnswer | null | PromiseLike<SiteAnswer | null>;
  /** The job's brief as read. */
  brief: SiteTaskBriefRecord | null;
}

/**
 * The outlook read from the job's stored records and the Pipeline's verified status, for callers that hold none of
 * them (the answer emails at queue and dispatch, the sharing routes). The status route passes what it has already
 * read (`known`), so the outlook makes no second Pipeline read.
 */
export async function loadJobOutlook(requestId: string, known?: JobOutlookKnownReads): Promise<JobOutlook> {
  return (await decideJobOutlook(requestId, known, true)).outlook;
}

/**
 * The outlook and whether every read it rests on succeeded. A read that fails is "unknown", never an ending: the
 * outlook is then the working one, and a caller that must not act on an unknown (the dispatch check) sees `certain`
 * false. Throws only when the job's own record cannot be read.
 */
export async function loadJobOutlookDecision(requestId: string, known?: JobOutlookKnownReads):
  Promise<{ outlook: JobOutlook; certain: boolean; ending: JobOutlook | null; resultUnknown: boolean }> {
  return decideJobOutlook(requestId, known, false);
}

/** `outlookOnly`: the caller uses the outlook alone, so a withdrawal (the outlook's first rule) ends the reads there. */
async function decideJobOutlook(requestId: string, known: JobOutlookKnownReads | undefined, outlookOnly: boolean):
  Promise<{ outlook: JobOutlook; certain: boolean; ending: JobOutlook | null; resultUnknown: boolean }> {
  const [{ siteWalkthroughIdentity }, { projectWebsiteCaptureRights }, { websiteRunClosure },
    { recordedWebsiteJobWindowEnding, recordedWebsiteJobNoGrantEnding }, { loadSiteAnswer },
    { atlasPreviewReachedSpendingCap, selectWebsiteAtlasPreview }, { storedCompanySimulation }] = await Promise.all([
    import("./siteWalkthrough"), import("./websiteCaptureRights"),
    import("./websiteRunClosure"), import("./websiteJobWindowEnding"), import("./siteAnswer"), import("./websiteAtlasPreview"),
    import("./websiteCompanySimulation")]);
  if (!dbAdmin) throw new Error("job_outlook_unavailable");
  // What the caller read is used only for the job's current capture; otherwise every read is made here.
  const given = known && known.captureId === siteWalkthroughIdentity(requestId, known.record).captureId ? known : undefined;
  const record = given ? given.record : (await dbAdmin.collection("inboundRequests").doc(requestId).get()).data();
  if (!record) throw new Error("job_outlook_request_missing");
  // Withdrawn: the outlook is `ended_by_site` whatever else is read (`jobOutlook`), so nothing else is read for it.
  if (outlookOnly && projectWebsiteCaptureRights(record).consent_revoked) {
    const input: JobOutlookInput = { consentRevoked: true, closedByOwner: false, answer: null, windowEnded: false,
      noGrantEnded: false, preparation: null, scene: null, proof: null };
    return { outlook: jobOutlook(input), certain: true, ending: null, resultUnknown: false };
  }
  let uncertain = false;
  const { captureId } = siteWalkthroughIdentity(requestId, record);
  const session = given ? given.session : await dbAdmin.collection("captureUploadSessions").doc(captureId).get()
    .then(snapshot => snapshot.data()).catch(() => { uncertain = true; return undefined; });
  let preparation: JobOutlookInput["preparation"] = null;
  let preparationTaskNotNamed = false;
  let scene: JobOutlookInput["scene"] = null;
  if (session?.website_preparation) {
    const status = given ? given.preparationStatus : await import("./websitePreparationStatus")
      .then(({ loadCurrentWebsitePreparationStatus }) => loadCurrentWebsitePreparationStatus(requestId, captureId)).catch(() => null);
    // A status that cannot be read or verified is unknown, not "before its first status".
    if (!status || status.state === "unavailable") uncertain = true;
    preparation = status ? { state: status.state, geometryOnlyEnd: status.state === "awaiting_inputs" && status.robotFit?.route === "geometry_only",
      terminalReason: status.terminalReason ?? null } : null;
    preparationTaskNotNamed = status?.taskNotNamed === true;
    if (status?.state === "handed_off") {
      const read = given ? Promise.resolve(given.sceneProgression)
        : import("./websiteSceneProgression").then(({ loadWebsiteSceneProgression }) => loadWebsiteSceneProgression(requestId, captureId));
      const progression = await read.then(value => ({ value }))
        .catch(() => { uncertain = true; return { value: null }; });
      scene = progression.value ? { state: progression.value.state,
        attemptFailed: progression.value.attemptFailed === true,
        ...(progression.value.sceneOutcome ? { endingKind: progression.value.sceneOutcome.kind } : {}) } : null;
    }
  }
  // The remaining reads do not depend on each other: they run together.
  const readAwaitsSiteSentence = async () => {
    const [{ jobWaitsForItsSentence }, { getBrief, isPlaceholderSummary }] = await Promise.all([import("./jobSentenceWait"), import("./siteTaskBrief")]);
    // An unreadable brief is no proof the site has not answered: the job is not shown as waiting on it.
    const brief = given ? { value: given.brief } : await getBrief(requestId).then(value => ({ value }), () => null);
    return brief !== null && jobWaitsForItsSentence({ requestId, record, brief: brief.value, preparationTaskNotNamed, isPlaceholder: isPlaceholderSummary });
  };
  const [answer, windowEndedAtEpoch, awaitsSiteSentence] = await Promise.all([
    (given ? Promise.resolve(given.answer) : loadSiteAnswer(requestId)).catch(() => null),
    import("./websiteSceneSponsorship").then(({ websiteJobWorkWindow }) => websiteJobWorkWindow(record))
      .then(window => window.endedAtEpoch ?? null).catch(() => null),
    readAwaitsSiteSentence(),
  ]);
  // Blueprint's own early trial is no longer read (2026-11-14): no run of it starts, ends or holds a job's outlook.
  const proof: SimulationProof | null = null;
  const runStoppedByWindow = false;
  const resultUnknown = false;
  // A closure record that does not read is unknown: neither closed nor open.
  let closedByOwner = false;
  try { closedByOwner = Boolean(websiteRunClosure(record, requestId, captureId)); } catch { uncertain = true; }
  const input: JobOutlookInput = {
    consentRevoked: projectWebsiteCaptureRights(record).consent_revoked,
    closedByOwner,
    answer: outlookAnswerOf(answer),
    windowEnded: Boolean(recordedWebsiteJobWindowEnding(record)),
    noGrantEnded: Boolean(recordedWebsiteJobNoGrantEnding(record, requestId)),
    windowEndedAtEpoch,
    runStoppedByWindow, resultUnknown,
    awaitsSiteSentence,
    atlasSpendingCapReached: atlasPreviewReachedSpendingCap(selectWebsiteAtlasPreview(record, captureId)),
    simulationDelivered: storedCompanySimulation(session, captureId) !== null,
    preparation, scene, proof, uncertain,
  };
  const outlook = jobOutlook(input);
  // A recorded fact (the site's own ending, a recorded ending) is certain whatever else could not be read.
  return { outlook, certain: !uncertain || RECORDED_PHASES.has(outlook.phase), ending: recordedEndingOf(input), resultUnknown };
}
