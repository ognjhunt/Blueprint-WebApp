import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { extractBlock, digestBlock, loadLock } from "./verify-shared-doctrine";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.resolve(root, file), "utf-8");

/**
 * The shared blocks are cross-repo doctrine and are already guarded by
 * `doctrine:verify`. What is not otherwise guarded is the repo-local preamble
 * that explains why this repo's public surface sits ahead of them — delete it
 * and the next lane reads a description of a company that no longer matches
 * what ships, which is the exact failure this preamble exists to prevent.
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
    expect(contents).toMatch(/deployment infrastructure/i);
    expect(contents).toMatch(/months 0–2/);
    expect(contents).toMatch(/qualifying-environment standard/i);
  });

  it("names the tension rather than hiding it in either direction", () => {
    expect(contents).toMatch(/The live tension, stated plainly/i);
    expect(contents).toMatch(/Frozen Work/);
    expect(contents).toMatch(/an agent reading only one of them will\s+be misled/i);
  });

  it("forbids the two wrong ways to resolve it", () => {
    expect(contents).toMatch(/Do not.*editing the shared block here/is);
    expect(contents).toMatch(/fork doctrine across/i);
    expect(contents).toMatch(/Do not.*authority to revert or narrow/is);
  });

  it("preserves the engineering invariants the reposition does not loosen", () => {
    expect(contents).toMatch(/bounded estimates or abstentions/i);
    expect(contents).toMatch(/never certifies physical performance or safety/i);
  });

  it("names the cross-repo reconciliation path", () => {
    expect(contents).toMatch(/BlueprintCapturePipeline\/doctrine\//);
    expect(contents).toMatch(/shared-doctrine\.lock\.json.*all three repos/is);
    expect(contents).toMatch(/blueprint-cto/);
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
    expect(agents).toMatch(/positioned as deployment infrastructure/i);
    expect(agents).toMatch(/read its preamble first; never edit inside a shared block/i);
  });
});
