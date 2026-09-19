/**
 * What one prepared site actually costs and earns.
 *
 * ## The arithmetic nobody had run
 *
 * A screening entry is 50 episodes at $0.50, paid by the team: $25. A finalist
 * round is 500 episodes at Blueprint's cost. So every candidate that advances
 * carries ten unpaid episodes for each paid one — and the shortlist rule
 * advances a *close* field intact, which is precisely the field screening
 * cannot separate.
 *
 * Let `M` be paid screening entries at a site, `F` finalists, `c_s` and `c_f`
 * our real cost per episode in each round, and `A` the site-specific
 * preparation, review, support and acquisition cost:
 *
 *     contribution = 25M − 50M·c_s − 500F·c_f − A
 *
 * Which gives break-even ceilings on average episode cost, before a penny of
 * `A`:
 *
 *     M=3,  F=3  →   $75 revenue, 1,650 episodes →  4.5¢
 *     M=15, F=3  →  $375 revenue, 2,250 episodes → 16.7¢
 *     M=15, F=5  →  $375 revenue, 3,250 episodes → 11.5¢
 *
 * At a hypothetical 10¢ an episode, three entrants and three finalists lose
 * $90 before the site is prepared at all. The least liquid sites are the least
 * profitable ones even when execution is cheap, and a cold start is nothing but
 * least-liquid sites.
 *
 * ## Why this module exists rather than a spreadsheet
 *
 * Because the honest answer to "is the current offer contribution-positive" is
 * that we do not know, and the way to stop not knowing is to meter it. Every
 * figure above is arithmetic on published prices; none of it is a measurement.
 * `c_s`, `c_f` and `A` are the unknowns, and they are unknowable from the
 * pricing page.
 *
 * So this records what actually happened per site — entries, revenue, episodes
 * by round, and costs as they are incurred — and computes contribution only
 * when someone supplies a real per-episode cost. It will not invent one.
 */

import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { episodeRate, finalistRound, screeningRound } from "../../client/src/lib/episodePricing";

export const COHORT_LEDGER_COLLECTION = "siteCohortEconomics";

export type CohortRound = "screening" | "finalist";

/** Costs that attach to a site rather than to an episode. */
export type CohortCostKind =
  /** Capture: a visit, a capturer payout, or our own time guiding a self-capture. */
  | "capture"
  /** The reconstruction itself, as billed by the provider. */
  | "reconstruction"
  /** Human review, support, and the back-and-forth on the task brief. */
  | "labour"
  /** Getting this site in the door. */
  | "acquisition"
  /** Anything else, named in the note. */
  | "other";

export interface CohortRecord {
  /** The site. One cohort per prepared scene. */
  sceneId: string;
  /** Paid screening entries: `M`. */
  paidEntries: number;
  /** What teams actually paid, which is not `25 × M` if anything was released. */
  revenueUsd: number;
  /** Episodes executed, by round. The denominators for `c_s` and `c_f`. */
  screeningEpisodes: number;
  finalistEpisodes: number;
  /** Distinct checkpoints that reached the finalist round: `F`. */
  finalists: number;
  /** Site-specific cost, accumulated as it is incurred. */
  siteCostUsd: number;
  costBreakdown: Partial<Record<CohortCostKind, number>>;
  firstRecordedIso: string;
  lastRecordedIso: string;
}

function nowIso() {
  return new Date().toISOString();
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function emptyCohort(sceneId: string): CohortRecord {
  return {
    sceneId,
    paidEntries: 0,
    revenueUsd: 0,
    screeningEpisodes: 0,
    finalistEpisodes: 0,
    finalists: 0,
    siteCostUsd: 0,
    costBreakdown: {},
    firstRecordedIso: nowIso(),
    lastRecordedIso: nowIso(),
  };
}

/**
 * Record episodes that executed against a site.
 *
 * Called from the result path, where the episode count is a report from the
 * Pipeline rather than the quote. A run billed for fewer episodes than it
 * reserved consumed fewer, and the cost side has to use what ran.
 */
export async function recordCohortEpisodes(params: {
  sceneId: string;
  runId?: string;
  round: CohortRound;
  episodes: number;
  /** Set when this is a distinct checkpoint's first run in this round. */
  newEntry?: boolean;
  /** What the team was actually charged, for a screening entry. */
  revenueUsd?: number;
}): Promise<void> {
  if (!db || !params.sceneId || params.episodes <= 0) return;

  const ref = db.collection(COHORT_LEDGER_COLLECTION).doc(params.sceneId);
  const increment = admin.firestore.FieldValue.increment;

  try {
    if (params.runId) {
      const receiptRef = db.collection("siteCohortEpisodeReceipts").doc(params.runId);
      await db.runTransaction(async transaction => {
        const receipt = await transaction.get(receiptRef);
        if (receipt.exists) return;
        const stored = await transaction.get(ref);
        const cohort = { ...emptyCohort(params.sceneId), ...stored.data() };
        const field = params.round === "screening" ? "screeningEpisodes" : "finalistEpisodes";
        transaction.set(ref, { ...cohort, [field]: cohort[field] + Math.round(params.episodes),
          paidEntries: cohort.paidEntries + (params.newEntry && params.round === "screening" ? 1 : 0),
          finalists: cohort.finalists + (params.newEntry && params.round === "finalist" ? 1 : 0),
          revenueUsd: round2(cohort.revenueUsd + (params.revenueUsd ?? 0)), lastRecordedIso: nowIso() }, { merge: true });
        transaction.set(receiptRef, { sceneId: params.sceneId, round: params.round, episodes: params.episodes });
      });
      return;
    }
    await ref.set(
      {
        sceneId: params.sceneId,
        [params.round === "screening" ? "screeningEpisodes" : "finalistEpisodes"]: increment(
          Math.round(params.episodes),
        ),
        ...(params.newEntry
          ? params.round === "screening"
            ? { paidEntries: increment(1) }
            : { finalists: increment(1) }
          : {}),
        ...(params.revenueUsd ? { revenueUsd: increment(round2(params.revenueUsd)) } : {}),
        lastRecordedIso: nowIso(),
      },
      { merge: true },
    );
  } catch (error) {
    // Metering must never fail the thing it is measuring. A run that executed
    // and got its result is worth more than a complete cost ledger.
    logger.warn({ error, ...params }, "Could not record cohort episodes");
  }
}

/** Record a cost that belongs to the site rather than to an episode. */
export async function recordCohortCost(params: {
  sceneId: string;
  kind: CohortCostKind;
  amountUsd: number;
  note?: string | null;
}): Promise<void> {
  if (!db || !params.sceneId || !(params.amountUsd > 0)) return;

  const ref = db.collection(COHORT_LEDGER_COLLECTION).doc(params.sceneId);
  const increment = admin.firestore.FieldValue.increment;

  try {
    await ref.set(
      {
        sceneId: params.sceneId,
        siteCostUsd: increment(round2(params.amountUsd)),
        costBreakdown: { [params.kind]: increment(round2(params.amountUsd)) },
        lastRecordedIso: nowIso(),
        ...(params.note ? { lastCostNote: params.note } : {}),
      },
      { merge: true },
    );
  } catch (error) {
    logger.warn({ error, ...params }, "Could not record cohort cost");
  }
}

export async function getCohort(sceneId: string): Promise<CohortRecord | null> {
  if (!db) return null;
  const snapshot = await db.collection(COHORT_LEDGER_COLLECTION).doc(sceneId).get();
  if (!snapshot.exists) return null;
  return { ...emptyCohort(sceneId), ...(snapshot.data() as Partial<CohortRecord>) };
}

export interface ContributionInput {
  cohort: CohortRecord;
  /** Our real cost per screening episode. Measured, not assumed. */
  screeningEpisodeCostUsd: number;
  /** Our real cost per finalist episode. Often the same; not necessarily. */
  finalistEpisodeCostUsd: number;
}

export interface ContributionResult {
  revenueUsd: number;
  screeningCostUsd: number;
  finalistCostUsd: number;
  siteCostUsd: number;
  contributionUsd: number;
  /** Ten unpaid episodes per paid one is the thing to watch. */
  unpaidEpisodesPerPaidEpisode: number | null;
}

/**
 * Contribution for one prepared site, given a measured episode cost.
 *
 * The cost is a parameter rather than a constant on purpose: this module will
 * not invent the number the whole exercise exists to find out.
 */
export function cohortContribution(input: ContributionInput): ContributionResult {
  const { cohort } = input;
  const screeningCostUsd = round2(cohort.screeningEpisodes * input.screeningEpisodeCostUsd);
  const finalistCostUsd = round2(cohort.finalistEpisodes * input.finalistEpisodeCostUsd);

  return {
    revenueUsd: round2(cohort.revenueUsd),
    screeningCostUsd,
    finalistCostUsd,
    siteCostUsd: round2(cohort.siteCostUsd),
    contributionUsd: round2(
      cohort.revenueUsd - screeningCostUsd - finalistCostUsd - cohort.siteCostUsd,
    ),
    unpaidEpisodesPerPaidEpisode:
      cohort.screeningEpisodes > 0
        ? round2(cohort.finalistEpisodes / cohort.screeningEpisodes)
        : null,
  };
}

/**
 * The highest average episode cost this site could bear and still break even,
 * before any site-specific cost.
 *
 * The ceiling, not a target. Reconstruction and human work still have to fit
 * underneath it, and at a thin field there is very little room: three entrants
 * and three finalists leaves 4.5¢.
 */
export function breakEvenEpisodeCostUsd(cohort: CohortRecord): number | null {
  const episodes = cohort.screeningEpisodes + cohort.finalistEpisodes;
  if (episodes <= 0) return null;
  return Math.round((cohort.revenueUsd / episodes) * 10_000) / 10_000;
}

/**
 * The same ceiling from the published prices, for a field that has not run yet.
 *
 * Useful before there is anything to meter: it says what the offer implies
 * rather than what a site did.
 */
export function projectedBreakEvenEpisodeCostUsd(params: {
  paidEntries: number;
  finalists: number;
}): number | null {
  const revenue = params.paidEntries * screeningRound.episodes * episodeRate;
  const episodes =
    params.paidEntries * screeningRound.episodes + params.finalists * finalistRound.episodes;
  if (episodes <= 0) return null;
  return Math.round((revenue / episodes) * 10_000) / 10_000;
}
