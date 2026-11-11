// @vitest-environment node
import express from "express";
import fs from "fs/promises";
import http from "http";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { serveStatic } from "../vite";

const CONFIGURED = {
  IOS_APP_STORE_ID: "6444444444",
  IOS_APP_CLIP_BUNDLE_ID: "Public.BlueprintCapture.Clip",
};
const SHELL = '<!doctype html><html lang="en"><head><title>Blueprint</title></head><body></body></html>';

// The App Clip banner is retired (owner, 2026-11-11): no capture app is in use.
describe("serveStatic never stamps an App Clip banner", () => {
  const servers: http.Server[] = [];
  const roots: string[] = [];

  afterEach(async () => {
    vi.unstubAllEnvs();
    await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
    await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
  });

  async function start() {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-banner-"));
    roots.push(root);
    await fs.writeFile(path.join(root, "index.html"), SHELL, "utf8");
    const app = express();
    serveStatic(app, root);
    const server = http.createServer(app);
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("no address");
    return `http://127.0.0.1:${address.port}`;
  }

  it("serves no tag on /capture-upload/:token even when the old IDs are configured", async () => {
    vi.stubEnv("IOS_APP_STORE_ID", CONFIGURED.IOS_APP_STORE_ID);
    vi.stubEnv("IOS_APP_CLIP_BUNDLE_ID", CONFIGURED.IOS_APP_CLIP_BUNDLE_ID);
    const base = await start();
    expect(await (await fetch(`${base}/capture-upload/tok_abc123`)).text()).not.toContain("apple-itunes-app");
    expect(await (await fetch(`${base}/contact/site-operator`)).text()).not.toContain("apple-itunes-app");
  });

  it("serves no tag when unconfigured", async () => {
    vi.stubEnv("IOS_APP_STORE_ID", "");
    vi.stubEnv("IOS_APP_CLIP_BUNDLE_ID", "");
    const base = await start();
    expect(await (await fetch(`${base}/capture-upload/tok_abc123`)).text()).not.toContain("apple-itunes-app");
  });
});
