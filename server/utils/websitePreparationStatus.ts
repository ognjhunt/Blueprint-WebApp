import { websiteCaptureOwnerUid } from "./websiteCaptureOwner";
/** Current-source preparation status; never a native assessment or preview verdict. */
import { z } from "zod";
import { preparationOutcomeSchema, projectPreparationOutcome } from "./taskPreparationOutcome";
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
/** Older Pipelines keep answering v1/v2/v3; v3 adds a retained evidence finding. */
export const websitePreparationReceiptSchema = z.union([receiptV1, receiptV2, receiptV3, receiptV4]);
export type WebsitePreparationReceipt = z.infer<typeof websitePreparationReceiptSchema>;
type PreparationState = typeof statesV2[number];
/** Asks for v4; older Pipelines cap negotiation at their newest known version. */
export const WEBSITE_PREPARATION_STATUS_VERSION_HEADER = "x-blueprint-preparation-status-version";
export type PublicWebsitePreparationStatus = {
  state: PreparationState | "unavailable"; correlationId: string | null;
  terminalReason?: WebsitePreparationTerminalReason | null;
  outcome?: TaskOutcome | null;
  /** Only from a v4 receipt: the optional correction of the guessed object to move. */
  question?: TaskTargetChoiceQuestion | null;
};
export type WebsitePreparationNoticeMilestone = "preparation_needs_attention" | "preparation_ended";
export type WebsitePreparationIntent = {requestId: string; captureId: string; eventId: string; correlationId: string;
  milestone: WebsitePreparationNoticeMilestone; terminalReason: WebsitePreparationTerminalReason | null};
export interface StoredWebsitePreparation {
  selector: WebsitePreparationSelector; status: WebsitePreparationReceipt;
  notification: { eventId: string; state: "pending" | "enqueued" } | null;
}
export interface PreparationAuthority { fingerprint: string; binding?: Record<string, any>; owner: string | null;
  sponsorshipDigest?: string }
export interface WebsitePreparationDeps {
  readLedger(selector: WebsitePreparationSelector, signal?: AbortSignal): Promise<unknown>;
  verifyCurrent(selector: WebsitePreparationSelector, transaction?: FirebaseFirestore.Transaction, signal?: AbortSignal): Promise<PreparationAuthority>;
  readStored(captureId: string): Promise<StoredWebsitePreparation | null>;
  commit(selector: WebsitePreparationSelector, status: WebsitePreparationReceipt, authority: PreparationAuthority): Promise<void>;
  pending(limit: number): Promise<StoredWebsitePreparation[]>;
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
      || (receipt.schema_version === "website_preparation_status.v3" || receipt.schema_version === "website_preparation_status.v4")
        && receipt.outcome !== null && !["awaiting_inputs", "failed_retryable", "failed_terminal"].includes(receipt.state)
      || receipt.schema_version === "website_preparation_status.v4" && receipt.question !== null
        && receipt.state === "authority_ended"
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
    body, headers: {"content-type": "application/json", ...signed.headers, [WEBSITE_PREPARATION_STATUS_VERSION_HEADER]: "4"}});
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
        [WEBSITE_PREPARATION_WATCH_FIELD]: watch, [WEBSITE_PREPARATION_WATCH_DUE_FIELD]: watch?.due_at_ms ?? null},
      {mergeFields: ["website_preparation", "website_preparation_notification_pending",
        WEBSITE_PREPARATION_WATCH_FIELD, WEBSITE_PREPARATION_WATCH_DUE_FIELD]});
    });
  },
  async pending(limit) {
    if (!db) throw unavailable();
    const rows = await automationBatch(db, db.collection("captureUploadSessions")
      .where("website_preparation_notification_pending", "==", true), "website_preparation_notifications", limit);
    return rows.docs.map(row => parseStored(row.data().website_preparation)).filter((p): p is StoredWebsitePreparation => Boolean(p));
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
    // Customer correlation is company-derived; never trust caller supplied correlation text.
    return {state: status.state, correlationId: `bp-prep-${status.status_digest.slice(7, 23)}`,
      terminalReason: terminalReasonOf(status),
      ...(status.schema_version === "website_preparation_status.v3" || status.schema_version === "website_preparation_status.v4"
        ? {outcome: status.outcome ? projectPreparationOutcome(status.outcome) : null} : {}),
      ...(status.schema_version === "website_preparation_status.v4" ? {question: status.question} : {})};
  } catch { return {state: "unavailable", correlationId: null}; }
}
/** The current question with the exact selector it was read under, or null; re-verified with the Pipeline. */
export async function loadCurrentTaskTargetChoiceQuestion(requestId: string, captureId: string, deps = defaultDeps):
  Promise<{selector: WebsitePreparationSelector; question: TaskTargetChoiceQuestion} | null> {
  id.parse(requestId); websitePreparationSelectorSchema.shape.capture_id.parse(captureId);
  const {status, selector} = await fresh(captureId, requestId, deps);
  return status.schema_version === "website_preparation_status.v4" && status.question
    ? {selector, question: status.question} : null;
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
        milestone: notice.milestone, terminalReason: terminalReasonOf(current.status)});
      if (result === "unavailable") {pending++; continue;}
      await deps.acknowledge(row.selector.capture_id, row.notification.eventId); enqueued++;
    } catch { pending++; }
  }
  return {enqueued, pending};
}
