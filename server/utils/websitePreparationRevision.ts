/** Immutable prepared derivatives stay in the capture's job and original allowance. */
import { crossRuntimeDigest } from "./crossRuntimeCanonical";
export const WEBSITE_PREPARATION_REVISION = "website_preparation_revision";
const prefix = "website-correction-";
export function websitePreparationRevision(request: Record<string, any>): {capture_id: string; corrections_digest: string} | null {
  const value = request.task?.subject?.[WEBSITE_PREPARATION_REVISION];
  if (value === undefined) {
    if (String(request.submission_id ?? "").startsWith(prefix)) throw new Error("website_scene_preparation_revision_invalid");
    return null;
  }
  const {submission_id, ...body} = request;
  if (!value || typeof value !== "object" || Array.isArray(value)
    || Object.keys(value).sort().join(",") !== "capture_id,corrections_digest"
    || typeof value.capture_id !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value.capture_id)
    || typeof value.corrections_digest !== "string" || !/^sha256:[a-f0-9]{64}$/.test(value.corrections_digest)
    || request.execution?.purpose !== "scene_preparation" || !Array.isArray(request.execution.policy_candidates)
    || request.execution.policy_candidates.length !== 0
    || submission_id !== prefix + crossRuntimeDigest(body).slice(7)) throw new Error("website_scene_preparation_revision_invalid");
  return value;
}
export const WEBSITE_PREPARATION_RENEWAL = "website_preparation_renewal";
const renewalPrefix = "website-renewal-";
const identifier = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
/** A completed preparation re-issued after its sponsor renewed the expired grant.
 * Mirrors the Pipeline's ``renewal`` exactly (shared vector website-preparation-renewal.v1.json):
 * same capture, so every sibling keeps sharing the capture's native limits. */
export function websitePreparationRenewal(request: Record<string, any>): {capture_id: string; parent_submission_id: string} | null {
  const value = request.task?.subject?.[WEBSITE_PREPARATION_RENEWAL];
  if (value === undefined) {
    if (String(request.submission_id ?? "").startsWith(renewalPrefix)) throw new Error("website_scene_preparation_renewal_invalid");
    return null;
  }
  const {submission_id, ...body} = request;
  const parent = value?.parent_submission_id;
  if (!value || typeof value !== "object" || Array.isArray(value)
    || Object.keys(value).sort().join(",") !== "capture_id,parent_submission_id"
    || typeof value.capture_id !== "string" || !identifier.test(value.capture_id)
    || typeof parent !== "string" || !identifier.test(parent)
    || !(parent === value.capture_id || parent.startsWith(renewalPrefix))
    || Object.hasOwn(request.task.subject, WEBSITE_PREPARATION_REVISION)
    || request.execution?.purpose !== "scene_preparation" || !Array.isArray(request.execution.policy_candidates)
    || request.execution.policy_candidates.length !== 0
    || submission_id !== renewalPrefix + crossRuntimeDigest(body).slice(7)) throw new Error("website_scene_preparation_renewal_invalid");
  return value;
}
export const WEBSITE_NAVIGATION_REISSUE = "website_navigation_reissue";
const reissuePrefix = "website-reissue-";
/** A navigation job's intake sent again for the same capture: its scene half was derived from an Atlas
 * result published after the first intake, and this route and the Pipeline intake keep one intake per
 * submission. The navigation task names the capture, the parent submission (the capture's own, or an
 * earlier re-issue) and that Atlas result; the submission is the prefix and the digest of the rest.
 * Mirrors the Pipeline's ``reissue`` exactly (shared vector website-navigation-reissue.v1.json): same
 * capture, so the job keeps its original limits. */
export function websiteNavigationReissue(request: Record<string, any>):
  {capture_id: string; parent_submission_id: string; atlas_result_digest: string} | null {
  const value = request.task?.[WEBSITE_NAVIGATION_REISSUE];
  if (value === undefined) {
    if (String(request.submission_id ?? "").startsWith(reissuePrefix)) throw new Error("website_scene_navigation_reissue_invalid");
    return null;
  }
  const {submission_id, ...body} = request;
  const parent = value?.parent_submission_id;
  const subject = request.task?.subject && typeof request.task.subject === "object" ? request.task.subject : {};
  if (!value || typeof value !== "object" || Array.isArray(value)
    || Object.keys(value).sort().join(",") !== "atlas_result_digest,capture_id,parent_submission_id"
    || typeof value.capture_id !== "string" || !identifier.test(value.capture_id)
    || typeof parent !== "string" || !identifier.test(parent)
    || !(parent === value.capture_id || parent.startsWith(reissuePrefix))
    || typeof value.atlas_result_digest !== "string" || !/^sha256:[a-f0-9]{64}$/.test(value.atlas_result_digest)
    || request.task?.strategy !== "goal_region_navigation"
    || Object.hasOwn(subject, WEBSITE_PREPARATION_REVISION) || Object.hasOwn(subject, WEBSITE_PREPARATION_RENEWAL)
    || request.execution?.purpose !== "scene_preparation" || !Array.isArray(request.execution.policy_candidates)
    || request.execution.policy_candidates.length !== 0
    || submission_id !== reissuePrefix + crossRuntimeDigest(body).slice(7)) throw new Error("website_scene_navigation_reissue_invalid");
  return value;
}
export function websitePreparationCaptureId(request: Record<string, any>): string {
  // A re-issue is read first, so a request carrying another derivative's marker beside it is refused.
  const reissue = websiteNavigationReissue(request);
  return (reissue ?? websitePreparationRevision(request) ?? websitePreparationRenewal(request))?.capture_id
    ?? request.submission_id;
}
