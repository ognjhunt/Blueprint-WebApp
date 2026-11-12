import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { extractBlock, digestBlock, loadLock } from "./verify-shared-doctrine";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.resolve(root, file), "utf-8");

/**
 * The shared blocks are guarded by `doctrine:verify`. This pins the short
 * repo-local guidance around them (owner direction 2026-11-12): what Blueprint
 * does (the job packet), that a deployment company receives a summary only
 * until the owner sets a new permission, and that privacy, rights and money are
 * the only hard stops.
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

  it("describes the job packet and the day-one limit on what is shared", () => {
    const preamble = contents.slice(0, contents.indexOf("<!-- SHARED_PLATFORM_CONTEXT_START -->"));
    expect(preamble).toMatch(/job\s+packet/i);
    expect(preamble).toMatch(/deployment\s+company/i);
    expect(preamble).toMatch(/early\s+trial/i);
    expect(preamble).toMatch(/summary\s+of\s+a\s+job\s+only/i);
    expect(preamble).toMatch(/video\s+and\s+simulation\s+stay\s+private/i);
    expect(preamble).toMatch(/no\s+price\s+is\s+stated/i);
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
