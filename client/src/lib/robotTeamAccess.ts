import { withCsrfHeader } from "@/lib/csrf";
import { PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legalAcceptance";

/** Mirrors `LibraryAccess` on the server. */
export interface LibraryAccess {
  gated: boolean;
  status: "applied" | "approved" | "declined" | "none";
  signedIn: boolean;
  emailVerified: boolean;
  allowed: boolean;
  staff: boolean;
  /** An approved deployment company that must agree to the current Terms and Privacy Policy first. */
  termsRequired?: boolean;
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
