/**
 * Protects old jobs from a late window ending; not a status.
 *
 * Before Blueprint's early trial was retired (2026-11-14), a finished trial campaign that reached an estimate or a
 * hold stood above a recorded window ending (`resultOutranksWindowEnding`, through the scene progression), so the
 * window sweep never ended that job and never sent its ending email. Those windows closed long ago. The page, the
 * outlook and every email no longer read campaign records; only the sweep's three decisions (end the job, send its
 * window ending, send its no-grant ending) still do, here, read-only, so no old job is ended or emailed late.
 *
 * Read as the scene progression read campaigns: only for the latest intake of the capture once it completed, not
 * once the Pipeline sent its own outcome for the scene, and per the intake's own team. Any estimate protects; else
 * an open campaign that executed a test does not (it read as testing); else the newest finished campaign protects
 * when its outcome is a hold. A run an earlier release stored as still waiting (`awaiting_spend_approval`,
 * `setup_repair`) with a result record was read again from its publication and could turn into an estimate or a hold;
 * it protects here,
 * which can only keep a job from being ended, never end one.
 */
import { isScreeningHeldOutcome, storedScreeningOutcome } from "./betaPolicyScreeningContract";
import { adoptedSceneOutcome } from "./sceneIntentOutcome";
import { queryPages, readLatestWebsiteSceneIntake } from "./websiteSceneProgression";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";

const LEGACY_WAITS = new Set(["awaiting_spend_approval", "setup_repair"]);

/** Whether this job's stored campaign records reached a result that kept it from a window ending before. Throws when unreadable. */
export function retainedTrialResultProtects(runs: Iterable<{ id: string; run: Record<string, any> | undefined }>, team: string): boolean {
  let running = false;
  let newest: { key: string; outcome: string } | null = null;
  for (const { id, run } of runs) {
    if (run?.run_kind !== "beta_policy_screening" || run.team_namespace !== team) continue;
    const finished = ["completed", "blocked"].includes(run.state);
    // Read again from its publication before, so it could end as anything: it protects (see above).
    const outcome = finished && LEGACY_WAITS.has(run.screening_outcome) && typeof run.result_record_id === "string" ? "legacy_wait"
      : storedScreeningOutcome(run.screening_outcome);
    if (!finished || !outcome) { running ||= run.screening_execution_observed === true; continue; }
    if (outcome === "estimate" || outcome === "legacy_wait") return true;
    if (outcome === "superseded") continue;
    const key = `${String(run.created_at_iso ?? "")}\u0000${id}`;
    if (!newest || key > newest.key) newest = { key, outcome };
  }
  return !running && newest !== null && isScreeningHeldOutcome(newest.outcome);
}

export async function retainedTrialResultOutranksEnding(requestId: string, captureId: string): Promise<boolean> {
  if (!db) throw new Error("website_scene_progression_unavailable");
  const { latest } = await readLatestWebsiteSceneIntake(requestId, captureId);
  if (latest?.state !== "completed" || latest.pipeline_status?.phase === "policy_canary_complete" || adoptedSceneOutcome(latest)) return false;
  const team = latest.request?.owner?.organization_id, intent = latest.receipt?.intent_id;
  if (typeof team !== "string" || !team || typeof intent !== "string") return false;
  const runs: Array<{ id: string; run: Record<string, any> | undefined }> = [];
  for await (const rows of queryPages(db.collection("taskEvaluationPolicyRuns").where("source_scene_intent_id", "==", intent)))
    runs.push(...rows.map(row => ({ id: row.id, run: row.data() })));
  return retainedTrialResultProtects(runs, team);
}
