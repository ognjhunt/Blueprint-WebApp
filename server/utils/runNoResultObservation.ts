import type { RunExecutionProgress } from "./agentRunRecord";

export interface NoResultObservation {
  executionProgress?: RunExecutionProgress;
  episodesRun?: number | null;
}

/** Missing or incomplete observations never establish that nothing ran. */
export function noResultObservationText(observation?: NoResultObservation): string {
  const progress = observation?.executionProgress;
  if (progress) {
    const { observed_attempted_episode_count: attempted, scored_episode_count: scored,
      succeeded_episode_count: succeeded, failed_episode_count: failed, void_episode_count: voids,
      measurement_complete } = progress;
    const complete = measurement_complete === true;
    const valid = [attempted, scored, succeeded, failed, voids].every(value => Number.isSafeInteger(value) && value >= 0)
      && scored === succeeded + failed && attempted >= scored + voids
      && (!complete || attempted === scored + voids);
    if (valid && complete && attempted === 0) return "No episode was attempted; execution measurement is complete.";
    if (valid && attempted > 0) return `Observed${complete ? "" : " so far"}: ${attempted} attempted; ${scored} scored (${succeeded} succeeded, ${failed} failed); ${voids} void.${complete ? "" : " These counts are incomplete; additional episodes may have run."}`;
  }
  const scored = observation?.episodesRun;
  if (Number.isSafeInteger(scored) && scored! > 0) return `${scored} scored episodes were reported; total attempted and void counts are unknown.`;
  return "Episode progress is unknown.";
}
