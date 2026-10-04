// @vitest-environment node
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { contactFetchUrl, contactHttpRequest, isPublicContactAddress, readPublicContactPage, CONTACT_PAGE_LIMIT, CONTACT_RESEARCH_PAGE_LIMIT } from "../agents/communications-contact-fetch";

function transport(options: { addresses?: { address: string; family: number }[]; status?: number; headers?: Record<string, string>; body?: string;
  prematureAbort?: boolean; pending?: boolean } = {}) {
  const lookup = vi.fn(async () => options.addresses ?? [{ address: "8.8.8.8", family: 4 }]);
  const request = vi.fn((_url: URL, _config: any, response: any) => {
    const req = new EventEmitter() as any;
    let stream: any;
    req.destroy = (error: Error) => { stream?.destroy(); req.emit("error", error); req.emit("close"); };
    req.end = () => queueMicrotask(() => {
      stream = new PassThrough() as any; stream.statusCode = options.status ?? 200;
      stream.headers = options.headers ?? { "content-type": "text/html" };
      const destroy = stream.destroy.bind(stream);
      // IncomingMessage can emit aborted synchronously when locally destroyed.
      stream.destroy = () => { stream.emit("aborted"); return destroy(); };
      response(stream);
      if (options.prematureAbort) { stream.emit("aborted"); req.emit("close"); return; }
      if (options.pending) return;
      stream.end(options.body ?? "<p>Public page</p>"); req.emit("close");
    });
    return req;
  });
  return { lookup, request };
}
describe("bounded public contact retrieval (offline transport)", () => {
  it.each(["127.0.0.1", "0.0.0.0", "10.1.2.3", "172.16.0.1", "169.254.169.254", "192.168.0.1", "100.64.0.1",
    "192.0.2.1", "198.51.100.1", "203.0.113.1", "224.0.0.1", "255.255.255.255", "::1", "::", "fc00::1", "fe80::1",
    "::ffff:8.8.8.8", "2001:db8::1", "2001::1", "2002::1", "3fff::1"])("rejects reserved/non-public address %s", address => {
    expect(isPublicContactAddress(address)).toBe(false);
  });
  it.each(["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111", "2001:4860:4860::8888"])("permits global address %s", address => {
    expect(isPublicContactAddress(address)).toBe(true);
  });
  it.each(["http://facility.example/contact", "https://u:p@facility.example/contact", "https://facility.example:8443/contact",
    "https://facility.example.attacker.example/contact", "https://127.0.0.1/contact", "https://internal/contact"])("refuses URL %s", url => {
    expect(() => contactFetchUrl(url, "https://facility.example")).toThrow();
  });
  it("pins the checked public address to the TLS request while preserving hostname and omitting auth/cookies", async () => {
    const deps = transport();
    expect(await contactHttpRequest(new URL("https://www.facility.example/contact"), 1000, deps as any)).toMatchObject({ status: 200 });
    expect(deps.lookup).toHaveBeenCalledOnce(); expect(deps.request).toHaveBeenCalledOnce();
    const [url, config] = deps.request.mock.calls[0]; expect(url.hostname).toBe("www.facility.example");
    expect(config).toMatchObject({ agent: false, servername: "www.facility.example", method: "GET" });
    expect(config.headers).not.toHaveProperty("Authorization"); expect(config.headers).not.toHaveProperty("Cookie");
    const callback = vi.fn(); config.lookup("www.facility.example", {}, callback); expect(callback).toHaveBeenCalledWith(null, "8.8.8.8", 4);
    const all = vi.fn(); config.lookup("www.facility.example", { all: true }, all); expect(all).toHaveBeenCalledWith(null, [{ address: "8.8.8.8", family: 4 }]);
    expect(deps.lookup).toHaveBeenCalledOnce();
  });
  it("rejects a mixed public/private DNS result before opening any connection", async () => {
    const deps = transport({ addresses: [{ address: "8.8.8.8", family: 4 }, { address: "127.0.0.1", family: 4 }] });
    await expect(contactHttpRequest(new URL("https://facility.example"), 1000, deps as any)).rejects.toThrow("private_dns"); expect(deps.request).not.toHaveBeenCalled();
  });
  it.each([{ "content-type": "application/pdf" }, { "content-type": "text/html", "content-encoding": "gzip" }])("refuses unsafe response headers %j", async headers => {
    await expect(contactHttpRequest(new URL("https://facility.example"), 1000, transport({ headers }) as any)).rejects.toThrow("response_forbidden");
  });
  it("retries a declared oversized page only within the explicit recovery limit and retains its entire body", async () => {
    const body = "x".repeat(CONTACT_PAGE_LIMIT + 1), deps = transport({ body, headers: { "content-type": "text/plain", "content-length": String(body.length) } });
    await expect(contactHttpRequest(new URL("https://facility.example"), 1000, deps as any)).rejects.toThrow("size_limit");
    const response = await contactHttpRequest(new URL("https://facility.example"), 1000, deps as any, CONTACT_RESEARCH_PAGE_LIMIT);
    expect(response.body.toString()).toBe(body);
    await expect(contactHttpRequest(new URL("https://facility.example"), 1000, deps as any, 10_000_000)).rejects.toThrow("limit_invalid");
  });
  it("retains the streaming size limit when local destruction synchronously aborts the response", async () => {
    await expect(contactHttpRequest(new URL("https://facility.example"), 1000, transport({ body: "x".repeat(CONTACT_PAGE_LIMIT + 1) }) as any)).rejects.toThrow("size_limit");
  });
  it("reports a genuinely premature response abort as incomplete", async () => {
    await expect(contactHttpRequest(new URL("https://facility.example"), 1000,
      transport({ prematureAbort: true }) as any)).rejects.toThrow("contact_fetch_incomplete");
  });
  it("retains the deadline error when request destruction synchronously aborts a pending response", async () => {
    vi.useFakeTimers();
    try {
      const result = contactHttpRequest(new URL("https://facility.example"), 1000, transport({ pending: true }) as any);
      const rejected = expect(result).rejects.toThrow("contact_fetch_timeout");
      await vi.advanceTimersByTimeAsync(1000);
      await rejected;
    } finally { vi.useRealTimers(); }
  });
  it("returns a redirect for explicit same-operator validation, without automatic follow", async () => {
    const deps = transport({ status: 302, headers: { location: "https://attacker.example/contact" } });
    expect(await contactHttpRequest(new URL("https://facility.example"), 1000, deps as any)).toMatchObject({ status: 302, location: "https://attacker.example/contact" });
    expect(deps.request).toHaveBeenCalledOnce(); expect(() => contactFetchUrl("https://attacker.example/contact", "https://facility.example")).toThrow();
  });
  it("validates every redirect and permits the www/apex canonical hop", async () => {
    const http = vi.fn().mockResolvedValueOnce({ status: 302, location: "https://facility.example/contact", body: Buffer.alloc(0), contentType: "" })
      .mockResolvedValueOnce({ status: 200, contentType: "text/html", body: Buffer.from("<p>Public contact</p>") });
    expect(await readPublicContactPage("https://www.facility.example/contact", "https://www.facility.example", Date.now() + 10000, http))
      .toMatchObject({ finalUrl: "https://facility.example/contact", redirects: ["https://facility.example/contact"] });
    expect(http).toHaveBeenCalledTimes(2);
    for (const location of ["https://attacker.example/contact", "http://facility.example/contact", "https://u:p@facility.example/contact"]) {
      const bad = vi.fn().mockResolvedValue({ status: 302, location });
      await expect(readPublicContactPage("https://facility.example/contact", "https://facility.example", Date.now() + 10000, bad)).rejects.toThrow("url_forbidden");
      expect(bad).toHaveBeenCalledOnce();
    }
  });
  it("limits redirects and respects the total retrieval deadline", async () => {
    const http = vi.fn().mockResolvedValue({ status: 302, location: "/contact" });
    await expect(readPublicContactPage("https://facility.example/contact", "https://facility.example", Date.now() + 10000, http)).rejects.toThrow("redirect_limit");
    expect(http).toHaveBeenCalledTimes(3);
    const expired = vi.fn();
    await expect(readPublicContactPage("https://facility.example/contact", "https://facility.example", Date.now() - 1, expired)).rejects.toThrow("deadline");
    expect(expired).not.toHaveBeenCalled();
  });
});
