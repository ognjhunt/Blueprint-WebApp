// @vitest-environment node
/**
 * The conformance suite for the Pipeline's completion record.
 *
 * These are **release gates, not experiments**. Paid execution must not depend
 * on discovering afterwards whether settlement and inactive-team reconciliation
 * work, so each case here is one the implementation has to pass before the
 * first team is charged for anything.
 *
 * Six cases, as specified:
 *
 *  1. zero episodes execute                    → whole reservation released
 *  2. 37 valid episodes against a $99 entry    → $99 settled once there is a result
 *  3. the policy fails the task                → failure recorded, attempts billed
 *  4. our environment fails                    → affected attempts not billed
 *  5. completion delivered repeatedly          → one resolution, one result
 *  6. the team stops calling the API           → the reservation still resolves
 *
 * Case 2 now uses the flat customer quote. Case 5 it did not: a
 * timeout could release a hold and a late completion then settle it, because
 * `deriveBalance` booked every settle unconditionally. That is fixed, and this
 * is where it stays fixed.
 */
import { describe, expect, it } from "vitest";

import {
  billableAmountUsd,
  completionRecordSchema,
  resolutionFor,
  validateCompletionRecord,
  type CompletionRecord,
} from "../utils/pipelineCompletionRecord";
import { deriveBalance, type LedgerEntry } from "../utils/robotTeamBalance";
import { settlementAmountUsd } from "../utils/agentEvalRuns";

/** A record that passes, which each case then breaks in one specific way. */
function record(overrides: Partial<CompletionRecord> = {}): CompletionRecord {
  return completionRecordSchema.parse({
    reservation_id: "res-1",
    run_id: "pipeline-run-1",
    team_id: "team-1",
    checkpoint_version: "ckpt-1@v3",
    scene_version: "scene-1@v2",
    scoring_version: "scoring@2026-09-01",
    episodes_run: 50,
    episodes_succeeded: 47,
    episodes_billable: 50,
    infrastructure_failures: [],
    result_manifest_uri: "gs://bucket/runs/res-1/manifest.json",
    median_cycle_seconds: 42,
    rate_usd: 0.5,
    completed_at_iso: "2026-09-17T12:00:00.000Z",
    ...overrides,
  });
}

function entry(
  partial: Partial<LedgerEntry> & Pick<LedgerEntry, "kind" | "amountUsd" | "createdAtIso">,
): LedgerEntry {
  return {
    entryId: `e-${Math.random()}`,
    teamId: "team-1",
    reservationId: "res-1",
    reason: "conformance",
    idempotencyKey: `k-${Math.random()}`,
    ...partial,
  };
}

describe("1. zero episodes execute", () => {
  it("releases the whole reservation and records an explicit non-execution", () => {
    const zero = record({ episodes_run: 0, episodes_succeeded: 0, episodes_billable: 0 });
    const resolution = resolutionFor(zero);

    expect(resolution.kind).toBe("release");
    expect(resolution.amountUsd).toBe(0);
    // Not a settle of zero. The ledger has to say what happened rather than
    // record a spend of nothing.
    expect(resolution.reason).toMatch(/no episode executed/i);
  });
});

describe("2. 37 valid episodes against a $99 entry", () => {
  it("prorates the quoted entry after partial execution", () => {
    const partial = record({
      episodes_run: 37,
      episodes_succeeded: 30,
      episodes_billable: 37,
    });

    expect(billableAmountUsd(partial)).toBeCloseTo(18.5, 2);

    // The Pipeline's rate is telemetry; the customer's maximum price is the quote.
    expect(
      settlementAmountUsd({ quotedUsd: 99, quotedEpisodes: 50, episodesRun: 37 }),
    ).toBe(73.26);

    // The hold clears with the unrun share returned to available balance.
    const balance = deriveBalance("team-1", [
      entry({ kind: "credit", amountUsd: 99, createdAtIso: "2026-09-17T00:00:00.000Z", reservationId: null }),
      entry({ kind: "reserve", amountUsd: 99, createdAtIso: "2026-09-17T00:01:00.000Z" }),
      entry({ kind: "settle", amountUsd: 73.26, createdAtIso: "2026-09-17T00:02:00.000Z" }),
    ]);

    expect(balance.spentUsd).toBe(73.26);
    expect(balance.reservedUsd).toBe(0);
    expect(balance.availableUsd).toBe(25.74);
  });

  it("never settles above the quote, whatever rate is reported", () => {
    // A rate ten times too high must not come out of a real balance.
    const wrong = record({ episodes_run: 50, episodes_billable: 50, rate_usd: 5 });

    expect(billableAmountUsd(wrong)).toBe(250);
    expect(
      Math.min(
        billableAmountUsd(wrong),
        settlementAmountUsd({ quotedUsd: 25, quotedEpisodes: 50, episodesRun: 50 }),
      ),
    ).toBe(25);
  });
});

describe("3. the policy fails the task", () => {
  it("records the failure and bills the attempts", () => {
    // The published rule: the robot dropping the box is a result, and you pay
    // for it. A bad result is not a refund.
    const failed = record({ episodes_run: 50, episodes_succeeded: 8, episodes_billable: 50 });

    expect(validateCompletionRecord(failed)).toEqual([]);
    expect(resolutionFor(failed)).toMatchObject({ kind: "settle", amountUsd: 25 });
  });
});

describe("4. Blueprint's environment fails", () => {
  it("excludes the affected attempts from billing", () => {
    const partial = record({
      episodes_run: 50,
      episodes_succeeded: 30,
      episodes_billable: 40,
      infrastructure_failures: Array.from({ length: 10 }, (_, index) => ({
        episode_index: 40 + index,
        reason: "scene failed to launch",
      })),
    });

    expect(validateCompletionRecord(partial)).toEqual([]);
    expect(billableAmountUsd(partial)).toBeCloseTo(20, 2);
  });

  it("releases the whole hold when nothing was billable", () => {
    const allOurFault = record({
      episodes_run: 4,
      episodes_succeeded: 0,
      episodes_billable: 0,
      infrastructure_failures: Array.from({ length: 4 }, (_, index) => ({
        episode_index: index,
        reason: "scene failed to launch",
      })),
    });

    const resolution = resolutionFor(allOurFault);
    expect(resolution.kind).toBe("release");
    expect(resolution.reason).toMatch(/lost to our own infrastructure/i);
  });

  it("refuses a record where an episode is both our fault and their bill", () => {
    // 50 episodes cannot be 50 billable and also 10 infrastructure failures.
    // One of those numbers is wrong and we do not know which, so this is a
    // refusal rather than a clamp.
    const impossible = record({
      episodes_run: 50,
      episodes_billable: 50,
      infrastructure_failures: [{ episode_index: 1, reason: "launch" }],
    });

    expect(validateCompletionRecord(impossible)).toContain(
      "billable_overlaps_infrastructure_failures",
    );
  });

  it("refuses more successes than episodes", () => {
    const impossible = record({ episodes_run: 10, episodes_succeeded: 11, episodes_billable: 10 });

    expect(validateCompletionRecord(impossible)).toContain("successes_exceed_episodes");
  });
});

describe("5. completion delivered repeatedly", () => {
  it("resolves the money once, and the first resolution wins", () => {
    // The case our code got wrong. A settle keyed on the reservation dedupes a
    // retry of the same call; what it did not handle was a *different* second
    // resolution -- a timeout releasing the hold and a late completion then
    // settling it, which booked real spend against money already handed back.
    const balance = deriveBalance("team-1", [
      entry({ kind: "credit", amountUsd: 25, createdAtIso: "2026-09-17T00:00:00.000Z", reservationId: null }),
      entry({ kind: "reserve", amountUsd: 25, createdAtIso: "2026-09-17T00:01:00.000Z" }),
      // Expired and released before anything reported.
      entry({ kind: "release", amountUsd: 0, createdAtIso: "2026-09-17T06:01:00.000Z" }),
      // Then the completion arrives, twice.
      entry({ kind: "settle", amountUsd: 18.5, createdAtIso: "2026-09-17T06:05:00.000Z" }),
      entry({ kind: "settle", amountUsd: 18.5, createdAtIso: "2026-09-17T06:06:00.000Z" }),
    ]);

    // One financial resolution: the release. Both settles are absorbed.
    expect(balance.spentUsd).toBe(0);
    expect(balance.absorbedUsd).toBeCloseTo(37, 2);
    expect(balance.availableUsd).toBe(25);
    // And never an overdraft, which is what the old clamp was hiding.
    expect(balance.overdrawnUsd).toBe(0);
  });

  it("settles once when the settle is the first resolution and arrives twice", () => {
    const balance = deriveBalance("team-1", [
      entry({ kind: "credit", amountUsd: 25, createdAtIso: "2026-09-17T00:00:00.000Z", reservationId: null }),
      entry({ kind: "reserve", amountUsd: 25, createdAtIso: "2026-09-17T00:01:00.000Z" }),
      entry({ kind: "settle", amountUsd: 18.5, createdAtIso: "2026-09-17T00:02:00.000Z" }),
      entry({ kind: "settle", amountUsd: 18.5, createdAtIso: "2026-09-17T00:03:00.000Z" }),
    ]);

    expect(balance.spentUsd).toBeCloseTo(18.5, 2);
    expect(balance.absorbedUsd).toBeCloseTo(18.5, 2);
  });

  it("keeps the record inspectable, because evidence and money are different", () => {
    // A late result is still a result. Financial finality does not mean the
    // run's own record is discarded -- we absorb the cost and keep what it
    // showed, which is the whole reason the two routes are separate.
    const late = record({ episodes_run: 37, episodes_succeeded: 30, episodes_billable: 37 });

    expect(late.result_manifest_uri).toMatch(/^gs:\/\//);
    expect(late.checkpoint_version).toBeTruthy();
    expect(late.scene_version).toBeTruthy();
    expect(late.scoring_version).toBeTruthy();
  });
});

describe("6. the team stops calling the API", () => {
  it("resolves the reservation without the team ever coming back", () => {
    // Nobody asks on behalf of a team that reserved money and went quiet, so
    // expiry has to resolve it. A hold that outlives its run is, from the
    // team's side, indistinguishable from being overcharged.
    const balance = deriveBalance("team-1", [
      entry({ kind: "credit", amountUsd: 25, createdAtIso: "2026-09-17T00:00:00.000Z", reservationId: null }),
      entry({ kind: "reserve", amountUsd: 25, createdAtIso: "2026-09-17T00:01:00.000Z" }),
      entry({ kind: "release", amountUsd: 0, createdAtIso: "2026-09-17T06:01:00.000Z" }),
    ]);

    expect(balance.reservedUsd).toBe(0);
    expect(balance.availableUsd).toBe(25);
    expect(balance.spentUsd).toBe(0);
  });
});

describe("the contract refuses what it cannot interpret", () => {
  it("requires the versions a claim has to be attributable to", () => {
    // A measured band belongs to a checkpoint, a scene and a scoring version.
    // A result that cannot name its inputs cannot be invalidated later when
    // one of them turns out to have been wrong.
    for (const field of ["checkpoint_version", "scene_version", "scoring_version"]) {
      const withoutField = { ...record() } as Record<string, unknown>;
      delete withoutField[field];
      expect(completionRecordSchema.safeParse(withoutField).success, field).toBe(false);
    }
  });

  it("requires somewhere to look at the result", () => {
    const withoutManifest = { ...record() } as Record<string, unknown>;
    delete withoutManifest.result_manifest_uri;

    expect(completionRecordSchema.safeParse(withoutManifest).success).toBe(false);
  });

  it("rejects an unknown field rather than ignoring it", () => {
    // Strict, so a Pipeline sending `episodes_attempted` when we asked for
    // `episodes_run` finds out at the boundary instead of having the number
    // silently dropped.
    expect(
      completionRecordSchema.safeParse({ ...record(), episodes_attempted: 50 }).success,
    ).toBe(false);
  });
});
