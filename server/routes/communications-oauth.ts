import { Router, type Express, type Response } from "express";
import rateLimit from "express-rate-limit";
import verifyFirebaseToken from "../middleware/verifyFirebaseToken";
import { csrfProtection } from "../middleware/csrf";
import { configuredFounderConsent } from "../agents/communications-oauth-store";
import { FounderConsentError, FOUNDER_OAUTH_PREFIX, FOUNDER_OAUTH_COOKIE,
  type FounderGmailConsent } from "../agents/communications-oauth";

const parseCookie = (header = "") => {
  const matches = header.split(";").map(part => part.trim()).filter(part => part.startsWith(FOUNDER_OAUTH_COOKIE + "="));
  if (matches.length !== 1) return "";
  try { return decodeURIComponent(matches[0].slice(FOUNDER_OAUTH_COOKIE.length + 1)); } catch { return ""; }
};
const identity = (res: Response) => ({ uid: res.locals.firebaseUser?.uid || "",
  tenantId: res.locals.firebaseUser?.firebase?.tenant || null, authTime: res.locals.firebaseUser?.auth_time || 0 });
const cookieOptions = { httpOnly: true, secure: true, sameSite: "lax" as const, path: FOUNDER_OAUTH_PREFIX, maxAge: 600000 };
const failure = (res: Response, error: unknown) => res.status(error instanceof FounderConsentError ? error.status : 503)
  .json({ error: error instanceof FounderConsentError ? error.code : "founder_oauth_unavailable" });

export function founderGmailOAuthRouter(getConsent: () => FounderGmailConsent | null = configuredFounderConsent) {
  const router = Router();
  router.use((_req, res, next) => { res.set({ "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" }); next(); });
  router.use(rateLimit({ windowMs: 60000, limit: 20, standardHeaders: true, legacyHeaders: false }));
  // Google cannot attach a Firebase bearer token. This reception only consumes
  // a browser-bound one-use state and encrypts the code; it cannot exchange/save.
  router.get("/callback", async (req, res) => {
    try {
      const consent = getConsent(); if (!consent) return res.status(503).json({ error: "founder_oauth_disabled_or_unconfigured" });
      const { state, code, error } = req.query;
      if (typeof state !== "string" || (error !== undefined && error !== "access_denied")
        || (code !== undefined && typeof code !== "string") || (code !== undefined && error !== undefined)) {
        return res.status(400).json({ error: "founder_oauth_callback_invalid" });
      }
      await consent.callback({ state, code: code as string | undefined, denied: error === "access_denied" }, parseCookie(req.headers.cookie));
      // Fixed same-site clean location; never reflect a code/state/redirect input.
      return res.redirect(303, "/admin/leads?founder_gmail=returned");
    } catch (error) { return failure(res, error); }
  });
  router.use(verifyFirebaseToken);
  router.get("/status", async (req, res) => {
    try {
      const consent = getConsent();
      if (!consent) return res.json({ enabled: false, state: "disabled_or_unconfigured", sendsEnabled: false });
      return res.json({ enabled: true, ...await consent.status(identity(res), parseCookie(req.headers.cookie)), sendsEnabled: false });
    } catch (error) { return failure(res, error); }
  });
  router.use(csrfProtection, (req, res, next) => {
    // Browser-only owner actions; no arbitrary return URLs or native exemption.
    if (req.header("origin") !== "https://tryblueprint.io") return res.status(403).json({ error: "founder_oauth_origin_invalid" });
    if (!req.body || Array.isArray(req.body) || Object.keys(req.body).length) return res.status(400).json({ error: "founder_oauth_body_invalid" });
    next();
  });
  router.post("/start", async (_req, res) => {
    try {
      const consent = getConsent(); if (!consent) return res.status(503).json({ error: "founder_oauth_disabled_or_unconfigured" });
      const result = await consent.start(identity(res));
      res.cookie(FOUNDER_OAUTH_COOKIE, result.cookie, cookieOptions);
      return res.json({ authorizationUrl: result.authorizationUrl });
    } catch (error) { return failure(res, error); }
  });
  router.post("/complete", async (req, res) => {
    try {
      const consent = getConsent(); if (!consent) return res.status(503).json({ error: "founder_oauth_disabled_or_unconfigured" });
      const result = await consent.finish(identity(res), parseCookie(req.headers.cookie));
      res.clearCookie(FOUNDER_OAUTH_COOKIE, { ...cookieOptions, maxAge: undefined });
      return res.json(result);
    } catch (error) { return failure(res, error); }
  });
  return router;
}

export function registerFounderGmailOAuthRoutes(app: Express) { app.use(FOUNDER_OAUTH_PREFIX, founderGmailOAuthRouter()); }
