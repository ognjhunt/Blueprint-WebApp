/**
 * The Pipeline's progress grader, as the publication names it (`progress.grader_version`). The version
 * fixes its thresholds: `approached` is a grasp point within 0.02 m (`APPROACHED_DISTANCE_M`) of the
 * object's bounds. The page says that number, so it sits beside the version it belongs to: a new
 * threshold is a new version, and both change here together.
 */
export const SCREENING_PROGRESS_GRADER_VERSION = "policy_episode_progress.v1";
/** What `approached` means under `SCREENING_PROGRESS_GRADER_VERSION`, in whole centimetres. */
export const APPROACHED_WITHIN_CM = 2;
