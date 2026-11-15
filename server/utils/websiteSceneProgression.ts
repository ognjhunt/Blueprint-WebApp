/**
 * Beta journey L3/L6: what a site is told about its scene after hand-off.
 *
 * The launch worker polls the Pipeline's scene intent into
 * `taskEvaluationSceneIntakes`; until now no site page read it, so a scene
 * that could never become runnable still read as "preparing". This projects
 * the site's latest intake to a coarse state and nothing more: no Pipeline
 * phase, blocker, attempt or spend detail reaches a site.
 *
 * A built scene is "ready" for the site once the Pipeline has published the
 * job's company simulation package (`storedCompanySimulation`, the scene,
 * its object and the success rule); until then it is still being built. A
 * blocked scene-stage hold the Pipeline sent (`betaPolicyScreeningHold`) is
 * `held`, in the hold's own sentence; a released hold says nothing.
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
import { isSceneHoldOutcome, screeningHoldDetail, type SceneHoldOutcome, type ScreeningHoldDetail } from "./betaPolicyScreeningContract";
import { SCREENING_HOLD_RUN_KIND } from "./betaPolicyScreeningHold";
import { adoptedSceneOutcome, sceneOutcomeReading } from "./sceneIntentOutcome";
import { storedCompanySimulation } from "./websiteCompanySimulation";

// Pipeline blocks that stay blocked once hit (task_evaluation_scene_progression):
// the configuration failed for good, the policy canary blocked (at or before
// its provider), the intent's authority ended, or a bounded retry/recovery
// allowance ran out. The Pipeline prefixes each code with the module that
// raised it (`scene_progression_`, `scene_intake_`); older records carry the
// bare code. A spent attempt or spend cap waits on the owner's money approval
// and is never an ending.
// A failed scene configuration is one paid build attempt, which the Pipeline retries and can still succeed after
// (review, 2026-11-11: on one job 17 of 19 attempts failed before one succeeded). It is never an ending here; the
// scene has ended only when the Pipeline's own record says the build is final (the intent outcome, above).
const ENDED_PHASES = new Set(["policy_canary_blocked", "policy_canary_preprovider_blocked", "authority"]);
const RETRIED_PHASES = new Set(["scene_configuration_failed"]);
const EXHAUSTED_ALLOWANCES = ["retry_cap_exhausted", "submission_retry_cap_exhausted",
  "preallocation_capacity_recovery_cap_exhausted", "market_miss_recovery_cap_exhausted"];
const ENDED_BLOCKERS = new Set([
  ...EXHAUSTED_ALLOWANCES.flatMap(code => [code, `scene_progression_${code}`, `scene_intake_${code}`]),
  "scene_intake_authority_expired", "scene_intake_authority_revoked"]);
const POLICY_RUN_COLLECTION = "taskEvaluationPolicyRuns";
const IN_FLIGHT = new Set(["revocation_pending", "forward_pending", "forward_blocked",
  "commercial_authorization_required", "accepted", "closeout_pending"]);

/** What a built scene adds to its intake: the scene-stage hold that speaks for it, and whether its simulation is ready. */
export type SceneStageReading = { hold: SceneHold | null; simulationReady: boolean };
/** A blocked scene-stage hold: its outcome and, when it has words of its own, its detail. */
export type SceneHold = { outcome: SceneHoldOutcome; holdDetail?: ScreeningHoldDetail };

export function projectWebsiteSceneProgression(record: Record<string, any> | null | undefined,
  stage: SceneStageReading | null = null): TaskSceneProgression | null {
  const outcome = adoptedSceneOutcome(record);
  if (outcome) {
    const sceneOutcome = sceneOutcomeReading(outcome);
    if (!outcome.terminal) return { state: "waiting", sceneOutcome };
    return outcome.kind === "held" ? { state: "held", heldReason: "held_capability", sceneOutcome } : { state: "ended", sceneOutcome };
  }
  const state = record?.state;
  if (state === "completed") {
    const hold = stage?.hold;
    if (hold) return { state: "held", heldReason: hold.outcome, ...(hold.holdDetail ? { holdDetail: hold.holdDetail } : {}) };
    return { state: stage?.simulationReady ? "ready" : "completed" };
  }
  // The worker's own terminal states: a typed terminal refusal, or the intent's authority ended.
  if (state === "blocked" || state === "expired" || state === "revoked") return { state: "ended" };
  if (!IN_FLIGHT.has(state)) return null;
  const status = record?.pipeline_status;
  if (status?.status === "blocked") {
    const blockers: unknown[] = Array.isArray(status.blockers) ? status.blockers : [];
    if (ENDED_PHASES.has(status.phase) || (blockers.length > 0 && blockers.every(code =>
      typeof code === "string" && ENDED_BLOCKERS.has(code)))) return { state: "ended" };
    return RETRIED_PHASES.has(status.phase) ? { state: "waiting", attemptFailed: true } : { state: "waiting" };
  }
  if (status?.status === "needs_input" || state === "forward_blocked") return { state: "waiting" };
  return { state: "in_progress" };
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

/**
 * The scene-stage hold that speaks for a scene in this team: a stored hold record
 * (`betaPolicyScreeningHold`) that is blocked with a hold outcome. A released,
 * cancelled or closed hold says nothing. Campaign records of Blueprint's
 * retired early trial (`run_kind: beta_policy_screening`) stay stored for
 * withdrawal and the job ceiling, and are not read here.
 */
export function sceneHold(runs: Iterable<{ id: string; run: Record<string, any> | undefined }>, team: string): SceneHold | null {
  for (const { run } of runs) {
    if (run?.run_kind !== SCREENING_HOLD_RUN_KIND || run.team_namespace !== team || run.state !== "blocked") continue;
    if (!isSceneHoldOutcome(run.screening_outcome)) continue;
    const holdDetail = run.screening_outcome === "held_setup" ? screeningHoldDetail(run.hold_reason_code, run.hold_detail_code) : null;
    return { outcome: run.screening_outcome, ...(holdDetail ? { holdDetail } : {}) };
  }
  return null;
}

/** The stored hold records of this intake's scene, in its own team. */
async function readSceneHold(store: FirebaseFirestore.Firestore, intake: Record<string, any>): Promise<SceneHold | null> {
  const team = intake.request?.owner?.organization_id;
  if (typeof team !== "string" || !team || typeof intake.receipt?.intent_id !== "string") return null;
  const runs: Array<{ id: string; run: Record<string, any> | undefined }> = [];
  for await (const rows of queryPages(store.collection(POLICY_RUN_COLLECTION)
    .where("source_scene_intent_id", "==", intake.receipt.intent_id))) {
    runs.push(...rows.map(row => ({ id: row.id, run: row.data() })));
  }
  return sceneHold(runs, team);
}

/** The site's latest scene intake for this capture, and the capture's session. Throws when it cannot be read. */
export async function readLatestWebsiteSceneIntake(requestId: string, captureId: string):
  Promise<{ latest: Record<string, any> | undefined; session: Record<string, any> | undefined }> {
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
  return { latest, session };
}

/** The site's latest scene intake for this capture, projected. Throws when it cannot be read. */
export async function readWebsiteSceneProgression(requestId: string, captureId: string): Promise<TaskSceneProgression | null> {
  if (!db) throw new Error("website_scene_progression_unavailable");
  const { latest, session } = await readLatestWebsiteSceneIntake(requestId, captureId);
  const stage = latest?.state === "completed"
    ? { hold: await readSceneHold(db, latest), simulationReady: storedCompanySimulation(session, captureId) !== null } : null;
  return projectWebsiteSceneProgression(latest, stage);
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
