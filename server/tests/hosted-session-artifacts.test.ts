// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { HostedSessionRecord } from "../types/hosted-session";
import {
  normalizePublishedArtifactUri,
  preferredPublishedArtifactBucket,
} from "../utils/hosted-session-artifacts";

function session(parts: {
  siteModel?: Partial<NonNullable<HostedSessionRecord["siteModel"]>> | null;
  launchContext?: Record<string, unknown>;
}): HostedSessionRecord {
  return {
    siteModel: parts.siteModel ?? null,
    launchContext: parts.launchContext ?? {},
  } as unknown as HostedSessionRecord;
}

describe("preferredPublishedArtifactBucket", () => {
  it("returns the first real gs:// bucket from the site model", () => {
    expect(
      preferredPublishedArtifactBucket(
        session({ siteModel: { siteWorldHealthUri: "gs://published-bucket/health.json" } }),
      ),
    ).toBe("published-bucket");
  });

  it("skips the local-blueprint placeholder bucket and non-gs candidates", () => {
    expect(
      preferredPublishedArtifactBucket(
        session({
          siteModel: {
            siteWorldHealthUri: "https://example.com/health.json",
            siteWorldSpecUri: "gs://local-blueprint/spec.json",
          },
          launchContext: { site_world_health_uri: "gs://real-bucket/h.json" },
        }),
      ),
    ).toBe("real-bucket");
  });

  it("returns null when no candidate is a non-local gs:// URI", () => {
    expect(
      preferredPublishedArtifactBucket(
        session({
          siteModel: { siteWorldHealthUri: "gs://local-blueprint/x" },
          launchContext: { site_world_spec_uri: "not-a-uri" },
        }),
      ),
    ).toBeNull();
  });
});

describe("normalizePublishedArtifactUri", () => {
  it("returns non-local-blueprint URIs unchanged", () => {
    const s = session({ siteModel: { siteWorldHealthUri: "gs://published/health.json" } });
    expect(normalizePublishedArtifactUri("gs://other/asset.png", s)).toBe("gs://other/asset.png");
    expect(normalizePublishedArtifactUri("", s)).toBe("");
  });

  it("rewrites a local-blueprint URI onto the preferred published bucket", () => {
    const s = session({ siteModel: { siteWorldHealthUri: "gs://published-bucket/health.json" } });
    expect(normalizePublishedArtifactUri("gs://local-blueprint/path/to/frame.png", s)).toBe(
      "gs://published-bucket/path/to/frame.png",
    );
  });

  it("leaves a local-blueprint URI untouched when there is no published bucket", () => {
    const s = session({ siteModel: { siteWorldHealthUri: "gs://local-blueprint/only.json" } });
    expect(normalizePublishedArtifactUri("gs://local-blueprint/x.png", s)).toBe("gs://local-blueprint/x.png");
  });
});
