// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalFetch = global.fetch;

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  default: {},
  dbAdmin: null,
  storageAdmin: null,
}));

const overrideEnvKeys = [
  "NODE_ENV",
  "BLUEPRINT_ENABLE_DEMO_SITE_WORLDS",
  "BLUEPRINT_HOSTED_DEMO_RUNTIME_BASE_URL",
  "BLUEPRINT_HOSTED_DEMO_RUNTIME_WEBSOCKET_BASE_URL",
  "BLUEPRINT_HOSTED_DEMO_SITE_WORLD_ID",
  "BLUEPRINT_HOSTED_DEMO_PIPELINE_URI_PREFIX",
  "BLUEPRINT_HOSTED_DEMO_SITE_NAME",
  "BLUEPRINT_HOSTED_DEMO_SITE_ADDRESS",
  "BLUEPRINT_HOSTED_DEMO_QUALIFICATION_STATE",
];

describe("env-gated hosted demo site-world override", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    for (const key of overrideEnvKeys) {
      delete process.env[key];
    }
    global.fetch = originalFetch;
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("injects a temporary site-world card and resolves hosted runtime against its explicit artifacts", async () => {
    process.env.BLUEPRINT_HOSTED_DEMO_RUNTIME_BASE_URL = "https://demo-runtime.example.com";
    process.env.BLUEPRINT_HOSTED_DEMO_RUNTIME_WEBSOCKET_BASE_URL = "wss://demo-runtime.example.com";
    process.env.BLUEPRINT_HOSTED_DEMO_SITE_WORLD_ID = "siteworld-707ec52ef0a8";
    process.env.BLUEPRINT_HOSTED_DEMO_PIPELINE_URI_PREFIX =
      "gs://vast-local/scenes/alpha-current-location/captures/1F6AB013-9A05-45AD-8B27-1BB18062A151/pipeline";
    process.env.BLUEPRINT_HOSTED_DEMO_SITE_NAME = "Alpha Current Location";
    process.env.BLUEPRINT_HOSTED_DEMO_SITE_ADDRESS = "Tunnel-backed local demo";
    process.env.BLUEPRINT_HOSTED_DEMO_QUALIFICATION_STATE = "not_ready_yet";

    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "https://demo-runtime.example.com/v1/site-worlds/siteworld-707ec52ef0a8") {
        return new Response(
          JSON.stringify({
            canonical_package_uri:
              "gs://vast-local/scenes/alpha-current-location/captures/1F6AB013-9A05-45AD-8B27-1BB18062A151/pipeline/evaluation_prep/site_world_spec.json",
            canonical_package_version: "manual-runtime-registration",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (String(input) === "https://demo-runtime.example.com/v1/site-worlds/siteworld-707ec52ef0a8/health") {
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

    const [{ getSiteWorldById }, { getPublicSiteWorldById }, { resolveHostedRuntime }] = await Promise.all([
      import("../../client/src/data/siteWorlds"),
      import("../utils/site-worlds"),
      import("../utils/hosted-session-runtime"),
    ]);

    const clientRecord = getSiteWorldById("siteworld-707ec52ef0a8");
    expect(clientRecord).not.toBeNull();
    expect(clientRecord?.runtimeManifest.runtimeBaseUrl).toBe("https://demo-runtime.example.com");
    expect(clientRecord?.siteWorldSpecUri).toBe(
      "gs://vast-local/scenes/alpha-current-location/captures/1F6AB013-9A05-45AD-8B27-1BB18062A151/pipeline/evaluation_prep/site_world_spec.json",
    );

    const serverRecord = await getPublicSiteWorldById("siteworld-707ec52ef0a8");
    expect(serverRecord).not.toBeNull();
    expect(serverRecord?.siteName).toBe("Alpha Current Location");
    expect(serverRecord?.siteWorldRegistrationUri).toBe(
      "gs://vast-local/scenes/alpha-current-location/captures/1F6AB013-9A05-45AD-8B27-1BB18062A151/pipeline/evaluation_prep/site_world_registration.json",
    );
    expect(serverRecord?.hostedSessionOverride?.allowBlockedSiteWorld).toBe(true);

    const runtime = await resolveHostedRuntime("siteworld-707ec52ef0a8");
    expect(runtime.runtimeBaseUrl).toBe("https://demo-runtime.example.com");
    expect(runtime.websocketBaseUrl).toBe("wss://demo-runtime.example.com");
    expect(runtime.siteWorldSpecUri).toBe(
      "gs://vast-local/scenes/alpha-current-location/captures/1F6AB013-9A05-45AD-8B27-1BB18062A151/pipeline/evaluation_prep/site_world_spec.json",
    );
    expect(runtime.resolvedArtifactCanonicalUri).toBe(runtime.siteWorldSpecUri);
    expect(runtime.allowBlockedSiteWorld).toBe(true);
    expect(runtime.qualificationState).toBe("not_ready_yet");
    expect(runtime.registeredCanonicalPackageUri).toBe(runtime.siteWorldSpecUri);
  });

  it("hides the hosted demo override from the production catalog unless the demo flag is enabled", async () => {
    process.env.NODE_ENV = "production";
    process.env.BLUEPRINT_HOSTED_DEMO_RUNTIME_BASE_URL = "https://demo-runtime.example.com";
    process.env.BLUEPRINT_HOSTED_DEMO_RUNTIME_WEBSOCKET_BASE_URL = "wss://demo-runtime.example.com";
    process.env.BLUEPRINT_HOSTED_DEMO_SITE_WORLD_ID = "siteworld-hidden";
    process.env.BLUEPRINT_HOSTED_DEMO_PIPELINE_URI_PREFIX =
      "gs://vast-local/scenes/hidden/captures/demo/pipeline";
    process.env.BLUEPRINT_HOSTED_DEMO_SITE_NAME = "Hidden Demo";
    process.env.BLUEPRINT_HOSTED_DEMO_SITE_ADDRESS = "Tunnel-backed local demo";

    const { getSiteWorldById } = await import("../../client/src/data/siteWorlds");
    expect(getSiteWorldById("siteworld-hidden")).toBeNull();
  });
});
