/**
 * The first look in plain words, for the site's job page and the company's page alike: one function, so
 * both pages word the same row identically (PACKAGE_E step 3 and E1). The sentences are neutral (they
 * say "the item", "the video"), because the same words reach the site and the deployment company.
 *
 * Rows are the Pipeline's published `website_robot_fit_projection.v2` model rows (status v8;
 * `scratchpad/e2e/FIRST_LOOK_CONTRACT.md`, revision 2, plus revision 3's `route_clear`):
 *
 * - `fits`, `fits_spec`: "Fits."
 * - `doesnt_fit`: "Does not fit: {why}."
 * - `fits_if`: one sentence per condition ("Fits if the item weighs under 11.6 kg."). When the site gave a
 *   weight range (`job_facts.weight`), only the weight condition is resolved: the range's upper bound at
 *   or under the limit settles it (the sentence then says so, or the row reads "Fits: …" when it was the
 *   only condition); even the lightest item in a bounded range over the rated payload reads "Too heavy
 *   for this robot"; "over 30 kg" and "not sure" leave it conditional.
 * - `unknown`: "Not rated yet: {why}." with each cause in fixed words.
 *
 * A code this file does not know (a verdict, a quantity, a check the Pipeline adds later) never crashes
 * and is never shown: the row, or the cause, reads only "Not rated yet." Robot names come only from the
 * row itself. `firstLookInWords` keeps the Pipeline's rows and order and adds "And N more." when the
 * Pipeline cut the list.
 */
import { weightLowerBoundKg, weightUpperBoundKg, type JobFacts } from "./jobFacts";
import type { AnswerRobot } from "./siteAnswer";

/** A published v2 condition, as loosely typed as a stored value is. */
export interface FirstLookCondition {
  quantity?: unknown; need_min?: unknown; need_max?: unknown; limit?: unknown; need_basis?: unknown; limit_basis?: unknown;
}

/** A published v2 model row, as loosely typed as a stored or fetched value is. */
export interface FirstLookRow {
  name?: unknown;
  manufacturer?: unknown;
  verdict?: unknown;
  verdict_if_conditions_hold?: unknown;
  rated_payload_kg?: unknown;
  payload_limit_kg?: unknown;
  failed_checks?: unknown;
  conditions?: unknown;
  missing?: unknown;
}

export type FirstLookVerdict = "fits" | "does_not_fit" | "conditional" | "not_rated";

export interface FirstLookRowWords {
  verdict: FirstLookVerdict;
  /** "Fits.", "Does not fit: it cannot reach both spots.", "Fits if the item weighs under 11.6 kg.", ... */
  text: string;
  /** "Universal Robots UR10e", from the row only; null when the row names no robot. */
  robot: string | null;
}

export const FIRST_LOOK_FITS = "Fits.";
export const FIRST_LOOK_NOT_RATED = "Not rated yet.";
export const FIRST_LOOK_DOES_NOT_FIT = "Does not fit.";

/** Why a robot was ruled out, in fixed words, by the Pipeline's check code. */
export const FIRST_LOOK_CHECK_WORDS: Readonly<Record<string, string>> = {
  stance: "there is no place for it to stand",
  reach: "it cannot reach both spots",
  payload: "the item is too heavy for it",
  cycle_time: "it is too slow for the rate",
  access: "it cannot get there from the entrance",
};

/** The published figure a `catalog_figure_missing` cause lacks, by check. */
const CATALOG_FIGURE: Readonly<Record<string, string>> = {
  stance: "base size", reach: "reach", payload: "rated payload", cycle_time: "top speed",
};

/** Why a row is not rated yet, in fixed words, by check and cause. Null when the pair has no words. */
export function missingCauseWords(check: unknown, cause: unknown): string | null {
  if (typeof check !== "string" || typeof cause !== "string") return null;
  switch (cause) {
    case "catalog_figure_missing":
      return CATALOG_FIGURE[check] ? `the maker publishes no ${CATALOG_FIGURE[check]} for it` : "the maker publishes no figure we need for it";
    case "footprint_not_searched": return "its base is larger than a standard station, and we have not looked for room for it";
    case "no_clear_station": return "we found no clear floor space for it to stand";
    case "arm_pose_search_inconclusive": return "our search found no arm position that reaches, although its published reach is enough";
    case "carry_check_undecided": return "the carry check in the simulation did not settle whether it reaches";
    case "not_modelled": return check === "reach" ? "we do not yet model its reach from where it stands" : "we do not model this yet";
    case "not_checked": return check === "access" ? "we do not yet check whether it can get there from the entrance" : "we have not checked this yet";
    case "tool_figure_missing": return "the size of its standard gripper is not known";
    case "item_mass_missing": return "the item's weight is not known, and its standard gripper alone is over its rating";
    case "estimate_straddles_limit": return "the item's estimated weight is too close to its rating to tell";
    default: return null;
  }
}

export const fitsIfUnder = (limit: string) => `Fits if the item weighs under ${limit} kg.`;
export const fitsWithinRange = (upper: string, limit: string) =>
  `Fits: the item is under ${upper} kg and this robot carries ${limit} kg.`;
export const weightSettled = (upper: string, limit: string) => `The item is under ${upper} kg and this robot carries ${limit} kg.`;
export const tooHeavy = (rated: string) => `Too heavy for this robot (${rated} kg).`;
export const FITS_IF_ROUTE_CLEAR = "Fits if it has a clear route to the job.";

const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);
const positive = (value: unknown) => (typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null);
const nonNegative = (value: unknown) => (typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null);
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const codes = (value: unknown) => list(value).filter((item): item is string => typeof item === "string");
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

/** A figure as the page says it: at most one decimal for kg and s, two for metres, no trailing zero. */
export function figureWords(value: number, decimals = 1): string {
  const factor = 10 ** decimals;
  return String(Math.round(value * factor) / factor);
}
/** Kilograms as the page says them ("11.6", "5", "29.1"). */
export const kgWords = (value: number) => figureWords(value, 1);

const BASIS_WORDS: Readonly<Record<string, string>> = {
  estimated_from_video: "estimated from the video", owner_stated: "from the site's own numbers",
};

/** "0.7 to 1.22 m", or "about 1.2 m" when both ends round the same. Null without both ends. */
function band(min: unknown, max: unknown, unit: string, decimals: number): string | null {
  const low = nonNegative(min), high = nonNegative(max);
  if (low === null || high === null || high < low) return null;
  const a = figureWords(low, decimals), b = figureWords(high, decimals);
  return a === b ? `about ${a} ${unit}` : `${a} to ${b} ${unit}`;
}

/** One condition in a sentence, or null when it has no words (an unknown quantity, a missing limit). */
export function conditionWords(condition: unknown): string | null {
  const c = record(condition) as FirstLookCondition;
  const basis = typeof c.need_basis === "string" ? BASIS_WORDS[c.need_basis] : undefined;
  switch (c.quantity) {
    case "item_mass_kg": {
      const limit = positive(c.limit);
      return limit === null ? null : fitsIfUnder(kgWords(limit));
    }
    case "reach_m": {
      const limit = positive(c.limit);
      if (limit === null) return null;
      const need = band(c.need_min, c.need_max, "m", 2);
      return `Fits if the job is within its ${figureWords(limit, 2)} m reach${need ? `; it seems to need ${need}${basis ? `, ${basis}` : ""}` : ""}.`;
    }
    case "cycle_time_s": {
      const limit = positive(c.limit);
      if (limit === null) return null;
      const need = band(c.need_min, c.need_max, "s", 1);
      return `Fits if each cycle can stay within the site's ${figureWords(limit, 1)} s target${need ? `; it seems to take ${need}` : ""}.`;
    }
    case "floor_width_m": {
      const limit = positive(c.limit);
      if (limit === null) return null;
      const need = band(c.need_min, c.need_max, "m", 2);
      return `Fits if there is ${figureWords(limit, 2)} m of clear floor to stand on${need ? `; this job seems to offer ${need}${basis ? `, ${basis}` : ""}` : ""}.`;
    }
    case "route_clear":
      return FITS_IF_ROUTE_CLEAR;
    default:
      return null;
  }
}

function robotOf(row: FirstLookRow): string | null {
  const name = text(row.name);
  if (!name) return null;
  const maker = text(row.manufacturer);
  return maker && !name.toLowerCase().startsWith(maker.toLowerCase()) ? `${maker} ${name}` : name;
}

/** The row in words, with the weight condition resolved by the site's weight answer when it settles it. */
export function firstLookRowInWords(row: FirstLookRow | null | undefined, facts?: Partial<JobFacts> | null): FirstLookRowWords {
  const safe = record(row) as FirstLookRow;
  const robot = robotOf(safe);
  const words = (verdict: FirstLookVerdict, line: string): FirstLookRowWords => ({ verdict, text: line, robot });
  switch (safe.verdict) {
    case "fits":
    case "fits_spec":
      return words("fits", FIRST_LOOK_FITS);
    case "doesnt_fit": {
      const known = codes(safe.failed_checks).find(code => Object.prototype.hasOwnProperty.call(FIRST_LOOK_CHECK_WORDS, code));
      return words("does_not_fit", known ? `Does not fit: ${FIRST_LOOK_CHECK_WORDS[known]}.` : FIRST_LOOK_DOES_NOT_FIT);
    }
    case "fits_if": {
      const conditions = list(safe.conditions);
      if (conditions.length === 0) return words("not_rated", FIRST_LOOK_NOT_RATED);
      const upper = weightUpperBoundKg(facts), lower = weightLowerBoundKg(facts);
      const rated = positive(safe.rated_payload_kg);
      const sentences: string[] = [];
      let settledWeight: { upper: number; limit: number } | null = null;
      for (const condition of conditions) {
        const c = record(condition);
        if (c.quantity === "item_mass_kg") {
          const limit = positive(c.limit);
          if (limit !== null && upper !== null && upper <= limit) { settledWeight = { upper, limit }; continue; }
          // Only a bounded range settles a row ("over 30 kg" and "not sure" leave it conditional, PACKAGE_E E1).
          if (limit !== null && upper !== null && lower !== null && rated !== null && lower > rated)
            return words("does_not_fit", tooHeavy(kgWords(rated)));
        }
        const sentence = conditionWords(condition);
        // A condition with no words means the row cannot be said truthfully: it is not rated.
        if (!sentence) return words("not_rated", FIRST_LOOK_NOT_RATED);
        sentences.push(sentence);
      }
      if (sentences.length === 0 && settledWeight)
        return words("fits", fitsWithinRange(kgWords(settledWeight.upper), kgWords(settledWeight.limit)));
      if (settledWeight) sentences.push(weightSettled(kgWords(settledWeight.upper), kgWords(settledWeight.limit)));
      return words("conditional", sentences.join(" "));
    }
    case "unknown": {
      const why = [...new Set(list(safe.missing).map(item => missingCauseWords(record(item).check, record(item).cause))
        .filter((line): line is string => Boolean(line)))];
      return words("not_rated", why.length ? `Not rated yet: ${why.join("; ")}.` : FIRST_LOOK_NOT_RATED);
    }
    default:
      // Any code added later: never a raw code, never a crash.
      return words("not_rated", FIRST_LOOK_NOT_RATED);
  }
}

export interface FirstLookWords {
  rows: FirstLookRowWords[];
  /** "And 24 more." when the Pipeline cut the list; null otherwise. */
  more: string | null;
}

export const andMore = (count: number) => `And ${count} more.`;
export const AND_MORE_UNCOUNTED = "And more not listed here.";

/**
 * A whole published table in words: at most the rows the Pipeline sent, in its order, then "And N more."
 * when it cut the list (`models_truncated`), N from its counts of the whole table.
 */
export function firstLookInWords(fit: unknown, facts?: Partial<JobFacts> | null): FirstLookWords {
  const table = record(fit);
  const models = list(table.models).slice(0, 200);
  const rows = models.map(row => firstLookRowInWords(row as FirstLookRow, facts));
  if (table.models_truncated !== true) return { rows, more: null };
  const counts = record(table.counts);
  const total = Object.values(counts).reduce<number>((sum, value) => sum + (nonNegative(value) ?? 0), 0);
  return { rows, more: total > models.length ? andMore(total - models.length) : AND_MORE_UNCOUNTED };
}

/**
 * Today's website-composed robot (`AnswerRobot`, client/src/lib/siteAnswer.ts) as a published row, for a
 * page that has no v2 table yet. It carries no limit, so it never becomes conditional: a robot that "may
 * fit" reads "Not rated yet." rather than a limit nobody published.
 */
export function firstLookRowFromAnswerRobot(robot: Pick<AnswerRobot, "name" | "manufacturer" | "verdict" | "checks">): FirstLookRow {
  const failed = robot.checks.filter(check => check.outcome === "fail").map(check => check.key);
  const verdict = robot.verdict === "fits" ? "fits" : robot.verdict === "fits_on_paper" ? "fits_spec"
    : robot.verdict === "ruled_out" ? "doesnt_fit" : "unknown";
  return { name: robot.name, manufacturer: robot.manufacturer, verdict, verdict_if_conditions_hold: null,
    rated_payload_kg: null, payload_limit_kg: null, failed_checks: verdict === "doesnt_fit" ? failed : [], conditions: [], missing: [] };
}
