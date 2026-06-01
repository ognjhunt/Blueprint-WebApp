// @vitest-environment node
import express from "express";
import { createServer } from "node:http";
import type { Server } from "node:http";
import { describe, expect, it } from "vitest";

async function startServer() {
  const { default: siteContentRouter } = await import("../routes/site-content");
  const app = express();
  app.use("/api/site-content", siteContentRouter);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("server failed to bind");
  }
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
}

async function stopServer(server: Server) {
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

describe("site-content route", () => {
  it("returns capture-grounded public summaries without upgrading support signals into operational proof", async () => {
    const { server, baseUrl } = await startServer();
    try {
      const response = await fetch(`${baseUrl}/api/site-content`);
      expect(response.status).toBe(200);
      const payload = (await response.json()) as {
        summary: string;
        definitions: Array<{ term: string; definition: string }>;
        safety: string;
      };

      expect(payload.summary).toContain("lawful indoor capture");
      expect(payload.summary).toContain("buyer decision workflows");
      expect(payload.definitions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            term: "Ground-truth boundary",
            definition: expect.stringContaining("Ground truth means raw capture evidence"),
          }),
        ]),
      );
      expect(payload.safety).toContain("provider execution");
      expect(payload.safety).toContain("owner-system evidence");
      expect(payload.safety).not.toMatch(/coming soon|not launched|not ready|placeholder/i);
    } finally {
      await stopServer(server);
    }
  });
});
