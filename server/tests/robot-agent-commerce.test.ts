// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../utils/accounting", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../utils/accounting")>();
  return {
    ...actual,
    fetchBuyerOrder: vi.fn(async () => null),
  };
});

afterEach(async () => {
  const commerce = await import("../utils/robot-agent-commerce");
  commerce.resetAgentDryRunCommerceForTests();
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
