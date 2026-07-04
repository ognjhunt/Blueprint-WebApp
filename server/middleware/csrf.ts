import crypto from "crypto";
import type { NextFunction, Request, Response } from "express";

const CSRF_COOKIE_NAME = "csrf_token";
const CSRF_HEADER_NAME = "x-csrf-token";
const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const NATIVE_CLIENT_HEADER_NAME = "x-blueprint-native-client";

const parseCookies = (cookieHeader?: string) => {
  if (!cookieHeader) {
    return {};
  }

  return cookieHeader.split(";").reduce<Record<string, string>>((acc, entry) => {
    const [rawKey, ...rest] = entry.trim().split("=");
    if (!rawKey) {
      return acc;
    }
    acc[decodeURIComponent(rawKey)] = decodeURIComponent(rest.join("="));
    return acc;
  }, {});
};

export const csrfCookieHandler = (_req: Request, res: Response) => {
  const token = crypto.randomBytes(32).toString("hex");

  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  return res.status(200).json({ csrfToken: token });
};

export const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
  if (!STATE_CHANGING_METHODS.has(req.method)) {
    return next();
  }

  // WEB-06: the native-client exemption must not be a pure request-controlled
  // header — an attacker could set it to disable CSRF on every csrfProtection route.
  // Only honor it for a request that also presents a Bearer Authorization token.
  // Bearer-authenticated requests are inherently CSRF-safe (a cross-site request
  // cannot forge a custom Authorization header without a CORS preflight), and real
  // native clients authenticate with a Firebase Bearer token, so this preserves the
  // legitimate path while closing the spoof.
  const nativeClient = String(req.header(NATIVE_CLIENT_HEADER_NAME) || "").trim().toLowerCase();
  const hasBearerAuth = /^Bearer\s+\S/i.test(req.header("authorization") || "");
  if (
    hasBearerAuth &&
    (nativeClient === "ios" || nativeClient === "android" || nativeClient === "blueprint-capture")
  ) {
    return next();
  }

  const cookies = parseCookies(req.headers.cookie);
  const cookieToken = cookies[CSRF_COOKIE_NAME];
  const headerToken = req.header(CSRF_HEADER_NAME) || req.header("X-CSRF-Token");

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ error: "Invalid CSRF token" });
  }

  return next();
};

export const getCsrfCookieName = () => CSRF_COOKIE_NAME;
