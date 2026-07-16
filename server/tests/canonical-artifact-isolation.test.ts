// @vitest-environment node
import fsSync from "node:fs";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import {
  canonicalArtifactWriteRedirectActive,
  resolveCanonicalArtifactReadPath,
  resolveCanonicalArtifactWriteRoot,
} from "../utils/canonicalArtifactRoot";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

const originalOverride = process.env.BLUEPRINT_CANONICAL_ARTIFACT_ROOT;

afterEach(() => {
  if (originalOverride === undefined) {
    delete process.env.BLUEPRINT_CANONICAL_ARTIFACT_ROOT;
  } else {
    process.env.BLUEPRINT_CANONICAL_ARTIFACT_ROOT = originalOverride;
  }
});

describe("canonical artifact isolation", () => {
  it("keeps the vitest lane redirected away from the tracked worktree", () => {
    // client/tests/setup.ts must have installed the redirect before any test
    // (including subprocess-spawning ones) can exercise canonical writers.
    expect(canonicalArtifactWriteRedirectActive()).toBe(true);
    const writeRoot = resolveCanonicalArtifactWriteRoot(REPO_ROOT);
    expect(writeRoot).not.toBe(REPO_ROOT);
    expect(path.relative(REPO_ROOT, writeRoot).startsWith("..")).toBe(true);
  });

  it("resolves canonical write paths under the override root", () => {
    process.env.BLUEPRINT_CANONICAL_ARTIFACT_ROOT = path.join(
      os.tmpdir(),
      "canonical-isolation-probe",
    );
    const writeRoot = resolveCanonicalArtifactWriteRoot(REPO_ROOT);
    expect(writeRoot).toBe(path.join(os.tmpdir(), "canonical-isolation-probe"));
  });

  it("falls back to the pristine repo copy for reads when the override has no version", async () => {
    const overrideRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "canonical-isolation-read-"),
    );
    process.env.BLUEPRINT_CANONICAL_ARTIFACT_ROOT = overrideRoot;

    const relativePath = "ops/paperclip/playbooks/capturer-supply-playbook.md";
    const readPath = resolveCanonicalArtifactReadPath(REPO_ROOT, relativePath);
    expect(readPath).toBe(path.join(REPO_ROOT, relativePath));

    const overrideCopy = path.join(overrideRoot, relativePath);
    await fs.mkdir(path.dirname(overrideCopy), { recursive: true });
    await fs.writeFile(overrideCopy, "# generated in override\n", "utf8");
    expect(resolveCanonicalArtifactReadPath(REPO_ROOT, relativePath)).toBe(
      overrideCopy,
    );
  });

  it("routes city-launch GTM canonical artifact paths through the override", async () => {
    const overrideRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "canonical-isolation-gtm-"),
    );
    process.env.BLUEPRINT_CANONICAL_ARTIFACT_ROOT = overrideRoot;

    const { buildCityLaunchGtm72hArtifactPaths } = await import(
      "../utils/cityLaunchExecutionHarness"
    );
    const { resolveCityLaunchProfile } = await import(
      "../utils/cityLaunchProfiles"
    );
    const profile = resolveCityLaunchProfile("Austin, TX");
    const paths = buildCityLaunchGtm72hArtifactPaths(profile, "/tmp/run-dir");

    for (const candidate of [
      paths.canonical.contractJsonPath,
      paths.canonical.contractMarkdownPath,
      paths.canonical.adStudioCreativeHandoffPath,
      paths.canonical.metaAdsReadinessPath,
      paths.canonical.scorecardManifestPath,
      ...Object.values(paths.canonical.scorecardPaths),
    ]) {
      expect(
        path.relative(overrideRoot, candidate).startsWith(".."),
        `${candidate} must resolve under the override root`,
      ).toBe(false);
      expect(
        fsSync.existsSync(candidate) &&
          path.relative(REPO_ROOT, candidate).startsWith("ops"),
        `${candidate} must not point at the tracked worktree`,
      ).toBe(false);
    }
  });
});
