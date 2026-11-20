// @vitest-environment node
/**
 * The site is never charged (owner, 2026-11-12: the site pays nothing). No flow a site can start reaches payment code.
 *
 * Read from the source, so it holds for every route at once: the entry points are found in `server/routes.ts` (every
 * router mounted outside `/api/admin` and `/api/internal`, which no site and no company can call, plus the retired
 * capturer routes, which answer anyone with a refusal) and the browser app (`client/src/main.tsx`). From each, every
 * static and dynamic import is followed, and no file reached may load a payment SDK, call a payment provider's API or
 * write a payment record. Deployment companies will pay, how is not decided: when that is built, its code may exist,
 * but this test keeps it out of reach of every site-facing flow.
 */
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(import.meta.dirname, "../..");
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), "utf8");

/** A payment provider's SDK. */
const PAYMENT_PACKAGE = /^(?:stripe|@stripe\/.*|braintree|braintree-web|@paypal\/.*|paypal-.*|square|@square\/.*|@adyen\/.*|chargebee.*|recurly.*|@paddle\/.*|@lemonsqueezy\/.*|razorpay|@mollie\/.*|lemonsqueezy.*)$/;
/** A payment provider's API, or a store of payments, charges, invoices, subscriptions, balances or orders. */
const PAYMENT_CODE: ReadonlyArray<[string, RegExp]> = [
  ["a payment provider's API", /\b(?:api|js|checkout|billing|connect)\.stripe\.com|\bapi\.paypal\.com|\bapi-m\.paypal\.com|braintreegateway\.com|checkout\.adyen\.com|api\.squareup\.com/],
  ["a payment record", /collection\(\s*["'`](?:payments?|charges?|invoices?|checkoutSessions?|checkout_sessions|subscriptions?|stripe[A-Za-z_]*|creditLedger|balances?|topUps?|top_ups|orders?|siteCharges)["'`]\s*\)/],
  ["a charge call", /\.(?:charges|paymentIntents|invoices|subscriptions|checkout\.sessions)\.create\(/],
];

/** Each module a file imports, statically or dynamically, resolved to a repo file or kept as a package name. */
function importsOf(file: string): { files: string[]; packages: string[] } {
  const { importedFiles } = ts.preProcessFile(read(file), true, true);
  const files: string[] = [];
  const packages: string[] = [];
  for (const { fileName: spec } of importedFiles) {
    if (spec.startsWith(".") || spec.startsWith("@/")) {
      const base = spec.startsWith("@/") ? path.join("client/src", spec.slice(2)) : path.join(path.dirname(file), spec);
      const stem = base.replace(/\.(?:js|mjs|cjs)$/, "");
      const found = [stem, `${stem}.ts`, `${stem}.tsx`, `${stem}/index.ts`, `${stem}/index.tsx`, base]
        .find(candidate => /\.(?:tsx?|mjs|js)$/.test(candidate) && fs.existsSync(path.join(ROOT, candidate)));
      if (found) files.push(path.normalize(found));
    } else {
      packages.push(spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0]);
    }
  }
  return { files, packages };
}

/** Every repo file and package reachable from the entry files. */
function reach(entries: readonly string[]): { files: Set<string>; packages: Map<string, string> } {
  const files = new Set<string>();
  const packages = new Map<string, string>();
  const queue = [...entries];
  while (queue.length) {
    const file = queue.pop()!;
    if (files.has(file)) continue;
    files.add(file);
    const found = importsOf(file);
    for (const name of found.packages) if (!packages.has(name)) packages.set(name, file);
    queue.push(...found.files.filter(next => !files.has(next)));
  }
  return { files, packages };
}

/** The routers mounted in `server/routes.ts` that a site, a visitor or a company can call. */
function siteFacingRouteFiles(): { entries: string[]; skipped: string[] } {
  const file = "server/routes.ts";
  const source = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true);
  const imported = new Map<string, string>();
  const entries = new Set<string>();
  const skipped: string[] = [];
  const resolve = (spec: string) => importsOf(file).files.find(candidate =>
    candidate.replace(/\.tsx?$/, "") === path.normalize(path.join("server", spec)));
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && node.importClause) {
      const target = resolve(node.moduleSpecifier.text);
      const names = [node.importClause.name?.text, ...(node.importClause.namedBindings && ts.isNamedImports(node.importClause.namedBindings)
        ? node.importClause.namedBindings.elements.map(element => element.name.text) : [])].filter(Boolean) as string[];
      if (target) for (const name of names) imported.set(name, target);
    }
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.expression.getText(source) === "app") {
      const [first] = node.arguments;
      const mount = first && ts.isStringLiteral(first) ? first.text : "/";
      const handlers = node.arguments.filter(argument => ts.isIdentifier(argument)).map(argument => imported.get(argument.getText(source)))
        .filter((target): target is string => Boolean(target) && target!.startsWith("server/routes/"));
      for (const target of handlers) (/^\/api\/(?:admin|internal)(?:\/|$)/.test(mount) ? skipped.push(target) : entries.add(target));
    }
    if (ts.isCallExpression(node) && node.expression.getText(source) === "registerRetiredCapturerRoutes") {
      const target = imported.get("registerRetiredCapturerRoutes");
      if (target) entries.add(target);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return { entries: [...entries].sort(), skipped: [...new Set(skipped)].sort() };
}

describe("no site-facing flow reaches payment code", () => {
  const { entries, skipped } = siteFacingRouteFiles();
  const server = reach(entries);
  const browser = reach(["client/src/main.tsx"]);

  it("finds the site's and the company's routes in server/routes.ts, and leaves out only admin and internal ones", () => {
    for (const route of ["server/routes/site-task-brief.ts", "server/routes/self-capture-uploads.ts", "server/routes/inbound-request.ts",
      "server/routes/site-worlds.ts", "server/routes/robot-team-access.ts", "server/routes/job-outcomes.ts",
      "server/routes/workspace.ts", "server/utils/retiredCapturerRoutes.ts"])
      expect(entries, route).toContain(route);
    expect(skipped.length).toBeGreaterThan(0);
    for (const route of skipped) expect(route).toMatch(/^server\/routes\/(?:admin|internal)-/);
    // The introduction, and with it the billable event, is reached from the site's own route.
    expect(server.files).toContain("server/utils/jobIntroductions.ts");
    expect(server.files).toContain("server/utils/billableEvents.ts");
    expect(browser.files.size).toBeGreaterThan(50);
    expect(server.files.size).toBeGreaterThan(200);
  });

  it("loads no payment SDK on the server or in the browser", () => {
    for (const [label, reached] of [["server", server], ["browser", browser]] as const)
      expect([...reached.packages.entries()].filter(([name]) => PAYMENT_PACKAGE.test(name))
        .map(([name, from]) => `${label}: ${name} (from ${from})`)).toEqual([]);
  });

  it("calls no payment API and writes no payment record from any file it reaches", () => {
    const findings: string[] = [];
    for (const file of new Set([...server.files, ...browser.files]))
      for (const [label, pattern] of PAYMENT_CODE) if (pattern.test(read(file))) findings.push(`${file}: ${label}`);
    expect(findings).toEqual([]);
  });

  it("has no payment SDK installed at all", () => {
    const manifest = JSON.parse(read("package.json")) as Record<string, Record<string, string> | undefined>;
    const installed = Object.keys({ ...manifest.dependencies, ...manifest.devDependencies, ...manifest.optionalDependencies });
    expect(installed.filter(name => PAYMENT_PACKAGE.test(name))).toEqual([]);
  });

  it("would catch a payment SDK, a provider call or a payment record", () => {
    expect(PAYMENT_PACKAGE.test("stripe") && PAYMENT_PACKAGE.test("@stripe/stripe-js")).toBe(true);
    const planted = "await stripe.paymentIntents.create({ amount: 500 }); fetch('https://api.stripe.com/v1/charges'); "
      + "db.collection(\"invoices\").add({});";
    expect(PAYMENT_CODE.filter(([, pattern]) => pattern.test(planted)).map(([label]) => label))
      .toEqual(["a payment provider's API", "a payment record", "a charge call"]);
  });
});
