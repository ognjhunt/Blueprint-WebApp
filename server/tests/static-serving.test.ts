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

async function createStaticServer() {
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
  serveStatic(app, root);

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
});
