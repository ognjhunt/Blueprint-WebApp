// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

const executeAction = vi.hoisted(() => vi.fn());

type StoreState = Record<string, Map<string, Record<string, unknown>>>;

const stores: StoreState = {
  capture_jobs: new Map(),
  bookings: new Map(),
  users: new Map(),
  action_ledger: new Map(),
};

function resetStores() {
  Object.values(stores).forEach((store) => store.clear());
}

function getByPath(value: Record<string, unknown>, path: string) {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[segment];
  }, value);
}

function merge(target: Record<string, unknown>, patch: Record<string, unknown>) {
  const next = { ...target };
  for (const [key, value] of Object.entries(patch)) {
    if (
      value
      && typeof value === "object"
      && !Array.isArray(value)
      && target[key]
      && typeof target[key] === "object"
      && !Array.isArray(target[key])
    ) {
      next[key] = merge(
        target[key] as Record<string, unknown>,
        value as Record<string, unknown>,
      );
    } else {
      next[key] = value;
    }
  }
  return next;
}

function makeCollection(name: keyof StoreState) {
  const store = stores[name];

  const applyFilters = (
    docs: Array<{ id: string; data: Record<string, unknown> }>,
    filters: Array<{ field: string; value: unknown }>,
  ) =>
    docs.filter(({ data }) =>
      filters.every((filter) => getByPath(data, filter.field) === filter.value),
    );

  const query = (filters: Array<{ field: string; value: unknown }> = [], limitCount?: number) => ({
    where: (field: string, _op: string, value: unknown) =>
      query([...filters, { field, value }], limitCount),
    limit: (count: number) => query(filters, count),
    get: async () => {
      const docs = applyFilters(
        Array.from(store.entries()).map(([id, data]) => ({ id, data })),
        filters,
      ).slice(0, limitCount ?? Number.MAX_SAFE_INTEGER);

      return {
        empty: docs.length === 0,
        size: docs.length,
        docs: docs.map(({ id, data }) => ({
          id,
          data: () => data,
          ref: {
            set: async (payload: Record<string, unknown>, options?: { merge?: boolean }) => {
              store.set(id, options?.merge ? merge(store.get(id) || {}, payload) : payload);
            },
            update: async (payload: Record<string, unknown>) => {
              store.set(id, merge(store.get(id) || {}, payload));
            },
          },
        })),
      };
    },
  });

  return {
    doc: (id: string) => ({
      async get() {
        return {
          exists: store.has(id),
          data: () => store.get(id),
        };
      },
      async set(payload: Record<string, unknown>, options?: { merge?: boolean }) {
        store.set(id, options?.merge ? merge(store.get(id) || {}, payload) : payload);
      },
      async update(payload: Record<string, unknown>) {
        store.set(id, merge(store.get(id) || {}, payload));
      },
    }),
    where: (field: string, op: string, value: unknown) => query().where(field, op, value),
    limit: (count: number) => query([], count),
  };
}

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  default: {
    firestore: {
      FieldValue: {
        serverTimestamp: () => "timestamp",
      },
    },
  },
  dbAdmin: {
    collection(name: keyof StoreState) {
      return makeCollection(name);
    },
  },
}));

vi.mock("../agents/action-executor", () => ({
  executeAction,
}));

afterEach(() => {
  executeAction.mockReset();
  resetStores();
  vi.resetModules();
});

describe("field ops automation", () => {
  it("sends capturer confirmations and schedules the next reminder", async () => {
    stores.capture_jobs.set("job-1", {
      title: "Durham Facility",
      address: "123 Main St",
      availabilityStartsAt: "2026-04-02T15:00:00.000Z",
    });
    stores.users.set("creator-1", {
      email: "capturer@example.com",
      name: "Casey Capturer",
    });
    executeAction.mockResolvedValue({
      state: "sent",
      tier: 1,
      ledgerDocId: "ledger-1",
    });

    const { sendCapturerCommunication } = await import("../utils/field-ops-automation");
    const result = await sendCapturerCommunication({
      captureJobId: "job-1",
      communicationType: "confirmation",
      creatorId: "creator-1",
      triggeredBy: "ops@tryblueprint.io",
    });

    expect(result.state).toBe("sent");
    expect(executeAction).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "send_email",
        sourceCollection: "capture_jobs",
      }),
    );
    expect(stores.capture_jobs.get("job-1")).toMatchObject({
      field_ops: {
        capturer_assignment: {
          creator_id: "creator-1",
          email: "capturer@example.com",
        },
        reminders: {
          status: "pending",
          next_type: "reminder_48h",
        },
      },
    });
  }, 15_000);

  it("keeps non-simple reschedules in pending approval", async () => {
    stores.bookings.set("booking-1", {
      blueprintId: "bp-1",
      businessName: "Durham Facility",
      date: "2026-04-02",
      time: "10:00",
      email: "buyer@example.com",
    });

    const { processSimpleReschedule } = await import("../utils/field-ops-automation");
    const result = await processSimpleReschedule({
      bookingId: "booking-1",
      requestedDate: "2026-04-03",
      requestedTime: "11:00",
      requestedBy: "buyer",
    });

    expect(result.state).toBe("pending_approval");
    expect(executeAction).not.toHaveBeenCalled();
    expect(stores.bookings.get("booking-1")).toMatchObject({
      reschedule_request: {
        status: "pending_approval",
        requested_date: "2026-04-03",
        requested_time: "11:00",
      },
    });
  });

  it("writes site-access outreach state after sending the first outreach", async () => {
    stores.capture_jobs.set("job-2", {
      title: "Warehouse North",
      address: "500 Dock Rd",
    });
    executeAction.mockResolvedValue({
      state: "sent",
      tier: 2,
      ledgerDocId: "ledger-site-1",
    });

    const { sendSiteAccessOutreach } = await import("../utils/field-ops-automation");
    const result = await sendSiteAccessOutreach({
      captureJobId: "job-2",
      operatorEmail: "operator@example.com",
      operatorName: "Pat Operator",
      triggeredBy: "ops@tryblueprint.io",
    });

    expect(result.state).toBe("sent");
    expect(stores.capture_jobs.get("job-2")).toMatchObject({
      site_access: {
        permission_state: "awaiting_response",
        operator_contact: {
          email: "operator@example.com",
          name: "Pat Operator",
        },
        ledger_doc_id: "ledger-site-1",
      },
    });
  });
});
