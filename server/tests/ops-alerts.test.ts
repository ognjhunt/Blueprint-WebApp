// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

type StoredDoc = Record<string, unknown>;

const state = vi.hoisted(() => ({
  docs: new Map<string, StoredDoc>(),
  sendSlackMessage: vi.fn(),
}));

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function docKey(collection: string, id: string): string {
  return `${collection}/${id}`;
}

function readDoc(collection: string, id: string): StoredDoc | undefined {
  const stored = state.docs.get(docKey(collection, id));
  return stored ? clone(stored) : undefined;
}

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  dbAdmin: {
    collection: (collection: string) => ({
      doc: (id: string) => ({
        id,
        get: async () => {
          const data = readDoc(collection, id);
          return {
            id,
            exists: Boolean(data),
            data: () => (data ? clone(data) : undefined),
          };
        },
        set: async (payload: StoredDoc, options?: { merge?: boolean }) => {
          const existing = readDoc(collection, id) || {};
          state.docs.set(
            docKey(collection, id),
            options?.merge ? { ...existing, ...clone(payload) } : clone(payload),
          );
        },
      }),
    }),
  },
}));

vi.mock("../utils/slack", () => ({
  sendSlackMessage: state.sendSlackMessage,
}));

afterEach(() => {
  state.docs.clear();
  state.sendSlackMessage.mockReset();
  delete process.env.BLUEPRINT_OPS_ALERT_THRESHOLD_BUYER_ARTIFACT_ACCESS_FAILURE;
});

describe("ops alerts", () => {
  it("persists counters, opens thresholded alerts, and dedupes Slack notifications", async () => {
    process.env.BLUEPRINT_OPS_ALERT_THRESHOLD_BUYER_ARTIFACT_ACCESS_FAILURE = "2";
    const { recordBetaOpsFailureSignal } = await import("../utils/ops-alerts");

    await expect(
      recordBetaOpsFailureSignal({
        kind: "buyer_artifact_access_failure",
        scopeId: "ent-123",
        summary: "Signed URL failed",
      }),
    ).resolves.toMatchObject({
      recorded: true,
      alertOpened: false,
      eventCount: 1,
      threshold: 2,
    });
    expect(readDoc("opsAlertSignals", "buyer_artifact_access_failure:ent-123")).toMatchObject({
      event_count: 1,
      threshold: 2,
    });
    expect(readDoc("opsAlerts", "buyer_artifact_access_failure:ent-123")).toBeUndefined();
    expect(state.sendSlackMessage).not.toHaveBeenCalled();

    await expect(
      recordBetaOpsFailureSignal({
        kind: "buyer_artifact_access_failure",
        scopeId: "ent-123",
        summary: "Signed URL failed again",
      }),
    ).resolves.toMatchObject({
      recorded: true,
      alertOpened: true,
      eventCount: 2,
      threshold: 2,
    });
    expect(readDoc("opsAlerts", "buyer_artifact_access_failure:ent-123")).toMatchObject({
      status: "open",
      kind: "buyer_artifact_access_failure",
      scope_id: "ent-123",
      event_count: 2,
      requires_human_review: true,
    });
    expect(state.sendSlackMessage).toHaveBeenCalledTimes(1);

    await expect(
      recordBetaOpsFailureSignal({
        kind: "buyer_artifact_access_failure",
        scopeId: "ent-123",
        summary: "Signed URL failed a third time",
      }),
    ).resolves.toMatchObject({
      recorded: true,
      alertOpened: false,
      eventCount: 3,
      threshold: 2,
    });
    expect(state.sendSlackMessage).toHaveBeenCalledTimes(1);
  });
});
