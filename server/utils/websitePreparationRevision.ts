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
export function websitePreparationCaptureId(request: Record<string, any>): string {
  return (websitePreparationRevision(request) ?? websitePreparationRenewal(request))?.capture_id ?? request.submission_id;
}
