/** The exact browser write awaiting (or having passed) privacy admission. */
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { randomUUID } from "node:crypto";
import { SITE_CAPTURE_SESSIONS_COLLECTION } from "./siteCaptureUploadIdentity";
import { crossRuntimeDigest } from "./crossRuntimeCanonical";
import type { WrittenManifest, WrittenObject } from "./websiteCaptureDelivery";
import type { CapturePrivacyProducerSource } from "./capturePrivacyRecord";

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
  const privacy = snapshot.data()?.capture_privacy_screen;
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
    transaction.set(ref, { browser_pending_delivery: outcome.selected, browser_upload_reservation: null }, { merge: true });
    return outcome.selected;
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
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const value = snapshot.data()?.browser_pending_delivery;
    if (!validPending(value) || !sameDelivery(value, selected)) throw new Error("browser_pending_changed");
    if (value.state !== "published") transaction.set(ref, {
      browser_pending_delivery: { ...value, state: "published" },
    }, { merge: true });
  });
}
