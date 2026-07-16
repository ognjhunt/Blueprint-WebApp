import type { Request, Response } from "express";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import type { HostedSessionRecord } from "../types/hosted-session";
import { HostedSessionRuntimeError } from "./hosted-session-runtime";
import {
  hostedAccessStatus,
  hostedSessionEntitlementIds,
  isHostedAccessError,
} from "./hosted-session-route-helpers";
import {
  findProvisionedHostedSessionEntitlement,
  type AgentEntitlementProof,
} from "./robot-agent-commerce";

/**
 * Access control for hosted site-world sessions.
 *
 * Centralizes the "who may launch / read this session" rules: authenticating
 * the Firebase user, requiring a robot-team or admin account, and resolving
 * launch entitlement (admin, session owner, or a provisioned entitlement).
 *
 * The guards are produced by {@link createHostedSessionAccess} so the
 * session-loader can be injected — the loader lives with the in-memory session
 * store in the route module, and injecting it keeps this module free of a
 * dependency cycle while preserving the exact call signatures used by routes.
 */

const PROVISIONED_HOSTED_ENTITLEMENT_REQUIRED =
  "A provisioned hosted-session entitlement is required for protected site-world launch.";

export type HostedSessionAccessUser = {
  uid: string;
  email: string | null;
  admin: boolean;
};

export type HostedSessionAccessScope = "read" | "ui" | "operate" | "export";

export type HostedSessionLaunchAccess = HostedSessionAccessUser & {
  entitled: boolean;
  entitlement: AgentEntitlementProof | null;
  accessSource: "admin" | "session_owner" | "session_share" | "agent_dry_run" | "firestore" | "public_demo" | "none";
  blockers: string[];
};

async function loadUserProfile(uid: string) {
  if (!db) {
    return null;
  }

  const userDoc = await db.collection("users").doc(uid).get();
  if (!userDoc.exists) {
    return null;
  }
  return userDoc.data() as Record<string, unknown>;
}

export interface HostedSessionAccessDeps {
  loadHostedSession: (sessionId: string) => Promise<HostedSessionRecord | null>;
}

function trimLower(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function asStringList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => trimLower(item)).filter(Boolean);
}

function timestampMs(value: unknown) {
  if (!value) {
    return null;
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (value instanceof Date) {
    return value.getTime();
  }
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const maybeTimestamp = value as { toDate?: () => Date };
    if (typeof maybeTimestamp.toDate === "function") {
      return maybeTimestamp.toDate().getTime();
    }
  }
  return null;
}

function shareGrantMatchesUser(grant: unknown, user: HostedSessionAccessUser) {
  if (typeof grant === "string") {
    const normalizedGrant = trimLower(grant);
    return normalizedGrant === trimLower(user.uid) || Boolean(user.email && normalizedGrant === trimLower(user.email));
  }
  if (!grant || typeof grant !== "object") {
    return false;
  }
  const payload = grant as Record<string, unknown>;
  const uid = trimLower(payload.uid || payload.userId || payload.user_id);
  const email = trimLower(payload.email || payload.userEmail || payload.user_email);
  return uid === trimLower(user.uid) || Boolean(user.email && email === trimLower(user.email));
}

function shareGrantIsActive(grant: unknown) {
  if (typeof grant === "string") {
    return true;
  }
  if (!grant || typeof grant !== "object") {
    return false;
  }
  const payload = grant as Record<string, unknown>;
  if (payload.revoked === true) {
    return false;
  }
  if (payload.revokedAt || payload.revoked_at) {
    return false;
  }
  const expiresAt = timestampMs(payload.expiresAt || payload.expires_at);
  return !expiresAt || expiresAt > Date.now();
}

function shareGrantAllowsScope(grant: unknown, scope: HostedSessionAccessScope) {
  if (typeof grant === "string") {
    return scope === "read";
  }
  if (!grant || typeof grant !== "object") {
    return false;
  }
  const payload = grant as Record<string, unknown>;
  const permissions = new Set([
    ...asStringList(payload.permissions),
    ...asStringList(payload.scopes),
  ]);
  if (permissions.has("all") || permissions.has(scope)) {
    return true;
  }

  const role = trimLower(payload.role);
  if (role === "owner") {
    return true;
  }
  if (role === "operator") {
    return scope === "read" || scope === "ui" || scope === "operate";
  }
  if (role === "presenter") {
    return scope === "read" || scope === "ui";
  }
  if (role === "exporter") {
    return scope === "read" || scope === "export";
  }
  if (role === "viewer") {
    return scope === "read";
  }

  return permissions.size === 0 && !role && scope === "read";
}

function sessionShareGrants(session: HostedSessionRecord) {
  const payload = session as HostedSessionRecord & {
    sharedWith?: unknown;
    sessionShares?: unknown;
  };
  const grants = Array.isArray(payload.accessGrants)
    ? payload.accessGrants
    : Array.isArray(payload.sessionShares)
      ? payload.sessionShares
      : Array.isArray(payload.sharedWith)
        ? payload.sharedWith
        : [];
  return grants;
}

function hasActiveSessionShareGrant(
  session: HostedSessionRecord,
  user: HostedSessionAccessUser,
  scope: HostedSessionAccessScope,
) {
  return sessionShareGrants(session).some((grant) =>
    shareGrantMatchesUser(grant, user) &&
    shareGrantIsActive(grant) &&
    shareGrantAllowsScope(grant, scope),
  );
}

export function createHostedSessionAccess(deps: HostedSessionAccessDeps) {
  function currentFirebaseUser(res: Response) {
    return res.locals.firebaseUser as
      | { uid?: string; email?: string; email_verified?: boolean; admin?: boolean }
      | undefined;
  }

  function sendHostedAccessError(res: Response, error: unknown) {
    if (!isHostedAccessError(error)) {
      return false;
    }
    const hostedError = error as HostedSessionRuntimeError;
    res.status(hostedAccessStatus(hostedError)).json({
      error: hostedError.message,
      code: hostedError.code,
    });
    return true;
  }

  async function ensureRobotTeamOrAdminAccess(res: Response): Promise<HostedSessionAccessUser> {
    const firebaseUser = currentFirebaseUser(res);
    if (!firebaseUser?.uid) {
      throw new HostedSessionRuntimeError("unauthorized", "Missing authenticated user.");
    }

    if (firebaseUser.admin) {
      return {
        uid: firebaseUser.uid,
        email: firebaseUser.email || null,
        admin: true,
      };
    }

    const profile = await loadUserProfile(firebaseUser.uid);
    const buyerType = String(profile?.buyerType || "").trim();
    if (buyerType !== "robot_team") {
      throw new HostedSessionRuntimeError(
        "forbidden",
        "Hosted sessions are only available to robot-team accounts.",
      );
    }

    return {
      uid: firebaseUser.uid,
      email: firebaseUser.email || null,
      admin: false,
    };
  }

  async function ensureLaunchAccess(
    req: Request,
    res: Response,
    options: {
      siteWorldIds?: Array<string | null | undefined>;
      entitlementId?: string | null;
      session?: HostedSessionRecord | null;
      requireEntitlement?: boolean;
      sessionAccess?: HostedSessionAccessScope;
    } = {},
  ): Promise<HostedSessionLaunchAccess> {
    const user = await ensureRobotTeamOrAdminAccess(res);
    if (user.admin) {
      return {
        ...user,
        entitled: true,
        entitlement: null,
        accessSource: "admin",
        blockers: [],
      };
    }

    const session =
      options.session === undefined && req.params.sessionId
        ? await deps.loadHostedSession(String(req.params.sessionId || ""))
        : options.session || null;
    if (session?.createdBy?.uid === user.uid) {
      return {
        ...user,
        entitled: true,
        entitlement: null,
        accessSource: "session_owner",
        blockers: [],
      };
    }
    if (session) {
      const scope = options.sessionAccess || "operate";
      if (hasActiveSessionShareGrant(session, user, scope)) {
        return {
          ...user,
          entitled: true,
          entitlement: null,
          accessSource: "session_share",
          blockers: [],
        };
      }
      throw new HostedSessionRuntimeError(
        "session_access_denied",
        "Session access requires the creating robot-team account, admin access, or an active per-session share grant.",
      );
    }

    const tokenUser = currentFirebaseUser(res);
    const entitlement = await findProvisionedHostedSessionEntitlement({
      buyerUserId: user.uid,
      // Verified token email only — unlocks entitlements from anonymous agent
      // live checkouts that were bound by buyer email instead of uid.
      buyerEmail: tokenUser?.email_verified === false ? null : user.email,
      siteWorldIds: options.siteWorldIds?.length ? options.siteWorldIds : hostedSessionEntitlementIds(session),
      entitlementId: options.entitlementId,
    });
    if (entitlement) {
      return {
        ...user,
        entitled: true,
        entitlement,
        accessSource: entitlement.source,
        blockers: [],
      };
    }

    if (options.requireEntitlement) {
      throw new HostedSessionRuntimeError(
        "entitlement_required",
        PROVISIONED_HOSTED_ENTITLEMENT_REQUIRED,
      );
    }

    return {
      ...user,
      entitled: false,
      entitlement: null,
      accessSource: "none",
      blockers: [PROVISIONED_HOSTED_ENTITLEMENT_REQUIRED],
    };
  }

  async function getLaunchAccessState(req: Request, res: Response, siteWorldId: string) {
    try {
      return await ensureLaunchAccess(req, res, {
        siteWorldIds: [siteWorldId],
        requireEntitlement: false,
      });
    } catch (error) {
      if (error instanceof HostedSessionRuntimeError && (error.code === "forbidden" || error.code === "unauthorized")) {
        return {
          uid: currentFirebaseUser(res)?.uid || null,
          email: currentFirebaseUser(res)?.email || null,
          admin: false,
          entitled: false,
          entitlement: null,
          accessSource: "none",
          blockers: [error.message],
        };
      }
      throw error;
    }
  }

  return {
    currentFirebaseUser,
    sendHostedAccessError,
    ensureRobotTeamOrAdminAccess,
    ensureLaunchAccess,
    getLaunchAccessState,
  };
}
