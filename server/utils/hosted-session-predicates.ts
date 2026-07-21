import type { HostedSessionMode, HostedSessionRecord } from "../types/hosted-session";

/**
 * Pure classification predicates for hosted sessions.
 *
 * These answer yes/no (or key/mode) questions about a session record without
 * any I/O or route-level state, including whether a presentation session is
 * reusable and when it expires.
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
