/** The exact browser write awaiting (or having passed) privacy admission. */
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { SITE_CAPTURE_SESSIONS_COLLECTION } from "./siteCaptureUploadIdentity";
import { crossRuntimeDigest } from "./crossRuntimeCanonical";
import type { WrittenManifest, WrittenObject } from "./websiteCaptureDelivery";

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

function sameDelivery(a: BrowserPending, b: BrowserPending): boolean {
  const withoutState = ({ state: _state, ...identity }: BrowserPending) => identity;
  return crossRuntimeDigest(withoutState(a)) === crossRuntimeDigest(withoutState(b));
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

/** A held V1 is never replaced by V2, even if V2 has overwritten the canonical name. */
export async function recordBrowserPending(incoming: BrowserPending): Promise<BrowserPending> {
  if (!db || !validPending(incoming) || incoming.state !== "held") throw new Error("browser_pending_unavailable");
  const ref = db.collection(SITE_CAPTURE_SESSIONS_COLLECTION).doc(incoming.capture_id);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (snapshot.data()?.site_capture_bundle_claim) throw new Error("browser_pending_bundle_conflict");
    const value = snapshot.data()?.browser_pending_delivery;
    if (value != null && !validPending(value)) throw new Error("browser_pending_invalid");
    const outcome = selectBrowserPending(value ?? null, incoming);
    if (outcome.action === "conflict") throw new Error("browser_pending_conflict");
    if (outcome.action === "record") transaction.set(ref, { browser_pending_delivery: incoming }, { merge: true });
    return outcome.selected;
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
