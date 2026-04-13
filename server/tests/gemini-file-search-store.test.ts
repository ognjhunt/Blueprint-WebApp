// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  DEFAULT_CITY_LAUNCH_DOC_PATHS,
  DEFAULT_CITY_LAUNCH_FILE_SEARCH_DISPLAY_NAME,
  resolveCuratedCityLaunchDocPaths,
} from "../utils/geminiFileSearchStore";

describe("gemini file search store builder", () => {
  it("keeps the default city-launch store display name stable", () => {
    expect(DEFAULT_CITY_LAUNCH_FILE_SEARCH_DISPLAY_NAME).toBe("blueprint-city-launch");
  });

  it("resolves the narrow default city-launch doc pack", async () => {
    const paths = await resolveCuratedCityLaunchDocPaths();

    expect(paths.length).toBeGreaterThan(5);
    expect(paths).toContain("PLATFORM_CONTEXT.md");
    expect(paths).toContain("WORLD_MODEL_STRATEGY_CONTEXT.md");
    expect(paths).toContain("docs/city-launch-deep-research-harness-2026-04-11.md");
    expect(paths).toContain("ops/paperclip/playbooks/capturer-supply-playbook.md");
    expect(DEFAULT_CITY_LAUNCH_DOC_PATHS.includes("DEPLOYMENT.md")).toBe(true);
  });

  it("includes city-specific artifacts when they exist", async () => {
    const paths = await resolveCuratedCityLaunchDocPaths({
      city: "Austin, TX",
    });

    expect(paths).toContain("ops/paperclip/playbooks/city-launch-austin-tx.md");
    expect(paths).toContain("ops/paperclip/playbooks/city-demand-austin-tx.md");
    expect(paths).toContain("docs/city-launch-system-austin-tx.md");
    expect(paths).toContain("ops/paperclip/playbooks/city-capture-target-ledger-austin-tx.md");
  });
});
