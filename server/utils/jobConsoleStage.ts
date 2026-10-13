/**
 * Where one site job stands in the beta loop, and what moves it next.
 *
 * The loop, in order: a site shows one job (intake, brief, capture, public
 * card); approved robot teams ask to evaluate it; Blueprint admits each free
 * evaluation; runs report; Blueprint recommends one team whose evaluation
 * passed; the site books it in one step; Blueprint coordinates the pilot.
 *
 * Pure on purpose. The founder runs this loop by hand, and the console's only
 * job is to say, for every site, which step is next and whose it is. Keeping
 * the rule here, away from Firestore, means it can be tested exhaustively and
 * read in one place when someone asks why a row says what it says.
 *
 * Nothing here decides anything. "Recommend a team" is a prompt for a person;
 * the recommendation itself goes through the existing operator form.
 */

import type {
  ActionOwner,
  JobFacts,
  JobStage,
  JobStageResult,
  WithdrawalState,
} from "../../client/src/types/jobConsole";

export * from "../../client/src/types/jobConsole";

function plural(count: number, one: string, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}

function teamLabel(name: string | null | undefined) {
  return name && name.trim() ? name.trim() : "the requesting team";
}

/** Derive the single stage and next action for one job. */
export function deriveJobStage(facts: JobFacts): JobStageResult {
  const attention: string[] = [];
  if (facts.opsNotice && !["resolved", "closed", "dismissed"].includes(facts.opsNotice.state)) {
    attention.push(`Ops notice: ${facts.opsNotice.summary || facts.opsNotice.state}`);
  }
  if (!facts.claimed) attention.push("Site has not claimed the job in an account");
  if (facts.listing.state === "review_required") attention.push("Public card needs the site's re-approval");

  const result = (stage: JobStage, nextAction: string, actionOwner: ActionOwner): JobStageResult =>
    ({ stage, nextAction, actionOwner, attention });

  // Withdrawal overrides every downstream state: no evaluation, recommendation
  // or booking may proceed on a recording the site took back.
  if (facts.withdrawal.state !== "none") {
    const wording: Record<Exclude<WithdrawalState, "none">, string> = {
      requested: "Confirm the capture withdrawal reached the Pipeline",
      cleanup_pending: "Confirm capture withdrawal cleanup",
      external_pending: "Confirm external copies of the capture are removed",
      legal_hold: "Recording withdrawn; cleanup is under legal hold",
      complete: "No action: recording withdrawn and cleanup confirmed",
    };
    return result("withdrawn", wording[facts.withdrawal.state],
      ["legal_hold", "complete"].includes(facts.withdrawal.state) ? "none" : "blueprint");
  }
  if (facts.archived) return result("closed", "No action: the site archived this job", "none");

  // Booking and recommendation: the end of the loop wins over anything earlier.
  if (facts.booking.state === "scheduled") {
    return result("scheduled",
      facts.booking.startsAt ? `Pilot scheduled for ${facts.booking.startsAt.slice(0, 10)}` : "Pilot scheduled",
      "none");
  }
  if (facts.booking.state === "awaiting_coordination" || facts.booking.state === "booked") {
    if (facts.recommendation.state === "review_required") {
      return result("coordination", "Reconcile the changed job with the accepted pilot before scheduling", "blueprint");
    }
    if (facts.booking.state === "booked") {
      return result("coordination", "Reconcile the booking with the current recommendation", "blueprint");
    }
    return result("coordination", `Schedule pilot with ${teamLabel(facts.recommendation.teamName)}`, "blueprint");
  }
  if (facts.recommendation.state === "review_required") {
    return result("recommendation_review", "The brief changed: review the recommendation against the current job", "blueprint");
  }
  if (facts.recommendation.state === "recommended") {
    return result("awaiting_booking",
      `Waiting on site to book ${teamLabel(facts.recommendation.teamName)}`, "site");
  }

  // Evaluation loop.
  const { runs, evaluations } = facts;
  const recommendable = runs.passing + runs.untargeted;
  const active = runs.queued + runs.running;
  if (evaluations.pendingAdmission > 0 && recommendable > 0) {
    attention.push(`${plural(evaluations.pendingAdmission, "evaluation request")} awaiting admission`);
  }
  if (recommendable > 0) {
    const basis = runs.passing > 0
      ? plural(runs.passing, "passing run")
      : `${plural(runs.untargeted, "reported run")}, no site target to compare`;
    return result("recommend", `Recommend a team (${basis})`, "blueprint");
  }
  if (evaluations.pendingAdmission > 0) {
    const first = evaluations.pending[0];
    const more = evaluations.pendingAdmission > 1 ? ` (+${evaluations.pendingAdmission - 1} more)` : "";
    return result("admission", `Admit evaluation for ${teamLabel(first?.teamName)}${more}`, "blueprint");
  }
  if (active > 0) {
    const parts = [runs.running ? `${runs.running} running` : "", runs.queued ? `${runs.queued} queued` : ""]
      .filter(Boolean).join(", ");
    return result("evaluating", `Evaluation in progress (${parts})`, "none");
  }
  if (runs.reported + runs.noResult > 0) {
    const detail = runs.belowTarget > 0
      ? `${plural(runs.belowTarget, "run")} below the site's target`
      : `${plural(runs.noResult, "run")} without a result`;
    return result("no_passing_run", `No passing evaluation yet (${detail}): invite or admit another team`, "blueprint");
  }
  if (evaluations.admitted > 0) {
    return result("evaluating", "Admitted; waiting for the run to be recorded", "none");
  }

  // Before any team asked: the site's own steps.
  if (facts.capture.state === "none" && facts.brief.state === "review_pending") {
    return result("intake", "Brief review is queued; check it completes", "blueprint");
  }
  if (facts.brief.state === "none" && facts.capture.state === "none") {
    return result("intake", "Draft the task brief from the intake", "blueprint");
  }
  if (facts.capture.state === "none") {
    return facts.brief.state === "draft"
      ? result("brief_review", "Waiting on site to confirm the brief and film the work area", "site")
      : result("capture", "Waiting on site to film the work area", "site");
  }
  if (facts.capture.state === "uploaded") return result("capture", "Review capture coverage", "blueprint");
  if (facts.capture.state === "scene_failed") return result("capture", "Scene preparation failed: retry or request a new capture", "blueprint");
  if (facts.capture.state === "coverage_short") {
    const views = facts.capture.missingViews.slice(0, 3).join(", ");
    return result("capture", views ? `Waiting on site to add views: ${views}` : "Waiting on site to add missing views", "site");
  }
  if (facts.listing.state === "paused") return result("listing", "Listing paused by the site", "site");
  if (facts.listing.state !== "live") {
    return result("listing", facts.listing.state === "review_required"
      ? "Waiting on site to re-approve the public card"
      : "Waiting on site to publish the public card (or invite approved teams directly)", "site");
  }
  return result("awaiting_teams", "Invite approved robot teams to evaluate this job", "blueprint");
}
