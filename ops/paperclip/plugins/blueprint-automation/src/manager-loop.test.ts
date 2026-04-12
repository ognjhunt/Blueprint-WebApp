import { describe, expect, it } from "vitest";
import {
  buildRoutineHealthAlertSignature,
  buildDailyAccountabilitySnapshot,
  buildManagerStateSnapshot,
  collectRoutineHealthAlerts,
  shouldWakeChiefOfStaffForIssueEvent,
  type ManagerRoutineHealthEntry,
} from "./manager-loop.js";

describe("manager loop helpers", () => {
  it("builds a chief-of-staff snapshot with stale, blocked, unassigned, and completed work", () => {
    const snapshot = buildManagerStateSnapshot({
      generatedAt: "2026-03-30T12:00:00.000Z",
      chiefOfStaffAgentKey: "blueprint-chief-of-staff",
      chiefOfStaffAgentId: "chief-1",
      issues: [
        {
          id: "iss-blocked",
          title: "Blocked payout exception",
          projectId: "proj-webapp",
          projectName: "blueprint-webapp",
          status: "blocked",
          priority: "high",
          assigneeAgentId: "finance-support-agent",
          createdByAgentId: "ops-lead",
          updatedAt: "2026-03-30T10:00:00.000Z",
        },
        {
          id: "iss-stale",
          title: "Unmoved buyer follow-up",
          projectId: "proj-webapp",
          projectName: "blueprint-webapp",
          status: "todo",
          priority: "high",
          assigneeAgentId: "ops-lead",
          createdByAgentId: "growth-lead",
          updatedAt: "2026-03-30T06:00:00.000Z",
        },
        {
          id: "iss-unassigned",
          title: "Missing owner capture request",
          projectId: "proj-capture",
          projectName: "blueprint-capture",
          status: "todo",
          priority: "medium",
          assigneeAgentId: null,
          createdByAgentId: "ops-lead",
          updatedAt: "2026-03-30T08:00:00.000Z",
        },
        {
          id: "iss-complete",
          title: "Recently completed intake review",
          projectId: "proj-webapp",
          projectName: "blueprint-webapp",
          status: "done",
          priority: "medium",
          assigneeAgentId: "intake-agent",
          createdByAgentId: "ops-lead",
          updatedAt: "2026-03-30T11:00:00.000Z",
        },
        {
          id: "iss-chief",
          title: "Chief of staff loop issue",
          projectId: "proj-exec",
          projectName: "blueprint-executive-ops",
          status: "todo",
          priority: "high",
          assigneeAgentId: "chief-1",
          createdByAgentId: "chief-1",
          updatedAt: "2026-03-30T11:30:00.000Z",
        },
      ] as any,
      agents: [
        { id: "chief-1", name: "Chief of Staff", role: "cto", status: "running" },
        { id: "ops-1", name: "Ops Lead", role: "cto", status: "running" },
        { id: "growth-1", name: "Growth Lead", role: "cto", status: "idle" },
      ] as any,
      routineHealth: {
        "ops-lead-morning": {
          routineKey: "ops-lead-morning",
          routineTitle: "Ops Lead Morning",
          agentKey: "ops-lead",
          lastOutcome: "blocked",
          lastRunAt: "2026-03-30T09:00:00.000Z",
          lastSuccessAt: "2026-03-29T09:00:00.000Z",
          lastFailureReason: "Missing queue evidence",
          consecutiveFailures: 2,
          expectedIntervalHours: 24,
          lastIssueId: "iss-blocked",
        },
      } satisfies Record<string, ManagerRoutineHealthEntry>,
      recentEvents: [
        {
          id: "evt-1",
          kind: "issue-upserted",
          title: "Blocked payout exception",
          issueId: "iss-blocked",
          createdAt: "2026-03-30T10:00:00.000Z",
        },
      ],
      managedIssueIds: new Set(["iss-blocked", "iss-stale"]),
    });

    expect(snapshot.runClassification).toBe("actionable");
    expect(snapshot.hasActionableWork).toBe(true);
    expect(snapshot.summary.openIssueCount).toBe(3);
    expect(snapshot.summary.blockedIssueCount).toBe(1);
    expect(snapshot.summary.staleIssueCount).toBe(1);
    expect(snapshot.summary.unassignedIssueCount).toBe(1);
    expect(snapshot.summary.recentlyCompletedCount).toBe(1);
    expect(snapshot.summary.routineAlertCount).toBe(1);
    expect(snapshot.summary.managedOpenIssueCount).toBe(2);
    expect(snapshot.summary.activeAgentCount).toBe(1);
    expect(snapshot.summary.openHandoffCount).toBe(0);
    expect(snapshot.summary.stuckHandoffCount).toBe(0);
    expect(snapshot.handoffSummary.avgLatencyHours).toBeNull();
    expect(snapshot.dailyAccountability.agentsRan).toEqual([]);
    expect(snapshot.openIssues).toHaveLength(3);
    expect(snapshot.openIssues.map((issue) => issue.id)).toEqual([
      "iss-blocked",
      "iss-stale",
      "iss-unassigned",
    ]);
    expect(snapshot.blockedIssues.map((issue) => issue.id)).toContain("iss-blocked");
    expect(snapshot.staleIssues.map((issue) => issue.id)).toContain("iss-stale");
    expect(snapshot.unassignedIssues.map((issue) => issue.id)).toContain("iss-unassigned");
    expect(snapshot.recentlyCompletedIssues.map((issue) => issue.id)).toContain("iss-complete");
    expect(snapshot.nextActionHints.length).toBeGreaterThan(0);
  });

  it("flags blocked and stale routine alerts", () => {
    const alerts = collectRoutineHealthAlerts(
      {
        blocked: {
          routineKey: "blocked",
          routineTitle: "Blocked Routine",
          agentKey: "ops-lead",
          routineStatus: "active",
          lastOutcome: "blocked",
          lastRunAt: "2026-03-30T11:00:00.000Z",
          lastSuccessAt: "2026-03-30T10:00:00.000Z",
          lastFailureReason: "rate limited",
          consecutiveFailures: 2,
          expectedIntervalHours: 1,
          lastIssueId: "iss-1",
        },
        stale: {
          routineKey: "stale",
          routineTitle: "Stale Routine",
          agentKey: "growth-lead",
          routineStatus: "active",
          lastOutcome: "done",
          lastRunAt: "2026-03-29T00:00:00.000Z",
          lastSuccessAt: "2026-03-29T00:00:00.000Z",
          lastFailureReason: null,
          consecutiveFailures: 0,
          expectedIntervalHours: 4,
          lastIssueId: "iss-2",
        },
      },
      "2026-03-30T12:00:00.000Z",
    );

    expect(alerts).toHaveLength(2);
    expect(alerts.map((alert) => alert.kind).sort()).toEqual(["blocked", "stale"]);
  });

  it("ignores paused routines when computing routine alerts", () => {
    const alerts = collectRoutineHealthAlerts(
      {
        paused: {
          routineKey: "paused",
          routineTitle: "Demand Intel Daily",
          agentKey: "demand-intel-agent",
          routineStatus: "paused",
          lastOutcome: "done",
          lastRunAt: "2026-03-29T00:00:00.000Z",
          lastSuccessAt: "2026-03-29T00:00:00.000Z",
          lastFailureReason: null,
          consecutiveFailures: 0,
          expectedIntervalHours: 24,
          lastIssueId: "iss-3",
        },
      },
      "2026-03-30T12:00:00.000Z",
    );

    expect(alerts).toEqual([]);
  });

  it("builds a stable routine-alert signature for unchanged manager alerts", () => {
    const signature = buildRoutineHealthAlertSignature([
      {
        routineKey: "market-intel-daily",
        routineTitle: "Market Intel Daily",
        agentKey: "market-intel-agent",
        kind: "stale",
        detail: "Last healthy run is 89.2h old against a 24h cadence.",
        lastRunAt: "2026-03-30T13:15:00.928Z",
        lastSuccessAt: "2026-03-30T13:15:00.928Z",
        consecutiveFailures: 0,
        expectedIntervalHours: 24,
        lastIssueId: "iss-2",
      },
    ]);

    const sameAlertDifferentAgeText = buildRoutineHealthAlertSignature([
      {
        routineKey: "market-intel-daily",
        routineTitle: "Market Intel Daily",
        agentKey: "market-intel-agent",
        kind: "stale",
        detail: "Last healthy run is 91.2h old against a 24h cadence.",
        lastRunAt: "2026-03-30T13:15:00.928Z",
        lastSuccessAt: "2026-03-30T13:15:00.928Z",
        consecutiveFailures: 0,
        expectedIntervalHours: 24,
        lastIssueId: "iss-2",
      },
    ]);

    expect(signature).toBe(sameAlertDifferentAgeText);
  });

  it("builds a sparse daily accountability view from issue state and comment evidence", () => {
    const snapshot = buildDailyAccountabilitySnapshot({
      generatedAt: "2026-04-01T22:00:00.000Z",
      issues: [
        {
          id: "iss-1",
          title: "Founder EoD brief shipped",
          projectName: "blueprint-executive-ops",
          status: "done",
          priority: "high",
          assigneeAgentId: "chief-1",
          updatedAt: "2026-04-01T21:30:00.000Z",
        },
        {
          id: "iss-2",
          title: "Buyer proof pack follow-up",
          projectName: "blueprint-webapp",
          status: "todo",
          priority: "high",
          assigneeAgentId: "buyer-1",
          updatedAt: "2026-04-01T20:45:00.000Z",
        },
      ] as any,
      agents: [
        { id: "chief-1", name: "Blueprint Chief Of Staff", role: "cto", status: "idle" },
        { id: "buyer-1", name: "Buyer Success Agent", role: "engineer", status: "running" },
      ] as any,
      issueCommentsById: {
        "iss-1": [
          {
            id: "comment-1",
            issueId: "iss-1",
            authorAgentId: "chief-1",
            body: "Published https://www.notion.so/founder-eod artifact and queued the next founder checkpoint.",
            createdAt: "2026-04-01T21:20:00.000Z",
          },
        ],
        "iss-2": [
          {
            id: "comment-2",
            issueId: "iss-2",
            authorAgentId: "buyer-1",
            body: "Checked in with the buyer and waiting for a reply.",
            createdAt: "2026-04-01T20:30:00.000Z",
          },
        ],
      } as any,
      routineHealth: {},
    });

    expect(snapshot.materiallyActiveAgentCount).toBe(1);
    expect(snapshot.lowValueAgentCount).toBe(1);
    expect(snapshot.agentsRan[0]?.agentId).toBe("chief-1");
    expect(snapshot.agentsRan[0]?.proofSignals[0]).toContain("Founder EoD brief shipped");
    expect(snapshot.agentsRan[1]?.assessment).toBe("low_value");
  });

  it("wakes the chief of staff on meaningful issue changes, including issues assigned to chief of staff by others", () => {
    expect(
      shouldWakeChiefOfStaffForIssueEvent({
        eventType: "issue.created",
        chiefOfStaffAgentId: "chief-1",
        issue: {
          status: "todo",
          priority: "medium",
          assigneeAgentId: "ops-lead",
          createdByAgentId: "ops-lead",
        } as any,
      }),
    ).toBe(true);

    expect(
      shouldWakeChiefOfStaffForIssueEvent({
        eventType: "issue.created",
        chiefOfStaffAgentId: "chief-1",
        issue: {
          status: "todo",
          priority: "high",
          assigneeAgentId: "chief-1",
          createdByAgentId: "ops-lead",
        } as any,
      }),
    ).toBe(true);

    expect(
      shouldWakeChiefOfStaffForIssueEvent({
        eventType: "issue.updated",
        chiefOfStaffAgentId: "chief-1",
        issue: {
          status: "done",
          priority: "medium",
          assigneeAgentId: "ops-lead",
          createdByAgentId: "ops-lead",
        } as any,
      }),
    ).toBe(true);

    expect(
      shouldWakeChiefOfStaffForIssueEvent({
        eventType: "issue.updated",
        chiefOfStaffAgentId: "chief-1",
        issue: {
          status: "todo",
          priority: "low",
          assigneeAgentId: "chief-1",
          createdByAgentId: "chief-1",
        } as any,
      }),
    ).toBe(false);
  });

  it("suppresses generic create wakes for automation-created issues but still wakes on later updates", () => {
    expect(
      shouldWakeChiefOfStaffForIssueEvent({
        eventType: "issue.created",
        chiefOfStaffAgentId: "chief-1",
        issue: {
          status: "todo",
          priority: "high",
          assigneeAgentId: "ops-lead",
          createdByAgentId: "ops-lead",
          originKind: "blueprint_automation",
        } as any,
      }),
    ).toBe(false);

    expect(
      shouldWakeChiefOfStaffForIssueEvent({
        eventType: "issue.updated",
        chiefOfStaffAgentId: "chief-1",
        issue: {
          status: "blocked",
          priority: "high",
          assigneeAgentId: "ops-lead",
          createdByAgentId: "ops-lead",
          originKind: "blueprint_automation",
        } as any,
      }),
    ).toBe(true);
  });
});
