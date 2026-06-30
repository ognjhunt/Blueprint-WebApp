import express, { type Express } from "express";
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { type Server } from "http";
import viteConfig from "../vite.config";

export async function setupVite(app: Express, server: Server) {
  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: {
      middlewareMode: true,
      hmr: { server },
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
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express, distPathOverride?: string) {
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

    res.status(200).type("html").send(shellHtml);
  });
}
