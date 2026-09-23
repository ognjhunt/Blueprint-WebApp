/**
 * Attaching a site to an operator's account, from wherever that happens.
 *
 * Two places do it: the brief confirmation, where the operator saves the site
 * to an account in the same step, and the `/claim/:token` page the emails
 * link to. Both go through the same server claim, which requires a verified
 * email that matches the submission, so the rules live in one place.
 */
import type { User } from "firebase/auth";
import { WorkspaceRequestError, workspaceRequest } from "@/lib/workspace";
import { MIN_PASSWORD_LENGTH } from "@/lib/passwordPolicy";

export interface ClaimContext {
  /** The submission's own email, which the account must use. */
  email: string | null;
  /** Seeds the organization name when the account is brand new. */
  siteName: string | null;
}

/** Sets up a fresh site-operator workspace if needed, then attaches the site. */
export async function attachSiteClaim(
  token: string,
  user: User,
  context: ClaimContext,
  acceptedTerms: boolean,
) {
  try {
    return await workspaceRequest(user, "/claim", "POST", { token });
  } catch (error) {
    if (error instanceof WorkspaceRequestError && error.code === "workspace_setup_required") {
      await setUpSiteWorkspace(user, context, acceptedTerms);
      return workspaceRequest(user, "/claim", "POST", { token });
    }
    throw error;
  }
}

/**
 * Records the account's workspace type and terms before the email is
 * verified, so the claim that follows the verification click needs nothing
 * else from the operator.
 */
export async function setUpSiteWorkspace(user: User, context: ClaimContext, acceptedTerms: boolean) {
  const name = context.email?.split("@")[0] || "Site operator";
  await workspaceRequest(user, "/setup", "POST", {
    name,
    organization: context.siteName || "My site",
    workspaceType: "site_operator",
    acceptedTerms,
  });
}

/**
 * Where the verification email lands. `auto=1` lets the claim page finish the
 * attach on its own when the verified account is already signed in, so the
 * verification click is the only step left.
 */
export function claimVerificationUrl(token: string) {
  const url = new URL(`/claim/${encodeURIComponent(token)}`, window.location.origin);
  url.searchParams.set("auto", "1");
  return url.toString();
}

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  "auth/email-already-in-use": "An account already uses this email. Choose “I already have an account” and sign in.",
  "auth/wrong-password": "That password does not match this account.",
  "auth/invalid-credential": "That email and password do not match an account.",
  "auth/user-not-found": "There is no account with this email yet. Create one instead.",
  "auth/invalid-email": "That email address does not look right.",
  "auth/too-many-requests": "Too many attempts in a row. Wait a few minutes, then try again.",
  "auth/network-request-failed": "We could not reach the sign-in service. Check your connection and try again.",
  "auth/popup-closed-by-user": "The Google window closed before signing in.",
  "auth/cancelled-popup-request": "The Google window closed before signing in.",
  "auth/popup-blocked": "Your browser blocked the Google window. Allow pop-ups for this site and try again.",
  "auth/user-disabled": "This account is disabled. Write to hello@tryblueprint.io and we will help.",
  "auth/requires-recent-login": "For your security, sign in again and retry.",
  "auth/expired-action-code": "That verification link has expired. We can send a new one.",
  "auth/invalid-action-code": "That verification link has already been used or is not valid.",
};

/**
 * A sign-in error in words a person can act on.
 *
 * Firebase errors carry codes like "auth/too-many-requests" and messages like
 * "Firebase: Error (auth/too-many-requests)." Neither is for a customer, so a
 * code we know becomes a sentence and anything that still looks like a code
 * becomes the caller's fallback.
 */
export function friendlyAuthError(error: unknown, fallback: string): string {
  if (error instanceof WorkspaceRequestError) return error.message;
  const code = (error as { code?: string } | null)?.code;
  if (code === "auth/weak-password") return `Choose a password of ${MIN_PASSWORD_LENGTH} characters or more.`;
  if (code && AUTH_ERROR_MESSAGES[code]) return AUTH_ERROR_MESSAGES[code];
  if (code?.startsWith("auth/")) return fallback;
  if (error instanceof TypeError) return "We could not reach Blueprint. Check your connection and try again.";
  if (error instanceof Error && error.message && !/firebase|auth\/|\(|\bError\b/i.test(error.message)) {
    return error.message;
  }
  return fallback;
}
