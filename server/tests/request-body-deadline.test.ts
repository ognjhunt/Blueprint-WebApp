import express from "express";
import http, { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";

import { createRequestBodyDeadline, requestBodyTimeoutMs } from "../utils/requestBodyDeadline";

const limits = { defaultMs: 150, uploadMs: 2_000 };
let close: (() => void) | undefined;
afterEach(() => close?.());

async function start() {
  const app = express();
  app.use(createRequestBodyDeadline(limits));
  app.post(/.*/, (req, res) => {
    let bytes = 0;
    req.on("data", chunk => { bytes += chunk.length; });
    req.on("end", () => res.json({ bytes }));
  });
  const server = createServer(app);
  server.requestTimeout = 0;
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  close = () => server.close();
  return (server.address() as AddressInfo).port;
}

/** A POST whose body arrives in two halves, `gapMs` apart. */
function slowPost(port: number, path: string, gapMs: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = http.request({ port, host: "127.0.0.1", path, method: "POST", headers: { "Content-Length": "8" } }, res => {
      res.resume();
      resolve(res.statusCode ?? 0);
    });
    req.on("error", reject);
    req.write("abcd");
    setTimeout(() => { if (!req.destroyed) req.end("efgh"); }, gapMs);
  });
}

describe("per-route request body deadline", () => {
  it("keeps the 300 s default everywhere and gives only the whole-video upload an hour", () => {
    expect(requestBodyTimeoutMs("POST", "/api/self-capture/uploads/tok")).toBe(60 * 60_000);
    expect(requestBodyTimeoutMs("POST", "/api/self-capture/uploads/tok/parts/complete")).toBe(300_000);
    expect(requestBodyTimeoutMs("PUT", "/api/self-capture/uploads/tok")).toBe(300_000);
    expect(requestBodyTimeoutMs("POST", "/api/inbound-request")).toBe(300_000);
  });

  it("answers 408 to a slow body on an ordinary route", async () => {
    const port = await start();
    expect(await slowPost(port, "/api/inbound-request", 600)).toBe(408);
  });

  it("still closes a trickling body after the route answered early", async () => {
    const app = express();
    app.use(createRequestBodyDeadline(limits));
    app.post(/.*/, (_req, res) => { res.status(404).json({ error: "not found" }); });
    const server = createServer(app);
    server.requestTimeout = 0;
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    close = () => server.close();
    const port = (server.address() as AddressInfo).port;
    const started = Date.now();
    const closedAfterMs = await new Promise<number>((resolve) => {
      const req = http.request({ port, host: "127.0.0.1", path: "/api/inbound-request", method: "POST", headers: { "Content-Length": "1000" } }, res => res.resume());
      req.on("error", () => {});
      req.on("socket", socket => socket.once("close", () => resolve(Date.now() - started)));
      req.write("a");
      const trickle = setInterval(() => { if (!req.destroyed) req.write("a"); else clearInterval(trickle); }, 20);
      setTimeout(() => { clearInterval(trickle); req.destroy(); }, 1_500);
    });
    expect(closedAfterMs).toBeLessThan(1_000);
  });

  it("lets a slow whole-video upload finish past the ordinary limit", async () => {
    const port = await start();
    expect(await slowPost(port, "/api/self-capture/uploads/tok", 600)).toBe(200);
  });
});
