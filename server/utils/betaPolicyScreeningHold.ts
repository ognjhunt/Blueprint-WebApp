/**
 * A website job's evaluation held before any campaign could start, by name.
 *
 * After the scene is published, the Pipeline's evaluation can end before it
 * plans a campaign: the scene failed its robot-free check, the check could not
 * be completed and nothing retries it, the task has no such check, or the
 * scene's team half could not be compiled and nothing retries it. Only a
 * campaign publication reached this site, so those jobs read "in progress" for
 * good. The Pipeline now sends one hold per scene intent over the same signed
 * transport (`beta_policy_screening_holds`), with a revision and a self-digest.
 *
 * The hold is kept as its own row among the scene's evaluation runs
 * (`run_kind: beta_policy_screening_hold`), so the job page, its one result
 * email and the ops alert read it the way they read a finished campaign. It
 * speaks only while no campaign was published for the scene, and a `released`
 * revision (the evaluation moved again after a deploy) silences it. It carries
 * no job evidence binding, so it is never listed as a result.
 */
import { createHash } from "node:crypto";
import { z } from "zod";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { crossRuntimeArtifactDigest } from "./crossRuntimeCanonical";
import { scientificBriefDigest } from "./jobEvidenceContract";
import { assertManagedScreeningCaptureCurrent, assertScreeningSceneSource, managedJobTask, readManagedJobSourceSession,
  readManagedScreeningCapture } from "./jobManagedEvaluation";
import { SCENE_INTAKE_COLLECTION } from "./taskEvaluationSceneIntake";
import { betaPolicyScreeningSourceSchema, isScreeningAttentionOutcome, storedScreeningOutcome,
  type ScreeningHeldOutcome } from "./betaPolicyScreeningContract";
import { heldOutcomeNoticeIntent } from "./screeningOutcomeNotifications";
import type { TaskItemInventoryRecord } from "./taskItemInventory";
import { websiteRunClosure } from "./websiteRunClosure";

export const SCREENING_HOLD_SCHEMA = "beta_policy_screening_hold.v1";
export const SCREENING_HOLD_RUN_KIND = "beta_policy_screening_hold";

/** The Pipeline's reason, and the outcome the site is told for it. */
export const SCREENING_HOLD_OUTCOMES = {
  robot_free_probe_failed: "held_scene_check",
  robot_free_probe_not_completed: "held_setup",
  robot_free_probe_unavailable_for_task: "held_capability",
  team_scene_packet_blocked: "held_setup",
} as const satisfies Record<string, ScreeningHeldOutcome>;
type HoldReason = keyof typeof SCREENING_HOLD_OUTCOMES;
const REASONS = Object.keys(SCREENING_HOLD_OUTCOMES) as [HoldReason, ...HoldReason[]];

const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/);
const code = z.string().regex(/^[a-z][a-z0-9_:.=-]{0,199}$/);
const holdSchema = z.object({
  schema_version: z.literal(SCREENING_HOLD_SCHEMA),
  hold_id: z.string().regex(/^hold-[a-f0-9]{32}$/),
  site_id: identifier,
  source: betaPolicyScreeningSourceSchema,
  status: z.enum(["held", "released"]),
  reason_code: z.enum(REASONS).nullable(),
  detail_code: code.nullable(),
  revision: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  generated_at: z.string().datetime({ offset: true }),
  hold_digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
}).strict().superRefine((value, ctx) => {
  // One hold per scene intent, named by it; a release names no reason.
  const id = `hold-${createHash("sha256").update(value.source.scene_intent_id).digest("hex").slice(0, 32)}`;
  if (value.hold_id !== id || (value.status === "held") !== (value.reason_code !== null)
    || (value.status === "released" && value.detail_code !== null))
    ctx.addIssue({ code: "custom", message: "Screening hold identity or reason mismatch" });
});
export type BetaPolicyScreeningHold = z.infer<typeof holdSchema>;

export function parseBetaPolicyScreeningHold(value: unknown): BetaPolicyScreeningHold | null {
  const parsed = holdSchema.safeParse(value);
  try {
    if (!parsed.success || crossRuntimeArtifactDigest(parsed.data, "hold_digest") !== parsed.data.hold_digest) return null;
  } catch {
    return null;
  }
  return parsed.data;
}

/** The outcome a hold tells the site, or null once released. */
export const screeningHoldOutcome = (hold: Pick<BetaPolicyScreeningHold, "status" | "reason_code">): ScreeningHeldOutcome | null =>
  hold.status === "held" && hold.reason_code ? SCREENING_HOLD_OUTCOMES[hold.reason_code] : null;

/**
 * Bind the hold to the scene intake and the job exactly as a campaign is bound
 * (`ingestBetaPolicyScreening`), then keep its latest revision. Replays are a
 * no-op; an older revision never replaces a newer one.
 */
export async function ingestBetaPolicyScreeningHold(hold: BetaPolicyScreeningHold) {
  if (!db) throw new Error("screening_store_unavailable");
  const store = db;
  const matches = await store.collection(SCENE_INTAKE_COLLECTION)
    .where("receipt.intent_id", "==", hold.source.scene_intent_id).limit(2).get();
  if (matches.docs.length !== 1) throw new Error("screening_scene_intake_unavailable");
  const intakeRef = matches.docs[0].ref;
  const selected = matches.docs[0].data();
  if (typeof selected.website_request_id !== "string" || typeof selected.source_session_id !== "string")
    throw new Error("screening_scene_intake_unavailable");
  const selectedJob = (await store.collection("inboundRequests").doc(selected.website_request_id).get()).data();
  const screeningCapture = selectedJob?.job_evidence_source ? { captureId: selected.source_session_id }
    : await readManagedScreeningCapture(selected.website_request_id, selected.source_session_id);
  const runRef = store.collection("taskEvaluationPolicyRuns").doc(hold.hold_id);
  return store.runTransaction(async transaction => {
    const intake = (await transaction.get(intakeRef)).data();
    const jobId = intake?.website_request_id;
    if (typeof jobId !== "string" || jobId !== selected.website_request_id || intake?.source_session_id !== screeningCapture.captureId)
      throw new Error("screening_scene_source_mismatch");
    const [job, brief, inventory, oldRun] = await Promise.all([
      transaction.get(store.collection("inboundRequests").doc(jobId)),
      transaction.get(store.collection("siteTaskBriefs").doc(jobId)),
      transaction.get(store.collection("siteTaskItemInventories").doc(jobId)),
      transaction.get(runRef),
    ]);
    if (!brief.exists) throw new Error("job_brief_not_agreed");
    await assertManagedScreeningCaptureCurrent(jobId, screeningCapture, ref => transaction.get(ref));
    const scope = managedJobTask({ binding: { job_id: jobId, brief_digest: scientificBriefDigest(brief.data()!) },
      record: job.data(), brief: brief.data(), allowProposedScreening: true, screeningCapture,
      inventory: inventory.exists ? inventory.data() as TaskItemInventoryRecord : null,
      sourceSession: await readManagedJobSourceSession(job.data(), ref => transaction.get(ref)) });
    assertScreeningSceneSource(hold, intake!, scope);
    const previous = oldRun.data();
    const receipt = (status: "created" | "updated" | "replayed", value: { hold_revision: number; hold_digest: string }) =>
      ({ status, hold_id: hold.hold_id, revision: value.hold_revision, hold_digest: value.hold_digest });
    if (previous) {
      if (previous.run_kind !== SCREENING_HOLD_RUN_KIND || previous.source_scene_intent_id !== hold.source.scene_intent_id
        || previous.website_request_id !== jobId) throw new Error("screening_hold_identity_conflict");
      if (previous.hold_digest === hold.hold_digest || previous.hold_revision > hold.revision)
        return receipt("replayed", previous as { hold_revision: number; hold_digest: string });
      if (previous.hold_revision === hold.revision) throw new Error("screening_hold_revision_conflict");
    }
    const outcome = screeningHoldOutcome(hold);
    const closed = Boolean(websiteRunClosure(job.data(), jobId, hold.source.capture_id));
    // The site hears once when a hold first names an outcome (F-01); the same outcome again,
    // a release, or a run the owner closed owes nothing new.
    const notice = closed || outcome === storedScreeningOutcome(previous?.screening_outcome) ? null
      : heldOutcomeNoticeIntent(outcome, jobId, hold.hold_id, hold.source.scene_intent_id);
    const now = new Date().toISOString();
    transaction.set(runRef, {
      run_id: hold.hold_id, run_kind: SCREENING_HOLD_RUN_KIND, state: outcome ? "blocked" : "released",
      website_request_id: jobId, owner_user_id: intake!.request.owner.user_id, team_namespace: scope.teamNamespace,
      source_scene_intent_id: hold.source.scene_intent_id, source_scene_intake_id: intakeRef.id,
      source_scene_revision_digest: hold.source.scene_revision_digest, job_task_context_digest: scope.taskContextDigest,
      hold_reason_code: hold.reason_code, hold_detail_code: hold.detail_code, hold_revision: hold.revision,
      hold_digest: hold.hold_digest, hold_generated_at: hold.generated_at, screening_outcome: outcome,
      ...(outcome && isScreeningAttentionOutcome(outcome) ? { screening_hold_reason: hold.reason_code } : {}),
      ...(notice ? { outcome_notification_pending: true, outcome_notification_intent: notice }
        : previous?.outcome_notification_intent !== undefined ? { outcome_notification_pending: previous.outcome_notification_pending === true,
          outcome_notification_intent: previous.outcome_notification_intent } : {}),
      created_at_iso: previous?.created_at_iso ?? now, updated_at_iso: now });
    return receipt(previous ? "updated" : "created", { hold_revision: hold.revision, hold_digest: hold.hold_digest });
  });
}
