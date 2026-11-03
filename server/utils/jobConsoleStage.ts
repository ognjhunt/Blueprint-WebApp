/**
 * Where one site job stands in the beta loop, and what moves it next.
 *
 * The loop, in order: a site shows one job (intake, brief, capture, public
 * card); approved robot teams ask to evaluate it; Blueprint admits each free
 * evaluation; runs report; on a passing run, Blueprint works with a deployment
 * company, and the site and the company agree any pilot directly. Since
 * 2026-10-26 Blueprint also runs the candidates itself: its scene preparation,
 * its screening and the screening's outcome come from the projection the job
 * page shows (`facts.scene`), after any team's runs and before the site's own
 * steps.
 *
 * Pure on purpose. The founder runs this loop by hand, and the console's only
 * job is to say, for every site, which step is next and whose it is. Keeping
 * the rule here, away from Firestore, means it can be tested exhaustively and
 * read in one place when someone asks why a row says what it says.
 *
 * Nothing here decides anything. A passing run is a prompt for a person.
 *
 * Whether robot teams can evaluate a job is not decided here either. It is
 * `teamJobAccess`, the one answer every team-facing surface gives, carried in
 * `facts.teamAccess`. The console asks the founder to invite teams only when
 * that answer is open, and otherwise names what holds the job and whose move
 * it is.
 */

import type {
  ActionOwner,
  BlueprintScene,
  JobFacts,
  JobStage,
  JobStageResult,
  ListingState,
  SceneHold,
  TeamAccessReason,
  WithdrawalState,
} from "../../client/src/types/jobConsole";

export * from "../../client/src/types/jobConsole";

type Step = Pick<JobStageResult, "stage" | "nextAction" | "actionOwner">;

function plural(count: number, one: string, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}

function teamLabel(name: string | null | undefined) {
  return name && name.trim() ? name.trim() : "the requesting team";
}

function step(stage: JobStage, nextAction: string, actionOwner: ActionOwner): Step {
  return { stage, nextAction, actionOwner };
}

/** Why teams cannot evaluate the job, as an attention line names it. */
const CLOSED_REASON_LABELS: Record<TeamAccessReason, string> = {
  not_a_site_job: "not a site's job",
  pipeline_placeholder: "a Pipeline placeholder, not a site's job",
  task_not_yet_supported: "we are preparing an evaluation for this kind of job",
  not_listed: "no current public card",
  kept_private: "the retired dossier keeps it private",
  restricted_to_named_teams: "the retired dossier names only certain teams",
  operator_paused: "paused by the site",
  consent_withdrawn: "recording permission withdrawn",
  development_only: "a development capture",
  rights_blocked: "the rights review blocked the capture",
  rights_needs_review: "the rights review has not cleared the capture",
  recording_consent_missing: "no current recording grant",
  scene_not_runnable: "the scene is not proven runnable",
};

/** A job with no current card grant: what the card's own state says to do. */
function listingStep(state: ListingState): Step {
  switch (state) {
    case "paused": return step("listing", "Listing paused by the site", "site");
    case "review_required": return step("listing", "Waiting on site to re-approve the public card", "site");
    case "hidden": return step("listing", "Public card hidden by the site", "site");
    // Switched on, but not a grant teams can be shown (an older consent, or details that no longer validate).
    case "live": return step("listing", "Waiting on site to re-approve the public card (the approval on file is not current)", "site");
    case "none": return step("listing", "Kept private: waiting on site to publish the public card", "site");
  }
}

/** A listed job whose scene cannot run an evaluation yet: the condition that holds it. */
function sceneStep(hold: SceneHold | null): Step {
  switch (hold) {
    case "brief_unconfirmed": return step("brief_review", "Waiting on site to confirm the brief", "site");
    case "clarification_review": return step("brief_review", "Review the site's written clarification", "blueprint");
    case "screening_call": return step("brief_review", "Book the screening call", "blueprint");
    case "not_now": return step("not_open", "No action: screening said not now, so no scene is built", "none");
    case "unscreened": return step("brief_review", "No screening decision on file: re-screen the confirmed brief", "blueprint");
    case "unclaimed": return step("capture", "Waiting on site to save the job to an account", "site");
    case "scene_not_built": return step("capture", "Waiting on the Pipeline to build the scene", "none");
    case "scene_not_proven": return step("capture", "Waiting on the Pipeline's runnable-scene proof", "none");
    case "gates_open": return step("brief_review", "Waiting on site to answer the brief's open questions", "site");
    case null: return step("not_open", "Scene not proven runnable: check the job's screening and scene records", "blueprint");
  }
}

/**
 * The next step for a job approved robot teams cannot evaluate, read from
 * `teamJobAccess`'s reason: never an invitation, always what holds the job and
 * whose move it is.
 */
export function closedJobStep(facts: JobFacts): Step {
  const { reason, sceneHold } = facts.teamAccess;
  switch (reason) {
    case "not_listed": return listingStep(facts.listing.state);
    case "operator_paused": return step("listing", "Listing paused by the site", "site");
    case "kept_private":
      return step("not_open", "Private under the retired dossier: ask the site whether approved teams may see it", "blueprint");
    case "restricted_to_named_teams":
      return step("not_open", "Retired dossier names only certain teams: ask the site whether every approved team may see it", "blueprint");
    // A brief the screen could not read is not out of scope: the site owes one sentence.
    case "task_not_yet_supported": return facts.teamAccess.scopeReason === "unclear"
      ? step("brief_review", "Waiting on site to describe the job in one sentence and confirm the brief again", "site")
      : step("not_open", "Held while we prepare an evaluation for this kind of job; counted as demand for what to build next", "none");
    case "development_only": return step("not_open", "No action: a development capture is never opened to teams", "none");
    case "rights_needs_review": return step("not_open", "Rights review pending: review the capture's rights and privacy", "blueprint");
    case "rights_blocked":
      return step("not_open", "Rights review blocked the capture: resolve it with the site or request a new capture", "blueprint");
    case "recording_consent_missing": return step("not_open", "Waiting on site to grant current recording permission", "site");
    // Withdrawal outranks every stage, so this is reached only if the two readings ever disagree.
    case "consent_withdrawn": return step("withdrawn", "Confirm the capture withdrawal reached the Pipeline", "blueprint");
    case "scene_not_runnable": return sceneStep(sceneHold);
    case "not_a_site_job":
    case "pipeline_placeholder": return step("not_open", `No action: ${CLOSED_REASON_LABELS[reason]}`, "none");
    // Closed with no reason given: still never an invitation.
    case null: return step("not_open", "Not open to teams, and no reason is recorded: check the job record", "blueprint");
  }
}

const SCREENING_WAITS: Record<NonNullable<BlueprintScene["progressOutcome"]>, string> = {
  awaiting_spend_approval: "Screening waits for spend approval: check the job's screening budget",
  setup_repair: "Screening waits for a setup repair: check the screening plan's blockers",
  superseded: "Screening is planned again for the current candidates",
};

/** Blueprint's own scene and screening: the next step, and any money or setup wait worth a glance. */
function blueprintSceneStep(scene: BlueprintScene, attention: string[]): Step {
  const wait = scene.progressOutcome;
  if (wait === "awaiting_spend_approval") attention.push("Money wait: the screening awaits spend approval");
  if (wait === "setup_repair") attention.push("Setup wait: the screening needs a repair");
  switch (scene.state) {
    case "in_progress": return step("scene_preparation", "Pipeline is preparing the scene", "none");
    case "waiting":
      attention.push("Scene preparation is waiting");
      return step("scene_preparation", "Scene preparation is waiting: check the job's preparation watch", "blueprint");
    case "completed":
    case "testing":
      if (wait === "awaiting_spend_approval" || wait === "setup_repair") return step("screening", SCREENING_WAITS[wait], "blueprint");
      if (scene.state === "testing") return step("screening", "Blueprint is running the candidates", "none");
      return step("screening", wait ? SCREENING_WAITS[wait] : "Scene ready: the screening starts on its own", "none");
    case "evaluated":
      attention.push("Estimate published");
      return step("estimate", "Estimate published: introduce a deployment company if the site replies", "blueprint");
    case "held":
      return step("held", `Held${scene.heldReason ? ` (${scene.heldReason})` : ""}: counted as demand for what to build next`, "none");
    case "ended": return step("ended", `Preparation ended${scene.ending ? ` (${scene.ending})` : ""}`, "none");
  }
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
  // Teams can evaluate the job only when `teamJobAccess` says so.
  const closed = facts.teamAccess.evaluationAvailable ? null : closedJobStep(facts);
  // Teams already engaged: say why no new evaluation can be admitted.
  const noteClosed = () => {
    if (closed) {
      const reason = facts.teamAccess.reason;
      attention.push(`Not open to teams: ${reason ? CLOSED_REASON_LABELS[reason] : "no reason recorded"}`);
    }
  };

  // Withdrawal overrides every downstream state: no evaluation may proceed on a
  // recording the site took back.
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

  // Evaluation loop.
  const { runs, evaluations } = facts;
  const active = runs.queued + runs.running;
  if (evaluations.pendingAdmission > 0 && runs.passing > 0) {
    attention.push(`${plural(evaluations.pendingAdmission, "evaluation request")} awaiting admission`);
  }
  if (runs.passing > 0) {
    noteClosed();
    return result("passing_run", `Work with a deployment company on the passing result (${plural(runs.passing, "passing run")})`, "blueprint");
  }
  if (evaluations.pendingAdmission > 0) {
    const first = evaluations.pending[0];
    const more = evaluations.pendingAdmission > 1 ? ` (+${evaluations.pendingAdmission - 1} more)` : "";
    noteClosed();
    return result("admission", `Admit evaluation for ${teamLabel(first?.teamName)}${more}`, "blueprint");
  }
  if (active > 0) {
    const parts = [runs.running ? `${runs.running} running` : "", runs.queued ? `${runs.queued} queued` : ""]
      .filter(Boolean).join(", ");
    noteClosed();
    return result("evaluating", `Evaluation in progress (${parts})`, "none");
  }
  if (runs.reported + runs.noResult > 0) {
    const detail = runs.belowTarget > 0
      ? `${plural(runs.belowTarget, "run")} below the pass mark`
      : `${plural(runs.noResult, "run")} without a result`;
    // Another team can come in only while the job is open; otherwise the step is whatever closed it.
    return closed
      ? result("no_passing_run", `No passing evaluation yet (${detail}). ${closed.nextAction}`, closed.actionOwner)
      : result("no_passing_run", `No passing evaluation yet (${detail}): invite or admit another team`, "blueprint");
  }
  if (evaluations.admitted > 0) {
    noteClosed();
    return result("evaluating", "Admitted; waiting for the run to be recorded", "none");
  }

  // Blueprint's own scene and screening: past the site's steps once it exists.
  if (facts.scene) {
    const scene = blueprintSceneStep(facts.scene, attention);
    return result(scene.stage, scene.nextAction, scene.actionOwner);
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
  // Capture is settled. Whether teams can come in is `teamJobAccess`'s answer, not the card flag alone.
  if (!closed) return result("awaiting_teams", "Invite approved robot teams to evaluate this job", "blueprint");
  return result(closed.stage, closed.nextAction, closed.actionOwner);
}
