// @vitest-environment node
/**
 * Cancelling a run you have not had, versus cancelling one you have had.
 *
 * ## The hole
 *
 * `POST /runs/:reservationId/release` took any reservation id, gave the hold
 * back, and never looked at the run. Its ledger reason was the fixed string
 * "Run did not start" -- which it had no way of knowing. So an agent could
 * reserve, let execution begin, release, and keep the work; and with nothing
 * reporting outcomes yet, that work is never billed at all.
 *
 * Settlement is Pipeline-signed precisely so a team cannot close its own
 * reservation for zero. Release was the same capability on the team's own key,
 * one route down.
 *
 * ## The window
 *
 * A release is a cancellation, and it is valid while nothing has reported. Once
 * an outcome exists the run settles on its merits -- a failed attempt is
 * billable, an environment that would not launch is not -- and that is the
 * Pipeline's report to make rather than the spender's.
 *
 * We cannot see from this repo whether execution physically started. What we
 * can see is whether anything reported, and that closes the loop that costs
 * money while leaving the race that costs latency.
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

const { checkReleaseEligibility } = await import("../utils/agentEvalRuns");

const TEAM = "team-alpha";

function seedRun(overrides: Record<string, unknown> = {}) {
  sharedFakeFirestoreState.docs.set("evaluationRuns/run_res-1", {
    runId: "run_res-1",
    teamId: TEAM,
    checkpointId: "ckpt-1",
    sceneId: "scene-1",
    taskFamily: "tote_transfer",
    reservationId: "res-1",
    quotedUsd: 25,
    quotedEpisodes: 50,
    state: "requested",
    episodesRun: null,
    moneyResolved: false,
    requestedAtIso: "2026-09-17T00:00:00.000Z",
    resolvedAtIso: null,
    note: null,
    ...overrides,
  });
}

beforeEach(() => {
  sharedFakeFirestoreState.docs.clear();
});

describe("a team's agent may cancel a run that has not reported", () => {
  it("allows it while the run is still only requested", async () => {
    seedRun();

    const result = await checkReleaseEligibility(TEAM, "res-1");

    expect(result.allowed).toBe(true);
    expect(result).toMatchObject({ alreadyResolved: false });
  });

  it("allows an orphan hold with no run record, because nothing else will free it", async () => {
    // Same thing the reconciler does at expiry. Refusing would strand it.
    const result = await checkReleaseEligibility(TEAM, "res-unknown");

    expect(result).toMatchObject({ allowed: true, alreadyResolved: false, run: null });
  });
});

describe("and may not cancel one that has", () => {
  it("refuses once episodes have been reported", async () => {
    seedRun({ state: "completed", episodesRun: 37 });

    const result = await checkReleaseEligibility(TEAM, "res-1");

    expect(result).toMatchObject({ allowed: false, reason: "outcome_reported" });
  });

  it("refuses a blocked run too, because that outcome is also not the spender's to write", async () => {
    // A blocked run releases its whole hold -- but the Pipeline says so, and
    // the reason matters. An agent calling it "did not start" would get the
    // same money back with a worse record of why.
    seedRun({ state: "blocked", episodesRun: 0 });

    const result = await checkReleaseEligibility(TEAM, "res-1");

    expect(result).toMatchObject({ allowed: false, reason: "outcome_reported" });
  });

  it("refuses on a half-written outcome, failing closed", async () => {
    // `state` and `episodesRun` are written together. Either one alone is
    // enough to refuse, so a partial write cannot open the window back up.
    seedRun({ state: "requested", episodesRun: 12 });

    expect(await checkReleaseEligibility(TEAM, "res-1")).toMatchObject({
      allowed: false,
      reason: "outcome_reported",
    });

    seedRun({ state: "completed", episodesRun: null });

    expect(await checkReleaseEligibility(TEAM, "res-1")).toMatchObject({
      allowed: false,
      reason: "outcome_reported",
    });
  });

  it("refuses a reservation belonging to another team", async () => {
    // Releasing someone else's is a no-op in the ledger, because entries are
    // per team. Saying so beats writing a meaningless entry and reporting
    // success.
    seedRun({ teamId: "team-beta" });

    const result = await checkReleaseEligibility(TEAM, "res-1");

    expect(result).toMatchObject({ allowed: false, reason: "not_your_reservation" });
  });
});

describe("and asking twice changes nothing", () => {
  it("reports an already-resolved hold as resolved rather than releasing again", async () => {
    seedRun({ state: "abandoned", moneyResolved: true, episodesRun: null });

    const result = await checkReleaseEligibility(TEAM, "res-1");

    // Allowed, so the caller answers the same way it did the first time, but
    // flagged so it writes no second ledger entry.
    expect(result).toMatchObject({ allowed: true, alreadyResolved: true });
  });

  it("treats a settled run as resolved, not as cancellable", async () => {
    seedRun({ state: "completed", episodesRun: 50, moneyResolved: true });

    expect(await checkReleaseEligibility(TEAM, "res-1")).toMatchObject({
      allowed: true,
      alreadyResolved: true,
    });
  });
});
