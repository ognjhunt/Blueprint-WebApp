/**
 * The job's outlook, as the server decides it once (`server/utils/jobOutlook.ts`) for the job page, the sharing
 * routes and every answer email. The page shows the screen for the phase and never works it out itself.
 */
export type JobPhase = "reading" | "building" | "testing" | "result" | "no_test" | "cannot_match" | "ended_by_site"
  /** The job waits for the site to say what the robot should do in one sentence (review, 2026-11-12). */
  | "waiting_on_site";
export type JobOutlookReason =
  | "permission_withdrawn" | "closed_by_owner"
  | "window_expired" | "no_grant" | "preparation_failed" | "scene_held" | "scene_stopped"
  | "run_held" | "run_ended" | "no_ai_robot_scored" | "robot_fit_only" | "unsized"
  | "step_failed" | "other_kind" | "authority_ended" | "kept_on_file" | "job_ended" | "window_ended_during_test" | "task_not_named"
  | "not_processed_in_time" | "simulation_stopped";
export interface JobOutlook {
  phase: JobPhase;
  reason: JobOutlookReason | null;
  /** One plain, true sentence for the reason: the page's line and the answer email's first sentence. */
  sentence: string | null;
}

/** The reason sentences, said the same on the page and in the email. */
export const OUTLOOK_SENTENCES: Readonly<Record<Exclude<JobOutlookReason, "run_held" | "run_ended" | "other_kind">, string>> = {
  permission_withdrawn: "Permission to use your video was withdrawn, so this job has stopped.",
  closed_by_owner: "You closed this job's simulation run.",
  window_expired: "The time for this job ran out before a simulation test could run.",
  // The Pipeline's own record that the job's authority ended before a test ran: said as the window ending is.
  authority_ended: "The time for this job ran out before a simulation test could run.",
  // A job of a kind we can't simulate yet, kept on file by the no-grant sweep: no simulation is coming for now.
  kept_on_file: "We can't test this kind of job yet. We've kept your job on file.",
  // An ended authority the Pipeline gives no reason for: true, and no claim about why.
  job_ended: "This job has ended.",
  task_not_named: "Tell us in one sentence what the robot should do, so we can build the simulation of your job.",
  // A run the window's end stopped while it was under way.
  window_ended_during_test: "The time for this job ran out during the simulation test.",
  no_grant: "We have not built a simulation for this job.",
  preparation_failed: "We could not build a simulation of your site.",
  // Preparation ended `capacity_blocked`: every cause of it is on our side (review, 2026-11-12).
  not_processed_in_time: "We could not start or finish preparing your job in time, for a reason on our side. Nothing you did caused it.",
  // A simulation ending whose kind this release does not know.
  simulation_stopped: "The simulation of your job stopped, for a reason this page cannot show yet.",
  // True for every hold it covers: a scene outcome held, and an evaluation held for capability, set-up, budget or a
  // scene check (review, 2026-11-11).
  scene_held: "The simulation test of your job is on hold.",
  scene_stopped: "We could not finish building the simulation of your site.",
  robot_fit_only: "For this job we check robot fit only; no AI robot is tested on it in a simulation.",
  unsized: "Your video didn't show the job clearly enough for us to measure it.",
  // A finished test in which no AI robot could be scored is an ending, never a result (review, 2026-11-11).
  no_ai_robot_scored: "The simulation test finished, but no AI robot could be scored in it.",
  step_failed: "A step failed and we're working on it. We'll email you the result.",
};


/**
 * Endings after which a simulation test can still come: a hold. Only their emails and pages say "If a test result
 * comes later, we'll email it"; every other ending is final (review, 2026-11-11).
 */
export const OUTLOOK_HOLDS: ReadonlySet<JobOutlookReason> = new Set(["run_held", "scene_held"]);

/** Whether the phase has an answer the site may share: a result, the paper check after an ending, or another kind. */
export const outlookHasAnswer = (outlook: Pick<JobOutlook, "phase">) =>
  outlook.phase === "result" || outlook.phase === "no_test" || outlook.phase === "cannot_match";
