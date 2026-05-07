// @vitest-environment node
import express from "express";
import { createServer } from "http";
import type { Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";

const dispatchCityLaunchFounderApproval = vi.hoisted(() => vi.fn());

vi.mock("../middleware/verifyFirebaseToken", () => ({
  default: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../middleware/requireAdminRole", () => ({
  requireAdminRole: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../utils/cityLaunchApprovalDispatch", () => ({
  dispatchCityLaunchFounderApproval,
}));

async function startServer() {
  const { default: cityLaunchRouter } = await import("../routes/city-launch");
  const app = express();
  app.use(express.json());
  app.use("/api/city-launch", cityLaunchRouter);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("City launch route test server failed to bind.");
  }

  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
}

async function stopServer(server: Server) {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}

afterEach(() => {
  dispatchCityLaunchFounderApproval.mockReset();
  vi.resetModules();
});

describe("city launch routes", () => {
  it("accepts founder-facing budget tiers when dispatching approval packets", async () => {
    dispatchCityLaunchFounderApproval.mockResolvedValue({
      dispatched: true,
      blockerId: "city-launch-approval-austin-tx",
      emailSent: false,
      slackMirrored: true,
    });

    const { server, baseUrl } = await startServer();
    try {
      const response = await fetch(`${baseUrl}/api/city-launch/approvals/dispatch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          city: "Austin, TX",
          budgetTier: "lean",
          budgetMaxUsd: 2_500,
          operatorAutoApproveUsd: 500,
        }),
      });
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload).toMatchObject({
        ok: true,
        blockerId: "city-launch-approval-austin-tx",
      });
      expect(dispatchCityLaunchFounderApproval).toHaveBeenCalledWith({
        city: "Austin, TX",
        budgetPolicy: expect.objectContaining({
          tier: "lean",
          maxTotalApprovedUsd: 2_500,
          operatorAutoApproveUsd: 500,
        }),
      });
    } finally {
      await stopServer(server);
    }
  });
});
