import { Request, Response, Router } from "express";

import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { resolveAccessContext } from "../utils/access-control";
import {
  CLIENT_RUNTIME_CONFIG_COLLECTION,
  CLIENT_RUNTIME_CONFIG_DOC_ID,
  DEFAULT_CLIENT_RUNTIME_CONFIG,
  normalizeClientRuntimeConfig,
  validateClientRuntimeConfigUpdate,
  type ClientRuntimeConfig,
} from "../utils/client-runtime-config";

/**
 * R052: config-driven client runtime controls for the capture client.
 *
 * Serves force-update / kill-switch / maintenance-mode state from an
 * admin-controllable Firestore document (`appConfig/clientRuntime`, part of the
 * existing Firebase/Firestore stack — no new primary service).
 *
 *   GET  /api/client/runtime-config          (public; polled by capture client)
 *   GET  /api/admin/client-runtime-config    (admin; current config + source)
 *   PUT  /api/admin/client-runtime-config    (admin; update the config)
 *
 * The public read is intentionally unauthenticated and no-store cached: the
 * capture client must be able to fetch the kill-switch/min-version even when the
 * user is signed out or the app is otherwise blocked. Admin mutations are gated
 * behind Firebase auth + an admin role (mounted middleware + `requireAdmin`).
 *
 * Fail-safe: when Firestore is unavailable or the doc is missing, we serve the
 * availability-preserving defaults (kill-switch OFF) rather than fabricating an
 * "enforced" state. Enforcement is only ever ON when an admin set it.
 */

const CLIENT_RUNTIME_ENDPOINT_SCHEMA = "blueprint/client-runtime-config/v1";

async function loadClientRuntimeConfig(): Promise<{
  config: ClientRuntimeConfig;
  source: "firestore" | "default";
}> {
  if (!db) {
    return { config: { ...DEFAULT_CLIENT_RUNTIME_CONFIG }, source: "default" };
  }
  try {
    const snapshot = await db
      .collection(CLIENT_RUNTIME_CONFIG_COLLECTION)
      .doc(CLIENT_RUNTIME_CONFIG_DOC_ID)
      .get();
    if (!snapshot.exists) {
      return { config: { ...DEFAULT_CLIENT_RUNTIME_CONFIG }, source: "default" };
    }
    return {
      config: normalizeClientRuntimeConfig((snapshot.data() || {}) as Record<string, unknown>),
      source: "firestore",
    };
  } catch (error) {
    logger.error({ error }, "Failed to read client runtime config; serving safe defaults");
    return { config: { ...DEFAULT_CLIENT_RUNTIME_CONFIG }, source: "default" };
  }
}

function sendConfig(
  res: Response,
  payload: { config: ClientRuntimeConfig; source: "firestore" | "default" },
) {
  // Never cache the kill-switch: a stale CDN/browser copy could keep a bricked
  // build alive or hide a maintenance window.
  res.set("Cache-Control", "no-store, max-age=0");
  res.status(200).json({
    ok: true,
    schema: CLIENT_RUNTIME_ENDPOINT_SCHEMA,
    ...payload.config,
    source: payload.source,
    serverTime: new Date().toISOString(),
  });
}

/** Public, unauthenticated read for the capture client. */
export async function clientRuntimeConfigPublicHandler(_req: Request, res: Response) {
  const payload = await loadClientRuntimeConfig();
  sendConfig(res, payload);
}

async function requireAdmin(res: Response): Promise<boolean> {
  const context = await resolveAccessContext(res);
  return context.isAdmin;
}

const adminRouter = Router();

adminRouter.get("/", async (_req: Request, res: Response) => {
  if (!res.locals.firebaseUser) {
    return res.status(401).json({ error: "Authentication required" });
  }
  if (!(await requireAdmin(res))) {
    return res.status(403).json({ error: "Admin access required" });
  }
  const payload = await loadClientRuntimeConfig();
  return res.status(200).json({
    ok: true,
    schema: CLIENT_RUNTIME_ENDPOINT_SCHEMA,
    config: payload.config,
    source: payload.source,
  });
});

adminRouter.put("/", async (req: Request, res: Response) => {
  if (!res.locals.firebaseUser) {
    return res.status(401).json({ error: "Authentication required" });
  }
  if (!(await requireAdmin(res))) {
    return res.status(403).json({ error: "Admin access required" });
  }

  const validation = validateClientRuntimeConfigUpdate(req.body);
  if (!validation.ok || !validation.value) {
    return res.status(400).json({ error: "Invalid config update", details: validation.errors });
  }

  if (!db) {
    return res.status(503).json({ error: "Config store unavailable" });
  }

  const context = await resolveAccessContext(res);
  const updatedBy = context.email || context.uid || "admin";

  try {
    await db
      .collection(CLIENT_RUNTIME_CONFIG_COLLECTION)
      .doc(CLIENT_RUNTIME_CONFIG_DOC_ID)
      .set(
        {
          ...validation.value,
          updatedBy,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAtIso: new Date().toISOString(),
        },
        { merge: true },
      );
  } catch (error) {
    logger.error({ error }, "Failed to update client runtime config");
    return res.status(500).json({ error: "Failed to update config" });
  }

  const payload = await loadClientRuntimeConfig();
  logger.info({ updatedBy, update: validation.value }, "Client runtime config updated");
  return res.status(200).json({
    ok: true,
    schema: CLIENT_RUNTIME_ENDPOINT_SCHEMA,
    config: payload.config,
    source: payload.source,
  });
});

export default adminRouter;
