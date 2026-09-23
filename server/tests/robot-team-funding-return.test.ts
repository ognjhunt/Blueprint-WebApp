// @vitest-environment node
/**
 * A top-up returns the payer to the task they were buying and leaves them a
 * receipt. Before, checkout came back to the bare task library, where the
 * confirmation rendered inside a closed section nobody opens.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const createSession = vi.hoisted(() => vi.fn(async () => ({ id: "cs_1", url: "https://checkout.stripe.test/cs_1" })));

vi.mock("../constants/stripe", () => ({
  stripeClient: { checkout: { sessions: { create: createSession } } },
  stripeAvailable: true,
}));
vi.mock("../../client/src/lib/firebaseAdmin", () => ({ default: {}, dbAdmin: null, storageAdmin: null }));
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

const { MIN_TOPUP_USD, startBalanceTopup } = await import("../utils/robotTeamFunding");
const { minTopupUsd } = await import("../../client/src/lib/evaluationPricing");

beforeEach(() => createSession.mockClear());

describe("starting a top-up", () => {
  it("returns to the task being bought and asks Stripe for a receipt", async () => {
    const result = await startBalanceTopup({
      teamId: "team-1", amountUsd: 99, contactEmail: "eng@alpha.example", returnSceneId: "req-1",
    });
    expect(result).toMatchObject({ created: true });
    const params = createSession.mock.calls[0][0] as Record<string, any>;
    expect(params.success_url).toMatch(/\/contact\/robot-team\?funded=1&sceneId=req-1$/);
    expect(params.cancel_url).toMatch(/\/contact\/robot-team\?funded=0&sceneId=req-1$/);
    expect(params.payment_intent_data).toEqual({ receipt_email: "eng@alpha.example" });
  });

  it("ignores a return task that is not a plain id", async () => {
    await startBalanceTopup({ teamId: "team-1", amountUsd: 99, returnSceneId: "x&funded=0" });
    const params = createSession.mock.calls[0][0] as Record<string, any>;
    expect(params.success_url).toMatch(/\/contact\/robot-team\?funded=1$/);
    expect(params.payment_intent_data).toBeUndefined();
  });
});

describe("the published minimum top-up", () => {
  it("is the one the server enforces", () => {
    // Pricing, the Terms and the plan preview all read `minTopupUsd`.
    expect(minTopupUsd).toBe(MIN_TOPUP_USD);
  });
});
