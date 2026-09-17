// @vitest-environment node
/**
 * The two routes that move a robot team's held money, at the seam.
 *
 * Module tests cover the arithmetic. What they cannot cover is the wiring, and
 * the wiring is what was missing: `POST /api/agent-team/runs` reserved money
 * and returned reservation ids without writing anything a settlement pass could
 * ever find. Every unit test involved passed.
 *
 * The second case here is a different failure with the same shape. The Pipeline
 * reports `episodes_run` and `rate_usd` and the route multiplied them, but
 * `deriveBalance` books a settle at face value and does not clamp it to the
 * hold — so a wrong rate on the Pipeline side came out of a team's balance as
 * real spend, past the amount their agent authorised.
 */
import express from "express";
import { createServer } from "node:http";
import type { Server } from "node:http";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FAKE_FIELD_DELETE, sharedFakeFirestoreState } from "./helpers/fake-firestore";

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

// One known key for one known team. The credential machinery has its own
// tests; here it only has to resolve.
vi.mock("../utils/robotTeamAgentKeys", () => ({
  presentedAgentKey: (headers: Record<string, unknown>) => {
    const raw = String(headers["authorization"] ?? "");
    return raw.toLowerCase().startsWith("bearer ") ? raw.slice(7) : null;
  },
  resolveAgentKey: async (key: string | null) =>
    key === "bpk_test" ? "team-alpha" : null,
}));

// The Pipeline signature has its own tests too. Accept, so the money logic is
// what this file is measuring.
vi.mock("../utils/pipelineSyncSecurity", () => ({
  verifyPipelineSyncRequest: () => ({ ok: true }),
  createPipelineSyncRateLimiter: () => (_req: unknown, _res: unknown, next: () => void) =>
    next(),
}));

async function startRoutes(): Promise<{ server: Server; baseUrl: string }> {
  const { default: agentTeam } = await import("../routes/agent-team");
  const { default: settlement } = await import("../routes/internal-agent-run-settlement");
  const app = express();
  app.use(express.json());
  app.use("/api/agent-team", agentTeam);
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
const AUTH = { authorization: "Bearer bpk_test", "content-type": "application/json" };

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

  // Runnable supply now means three things, not one: a qualified verdict, the
  // operator's confirmation of the brief we drafted, and a scene that exists.
  docs.set("inboundRequests/site-1", {
    requestId: "site-1",
    request: {
      buyerType: "site",
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
    site_task_brief_confirmed_at: "2026-09-17T00:00:00.000Z",
    pipeline: {
      scene_id: "site-1",
      capture_id: "cap-1",
      pipeline_prefix: "gs://bucket/site-1",
      artifacts: { worldlabs_world_manifest_uri: "gs://bucket/site-1/world.json" },
    },
  });
}

beforeEach(() => {
  sharedFakeFirestoreState.docs.clear();
  vi.unstubAllEnvs();
});

/* -------------------------------------------------- the reservation wiring */

describe("confirming a spend leaves something that can settle it", () => {
  it("writes a run record for every hold it takes", async () => {
    await seedSpendableTeam();

    const body = await withRoutes(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/agent-team/runs`, {
        method: "POST",
        headers: AUTH,
        body: JSON.stringify({
          checkpointId: "ckpt-1",
          confirm: true,
          idempotencyKey: "morning-plan-1",
          maxRuns: 1,
        }),
      });
      expect(response.status).toBe(202);
      return (await response.json()) as {
        started: { runId: string; reservationId: string; costUsd: number }[];
        holds: { expiresAfterMs: number; onExpiry: string };
      };
    });

    expect(body.started).toHaveLength(1);
    const [run] = body.started;

    // The hold and the record name each other. Before this, only the hold
    // existed and nothing downstream could find it.
    const stored = sharedFakeFirestoreState.docs.get(`evaluationRuns/${run.runId}`);
    expect(stored).toMatchObject({
      teamId: TEAM,
      checkpointId: "ckpt-1",
      sceneId: "site-1",
      reservationId: run.reservationId,
      state: "requested",
      moneyResolved: false,
    });
    // And it is queued for resolution, which is what makes it independent of
    // anyone calling the settlement endpoint.
    expect(typeof stored?.settlementDueAtMs).toBe("number");

    // The response says what happens to the money if nothing reports back.
    expect(body.holds.expiresAfterMs).toBeGreaterThan(0);
    expect(body.holds.onExpiry).toContain("released in full");
  });

  it("shows the agent its own open holds and when they expire", async () => {
    await seedSpendableTeam();

    const body = await withRoutes(async (baseUrl) => {
      await fetch(`${baseUrl}/api/agent-team/runs`, {
        method: "POST",
        headers: AUTH,
        body: JSON.stringify({
          checkpointId: "ckpt-1",
          confirm: true,
          idempotencyKey: "morning-plan-2",
          maxRuns: 1,
        }),
      });
      const response = await fetch(`${baseUrl}/api/agent-team/runs`, { headers: AUTH });
      expect(response.status).toBe(200);
      return (await response.json()) as {
        heldUsd: number;
        runs: { state: string; holdExpiresAtIso: string | null }[];
      };
    });

    expect(body.runs).toHaveLength(1);
    expect(body.runs[0]?.state).toBe("requested");
    expect(Date.parse(String(body.runs[0]?.holdExpiresAtIso))).toBeGreaterThan(Date.now());
    expect(body.heldUsd).toBeGreaterThan(0);
  });

  it("frees a hold nothing reported on when the agent next calls", async () => {
    await seedSpendableTeam();

    const result = await withRoutes(async (baseUrl) => {
      await fetch(`${baseUrl}/api/agent-team/runs`, {
        method: "POST",
        headers: AUTH,
        body: JSON.stringify({
          checkpointId: "ckpt-1",
          confirm: true,
          idempotencyKey: "morning-plan-3",
          maxRuns: 1,
        }),
      });

      // Age the hold past its expiry. No scheduler is running in this test and
      // no env flag is set: the agent's own next call is what clears it.
      for (const [key, doc] of sharedFakeFirestoreState.docs.entries()) {
        if (!key.startsWith("evaluationRuns/")) continue;
        const record = doc as Record<string, unknown>;
        sharedFakeFirestoreState.docs.set(key, {
          ...record,
          settlementDueAtMs: 1,
          requestedAtIso: "2026-01-01T00:00:00.000Z",
        });
      }

      const response = await fetch(`${baseUrl}/api/agent-team/me`, { headers: AUTH });
      return (await response.json()) as { balance: { reservedUsd: number; availableUsd: number } };
    });

    expect(result.balance.reservedUsd).toBe(0);
    expect(result.balance.availableUsd).toBe(5_000);
  });
});

/* ------------------------------------------------------- the settlement cap */

describe("the Pipeline cannot charge past what the team authorised", () => {
  async function holdThenSettle(settlementBody: Record<string, unknown>) {
    await seedSpendableTeam();
    return withRoutes(async (baseUrl) => {
      const start = await fetch(`${baseUrl}/api/agent-team/runs`, {
        method: "POST",
        headers: AUTH,
        body: JSON.stringify({
          checkpointId: "ckpt-1",
          confirm: true,
          idempotencyKey: "plan-settle",
          maxRuns: 1,
        }),
      });
      const started = (await start.json()) as {
        started: { reservationId: string; runId: string; costUsd: number }[];
      };
      const [run] = started.started;

      const settled = await fetch(`${baseUrl}/api/internal/pipeline/agent-run-settlements`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          team_id: TEAM,
          reservation_id: run.reservationId,
          run_id: "pipeline-run-9",
          ...settlementBody,
        }),
      });

      const me = await fetch(`${baseUrl}/api/agent-team/me`, { headers: AUTH });
      return {
        quotedUsd: run.costUsd,
        runId: run.runId,
        settlement: (await settled.json()) as Record<string, unknown>,
        balance: ((await me.json()) as { balance: { spentUsd: number; reservedUsd: number } })
          .balance,
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

  it("settles a partial run for the part that ran", async () => {
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

  it("records what the run showed, and hands the team a way to read it", async () => {
    // The loop that was never closed: money settled and results went nowhere.
    // `recordEvaluationOutcome` and `recordMeasuredCapability` had no caller,
    // and no route on the agent surface could return a result.
    await seedSpendableTeam();

    const seen = await withRoutes(async (baseUrl) => {
      const start = await fetch(`${baseUrl}/api/agent-team/runs`, {
        method: "POST",
        headers: AUTH,
        body: JSON.stringify({
          checkpointId: "ckpt-1",
          confirm: true,
          idempotencyKey: "plan-result",
          maxRuns: 1,
        }),
      });
      const { started } = (await start.json()) as {
        started: { reservationId: string; runId: string }[];
      };
      const [run] = started;

      const reported = await fetch(`${baseUrl}/api/internal/pipeline/agent-run-results`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          reservation_id: run.reservationId,
          episodes_run: 200,
          episodes_succeeded: 198,
          median_cycle_seconds: 44,
          note: "Two drops, both on the same shelf.",
        }),
      });
      expect(reported.status).toBe(200);

      const list = await fetch(`${baseUrl}/api/agent-team/results`, { headers: AUTH });
      const one = await fetch(`${baseUrl}/api/agent-team/results/${run.runId}`, { headers: AUTH });
      return {
        reported: (await reported.json()) as Record<string, unknown>,
        list: (await list.json()) as { runs: Record<string, unknown>[] },
        one: (await one.json()) as Record<string, unknown>,
      };
    });

    // The observation and the claim are kept apart, and the claim is the
    // lower bound: 198 of 200 is 99%, which 200 trials support at 95%, not at
    // "better than 99%".
    expect(seen.reported.observed).toMatchObject({ episodesRun: 200, episodesSucceeded: 198 });
    expect(seen.reported.claimed).toMatchObject({ cycleTime: "thirty_to_two_min" });

    expect(seen.list.runs).toHaveLength(1);
    expect(seen.list.runs[0]?.resultStatus).toBe("reported");
    expect(seen.one.resultStatus).toBe("reported");
    expect((seen.one.result as { note?: string })?.note).toMatch(/two drops/i);
  });

  it("says a run is awaiting its result rather than leaving a bare null", async () => {
    await seedSpendableTeam();

    const list = await withRoutes(async (baseUrl) => {
      await fetch(`${baseUrl}/api/agent-team/runs`, {
        method: "POST",
        headers: AUTH,
        body: JSON.stringify({
          checkpointId: "ckpt-1",
          confirm: true,
          idempotencyKey: "plan-pending",
          maxRuns: 1,
        }),
      });
      const response = await fetch(`${baseUrl}/api/agent-team/results`, { headers: AUTH });
      return (await response.json()) as { runs: { resultStatus: string; result: unknown }[] };
    });

    // A run with no result is not a run that found nothing.
    expect(list.runs[0]?.resultStatus).toBe("awaiting_result");
    expect(list.runs[0]?.result).toBeNull();
  });

  it("refuses more successes than episodes rather than clamping them", async () => {
    // Clamping would write a measured claim derived from a number nobody meant,
    // and nothing outranks a measured claim.
    await seedSpendableTeam();

    const result = await withRoutes(async (baseUrl) => {
      const start = await fetch(`${baseUrl}/api/agent-team/runs`, {
        method: "POST",
        headers: AUTH,
        body: JSON.stringify({
          checkpointId: "ckpt-1",
          confirm: true,
          idempotencyKey: "plan-impossible",
          maxRuns: 1,
        }),
      });
      const { started } = (await start.json()) as { started: { reservationId: string }[] };
      const response = await fetch(`${baseUrl}/api/internal/pipeline/agent-run-results`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
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
