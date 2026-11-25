/**
 * The owner's marketplace numbers on the staff job page (`GET /api/admin/jobs/marketplace-numbers`), worked out by
 * `server/utils/marketplaceNumbers.ts` and shown by `client/src/components/admin/MarketplaceNumbers.tsx`.
 *
 * Every number says how many records it rests on. A number with nothing under it is null and the page says "No data
 * yet"; it is never 0 when nothing was measured.
 */

export const MARKETPLACE_WINDOWS = [7, 30] as const;
export type MarketplaceWindow = (typeof MARKETPLACE_WINDOWS)[number];

/** A share: `count` of `of`, and `share` (0 to 1), null when `of` is 0. */
export interface MarketplaceShare {
  count: number;
  of: number;
  share: number | null;
}

/** A time from the site's video arriving to a first step, over the jobs where both times are recorded. */
export interface MarketplaceDuration {
  /** Jobs whose time could be measured. */
  measured: number;
  /** Median and 90th percentile in milliseconds; null when `measured` is 0. */
  medianMs: number | null;
  p90Ms: number | null;
  /** Shared jobs with no such step yet. */
  waiting: number;
  /** Jobs with the step whose time cannot be measured: no video time on record, the step's time not recorded, or the
   * step recorded before the video. */
  notMeasurable: number;
}

/** Dollars over jobs: median, 90th percentile, largest and sum. */
export interface MarketplaceUsdSpread {
  jobs: number;
  medianUsd: number;
  p90Usd: number;
  maxUsd: number;
  totalUsd: number;
}

export interface MarketplaceLaneSpend {
  key: string;
  label: string;
  /** Null when no job's figure for this lane could be read. */
  spread: MarketplaceUsdSpread | null;
  /** Jobs whose figure for this lane could not be read (left out of `spread`). */
  unreadable: number;
}

/** A first step on one job: none yet, recorded at a time, or recorded with its time unknown. */
export type MarketplaceStep =
  | { state: "none" }
  | { state: "time_unknown" }
  /** `afterVideoMs` null: no video time on record, or the step was recorded before it. */
  | { state: "at"; atIso: string; afterVideoMs: number | null };

export type MarketplaceJobSpend =
  | { state: "counted"; usd: number }
  /** The job has no row in any ledger the cap counts. */
  | { state: "no_ledger" }
  /** A ledger row's figure cannot be read, so the cap counts the job as unbounded. */
  | { state: "unreadable" }
  /** The ledgers could not be read right now. */
  | { state: "unavailable" };

/** One shared job. No site name, address or contact, and no company name: ids and counts only. */
export interface MarketplaceJobRow {
  jobId: string;
  /** An internal test job (only with the switch on), with its label. */
  internalTest: { label: string | null } | null;
  sharedAtIso: string;
  videoAtIso: string | null;
  firstResponse: MarketplaceStep;
  firstApply: MarketplaceStep;
  responses: number;
  applications: number;
  /** Introductions made: the company's email with the site's details was sent. */
  introductions: number;
  /** Introductions the site asked for that are not made yet (and not cancelled). */
  introductionsWaiting: number;
  spend: MarketplaceJobSpend;
  /** Null: nothing was recorded for this job (or the counters could not be read). */
  simulationOpens: number | null;
  simulationDownloads: number | null;
}

export interface MarketplaceUse {
  total: number;
  jobs: number;
  companies: number;
}

export interface MarketplaceOutcomeRow {
  key: string;
  label: string;
  /** Introductions on which this was recorded. */
  introductions: number;
}

export interface MarketplaceNumbers {
  windowDays: MarketplaceWindow;
  includeTests: boolean;
  /** The first UTC day of the window, at 00:00Z; the window runs to now. */
  sinceIso: string;
  generatedAtIso: string;
  /** The jobs the window holds, after exclusions. */
  sharedJobs: number;
  /** Where a read limit may have left records out, in words; empty when nothing was cut. */
  limits: string[];
  headline: {
    firstResponse: MarketplaceDuration;
    firstApply: MarketplaceDuration;
    jobsWithApply: MarketplaceShare;
    applicationsIntroduced: MarketplaceShare;
  };
  answers: {
    needMoreDetails: MarketplaceShare;
    notAFit: MarketplaceShare;
  };
  outcomes: {
    /** Introductions made on the window's jobs: what the outcome rows are counted over. */
    introductions: number;
    rows: MarketplaceOutcomeRow[];
  };
  cost: {
    /** Null when no job's spend could be counted. */
    perJob: MarketplaceUsdSpread | null;
    noLedger: number;
    unreadable: number;
    unavailable: number;
    lanes: MarketplaceLaneSpend[];
    /** The job's one cap, in dollars, as the cap's contract states it. */
    capUsd: number;
  };
  simulation: {
    viewerOpens: MarketplaceUse | null;
    downloads: MarketplaceUse | null;
  };
  jobs: MarketplaceJobRow[];
}
