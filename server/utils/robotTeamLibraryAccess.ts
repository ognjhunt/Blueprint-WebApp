import type { Request, Response } from "express";

import { authAdmin } from "../../client/src/lib/firebaseAdmin";
import { bindVerifiedPreferenceAccount } from "./updatePreferences";
import { logger } from "../logger";
import { resolveAccessContext } from "./access-control";
import { resolveViewerAccess, type LibraryAccess } from "./robotTeamEarlyAccess";

/**
 * The library access for one request, from the credential it carries.
 *
 * - A Firebase ID token: the verified email decides; staff always see.
 * - Nothing, or a credential that does not verify: anonymous.
 *
 * A bad token on a public page is treated as anonymous rather than a 401, so a
 * stale session shows the application instead of an error.
 */
export async function libraryAccessForRequest(req: Request): Promise<LibraryAccess> {
  const authorization = String(req.headers.authorization ?? "");
  const presented = authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() : null;

  if (presented && authAdmin) {
    try {
      const decoded = await authAdmin.verifyIdToken(presented, true);
      // Same role resolution as the admin routes: token claims plus users/{uid}.
      const context = await resolveAccessContext({ locals: { firebaseUser: decoded } } as unknown as Response);
      if (decoded.email_verified === true && decoded.email) await bindVerifiedPreferenceAccount(decoded.uid, decoded.email);
      return await resolveViewerAccess({
        uid: decoded.uid,
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
