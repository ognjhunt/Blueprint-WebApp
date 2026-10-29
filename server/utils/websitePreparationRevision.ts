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
export function websitePreparationCaptureId(request: Record<string, any>): string {
  return websitePreparationRevision(request)?.capture_id ?? request.submission_id;
}
