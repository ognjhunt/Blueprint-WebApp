// @vitest-environment node
import { createServer, type Server } from "node:http";
import { generateKeyPairSync } from "node:crypto";
import { EventEmitter } from "node:events";
import type { Response } from "express";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withWebsiteOwnerDeps } from "../utils/websiteCaptureOwnerTransport";

const key = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey.export({
  type: "pkcs8", format: "pem",
}).toString();
const serviceAccount = { type: "service_account", project_id: "test-project",
  client_email: "test@test-project.iam.gserviceaccount.com", private_key: key };
let server: Server;
let origin: string;
let mode: "token" | "firestore" | "firestore-extra" | "media" | "media-short" | "oversize" = "token";
const counts = { token: 0, firestore: 0, media: 0 };
const closed: string[] = [];
let disconnectOnMedia: EventEmitter | null = null;

beforeAll(async () => {
  server = createServer((req, res) => {
    const path = req.url ?? "";
    req.socket.once("close", () => closed.push(path));
    if (path.startsWith("/token")) {
      counts.token++;
      if (mode === "token") return;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ access_token: "local-token", token_type: "Bearer", expires_in: 3600 }));
    } else if (path.startsWith("/v1/projects")) {
      counts.firestore++;
      if (mode === "firestore") return;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ name: "projects/test-project/databases/(default)/documents/inboundRequests/r1",
        updateTime: "2026-09-29T00:00:00.123456789Z", fields: {
          account_owner_uid: { stringValue: "uid-owner" },
          claimed_at_iso: { nullValue: "NULL_VALUE" },
          request: { mapValue: { fields: { buyerType: { stringValue: "site_operator" },
            capture_mode: { stringValue: "self_capture" }, consent_attestation: { mapValue: { fields: {
              granted: { booleanValue: true }, statement_version: { stringValue: "2026-09-18.v1" },
              recorded_at_iso: { stringValue: "2026-09-29T00:00:00.000Z" },
              ...(mode === "firestore-extra" ? { private_email: { stringValue: "must-not-enter" } } : {}),
            } } } } } },
        } }));
    } else if (path.startsWith("/download/storage/v1")) {
      counts.media++;
      res.setHeader("content-type", "application/json");
      if (mode === "oversize") { res.setHeader("content-length", "100"); res.end("x".repeat(100)); return; }
      if (mode === "media-short") { res.end("{}"); return; }
      res.write("{");
      if (disconnectOnMedia) setTimeout(() => disconnectOnMedia?.emit("close"), 10);
      if (mode !== "media") res.end("}");
    } else if (path.startsWith("/storage/v1")) {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ name: "scenes/site-r1/captures/walkthrough-r1/raw/capture_upload_complete.json",
        generation: "123", size: mode === "media-short" ? "3" : "2", crc32c: "AAAAAA==", metageneration: "1" }));
    } else res.writeHead(404).end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no_port");
  origin = `http://127.0.0.1:${address.port}`;
});
afterAll(async () => { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); });

const options = () => ({ serviceAccount, bucket: "test-bucket", projectId: "test-project",
  tokenUrl: `${origin}/token`, firestoreOrigin: origin, storageOrigin: origin });

describe("one terminal owner-read network deadline", () => {
  it("reads only masked Firestore fields and preserves nanosecond updateTime", async () => {
    mode = "media";
    const result = await withWebsiteOwnerDeps(2000, deps => deps.readRequest("r1"), options());
    expect(result?.updateTime).toEqual({ seconds: 1790640000, nanoseconds: 123456789 });
    expect(result?.data.account_owner_uid).toBe("uid-owner");
    expect(result?.data.claimed_at_iso).toBeNull();
    expect(JSON.stringify(result)).not.toMatch(/email|contact/);
  });
  it("rejects an unexpected nested Firestore field even inside an allowed map", async () => {
    mode = "firestore-extra";
    await expect(withWebsiteOwnerDeps(2000, deps => deps.readRequest("r1"), options())).rejects.toThrow();
  });
  it("aborts a stalled token exchange once, closing its socket", async () => {
    mode = "token"; counts.token = 0; closed.length = 0;
    await expect(withWebsiteOwnerDeps(100, async () => null, options())).rejects.toThrow();
    expect(counts.token).toBe(1);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(closed.some((path) => path.startsWith("/token"))).toBe(true);
  });
  it("aborts a stalled Firestore header read under the same clock", async () => {
    mode = "firestore"; counts.firestore = 0; closed.length = 0;
    await expect(withWebsiteOwnerDeps(120, deps => deps.readRequest("r1"), options())).rejects.toThrow();
    expect(counts.firestore).toBe(1);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(closed.some((path) => path.startsWith("/v1/projects"))).toBe(true);
  });
  it("aborts a stalled media body without replaying the read", async () => {
    mode = "media"; counts.media = 0; closed.length = 0;
    const reason = await withWebsiteOwnerDeps(120, deps => deps.readPinned(
      "scenes/site-r1/captures/walkthrough-r1/raw/capture_upload_complete.json", "123", 64), options())
      .then(() => "unexpected_success", (error: Error) => error.message);
    expect(counts.media, reason).toBe(1);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(closed.some((path) => path.startsWith("/download/storage/v1"))).toBe(true);
  });
  it("aborts a stalled media body on caller disconnect and caps announced size", async () => {
    mode = "media"; closed.length = 0;
    const disconnected = Object.assign(new EventEmitter(), { writableEnded: false }) as unknown as Response;
    disconnectOnMedia = disconnected;
    try {
      await expect(withWebsiteOwnerDeps(2000, deps => deps.readPinned(
        "scenes/site-r1/captures/walkthrough-r1/raw/capture_upload_complete.json", "123", 64),
      { ...options(), disconnect: disconnected })).rejects.toThrow();
    } finally { disconnectOnMedia = null; }
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(closed.some((path) => path.startsWith("/download/storage/v1"))).toBe(true);
    mode = "oversize";
    const reason = await withWebsiteOwnerDeps(2000, deps => deps.readPinned(
      "scenes/site-r1/captures/walkthrough-r1/raw/capture_upload_complete.json", "123", 64), options())
      .then(() => "unexpected_success", (error: Error) => error.message);
    expect(reason).toMatch(/size|oversize/i);
  });
  it("rejects a completed pinned body shorter than its exact metadata size", async () => {
    mode = "media-short";
    await expect(withWebsiteOwnerDeps(2000, deps => deps.readPinned(
      "scenes/site-r1/captures/walkthrough-r1/raw/capture_upload_complete.json", "123", 64),
    options())).rejects.toThrow("capture_owner_pinned_size_invalid");
  });
});
