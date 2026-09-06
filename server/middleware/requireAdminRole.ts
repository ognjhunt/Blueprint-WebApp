import type { Request, Response } from "express";

import { logger } from "../logger";
import { hasAnyRole, resolveExecutionAccessContext } from "../utils/access-control";

export async function requireAdminRole(
  _req: Request,
  res: Response,
  next: () => void,
) {
  const user = res.locals.firebaseUser;

  if (!user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  if (!(await hasAnyRole(res, ["admin", "ops"]))) {
    logger.warn(
      { email: user.email, uid: user.uid },
      "Non-admin user attempted to access admin routes",
    );
    return res.status(403).json({ error: "Admin access required" });
  }

  next();
}

export async function requireExecutionRole(_req:Request,res:Response,next:()=>void) {
  if (!res.locals.firebaseUser?.uid) return res.status(401).json({error:"Authentication required"});
  const access=await resolveExecutionAccessContext(res);
  if (!access.isOps) return res.status(403).json({error:"Verified execution authority required"});
  next();
}
