/**
 * The job's outlook: ONE decision over everything that can end a job, used by the job page (through the status
 * route), the sharing routes and every answer email, so none of them works out "is a test still coming?" on its own
 * (independent review, 2026-11-11).
 *
 * Phases:
 * - `reading`: the video is being read.
 * - `building`: the job is on the way to a simulation and nothing has ended it (before the Pipeline's first status,
 *   preparing, waiting on capacity, awaiting inputs, a retryable failure, handed off and not yet testing).
 * - `testing`: a run is queued with a plan, or running, and nothing has ended it.
 * - `result`: a published test result names at least one AI robot.
 * - `no_test`: an ending has been recorded and no result exists; the paper check is the answer, with `sentence`.
 * - `cannot_match`: the reader says it is another kind of job and no simulation is on the way.
 * - `ended_by_site`: the site withdrew recording permission or closed the run; never building, never an answer email.
 *
 * Holds that retry by themselves are not endings (the screening outcome `setup_repair`, a scene outcome that is a
 * wait, `awaiting_spend_approval`); a hold that will not restart by itself is (`held_setup`, `held_budget`,
 * `held_scene_check` and the other held outcomes, a terminal scene `setup_repair`). The job window bounds `building`
 * and `testing`: once it ends, the job is `no_test`.
 */
import { RUN_ENDED_WITHOUT_RESULT, testNotRunLine, type SimulationProof } from "../../client/src/lib/simulationProof";
import { REASON_UNSIZED, type SiteAnswer } from "../../client/src/lib/siteAnswer";
import { sceneScreenGateEnded } from "./sceneScreenGate";
// Static, as every other store reader: a dynamic import of this module can bind its admin handle before it is set.
import { dbAdmin } from "../../client/src/lib/firebaseAdmin";

export { OUTLOOK_SENTENCES, type JobOutlook, type JobOutlookReason, type JobPhase } from "../../client/src/lib/jobOutlook";
import { OUTLOOK_SENTENCES, type JobOutlook, type JobOutlookReason, type JobPhase } from "../../client/src/lib/jobOutlook";

export interface JobOutlookInput {
  consentRevoked: boolean;
  closedByOwner: boolean;
  /** The composed answer's state, and whether its reason is the unsized video. */
  answer: { state: "reading" | "ready" | "cannot_assess"; unsized: boolean; reason: string | null } | null;
  windowEnded: boolean;
  noGrantEnded: boolean;
  /** The site screen refuses the job a grant and no preparation ever started. */
  grantRefused: boolean;
  /** The Pipeline's preparation status, as verified. */
  preparation: { state: string; geometryOnlyEnd: boolean } | null;
  /** The scene's progression after hand-off: its state, and whether its outcome is an ending (not a wait). */
  scene: { state: string } | null;
  /** The job's simulation proof (`projectSimulationProof`), or null when there is no evaluation to read. */
  proof: SimulationProof | null;
}

const BUILDING_PREPARATION = new Set(["preparing", "capacity_delayed", "awaiting_inputs", "failed_retryable", "unavailable"]);
const ENDED_PREPARATION = new Set(["failed_terminal", "authority_ended"]);
const SCENE_ON_THE_WAY = new Set(["waiting", "testing"]);

/** The outlook from what the job's records say. Pure. */
export function jobOutlook(input: JobOutlookInput): JobOutlook {
  const outlook = (phase: JobPhase, reason: JobOutlookReason | null = null, sentence?: string | null): JobOutlook =>
    ({ phase, reason, sentence: sentence !== undefined ? sentence : reason && reason in OUTLOOK_SENTENCES
      ? OUTLOOK_SENTENCES[reason as keyof typeof OUTLOOK_SENTENCES] : null });
  // The site's own endings come first: never building, never an answer.
  if (input.consentRevoked) return outlook("ended_by_site", "permission_withdrawn");
  if (input.closedByOwner) return outlook("ended_by_site", "closed_by_owner");
  const proof = input.proof;
  // A published result that names at least one AI robot is the answer, whatever else has happened since.
  if (proof?.state === "done" && proof.options.options.length > 0) return outlook("result");
  if (input.answer?.state === "reading" || !input.answer) return outlook("reading");
  // Endings with no result: the paper check is the answer.
  if (proof?.state === "done") return outlook("no_test", "no_ai_robot_scored", testNotRunLine(proof));
  if (proof?.state === "could_not_run") return outlook("no_test", proof.headline === RUN_ENDED_WITHOUT_RESULT ? "run_ended" : "run_held", testNotRunLine(proof));
  if (input.scene?.state === "held") return outlook("no_test", "scene_held");
  if (input.scene?.state === "ended") return outlook("no_test", "scene_stopped");
  if (input.preparation && ENDED_PREPARATION.has(input.preparation.state)) return outlook("no_test", "preparation_failed");
  if (input.windowEnded) return outlook("no_test", "window_expired");
  if (input.noGrantEnded || input.grantRefused) return outlook("no_test", "no_grant");
  if (input.preparation?.geometryOnlyEnd) return outlook("no_test", "robot_fit_only");
  if (input.answer.state === "cannot_assess" && input.answer.unsized) return outlook("no_test", "unsized");
  if (input.preparation?.state === "handed_off" && input.scene?.state === "completed"
    && (!proof || proof.state === "not_started")) return outlook("no_test", "built_not_tested");
  // Still on the way: testing once a run is queued with a plan or running, else building.
  const runOnTheWay = proof?.state === "running" || (proof?.state === "preparing" && proof.options.entered > 0);
  const buildOnTheWay = Boolean(input.preparation && (BUILDING_PREPARATION.has(input.preparation.state)
    || input.preparation.state === "handed_off" && (!input.scene || SCENE_ON_THE_WAY.has(input.scene.state) || input.scene.state === "completed")))
    || proof?.state === "preparing";
  // Another kind of job with no simulation on the way: the reader's own reason is the answer.
  if (input.answer.state === "cannot_assess" && !runOnTheWay && !buildOnTheWay) return outlook("cannot_match", "other_kind", input.answer.reason);
  if (runOnTheWay) return outlook("testing");
  return outlook("building", input.preparation?.state === "failed_retryable" ? "step_failed" : null);
}

export { outlookHasAnswer } from "../../client/src/lib/jobOutlook";

/** The answer's part of the outlook input. */
export const outlookAnswerOf = (answer: SiteAnswer | null | undefined): JobOutlookInput["answer"] => answer
  ? { state: answer.state, unsized: answer.state === "cannot_assess" && answer.reason === REASON_UNSIZED, reason: answer.reason ?? null } : null;

/**
 * The outlook read from the job's stored records and the Pipeline's verified status, for callers that hold none of
 * them (the answer emails at queue and dispatch, the sharing routes). The status route builds the same input from
 * what it has already read.
 */
export async function loadJobOutlook(requestId: string): Promise<JobOutlook> {
  const [{ siteWalkthroughIdentity }, { projectWebsiteCaptureRights }, { websiteRunClosure },
    { recordedWebsiteJobWindowEnding, recordedWebsiteJobNoGrantEnding }, { loadSiteAnswer }] = await Promise.all([
    import("./siteWalkthrough"), import("./websiteTaskContext"),
    import("./websiteRunClosure"), import("./websiteJobWindowEnding"), import("./siteAnswer")]);
  if (!dbAdmin) throw new Error("job_outlook_unavailable");
  const record = (await dbAdmin.collection("inboundRequests").doc(requestId).get()).data();
  if (!record) throw new Error("job_outlook_request_missing");
  const { captureId } = siteWalkthroughIdentity(requestId, record);
  const session = (await dbAdmin.collection("captureUploadSessions").doc(captureId).get()).data();
  let preparation: JobOutlookInput["preparation"] = null;
  let scene: JobOutlookInput["scene"] = null;
  if (session?.website_preparation) {
    const { loadCurrentWebsitePreparationStatus } = await import("./websitePreparationStatus");
    // The status route reads no preparation status for a video sent before the job had an account, and a read that
    // cannot be verified is no status at all: either way the job is read as before its first status.
    const status = await loadCurrentWebsitePreparationStatus(requestId, captureId).catch(() => null);
    preparation = status ? { state: status.state, geometryOnlyEnd: status.state === "awaiting_inputs" && status.robotFit?.route === "geometry_only" } : null;
    if (status?.state === "handed_off") {
      const { loadWebsiteSceneProgression } = await import("./websiteSceneProgression");
      const progression = await loadWebsiteSceneProgression(requestId, captureId).catch(() => null);
      scene = progression ? { state: progression.state } : null;
    }
  }
  let proof: SimulationProof | null = null;
  try {
    const [{ readSiteManagedEvidence }, { projectSimulationProof }] = await Promise.all([
      import("./siteManagedEvidence"), import("../../client/src/lib/simulationProof")]);
    const { managedEvidence } = await readSiteManagedEvidence(requestId);
    proof = managedEvidence.length ? projectSimulationProof({ evaluation: managedEvidence as never, pick: null }) : null;
  } catch { proof = null; }
  const answer = await loadSiteAnswer(requestId).catch(() => null);
  return jobOutlook({
    consentRevoked: projectWebsiteCaptureRights(record).consent_revoked,
    closedByOwner: Boolean(websiteRunClosure(record, requestId, captureId)),
    answer: outlookAnswerOf(answer),
    windowEnded: Boolean(recordedWebsiteJobWindowEnding(record)),
    noGrantEnded: Boolean(recordedWebsiteJobNoGrantEnding(record, requestId)),
    // The screen gates nothing for a job carrying the 2026-11-11 marker: such a job is built, so it is never refused.
    grantRefused: !record.website_scene_sponsorship && !session?.website_preparation && record.site_task_triage?.disposition === "not_now"
      && !sceneScreenGateEnded(record, requestId),
    preparation, scene, proof,
  });
}
