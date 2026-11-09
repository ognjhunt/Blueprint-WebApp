import { websiteCaptureOwnerUid } from "./websiteCaptureOwner";
/** Current-source preparation status; never a native assessment or preview verdict. */
import { z } from "zod";
import { preparationOutcomeSchema, preparationOutcomeV6Schema, projectPreparationOutcome, ROBOT_FIT_HOLD_PREFIX }
  from "./taskPreparationOutcome";
import { taskTargetChoiceQuestionSchema, type TaskTargetChoiceQuestion } from "./taskTargetChoiceContract";
import type { TaskOutcome } from "../../client/src/types/taskOutcome";
import { signedWebsitePipelineRequest } from "./websitePipelineSignedRequest";
import { dbAdmin as db, storageAdmin } from "../../client/src/lib/firebaseAdmin";
import { crossRuntimeArtifactDigest, crossRuntimeDigest } from "./crossRuntimeCanonical";
import { automationBatch } from "./automationBatch";
import { strictBoundedProofJson } from "./strictBoundedProofJson";
import { observeWebsiteCaptureOwner } from "./websiteCaptureOwnerObservation";
import { withWebsiteOwnerDeps } from "./websiteCaptureOwnerTransport";
import { assertWebsiteCaptureBindingInTransaction, resolveWebsiteCaptureBinding } from "./websiteCaptureBinding";
import { projectWebsiteCaptureRights } from "./websiteTaskContext";
import { TASK_BRIEFS_COLLECTION, type SiteTaskBriefRecord } from "./siteTaskBrief";
import { TASK_ITEM_INVENTORY_COLLECTION, type TaskItemInventoryRecord } from "./taskItemInventory";
import { buildBrowserDelivery } from "./websiteCaptureDelivery";
import { verifiedPendingManifest, verifiedPendingMarker } from "./websiteBrowserUploadStatus";
import type { BrowserPending } from "./websiteBrowserPending";
import { retainedWebsiteScenePurpose, currentWebsitePreparationStatusContext } from "./websiteSceneSponsorship";
import { nextWebsitePreparationWatch, parseWebsitePreparationWatch, WEBSITE_PREPARATION_WATCH_DUE_FIELD,
  WEBSITE_PREPARATION_WATCH_FIELD } from "./websitePreparationWatch";

const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/);
const sceneId = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,124}$/);
const captureId = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,131}$/);
const digest = z.string().regex(/^sha256:[a-f0-9]{64}$/);
export const websitePreparationSelectorSchema = z.object({
  request_id: id, scene_id: sceneId, capture_id: captureId,
  completion_marker_generation: z.string().regex(/^[1-9][0-9]{0,19}$/),
  producer_delivery_key: digest, source_payload_sha256: z.string().regex(/^[a-f0-9]{64}$/), task_context_digest: digest,
}).strict().refine(v => v.scene_id === `site-${v.request_id}`, "scene binding mismatch");
export type WebsitePreparationSelector = z.infer<typeof websitePreparationSelectorSchema>;
const statesV1 = ["preparing", "awaiting_inputs", "failed_retryable", "authority_ended", "handed_off"] as const;
/** v2 is additive (beta L3/L6): a capacity-only wait, and an ending with a reason. */
const statesV2 = [...statesV1, "capacity_delayed", "failed_terminal"] as const;
export const WEBSITE_PREPARATION_TERMINAL_REASONS = ["permanent_invalid", "retry_exhausted", "budget_exhausted",
  "capacity_blocked", "out_of_scope"] as const;
export type WebsitePreparationTerminalReason = typeof WEBSITE_PREPARATION_TERMINAL_REASONS[number];
const codes = { preparing: "preparation_in_progress", awaiting_inputs: "preparation_inputs_pending",
  failed_retryable: "preparation_retryable_failure", authority_ended: "preparation_authority_ended",
  handed_off: "preparation_handed_off", capacity_delayed: "preparation_capacity_delayed",
  failed_terminal: "preparation_failed_terminal" } as const;
const receiptBase = z.object(websitePreparationSelectorSchema.shape).extend({
  attempt_count: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  correlation_id: digest, status_digest: digest,
});
const receiptV1 = receiptBase.extend({
  schema_version: z.literal("website_preparation_status.v1"), state: z.enum(statesV1),
  code: z.enum(statesV1.map(state => codes[state]) as [string, ...string[]]),
}).strict();
const receiptV2 = receiptBase.extend({
  schema_version: z.literal("website_preparation_status.v2"), state: z.enum(statesV2),
  code: z.enum(statesV2.map(state => codes[state]) as [string, ...string[]]),
  terminal_reason: z.enum(WEBSITE_PREPARATION_TERMINAL_REASONS).nullable(),
}).strict();
const receiptV3 = receiptV2.extend({
  schema_version: z.literal("website_preparation_status.v3"),
  outcome: preparationOutcomeSchema.nullable(),
}).strict();
/** v4 adds the one optional question the site can answer inside this job; it never makes the job wait. */
const receiptV4 = receiptV3.extend({
  schema_version: z.literal("website_preparation_status.v4"),
  question: taskTargetChoiceQuestionSchema.nullable(),
}).strict();
/** v5 adds the job's robot fit table: which catalog robots fit by spec sheet, a spec-bounded estimate
 * (the Pipeline's docs/schemas/website_robot_fit_projection.v1.schema.json). Never a physical test. */
const fitCount = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const ROBOT_FIT_VERDICTS = ["fits", "fits_spec", "doesnt_fit", "unknown"] as const;
export const ROBOT_FIT_NOT_RUN_REASONS = ["preparation_blocked", "task_strategy_not_modelled", "subject_not_excised",
  "task_family_not_modelled"] as const;
export const robotFitSchema = z.object({
  schema_version: z.literal("website_robot_fit_projection.v1"),
  route: z.enum(["full", "geometry_only"]),
  status: z.enum(["completed", "not_run"]),
  reason: z.enum(ROBOT_FIT_NOT_RUN_REASONS).nullable(),
  evidence_label: z.literal("spec_bounded_estimate").nullable(),
  counts: z.object({fits: fitCount, fits_spec: fitCount, doesnt_fit: fitCount, unknown: fitCount}).strict().nullable(),
  models: z.array(z.object({name: z.string().min(1).max(120), manufacturer: z.string().min(1).max(120),
    verdict: z.enum(ROBOT_FIT_VERDICTS), open_checks: z.array(z.string().regex(/^[a-z_]{1,40}$/)).max(12)}).strict())
    .max(200),
  models_truncated: z.boolean(),
  table_digest: digest.nullable(),
}).strict().refine(fit => fit.status === "completed"
  ? fit.reason === null && fit.evidence_label === "spec_bounded_estimate" && fit.counts !== null && fit.table_digest !== null
  : fit.reason !== null && fit.evidence_label === null && fit.counts === null && fit.models.length === 0
    && fit.table_digest === null && !fit.models_truncated, "robot fit status mismatch");
export type RobotFitReceipt = z.infer<typeof robotFitSchema>;
const receiptV5 = receiptV4.extend({
  schema_version: z.literal("website_preparation_status.v5"),
  robot_fit: robotFitSchema.nullable(),
}).strict();
/** v6 adds the early robot fit precheck (Pipeline #3336, docs/schemas/website_robot_fit_precheck_projection.v1):
 * whether a robot the screening catalog runs can do the task in this room, decided before any spend, and the
 * hold it names when none can. A pre-spend estimate, never a physical test. */
export const ROBOT_FIT_PRECHECK_STATUSES = ["fit", "no_fit", "unknown"] as const;
export const ROBOT_FIT_PRECHECK_EMBODIMENTS = ["droid_franka_panda_robotiq_2f85_v1", "unitree_g1_dex3_sonic_v1",
  "registered_team_embodiment"] as const;
export const robotFitPrecheckSchema = z.object({
  schema_version: z.literal("website_robot_fit_precheck_projection.v1"),
  status: z.enum(ROBOT_FIT_PRECHECK_STATUSES),
  hold_reason: z.string().regex(new RegExp(`^${ROBOT_FIT_HOLD_PREFIX}[a-z][a-z0-9_]{0,99}$`)).nullable(),
  // Display only and open: any JSON value, or none, never makes the status unavailable. It is kept exactly as
  // sent, so the status digest still covers it; `publicRobotFitPrecheck` shows only a well-formed kind, else null.
  task_kind: z.unknown().optional(),
  counts: z.object({fit: fitCount, no_fit: fitCount, unknown: fitCount, unavailable: fitCount}).strict(),
  embodiments: z.array(z.object({embodiment: z.enum(ROBOT_FIT_PRECHECK_EMBODIMENTS),
    verdict: z.enum(ROBOT_FIT_PRECHECK_STATUSES), reasons: z.array(z.string().regex(/^[a-z][a-z0-9_]{0,79}$/)).max(4),
    fit_candidates: fitCount}).strict()).max(50),
  embodiments_truncated: z.boolean(),
  evidence_label: z.literal("pre_spend_estimate"),
  precheck_digest: digest,
  // The Pipeline's own rule: fit when any candidate fits, else unknown when any is undecided, else no fit (a hold).
}).strict().refine(fit => fit.status === (fit.counts.fit > 0 ? "fit" : fit.counts.unknown > 0 ? "unknown" : "no_fit")
  && (fit.status === "no_fit") === (fit.hold_reason !== null), "robot fit precheck status mismatch");
export type RobotFitPrecheckReceipt = z.infer<typeof robotFitPrecheckSchema>;
const receiptV6 = receiptV5.extend({
  schema_version: z.literal("website_preparation_status.v6"),
  outcome: preparationOutcomeV6Schema.nullable(),
  robot_fit_precheck: robotFitPrecheckSchema.nullable(),
}).strict();
/** Older Pipelines keep answering v1–v5; v3 adds a retained evidence finding. */
export const websitePreparationReceiptSchema = z.union([receiptV1, receiptV2, receiptV3, receiptV4, receiptV5, receiptV6]);
export type WebsitePreparationReceipt = z.infer<typeof websitePreparationReceiptSchema>;
type PreparationState = typeof statesV2[number];
/** Asks for v6; older Pipelines cap negotiation at their newest known version (v5 and below stay accepted). */
export const WEBSITE_PREPARATION_STATUS_VERSION = "6";
export const WEBSITE_PREPARATION_STATUS_VERSION_HEADER = "x-blueprint-preparation-status-version";
/** The site's view of the robot fit table; robots that fit come first. */
export type PublicRobotFit = {
  route: RobotFitReceipt["route"]; status: RobotFitReceipt["status"]; reason: RobotFitReceipt["reason"];
  counts: {fits: number; fitsSpec: number; doesntFit: number; unknown: number} | null;
  models: {name: string; manufacturer: string; verdict: typeof ROBOT_FIT_VERDICTS[number]; openChecks: string[]}[];
  modelsTruncated: boolean;
};
export function publicRobotFit(fit: RobotFitReceipt): PublicRobotFit {
  return {route: fit.route, status: fit.status, reason: fit.reason,
    counts: fit.counts && {fits: fit.counts.fits, fitsSpec: fit.counts.fits_spec, doesntFit: fit.counts.doesnt_fit,
      unknown: fit.counts.unknown},
    models: fit.models.map(row => ({name: row.name, manufacturer: row.manufacturer, verdict: row.verdict,
      openChecks: row.open_checks})),
    modelsTruncated: fit.models_truncated};
}
/** The site's view of the early robot fit precheck: which robot bodies were measured and why none fits. */
export type PublicRobotFitPrecheck = {
  status: RobotFitPrecheckReceipt["status"]; holdReason: string | null; taskKind: string | null;
  counts: {fit: number; noFit: number; unknown: number; unavailable: number};
  embodiments: {embodiment: typeof ROBOT_FIT_PRECHECK_EMBODIMENTS[number]; verdict: RobotFitPrecheckReceipt["status"];
    reasons: string[]}[];
  embodimentsTruncated: boolean; precheckDigest: string;
};
/** The precheck's task kind for display: lowercase letters and underscores, at most 40 characters, else null. */
export const displayTaskKind = (kind: unknown): string | null =>
  typeof kind === "string" && /^[a-z_]{1,40}$/.test(kind) ? kind : null;
export function publicRobotFitPrecheck(precheck: RobotFitPrecheckReceipt): PublicRobotFitPrecheck {
  return {status: precheck.status, holdReason: precheck.hold_reason, taskKind: displayTaskKind(precheck.task_kind),
    counts: {fit: precheck.counts.fit, noFit: precheck.counts.no_fit, unknown: precheck.counts.unknown,
      unavailable: precheck.counts.unavailable},
    embodiments: precheck.embodiments.map(row => ({embodiment: row.embodiment, verdict: row.verdict, reasons: row.reasons})),
    embodimentsTruncated: precheck.embodiments_truncated, precheckDigest: precheck.precheck_digest};
}
export type PublicWebsitePreparationStatus = {
  state: PreparationState | "unavailable"; correlationId: string | null;
  terminalReason?: WebsitePreparationTerminalReason | null;
  outcome?: TaskOutcome | null;
  /** Only from a v4 receipt: the optional correction of the guessed object to move. */
  question?: TaskTargetChoiceQuestion | null;
  /** Only from a v5 receipt: which robots fit the job by spec sheet. */
  robotFit?: PublicRobotFit | null;
  /** Only from a v6 receipt: the robot fit precheck made before any spend, and its hold when none fits. */
  robotFitPrecheck?: PublicRobotFitPrecheck | null;
};
export type WebsitePreparationNoticeMilestone = "preparation_needs_attention" | "preparation_ended";
export type WebsitePreparationIntent = {requestId: string; captureId: string; eventId: string; correlationId: string;
  milestone: WebsitePreparationNoticeMilestone; terminalReason: WebsitePreparationTerminalReason | null;
  /** Set when this needs-attention notice may be the Pipeline's early task hold, whose reason only the separately
   * delivered Atlas preview carries: the notice waits for that preview until this time, then goes out generic. */
  awaitEarlyHoldUntilMs?: number};
/**
 * How long a needs-attention notice that may be an early task hold waits for the Atlas preview naming its reason.
 * The Pipeline retries a failed preview delivery after min(3600, 30 * 2^attempts) seconds
 * (`website_atlas_preview._deliver`), so retries land about 1, 3, 7, 15, 31 and 63 minutes after the first
 * failure, then about 123 minutes (the first capped, one-hour wait). This covers that retry with a 12-minute margin.
 */
export const EARLY_HOLD_PREVIEW_WAIT_MS = 135 * 60 * 1000;
/** Beside `website_preparation`, never inside it, so a release whose strict parser predates it still reads the row. */
export const WEBSITE_PREPARATION_NOTICE_OWED_FIELD = "website_preparation_notice_owed";
/** A status that is an early task hold looks like this: waiting on inputs with no finding of its own. */
const mayBeEarlyTaskHold = (status: WebsitePreparationReceipt) =>
  status.state === "awaiting_inputs" && (!("outcome" in status) || status.outcome === null);
export interface StoredWebsitePreparation {
  selector: WebsitePreparationSelector; status: WebsitePreparationReceipt;
  notification: { eventId: string; state: "pending" | "enqueued" } | null;
}
/** A pending row, with when its notice was first owed when that was recorded (rows from older releases lack it). */
export type PendingWebsitePreparation = StoredWebsitePreparation & { owedSinceMs?: number };
const owedSchema = z.object({event_id: digest, since_ms: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)}).strict();
/** When the pending notice was first owed, kept across replays of the same event; null when nothing is pending. */
function noticeOwed(preparation: StoredWebsitePreparation, prior: unknown, nowMs: number) {
  const notice = preparation.notification;
  if (notice?.state !== "pending") return null;
  const kept = owedSchema.safeParse(prior);
  return kept.success && kept.data.event_id === notice.eventId ? kept.data : {event_id: notice.eventId, since_ms: nowMs};
}
export interface PreparationAuthority { fingerprint: string; binding?: Record<string, any>; owner: string | null;
  sponsorshipDigest?: string }
export interface WebsitePreparationDeps {
  readLedger(selector: WebsitePreparationSelector, signal?: AbortSignal): Promise<unknown>;
  verifyCurrent(selector: WebsitePreparationSelector, transaction?: FirebaseFirestore.Transaction, signal?: AbortSignal): Promise<PreparationAuthority>;
  readStored(captureId: string): Promise<StoredWebsitePreparation | null>;
  commit(selector: WebsitePreparationSelector, status: WebsitePreparationReceipt, authority: PreparationAuthority): Promise<void>;
  pending(limit: number): Promise<PendingWebsitePreparation[]>;
  acknowledge(captureId: string, eventId: string): Promise<void>;
  findEvent(requestId: string, eventId: string, transaction?: FirebaseFirestore.Transaction): Promise<StoredWebsitePreparation | null>;
}
const unavailable = () => new Error("website_preparation_unavailable");
const needsAttention = (state: string) => state === "failed_retryable" || state === "awaiting_inputs";
export function websitePreparationEventId(selector: WebsitePreparationSelector): string {
  return crossRuntimeDigest({ ...selector, milestone: "preparation_needs_attention" });
}
/** One per terminal transition: a re-driven attempt that ends again is a new event. */
export function websitePreparationEndedEventId(selector: WebsitePreparationSelector, attemptCount: number): string {
  return crossRuntimeDigest({ ...selector, milestone: "preparation_ended", attempt_count: attemptCount });
}
/** The single notice a current status calls for, if any. */
function noticeFor(selector: WebsitePreparationSelector, status: WebsitePreparationReceipt):
  {eventId: string; milestone: WebsitePreparationNoticeMilestone} | null {
  if (status.state === "failed_terminal")
    return {eventId: websitePreparationEndedEventId(selector, status.attempt_count), milestone: "preparation_ended"};
  // A geometry-only job ends at its robot fit check by design: that end is its result, not a problem.
  if (status.state === "awaiting_inputs" && "robot_fit" in status && status.robot_fit?.route === "geometry_only")
    return null;
  return needsAttention(status.state)
    ? {eventId: websitePreparationEventId(selector), milestone: "preparation_needs_attention"} : null;
}
const terminalReasonOf = (status: WebsitePreparationReceipt) =>
  status.schema_version !== "website_preparation_status.v1" ? status.terminal_reason : null;
function parseReceipt(raw: unknown, selector: WebsitePreparationSelector): WebsitePreparationReceipt {
  const receipt = websitePreparationReceiptSchema.parse(raw);
  websitePreparationSelectorSchema.parse(receiptSelectors(receipt));
  if (crossRuntimeDigest(receiptSelectors(receipt)) !== crossRuntimeDigest(selector)
      || codes[receipt.state] !== receipt.code
      || (receipt.state === "failed_terminal") !== (terminalReasonOf(receipt) !== null)
      || "outcome" in receipt && receipt.outcome !== null
        && !["awaiting_inputs", "failed_retryable", "failed_terminal"].includes(receipt.state)
      || "question" in receipt && receipt.question !== null && receipt.state === "authority_ended"
      // A robot fit hold and the precheck it names are one finding: never two that disagree.
      || "robot_fit_precheck" in receipt && receipt.outcome?.reason === "robot_fit_none" && receipt.robot_fit_precheck !== null
        && (receipt.robot_fit_precheck.status !== "no_fit"
          || receipt.robot_fit_precheck.precheck_digest !== receipt.outcome.evidence_digest)
      || crossRuntimeArtifactDigest(receipt as unknown as Record<string, unknown>, "status_digest") !== receipt.status_digest)
    throw unavailable();
  return receipt;
}
function receiptSelectors(value: WebsitePreparationReceipt): WebsitePreparationSelector {
  const {request_id, scene_id, capture_id, completion_marker_generation,
    producer_delivery_key, source_payload_sha256, task_context_digest} = value;
  return {request_id, scene_id, capture_id, completion_marker_generation,
    producer_delivery_key, source_payload_sha256, task_context_digest};
}
function parseStored(value: unknown): StoredWebsitePreparation | null {
  if (value == null) return null;
  const parsed = z.object({ selector: websitePreparationSelectorSchema, status: websitePreparationReceiptSchema,
    notification: z.object({eventId: digest, state: z.enum(["pending", "enqueued"])}).strict().nullable(),
  }).strict().parse(value);
  parseReceipt(parsed.status, parsed.selector);
  if (parsed.notification && parsed.notification.eventId !== websitePreparationEventId(parsed.selector)
    && parsed.notification.eventId !== noticeFor(parsed.selector, parsed.status)?.eventId) throw unavailable();
  return parsed;
}
/** An exact lower/reused revision cannot downgrade newer persisted authority. The same
 * revision read in the other receipt version is the same ledger state, not a replay. */
export function mergeWebsitePreparationStatus(prior: StoredWebsitePreparation | null,
  selector: WebsitePreparationSelector, status: WebsitePreparationReceipt): StoredWebsitePreparation {
  parseReceipt(status, selector);
  const same = prior && crossRuntimeDigest(prior.selector) === crossRuntimeDigest(selector);
  if (same && (status.attempt_count < prior.status.attempt_count || status.revision < prior.status.revision
    || status.revision === prior.status.revision && status.schema_version === prior.status.schema_version
      && status.status_digest !== prior.status.status_digest)) throw unavailable();
  const attentionId = websitePreparationEventId(selector);
  const notice = noticeFor(selector, status);
  // One durable intent per event: a replay keeps it; a newer event replaces an
  // unsent one; a state that calls for no notice keeps only the attention intent.
  const notification = notice
    ? same && prior.notification?.eventId === notice.eventId ? prior.notification : {eventId: notice.eventId, state: "pending" as const}
    : same && prior.notification?.eventId === attentionId ? prior.notification : null;
  return {selector, status, notification};
}
/** Existing signed client admission, bounded response, no redirect or arbitrary caller destination. */
async function readCanonicalLedger(selector: WebsitePreparationSelector, signal?: AbortSignal): Promise<unknown> {
  const body = JSON.stringify(selector);
  const signed = signedWebsitePipelineRequest("/api/live-pipeline/website-preparation-status", body);
  if (!signed) throw unavailable();
  const response = await fetch(signed.url, {method: "POST", redirect: "error", signal: signal ?? AbortSignal.timeout(5_000),
    body, headers: {"content-type": "application/json", ...signed.headers, [WEBSITE_PREPARATION_STATUS_VERSION_HEADER]: WEBSITE_PREPARATION_STATUS_VERSION}});
  if (!response.ok || !response.body || Number(response.headers.get("content-length")) > 8192) throw unavailable();
  const reader = response.body.getReader(); let length = 0; const chunks: Buffer[] = [];
  try {
    for (;;) { const chunk = await reader.read(); if (chunk.done) break;
      length += chunk.value.length; if (length > 8192) throw unavailable(); chunks.push(Buffer.from(chunk.value)); }
    return strictBoundedProofJson(Buffer.concat(chunks), 8192);
  } finally { await reader.cancel().catch(() => undefined); }
}
function sourceFingerprint(session: Record<string, any>): string {
  return crossRuntimeDigest({pending: session.browser_pending_delivery ?? null,
    stored: session.browser_stored_upload ?? null, reservation: session.browser_upload_reservation ?? null,
    identity: session.immutable_upload_identity ?? null, bundle: session.site_capture_bundle ?? null});
}
async function verifyCurrent(selector: WebsitePreparationSelector, transaction?: FirebaseFirestore.Transaction, signal?: AbortSignal): Promise<PreparationAuthority> {
  if (!db || !storageAdmin || selector.capture_id !== `walkthrough-${selector.request_id}`) throw unavailable();
  const get = async (collection: string, key: string) => {
    const ref = db!.collection(collection).doc(key);
    return (transaction ? await transaction.get(ref) : await ref.get()).data();
  };
  const session = await get("captureUploadSessions", selector.capture_id);
  if (!session || session.browser_upload_reservation || session.browser_stored_upload) throw unavailable();
  const request = await get("inboundRequests", selector.request_id);
  const purpose = retainedWebsiteScenePurpose(request);
  const observed = await withWebsiteOwnerDeps(3_000, deps => observeWebsiteCaptureOwner({
    request_id: selector.request_id, scene_id: selector.scene_id, capture_id: selector.capture_id,
    completion_marker_generation: selector.completion_marker_generation, ...(purpose ? {purpose} : {})}, deps));
  if (!observed.capture_rights.derived_scene_generation_allowed
    || observed.producer_delivery.delivery_key !== selector.producer_delivery_key) throw unavailable();
  // Historical pinned observer is deliberately insufficient: compare latest canonical marker and current session source.
  const [marker] = await storageAdmin.bucket(process.env.FIREBASE_STORAGE_BUCKET || "blueprint-8c1ca.appspot.com")
    .file(observed.completion_marker.object_name).getMetadata();
  if (String(marker.generation) !== selector.completion_marker_generation) throw unavailable();
  if (observed.producer_delivery.kind === "website_browser_capture_delivery") {
    const pending = session.browser_pending_delivery as BrowserPending | undefined;
    if (!pending || pending.state !== "published" || pending.request_id !== selector.request_id
      || pending.scene_id !== selector.scene_id || pending.capture_id !== selector.capture_id
      || !await verifiedPendingManifest(pending) || !await verifiedPendingMarker(pending)) throw unavailable();
    const delivery = buildBrowserDelivery({requestId: selector.request_id, sceneId: selector.scene_id,
      captureId: selector.capture_id, rawPrefix: pending.video.object_name.slice(0, pending.video.object_name.lastIndexOf("/")),
      video: pending.video, manifest: pending.manifest, completedAtIso: pending.completed_at_iso});
    if (delivery.record.delivery_key !== selector.producer_delivery_key
      || crossRuntimeDigest(pending.video) !== crossRuntimeDigest(observed.producer_delivery.raw_video)) throw unavailable();
  } else if (!session.site_capture_bundle || !session.immutable_upload_identity
    || session.site_capture_bundle.request_id !== selector.request_id
    || session.site_capture_bundle.scene_id !== selector.scene_id
    || session.site_capture_bundle.capture_id !== selector.capture_id
    || session.immutable_upload_identity.upload_completion_digest !== observed.completion_marker.sha256) throw unavailable();
  const [currentVideo] = await storageAdmin.bucket(process.env.FIREBASE_STORAGE_BUCKET || "blueprint-8c1ca.appspot.com")
    .file(observed.producer_delivery.raw_video.object_name).getMetadata();
  if (String(currentVideo.generation) !== observed.producer_delivery.raw_video.generation
    || Number(currentVideo.size) !== observed.producer_delivery.raw_video.size_bytes
    || currentVideo.crc32c !== observed.producer_delivery.raw_video.crc32c) throw unavailable();
  const binding = await resolveWebsiteCaptureBinding(selector.request_id, selector.scene_id, selector.capture_id);
  if (transaction) await assertWebsiteCaptureBindingInTransaction(transaction, selector.request_id, binding);
  const brief = await get(TASK_BRIEFS_COLLECTION, selector.request_id) as SiteTaskBriefRecord;
  const inventory = await get(TASK_ITEM_INVENTORY_COLLECTION, selector.request_id) as TaskItemInventoryRecord;
  if (projectWebsiteCaptureRights(request).consent_revoked) throw new Error("website_preparation_authority_ended");
  const sourceOwner = websiteCaptureOwnerUid(request);
  const owner = typeof sourceOwner === "string" ? sourceOwner : null;
  if (!brief || !projectWebsiteCaptureRights(request).derived_scene_generation_allowed
    || observed.purpose !== purpose || (purpose ? observed.capture_owner?.user_id ?? null : observed.capture_owner?.user_id) !== owner
    || !purpose && owner === null
    || currentWebsitePreparationStatusContext({requestId: selector.request_id, brief, record: request ?? {}, inventory,
      captureId: selector.capture_id, captureBinding: binding}).context_digest !== selector.task_context_digest) throw unavailable();
  return {fingerprint: sourceFingerprint(session), binding, owner,
    ...(purpose ? {sponsorshipDigest: request!.website_scene_sponsorship.authority_digest} : {})};
}
const defaultDeps: WebsitePreparationDeps = {
  readLedger: readCanonicalLedger, verifyCurrent,
  async readStored(captureId) {
    if (!db) throw unavailable();
    return parseStored((await db.collection("captureUploadSessions").doc(captureId).get()).data()?.website_preparation);
  },
  async commit(selector, status, authority) {
    if (!db) throw unavailable(); const store = db;
    await store.runTransaction(async tx => {
      const ref = store.collection("captureUploadSessions").doc(selector.capture_id);
      const session = (await tx.get(ref)).data();
      const request = (await tx.get(store.collection("inboundRequests").doc(selector.request_id))).data();
      const brief = (await tx.get(store.collection(TASK_BRIEFS_COLLECTION).doc(selector.request_id))).data() as SiteTaskBriefRecord;
      const inventory = (await tx.get(store.collection(TASK_ITEM_INVENTORY_COLLECTION).doc(selector.request_id))).data() as TaskItemInventoryRecord;
      await assertWebsiteCaptureBindingInTransaction(tx, selector.request_id, authority.binding);
      const sourceOwner = websiteCaptureOwnerUid(request);
      const owner = typeof sourceOwner === "string" ? sourceOwner : null;
      if (!session || sourceFingerprint(session) !== authority.fingerprint || !brief
        || owner !== authority.owner || !projectWebsiteCaptureRights(request).derived_scene_generation_allowed
        || authority.sponsorshipDigest !== undefined && request?.website_scene_sponsorship?.authority_digest !== authority.sponsorshipDigest
        || currentWebsitePreparationStatusContext({requestId: selector.request_id, brief, record: request ?? {}, inventory,
          captureId: selector.capture_id, captureBinding: authority.binding}).context_digest !== selector.task_context_digest) throw unavailable();
      const preparation = mergeWebsitePreparationStatus(parseStored(session.website_preparation), selector, status);
      const watch = nextWebsitePreparationWatch(parseWebsitePreparationWatch(session[WEBSITE_PREPARATION_WATCH_FIELD]),
        preparation, Date.now());
      // mergeFields replaces each named field whole: Firestore's merge would keep
      // a v2-only key such as terminal_reason under a later v1 receipt.
      tx.set(ref, {website_preparation: preparation,
        website_preparation_notification_pending: preparation.notification?.state === "pending",
        [WEBSITE_PREPARATION_NOTICE_OWED_FIELD]: noticeOwed(preparation, session[WEBSITE_PREPARATION_NOTICE_OWED_FIELD], Date.now()),
        [WEBSITE_PREPARATION_WATCH_FIELD]: watch, [WEBSITE_PREPARATION_WATCH_DUE_FIELD]: watch?.due_at_ms ?? null},
      {mergeFields: ["website_preparation", "website_preparation_notification_pending", WEBSITE_PREPARATION_NOTICE_OWED_FIELD,
        WEBSITE_PREPARATION_WATCH_FIELD, WEBSITE_PREPARATION_WATCH_DUE_FIELD]});
    });
  },
  async pending(limit) {
    if (!db) throw unavailable();
    const rows = await automationBatch(db, db.collection("captureUploadSessions")
      .where("website_preparation_notification_pending", "==", true), "website_preparation_notifications", limit);
    return rows.docs.flatMap(row => {
      const stored = parseStored(row.data().website_preparation);
      if (!stored) return [];
      const owed = owedSchema.safeParse(row.data()[WEBSITE_PREPARATION_NOTICE_OWED_FIELD]);
      return [owed.success && owed.data.event_id === stored.notification?.eventId
        ? {...stored, owedSinceMs: owed.data.since_ms} : stored];
    });
  },
  async findEvent(requestId, eventId, transaction) {
    if (!db) throw unavailable();
    const query = db.collection("captureUploadSessions")
      .where("website_preparation.notification.eventId", "==", eventId).limit(2);
    const rows = transaction ? await transaction.get(query) : await query.get();
    if (rows.docs.length !== 1) return null;
    const row = parseStored(rows.docs[0].data().website_preparation);
    return row?.selector.request_id === requestId ? row : null;
  },
  async acknowledge(captureId, eventId) {
    if (!db) throw unavailable(); const store = db;
    await store.runTransaction(async tx => {
      const ref = store.collection("captureUploadSessions").doc(captureId);
      const stored = parseStored((await tx.get(ref)).data()?.website_preparation);
      if (stored?.notification?.eventId !== eventId) return;
      tx.set(ref, {website_preparation: {...stored, notification: {eventId, state: "enqueued"}},
        website_preparation_notification_pending: false},
      {mergeFields: ["website_preparation", "website_preparation_notification_pending"]});
    });
  },
};
/** Bound only read-only work: late SDK reads cannot enter a commit or publish a notice. */
async function boundedRead<T>(action: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController(); let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {controller.abort(); reject(unavailable());}, 5_000);
  });
  try {return await Promise.race([action(controller.signal), timeout]);}
  finally {clearTimeout(timer!); controller.abort();}
}
async function latestVerified(selector: WebsitePreparationSelector, deps: WebsitePreparationDeps,
  signal: AbortSignal, transaction?: FirebaseFirestore.Transaction) {
  const first = parseReceipt(await deps.readLedger(selector, signal), selector);
  const authority = await deps.verifyCurrent(selector, transaction, signal);
  if (signal.aborted) throw unavailable();
  const latest = parseReceipt(await deps.readLedger(selector, signal), selector);
  if (signal.aborted || first.status_digest !== latest.status_digest) throw unavailable();
  return {latest, authority};
}
/** Callback supplies selectors only. Read phase is bounded; durable commit is never abandoned by a timer. */
export async function syncWebsitePreparationStatus(raw: unknown, deps = defaultDeps): Promise<WebsitePreparationReceipt> {
  const selector = websitePreparationSelectorSchema.parse(raw);
  const {latest, authority} = await boundedRead(signal => latestVerified(selector, deps, signal));
  await deps.commit(selector, latest, authority);
  return latest;
}
async function fresh(captureId: string, requestId: string, deps: WebsitePreparationDeps) {
  return boundedRead(async signal => {
    const stored = await deps.readStored(captureId);
    if (!stored || stored.selector.request_id !== requestId || stored.selector.capture_id !== captureId) throw unavailable();
    const {latest: status} = await latestVerified(stored.selector, deps, signal);
    mergeWebsitePreparationStatus(stored, stored.selector, status);
    return {status, selector: stored.selector};
  });
}
/** Server-only source proof for the signed, read-only candidate companion. */
export async function loadCurrentWebsitePreparationProof(requestId: string, captureId: string, deps = defaultDeps) {
  id.parse(requestId); websitePreparationSelectorSchema.shape.capture_id.parse(captureId);
  return fresh(captureId, requestId, deps);
}
export async function loadCurrentWebsitePreparationStatus(requestId: string, captureId: string,
  deps = defaultDeps): Promise<PublicWebsitePreparationStatus> {
  try {
    id.parse(requestId); websitePreparationSelectorSchema.shape.capture_id.parse(captureId);
    const {status} = await fresh(captureId, requestId, deps);
    const precheck = "robot_fit_precheck" in status && status.robot_fit_precheck
      ? publicRobotFitPrecheck(status.robot_fit_precheck) : null;
    // Customer correlation is company-derived; never trust caller supplied correlation text.
    return {state: status.state, correlationId: `bp-prep-${status.status_digest.slice(7, 23)}`,
      terminalReason: terminalReasonOf(status),
      ...("outcome" in status ? {outcome: status.outcome ? projectPreparationOutcome(status.outcome, precheck && {
        holdReason: precheck.holdReason, precheckDigest: precheck.precheckDigest, counts: precheck.counts}) : null} : {}),
      ...("question" in status ? {question: status.question} : {}),
      ...("robot_fit" in status ? {robotFit: status.robot_fit ? publicRobotFit(status.robot_fit) : null} : {}),
      ...("robot_fit_precheck" in status ? {robotFitPrecheck: precheck} : {})};
  } catch { return {state: "unavailable", correlationId: null}; }
}
/** The current question with the exact selector it was read under, or null; re-verified with the Pipeline. */
export async function loadCurrentTaskTargetChoiceQuestion(requestId: string, captureId: string, deps = defaultDeps):
  Promise<{selector: WebsitePreparationSelector; question: TaskTargetChoiceQuestion} | null> {
  id.parse(requestId); websitePreparationSelectorSchema.shape.capture_id.parse(captureId);
  const {status, selector} = await fresh(captureId, requestId, deps);
  return "question" in status && status.question ? {selector, question: status.question} : null;
}
/** Recheck ownership, rights and current task without calling back into the
 * Pipeline worker that is reading an already retained owner selection. */
export async function verifyCurrentWebsitePreparationSelector(raw: unknown, deps = defaultDeps): Promise<void> {
  const selector = websitePreparationSelectorSchema.parse(raw);
  await boundedRead(signal => deps.verifyCurrent(selector, undefined, signal));
}
export async function canNotifyCurrentWebsitePreparationIssue(requestId: string, eventId: string,
  transactionOrDeps?: FirebaseFirestore.Transaction | WebsitePreparationDeps,
  injectedDeps = defaultDeps): Promise<boolean> {
  const deps = transactionOrDeps && "readLedger" in transactionOrDeps ? transactionOrDeps : injectedDeps;
  const transaction = transactionOrDeps && !("readLedger" in transactionOrDeps) ? transactionOrDeps : undefined;
  id.parse(requestId); digest.parse(eventId);
  try {
    return await boundedRead(async signal => {
      const match = await deps.findEvent(requestId, eventId, transaction);
      if (!match) return false;
      // Read-only admission: all tx reads precede caller's dispatch marker; no nested status commit.
      const {latest} = await latestVerified(match.selector, deps, signal, transaction);
      mergeWebsitePreparationStatus(match, match.selector, latest);
      // Still the same event: a needs-attention state, or the same terminal transition.
      return noticeFor(match.selector, latest)?.eventId === eventId;
    });
  } catch (error) {
    if ((error as Error).message === "website_preparation_authority_ended") return false;
    throw unavailable();
  }
}
/** Enqueue only into the existing outbox. Unknown enqueue outcome keeps recoverable durable intent. */
export async function drainPendingWebsitePreparationNotifications(
  enqueue: (intent: WebsitePreparationIntent) => Promise<"enqueued" | "duplicate" | "unavailable">,
  deps = defaultDeps, limit = 20): Promise<{enqueued: number; pending: number}> {
  let enqueued = 0, pending = 0;
  for (const row of await deps.pending(limit)) {
    try {
      const current = await fresh(row.selector.capture_id, row.selector.request_id, deps);
      const notice = noticeFor(current.selector, current.status);
      if (!notice || !row.notification || row.notification.eventId !== notice.eventId) { pending++; continue; }
      const result = await enqueue({requestId: row.selector.request_id, captureId: row.selector.capture_id,
        eventId: row.notification.eventId, correlationId: `bp-prep-${current.status.status_digest.slice(7, 23)}`,
        milestone: notice.milestone, terminalReason: terminalReasonOf(current.status),
        ...(notice.milestone === "preparation_needs_attention" && mayBeEarlyTaskHold(current.status)
          && row.owedSinceMs !== undefined ? {awaitEarlyHoldUntilMs: row.owedSinceMs + EARLY_HOLD_PREVIEW_WAIT_MS} : {})});
      if (result === "unavailable") {pending++; continue;}
      await deps.acknowledge(row.selector.capture_id, row.notification.eventId); enqueued++;
    } catch { pending++; }
  }
  return {enqueued, pending};
}
