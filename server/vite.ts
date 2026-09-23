import express, { type Express } from "express";
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { type Server } from "http";
import viteConfig from "../vite.config";
import { stampCanvasSurface } from "../client/src/app/canvasSurface";
import { stampAppClipBanner } from "./utils/appClipBanner";
import { ROUTE_PATTERNS_FILE, routePatternMatches } from "../client/src/app/routeMatch";
import { logger } from "./logger";

export async function setupVite(app: Express, server: Server) {
  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: {
      middlewareMode: true,
      // Middleware mode has no standalone Vite listener from which to infer a
      // browser port. Pin the client to the Express listener used by local and
      // CI Playwright runs so the injected HMR URL is never `:undefined`.
      hmr: {
        server,
        port: Number(process.env.PORT || 5000),
        clientPort: Number(process.env.PORT || 5000),
      },
    },
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        __dirname,
        "..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      const template = await fs.promises.readFile(clientTemplate, "utf-8");
      const page = await vite.transformIndexHtml(url, template);
      res
        .status(200)
        .set({ "Content-Type": "text/html" })
        .end(stampAppClipBanner(stampCanvasSurface(page, url), url));
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

/**
 * The client's route patterns, written by the build next to `public`. Without
 * them every unknown path is served with 200, which is how this used to work.
 */
function loadRoutePatterns(distPath: string): string[] | null {
  const file = path.resolve(distPath, "..", ROUTE_PATTERNS_FILE);
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as { patterns?: unknown };
    if (Array.isArray(parsed.patterns) && parsed.patterns.every((item) => typeof item === "string")) {
      return parsed.patterns as string[];
    }
  } catch {
    // Missing or unreadable: fall through to the warning.
  }
  logger.warn({ file }, "Client route patterns not found; unknown paths will be served with status 200");
  return null;
}

export function serveStatic(
  app: Express,
  distPathOverride?: string,
  options: { routePatterns?: string[] | null } = {},
) {
  const distPath =
    distPathOverride ?? path.resolve(__dirname, "..", "dist", "public");
  const indexPath = path.resolve(distPath, "index.html");
  const htmlCache = new Map<string, string | null>();

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  const readCachedHtml = (filePath: string) => {
    if (htmlCache.has(filePath)) {
      return htmlCache.get(filePath) ?? null;
    }

    try {
      const html = fs.readFileSync(filePath, "utf8");
      htmlCache.set(filePath, html);
      return html;
    } catch {
      htmlCache.set(filePath, null);
      return null;
    }
  };

  const indexHtml = readCachedHtml(indexPath);
  if (!indexHtml) {
    throw new Error(`Could not read the built client index: ${indexPath}`);
  }

  // Minimal SPA boot shell (empty root, no homepage markup/images).
  // Used as the catch-all fallback for client-rendered routes that have no dedicated
  // prerendered document, so they parse a ~3KB shell instead of the ~39KB homepage.
  const shellHtml = readCachedHtml(path.resolve(distPath, "app-shell.html")) ?? indexHtml;

  app.use(express.static(distPath, { redirect: false }));

  const routePatterns = options.routePatterns !== undefined ? options.routePatterns : loadRoutePatterns(distPath);
  // Case-insensitive so a path the router might still render is never
  // reported missing; the error only ever goes toward serving 200.
  const knownRoute = (pathname: string) =>
    !routePatterns ||
    routePatterns.some((pattern) => routePatternMatches(pattern.toLowerCase(), pathname.toLowerCase()));

  // fall through to route-specific HTML first, then the SPA shell.
  app.use((req, res) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.sendStatus(404);
      return;
    }

    const hasExtension = path.extname(req.path) !== "";
    if (!hasExtension) {
      const cleanedPath = req.path.replace(/\/+$/, "") || "/";
      const candidateHtmlPath =
        cleanedPath === "/"
          ? indexPath
          : path.resolve(distPath, cleanedPath.slice(1), "index.html");

      const relativeToDist = path.relative(distPath, candidateHtmlPath);
      const isWithinDist =
        relativeToDist === "index.html" ||
        (!relativeToDist.startsWith("..") && !path.isAbsolute(relativeToDist));

      const candidateHtml =
        isWithinDist ? readCachedHtml(candidateHtmlPath) : null;
      if (candidateHtml) {
        res.status(200).type("html").send(candidateHtml);
        return;
      }
    }

    const known = knownRoute(req.path);
    if (hasExtension && !known) {
      // A missing file (an old chunk, a mistyped icon) is not a page.
      res.sendStatus(404);
      return;
    }

    // The shell still boots the app, which renders the not-found page; only
    // the status changes, so crawlers and link checkers see a real 404.
    res
      .status(known ? 200 : 404)
      .type("html")
      .send(stampAppClipBanner(stampCanvasSurface(shellHtml, req.path), req.path));
  });
}
