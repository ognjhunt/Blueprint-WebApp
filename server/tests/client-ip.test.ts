// @vitest-environment node
import type { AddressInfo } from "node:net";
import express, { type Request } from "express";
import rateLimit from "express-rate-limit";
import { afterEach, describe, expect, it } from "vitest";
import {
  clientIp,
  clientIpRateLimitKey,
  describeClientIpResolution,
  pinClientIp,
  resolveClientIpConfig,
  trustProxySetting,
  type ClientIpConfig,
} from "../utils/clientIp";

/** A request run through Express's real req.ip getter with a synthetic socket. */
function request(
  hops: number,
  remoteAddress: string | undefined,
  headers: Record<string, string> = {},
): Request {
  const app = express();
  app.set("trust proxy", trustProxySetting({ trustProxyHops: hops, trustCfConnectingIp: false }));
  return Object.assign(Object.create(express.request), {
    app,
    socket: { remoteAddress },
    headers,
  }) as Request;
}

const cfg = (trustProxyHops: number, trustCfConnectingIp = false): ClientIpConfig => ({
  trustProxyHops,
  trustCfConnectingIp,
});

describe("resolveClientIpConfig", () => {
  it("defaults to one trusted hop in production and none elsewhere", () => {
    expect(resolveClientIpConfig({ NODE_ENV: "production" })).toEqual(cfg(1));
    expect(resolveClientIpConfig({ NODE_ENV: "development" })).toEqual(cfg(0));
    expect(resolveClientIpConfig({})).toEqual(cfg(0));
  });

  it("takes an explicit hop count from BLUEPRINT_TRUST_PROXY_HOPS", () => {
    expect(resolveClientIpConfig({ NODE_ENV: "production", BLUEPRINT_TRUST_PROXY_HOPS: "2" })).toEqual(cfg(2));
    expect(resolveClientIpConfig({ NODE_ENV: "production", BLUEPRINT_TRUST_PROXY_HOPS: "0" })).toEqual(cfg(0));
  });

  it.each(["abc", "-1", "1.5", "true", "9"])("keeps the default and reports an unusable value %s", (value) => {
    expect(resolveClientIpConfig({ NODE_ENV: "production", BLUEPRINT_TRUST_PROXY_HOPS: value })).toEqual({
      ...cfg(1),
      invalidHopsValue: value,
    });
  });

  it("honours CF-Connecting-IP only when explicitly set to 1", () => {
    expect(resolveClientIpConfig({ NODE_ENV: "production", BLUEPRINT_TRUST_CF_CONNECTING_IP: "1" }).trustCfConnectingIp).toBe(true);
    expect(resolveClientIpConfig({ NODE_ENV: "production", BLUEPRINT_TRUST_CF_CONNECTING_IP: "true" }).trustCfConnectingIp).toBe(false);
  });

  it("maps zero hops to Express's 'trust nothing'", () => {
    expect(trustProxySetting(cfg(0))).toBe(false);
    expect(trustProxySetting(cfg(2))).toBe(2);
  });
});

describe("clientIp", () => {
  it("takes the address the single trusted proxy saw, not a forged farther entry", () => {
    const req = request(1, "10.1.2.3", { "x-forwarded-for": "203.0.113.99, 198.51.100.7" });
    expect(clientIp(req, cfg(1))).toBe("198.51.100.7");
  });

  it("walks two hops when Cloudflare sits in front of Render", () => {
    // visitor -> Cloudflare edge (172.70.x) -> Render proxy -> app
    const req = request(2, "10.1.2.3", { "x-forwarded-for": "198.51.100.7, 172.70.1.1" });
    expect(clientIp(req, cfg(2))).toBe("198.51.100.7");
    // With only one hop trusted, the same chain resolves to the Cloudflare edge:
    // the failure the hop setting exists to prevent.
    expect(clientIp(request(1, "10.1.2.3", { "x-forwarded-for": "198.51.100.7, 172.70.1.1" }), cfg(1))).toBe("172.70.1.1");
  });

  it("ignores X-Forwarded-For entirely when no proxy is trusted", () => {
    const req = request(0, "198.51.100.7", { "x-forwarded-for": "203.0.113.99" });
    expect(clientIp(req, cfg(0))).toBe("198.51.100.7");
  });

  it("reads CF-Connecting-IP only when opted in, behind a trusted proxy, and only if it is an address", () => {
    const headers = { "x-forwarded-for": "172.70.1.1", "cf-connecting-ip": "198.51.100.7" };
    expect(clientIp(request(1, "10.1.2.3", headers), cfg(1, true))).toBe("198.51.100.7");
    expect(clientIp(request(1, "10.1.2.3", headers), cfg(1, false))).toBe("172.70.1.1");
    expect(clientIp(request(0, "198.51.100.9", headers), cfg(0, true))).toBe("198.51.100.9");
    const forged = { "x-forwarded-for": "172.70.1.1", "cf-connecting-ip": "not-an-ip, 1.2.3.4" };
    expect(clientIp(request(1, "10.1.2.3", forged), cfg(1, true))).toBe("172.70.1.1");
  });

  it("treats IPv4-mapped and plain IPv4 as the same visitor", () => {
    expect(clientIp(request(0, "::ffff:198.51.100.7"), cfg(0))).toBe("198.51.100.7");
  });

  it("never returns undefined", () => {
    expect(clientIp(request(0, undefined), cfg(0))).toBe("unknown");
  });
});

describe("clientIpRateLimitKey", () => {
  afterEach(() => {
    delete process.env.BLUEPRINT_TRUST_PROXY_HOPS;
  });

  it("keys IPv4 by address and groups IPv6 by its /56 allocation", () => {
    expect(clientIpRateLimitKey(request(0, "198.51.100.7"))).toBe("198.51.100.7");
    const a = clientIpRateLimitKey(request(0, "2001:4860:1234:5600::1"));
    const b = clientIpRateLimitKey(request(0, "2001:4860:1234:56ff::2"));
    expect(a).toBe(b);
    expect(a).toContain("/56");
  });
});

describe("pinClientIp + a default-keyed limiter (real Express server)", () => {
  async function serve(config: ClientIpConfig) {
    const app = express();
    app.set("trust proxy", trustProxySetting(config));
    app.use(pinClientIp(config));
    // Default keyGenerator: reads req.ip, exactly like the route-level limiters.
    app.use(rateLimit({ windowMs: 60_000, limit: 1, standardHeaders: false, legacyHeaders: false }));
    app.get("/", (req, res) => res.json({ ip: req.ip }));
    const server = await new Promise<import("node:http").Server>((resolve) => {
      const s = app.listen(0, "127.0.0.1", () => resolve(s));
    });
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
    return { base, close: () => new Promise((r) => server.close(r)) };
  }

  it("gives every limiter the CF-Connecting-IP visitor once opted in", async () => {
    const { base, close } = await serve(cfg(1, true));
    try {
      const first = await fetch(base, { headers: { "x-forwarded-for": "172.70.1.1", "cf-connecting-ip": "198.51.100.7" } });
      expect(await first.json()).toEqual({ ip: "198.51.100.7" });
      // Same visitor through a different Cloudflare edge: same bucket.
      const again = await fetch(base, { headers: { "x-forwarded-for": "172.70.9.9", "cf-connecting-ip": "198.51.100.7" } });
      expect(again.status).toBe(429);
      // A different visitor through the same edge: their own bucket.
      const other = await fetch(base, { headers: { "x-forwarded-for": "172.70.1.1", "cf-connecting-ip": "198.51.100.8" } });
      expect(other.status).toBe(200);
    } finally {
      await close();
    }
  });

  it("does not let a forged leftmost X-Forwarded-For entry mint a fresh quota", async () => {
    const { base, close } = await serve(cfg(1));
    try {
      expect((await fetch(base, { headers: { "x-forwarded-for": "203.0.113.1, 198.51.100.7" } })).status).toBe(200);
      expect((await fetch(base, { headers: { "x-forwarded-for": "203.0.113.2, 198.51.100.7" } })).status).toBe(429);
    } finally {
      await close();
    }
  });
});

describe("describeClientIpResolution", () => {
  it("summarises the chain without logging it", () => {
    const req = request(1, "10.1.2.3", {
      "x-forwarded-for": "198.51.100.7, 172.70.1.1",
      "cf-connecting-ip": "198.51.100.7",
      "cf-ray": "abc-IAD",
    });
    expect(describeClientIpResolution(req, cfg(1))).toEqual({
      event: "client_ip_resolution_sample",
      trustProxyHops: 1,
      trustCfConnectingIp: false,
      resolvedIp: "172.70.1.1",
      forwardedForEntries: 2,
      resolvedIsLeftmostForwardedFor: false,
      cfRayPresent: true,
      cfConnectingIpPresent: true,
      cfConnectingIpMatchesResolved: false,
    });
  });
});
