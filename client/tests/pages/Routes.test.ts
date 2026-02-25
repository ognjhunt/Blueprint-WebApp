import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Route registration", () => {
  it("registers /how-it-works and /pilot-exchange in route registry", () => {
    const routesPath = path.resolve(process.cwd(), "client/src/app/routes.tsx");
    const source = fs.readFileSync(routesPath, "utf-8");

    expect(source).toContain('path: "/how-it-works"');
    expect(source).toContain('path: "/pilot-exchange"');
  });

  it("keeps canonical dashboard and off-waitlist routes reachable", () => {
    const routesPath = path.resolve(process.cwd(), "client/src/app/routes.tsx");
    const source = fs.readFileSync(routesPath, "utf-8");

    expect(source).toContain('path: "/dashboard"');
    expect(source).toContain('path: "/off-waitlist-signup"');
  });
});
