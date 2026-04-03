// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGet = vi.fn();
const mockSet = vi.fn();
const mockExecuteAction = vi.fn();

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  default: {
    firestore: {
      FieldValue: {
        serverTimestamp: () => "SERVER_TIMESTAMP",
      },
    },
  },
  dbAdmin: {
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        get: mockGet,
        set: mockSet,
      })),
      where: vi.fn(() => ({
        limit: vi.fn(() => ({
          get: mockGet,
        })),
      })),
      orderBy: vi.fn(() => ({
        limit: vi.fn(() => ({
          get: mockGet,
        })),
      })),
      limit: vi.fn(() => ({
        get: mockGet,
      })),
    })),
  },
}));

vi.mock("../agents/action-executor", () => ({
  executeAction: mockExecuteAction,
}));

describe("renewal tracking", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockExecuteAction.mockResolvedValue({ state: "sent", ledgerDocId: "ledger_123" });
  });

  it("initializes renewal tracking", async () => {
    mockGet.mockResolvedValueOnce({ exists: false });
    const { initRenewalTracking } = await import("../utils/growth-ops");

    await initRenewalTracking({
      entitlementId: "ent_123",
      orderId: "order_123",
      buyerEmail: "buyer@example.com",
      skuName: "Exact-Site Hosted Review",
      licenseTier: "commercial",
      grantedAt: new Date().toISOString(),
    });

    expect(mockSet).toHaveBeenCalledTimes(1);
  });

  it("sends renewal outreach in the renewal window", async () => {
    mockGet.mockResolvedValueOnce({
      docs: [
        {
          data: () => ({
            entitlementId: "ent_123",
            orderId: "order_123",
            buyerEmail: "buyer@example.com",
            skuName: "Exact-Site Hosted Review",
            licenseTier: "commercial",
            grantedAt: new Date(Date.now() - 76 * 86_400_000).toISOString(),
            status: "not_due",
            outreachHistory: [],
          }),
          ref: { set: mockSet },
        },
      ],
    });

    const { runRenewalOutreach } = await import("../utils/growth-ops");
    const result = await runRenewalOutreach({ limit: 10 });

    expect(result.processedCount).toBe(1);
    expect(mockExecuteAction).toHaveBeenCalled();
  });
});
