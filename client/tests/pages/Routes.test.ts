import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Route registration", () => {
  it("registers /how-it-works in the main router", () => {
    const routerPath = path.resolve(process.cwd(), "client/src/main.tsx");
    const source = fs.readFileSync(routerPath, "utf-8");

    expect(source).toContain('const HowItWorks = lazy(() => import("./pages/HowItWorks"))');
    expect(source).toContain('<Route path="/how-it-works" component={withLayout(HowItWorks)} />');
  });

  it("registers /pilot-exchange in the main router", () => {
    const routerPath = path.resolve(process.cwd(), "client/src/main.tsx");
    const source = fs.readFileSync(routerPath, "utf-8");

    expect(source).toContain('const PilotExchange = lazy(() => import("./pages/PilotExchange"))');
    expect(source).toContain('<Route path="/pilot-exchange" component={withLayout(PilotExchange)} />');
  });
});
