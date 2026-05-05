import { describe, expect, it } from "vitest";
import {
  buildIssueWakeCooldownKey,
  buildRoutineCatchUpWindowKey,
  isAgentOperational,
  isStaleRoutineExecutionIssue,
  recommendedRoutineExecutionPolicy,
  evaluateWakeupSuppression,
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

  it("routes unavailable analytics work to chief of staff before growth lead", () => {
    expect(
      selectHealthyAgentKey(
        "analytics-agent",
        {
          "analytics-agent": "error",
          "blueprint-chief-of-staff": "idle",
          "growth-lead": "idle",
          "blueprint-cto": "idle",
        },
        {
          chiefOfStaffKey: "blueprint-chief-of-staff",
          ctoKey: "blueprint-cto",
          ceoKey: "blueprint-ceo",
        },
      ).assigneeKey,
    ).toBe("blueprint-chief-of-staff");
  });

  it("routes unavailable notion-manager work to chief of staff before CTO", () => {
    expect(
      selectHealthyAgentKey(
        "notion-manager-agent",
        {
          "notion-manager-agent": "error",
          "blueprint-chief-of-staff": "idle",
          "blueprint-cto": "idle",
        },
        {
          chiefOfStaffKey: "blueprint-chief-of-staff",
          ctoKey: "blueprint-cto",
          ceoKey: "blueprint-ceo",
        },
      ).assigneeKey,
    ).toBe("blueprint-chief-of-staff");
  });

  it("defaults routines to coalesced execution with no catch-up backlog", () => {
    expect(recommendedRoutineExecutionPolicy()).toEqual({
      concurrencyPolicy: "coalesce_if_active",
      catchUpPolicy: "skip_missed",
    });
  });

  it("suppresses duplicate wakeups with TTL, backoff, and max attempts", () => {
    const first = evaluateWakeupSuppression({
      state: {},
      key: "chief-of-staff:issue:BLU-1",
      nowMs: 1_000,
      ttlMs: 15 * 60 * 1000,
      baseBackoffMs: 60_000,
      maxAttempts: 2,
    });
    expect(first.decision).toBe("allow");

    const duplicate = evaluateWakeupSuppression({
      state: first.state,
      key: "chief-of-staff:issue:BLU-1",
      nowMs: 1_500,
      ttlMs: 15 * 60 * 1000,
      baseBackoffMs: 60_000,
      maxAttempts: 2,
    });
    expect(duplicate).toMatchObject({
      decision: "skip",
      reason: "backoff",
    });

    const second = evaluateWakeupSuppression({
      state: duplicate.state,
      key: "chief-of-staff:issue:BLU-1",
      nowMs: 62_000,
      ttlMs: 15 * 60 * 1000,
      baseBackoffMs: 60_000,
      maxAttempts: 2,
    });
    expect(second).toMatchObject({
      decision: "allow",
      attempts: 2,
    });

    const maxed = evaluateWakeupSuppression({
      state: second.state,
      key: "chief-of-staff:issue:BLU-1",
      nowMs: 183_000,
      ttlMs: 15 * 60 * 1000,
      baseBackoffMs: 60_000,
      maxAttempts: 2,
    });
    expect(maxed).toMatchObject({
      decision: "skip",
      reason: "max_attempts",
    });
  });

  it("keys no-change issue wake cooldowns by issue and reason, not event id", () => {
    expect(
      buildIssueWakeCooldownKey({
        companyId: "company-1",
        agentId: "chief-1",
        issueId: "issue-austin-blocker",
        reason: "issue.updated",
        stateFingerprint: "blocked:no-change",
      }),
    ).toBe(
      buildIssueWakeCooldownKey({
        companyId: "company-1",
        agentId: "chief-1",
        issueId: "issue-austin-blocker",
        reason: "issue.updated",
        stateFingerprint: "blocked:no-change",
      }),
    );

    expect(
      buildIssueWakeCooldownKey({
        companyId: "company-1",
        agentId: "chief-1",
        issueId: "issue-austin-blocker",
        reason: "issue.updated",
        stateFingerprint: "blocked:no-change",
      }),
    ).not.toBe(
      buildIssueWakeCooldownKey({
        companyId: "company-1",
        agentId: "chief-1",
        issueId: "issue-austin-blocker",
        reason: "issue.updated",
        stateFingerprint: "blocked:human-comment",
      }),
    );
  });

  it("reroutes unavailable CI watchers into the implementation lane before escalating", () => {
    expect(
      selectHealthyAgentKey(
        "webapp-ci-watch",
        {
          "webapp-ci-watch": "error",
          "webapp-codex": "idle",
          "webapp-review": "idle",
          "blueprint-cto": "idle",
        },
        {
          chiefOfStaffKey: "blueprint-chief-of-staff",
          ctoKey: "blueprint-cto",
          ceoKey: "blueprint-ceo",
        },
      ).assigneeKey,
    ).toBe("webapp-codex");
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
