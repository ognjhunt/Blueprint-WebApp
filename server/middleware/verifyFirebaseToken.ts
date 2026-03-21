import type { NextFunction, Request, Response } from "express";

import { authAdmin } from "../../client/src/lib/firebaseAdmin";

export default async function verifyFirebaseToken(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const authHeader = req.headers.authorization ?? "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Missing or invalid authorization" });
  }

  if (!authAdmin) {
    return res.status(503).json({
      error: "Firebase Admin auth is not configured on this server.",
    });
  }

  try {
    const decodedToken = await authAdmin.verifyIdToken(token);
    res.locals.firebaseUser = decodedToken;
    return next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
