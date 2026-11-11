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
 * - `testing`: a run is queued with a plan, running, or its scene reports a test, and no ending recorded.
 * - `result`: a published test result scored at least one AI robot.
 * - `no_test`: an ending is recorded and no result exists; the paper check is the answer, with `sentence`.
 * - `cannot_match`: another kind of job, with no grant at the end of the no-grant wait.
 * - `ended_by_site`: the site withdrew recording permission or closed the run; never building, never an answer email.
 *
 * Holds that retry by themselves are not endings (the screening outcome `setup_repair`, a scene outcome that is a
 * wait, `awaiting_spend_approval`). The job window bounds `building` and `testing`: once its ending is recorded the
 * job is `no_test`.
 */
import { RUN_ENDED_WITHOUT_RESULT, testNotRunLine, type SimulationProof } from "../../client/src/lib/simulationProof";
import { REASON_UNSIZED, type SiteAnswer } from "../../client/src/lib/siteAnswer";
// Static, as every other store reader: a dynamic import of this module can bind its admin handle before it is set.
import { dbAdmin } from "../../client/src/lib/firebaseAdmin";

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
  /** A job of a kind we can't simulate yet, with no grant: the no-grant sweep keeps it on file (`websiteJobKeptOnFile`). */
  keptOnFile?: boolean;
  /** The Pipeline's preparation status, as verified. */
  preparation: { state: string; geometryOnlyEnd: boolean } | null;
  /** The scene's progression after hand-off; `waiting` when its test waits on an outcome (approval, a re-plan);
   * `attemptFailed` when a build attempt failed and another is coming. */
  scene: { state: string; waiting?: boolean; attemptFailed?: boolean } | null;
  /** The job's simulation proof (`projectSimulationProof`), or null when there is no evaluation to read. */
  proof: SimulationProof | null;
  /** Something the decision needs could not be read. An unknown is never an ending, and never hides a recorded one. */
  uncertain?: boolean;
  /** The job's grant window has passed (`websiteJobWorkWindow`). */
  windowPassed?: boolean;
}

/**
 * Whether a finished test scored at least one AI robot: only that is a result. A finished test that scored none is an
 * ending ("no AI robot could be scored"), never a result.
 */
export const proofScoredAnyRobot = (proof: SimulationProof | null | undefined) =>
  proof?.state === "done" && proof.options.options.some(option => option.scored > 0);

/**
 * The outlook from what the job's records say. Pure.
 *
 * Rule (review, 2026-11-11): when unsure, the job is still being worked on. Only a positively recorded ending gives
 * the site its answer (the paper check, the button, the paper email). Every other state, missing value, unreadable
 * record or state name never seen before is `building` or `testing`. The recorded endings, and only these:
 * - recording permission withdrawn; the run closed by the owner (the site's own: `ended_by_site`);
 * - a finished evaluation: a result when it scored an AI robot, else "no AI robot could be scored";
 * - an evaluation record in a terminal state, or held (`could_not_run`);
 * - a scene outcome recorded as final (`held`, `ended`);
 * - preparation `failed_terminal`, and the Pipeline's `authority_ended`;
 * - a job of a kind we can't simulate yet kept on file by the no-grant sweep (`cannot_match`);
 * - the job window's ending, and the no-grant wait's ending, each written by its sweep (another kind of job, with
 *   no grant at the end of that wait, is `cannot_match`);
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
  const proof = input.proof;
  const working = (): JobOutlook => {
    const testing = proof?.state === "running" || (proof?.state === "preparing" && proof.options.entered > 0)
      || input.scene?.state === "testing" || input.scene?.state === "evaluated" || proof?.state === "done";
    return testing ? outlook("testing")
      : outlook("building", input.preparation?.state === "failed_retryable" || input.scene?.attemptFailed ? "step_failed" : null);
  };
  // Ordered by where each fact lives (review, 2026-11-11): the facts recorded on the website's side first (above, the
  // site's own endings; then a published scored result; then every recorded ending). A read that failed elsewhere
  // (`uncertain`) never hides one of them; it only keeps a job with none of them working.
  if (proofScoredAnyRobot(proof)) return outlook("result");
  if (!input.answer || input.answer.state === "reading") return outlook("reading");
  // A live run is testing, whatever the clock says: the window's end stops it through its own authority, and the run's
  // terminal record then says so (`window_ended_during_test`).
  if (liveRun(input)) return outlook("testing");
  return recordedEndingOf(input) ?? working();
}

/** A run queued with its plan or running, or a scene that reports a test under way. */
const liveRun = (input: JobOutlookInput) => input.proof?.state === "running"
  || (input.proof?.state === "preparing" && input.proof.options.entered > 0) || (input.scene?.state === "testing" && !input.scene.waiting);

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
    // A run that ended after the job's time ran out: the window's end stopped it, and it says so.
    if (ended && input.windowPassed === true) return outlook("no_test", "window_ended_during_test");
    return outlook("no_test", ended ? "run_ended" : "run_held", testNotRunLine(proof));
  }
  if (input.scene?.state === "held") return outlook("no_test", "scene_held");
  if (input.scene?.state === "ended") return outlook("no_test", "scene_stopped");
  if (input.preparation?.state === "failed_terminal") return outlook("no_test", "preparation_failed");
  // The Pipeline's status names no reason for an ended authority. A revoked source is the site's own withdrawal,
  // decided above; a job whose time ran out says so; anything else says only that the job ended.
  if (input.preparation?.state === "authority_ended") return outlook("no_test", input.windowPassed === true ? "authority_ended" : "job_ended");
  if (input.windowEnded === true) return outlook("no_test", "window_expired");
  if (input.keptOnFile === true) return outlook("cannot_match", "kept_on_file");
  if (input.noGrantEnded === true) return answer?.state === "cannot_assess" && !answer.unsized && answer.reason
    ? outlook("cannot_match", "other_kind", answer.reason) : outlook("no_test", "no_grant");
  if (input.preparation?.geometryOnlyEnd === true) return outlook("no_test", "robot_fit_only");
  if (answer?.state === "cannot_assess" && answer.unsized) return outlook("no_test", "unsized");
  return null;
}

export { outlookHasAnswer } from "../../client/src/lib/jobOutlook";
const RECORDED_PHASES: ReadonlySet<string> = new Set(["ended_by_site", "result", "no_test", "cannot_match"]);

/** The answer's part of the outlook input. */
export const outlookAnswerOf = (answer: SiteAnswer | null | undefined): JobOutlookInput["answer"] => answer
  ? { state: answer.state, unsized: answer.state === "cannot_assess" && answer.reason === REASON_UNSIZED, reason: answer.reason ?? null } : null;

/**
 * The outlook read from the job's stored records and the Pipeline's verified status, for callers that hold none of
 * them (the answer emails at queue and dispatch, the sharing routes). The status route builds the same input from
 * what it has already read.
 */
export async function loadJobOutlook(requestId: string): Promise<JobOutlook> {
  return (await loadJobOutlookDecision(requestId)).outlook;
}

/**
 * The outlook and whether every read it rests on succeeded. A read that fails is "unknown", never an ending: the
 * outlook is then the working one, and a caller that must not act on an unknown (the dispatch check) sees `certain`
 * false. Throws only when the job's own record cannot be read.
 */
export async function loadJobOutlookDecision(requestId: string):
  Promise<{ outlook: JobOutlook; certain: boolean; ending: JobOutlook | null }> {
  const [{ siteWalkthroughIdentity }, { projectWebsiteCaptureRights }, { websiteRunClosure },
    { recordedWebsiteJobWindowEnding, recordedWebsiteJobNoGrantEnding }, { loadSiteAnswer }] = await Promise.all([
    import("./siteWalkthrough"), import("./websiteTaskContext"),
    import("./websiteRunClosure"), import("./websiteJobWindowEnding"), import("./siteAnswer")]);
  if (!dbAdmin) throw new Error("job_outlook_unavailable");
  const record = (await dbAdmin.collection("inboundRequests").doc(requestId).get()).data();
  if (!record) throw new Error("job_outlook_request_missing");
  let uncertain = false;
  const { captureId } = siteWalkthroughIdentity(requestId, record);
  const session = await dbAdmin.collection("captureUploadSessions").doc(captureId).get()
    .then(snapshot => snapshot.data()).catch(() => { uncertain = true; return undefined; });
  let preparation: JobOutlookInput["preparation"] = null;
  let scene: JobOutlookInput["scene"] = null;
  if (session?.website_preparation) {
    const { loadCurrentWebsitePreparationStatus } = await import("./websitePreparationStatus");
    const status = await loadCurrentWebsitePreparationStatus(requestId, captureId).catch(() => null);
    // A status that cannot be read or verified is unknown, not "before its first status".
    if (!status || status.state === "unavailable") uncertain = true;
    preparation = status ? { state: status.state, geometryOnlyEnd: status.state === "awaiting_inputs" && status.robotFit?.route === "geometry_only" } : null;
    if (status?.state === "handed_off") {
      const { loadWebsiteSceneProgression } = await import("./websiteSceneProgression");
      const progression = await loadWebsiteSceneProgression(requestId, captureId).then(value => ({ value }))
        .catch(() => { uncertain = true; return { value: null }; });
      scene = progression.value ? { state: progression.value.state, waiting: Boolean(progression.value.progressOutcome),
        attemptFailed: progression.value.attemptFailed === true } : null;
    }
  }
  let proof: SimulationProof | null = null;
  try {
    const [{ readSiteManagedEvidence }, { projectSimulationProof }] = await Promise.all([
      import("./siteManagedEvidence"), import("../../client/src/lib/simulationProof")]);
    const { managedEvidence, managedEvidenceUnavailable } = await readSiteManagedEvidence(requestId);
    if (managedEvidenceUnavailable) uncertain = true;
    proof = managedEvidence.length ? projectSimulationProof({ evaluation: managedEvidence as never, pick: null }) : null;
  } catch { uncertain = true; }
  const answer = await loadSiteAnswer(requestId).catch(() => null);
  // A closure record that does not read is unknown: neither closed nor open.
  let closedByOwner = false;
  try { closedByOwner = Boolean(websiteRunClosure(record, requestId, captureId)); } catch { uncertain = true; }
  const input: JobOutlookInput = {
    consentRevoked: projectWebsiteCaptureRights(record).consent_revoked,
    closedByOwner,
    answer: outlookAnswerOf(answer),
    windowEnded: Boolean(recordedWebsiteJobWindowEnding(record)),
    noGrantEnded: Boolean(recordedWebsiteJobNoGrantEnding(record, requestId)),
    keptOnFile: (await import("./websiteJobWindowSweep")).websiteJobKeptOnFile(record),
    windowPassed: await import("./websiteSceneSponsorship").then(({ websiteJobWorkWindow }) => websiteJobWorkWindow(record))
      .then(window => window.ended).catch(() => false),
    preparation, scene, proof, uncertain,
  };
  const outlook = jobOutlook(input);
  // A recorded fact (the site's own ending, a result, a recorded ending) is certain whatever else could not be read.
  return { outlook, certain: !uncertain || RECORDED_PHASES.has(outlook.phase), ending: recordedEndingOf(input) };
}
