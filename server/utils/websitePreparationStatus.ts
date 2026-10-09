/** Current-source preparation status; never a native assessment or preview verdict. */
import { createHmac, randomUUID } from "node:crypto";
import { z } from "zod";
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
import { loadAssessmentPreparationProposal, assertAssessmentPreparationCurrent, type PreparedAssessmentProposal } from "./siteAssessmentPreparation";

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
const states = ["preparing", "awaiting_inputs", "failed_retryable", "authority_ended", "handed_off"] as const;
const codes = { preparing: "preparation_in_progress", awaiting_inputs: "preparation_inputs_pending",
  failed_retryable: "preparation_retryable_failure", authority_ended: "preparation_authority_ended",
  handed_off: "preparation_handed_off" } as const;
export const websitePreparationReceiptSchema = websitePreparationSelectorSchema.innerType().extend({
  schema_version: z.literal("website_preparation_status.v1"),
  attempt_count: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), state: z.enum(states),
  code: z.enum(Object.values(codes) as [string, ...string[]]),
  correlation_id: digest, status_digest: digest,
}).strict();
export type WebsitePreparationReceipt = z.infer<typeof websitePreparationReceiptSchema>;
export type PublicWebsitePreparationStatus = {
  state: typeof states[number] | "unavailable"; correlationId: string | null;
};
export type WebsitePreparationIntent = {requestId: string; captureId: string; eventId: string; correlationId: string};
export interface StoredWebsitePreparation {
  selector: WebsitePreparationSelector; status: WebsitePreparationReceipt;
  notification: { eventId: string; state: "pending" | "enqueued" } | null;
}
export interface PreparationAuthority { fingerprint: string; binding?: Record<string, any>; owner: string | null;
  preparation?: PreparedAssessmentProposal | null; sponsorshipDigest?: string }
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
function parseReceipt(raw: unknown, selector: WebsitePreparationSelector): WebsitePreparationReceipt {
  const receipt = websitePreparationReceiptSchema.parse(raw);
  websitePreparationSelectorSchema.parse(receiptSelectors(receipt));
  if (crossRuntimeDigest(receiptSelectors(receipt)) !== crossRuntimeDigest(selector)
      || codes[receipt.state] !== receipt.code
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
  if (parsed.notification && parsed.notification.eventId !== websitePreparationEventId(parsed.selector)) throw unavailable();
  return parsed;
}
/** An exact lower/reused revision cannot downgrade newer persisted authority. */
export function mergeWebsitePreparationStatus(prior: StoredWebsitePreparation | null,
  selector: WebsitePreparationSelector, status: WebsitePreparationReceipt): StoredWebsitePreparation {
  parseReceipt(status, selector);
  const same = prior && crossRuntimeDigest(prior.selector) === crossRuntimeDigest(selector);
  if (same && (status.attempt_count < prior.status.attempt_count || status.revision < prior.status.revision
    || status.revision === prior.status.revision && status.status_digest !== prior.status.status_digest)) throw unavailable();
  const eventId = websitePreparationEventId(selector);
  return {selector, status, notification: same && prior.notification?.eventId === eventId ? prior.notification
    : needsAttention(status.state) ? {eventId, state: "pending"} : null};
}
/** Existing signed client admission, bounded response, no redirect or arbitrary caller destination. */
async function readCanonicalLedger(selector: WebsitePreparationSelector, signal?: AbortSignal): Promise<unknown> {
  const configured = process.env.CAPTURE_LIFECYCLE_PIPELINE_BASE_URL
    || process.env.CAPTURE_UPLOAD_INTAKE_FORWARD_URL?.replace(/\/capture-upload-intakes\/?$/, "");
  const token = process.env.CAPTURE_UPLOAD_INTAKE_FORWARD_TOKEN;
  if (!configured || !token) throw unavailable();
  const url = new URL(configured);
  if (url.username || url.password || (url.protocol !== "https:" && !(process.env.NODE_ENV === "test"
    && url.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)))) throw unavailable();
  url.pathname = "/api/live-pipeline/website-preparation-status"; url.search = ""; url.hash = "";
  const body = JSON.stringify(selector), timestamp = new Date().toISOString(), nonce = randomUUID();
  const client = "blueprint-webapp";
  const signature = createHmac("sha256", token).update(`${timestamp}.${client}.${nonce}.${body}`).digest("hex");
  const response = await fetch(url, {method: "POST", redirect: "error", signal: signal ?? AbortSignal.timeout(5_000),
    body, headers: {"content-type": "application/json", "x-blueprint-pipeline-timestamp": timestamp,
      "x-blueprint-pipeline-client-id": client, "x-blueprint-pipeline-nonce": nonce,
      "x-blueprint-pipeline-signature": `sha256=${signature}`}});
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
  const preparation = purpose ? await loadAssessmentPreparationProposal(selector.request_id, selector.capture_id) : null;
  if (transaction && purpose) await assertAssessmentPreparationCurrent(transaction, preparation, request ?? {},
    {requestId: selector.request_id, captureId: selector.capture_id});
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
  const owner = typeof request?.account_owner_uid === "string" ? request.account_owner_uid : null;
  if (!brief || !projectWebsiteCaptureRights(request).derived_scene_generation_allowed
    || observed.purpose !== purpose || (purpose ? observed.capture_owner?.user_id ?? null : observed.capture_owner?.user_id) !== owner
    || !purpose && owner === null
    || currentWebsitePreparationStatusContext({requestId: selector.request_id, brief, record: request ?? {}, inventory,
      captureId: selector.capture_id, captureBinding: binding, assessmentPreparationProposal: preparation?.proposal}).context_digest !== selector.task_context_digest) throw unavailable();
  return {fingerprint: sourceFingerprint(session), binding, owner, preparation,
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
      if (authority.preparation) await assertAssessmentPreparationCurrent(tx, authority.preparation, request ?? {},
        {requestId: selector.request_id, captureId: selector.capture_id});
      const owner = typeof request?.account_owner_uid === "string" ? request.account_owner_uid : null;
      if (!session || sourceFingerprint(session) !== authority.fingerprint || !brief
        || owner !== authority.owner || !projectWebsiteCaptureRights(request).derived_scene_generation_allowed
        || authority.sponsorshipDigest !== undefined && request?.website_scene_sponsorship?.authority_digest !== authority.sponsorshipDigest
        || currentWebsitePreparationStatusContext({requestId: selector.request_id, brief, record: request ?? {}, inventory,
          captureId: selector.capture_id, captureBinding: authority.binding,
          assessmentPreparationProposal: authority.preparation?.proposal}).context_digest !== selector.task_context_digest) throw unavailable();
      const preparation = mergeWebsitePreparationStatus(parseStored(session.website_preparation), selector, status);
      tx.set(ref, {website_preparation: preparation,
        website_preparation_notification_pending: preparation.notification?.state === "pending"}, {merge: true});
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
        website_preparation_notification_pending: false}, {merge: true});
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
export async function loadCurrentWebsitePreparationStatus(requestId: string, captureId: string,
  deps = defaultDeps): Promise<PublicWebsitePreparationStatus> {
  try {
    id.parse(requestId); websitePreparationSelectorSchema.innerType().shape.capture_id.parse(captureId);
    const {status} = await fresh(captureId, requestId, deps);
    // Customer correlation is company-derived; never trust caller supplied correlation text.
    return {state: status.state, correlationId: `bp-prep-${status.status_digest.slice(7, 23)}`};
  } catch { return {state: "unavailable", correlationId: null}; }
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
      return needsAttention(latest.state) && websitePreparationEventId(match.selector) === eventId;
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
      if (!needsAttention(current.status.state) || !row.notification
        || row.notification.eventId !== websitePreparationEventId(current.selector)) { pending++; continue; }
      const result = await enqueue({requestId: row.selector.request_id, captureId: row.selector.capture_id,
        eventId: row.notification.eventId, correlationId: `bp-prep-${current.status.status_digest.slice(7, 23)}`});
      if (result === "unavailable") {pending++; continue;}
      await deps.acknowledge(row.selector.capture_id, row.notification.eventId); enqueued++;
    } catch { pending++; }
  }
  return {enqueued, pending};
}
