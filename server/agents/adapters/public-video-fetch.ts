import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { isIP } from "node:net";
import { Readable } from "node:stream";
import { isPublicContactAddress } from "../communications-contact-fetch";

const aborted = () => Object.assign(new Error("Task video request aborted"), { name: "AbortError" });
const failed = () => new Error("Task video link could not be fetched");
type VideoFetchOptions = { signal?: AbortSignal | null; validateUrl: (value: string) => URL };

/** Video-only GET: validate each hop, pin its public DNS result to TLS, and
 * stream its body into openVideo's existing byte/receipt/deadline controls.
 * No caller headers, proxy, shared connection pool or custom TLS trust. */
export async function fetchPublicVideo(value: string, options: VideoFetchOptions,
  deps = { lookup, request }): Promise<Response> {
  const { signal, validateUrl } = options;
  let current = value;
  for (let hop = 0; hop <= 3; hop++) {
    const url = validateUrl(current);
    const hostname = url.hostname.replace(/^\[|\]$/g, "");
    if (signal?.aborted) throw aborted();
    const addresses = await new Promise<{ address: string; family: number }[]>((resolve, reject) => {
      const onAbort = () => reject(aborted());
      signal?.addEventListener("abort", onAbort, { once: true });
      deps.lookup(hostname, { all: true, verbatim: true }).then(resolve, () => reject(failed()))
        .finally(() => signal?.removeEventListener("abort", onAbort));
      if (signal?.aborted) onAbort();
    });
    if (!addresses.length || addresses.length > 16
      || addresses.some(item => !isPublicContactAddress(item.address) || item.family !== isIP(item.address))) {
      throw new Error("Task video host must resolve exclusively to public addresses");
    }
    if (signal?.aborted) throw aborted();
    const selected = addresses[0];
    const response = await new Promise<import("node:http").IncomingMessage>((resolve, reject) => {
      let incoming: import("node:http").IncomingMessage | undefined;
      const cleanup = () => signal?.removeEventListener("abort", onAbort);
      const onAbort = () => {
        const error = aborted();
        incoming?.destroy(error); req.destroy(error); reject(error); cleanup();
      };
      const req = deps.request(url, { method: "GET", agent: false,
        servername: isIP(hostname) ? "" : hostname,
        headers: { Accept: "video/*, application/octet-stream", "Accept-Encoding": "identity" },
        lookup: ((_host: string, config: any, callback: any) => config?.all
          ? callback(null, [{ address: selected.address, family: selected.family }])
          : callback(null, selected.address, selected.family)) as any,
      }, result => {
        incoming = result;
        result.once("close", cleanup);
        // Map transport errors before exposing the stream, without URL/query
        // or provider error text. Abort retains its existing timeout identity.
        // toWeb inherits this small high-water mark, limiting queued chunks
        // without relying on options absent from the repo's older Node types.
        const body = new Readable({ highWaterMark: 1, read() { result.resume(); }, destroy(error, callback) {
          result.destroy(); req.destroy(); cleanup(); callback(error);
        } });
        body.on("error", () => {}); // Also observed by toWeb; safe before its attachment.
        result.on("data", chunk => { if (!body.push(chunk)) result.pause(); });
        result.on("end", () => body.push(null));
        result.on("error", () => body.destroy(signal?.aborted ? aborted() : failed()));
        result.on("aborted", () => body.destroy(signal?.aborted ? aborted() : failed()));
        // Keep this bridge on the response; redirects never expose its body.
        (result as typeof result & { videoBody: Readable }).videoBody = body;
        resolve(result);
      });
      req.once("error", () => { reject(signal?.aborted ? aborted() : failed()); cleanup(); });
      signal?.addEventListener("abort", onAbort, { once: true });
      if (signal?.aborted) onAbort();
      else req.end();
    }).catch(() => { throw signal?.aborted ? aborted() : failed(); });
    const body = (response as typeof response & { videoBody: Readable }).videoBody;
    const status = response.statusCode ?? 0;
    if ([301, 302, 303, 307, 308].includes(status)) {
      const location = response.headers.location;
      body.destroy();
      if (!location || hop === 3) throw new Error("Task video redirect limit exceeded or destination missing");
      try { current = new URL(location, url).href; }
      catch { throw new Error("Task video redirect URL is invalid"); }
      continue;
    }
    const headers = new Headers();
    for (const name of ["content-type", "content-length"]) {
      const header = response.headers[name];
      if (typeof header === "string") headers.set(name, header);
    }
    if (response.headers["content-encoding"] && response.headers["content-encoding"] !== "identity") {
      body.destroy(); throw new Error("Task video response encoding is unsupported");
    }
    if (status < 200 || status > 299 || [204, 205].includes(status)) {
      body.destroy(); return new Response(null, { status, headers });
    }
    return new Response(Readable.toWeb(body) as ReadableStream<Uint8Array>, { status, headers });
  }
  throw failed();
}
