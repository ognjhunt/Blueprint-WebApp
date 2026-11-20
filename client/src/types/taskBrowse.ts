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
  /**
   * Where the job's simulation stands, read from its real state (`libraryJobStage`), for the card's label. Null, and
   * no label, when that state cannot be read for certain.
   */
  simulationStage?: LibraryJobStage | null;
  /** A verified simulation package for the job's current capture is stored. */
  simulationDownloadAvailable?: boolean;
  evaluationAvailable: boolean;
  publishedAtIso: string;
  thumbnailUrl: string | null;
  /** The company's page for this job (`/jobs/:jobId`). */
  jobUrl?: string;
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
  /** The site's scene finding beside a verdict resting on the site's own measurement, said about the site. */
  sceneNote?: string | null;
  note: string;
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
export type LibraryJobStage = "no_video" | "video_received" | "simulation_building" | "simulation_built";
/** The card's label for where the job's simulation stands, true in each state; no label when the state is unknown. */
export const libraryStageLabels: Readonly<Record<LibraryJobStage, string>> = {
  no_video: "No video yet", video_received: "Video received", simulation_building: "Simulation being built",
  simulation_built: "Simulation built",
};
export const opportunityLabels = { open: "Open", past: "Past", not_seeking: "Not looking for a company yet" };

const generatedJobTitles: ReadonlyMap<string, string> = new Map([
  ["Carton palletizing opportunity", "Palletize cartons"],
  ["Pallet handling opportunity", "Handle pallets"],
  ["Palletizing opportunity", "Palletize items"],
  ["Depalletizing opportunity", "Unload pallets"],
  ["Case packing opportunity", "Pack products into cases"],
  ["Machine tending opportunity", "Load or unload a machine"],
  ["Dish handling opportunity", "Handle dishes"],
  ["Packing opportunity", "Pack items"],
  ["Inspection opportunity", "Inspect items"],
  ["Material handling opportunity", "Move materials"],
  ["Job opportunity", "Automation job"],
]);

export function jobTitleForDisplay(title: string): string {
  return generatedJobTitles.get(title) ?? title;
}

const opportunityCategories = {
  other: ["Job opportunity", "Other", ""],
  dishes: ["Dish handling opportunity", "Dish handling", "Dishes"],
  palletizing: ["Palletizing opportunity", "Palletizing", ""],
  depalletizing: ["Depalletizing opportunity", "Depalletizing", ""],
  cartonPalletizing: ["Carton palletizing opportunity", "Palletizing", "Cartons"],
  palletHandling: ["Pallet handling opportunity", "Pallet handling", ""],
  casePacking: ["Case packing opportunity", "Case packing", ""],
  packaging: ["Packing opportunity", "Packaging", ""],
  machineTending: ["Machine tending opportunity", "Machine tending", ""],
  inspection: ["Inspection opportunity", "Quality inspection", ""],
  materialHandling: ["Material handling opportunity", "Material handling", ""],
} as const;

type OpportunityCategory = typeof opportunityCategories[keyof typeof opportunityCategories];

function categoryDraft([title, taskFamily, objects]: OpportunityCategory): TaskListingDetails {
  return { title, taskFamily, objects, siteType: "", region: "", cycleTarget: "", pilotTiming: "", pilotBudget: "", pilotPriceStatus: "target_budget", pilotConditions: "", ongoingTarget: "", opportunity: "open" };
}

/** Rebuild safe details for newly created and older stored listings. */
export function storedAnonymizedOpportunityDraft(title: unknown): TaskListingDetails {
  return categoryDraft(Object.values(opportunityCategories).find(category => category[0] === title) ?? opportunityCategories.other);
}

/** Use the site's description to select a fixed category. No description text crosses into the listing. */
export function anonymizedOpportunityDraft(description: string): TaskListingDetails {
  const text = description.toLowerCase();
  const categories = opportunityCategories;
  if (/\b(?:machine|cnc)[ -]tend(?:ing)?\b|\b(?:un)?load\w*\b.{0,55}\b(?:into|from|out of|in) (?:(?:a|an|the) )?(?:cnc|lathe|injection mold(?:ing)? machine)\b/.test(text)) {
    return categoryDraft(categories.machineTending);
  }
  if (/\bdepalleti[sz]\w*\b/.test(text)) return categoryDraft(categories.depalletizing);
  if (/\bpalleti[sz]\w*\b|\bstack\w*\b.{0,70}\b(?:on|onto) (?:\w+ ){0,3}pallets?\b/.test(text)) {
    return categoryDraft(/\b(?:cartons?|box(?:es)?)\b/.test(text) ? categories.cartonPalletizing : categories.palletizing);
  }
  if (/\bcase[ -]pack\w*\b|\b(?:pack|load)\w*\b.{0,55}\binto (?:\w+ ){0,2}(?:cases?|cartons?|boxes)\b/.test(text)) return categoryDraft(categories.casePacking);
  if (/\binspect\w*\b|\bquality (?:check|control)\b/.test(text)) return categoryDraft(categories.inspection);
  if (/\b(?:dish(?:es)?|dishwashers?)\b/.test(text)) return categoryDraft(categories.dishes);
  if (/\bpallets?\b/.test(text)) return categoryDraft(categories.palletHandling);
  if (/\bpack(?:s|ing|ed|ag\w*)?\b/.test(text)) return categoryDraft(categories.packaging);
  if (/\b(?:pick|place|transfer|move)\w*\b/.test(text)) return categoryDraft(categories.materialHandling);
  return categoryDraft(categories.other);
}

/** One first-look row in words (`client/src/lib/firstLookWords.ts`), as the company's page shows it. */
export interface CompanyFirstLookRow { verdict: "fits" | "does_not_fit" | "conditional" | "not_rated"; text: string; robot: string | null }

/**
 * The company's page for one job (package E, E3), for a signed-in approved company only. Never the site's name, typed
 * address, email, phone or submitter name: only the site's own sentence for the job, its quick answers, the country,
 * and the job packet's parts, each when it exists.
 */
export interface CompanyJobPage {
  schemaVersion: "company_job_page.v1";
  id: string;
  /** The category title ("Material handling opportunity"). */
  title: string;
  taskFamily: string;
  publishedAtIso: string;
  /** The site's own sentence for the job, without its name, address, contact details or any other name-shaped text
   * (`removeIdentifyingDetails`, then `removeNamesNotHeld`). */
  sentence: string;
  /** The site's quick answers in words, one line each (`jobFactsInWords`). */
  jobFacts: string[];
  /** The country only, or null when the site gave none we can read. */
  country: string | null;
  /**
   * The sound-free company clip behind a short ticket, "The video is being prepared.", or `none`: the site sent the job
   * with its description only, so there is no video yet.
   */
  video: { state: "ready"; url: string; width: number; height: number; durationSeconds: number | null } | { state: "preparing" } | { state: "none" };
  /** "Download the simulation" (E9): the job's simulation package behind a short ticket, or "not finished yet". */
  simulationDownload: { state: "ready"; url: string } | { state: "not_finished" };
  /** The simulation of the site in the viewer, behind a short ticket, or "not finished yet". */
  simulation: { state: "ready"; viewerUrl: string } | { state: "not_finished" };
  /** The first look, or null while there is none. */
  firstLook: JobCardAnswerSummary | null;
  /** The first look's robots in plain words, resolved with the site's weight answer where it can be. */
  firstLookRows: CompanyFirstLookRow[];
  /** "And 27 more." when the first look rated more robots than it lists; null otherwise. */
  firstLookMore?: string | null;
  /**
   * What the video shows of the job's object, and how sure each figure is (the Pipeline's packet facts, preparation
   * status v9), each line without contact details or a street address; null until the Pipeline has them. Blueprint's
   * estimate of something the site answered on its job page is left out: the site's answer is in `jobFacts`.
   */
  packetFacts: { object: string[]; measured: string[]; estimated: string[] } | null;
  /** What nothing in the job packet measured or asked: a company judges these itself. */
  notShown: string[];
  /** This company's own answer on this job, if any. */
  myAnswer: { state: "interested" | "declined" | "needs_something" | "tested_can_do" | "tested_cannot_yet"; inputs: string; updatedAtIso: string;
    statementVersion: string | null } | null;
  /** The line under the form, and the version recorded with an answer. */
  responseStatement: { version: string; text: string };
}
