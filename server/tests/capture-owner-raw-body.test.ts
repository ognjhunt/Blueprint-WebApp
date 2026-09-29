// @vitest-environment node
import { createServer } from "node:http";
import express from "express";
import { describe, expect, it } from "vitest";
import { captureOwnerRawBody, decodeCaptureOwnerFlatJson, isCaptureOwnerPath } from "../utils/captureOwnerRawBody";

const path = "/api/internal/pipeline/creator-captures/walkthrough-r1/capture-owner";
const valid = '{ "request_id":"r1", "scene_id":"site-r1", "completion_marker_generation":"90071992547409931", "remaining_timeout_ms":3000 }';

describe("capture owner exact early body", () => {
  it("preserves the original signed bytes and rejects escaped duplicate keys", () => {
    expect(decodeCaptureOwnerFlatJson(valid)).toEqual({ request_id: "r1", scene_id: "site-r1",
      completion_marker_generation: "90071992547409931", remaining_timeout_ms: 3000 });
    expect(() => decodeCaptureOwnerFlatJson(valid.replace('"scene_id":"site-r1",',
      '"scene_id":"site-r1", "scene\\u005fid":"site-r1",'))).toThrow();
    expect(() => decodeCaptureOwnerFlatJson(valid.replace("3000", "true"))).toThrow();
    expect(() => decodeCaptureOwnerFlatJson(valid.replace("3000", "3e3"))).toThrow();
    expect(() => decodeCaptureOwnerFlatJson(valid.replace("3000", "[3000]"))).toThrow();
    expect(() => decodeCaptureOwnerFlatJson(valid.replace('"scene_id"', '\u00a0"scene_id"'))).toThrow();
  });
  it("matches only the one exact operation", () => {
    expect(isCaptureOwnerPath(path)).toBe(true);
    expect(isCaptureOwnerPath(`${path}/`)).toBe(true);
    expect(isCaptureOwnerPath(`${path}/other`)).toBe(false);
    expect(isCaptureOwnerPath(path.replace("/walkthrough-r1/", "/a/b/"))).toBe(false);
  });
  it("rejects >4KiB before downstream JSON and preserves whitespace for HMAC", async () => {
    const app = express();
    app.use(captureOwnerRawBody);
    app.use(express.json({ limit: "1mb" }));
    app.post(path, (req, res) => res.json({ body: req.body, rawBody: req.rawBody,
      admitted: (req as typeof req & { captureOwnerBodyAdmitted?: boolean }).captureOwnerBodyAdmitted }));
    const server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("no_port");
    const url = `http://127.0.0.1:${addr.port}${path}`;
    try {
      const good = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: valid });
      expect(good.status).toBe(200);
      expect(await good.json()).toMatchObject({ rawBody: valid, admitted: true });
      const large = await fetch(url, { method: "POST", headers: { "content-type": "application/json" },
        body: valid.replace("r1", "x".repeat(5000)) });
      expect(large.status).toBe(413);
      const encoded = await fetch(url, { method: "POST", headers: { "content-type": "application/json",
        "content-encoding": "gzip" }, body: valid });
      expect(encoded.status).toBe(415);
    } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
  });
});
