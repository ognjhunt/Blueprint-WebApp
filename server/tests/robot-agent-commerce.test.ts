// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import express from "express";
import { createServer } from "http";
import type { Server } from "node:http";

async function startServer() {
  const { default: router } = await import("../routes/agent-access");
  const app = express();
  app.use(express.json());
  app.use("/api/agent-access", router);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind test server");
  }
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function stopServer(server: Server) {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

afterEach(async () => {
  const commerce = await import("../utils/robot-agent-commerce");
  commerce.resetAgentDryRunCommerceForTests();
});

describe("robot agent dry-run commerce", () => {
  it("publishes a credential-free agent discovery manifest with search, dry-run commerce, and truth labels", async () => {
    const { server, baseUrl } = await startServer();
    try {
      const response = await fetch(`${baseUrl}/api/agent-access`);
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        preferredTool: "blueprint.siteWorld.search",
        compatibilityTool: "blueprint.catalog.search",
        publicDemo: {
          canRunWithoutCredentials: true,
        },
        dryRunCommerce: {
          liveStripeTouched: false,
          endpoints: expect.objectContaining({
            quote: "/api/agent-access/commerce/quote",
            dryRunCheckout: "/api/agent-access/commerce/dry-run-checkout",
            entitlementReadiness: "/api/agent-access/commerce/entitlement-readiness",
          }),
        },
        requestCandidate: {
          grantsAccess: false,
        },
        truthLabels: expect.arrayContaining(["capture_grounded", "request_gated", "dry_run_order"]),
      });
    } finally {
      await stopServer(server);
    }
  });

  it("quotes a hosted-session rental and creates a dry-run order with a provisioned entitlement", async () => {
    const { server, baseUrl } = await startServer();
    try {
      const quote = await fetch(
        `${baseUrl}/api/agent-access/commerce/quote?siteWorldId=sw-chi-01&product=hosted_session_rental&sessionHours=2`,
      );
      expect(quote.status).toBe(200);
      await expect(quote.json()).resolves.toMatchObject({
        quote: {
          mode: "dry_run",
          product: "hosted_session_rental",
          siteWorldId: "sw-chi-01",
          sku: "hosted-session-sw-chi-01",
          quantity: 2,
          totalAmountCents: 3600,
        },
      });

      const checkout = await fetch(`${baseUrl}/api/agent-access/commerce/dry-run-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "dry_run",
          siteWorldId: "sw-chi-01",
          product: "hosted_session_rental",
          sessionHours: 2,
          buyer: { uid: "robot-team-1", email: "robot@example.com" },
        }),
      });
      const checkoutPayload = (await checkout.json()) as Record<string, unknown>;
      expect(checkout.status).toBe(201);
      expect(checkoutPayload).toMatchObject({
        order: {
          status: "fulfilled",
          payment_status: "dry_run_paid",
          fulfillment_status: "provisioned",
          item: { sku: "hosted-session-sw-chi-01", item_type: "hosted_session_rental" },
        },
        receipt: {
          mode: "dry_run",
          liveStripeTouched: false,
        },
        entitlement: {
          access_state: "provisioned",
          sku: "hosted-session-sw-chi-01",
        },
      });

      const orderId = String(((checkoutPayload.order as Record<string, unknown>) || {}).id || "");
      const entitlementId = String(((checkoutPayload.entitlement as Record<string, unknown>) || {}).id || "");
      expect(orderId).toBeTruthy();
      expect(entitlementId).toBeTruthy();

      const order = await fetch(`${baseUrl}/api/agent-access/commerce/orders/${orderId}`);
      expect(order.status).toBe(200);
      await expect(order.json()).resolves.toMatchObject({
        order: { id: orderId },
        entitlement: { id: entitlementId },
      });

      const entitlement = await fetch(`${baseUrl}/api/agent-access/commerce/entitlements/${entitlementId}`);
      expect(entitlement.status).toBe(200);
      await expect(entitlement.json()).resolves.toMatchObject({
        entitlement: {
          id: entitlementId,
          access_state: "provisioned",
          dry_run: true,
        },
      });
    } finally {
      await stopServer(server);
    }
  });
});
