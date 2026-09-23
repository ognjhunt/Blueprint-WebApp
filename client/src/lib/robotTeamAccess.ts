import { withCsrfHeader } from "@/lib/csrf";

/** Mirrors `LibraryAccess` on the server. */
export interface LibraryAccess {
  gated: boolean;
  status: "applied" | "approved" | "declined" | "none";
  signedIn: boolean;
  emailVerified: boolean;
  allowed: boolean;
  staff: boolean;
}

export interface EarlyAccessApplication {
  name: string;
  email: string;
  company: string;
  website?: string;
  robot: string;
  workWanted: string;
  region?: string;
  acceptedTerms: true;
}

export class EarlyAccessApplicationError extends Error {}

export async function applyForEarlyAccess(application: EarlyAccessApplication): Promise<LibraryAccess["status"]> {
  const response = await fetch("/api/robot-team-access/apply", {
    method: "POST",
    headers: await withCsrfHeader({ "Content-Type": "application/json" }),
    body: JSON.stringify(application),
  });
  const body = (await response.json().catch(() => ({}))) as { status?: LibraryAccess["status"]; error?: string };
  if (!response.ok) {
    throw new EarlyAccessApplicationError(body.error || "The application could not be sent. Try again.");
  }
  return body.status ?? "applied";
}
