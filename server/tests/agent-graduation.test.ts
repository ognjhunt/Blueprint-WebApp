// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGet = vi.fn();
const mockSet = vi.fn();

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
        get: mockGet,
      })),
    })),
  },
}));

describe("agent graduation", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("recommends promotion when the lane clears the threshold", async () => {
    const createdAt = new Date().toISOString();
    const actions = Array.from({ length: 24 }, () => ({
      data: () => ({ status: "sent", created_at_iso: createdAt }),
    })).concat([
      {
        data: () => ({ status: "rejected", created_at_iso: createdAt }),
      },
    ]);

    mockGet
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({
          currentPhase: 1,
          phaseStartedAt: new Date(Date.now() - 15 * 86_400_000).toISOString(),
        }),
      })
      .mockResolvedValueOnce({ docs: actions });

    const { evaluateGraduationStatus } = await import("../utils/agent-graduation");
    const result = await evaluateGraduationStatus("waitlist");

    expect(result.recommendation).toBe("promote");
    expect(result.metrics.volume).toBe(25);
    expect(result.metrics.accuracy).toBeGreaterThanOrEqual(0.9);
  });

  it("holds when volume is too low", async () => {
    const createdAt = new Date().toISOString();
    const actions = Array.from({ length: 5 }, () => ({
      data: () => ({ status: "sent", created_at_iso: createdAt }),
    }));

    mockGet
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({
          currentPhase: 1,
          phaseStartedAt: new Date(Date.now() - 20 * 86_400_000).toISOString(),
        }),
      })
      .mockResolvedValueOnce({ docs: actions });

    const { evaluateGraduationStatus } = await import("../utils/agent-graduation");
    const result = await evaluateGraduationStatus("waitlist");

    expect(result.recommendation).toBe("hold");
  });

  it("recommends demotion when accuracy collapses", async () => {
    const createdAt = new Date().toISOString();
    const actions = Array.from({ length: 6 }, () => ({
      data: () => ({ status: "sent", created_at_iso: createdAt }),
    })).concat(
      Array.from({ length: 4 }, () => ({
        data: () => ({ status: "failed", created_at_iso: createdAt }),
      })),
    );

    mockGet
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({
          currentPhase: 2,
          phaseStartedAt: new Date(Date.now() - 40 * 86_400_000).toISOString(),
        }),
      })
      .mockResolvedValueOnce({ docs: actions });

    const { evaluateGraduationStatus } = await import("../utils/agent-graduation");
    const result = await evaluateGraduationStatus("support_triage");

    expect(result.recommendation).toBe("demote");
  });

  it("promotes a lane manually", async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        currentPhase: 1,
        metrics: { accuracy: 1, volume: 10, approvedCount: 10, rejectedCount: 0, failedCount: 0, pendingCount: 0, daysInPhase: 14 },
      }),
    });

    const { promoteAgentLane } = await import("../utils/agent-graduation");
    const result = await promoteAgentLane("waitlist", "ops@tryblueprint.io");

    expect(result.currentPhase).toBe(2);
    expect(mockSet).toHaveBeenCalled();
  });
});
