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
 *
 * C-04: once the Pipeline sends the intent's one outcome, that outcome decides
 * the state: a terminal hold is `held` (we can't simulate this kind of job
 * yet), a terminal withdrawal or setup stop is `ended`, and anything not
 * terminal is `waiting`. The blocker reading below is kept for older
 * Pipelines that send no outcome.
 */
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { SCENE_INTAKE_COLLECTION } from "./taskEvaluationSceneIntake";
import type { TaskSceneProgression } from "./taskStatusProjection";
import { taskTargetSelection, taskTargetSelectionApplies } from "./websiteTaskTargetChoice";
import { isScreeningHeldOutcome, storedScreeningOutcome, type ScreeningOutcome } from "./betaPolicyScreeningContract";
import { adoptedSceneOutcome, sceneOutcomeReading } from "./sceneIntentOutcome";

// Pipeline blocks that stay blocked once hit (task_evaluation_scene_progression):
// the configuration failed for good, the policy canary blocked (at or before
// its provider), the intent's authority ended, or a bounded retry/recovery
// allowance ran out. The Pipeline prefixes each code with the module that
// raised it (`scene_progression_`, `scene_intake_`); older records carry the
// bare code. A spent attempt or spend cap waits on the owner's money approval
// and is never an ending.
const ENDED_PHASES = new Set(["scene_configuration_failed", "policy_canary_blocked", "policy_canary_preprovider_blocked", "authority"]);
const EXHAUSTED_ALLOWANCES = ["retry_cap_exhausted", "submission_retry_cap_exhausted",
  "preallocation_capacity_recovery_cap_exhausted", "market_miss_recovery_cap_exhausted"];
const ENDED_BLOCKERS = new Set([
  ...EXHAUSTED_ALLOWANCES.flatMap(code => [code, `scene_progression_${code}`, `scene_intake_${code}`]),
  "scene_intake_authority_expired", "scene_intake_authority_revoked"]);
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

/** A finished job evaluation's outcome for the scene, and whether any test on it executed. */
export type SceneScreeningResult = { outcome: ScreeningOutcome; observed: boolean };

export function projectWebsiteSceneProgression(record: Record<string, any> | null | undefined,
  testAccepted: boolean | SceneScreeningResult = false): TaskSceneProgression | null {
  const outcome = adoptedSceneOutcome(record);
  if (outcome) {
    const sceneOutcome = sceneOutcomeReading(outcome);
    if (!outcome.terminal) return { state: "waiting", sceneOutcome };
    return outcome.kind === "held" ? { state: "held", heldReason: "held_capability", sceneOutcome } : { state: "ended", sceneOutcome };
  }
  const state = record?.state;
  const phase = record?.pipeline_status?.phase;
  if (state === "completed" && typeof testAccepted === "object") {
    const { outcome, observed } = testAccepted;
    if (outcome === "estimate") return { state: "evaluated" };
    if (isScreeningHeldOutcome(outcome)) return { state: "held", heldReason: outcome };
    // Waiting on us or the owner, or planned again: the scene is tested only once a test executed.
    return { state: observed ? "testing" : "completed", progressOutcome: outcome };
  }
  if (state === "completed") return { state: testAccepted || phase === "policy_canary_complete" ? "testing" : "completed" };
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
export async function* queryPages(query: FirebaseFirestore.Query, size = 100,
  read: (query: FirebaseFirestore.Query) => Promise<FirebaseFirestore.QuerySnapshot> = query => query.get()) {
  let cursor: string | null = null;
  for (;;) {
    let page = query.orderBy("__name__").limit(size);
    if (cursor) page = page.startAfter(cursor);
    const snapshot = await read(page);
    if (snapshot.docs.length) yield snapshot.docs;
    if (snapshot.docs.length < size) return;
    cursor = snapshot.docs[snapshot.docs.length - 1].id;
  }
}

/** Commercial scope follows the same retained correction as scene progression.
 * A matching intake was produced from the corrected ready preparation; the
 * earlier intake cannot release a pending selection, even with an unchanged brief. */
export async function readWebsiteTargetScope(requestId: string, captureId: string,
  session: Record<string, any> | null | undefined,
  read?: (query: FirebaseFirestore.Query) => Promise<FirebaseFirestore.QuerySnapshot>) {
  const selection = taskTargetSelection(session);
  const {correctionsDigest, rejected} = selection;
  if (!correctionsDigest || rejected) return {correctionsDigest, superseded: rejected};
  if (!db) throw new Error('website_scene_progression_unavailable');
  for await (const rows of queryPages(db.collection(SCENE_INTAKE_COLLECTION)
    .where('website_request_id', '==', requestId), 100, read)) {
    for (const row of rows) {
      const value = row.data();
      if (value.source_session_id !== captureId || !taskTargetSelectionApplies(session, value)) continue;
      const state = projectWebsiteSceneProgression(value)?.state;
      if (state && state !== 'ended') return {correctionsDigest, superseded: false};
    }
  }
  return {correctionsDigest, superseded: true};
}

/** What a scene's job evaluations say, read in any order. */
export type SceneScreening = { estimate: boolean; running: boolean; observed: boolean; outcome: ScreeningOutcome | null };

/**
 * The scene's job evaluations in this team (F-03). Any campaign's estimate is
 * the job's result. Otherwise a campaign still open with an executed test is
 * testing. Otherwise the newest finished campaign speaks for the job (by
 * creation time, then id): a newer campaign plans the current candidates
 * again. A campaign closed as superseded speaks only through its successor,
 * and only while no other campaign has finished.
 */
export function sceneScreening(runs: Iterable<{ id: string; run: Record<string, any> | undefined }>, team: string): SceneScreening {
  let estimate = false, running = false, observed = false, superseded = false;
  let newest: { key: string; outcome: ScreeningOutcome } | null = null;
  for (const { id, run } of runs) {
    if (run?.run_kind !== "beta_policy_screening" || run.team_namespace !== team) continue;
    const outcome = storedScreeningOutcome(run.screening_outcome);
    const executed = run.screening_execution_observed === true;
    observed ||= executed;
    if (!["completed", "blocked"].includes(run.state) || !outcome) { running ||= executed; continue; }
    if (outcome === "estimate") estimate = true;
    else if (outcome === "superseded") superseded = true;
    else {
      const key = `${String(run.created_at_iso ?? "")}\u0000${id}`;
      if (!newest || key > newest.key) newest = { key, outcome };
    }
  }
  return { estimate, running, observed, outcome: newest?.outcome ?? (superseded ? "superseded" : null) };
}

/** How the scene reads from its job evaluations alone: an outcome, an open test (true), or nothing yet (false). */
export function sceneScreeningResult(scene: SceneScreening): boolean | SceneScreeningResult {
  if (scene.estimate) return { outcome: "estimate", observed: true };
  if (scene.running) return true;
  return scene.outcome ? { outcome: scene.outcome, observed: scene.observed } : false;
}

/**
 * Whether the Pipeline accepted a policy test on a configured scene of this
 * intake's task, in the intake's own team. A configured scene carries the
 * task's objects, so this is the first internal test of the finished scene.
 */
async function firstTestAccepted(store: FirebaseFirestore.Firestore, intake: Record<string, any>): Promise<boolean | SceneScreeningResult> {
  const taskId = intake.request?.task?.task_id;
  const team = intake.request?.owner?.organization_id;
  if (typeof taskId !== "string" || !taskId || typeof team !== "string" || !team) return false;
  const runs: Array<{ id: string; run: Record<string, any> | undefined }> = [];
  if (typeof intake.receipt?.intent_id === "string") {
    for await (const rows of queryPages(store.collection(POLICY_RUN_COLLECTION)
      .where("source_scene_intent_id", "==", intake.receipt.intent_id))) {
      runs.push(...rows.map(row => ({ id: row.id, run: row.data() })));
    }
  }
  // An estimate, or a test still running, needs no launch lookup. A finished
  // outcome without an estimate is a fallback behind any accepted launch test.
  const scene = sceneScreening(runs, team);
  if (scene.estimate || scene.running) return sceneScreeningResult(scene);
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
  return sceneScreeningResult(scene);
}

/** The site's latest scene intake for this capture, projected. Throws when it cannot be read. */
export async function readWebsiteSceneProgression(requestId: string, captureId: string): Promise<TaskSceneProgression | null> {
  if (!db) throw new Error("website_scene_progression_unavailable");
  let latest: Record<string, any> | undefined;
  const session = (await db.collection('captureUploadSessions').doc(captureId).get()).data();
  for await (const rows of queryPages(db.collection(SCENE_INTAKE_COLLECTION).where("website_request_id", "==", requestId))) {
    for (const row of rows) {
      const value = row.data();
      if (value.source_session_id === captureId && taskTargetSelectionApplies(session, value) && (!latest
        || String(value.created_at_iso || "") > String(latest.created_at_iso || ""))) latest = value;
    }
  }
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
