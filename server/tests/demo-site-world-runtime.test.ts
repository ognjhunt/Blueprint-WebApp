// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  default: {},
  dbAdmin: null,
  storageAdmin: null,
}));

import { getSiteWorldById } from "../../client/src/data/siteWorlds";
import { resolveHostedRuntime } from "../utils/hosted-session-runtime";
import { getPublicSiteWorldById } from "../utils/site-worlds";

describe("demo site-world runtime fallback", () => {
  it("exposes the hardcoded site-world in client and server catalogs", async () => {
    const clientRecord = getSiteWorldById("siteworld-f5fd54898cfb");
    expect(clientRecord).not.toBeNull();
    expect(clientRecord?.runtimeManifest.runtimeBaseUrl).toBe("http://146.115.17.157:45457");
    expect(clientRecord?.hostedSessionOverride?.allowBlockedSiteWorld).toBe(true);

    const serverRecord = await getPublicSiteWorldById("siteworld-f5fd54898cfb");
    expect(serverRecord).not.toBeNull();
    expect(serverRecord?.sceneMemoryManifestUri).toContain("scene_memory_manifest.json");
    expect(serverRecord?.siteWorldRegistrationUri).toContain("site_world_registration.json");
  });

  it("resolves hosted runtime with the demo launch override", async () => {
    const runtime = await resolveHostedRuntime("siteworld-f5fd54898cfb");

    expect(runtime.runtimeBaseUrl).toBe("http://146.115.17.157:45457");
    expect(runtime.websocketBaseUrl).toBe("ws://146.115.17.157:45457");
    expect(runtime.allowBlockedSiteWorld).toBe(true);
    expect(runtime.qualificationState).toBe("qualified_ready");
    expect(runtime.deploymentReadiness?.qualification_state).toBe("qualified_ready");
  });
});
