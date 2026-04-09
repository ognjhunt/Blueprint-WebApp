import { describe, expect, it } from "vitest";
import { loadEnvironmentProfile, listEnvironmentProfileKeys } from "./environment-profiles.js";

describe("environment profiles", () => {
  it("loads the engineered implementation profile", () => {
    const profile = loadEnvironmentProfile("engineering_impl_default");
    expect(profile?.key).toBe("engineering_impl_default");
    expect(profile?.memory?.bind).toContain("doctrine_shared");
    expect(profile?.vault?.allowed_refs).toContain("BLUEPRINT_PAPERCLIP_GITHUB_TOKEN");
  });

  it("lists seeded runtime environment profiles", () => {
    const keys = listEnvironmentProfileKeys();
    expect(keys).toContain("engineering_impl_default");
    expect(keys).toContain("engineering_review_readonly");
    expect(keys).toContain("ops_internal_mutation_limited");
  });
});
