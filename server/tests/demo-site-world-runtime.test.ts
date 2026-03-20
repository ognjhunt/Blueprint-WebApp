// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { createServer } from "node:http";

const originalFetch = global.fetch;

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  default: {},
  dbAdmin: null,
  storageAdmin: null,
}));

import { getSiteWorldById } from "../../client/src/data/siteWorlds";
import { resolveHostedRuntime } from "../utils/hosted-session-runtime";
import { getPublicSiteWorldById } from "../utils/site-worlds";
import router from "../routes/site-world-sessions";
import express from "express";

vi.mock("../middleware/verifyFirebaseToken", () => ({
  default: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

describe("demo site-world runtime fallback", () => {
  it("resolves hosted runtime with the demo launch override", async () => {
    process.env.BLUEPRINT_HOSTED_DEMO_RUNTIME_BASE_URL = "https://demo-runtime.example.com";
    process.env.BLUEPRINT_HOSTED_DEMO_RUNTIME_WEBSOCKET_BASE_URL = "wss://demo-runtime.example.com";
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "https://demo-runtime.example.com/v1/site-worlds/siteworld-f5fd54898cfb") {
        return new Response(
          JSON.stringify({
            canonical_package_uri:
              "gs://local-blueprint/scenes/9483414B-8776-4F68-AC80-D3B3BA774A90/captures/6F2FD31B-0F9F-43C4-9DF9-885E1A295CF3/pipeline/evaluation_prep/site_world_spec.json",
            canonical_package_version: "demo-runtime-v1",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (String(input) === "https://demo-runtime.example.com/v1/site-worlds/siteworld-f5fd54898cfb/health") {
        return new Response(
          JSON.stringify({
            status: "healthy",
            launchable: true,
            blockers: [],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return originalFetch(input, init);
    }) as typeof global.fetch;

    const runtime = await resolveHostedRuntime("siteworld-f5fd54898cfb");

    expect(runtime.runtimeBaseUrl).toBe("https://demo-runtime.example.com");
    expect(runtime.websocketBaseUrl).toBe("wss://demo-runtime.example.com");
    expect(runtime.allowBlockedSiteWorld).toBe(true);
    expect(runtime.qualificationState).toBe("qualified_ready");
    expect(runtime.deploymentReadiness?.qualification_state).toBe("qualified_ready");
    expect(runtime.resolvedArtifactCanonicalUri).toContain("site_world_spec.json");
    expect(runtime.registeredCanonicalPackageUri).toContain("site_world_spec.json");
    expect(String(runtime.registeredCanonicalPackageVersion || "")).toBe("demo-runtime-v1");
  }, 15000);

  it("exposes the hardcoded site-world in client and server catalogs", async () => {
    const clientRecord = getSiteWorldById("siteworld-f5fd54898cfb");
    expect(clientRecord).not.toBeNull();
    expect(clientRecord?.runtimeManifest.runtimeBaseUrl).toBeNull();
    expect(clientRecord?.hostedSessionOverride?.allowBlockedSiteWorld).toBe(true);

    const serverRecord = await getPublicSiteWorldById("siteworld-f5fd54898cfb");
    expect(serverRecord).not.toBeNull();
    expect(serverRecord?.sceneMemoryManifestUri).toContain("scene_memory_manifest.json");
    expect(serverRecord?.siteWorldRegistrationUri).toContain("site_world_registration.json");
    expect(["ready", "partial"]).toContain(serverRecord?.artifactExplorer?.status);
    expect(serverRecord?.artifactExplorer?.sources.some((item) => item.id === "canonical")).toBe(true);
  });

  afterEach(() => {
    delete process.env.BLUEPRINT_HOSTED_DEMO_RUNTIME_BASE_URL;
    delete process.env.BLUEPRINT_HOSTED_DEMO_RUNTIME_WEBSOCKET_BASE_URL;
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("allows launch-readiness for the demo site-world from a non-robot-team signed-in account", async () => {
    process.env.BLUEPRINT_HOSTED_DEMO_RUNTIME_BASE_URL = "https://demo-runtime.example.com";
    process.env.BLUEPRINT_HOSTED_DEMO_RUNTIME_WEBSOCKET_BASE_URL = "wss://demo-runtime.example.com";
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "https://demo-runtime.example.com/v1/site-worlds/siteworld-f5fd54898cfb") {
        return new Response(
          JSON.stringify({
            canonical_package_uri:
              "gs://local-blueprint/scenes/9483414B-8776-4F68-AC80-D3B3BA774A90/captures/6F2FD31B-0F9F-43C4-9DF9-885E1A295CF3/pipeline/evaluation_prep/site_world_spec.json",
            canonical_package_version: "demo-runtime-v1",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (String(input) === "https://demo-runtime.example.com/v1/site-worlds/siteworld-f5fd54898cfb/health") {
        return new Response(
          JSON.stringify({
            status: "healthy",
            launchable: true,
            blockers: [],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return originalFetch(input, init);
    }) as typeof global.fetch;

    const app = express();
    app.use((req, res, next) => {
      res.locals.firebaseUser = { uid: "user-1", email: "demo@example.com", admin: false };
      next();
    });
    app.use(router);
    const server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test server");
    }

    try {
      const response = await fetch(
        `http://127.0.0.1:${address.port}/launch-readiness?siteWorldId=siteworld-f5fd54898cfb`,
      );
      const payload = await response.json();
      expect(response.status).toBe(200);
      expect(payload.status).toBe("presentation_assets_missing");
      expect(payload.runtime_only.launchable).toBe(true);
      expect(payload.runtime_only.status).toBe("runtime_live_ready");
      expect(payload.presentation_demo.status).toBe("presentation_assets_missing");
      expect(payload.runtime_only.blockers).not.toContain(
        "Hosted sessions are only available to robot-team accounts.",
      );
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    }
  }, 15000);
});
