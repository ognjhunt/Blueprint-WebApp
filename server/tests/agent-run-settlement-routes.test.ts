// @vitest-environment node
/**
 * The Pipeline's routes that settle a robot team's held money and record what
 * its run showed, at the seam.
 *
 * Module tests cover the arithmetic. These cover the wiring: a hold taken for a
 * run (here seeded through `authorizeAgentSpend`, as the retired agent API once
 * did) is what a settlement pass finds. The Pipeline reports `episodes_run` and
 * `rate_usd`, but `deriveBalance` books a settle at face value and does not
 * clamp it to the hold, so the route must: a wrong rate on the Pipeline side
 * must never come out of a team's balance past the amount it authorised.
 */
import express from "express";
import { createServer } from "node:http";
import type { Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FAKE_FIELD_DELETE, sharedFakeFirestore, sharedFakeFirestoreState } from "./helpers/fake-firestore";
import { listedTaskCard } from "./helpers/listedTaskCard";

// Early access is covered in robot-team-early-access.test.ts. These tests are
// about planning, spending and settling, so every team here is admitted.
vi.mock("../utils/robotTeamEarlyAccess", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../utils/robotTeamEarlyAccess")>()),
  teamHasEarlyAccess: async () => true,
}));


// Paying needs an account-bound team; that gate has its own suite
// (robot-team-account-gate.test.ts). These suites exercise what happens after
// a verified account has claimed the team.
vi.mock("../utils/robotTeamAccounts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../utils/robotTeamAccounts")>()),
  teamAccountUid: async () => "account-uid",
}));

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE: del } = await import(
    "./helpers/fake-firestore"
  );
  return {
    default: {
      firestore: {
        FieldValue: {
          serverTimestamp: () => "SERVER_TIMESTAMP",
          delete: () => del,
        },
      },
    },
    dbAdmin: sharedFakeFirestore,
    authAdmin: { verifyIdToken: async () => ({ uid: "nobody" }) },
  };
});

// The Pipeline signature has its own tests too. Accept, so the money logic is
// what this file is measuring.
vi.mock("../utils/pipelineSyncSecurity", () => ({
  verifyPipelineSyncRequest: () => ({ ok: true }),
  createPipelineSyncRateLimiter: () => (_req: unknown, _res: unknown, next: () => void) =>
    next(),
}));

const admissionFixture = vi.hoisted(() => ({
  digestSha256: `sha256:${"a".repeat(64)}`,
  distinctRequests: false,
}));

vi.mock("../utils/agentExecutionAdmission", () => ({
  discoverAgentExecutionAdmission: vi.fn(async ({ executionRequestId }: { executionRequestId: string }) => ({
    admitted: true as const,
    digestSha256: admissionFixture.digestSha256,
    envelope: { source_request_id: executionRequestId },
  })),
}));

async function startRoutes(): Promise<{ server: Server; baseUrl: string }> {
  const { default: settlement } = await import("../routes/internal-agent-run-settlement");
  const app = express();
  app.use(express.json());
  app.use("/api/internal/pipeline", settlement);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server failed to bind");
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function stopServer(server: Server) {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function withRoutes<T>(run: (baseUrl: string) => Promise<T>): Promise<T> {
  const { server, baseUrl } = await startRoutes();
  try {
    return await run(baseUrl);
  } finally {
    await stopServer(server);
  }
}

const TEAM = "team-alpha";

/** One confirmed hold for one run, dispatched to the Pipeline, as a purchase left it. */
async function startOneTimeRun(idempotencyKey: string) {
  const { authorizeAgentSpend } = await import("../utils/robotTeamBalance");
  const { runIdForReservation } = await import("../utils/agentEvalRuns");
  const { entryPrice, screeningRound } = await import("../../client/src/lib/evaluationPricing");
  const authorization = await authorizeAgentSpend({ teamId: TEAM, amountUsd: entryPrice,
    reason: "Evaluation ckpt-1 on site-1", idempotencyKey: `execution:${idempotencyKey}`,
    requestedRun: { checkpointId: "ckpt-1", sceneId: "site-1", taskFamily: "tote_transfer",
      quotedEpisodes: screeningRound.episodes,
      executionAdmission: { envelope: { source_request_id: `selfserve-${"a".repeat(32)}` },
        digestSha256: admissionFixture.digestSha256 } },
  });
  if (!authorization.authorized) throw new Error(`hold refused: ${authorization.refusal}`);
  const runId = runIdForReservation(authorization.reservationId);
  const key = `evaluationRuns/${runId}`;
  sharedFakeFirestoreState.docs.set(key, { ...sharedFakeFirestoreState.docs.get(key),
    dispatchPending: false, dispatch: { state: "accepted", pipelineRunId: "pipeline-run-9" } });
  return { reservationId: authorization.reservationId, runId, costUsd: entryPrice };
}

async function teamBalance() {
  const { getTeamBalance } = await import("../utils/robotTeamBalance");
  return getTeamBalance(TEAM);
}

/** A funded team, an enabled agent, one screened site, one checkpoint. */
async function seedSpendableTeam() {
  const docs = sharedFakeFirestoreState.docs;

  docs.set(`robotTeams/${TEAM}`, {
    id: TEAM,
    name: "Alpha Robotics",
    status: "engaged",
    capability: {
      payloadCapacity: { value: "payload_20kg", grade: "self_reported", source: "intake" },
      humanProximity: { value: "shared_space", grade: "self_reported", source: "intake" },
      deploymentGeography: { value: "us_national", grade: "self_reported", source: "intake" },
    },
    fieldProvenance: {},
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  });

  docs.set("robotTeamSpendPolicy/" + TEAM, {
    teamId: TEAM,
    dailyLimitUsd: 5_000,
    perRunLimitUsd: 5_000,
    agentSpendEnabled: true,
    updatedAtIso: "2026-09-01T00:00:00.000Z",
  });

  docs.set(`robotTeamLedger/${TEAM}:seed-credit`, {
    entryId: `${TEAM}:seed-credit`,
    teamId: TEAM,
    kind: "credit",
    amountUsd: 5_000,
    reservationId: null,
    reason: "seed",
    idempotencyKey: "seed-credit",
    createdAtIso: "2026-09-01T00:00:00.000Z",
  });

  docs.set("robotCheckpoints/ckpt-1", {
    checkpointId: "ckpt-1",
    teamId: TEAM,
    label: "nightly",
    runtime: "policy_endpoint",
    reference: "https://example.invalid/policy",
    status: "runnable",
    unrunnableReason: null,
  });

  // Runnable supply now means four things, not one: a qualified verdict, the
  // operator's confirmation of the brief we drafted, a scene that exists, and an
  // internal proof that an evaluation can actually run against that scene.
  docs.set("inboundRequests/site-1", {
    requestId: "site-1",
    request: {
      // What intake stores for every site (it normalizes the buyer type),
      // with the recording grant free admission and the job library require.
      buyerType: "site_operator",
      consent_attestation: { granted: true, statement_version: "2026-09-18.v1", recorded_at_iso: "2026-09-17T00:00:00.000Z" },
      targetSiteType: "Warehouse",
      capture_mode: "self_capture",
      capture_region: "us",
      siteTaskSpec: { taskFamily: "tote_transfer" },
      siteTaskGates: {
        sceneStability: "stable",
        taskShape: "single",
        objectVariety: "under_10",
        deploymentTimeline: "this_quarter",
        accessWindow: "scheduled",
      },
    },
    site_task_triage: { disposition: "qualified" },
    // Teams plan only against sites that shared a card.
    public_task_listing: listedTaskCard(),
    site_task_brief_confirmed_at: "2026-09-17T00:00:00.000Z",
    pipeline: {
      scene_id: "site-1",
      capture_id: "cap-1",
      pipeline_prefix: "gs://bucket/site-1",
      artifacts: { worldlabs_world_manifest_uri: "gs://bucket/site-1/world.json" },
    },
    // The runnability proof `sceneRunnableReadiness` requires: a simulator has
    // stepped this scene and benchmark tasks are defined.
    evaluation_readiness: {
      runtime_launchable: true,
      benchmark_coverage_status: "ready",
      benchmark_task_count: 3,
      robot_eval_preflight_summary: { simulator_execution_proven: true, episode_count: 20 },
    },
  });
}

beforeEach(() => {
  sharedFakeFirestoreState.docs.clear();
  admissionFixture.digestSha256 = `sha256:${"a".repeat(64)}`;
  admissionFixture.distinctRequests = false;
  vi.unstubAllEnvs();
});

describe("the Pipeline cannot charge past what the team authorised", () => {
  it("returns a conflict when cancellation wins after settlement validation", async () => {
    await seedSpendableTeam();
    const result = await withRoutes(async (baseUrl) => {
      const run = await startOneTimeRun("cancel-race-plan");
      const original = sharedFakeFirestore.runTransaction.bind(sharedFakeFirestore);
      let injectCancellation = true;
      sharedFakeFirestore.runTransaction = (async (updateFn: (tx: any) => Promise<unknown>) => original(async (tx: any) => updateFn({
        ...tx,
        get: async (ref: any) => {
          if (injectCancellation && ref.__collection === "evaluationRuns" && ref.id === run.runId) {
            injectCancellation = false;
            const key = `evaluationRuns/${run.runId}`;
            sharedFakeFirestoreState.docs.set(key, {
              ...sharedFakeFirestoreState.docs.get(key),
              state: "abandoned",
              cancellationRequested: true,
              dispatchPending: false,
            });
          }
          return tx.get(ref);
        },
      }))) as typeof sharedFakeFirestore.runTransaction;
      try {
        const response = await fetch(`${baseUrl}/api/internal/pipeline/agent-run-settlements`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ pipeline_run_id: "pipeline-run-9",
            execution_admission_digest: admissionFixture.digestSha256,
            team_id: TEAM, reservation_id: run.reservationId, run_id: "pipeline-run-9",
            episodes_run: 50, rate_usd: 5 }),
        });
        const body = await response.json() as { code?: string };
        const lateResult = await fetch(`${baseUrl}/api/internal/pipeline/agent-run-results`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ pipeline_run_id: "pipeline-run-9",
            execution_admission_digest: admissionFixture.digestSha256,
            reservation_id: run.reservationId, episodes_run: 50, episodes_succeeded: 48 }),
        });
        return { status: response.status, body, lateResultStatus: lateResult.status };
      } finally {
        sharedFakeFirestore.runTransaction = original as typeof sharedFakeFirestore.runTransaction;
      }
    });

    expect(result).toEqual({ status: 409,
      body: expect.objectContaining({ code: "agent_run_outcome_conflict" }), lateResultStatus: 409 });
    expect([...sharedFakeFirestoreState.docs.values()].some(doc => doc.lateDiagnosticResult)).toBe(true);
    const ledger = [...sharedFakeFirestoreState.docs.values()].filter(doc => doc.teamId === TEAM && doc.kind === "settle");
    expect(ledger).toEqual([]);
  });

  async function holdThenSettle(settlementBody: Record<string, unknown>) {
    await seedSpendableTeam();
    return withRoutes(async (baseUrl) => {
      const run = await startOneTimeRun("plan-settle");

      const settled = await fetch(`${baseUrl}/api/internal/pipeline/agent-run-settlements`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          pipeline_run_id: "pipeline-run-9",
          execution_admission_digest: admissionFixture.digestSha256,
          team_id: TEAM,
          reservation_id: run.reservationId,
          run_id: "pipeline-run-9",
          ...settlementBody,
        }),
      });

      return {
        quotedUsd: run.costUsd,
        runId: run.runId,
        settlement: (await settled.json()) as Record<string, unknown>,
        balance: await teamBalance(),
      };
    });
  }

  it("caps a settlement at the quote when the reported rate is wrong", async () => {
    // A rate ten times too high. Uncapped this is a real overcharge, booked as
    // spend, against a hold the team's agent sized itself.
    const result = await holdThenSettle({ episodes_run: 50, rate_usd: 50 });

    expect(result.settlement.reportedUsd).toBe(2_500);
    expect(result.settlement.amountUsd).toBe(result.quotedUsd);
    expect(result.balance.spentUsd).toBe(result.quotedUsd);
  });

  it("prorates the entry when a partial run produced results", async () => {
    const result = await holdThenSettle({ episodes_run: 25, rate_usd: 5 });

    expect(result.settlement.amountUsd).toBe(result.quotedUsd / 2);
    expect(result.balance.spentUsd).toBe(result.quotedUsd / 2);
    expect(result.balance.reservedUsd).toBe(0);
  });

  it("releases the whole hold when no episode ran", async () => {
    const result = await holdThenSettle({
      episodes_run: 0,
      rate_usd: 5,
      blocked_before_any_episode: true,
    });

    expect(result.settlement.released).toBe(true);
    expect(result.balance.spentUsd).toBe(0);
    expect(result.balance.reservedUsd).toBe(0);
  });

  it("retains partial episode counts while closing a blocked run without charging", async () => {
    const progress = { observed_attempted_episode_count: 5, scored_episode_count: 4,
      succeeded_episode_count: 3, failed_episode_count: 1, void_episode_count: 1,
      measurement_complete: false };
    const result = await holdThenSettle({ episodes_run: 4, rate_usd: 5,
      blocked_before_any_episode: false, execution_status: "blocked", execution_progress: progress });
    expect(result.settlement.released).toBe(true);
    expect(result.balance.spentUsd).toBe(0);
    expect(sharedFakeFirestoreState.docs.get(`evaluationRuns/${result.runId}`)).toMatchObject({
      state: "blocked", episodesRun: 4, executionProgress: progress,
    });
  });

  it("does not accept a claim of no execution when the episode measurement is incomplete", async () => {
    const result = await holdThenSettle({ episodes_run: 0, rate_usd: 5,
      blocked_before_any_episode: true, execution_status: "blocked", execution_progress: {
        observed_attempted_episode_count: 0, scored_episode_count: 0, succeeded_episode_count: 0,
        failed_episode_count: 0, void_episode_count: 0, measurement_complete: false,
      } });
    expect(result.settlement.code).toBe("agent_run_settlement_invalid");
    expect(sharedFakeFirestoreState.docs.get(`evaluationRuns/${result.runId}`)?.state).toBe("requested");
    expect(result.balance.spentUsd).toBe(0);
  });

  it("takes the run out of the settlement queue once the money has moved", async () => {
    const result = await holdThenSettle({ episodes_run: 50, rate_usd: 5 });

    const stored = sharedFakeFirestoreState.docs.get(`evaluationRuns/${result.runId}`) as
      | Record<string, unknown>
      | undefined;
    expect(stored?.moneyResolved).toBe(true);
    expect(stored?.state).toBe("completed");
    // Absence, not a flag: the reconciler's query is a range over this field.
    expect(stored).not.toHaveProperty("settlementDueAtMs");
    expect(FAKE_FIELD_DELETE in (stored ?? {})).toBe(false);
  });

  it("records what the run showed", async () => {
    // The loop that was never closed: money settled and results went nowhere.
    // `recordEvaluationOutcome` and `recordMeasuredCapability` had no caller.
    await seedSpendableTeam();

    const seen = await withRoutes(async (baseUrl) => {
      const run = await startOneTimeRun("plan-result");

      const reported = await fetch(`${baseUrl}/api/internal/pipeline/agent-run-results`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          pipeline_run_id: "pipeline-run-9",
          execution_admission_digest: admissionFixture.digestSha256,
          reservation_id: run.reservationId,
          episodes_run: 200,
          episodes_succeeded: 198,
          median_cycle_seconds: 44,
          note: "Two drops, both on the same shelf.",
        }),
      });
      expect(reported.status).toBe(200);
      return { runId: run.runId, reported: (await reported.json()) as Record<string, unknown> };
    });

    // The observation and the claim are kept apart, and the claim is the
    // lower bound: 198 of 200 is 99%, which 200 trials support at 95%, not at
    // "better than 99%".
    expect(seen.reported.observed).toMatchObject({ episodesRun: 200, episodesSucceeded: 198 });
    expect(seen.reported.claimed).toMatchObject({ cycleTime: "thirty_to_two_min" });
    expect(sharedFakeFirestoreState.docs.get(`evaluationRuns/${seen.runId}`)?.result?.note).toMatch(/two drops/i);
  });

  it("refuses more successes than episodes rather than clamping them", async () => {
    // Clamping would write a measured claim derived from a number nobody meant,
    // and nothing outranks a measured claim.
    await seedSpendableTeam();

    const result = await withRoutes(async (baseUrl) => {
      const started = [await startOneTimeRun("plan-impossible")];
      const response = await fetch(`${baseUrl}/api/internal/pipeline/agent-run-results`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          pipeline_run_id: "pipeline-run-9",
          execution_admission_digest: admissionFixture.digestSha256,
          reservation_id: started[0].reservationId,
          episodes_run: 10,
          episodes_succeeded: 40,
        }),
      });
      return { status: response.status, body: (await response.json()) as Record<string, unknown> };
    });

    expect(result.status).toBe(400);
    expect(result.body.code).toBe("agent_run_result_impossible");
  });

  it("refuses a result for a reservation no run was recorded against", async () => {
    await seedSpendableTeam();

    const status = await withRoutes(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/internal/pipeline/agent-run-results`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          reservation_id: "res_nobody_ever",
          episodes_run: 50,
          episodes_succeeded: 50,
        }),
      });
      return response.status;
    });

    expect(status).toBe(404);
  });

  it("confirms it reconciled a run it recognised", async () => {
    const result = await holdThenSettle({ episodes_run: 50, rate_usd: 5 });
    expect(result.settlement.reconciled).toBe(true);
    expect(result.settlement.quotedUsd).toBe(result.quotedUsd);
  });
});

// Historical paid lifecycle coverage only; production release refusal is tested in free-beta-guards and robot-team-account-gate.
vi.mock("../utils/freeBeta", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../utils/freeBeta")>()),
  FREE_BETA_ONLY: false,
  canDispatchFreeBetaRun: () => true,
}));
