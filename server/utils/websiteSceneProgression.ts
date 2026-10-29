/**
 * Beta journey L3/L6: what a site is told about its scene after hand-off.
 *
 * The launch worker polls the Pipeline's scene intent into
 * `taskEvaluationSceneIntakes`; until now no site page read it, so a scene
 * that could never become runnable still read as "preparing". This projects
 * the site's latest intake to a coarse state and nothing more: no Pipeline
 * phase, blocker, attempt or spend detail reaches a site.
 *
 * A built scene is not yet "ready" for the site (owner decision 2026-10-22):
 * it is ready once its task objects are in and our first internal test on it
 * has started. That is `testing`: a policy test ran inside the intake, or the
 * Pipeline accepted one on a configured scene of the intake's task. Once the
 * automatic evaluation completes, its estimate is the job's result
 * (`evaluated`, owner decision 2026-10-28).
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
const POLICY_RUN_COLLECTION = "taskEvaluationPolicyRuns";
const IN_FLIGHT = new Set(["revocation_pending", "forward_pending", "forward_blocked",
  "commercial_authorization_required", "accepted", "closeout_pending"]);
// The intake's own policy test ran (its terminal receipts are being joined) or finished.
const TESTED_PHASES = new Set(["terminal_reconciliation", "policy_canary_complete"]);
// A policy run the Pipeline accepted, until it ends without running.
const TEST_ACCEPTED_STATES = new Set(["preparing", "ready_to_activate", "queued", "running", "aggregating",
  "results_ready", "abstained", "queued_in_pipeline", "queued_dispatch_blocked"]);
const TEST_ENDED_STATES = new Set(["blocked", "failed", "cancelled", "forward_terminal_blocked",
  "control_plane_terminal_blocked"]);

/** Whether a stored policy run is a test the Pipeline accepted and that has not ended unrun. */
export function policyTestAccepted(run: Record<string, any> | null | undefined): boolean {
  const state = String(run?.state ?? "");
  if (TEST_ENDED_STATES.has(state)) return false;
  return TEST_ACCEPTED_STATES.has(state) || run?.launch_forward?.status === "forwarded";
}

export function projectWebsiteSceneProgression(record: Record<string, any> | null | undefined,
  testAccepted: boolean | "evaluated" | "held" = false): TaskSceneProgression | null {
  const state = record?.state;
  const phase = record?.pipeline_status?.phase;
  if (state === "completed") return { state: testAccepted === "evaluated" || testAccepted === "held" ? testAccepted
    : testAccepted || phase === "policy_canary_complete" ? "testing" : "completed" };
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
  return { state: TESTED_PHASES.has(phase) ? "testing" : "in_progress" };
}

/** Every page of a query, in document order: history is never cut at a result count. */
export async function* queryPages(query: FirebaseFirestore.Query, size = 100) {
  let cursor: string | null = null;
  for (;;) {
    let page = query.orderBy("__name__").limit(size);
    if (cursor) page = page.startAfter(cursor);
    const snapshot = await page.get();
    if (snapshot.docs.length) yield snapshot.docs;
    if (snapshot.docs.length < size) return;
    cursor = snapshot.docs[snapshot.docs.length - 1].id;
  }
}

/**
 * Whether the Pipeline accepted a policy test on a configured scene of this
 * intake's task, in the intake's own team. A configured scene carries the
 * task's objects, so this is the first internal test of the finished scene.
 */
async function firstTestAccepted(store: FirebaseFirestore.Firestore, intake: Record<string, any>): Promise<boolean | "evaluated" | "held"> {
  const taskId = intake.request?.task?.task_id;
  const team = intake.request?.owner?.organization_id;
  if (typeof taskId !== "string" || !taskId || typeof team !== "string" || !team) return false;
  if (typeof intake.receipt?.intent_id === "string") {
    let observed = false;
    for await (const rows of queryPages(store.collection(POLICY_RUN_COLLECTION)
      .where("source_scene_intent_id", "==", intake.receipt.intent_id))) {
      for (const row of rows) {
        const run = row.data();
        if (run?.run_kind !== "beta_policy_screening" || run.team_namespace !== team) continue;
        // A completed campaign with a scored episode is the job's estimate.
        if (run.state === "completed" && run.episodes_scored > 0) return "evaluated";
        // No candidate can do this kind of job yet: held, not an open test.
        if (["completed", "blocked"].includes(run.state) && run.no_estimate_reason === "held") return "held";
        observed ||= run.screening_execution_observed === true;
      }
    }
    if (observed) return true;
  }
  const launchIds: string[] = [];
  for await (const rows of queryPages(store.collection("taskEvaluationLaunches")
    .where("configured_scene_offering.task.identity.id", "==", taskId))) {
    launchIds.push(...rows.filter(row => row.data()?.configured_scene_offering?.team_namespace === team).map(row => row.id));
  }
  // Firestore takes at most 30 values in one `in` filter.
  for (let start = 0; start < launchIds.length; start += 30) {
    for await (const rows of queryPages(store.collection(POLICY_RUN_COLLECTION)
      .where("source_launch_id", "in", launchIds.slice(start, start + 30)))) {
      if (rows.some(row => policyTestAccepted(row.data()))) return true;
    }
  }
  return false;
}

/** The site's latest scene intake for this capture, projected. Throws when it cannot be read. */
export async function readWebsiteSceneProgression(requestId: string, captureId: string): Promise<TaskSceneProgression | null> {
  if (!db) throw new Error("website_scene_progression_unavailable");
  const rows = await db.collection(SCENE_INTAKE_COLLECTION).where("website_request_id", "==", requestId).limit(20).get();
  const latest = rows.docs.map(row => row.data())
    .filter(row => row?.source_session_id === captureId)
    .sort((a, b) => String(b.created_at_iso || "").localeCompare(String(a.created_at_iso || "")))[0];
  const tested = latest?.state === "completed" && latest.pipeline_status?.phase !== "policy_canary_complete"
    && await firstTestAccepted(db, latest);
  return projectWebsiteSceneProgression(latest, tested);
}

/** The same, for a page: unreadable is unknown (null). */
export async function loadWebsiteSceneProgression(requestId: string, captureId: string): Promise<TaskSceneProgression | null> {
  if (!db) return null;
  try {
    return await readWebsiteSceneProgression(requestId, captureId);
  } catch {
    return null;
  }
}
