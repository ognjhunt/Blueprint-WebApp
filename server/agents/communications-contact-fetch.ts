import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { isIP } from "node:net";
import { isPublicAddress } from "../utils/publicFetchGuard";
import { sameOperatorUrl } from "./communications-contact-evidence";

export const CONTACT_PAGE_LIMIT = 128 * 1024;
export const CONTACT_RESEARCH_PAGE_LIMIT = 384 * 1024;
export type ContactPage = { requestedUrl: string; finalUrl: string; redirects: string[];
  checkedAt: string; status: 200; contentType: string; bodyBase64: string };
export type ContactPageReader = (url: string, organizationUrl: string, deadline: number,
  options?: { maxBytes: number }) => Promise<ContactPage>;
/** The shared public-address classifier; kept under its original name for
 * existing callers (contact pages and public task video). */
export const isPublicContactAddress = isPublicAddress;
export function contactFetchUrl(value: string, organizationUrl: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || (url.port && url.port !== "443") || isIP(url.hostname.replace(/^\[|\]$/g, ""))
    || !sameOperatorUrl(value, organizationUrl) || !url.hostname.includes(".")
    || /(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(url.hostname)) throw new Error("contact_fetch_url_forbidden");
  url.hash = "";
  return url;
}

/** Validation is pinned to the actual TLS connection; no second DNS resolution,
 * cookies, credentials, auth, environment proxy or automatic redirects. */
export async function contactHttpRequest(url: URL, timeoutMs: number,
  deps = { lookup, request }, maxBytes = CONTACT_PAGE_LIMIT): Promise<{ status: number; location?: string; contentType: string; body: Buffer }> {
  if (![CONTACT_PAGE_LIMIT, CONTACT_RESEARCH_PAGE_LIMIT].includes(maxBytes)) throw new Error("contact_fetch_limit_invalid");
  const deadline = Date.now() + timeoutMs;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const addresses = await Promise.race([deps.lookup(url.hostname, { all: true, verbatim: true }),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("contact_fetch_dns_timeout")), timeoutMs); })]);
    if (!addresses.length || addresses.length > 16 || addresses.some(item => !isPublicContactAddress(item.address))) {
      throw new Error("contact_fetch_private_dns");
    }
    const selected = addresses[0];
    return await new Promise((resolve, reject) => {
      const req = deps.request(url, { method: "GET", agent: false, servername: url.hostname,
        headers: { Accept: "text/html, text/plain", "Accept-Encoding": "identity", "User-Agent": "Blueprint-public-contact-verifier/1" },
        lookup: ((_host: string, options: any, callback: any) => options?.all
          ? callback(null, [{ address: selected.address, family: selected.family }])
          : callback(null, selected.address, selected.family)) as any,
      }, response => {
        const status = response.statusCode ?? 0, contentType = String(response.headers["content-type"] ?? "").toLowerCase();
        if ([301, 302, 303, 307, 308].includes(status)) {
          response.destroy(); resolve({ status, location: response.headers.location, contentType, body: Buffer.alloc(0) }); return;
        }
        if (status === 404 || status === 410) { reject(new Error("contact_fetch_page_unavailable")); response.destroy(); return; }
        if (status !== 200 || !/^(?:text\/html|text\/plain)(?:;|$)/.test(contentType)
          || (response.headers["content-encoding"] && response.headers["content-encoding"] !== "identity")
          ) {
          reject(new Error("contact_fetch_response_forbidden")); response.destroy(); return;
        }
        if (Number(response.headers["content-length"] ?? 0) > maxBytes) {
          reject(new Error("contact_fetch_size_limit")); response.destroy(); return;
        }
        const chunks: Buffer[] = []; let size = 0;
        response.on("data", chunk => {
          const bytes = Buffer.from(chunk); size += bytes.length;
          if (size > maxBytes) { reject(new Error("contact_fetch_size_limit")); response.destroy(); }
          else chunks.push(bytes);
        });
        response.on("error", reject);
        response.on("aborted", () => reject(new Error("contact_fetch_incomplete")));
        response.on("end", () => resolve({ status, contentType, body: Buffer.concat(chunks) }));
      });
      const deadlineTimer = setTimeout(() => {
        const error = new Error("contact_fetch_timeout"); reject(error); req.destroy(error);
      }, Math.max(1, deadline - Date.now()));
      req.on("error", reject); req.on("close", () => clearTimeout(deadlineTimer)); req.end();
    });
  } finally { clearTimeout(timer); }
}

/** Larger complete bodies are allowed only in the bounded contact recovery.
 * Streaming, DNS/TLS pinning and redirect/credential restrictions are unchanged. */
export const readResearchContactPage: ContactPageReader = (value, organizationUrl, deadline, options) =>
  readPublicContactPage(value, organizationUrl, deadline,
    (url, timeout) => contactHttpRequest(url, timeout, undefined, options?.maxBytes ?? CONTACT_PAGE_LIMIT));

export async function readPublicContactPage(value: string, organizationUrl: string, deadline: number,
  httpRequest = contactHttpRequest): Promise<ContactPage> {
  const requestedUrl = contactFetchUrl(value, organizationUrl).href, redirects: string[] = [];
  let url = new URL(requestedUrl);
  for (let attempt = 0; attempt <= 2; attempt++) {
    const remaining = Math.min(8000, deadline - Date.now());
    if (remaining <= 0) throw new Error("contact_fetch_deadline");
    const response = await httpRequest(url, remaining);
    if (response.status === 200) return { requestedUrl, finalUrl: url.href, redirects, checkedAt: new Date().toISOString(),
      status: 200, contentType: response.contentType, bodyBase64: response.body.toString("base64") };
    if (!response.location || attempt === 2) throw new Error("contact_fetch_redirect_limit");
    const next = contactFetchUrl(new URL(response.location, url).href, organizationUrl);
    redirects.push(next.href); url = next;
  }
  throw new Error("contact_fetch_failed");
}
