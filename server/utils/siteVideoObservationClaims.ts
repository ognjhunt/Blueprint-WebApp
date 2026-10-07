import type { SiteVideoEvidenceOutput } from "../agents/tasks/site-video-evidence";

/** Projection only: retain the original model output, but do not turn an
 * unsupported observation into a brief answer or a screening contradiction.
 * A timestamp makes a claim inspectable; it does not establish its truth. */
export function timestampedVideoObservations(
  evidence: Pick<SiteVideoEvidenceOutput, "footage_status" | "observations">,
): SiteVideoEvidenceOutput["observations"] {
  if (evidence.footage_status !== "usable" && evidence.footage_status !== "partially_usable") return [];
  return evidence.observations.filter(observation => observation.stance !== "not_visible"
    && observation.moments.some(moment => Number.isFinite(moment.at_seconds) && moment.at_seconds >= 0));
}
