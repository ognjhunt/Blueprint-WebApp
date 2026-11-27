import { withCsrfHeader } from "@/lib/csrf";

/** Said when an emailed sign-in link was used already, expired, or its company's approval changed. */
export const SIGN_IN_LINK_ENDED = "This sign-in link no longer works. Ask for a new one on this page.";
/** Said when a press could not finish for a moment (no answer, or not a link that ended): the server's own 503 words. */
export const SIGN_IN_TRY_AGAIN = "Sign-in is temporarily unavailable. Try again shortly.";

/**
 * A failed press of "Sign in with this link". `ended` only when the server said the link itself no longer works
 * (`sign_in_link_invalid`: used, expired, its approval changed, or not a link at all); then the page lets the link go.
 * Anything else (a 503 that says "Try again shortly", the network) keeps the link, so the company can press again
 * without reopening its email (review, 2026-11-27).
 */
export class CompanySignInLinkFailure extends Error {
  constructor(message: string, public ended: boolean) { super(message); }
}

/** The server's answer that the link itself is spent or never was one: a 403, or a 400 for a link of the wrong shape. */
export const signInLinkEnded = (status: number, code: unknown) => (status === 403 || status === 400) && code === "sign_in_link_invalid";

/**
 * Spend a deployment company's emailed sign-in link (`server/utils/companySignInLink.ts`) and sign its account in.
 * Called only from a person's press (outreach gap 1, 2026-11-27): a mail scanner that opens the page and runs its scripts
 * must not spend the one use.
 * Returns where the link leads (a job, or the job list). Throws with the server's words when the link no longer works.
 */
export async function signInWithCompanyLink(link: string): Promise<string | null> {
  const response = await fetch("/api/robot-team-access/sign-in-link/redeem", { method: "POST", credentials: "include",
    headers: await withCsrfHeader({ "Content-Type": "application/json" }), body: JSON.stringify({ link }) });
  const data = await response.json().catch(() => ({})) as { customToken?: string; returnTo?: string; error?: string; code?: string };
  if (!response.ok || !data.customToken) {
    throw new CompanySignInLinkFailure(data.error || SIGN_IN_LINK_ENDED, signInLinkEnded(response.status, data.code));
  }
  const [{ signInWithCustomToken }, firebase] = await Promise.all([import("firebase/auth"), import("@/lib/firebase")]);
  await signInWithCustomToken(firebase.auth, data.customToken);
  return data.returnTo ?? null;
}

/**
 * Read `?link=` from the address without changing it. Pure, so React may call it twice (StrictMode in development) and
 * both calls see the link; take it out of the address bar with `stripSignInLinkFromAddress` in an effect.
 */
export function readSignInLinkFromAddress(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("link") || null;
}

/** Take `?link=` out of the address bar, keeping every other parameter. Safe to call more than once. */
export function stripSignInLinkFromAddress(): void {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  if (!params.has("link")) return;
  params.delete("link");
  const rest = params.toString();
  window.history.replaceState(window.history.state, "", `${window.location.pathname}${rest ? `?${rest}` : ""}${window.location.hash}`);
}
