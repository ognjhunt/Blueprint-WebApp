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
  evaluationAvailable: boolean;
  costUsd: number | null;
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
  /** One line from the simulation of the site, when it ran without a result to lead with (held, could not run). */
  simulation: string | null;
  /**
   * The simulation test's result, the same one the site's screen leads with (`testResultOf`): its kind, row 1 of
   * the ranked options and every option's count. Option names come from the closed map only. Null without a result.
   */
  /** The site's scene finding beside a verdict resting on the site's own measurement, said about the site. */
  sceneNote?: string | null;
  test?: {
    kind: "winner" | "one_option" | "no_clear_winner" | "none_finished" | "testing";
    wording: "did_best" | "was_ahead" | null;
    entered: number;
    setupFlag: boolean;
    options: Array<{ label: string; maker: string | null; succeeded: number; scored: number; furthestText: string | null }>;
  } | null;
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
export type LibraryJobStage = "no_video" | "video_received" | "simulation_building" | "simulation_built" | "no_simulation";
/** The card's label for where the job's simulation stands, true in each state; no label when the state is unknown. */
export const libraryStageLabels: Readonly<Record<LibraryJobStage, string>> = {
  no_video: "No video yet", video_received: "Video received", simulation_building: "Simulation being built",
  simulation_built: "Simulation built", no_simulation: "No simulation for this kind of job",
};
export const opportunityLabels = { open: "Open", past: "Past", not_seeking: "Not looking for a company yet" };

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
  /** The site's own sentence for the job. */
  sentence: string;
  /** The site's quick answers in words, one line each (`jobFactsInWords`). */
  jobFacts: string[];
  /** The country only, or null when the site gave none we can read. */
  country: string | null;
  /** The sound-free company clip behind a short ticket, or "The video is being prepared." */
  video: { state: "ready"; url: string; width: number; height: number; durationSeconds: number | null } | { state: "preparing" };
  /** "Download the simulation" (E9): the job's simulation package behind a short ticket, or "not finished yet". */
  simulationDownload: { state: "ready"; url: string } | { state: "not_finished" };
  /** The simulation of the site in the viewer, behind a short ticket, or "not finished yet". */
  simulation: { state: "ready"; viewerUrl: string } | { state: "not_finished" };
  /** The first look (and the early trial's result inside it, `test`), or null while there is none. */
  firstLook: JobCardAnswerSummary | null;
  /** The first look's robots in plain words, resolved with the site's weight answer where it can be. */
  firstLookRows: CompanyFirstLookRow[];
  /** "And 27 more." when the first look rated more robots than it lists; null otherwise. */
  firstLookMore?: string | null;
  /** This company's own answer on this job, if any. */
  myAnswer: { state: "interested" | "declined" | "needs_something" | "tested_can_do" | "tested_cannot_yet"; inputs: string; updatedAtIso: string;
    statementVersion: string | null } | null;
  /** The line under the form, and the version recorded with an answer. */
  responseStatement: { version: string; text: string };
}
