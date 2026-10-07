// @vitest-environment node
import express from "express";
import { createServer, type Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ bucketFails: false, authorizationFails: false }));
const logger = vi.hoisted(() => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn() }));
const screen = vi.hoisted(() => vi.fn());
vi.mock("../logger", () => ({ logger }));
vi.mock("../../client/src/lib/firebaseAdmin", async () => ({
  dbAdmin: (await import("./helpers/fake-firestore")).sharedFakeFirestore,
  default: { firestore: { FieldValue: { serverTimestamp: () => "timestamp" } } },
  storageAdmin: { bucket: () => {
    if (state.bucketFails) throw new Error("private fixture bucket initialization failure gs://private-bucket/secret-token");
    return { file: () => ({ getMetadata: async () => { throw Object.assign(new Error("missing"), { code: 404 }); } }) };
  } },
}));
vi.mock("../utils/captureUploadAuthorization", () => ({ authorizeCaptureUpload: async () => {
  if (state.authorizationFails) throw new Error("private fixture authorization failure user@example.invalid");
  return { allowed: true, holdReason: null, detail: null, blockers: [], openQuestions: [] };
} }));
vi.mock("../utils/capturePrivacyScreen", () => ({ screenCaptureForPrivacy: screen }));
vi.mock("../utils/siteCaptureBundleService", () => ({ describeBundleLink: async () => null }));

import router from "../routes/self-capture-uploads";
import { createCaptureUploadToken } from "../utils/captureUploadToken";
import { sharedFakeFirestoreState } from "./helpers/fake-firestore";

let server: Server | undefined;
beforeEach(() => {
  state.bucketFails = false; state.authorizationFails = false;
  sharedFakeFirestoreState.docs.clear(); vi.clearAllMocks();
});
afterEach(async () => {
  if (server) { server.closeAllConnections(); await new Promise<void>(resolve => server!.close(() => resolve())); server = undefined; }
});
const token = () => createCaptureUploadToken({ requestId: "fixture-request", sceneId: "fixture-scene", captureId: "fixture-capture" });

function handler(path: string) {
  return (router as any).stack.find((layer: any) => layer.route?.path === path && layer.route.methods.get).route.stack[0].handle;
}
function responseRecorder() {
  const response = { statusCode: 200, body: undefined as any, headers: new Map<string, string>(),
    setHeader(name: string, value: string) { this.headers.set(name.toLowerCase(), value); },
    status(code: number) { this.statusCode = code; return this; },
    json(body: unknown) { this.body = body; return this; },
  };
  return response;
}

describe("capture status dependency failures", () => {
  it.each(["/:token/status", "/:token"])("contains a storage initialization rejection on %s", async path => {
    state.bucketFails = true;
    const response = responseRecorder();
    // Invoke the actual registered Express callback. Before the repair this
    // returned a rejected promise without writing any response; Express 4 does
    // not attach a rejection handler to that promise.
    await expect(handler(path)({ params: { token: token() } }, response)).resolves.toBe(response);
    expect(response.statusCode).toBe(503);
    expect(response.body).toMatchObject({ code: "capture_status_unavailable", retryAllowed: true, processingRetryAvailable: false });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(JSON.stringify(response.body)).not.toMatch(/private-bucket|secret-token|gs:\/\/|captureId|captureReceived/);
    expect(screen).not.toHaveBeenCalled();
  });

  it.each(["authorization", "storage"])("responds over HTTP when %s unexpectedly rejects", async source => {
    state.authorizationFails = source === "authorization";
    state.bucketFails = source === "storage";
    const app = express(); app.use("/api/self-capture/uploads", router);
    server = createServer(app);
    await new Promise<void>((resolve, reject) => { server!.once("error", reject); server!.listen(0, "127.0.0.1", resolve); });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("fixture server address unavailable");
    const response = await fetch(`http://127.0.0.1:${address.port}/api/self-capture/uploads/${token()}/status`, { signal: AbortSignal.timeout(1500) });
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json();
    expect(body).toMatchObject({ code: "capture_status_unavailable", retryAllowed: true, processingRetryAvailable: false });
    expect(JSON.stringify(body)).not.toMatch(/user@example|private fixture|fixture-request|captureReceived|private-bucket|secret-token/);
    expect(JSON.stringify(logger.warn.mock.calls)).not.toMatch(/user@example|private fixture|fixture-request|private-bucket|secret-token/);
    expect(sharedFakeFirestoreState.docs.size).toBe(0);
    expect(screen).not.toHaveBeenCalled();
  });

  it("keeps malformed links invalid without revealing dependency state", async () => {
    state.bucketFails = true;
    const response = responseRecorder();
    await handler("/:token/status")({ params: { token: "invalid" } }, response);
    expect(response.statusCode).toBe(404);
    expect(response.body).toEqual({ error: "This upload link is not valid or has expired." });
  });
});
