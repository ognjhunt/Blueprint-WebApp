/**
 * The job's outlook, as the server decides it once (`server/utils/jobOutlook.ts`) for the job page, the sharing
 * routes and every answer email. The page shows the screen for the phase and never works it out itself.
 */
export type JobPhase = "reading" | "building" | "testing" | "result" | "no_test" | "cannot_match" | "ended_by_site";
export type JobOutlookReason =
  | "permission_withdrawn" | "closed_by_owner"
  | "window_expired" | "no_grant" | "preparation_failed" | "scene_held" | "scene_stopped"
  | "run_held" | "run_ended" | "no_ai_robot_scored" | "robot_fit_only" | "unsized" | "built_not_tested"
  | "step_failed" | "other_kind";
export interface JobOutlook {
  phase: JobPhase;
  reason: JobOutlookReason | null;
  /** One plain, true sentence for the reason: the page's line and the answer email's first sentence. */
  sentence: string | null;
}

/** The reason sentences, said the same on the page and in the email. */
export const OUTLOOK_SENTENCES: Readonly<Record<Exclude<JobOutlookReason, "run_held" | "run_ended" | "no_ai_robot_scored" | "other_kind">, string>> = {
  permission_withdrawn: "Permission to use your video was withdrawn, so this job has stopped.",
  closed_by_owner: "You closed this job's simulation run.",
  window_expired: "The time for this job ran out before a simulation test could run.",
  no_grant: "We have not built a simulation for this job.",
  preparation_failed: "We could not build a simulation of your site.",
  scene_held: "Our simulation test can't do this kind of job yet.",
  scene_stopped: "We could not finish building the simulation of your site.",
  robot_fit_only: "For this job we check robot fit only; no AI robot is tested on it in a simulation.",
  unsized: "Your video didn't show the job clearly enough for us to measure it.",
  built_not_tested: "We built the simulation of your site, but no AI robot was tested in it.",
  step_failed: "A step failed and we're working on it. We'll email you the result.",
};


/** Whether the phase has an answer the site may share: a result, the paper check after an ending, or another kind. */
export const outlookHasAnswer = (outlook: Pick<JobOutlook, "phase">) =>
  outlook.phase === "result" || outlook.phase === "no_test" || outlook.phase === "cannot_match";
