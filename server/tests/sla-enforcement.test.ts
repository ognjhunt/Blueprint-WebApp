// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGet = vi.fn();
const mockSet = vi.fn();
const mockExecuteAction = vi.fn();
const mockSendSlackMessage = vi.fn();

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

vi.mock("../utils/slack", () => ({
  sendSlackMessage: mockSendSlackMessage,
}));

describe("sla enforcement", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockExecuteAction.mockResolvedValue({ state: "sent", ledgerDocId: "ledger_123" });
    mockSendSlackMessage.mockResolvedValue({ sent: true });
  });

  it("creates an SLA tracker", async () => {
    mockGet.mockResolvedValueOnce({ exists: false });
    const { createSlaTracker } = await import("../utils/sla-enforcement");

    await createSlaTracker({ requestId: "req_123", buyerEmail: "buyer@example.com" });

    expect(mockSet).toHaveBeenCalledTimes(1);
    const payload = mockSet.mock.calls[0]?.[0];
    expect(payload.currentStage).toBe("scoping");
  });

  it("marks an SLA as at risk when nearing the deadline", async () => {
    mockGet.mockResolvedValueOnce({
      docs: [
        {
          data: () => ({
            requestId: "req_123",
            buyerEmail: "buyer@example.com",
            status: "on_track",
            stages: [
              {
                key: "scoping",
                slaHours: 24,
                startedAt: new Date(Date.now() - 20 * 3_600_000).toISOString(),
                deadline: new Date(Date.now() + 4 * 3_600_000).toISOString(),
                completedAt: null,
                status: "active",
                escalations: [],
              },
            ],
          }),
          ref: { set: mockSet },
        },
      ],
    });

    const { runSlaWatchdog } = await import("../utils/sla-enforcement");
    const result = await runSlaWatchdog({ limit: 10 });

    expect(result.processedCount).toBe(1);
  });

  it("breaches the SLA after the deadline", async () => {
    mockGet.mockResolvedValueOnce({
      docs: [
        {
          data: () => ({
            requestId: "req_456",
            buyerEmail: "buyer@example.com",
            status: "on_track",
            stages: [
              {
                key: "scoping",
                slaHours: 24,
                startedAt: new Date(Date.now() - 25 * 3_600_000).toISOString(),
                deadline: new Date(Date.now() - 1_000).toISOString(),
                completedAt: null,
                status: "active",
                escalations: [],
              },
            ],
          }),
          ref: { set: mockSet },
        },
      ],
    });

    const { runSlaWatchdog } = await import("../utils/sla-enforcement");
    const result = await runSlaWatchdog({ limit: 10 });

    expect(result.processedCount).toBe(1);
    expect(mockExecuteAction).toHaveBeenCalled();
  });
});
