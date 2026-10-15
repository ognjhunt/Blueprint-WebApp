import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { extractBlock, digestBlock, loadLock } from "./verify-shared-doctrine";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.resolve(root, file), "utf-8");

/**
 * The shared blocks are cross-repo doctrine and are already guarded by
 * `doctrine:verify`. What is not otherwise guarded is the repo-local preamble
 * that states what ships and how the public surface and the shared blocks are
 * kept in agreement — delete it and the next lane reads a description of a
 * company that no longer matches what ships, which is the exact failure this
 * preamble exists to prevent.
 */
describe("platform context preamble", () => {
  const contents = read("PLATFORM_CONTEXT.md");

  it("keeps the preamble outside the locked block", () => {
    const start = contents.indexOf("<!-- SHARED_PLATFORM_CONTEXT_START -->");
    expect(start).toBeGreaterThan(-1);
    const preamble = contents.slice(0, start);
    expect(preamble).toMatch(/Read this before the shared block/i);
    // The digest must be unaffected by anything the preamble says.
    const lock = loadLock(root);
    const expected = lock.blocks.SHARED_PLATFORM_CONTEXT.canonical_sha256;
    expect(digestBlock(extractBlock(contents, "SHARED_PLATFORM_CONTEXT"))).toBe(expected);
  });

  it("states what the public surface currently ships", () => {
    expect(contents).toMatch(/recommended pilot/i);
    // Founder decision, 2026-10-13: a free beta with an evaluated recommendation.
    expect(contents).toMatch(/completely free/i);
    expect(contents).toMatch(/evaluation result on that job passed/i);
    expect(contents).toMatch(/open for sites/i);
    expect(contents).toMatch(/qualifying-environment standard/i);
  });

  it("records that the public surface and the shared block agree", () => {
    // Founder decision, 2026-10-14: the free beta became an active program.
    expect(contents).toMatch(/The shared block and this repo's public surface agree/i);
    const block = extractBlock(contents, "SHARED_PLATFORM_CONTEXT");
    expect(block).toMatch(/### Active Programs/);
    expect(block).toMatch(/Free Beta: Evaluated, Recommended Pilot/);
    expect(block).toMatch(/free-beta-evaluated-pilot/);
    expect(block).toMatch(/Arm Decision Proof v1/);
    expect(block).not.toMatch(/sole active program/i);
  });

  it("forbids forking doctrine with a local edit", () => {
    expect(contents).toMatch(/Do not.*edit the shared block here/is);
    expect(contents).toMatch(/fork doctrine across/i);
  });

  it("preserves the engineering invariants the reposition does not loosen", () => {
    expect(contents).toMatch(/bounded estimates or abstentions/i);
    expect(contents).toMatch(/never certifies physical performance or safety/i);
  });

  it("names the cross-repo path for changing the offer or the doctrine", () => {
    expect(contents).toMatch(/BlueprintCapturePipeline\/doctrine\//);
    expect(contents).toMatch(/shared-doctrine\.lock\.json.*all three repos/is);
    expect(contents).toMatch(/Changing the active programs is a founder decision/);
  });
});

describe("repo-local agent guides agree with the preamble", () => {
  it("points CLAUDE.md at the preamble and forbids editing the locked blocks", () => {
    const claude = read("CLAUDE.md");
    expect(claude).toMatch(/Start with `PLATFORM_CONTEXT\.md`'s preamble/);
    expect(claude).toMatch(/Never edit\s+inside a shared block/i);
    expect(claude).toMatch(/never update the lock digest to match a local edit/i);
    // The evidence discipline the public surface runs on.
    expect(claude).toMatch(/There is no third grade/i);
    expect(claude).toMatch(/brand-polish/);
  });

  it("updates the AGENTS.md mission to describe the surface that ships", () => {
    const agents = read("AGENTS.md");
    expect(agents).toMatch(/positioned as a recommended pilot/i);
    expect(agents).toMatch(/read its preamble first; never edit inside a shared block/i);
  });
});
