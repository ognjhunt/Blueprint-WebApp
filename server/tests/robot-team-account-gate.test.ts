// @vitest-environment node
/**
 * A team with a run on record hears once when that run reports, at its bound
 * account's address. The agent API and the account's agent keys that this file
 * also covered are gone (frame of 2026-11-12: robot teams running their own
 * software is "later").
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState } from "./helpers/fake-firestore";

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE } = await import("./helpers/fake-firestore");
  return {
    default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => FAKE_FIELD_DELETE } } },
    dbAdmin: sharedFakeFirestore,
    storageAdmin: null,
  };
});
vi.mock("../logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

beforeEach(() => {
  sharedFakeFirestoreState.docs.clear();
  sharedFakeFirestoreState.docs.set("robotTeams/team-1", { id: "team-1", name: "Acme Robotics",
    accountUid: "robot-owner", accountEmail: "robot-owner@example.com" });
});

describe("the team hears when its evaluation run reports", () => {
  it("emails the account once per run, for a result and for a run with none", async () => {
    const { notifyTeamOfRunOutcome } = await import("../utils/robotTeamNotifications");
    const teamId = "team-1";
    await notifyTeamOfRunOutcome({ teamId, runId: "run-1", outcome: { kind: "result", episodesSucceeded: 41, episodesRun: 50 } });
    await notifyTeamOfRunOutcome({ teamId, runId: "run-1", outcome: { kind: "result", episodesSucceeded: 41, episodesRun: 50 } });
    await notifyTeamOfRunOutcome({ teamId, runId: "run-2", outcome: { kind: "no_result" } });

    const rows = [...sharedFakeFirestoreState.docs.entries()]
      .filter(([key]) => key.startsWith("captureOutbox/team:"))
      .map(([, value]) => value as Record<string, string>);
    expect(rows).toHaveLength(2);
    const result = rows.find((row) => row.kind === "team_run_result")!;
    expect(result.to).toBe("robot-owner@example.com");
    expect(result.body).toContain("41 of 50 simulated episodes succeeded");
    // No page lists a team's runs, so no email points at one.
    expect(result.body).not.toMatch(/tryblueprint\.io\/app|workspace|settings\?tab=agent/);
    const noResult = rows.find((row) => row.kind === "team_run_no_result")!.body;
    expect(noResult).toMatch(/nothing is charged for it/i);
    expect(noResult).not.toMatch(/workspace/);
    for (const body of [result.body, noResult]) expect(body).not.toMatch(/\bbalance\b|\bhold\b|top-?up/i);
  });
});
