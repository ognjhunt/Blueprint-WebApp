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
export const taskStageLabels = { capture: "Being captured", preparing: "Scene in preparation", ready: "Ready to evaluate" };
export const opportunityLabels = { open: "Open to pilot proposals", past: "Past opportunity", not_seeking: "Evaluation only" };

/** Conservative, non-identifying text only. Never publish arbitrary intake prose. */
export function anonymizedOpportunityDraft(description: string): TaskListingDetails {
  const text = description.toLowerCase();
  const category = /dish|dishwasher/.test(text) ? ["Dish handling opportunity", "Dish handling", "Dishes"]
    : /pallet/.test(text) ? [/carton|box/.test(text) ? "Carton palletizing opportunity" : "Pallet handling opportunity", "Pallet handling", /carton|box/.test(text) ? "Cartons" : ""]
      : /pack/.test(text) ? ["Recurring packing opportunity", "Packing", ""]
        : /inspect/.test(text) ? ["Recurring inspection opportunity", "Inspection", ""]
          : /pick|place|transfer|move/.test(text) ? ["Recurring material handling opportunity", "Material handling", ""]
            : ["Recurring work opportunity", "Recurring work", ""];
  return { title: category[0], taskFamily: category[1], objects: category[2], siteType: "", region: "", cycleTarget: "", pilotTiming: "", pilotBudget: "", pilotPriceStatus: "target_budget", pilotConditions: "", ongoingTarget: "", opportunity: "open" };
}
