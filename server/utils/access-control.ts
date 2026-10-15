import type { Response } from "express";

import { dbAdmin as db, authAdmin } from "../../client/src/lib/firebaseAdmin";
import { withTaskEvaluationLaunchStoreTimeout } from "./taskEvaluationLaunchStore";
import { logger } from "../logger";

export type AccessRole = "admin" | "ops";

type FirebaseUserLike = {
  uid?: string;
  email?: string;
  email_verified?: boolean;
  admin?: boolean;
  ops?: boolean;
  role?: unknown;
  roles?: unknown;
} | null | undefined;

type UserDocLike = Record<string, unknown> | null;

export type AccessContext = {
  uid: string | null;
  email: string | null;
  roles: AccessRole[];
  isAdmin: boolean;
  isOps: boolean;
};

function asRole(value: unknown): AccessRole | null {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "admin" || normalized === "ops") {
    return normalized;
  }
  return null;
}

function collectRoles(rawValues: unknown[]): AccessRole[] {
  const roles = new Set<AccessRole>();

  for (const rawValue of rawValues) {
    if (Array.isArray(rawValue)) {
      for (const entry of rawValue) {
        const role = asRole(entry);
        if (role) {
          roles.add(role);
        }
      }
      continue;
    }

    const role = asRole(rawValue);
    if (role) {
      roles.add(role);
    }
  }

  return [...roles];
}

function rolesFromFirebaseUser(user: FirebaseUserLike): AccessRole[] {
  if (!user) {
    return [];
  }

  const roles = new Set<AccessRole>(
    collectRoles([user.roles, user.role]),
  );

  if (user.admin === true) {
    roles.add("admin");
  }
  if (user.ops === true) {
    roles.add("ops");
  }

  return [...roles];
}

function rolesFromUserDoc(userDoc: UserDocLike): AccessRole[] {
  if (!userDoc) {
    return [];
  }

  const roles = new Set<AccessRole>(
    collectRoles([
      userDoc.roles,
      userDoc.role,
      userDoc.accessRoles,
    ]),
  );

  if (userDoc.admin === true) {
    roles.add("admin");
  }
  if (userDoc.ops === true) {
    roles.add("ops");
  }

  return [...roles];
}

async function loadUserDocRoles(uid: string | null): Promise<AccessRole[]> {
  if (!uid || !db) {
    return [];
  }

  try {
    const userDoc = await db.collection("users").doc(uid).get();
    if (!userDoc.exists) {
      return [];
    }
    return rolesFromUserDoc((userDoc.data() || {}) as Record<string, unknown>);
  } catch {
    return [];
  }
}

function emailList(value: string | undefined): Set<string> {
  return new Set(
    String(value || "")
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean),
  );
}

/**
 * Roles granted by an explicit, server-side email allowlist. Only a verified
 * Firebase email counts.
 */
export function rolesFromEmailAllowlist(user: FirebaseUserLike, env: NodeJS.ProcessEnv = process.env): AccessRole[] {
  const email = typeof user?.email === "string" ? user.email.trim().toLowerCase() : "";
  if (!email || user?.email_verified !== true) return [];
  const roles: AccessRole[] = [];
  if (emailList(env.BLUEPRINT_ADMIN_EMAIL_ALLOWLIST).has(email)) roles.push("admin");
  if (emailList(env.BLUEPRINT_OPS_EMAIL_ALLOWLIST).has(email)) roles.push("ops");
  return roles;
}

/**
 * Legacy users-doc roles. Firestore rules now forbid clients from writing
 * admin/ops/accessRoles, but documents written before that rule may still
 * carry them, so a doc-only grant is logged. BLUEPRINT_ADMIN_ROLE_DOC_FALLBACK=0
 * turns the fallback off once custom claims (scripts/ops/audit-admin-roles.ts)
 * or the allowlist cover every operator.
 */
export function userDocRoleFallbackEnabled(env: NodeJS.ProcessEnv = process.env) {
  return !["0", "false", "no", "off"].includes(String(env.BLUEPRINT_ADMIN_ROLE_DOC_FALLBACK ?? "").trim().toLowerCase());
}

const DOC_ROLE_WARN_INTERVAL_MS = 60 * 60 * 1000;
const docRoleWarnedAt = new Map<string, number>();

/**
 * Evidence for turning the fallback off: how many authorisations since boot
 * rested on a users-doc role that no custom claim or allowlist entry covers.
 * Counts only; who it was is in the structured log line, never here.
 */
const docOnlyGrants = { total: 0, principals: new Set<string>(), lastAt: null as string | null };

export type AdminRoleDocFallbackStatus = {
  fallbackEnabled: boolean;
  docOnlyGrantsSinceBoot: number;
  docOnlyPrincipalsSinceBoot: number;
  lastDocOnlyGrantAt: string | null;
};

export function adminRoleDocFallbackStatus(env: NodeJS.ProcessEnv = process.env): AdminRoleDocFallbackStatus {
  return {
    fallbackEnabled: userDocRoleFallbackEnabled(env),
    docOnlyGrantsSinceBoot: docOnlyGrants.total,
    docOnlyPrincipalsSinceBoot: docOnlyGrants.principals.size,
    lastDocOnlyGrantAt: docOnlyGrants.lastAt,
  };
}

/**
 * A role granted only because the fallback is on. Every such grant is
 * counted; the warning is logged at most hourly per uid so a busy operator
 * does not flood the log, and carries what would remain if the fallback were
 * set to 0 so the founder can see who depends on it before flipping it.
 */
function recordDocOnlyGrant(
  uid: string,
  docOnlyRoles: AccessRole[],
  sources: { claimRoles: AccessRole[]; allowlistRoles: AccessRole[] },
) {
  const now = Date.now();
  docOnlyGrants.total += 1;
  docOnlyGrants.principals.add(uid);
  docOnlyGrants.lastAt = new Date(now).toISOString();
  if (now - (docRoleWarnedAt.get(uid) || 0) < DOC_ROLE_WARN_INTERVAL_MS) return;
  docRoleWarnedAt.set(uid, now);
  logger.warn(
    {
      event: "admin_role_from_user_doc",
      metric: "admin_role_doc_fallback_grant",
      uid,
      roles: docOnlyRoles,
      claimRoles: sources.claimRoles,
      allowlistRoles: sources.allowlistRoles,
      deniedWhenFallbackOff: true,
      fallbackSetting: "BLUEPRINT_ADMIN_ROLE_DOC_FALLBACK",
      docOnlyGrantsSinceBoot: docOnlyGrants.total,
      docOnlyPrincipalsSinceBoot: docOnlyGrants.principals.size,
    },
    "Admin/ops role granted only by the users document, not by custom claims or the allowlist; migrate it to a custom claim (scripts/ops/audit-admin-roles.ts) before setting BLUEPRINT_ADMIN_ROLE_DOC_FALLBACK=0",
  );
}

export async function resolveAccessContext(res: Response): Promise<AccessContext> {
  const firebaseUser = res.locals.firebaseUser as FirebaseUserLike;
  const uid = typeof firebaseUser?.uid === "string" ? firebaseUser.uid.trim() || null : null;
  const email =
    typeof firebaseUser?.email === "string" ? firebaseUser.email.trim().toLowerCase() || null : null;

  // Preferred sources: Firebase custom claims, then the server allowlist.
  const claimRoles = rolesFromFirebaseUser(firebaseUser);
  const allowlistRoles = rolesFromEmailAllowlist(firebaseUser);
  const roles = new Set<AccessRole>([...claimRoles, ...allowlistRoles]);
  if (userDocRoleFallbackEnabled()) {
    const userDocRoles = await loadUserDocRoles(uid);
    const docOnly = userDocRoles.filter((role) => !roles.has(role));
    if (uid && docOnly.length) recordDocOnlyGrant(uid, docOnly, { claimRoles, allowlistRoles });
    for (const role of userDocRoles) {
      roles.add(role);
    }
  }

  return {
    uid,
    email,
    roles: [...roles],
    isAdmin: roles.has("admin"),
    isOps: roles.has("admin") || roles.has("ops"),
  };
}

export async function hasAnyRole(res: Response, requiredRoles: AccessRole[]): Promise<boolean> {
  const context = await resolveAccessContext(res);
  return requiredRoles.some((role) => context.roles.includes(role));
}

/** Paid-route authority never trusts historical, formerly client-writable profiles. */
export async function resolveExecutionAccessContext(res: Response): Promise<AccessContext> {
  const principal=res.locals.firebaseUser as FirebaseUserLike & {tenantId?:string;tenant_id?:string;firebase?:{tenant?:string}};
  const uid=typeof principal?.uid==="string"?principal.uid:null;
  const denied:AccessContext={uid:null,email:typeof principal?.email==="string"?principal.email:null,roles:[],isAdmin:false,isOps:false};
  if (!uid || !authAdmin) return denied;
  try {
    const tenant=principal?.tenantId || principal?.tenant_id || principal?.firebase?.tenant;
    const authority=tenant?authAdmin.tenantManager().authForTenant(tenant):authAdmin;
    const account=await withTaskEvaluationLaunchStoreTimeout(authority.getUser(uid));
    if (account.disabled) return denied;
    const roles=rolesFromFirebaseUser(account.customClaims);
    return {uid,email:account.email || denied.email,roles,isAdmin:roles.includes("admin"),isOps:roles.includes("admin") || roles.includes("ops")};
  } catch { return denied; }
}
