import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  loadPlatformDoctrineDocs,
  resolveConfiguredRepoRoot,
} from "./repo-root.js";

afterEach(() => {
  delete process.env.PAPERCLIP_REPO_ROOT;
  delete process.env.REPO_ROOT;
});

describe("platform doctrine repo root helpers", () => {
  it("prefers REPO_ROOT over PAPERCLIP_REPO_ROOT when no explicit root is passed", () => {
    process.env.PAPERCLIP_REPO_ROOT = "/tmp/paperclip-repo";
    process.env.REPO_ROOT = "/tmp/webapp-repo";

    expect(resolveConfiguredRepoRoot()).toBe(path.resolve("/tmp/webapp-repo"));
  });

  it("allows an explicit repo root override", () => {
    process.env.PAPERCLIP_REPO_ROOT = "/tmp/paperclip-repo";
    process.env.REPO_ROOT = "/tmp/webapp-repo";

    expect(resolveConfiguredRepoRoot("../Blueprint-WebApp")).toBe(
      path.resolve("../Blueprint-WebApp"),
    );
  });

  it("uses the provided fallback repo root when no explicit or env root is available", () => {
    expect(resolveConfiguredRepoRoot(null, "/tmp/blueprint-webapp")).toBe(
      path.resolve("/tmp/blueprint-webapp"),
    );
  });

  it("reads the platform doctrine markdown from a configured repo root", () => {
    const repoRoot = mkdtempSync(path.join(os.tmpdir(), "paperclip-platform-doctrine-"));

    try {
      writeFileSync(path.join(repoRoot, "PLATFORM_CONTEXT.md"), "platform-context-from-test");
      writeFileSync(
        path.join(repoRoot, "WORLD_MODEL_STRATEGY_CONTEXT.md"),
        "world-model-strategy-from-test",
      );

      const docs = loadPlatformDoctrineDocs(repoRoot);

      expect(docs).toEqual([
        {
          title: "Platform Context — System Framing & Product Doctrine",
          naturalKey: "platform-context-doctrine",
          type: "Platform Doctrine",
          fileContent: "platform-context-from-test",
        },
        {
          title: "World Model Strategy — Core Strategy Document",
          naturalKey: "world-model-strategy-doctrine",
          type: "Platform Doctrine",
          fileContent: "world-model-strategy-from-test",
        },
      ]);
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });
});
