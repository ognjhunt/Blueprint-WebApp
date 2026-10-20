import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const CLIENT_SOURCE = path.resolve(process.cwd(), "client/src");
const SOURCE_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx", ".html", ".json", ".map", ".txt"]);
const FORBIDDEN_SECRET_PATTERNS = [
  { label: "OpenAI or Anthropic API credential", pattern: /\bsk-(?:proj-|ant-|svcacct-)?[A-Za-z0-9_-]{20,}/ },
  { label: "Stripe secret or restricted key", pattern: /[sr]k_(?:live|test)_[A-Za-z0-9]{16,}/ },
  { label: "Stripe webhook secret", pattern: /whsec_[A-Za-z0-9]{16,}/ },
  { label: "Resend API credential", pattern: /\bre_[A-Za-z0-9_]{20,}/ },
  { label: "SendGrid API credential", pattern: /SG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}/ },
  { label: "GitHub API credential", pattern: /(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})/ },
  { label: "Slack API credential", pattern: /xox[baprs]-[A-Za-z0-9-]{20,}/ },
  { label: "Private key", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
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
  it("does not ship provider or webhook bearer credentials in browser source or public files", () => {
    const roots = [CLIENT_SOURCE, path.resolve(process.cwd(), "client/public")];
    const findings = roots.flatMap(sourceFiles).flatMap((filePath) => {
      const source = fs.readFileSync(filePath, "utf8");
      return FORBIDDEN_SECRET_PATTERNS.filter(({ pattern }) => pattern.test(source)).map(
        ({ label }) => `${path.relative(process.cwd(), filePath)}: ${label}`,
      );
    });

    expect(findings).toEqual([]);
  });
});
