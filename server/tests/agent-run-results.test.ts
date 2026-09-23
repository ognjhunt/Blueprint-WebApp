// @vitest-environment node
/**
 * What a run showed, and what that entitles us to claim.
 *
 * ## The loop that was never closed
 *
 * `recordEvaluationOutcome` and `recordMeasuredCapability` were the two
 * functions that write a result back into the registry, and nothing called
 * either of them. So the `measured` grade — the top rung of the ladder that
 * governs the entire registry — had no writer; a `self_registered` team could
 * never be promoted into the supply sites are shown, because the only path in
 * was an uncalled function; and a team could buy evaluations and had no way to
 * learn what they showed. Money settled, results went nowhere.
 *
 * ## Why the band maths is the load-bearing part
 *
 * Once a run writes `demonstratedSuccessRate` at `measured`, nothing outranks
 * it. Not the team's own answer, not a later datasheet, not another run that
 * reports a worse figure at the same grade. That permanence is the point of the
 * ladder and it is exactly why an inflated band is worse than no band: a run
 * that reports fifty-for-fifty has not demonstrated better than 99%, and
 * writing that would make `measured` less trustworthy than the dropdown it
 * supersedes.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { sharedFakeFirestoreState } from "./helpers/fake-firestore";

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE } = await import("./helpers/fake-firestore");
  return {
    default: {
      firestore: {
        FieldValue: {
          serverTimestamp: () => "SERVER_TIMESTAMP",
          delete: () => FAKE_FIELD_DELETE,
        },
      },
    },
    dbAdmin: sharedFakeFirestore,
  };
});

vi.mock("../logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const {
  cycleTimeBand,
  getRunForTeam,
  listRunsForTeam,
  measurementContradictsBand,
  recordRunResult,
  successRateBand,
  wilsonLowerBound,
  wilsonUpperBound,
} = await import("../utils/agentRunResults");
const { getRobotTeam } = await import("../utils/robotTeamRegistry");

const TEAM = "team-alpha";

function seedRun(runId = "run_res_1", teamId = TEAM) {
  sharedFakeFirestoreState.docs.set(`evaluationRuns/${runId}`, {
    runId,
    teamId,
    checkpointId: "ckpt-1",
    sceneId: "scene-1",
    taskFamily: "tote_transfer",
    reservationId: runId.replace(/^run_/, ""),
    quotedUsd: 250,
    quotedEpisodes: 50,
    state: "completed",
    episodesRun: 50,
    moneyResolved: true,
    requestedAtIso: "2026-09-17T00:00:00.000Z",
    resolvedAtIso: "2026-09-17T01:00:00.000Z",
    note: null,
  });
}

function seedTeam(status = "self_registered") {
  sharedFakeFirestoreState.docs.set(`robotTeams/${TEAM}`, {
    id: TEAM,
    name: "Alpha Robotics",
    status,
    registrationSource: "self_serve",
    capability: {},
    fieldProvenance: {},
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  });
}

beforeEach(() => {
  sharedFakeFirestoreState.docs.clear();
});

/* ------------------------------------------- the claim is not the observation */

describe("a band is the lower bound of what was seen, never the ratio", () => {
  it("refuses to call fifty-for-fifty better than 99%", async () => {
    // The observation is 100%. The claim that fifty trials supports is not.
    expect(successRateBand(50, 50)).toBe("ninety");
  });

  it("refuses to call ten-for-ten anything at all", async () => {
    // Ten trials cannot distinguish 90% from 99%, so there is no honest band.
    // Null keeps whatever the registry had rather than adding a claim the
    // evidence does not carry.
    expect(successRateBand(10, 10)).toBeNull();
  });

  it("lets a long clean run earn the top band", async () => {
    expect(successRateBand(1_000, 1_000)).toBe("ninetynine_plus");
  });

  it("gives no band at all when the run was plainly poor", async () => {
    // There is no band below `ninety`, and `unsure` means "not measured on a
    // task like this" -- which would be false about a run that measured it.
    expect(successRateBand(30, 50)).toBeNull();
    expect(successRateBand(0, 50)).toBeNull();
  });

  it("never returns a band for an empty run", () => {
    expect(successRateBand(0, 0)).toBeNull();
  });

  it("produces a bound inside [0,1] for every plausible input", () => {
    for (const [k, n] of [[0, 1], [1, 1], [5, 10], [99, 100], [0, 10_000]]) {
      const bound = wilsonLowerBound(k, n);
      expect(bound).toBeGreaterThanOrEqual(0);
      expect(bound).toBeLessThanOrEqual(1);
    }
    // And no width at all when there is no sample, rather than NaN.
    expect(wilsonLowerBound(0, 0)).toBe(0);
  });

  it("is monotonic: more successes never lowers the bound", () => {
    let previous = -1;
    for (let k = 0; k <= 100; k += 10) {
      const bound = wilsonLowerBound(k, 100);
      expect(bound).toBeGreaterThanOrEqual(previous);
      previous = bound;
    }
  });
});

describe("cycle time bands", () => {
  it.each([
    { seconds: 12, band: "under_30s" },
    { seconds: 45, band: "thirty_to_two_min" },
    { seconds: 300, band: "two_to_ten_min" },
    { seconds: 1_200, band: "over_ten_min" },
  ])("maps $seconds seconds to $band", ({ seconds, band }) => {
    expect(cycleTimeBand(seconds)).toBe(band);
  });

  it("says it varies when the spread is wide, whatever the median", () => {
    // A band describes a pace a job holds. A run whose slowest cycles are many
    // times its fastest does not hold one.
    expect(cycleTimeBand(45, 10, 200)).toBe("varies");
  });

  it("does not claim variance from a median alone", () => {
    expect(cycleTimeBand(45, null, null)).toBe("thirty_to_two_min");
  });

  it("claims nothing when no cycle was measured", () => {
    expect(cycleTimeBand(null)).toBeNull();
    expect(cycleTimeBand(0)).toBeNull();
  });
});

/* ------------------------------------------------------- closing the loop */

describe("a reported result reaches the registry", () => {
  it("writes a measured figure that outranks the team's own answer", async () => {
    seedRun();
    sharedFakeFirestoreState.docs.set(`robotTeams/${TEAM}`, {
      id: TEAM,
      name: "Alpha Robotics",
      status: "applied",
      // What the team said about itself, at the grade a form produces.
      capability: { demonstratedSuccessRate: "ninetynine_plus" },
      fieldProvenance: {
        demonstratedSuccessRate: { grade: "self_reported", source: "intake" },
      },
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
    });

    await recordRunResult({
      runId: "run_res_1",
      report: { episodesRun: 50, episodesSucceeded: 50 },
    });

    const team = await getRobotTeam(TEAM);
    // The run said ninety. The team had claimed better than 99%. Measured wins,
    // and it wins downwards -- which is the whole reason the ladder exists.
    expect(team?.capability.demonstratedSuccessRate).toBe("ninety");
    expect(team?.fieldProvenance?.demonstratedSuccessRate?.grade).toBe("measured");
  });

  it("promotes a self-registered team into the supply sites are shown", async () => {
    // The only path from `self_registered` into the matchable set, and it was
    // unreachable: the function that does it had no caller.
    seedRun();
    seedTeam("self_registered");

    await recordRunResult({
      runId: "run_res_1",
      report: { episodesRun: 1_000, episodesSucceeded: 1_000 },
    });

    const team = await getRobotTeam(TEAM);
    expect(team?.status).toBe("applied");
  });

  it("does not promote a team whose run established nothing", async () => {
    // A run too short to support any band is not evidence, so it does not buy
    // a place in the list sites are shown.
    seedRun();
    seedTeam("self_registered");

    await recordRunResult({
      runId: "run_res_1",
      report: { episodesRun: 10, episodesSucceeded: 10 },
    });

    const team = await getRobotTeam(TEAM);
    expect(team?.status).toBe("self_registered");
  });

  it("keeps the observation even when it can claim nothing from it", async () => {
    seedRun();
    seedTeam();

    const result = await recordRunResult({
      runId: "run_res_1",
      report: { episodesRun: 50, episodesSucceeded: 30 },
    });

    expect(result?.observed).toMatchObject({
      episodesRun: 50,
      episodesSucceeded: 30,
      successRate: 0.6,
    });
    expect(result?.claimed.demonstratedSuccessRate).toBeNull();
  });

  it("refuses a result for a run no hold was ever taken for", async () => {
    // Inventing a team and a checkpoint to have somewhere to write would put a
    // measured-grade claim on a robot nobody evaluated.
    await expect(
      recordRunResult({ runId: "run_res_nobody", report: { episodesRun: 50, episodesSucceeded: 50 } }),
    ).resolves.toBeNull();
  });

  it("caps successes at the episodes that ran", async () => {
    seedRun();
    seedTeam();

    const result = await recordRunResult({
      runId: "run_res_1",
      report: { episodesRun: 50, episodesSucceeded: 9_000 },
    });

    expect(result?.observed.episodesSucceeded).toBe(50);
  });
});

/* -------------------------------------------------------- reading it back */

describe("a team can read its own results and only its own", () => {
  it("returns a run with whatever it showed", async () => {
    seedRun();
    seedTeam();
    await recordRunResult({
      runId: "run_res_1",
      report: { episodesRun: 200, episodesSucceeded: 199, medianCycleSeconds: 42 },
    });

    const run = await getRunForTeam(TEAM, "run_res_1");
    expect(run?.result?.observed.successRate).toBe(1);
    expect(run?.result?.claimed.cycleTime).toBe("thirty_to_two_min");
  });

  it("refuses another team's run even with the right id", async () => {
    // Run ids are derivable from reservation ids, so scoping has to happen in
    // the read rather than in a filter afterwards.
    seedRun("run_res_1", "team-beta");

    await expect(getRunForTeam(TEAM, "run_res_1")).resolves.toBeNull();
  });

  it("lists runs that have settled, which the holds list drops", async () => {
    // A finished run disappears from `GET /runs` at the moment it becomes
    // useful. This is the list that keeps it.
    seedRun("run_res_1");
    seedRun("run_res_2");

    const runs = await listRunsForTeam(TEAM);
    expect(runs).toHaveLength(2);
    expect(runs.every((run) => run.moneyResolved)).toBe(true);
  });
});

/* --------------------------------- a measurement that disproves a claim */

describe("a run that rules out a claim withdraws it", () => {
  /** A team that has already told us how good it is. */
  function seedTeamClaiming(band: string, grade = "self_reported") {
    sharedFakeFirestoreState.docs.set(`robotTeams/${TEAM}`, {
      id: TEAM,
      name: "Alpha Robotics",
      status: "applied",
      registrationSource: "self_serve",
      capability: { demonstratedSuccessRate: band },
      fieldProvenance: {
        demonstratedSuccessRate: {
          grade,
          source: "intake:req-1",
          observedAt: "2026-09-01T00:00:00.000Z",
        },
      },
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
    });
  }

  it("clears a self-reported band the run disproved", async () => {
    // The hole. `recordRunResult` only wrote to the registry for fields that
    // earned a band, so a run measuring 30 of 50 wrote nothing -- and the
    // team's own `ninetyfive` survived the strongest evidence we will ever
    // have about that checkpoint.
    seedRun();
    seedTeamClaiming("ninetyfive");

    await recordRunResult({
      runId: "run_res_1",
      report: {
        episodesRun: 50,
        episodesSucceeded: 30,
        medianCycleSeconds: null,
        cycleSecondsP10: null,
        cycleSecondsP90: null,
        note: null,
        artifactUri: null,
      },
    });

    const team = await getRobotTeam(TEAM);
    expect(team?.capability.demonstratedSuccessRate).toBeNull();
    // Recorded as a measured finding, not as an absence. That grade is what
    // stops a later self-report from restoring the number.
    expect(team?.fieldProvenance.demonstratedSuccessRate?.grade).toBe("measured");
    expect(team?.fieldProvenance.demonstratedSuccessRate?.source).toContain("run_res_1");
  });

  it("leaves a claim alone when a short clean run cannot disprove it", async () => {
    // Ten-for-ten earns no band, because ten trials cannot separate 90% from
    // 99%. It is also a perfect result. Withdrawing on "no band" would mean a
    // team's good short run cost it the claim its long run earned.
    seedRun();
    seedTeamClaiming("ninetyfive");
    sharedFakeFirestoreState.docs.set("evaluationRuns/run_res_1", {
      ...(sharedFakeFirestoreState.docs.get("evaluationRuns/run_res_1") as object),
      episodesRun: 10,
    });

    await recordRunResult({
      runId: "run_res_1",
      report: {
        episodesRun: 10,
        episodesSucceeded: 10,
        medianCycleSeconds: null,
        cycleSecondsP10: null,
        cycleSecondsP90: null,
        note: null,
        artifactUri: null,
      },
    });

    const team = await getRobotTeam(TEAM);
    expect(team?.capability.demonstratedSuccessRate).toBe("ninetyfive");
    expect(team?.fieldProvenance.demonstratedSuccessRate?.grade).toBe("self_reported");
  });

  it("withdraws a measured band that a later run disproved", async () => {
    // Measured does not mean immortal. A previous run's band is evidence, and
    // evidence can be superseded by evidence at the same grade.
    seedRun();
    seedTeamClaiming("ninetynine", "measured");

    await recordRunResult({
      runId: "run_res_1",
      report: {
        episodesRun: 50,
        episodesSucceeded: 20,
        medianCycleSeconds: null,
        cycleSecondsP10: null,
        cycleSecondsP90: null,
        note: null,
        artifactUri: null,
      },
    });

    const team = await getRobotTeam(TEAM);
    expect(team?.capability.demonstratedSuccessRate).toBeNull();
  });

  it("does not touch the registry for a run that executed nothing", async () => {
    // Zero episodes is an environment that would not launch. It is not a
    // measurement and it must not erase anything.
    seedRun();
    seedTeamClaiming("ninetyfive");

    await recordRunResult({
      runId: "run_res_1",
      report: {
        episodesRun: 0,
        episodesSucceeded: 0,
        medianCycleSeconds: null,
        cycleSecondsP10: null,
        cycleSecondsP90: null,
        note: null,
        artifactUri: null,
      },
    });

    const team = await getRobotTeam(TEAM);
    expect(team?.capability.demonstratedSuccessRate).toBe("ninetyfive");
  });
});

describe("contradiction, not silence", () => {
  it("rules out a band only when the whole interval sits below it", () => {
    // 30/50 has an upper bound near 72%, so it rules out every band we state.
    expect(measurementContradictsBand(30, 50, "ninety")).toBe(true);
    expect(measurementContradictsBand(30, 50, "ninetyfive")).toBe(true);

    // 47/50 observes 94% with an upper bound near 98%: it cannot rule out a
    // 95% claim, and it can rule out a 99% one.
    expect(measurementContradictsBand(47, 50, "ninetyfive")).toBe(false);
    expect(measurementContradictsBand(47, 50, "ninetynine")).toBe(true);

    // A perfect short run rules out nothing at all.
    expect(measurementContradictsBand(10, 10, "ninetynine_plus")).toBe(false);
  });

  it("treats an empty run and an unrecognised band as contradicting nothing", () => {
    expect(measurementContradictsBand(0, 0, "ninety")).toBe(false);
    expect(measurementContradictsBand(0, 50, "unsure")).toBe(false);
    expect(measurementContradictsBand(0, 50, null)).toBe(false);
  });

  it("brackets the observation between the two bounds", () => {
    for (const [k, n] of [[30, 50], [10, 10], [47, 50], [0, 50], [1, 3]]) {
      const lower = wilsonLowerBound(k, n);
      const upper = wilsonUpperBound(k, n);
      expect(lower).toBeLessThanOrEqual(k / n);
      expect(upper).toBeGreaterThanOrEqual(k / n);
      expect(upper).toBeLessThanOrEqual(1);
    }
  });
});


describe("immutable results and repeat delivery", () => {
  it("reuses an identical receipt and meters its episodes once", async () => {
    seedRun(); seedTeam();
    const request = { runId: "run_res_1", report: { episodesRun: 50, episodesSucceeded: 40, artifactUri: "gs://fixtures/receipt.json" } };
    const first = await recordRunResult(request);
    const stored = sharedFakeFirestoreState.docs.get("evaluationRuns/run_res_1")!;
    // Firestore map iteration order is not JSON property insertion order.
    const reversed = Object.fromEntries(Object.entries(first!).reverse());
    sharedFakeFirestoreState.docs.set("evaluationRuns/run_res_1", { ...stored, result: reversed });
    const second = await recordRunResult(request);
    expect(second).toEqual(first);
    const cohort = sharedFakeFirestoreState.docs.get("siteCohortEconomics/" + first!.sceneId);
    expect(cohort).toMatchObject({ screeningEpisodes: 50, paidEntries: 1 });
    await expect(recordRunResult({ ...request, report: { ...request.report, episodesSucceeded: 50 } })).rejects.toThrow("conflicts");
    expect(sharedFakeFirestoreState.docs.get("evaluationRuns/run_res_1")?.result).toEqual(first);
  });
});

describe("the site hears when a result lands", () => {
  it("emails the site once per run, with what was observed", async () => {
    seedRun();
    seedTeam("applied");
    sharedFakeFirestoreState.docs.set("inboundRequests/scene-1", { contact: { email: "site@example.com" } });

    await recordRunResult({ runId: "run_res_1", report: { episodesRun: 50, episodesSucceeded: 41 } });
    await recordRunResult({ runId: "run_res_1", report: { episodesRun: 50, episodesSucceeded: 41 } });

    const notices = [...sharedFakeFirestoreState.docs.entries()]
      .filter(([key]) => key.startsWith("captureOutbox/scene-1:results_ready:"));
    expect(notices).toHaveLength(1);
    expect(notices[0][1]).toMatchObject({ to: "site@example.com", kind: "results_ready" });
    expect(String((notices[0][1] as { body: string }).body)).toContain("41 of 50 simulated episodes succeeded");
  });
});
