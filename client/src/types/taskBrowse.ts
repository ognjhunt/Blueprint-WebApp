import type { ListingTargeting } from "./updatePreferences";
import type { AnswerBasis, AnswerConfidenceLevel, AnswerEvidence } from "../lib/siteAnswer";
/** Public fields approved by the site owner, never copied from private intake. */
export interface TaskListingDetails {
  targeting?: ListingTargeting;
  title: string;
  taskFamily: string;
  siteType: string;
  region: string;
  objects: string;
  cycleTarget: string;
  pilotTiming: string;
  pilotBudget: string;
  /** A site proposal is still subject to the provider's acceptance and a final agreement. */
  pilotPriceStatus?: "site_offer" | "target_budget";
  pilotConditions?: string;
  ongoingTarget?: string;
  opportunity: "open" | "past" | "not_seeking";
}
export interface TaskBrowseCard extends TaskListingDetails {
  id: string;
  stage: "capture" | "preparing" | "ready";
  evaluationAvailable: boolean;
  costUsd: number | null;
  publishedAtIso: string;
  thumbnailUrl: string | null;
  /** The answer's headline, only when the site chose to share its answer with the card. */
  answerHeadline?: string;
}
/** The card as an approved company opens it: the browse card, and the answer when the site shared it. */
export interface TaskCardDetail extends TaskBrowseCard {
  answerSummary?: JobCardAnswerSummary;
}
/** One robot in the shared answer: names, verdict, its published figures and its cited track record. */
export interface JobCardAnswerRobot {
  manufacturer: string;
  name: string;
  verdictLabel: string;
  /** The two published figures (reach, payload), each with its source. */
  specs: Array<{ label: string; display: string; sourceUrl: string }>;
  /**
   * Each check's outcome and its two figures, the strings the site's own check sentence says (`AnswerCheck.need`
   * and `has`): numbers with their units, never the site's words. Absent on cards composed before 2026-11-11.
   */
  checks?: Array<{ key: "reach" | "payload" | "cycle_time"; outcome: "pass" | "fail" | "unknown"; need: string | null; has: string | null;
    /** A pass with little to spare. */ tight?: boolean }>;
  evidence: AnswerEvidence[];
}
/**
 * Blueprint's answer for a job, as an approved deployment company sees it on
 * the card. Present only when the site pressed "Find a deployment company for
 * this job" under the statement that names the answer
 * (`client/src/lib/jobCardAnswerConsent.ts`). Sizes, weights and distances,
 * robot names and cited sources: never the site's name, address, contacts,
 * video or own words.
 */
export interface JobCardAnswerSummary {
  headline: string;
  familyLabel: string | null;
  facts: Array<{ label: string; display: string; basis: AnswerBasis }>;
  pick: JobCardAnswerRobot | null;
  runnerUp: JobCardAnswerRobot | null;
  confidence: { level: AnswerConfidenceLevel; reason: string | null };
  unknowns: string[];
  /** One line from the simulation of the site, when one has run. */
  simulation: string | null;
  note: string;
}
/**
 * One job as an approved robot team opens it to request an evaluation: the
 * site-approved card and nothing more. Served only while the job is open to
 * evaluation requests (`server/utils/teamJobAccess.ts`).
 */
export interface TeamJobOpening extends TaskListingDetails {
  id: string;
  publishedAtIso: string;
  thumbnailUrl: string | null;
  /** What a team is asked to do and how it is judged, once the job's scene is ready. */
  evaluation?: TeamEvaluationTerms | null;
}
/**
 * A job's team evaluation, as the Pipeline published it: 200 hidden cells from
 * the job's bounded variations, the only run a recommendation rests on.
 * Success is decided by the simulator from the task object's state.
 */
export interface TeamEvaluationTerms {
  instruction: string;
  taskKind: string;
  scored: { available: boolean; reason: string | null; episodes: number; families: string[];
    parameterBounds: Record<string, [number, number]> };
  policyInterfaces: Array<{ policyInterfaceId: string; robot: "droid_franka" | "team_declared"; summary: string }>;
}
export const taskStageLabels = { capture: "Being captured", preparing: "Scene in preparation", ready: "Ready to evaluate" };
export const opportunityLabels = { open: "Open to a pilot", past: "Past opportunity", not_seeking: "Evaluation only" };

/** Conservative, non-identifying text only. Never publish arbitrary intake prose. */
export function anonymizedOpportunityDraft(description: string): TaskListingDetails {
  const text = description.toLowerCase();
  const category = /dish|dishwasher/.test(text) ? ["Dish handling opportunity", "Dish handling", "Dishes"]
    : /pallet/.test(text) ? [/carton|box/.test(text) ? "Carton palletizing opportunity" : "Pallet handling opportunity", "Pallet handling", /carton|box/.test(text) ? "Cartons" : ""]
      : /pack/.test(text) ? ["Packing opportunity", "Packing", ""]
        : /inspect/.test(text) ? ["Inspection opportunity", "Inspection", ""]
          : /pick|place|transfer|move/.test(text) ? ["Material handling opportunity", "Material handling", ""]
            : ["Work assessment opportunity", "To be determined", ""];
  return { title: category[0], taskFamily: category[1], objects: category[2], siteType: "", region: "", cycleTarget: "", pilotTiming: "", pilotBudget: "", pilotPriceStatus: "target_budget", pilotConditions: "", ongoingTarget: "", opportunity: "open" };
}
