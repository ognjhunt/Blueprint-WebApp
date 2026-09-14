import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { minimalPublicPaths } from "@/data/minimalPublicSite";
import {
  canvasSurfaceColors,
  canvasSurfaceFor,
  stampCanvasSurface,
  type CanvasSurface,
} from "@/app/canvasSurface";

const repoRoot = process.cwd();
const clientSrc = path.join(repoRoot, "client", "src");
const routesSource = fs.readFileSync(path.join(clientSrc, "app", "routes.tsx"), "utf8");

/**
 * The shells a page can render, and the canvas ground each one paints.
 * Detection order matters: a workspace page reaches `.workspace-shell` through
 * `AppShell`/`Frame`, so those are checked before the generic Runway classes.
 */
const shellSurfaces: ReadonlyArray<{ pattern: RegExp; surface: CanvasSurface }> = [
  { pattern: /\bAuthLayout\b/, surface: "light" }, // .minimal-site .auth-shell
  { pattern: /\bMinimalSiteLayout\b/, surface: "light" }, // .minimal-site
  { pattern: /\bAppShell\b|\bFrame\b|workspace-shell/, surface: "light" }, // .workspace-shell
  { pattern: /\bSurfacePage\b|bg-runway-|bg-canvas\b/, surface: "dark" }, // Runway ground
];

type ParsedRoute = { routePath: string; component: string; bare: boolean };

function parseRoutes(): ParsedRoute[] {
  const tableStart = routesSource.indexOf("export const appRoutes");
  const table = routesSource.slice(tableStart);
  return [...table.matchAll(/\{\s*path:\s*"([^"]+)",[^}]*?component:\s*(\w+)/g)].map(
    (match) => ({
      routePath: match[1],
      component: match[2],
      bare: /shell:\s*"bare"/.test(match[0]),
    }),
  );
}

const lazyModules = new Map(
  [
    ...routesSource.matchAll(
      /const\s+(\w+)\s*=\s*lazyRoute\(\s*\(\)\s*=>\s*import\("([^"]+)"\)/g,
    ),
  ].map((match) => [match[1], match[2]]),
);

/** True for components declared inline in routes.tsx that only redirect away. */
function isInlineRedirect(component: string): boolean {
  const start = routesSource.search(new RegExp(`^const\\s+${component}\\s*=`, "m"));
  if (start === -1) return false;
  const rest = routesSource.slice(start + 1);
  const end = rest.search(/^(?:const|export const)\s/m);
  const declaration = end === -1 ? rest : rest.slice(0, end);
  return /\bMarketingRedirect\b/.test(declaration);
}

function readPageSource(component: string): string | null {
  const relative = lazyModules.get(component);
  if (!relative) return null;
  const base = path.join(clientSrc, relative.replace(/^\.\.\//, ""));
  for (const candidate of [`${base}.tsx`, `${base}.ts`, path.join(base, "index.tsx")]) {
    if (fs.existsSync(candidate)) return fs.readFileSync(candidate, "utf8");
  }
  return null;
}

/** The ground a route's page actually paints, or null when it can't be read. */
function renderedSurface(route: ParsedRoute): CanvasSurface | null {
  const source = readPageSource(route.component);
  if (source) {
    if (/\bMarketingRedirect\b/.test(source)) return null; // transient
    for (const { pattern, surface } of shellSurfaces) {
      if (pattern.test(source)) return surface;
    }
  }
  if (isInlineRedirect(route.component)) return null; // transient
  if (route.bare) return null; // shell comes from the page, which wasn't readable
  // Otherwise SiteLayout: MinimalSiteLayout (paper) for the minimal public
  // paths, the Runway ground for everything else.
  return (minimalPublicPaths as readonly string[]).includes(route.routePath)
    ? "light"
    : "dark";
}

describe("canvasSurfaceFor", () => {
  it("puts the public site, auth, and workspace on Blueprint paper", () => {
    for (const pathname of [
      "/",
      "/how-it-works",
      "/contact/site-operator",
      "/contact/robot-team",
      "/privacy",
      "/terms",
      "/sign-in",
      "/signup/business",
      "/forgot-password",
      "/app",
      "/app/tasks/abc123",
      "/requests/req_1/evidence",
      "/settings",
    ]) {
      expect(canvasSurfaceFor(pathname), pathname).toBe("light");
    }
  });

  it("puts the Runway instrument surfaces on the dark ground", () => {
    for (const pathname of [
      "/capture",
      "/capture-app",
      "/capture-app/account",
      "/launch-map",
      "/sites",
      "/sites/some-site",
      "/admin/leads",
      "/ops/spend",
      "/internal/design-system",
      "/beta/buyer-guide",
    ]) {
      expect(canvasSurfaceFor(pathname), pathname).toBe("dark");
    }
  });

  it("falls back to paper for unmatched paths, matching the 404 shell", () => {
    expect(canvasSurfaceFor("/no-such-page")).toBe("light");
  });

  it("ignores trailing slashes, query strings, and hashes", () => {
    expect(canvasSurfaceFor("/sites/")).toBe("dark");
    expect(canvasSurfaceFor("/sites?ref=nav")).toBe("dark");
    expect(canvasSurfaceFor("/#how-it-works")).toBe("light");
    expect(canvasSurfaceFor("/contact/site-operator?persona=x#form")).toBe("light");
  });

  // The guard that keeps this honest as routes are added: the canvas ground has
  // to be the one the route's own shell paints, or a transition through it
  // flashes the wrong colour.
  it("agrees with the shell every route actually renders", () => {
    const routes = parseRoutes();
    expect(routes.length).toBeGreaterThan(100);

    const mismatches = routes
      .map((route) => ({ route, expected: renderedSurface(route) }))
      .filter(({ route, expected }) => expected && canvasSurfaceFor(route.routePath) !== expected)
      .map(
        ({ route, expected }) =>
          `${route.routePath} renders a ${expected} shell (${route.component}) but the canvas resolves ${canvasSurfaceFor(route.routePath)}`,
      );

    expect(mismatches).toEqual([]);
  });
});

describe("stampCanvasSurface", () => {
  it("adds the resolved surface to the html tag", () => {
    expect(stampCanvasSurface('<html lang="en">', "/admin/leads")).toBe(
      '<html lang="en" data-surface="dark">',
    );
    expect(stampCanvasSurface('<html lang="en">', "/sign-in")).toBe(
      '<html lang="en" data-surface="light">',
    );
  });

  it("replaces a surface already stamped, rather than duplicating it", () => {
    expect(stampCanvasSurface('<html lang="en" data-surface="light">', "/sites")).toBe(
      '<html lang="en" data-surface="dark">',
    );
  });

  it("leaves documents without an html tag untouched", () => {
    expect(stampCanvasSurface("<div>no doctype</div>", "/")).toBe("<div>no doctype</div>");
  });

  it("exposes a colour for each surface, matching the index.css canvas rules", () => {
    const css = fs.readFileSync(path.join(clientSrc, "index.css"), "utf8");
    expect(css).toContain(`--canvas-ground: ${canvasSurfaceColors.light};`);
    expect(css).toContain(`--canvas-ground: ${canvasSurfaceColors.dark};`);
  });
});
