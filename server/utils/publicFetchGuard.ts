/**
 * Fetching a URL that came from outside.
 *
 * Both callers — a site's task-footage link and a robot team's website — hand
 * us a URL that a stranger chose. Without a guard, "go and read this" is an
 * SSRF primitive: a worker with network access reading its own metadata
 * endpoint, an internal service, or a loopback admin port, and returning the
 * contents to a model that will happily summarise them.
 *
 * So the rules are deliberately blunt: public https only, no embedded
 * credentials, no private or link-local address space, a byte ceiling, and a
 * timeout. Anything else is refused with a code the caller can act on rather
 * than a generic failure — "the site shared a viewer page" and "the fetch
 * failed" need different answers.
 *
 * Two strengths live here. `assertPublicHttpsUrl` / `fetchPublicText` check the
 * hostname string only. `fetchPinnedPublicText` resolves the hostname, refuses
 * unless every address is public, and connects to the address it validated, so
 * a DNS answer that changes between the check and the connect (rebinding)
 * cannot reach a private address. Use the pinned fetch whenever the hostname
 * itself came from a stranger.
 */

import { lookup as dnsLookup } from "node:dns/promises";
import type { IncomingMessage } from "node:http";
import { request as httpsRequest } from "node:https";
import { BlockList, isIP } from "node:net";

export class PublicFetchError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Reject anything that is not a plain public https URL.
 *
 * Hostname checks only; this does not resolve DNS, so a hostname that resolves
 * to a private address still gets through. That residual risk is accepted here
 * because the fetch result is never executed and never returned verbatim to a
 * user — it is summarised by a model into a reviewed proposal. A caller that
 * needs stronger isolation should fetch through an egress proxy instead.
 */
export function assertPublicHttpsUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new PublicFetchError("url_invalid", "Not a valid URL");
  }

  if (url.protocol !== "https:") {
    throw new PublicFetchError("url_not_https", "URL must be https");
  }
  if (url.username || url.password) {
    throw new PublicFetchError("url_has_credentials", "URL must not embed credentials");
  }

  const host = url.hostname.toLowerCase();
  const isPrivate =
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".internal") ||
    host === "metadata.google.internal" ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host === "[::1]" ||
    host === "0.0.0.0";
  if (isPrivate) {
    throw new PublicFetchError("url_private_host", "URL must point at a public host");
  }

  return url;
}

/**
 * IPv4 space that is never a public web server: "this network" (incl.
 * 0.0.0.0), RFC 1918, CGNAT, loopback, link-local (incl. the 169.254.169.254
 * metadata endpoint), IETF/benchmark/documentation ranges, the 6to4 relay
 * anycast, and everything from 224/3 up (multicast, reserved, broadcast).
 */
const NON_PUBLIC_V4 = new BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
  ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24],
  ["203.0.113.0", 24], ["224.0.0.0", 3],
] as const) NON_PUBLIC_V4.addSubnet(address, prefix);

/**
 * IPv6 is an allowlist: only global unicast (2000::/3) can be public. That
 * excludes loopback, unspecified, IPv4-mapped/compatible (::ffff:0:0/96),
 * NAT64 (64:ff9b::/96), unique-local fc00::/7 (incl. the fd00:ec2::254
 * metadata endpoint), link-local and multicast without listing them. Inside
 * 2000::/3, Teredo/IETF assignments, 6to4 (which embeds an arbitrary IPv4
 * address) and the documentation ranges are refused.
 */
const GLOBAL_V6 = new BlockList();
GLOBAL_V6.addSubnet("2000::", 3, "ipv6");
const NON_PUBLIC_GLOBAL_V6 = new BlockList();
for (const [address, prefix] of [
  ["2001::", 23], ["2001:db8::", 32], ["2002::", 16], ["3fff::", 20],
] as const) NON_PUBLIC_GLOBAL_V6.addSubnet(address, prefix, "ipv6");

/** True only for an address a public web server could hold. */
export function isPublicAddress(address: string): boolean {
  try {
    const family = isIP(address);
    if (family === 4) return !NON_PUBLIC_V4.check(address, "ipv4");
    if (family === 6) {
      return GLOBAL_V6.check(address, "ipv6") && !NON_PUBLIC_GLOBAL_V6.check(address, "ipv6");
    }
  } catch {
    // A zone-scoped or otherwise unparseable address is not public.
  }
  return false;
}

/** Suffixes that only ever name local, private or special-use hosts. */
const NON_PUBLIC_HOST_SUFFIX =
  /(?:^|\.)(?:localhost|local|localdomain|internal|intranet|lan|home|corp|private|test|invalid|example|onion|home\.arpa|in-addr\.arpa|ip6\.arpa)$/;

/**
 * The stricter URL check for the pinned fetch: https on the default port, no
 * credentials, a dotted DNS name (never an IP literal in any spelling — the URL
 * parser already canonicalises decimal/hex/octal IPv4 forms into dotted quads),
 * and no special-use suffix.
 */
export function assertPinnableHttpsUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new PublicFetchError("url_invalid", "Not a valid URL");
  }
  if (url.protocol !== "https:") {
    throw new PublicFetchError("url_not_https", "URL must be https");
  }
  if (url.username || url.password) {
    throw new PublicFetchError("url_has_credentials", "URL must not embed credentials");
  }
  if (url.port && url.port !== "443") {
    throw new PublicFetchError("url_port_forbidden", "URL must use the default https port");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase();
  if (isIP(host)) {
    throw new PublicFetchError("url_ip_literal", "URL must name a host, not an IP address");
  }
  if (!host.includes(".") || NON_PUBLIC_HOST_SUFFIX.test(host)) {
    throw new PublicFetchError("url_private_host", "URL must point at a public host");
  }
  url.hash = "";
  return url;
}

export type PinnedFetchDeps = {
  lookup: (
    hostname: string,
    options: { all: true; verbatim: true },
  ) => Promise<Array<{ address: string; family: number }>>;
  request: typeof httpsRequest;
};

const defaultPinnedDeps: PinnedFetchDeps = { lookup: dnsLookup, request: httpsRequest };

type PinnedHop = {
  status: number;
  location?: string;
  contentType: string;
  body: Buffer;
  truncated: boolean;
};

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/** Resolve once, validate every answer, and connect only to the validated one. */
async function pinnedHttpsGet(
  url: URL,
  deadline: number,
  limits: { maxBytes: number; accept: string; userAgent: string; contentTypes: RegExp },
  deps: PinnedFetchDeps,
): Promise<PinnedHop> {
  const hostname = url.hostname.replace(/\.$/, "");
  let dnsTimer: ReturnType<typeof setTimeout> | undefined;
  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await Promise.race([
      deps.lookup(hostname, { all: true, verbatim: true }),
      new Promise<never>((_, reject) => {
        dnsTimer = setTimeout(
          () => reject(new PublicFetchError("fetch_timeout", "URL timed out")),
          Math.max(1, deadline - Date.now()),
        );
      }),
    ]);
  } catch (error) {
    if (error instanceof PublicFetchError) throw error;
    throw new PublicFetchError("dns_failed", "Host could not be resolved");
  } finally {
    clearTimeout(dnsTimer);
  }
  if (
    !addresses.length ||
    addresses.length > 16 ||
    addresses.some((item) => !isPublicAddress(item.address) || item.family !== isIP(item.address))
  ) {
    throw new PublicFetchError(
      "dns_private_address",
      "Host must resolve exclusively to public addresses",
    );
  }
  const selected = addresses[0];

  return new Promise<PinnedHop>((resolve, reject) => {
    let settled = false;
    let deadlineTimer: ReturnType<typeof setTimeout> | undefined;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadlineTimer);
      fn();
    };
    const fail = (code: string, message: string) =>
      finish(() => reject(new PublicFetchError(code, message)));

    const req = deps.request(
      url,
      {
        method: "GET",
        // No shared pool: a pooled socket could belong to a different address.
        agent: false,
        servername: hostname,
        headers: {
          Accept: limits.accept,
          "Accept-Encoding": "identity",
          "User-Agent": limits.userAgent,
        },
        // Every connection attempt gets the validated address; DNS is never
        // consulted a second time for this hop.
        lookup: ((_host: string, options: any, callback: any) =>
          options?.all
            ? callback(null, [{ address: selected.address, family: selected.family }])
            : callback(null, selected.address, selected.family)) as any,
      },
      (response: IncomingMessage) => {
        const status = response.statusCode ?? 0;
        const contentType = String(response.headers["content-type"] ?? "").toLowerCase();
        if (REDIRECT_STATUSES.has(status)) {
          const location = response.headers.location;
          finish(() => resolve({ status, location, contentType, body: Buffer.alloc(0), truncated: false }));
          response.destroy();
          return;
        }
        if (status < 200 || status > 299) {
          finish(() => resolve({ status, contentType, body: Buffer.alloc(0), truncated: false }));
          response.destroy();
          return;
        }
        const encoding = response.headers["content-encoding"];
        if (encoding && encoding !== "identity") {
          fail("response_encoded", "URL served an encoded body");
          response.destroy();
          return;
        }
        if (!limits.contentTypes.test(contentType)) {
          fail(
            "not_readable_text",
            `URL served ${contentType.split(";")[0] || "an unknown type"} rather than a readable page`,
          );
          response.destroy();
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        response.on("data", (chunk) => {
          if (settled) return;
          const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          if (size + bytes.length > limits.maxBytes) {
            chunks.push(bytes.subarray(0, limits.maxBytes - size));
            size = limits.maxBytes;
            // Stop reading at the cap; the rest of the body is never buffered.
            finish(() =>
              resolve({ status, contentType, body: Buffer.concat(chunks), truncated: true }),
            );
            response.destroy();
            return;
          }
          size += bytes.length;
          chunks.push(bytes);
        });
        response.on("end", () =>
          finish(() =>
            resolve({ status, contentType, body: Buffer.concat(chunks), truncated: false }),
          ),
        );
        response.on("aborted", () => fail("fetch_incomplete", "URL response ended early"));
        response.on("error", () => fail("fetch_incomplete", "URL response ended early"));
      },
    );
    deadlineTimer = setTimeout(() => {
      fail("fetch_timeout", "URL timed out");
      req.destroy();
    }, Math.max(1, deadline - Date.now()));
    req.on("error", () => fail("fetch_failed", "URL could not be read"));
    req.end();
  });
}

export type PinnedPublicText = {
  requestedUrl: string;
  finalUrl: string;
  redirects: string[];
  status: number;
  contentType: string;
  text: string;
  truncated: boolean;
};

/**
 * Read a stranger-named public page without letting it reach private space.
 *
 * Every hop is re-validated (URL shape, then DNS), pinned to the address it
 * validated, and bounded by one overall deadline. Redirects are followed by
 * hand up to `maxRedirects`; a redirect beyond that, or one with no Location,
 * is refused. Bodies stop at `maxBytes` and come back marked truncated. A
 * non-2xx status is returned rather than thrown, with an empty body, so the
 * caller can say "HTTP 404" instead of "failed".
 */
export async function fetchPinnedPublicText(
  rawUrl: string,
  options: {
    maxBytes?: number;
    timeoutMs?: number;
    maxRedirects?: number;
    accept?: string;
    userAgent?: string;
    contentTypes?: RegExp;
    deps?: PinnedFetchDeps;
  } = {},
): Promise<PinnedPublicText> {
  const maxBytes = options.maxBytes ?? 512 * 1024;
  const maxRedirects = options.maxRedirects ?? 3;
  const deadline = Date.now() + (options.timeoutMs ?? 5_000);
  const deps = options.deps ?? defaultPinnedDeps;
  const limits = {
    maxBytes,
    accept: options.accept ?? "text/html,application/xhtml+xml,text/plain",
    userAgent: options.userAgent ?? "Blueprint-public-page-reader/1",
    contentTypes: options.contentTypes ?? /^(?:text\/html|application\/xhtml\+xml|text\/plain)(?:;|$)/,
  };

  let url = assertPinnableHttpsUrl(rawUrl);
  const requestedUrl = url.href;
  const redirects: string[] = [];
  for (let hop = 0; ; hop++) {
    if (Date.now() >= deadline) throw new PublicFetchError("fetch_timeout", "URL timed out");
    const response = await pinnedHttpsGet(url, deadline, limits, deps);
    if (!REDIRECT_STATUSES.has(response.status)) {
      return {
        requestedUrl,
        finalUrl: url.href,
        redirects,
        status: response.status,
        contentType: response.contentType,
        text: response.body.toString("utf8"),
        truncated: response.truncated,
      };
    }
    if (!response.location || hop >= maxRedirects) {
      throw new PublicFetchError("redirect_limit", "URL redirected too many times");
    }
    let next: string;
    try {
      next = new URL(response.location, url).href;
    } catch {
      throw new PublicFetchError("url_invalid", "URL redirected to an invalid location");
    }
    url = assertPinnableHttpsUrl(next);
    redirects.push(url.href);
  }
}

const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 20_000;

/**
 * Read a public page as text.
 *
 * Truncates rather than refuses when a page is long: a product page's first
 * two megabytes contain the spec table, and failing the whole read because a
 * site ships a large bundle would lose information for no safety gain.
 */
export async function fetchPublicText(
  rawUrl: string,
  options: { maxBytes?: number; timeoutMs?: number; fetcher?: typeof fetch } = {},
): Promise<{ url: string; text: string; truncated: boolean }> {
  const url = assertPublicHttpsUrl(rawUrl);
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const fetcher = options.fetcher ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetcher(url.toString(), {
      redirect: "follow",
      signal: controller.signal,
      headers: { accept: "text/html,text/plain,application/xhtml+xml" },
    });
    if (!response.ok) {
      throw new PublicFetchError("fetch_failed", `URL returned HTTP ${response.status}`);
    }

    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    if (contentType && !/text\/html|text\/plain|xhtml|application\/json/.test(contentType)) {
      throw new PublicFetchError(
        "not_readable_text",
        `URL served ${contentType.split(";")[0]} rather than a readable page`,
      );
    }

    const raw = await response.text();
    const truncated = raw.length > maxBytes;
    return { url: url.toString(), text: truncated ? raw.slice(0, maxBytes) : raw, truncated };
  } catch (error) {
    if (error instanceof PublicFetchError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new PublicFetchError("fetch_timeout", "URL timed out");
    }
    throw new PublicFetchError(
      "fetch_failed",
      error instanceof Error ? error.message : "URL could not be read",
    );
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Strip markup down to the words.
 *
 * Crude on purpose. The model is reading for a spec line, not rendering a page,
 * and a real HTML parser here would be a dependency and an attack surface for
 * no gain in what gets extracted.
 */
export function toReadableText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}
