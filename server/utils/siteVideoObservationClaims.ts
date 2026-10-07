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

/** Recompute the projected measurement from cited complete intervals. Model
 * summary numbers are retained in the raw output, never treated as arithmetic
 * evidence. This checks interval consistency, not whether a task really began
 * or ended in the video (which still needs semantic review). */
export function measuredVideoCycles(
  evidence: Pick<SiteVideoEvidenceOutput, "footage_status" | "cycle_measurement">,
): { seconds: number | null; band: SiteVideoEvidenceOutput["cycle_measurement"]["implied_band"] } {
  const unknown = { seconds: null, band: null };
  if (evidence.footage_status !== "usable" && evidence.footage_status !== "partially_usable") return unknown;
  const intervals = [...new Map(evidence.cycle_measurement.cycles
    .filter(cycle => cycle.complete && Number.isFinite(cycle.start_seconds)
      && Number.isFinite(cycle.end_seconds) && cycle.start_seconds >= 0
      && cycle.end_seconds > cycle.start_seconds)
    .map(cycle => [`${cycle.start_seconds}:${cycle.end_seconds}`, cycle] as const)).values()]
    .sort((left, right) => left.start_seconds - right.start_seconds);
  if (!intervals.length || intervals.some((cycle, index) => index > 0
    && cycle.start_seconds < intervals[index - 1].end_seconds)) return unknown;
  const durations = intervals.map(cycle => cycle.end_seconds - cycle.start_seconds).sort((a, b) => a - b);
  const middle = Math.floor(durations.length / 2);
  const lower = durations[middle - 1], upper = durations[middle];
  const seconds = durations.length % 2 ? upper : lower + (upper - lower) / 2;
  // Match the existing cycleTime labels: under 30s; 30s to 2m; 2m to
  // 10m; over 10m. At the shared 2m boundary, use the first inclusive band.
  const band = seconds < 30 ? "under_30s" : seconds <= 120 ? "thirty_to_two_min"
    : seconds <= 600 ? "two_to_ten_min" : "over_ten_min";
  return { seconds, band };
}
