import crypto from "crypto";
import type { NextFunction, Request, Response } from "express";

const CSRF_COOKIE_NAME = "csrf_token";
const CSRF_HEADER_NAME = "x-csrf-token";
const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

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
    httpOnly: false,
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

  const cookies = parseCookies(req.headers.cookie);
  const cookieToken = cookies[CSRF_COOKIE_NAME];
  const headerToken = req.header(CSRF_HEADER_NAME) || req.header("X-CSRF-Token");

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ error: "Invalid CSRF token" });
  }

  return next();
};

export const getCsrfCookieName = () => CSRF_COOKIE_NAME;
