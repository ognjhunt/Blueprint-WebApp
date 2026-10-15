import type { ListingTargeting } from "./updatePreferences";
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
 * A job's team evaluation, as the Pipeline published it: practice runs the ten
 * published cells and returns every outcome; scored runs 200 hidden cells from
 * the same bounded variations and is the only run a recommendation rests on.
 * Success is decided by the simulator from the task object's state.
 */
export interface TeamEvaluationTerms {
  instruction: string;
  taskKind: string;
  practice: { available: boolean; reason: string | null; episodes: number;
    cells: Array<{ cellId: string; family: string; parameters: Record<string, number> }> };
  scored: { available: boolean; reason: string | null; episodes: number; families: string[];
    parameterBounds: Record<string, [number, number]> };
  policyInterfaces: Array<{ policyInterfaceId: string; robot: "droid_franka" | "team_declared"; summary: string }>;
}
export const taskStageLabels = { capture: "Being captured", preparing: "Scene in preparation", ready: "Ready to evaluate" };
export const opportunityLabels = { open: "Open to pilot proposals", past: "Past opportunity", not_seeking: "Evaluation only" };

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
