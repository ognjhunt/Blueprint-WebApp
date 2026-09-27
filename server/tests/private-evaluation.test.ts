// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE } = await import("./helpers/fake-firestore");
  return { default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => FAKE_FIELD_DELETE } } }, dbAdmin: sharedFakeFirestore };
});
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

const { createRequestedRun, markRunStarted, reportRunOutcome, loadSceneScreening, listRunsForScene, listRequestedRuns } = await import("../utils/agentEvalRuns");
const { recordRunResult, getRunForTeam, listRunsForTeam } = await import("../utils/agentRunResults");

async function purchase(reservationId = "private") {
  const run = await createRequestedRun({ teamId: "team", checkpointId: "checkpoint", sceneId: "site", taskFamily: "pick_place", reservationId, quotedUsd: 99, quotedEpisodes: 50 });
  if (!run) throw new Error("Missing run");
  return run;
}
function siteNotices() {
  return [...state.docs.values()].filter(doc => doc.to === "site@example.com");
}

beforeEach(() => {
  state.docs.clear();
  state.docs.set("inboundRequests/site", { contact: { email: "site@example.com" } });
  state.docs.set("robotTeams/team", { id: "team", name: "Team", status: "self_registered", accountEmail: "robot@example.com", capability: { demonstratedSuccessRate: "ninetynine_plus" }, fieldProvenance: { demonstratedSuccessRate: { grade: "self_reported" } } });
  state.docs.set("robotCheckpoints/checkpoint", { checkpointId: "checkpoint", teamId: "team", measured: { demonstratedSuccessRate: "ninetynine_plus" } });
});

describe("private paid evaluation boundary", () => {
  it.each([0, 50])("keeps a %s/50 result private, including retries, without changing matching evidence", async succeeded => {
    const beforeTeam = structuredClone(state.docs.get("robotTeams/team"));
    const beforeCheckpoint = structuredClone(state.docs.get("robotCheckpoints/checkpoint"));
    const run = await purchase();
    expect(run.evaluationPurpose).toBe("private");
    expect(await listRequestedRuns()).toHaveLength(1);
    expect(await listRunsForScene("site")).toEqual([]);
    expect(await markRunStarted({ runId: run.runId, pipelineRunId: "executor" })).toBe(true);
    const params = { runId: run.runId, report: { episodesRun: 50, episodesSucceeded: succeeded, artifactUri: "gs://private/result.json" } };
    await recordRunResult(params);
    await recordRunResult(params);
    await reportRunOutcome({ runId: run.runId, state: "completed", episodesRun: 50 });
    expect(await listRunsForScene("site")).toEqual([]);
    expect(await loadSceneScreening("site")).toEqual({ teams: 0, queued: 0, running: 0, reported: 0, noResult: 0 });
    expect(siteNotices()).toEqual([]);
    expect(state.docs.get("robotTeams/team")).toEqual(beforeTeam);
    expect(state.docs.get("robotCheckpoints/checkpoint")).toEqual(beforeCheckpoint);
    expect((await getRunForTeam("team", run.runId))?.result?.observed.episodesSucceeded).toBe(succeeded);
    expect(await getRunForTeam("other-team", run.runId)).toBeNull();
    expect(await listRunsForTeam("other-team")).toEqual([]);
    expect(await listRunsForTeam("team")).toHaveLength(1);
    expect([...state.docs.values()].filter(doc => doc.kind === "team_run_result")).toHaveLength(1);
    expect(state.docs.get("siteCohortEconomics/site")).toMatchObject({ revenueUsd: 99, screeningEpisodes: 50, paidEntries: 1 });
  });

  it("keeps start and blocked/no-result updates private while informing the team", async () => {
    const run = await purchase();
    await markRunStarted({ runId: run.runId, pipelineRunId: "executor" });
    await markRunStarted({ runId: run.runId, pipelineRunId: "executor" });
    await reportRunOutcome({ runId: run.runId, state: "blocked", episodesRun: 0 });
    await reportRunOutcome({ runId: run.runId, state: "blocked", episodesRun: 0 });
    expect(siteNotices()).toEqual([]);
    expect(await listRunsForScene("site")).toEqual([]);
    expect((await loadSceneScreening("site")).noResult).toBe(0);
    expect([...state.docs.values()].filter(doc => doc.kind === "team_run_no_result")).toHaveLength(1);
  });

  it("keeps historical sharing while excluding private or unrecognized modes", async () => {
    const run = await purchase();
    for (const [id, purpose] of [["historical", undefined], ["official", "pilot"], ["unknown", "unexpected"]] as const) {
      state.docs.set(`evaluationRuns/${id}`, { ...run, runId: id, evaluationPurpose: purpose });
    }
    expect((await listRunsForScene("site")).map(run => run.runId).sort()).toEqual(["historical", "official"]);
    expect((await loadSceneScreening("site")).queued).toBe(2);
  });
});
