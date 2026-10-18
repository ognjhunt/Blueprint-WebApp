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

import { projectAgentRunResult, projectWorkspaceResult, teamAlias, termsFor } from "../utils/workspace-projection";
import { RUN_RESULT_SCORING_SCHEMA_VERSION, type RunResultScoring } from "../utils/runResultScoring";
import { syntheticQualifiedAdmission, syntheticSiteTaskQualification, syntheticEpisodeOutcomes } from "./helpers/recommendation-evidence";

const digest = (char: string) => `sha256:${char.repeat(64)}`;
const simulatorScored: RunResultScoring = {
  schemaVersion: RUN_RESULT_SCORING_SCHEMA_VERSION, runtime: "team_evaluation_scored",
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

function qualified(scored = 200, succeeded = 164) {
  return { ...reported, sceneId: "req-1", executionAdmission: syntheticQualifiedAdmission("capture-fixture", "req-1"), quotedEpisodes: 200, executionCaptureId: "capture-fixture",
    result: { ...reported.result, evidenceScope: "simulation" as const,
      scoring: { ...simulatorScored, scoredEpisodeCount: scored, claimCeiling: "site_task_simulation",
        siteTaskQualification: syntheticSiteTaskQualification("capture-fixture", "req-1") }, episodeOutcomes: syntheticEpisodeOutcomes(scored, succeeded),
      observed: { ...reported.result.observed, episodesRun: scored, episodesSucceeded: succeeded, successRate: succeeded / scored } } };
}

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
    const met = projectAgentRunResult(qualified(), "req-1", { ...termsFor({}), successRate: 80 });
    const missed = projectAgentRunResult(qualified(), "req-1", { ...termsFor({}), successRate: 90 });
    expect(met.targetsMet).toBe(true);
    expect(missed.targetsMet).toBe(false);
  });

  it("treats zero cycle duration as missing even for otherwise qualified evidence", () => {
    const candidate = qualified(200, 190); candidate.result.observed.medianCycleSeconds = 0;
    const row = projectAgentRunResult(candidate, "req-1", { ...termsFor({}), successRate: 90, cycleTimeSeconds: 30 });
    expect(row.successRate).toBe(95);
    expect(row.cycleTimeSeconds).toBeNull();
    expect(row.targetsMet).toBeNull();
  });

  it("uses the exact count ratio rather than a rounded stored rate at the pass boundary", () => {
    const candidate = qualified(200, 179); candidate.result.observed.successRate = 0.9;
    const row = projectAgentRunResult(candidate,
      "req-1", { ...termsFor({}), successRate: 90 });
    expect(row.successRate).toBe(89.5);
    expect(row.targetsMet).toBe(false);
  });

  it("keeps diagnostics visible but refuses pass labels without bound scene qualification and complete accounting", () => {
    const terms = { ...termsFor({}), successRate: 80 };
    const missingQualification = qualified(); delete (missingQualification.result.scoring as Partial<RunResultScoring>).siteTaskQualification;
    const missingRows = qualified(); delete (missingRows.result as { episodeOutcomes?: unknown }).episodeOutcomes;
    const duplicates = qualified(); duplicates.result.episodeOutcomes[1].cell_id = duplicates.result.episodeOutcomes[0].cell_id;
    const mismatched = qualified(); mismatched.result.episodeOutcomes[0].outcome = "failure";
    const diagnosticCeiling = qualified(); diagnosticCeiling.result.scoring.claimCeiling = "diagnostic_policy_execution";
    for (const candidate of [reported, missingQualification, missingRows, duplicates, mismatched, diagnosticCeiling,
      { ...qualified(), executionCaptureId: "another-capture" },
      { ...qualified(), executionAdmission: { envelope: { evidence_scope: "development_only" } } }, qualified(189, 164)]) {
      const row = projectAgentRunResult(candidate, "req-1", terms);
      expect(row.sampleCount).toBeGreaterThan(0);
      expect(row.successRate).not.toBeNull();
      expect(row.targetsMet).toBeNull();
    }
    expect(projectAgentRunResult(qualified(190, 171), "req-1", terms).targetsMet).toBe(true);
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

describe("legacy workspace benchmarks", () => {
  it.each(["top_level", "nested"])("retains complete %s observations without claiming the site's targets were met", location => {
    const benchmark = { status: "complete", policy_aggregates: [{ metrics: {
      full_task_success: { estimate: 0.99, sample_count: 200 },
    } }] };
    const run = { status: "completed", buyer_user_id: "team-private", pipeline_result: {
      cycle_time_seconds: { estimate: 12, unit: "seconds" },
      ...(location === "nested" ? { benchmark_projection: benchmark } : {}),
    }, ...(location === "top_level" ? { benchmark_projection: benchmark } : {}) };
    const row = projectWorkspaceResult("legacy-run", run, "req-1", { ...termsFor({}), successRate: 95, cycleTimeSeconds: 30 });
    expect(row).toMatchObject({ successRate: 99, cycleTimeSeconds: 12, sampleCount: 200, evidenceLabel: "Simulation", targetsMet: null });
    expect(row.teamAlias).not.toContain("team-private");
  });
});
