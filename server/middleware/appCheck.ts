import type { NextFunction, Request, Response } from "express";
import admin from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";

/**
 * Firebase App Check on the anonymous routes that cost Blueprint money:
 * starting a job and admitting upload bytes.
 *
 * Staged by `BLUEPRINT_APP_CHECK_MODE`, default `off`:
 * - `off`: nothing is read or verified.
 * - `monitor`: the `X-Firebase-AppCheck` token is verified off the request
 *   path and the outcome logged (`app_check_monitor`); nothing is refused.
 *   Run this until missing and invalid outcomes are explained.
 * - `enforce`: a missing token is 401, an invalid one 403, and 503 when the
 *   verifier itself is unavailable (fail closed).
 *
 * The web client sends the token only when `VITE_FIREBASE_APPCHECK_SITE_KEY`
 * is set (reCAPTCHA Enterprise). The iOS bundle routes are not guarded: the
 * app would need its own App Attest provider first.
 */

export type AppCheckMode = "off" | "monitor" | "enforce";
export type AppCheckOutcome = "valid" | "missing" | "invalid" | "unverifiable";
type Verifier = (token: string) => Promise<unknown>;

export const APP_CHECK_HEADER = "x-firebase-appcheck";

export function appCheckMode(env: NodeJS.ProcessEnv = process.env): AppCheckMode {
  const raw = String(env.BLUEPRINT_APP_CHECK_MODE ?? "").trim().toLowerCase();
  return raw === "monitor" || raw === "enforce" ? raw : "off";
}

function adminVerifier(): Verifier | null {
  try {
    if (!admin?.apps?.length) return null;
    const appCheck = admin.appCheck();
    return (token) => appCheck.verifyToken(token);
  } catch {
    return null;
  }
}

async function verify(token: string, verifier: Verifier | null): Promise<AppCheckOutcome> {
  if (!token) return "missing";
  if (!verifier) return "unverifiable";
  try {
    await verifier(token);
    return "valid";
  } catch {
    return "invalid";
  }
}

const REFUSALS: Record<Exclude<AppCheckOutcome, "valid">, { status: number; code: string; error: string }> = {
  missing: { status: 401, code: "app_check_required",
    error: "We could not confirm this request came from the Blueprint website. Reload the page and try again." },
  invalid: { status: 403, code: "app_check_invalid",
    error: "We could not confirm this request came from the Blueprint website. Reload the page and try again." },
  unverifiable: { status: 503, code: "app_check_unavailable",
    error: "We could not check this request right now. Please try again in a minute." },
};

export function requireAppCheck(route: string, options: { verifier?: Verifier | null; env?: NodeJS.ProcessEnv } = {}) {
  return (req: Request, res: Response, next: NextFunction) => {
    const mode = appCheckMode(options.env);
    if (mode === "off") return next();
    const token = String(req.get(APP_CHECK_HEADER) ?? "").trim();
    const verifier = options.verifier === undefined ? adminVerifier() : options.verifier;
    if (mode === "monitor") {
      void verify(token, verifier).then((outcome) => {
        if (outcome === "valid") logger.debug({ event: "app_check_monitor", route, outcome }, "App Check token verified");
        else logger.info({ event: "app_check_monitor", route, outcome }, "App Check would refuse this request");
      });
      return next();
    }
    verify(token, verifier).then((outcome) => {
      if (outcome === "valid") return next();
      logger.warn({ event: "app_check_refused", route, outcome }, "App Check refused a request");
      const refusal = REFUSALS[outcome];
      res.status(refusal.status).json({ code: refusal.code, error: refusal.error });
    }, next);
  };
}
