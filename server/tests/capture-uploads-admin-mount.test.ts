import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The staff captures API (/api/capture-uploads) is staff-only, like its page; sites upload through /api/self-capture-uploads.
describe("/api/capture-uploads mount", () => {
  const source = readFileSync("server/routes.ts", "utf8");

  it("requires the admin role before the router", () => {
    const mount = source.match(/app\.use\(\s*"\/api\/capture-uploads",([\s\S]*?)\);/);
    expect(mount).not.toBeNull();
    const handlers = mount![1].split(",").map(part => part.trim()).filter(Boolean);
    expect(handlers).toEqual(["csrfProtection", "verifyFirebaseToken", "requireAdminRole", "captureUploadsRouter"]);
  });

  it("leaves the site's own upload route without the admin role", () => {
    const mount = source.match(/app\.use\(\s*"\/api\/self-capture-uploads",([\s\S]*?)\);/);
    if (mount) expect(mount[1]).not.toContain("requireAdminRole");
  });
});
