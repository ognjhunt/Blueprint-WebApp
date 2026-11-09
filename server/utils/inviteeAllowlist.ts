import { emailList } from "./access-control";

/**
 * The invited beta's door: who may start a job. Each job costs Blueprint
 * real money, so while BLUEPRINT_INVITEE_ALLOWLIST is set only listed
 * addresses (or `@domain` entries) start one. Unset or empty keeps today's
 * open intake. Admin and ops allowlisted emails pass when signed in and verified.
 *
 * Nothing about a refused address is stored or sent anywhere.
 */

const EMAIL_ENTRY = /^[^\s@,]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/;
const DOMAIN_ENTRY = /^@[a-z0-9-]+(\.[a-z0-9-]+)+$/;

export type InviteeAllowlist =
  | { state: "unset" }
  | { state: "set"; emails: Set<string>; domains: Set<string> }
  | { state: "malformed" };

export function parseInviteeAllowlist(raw: string | undefined): InviteeAllowlist {
  if (!String(raw ?? "").trim()) return { state: "unset" };
  const entries = String(raw).split(",").map((entry) => entry.trim().toLowerCase()).filter(Boolean);
  const emails = new Set<string>();
  const domains = new Set<string>();
  for (const entry of entries) {
    if (DOMAIN_ENTRY.test(entry)) domains.add(entry.slice(1));
    else if (EMAIL_ENTRY.test(entry)) emails.add(entry);
    else return { state: "malformed" };
  }
  // A value of only commas was meant to say something; treat it as broken, not open.
  return entries.length ? { state: "set", emails, domains } : { state: "malformed" };
}

export function describeInviteeAllowlist(env: NodeJS.ProcessEnv = process.env) {
  return parseInviteeAllowlist(env.BLUEPRINT_INVITEE_ALLOWLIST).state;
}

export const INVITEE_REFUSALS = {
  invitee_not_on_allowlist: {
    status: 403,
    message: "Blueprint's beta is invite-only for now, and this email is not on the list.",
  },
  invitee_email_unverified: {
    status: 403,
    message: "Please verify your email address first; Blueprint's beta is invite-only and checks the verified address.",
  },
  invitee_allowlist_unavailable: {
    status: 503,
    message: "Blueprint cannot check its beta invite list right now, so new jobs are paused. Please try again later.",
  },
} as const;

export type InviteeDecision =
  | { allowed: true }
  | { allowed: false; code: keyof typeof INVITEE_REFUSALS; status: number; message: string };

const refuse = (code: keyof typeof INVITEE_REFUSALS): InviteeDecision => ({ allowed: false, code, ...INVITEE_REFUSALS[code] });

/**
 * Is this email invited to start a job? Call before anything is created.
 *
 * `emailVerified` is the sign-in token's `email_verified` on signed-in routes.
 * Leave it undefined only for an address typed into the public form, which
 * cannot be verified: the list can still match it, but the admin/ops pass
 * needs a verified sign-in. A signed-in, unverified email never counts.
 */
export function inviteeDecision(
  email: string | null | undefined,
  { emailVerified }: { emailVerified?: boolean } = {},
  env: NodeJS.ProcessEnv = process.env,
): InviteeDecision {
  const list = parseInviteeAllowlist(env.BLUEPRINT_INVITEE_ALLOWLIST);
  if (list.state === "unset") return { allowed: true };
  if (emailVerified === false) return refuse("invitee_email_unverified");
  const normalized = String(email ?? "").trim().toLowerCase();
  if (emailVerified === true && normalized && (emailList(env.BLUEPRINT_ADMIN_EMAIL_ALLOWLIST).has(normalized)
    || emailList(env.BLUEPRINT_OPS_EMAIL_ALLOWLIST).has(normalized))) return { allowed: true };
  // Fail closed: a broken list must not become open intake, since an uninvited job spends money.
  if (list.state === "malformed") return refuse("invitee_allowlist_unavailable");
  const domain = normalized.includes("@") ? normalized.slice(normalized.lastIndexOf("@") + 1) : "";
  if (list.emails.has(normalized) || (domain && list.domains.has(domain))) return { allowed: true };
  return refuse("invitee_not_on_allowlist");
}

type TokenUser = { email?: unknown; email_verified?: unknown } | undefined;

/** The same decision for a verified Firebase token (`res.locals.firebaseUser`). */
export function inviteeDecisionForToken(user: unknown, env: NodeJS.ProcessEnv = process.env): InviteeDecision {
  const token = user as TokenUser;
  return inviteeDecision(typeof token?.email === "string" ? token.email : "",
    { emailVerified: token?.email_verified === true }, env);
}
