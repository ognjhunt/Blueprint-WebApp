import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The capture link can open the Blueprint App Clip on an iPhone, so the site no
 * longer says there is no app. What happens is stated instead: a small Blueprint
 * camera on an iPhone where it is available, the browser recorder everywhere
 * else. This guard keeps the old promise from coming back in any copy.
 */
const ROOTS = ["client/src", "server/utils", "server/routes"];
const FORBIDDEN = /\bno app\b|nothing to install|no app to install|app needed|without (?:an|the) app\b/i;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(tsx?|html)$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });
}

describe("capture-link copy", () => {
  it("never says there is no app to install", () => {
    const root = process.cwd();
    const offenders = ROOTS.flatMap((dir) => sourceFiles(join(root, dir)))
      .flatMap((file) =>
        readFileSync(file, "utf8")
          .split("\n")
          .map((line, index) => ({ file: relative(root, file), line: index + 1, text: line }))
          .filter(({ text }) => FORBIDDEN.test(text)),
      )
      .map(({ file, line, text }) => `${file}:${line}: ${text.trim()}`);
    expect(offenders).toEqual([]);
  });
});
