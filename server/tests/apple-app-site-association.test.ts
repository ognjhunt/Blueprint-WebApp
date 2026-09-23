// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";

import {
  appleAssociationConfig,
  createAppleAssociationRouter,
} from "../routes/apple-app-site-association";

const CONFIGURED = {
  APPLE_TEAM_ID: "TEAM123456",
  IOS_APP_BUNDLE_ID: "Public.BlueprintCapture",
  IOS_APP_CLIP_BUNDLE_ID: "Public.BlueprintCapture.Clip",
};

let server: Server | null = null;

async function serve(env: Record<string, string | undefined>) {
  const app = express();
  app.use(createAppleAssociationRouter(env));
  server = createServer(app);
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no address");
  return `http://127.0.0.1:${address.port}`;
}

afterEach(async () => {
  if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
  server = null;
});

describe("apple-app-site-association", () => {
  it("serves 200 JSON naming the App Clip and the capture-link path on both paths", async () => {
    const base = await serve(CONFIGURED);
    for (const path of ["/.well-known/apple-app-site-association", "/apple-app-site-association"]) {
      const response = await fetch(`${base}${path}`, { redirect: "manual" });
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toMatch(/^application\/json/);
      const body = await response.json();
      expect(body.appclips.apps).toEqual(["TEAM123456.Public.BlueprintCapture.Clip"]);
      expect(body.applinks.details).toEqual([
        {
          appID: "TEAM123456.Public.BlueprintCapture",
          paths: ["/go", "/go/*", "/capture-upload/*"],
        },
      ]);
    }
    const head = await fetch(`${base}/.well-known/apple-app-site-association`, { method: "HEAD" });
    expect(head.status).toBe(200);
  });

  it("appends extra invocation paths without dropping the capture link", () => {
    const config = appleAssociationConfig({
      ...CONFIGURED,
      APP_CLIP_ADDITIONAL_PATHS: "extra/*, /capture-upload/*",
    });
    expect(config.invocationPaths).toEqual(["/go", "/go/*", "/capture-upload/*", "/extra/*"]);
  });

  it("answers 503 when the identifiers are not configured", async () => {
    const base = await serve({});
    const response = await fetch(`${base}/.well-known/apple-app-site-association`);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "App Clip association not configured on server" });
    const head = await fetch(`${base}/.well-known/apple-app-site-association`, { method: "HEAD" });
    expect(head.status).toBe(503);
    expect(appleAssociationConfig({ ...CONFIGURED, IOS_APP_CLIP_BUNDLE_ID: undefined }).missingFields)
      .toEqual(["IOS_APP_CLIP_BUNDLE_ID"]);
  });

  it("answers 204 rather than a guessed identifier when a value is a placeholder", async () => {
    const base = await serve({ ...CONFIGURED, APPLE_TEAM_ID: "YOUR_TEAM_ID" });
    const response = await fetch(`${base}/.well-known/apple-app-site-association`);
    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    const head = await fetch(`${base}/apple-app-site-association`, { method: "HEAD" });
    expect(head.status).toBe(204);
    expect(appleAssociationConfig({ ...CONFIGURED, IOS_APP_CLIP_BUNDLE_ID: "REPLACE_ME" }).payload).toBeNull();
  });
});
