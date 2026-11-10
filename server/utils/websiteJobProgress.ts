/**
 * Where a website job stands for its deadline, in the site-facing progression values.
 *
 * Every job has a deadline (`websiteJobDeadline`). A job still open on Blueprint's side when it
 * passes is ended by its window; a job that already shows a result, a hold or an ending keeps it.
 * The job page (`projectTaskStatus`) and the deadline sweep (`websiteJobDeadlineSweep`) both read
 * this, so the page and the one email cannot disagree. Pure: no reads.
 */
import type { TaskPreparationStatus, TaskSceneProgression } from "./taskStatusProjection";

export type WebsiteJobProgress = TaskSceneProgression["state"];

/**
 * Every progression value, and what its deadline does to it. Typed over the whole union, so a new
 * value does not compile until it is given one; the registry test pins the settled ones. `completed`
 * is a built scene not yet tested, which the page reads as still being prepared, so it ends too.
 */
export const WEBSITE_JOB_PROGRESS_AT_DEADLINE: Readonly<Record<WebsiteJobProgress, "ends" | "settled">> = {
  in_progress: "ends",
  waiting: "ends",
  testing: "ends",
  completed: "ends",
  ended: "settled",
  evaluated: "settled",
  held: "settled",
};

/**
 * The job's progression from what the job page reads: the scene after hand-off; before it, the
 * preparation status (a finding is a hold, a final state an ending, a geometry-only fit check its
 * result); with neither, a saved video is Blueprint's to work on. An unverifiable preparation status
 * is open: the page has nothing truer to show. Null when nothing is with Blueprint yet.
 */
export function websiteJobProgress(input: {
  sceneProgression?: TaskSceneProgression | null;
  preparationStatus?: Pick<TaskPreparationStatus, "state" | "outcome" | "robotFit"> | null;
  hasStoredCapture?: boolean;
}): WebsiteJobProgress | null {
  if (input.sceneProgression) return input.sceneProgression.state;
  const preparation = input.preparationStatus;
  if (preparation) {
    if (preparation.outcome) return "held";
    if (preparation.state === "failed_terminal" || preparation.state === "authority_ended") return "ended";
    if (preparation.state === "awaiting_inputs" && preparation.robotFit?.route === "geometry_only") return "evaluated";
    return preparation.state === "awaiting_inputs" || preparation.state === "failed_retryable" ? "waiting" : "in_progress";
  }
  return input.hasStoredCapture ? "in_progress" : null;
}

/** Whether a job in this progression ends when its deadline passes. */
export const websiteJobEndsAtDeadline = (progress: WebsiteJobProgress | null): progress is WebsiteJobProgress =>
  progress !== null && WEBSITE_JOB_PROGRESS_AT_DEADLINE[progress] === "ends";
