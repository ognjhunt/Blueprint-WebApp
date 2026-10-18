/**
 * Owner request (2026-10-18): every surface states the beta's expected
 * timelines, each from one named constant the owner can change, and none
 * promises a recommendation date.
 */
import { describe, expect, it } from "vitest";

import {
  EVALUATION_START_TIMELINE,
  REPLY_TIMELINE,
  SIMULATION_BUILD_TIMELINE,
  waitingTimeline,
} from "@/data/betaTimelines";

describe("the beta's expected timelines", () => {
  it("are the owner's three ranges, and none dates a recommendation", () => {
    expect(REPLY_TIMELINE).toBe("We reply within two business days.");
    expect(SIMULATION_BUILD_TIMELINE).toBe("Building the simulation usually takes one to three weeks during the beta.");
    expect(EVALUATION_START_TIMELINE).toBe("Evaluations start once an invited robot team takes up your job; we can't promise a date yet, and we email you when one starts.");
    for (const line of [REPLY_TIMELINE, SIMULATION_BUILD_TIMELINE, EVALUATION_START_TIMELINE]) {
      expect(line).not.toMatch(/recommend/i);
    }
  });

  it("names the wait for each stage that waits on Blueprint or a robot team, and nothing for the site's own steps", () => {
    expect(waitingTimeline("received")).toBe(REPLY_TIMELINE);
    expect(waitingTimeline("footage_received")).toBe(REPLY_TIMELINE);
    expect(waitingTimeline("assessing")).toBe(SIMULATION_BUILD_TIMELINE);
    expect(waitingTimeline("awaiting_teams")).toBe(EVALUATION_START_TIMELINE);
    // Settled evaluations: the headline already says what comes next, and its
    // evaluations have finished, so "evaluations start" would read wrong.
    for (const decision of ["confirm_brief", "record", "add_views", "save_account", "not_listed", "call_needed", "not_now",
      "not_yet_supported", "screening", "results", "no_team_passed", "no_qualified_evaluation", undefined, null, "unknown"]) {
      expect(waitingTimeline(decision)).toBeNull();
    }
  });
});
