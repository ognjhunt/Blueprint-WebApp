/**
 * Whether a site's job fits a company's pilot offer on paper (owner, 2026-11-28). A pure rule, no model: what the site
 * said and the kind of job, against what the company says it takes. Never an estimate from the video for a limit.
 *
 * An offer is ruled out only on a stated answer that cannot fit (an item heavier than the company takes, a state it does
 * not work in). "Not sure", or no answer, is `unknown`: the offer is still shown, with a plain line, and is never ruled
 * out for it. That keeps it flagged, not stopped.
 */
import { KINDS_OF_JOB_TYPE, WEIGHT_RANGE_KG, isJobFactCode, jobFactNumber, weightLowerBoundKg, type JobFacts,
  type ReaderJobKind } from "./jobFacts";
import { HOURS_ORDER, SIZE_ORDER, type OfferJobType, type PilotFitFact, type PilotOfferBody } from "./pilotOffers";

/** The job's facts the rule reads, built on the server from the job's record. */
export interface PilotFitJob {
  /** The video reading's kind of job, or null. */
  kind: ReaderJobKind | null;
  /** The keyword job type (`anonymizedOpportunityDraft`), "" when none. */
  taskFamily: string;
  /** The site's own answers to the quick questions. */
  facts: Partial<JobFacts> | null;
  /** The job's US state code, from the place the site gave under the statement that shares it; null when not on record. */
  usState: string | null;
}

export type PilotNoFitReason = PilotFitFact;
export interface PilotFit {
  fits: boolean;
  /** Facts the rule could not check: shown with the offer, never a reason to leave it out. */
  unknown: PilotFitFact[];
  /** The first stated fact that cannot fit, or null. */
  why: PilotNoFitReason | null;
  /** The site's weight answer is a range only partly under the company's limit (said, not ruled out). */
  weightPartly?: true;
}

/**
 * The job's type as an offer names it. Unloading and Cleaning win over the reading's kind, as the visit list already lets
 * a keyword type win (`visitMustConfirm`); else the reading's kind; else the kind the keyword type is a case of, when it
 * is one kind only. Null when nothing says.
 */
export function pilotJobTypeOf(kind: ReaderJobKind | null, taskFamily: string): OfferJobType | null {
  if (taskFamily === "Unloading") return "unloading";
  if (taskFamily === "Cleaning") return "cleaning";
  if (kind) return kind;
  const kinds = KINDS_OF_JOB_TYPE[taskFamily];
  return kinds?.length === 1 ? kinds[0] : null;
}

/** A stated code's place in its order, or null for no answer, "Not sure" or anything unknown. */
const placeOf = (order: readonly string[], code: unknown) => typeof code === "string" && order.includes(code) ? order.indexOf(code) : null;

export function pilotOfferFit(offer: PilotOfferBody, job: PilotFitJob): PilotFit {
  const unknown: PilotFitFact[] = [];
  let why: PilotNoFitReason | null = null;
  let weightPartly = false;
  const rule = (fact: PilotNoFitReason) => { why ??= fact; };

  // The kind of job.
  const type = pilotJobTypeOf(job.kind, job.taskFamily);
  if (type === null) unknown.push("job_type");
  else if (!offer.kinds.includes(type)) rule("job_type");

  // Weight: the heaviest item the site typed, else its weight range. Out only when even the range's lower end is over.
  const maxKg = offer.limits.maxKg;
  if (maxKg !== null) {
    const typed = jobFactNumber("maxLoadedWeightKg", job.facts?.maxLoadedWeightKg);
    const lower = weightLowerBoundKg(job.facts);
    const code = job.facts?.weight;
    // The range's upper end: a number, null for "Over 30 kg", undefined for no answer or "Not sure".
    const upper = code && isJobFactCode("weight", code) ? WEIGHT_RANGE_KG[code]?.upper : undefined;
    if (typed !== null) { if (typed > maxKg) rule("weight"); }
    else if (lower !== null && lower > maxKg) rule("weight");
    else if (lower === null || upper === undefined) unknown.push("weight");
    else if (upper === null || upper > maxKg) { unknown.push("weight"); weightPartly = true; }
  }

  // Size: the site's size band against the largest the company takes.
  if (offer.limits.maxSide !== null) {
    const site = placeOf(SIZE_ORDER, job.facts?.size);
    if (site === null) unknown.push("size");
    else if (site > SIZE_ORDER.indexOf(offer.limits.maxSide)) rule("size");
  }

  // Hours: the site's working day against the shortest the company takes.
  if (offer.limits.minHours !== null) {
    const site = placeOf(HOURS_ORDER, job.facts?.hours);
    if (site === null) unknown.push("hours");
    else if (site < HOURS_ORDER.indexOf(offer.limits.minHours)) rule("hours");
  }

  // Place: the job's US state against where the company works. No state on record: shown, flagged.
  if (job.usState === null) unknown.push("region");
  else if (offer.limits.states !== "all_us" && !offer.limits.states.includes(job.usState)) rule("region");

  return { fits: why === null, unknown, why, ...(weightPartly ? { weightPartly: true as const } : {}) };
}
