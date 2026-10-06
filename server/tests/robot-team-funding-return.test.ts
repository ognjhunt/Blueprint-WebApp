// @vitest-environment node
/**
 * A top-up returns the payer to the task they were buying and leaves them a
 * receipt. Before, checkout came back to the bare job library, where the
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

describe("starting a top-up during the free beta", () => {
  it.each([99, 1000, 0])("refuses %s before reaching Stripe", async amountUsd => {
    const result = await startBalanceTopup({ teamId: "team-1", amountUsd, contactEmail: "eng@example.test" });
    expect(result).toMatchObject({ created: false, refusal: "paid_evaluations_disabled" });
    expect(createSession).not.toHaveBeenCalled();
  });
});

describe("the published minimum top-up", () => {
  it("is the one the server enforces", () => {
    // Pricing, the Terms and the plan preview all read `minTopupUsd`.
    expect(minTopupUsd).toBe(MIN_TOPUP_USD);
  });
});
