// @vitest-environment node
/**
 * An agent run, as a row in the site's results table.
 *
 * The workspace table read only the legacy job-request collection, so a site
 * whose scene had been screened by three teams still saw "No team results
 * yet". This pins the projection: anonymised alias, observed numbers only,
 * simulation labelled as such, and a queued run shown as queued rather than
 * hidden.
 */
import { describe, expect, it } from "vitest";

import { projectAgentRunResult, teamAlias, termsFor } from "../utils/workspace-projection";
import { RUN_RESULT_SCORING_SCHEMA_VERSION, type RunResultScoring } from "../utils/runResultScoring";

const digest = (char: string) => `sha256:${char.repeat(64)}`;
const simulatorScored: RunResultScoring = {
  schemaVersion: RUN_RESULT_SCORING_SCHEMA_VERSION, runtime: "policy_canary_quick10_team_candidate",
  successSource: "simulator_scored", scoredEpisodeCount: 50, successContractDigest: digest("1"),
  sceneRevisionDigest: digest("2"), robotFreeProbeReceiptDigest: digest("3"),
  teamCandidateAdmissionDigest: digest("4"), sessionResultDigest: digest("5"), claimCeiling: "diagnostic_policy_execution",
};

const reported = {
  runId: "run_r1",
  teamId: "team-a",
  state: "completed" as const,
  result: {
    scoring: simulatorScored,
    observed: { episodesRun: 50, episodesSucceeded: 41, successRate: 0.82, medianCycleSeconds: 38.5 },
  },
};

describe("projectAgentRunResult", () => {
  it("shows observed numbers under the task-scoped alias, labelled as simulation", () => {
    const row = projectAgentRunResult(reported, "req-1", termsFor({}));

    expect(row.id).toBe("run_r1");
    expect(row.teamAlias).toBe(teamAlias("req-1", "team-a"));
    expect(row.teamAlias).not.toContain("team-a");
    expect(row.status).toBe("completed");
    expect(row.successRate).toBe(82);
    expect(row.cycleTimeSeconds).toBe(38.5);
    expect(row.sampleCount).toBe(50);
    expect(row.evidenceLabel).toBe("Simulation");
    expect(row.selected).toBe(false);
  });

  it("judges the site's targets when it has any", () => {
    const met = projectAgentRunResult(reported, "req-1", { ...termsFor({}), successRate: 80 });
    const missed = projectAgentRunResult(reported, "req-1", { ...termsFor({}), successRate: 90 });
    expect(met.targetsMet).toBe(true);
    expect(missed.targetsMet).toBe(false);
  });

  it("never calls targets met on a count the simulator did not score", () => {
    const terms = { ...termsFor({}), successRate: 80 };
    const unlabelled = { ...reported, result: { observed: reported.result.observed } };
    const teamReported = { ...reported, result: { ...reported.result,
      scoring: { ...simulatorScored, runtime: "http_policy_api_observation_probe", successSource: "team_reported" } } };
    for (const run of [unlabelled, teamReported]) {
      const row = projectAgentRunResult(run, "req-1", terms);
      expect(row.successRate).toBe(82);
      expect(row.targetsMet).toBeNull();
    }
  });

  it("shows a queued run as queued with no numbers", () => {
    const row = projectAgentRunResult(
      { runId: "run_r2", teamId: "team-b", state: "requested", result: null },
      "req-1",
      termsFor({}),
    );
    expect(row.status).toBe("requested");
    expect(row.successRate).toBeNull();
    expect(row.sampleCount).toBeNull();
    expect(row.targetsMet).toBeNull();
  });

  it("shows a zero-episode completion as no result", () => {
    const row = projectAgentRunResult(
      {
        runId: "run_empty",
        teamId: "team-b",
        state: "completed",
        result: { observed: { episodesRun: 0, episodesSucceeded: 0, successRate: null, medianCycleSeconds: null } },
      },
      "req-1",
      termsFor({}),
    );
    expect(row.status).toBe("no_result");
    expect(row.successRate).toBeNull();
    expect(row.sampleCount).toBeNull();
  });

  it("shows an environment-blocked run as blocked", () => {
    const row = projectAgentRunResult(
      { runId: "run_blocked", teamId: "team-b", state: "blocked", result: null },
      "req-1",
      termsFor({}),
    );
    expect(row.status).toBe("blocked");
  });
});
