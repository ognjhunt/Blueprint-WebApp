/**
 * What the company's page for one job leads with (owner, 2026-11-23, from the research report "Robot deployment
 * readiness needs"): a title built from the job's own facts, the facts a company decides "worth a conversation" on, a
 * status where a box would otherwise be empty, and a short list of what a site visit must still confirm for this kind
 * of job, in place of a long list of what the packet does not show.
 *
 * Every line is fixed wording or the site's own answer; the only free words are the video reading's name for the job's
 * object and, where the job has a brief (`client/src/lib/jobBrief.ts`), its labels, quotes and choices, which the server
 * passes through the site's known identity and the model pass first (`server/utils/companyJobPage.ts`).
 */
import { JOB_FACT_KEYS, JOB_FACT_SHORT_LABELS, jobFactKeysFor, jobFactLabel, sanitizeJobFacts, type JobFactKey, type JobReading,
  type ReaderJobKind } from "./jobFacts";

/** The words for what the reading saw done to the object (`OTHER_ACTIONS` in `site-video-evidence.ts`), as a verb. */
const ACTION_VERBS: Readonly<Record<string, string>> = {
  folding: "fold", pouring: "pour", wiping: "wipe", sweeping: "sweep", scrubbing: "scrub", fastening: "fasten",
  assembling: "assemble", cutting: "cut", welding: "weld", painting: "paint", spraying: "spray", sanding: "sand",
  polishing: "polish", mixing: "mix", sewing: "sew", tying: "tie", peeling: "peel", opening: "open", closing: "close",
  pressing: "press", capping: "cap", labelling: "label", wrapping: "wrap", inspecting: "inspect", cleaning: "clean",
  scraping: "scrape", scooping: "scoop", spreading: "spread",
};

const capitalized = (text: string) => text ? text[0].toUpperCase() + text.slice(1) : text;

export interface HeadlineInputs {
  /** The video reading's kind of job, its object and what it saw done to the object; null before a reading. */
  kind: ReaderJobKind | null;
  object: string | null;
  actions: readonly string[];
  /** The keyword job type (`anonymizedOpportunityDraft`), for depalletizing and for a job not yet read. */
  taskFamily: string;
  /** The category title shown until now ("Move materials"), used when the reading gives nothing better. */
  fallback: string;
}

/**
 * The job's title from what the video reading saw: "Scrape and scoop cake batter", "Stack cartons on pallets",
 * "Carry linen carts between places". The category title until a reading names the job, never a made-up task.
 */
export function jobHeadline({ kind, object, actions, taskFamily, fallback }: HeadlineInputs): string {
  const name = object?.trim() || null;
  const verbs = actions.map(action => ACTION_VERBS[action]).filter(Boolean).slice(0, 2);
  const withObject = (text: string) => name ? `${text}: ${name}` : text;
  switch (kind) {
    case "palletizing":
      if (taskFamily === "Depalletizing") return name ? `Take ${name} off pallets` : "Unload pallets";
      return name ? `Stack ${name} on pallets` : withObject(fallback);
    case "machine_tending":
      return name ? `Load and unload ${name} at a machine` : "Load or unload a machine";
    case "transport":
      return name ? `Carry ${name} between places` : "Go between places";
    case "pick_and_place":
      if (!name) return fallback;
      // The keyword type is a narrower case of picking and placing, so its own verb says more.
      if (taskFamily === "Case packing") return `Pack ${name} into cases`;
      if (taskFamily === "Packaging") return `Pack ${name}`;
      if (taskFamily === "Quality inspection") return `Inspect ${name}`;
      return `Pick and place ${name}`;
    case "other":
      if (verbs.length && name) return capitalized(`${verbs.join(" and ")} ${name}`);
      return withObject(fallback);
    default:
      return withObject(fallback);
  }
}

/** The public label for each kind the video reading can give: a category, never the site's words or its object. */
export const PUBLIC_KIND_LABELS: Readonly<Record<ReaderJobKind, string>> = {
  pick_and_place: "Pick and place job", palletizing: "Palletizing job", machine_tending: "Machine tending job",
  transport: "Moving things between places", other: "Other hands-on job",
};
const GENERIC_CATEGORY_TITLES = new Set(["Automation job"]);
const CATEGORY_KINDS: Readonly<Record<string, ReaderJobKind>> = {
  Palletizing: "palletizing", Depalletizing: "palletizing", "Pallet handling": "palletizing", "Machine tending": "machine_tending",
  "Material handling": "pick_and_place", "Case packing": "pick_and_place", Packaging: "pick_and_place",
  "Dish handling": "pick_and_place", "Quality inspection": "pick_and_place",
};

/**
 * A live job's kind as anyone may read it on /jobs (owner, 2026-11-23): the keyword category ("Palletize cartons") when
 * it is specific and the video reading agrees with it, else the reading's kind ("Pick and place job"), else the category.
 * Only fixed words: never the site's sentence, its object or anything the video shows of the site.
 */
export function publicJobKind(input: { taskFamily: string; categoryTitle: string; readerKind: ReaderJobKind | null;
  categoryKinds?: readonly ReaderJobKind[] }): { kind: string; kindKey: ReaderJobKind } {
  const specific = !GENERIC_CATEGORY_TITLES.has(input.categoryTitle) && input.taskFamily !== "Other";
  const agrees = input.readerKind !== null && (input.categoryKinds ?? []).includes(input.readerKind);
  if (input.readerKind && !(specific && agrees)) return { kind: PUBLIC_KIND_LABELS[input.readerKind], kindKey: input.readerKind };
  return { kind: input.categoryTitle, kindKey: input.readerKind ?? CATEGORY_KINDS[input.taskFamily] ?? "other" };
}

/** One line of the fit summary: the site's own answer, "Not sure", or "Not stated". */
export interface FitSummaryRow {
  /** The catalog question, the object, or a row of the job's brief by its id (`brief:<id>`, `client/src/lib/jobBrief.ts`). */
  key: JobFactKey | "object" | `brief:${string}`;
  label: string;
  /** The site's answer in words; for the object row, the video reading's name. Null when not stated. */
  value: string | null;
  state: "stated" | "unsure" | "not_stated" | "from_video";
  /** The site did not answer, and Blueprint's estimate of it is in the object facts below. */
  estimateBelow?: boolean;
  /**
   * Where a row of the job's brief takes its value from (`jobBriefFitSummary`): the site's answer, Blueprint's estimate
   * from the video reading (said "estimated from the video"), or the site's own sentence. Absent on the catalog's rows.
   */
  source?: "site" | "video_estimate" | "site_sentence";
}

export const NOT_STATED = "Not stated";
export const NOT_SURE = "Not sure";
export const ESTIMATE_BELOW = "Blueprint's estimate is below";

/** The row naming the job's object from the video reading, with the other items it suggests; null without a name. */
export function fitObjectRow(reading: Pick<JobReading, "object" | "others"> | null | undefined): FitSummaryRow | null {
  if (!reading?.object) return null;
  const others = reading.others.length ? ` (the video suggests ${reading.others.join(", ")} too)` : "";
  return { key: "object", label: "Object", value: `${reading.object}${others}`, state: "from_video" };
}

/**
 * The facts a company decides "worth a conversation" on, in a fixed order it can scan like a load post: the object
 * from the video, then each question the site's page asked (chosen the same way, `jobFactKeysFor`), with any other
 * answer the site gave after them. A question the site skipped says "Not stated" rather than disappearing, since rate
 * and hours are also the baseline a success rule needs. These are the catalog's rows: a job whose brief can be shown
 * gets its brief's rows instead (`jobBriefFitSummary`), and this is its fallback.
 */
export function fitSummary(facts: unknown, taskFamily: string, reading: Pick<JobReading, "kind" | "object" | "others"> | null,
  estimated: ReadonlySet<JobFactKey> = new Set()): FitSummaryRow[] {
  const answers = sanitizeJobFacts(facts);
  const asked = jobFactKeysFor(taskFamily, reading);
  const extra = JOB_FACT_KEYS.filter(key => !asked.includes(key) && answers?.[key] && answers[key] !== "unsure");
  const object = fitObjectRow(reading);
  const rows: FitSummaryRow[] = object ? [object] : [];
  for (const key of [...asked, ...extra]) {
    const code = answers?.[key];
    const label = JOB_FACT_SHORT_LABELS[key];
    if (code === "unsure") rows.push({ key, label, value: null, state: "unsure", ...(estimated.has(key) ? { estimateBelow: true } : {}) });
    else if (code && jobFactLabel(key, code)) rows.push({ key, label, value: jobFactLabel(key, code), state: "stated" });
    else rows.push({ key, label, value: null, state: "not_stated", ...(estimated.has(key) ? { estimateBelow: true } : {}) });
  }
  return rows;
}

/** The short line in the title's meta: how often and how long, when the site said. */
export function rateInWords(facts: unknown): string[] {
  const answers = sanitizeJobFacts(facts);
  const words: string[] = [];
  const perHour = answers?.perHour && answers.perHour !== "unsure" ? jobFactLabel("perHour", answers.perHour) : null;
  if (perHour) words.push(`${perHour} times an hour`);
  const hours = answers?.hours && answers.hours !== "unsure" ? jobFactLabel("hours", answers.hours) : null;
  if (hours) words.push(hours);
  return words;
}

/** Said once above the visit list: true of every packet. */
export const NOTHING_TESTED_AT_SITE = "Nothing here was tested at the site, and no robot's safety was assessed there.";

/**
 * What a first site visit must still confirm, for each kind of job: five to seven items from the integrators' own
 * request-for-quote and site-survey checklists (dbr77, Patti Engineering, Locus, OTTO Motors, Yaskawa Motoman), in
 * place of the long list of what the packet does not show.
 */
export const VISIT_MUST_CONFIRM: Readonly<Record<ReaderJobKind, readonly string[]>> = {
  pick_and_place: [
    "Where items are picked from and placed, and the height of each.",
    "Every item the job handles, including the largest, the heaviest and the most fragile.",
    "Floor space around the job and the ceiling height.",
    "Power and network at the job.",
    "Any machine or system the robot must signal or connect to.",
    "Who works nearby, any guarding already in place and the site's safety rules.",
    "The way in for the equipment, from the entrance to the job.",
  ],
  palletizing: [
    "How pallets arrive, where they are staged and how full ones leave.",
    "How cases arrive at the busiest time, and the height of the conveyor or table they arrive on.",
    "Every product and stack pattern the cell must handle.",
    "Floor space around the cell and the ceiling height.",
    "Power and network at the cell.",
    "Who works nearby, any guarding already in place and the site's safety rules.",
    "The way in for the equipment, from the entrance to the job.",
  ],
  machine_tending: [
    "The machine's door and controls: whether it opens by itself, and which signals a robot can use.",
    "How parts arrive and leave the machine: trays, fixtures or a conveyor.",
    "Every part the machine runs, and how often it changes over.",
    "Floor space in front of the machine, with access kept for operators and maintenance.",
    "Power, compressed air and network at the machine.",
    "Who works nearby, any guarding already in place and the site's safety rules.",
  ],
  transport: [
    "The route: doorways, aisle widths, ramps, lifts and the floor surface.",
    "Wi-Fi coverage along the whole route.",
    "People and forklift traffic on the route.",
    "Where loads are picked up and dropped off, and at what height.",
    "Space and power for charging.",
    "Any door, lift or site system the robot must work with.",
  ],
  other: [
    "The work area: its size, and what could be moved to suit a robot.",
    "How much the work changes from day to day.",
    "The environment: temperature, moisture, washdown and any food-safety rules.",
    "Power and network at the job.",
    "Who works nearby and the site's safety rules.",
  ],
};

/** The keyword job types, as the kind whose visit list fits them, until a reading gives a kind. */
const KIND_OF_JOB_TYPE: Readonly<Record<string, ReaderJobKind>> = {
  Palletizing: "palletizing", Depalletizing: "palletizing", "Pallet handling": "palletizing",
  "Machine tending": "machine_tending", "Material handling": "pick_and_place", "Case packing": "pick_and_place",
  Packaging: "pick_and_place", "Dish handling": "pick_and_place", "Quality inspection": "pick_and_place",
};

export function visitMustConfirm(kind: ReaderJobKind | null, taskFamily: string): readonly string[] {
  return VISIT_MUST_CONFIRM[kind ?? KIND_OF_JOB_TYPE[taskFamily] ?? "other"];
}

/** Where the job's simulation stands (`libraryJobStage`), said in the box instead of leaving it empty. */
export const SIMULATION_STATUS = {
  no_video: "The simulation is built from the site's video, which has not arrived yet.",
  video_received: "The video has arrived. The simulation has not started yet.",
  simulation_building: "The simulation is being built from the site's video.",
  simulation_built: "The simulation is built. Its download is being prepared.",
  unknown: "The simulation of the site is not finished yet.",
} as const;

/** Where the first look stands, when it has nothing to show yet. */
export const FIRST_LOOK_STATUS = {
  no_video: "Our first look comes once the site's video arrives.",
  reading: "The video is being read. Our first look follows.",
  unknown: "Our first look is not ready yet.",
} as const;

/** Said for a job whose site has not said what counts as done. */
export const NO_SUCCESS_RULE = "The site has not said what counts as done yet.";

/**
 * Said beside the download when the Pipeline says the package is the site's room without the job's object
 * (`object_included: false`). The two tested answers stay: a company can test in the site's room with a stand-in of its
 * own, sized from the facts about the object, and a tested answer says what it tested.
 */
export const SIMULATION_WITHOUT_OBJECT = "This simulation is the site's room without the job's object in it. To test the job, "
  + "add a stand-in of your own, sized from the facts about the object below, and say what you tested in your answer.";

/** Said while the facts about the job's object are being checked for names and contact details before they are shown. */
export const PACKET_FACTS_PENDING = "The facts about the object are being checked for names and contact details. They appear here once that is done.";

/** About the site, without anything that identifies it. */
export const SITE_IDENTITY_RULE = "The site's name, street address and contact details come only with an introduction the site asks for.";

/** "Answers questions from companies here, usually within 3 hours." from the median of the site's answer times. */
export function answerSpeedInWords(hours: number | null): string | null {
  if (hours === null || !Number.isFinite(hours) || hours < 0) return null;
  if (hours <= 1) return "Answers questions from companies here, usually within an hour.";
  if (hours < 24) return `Answers questions from companies here, usually within ${Math.ceil(hours)} hours.`;
  const days = Math.ceil(hours / 24);
  return `Answers questions from companies here, usually within ${days === 1 ? "a day" : `${days} days`}.`;
}
