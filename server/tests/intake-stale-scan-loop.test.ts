// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const waitlistStaleSet = vi.hoisted(() => vi.fn());
const waitlistFreshSet = vi.hoisted(() => vi.fn());
const inboundStaleSet = vi.hoisted(() => vi.fn());
const inboundFreshSet = vi.hoisted(() => vi.fn());

const waitlistStaleQuery: any = {};
waitlistStaleQuery.where = vi.fn(() => waitlistStaleQuery);
waitlistStaleQuery.limit = vi.fn(() => waitlistStaleQuery);
waitlistStaleQuery.get = vi.fn();

const inboundStaleQuery: any = {};
inboundStaleQuery.where = vi.fn(() => inboundStaleQuery);
inboundStaleQuery.limit = vi.fn(() => inboundStaleQuery);
inboundStaleQuery.get = vi.fn();

const fakeDb = {
  collection: vi.fn((name: string) => {
    if (name === "waitlistSubmissions") {
      return {
        where: vi.fn(() => waitlistStaleQuery),
      };
    }

    if (name === "inboundRequests") {
      return {
        where: vi.fn(() => inboundStaleQuery),
      };
    }

    throw new Error(`Unexpected collection ${name}`);
  }),
};

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  default: {
    firestore: {
      FieldValue: {
        serverTimestamp: () => "timestamp",
      },
    },
  },
  dbAdmin: fakeDb,
  storageAdmin: null,
  authAdmin: null,
}));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-03-31T12:00:00.000Z"));

  waitlistStaleSet.mockReset();
  waitlistFreshSet.mockReset();
  inboundStaleSet.mockReset();
  inboundFreshSet.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.resetModules();
});

const waitlistStaleDoc = {
  id: "waitlist-stale",
  data: () => ({
    email: "ada@example.com",
    email_domain: "example.com",
    location_type: "retail",
    market: "Austin",
    market_normalized: "austin",
    role: "capturer",
    role_normalized: "capturer",
    device: "iPhone 15 Pro",
    device_normalized: "iphone",
    phone: "555-000-1212",
    source: "referral",
    status: "new",
    queue: "capturer_beta_review",
    intent: "capturer_beta_access",
    filter_tags: ["market:austin"],
    created_at: "2026-03-30T10:00:00.000Z",
    updated_at: "2026-03-30T11:00:00.000Z",
    ops_automation: {
      status: "pending",
      last_attempt_at: "2026-03-30T11:00:00.000Z",
      next_action: "triage submission",
      retryable: true,
    },
  }),
  ref: {
    set: waitlistStaleSet,
  },
};

const waitlistFreshDoc = {
  id: "waitlist-fresh",
  data: () => ({
    email: "grace@example.com",
    email_domain: "example.com",
    location_type: "retail",
    market: "Austin",
    market_normalized: "austin",
    role: "capturer",
    role_normalized: "capturer",
    device: "iPhone 15 Pro",
    device_normalized: "iphone",
    phone: "555-000-3434",
    source: "referral",
    status: "new",
    queue: "capturer_beta_review",
    intent: "capturer_beta_access",
    filter_tags: ["market:austin"],
    created_at: "2026-03-31T11:30:00.000Z",
    updated_at: "2026-03-31T11:30:00.000Z",
    ops_automation: {
      status: "pending",
      last_attempt_at: "2026-03-31T11:30:00.000Z",
      next_action: "triage submission",
      retryable: true,
    },
  }),
  ref: {
    set: waitlistFreshSet,
  },
};

const inboundStaleDoc = {
  id: "request-stale",
  data: () => ({
    requestId: "request-stale",
    createdAt: "2026-03-30T09:30:00.000Z",
    updatedAt: "2026-03-30T10:00:00.000Z",
    status: "submitted",
    qualification_state: "submitted",
    opportunity_state: "not_applicable",
    priority: "normal",
    contact: {
      company: "Analytical Engines",
      roleTitle: "Operations Lead",
    },
    request: {
      buyerType: "site_operator",
      requestedLanes: ["qualification"],
      budgetBucket: "$50K-$300K",
      siteName: "Durham Facility",
      siteLocation: "Durham, NC",
      taskStatement: "Review a picking workflow.",
      workflowContext: null,
      operatingConstraints: null,
      privacySecurityConstraints: null,
      knownBlockers: null,
      targetRobotTeam: null,
      captureRights: null,
      derivedScenePermission: null,
      datasetLicensingPermission: null,
      payoutEligibility: null,
      details: null,
    },
    ops: {
      next_step: "Initial review",
    },
    ops_automation: {
      status: "pending",
      intent: "inbound_qualification",
      queue: "inbound_request_review",
      last_attempt_at: "2026-03-30T10:00:00.000Z",
    },
  }),
  ref: {
    set: inboundStaleSet,
  },
};

const inboundFreshDoc = {
  id: "request-fresh",
  data: () => ({
    requestId: "request-fresh",
    createdAt: "2026-03-31T11:15:00.000Z",
    updatedAt: "2026-03-31T11:30:00.000Z",
    status: "submitted",
    qualification_state: "submitted",
    opportunity_state: "not_applicable",
    priority: "normal",
    contact: {
      company: "Signal Works",
      roleTitle: "Program Manager",
    },
    request: {
      buyerType: "site_operator",
      requestedLanes: ["qualification"],
      budgetBucket: "$50K-$300K",
      siteName: "Austin Facility",
      siteLocation: "Austin, TX",
      taskStatement: "Review a layout change.",
      workflowContext: null,
      operatingConstraints: null,
      privacySecurityConstraints: null,
      knownBlockers: null,
      targetRobotTeam: null,
      captureRights: null,
      derivedScenePermission: null,
      datasetLicensingPermission: null,
      payoutEligibility: null,
      details: null,
    },
    ops: {
      next_step: "Initial review",
    },
    ops_automation: {
      status: "pending",
      intent: "inbound_qualification",
      queue: "inbound_request_review",
      last_attempt_at: "2026-03-31T11:30:00.000Z",
    },
  }),
  ref: {
    set: inboundFreshSet,
  },
};

waitlistStaleQuery.get.mockResolvedValue({
  docs: [waitlistStaleDoc, waitlistFreshDoc],
});
inboundStaleQuery.get.mockResolvedValue({
  docs: [inboundStaleDoc, inboundFreshDoc],
});

describe("intake stale scan loop", () => {
  it("marks stalled intake items as stale and leaves fresh items untouched", async () => {
    const { runIntakeStaleScanLoop } = await import("../agents/workflows");
    const result = await runIntakeStaleScanLoop({ limit: 25, ageHours: 24 });

    expect(result).toEqual({
      ok: true,
      processedCount: 2,
      failedCount: 0,
    });

    expect(waitlistStaleSet).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "follow_up_required",
        human_review_required: true,
        updated_at: "timestamp",
        ops_automation: expect.objectContaining({
          status: "stale",
          next_action: "Review stalled capturer application",
          last_error: "No status update for >24h",
          block_reason_code: "stale_over_24h",
          retryable: true,
          requires_human_review: true,
        }),
      }),
      { merge: true },
    );
    expect(waitlistFreshSet).not.toHaveBeenCalled();

    expect(inboundStaleSet).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "in_review",
        qualification_state: "in_review",
        human_review_required: true,
        updatedAt: "timestamp",
        ops: expect.objectContaining({
          next_step: "Review stalled buyer request; no status update for >24h.",
        }),
        ops_automation: expect.objectContaining({
          status: "stale",
          next_action: "Review stalled buyer request",
          last_error: "No status update for >24h",
          block_reason_code: "stale_over_24h",
          retryable: true,
          requires_human_review: true,
        }),
      }),
      { merge: true },
    );
    expect(inboundFreshSet).not.toHaveBeenCalled();
  });
});
