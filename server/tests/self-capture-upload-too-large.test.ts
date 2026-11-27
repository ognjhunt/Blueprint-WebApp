// @vitest-environment node
/**
 * Outreach audit D1 (2026-11-27): a video over the upload limit. multer's size error carries no status, so the app's
 * own handler answered 500 "Something went wrong on our side" and the site read "We couldn't confirm your video
 * arrived". The route now answers 413 with a sentence the site can act on.
 */
import express from "express";
import multer from "multer";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("../../client/src/lib/firebaseAdmin", async () => ({
  dbAdmin: (await import("./helpers/fake-firestore")).sharedFakeFirestore, default: null, storageAdmin: null, authAdmin: null,
}));
vi.mock("../utils/siteCaptureBundleService", () => ({ describeBundleLink: async () => null }));

const { walkthroughVideoField } = await import("../routes/self-capture-uploads");
const { VIDEO_TOO_LARGE, MAX_CAPTURE_VIDEO_BYTES } = await import("../../client/src/lib/captureVideoLimit");

let server: Server | undefined;
afterEach(async () => {
  if (server) { server.closeAllConnections(); await new Promise<void>(resolve => server!.close(() => resolve())); server = undefined; }
});

async function post(bytes: number) {
  const app = express();
  app.post("/upload", walkthroughVideoField(multer({ storage: multer.memoryStorage(), limits: { fileSize: 1024 } })),
    (_req, res) => { res.json({ ok: true }); });
  // The app's own last handler, as server/index.ts has it: a size error that reached it would read as a 500.
  app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(error.status || 500).json({ message: "Something went wrong on our side. Please try again." });
  });
  server = createServer(app);
  await new Promise<void>(resolve => server!.listen(0, "127.0.0.1", () => resolve()));
  const body = new FormData();
  body.append("video", new Blob([new Uint8Array(bytes)], { type: "video/mp4" }), "clip.mp4");
  const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/upload`, { method: "POST", body });
  return { status: response.status, body: await response.json() };
}

describe("the walkthrough upload's size limit", () => {
  it("over the limit: 413 with the site's sentence, not the generic 500", async () => {
    expect(await post(4096)).toEqual({ status: 413, body: { error: VIDEO_TOO_LARGE, code: "video_too_large" } });
  });
  it("under the limit: the route goes on as before", async () => {
    expect(await post(512)).toEqual({ status: 200, body: { ok: true } });
  });
  it("the route's default limit is the one the form and the job page check (2 GiB)", () => {
    expect(MAX_CAPTURE_VIDEO_BYTES).toBe(2 * 1024 * 1024 * 1024);
  });
});
