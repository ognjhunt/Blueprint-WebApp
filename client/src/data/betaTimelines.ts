/**
 * How long each beta step takes, in the words every surface uses: the start
 * form, /beta and the job page. One named constant each, so the owner can
 * change a range in one place (owner request, 2026-10-18).
 *
 * Ranges, never dates, and never a recommendation date: a recommendation
 * follows only when a robot team's evaluation of the job passes.
 */

/** Our reply to what a site sends: a new job, footage, written answers. */
export const REPLY_TIMELINE = "We reply within two business days.";

/** From a cleared, saved job and its footage to a scene robot teams can be evaluated in. */
export const SIMULATION_BUILD_TIMELINE = "We confirm the checks needed for your job and explain the next step. Timing depends on the evidence and compatible systems available.";

/** Evaluations wait on an invited robot team, so no date is promised. */
export const EVALUATION_START_TIMELINE =
  "We are checking compatible options and delivery support. Your job page shows who needs to act next; we email you when there is an update.";

/** All three, in the order a job meets them. */
export const BETA_TIMELINES = [REPLY_TIMELINE, SIMULATION_BUILD_TIMELINE, EVALUATION_START_TIMELINE] as const;

/**
 * The expected wait for a job page status (`projectTaskStatus` decisions),
 * when the job is waiting on Blueprint or on a robot team. Null for the site's
 * own steps, and for stages whose headline already says what comes next.
 */
export function waitingTimeline(decision: string | null | undefined): string | null {
  switch (decision) {
    case "received":
    case "footage_received":
      return REPLY_TIMELINE;
    case "assessing":
      return SIMULATION_BUILD_TIMELINE;
    case "awaiting_teams":
      return EVALUATION_START_TIMELINE;
    default:
      return null;
  }
}
