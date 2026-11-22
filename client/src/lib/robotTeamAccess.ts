import { withCsrfHeader } from "@/lib/csrf";
import { PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legalAcceptance";
import { withFirebaseAuthHeaders } from "@/lib/firebaseAuthHeaders";
import type { User } from "firebase/auth";

export const BROWSE_JOBS_PATH = "/contact/robot-team";
/** One name for the company job list everywhere: header, nav, links and the page itself (owner, 2026-11-20). */
export const BROWSE_JOBS_LABEL = "Find jobs";
export const BROWSE_JOBS_TITLE = BROWSE_JOBS_LABEL;

export function jobLibrarySignInHref(): string {
  const hash = typeof window === "undefined" ? "" : window.location.hash;
  const path = /^#job-[A-Za-z0-9_-]+$/.test(hash) ? `${BROWSE_JOBS_PATH}${hash}` : BROWSE_JOBS_PATH;
  return `/sign-in?next=${encodeURIComponent(path)}`;
}

/** Mirrors `LibraryAccess` on the server. */
export interface LibraryAccess {
  status: "applied" | "approved" | "declined" | "none";
  signedIn: boolean;
  emailVerified: boolean;
  allowed: boolean;
  staff: boolean;
  /** An approved deployment company that must agree to the current Terms and Privacy Policy first. */
  termsRequired?: boolean;
}

/** Approval is based on the verified company email, including for accounts without workspace setup. */
export async function isApprovedDeploymentCompany(user: User): Promise<boolean> {
  if (!user.emailVerified) return false;
  try {
    const signal = AbortSignal.timeout(2000);
    const response = await fetch("/api/robot-team-access/me", {
      headers: await withFirebaseAuthHeaders(user), signal,
    });
    if (!response.ok) return false;
    const { access } = (await response.json()) as { access?: LibraryAccess };
    return access?.emailVerified === true && access.status === "approved" && !access.staff;
  } catch {
    // An unavailable discovery route never blocks sign-in or opens a job.
    return false;
  }
}

export interface EarlyAccessApplication {
  /** A partner's delivery role, not an approval or a claim of compatibility. */
  partnerRole?: "deployment" | "technology";
  name: string;
  email: string;
  company: string;
  website?: string;
  robot: string;
  workWanted: string;
  region?: string;
  supportedSystems?: string;
  pilotPackage?: string;
  testSite?: string;
  acceptedTerms: true;
  optionalUpdates?: boolean;
  returnToJob?: string;
}

export class EarlyAccessApplicationError extends Error {}

export type AccessNotificationStatus = "queued" | "sent" | "needs_attention" | "not_requested";

/** Ask for a fresh invitation link; it is sent only if the address is approved. */
export async function requestInvitationLink(email: string): Promise<void> {
  const response = await fetch("/api/robot-team-access/invitation", {
    method: "POST",
    headers: await withCsrfHeader({ "Content-Type": "application/json" }),
    body: JSON.stringify({ email }),
  });
  if (!response.ok) throw new EarlyAccessApplicationError("The link could not be sent. Try again.");
}

export async function applyForEarlyAccess(application: EarlyAccessApplication): Promise<{
  status: LibraryAccess["status"]; notificationStatus: AccessNotificationStatus;
}> {
  const response = await fetch("/api/robot-team-access/apply", {
    method: "POST",
    headers: await withCsrfHeader({ "Content-Type": "application/json" }),
    // The versions of the Terms and Privacy Policy the form shows, recorded on the application as what was shown.
    body: JSON.stringify({ ...application, termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION }),
  });
  const body = (await response.json().catch(() => ({}))) as {
    status?: LibraryAccess["status"]; notificationStatus?: AccessNotificationStatus; error?: string;
  };
  if (!response.ok) {
    throw new EarlyAccessApplicationError(body.error || "The application could not be sent. Try again.");
  }
  return { status: body.status ?? "applied", notificationStatus: body.notificationStatus ?? "needs_attention" };
}
