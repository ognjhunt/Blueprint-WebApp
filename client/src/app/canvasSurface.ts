/**
 * Which ground the browser canvas paints for a route.
 *
 * The canvas is the surface behind everything React renders: it shows during a
 * route transition (while the next route's lazy chunk is in flight and the
 * Suspense fallback has replaced the page shell), during overscroll, and below
 * a document shorter than the viewport. Every Blueprint shell paints its own
 * ground — `.minimal-site`, `.auth-shell`, `.workspace-shell`, the Runway
 * `SiteLayout` — but those live *inside* the Suspense boundary, so none of them
 * is mounted during the gap. The canvas has to know the surface on its own.
 *
 * Blueprint's paper (`#f6f5ef`) is the default because the public site, the
 * auth pages, the `/app` workspace, and the 404 all render on it, and because
 * legacy marketing paths are `MarketingRedirect`s whose destinations are those
 * same paper surfaces. The Runway instrument surfaces — capture, the site
 * library, admin/ops, internal, beta — opt into the dark ground below.
 *
 * Kept free of React and browser globals so the client, the Express server, and
 * the prerenderer can all resolve a surface from a pathname.
 */
export type CanvasSurface = "light" | "dark";

/** Page ground per surface. Mirrored by the `html` rules in `index.css`. */
export const canvasSurfaceColors: Record<CanvasSurface, string> = {
  light: "#f6f5ef", // --ms-paper / --ws-paper
  dark: "#101312", // runway.deep
};

export const defaultCanvasSurface: CanvasSurface = "light";

/** Runway-ground routes that are not themselves a path prefix. */
const darkPaths = new Set(["/capture", "/launch-map", "/sites"]);

/** Route namespaces rendered entirely on the Runway ground. */
const darkPathPrefixes = [
  "/admin",
  "/beta",
  "/capture-app",
  "/internal",
  "/ops",
  "/sites/",
];

function normalizePathname(pathname: string): string {
  const withoutQuery = pathname.split(/[?#]/, 1)[0];
  return withoutQuery.replace(/\/+$/, "") || "/";
}

export function canvasSurfaceFor(pathname: string): CanvasSurface {
  const normalized = normalizePathname(pathname);
  if (darkPaths.has(normalized)) return "dark";
  if (darkPathPrefixes.some((prefix) => normalized.startsWith(prefix))) {
    return "dark";
  }
  return defaultCanvasSurface;
}

/**
 * Stamps the resolved surface onto a document's `<html>` tag so the very first
 * paint uses the right ground — before the JS bundle has run. Used by the
 * prerenderer for its static documents and by the server for the SPA shell,
 * which is served for many routes and so cannot carry a baked-in surface.
 */
export function stampCanvasSurface(html: string, pathname: string): string {
  const surface = canvasSurfaceFor(pathname);
  return html.replace(
    /<html\b([^>]*)>/i,
    (match, attrs: string) =>
      /\bdata-surface=/i.test(attrs)
        ? match.replace(/\bdata-surface="[^"]*"/i, `data-surface="${surface}"`)
        : `<html${attrs} data-surface="${surface}">`,
  );
}
