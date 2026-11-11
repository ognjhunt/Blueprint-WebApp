// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";

import { createAppleAssociationRouter } from "../routes/apple-app-site-association";

let server: Server | null = null;

async function serve() {
  const app = express();
  app.use(createAppleAssociationRouter());
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

describe("apple-app-site-association (retired 2026-11-11)", () => {
  it("names no app or App Clip on either path, even with the old variables set", async () => {
    process.env.APPLE_TEAM_ID = "TEAM123456";
    process.env.IOS_APP_BUNDLE_ID = "Public.BlueprintCapture";
    process.env.IOS_APP_CLIP_BUNDLE_ID = "Public.BlueprintCapture.Clip";
    try {
      const base = await serve();
      for (const path of ["/.well-known/apple-app-site-association", "/apple-app-site-association"]) {
        const response = await fetch(`${base}${path}`, { redirect: "manual" });
        expect(response.status).toBe(404);
        const body = await response.text();
        expect(body).not.toMatch(/applinks|appclips|BlueprintCapture|capture-upload/);
        expect(JSON.parse(body)).toEqual({ error: "app_association_retired" });
        expect((await fetch(`${base}${path}`, { method: "HEAD" })).status).toBe(404);
      }
    } finally {
      delete process.env.APPLE_TEAM_ID;
      delete process.env.IOS_APP_BUNDLE_ID;
      delete process.env.IOS_APP_CLIP_BUNDLE_ID;
    }
  });
});
