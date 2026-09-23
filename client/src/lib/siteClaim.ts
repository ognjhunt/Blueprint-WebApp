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

export function friendlyAuthError(error: unknown, fallback: string): string {
  if (error instanceof WorkspaceRequestError) return error.message;
  const code = (error as { code?: string } | null)?.code;
  if (code === "auth/email-already-in-use") {
    return "An account already uses this email. Choose “I already have an account” and sign in.";
  }
  if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
    return "That password does not match this account.";
  }
  if (code === "auth/weak-password") return `Choose a password of ${MIN_PASSWORD_LENGTH} characters or more.`;
  if (code === "auth/popup-closed-by-user") return "The Google window closed before signing in.";
  if (error instanceof Error) return error.message.replace("Firebase: ", "");
  return fallback;
}
