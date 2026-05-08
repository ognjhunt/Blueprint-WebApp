// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const executeAction = vi.hoisted(() => vi.fn());

const dbState = vi.hoisted(() => {
  const stores = new Map<string, Map<string, Record<string, unknown>>>();
  let docCounter = 0;

  function storeFor(collectionName: string) {
    if (!stores.has(collectionName)) {
      stores.set(collectionName, new Map());
    }
    return stores.get(collectionName)!;
  }

  function makeSnapshot(
    collectionName: string,
    filters: Array<{ field: string; op: string; value: unknown }> = [],
    limitCount: number | null = null,
  ) {
    const docs = [...storeFor(collectionName).entries()]
      .filter(([, data]) =>
        filters.every((filter) => {
          if (filter.op === "==") return data[filter.field] === filter.value;
          if (filter.op === "in" && Array.isArray(filter.value)) {
            return filter.value.includes(data[filter.field]);
          }
          return false;
        }),
      )
      .slice(0, limitCount ?? undefined)
      .map(([id, data]) => ({
        id,
        data: () => data,
        ref: makeDocRef(collectionName, id),
      }));
    return { empty: docs.length === 0, docs, size: docs.length };
  }

  function makeQuery(
    collectionName: string,
    filters: Array<{ field: string; op: string; value: unknown }> = [],
    limitCount: number | null = null,
  ) {
    return {
      where(field: string, op: string, value: unknown) {
        return makeQuery(collectionName, [...filters, { field, op, value }], limitCount);
      },
      limit(count: number) {
        return makeQuery(collectionName, filters, count);
      },
      async get() {
        return makeSnapshot(collectionName, filters, limitCount);
      },
    };
  }

  function makeDocRef(collectionName: string, id: string) {
    return {
      id,
      async get() {
        const data = storeFor(collectionName).get(id);
        return { exists: Boolean(data), data: () => data ?? null };
      },
      async set(payload: Record<string, unknown>, options?: { merge?: boolean }) {
        const current = storeFor(collectionName).get(id) || {};
        storeFor(collectionName).set(id, options?.merge ? { ...current, ...payload } : payload);
      },
      async update(payload: Record<string, unknown>) {
        const current = storeFor(collectionName).get(id);
        if (!current) throw new Error(`Missing document ${collectionName}/${id}`);
        storeFor(collectionName).set(id, { ...current, ...payload });
      },
    };
  }

  return {
    collection: vi.fn((collectionName: string) => ({
      doc(id?: string) {
        return makeDocRef(collectionName, id || `${collectionName}-${++docCounter}`);
      },
      where(field: string, op: string, value: unknown) {
        return makeQuery(collectionName, [{ field, op, value }]);
      },
      limit(count: number) {
        return makeQuery(collectionName, [], count);
      },
      async get() {
        return makeSnapshot(collectionName);
      },
    })),
    set(collectionName: string, id: string, payload: Record<string, unknown>) {
      storeFor(collectionName).set(id, payload);
    },
    get(collectionName: string, id: string) {
      return storeFor(collectionName).get(id);
    },
    values(collectionName: string) {
      return [...storeFor(collectionName).values()];
    },
    clear() {
      stores.clear();
      docCounter = 0;
    },
  };
});

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  default: {
    firestore: {
      FieldValue: {
        serverTimestamp: () => "SERVER_TIMESTAMP",
      },
    },
  },
  dbAdmin: {
    collection: dbState.collection,
  },
}));

vi.mock("../agents/action-executor", () => ({
  executeAction,
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  dbState.clear();
  executeAction.mockResolvedValue({
    state: "pending_approval",
    tier: 3,
    ledgerDocId: "ledger-1",
  });
});

describe("lifecycle cadence contract", () => {
  it("builds persona-specific first-week and follow-up steps with agent owners", async () => {
    const { buildLifecycleCadenceSteps } = await import("../utils/lifecycle-cadence");
    const steps = buildLifecycleCadenceSteps({
      persona: "robot_team",
      email: "buyer@robotics.co",
      displayName: "Ada",
      sourceLabel: "North Dock",
      nowIso: "2026-05-07T12:00:00.000Z",
    });

    expect(steps.map((step) => step.dayOffset)).toEqual([0, 2, 5, 7, 14, 30]);
    expect(steps.map((step) => step.agentOwner)).toEqual([
      "robot-team-growth-agent",
      "robot-team-growth-agent",
      "robot-team-growth-agent",
      "robot-team-growth-agent",
      "robot-team-growth-agent",
      "robot-team-growth-agent",
    ]);
    expect(steps[0].subject).toContain("exact-site");
    expect(steps[0].body).toContain("one real site");
    expect(steps.every((step) => step.ctaQuestion.endsWith("?"))).toBe(true);
  });

  it("rejects reserved or placeholder recipient emails at enrollment", async () => {
    const { createLifecycleCadenceEnrollment } = await import("../utils/lifecycle-cadence");
    const result = await createLifecycleCadenceEnrollment({
      persona: "capturer",
      email: "person@example.com",
      sourceCollection: "waitlistSubmissions",
      sourceDocId: "waitlist-1",
    });

    expect(result).toMatchObject({
      created: false,
      reason: expect.stringMatching(/placeholder|reserved/i),
    });
    expect(dbState.values("lifecycle_email_cadences")).toHaveLength(0);
  });

  it("creates a durable cadence enrollment with activation metadata", async () => {
    const { createLifecycleCadenceEnrollment } = await import("../utils/lifecycle-cadence");
    const result = await createLifecycleCadenceEnrollment({
      persona: "site_operator",
      email: "ops@facility.co",
      displayName: "Ada",
      company: "Facility Co",
      sourceCollection: "inboundRequests",
      sourceDocId: "request-1",
      sourceLabel: "South Warehouse",
      completedEventKeys: ["site_claim_submitted"],
    });

    expect(result).toMatchObject({ created: true, cadenceId: "inboundRequests:request-1:site_operator" });
    expect(dbState.get("lifecycle_email_cadences", "inboundRequests:request-1:site_operator")).toMatchObject({
      persona: "site_operator",
      email: "ops@facility.co",
      agent_owner: "site-operator-partnership-agent",
      policy_owner: "growth-lead",
      source_collection: "inboundRequests",
      source_doc_id: "request-1",
      completed_event_keys: ["site_claim_submitted"],
      status: "active",
      steps: expect.arrayContaining([
        expect.objectContaining({
          key: "operator_welcome_day0",
          agentOwner: "site-operator-partnership-agent",
          status: "pending",
        }),
      ]),
    });
  });

  it("queues due lifecycle drafts through the human-gated action ledger", async () => {
    const { buildLifecycleCadenceSteps, runLifecycleCadenceWorker } = await import("../utils/lifecycle-cadence");
    dbState.set("lifecycle_email_cadences", "cadence-1", {
      cadence_id: "cadence-1",
      persona: "capturer",
      email: "capturer@supply.co",
      display_name: "Cam",
      source_collection: "waitlistSubmissions",
      source_doc_id: "waitlist-1",
      status: "active",
      completed_event_keys: [],
      steps: buildLifecycleCadenceSteps({
        persona: "capturer",
        email: "capturer@supply.co",
        displayName: "Cam",
        nowIso: "2026-05-01T12:00:00.000Z",
      }),
    });

    const result = await runLifecycleCadenceWorker({
      limit: 10,
      now: new Date("2026-05-07T12:00:00.000Z"),
    });

    expect(result.processedCount).toBe(4);
    expect(executeAction).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceCollection: "lifecycle_email_cadences",
        sourceDocId: "cadence-1",
        safetyPolicy: expect.objectContaining({ lane: "lifecycle_cadence" }),
        actionPayload: expect.objectContaining({
          to: "capturer@supply.co",
          commercialEmail: true,
          unsubscribeUrl: expect.stringContaining("capturer%40supply.co"),
          lifecyclePersona: "capturer",
        }),
        draftOutput: expect.objectContaining({
          requires_human_review: true,
          agent_owner: "capturer-success-agent",
          policy_owner: "growth-lead",
        }),
      }),
    );
    expect(dbState.get("lifecycle_email_cadences", "cadence-1")).toMatchObject({
      last_ledger_doc_id: "ledger-1",
      last_status: "pending_approval",
    });
  });

  it("skips completed activation basics instead of sending stale nudges", async () => {
    const { buildLifecycleCadenceSteps, runLifecycleCadenceWorker } = await import("../utils/lifecycle-cadence");
    dbState.set("lifecycle_email_cadences", "cadence-skip", {
      cadence_id: "cadence-skip",
      persona: "capturer",
      email: "capturer@supply.co",
      source_collection: "waitlistSubmissions",
      source_doc_id: "waitlist-1",
      status: "active",
      completed_event_keys: ["first_capture_uploaded"],
      steps: buildLifecycleCadenceSteps({
        persona: "capturer",
        email: "capturer@supply.co",
        nowIso: "2026-05-01T12:00:00.000Z",
      }),
    });

    await runLifecycleCadenceWorker({
      limit: 10,
      now: new Date("2026-05-03T12:00:00.000Z"),
    });

    expect(executeAction).not.toHaveBeenCalled();
    expect(dbState.get("lifecycle_email_cadences", "cadence-skip")).toMatchObject({
      steps: expect.arrayContaining([
        expect.objectContaining({
          key: "capturer_welcome_day0",
          status: "skipped",
          skipReason: "event_completed:first_capture_uploaded",
        }),
        expect.objectContaining({
          key: "capturer_first_capture_plan_day2",
          status: "skipped",
          skipReason: "event_completed:first_capture_uploaded",
        }),
      ]),
    });
  });

  it("suppresses lifecycle drafts for unsubscribed recipients", async () => {
    const { buildLifecycleCadenceSteps, runLifecycleCadenceWorker } = await import("../utils/lifecycle-cadence");
    dbState.set("email_suppressions", "capturer@supply.co", {
      email: "capturer@supply.co",
      suppressed_scopes: ["lifecycle"],
      reason: "unsubscribe",
    });
    dbState.set("lifecycle_email_cadences", "cadence-suppressed", {
      cadence_id: "cadence-suppressed",
      persona: "capturer",
      email: "capturer@supply.co",
      source_collection: "waitlistSubmissions",
      source_doc_id: "waitlist-1",
      status: "active",
      completed_event_keys: [],
      steps: buildLifecycleCadenceSteps({
        persona: "capturer",
        email: "capturer@supply.co",
        nowIso: "2026-05-01T12:00:00.000Z",
      }),
    });

    const result = await runLifecycleCadenceWorker({
      limit: 10,
      now: new Date("2026-05-07T12:00:00.000Z"),
    });

    expect(result.suppressedCount).toBe(4);
    expect(executeAction).not.toHaveBeenCalled();
    expect(dbState.get("lifecycle_email_cadences", "cadence-suppressed")).toMatchObject({
      last_status: "suppressed",
      steps: expect.arrayContaining([
        expect.objectContaining({ status: "suppressed", skipReason: "email_suppressed" }),
      ]),
    });
  });
});

describe("email suppression ledger", () => {
  it("records unsubscribes into the suppression ledger", async () => {
    const { recordEmailSuppression, isEmailSuppressed } = await import("../utils/email-suppression");

    await recordEmailSuppression({
      email: "buyer@robotics.co",
      scope: "lifecycle",
      reason: "unsubscribe",
      source: "sendgrid:webhook",
    });

    expect(await isEmailSuppressed("buyer@robotics.co", "lifecycle")).toBe(true);
    expect(dbState.get("email_suppressions", "buyer@robotics.co")).toMatchObject({
      email: "buyer@robotics.co",
      suppressed_scopes: ["lifecycle"],
      reason: "unsubscribe",
      source: "sendgrid:webhook",
    });
  });
});
