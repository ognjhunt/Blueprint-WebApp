/**
 * Who is this request from?
 *
 * Every per-IP rate limit and every request log line depends on the answer,
 * and the answer depends on how many proxies sit between the visitor and this
 * process. Render terminates TLS at its own proxy, which appends the peer it
 * saw to `X-Forwarded-For`. Trusting exactly that many hops from the right
 * gives the visitor; trusting fewer gives a proxy address (one shared bucket
 * for everybody behind it), and trusting more lets a visitor write their own
 * address into the header and mint a fresh quota per request.
 *
 * The hop count is therefore configuration with an evidence-based default,
 * not a constant:
 *
 * - `BLUEPRINT_TRUST_PROXY_HOPS` — how many proxies to trust. Default 1 in
 *   production (Render's proxy; the repo's DNS records show Namecheap, not a
 *   Cloudflare zone, in front of tryblueprint.io) and 0 elsewhere. If an
 *   operator-controlled Cloudflare proxy is ever put in front of Render, the
 *   default is wrong and this becomes 2 — or use the next setting.
 * - `BLUEPRINT_TRUST_CF_CONNECTING_IP=1` — read the visitor from Cloudflare's
 *   `CF-Connecting-IP` header instead. Only safe when every request reaches
 *   the app through Cloudflare, because Cloudflare overwrites that header and
 *   nothing else does: without Cloudflare in the path a visitor can set it to
 *   anything. Off unless explicitly set, and ignored when no proxy is trusted.
 *
 * DEPLOYMENT.md ("Client IP behind proxies") says how to confirm the setting
 * against one real request in production.
 */

import type { Request } from "express";
import { ipKeyGenerator } from "express-rate-limit";
import { isIP } from "node:net";

const MAX_TRUSTED_HOPS = 5;

export type ClientIpConfig = {
  /** Proxies trusted from the right of X-Forwarded-For; 0 trusts none. */
  trustProxyHops: number;
  /** Read CF-Connecting-IP (only when trustProxyHops > 0). */
  trustCfConnectingIp: boolean;
  /** Set when the env value was unusable and the default was used instead. */
  invalidHopsValue?: string;
};

export function resolveClientIpConfig(env: NodeJS.ProcessEnv = process.env): ClientIpConfig {
  const fallback = env.NODE_ENV === "production" ? 1 : 0;
  const raw = env.BLUEPRINT_TRUST_PROXY_HOPS?.trim();
  let trustProxyHops = fallback;
  let invalidHopsValue: string | undefined;
  if (raw) {
    if (/^\d+$/.test(raw) && Number(raw) <= MAX_TRUSTED_HOPS) {
      trustProxyHops = Number(raw);
    } else {
      invalidHopsValue = raw;
    }
  }
  const trustCfConnectingIp = env.BLUEPRINT_TRUST_CF_CONNECTING_IP?.trim() === "1";
  return { trustProxyHops, trustCfConnectingIp, ...(invalidHopsValue ? { invalidHopsValue } : {}) };
}

/** The value for `app.set("trust proxy", ...)`: a hop count, or false for none. */
export function trustProxySetting(config: ClientIpConfig = resolveClientIpConfig()): number | false {
  return config.trustProxyHops > 0 ? config.trustProxyHops : false;
}

/** `::ffff:203.0.113.7` and `203.0.113.7` are one visitor, not two buckets. */
function normalizeAddress(address: string): string {
  const trimmed = address.trim();
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(trimmed);
  return mapped ? mapped[1] : trimmed;
}

function headerValue(req: Request, name: string): string | undefined {
  const value = req.headers[name];
  return typeof value === "string" ? value : undefined;
}

/**
 * The visitor's address under the configured trust, normalised. Falls back to
 * the socket peer, then "unknown", so a limiter never keys on undefined.
 */
export function clientIp(req: Request, config: ClientIpConfig = resolveClientIpConfig()): string {
  if (config.trustCfConnectingIp && config.trustProxyHops > 0) {
    const cf = headerValue(req, "cf-connecting-ip");
    if (cf && isIP(cf.trim())) return normalizeAddress(cf);
  }
  // After pinClientIp has run, req.ip already holds this same answer.
  const derived = req.ip || req.socket?.remoteAddress;
  return derived ? normalizeAddress(derived) : "unknown";
}

/**
 * Rate-limit key for express-rate-limit. Keeps the library's IPv6 /56
 * grouping, so one IPv6 allocation cannot rotate through addresses for quota.
 */
export function clientIpRateLimitKey(req: Request): string {
  const ip = clientIp(req);
  return isIP(ip) ? ipKeyGenerator(ip) : ip;
}

/**
 * Make `req.ip` itself the resolved address for the rest of the request, so
 * every limiter that uses express-rate-limit's default key, every log line and
 * every route reading `req.ip` agree with clientIp(). A no-op change unless
 * CF-Connecting-IP is enabled or the address needed normalising.
 */
export function pinClientIp(config: ClientIpConfig = resolveClientIpConfig()) {
  return (req: Request, _res: unknown, next: () => void) => {
    const resolved = clientIp(req, config);
    Object.defineProperty(req, "ip", { value: resolved, configurable: true, enumerable: true });
    next();
  };
}

export type ClientIpSample = {
  event: "client_ip_resolution_sample";
  trustProxyHops: number;
  trustCfConnectingIp: boolean;
  resolvedIp: string;
  forwardedForEntries: number;
  resolvedIsLeftmostForwardedFor: boolean;
  cfRayPresent: boolean;
  cfConnectingIpPresent: boolean;
  cfConnectingIpMatchesResolved: boolean | null;
};

/**
 * One structured line describing how a forwarded request was resolved, so the
 * hop count can be checked against reality without logging the whole header
 * chain. Compare `resolvedIp` with your own public address after making one
 * request. If they differ and `cfConnectingIpMatchesResolved` is false while
 * `cfRayPresent` is true, a Cloudflare hop sits in front of the trusted proxy.
 */
export function describeClientIpResolution(
  req: Request,
  config: ClientIpConfig = resolveClientIpConfig(),
): ClientIpSample {
  const resolvedIp = clientIp(req, config);
  const forwarded = (headerValue(req, "x-forwarded-for") || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const cf = headerValue(req, "cf-connecting-ip");
  return {
    event: "client_ip_resolution_sample",
    trustProxyHops: config.trustProxyHops,
    trustCfConnectingIp: config.trustCfConnectingIp,
    resolvedIp,
    forwardedForEntries: forwarded.length,
    resolvedIsLeftmostForwardedFor:
      forwarded.length > 0 && normalizeAddress(forwarded[0]) === resolvedIp,
    cfRayPresent: typeof req.headers["cf-ray"] === "string",
    cfConnectingIpPresent: Boolean(cf),
    cfConnectingIpMatchesResolved: cf ? normalizeAddress(cf) === resolvedIp : null,
  };
}
