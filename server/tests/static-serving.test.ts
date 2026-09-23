// @vitest-environment node
import express from "express";
import fs from "fs/promises";
import http from "http";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";

import { serveStatic } from "../vite";

const tmpRoots: string[] = [];
const servers: http.Server[] = [];

async function createStaticServer(routePatterns?: string[] | null) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-static-"));
  tmpRoots.push(root);

  await fs.mkdir(path.join(root, "pricing"), { recursive: true });
  await fs.writeFile(path.join(root, "index.html"), "home shell", "utf8");
  await fs.writeFile(
    path.join(root, "pricing", "index.html"),
    "pricing shell",
    "utf8",
  );

  const app = express();
  serveStatic(app, root, { routePatterns: routePatterns === undefined ? null : routePatterns });

  const server = http.createServer(app);
  servers.push(server);
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Static test server did not bind to a TCP address.");
  }

  return `http://127.0.0.1:${address.port}`;
}

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        }),
    ),
  );

  await Promise.all(
    tmpRoots.splice(0).map((root) =>
      fs.rm(root, { recursive: true, force: true }),
    ),
  );
});

describe("serveStatic", () => {
  it("serves route-specific prerendered HTML for extensionless routes", async () => {
    const baseUrl = await createStaticServer();

    const response = await fetch(`${baseUrl}/pricing`);

    await expect(response.text()).resolves.toBe("pricing shell");
    expect(response.status).toBe(200);
  });

  it("handles HEAD requests for extensionless prerendered routes", async () => {
    const baseUrl = await createStaticServer();

    const response = await fetch(`${baseUrl}/pricing`, { method: "HEAD" });

    expect(response.status).toBe(200);
  });

  it("answers a path no client route renders with a real 404, still booting the app", async () => {
    const baseUrl = await createStaticServer(["/", "/pricing", "/sites/:slug"]);

    const missing = await fetch(`${baseUrl}/no-such-page`);
    expect(missing.status).toBe(404);
    await expect(missing.text()).resolves.toBe("home shell");

    expect((await fetch(`${baseUrl}/sites/any-site`)).status).toBe(200);
    expect((await fetch(`${baseUrl}/Pricing/`)).status).toBe(200);
    expect((await fetch(`${baseUrl}/sites/a/b`)).status).toBe(404);
  });

  it("does not answer a missing file with the HTML shell", async () => {
    const baseUrl = await createStaticServer(["/"]);

    const response = await fetch(`${baseUrl}/assets/gone-abc123.js`);
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type") ?? "").not.toMatch(/html/);
  });

  it("keeps serving 200 when the build did not write route patterns", async () => {
    const baseUrl = await createStaticServer(null);

    expect((await fetch(`${baseUrl}/no-such-page`)).status).toBe(200);
  });
});
