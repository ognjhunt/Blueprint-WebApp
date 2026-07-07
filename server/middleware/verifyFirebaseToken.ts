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

  const localRouteProofToken = String(
    process.env.BLUEPRINT_LOCAL_WEBAPP_ROUTE_PROOF_AUTH_TOKEN || "",
  ).trim();
  if (
    localRouteProofToken &&
    token === localRouteProofToken &&
    process.env.NODE_ENV !== "production"
  ) {
    res.locals.firebaseUser = {
      uid: "local-webapp-route-proof",
      aud: "local-webapp-route-proof",
      auth_time: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 300,
      firebase: { identities: {}, sign_in_provider: "custom" },
      iat: Math.floor(Date.now() / 1000),
      iss: "local-webapp-route-proof",
      role: "local_route_proof",
      localRouteProof: true,
      sub: "local-webapp-route-proof",
    };
    return next();
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
