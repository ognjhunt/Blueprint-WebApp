// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildCityLaunchBudgetPolicy } from "../utils/cityLaunchPolicy";

const firestoreState = vi.hoisted(() => ({
  collections: new Map<string, Map<string, Record<string, unknown>>>(),
  autoId: 0,
}));

const readCityLaunchActivation = vi.hoisted(() => vi.fn());
const listCityLaunchBudgetEvents = vi.hoisted(() => vi.fn());
const recordCityLaunchBudgetEvent = vi.hoisted(() => vi.fn());

function collectionDocs(name: string) {
  let docs = firestoreState.collections.get(name);
  if (!docs) {
    docs = new Map<string, Record<string, unknown>>();
    firestoreState.collections.set(name, docs);
  }
  return docs;
}

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  default: {
    firestore: {
      FieldValue: {
        serverTimestamp: () => "SERVER_TIMESTAMP",
      },
    },
  },
  dbAdmin: {
    collection(name: string) {
      const docs = collectionDocs(name);
      return {
        doc(id?: string) {
          const docId = id || `auto-${++firestoreState.autoId}`;
          return {
            id: docId,
            async get() {
              return {
                exists: docs.has(docId),
                data: () => docs.get(docId),
              };
            },
            async set(payload: Record<string, unknown>, options?: { merge?: boolean }) {
              docs.set(docId, options?.merge ? { ...(docs.get(docId) || {}), ...payload } : payload);
            },
          };
        },
        where(field: string, operator: string, value: unknown) {
          if (operator !== "==") {
            throw new Error(`Unsupported operator ${operator}`);
          }
          return {
            limit(limit: number) {
              return {
                async get() {
                  return {
                    docs: [...docs.entries()]
                      .filter(([, data]) => data[field] === value)
                      .slice(0, limit)
                      .map(([id, data]) => ({
                        id,
                        data: () => data,
                      })),
                  };
                },
              };
            },
          };
        },
      };
    },
  },
}));

vi.mock("../utils/cityLaunchLedgers", () => ({
  readCityLaunchActivation,
  listCityLaunchBudgetEvents,
  recordCityLaunchBudgetEvent,
}));

beforeEach(() => {
  firestoreState.collections.clear();
  firestoreState.autoId = 0;
  readCityLaunchActivation.mockReset();
  listCityLaunchBudgetEvents.mockReset();
  recordCityLaunchBudgetEvent.mockReset();

  const budgetPolicy = buildCityLaunchBudgetPolicy({ tier: "funded" });
  readCityLaunchActivation.mockResolvedValue({
    city: "Austin, TX",
    citySlug: "austin-tx",
    budgetTier: budgetPolicy.tier,
    budgetPolicy,
    founderApproved: true,
  });
  listCityLaunchBudgetEvents.mockResolvedValue([]);
  recordCityLaunchBudgetEvent.mockImplementation(async (input: Record<string, unknown>) => ({
    id: input.id || "budget-1",
    city: input.city,
    citySlug: "austin-tx",
    launchId: input.launchId ?? null,
    category: input.category,
    amountUsd: input.amountUsd,
    note: input.note ?? null,
    approvedByRole: input.approvedByRole ?? null,
    withinPolicy: input.withinPolicy,
    eventType: input.eventType || "actual",
    researchProvenance: null,
    createdAtIso: "2026-04-30T12:00:00.000Z",
  }));
});

describe("agent spend ledger", () => {
  it("records policy-approved manual spend requests without credentials", async () => {
    const { requestAgentSpend, listAgentSpendRequests } = await import("../utils/agentSpendLedger");

    const record = await requestAgentSpend({
      city: "Austin, TX",
      amountUsd: 25,
      category: "tools",
      vendorName: "Stripe",
      purpose: "Create test payment rail",
      issueId: "BLU-200",
      requestedByAgent: "city-launch-agent",
      provider: "manual",
    });

    expect(record.status).toBe("policy_approved");
    expect(record.rawCredentialDelivered).toBe(false);
    expect(record.policyDecision.withinPolicy).toBe(true);

    const listed = await listAgentSpendRequests("Austin, TX");
    expect(listed).toHaveLength(1);
    expect(listed[0].id).toBe(record.id);
  });

  it("reconciles paid provider events back into city budget events", async () => {
    const { reconcileAgentSpendProviderEvent, requestAgentSpend } = await import("../utils/agentSpendLedger");
    const record = await requestAgentSpend({
      city: "Austin, TX",
      amountUsd: 25,
      category: "tools",
      vendorName: "Stripe",
      purpose: "Create test payment rail",
      issueId: "BLU-201",
      requestedByAgent: "city-launch-agent",
      provider: "manual",
    });

    const reconciled = await reconcileAgentSpendProviderEvent({
      spendRequestId: record.id,
      provider: "manual",
      providerEventId: "evt-1",
      status: "paid",
      paidAmountUsd: 25,
      note: "Manual test payment captured",
    });

    expect(reconciled.status).toBe("paid");
    expect(reconciled.budgetEventId).toContain(`agent_spend_${record.id}_evt-1`);
    expect(recordCityLaunchBudgetEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        id: `agent_spend_${record.id}_evt-1`,
        amountUsd: 25,
        eventType: "actual",
        withinPolicy: true,
      }),
    );
  });

  it("rejects reconciliation events that claim raw credential delivery", async () => {
    const { reconcileAgentSpendProviderEvent, requestAgentSpend } = await import("../utils/agentSpendLedger");
    const record = await requestAgentSpend({
      city: "Austin, TX",
      amountUsd: 25,
      category: "tools",
      vendorName: "Stripe",
      purpose: "Create test payment rail",
      issueId: "BLU-202",
      requestedByAgent: "city-launch-agent",
      provider: "manual",
    });

    await expect(
      reconcileAgentSpendProviderEvent({
        spendRequestId: record.id,
        provider: "manual",
        providerEventId: "evt-raw",
        status: "credential_issued",
        rawCredentialDelivered: true,
      }),
    ).rejects.toThrow("Raw payment credentials must not be delivered");
  });
});
