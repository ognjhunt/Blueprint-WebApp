// @vitest-environment node
/**
 * Settlement, which is where the money either comes back or does not.
 *
 * The defect these cover shipped working in every part except the last one.
 * `POST /api/agent-team/runs` reserved money correctly, refused correctly, and
 * returned reservation ids — and then nothing existed that could ever conclude
 * a run. The reservation was attached to a promise rather than to a record, so
 * a hold sat there until a person read the ledger and released it by hand.
 *
 * Unit tests on the ledger passed the whole time, because the ledger was never
 * the broken part: `deriveBalance` settles and releases exactly right when
 * something calls it. Nothing called it. So these tests are written against the
 * seam — a confirmed spend, then time passing, then the balance — because that
 * is the only place the failure was visible.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

/* ------------------------------------------------ an in-memory firestore */

type Doc = Record<string, unknown>;

const DELETE = Symbol("delete");
const SERVER_TIMESTAMP = Symbol("serverTimestamp");

const store = new Map<string, Map<string, Doc>>();

function collectionStore(name: string): Map<string, Doc> {
  const existing = store.get(name);
  if (existing) return existing;
  const created = new Map<string, Doc>();
  store.set(name, created);
  return created;
}

function applyMerge(target: Doc, patch: Doc): Doc {
  const next: Doc = { ...target };
  for (const [key, value] of Object.entries(patch)) {
    if (value === DELETE) delete next[key];
    else if (value === SERVER_TIMESTAMP) next[key] = "server-timestamp";
    else next[key] = value;
  }
  return next;
}

function matches(doc: Doc, field: string, op: string, value: unknown): boolean {
  const actual = doc[field];
  if (op === "==") return actual === value;
  if (op === "<=") return typeof actual === "number" && actual <= (value as number);
  if (op === "in") return (value as unknown[]).includes(actual);
  throw new Error(`fake firestore does not implement ${op}`);
}

function makeQuery(name: string, filters: [string, string, unknown][], order: string | null, cap: number | null) {
  const query = {
    where: (field: string, op: string, value: unknown) =>
      makeQuery(name, [...filters, [field, op, value]], order, cap),
    orderBy: (field: string) => makeQuery(name, filters, field, cap),
    limit: (n: number) => makeQuery(name, filters, order, n),
    get: async () => {
      let rows = [...collectionStore(name).entries()].filter(([, doc]) =>
        filters.every(([field, op, value]) => matches(doc, field, op, value)),
      );
      if (order) {
        rows = rows.sort((a, b) => Number(a[1][order] ?? 0) - Number(b[1][order] ?? 0));
      }
      if (cap != null) rows = rows.slice(0, cap);
      return {
        docs: rows.map(([id, doc]) => ({
          id,
          data: () => ({ ...doc }),
          ref: docRef(name, id),
        })),
      };
    },
  };
  return query;
}

function docRef(name: string, id: string) {
  return {
    id,
    __collection: name,
    get: async () => {
      const doc = collectionStore(name).get(id);
      return { exists: doc !== undefined, data: () => (doc ? { ...doc } : undefined) };
    },
    set: async (patch: Doc, options?: { merge?: boolean }) => {
      const current = options?.merge ? collectionStore(name).get(id) ?? {} : {};
      collectionStore(name).set(id, applyMerge(current, patch));
    },
  };
}

const dbAdmin = {
  collection: (name: string) => ({
    doc: (id: string) => docRef(name, id),
    where: (field: string, op: string, value: unknown) =>
      makeQuery(name, [[field, op, value]], null, null),
    orderBy: (field: string) => makeQuery(name, [], field, null),
    limit: (n: number) => makeQuery(name, [], null, n),
  }),
  runTransaction: async <T>(updateFn: (transaction: {
    get: (ref: ReturnType<typeof docRef> | ReturnType<typeof makeQuery>) => Promise<any>;
    set: (ref: ReturnType<typeof docRef>, patch: Doc, options?: { merge?: boolean }) => void;
  }) => Promise<T>): Promise<T> => {
    const writes: Array<() => void> = [];
    const transaction = {
      get: async (ref: ReturnType<typeof docRef> | ReturnType<typeof makeQuery>) => {
        if (!("__collection" in ref)) return ref.get();
        const doc = collectionStore(ref.__collection).get(ref.id);
        return { exists: doc !== undefined, data: () => (doc ? { ...doc } : undefined) };
      },
      set: (ref: ReturnType<typeof docRef>, patch: Doc, options?: { merge?: boolean }) => {
        writes.push(() => {
          const current = options?.merge ? collectionStore(ref.__collection).get(ref.id) ?? {} : {};
          collectionStore(ref.__collection).set(ref.id, applyMerge(current, patch));
        });
      },
    };
    const result = await updateFn(transaction);
    for (const write of writes) write();
    return result;
  },
};

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  dbAdmin,
  default: {
    firestore: {
      FieldValue: {
        serverTimestamp: () => SERVER_TIMESTAMP,
        delete: () => DELETE,
      },
    },
  },
}));

const lifecycleNotice = vi.hoisted(() => vi.fn(async () => ({ enqueued: true })));
vi.mock("../utils/taskLifecycleNotifications", () => ({ enqueueTaskLifecycleNotification: lifecycleNotice }));

vi.mock("../logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  attachRequestMeta: (value: unknown) => value,
}));

const {
  createRequestedRun,
  getRunForReservation,
  listUnsettledRuns,
  markResolved,
  reconcileAgentRunSettlements,
  reconcileTeamHolds,
  reportRunOutcome,
  RunOutcomeConflictError,
  runIdForReservation,
  settlementAmountUsd,
} = await import("../utils/agentEvalRuns");
const { creditTeam, getTeamBalance, setSpendPolicy, authorizeAgentSpend } = await import(
  "../utils/robotTeamBalance"
);

/* ------------------------------------------------------------ fixtures */

const TEAM = "team-alpha";
const QUOTE_USD = 250;
const QUOTE_EPISODES = 50;

async function fundedTeamWithOneHold(teamId = TEAM, idempotencyKey = "plan-1:0") {
  await creditTeam({
    teamId,
    amountUsd: 1_000,
    reason: "test funding",
    idempotencyKey: `credit:${teamId}`,
  });
  await setSpendPolicy({
    teamId,
    dailyLimitUsd: 1_000,
    perRunLimitUsd: 1_000,
    agentSpendEnabled: true,
  });

  const authorization = await authorizeAgentSpend({
    teamId,
    amountUsd: QUOTE_USD,
    reason: "test run",
    idempotencyKey,
  });
  if (!authorization.authorized) throw new Error(`fixture failed: ${authorization.refusal}`);

  const run = await createRequestedRun({
    teamId,
    checkpointId: "ckpt-1",
    sceneId: "scene-1",
    taskFamily: "tote_transfer",
    reservationId: authorization.reservationId,
    quotedUsd: QUOTE_USD,
    quotedEpisodes: QUOTE_EPISODES,
  });
  if (!run) throw new Error("fixture failed: no run record");
  return { run, reservationId: authorization.reservationId };
}

/** Move a run's clock back so it reads as expired without waiting six hours. */
async function ageRunBy(runId: string, ms: number) {
  const doc = collectionStore("evaluationRuns").get(runId)!;
  collectionStore("evaluationRuns").set(runId, {
    ...doc,
    requestedAtIso: new Date(Date.parse(String(doc.requestedAtIso)) - ms).toISOString(),
    settlementDueAtMs: Number(doc.settlementDueAtMs) - ms,
  });
}

beforeEach(() => {
  store.clear();
  vi.unstubAllEnvs();
});

/* ------------------------------------------------------- the actual hole */

describe("a hold is attached to a record that can conclude it", () => {
  it("writes a run naming the reservation, so something exists to settle", async () => {
    const { run, reservationId } = await fundedTeamWithOneHold();

    expect(run.reservationId).toBe(reservationId);
    expect(run.runId).toBe(runIdForReservation(reservationId));
    expect(run.state).toBe("requested");
    expect(run.moneyResolved).toBe(false);

    // The record is findable from the reservation alone, which is all the
    // Pipeline is ever told.
    await expect(getRunForReservation(reservationId)).resolves.toMatchObject({
      runId: run.runId,
      quotedUsd: QUOTE_USD,
      quotedEpisodes: QUOTE_EPISODES,
    });
  });

  it("makes the evaluationRuns collection something other code can read", async () => {
    // `teamEvalCandidates` has always read this collection to skip questions a
    // team already answered. Nothing wrote it, so the skip never fired and an
    // agent could buy the same scene twice.
    const { run } = await fundedTeamWithOneHold();
    const rows = await dbAdmin
      .collection("evaluationRuns")
      .where("teamId", "==", TEAM)
      .get();

    expect(rows.docs).toHaveLength(1);
    expect(rows.docs[0]?.data()).toMatchObject({
      teamId: TEAM,
      sceneId: "scene-1",
      taskFamily: "tote_transfer",
      checkpointId: "ckpt-1",
    });
    expect(rows.docs[0]?.id).toBe(run.runId);
  });
});

describe("money comes back without anyone going looking for it", () => {
  it("releases a hold that nothing ever reported on, once it expires", async () => {
    const { run } = await fundedTeamWithOneHold();
    expect((await getTeamBalance(TEAM)).reservedUsd).toBe(QUOTE_USD);

    await ageRunBy(run.runId, 7 * 60 * 60 * 1000);
    const summary = await reconcileAgentRunSettlements();

    expect(summary.abandoned).toBe(1);
    expect(summary.settled).toBe(0);

    const balance = await getTeamBalance(TEAM);
    expect(balance.reservedUsd).toBe(0);
    expect(balance.spentUsd).toBe(0);
    expect(balance.availableUsd).toBe(1_000);

    // The record says what happened, so nobody has to guess later.
    const stored = await getRunForReservation(run.reservationId);
    expect(stored?.state).toBe("abandoned");
    expect(stored?.moneyResolved).toBe(true);
  });

  it("leaves a hold alone while the run still has time to report", async () => {
    const { run } = await fundedTeamWithOneHold();

    // Due-time queue: a young run is not even read.
    const summary = await reconcileAgentRunSettlements();
    expect(summary.examined).toBe(0);
    expect(summary.abandoned).toBe(0);
    expect((await getTeamBalance(TEAM)).reservedUsd).toBe(QUOTE_USD);
    expect((await getRunForReservation(run.reservationId))?.state).toBe("requested");
  });

  it("frees a team's expired hold on its own agent's next call", async () => {
    // This is what makes settlement certain rather than scheduled. No cron ran
    // here and no env flag was set.
    const { run } = await fundedTeamWithOneHold();
    await ageRunBy(run.runId, 7 * 60 * 60 * 1000);

    const summary = await reconcileTeamHolds(TEAM);

    expect(summary.abandoned).toBe(1);
    expect((await getTeamBalance(TEAM)).availableUsd).toBe(1_000);
  });

  it("does not touch another team's holds when one team calls", async () => {
    const mine = await fundedTeamWithOneHold(TEAM, "mine:0");
    const theirs = await fundedTeamWithOneHold("team-beta", "theirs:0");
    await ageRunBy(mine.run.runId, 7 * 60 * 60 * 1000);
    await ageRunBy(theirs.run.runId, 7 * 60 * 60 * 1000);

    await reconcileTeamHolds(TEAM);

    expect((await getTeamBalance(TEAM)).reservedUsd).toBe(0);
    expect((await getTeamBalance("team-beta")).reservedUsd).toBe(QUOTE_USD);
  });

  it("honours a shortened expiry without releasing runs early", async () => {
    vi.stubEnv("BLUEPRINT_AGENT_RESERVATION_TTL_MS", "1000");
    const { run } = await fundedTeamWithOneHold();

    await ageRunBy(run.runId, 2_000);
    const summary = await reconcileAgentRunSettlements();

    expect(summary.abandoned).toBe(1);
    expect((await getTeamBalance(TEAM)).reservedUsd).toBe(0);
  });
});

describe("a reported run settles for what it ran", () => {
  it("keeps the first outcome immutable and leaves an identical retry resolved", async () => {
    const { run } = await fundedTeamWithOneHold();
    await reportRunOutcome({ runId: run.runId, state: "completed", episodesRun: 25 });
    await reconcileAgentRunSettlements();
    const resolved = collectionStore("evaluationRuns").get(run.runId);

    await expect(reportRunOutcome({ runId: run.runId, state: "completed", episodesRun: 25 }))
      .resolves.toBe(true);
    await expect(reportRunOutcome({ runId: run.runId, state: "completed", episodesRun: 50 }))
      .rejects.toBeInstanceOf(RunOutcomeConflictError);

    expect(collectionStore("evaluationRuns").get(run.runId)).toEqual(resolved);
    expect((await getTeamBalance(TEAM)).spentUsd).toBe(250);
  });

  it("refuses a financial outcome after cancellation without blocking late result evidence", async () => {
    const { run } = await fundedTeamWithOneHold();
    collectionStore("evaluationRuns").set(run.runId, {
      ...collectionStore("evaluationRuns").get(run.runId),
      state: "abandoned",
      cancellationRequested: true,
      dispatchPending: false,
    });

    await expect(reportRunOutcome({ runId: run.runId, state: "completed", episodesRun: 10 }))
      .rejects.toBeInstanceOf(RunOutcomeConflictError);
    expect((await getTeamBalance(TEAM)).spentUsd).toBe(0);
    expect((await getTeamBalance(TEAM)).reservedUsd).toBe(QUOTE_USD);
  });

  it("refuses settlement episodes that disagree with the accepted result receipt", async () => {
    const { run } = await fundedTeamWithOneHold();
    const runs = collectionStore("evaluationRuns");
    runs.set(run.runId, {
      ...runs.get(run.runId),
      result: { observed: { episodesRun: 20, episodesSucceeded: 19 } },
    });

    await expect(reportRunOutcome({ runId: run.runId, state: "completed", episodesRun: 25 }))
      .rejects.toBeInstanceOf(RunOutcomeConflictError);
    expect((runs.get(run.runId)?.result as { observed: { episodesRun: number } }).observed.episodesRun).toBe(20);
    expect((await getTeamBalance(TEAM)).reservedUsd).toBe(QUOTE_USD);
  });

  it("bills every episode when the run completed in full", async () => {
    const { run } = await fundedTeamWithOneHold();

    await reportRunOutcome({ runId: run.runId, state: "completed", episodesRun: 50 });
    const summary = await reconcileAgentRunSettlements();

    expect(summary.settled).toBe(1);
    const balance = await getTeamBalance(TEAM);
    expect(balance.spentUsd).toBe(QUOTE_USD);
    expect(balance.reservedUsd).toBe(0);
  });

  it("bills one flat entry once any episodes ran", async () => {
    const { run } = await fundedTeamWithOneHold();

    await reportRunOutcome({ runId: run.runId, state: "completed", episodesRun: 25 });
    await reconcileAgentRunSettlements();

    const balance = await getTeamBalance(TEAM);
    expect(balance.spentUsd).toBe(250);
    expect(balance.reservedUsd).toBe(0);
    expect(balance.availableUsd).toBe(750);
  });

  it("never bills past the quote, however many episodes are claimed", async () => {
    const { run } = await fundedTeamWithOneHold();

    await reportRunOutcome({ runId: run.runId, state: "completed", episodesRun: 5_000 });
    await reconcileAgentRunSettlements();

    expect((await getTeamBalance(TEAM)).spentUsd).toBe(QUOTE_USD);
  });

  it("gives the hold back whole when the environment never launched", async () => {
    const { run } = await fundedTeamWithOneHold();

    await reportRunOutcome({
      runId: run.runId,
      state: "blocked",
      episodesRun: 0,
      note: "scene would not load",
    });
    await reconcileAgentRunSettlements();

    const balance = await getTeamBalance(TEAM);
    expect(balance.spentUsd).toBe(0);
    expect(balance.availableUsd).toBe(1_000);
  });

  it("tells the site when a run ends with nothing to show, once", async () => {
    const { run } = await fundedTeamWithOneHold();
    lifecycleNotice.mockClear();

    await reportRunOutcome({ runId: run.runId, state: "blocked", episodesRun: 0, note: "scene would not load" });
    await reportRunOutcome({ runId: run.runId, state: "blocked", episodesRun: 0, note: "scene would not load" });

    expect(lifecycleNotice).toHaveBeenCalledTimes(1);
    expect(lifecycleNotice).toHaveBeenCalledWith({ requestId: "scene-1", milestone: "run_no_result", eventId: run.runId });
  });

  it("reports an outcome as due immediately rather than waiting for expiry", async () => {
    const { run } = await fundedTeamWithOneHold();
    await reportRunOutcome({ runId: run.runId, state: "completed", episodesRun: 50 });

    // No ageing. A finished run does not wait out a six-hour clock.
    const summary = await reconcileAgentRunSettlements();
    expect(summary.examined).toBe(1);
    expect(summary.settled).toBe(1);
  });

  it("refuses an outcome for a run no hold was ever taken for", async () => {
    // Otherwise the queue fills with rows no pass can clear, because there is
    // no reservation behind them.
    await expect(
      reportRunOutcome({ runId: "run_res_nobody", state: "completed", episodesRun: 10 }),
    ).resolves.toBe(false);

    const summary = await reconcileAgentRunSettlements();
    expect(summary.examined).toBe(0);
  });
});

describe("two paths to settlement cannot charge twice", () => {
  it("is a no-op when the reconciler runs after a direct settlement", async () => {
    const { run, reservationId } = await fundedTeamWithOneHold();

    // The Pipeline's fast path: settle with the shared key, then clear it.
    const { settleReservation } = await import("../utils/robotTeamBalance");
    await settleReservation({
      teamId: TEAM,
      reservationId,
      amountUsd: QUOTE_USD,
      reason: "direct",
      idempotencyKey: `settle:${reservationId}`,
    });
    await markResolved(run.runId, "completed", "settled directly");

    const summary = await reconcileAgentRunSettlements();
    expect(summary.examined).toBe(0);
    expect((await getTeamBalance(TEAM)).spentUsd).toBe(QUOTE_USD);
  });

  it("charges once even if the record was never cleared", async () => {
    // The crash case: money moved, the mark-resolved write never landed. The
    // shared idempotency key is what stops the reconciler billing it again.
    const { run, reservationId } = await fundedTeamWithOneHold();
    const { settleReservation } = await import("../utils/robotTeamBalance");

    await settleReservation({
      teamId: TEAM,
      reservationId,
      amountUsd: QUOTE_USD,
      reason: "direct",
      idempotencyKey: `settle:${reservationId}`,
    });
    await reportRunOutcome({ runId: run.runId, state: "completed", episodesRun: 50 });
    await reconcileAgentRunSettlements();

    expect((await getTeamBalance(TEAM)).spentUsd).toBe(QUOTE_USD);
  });

  it("retries a run whose settlement failed, rather than dropping it", async () => {
    const { run } = await fundedTeamWithOneHold();
    await reportRunOutcome({ runId: run.runId, state: "completed", episodesRun: 50 });

    // A pass that cannot write leaves the run due.
    const ledger = collectionStore("robotTeamLedger");
    const original = ledger.set.bind(ledger);
    ledger.set = () => {
      throw new Error("ledger unavailable");
    };
    const failed = await reconcileAgentRunSettlements();
    ledger.set = original;

    expect(failed.failed).toBe(1);
    expect(failed.settled).toBe(0);

    const recovered = await reconcileAgentRunSettlements();
    expect(recovered.settled).toBe(1);
    expect((await getTeamBalance(TEAM)).spentUsd).toBe(QUOTE_USD);
  });
});

describe("what an agent can see about its own held money", () => {
  it("lists holds that have not resolved, and stops listing them once they have", async () => {
    const { run } = await fundedTeamWithOneHold();

    expect(await listUnsettledRuns(TEAM)).toHaveLength(1);

    await reportRunOutcome({ runId: run.runId, state: "completed", episodesRun: 50 });
    await reconcileAgentRunSettlements();

    expect(await listUnsettledRuns(TEAM)).toHaveLength(0);
  });
});

describe("the settlement amount is derived from the quote, not from a rate", () => {
  it.each([
    { episodesRun: 0, expected: 0 },
    { episodesRun: 1, expected: 250 },
    { episodesRun: 25, expected: 250 },
    { episodesRun: 50, expected: 250 },
    { episodesRun: 99, expected: 250 },
    { episodesRun: null, expected: 0 },
  ])("bills $episodesRun of 50 episodes at $expected USD", ({ episodesRun, expected }) => {
    expect(
      settlementAmountUsd({ quotedUsd: 250, quotedEpisodes: 50, episodesRun }),
    ).toBe(expected);
  });

  it("does not divide by zero when a quote carries no episode count", () => {
    expect(
      settlementAmountUsd({ quotedUsd: 250, quotedEpisodes: 0, episodesRun: 10 }),
    ).toBe(250);
  });
});
