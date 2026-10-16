// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
import type { RobotTeamRecord } from "../types/robot-team-registry";
import { syntheticSiteTaskQualification, syntheticEpisodeOutcomes } from "./helpers/recommendation-evidence";

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, fakeArrayUnion } = await import("./helpers/fake-firestore");
  return { dbAdmin: sharedFakeFirestore, storageAdmin: null,
    default: { firestore: { FieldValue: { serverTimestamp: () => "server-time", arrayUnion: fakeArrayUnion } } } };
});
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
const slack = vi.hoisted(() => vi.fn(async () => ({ sent: true })));
vi.mock("../utils/slack", async importOriginal => ({ ...(await importOriginal<typeof import("../utils/slack")>()), sendSlackMessage: slack }));

const evidence = await import("../utils/pilotRecommendationEvidence");
const { RUN_RESULT_SCORING_SCHEMA_VERSION } = await import("../utils/runResultScoring");
const digest = (char: string) => `sha256:${char.repeat(64)}`;
/** What the Pipeline states for a team candidate's Quick-10 run: simulator-scored and fully bound. */
const scored = (episodes: number, overrides: Record<string, unknown> = {}) => ({
  schemaVersion: RUN_RESULT_SCORING_SCHEMA_VERSION, runtime: "team_evaluation_scored",
  successSource: "simulator_scored", scoredEpisodeCount: episodes, successContractDigest: digest("1"),
  sceneRevisionDigest: digest("2"), robotFreeProbeReceiptDigest: digest("3"), teamCandidateAdmissionDigest: digest("4"),
  sessionResultDigest: digest("5"), claimCeiling: "site_task_simulation", siteTaskQualification: syntheticSiteTaskQualification(), ...overrides,
});
const identity = await import("../utils/robotTeamIdentity");
const { upsertRobotTeamFromIntake } = await import("../utils/robotTeamRegistry");
const opsAlerts = await import("../utils/pilotOpsAlerts");
const { buildIdentitySplitReport } = await import("../../scripts/ops/report-robot-team-identity-splits");

function run(observed: Partial<{ episodesRun: number; episodesSucceeded: number; medianCycleSeconds: number | null }> = {}, overrides: Record<string, unknown> = {}) {
  const episodesRun = observed.episodesRun ?? 200, episodesSucceeded = observed.episodesSucceeded ?? 190;
  return { runId: "run_1", reservationId: "free_1", teamId: "team_a", checkpointId: "ckpt", sceneId: "job_1", taskFamily: null,
    evaluationPurpose: "pilot" as const, quotedUsd: 0, quotedEpisodes: 200, state: "completed" as const, episodesRun, moneyResolved: true,
    requestedAtIso: "2026-10-01T00:00:00.000Z", resolvedAtIso: null, note: null,
    executionCaptureId: "capture-fixture",
    result: { evidenceScope: "simulation" as const, episodeOutcomes: syntheticEpisodeOutcomes(episodesRun, episodesSucceeded), scoring: scored(episodesRun) as any, runId: "run_1", teamId: "team_a", checkpointId: "ckpt", sceneId: "job_1",
      observed: { episodesRun, episodesSucceeded, successRate: Math.round((episodesSucceeded / episodesRun) * 100) / 100, medianCycleSeconds: observed.medianCycleSeconds ?? null },
      claimed: { demonstratedSuccessRate: null, cycleTime: null }, note: null, artifactUri: null, reportedAtIso: "2026-10-02T00:00:00.000Z" },
    ...overrides };
}

const team = (row: Partial<RobotTeamRecord> & { id: string }): RobotTeamRecord =>
  ({ name: row.id, status: "applied", capability: {}, fieldProvenance: {}, createdAt: "2026-01-01", updatedAt: "2026-01-01", ...row }) as RobotTeamRecord;

describe("the job's pass mark", () => {
  it("prefers the site's confirmed target, then the brief, then the documented default", () => {
    expect(evidence.passMarkForJob({ workspace_task: { terms: { successRate: 95, cycleTimeSeconds: 30 } } }, { successCriteria: { successRate: 80 } }))
      .toEqual({ successRate: 0.95, source: "job_terms", minimumEpisodes: 190, cycleTimeSeconds: 30 });
    expect(evidence.passMarkForJob({}, { successCriteria: { successRate: 80, cycleTimeSeconds: 45 } }))
      .toMatchObject({ successRate: 0.8, source: "site_task_brief", cycleTimeSeconds: 45 });
    expect(evidence.passMarkForJob({ workspace_task: { terms: { successRate: null } } }, null))
      .toMatchObject({ successRate: 0.9, source: "blueprint_default", cycleTimeSeconds: null });
    expect(evidence.DEFAULT_PASS_MARK_SUCCESS_RATE).toBe(0.9);
  });

  it("passes only a completed, site-visible evaluation of this job that meets the mark", () => {
    const mark = evidence.passMarkForJob({}, null);
    const ok = evidence.verifyRecommendationEvidence({ run: run(), requestId: "job_1", passMark: mark });
    expect(ok).toMatchObject({ ok: true, evidence: { runId: "run_1", episodesSucceeded: 190, episodesRun: 200, evidenceScope: "simulation",
      passMark: mark, passed: true, cycleTimeMet: null, boundary: evidence.SIMULATION_EVIDENCE_BOUNDARY } });
    const refuse = (candidate: Parameters<typeof evidence.verifyRecommendationEvidence>[0]) => {
      const outcome = evidence.verifyRecommendationEvidence(candidate);
      return outcome.ok ? "ok" : outcome.refusal;
    };
    expect(refuse({ run: null, requestId: "job_1", passMark: mark })).toBe("evaluation_run_missing");
    expect(refuse({ run: run(), requestId: "job_2", passMark: mark })).toBe("evaluation_run_other_job");
    expect(refuse({ run: run({}, { evaluationPurpose: "private" }), requestId: "job_1", passMark: mark })).toBe("evaluation_run_private");
    expect(refuse({ run: run({}, { state: "blocked" }), requestId: "job_1", passMark: mark })).toBe("evaluation_result_missing");
    expect(refuse({ run: run({ episodesRun: 200, episodesSucceeded: 170 }), requestId: "job_1", passMark: mark })).toBe("evaluation_below_pass_mark");
    expect(refuse({ run: run({ episodesRun: 10, episodesSucceeded: 10 }), requestId: "job_1", passMark: mark })).toBe("evaluation_too_few_episodes");
    // A scored run with more than 5% void episodes never reaches here: the Pipeline refuses it.
    expect(refuse({ run: run({ episodesRun: 189, episodesSucceeded: 189 }), requestId: "job_1", passMark: mark })).toBe("evaluation_too_few_episodes");
    expect(refuse({ run: run({ medianCycleSeconds: 40 }), requestId: "job_1", passMark: { ...mark, cycleTimeSeconds: 30 } })).toBe("evaluation_cycle_time_missed");
    expect(refuse({ run: run({ medianCycleSeconds: 20 }), requestId: "job_1", passMark: { ...mark, cycleTimeSeconds: 30 } })).toBe("ok");
    for (const medianCycleSeconds of [null, 0, -1, NaN, Infinity]) {
      expect(refuse({ run: run({ medianCycleSeconds }), requestId: "job_1", passMark: { ...mark, cycleTimeSeconds: 30 } })).toBe("evaluation_cycle_time_missing");
    }
    expect(refuse({ run: run(), requestId: "job_1", passMark: mark, expectedResultId: "f".repeat(64) })).toBe("evaluation_result_changed");
  });

  it("admits only successes the simulator scored in an admitted runtime, failing closed on anything else", () => {
    const mark = evidence.passMarkForJob({}, null);
    const withScoring = (scoring: unknown) => {
      const base = run({ episodesRun: 200, episodesSucceeded: 200 });
      return { ...base, result: { ...base.result, scoring: scoring as any } };
    };
    const read = (candidate: ReturnType<typeof run>) => evidence.readEvaluation(candidate, "job_1", mark);
    const ok = evidence.verifyRecommendationEvidence({ run: withScoring(scored(200)), requestId: "job_1", passMark: mark });
    expect(ok).toMatchObject({ ok: true, evidence: { scoring: { runtime: "team_evaluation_scored",
      successSource: "simulator_scored", successContractDigest: digest("1"), robotFreeProbeReceiptDigest: digest("3"),
      claimCeiling: "site_task_simulation" } } });
    const cases: [unknown, string][] = [
      [undefined, "scoring_missing"],
      [{ ...scored(200), schemaVersion: "blueprint.agent_run_result_scoring.v0" }, "scoring_missing"],
      // The legacy HTTP probe door: the team's own HTTP response decided success.
      [scored(200, { runtime: "http_policy_api_observation_probe", successSource: "team_reported" }), "scoring_runtime_not_admitted"],
      [scored(200, { runtime: "legacy_robot_eval_command_batch", successSource: "unverified" }), "scoring_runtime_not_admitted"],
      [scored(200, { runtime: "controlled_native_sealed_task" }), "scoring_runtime_not_admitted"],
      [scored(200, { runtime: "a_runtime_added_later" }), "scoring_runtime_not_admitted"],
      [scored(200, { successSource: "team_reported" }), "scoring_not_simulator_scored"],
      [scored(200, { robotFreeProbeReceiptDigest: null }), "scoring_binding_incomplete"],
      [scored(200, { successContractDigest: "sha256:short" }), "scoring_binding_incomplete"],
      [scored(199), "scoring_episode_count_mismatch"],
    ];
    for (const [scoring, reason] of cases) {
      const reading = read(withScoring(scoring));
      expect(reading.scoringRefusal).toBe(reason);
      expect(reading.passed).toBe(false);
      expect(reading.refusals).toContain("evaluation_not_simulator_scored");
      const outcome = evidence.verifyRecommendationEvidence({ run: withScoring(scoring), requestId: "job_1", passMark: mark });
      expect(outcome).toEqual({ ok: false, refusal: "evaluation_not_simulator_scored" });
    }
  });

  it("states the evidence for the site without checkpoint or run internals", () => {
    const outcome = evidence.verifyRecommendationEvidence({ run: run(), requestId: "job_1", passMark: evidence.passMarkForJob({}, null) });
    if (!outcome.ok) throw new Error("expected evidence");
    const site = evidence.projectEvidenceForSite(outcome.evidence, { resultUrl: "/app/tasks/job_1" });
    expect(site).toMatchObject({ episodesSucceeded: 190, episodesRun: 200, passMarkSuccessRate: 0.9, evidenceScope: "simulation", resultUrl: "/app/tasks/job_1" });
    expect(JSON.stringify(site)).not.toMatch(/ckpt|run_1|team_a/);
    expect(evidence.evidenceCapabilityBasis(outcome.evidence)).toMatch(/in simulation: 190 of 200 episodes.*does not certify physical performance or safety/);
    expect(evidence.projectEvidenceForSite(null, { resultUrl: null })).toBeNull();
  });

  it("keeps the observed pass rule while disclosing voids and the independent-episode confidence interval", () => {
    const outcome = evidence.verifyRecommendationEvidence({ run: run({ episodesRun: 190, episodesSucceeded: 171 }), requestId: "job_1", passMark: evidence.passMarkForJob({}, null) });
    expect(outcome).toMatchObject({ ok: true, evidence: { successRate: 0.9, passRule: "observed_success_rate.v1",
      episodeAccounting: { planned: 200, reported: 200, scored: 190, succeeded: 171, failed: 19, void: 10 } } });
    if (!outcome.ok) throw new Error("expected evidence");
    expect(outcome.evidence.uncertainty!.lower).toBeCloseTo(0.84906, 4);
    expect(outcome.evidence.uncertainty!.boundary).toMatch(/correlated episodes.*other sites/);
    const rounded = run({ episodesRun: 200, episodesSucceeded: 179 });
    rounded.result.observed.successRate = 0.9;
    expect(evidence.readEvaluation(rounded, "job_1", evidence.passMarkForJob({}, null))).toMatchObject({ successRate: 0.895, passed: false });
  });

  it("requires scene qualification and complete episode accounting, even for perfect scores", () => {
    const mark = evidence.passMarkForJob({}, null);
    const variants = [
      { value: run({}, { executionCaptureId: "another-capture" }), refusal: "evaluation_scene_not_qualified" },
      { value: run({}, { executionAdmission: { envelope: { evidence_scope: "development_only" } } }), refusal: "evaluation_development_only" },
    ];
    const development = run(); development.result.evidenceScope = "development_only" as never;
    variants.push({ value: development, refusal: "evaluation_development_only" });
    const missing = run(); delete missing.result.scoring.siteTaskQualification;
    variants.push({ value: missing, refusal: "evaluation_scene_not_qualified" });
    const diagnostic = run(); diagnostic.result.scoring.claimCeiling = "diagnostic_policy_execution";
    variants.push({ value: diagnostic, refusal: "evaluation_scene_not_qualified" });
    const duplicates = run(); duplicates.result.episodeOutcomes[1].cell_id = duplicates.result.episodeOutcomes[0].cell_id;
    variants.push({ value: duplicates, refusal: "evaluation_episode_accounting_invalid" });
    const incomplete = run(); incomplete.result.episodeOutcomes.pop();
    variants.push({ value: incomplete, refusal: "evaluation_episode_accounting_invalid" });
    const countMismatch = run(); countMismatch.result.episodeOutcomes[0].outcome = "failure";
    variants.push({ value: countMismatch, refusal: "evaluation_episode_accounting_invalid" });
    for (const { value, refusal } of variants) {
      expect(evidence.verifyRecommendationEvidence({ run: value, requestId: "job_1", passMark: mark })).toEqual({ ok: false, refusal });
      expect(evidence.readEvaluation(value, "job_1", mark).passed).toBe(false);
    }
    const qualified = evidence.verifyRecommendationEvidence({ run: run(), requestId: "job_1", passMark: mark });
    if (!qualified.ok) throw new Error("expected qualified fixture");
    expect(evidence.projectEvidenceForSite({ ...qualified.evidence, evidenceScope: "development_only" }, { resultUrl: null })).toBeNull();
    expect(evidence.projectEvidenceForSite({ ...qualified.evidence, qualification: undefined }, { resultUrl: null })).toBeNull();
  });
});

describe("robot-team identity", () => {
  const intake = team({ id: "team_acme", status: "applied", registrationSource: "intake", contactEmail: "lead@acme.test" });
  const account = team({ id: "team_acme_1a2b", status: "self_registered", registrationSource: "self_serve", accountUid: "uid_1", accountEmail: "Lead@Acme.test" });

  it("resolves an intake row to the account-bound team by verified account email", () => {
    const resolved = identity.resolveIdentityFromRecords(intake, [account]);
    expect(resolved).toMatchObject({ ambiguous: false, canonical: { id: "team_acme_1a2b" } });
    expect(resolved.members.map(row => row.id).sort()).toEqual(["team_acme", "team_acme_1a2b"]);
    // From the account side, the intake row is a member too, so its state counts.
    expect(identity.resolveIdentityFromRecords(account, [intake]).members.map(row => row.id).sort()).toEqual(["team_acme", "team_acme_1a2b"]);
  });

  it("never links on a self-serve row's typed contact email", () => {
    const unbound = team({ id: "team_x_9", status: "self_registered", registrationSource: "self_serve", contactEmail: "lead@acme.test" });
    expect(identity.resolveIdentityFromRecords(intake, [unbound])).toMatchObject({ canonical: { id: "team_acme" }, ambiguous: false });
  });

  it("follows an explicit link and refuses to choose between two accounts", () => {
    const linked = { ...intake, contactEmail: "other@acme.test", canonicalTeamId: "team_acme_1a2b" };
    expect(identity.resolveIdentityFromRecords(linked, [account]).canonical?.id).toBe("team_acme_1a2b");
    const second = team({ id: "team_acme_ffff", status: "self_registered", accountUid: "uid_2", accountEmail: "lead@acme.test" });
    expect(identity.resolveIdentityFromRecords(intake, [account, second])).toMatchObject({ canonical: null, ambiguous: true });
  });

  it("counts only pointer-linked rows as the team's own decisions", () => {
    expect(identity.explicitlyLinked(account, { ...intake, canonicalTeamId: "team_acme_1a2b" })).toBe(true);
    expect(identity.explicitlyLinked({ ...account, linkedIntakeTeamIds: ["team_acme"] }, intake)).toBe(true);
    // Same email but no pointer: a typed public intake cannot speak for the team.
    expect(identity.explicitlyLinked(account, intake)).toBe(false);
  });

  it("reports split identities read-only, including rows missing an explicit link", () => {
    const loner = team({ id: "team_solo", contactEmail: "solo@example.test" });
    const report = buildIdentitySplitReport([intake, account, loner]);
    expect(report).toHaveLength(1);
    expect(report[0]).toMatchObject({ canonicalId: "team_acme_1a2b", ambiguous: false, unlinkedMemberIds: ["team_acme"] });
    expect(JSON.stringify(report)).not.toContain("lead@acme.test");
    const linkedReport = buildIdentitySplitReport([{ ...intake, canonicalTeamId: "team_acme_1a2b" }, account]);
    expect(linkedReport[0].unlinkedMemberIds).toEqual([]);
  });

  describe("at intake time", () => {
    beforeEach(() => state.docs.clear());

    it("links an evaluation-request intake to the signed-in account's team, both ways", async () => {
      state.docs.set("robotTeams/team_acme_1a2b", { ...account } as never);
      const record = await upsertRobotTeamFromIntake({ requestId: "req_eval_1", company: "Acme", contactEmail: "lead@acme.test",
        gates: {}, spec: {}, accountUid: "uid_1" });
      expect(record).toMatchObject({ id: "team_acme", status: "applied", canonicalTeamId: "team_acme_1a2b" });
      expect(state.docs.get("robotTeams/team_acme")).toMatchObject({ canonicalTeamId: "team_acme_1a2b" });
      expect(state.docs.get("robotTeams/team_acme_1a2b")).toMatchObject({ linkedIntakeTeamIds: ["team_acme"], status: "self_registered" });
      const resolved = await identity.resolveRobotTeamIdentity("team_acme");
      expect(resolved?.canonical?.id).toBe("team_acme_1a2b");
    });

    it("links nothing when the account owns several teams or none", async () => {
      state.docs.set("robotTeams/team_acme_1a2b", { ...account } as never);
      state.docs.set("robotTeams/team_acme_cccc", { ...account, id: "team_acme_cccc" } as never);
      const record = await upsertRobotTeamFromIntake({ requestId: "req_eval_2", company: "Acme", contactEmail: "lead@acme.test", gates: {}, spec: {}, accountUid: "uid_1" });
      expect(record?.canonicalTeamId).toBeUndefined();
      state.docs.clear();
      const plain = await upsertRobotTeamFromIntake({ requestId: "req_public", company: "Solo", contactEmail: "solo@example.test", gates: {}, spec: {} });
      expect(plain?.canonicalTeamId).toBeUndefined();
    });
  });
});

describe("ops alerts", () => {
  beforeEach(() => { state.docs.clear(); slack.mockClear(); process.env.SLACK_WEBHOOK_URL = "https://hooks.example.test/fixture"; });

  it("rings once per event with ids and a link only", async () => {
    const params = { workspaceRequestId: "req_eval_1", jobId: "job_1", teamIds: ["team_acme_1a2b"] };
    expect(await opsAlerts.alertOpsEvaluationNeedsAdmission(params)).toEqual({ sent: true });
    expect(await opsAlerts.alertOpsEvaluationNeedsAdmission(params)).toMatchObject({ sent: false, reason: "already_rung" });
    expect(slack).toHaveBeenCalledTimes(1);
    const [text] = slack.mock.calls[0] as unknown as [string];
    expect(text).toMatch(/needs founder admission.*req_eval_1.*job_1.*team_acme_1a2b/s);
    expect(opsAlerts.pilotBookedAlertText({ requestId: "job_1", recommendationId: "rec_1", teamId: "team_a" })).toMatch(/job `job_1`.*rec_1.*team_a.*\/admin\/robot-team-access\?job=job_1/s);
    expect(opsAlerts.pilotBookedAlertText({ requestId: "x@y.test", recommendationId: "rec_1", teamId: "team_a" })).not.toContain("x@y.test");
    delete process.env.SLACK_WEBHOOK_URL;
    expect(await opsAlerts.alertOpsPilotBooked({ requestId: "job_2", recommendationId: "rec_2", teamId: "team_a" })).toMatchObject({ sent: false, reason: "webhook_unconfigured" });
  });
});
