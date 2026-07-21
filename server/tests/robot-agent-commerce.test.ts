// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer } from "http";
import type { Server } from "node:http";

vi.mock("../utils/accounting", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../utils/accounting")>();
  return {
    ...actual,
    fetchBuyerOrder: vi.fn(async () => null),
  };
});

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
          license_term_hours: 2,
          license_term_unit: "hour",
        },
      });

      const orderId = String(((checkoutPayload.order as Record<string, unknown>) || {}).id || "");
      const checkoutEntitlement = (checkoutPayload.entitlement as Record<string, unknown>) || {};
      const entitlementId = String(checkoutEntitlement.id || "");
      expect(orderId).toBeTruthy();
      expect(entitlementId).toBeTruthy();
      expect(checkoutEntitlement.expires_at).toEqual(expect.any(String));
      const grantedAt = Date.parse(String(checkoutEntitlement.granted_at || ""));
      const expiresAt = Date.parse(String(checkoutEntitlement.expires_at || ""));
      expect(expiresAt - grantedAt).toBe(2 * 60 * 60 * 1000);

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
          license_term_hours: 2,
          license_term_unit: "hour",
        },
      });
    } finally {
      await stopServer(server);
    }
  });

  it("advertises ask and live commerce in the discovery manifest", async () => {
    const { server, baseUrl } = await startServer();
    try {
      const response = await fetch(`${baseUrl}/api/agent-access`);
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        ask: {
          endpoint: "/api/agent-access/ask",
          mcpTool: "blueprint.ask",
        },
        liveCommerce: {
          mode: "live",
          liveStripeTouched: true,
          serverPricedSku: true,
          endpoints: {
            liveCheckout: "/api/agent-access/commerce/live-checkout",
            liveOrder: "/api/agent-access/commerce/live-orders/{orderId}",
          },
          tools: expect.arrayContaining(["blueprint.commerce.checkoutLive", "blueprint.commerce.liveOrder.get"]),
        },
        truthLabels: expect.arrayContaining(["live_checkout"]),
      });
    } finally {
      await stopServer(server);
    }
  });

  it("blocks live checkout with structured blockers instead of charging for non-purchasable supply", async () => {
    const { server, baseUrl } = await startServer();
    try {
      const response = await fetch(`${baseUrl}/api/agent-access/commerce/live-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "live",
          siteWorldId: "sw-chi-01",
          product: "hosted_session_rental",
          sessionHours: 2,
          budgetCents: 100,
        }),
      });
      expect(response.status).toBe(409);
      const payload = (await response.json()) as Record<string, unknown>;
      expect(payload).toMatchObject({
        code: "live_checkout_blocked",
        mode: "live",
        withinBudget: false,
      });
      const blockerCodes = (payload.blockers as Array<{ code: string }>).map((blocker) => blocker.code);
      expect(blockerCodes).toContain("budget_exceeded");
      expect(blockerCodes.some((code) => code === "not_live_purchasable" || code === "site_world_not_found")).toBe(true);
    } finally {
      await stopServer(server);
    }
  });

  it("returns 404 for unknown live orders without leaking buyer data", async () => {
    const { server, baseUrl } = await startServer();
    try {
      const response = await fetch(`${baseUrl}/api/agent-access/commerce/live-orders/not-a-real-order`);
      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toMatchObject({ error: "Live agent order not found" });
    } finally {
      await stopServer(server);
    }
  });

  it("answers grounded agent questions with citations and machine next-actions", async () => {
    const { server, baseUrl } = await startServer();
    try {
      const response = await fetch(
        `${baseUrl}/api/agent-access/ask?q=${encodeURIComponent("How can an agent with a budget buy a hosted session?")}`,
      );
      expect(response.status).toBe(200);
      const payload = (await response.json()) as Record<string, unknown>;
      expect(payload).toMatchObject({
        bestAnswer: { id: "how-to-buy-live" },
        noConfidentMatch: false,
      });
      const bestAnswer = payload.bestAnswer as { citations: string[]; actions: Array<{ endpoint: string }> };
      expect(bestAnswer.citations.length).toBeGreaterThan(0);
      expect(bestAnswer.actions.map((action) => action.endpoint).join(" ")).toContain("live-checkout");

      const missing = await fetch(`${baseUrl}/api/agent-access/ask`);
      expect(missing.status).toBe(400);
    } finally {
      await stopServer(server);
    }
  });
});

describe("agent live checkout eligibility", () => {
  it("gates live checkout to pipeline-backed site worlds and enforces the budget guard", async () => {
    const commerce = await import("../utils/robot-agent-commerce");
    const buyer = { email: "agent-buyer@example.com" };
    const pipelineSiteWorld = {
      id: "sw-live-1",
      siteName: "Pipeline Site",
      dataSource: "pipeline",
      packages: [
        { name: "Hosted Session Rental", summary: "Hourly hosted review", priceLabel: "$18 / hour" },
      ],
    } as unknown as Parameters<typeof commerce.evaluateAgentLiveCheckoutEligibility>[1];

    const eligible = commerce.evaluateAgentLiveCheckoutEligibility(
      { siteWorldId: "sw-live-1", mode: "live", product: "hosted_session_rental", sessionHours: 2, budgetCents: 10000, buyer },
      pipelineSiteWorld,
      { stripeConfigured: true },
    );
    expect(eligible.eligible).toBe(true);
    expect(eligible.quote.mode).toBe("live");
    expect(eligible.quote.priceSource).toBe("catalog");
    expect(eligible.quote.totalAmountCents).toBe(3600);
    expect(eligible.withinBudget).toBe(true);
    expect(eligible.quote.truthLabels).toContain("live_checkout");

    const overBudget = commerce.evaluateAgentLiveCheckoutEligibility(
      { siteWorldId: "sw-live-1", mode: "live", product: "hosted_session_rental", sessionHours: 2, budgetCents: 100, buyer },
      pipelineSiteWorld,
      { stripeConfigured: true },
    );
    expect(overBudget.eligible).toBe(false);
    expect(overBudget.blockers.map((blocker) => blocker.code)).toEqual(["budget_exceeded"]);

    const staticSiteWorld = { ...pipelineSiteWorld, dataSource: "static" } as typeof pipelineSiteWorld;
    const notPurchasable = commerce.evaluateAgentLiveCheckoutEligibility(
      { siteWorldId: "sw-live-1", mode: "live", product: "hosted_session_rental", buyer },
      staticSiteWorld,
      { stripeConfigured: true },
    );
    expect(notPurchasable.eligible).toBe(false);
    expect(notPurchasable.blockers.map((blocker) => blocker.code)).toEqual(["not_live_purchasable"]);

    const noStripe = commerce.evaluateAgentLiveCheckoutEligibility(
      { siteWorldId: "sw-live-1", mode: "live", buyer },
      pipelineSiteWorld,
      { stripeConfigured: false },
    );
    expect(noStripe.eligible).toBe(false);
    expect(noStripe.blockers.map((blocker) => blocker.code)).toEqual(["stripe_unavailable"]);

    expect(() =>
      commerce.evaluateAgentLiveCheckoutEligibility(
        { siteWorldId: "sw-live-1", mode: "dry_run", buyer },
        pipelineSiteWorld,
        { stripeConfigured: true },
      ),
    ).toThrow(/mode=live/);
  });

  it("never charges the planning-default price and requires a buyer identity", async () => {
    const commerce = await import("../utils/robot-agent-commerce");
    // Pipeline fallback packages: "Site Package" is quoted-per-site and the
    // evaluation set is a different product, so hosted rental has no catalog price.
    const unpricedPipelineSiteWorld = {
      id: "sw-live-2",
      siteName: "Pipeline Fallback Site",
      dataSource: "pipeline",
      packages: [
        { name: "Site Package", summary: "Qualified package", priceLabel: "Quoted per site" },
        { name: "Policy Evaluation Set", summary: "Evaluation setup", priceLabel: "$6,500 / site evaluation" },
      ],
    } as unknown as Parameters<typeof commerce.evaluateAgentLiveCheckoutEligibility>[1];

    const unpriced = commerce.evaluateAgentLiveCheckoutEligibility(
      { siteWorldId: "sw-live-2", mode: "live", product: "hosted_session_rental", sessionHours: 2, buyer: { email: "a@b.com" } },
      unpricedPipelineSiteWorld,
      { stripeConfigured: true },
    );
    expect(unpriced.quote.priceSource).toBe("default");
    expect(unpriced.eligible).toBe(false);
    expect(unpriced.blockers.map((blocker) => blocker.code)).toEqual(["price_unavailable"]);

    const pricedSiteWorld = {
      ...unpricedPipelineSiteWorld,
      packages: [{ name: "Hosted Session Rental", summary: "Hourly", priceLabel: "$18 / hour" }],
    } as typeof unpricedPipelineSiteWorld;
    const anonymous = commerce.evaluateAgentLiveCheckoutEligibility(
      { siteWorldId: "sw-live-2", mode: "live", product: "hosted_session_rental" },
      pricedSiteWorld,
      { stripeConfigured: true },
    );
    expect(anonymous.eligible).toBe(false);
    expect(anonymous.blockers.map((blocker) => blocker.code)).toEqual(["buyer_identity_required"]);

    const authenticated = commerce.evaluateAgentLiveCheckoutEligibility(
      { siteWorldId: "sw-live-2", mode: "live", product: "hosted_session_rental" },
      pricedSiteWorld,
      { stripeConfigured: true, authenticatedBuyerUid: "robot-team-uid" },
    );
    expect(authenticated.eligible).toBe(true);
  });

  it("keeps Stripe redirect URLs on the site origin", async () => {
    const commerce = await import("../utils/robot-agent-commerce");
    const base = "https://tryblueprint.io";
    const fallback = "/agents?live_checkout=success";
    const resolve = (value: unknown) => commerce.sanitizeLiveCheckoutRedirect(value, fallback, base);

    expect(resolve("/agents?done=1")).toBe("https://tryblueprint.io/agents?done=1");
    expect(resolve("//evil.example/path")).toBe(`${base}${fallback}`);
    expect(resolve("/\\evil.example/path")).toBe(`${base}${fallback}`);
    expect(resolve("https://evil.example/path")).toBe(`${base}${fallback}`);
    expect(resolve("")).toBe(`${base}${fallback}`);
    expect(resolve(null)).toBe(`${base}${fallback}`);
  });

  it("recognizes agent commerce SKUs for live order lookups", async () => {
    const commerce = await import("../utils/robot-agent-commerce");
    expect(commerce.isAgentCommerceSku("hosted-session-sw-chi-01")).toBe(true);
    expect(commerce.isAgentCommerceSku("site-world-package-sw-chi-01")).toBe(true);
    expect(commerce.isAgentCommerceSku("chicago-scene-bundle-commercial")).toBe(false);
  });
});
