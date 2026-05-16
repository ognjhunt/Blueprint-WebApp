// @vitest-environment node
import { describe, expect, it } from "vitest";

import { buildContentSecurityPolicy } from "../utils/contentSecurityPolicy";

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
