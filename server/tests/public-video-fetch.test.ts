// @vitest-environment node
import { EventEmitter, once } from "node:events";
import { createServer } from "node:http";
import { PassThrough } from "node:stream";
import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { fetchPublicVideo } from "../agents/adapters/public-video-fetch";
import { openVideo, assertFetchableVideoUrl } from "../agents/adapters/gemini-video";

type Reply = { status?: number; headers?: Record<string, string>; body?: Buffer; pending?: boolean };
const fixture = Buffer.from("owned-local-video-fixture");
function transport(replies: Reply[] = [{}], addresses = [{ address: "8.8.8.8", family: 4 }]) {
  const requests: any[] = [];
  const lookup = vi.fn(async () => addresses);
  const request = vi.fn((url: URL, config: any, callback: any) => {
    const reply = replies[requests.length] ?? replies.at(-1)!;
    const req = new EventEmitter() as any;
    let stream: any;
    req.destroy = vi.fn((error?: Error) => {
      stream?.destroy(error);
      if (error && req.listenerCount("error")) req.emit("error", error);
    });
    req.end = () => queueMicrotask(() => {
      stream = new PassThrough() as any;
      stream.statusCode = reply.status ?? 200;
      stream.headers = reply.headers ?? { "content-type": "video/mp4" };
      callback(stream);
      if (!reply.pending) stream.end(reply.body ?? fixture);
    });
    requests.push({ url, config, req, stream: () => stream });
    return req;
  });
  return { lookup, request, requests };
}
const options = (signal?: AbortSignal) => ({ signal, validateUrl: assertFetchableVideoUrl });
const download = (deps: ReturnType<typeof transport>, signal?: AbortSignal) =>
  fetchPublicVideo("https://video.example.com/clip.mp4?private-signature=fixture", options(signal), deps as any);

describe("public video egress (injected DNS/HTTPS, no external sockets)", () => {
  it("pins the only validated DNS resolution to TLS while preserving hostname and trust defaults", async () => {
    const deps = transport();
    const response = await download(deps);
    expect(Buffer.from(await response.arrayBuffer())).toEqual(fixture);
    expect(deps.lookup).toHaveBeenCalledOnce();
    const { config, url } = deps.requests[0];
    expect(url.hostname).toBe("video.example.com");
    expect(config).toMatchObject({ agent: false, servername: "video.example.com", method: "GET" });
    expect(config).not.toHaveProperty("rejectUnauthorized");
    expect(config).not.toHaveProperty("checkServerIdentity");
    expect(config).not.toHaveProperty("ca");
    expect(config.headers).toEqual({ Accept: "video/*, application/octet-stream", "Accept-Encoding": "identity" });
    const selected = vi.fn(), all = vi.fn();
    config.lookup("video.example.com", {}, selected);
    config.lookup("video.example.com", { all: true }, all);
    expect(selected).toHaveBeenCalledWith(null, "8.8.8.8", 4);
    expect(all).toHaveBeenCalledWith(null, [{ address: "8.8.8.8", family: 4 }]);
    expect(deps.lookup).toHaveBeenCalledOnce();
  });

  it.each(["127.0.0.1", "169.254.169.254", "100.64.0.1", "::1", "fe80::1", "::ffff:127.0.0.1"])(
    "rejects DNS answer %s before a connection", async address => {
      const deps = transport([], [{ address, family: address.includes(":") ? 6 : 4 }]);
      await expect(download(deps)).rejects.toThrow("public addresses");
      expect(deps.request).not.toHaveBeenCalled();
    });
  it("rejects mixed DNS and malformed families without a connection", async () => {
    for (const addresses of [[{ address: "8.8.8.8", family: 4 }, { address: "127.0.0.1", family: 4 }],
      [{ address: "8.8.8.8", family: 6 }], []]) {
      const deps = transport([], addresses);
      await expect(download(deps)).rejects.toThrow("public addresses");
      expect(deps.request).not.toHaveBeenCalled();
    }
  });
  it("preserves IPv6 hostname/SNI semantics and validated address family", async () => {
    const deps = transport([{}], [{ address: "2606:4700:4700::1111", family: 6 }]);
    const response = await fetchPublicVideo("https://[2606:4700:4700::1111]/clip.mp4", options(), deps as any);
    await response.arrayBuffer();
    expect(deps.lookup).toHaveBeenCalledWith("2606:4700:4700::1111", { all: true, verbatim: true });
    expect(deps.requests[0].config.servername).toBe("");
    const pinned = vi.fn(); deps.requests[0].config.lookup("ignored", {}, pinned);
    expect(pinned).toHaveBeenCalledWith(null, "2606:4700:4700::1111", 6);
  });
  it("validates relative and cross-host public redirects with a separate pinned resolution per hop", async () => {
    const deps = transport([{ status: 302, headers: { location: "/next.mp4" } },
      { status: 307, headers: { location: "https://cdn.example.com/final.mp4" } }, {}]);
    const response = await download(deps);
    expect(Buffer.from(await response.arrayBuffer())).toEqual(fixture);
    expect(deps.requests.map(item => item.url.href)).toEqual([
      "https://video.example.com/clip.mp4?private-signature=fixture", "https://video.example.com/next.mp4", "https://cdn.example.com/final.mp4"]);
    expect(deps.lookup).toHaveBeenCalledTimes(3);
  });
  it.each([false, true])("preserves composed openVideo bytes and receipt after a public redirect (declared length: %s)", async declared => {
    const headers: Record<string, string> = { "content-type": "video/mp4" };
    if (declared) headers["content-length"] = String(fixture.length);
    const deps = transport([{ status: 302, headers: { location: "https://cdn.example.com/clip.mp4" } }, { headers }]);
    const fetcher = ((url: any, init: RequestInit = {}) => fetchPublicVideo(String(url), options(init.signal ?? undefined), deps as any)) as typeof fetch;
    const video = await openVideo("https://video.example.com/clip.mp4", fetcher);
    expect(Buffer.isBuffer(video.body)).toBe(!declared);
    const bytes = Buffer.isBuffer(video.body) ? video.body : Buffer.from(await new Response(video.body).arrayBuffer());
    expect(bytes).toEqual(fixture);
    expect(video.receipt()).toEqual({ bytes: fixture.length, sha256: createHash("sha256").update(fixture).digest("hex") });
    expect(deps.request).toHaveBeenCalledTimes(2);
  });
  it.each(["http://cdn.example.com/video.mp4", "https://u:p@cdn.example.com/video.mp4",
    "https://127.0.0.1/video.mp4", "https://[::1]/video.mp4"])("refuses redirect %s before contact", async location => {
      const deps = transport([{ status: 302, headers: { location } }]);
      await expect(download(deps)).rejects.toThrow();
      expect(deps.request).toHaveBeenCalledOnce(); expect(deps.lookup).toHaveBeenCalledOnce();
    });
  it("rejects a redirect hostname whose DNS turns private before the second request", async () => {
    const deps = transport([{ status: 302, headers: { location: "https://cdn.example.com/video.mp4" } }]);
    deps.lookup.mockResolvedValueOnce([{ address: "8.8.8.8", family: 4 }])
      .mockResolvedValueOnce([{ address: "127.0.0.1", family: 4 }]);
    await expect(download(deps)).rejects.toThrow("public addresses");
    expect(deps.request).toHaveBeenCalledOnce();
  });
  it("permits three public redirects and refuses the fourth without its connection", async () => {
    const good = transport(Array.from({ length: 3 }, () => ({ status: 302, headers: { location: "/next.mp4" } })).concat([{}]));
    await (await download(good)).arrayBuffer(); expect(good.request).toHaveBeenCalledTimes(4);
    const bad = transport([{ status: 302, headers: { location: "/next.mp4" } }]);
    await expect(download(bad)).rejects.toThrow("redirect limit"); expect(bad.request).toHaveBeenCalledTimes(4);
  });
  it("aborts pending DNS without creating a request and sanitizes resolver errors", async () => {
    const deps = transport(); deps.lookup.mockImplementation(() => new Promise(() => {}));
    const controller = new AbortController();
    const result = download(deps, controller.signal); controller.abort();
    await expect(result).rejects.toMatchObject({ name: "AbortError" }); expect(deps.request).not.toHaveBeenCalled();
    const failed = transport(); failed.lookup.mockRejectedValue(new Error("private-signature=fixture"));
    await expect(download(failed)).rejects.toThrow("Task video link could not be fetched");
  });
  it("aborts an in-flight body and destroys only its owned request", async () => {
    const deps = transport([{ pending: true }]); const controller = new AbortController();
    const response = await download(deps, controller.signal);
    const body = response.arrayBuffer(); controller.abort();
    await expect(body).rejects.toMatchObject({ name: "AbortError" });
    expect(deps.requests[0].req.destroy).toHaveBeenCalled();
  });
  it("destroys owned transport when the consumer cancels its body", async () => {
    const deps = transport([{ pending: true }]); const response = await download(deps);
    await response.body!.cancel(); expect(deps.requests[0].req.destroy).toHaveBeenCalled();
  });
  it("sanitizes streamed errors and refuses compressed responses without exposing source text", async () => {
    const deps = transport([{ pending: true }]); const response = await download(deps);
    const read = response.arrayBuffer(); deps.requests[0].stream().destroy(new Error("private-signature=fixture"));
    await expect(read).rejects.toThrow("Task video link could not be fetched");
    const compressed = transport([{ headers: { "content-type": "video/mp4", "content-encoding": "gzip" } }]);
    await expect(download(compressed)).rejects.toThrow("encoding is unsupported");
  });
  it("sanitizes a request-construction error containing a signed source query", async () => {
    const deps = transport();
    deps.request.mockImplementationOnce(() => { throw new Error("private-signature=fixture"); });
    await expect(download(deps)).rejects.toThrow("Task video link could not be fetched");
  });
  it.each([
    { headers: { "content-type": "text/html" }, code: "video_not_directly_readable" },
    { headers: { "content-type": "video/mp4", "content-length": String(64 * 1024 * 1024 + 1) }, code: "video_too_large" },
  ])("stops owned transport after rejecting headers with $code", async ({ headers, code }) => {
    const deps = transport([{ pending: true, headers }]);
    const fetcher = ((url: any, init: RequestInit = {}) => fetchPublicVideo(String(url), options(init.signal ?? undefined), deps as any)) as typeof fetch;
    await expect(openVideo("https://video.example.com/clip.mp4", fetcher)).rejects.toMatchObject({ code });
    expect(deps.requests[0].req.destroy).toHaveBeenCalled();
  });
});

it("blocks the reproduced public redirect before any GET to an actual owned private endpoint", async () => {
  let hits = 0;
  const server = createServer((_req, res) => { hits++; res.end(fixture); });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  try {
    const address = server.address(); if (!address || typeof address === "string") throw new Error("owned_address_missing");
    const deps = transport([{ status: 302, headers: { location: `http://127.0.0.1:${address.port}/synthetic-video.mp4` } }]);
    const fetcher = ((url: any, init: RequestInit = {}) => fetchPublicVideo(String(url), options(init.signal ?? undefined), deps as any)) as typeof fetch;
    await expect(openVideo("https://video.example.com/synthetic-video.mp4", fetcher)).rejects.toMatchObject({ code: "video_url_not_https" });
    console.info("owned-private-redirect-observation", JSON.stringify({ ownedPrivateGets: hits,
      injectedPublicHttpsRequests: deps.request.mock.calls.length, injectedDnsLookups: deps.lookup.mock.calls.length }));
    expect(hits).toBe(0); expect(deps.request).toHaveBeenCalledOnce();
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
