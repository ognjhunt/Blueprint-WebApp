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
  /** What the thumbnail is, when there is one: a render of the job's simulation, or a frame of its video. */
  thumbnailSource?: "simulation_render" | "company_clip_frame";
  /** The company's page for this job (`/jobs/:jobId`). */
  jobUrl?: string;
  /**
   * The site's own sentence for the job, as its job page shows it (`siteSentenceForCompany`): its known name, address
   * and contact details removed. Empty when the site's identity cannot be read.
   */
  sentence?: string;
  /** The answer's headline, only when the site chose to share its answer with the card. */
  answerHeadline?: string;
  /** The job's title from its facts (`jobHeadline`), as its page leads with it; the category title until a reading. */
  headline?: string;
  /** How often and how long, when the site said ("60 to 300 times an hour", "Two shifts"). */
  headlineFacts?: string[];
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
export type LibraryJobStage = "no_video" | "video_received" | "simulation_building" | "simulation_built"
  /** The job ended with no simulation built and none coming (outreach audit D7, 2026-11-27). */
  | "no_simulation";
/** The card's label for where the job's simulation stands, true in each state; no label when the state is unknown. */
export const libraryStageLabels: Readonly<Record<LibraryJobStage, string>> = {
  no_video: "No video yet", video_received: "Simulation not started yet", simulation_building: "Simulation being built",
  simulation_built: "Simulation built", no_simulation: "No simulation",
};

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
  ["Cleaning opportunity", "Clean surfaces"],
  ["Unloading opportunity", "Unload items"],
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
  cleaning: ["Cleaning opportunity", "Cleaning", ""],
  unloading: ["Unloading opportunity", "Unloading", ""],
} as const;

type OpportunityCategory = typeof opportunityCategories[keyof typeof opportunityCategories];

function categoryDraft([title, taskFamily, objects]: OpportunityCategory): TaskListingDetails {
  return { title, taskFamily, objects, siteType: "", region: "", cycleTarget: "", pilotTiming: "", pilotBudget: "", pilotPriceStatus: "target_budget", pilotConditions: "", ongoingTarget: "", opportunity: "open" };
}

/** Rebuild safe details for newly created and older stored listings. */
export function storedAnonymizedOpportunityDraft(title: unknown): TaskListingDetails {
  return categoryDraft(Object.values(opportunityCategories).find(category => category[0] === title) ?? opportunityCategories.other);
}

/**
 * Words that take things off a pallet: "off the incoming pallet", "from each pallet", "out of the pallet", "unload the
 * pallets", "unstack pallets", "break down pallets". Only a few words may stand between, so "from the conveyor and
 * place them on the pallet" (palletizing) does not match.
 */
const PALLET_WORDS = String.raw`(?:(?:the|a|an|each|every|its|their|our|incoming|inbound|arriving|delivered|full|loaded|mixed|stacked|supplier|received|wooden|plastic)\s+){0,3}pallets?\b`;
const DEPALLETIZING_WORDS = new RegExp(String.raw`\b(?:off|out of|from)\s+${PALLET_WORDS}|\b(?:unload|unstack|destack|break(?:ing)? down)\w*\s+${PALLET_WORDS}`);

/**
 * Taking goods out of a vehicle: "unload the cartons from the back of the truck", "offload boxes from the delivery van",
 * "truck unloading" (stress test, 2026-11-27: with no category of its own, the reading's palletizing kind titled it
 * "Stack … on pallets"). Unloading a pallet, a machine or a dishwasher is matched before this, by its own words.
 */
const VEHICLE = String.raw`(?:trucks?|trailers?|lorr(?:y|ies)|vans?|(?:shipping )?containers?|vehicles?)`;
const UNLOADING_WORDS = new RegExp(String.raw`\b(?:un-?load|off-?load)\w*\b.{0,60}\b${VEHICLE}\b|\b(?:truck|trailer|lorry|container)[ -]?(?:un-?load|off-?load)\w*`);

/**
 * Work done to a surface: mopping, sweeping, vacuuming, scrubbing, wiping, cleaning, dusting, polishing, disinfecting
 * and washing (stress test, 2026-11-27: "Mop the hard floors … after each move-out." was filed as moving materials). A
 * cleanroom or a washing machine is a place or a machine, not this work, so neither counts.
 *
 * Such a word is the job's action where a clause leads with it ("Mop the floors", "…, then wipe the tables", "the robot
 * should sweep"), and then wins over any moving word; anywhere else ("Move clean towels to the shelves", "Pick clean
 * parts from the conveyor", a review of PR #1466) it describes the things moved, and counts only when nothing in the
 * sentence moves things ("Floor cleaning in the lobby").
 */
const CLEANING_WORDS = /\b(?:mop(?:s|ped|ping)?|sweep(?:s|ing)?|swept|vacuum(?:s|ed|ing)?|hoover(?:s|ed|ing)?|scrub(?:s|bed|bing)?|wip(?:e|es|ed|ing)|clean(?:s|ed|ing)?|dust(?:s|ed|ing)?|polish(?:es|ed|ing)?|disinfect\w*|saniti[sz]\w*|wash(?:es|ed|ing)?)\b/;
const CLEANING_VERB = String.raw`(?:mop(?:ping)?|sweep(?:ing)?|vacuum(?:ing)?|hoover(?:ing)?|scrub(?:bing)?|wip(?:e|ing)|clean(?:ing)?|dust(?:ing)?|polish(?:ing)?|disinfect(?:ing)?|saniti[sz](?:e|ing)|wash(?:ing)?)`;
const CLEANING_ACTION = new RegExp(String.raw`(?:^\s*|[.;:!?,]\s*|\b(?:and|then|or|to|please|should|must|will|would|can|could)\s+)${CLEANING_VERB}\b`);
const NOT_CLEANING = /\bclean ?rooms?\b|\bwashing machines?\b/g;

/** A move-out or a move-in (a tenant leaving or arriving) is a noun, not moving things. */
const MOVING_WORDS = /\b(?:pick|place|transfer|move)\w*\b(?!-(?:ins?|outs?)\b)/;

/** Use the site's description to select a fixed category. No description text crosses into the listing. */
export function anonymizedOpportunityDraft(description: string): TaskListingDetails {
  const text = description.toLowerCase();
  const categories = opportunityCategories;
  if (/\b(?:machine|cnc)[ -]tend(?:ing)?\b|\b(?:un)?load\w*\b.{0,55}\b(?:into|from|out of|in) (?:(?:a|an|the) )?(?:cnc|lathe|injection mold(?:ing)? machine)\b/.test(text)) {
    return categoryDraft(categories.machineTending);
  }
  // Depalletizing by its words, not only by its name (stress test, 2026-11-24: "Take each carton off the incoming
  // pallet" was read as pallet handling): taking things off or out of a pallet, or unloading or unstacking pallets.
  if (/\bde-?palleti[sz]\w*\b/.test(text) || DEPALLETIZING_WORDS.test(text)) return categoryDraft(categories.depalletizing);
  if (/\bpalleti[sz]\w*\b|\bstack\w*\b.{0,70}\b(?:on|onto) (?:\w+ ){0,3}pallets?\b/.test(text)) {
    return categoryDraft(/\b(?:cartons?|box(?:es)?)\b/.test(text) ? categories.cartonPalletizing : categories.palletizing);
  }
  if (UNLOADING_WORDS.test(text) && !/\b(?:dish(?:es)?|dishwashers?)\b/.test(text)) return categoryDraft(categories.unloading);
  if (/\bcase[ -]pack\w*\b|\b(?:pack|load)\w*\b.{0,55}\binto (?:\w+ ){0,2}(?:cases?|cartons?|boxes)\b/.test(text)) return categoryDraft(categories.casePacking);
  if (/\binspect\w*\b|\bquality (?:check|control)\b/.test(text)) return categoryDraft(categories.inspection);
  if (/\b(?:dish(?:es)?|dishwashers?)\b/.test(text)) return categoryDraft(categories.dishes);
  if (/\bpallets?\b/.test(text)) return categoryDraft(categories.palletHandling);
  if (/\bpack(?:s|ing|ed|ag\w*)?\b/.test(text)) return categoryDraft(categories.packaging);
  const cleaningText = text.replace(NOT_CLEANING, " ");
  const moving = MOVING_WORDS.test(text);
  if (CLEANING_ACTION.test(cleaningText) || (!moving && CLEANING_WORDS.test(cleaningText))) return categoryDraft(categories.cleaning);
  if (moving) return categoryDraft(categories.materialHandling);
  return categoryDraft(categories.other);
}

/**
 * The company's page for one job (package E, E3), for a signed-in approved company only. Never the site's name, typed
 * address, email, phone or submitter name: only the site's own sentence for the job, its quick answers, the country,
 * and the job packet's parts a company decides on, each when it exists. Not the first look: it stays on the site's own
 * pages (owner, 2026-11-25).
 */
export interface CompanyJobPage {
  schemaVersion: "company_job_page.v1";
  id: string;
  /** The category title ("Material handling opportunity"). */
  title: string;
  /** The title built from the job's facts ("Scrape and scoop cake batter", `jobHeadline`); the category title until a
   * video reading names the job. */
  headline: string;
  /** How often and how long, when the site said ("60 to 300 times an hour", "Two shifts"). */
  headlineFacts: string[];
  taskFamily: string;
  publishedAtIso: string;
  /** The site's own sentence for the job, without its name, address, contact details or any other name
   * (`removeIdentifyingDetails`, the model pass, which judges a name the record does not hold, then the first again). Empty until the model pass has
   * succeeded for it (`server/utils/freeTextScreening.ts`). */
  sentence: string;
  /** The site's stated success criteria with identifying details removed. */
  successRule?: string;
  /** The site gave a success rule that cannot be shown yet (names and contact details are being taken out of it). */
  successRulePending?: true;
  /** The site's quick answers in words, one line each (`jobFactsInWords`). */
  jobFacts: string[];
  /** The same answers as fixed fields, "Not stated" where the site skipped one (`fitSummary`). */
  fitSummary: import("../lib/companyJobPage").FitSummaryRow[];
  /** The country only, or null when the site gave none we can read. */
  country: string | null;
  /**
   * The sound-free company clip behind a short ticket, "The video is being prepared.", or `none`: the site sent the job
   * with its description only, so there is no video yet.
   */
  video: { state: "ready"; url: string; width: number; height: number; durationSeconds: number | null } | { state: "preparing" };
  /** The job's thumbnail (`server/utils/jobThumbnail.ts`), shown before the video plays; null until made. */
  thumbnailUrl?: string | null;
  /** What the thumbnail is: a render of the job's simulation, or a frame of its video. */
  thumbnailSource?: "simulation_render" | "company_clip_frame" | null;
  /**
   * "Download the simulation" (E9): the job's simulation package behind a short ticket, or "not finished yet".
   * `sizeBytes` is the stored package's size, said on the button in whole megabytes; `fileName` the name it is saved
   * under, by the package's version (`companySimulationFileName`). `objectIncluded: false` when the Pipeline says the
   * package is the site's room with no object of the job's as a separate part.
   */
  simulationDownload: { state: "ready"; url: string; sizeBytes: number; fileName: string; objectIncluded?: false } | { state: "not_finished" };
  /** The simulation of the site in the viewer, behind a short ticket, or "not finished yet". */
  simulation: { state: "ready"; viewerUrl: string } | { state: "not_finished" };
  /**
   * What the video shows of the job's object, and how sure each figure is (the Pipeline's packet facts, preparation
   * status v9), each line shown only when neither the deterministic passes nor the model pass over free text find
   * anything to take out of it (a line either pass would change is left out); null until the Pipeline has them.
   * Blueprint's estimate of something the site answered on its job page is left out: the site's answer is in `jobFacts`.
   */
  packetFacts: { object: string[]; measured: string[]; estimated: string[] } | null;
  /** The Pipeline has packet facts and the model pass over them has not succeeded yet: none is shown until it has. */
  packetFactsPending?: true;
  /** Where the simulation stands while neither the viewer nor the download is ready; null once one is. */
  simulationStatus: string | null;
  /** What a first site visit must still confirm for this kind of job (`visitMustConfirm`). */
  visitMustConfirm: string[];
  /** About the site, with nothing that identifies it (`aboutTheSite`). */
  aboutSite: string[];
  /** This company's own answer on this job, if any. */
  myAnswer: { state: "interested" | "declined" | "needs_something" | "tested_can_do" | "tested_cannot_yet"; inputs: string; updatedAtIso: string;
    statementVersion: string | null; details?: import("../lib/companyResponses").CompanyReplyDetails } | null;
  /** The site's reply to this company's question; `answer` is null while names and contact details are being taken out
   * of it (`server/utils/freeTextScreening.ts`). */
  clarification?: { question: string; answer: string | null;
    /** The reply is not shown because the job reached its limit on preparing words (`server/utils/freeTextScreening.ts`). */
    limitReached?: true };
  /** This company's question while the site has not replied: when it asked, the reply date, and whether we reminded. */
  pendingQuestion?: { askedAtIso: string; replyByIso: string; reminded: boolean };
  /** The line under the form, and the version recorded with an answer. */
  responseStatement: { version: string; text: string };
}

/** A live job as anyone reads it on /jobs (`server/utils/taskBrowse.ts`, `listPublicLiveJobs`). */
export interface PublicLiveJob {
  /**
   * The job's public reference (never its id): the row opens `/jobs/<ref>`, which an approved company reads as the job and
   * anyone else is asked to apply for. Absent when the server has no signing secret.
   */
  ref?: string;
  /** The kind of job, from Blueprint's fixed categories ("Palletize cartons", "Pick and place job"); never the site's words. */
  kind: string;
  /** The fixed kind the label and the row's picture follow (the video reading's, else the category's). */
  kindKey: "pick_and_place" | "palletizing" | "machine_tending" | "transport" | "other";
  /** The country only, or null. */
  country: string | null;
  /** The day the job was shared, YYYY-MM-DD. */
  postedOn: string;
  /** An approved company can download the job's simulation now. */
  simulationReady: boolean;
}
