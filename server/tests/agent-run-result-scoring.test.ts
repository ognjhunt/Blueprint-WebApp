// @vitest-environment node
/**
 * Beta journey step L5/L6: only a simulator-scored team result can back a
 * recommendation.
 *
 * Drives a realistic HMAC-signed Pipeline result through the real
 * `/api/internal/pipeline/agent-run-results` route (real signature check, real
 * schema, real storage) and then through the real recommendation rule. Only
 * Firestore and the outbox transport are substituted.
 *
 * The admitted payload is the exact shape the Pipeline's team-candidate
 * Quick-10 projection produces (`team_candidate_quick10_result.py`). The
 * refused payloads are the doors that existed before: the legacy HTTP probe,
 * whose successes were the team's own HTTP verdicts, a legacy terminal whose
 * count came from a simulator preview, and an older Pipeline that states no
 * scoring at all.
 */
import express, { type Request, type Response } from "express";
import { createServer, type Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE, fakeArrayUnion } = await import("./helpers/fake-firestore");
  return {
    dbAdmin: sharedFakeFirestore, storageAdmin: null, authAdmin: null,
    default: { firestore: { FieldValue: {
      serverTimestamp: () => new Date().toISOString(), delete: () => FAKE_FIELD_DELETE,
      arrayUnion: (...items: unknown[]) => fakeArrayUnion(...items), increment: (n: number) => n,
    } } },
  };
});
vi.mock("../utils/email", () => ({ sendEmail: vi.fn(() => { throw new Error("No email transport in this contract"); }) }));
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

const syncSecret = "synthetic-scoring-contract-secret-never-live";
const sha = (c: string) => `sha256:${c.repeat(64)}`;
const RESERVATION = "free_scoring_contract", RUN = `run_${RESERVATION}`, JOB = "job_scoring";
const ATTEMPT = "agent-attempt-0123456789abcdef0123456789abcdef";
let server: Server | undefined, base = "";

/**
 * The payload the Pipeline posts for a team candidate's Quick-10 run: ten
 * episodes, each scored by the simulator against the scene's sealed success
 * contract, on a scene whose robot-free probe passed.
 */
const admittedPayload = () => ({
  reservation_id: RESERVATION,
  pipeline_run_id: ATTEMPT,
  execution_admission_digest: sha("a"),
  episodes_run: 10,
  episodes_succeeded: 10,
  median_cycle_seconds: null,
  cycle_seconds_p10: null,
  cycle_seconds_p90: null,
  note: "Ten simulator-scored Quick-10 episodes of one admitted team candidate; diagnostic simulation estimate.",
  artifact_uri: null,
  scoring: {
    schema_version: "blueprint.agent_run_result_scoring.v1",
    runtime: "policy_canary_quick10_team_candidate",
    success_source: "simulator_scored",
    scored_episode_count: 10,
    success_contract_digest: sha("1"),
    scene_revision_digest: sha("2"),
    robot_free_probe_receipt_digest: sha("3"),
    team_candidate_admission_digest: sha("4"),
    session_result_digest: sha("5"),
    claim_ceiling: "diagnostic_policy_execution",
  },
});

function seedDispatchedRun() {
  state.docs.set(`evaluationRuns/${RUN}`, {
    runId: RUN, reservationId: RESERVATION, teamId: "team_scoring", checkpointId: "ckpt_scoring", sceneId: JOB,
    taskFamily: "rigid_pick_place", evaluationPurpose: "pilot", quotedUsd: 0, quotedEpisodes: 10, state: "requested",
    episodesRun: null, moneyResolved: false, requestedAtIso: "2026-10-14T00:00:00.000Z", resolvedAtIso: null, note: null,
    executionAdmission: { envelope: { evidence_scope: "development_only" }, digestSha256: sha("a") },
    dispatch: { startedAtIso: "2026-10-14T00:01:00.000Z", pipelineRunId: ATTEMPT },
  } as never);
}

async function signed(path: string, body: unknown) {
  const { buildPipelineSyncSignature } = await import("../utils/pipelineSyncSecurity");
  const timestamp = new Date().toISOString(), encoded = JSON.stringify(body);
  return fetch(`${base}/api/internal/pipeline${path}`, { method: "POST",
    headers: { "content-type": "application/json", "X-Blueprint-Pipeline-Timestamp": timestamp,
      "X-Blueprint-Pipeline-Signature": buildPipelineSyncSignature({ secret: syncSecret, timestamp, body: encoded }) },
    body: encoded });
}

async function recommendation() {
  const evidence = await import("../utils/pilotRecommendationEvidence");
  const run = state.docs.get(`evaluationRuns/${RUN}`) as never;
  return evidence.verifyRecommendationEvidence({ run: { ...(run as object), state: "completed" } as never,
    requestId: JOB, passMark: evidence.passMarkForJob({}, null) });
}

beforeEach(async () => {
  state.docs.clear();
  vi.stubEnv("PIPELINE_SYNC_TOKEN", syncSecret);
  vi.stubEnv("PIPELINE_SYNC_ALLOW_LEGACY_BEARER", "false");
  const { default: pipeline } = await import("../routes/internal-agent-run-settlement");
  const app = express();
  // Production captures the raw body for the HMAC; so does this harness.
  app.use(express.json({ verify: (req: Request, _res: Response, buf: Buffer) => {
    (req as Request & { rawBody?: string }).rawBody = buf.toString("utf8");
  } }));
  app.use("/api/internal/pipeline", pipeline);
  server = createServer(app);
  await new Promise<void>(resolve => server!.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  seedDispatchedRun();
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await new Promise<void>(resolve => (server ? server.close(() => resolve()) : resolve()));
  server = undefined;
});

describe("a signed Pipeline result and what it may back", () => {
  it("stores a simulator-scored team-candidate result exactly and lets it back a recommendation", async () => {
    const unsigned = await fetch(`${base}/api/internal/pipeline/agent-run-results`, { method: "POST",
      headers: { "content-type": "application/json" }, body: JSON.stringify(admittedPayload()) });
    expect(unsigned.status).toBe(401);

    const response = await signed("/agent-run-results", admittedPayload());
    expect(response.status, await response.clone().text()).toBe(200);
    const stored = (state.docs.get(`evaluationRuns/${RUN}`) as { result: Record<string, unknown> }).result;
    expect(stored).toMatchObject({ evidenceScope: "development_only", observed: { episodesRun: 10, episodesSucceeded: 10 },
      scoring: { schemaVersion: "blueprint.agent_run_result_scoring.v1", runtime: "policy_canary_quick10_team_candidate",
        successSource: "simulator_scored", scoredEpisodeCount: 10, successContractDigest: sha("1"),
        sceneRevisionDigest: sha("2"), robotFreeProbeReceiptDigest: sha("3"), teamCandidateAdmissionDigest: sha("4"),
        sessionResultDigest: sha("5"), claimCeiling: "diagnostic_policy_execution" } });

    const outcome = await recommendation();
    expect(outcome).toMatchObject({ ok: true, evidence: { episodesRun: 10, episodesSucceeded: 10, evidenceScope: "development_only",
      scoring: { runtime: "policy_canary_quick10_team_candidate", successSource: "simulator_scored",
        claimCeiling: "diagnostic_policy_execution" } } });
    // Redelivery of the identical signed result is idempotent.
    expect((await signed("/agent-run-results", admittedPayload())).status).toBe(200);
  });

  it.each([
    ["the legacy HTTP probe, whose successes were the team's own verdicts",
      { runtime: "http_policy_api_observation_probe", success_source: "team_reported" }],
    ["a legacy terminal whose count came from a simulator preview",
      { runtime: "legacy_robot_eval_command_batch", success_source: "unverified" }],
    ["a runtime this WebApp does not know", { runtime: "a_future_runtime" }],
    ["an admitted runtime missing its robot-free probe binding", { robot_free_probe_receipt_digest: null }],
  ])("stores but never recommends on %s", async (_label, change) => {
    const payload = admittedPayload();
    const response = await signed("/agent-run-results", { ...payload, scoring: { ...payload.scoring, ...change } });
    expect(response.status, await response.clone().text()).toBe(200);
    expect((state.docs.get(`evaluationRuns/${RUN}`) as { result: { observed: unknown } }).result.observed)
      .toMatchObject({ episodesRun: 10, episodesSucceeded: 10 });
    expect(await recommendation()).toEqual({ ok: false, refusal: "evaluation_not_simulator_scored" });
  });

  it("never recommends on a result from a Pipeline that states no scoring", async () => {
    const { scoring: _omitted, ...older } = admittedPayload();
    expect((await signed("/agent-run-results", older)).status).toBe(200);
    expect(await recommendation()).toEqual({ ok: false, refusal: "evaluation_not_simulator_scored" });
  });

  it("refuses an impossible or malformed scoring statement before storing anything", async () => {
    const payload = admittedPayload();
    const tooMany = await signed("/agent-run-results", { ...payload, scoring: { ...payload.scoring, scored_episode_count: 11 } });
    expect(tooMany.status).toBe(400);
    expect((await tooMany.json()).code).toBe("agent_run_result_impossible");
    const extra = await signed("/agent-run-results", { ...payload, scoring: { ...payload.scoring, recommendation_eligible: true } });
    expect(extra.status).toBe(400);
    expect((await extra.json()).code).toBe("agent_run_result_invalid");
    expect((state.docs.get(`evaluationRuns/${RUN}`) as { result?: unknown }).result).toBeUndefined();
  });
});
