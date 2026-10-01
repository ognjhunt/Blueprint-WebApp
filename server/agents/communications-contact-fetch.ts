import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { BlockList, isIP } from "node:net";
import { sameOperatorUrl } from "./communications-contact-evidence";

export const CONTACT_PAGE_LIMIT = 128 * 1024;
export type ContactPage = { requestedUrl: string; finalUrl: string; redirects: string[];
  checkedAt: string; status: 200; contentType: string; bodyBase64: string };
export type ContactPageReader = (url: string, organizationUrl: string, deadline: number) => Promise<ContactPage>;
const privateV4 = new BlockList();
for (const [address, prefix] of [["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.168.0.0", 16],
  ["192.88.99.0", 24], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 3]] as const) privateV4.addSubnet(address, prefix);
const globalV6 = new BlockList(); globalV6.addSubnet("2000::", 3, "ipv6");
const privateV6 = new BlockList();
for (const [address, prefix] of [["2001::", 23], ["2001:db8::", 32], ["2002::", 16], ["3fff::", 20]] as const) privateV6.addSubnet(address, prefix, "ipv6");
export function isPublicContactAddress(address: string) {
  return isIP(address) === 4 ? !privateV4.check(address) : isIP(address) === 6
    && globalV6.check(address, "ipv6") && !privateV6.check(address, "ipv6");
}
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
  deps = { lookup, request }): Promise<{ status: number; location?: string; contentType: string; body: Buffer }> {
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
        if (status === 404 || status === 410) { response.destroy(); reject(new Error("contact_fetch_page_unavailable")); return; }
        if (status !== 200 || !/^(?:text\/html|text\/plain)(?:;|$)/.test(contentType)
          || (response.headers["content-encoding"] && response.headers["content-encoding"] !== "identity")
          || Number(response.headers["content-length"] ?? 0) > CONTACT_PAGE_LIMIT) {
          response.destroy(); reject(new Error("contact_fetch_response_forbidden")); return;
        }
        const chunks: Buffer[] = []; let size = 0;
        response.on("data", chunk => {
          const bytes = Buffer.from(chunk); size += bytes.length;
          if (size > CONTACT_PAGE_LIMIT) { response.destroy(); reject(new Error("contact_fetch_size_limit")); }
          else chunks.push(bytes);
        });
        response.on("error", reject);
        response.on("aborted", () => reject(new Error("contact_fetch_incomplete")));
        response.on("end", () => resolve({ status, contentType, body: Buffer.concat(chunks) }));
      });
      const deadlineTimer = setTimeout(() => req.destroy(new Error("contact_fetch_timeout")), Math.max(1, deadline - Date.now()));
      req.on("error", reject); req.on("close", () => clearTimeout(deadlineTimer)); req.end();
    });
  } finally { clearTimeout(timer); }
}

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
