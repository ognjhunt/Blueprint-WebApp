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
    })),
  },
}));

vi.mock("../agents/action-executor", () => ({
  executeAction: mockExecuteAction,
}));

describe("buyer onboarding", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockExecuteAction.mockResolvedValue({ state: "sent", ledgerDocId: "ledger_123" });
  });

  it("creates a four-step hosted-review buyer-success sequence", async () => {
    mockGet.mockResolvedValueOnce({ exists: false });

    const { createOnboardingSequence } = await import("../utils/buyer-onboarding");
    await createOnboardingSequence({
      orderId: "order_123",
      buyerEmail: "buyer@example.com",
      skuName: "Exact-Site Hosted Review",
      licenseTier: "commercial",
    });

    expect(mockSet).toHaveBeenCalledTimes(1);
    const payload = mockSet.mock.calls[0]?.[0];
    expect(payload.steps).toHaveLength(4);
    expect(payload.steps.map((step: { key: string }) => step.key)).toEqual([
      "access_day1",
      "first_run_day3",
      "blockers_day10",
      "feedback_day21",
    ]);
    expect(payload.steps[0].emailBody).toContain("confirm that your team can open the site-world");
    expect(payload.steps[3].emailBody).toContain("one useful artifact, one missing output");
  });

  it("processes due onboarding steps", async () => {
    mockGet.mockResolvedValueOnce({
      docs: [
        {
          data: () => ({
            orderId: "order_123",
            buyerEmail: "buyer@example.com",
            status: "active",
            steps: [
              {
                key: "welcome",
                scheduledAt: new Date(Date.now() - 1_000).toISOString(),
                sentAt: null,
                status: "pending",
                emailSubject: "Welcome",
                emailBody:
                  "This onboarding email is intentionally long enough to satisfy content validation and make the test realistic.",
              },
            ],
          }),
          ref: { set: mockSet },
        },
      ],
    });

    const { runOnboardingWorker } = await import("../utils/buyer-onboarding");
    const result = await runOnboardingWorker({ limit: 10 });

    expect(result.processedCount).toBe(1);
    expect(mockExecuteAction).toHaveBeenCalled();
  });
});
