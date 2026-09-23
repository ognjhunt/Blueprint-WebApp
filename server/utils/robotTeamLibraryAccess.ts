import type { Request, Response } from "express";

import { authAdmin } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { resolveAccessContext } from "./access-control";
import { presentedAgentKey, resolveAgentKey } from "./robotTeamAgentKeys";
import {
  isRobotTeamEarlyAccessGated,
  resolveViewerAccess,
  teamHasEarlyAccess,
  type LibraryAccess,
} from "./robotTeamEarlyAccess";

/**
 * The library access for one request, from whichever credential it carries.
 *
 * - A Blueprint agent key (`bpk_…`): the team's bound, verified account decides.
 * - A Firebase ID token: the verified email decides; staff always see.
 * - Nothing, or a credential that does not verify: anonymous.
 *
 * A bad token on a public page is treated as anonymous rather than a 401, so a
 * stale session shows the application instead of an error.
 */
export async function libraryAccessForRequest(req: Request): Promise<LibraryAccess> {
  const gated = isRobotTeamEarlyAccessGated();
  const presented = presentedAgentKey(req.headers as unknown as Record<string, unknown>);

  if (presented && presented.startsWith("bpk_")) {
    const teamId = await resolveAgentKey(presented).catch(() => null);
    const allowed = teamId ? await teamHasEarlyAccess(teamId) : !gated;
    return {
      gated,
      status: allowed ? "approved" : "none",
      signedIn: Boolean(teamId),
      emailVerified: allowed,
      allowed,
      staff: false,
    };
  }

  if (presented && authAdmin) {
    try {
      const decoded = await authAdmin.verifyIdToken(presented);
      // Same role resolution as the admin routes: token claims plus users/{uid}.
      const context = await resolveAccessContext({ locals: { firebaseUser: decoded } } as unknown as Response);
      return await resolveViewerAccess({
        email: typeof decoded.email === "string" ? decoded.email : null,
        emailVerified: decoded.email_verified === true,
        isOps: context.isOps,
      });
    } catch (error) {
      logger.debug({ error }, "Library request carried a token that did not verify; treating as anonymous");
    }
  }

  return resolveViewerAccess(null);
}
