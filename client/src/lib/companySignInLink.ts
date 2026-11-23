import { withCsrfHeader } from "@/lib/csrf";

/** Said when an emailed sign-in link was used already, expired, or its company's approval changed. */
export const SIGN_IN_LINK_ENDED = "This sign-in link no longer works. Ask for a new one on this page.";

/**
 * Spend a deployment company's emailed sign-in link (`server/utils/companySignInLink.ts`) and sign its account in.
 * Returns where the link leads (a job, or the job list). Throws with the server's words when the link no longer works.
 */
export async function signInWithCompanyLink(link: string): Promise<string | null> {
  const response = await fetch("/api/robot-team-access/sign-in-link/redeem", { method: "POST", credentials: "include",
    headers: await withCsrfHeader({ "Content-Type": "application/json" }), body: JSON.stringify({ link }) });
  const data = await response.json().catch(() => ({})) as { customToken?: string; returnTo?: string; error?: string };
  if (!response.ok || !data.customToken) throw new Error(data.error || SIGN_IN_LINK_ENDED);
  const [{ signInWithCustomToken }, firebase] = await Promise.all([import("firebase/auth"), import("@/lib/firebase")]);
  await signInWithCustomToken(firebase.auth, data.customToken);
  return data.returnTo ?? null;
}

/** Read `?link=` from the address and take it out of the address bar at once, keeping every other parameter. */
export function takeSignInLinkFromAddress(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const link = params.get("link");
  if (!link) return null;
  params.delete("link");
  const rest = params.toString();
  window.history.replaceState(window.history.state, "", `${window.location.pathname}${rest ? `?${rest}` : ""}${window.location.hash}`);
  return link;
}
