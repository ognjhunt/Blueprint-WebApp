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
/** The one line under the At a glance rows that names the questions the site skipped. */
export const NOT_STATED_YET = `${NOT_STATED} yet:`;

/** A row's value as the job page and the job summary show it: the answer, else "Not sure" or "Not stated". */
export function fitRowValue(row: FitSummaryRow): string {
  return row.value ?? (row.state === "unsure" ? NOT_SURE : NOT_STATED);
}

/**
 * Whether the At a glance rows hold an answer of the site's, stated or "Not sure", so that the job page and the job
 * summary say under them that Blueprint has not checked the site's answers (`SITE_ANSWERS_HINT`). Words quoted from the
 * site's sentence are marked "(the site's words)" on their own row and are not answers: rows of only those and of
 * Blueprint's estimates carry no such line.
 */
export function fitRowsHoldSiteAnswers(rows: readonly FitSummaryRow[]): boolean {
  return rows.some(row => (row.state === "stated" || row.state === "unsure") && row.source !== "site_sentence");
}

/** The marks after a row's value, each with its own leading space or dot: where it came from, and an estimate below. */
export function fitRowMarks(row: FitSummaryRow): string[] {
  const marks: string[] = [];
  if (row.state === "from_video") marks.push(row.source === "video_estimate" ? " (estimated from the video)" : " (from the video)");
  if (row.source === "site_sentence") marks.push(" (the site's words)");
  if (row.estimateBelow) marks.push(` · ${ESTIMATE_BELOW}`);
  return marks;
}

/**
 * The At a glance rows split as the job page and the job summary show them: each answer and each "Not sure" as a row,
 * and the questions the site skipped named on one line (`NOT_STATED_YET`), unless Blueprint estimated one.
 */
export function fitRowsShown(rows: readonly FitSummaryRow[]): { shown: FitSummaryRow[]; skipped: FitSummaryRow[] } {
  const skipped = rows.filter(row => row.state === "not_stated" && !row.estimateBelow);
  return { shown: rows.filter(row => !skipped.includes(row)), skipped };
}

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
  // The job ended with nothing built and nothing coming (it failed, or stopped at the job's cap or its time): "not
  // finished yet" would promise more (outreach audit D7, 2026-11-27).
  no_simulation: "There is no simulation for this job.",
  unknown: "The simulation of the site is not finished yet.",
} as const;

/**
 * Said beside the download when the Pipeline says the package is the site's room without the job's object
 * (`object_included: false`): what the download holds, and nothing more. No answer asks what a company tested (owner,
 * 2026-11-25: the tested answers are gone).
 */
export const SIMULATION_WITHOUT_OBJECT = "This simulation is the site's room without the job's object in it.";

/** Said while the facts about the job's object are being checked for names and contact details before they are shown. */
export const PACKET_FACTS_PENDING = "The facts about the object are being checked for names and contact details. They appear here once that is done.";

/** About the site, without anything that identifies it. */
export const SITE_IDENTITY_RULE = "The site's name, street address and contact details come only with an introduction the site asks for.";

/** The headings of the company's job page, which the job summary repeats. */
export const JOB_PAGE_HEADINGS = {
  job: "The job, in the site's words",
  done: "What counts as done",
  glance: "At a glance",
  object: "The object, and how sure we are",
  measured: "Measured",
  estimated: "Estimated",
  video: "The video",
  visit: "What a visit must confirm",
} as const;

/** Said in place of the site's sentence while it cannot be shown. */
export const SITE_DESCRIPTION_CANT_BE_SHOWN = "The site's description can't be shown right now.";
/** Under the site's quick answers: they are its own statements. */
export const SITE_ANSWERS_HINT = "The site's own answers. Blueprint has not checked them.";
/** Said while the sound-free copy of the site's video is not ready. */
export const VIDEO_PREPARING = "The video is being prepared.";
export const SIMULATION_NOT_FINISHED = "The simulation of the site is not finished yet.";
/** Under the simulation's buttons once its download is ready. */
export const SIMULATION_DOWNLOAD_HINT = "A 3D simulation of the site, to test in your own tools. Open scene.usda first; the README inside explains each file.";

/** The day the job was shared, as the page's title line says it ("Shared November 12, 2026"); "" without a date. */
export function sharedOnInWords(iso: string): string {
  const date = new Date(iso);
  return iso && !Number.isNaN(date.getTime())
    ? `Shared ${date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" })}` : "";
}

/**
 * The simulation's download button, with the package's size in whole megabytes (1,000,000 bytes, as the job console
 * counts them) when the page knows it: "Download the simulation (170 MB)". A package under half a megabyte says so.
 */
export const SIMULATION_DOWNLOAD_LABEL = "Download the simulation";
export function simulationDownloadLabel(sizeBytes?: number | null): string {
  if (typeof sizeBytes !== "number" || !Number.isFinite(sizeBytes) || sizeBytes <= 0) return SIMULATION_DOWNLOAD_LABEL;
  const megabytes = Math.round(sizeBytes / 1_000_000);
  return `${SIMULATION_DOWNLOAD_LABEL} (${megabytes < 1 ? "under 1" : megabytes} MB)`;
}

/**
 * The job summary (owner, 2026-11-25: "isnt the whole job packet available to download?"): a PDF of what the job page
 * shows in words, for a company to forward inside its own team (`server/utils/companyJobSummary.ts`). The video stays
 * on the page, and so does the simulation, which has its own download.
 */
export const JOB_SUMMARY_DOWNLOAD_LABEL = "Download the job summary (PDF)";
export const JOB_SUMMARY_FOOTER = "From Blueprint. The site's own answers are not checked by Blueprint.";
export const JOB_SUMMARY_UNAVAILABLE = "The job summary could not be downloaded. Try again.";

/**
 * A job's short reference for a file name: the first eight letters or digits of its id after any word prefix
 * ("capture-", "itest-"). The id is Blueprint's own and already in the job page's address, so it names nothing of the site.
 */
export function shortJobRef(jobId: string): string {
  return jobId.replace(/^[A-Za-z]+[-_]/, "").replace(/[^A-Za-z0-9]/g, "").slice(0, 8).toLowerCase() || "job";
}
/** The name the job summary is saved under: `job-summary-<short job ref>.pdf`. */
export function jobSummaryFileName(jobId: string): string {
  return `job-summary-${shortJobRef(jobId)}.pdf`;
}

/** "Answers questions from companies here, usually within 3 hours." from the median of the site's answer times. */
export function answerSpeedInWords(hours: number | null): string | null {
  if (hours === null || !Number.isFinite(hours) || hours < 0) return null;
  if (hours <= 1) return "Answers questions from companies here, usually within an hour.";
  if (hours < 24) return `Answers questions from companies here, usually within ${Math.ceil(hours)} hours.`;
  const days = Math.ceil(hours / 24);
  return `Answers questions from companies here, usually within ${days === 1 ? "a day" : `${days} days`}.`;
}
