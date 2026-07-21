import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const CLIENT_SOURCE = path.resolve(process.cwd(), "client/src");
const SOURCE_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx"]);
const FORBIDDEN_SECRET_PATTERNS = [
  { label: "Perplexity API token", pattern: /pplx-[A-Za-z0-9_-]{12,}/ },
  { label: "Firecrawl API token", pattern: /fc-[A-Za-z0-9_-]{12,}/ },
  {
    label: "hard-coded bearer credential",
    pattern: /(?:authorization\s*[:=]\s*["']?|["'])bearer\s+[A-Za-z0-9._-]{20,}/i,
  },
] as const;

function sourceFiles(root: string): string[] {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) return sourceFiles(fullPath);
    return SOURCE_EXTENSIONS.has(path.extname(entry.name)) ? [fullPath] : [];
  });
}

describe("client source secret guard", () => {
  it("does not ship provider or webhook bearer credentials in browser source", () => {
    const findings = sourceFiles(CLIENT_SOURCE).flatMap((filePath) => {
      const source = fs.readFileSync(filePath, "utf8");
      return FORBIDDEN_SECRET_PATTERNS.filter(({ pattern }) => pattern.test(source)).map(
        ({ label }) => `${path.relative(process.cwd(), filePath)}: ${label}`,
      );
    });

    expect(findings).toEqual([]);
  });
});
