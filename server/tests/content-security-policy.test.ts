// @vitest-environment node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { buildContentSecurityPolicy, INLINE_SCRIPT_HASHES } from "../utils/contentSecurityPolicy";

function parseDirective(policy: string, directiveName: string) {
  const directive = policy
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${directiveName} `));

  return directive ? directive.split(/\s+/).slice(1) : [];
}

describe("content security policy", () => {
  it("allows production Google Maps scripts used by site intake pages", () => {
    const policy = buildContentSecurityPolicy({ isProduction: true });

    const scriptSrc = parseDirective(policy, "script-src");

    expect(scriptSrc).toContain("https://maps.googleapis.com");
    expect(scriptSrc).toContain("https://maps.gstatic.com");
  });

  it("lets the location field query its geocoders", () => {
    const connectSrc = parseDirective(buildContentSecurityPolicy({ isProduction: true }), "connect-src");
    // Google Places when a key is configured, and the keyless free fallback the
    // field uses otherwise. Dropping either silently strips the suggestions.
    expect(connectSrc).toContain("https://maps.googleapis.com");
    expect(connectSrc).toContain("https://photon.komoot.io");
  });

  it("keeps development-only script sources out of production", () => {
    const policy = buildContentSecurityPolicy({ isProduction: true });

    const scriptSrc = parseDirective(policy, "script-src");

    expect(scriptSrc).not.toContain("'unsafe-eval'");
    expect(scriptSrc).not.toContain("http://localhost:5173");
  });

  it("allows Spark splat wasm data loaders used by the self-hosted preview", () => {
    const policy = buildContentSecurityPolicy({ isProduction: true });

    const scriptSrc = parseDirective(policy, "script-src");
    const connectSrc = parseDirective(policy, "connect-src");

    expect(scriptSrc).toContain("'wasm-unsafe-eval'");
    expect(connectSrc).toContain("data:");
  });
});

describe("production script-src has no 'unsafe-inline'", () => {
  const repoRoot = path.resolve(__dirname, "..", "..");

  function htmlFiles(): string[] {
    const files = [path.join(repoRoot, "client", "index.html")];
    const publicDir = path.join(repoRoot, "client", "public");
    for (const name of fs.readdirSync(publicDir)) {
      if (name.endsWith(".html")) files.push(path.join(publicDir, name));
    }
    // A local or CI build also covers the prerendered pages.
    const walk = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith(".html")) files.push(full);
      }
    };
    walk(path.join(repoRoot, "dist", "public"));
    return files;
  }

  const hash = (value: string) =>
    `'sha256-${crypto.createHash("sha256").update(value, "utf8").digest("base64")}'`;

  it("drops 'unsafe-inline' in production and keeps it only for development", () => {
    const production = parseDirective(buildContentSecurityPolicy({ isProduction: true }), "script-src");
    expect(production).not.toContain("'unsafe-inline'");
    for (const allowed of INLINE_SCRIPT_HASHES) expect(production).toContain(allowed);
    const development = parseDirective(buildContentSecurityPolicy({ isProduction: false }), "script-src");
    expect(development).toContain("'unsafe-inline'");
  });

  it("covers every executable inline script and inline event handler the site serves", () => {
    const scriptSrc = parseDirective(buildContentSecurityPolicy({ isProduction: true }), "script-src");
    const uncovered: string[] = [];
    let inlineSeen = 0;
    for (const file of htmlFiles()) {
      const html = fs.readFileSync(file, "utf8");
      for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
        const [, attributes, body] = match;
        if (/\bsrc\s*=/.test(attributes)) continue;
        const type = /\btype\s*=\s*["']?([^"'\s>]+)/i.exec(attributes)?.[1]?.toLowerCase() || "";
        // Data blocks (JSON-LD, JSON) are not executed and CSP does not apply.
        if (type && !["text/javascript", "module", "application/javascript"].includes(type)) continue;
        inlineSeen += 1;
        if (!scriptSrc.includes(hash(body))) {
          uncovered.push(`${path.relative(repoRoot, file)}: <script> ${body.trim().slice(0, 60)}`);
        }
      }
      for (const match of html.matchAll(/\son[a-z]+\s*=\s*"([^"]*)"/gi)) {
        inlineSeen += 1;
        if (!scriptSrc.includes(hash(match[1])) || !scriptSrc.includes("'unsafe-hashes'")) {
          uncovered.push(`${path.relative(repoRoot, file)}: handler ${match[1]}`);
        }
      }
    }
    expect(inlineSeen).toBeGreaterThan(0);
    expect(uncovered).toEqual([]);
  });
});
