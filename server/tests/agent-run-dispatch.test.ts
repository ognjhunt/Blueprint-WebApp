// @vitest-environment node
/**
 * The seam the Pipeline reads runs from, and what a site can see of them.
 *
 * A purchased run used to be a record nothing consumed. These pin the three
 * things that change that: queued runs can be listed, a started run is marked
 * and is not released as abandoned while it executes, and a scene can count
 * who is being screened against it and the best result so far.
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
  createRequestedRun,
  listRequestedRuns,
  markRunStarted,
  loadSceneScreening,
  reservationTtlMs,
  claimRunCancellation,
} = await import("../utils/agentEvalRuns");

async function queue(params: { reservationId: string; teamId: string; sceneId: string }) {
  const run = await createRequestedRun({
    teamId: params.teamId,
    checkpointId: "ckpt-1",
    sceneId: params.sceneId,
    taskFamily: "pick_place",
    reservationId: params.reservationId,
    quotedUsd: 25,
    quotedEpisodes: 50,
  });
  if (!run) throw new Error("run not written");
  return run;
}

function stored(runId: string) {
  return sharedFakeFirestoreState.docs.get(`evaluationRuns/${runId}`) as Record<string, unknown>;
}

beforeEach(() => {
  sharedFakeFirestoreState.docs.clear();
});

describe("listing queued runs for the Pipeline", () => {
  it("lists requested runs and nothing that already concluded", async () => {
    await queue({ reservationId: "r1", teamId: "team-a", sceneId: "req-1" });
    await queue({ reservationId: "r2", teamId: "team-b", sceneId: "req-1" });
    sharedFakeFirestoreState.docs.set("evaluationRuns/run_r3", {
      runId: "run_r3",
      teamId: "team-c",
      sceneId: "req-1",
      state: "completed",
      requestedAtIso: "2026-09-01T00:00:00.000Z",
    });

    const runs = await listRequestedRuns();

    expect(runs.map((run) => run.runId).sort()).toEqual(["run_r1", "run_r2"]);
  });
});

it("partitions the pending queue before limiting it and excludes expired holds", async () => {
  for (const [id, captureId] of [["other", "other-capture"], ["wanted", "this-capture"], ["expired", "this-capture"]]) {
    await createRequestedRun({ teamId: "team-a", checkpointId: "cp", sceneId: id, taskFamily: "pick_place", reservationId: id, quotedUsd: 25, quotedEpisodes: 50,
      executionAdmission: { envelope: { binding: { capture_id: captureId } }, digestSha256: `sha256:${"a".repeat(64)}` } });
  }
  sharedFakeFirestoreState.docs.set("evaluationRuns/run_expired", { ...stored("run_expired"), settlementDueAtMs: Date.now() - 1 });
  expect((await listRequestedRuns(1, "this-capture")).map(run => run.runId)).toEqual(["run_wanted"]);
});

describe("marking a run started", () => {
  it("records the dispatch and pushes the settlement due time out by one TTL from now", async () => {
    const run = await queue({ reservationId: "r1", teamId: "team-a", sceneId: "req-1" });
    // A run that waited in the queue past its own hold: without the start
    // marker the reconciler would release it as abandoned while it executes.
    sharedFakeFirestoreState.docs.set(`evaluationRuns/${run.runId}`, {
      ...stored(run.runId),
      requestedAtIso: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      settlementDueAtMs: Date.now() + 60 * 60 * 1000,
    });

    const marked = await markRunStarted({ runId: run.runId, pipelineRunId: "pipe-77" });

    expect(marked).toBe(true);
    const after = stored(run.runId);
    expect((after.dispatch as { pipelineRunId: string }).pipelineRunId).toBe("pipe-77");
    expect(typeof (after.dispatch as { startedAtIso: string }).startedAtIso).toBe("string");
    expect(Number(after.settlementDueAtMs)).toBeGreaterThanOrEqual(Date.now() + reservationTtlMs() - 5_000);
    expect(after.state).toBe("requested");
  });

  it("refuses to start a run that already concluded", async () => {
    sharedFakeFirestoreState.docs.set("evaluationRuns/run_done", {
      runId: "run_done",
      teamId: "team-a",
      sceneId: "req-1",
      state: "completed",
    });
    expect(await markRunStarted({ runId: "run_done" })).toBe(false);
  });

  it("refuses a run it holds no record of", async () => {
    expect(await markRunStarted({ runId: "run_missing" })).toBe(false);
  });
});

describe("what a scene can see of its screening", () => {
  it("counts queued, running and reported runs without comparing their results", async () => {
    const queued = await queue({ reservationId: "r1", teamId: "team-a", sceneId: "req-1" });
    const running = await queue({ reservationId: "r2", teamId: "team-b", sceneId: "req-1" });
    await markRunStarted({ runId: running.runId, pipelineRunId: "owner-1" });
    // Two reported runs from the same team remain separate observations.
    for (const [reservation, succeeded] of [["r3", 30], ["r4", 41]] as const) {
      sharedFakeFirestoreState.docs.set(`evaluationRuns/run_${reservation}`, {
        runId: `run_${reservation}`,
        teamId: "team-c",
        sceneId: "req-1",
        state: "completed",
        result: {
          observed: { episodesRun: 50, episodesSucceeded: succeeded, successRate: succeeded / 50, medianCycleSeconds: 40 },
        },
      });
    }
    // Another scene's run is not this scene's business.
    await queue({ reservationId: "r5", teamId: "team-d", sceneId: "req-2" });
    // An abandoned run is not a team being screened.
    sharedFakeFirestoreState.docs.set("evaluationRuns/run_r6", {
      runId: "run_r6",
      teamId: "team-e",
      sceneId: "req-1",
      state: "abandoned",
    });

    const screening = await loadSceneScreening("req-1");

    expect(screening).toEqual({
      teams: 3,
      queued: 1,
      running: 1,
      reported: 2,
      noResult: 0,
    });
    expect(queued.state).toBe("requested");
  });

  it("is empty for a scene nobody has run against", async () => {
    expect(await loadSceneScreening("req-none")).toEqual({
      teams: 0,
      queued: 0,
      running: 0,
      reported: 0,
      noResult: 0,
    });
  });

  it("counts blocked and zero-episode completions as no result", async () => {
    sharedFakeFirestoreState.docs.set("evaluationRuns/run_empty", {
      runId: "run_empty",
      teamId: "team-a",
      sceneId: "req-1",
      state: "completed",
      result: { observed: { episodesRun: 0, episodesSucceeded: 0, successRate: null, medianCycleSeconds: null } },
    });
    sharedFakeFirestoreState.docs.set("evaluationRuns/run_blocked", {
      runId: "run_blocked",
      teamId: "team-b",
      sceneId: "req-1",
      state: "blocked",
    });

    expect(await loadSceneScreening("req-1")).toEqual({
      teams: 2,
      queued: 0,
      running: 0,
      reported: 0,
      noResult: 2,
    });
  });
});


describe("exclusive, bounded execution ownership", () => {
  it("refuses an expired hold, then preserves one owner's start time on retries", async () => {
    const run = await queue({ reservationId: "expiry", teamId: "team-a", sceneId: "req-1" });
    sharedFakeFirestoreState.docs.set(`evaluationRuns/${run.runId}`, { ...stored(run.runId), settlementDueAtMs: Date.now() - 1 });
    expect(await markRunStarted({ runId: run.runId, pipelineRunId: "owner" })).toBe(false);
    sharedFakeFirestoreState.docs.set(`evaluationRuns/${run.runId}`, { ...stored(run.runId), settlementDueAtMs: Date.now() + 60_000 });
    expect(await markRunStarted({ runId: run.runId, pipelineRunId: "owner" })).toBe(true);
    const first = stored(run.runId);
    expect(await markRunStarted({ runId: run.runId, pipelineRunId: "owner" })).toBe(true);
    expect(stored(run.runId)).toEqual(first);
    expect(await markRunStarted({ runId: run.runId, pipelineRunId: "other" })).toBe(false);
    expect(await claimRunCancellation("team-a", "expiry")).toMatchObject({ allowed: false, reason: "execution_started" });
    expect(await listRequestedRuns()).toEqual([]);
  });

  it("cannot start after cancellation has claimed the run, even before ledger release", async () => {
    const run = await queue({ reservationId: "cancel", teamId: "team-a", sceneId: "req-1" });
    expect(await claimRunCancellation("team-a", "cancel")).toMatchObject({ allowed: true });
    expect(await markRunStarted({ runId: run.runId, pipelineRunId: "owner" })).toBe(false);
  });

  it("a retried confirm cannot erase dispatch or a completed result", async () => {
    const params = { reservationId: "retry", teamId: "team-a", sceneId: "req-1" };
    const run = await queue(params);
    await markRunStarted({ runId: run.runId, pipelineRunId: "owner" });
    sharedFakeFirestoreState.docs.set(`evaluationRuns/${run.runId}`, { ...stored(run.runId), state: "completed", moneyResolved: true, episodesRun: 50, result: { observed: { episodesRun: 50 } } });
    const prior = stored(run.runId);
    expect(await queue(params)).toMatchObject({ state: "completed", moneyResolved: true });
    expect(stored(run.runId)).toEqual(prior);
  });
});
