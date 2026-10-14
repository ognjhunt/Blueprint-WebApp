// @vitest-environment node
import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertPinnableHttpsUrl,
  fetchPinnedPublicText,
  isPublicAddress,
  PublicFetchError,
} from "../utils/publicFetchGuard";

type Answer = { address: string; family: number };
type Reply = {
  status?: number;
  headers?: Record<string, string>;
  chunks?: Buffer[];
  pending?: boolean;
};

/**
 * Offline transport: `lookup` answers per call, `request` answers per call,
 * and nothing touches the network. Each served body is a Readable that counts
 * how many chunks were actually pulled, so the byte cap can be shown to stop
 * reading rather than read-then-slice.
 */
function transport(answers: Answer[][], replies: Reply[]) {
  const lookup = vi.fn(async () => {
    const next = answers.shift();
    if (!next) throw new Error("unexpected lookup");
    return next;
  });
  const served: Array<{ pulled: number; destroyed: boolean }> = [];
  const request = vi.fn((_url: URL, _config: any, onResponse: any) => {
    const reply = replies.shift() ?? {};
    const req = new EventEmitter() as any;
    req.destroy = () => {
      req.emit("close");
    };
    req.end = () =>
      queueMicrotask(() => {
        if (reply.pending) return;
        const stats = { pulled: 0, destroyed: false };
        served.push(stats);
        const chunks = reply.chunks ?? [Buffer.from("<title>ok</title>")];
        let index = 0;
        const body = new Readable({
          read() {
            if (index >= chunks.length) {
              this.push(null);
              return;
            }
            stats.pulled += 1;
            this.push(chunks[index++]);
          },
          destroy(error, callback) {
            stats.destroyed = true;
            callback(error);
          },
        }) as any;
        body.statusCode = reply.status ?? 200;
        body.headers = reply.headers ?? { "content-type": "text/html; charset=utf-8" };
        onResponse(body);
      });
    return req;
  });
  return { deps: { lookup, request } as any, lookup, request, served };
}

const PUBLIC: Answer[] = [{ address: "93.184.216.34", family: 4 }];

afterEach(() => {
  vi.useRealTimers();
});

describe("isPublicAddress", () => {
  it.each([
    ["loopback", "127.0.0.1"],
    ["loopback (top of /8)", "127.255.255.254"],
    ["unspecified", "0.0.0.0"],
    ["this-network", "0.1.2.3"],
    ["RFC 1918 10/8", "10.1.2.3"],
    ["RFC 1918 172.16/12", "172.31.255.1"],
    ["RFC 1918 192.168/16", "192.168.0.1"],
    ["CGNAT", "100.64.0.1"],
    ["CGNAT (top)", "100.127.255.254"],
    ["link-local", "169.254.1.1"],
    ["cloud metadata", "169.254.169.254"],
    ["IETF protocol assignments", "192.0.0.170"],
    ["documentation", "192.0.2.1"],
    ["benchmarking", "198.18.0.1"],
    ["multicast", "224.0.0.1"],
    ["multicast SSDP", "239.255.255.250"],
    ["reserved 240/4", "240.0.0.1"],
    ["broadcast", "255.255.255.255"],
    ["IPv6 loopback", "::1"],
    ["IPv6 unspecified", "::"],
    ["IPv6 link-local", "fe80::1"],
    ["IPv6 link-local with zone", "fe80::1%eth0"],
    ["IPv6 unique-local", "fc00::1"],
    ["AWS IPv6 metadata", "fd00:ec2::254"],
    ["IPv6 multicast", "ff02::1"],
    ["IPv4-mapped loopback", "::ffff:127.0.0.1"],
    ["IPv4-mapped metadata", "::ffff:169.254.169.254"],
    ["IPv4-mapped public (still refused)", "::ffff:8.8.8.8"],
    ["NAT64 embedding loopback", "64:ff9b::7f00:1"],
    ["6to4 embedding loopback", "2002:7f00:1::1"],
    ["Teredo", "2001:0:4136:e378::1"],
    ["IPv6 documentation", "2001:db8::1"],
    ["not an address", "robotco.com"],
  ])("refuses %s (%s)", (_label, address) => {
    expect(isPublicAddress(address)).toBe(false);
  });

  it.each(["8.8.8.8", "93.184.216.34", "1.1.1.1", "2606:4700:4700::1111", "2001:4860:4860::8888"])(
    "permits public address %s",
    (address) => {
      expect(isPublicAddress(address)).toBe(true);
    },
  );
});

describe("assertPinnableHttpsUrl", () => {
  it.each([
    ["plain http", "http://robotco.com", "url_not_https"],
    ["embedded credentials", "https://u:p@robotco.com", "url_has_credentials"],
    ["non-default port", "https://robotco.com:8443", "url_port_forbidden"],
    ["IPv4 literal", "https://127.0.0.1/", "url_ip_literal"],
    ["metadata literal", "https://169.254.169.254/latest/meta-data", "url_ip_literal"],
    ["decimal IPv4 spelling", "https://2130706433/", "url_ip_literal"],
    ["hex IPv4 spelling", "https://0x7f000001/", "url_ip_literal"],
    ["IPv6 literal", "https://[::1]/", "url_ip_literal"],
    ["IPv4-mapped IPv6 literal", "https://[::ffff:127.0.0.1]/", "url_ip_literal"],
    ["localhost", "https://localhost/", "url_private_host"],
    ["localhost with trailing dot", "https://localhost./", "url_private_host"],
    ["localhost subdomain", "https://admin.localhost/", "url_private_host"],
    ["GCP metadata name", "https://metadata.google.internal/", "url_private_host"],
    ["mDNS name", "https://printer.local/", "url_private_host"],
    ["single label", "https://intranet/", "url_private_host"],
  ])("refuses %s", (_label, url, code) => {
    expect(() => assertPinnableHttpsUrl(url)).toThrow(
      expect.objectContaining({ code }) as unknown as Error,
    );
  });

  it("accepts a public https URL on the default port", () => {
    expect(assertPinnableHttpsUrl("https://robotco.com:443/#frag").href).toBe("https://robotco.com/");
  });
});

describe("fetchPinnedPublicText (offline transport)", () => {
  it("connects to the address it validated, without a second DNS lookup", async () => {
    const t = transport([PUBLIC], [{}]);
    const page = await fetchPinnedPublicText("https://robotco.com", { deps: t.deps });
    expect(page).toMatchObject({ status: 200, finalUrl: "https://robotco.com/", text: "<title>ok</title>" });
    expect(t.lookup).toHaveBeenCalledOnce();
    const [url, config] = t.request.mock.calls[0];
    expect(url.hostname).toBe("robotco.com");
    expect(config).toMatchObject({ agent: false, servername: "robotco.com", method: "GET" });
    const single = vi.fn();
    config.lookup("robotco.com", {}, single);
    expect(single).toHaveBeenCalledWith(null, "93.184.216.34", 4);
    const all = vi.fn();
    config.lookup("robotco.com", { all: true }, all);
    expect(all).toHaveBeenCalledWith(null, [{ address: "93.184.216.34", family: 4 }]);
  });

  it("is not fooled by DNS rebinding: a later private answer never reaches the socket", async () => {
    const t = transport([PUBLIC, [{ address: "127.0.0.1", family: 4 }]], [{}]);
    await fetchPinnedPublicText("https://rebind.example.com", { deps: t.deps });
    const [, config] = t.request.mock.calls[0];
    // Simulate the socket layer resolving again, as a rebinding attack relies on.
    const callback = vi.fn();
    config.lookup("rebind.example.com", {}, callback);
    config.lookup("rebind.example.com", { all: true }, callback);
    expect(callback).toHaveBeenNthCalledWith(1, null, "93.184.216.34", 4);
    expect(callback).toHaveBeenNthCalledWith(2, null, [{ address: "93.184.216.34", family: 4 }]);
    // The private second answer was never even requested.
    expect(t.lookup).toHaveBeenCalledOnce();
  });

  it.each([
    ["all private", [{ address: "10.0.0.5", family: 4 }]],
    ["mixed public and private", [...PUBLIC, { address: "169.254.169.254", family: 4 }]],
    ["mixed with IPv6 metadata", [...PUBLIC, { address: "fd00:ec2::254", family: 6 }]],
    ["IPv4-mapped loopback", [{ address: "::ffff:127.0.0.1", family: 6 }]],
    ["family mismatch", [{ address: "93.184.216.34", family: 6 }]],
    ["empty answer", []],
  ])("refuses before connecting when DNS is %s", async (_label, answer) => {
    const t = transport([answer as Answer[]], [{}]);
    await expect(fetchPinnedPublicText("https://robotco.com", { deps: t.deps })).rejects.toMatchObject({
      code: "dns_private_address",
    });
    expect(t.request).not.toHaveBeenCalled();
  });

  it("re-validates DNS on every redirect hop and refuses a hop that resolves private", async () => {
    const t = transport(
      [PUBLIC, [{ address: "192.168.1.1", family: 4 }]],
      [{ status: 302, headers: { location: "https://internal-admin.robotco.com/" } }, {}],
    );
    await expect(fetchPinnedPublicText("https://robotco.com", { deps: t.deps })).rejects.toMatchObject({
      code: "dns_private_address",
    });
    expect(t.lookup).toHaveBeenCalledTimes(2);
    expect(t.lookup.mock.calls[1][0]).toBe("internal-admin.robotco.com");
    expect(t.request).toHaveBeenCalledOnce();
  });

  it.each([
    ["an IP literal", "http://169.254.169.254/latest/meta-data", "url_not_https"],
    ["an https IP literal", "https://169.254.169.254/latest/meta-data", "url_ip_literal"],
    ["localhost", "https://localhost/admin", "url_private_host"],
    ["a non-default port", "https://robotco.com:2375/", "url_port_forbidden"],
  ])("refuses a redirect to %s without connecting again", async (_label, location, code) => {
    const t = transport([PUBLIC], [{ status: 301, headers: { location } }]);
    await expect(fetchPinnedPublicText("https://robotco.com", { deps: t.deps })).rejects.toMatchObject({ code });
    expect(t.request).toHaveBeenCalledOnce();
    expect(t.lookup).toHaveBeenCalledOnce();
  });

  it("follows a bounded number of re-validated redirects", async () => {
    const t = transport(
      [PUBLIC, PUBLIC],
      [{ status: 301, headers: { location: "https://www.robotco.com/" } }, {}],
    );
    const page = await fetchPinnedPublicText("https://robotco.com", { deps: t.deps });
    expect(page).toMatchObject({ finalUrl: "https://www.robotco.com/", redirects: ["https://www.robotco.com/"] });

    const loop = transport(
      [PUBLIC, PUBLIC, PUBLIC, PUBLIC],
      Array.from({ length: 4 }, () => ({ status: 302, headers: { location: "/again" } })),
    );
    await expect(
      fetchPinnedPublicText("https://robotco.com", { deps: loop.deps, maxRedirects: 3 }),
    ).rejects.toMatchObject({ code: "redirect_limit" });
    expect(loop.request).toHaveBeenCalledTimes(4);

    const none = transport([PUBLIC], [{ status: 302, headers: { location: "/x" } }]);
    await expect(
      fetchPinnedPublicText("https://robotco.com", { deps: none.deps, maxRedirects: 0 }),
    ).rejects.toMatchObject({ code: "redirect_limit" });
  });

  it("stops reading at the byte cap instead of buffering the whole body", async () => {
    const chunk = Buffer.alloc(64 * 1024, "a");
    const t = transport([PUBLIC], [{ chunks: Array.from({ length: 64 }, () => chunk) }]); // 4 MiB offered
    const page = await fetchPinnedPublicText("https://robotco.com", { deps: t.deps, maxBytes: 512 * 1024 });
    expect(page.truncated).toBe(true);
    expect(Buffer.byteLength(page.text)).toBe(512 * 1024);
    expect(t.served[0].destroyed).toBe(true);
    // 8 chunks fill the cap and the 9th crosses it; the stream may have read a
    // little ahead, but nowhere near the 64 chunks offered.
    expect(t.served[0].pulled).toBeLessThan(16);
  });

  it("returns a non-2xx status rather than its body", async () => {
    const t = transport([PUBLIC], [{ status: 404, chunks: [Buffer.from("secret")] }]);
    const page = await fetchPinnedPublicText("https://robotco.com", { deps: t.deps });
    expect(page).toMatchObject({ status: 404, text: "" });
  });

  it.each([
    [{ "content-type": "application/octet-stream" }, "not_readable_text"],
    [{ "content-type": "text/html", "content-encoding": "gzip" }, "response_encoded"],
  ])("refuses an unreadable response %j", async (headers, code) => {
    const t = transport([PUBLIC], [{ headers }]);
    await expect(fetchPinnedPublicText("https://robotco.com", { deps: t.deps })).rejects.toMatchObject({ code });
  });

  it("enforces one overall deadline", async () => {
    vi.useFakeTimers();
    const t = transport([PUBLIC], [{ pending: true }]);
    const result = fetchPinnedPublicText("https://robotco.com", { deps: t.deps, timeoutMs: 1000 });
    const rejected = expect(result).rejects.toMatchObject({ code: "fetch_timeout" });
    await vi.advanceTimersByTimeAsync(1000);
    await rejected;
  });

  it("times out a DNS lookup that never answers", async () => {
    vi.useFakeTimers();
    const deps = { lookup: vi.fn(() => new Promise(() => {})), request: vi.fn() } as any;
    const result = fetchPinnedPublicText("https://robotco.com", { deps, timeoutMs: 500 });
    const rejected = expect(result).rejects.toBeInstanceOf(PublicFetchError);
    await vi.advanceTimersByTimeAsync(500);
    await rejected;
    expect(deps.request).not.toHaveBeenCalled();
  });
});
