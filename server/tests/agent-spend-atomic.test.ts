// @vitest-environment node
/** Atomic one-time spend approval: signed intent, balance, ledger, and run. */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { sharedFakeFirestore, sharedFakeFirestoreState } from "./helpers/fake-firestore";

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore } = await import("./helpers/fake-firestore");
  return {
    default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP" } } },
    dbAdmin: sharedFakeFirestore,
  };
});

vi.mock("../logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { authorizeAgentSpend } = await import("../utils/robotTeamBalance");
const { createEvalPlanToken } = await import("../utils/evalPlanToken");

const TEAM = "team-atomic";
const CHECKPOINT = "ckpt-1";
const SCENE = "scene-1";

function seedCredit(amountUsd = 25) {
  sharedFakeFirestoreState.docs.set("robotTeamLedger/credit-1", {
    entryId: "credit-1",
    teamId: TEAM,
    kind: "credit",
    amountUsd,
    reservationId: null,
    reason: "Stripe credit",
    idempotencyKey: "credit-1",
    createdAtIso: "2026-09-19T00:00:00.000Z",
  });
}

function token(lines = [{ sceneId: SCENE, costUsd: 25 }]) {
  return createEvalPlanToken({ teamId: TEAM, checkpointId: CHECKPOINT, lines });
}

function authorize(overrides: Record<string, unknown> = {}) {
  return authorizeAgentSpend({
    teamId: TEAM,
    amountUsd: 25,
    reason: "One-time screening of scene-1",
    idempotencyKey: "buy-1",
    confirmedPlan: { token: token(), checkpointId: CHECKPOINT, sceneId: SCENE },
    requestedRun: {
      checkpointId: CHECKPOINT,
      sceneId: SCENE,
      taskFamily: "tote_transfer",
      quotedEpisodes: 50,
      executionAdmission: undefined,
    },
    ...overrides,
  });
}

beforeEach(() => {
  sharedFakeFirestoreState.docs.clear();
  vi.restoreAllMocks();
});

describe("signed one-time approval", () => {
  it("reserves without changing the recurring policy and creates the run atomically", async () => {
    seedCredit();
    sharedFakeFirestoreState.docs.set(`robotTeamSpendPolicy/${TEAM}`, {
      teamId: TEAM,
      agentSpendEnabled: false,
      dailyLimitUsd: 0,
      perRunLimitUsd: 0,
      updatedAtIso: "2026-09-19T00:00:00.000Z",
    });

    const result = await authorize();

    expect(result).toEqual({ authorized: true, reservationId: "res_team-atomic_buy-1" });
    expect(sharedFakeFirestoreState.docs.get(`robotTeamSpendPolicy/${TEAM}`)).toMatchObject({
      agentSpendEnabled: false,
      dailyLimitUsd: 0,
      perRunLimitUsd: 0,
    });
    expect(sharedFakeFirestoreState.docs.get(`robotTeamLedger/${TEAM}:buy-1`)).toMatchObject({
      kind: "reserve",
      amountUsd: 25,
      reservationId: "res_team-atomic_buy-1",
    });
    expect(sharedFakeFirestoreState.docs.get("evaluationRuns/run_res_team-atomic_buy-1")).toMatchObject({
      teamId: TEAM,
      checkpointId: CHECKPOINT,
      sceneId: SCENE,
      reservationId: "res_team-atomic_buy-1",
      quotedUsd: 25,
      state: "requested",
      dispatchPending: true,
    });
  });

  it.each([
    ["invalid signature", { confirmedPlan: { token: `${token()}x`, checkpointId: CHECKPOINT, sceneId: SCENE } }],
    ["wrong scene", { confirmedPlan: { token: token(), checkpointId: CHECKPOINT, sceneId: "scene-2" } }],
    ["wrong amount", { amountUsd: 24 }],
  ])("rejects %s", async (_label, overrides) => {
    seedCredit();
    const result = await authorize(overrides);
    expect(result).toMatchObject({ authorized: false, refusal: "invalid_approval" });
    expect([...sharedFakeFirestoreState.docs.keys()].some((key) => key.includes(":buy-1"))).toBe(false);
  });

  it("returns the same reservation on a same-key retry after the balance is exhausted", async () => {
    seedCredit();
    const first = await authorize();
    const retry = await authorize();
    expect(retry).toEqual(first);
  });

  it("refuses a different key after the last $25 is reserved", async () => {
    seedCredit();
    expect((await authorize()).authorized).toBe(true);
    const second = await authorize({ idempotencyKey: "buy-2" });
    expect(second).toMatchObject({ authorized: false, refusal: "insufficient_balance" });
  });

  it("retries a transaction conflict so two requests cannot reserve the last $25", async () => {
    seedCredit();
    const originalRunTransaction = sharedFakeFirestore.runTransaction;
    const spy = vi.spyOn(sharedFakeFirestore, "runTransaction").mockImplementationOnce(async (updateFn: any) => {
      // Simulate the first transaction attempt reading the old balance. Its
      // buffered writes are discarded when another writer changes the lock.
      await updateFn({
        get: async (ref: any) => typeof ref.get === "function" ? ref.get() : null,
        set: () => undefined,
      });
      const winner = await authorize({ idempotencyKey: "winner" });
      expect(winner).toMatchObject({ authorized: true });
      // Firestore retries the losing callback against the winner's committed
      // lock and ledger state.
      return originalRunTransaction(updateFn);
    });

    const loser = await authorize({ idempotencyKey: "loser" });
    spy.mockRestore();

    expect(loser).toMatchObject({ authorized: false, refusal: "insufficient_balance" });
    const reserves = [...sharedFakeFirestoreState.docs.values()].filter((doc) => doc.kind === "reserve");
    expect(reserves).toHaveLength(1);
    expect([...sharedFakeFirestoreState.docs.keys()].filter((key) => key.startsWith("evaluationRuns/"))).toHaveLength(1);
  });
});
