import { readDurableSiteCaptureRecovery, writeDurableSiteCaptureRecovery, retireDurableSiteCaptureRecovery, durableSiteCaptureRecoveryKeys } from "./siteCaptureDurability";
/** Local recovery only; server authorization and saved submission remain authoritative. */
export const SITE_CAPTURE_DRAFT_VERSION = 1;
export const SITE_CAPTURE_DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export type SiteCaptureDraft = {
  task: string; location: string; email: string; company: string;
  method: "phone" | "upload" | "visit"; region: "" | "us" | "non_us";
  regionManuallySet: boolean;
};
export type SiteCaptureRecovery = {
  version: 1; savedAt: number; requestId: string; retryToken: string;
  draft: SiteCaptureDraft;
  pending: null | { body: string; endpoint: "/api/inbound-request" | "/api/workspace/capture-start"; acknowledged: boolean };
};
export const emptySiteCaptureDraft = (): SiteCaptureDraft => ({
  task: "", location: "", email: "", company: "", method: "phone", region: "", regionManuallySet: false,
});
export function siteCaptureDraftKey(uid: string | null, authoring: string) {
  return `bp-site-capture:v1:${uid === null ? "anonymous" : `account:${encodeURIComponent(uid)}`}:${encodeURIComponent(authoring)}`;
}
export function newSiteCaptureRecovery(): SiteCaptureRecovery {
  return { version: 1, savedAt: Date.now(), requestId: `capture-${crypto.randomUUID()}`,
    retryToken: crypto.randomUUID(), draft: emptySiteCaptureDraft(), pending: null };
}
export function readSiteCaptureRecovery(key: string | null): SiteCaptureRecovery | null {
  if (!key || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw || raw.length > 25000) return null;
    return validSiteCaptureRecovery(JSON.parse(raw));
  } catch { return null; }
}
function validSiteCaptureRecovery(input: unknown): SiteCaptureRecovery | null {
  try {
    const value = input as SiteCaptureRecovery;
    const draft = value.draft;
    const now = Date.now();
    if (value.version !== 1 || !Number.isFinite(value.savedAt) || value.savedAt > now + 60000
      || now - value.savedAt >= SITE_CAPTURE_DRAFT_TTL_MS
      || !/^capture-[a-f0-9-]{36}$/.test(value.requestId) || !/^[a-f0-9-]{36}$/.test(value.retryToken)
      || !draft || !["phone", "upload", "visit"].includes(draft.method)
      || !["", "us", "non_us"].includes(draft.region) || typeof draft.regionManuallySet !== "boolean"
      || !([[draft.task, 2000], [draft.location, 300], [draft.email, 320], [draft.company, 200]] as const)
        .every(([field, limit]) => typeof field === "string" && field.length <= limit)) return null;
    if (value.pending !== null) {
      const pending = value.pending;
      if (!pending || typeof pending.body !== "string" || pending.body.length > 16000
        || typeof pending.acknowledged !== "boolean"
        || !["/api/inbound-request", "/api/workspace/capture-start"].includes(pending.endpoint)) return null;
      const body = JSON.parse(pending.body);
      if (body.requestId !== value.requestId || body.retryToken !== value.retryToken
        || body.buyerType !== "site_operator" || body.taskStatement !== draft.task.trim()
        || body.siteLocation !== draft.location.trim() || body.captureRegion !== draft.region) return null;
    }
    return value;
  } catch { return null; }
}
export function writeSiteCaptureRecovery(key: string | null, value: SiteCaptureRecovery, options: { releasePendingBody?: string } = {}): boolean {
  if (!key || typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(key);
    const latest = readSiteCaptureRecovery(key);
    // Invalid/expired bytes require explicit clearing, never silent replacement.
    if (raw !== null && !latest) return false;
    if (latest && (latest.requestId !== value.requestId || latest.retryToken !== value.retryToken)) return false;
    if (latest?.pending) {
      if (!value.pending) {
        if (options.releasePendingBody !== latest.pending.body || latest.pending.acknowledged) return false;
      } else {
        if (latest.pending.body !== value.pending.body) return false;
        // Only a matching workspace refusal can change the retry route.
        if (latest.pending.endpoint !== value.pending.endpoint && !(latest.pending.endpoint === "/api/workspace/capture-start"
          && value.pending.endpoint === "/api/inbound-request" && !latest.pending.acknowledged)) return false;
        value = { ...latest, savedAt: Math.max(latest.savedAt, value.savedAt), pending: { ...value.pending,
          acknowledged: latest.pending.acknowledged || value.pending.acknowledged } };
      }
    }
    // Persist only the named recovery fields: no File objects or bearer URL
    // can ride along on a future caller's spread object.
    const { task, location, email, company, method, region, regionManuallySet } = value.draft;
    window.localStorage.setItem(key, JSON.stringify({
      version: value.version, savedAt: value.savedAt, requestId: value.requestId, retryToken: value.retryToken,
      draft: { task, location, email, company, method, region, regionManuallySet },
      pending: value.pending ? { body: value.pending.body, endpoint: value.pending.endpoint, acknowledged: value.pending.acknowledged } : null,
    }));
    return true;
  } catch { return false; }
}

/** Every UI write shares this origin/scoped lock; no network work belongs inside it. */
class SiteCaptureRecoveryError extends Error {}
export async function withSiteCaptureRecoveryLock<T>(key: string | null, action: () => T | Promise<T>): Promise<T> {
  if (!key || typeof navigator === "undefined" || !navigator.locks?.request) {
    throw new SiteCaptureRecoveryError("This browser cannot safely coordinate saved drafts. Use a supported browser with local storage enabled, or email hello@tryblueprint.io for help starting your job.");
  }
  try { return await navigator.locks.request(key, action); }
  catch (error) {
    if (error instanceof SiteCaptureRecoveryError) throw error;
    throw new SiteCaptureRecoveryError("This browser cannot safely save recovery details. No new job was submitted. Use a browser with local storage enabled, or your existing private job link.");
  }
}

/** Read authority and freeze atomically across tabs, before dispatching any request. */
export async function freezeSiteCaptureRecovery(key: string | null, candidate: SiteCaptureRecovery, isActive: () => boolean = () => true) {
  return withSiteCaptureRecoveryLock(key, async () => {
    if (!isActive()) throw new SiteCaptureRecoveryError("This account changed before submission. Reload to review the current draft.");
    if (!key) throw new SiteCaptureRecoveryError("Recovery scope unavailable");
    // Read bytes explicitly: a denied read must not be mistaken for an empty slot.
    const raw = window.localStorage.getItem(key);
    const latest = readSiteCaptureRecovery(key);
    if (raw !== null && !latest) throw new SiteCaptureRecoveryError("Saved recovery details could not be read. Use your private job link or explicitly clear this browser's draft.");
    if (latest?.pending) {
      await writeDurableSiteCaptureRecovery(key, latest);
      return { value: latest, adopted: true };
    }
    if (latest && (latest.requestId !== candidate.requestId || latest.retryToken !== candidate.retryToken)) {
      throw new SiteCaptureRecoveryError("This draft was changed in another tab. Reload this page and review the current draft before starting.");
    }
    if (!candidate.pending) throw new SiteCaptureRecoveryError("Submission snapshot missing");
    const value = { ...candidate, savedAt: Date.now(), requestId: latest?.requestId ?? candidate.requestId,
      retryToken: latest?.retryToken ?? candidate.retryToken };
    value.pending = { ...candidate.pending, body: JSON.stringify({ ...JSON.parse(candidate.pending.body),
      requestId: value.requestId, retryToken: value.retryToken }) };
    if (!await writeSiteCaptureRecoveryDurably(key, value)) throw new SiteCaptureRecoveryError("This browser cannot save recovery details. No job was submitted. Use a browser with local storage enabled.");
    return { value, adopted: false };
  });
}
export function forgetSiteCaptureRecovery(key: string | null): boolean {
  try { if (key) window.localStorage.removeItem(key); return true; } catch { return false; }
}

/** Preserve uncertainty when stored bytes are unreadable or expired. */
export function hasSiteCaptureRecoveryBytes(key: string | null): boolean {
  if (!key || typeof window === "undefined") return false;
  try { return window.localStorage.getItem(key) !== null; } catch { return false; }
}

/** Call only while holding this scope's WebLock. Strict commit completes before dispatch. */
export async function writeSiteCaptureRecoveryDurably(key: string | null, value: SiteCaptureRecovery,
  options: { releasePendingBody?: string; replaceIdentity?: boolean } = {}): Promise<boolean> {
  if (!key) return false;
  const before = window.localStorage.getItem(key);
  if (!writeSiteCaptureRecovery(key, value, options)) return false;
  const written = window.localStorage.getItem(key);
  const canonical = readSiteCaptureRecovery(key);
  if (!canonical) throw new SiteCaptureRecoveryError("Saved recovery details could not be read.");
  try { await writeDurableSiteCaptureRecovery(key, canonical, options.replaceIdentity); return true; }
  catch (error) {
    // Roll back only this exact attempted write; never erase a later authority.
    if (window.localStorage.getItem(key) === written) {
      if (before === null) window.localStorage.removeItem(key); else window.localStorage.setItem(key, before);
    }
    throw error;
  }
}
/** Restore before mounting an editable form or generating a fresh identity. */
export async function hydrateSiteCaptureRecovery(key: string | null, isActive: () => boolean = () => true): Promise<void> {
  await withSiteCaptureRecoveryLock(key, async () => {
    if (!key || !isActive()) return;
    const mirror = await readDurableSiteCaptureRecovery(key);
    if (!isActive()) return;
    if (mirror?.retired) {
      if (!forgetSiteCaptureRecovery(key)) throw new SiteCaptureRecoveryError("Device recovery could not be cleared.");
      if (!await writeSiteCaptureRecoveryDurably(key, newSiteCaptureRecovery(), {replaceIdentity: true})) throw new SiteCaptureRecoveryError("Device recovery could not be saved.");
      return;
    }
    const raw = window.localStorage.getItem(key), local = readSiteCaptureRecovery(key);
    if (raw !== null && !local) throw new SiteCaptureRecoveryError("Saved recovery details expired or could not be read.");
    const durable = mirror?.value ? validSiteCaptureRecovery(mirror.value) : null;
    if (mirror?.value && !durable) throw new SiteCaptureRecoveryError("Saved recovery details expired or could not be read.");
    if (local && durable && (local.requestId !== durable.requestId || local.retryToken !== durable.retryToken
      || (local.pending && durable.pending && local.pending.body !== durable.pending.body))) {
      throw new SiteCaptureRecoveryError("Conflicting recovery details require your private job link.");
    }
    let winner = local ?? durable;
    if (durable?.pending && (!local?.pending || durable.pending.acknowledged)) winner = durable;
    if (!winner) winner = newSiteCaptureRecovery();
    // Reconstruct the fast mirror using named fields; no signed URL is retained.
    if (!await writeSiteCaptureRecoveryDurably(key, winner)) throw new SiteCaptureRecoveryError("Device recovery could not be saved.");
  });
}
export async function resetSiteCaptureRecoveryDurably(key: string | null, fresh: SiteCaptureRecovery): Promise<boolean> {
  if (!key) return false;
  await retireDurableSiteCaptureRecovery(key);
  if (!forgetSiteCaptureRecovery(key)) return false;
  return writeSiteCaptureRecoveryDurably(key, fresh, {replaceIdentity: true});
}
/** Tombstones fence delayed writers, across all authoring scopes for this account. */
export async function clearSiteCaptureRecoveryForAccount(uid: string): Promise<boolean> {
  const prefix = `bp-site-capture:v1:account:${encodeURIComponent(uid)}:`;
  try {
    const keys = new Set((await durableSiteCaptureRecoveryKeys()).filter(key => key.startsWith(prefix)));
    for (let index = 0; index < window.localStorage.length; index++) {
      const key = window.localStorage.key(index); if (key?.startsWith(prefix)) keys.add(key);
    }
    let cleared = true;
    for (const key of keys) await withSiteCaptureRecoveryLock(key, async () => {
      await retireDurableSiteCaptureRecovery(key);
      if (!forgetSiteCaptureRecovery(key)) cleared = false;
    });
    return cleared;
  } catch { return false; }
}
