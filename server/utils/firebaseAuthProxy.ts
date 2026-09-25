import type { RequestHandler } from "express";
import https from "node:https";

const projectId = process.env.FIREBASE_PROJECT_ID || "blueprint-8c1ca";
const upstreamOrigin = `https://${projectId}.firebaseapp.com`;
const responseHeaders = new Set([
  "cache-control", "content-encoding", "content-language", "content-length",
  "content-security-policy", "content-type", "etag", "expires", "last-modified",
  "location", "referrer-policy", "set-cookie", "vary", "x-content-type-options",
  "x-frame-options",
]);

/** Keep Firebase's OAuth helper on the app origin for mobile redirect sign-in. */
export const firebaseAuthProxy: RequestHandler = (req, res) => {
  if (!/^[a-z0-9-]+$/.test(projectId) || !["GET", "HEAD", "POST"].includes(req.method)) {
    res.sendStatus(405);
    return;
  }

  const upstreamUrl = new URL(req.originalUrl, upstreamOrigin);
  if (upstreamUrl.origin !== upstreamOrigin || !upstreamUrl.pathname.startsWith("/__/auth/")) {
    res.sendStatus(404);
    return;
  }

  const contentLength = Number(req.headers["content-length"] || 0);
  if (contentLength > 65_536) {
    res.sendStatus(413);
    return;
  }

  const upstream = https.request(upstreamUrl, {
    method: req.method,
    headers: {
      ...(req.headers.accept ? { accept: req.headers.accept } : {}),
      ...(req.headers["content-type"] ? { "content-type": req.headers["content-type"] } : {}),
      ...(req.headers["user-agent"] ? { "user-agent": req.headers["user-agent"] } : {}),
    },
    timeout: 15_000,
  }, (upstreamResponse) => {
    res.statusCode = upstreamResponse.statusCode || 502;
    for (const [name, value] of Object.entries(upstreamResponse.headers)) {
      if (responseHeaders.has(name) && value !== undefined) res.setHeader(name, value);
    }
    upstreamResponse.pipe(res);
  });

  upstream.on("timeout", () => upstream.destroy(new Error("Firebase auth helper timed out")));
  upstream.on("error", () => {
    if (!res.headersSent) res.sendStatus(502);
    else res.end();
  });
  req.on("aborted", () => upstream.destroy());

  if (req.method !== "POST") {
    upstream.end();
    return;
  }

  let received = 0;
  req.on("data", (chunk: Buffer) => {
    received += chunk.length;
    if (received > 65_536) {
      upstream.destroy();
      if (!res.headersSent) res.sendStatus(413);
      return;
    }
    upstream.write(chunk);
  });
  req.on("end", () => upstream.end());
};
