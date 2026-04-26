// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CityLaunchProspectRecord } from "../utils/cityLaunchLedgers";

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  default: {
    apps: [],
    firestore: {
      FieldValue: {
        serverTimestamp: () => "SERVER_TIMESTAMP",
      },
    },
    messaging: () => ({
      send: vi.fn(),
    }),
  },
  dbAdmin: null,
}));

function prospect(overrides: Partial<CityLaunchProspectRecord> = {}): CityLaunchProspectRecord {
  return {
    id: "public_candidate_durham-nc_durham-food-hall",
    city: "Durham, NC",
    citySlug: "durham-nc",
    launchId: null,
    sourceBucket: "public_commercial_review_candidate",
    channel: "agent_public_candidate_research",
    name: "Durham Food Hall",
    email: null,
    status: "approved",
    ownerAgent: "public-space-review-agent",
    notes: "Auto-promoted from public review candidate evidence.",
    firstContactedAt: null,
    lastContactedAt: null,
    siteAddress: "530 Foster St, Durham, NC 27701",
    locationSummary: "Public-facing food hall with common visitor areas.",
    lat: 36.0001,
    lng: -78.9001,
    siteCategory: "food_hall",
    workflowFit: "public-facing common-access capture",
    priorityNote: "Allowed capture zones: public corridors; common seating",
    researchProvenance: {
      sourceType: "public_candidate_review",
      artifactPath: "cityLaunchCandidateSignals/candidate-durham-1",
      sourceKey: "candidate-durham-1",
      sourceUrls: ["https://durhamfoodhall.com/"],
      parsedAtIso: "2026-04-25T20:00:00.000Z",
      explicitFields: ["sourceUrls"],
      inferredFields: [],
    },
    createdAtIso: "2026-04-25T20:00:00.000Z",
    updatedAtIso: "2026-04-25T20:00:00.000Z",
    ...overrides,
  };
}

function recipient(overrides: Record<string, unknown> = {}) {
  return {
    creatorId: String(overrides.creatorId || "creator-durham-1"),
    profile: {
      capturerMarket: "Durham, NC",
      notification_preferences: { nearby_jobs: true },
      notification_device: {
        fcm_token: "fcm-token-1",
        authorization_status: "authorized",
        platform: "ios",
      },
      ...overrides,
    },
  };
}

describe("city launch notifications", () => {
  beforeEach(async () => {
    vi.resetModules();
    const notifications = await import("../utils/cityLaunchNotifications");
    notifications.__resetCityLaunchNotificationMemoryForTests();
  });

  it("writes a notification for promoted public-area prospects", async () => {
    const { dispatchCityLaunchTargetPromotionNotifications } = await import("../utils/cityLaunchNotifications");
    const send = vi.fn().mockResolvedValue({ messageId: "push-1" });

    const result = await dispatchCityLaunchTargetPromotionNotifications({
      city: "Durham, NC",
      promotedProspects: [prospect()],
      recipients: [recipient()],
      transport: {
        configured: () => true,
        send,
      },
    });

    expect(result.sentCount).toBe(1);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      title: "New Blueprint capture targets in Durham",
      body: "A new indoor public-area target is ready near you: Durham Food Hall. Review zones before capturing.",
    }));
    expect(result.records[0]).toMatchObject({
      citySlug: "durham-nc",
      recipientCreatorId: "creator-durham-1",
      triggerType: "city_launch_targets_promoted",
      channel: "push",
      status: "sent",
      prospectIds: ["public_candidate_durham-nc_durham-food-hall"],
      candidateIds: ["candidate-durham-1"],
    });
  });

  it("does not notify for inactive or missing-evidence prospects", async () => {
    const { dispatchCityLaunchTargetPromotionNotifications } = await import("../utils/cityLaunchNotifications");

    const result = await dispatchCityLaunchTargetPromotionNotifications({
      city: "Durham, NC",
      promotedProspects: [
        prospect({ status: "inactive" }),
        prospect({ id: "missing-evidence", researchProvenance: null }),
      ],
      recipients: [recipient()],
      transport: {
        configured: () => true,
        send: vi.fn(),
      },
    });

    expect(result.recipientCount).toBe(0);
    expect(result.records).toEqual([]);
  });

  it("respects nearby_jobs=false", async () => {
    const { dispatchCityLaunchTargetPromotionNotifications } = await import("../utils/cityLaunchNotifications");

    const result = await dispatchCityLaunchTargetPromotionNotifications({
      city: "Durham, NC",
      promotedProspects: [prospect()],
      recipients: [
        recipient({
          creatorId: "creator-muted",
          notification_preferences: { nearby_jobs: false },
        }),
      ],
      transport: {
        configured: () => true,
        send: vi.fn(),
      },
    });

    expect(result.recipientCount).toBe(0);
    expect(result.records).toEqual([]);
  });

  it("deduplicates the same recipient city and prospect set", async () => {
    const { dispatchCityLaunchTargetPromotionNotifications, __readCityLaunchNotificationMemoryForTests } =
      await import("../utils/cityLaunchNotifications");
    const send = vi.fn().mockResolvedValue({ messageId: "push-1" });
    const input = {
      city: "Durham, NC",
      promotedProspects: [prospect()],
      recipients: [recipient()],
      transport: {
        configured: () => true,
        send,
      },
    };

    await dispatchCityLaunchTargetPromotionNotifications(input);
    const result = await dispatchCityLaunchTargetPromotionNotifications(input);

    expect(send).toHaveBeenCalledTimes(1);
    expect(result.skippedCount).toBe(1);
    expect(result.records[0]).toMatchObject({ status: "skipped", skipReason: "duplicate_notification" });
    expect(__readCityLaunchNotificationMemoryForTests()).toHaveLength(1);
  });

  it("records push failure without throwing", async () => {
    const { dispatchCityLaunchTargetPromotionNotifications } = await import("../utils/cityLaunchNotifications");

    const result = await dispatchCityLaunchTargetPromotionNotifications({
      city: "Durham, NC",
      promotedProspects: [prospect()],
      recipients: [recipient()],
      transport: {
        configured: () => true,
        send: vi.fn().mockRejectedValue(new Error("FCM unavailable")),
      },
    });

    expect(result.failedCount).toBe(1);
    expect(result.records[0]).toMatchObject({
      status: "failed",
      failureReason: "FCM unavailable",
    });
  });

  it("queues in-app ledger fallback when push transport is not configured", async () => {
    const { dispatchCityLaunchTargetPromotionNotifications } = await import("../utils/cityLaunchNotifications");

    const result = await dispatchCityLaunchTargetPromotionNotifications({
      city: "Durham, NC",
      promotedProspects: [prospect(), prospect({ id: "public_candidate_durham-nc_american-tobacco-campus", name: "American Tobacco Campus" })],
      recipients: [recipient()],
      transport: {
        configured: () => false,
        send: vi.fn(),
      },
    });

    expect(result.queuedCount).toBe(1);
    expect(result.records[0]).toMatchObject({
      channel: "in_app",
      status: "queued",
      skipReason: "push_transport_not_configured",
      title: "New Blueprint capture targets in Durham",
      body: "2 indoor public-area targets are ready to review. Open Blueprint Capture to see routes and guidance.",
    });
  });
});
