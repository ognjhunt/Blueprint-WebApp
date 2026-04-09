import { describe, expect, it } from "vitest";
import { buildBlueprintRuntimeMetadata, loadRuntimeAgentManifest, resolveRuntimeAgentRelease } from "./versioning.js";

describe("runtime versioning", () => {
  it("loads the webapp codex runtime manifest", () => {
    const manifest = loadRuntimeAgentManifest("webapp-codex");
    expect(manifest?.agent_key).toBe("webapp-codex");
    expect(manifest?.default_environment_profile).toBe("engineering_impl_default");
  });

  it("resolves the production release for webapp review", () => {
    const release = resolveRuntimeAgentRelease("webapp-review", "production");
    expect(release?.channel.channel).toBe("production");
    expect(release?.version.version).toBe("2026-04-09.1");
    expect(release?.version.environment_profile).toBe("engineering_review_readonly");
  });

  it("builds normalized runtime metadata", () => {
    const metadata = buildBlueprintRuntimeMetadata("blueprint-chief-of-staff");
    expect(metadata?.agentVersionRef).toBe("2026-04-09.1");
    expect(metadata?.channelRef).toBe("production");
    expect(metadata?.version.environment_profile).toBe("ops_internal_mutation_limited");
  });
});
