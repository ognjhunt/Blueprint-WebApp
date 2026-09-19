/** Public fields approved by the site owner, never copied from private intake. */
export interface TaskListingDetails {
  title: string;
  taskFamily: string;
  siteType: string;
  region: string;
  objects: string;
  cycleTarget: string;
  pilotTiming: string;
  pilotBudget: string;
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
