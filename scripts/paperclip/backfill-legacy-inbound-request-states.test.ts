import { describe, expect, it } from "vitest";

import {
  legacyStatusToQualificationState,
  needsLegacyBackfill,
  parseArgs,
  planBackfillTargets,
} from "./backfill-legacy-inbound-request-states.ts";

describe("paperclip legacy inbound request backfill", () => {
  it("accepts explicit request ids and dry-run mode", () => {
    expect(parseArgs(["--request-ids", "request-1,request-2", "--dry-run"])).toEqual({
      requestIds: ["request-1", "request-2"],
      dryRun: true,
    });
  });

  it("maps legacy statuses to the current qualification states", () => {
    expect(legacyStatusToQualificationState("triaging")).toBe("in_review");
    expect(legacyStatusToQualificationState("scheduled")).toBe("capture_requested");
    expect(legacyStatusToQualificationState("qualified")).toBe("qualified_ready");
    expect(legacyStatusToQualificationState("closed")).toBe("not_ready_yet");
    expect(legacyStatusToQualificationState(undefined)).toBe("submitted");
  });

  it("plans only legacy docs and honors explicit request ids", () => {
    const records = [
      {
        id: "legacy-1",
        data: {
          status: "qualified",
          qualification_state: null,
          opportunity_state: null,
          priority: "high",
          growth_wedge: "site-access",
        },
      },
      {
        id: "live-1",
        data: {
          status: "submitted",
          qualification_state: "submitted",
          opportunity_state: "not_applicable",
          priority: "normal",
        },
      },
      {
        id: "legacy-2",
        data: {
          status: "triaging",
          qualification_state: "unknown",
          opportunity_state: "",
          priority: "normal",
        },
      },
    ];

    expect(needsLegacyBackfill(records[0].data)).toBe(true);
    expect(needsLegacyBackfill(records[1].data)).toBe(false);
    expect(needsLegacyBackfill(records[2].data)).toBe(true);

    expect(planBackfillTargets(records, ["legacy-1", "legacy-2", "missing"])).toEqual({
      targets: [
        {
          id: "legacy-1",
          priority: "high",
          growthWedge: "site-access",
          normalizedQualificationState: "qualified_ready",
          normalizedOpportunityState: "handoff_ready",
          normalizedQueueKey: "exact_site_hosted_review_queue",
        },
        {
          id: "legacy-2",
          priority: "normal",
          growthWedge: null,
          normalizedQualificationState: "in_review",
          normalizedOpportunityState: "not_applicable",
          normalizedQueueKey: "inbound_request_review",
        },
      ],
      missingIds: ["missing"],
      skippedIds: ["missing"],
    });
  });
});
