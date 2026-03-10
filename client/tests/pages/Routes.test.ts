import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Route registration", () => {
  it("registers core concept routes", () => {
    const routesPath = path.resolve(process.cwd(), "client/src/app/routes.tsx");
    const source = fs.readFileSync(routesPath, "utf-8");

    expect(source).toContain('path: "/qualified-opportunities"');
    expect(source).toContain('path: "/qualified-opportunities-guide"');
    expect(source).toContain('path: "/marketplace"');
    expect(source).toContain('path: "/how-it-works"');
    expect(source).toContain('path: "/solutions"');
    expect(source).toContain('path: "/pricing"');
  });

  it("keeps legacy deployment-marketplace slugs as redirect aliases", () => {
    const routesPath = path.resolve(process.cwd(), "client/src/app/routes.tsx");
    const source = fs.readFileSync(routesPath, "utf-8");

    expect(source).toContain('path: "/deployment-marketplace"');
    expect(source).toContain('path: "/deployment-marketplace-guide"');
    expect(source).toContain('path: "/pilot-exchange"');
    expect(source).toContain('path: "/pilot-exchange-guide"');
  });

  it("does not expose deprecated public marketing routes", () => {
    const routesPath = path.resolve(process.cwd(), "client/src/app/routes.tsx");
    const source = fs.readFileSync(routesPath, "utf-8");

    expect(source).not.toContain('path: "/why-simulation"');
    expect(source).not.toContain('path: "/learn"');
    expect(source).not.toContain('path: "/docs"');
    expect(source).not.toContain('path: "/evals"');
    expect(source).not.toContain('path: "/rl-training"');
    expect(source).not.toContain('path: "/case-studies"');
    expect(source).not.toContain('path: "/careers"');
  });

  it("keeps canonical dashboard and off-waitlist routes reachable", () => {
    const routesPath = path.resolve(process.cwd(), "client/src/app/routes.tsx");
    const source = fs.readFileSync(routesPath, "utf-8");

    expect(source).toContain('path: "/dashboard"');
    expect(source).toContain('path: "/off-waitlist-signup"');
  });
});
