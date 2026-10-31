/**
 * Owner-approved, time-only extensions of a scene intent's execution window.
 *
 * The Pipeline records the sealed extension (operator door, after the owner's
 * approval) and sends this notice over the signed Pipeline sync transport.
 * The WebApp keeps an append-only history on the scene intake and lets the
 * readers that would otherwise stop the job at the sealed expiry use
 * max(raw, latest verified extension), never past raw + 7 days. Nothing here
 * changes a spend cap, an attempt count, a provider, the task or the rights.
 */
import { z } from "zod";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { crossRuntimeDigest } from "./crossRuntimeCanonical";
import { projectWebsiteCaptureRights } from "./websiteTaskContext";
import { assertWebsiteRunOpen } from "./websiteRunClosure";

export const SCENE_EXECUTION_WINDOW_NOTICE_SCHEMA = "task_evaluation_scene_execution_window_extension_notice.v1";
export const SCENE_EXECUTION_WINDOW_MAX_SECONDS = 7 * 86400;
const SPONSORSHIP_WINDOW_SCHEMA = "website_scene_sponsorship_execution_window.v1";
// The scene intake collection (taskEvaluationSceneIntake.SCENE_INTAKE_COLLECTION),
// named here so the sponsorship reader does not import the intake worker.
const SCENE_INTAKES = "taskEvaluationSceneIntakes";
const MAX = SCENE_EXECUTION_WINDOW_MAX_SECONDS;
const sha = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const epoch = z.number().finite().positive();
const intentId = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/);

const noticeFields = {
  schema_version: z.literal(SCENE_EXECUTION_WINDOW_NOTICE_SCHEMA),
  intent_id: intentId, intent_digest: sha, extension_digest: sha,
  original_expires_at_epoch: epoch, expires_at_epoch: epoch, issued_at_epoch: epoch,
  authorization_reference: z.string().min(1).max(500)
    .refine(value => value === value.trim() && !/[\u0000-\u001f\u007f-\u009f]/.test(value)),
  authorized_via: z.literal("operator_door"),
};
const boundedWindow = (value: { original_expires_at_epoch: number; expires_at_epoch: number; issued_at_epoch: number }) =>
  value.original_expires_at_epoch < value.expires_at_epoch && value.expires_at_epoch <= value.original_expires_at_epoch + MAX
  && value.issued_at_epoch < value.expires_at_epoch && value.expires_at_epoch <= value.issued_at_epoch + MAX;
export const sceneExecutionWindowNotice = z.object(noticeFields).strict().refine(boundedWindow);
export type SceneExecutionWindowNotice = z.infer<typeof sceneExecutionWindowNotice>;
const storedExtension = z.object({ ...noticeFields, received_at_iso: z.string().datetime() }).strict().refine(boundedWindow);
const sponsorshipWindow = z.object({
  schema_version: z.literal(SPONSORSHIP_WINDOW_SCHEMA), scope: z.literal("execution_time_only"),
  authority_digest: sha, intent_id: intentId, intake_id: intentId, extension_digest: sha,
  original_expires_at_epoch: epoch, expires_at_epoch: epoch,
}).strict();

const revoked = (intake: Record<string, any>) => Boolean(intake.revocation_requested || intake.revocation_receipt)
  || ["revocation_pending", "revoked", "cancelled"].includes(intake.state);

/** Stored extensions that bind this exact intake, intent and sealed expiry; others are ignored. */
export function verifiedSceneExecutionWindowExtensions(intake: Record<string, any> | undefined): SceneExecutionWindowNotice[] {
  const raw = intake?.request?.execution?.expires_at_epoch;
  const rows = intake?.execution_window_extensions;
  if (!intake || typeof raw !== "number" || !Number.isFinite(raw) || !Array.isArray(rows)) return [];
  return rows.flatMap(row => {
    const parsed = storedExtension.safeParse(row);
    if (!parsed.success || parsed.data.intent_id !== intake.receipt?.intent_id
      || parsed.data.intent_digest !== intake.receipt?.intent_digest || parsed.data.original_expires_at_epoch !== raw)
      return [];
    const { received_at_iso: _received, ...notice } = parsed.data;
    return [notice];
  });
}

/**
 * The scene intake's effective expiry: max(raw, latest verified extension),
 * never past raw + 7 days. A non-numeric raw expiry is returned unchanged so
 * each caller keeps its own handling of it.
 */
export function effectiveSceneExecutionExpiry(intake: Record<string, any> | undefined): number {
  const raw = intake?.request?.execution?.expires_at_epoch;
  if (typeof raw !== "number" || !Number.isFinite(raw)) return raw;
  const extended = verifiedSceneExecutionWindowExtensions(intake)
    .reduce((latest, row) => Math.max(latest, row.expires_at_epoch), raw);
  return Math.min(extended, raw + MAX);
}

/**
 * The "still valid until" of a retained preparation grant whose bound scene
 * intent carries a verified extension; undefined when nothing extends it.
 * The grant itself (caps, attempts, issued window, digest) is unchanged.
 */
export function sponsorshipExecutionWindowUntil(grant: Record<string, any> | undefined,
  job: Record<string, any> | undefined, intake: Record<string, any> | undefined): number | undefined {
  const window = sponsorshipWindow.safeParse(job?.website_scene_sponsorship_execution_window);
  const raw = grant?.expires_at_epoch;
  if (!window.success || !intake || typeof raw !== "number" || !Number.isFinite(raw)) return undefined;
  const value = window.data;
  if (value.authority_digest !== grant!.authority_digest || value.original_expires_at_epoch !== raw
    || revoked(intake) || (intake.root_sponsorship_digest ?? intake.sponsorship_digest) !== grant!.authority_digest
    || intake.receipt?.intent_id !== value.intent_id
    || !verifiedSceneExecutionWindowExtensions(intake).some(row =>
      row.extension_digest === value.extension_digest && row.expires_at_epoch === value.expires_at_epoch))
    return undefined;
  return Math.min(value.expires_at_epoch, raw + MAX);
}

/** The intake a job's sponsorship window names, read in the caller's transaction. */
export async function sponsorshipWindowIntake(transaction: { get: (ref: any) => Promise<any> },
  job: Record<string, any> | undefined) {
  const id = job?.website_scene_sponsorship_execution_window?.intake_id;
  if (!db || typeof id !== "string" || !intentId.safeParse(id).success) return undefined;
  return (await transaction.get(db.collection(SCENE_INTAKES).doc(id))).data() as Record<string, any> | undefined;
}

/**
 * Record one Pipeline-signed extension notice. Append-only and idempotent by
 * extension_digest; the same digest with any other content is refused.
 */
export async function recordSceneExecutionWindowExtension(input: SceneExecutionWindowNotice) {
  const notice = sceneExecutionWindowNotice.parse(input);
  if (!db) throw new Error("scene_execution_window_store_unavailable");
  const store = db;
  const matches = await store.collection(SCENE_INTAKES).where("receipt.intent_id", "==", notice.intent_id).limit(2).get();
  if (matches.docs.length !== 1) throw new Error("scene_execution_window_intake_unavailable");
  const intakeRef = matches.docs[0].ref;
  return store.runTransaction(async transaction => {
    const intake = (await transaction.get(intakeRef)).data() as Record<string, any> | undefined;
    if (!intake || intake.receipt?.intent_id !== notice.intent_id)
      throw new Error("scene_execution_window_intake_unavailable");
    if (intake.receipt?.intent_digest !== notice.intent_digest || crossRuntimeDigest(intake.request) !== intake.request_digest)
      throw new Error("scene_execution_window_intent_mismatch");
    if (intake.request?.execution?.expires_at_epoch !== notice.original_expires_at_epoch)
      throw new Error("scene_execution_window_original_expiry_mismatch");
    if (revoked(intake)) throw new Error("scene_execution_window_intent_revoked");
    // Capture rights are read on the WebApp's own job record, as the Pipeline did before writing.
    if (typeof intake.website_request_id !== "string" || !intake.website_request_id)
      throw new Error("scene_execution_window_capture_rights_unavailable");
    const jobRef = store.collection("inboundRequests").doc(intake.website_request_id);
    const job = (await transaction.get(jobRef)).data() as Record<string, any> | undefined;
    if (!job) throw new Error("scene_execution_window_capture_rights_unavailable");
    if (job.capture_withdrawal) throw new Error("scene_execution_window_capture_withdrawn");
    if (!projectWebsiteCaptureRights(job).derived_scene_generation_allowed)
      throw new Error("scene_execution_window_consent_revoked");
    try { assertWebsiteRunOpen(job, intake.website_request_id, intake.source_session_id); }
    catch { throw new Error("scene_execution_window_run_not_open"); }
    const history: Record<string, any>[] = Array.isArray(intake.execution_window_extensions)
      ? intake.execution_window_extensions : [];
    const prior = history.find(row => row?.extension_digest === notice.extension_digest);
    const receipt = (status: "recorded" | "replayed", record: Record<string, any>, mirrored: boolean) => ({
      schema_version: "task_evaluation_scene_execution_window_extension_receipt.v1", status,
      intent_id: notice.intent_id, extension_digest: notice.extension_digest, expires_at_epoch: notice.expires_at_epoch,
      effective_expires_at_epoch: effectiveSceneExecutionExpiry(record), intake_state: record.state ?? null,
      sponsorship_window_mirrored: mirrored, spend_caps_changed: false });
    if (prior) {
      const { received_at_iso: _received, ...stored } = prior;
      if (crossRuntimeDigest(stored) !== crossRuntimeDigest(notice))
        throw new Error("scene_execution_window_extension_conflict");
      return receipt("replayed", intake, job.website_scene_sponsorship_execution_window?.extension_digest
        === notice.extension_digest);
    }
    const extensions = [...history, { ...notice, received_at_iso: new Date().toISOString() }];
    // A status poll that stopped because the window ended resumes; any other state is left as it is.
    const reopened = intake.state === "expired"
      ? { state: "accepted", next_forward_at_ms: 0, closeout_complete: false, blocker: null } : {};
    const updated = { ...intake, execution_window_extensions: extensions, ...reopened };
    if (!verifiedSceneExecutionWindowExtensions(updated).some(row => row.extension_digest === notice.extension_digest))
      throw new Error("scene_execution_window_extension_invalid");
    // The retained preparation grant this intent is bound to keeps its digest and
    // caps; its "still valid" read follows this window (sponsorshipExecutionWindowUntil).
    const grant = job.website_scene_sponsorship;
    const root = intake.root_sponsorship_digest ?? intake.sponsorship_digest;
    const current = sponsorshipWindow.safeParse(job.website_scene_sponsorship_execution_window);
    const mirror = grant && typeof root === "string" && grant.authority_digest === root
      && grant.expires_at_epoch === notice.original_expires_at_epoch
      && !(current.success && current.data.authority_digest === root && current.data.expires_at_epoch >= notice.expires_at_epoch);
    transaction.update(intakeRef, { execution_window_extensions: extensions, ...reopened,
      updated_at_iso: new Date().toISOString() });
    if (mirror) transaction.update(jobRef, { website_scene_sponsorship_execution_window: {
      schema_version: SPONSORSHIP_WINDOW_SCHEMA, scope: "execution_time_only", authority_digest: root,
      intent_id: notice.intent_id, intake_id: intakeRef.id, extension_digest: notice.extension_digest,
      original_expires_at_epoch: notice.original_expires_at_epoch, expires_at_epoch: notice.expires_at_epoch } });
    return receipt("recorded", updated, Boolean(mirror));
  });
}
