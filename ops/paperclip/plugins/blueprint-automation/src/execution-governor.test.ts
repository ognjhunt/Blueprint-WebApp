import { describe, expect, it } from "vitest";
import {
  buildRoutineCatchUpWindowKey,
  isAgentOperational,
  isStaleRoutineExecutionIssue,
  recommendedRoutineExecutionPolicy,
  selectHealthyAgentKey,
  shouldTriggerRoutineCatchUp,
} from "./execution-governor.js";

describe("execution governor helpers", () => {
  it("treats error agents as unavailable and idle agents as operational", () => {
    expect(isAgentOperational("idle")).toBe(true);
    expect(isAgentOperational("running")).toBe(true);
    expect(isAgentOperational("error")).toBe(false);
  });

  it("reroutes work from an errored ops owner to chief of staff", () => {
    expect(
      selectHealthyAgentKey(
        "ops-lead",
        {
          "ops-lead": "error",
          "blueprint-chief-of-staff": "idle",
          "blueprint-cto": "idle",
        },
        {
          chiefOfStaffKey: "blueprint-chief-of-staff",
          ctoKey: "blueprint-cto",
          ceoKey: "blueprint-ceo",
        },
      ),
    ).toEqual({
      assigneeKey: "blueprint-chief-of-staff",
      rerouted: true,
      attempted: ["ops-lead", "blueprint-chief-of-staff", "blueprint-cto"],
    });
  });

  it("reroutes webapp codex execution to the paired review lane before escalating", () => {
    expect(
      selectHealthyAgentKey(
        "webapp-codex",
        {
          "webapp-codex": "error",
          "webapp-review": "idle",
          "blueprint-cto": "idle",
        },
        {
          chiefOfStaffKey: "blueprint-chief-of-staff",
          ctoKey: "blueprint-cto",
          ceoKey: "blueprint-ceo",
        },
      ).assigneeKey,
    ).toBe("webapp-review");
  });

  it("defaults routines to auditable execution rather than coalescing or skipping", () => {
    expect(recommendedRoutineExecutionPolicy()).toEqual({
      concurrencyPolicy: "always_enqueue",
      catchUpPolicy: "enqueue_missed_with_cap",
    });
  });

  it("detects a missed weekday schedule after the local fire time", () => {
    expect(
      shouldTriggerRoutineCatchUp(
        {
          enabled: true,
          cronExpression: "40 7 * * 1-5",
          timezone: "America/New_York",
          nextRunAt: "2026-04-06T11:40:00.000Z",
          lastFiredAt: null,
        },
        new Date("2026-04-03T16:00:00.000Z"),
      ),
    ).toBe(true);
  });

  it("does not catch up when the routine already fired in the current window", () => {
    expect(
      shouldTriggerRoutineCatchUp(
        {
          enabled: true,
          cronExpression: "15 11 * * 1-5",
          timezone: "America/New_York",
          nextRunAt: "2026-04-06T15:15:00.000Z",
          lastFiredAt: "2026-04-03T15:15:10.266Z",
        },
        new Date("2026-04-03T17:30:00.000Z"),
      ),
    ).toBe(false);
  });

  it("keys catch-up reruns to the missed scheduled window rather than the current monitor minute", () => {
    expect(
      buildRoutineCatchUpWindowKey(
        {
          enabled: true,
          cronExpression: "10 8 * * 1-5",
          timezone: "America/New_York",
          nextRunAt: "2026-04-04T12:10:00.000Z",
          lastFiredAt: "2026-04-03T12:10:01.804Z",
        },
        new Date("2026-04-03T18:50:13.960Z"),
      ),
    ).toBe("2026-04-03:08:10:10 8 * * 1-5");
  });

  it("marks an old routine execution issue without a live run lock as stale", () => {
    expect(
      isStaleRoutineExecutionIssue(
        {
          originKind: "routine_execution",
          executionRunId: null,
          status: "todo",
          updatedAt: "2026-03-31T19:06:55.624Z",
        },
        24,
        Date.parse("2026-04-03T17:30:00.000Z"),
      ),
    ).toBe(true);
  });
});
