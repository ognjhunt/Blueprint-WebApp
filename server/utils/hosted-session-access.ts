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

export type HostedSessionLaunchAccess = HostedSessionAccessUser & {
  entitled: boolean;
  entitlement: AgentEntitlementProof | null;
  accessSource: "admin" | "session_owner" | "agent_dry_run" | "firestore" | "public_demo" | "none";
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

export function createHostedSessionAccess(deps: HostedSessionAccessDeps) {
  function currentFirebaseUser(res: Response) {
    return res.locals.firebaseUser as
      | { uid?: string; email?: string; admin?: boolean }
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

    const entitlement = await findProvisionedHostedSessionEntitlement({
      buyerUserId: user.uid,
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

    if (options.requireEntitlement || session) {
      throw new HostedSessionRuntimeError(
        session ? "session_access_denied" : "entitlement_required",
        session
          ? "Session access requires the creating robot-team account, admin access, or a matching provisioned entitlement."
          : PROVISIONED_HOSTED_ENTITLEMENT_REQUIRED,
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
