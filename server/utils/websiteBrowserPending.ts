/** The exact browser write awaiting (or having passed) privacy admission. */
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { createHash, randomUUID } from "node:crypto";
import { SITE_CAPTURE_SESSIONS_COLLECTION } from "./siteCaptureUploadIdentity";
import { crossRuntimeDigest } from "./crossRuntimeCanonical";
import type { WrittenManifest, WrittenObject } from "./websiteCaptureDelivery";
import type { CapturePrivacyProducerSource } from "./capturePrivacyRecord";
import { logger } from "../logger";
import { isSiteVideoEvidenceEnabled } from "../config/env";
import { enqueueNewPublishedSiteAssessment } from "./siteAssessmentQueue";

export interface BrowserPending {
  schema_version: "website_browser_pending.v1";
  request_id: string;
  scene_id: string;
  capture_id: string;
  state: "held" | "published";
  completed_at_iso: string;
  video: WrittenObject;
  manifest: WrittenManifest;
}

export interface BrowserWriteReservation {
  schema_version: "website_browser_write_reservation.v1";
  request_id: string;
  scene_id: string;
  capture_id: string;
  id: string;
  expires_at_ms: number;
}

/** Original server-built manifest retained before its Storage write is attempted. */
export interface BrowserStoredUpload {
  schema_version: "website_browser_stored_upload.v1";
  request_id: string;
  scene_id: string;
  capture_id: string;
  completed_at_iso: string;
  video: WrittenObject;
  manifest_json: string;
  manifest_sha256: string;
}

function validStoredUpload(value: unknown): value is BrowserStoredUpload {
  if (!value || typeof value !== "object") return false;
  const p = value as Partial<BrowserStoredUpload>;
  if (p.schema_version !== "website_browser_stored_upload.v1"
      || typeof p.request_id !== "string" || p.scene_id !== `site-${p.request_id}`
      || p.capture_id !== `walkthrough-${p.request_id}`
      || typeof p.completed_at_iso !== "string" || !Number.isFinite(Date.parse(p.completed_at_iso))
      || typeof p.manifest_json !== "string" || Buffer.byteLength(p.manifest_json) > 65_536
      || p.manifest_sha256 !== `sha256:${createHash("sha256").update(p.manifest_json).digest("hex")}`
      || !p.video || typeof p.video.object_name !== "string"
      || p.video.object_name !== `scenes/${p.scene_id}/captures/${p.capture_id}/raw/walkthrough.${p.video.object_name.endsWith(".mov") ? "mov" : "mp4"}`
      || typeof p.video.generation !== "string" || !/^[1-9][0-9]{0,19}$/.test(p.video.generation)
      || !Number.isSafeInteger(p.video.size_bytes) || p.video.size_bytes < 1
      || typeof p.video.crc32c !== "string" || !/^[A-Za-z0-9+/]{6}==$/.test(p.video.crc32c)) return false;
  try {
    const manifest = JSON.parse(p.manifest_json);
    return manifest.request_id === p.request_id && manifest.scene_id === p.scene_id
      && manifest.capture_id === p.capture_id && manifest.video_uri === p.video.object_name;
  } catch { return false; }
}

interface LegacyFinishClaim {
  schema_version: "website_browser_legacy_finish_claim.v1";
  request_id: string;
  scene_id: string;
  capture_id: string;
}

function validLegacyClaim(value: unknown): value is LegacyFinishClaim {
  if (!value || typeof value !== "object") return false;
  const claim = value as Partial<LegacyFinishClaim>;
  return claim.schema_version === "website_browser_legacy_finish_claim.v1"
    && typeof claim.request_id === "string" && claim.scene_id === `site-${claim.request_id}`
    && claim.capture_id === `walkthrough-${claim.request_id}`;
}

const WRITE_RESERVATION_MS = 60 * 60 * 1000;

function validReservation(value: unknown): value is BrowserWriteReservation {
  if (!value || typeof value !== "object") return false;
  const p = value as Partial<BrowserWriteReservation>;
  return p.schema_version === "website_browser_write_reservation.v1"
    && typeof p.request_id === "string" && typeof p.scene_id === "string"
    && typeof p.capture_id === "string" && typeof p.id === "string"
    && Number.isSafeInteger(p.expires_at_ms) && (p.expires_at_ms ?? 0) > 0;
}

function sameDelivery(a: BrowserPending, b: BrowserPending): boolean {
  const withoutState = ({ state: _state, ...identity }: BrowserPending) => identity;
  return crossRuntimeDigest(withoutState(a)) === crossRuntimeDigest(withoutState(b));
}

/** Privacy clearance is scoped to the completed write, not the capture ID. */
export function browserPendingDecisionKey(pending: BrowserPending): string {
  if (!validPending(pending)) throw new Error("browser_pending_invalid");
  const { state: _state, ...identity } = pending;
  return crossRuntimeDigest(identity);
}

export function selectBrowserPending(
  existing: BrowserPending | null, incoming: BrowserPending,
): { action: "record" | "replay"; selected: BrowserPending } | { action: "conflict" } {
  if (!existing) return { action: "record", selected: incoming };
  if (sameDelivery(existing, incoming)) return { action: "replay", selected: existing };
  if (existing.state === "published") return { action: "record", selected: incoming };
  return { action: "conflict" };
}

function validPending(value: unknown): value is BrowserPending {
  if (!value || typeof value !== "object") return false;
  const p = value as Partial<BrowserPending>;
  return p.schema_version === "website_browser_pending.v1"
    && (p.state === "held" || p.state === "published")
    && typeof p.request_id === "string" && typeof p.scene_id === "string"
    && typeof p.capture_id === "string" && typeof p.completed_at_iso === "string"
    && typeof p.video?.generation === "string" && typeof p.manifest?.generation === "string";
}

/** Claim the capture before either canonical video or manifest can be written. */
export async function reserveBrowserUpload(input: { request_id: string; scene_id: string; capture_id: string },
  nowMs = Date.now()): Promise<BrowserWriteReservation> {
  if (!db || !Number.isSafeInteger(nowMs) || nowMs < 1
      || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(input.request_id)
      || input.scene_id !== `site-${input.request_id}`
      || input.capture_id !== `walkthrough-${input.request_id}`)
    throw new Error("browser_pending_unavailable");
  const reservation: BrowserWriteReservation = { schema_version: "website_browser_write_reservation.v1",
    ...input, id: randomUUID(), expires_at_ms: nowMs + WRITE_RESERVATION_MS };
  const ref = db.collection(SITE_CAPTURE_SESSIONS_COLLECTION).doc(input.capture_id);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (snapshot.data()?.site_capture_bundle_claim) throw new Error("browser_pending_bundle_conflict");
    // A legacy held status poll owns this prefix until it has published its
    // plain marker. A modern upload must not replace its unversioned source.
    if (snapshot.data()?.browser_legacy_finish_claim) throw new Error("browser_pending_conflict");
    const value = snapshot.data()?.browser_pending_delivery;
    if (value != null && !validPending(value)) throw new Error("browser_pending_invalid");
    if (value?.state === "held") throw new Error("browser_pending_conflict");
    // A completed video with an interrupted manifest write must be retried,
    // rather than overwritten by a second upload of the same footage.
    if (snapshot.data()?.browser_stored_upload != null) throw new Error("browser_pending_conflict");
    const active = snapshot.data()?.browser_upload_reservation;
    if (active != null && !validReservation(active)) throw new Error("browser_pending_invalid");
    if (active && active.expires_at_ms > nowMs) throw new Error("browser_pending_conflict");
    // Keep this evidence after release or a failed write: canonical video may
    // already have changed even when no pending delivery was recorded.
    transaction.set(ref, { browser_upload_reservation: reservation,
      browser_modern_attempt: true }, { merge: true });
    return reservation;
  });
}

/** Claim a pre-receipt held capture before screening can clear its old source. */
export async function prepareLegacyBrowserFinish(input: { request_id: string; scene_id: string; capture_id: string }):
  Promise<"legacy" | "modern" | "blocked"> {
  if (!db || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(input.request_id)
      || input.scene_id !== `site-${input.request_id}`
      || input.capture_id !== `walkthrough-${input.request_id}`) throw new Error("browser_pending_unavailable");
  const sessionRef = db.collection(SITE_CAPTURE_SESSIONS_COLLECTION).doc(input.capture_id);
  const requestRef = db.collection("inboundRequests").doc(input.request_id);
  return db.runTransaction(async (transaction) => {
    const session = await transaction.get(sessionRef);
    const request = await transaction.get(requestRef);
    const data = session.data();
    // Typed browser and app deliveries use their own pinned completion paths.
    if (data?.browser_pending_delivery || data?.site_capture_bundle_claim) return "modern";
    if (data?.browser_modern_attempt != null || data?.browser_upload_reservation != null) return "blocked";
    const existing = data?.browser_legacy_finish_claim;
    if (existing != null) {
      if (!validLegacyClaim(existing) || existing.request_id !== input.request_id
          || existing.scene_id !== input.scene_id || existing.capture_id !== input.capture_id)
        return "blocked";
      return "legacy";
    }
    const privacy = request.data()?.capture_privacy_screen;
    if (!privacy || (privacy.eligibility !== "pending" && privacy.eligibility !== "rejected")
        || privacy.capture_id !== input.capture_id) return "modern";
    const claim: LegacyFinishClaim = { schema_version: "website_browser_legacy_finish_claim.v1", ...input };
    transaction.set(sessionRef, { browser_legacy_finish_claim: claim }, { merge: true });
    return "legacy";
  });
}

/** A crash after clearance may replay only this capture's recorded decision. */
export async function storedCapturePrivacyCleared(requestId: string, captureId: string,
  producerSource: CapturePrivacyProducerSource | null): Promise<boolean> {
  if (!db) throw new Error("browser_pending_unavailable");
  const snapshot = await db.collection("inboundRequests").doc(requestId).get();
  const privacy = producerSource === null
    ? snapshot.data()?.capture_privacy_screen
    : snapshot.data()?.capture_privacy_source_bound_decision;
  return privacy?.capture_id === captureId && privacy.proceeded === true
    && (privacy.eligibility === "approved" || privacy.eligibility === "unscreened")
    && (producerSource === null ? privacy.producer_source == null
      : privacy.producer_source?.kind === producerSource.kind
        && privacy.producer_source?.key === producerSource.key);
}

/** Only the original reservation may turn its actual write responses into a held delivery. */
export async function recordBrowserPending(incoming: BrowserPending,
  reservation: BrowserWriteReservation): Promise<BrowserPending> {
  if (!db || !validPending(incoming) || incoming.state !== "held" || !validReservation(reservation)
      || reservation.capture_id !== incoming.capture_id || reservation.request_id !== incoming.request_id
      || reservation.scene_id !== incoming.scene_id) throw new Error("browser_pending_unavailable");
  const ref = db.collection(SITE_CAPTURE_SESSIONS_COLLECTION).doc(incoming.capture_id);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (snapshot.data()?.site_capture_bundle_claim) throw new Error("browser_pending_bundle_conflict");
    const active = snapshot.data()?.browser_upload_reservation;
    if (!validReservation(active) || crossRuntimeDigest(active) !== crossRuntimeDigest(reservation))
      throw new Error("browser_pending_changed");
    const value = snapshot.data()?.browser_pending_delivery;
    if (value != null && !validPending(value)) throw new Error("browser_pending_invalid");
    const outcome = selectBrowserPending(value ?? null, incoming);
    if (outcome.action === "conflict") throw new Error("browser_pending_conflict");
    transaction.set(ref, { browser_pending_delivery: outcome.selected, browser_upload_reservation: null,
      browser_stored_upload: null }, { merge: true });
    return outcome.selected;
  });
}

/** Journal only an actual write response held by this upload's current claim. */
export async function recordBrowserStoredUpload(incoming: BrowserStoredUpload,
  reservation: BrowserWriteReservation): Promise<void> {
  if (!db || !validStoredUpload(incoming) || !validReservation(reservation)
      || incoming.request_id !== reservation.request_id || incoming.scene_id !== reservation.scene_id
      || incoming.capture_id !== reservation.capture_id) throw new Error("browser_pending_invalid");
  const ref = db.collection(SITE_CAPTURE_SESSIONS_COLLECTION).doc(incoming.capture_id);
  await db.runTransaction(async transaction => {
    const data = (await transaction.get(ref)).data();
    if (data?.site_capture_bundle_claim || !validReservation(data?.browser_upload_reservation)
        || crossRuntimeDigest(data.browser_upload_reservation) !== crossRuntimeDigest(reservation))
      throw new Error("browser_pending_changed");
    const prior = data?.browser_stored_upload;
    if (prior != null && (!validStoredUpload(prior) || crossRuntimeDigest(prior) !== crossRuntimeDigest(incoming)))
      throw new Error("browser_pending_changed");
    transaction.set(ref, { browser_stored_upload: incoming }, { merge: true });
  });
}

export async function loadBrowserStoredUpload(captureId: string): Promise<BrowserStoredUpload | null> {
  if (!db) throw new Error("browser_pending_unavailable");
  const value = (await db.collection(SITE_CAPTURE_SESSIONS_COLLECTION).doc(captureId).get())
    .data()?.browser_stored_upload;
  if (value == null) return null;
  if (!validStoredUpload(value) || value.capture_id !== captureId) throw new Error("browser_pending_invalid");
  return value;
}

/** Retry keeps the original receipt and never grants a canonical video write. */
export async function reserveBrowserStoredUploadRetry(selected: BrowserStoredUpload,
  nowMs = Date.now()): Promise<BrowserWriteReservation> {
  if (!db || !validStoredUpload(selected)) throw new Error("browser_pending_invalid");
  const reservation: BrowserWriteReservation = { schema_version: "website_browser_write_reservation.v1",
    request_id: selected.request_id, scene_id: selected.scene_id, capture_id: selected.capture_id,
    id: randomUUID(), expires_at_ms: nowMs + WRITE_RESERVATION_MS };
  const ref = db.collection(SITE_CAPTURE_SESSIONS_COLLECTION).doc(selected.capture_id);
  return db.runTransaction(async transaction => {
    const data = (await transaction.get(ref)).data();
    if (data?.site_capture_bundle_claim || data?.browser_pending_delivery?.state === "held"
        || !validStoredUpload(data?.browser_stored_upload)
        || crossRuntimeDigest(data.browser_stored_upload) !== crossRuntimeDigest(selected))
      throw new Error("browser_pending_changed");
    const active = data?.browser_upload_reservation;
    if (active != null && (!validReservation(active) || active.expires_at_ms > nowMs))
      throw new Error("browser_pending_conflict");
    transaction.set(ref, { browser_upload_reservation: reservation }, { merge: true });
    return reservation;
  });
}

/** A failed write frees only its own claim; a newer claim is never erased. */
export async function releaseBrowserUpload(reservation: BrowserWriteReservation): Promise<void> {
  if (!db || !validReservation(reservation)) throw new Error("browser_pending_unavailable");
  const ref = db.collection(SITE_CAPTURE_SESSIONS_COLLECTION).doc(reservation.capture_id);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const active = snapshot.data()?.browser_upload_reservation;
    if (active == null) return;
    if (!validReservation(active)) throw new Error("browser_pending_invalid");
    if (crossRuntimeDigest(active) === crossRuntimeDigest(reservation))
      transaction.set(ref, { browser_upload_reservation: null }, { merge: true });
  });
}

export async function loadBrowserPending(captureId: string): Promise<BrowserPending | null> {
  if (!db) throw new Error("browser_pending_unavailable");
  const snapshot = await db.collection(SITE_CAPTURE_SESSIONS_COLLECTION).doc(captureId).get();
  const value = snapshot.data()?.browser_pending_delivery;
  if (value == null) return null;
  if (!validPending(value) || value.capture_id !== captureId) throw new Error("browser_pending_invalid");
  return value;
}

export async function publishBrowserPending(selected: BrowserPending): Promise<void> {
  if (!db) throw new Error("browser_pending_unavailable");
  const ref = db.collection(SITE_CAPTURE_SESSIONS_COLLECTION).doc(selected.capture_id);
  const newlyPublished = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const value = snapshot.data()?.browser_pending_delivery;
    if (!validPending(value) || !sameDelivery(value, selected)) throw new Error("browser_pending_changed");
    if (value.state !== "published") {
      // New source publication and its advisory intent share one commit. An
      // older already-published row is intentionally never backfilled.
      await enqueueNewPublishedSiteAssessment(transaction, value);
      transaction.set(ref, { browser_pending_delivery: { ...value, state: "published" } }, { merge: true });
      return true;
    }
    return false;
  });
  // Dispatch begins only after durable publication; the HTTP upload response
  // does not wait for providers. Return visits can wake retained queued work.
  if (newlyPublished && selected.capture_id === `walkthrough-${selected.request_id}` && isSiteVideoEvidenceEnabled()) {
    void import("./siteAssessmentQueue").then(({ tickSiteAssessments }) => tickSiteAssessments(1)).catch(() => {
      logger.warn("Site advisory publication wake-up unavailable");
    });
  }
}
