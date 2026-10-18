/**
 * Beta journey L3/L6: what a site is told about its scene after hand-off.
 *
 * The launch worker polls the Pipeline's scene intent into
 * `taskEvaluationSceneIntakes`; until now no site page read it, so a scene
 * that could never become runnable still read as "preparing". This projects
 * the site's latest intake to a coarse state and nothing more: no Pipeline
 * phase, blocker, attempt or spend detail reaches a site.
 */
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { SCENE_INTAKE_COLLECTION } from "./taskEvaluationSceneIntake";
import type { TaskSceneProgression } from "./taskStatusProjection";

// Pipeline blocks that stay blocked once hit (task_evaluation_scene_progression):
// the configuration failed for good, the policy canary blocked, the intent's
// authority ended, or a bounded retry/recovery allowance ran out.
const ENDED_PHASES = new Set(["scene_configuration_failed", "policy_canary_blocked", "authority"]);
const ENDED_BLOCKERS = new Set(["retry_cap_exhausted", "submission_retry_cap_exhausted",
  "preallocation_capacity_recovery_cap_exhausted", "scene_intake_authority_expired", "scene_intake_authority_revoked"]);
const IN_FLIGHT = new Set(["revocation_pending", "forward_pending", "forward_blocked",
  "commercial_authorization_required", "accepted", "closeout_pending"]);

export function projectWebsiteSceneProgression(record: Record<string, any> | null | undefined): TaskSceneProgression | null {
  const state = record?.state;
  if (state === "completed") return { state: "completed" };
  // The worker's own terminal states: a typed terminal refusal, or the intent's authority ended.
  if (state === "blocked" || state === "expired" || state === "revoked") return { state: "ended" };
  if (!IN_FLIGHT.has(state)) return null;
  const status = record?.pipeline_status;
  if (status?.status === "blocked") {
    const blockers: unknown[] = Array.isArray(status.blockers) ? status.blockers : [];
    return ENDED_PHASES.has(status.phase) || (blockers.length > 0 && blockers.every(code =>
      typeof code === "string" && ENDED_BLOCKERS.has(code))) ? { state: "ended" } : { state: "waiting" };
  }
  if (status?.status === "needs_input" || state === "forward_blocked") return { state: "waiting" };
  return { state: "in_progress" };
}

/** The site's latest scene intake for this capture, projected. Unreadable is unknown (null). */
export async function loadWebsiteSceneProgression(requestId: string, captureId: string): Promise<TaskSceneProgression | null> {
  if (!db) return null;
  try {
    const rows = await db.collection(SCENE_INTAKE_COLLECTION).where("website_request_id", "==", requestId).limit(20).get();
    const latest = rows.docs.map(row => row.data())
      .filter(row => row?.source_session_id === captureId)
      .sort((a, b) => String(b.created_at_iso || "").localeCompare(String(a.created_at_iso || "")))[0];
    return projectWebsiteSceneProgression(latest);
  } catch {
    return null;
  }
}
