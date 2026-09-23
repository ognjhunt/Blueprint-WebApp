// @vitest-environment node
import express from "express";
import fs from "fs/promises";
import http from "http";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { appClipBannerContent, stampAppClipBanner } from "../utils/appClipBanner";
import { serveStatic } from "../vite";

const CONFIGURED = {
  IOS_APP_STORE_ID: "6444444444",
  IOS_APP_CLIP_BUNDLE_ID: "Public.BlueprintCapture.Clip",
};
const SHELL = '<!doctype html><html lang="en"><head><title>Blueprint</title></head><body></body></html>';
const TAG =
  '<meta name="apple-itunes-app" content="app-id=6444444444, app-clip-bundle-id=Public.BlueprintCapture.Clip, app-clip-display=card" />';

describe("App Clip Smart App Banner", () => {
  it("is stamped on a capture link when the App Store and App Clip IDs are configured", () => {
    const html = stampAppClipBanner(SHELL, "/capture-upload/tok_abc123", CONFIGURED);
    expect(html).toContain(TAG);
    expect(html.indexOf(TAG)).toBeGreaterThan(html.indexOf("<head>"));
    expect(stampAppClipBanner(SHELL, "/capture-upload/tok_abc123/?x=1", CONFIGURED)).toContain(TAG);
  });

  it("is left off every other route", () => {
    for (const pathname of ["/", "/contact/site-operator", "/capture-upload", "/capture-upload/", "/capture-upload/tok/extra", "/capture-app"]) {
      expect(stampAppClipBanner(SHELL, pathname, CONFIGURED)).toBe(SHELL);
    }
  });

  it("is left off when either ID is missing, a placeholder or malformed", () => {
    const cases = [
      {},
      { IOS_APP_CLIP_BUNDLE_ID: CONFIGURED.IOS_APP_CLIP_BUNDLE_ID },
      { IOS_APP_STORE_ID: CONFIGURED.IOS_APP_STORE_ID },
      { ...CONFIGURED, IOS_APP_STORE_ID: "YOUR_APP_STORE_ID" },
      { ...CONFIGURED, IOS_APP_STORE_ID: "id6444444444" },
      { ...CONFIGURED, IOS_APP_CLIP_BUNDLE_ID: "REPLACE_ME" },
      { ...CONFIGURED, IOS_APP_CLIP_BUNDLE_ID: 'x" onload="' },
    ];
    for (const env of cases) {
      expect(appClipBannerContent(env)).toBeNull();
      expect(stampAppClipBanner(SHELL, "/capture-upload/tok_abc123", env)).toBe(SHELL);
    }
  });

  it("does not add a second tag", () => {
    const once = stampAppClipBanner(SHELL, "/capture-upload/tok", CONFIGURED);
    expect(stampAppClipBanner(once, "/capture-upload/tok", CONFIGURED)).toBe(once);
  });
});

describe("serveStatic stamps the banner on the capture-link shell only", () => {
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

  it("serves the tag on /capture-upload/:token when configured", async () => {
    vi.stubEnv("IOS_APP_STORE_ID", CONFIGURED.IOS_APP_STORE_ID);
    vi.stubEnv("IOS_APP_CLIP_BUNDLE_ID", CONFIGURED.IOS_APP_CLIP_BUNDLE_ID);
    const base = await start();
    expect(await (await fetch(`${base}/capture-upload/tok_abc123`)).text()).toContain(TAG);
    expect(await (await fetch(`${base}/contact/site-operator`)).text()).not.toContain("apple-itunes-app");
  });

  it("serves no tag when unconfigured", async () => {
    vi.stubEnv("IOS_APP_STORE_ID", "");
    vi.stubEnv("IOS_APP_CLIP_BUNDLE_ID", "");
    const base = await start();
    expect(await (await fetch(`${base}/capture-upload/tok_abc123`)).text()).not.toContain("apple-itunes-app");
  });
});
