import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The staff captures API (/api/capture-uploads) and its page are retired; sites upload through /api/self-capture-uploads.
describe("/api/capture-uploads mount", () => {
  const source = readFileSync("server/routes.ts", "utf8");

  it("is no longer mounted, and the staff captures page is gone", () => {
    expect(source).not.toMatch(/"\/api\/capture-uploads"/);
    expect(readFileSync("client/src/app/routes.tsx", "utf8")).not.toContain('"/app/captures"');
  });

  it("leaves the site's own upload route without the admin role", () => {
    const mount = source.match(/app\.use\(\s*"\/api\/self-capture-uploads",([\s\S]*?)\);/);
    if (mount) expect(mount[1]).not.toContain("requireAdminRole");
  });
});
