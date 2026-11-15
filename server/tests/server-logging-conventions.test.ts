// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const serverRoots = [
  "server/routes",
  "server/utils",
  "server/agents",
  "server/middleware",
  "server/constants",
];

function listTypeScriptFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return listTypeScriptFiles(fullPath);
    }
    if (!entry.name.endsWith(".ts") || entry.name.endsWith(".test.ts")) {
      return [];
    }
    return [fullPath];
  });
}

describe("server logging conventions", () => {
  it("keeps production server code on the structured logger instead of console output", () => {
    const files = serverRoots.flatMap((root) => listTypeScriptFiles(path.join(repoRoot, root)));
    const offenders = files
      .map((file) => ({
        file: path.relative(repoRoot, file),
        content: fs.readFileSync(file, "utf8"),
      }))
      .filter(({ content }) => /\bconsole\.(log|info|warn|error)\b/.test(content))
      .map(({ file }) => file);

    expect(offenders).toEqual([]);
  });
});
