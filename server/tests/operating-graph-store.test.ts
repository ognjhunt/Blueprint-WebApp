// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  writes: [] as Array<{
    collection: string;
    id: string;
    payload: Record<string, unknown>;
    options?: Record<string, unknown>;
  }>,
  eventsByEntityId: new Map<string, Array<Record<string, unknown>>>(),
}));

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  default: {
    firestore: {
      FieldValue: {
        serverTimestamp: () => "SERVER_TIMESTAMP",
      },
    },
  },
  dbAdmin: {
    collection: (name: string) => {
      if (name === "operatingGraphEvents") {
        return {
          doc: (id: string) => ({
            set: async (payload: Record<string, unknown>, options?: Record<string, unknown>) => {
              state.writes.push({ collection: name, id, payload, options });
              const entityId = String(payload.entity_id || "");
              if (entityId) {
                const existing = state.eventsByEntityId.get(entityId) || [];
                existing.push(payload);
                state.eventsByEntityId.set(entityId, existing);
              }
            },
          }),
          where: (field: string, _op: string, value: string) => ({
            get: async () => {
              if (field !== "entity_id") {
                return { docs: [] };
              }
              const docs = (state.eventsByEntityId.get(value) || []).map((payload) => ({
                data: () => payload,
              }));
              return { docs };
            },
          }),
        };
      }

      if (name === "operatingGraphState") {
        return {
          doc: (id: string) => ({
            set: async (payload: Record<string, unknown>, options?: Record<string, unknown>) => {
              state.writes.push({ collection: name, id, payload, options });
            },
          }),
        };
      }

      return {
        doc: (id: string) => ({
          set: async (payload: Record<string, unknown>, options?: Record<string, unknown>) => {
            state.writes.push({ collection: name, id, payload, options });
          },
        }),
      };
    },
  },
}));

describe("appendOperatingGraphEvent", () => {
  afterEach(() => {
    state.writes = [];
    state.eventsByEntityId = new Map();
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("persists a current-state projection alongside the immutable event", async () => {
    const { appendOperatingGraphEvent, buildCaptureRunId } = await import("../utils/operatingGraph");

    const captureRunId = buildCaptureRunId({ captureId: "capture-123" });

    await appendOperatingGraphEvent({
      eventKey: "capture:start",
      entityType: "capture_run",
      entityId: captureRunId,
      city: "Austin, TX",
      citySlug: "austin-tx",
      stage: "capture_in_progress",
      summary: "Capture started.",
      sourceRepo: "BlueprintCapture",
      sourceKind: "capture_lifecycle",
      origin: {
        repo: "BlueprintCapture",
        sourceCollection: "capture_submissions",
        sourceDocId: "capture-123",
      },
      metadata: {
        capture_id: "capture-123",
        site_submission_id: "site-9",
      },
      recordedAtIso: "2026-04-21T12:00:00.000Z",
    });

    expect(state.writes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          collection: "operatingGraphEvents",
        }),
        expect.objectContaining({
          collection: "operatingGraphState",
          id: captureRunId,
          payload: expect.objectContaining({
            state_key: captureRunId,
            entity_type: "capture_run",
            entity_id: captureRunId,
            current_stage: "capture_in_progress",
            latest_summary: "Capture started.",
            latest_event_at_iso: "2026-04-21T12:00:00.000Z",
          }),
        }),
      ]),
    );
  });
});
