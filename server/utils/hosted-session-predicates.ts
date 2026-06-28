import type { HostedSessionMode, HostedSessionRecord } from "../types/hosted-session";

/**
 * Pure classification predicates for hosted sessions.
 *
 * These answer yes/no (or key/mode) questions about a session record without
 * any I/O or route-level state: whether a site world is a public demo, whether
 * a presentation-demo session is reusable, when it expires, etc. They are
 * imported by both the route layer and the in-memory session store.
 */

function toIsoString(value: unknown) {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && value !== null && "toDate" in value && typeof (value as { toDate: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return String(value);
}

const PUBLIC_DEMO_SITE_WORLD_IDS = new Set<string>();
if (process.env.NODE_ENV !== "production" || process.env.BLUEPRINT_ENABLE_DEMO_SITE_WORLDS === "1") {
  PUBLIC_DEMO_SITE_WORLD_IDS.add("siteworld-f5fd54898cfb");
}
if (process.env.BLUEPRINT_HOSTED_DEMO_SITE_WORLD_ID?.trim()) {
  PUBLIC_DEMO_SITE_WORLD_IDS.add(process.env.BLUEPRINT_HOSTED_DEMO_SITE_WORLD_ID.trim());
}

export function isPublicDemoSiteWorldId(siteWorldId: string) {
  return PUBLIC_DEMO_SITE_WORLD_IDS.has(String(siteWorldId || "").trim());
}

export function isPublicDemoSession(session: HostedSessionRecord | null | undefined) {
  return Boolean(session && isPublicDemoSiteWorldId(session.site.siteWorldId));
}

export function normalizeSessionMode(value: unknown): HostedSessionMode {
  return value === "presentation_demo" ? "presentation_demo" : "runtime_only";
}

export function sessionUsesPresentationDemo(session: HostedSessionRecord) {
  return session.sessionMode === "presentation_demo";
}

export function isSessionExpired(session: HostedSessionRecord) {
  const expiresAt = toIsoString(session.presentationRuntime?.expiresAt);
  return Boolean(expiresAt && new Date(expiresAt).getTime() <= Date.now());
}

export function isReusablePresentationSession(session: HostedSessionRecord, uid: string, siteWorldId: string) {
  if (!sessionUsesPresentationDemo(session)) return false;
  if (session.createdBy.uid !== uid) return false;
  if (session.site.siteWorldId !== siteWorldId) return false;
  if (session.status === "stopped" || session.status === "failed") return false;
  if (isSessionExpired(session)) return false;
  return true;
}

export function presentationSessionKey(uid: string, siteWorldId: string) {
  return `${uid}:${siteWorldId}`;
}
