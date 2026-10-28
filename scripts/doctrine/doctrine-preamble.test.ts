import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { extractBlock, digestBlock, loadLock } from "./verify-shared-doctrine";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.resolve(root, file), "utf-8");

/**
 * The shared blocks are guarded by `doctrine:verify`. This pins the short
 * repo-local guidance around them (owner direction 2026-10-28): what Blueprint
 * does, and that privacy, rights and money are the only hard stops.
 */
describe("platform context preamble", () => {
  const contents = read("PLATFORM_CONTEXT.md");

  it("keeps the preamble outside the locked block", () => {
    const start = contents.indexOf("<!-- SHARED_PLATFORM_CONTEXT_START -->");
    expect(start).toBeGreaterThan(-1);
    expect(contents.slice(0, start)).toMatch(/Read this before the shared block/i);
    const lock = loadLock(root);
    expect(digestBlock(extractBlock(contents, "SHARED_PLATFORM_CONTEXT")))
      .toBe(lock.blocks.SHARED_PLATFORM_CONTEXT.canonical_sha256);
  });

  it("describes the product Blueprint runs itself", () => {
    expect(contents).toMatch(/runs the candidate robot policies/i);
    expect(contents).toMatch(/deployment company/i);
    const block = extractBlock(contents, "SHARED_PLATFORM_CONTEXT");
    expect(block).toMatch(/### The Only Hard Stops/);
    expect(block).toMatch(/Arm Decision Proof v1/);
    expect(block).toMatch(/never certify physical\s+performance or safety/i);
  });

  it("names the cross-repo path for changing the doctrine", () => {
    expect(contents).toMatch(/BlueprintCapturePipeline\/doctrine\//);
    expect(contents).toMatch(/shared-doctrine\.lock\.json/);
  });
});

describe("repo-local agent guides agree with the preamble", () => {
  it.each(["AGENTS.md", "CLAUDE.md"])("%s keeps privacy, rights and money as the only hard stops", (file) => {
    const guide = read(file);
    expect(guide).toMatch(/privacy, rights\s+and money|\*\*Privacy:\*\*[\s\S]*\*\*Rights:\*\*[\s\S]*\*\*Money:\*\*/i);
    expect(guide).toMatch(/shared block/i);
  });
});
