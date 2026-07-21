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
    expect(payload.stages.map((stage: { key: string }) => stage.key)).toContain("upload_to_package");
    expect(payload.customerFacingStatus).toMatchObject({
      status: "on_track",
      active_stage: "scoping",
    });
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

  it("lists operator SLA trackers with active stage and customer-facing delayed semantics", async () => {
    mockGet.mockResolvedValueOnce({
      docs: [
        {
          id: "req_789",
          data: () => ({
            requestId: "req_789",
            buyerEmail: "buyer@example.com",
            currentStage: "upload_to_package",
            status: "breached",
            createdAt: "2026-07-08T10:00:00.000Z",
            completedAt: null,
            stages: [
              {
                key: "upload_to_package",
                slaHours: 48,
                startedAt: "2026-07-08T10:00:00.000Z",
                deadline: "2026-07-10T10:00:00.000Z",
                completedAt: null,
                status: "breached",
                escalations: [],
              },
            ],
          }),
        },
      ],
    });

    const { listOperatorSlaTrackers } = await import("../utils/sla-enforcement");
    const result = await listOperatorSlaTrackers({
      status: "breached",
      stage: "upload_to_package",
      limit: 10,
    });

    expect(result.trackers).toHaveLength(1);
    expect(result.trackers[0]).toMatchObject({
      id: "req_789",
      request_id: "req_789",
      status: "breached",
      current_stage: "upload_to_package",
      customer_facing_status: {
        label: "Delayed",
        active_stage: "upload_to_package",
      },
    });
    expect(result.customer_status_semantics.breached.message).toMatch(/missed its target window/i);
  });
});
