/**
 * The job brief: the "At a glance" rows chosen for one job (owner, 2026-11-25: "shouldnt this section be more
 * adaptive/custom to the job? many of these seem hard-coded and not specific to this job").
 *
 * A small text model reads what Blueprint already holds about the job (the site's sentence and success rule, the video
 * reading's kind, object, other items and which estimates it made, the site's quick answers and the catalog of quick
 * questions) and names three to six facts that most decide whether a deployment company can do THIS job, each with the
 * one place its value comes from (`server/agents/tasks/job-brief.ts`, `server/utils/jobBrief.ts`). It never writes a
 * value. Every value a company reads is written by the code here, from evidence on the job record:
 *
 * - `site_answer`: the site's answer to a catalog quick question, in the catalog's own words (`jobFactLabel`);
 * - `video_estimate`: Blueprint's estimate from the video reading, formatted from its stored numbers and marked
 *   "estimated from the video";
 * - `site_sentence`: a few words quoted from the site's own sentence, shown only while they still are in it;
 * - `ask_site`: a question of the brief's own, asked on the site's job page with "Not sure" added; the choice the site
 *   tapped, else "Not stated".
 *
 * The model's words (labels, questions, choices) and the site's quoted words are screened for the site's identity, as
 * every model reading of the site's video and sentence is, before a company reads them (`server/utils/companyJobPage.ts`).
 * A brief with fewer than three rows that can be shown is not used: the catalog's rows are shown instead
 * (`fitSummary` in `companyJobPage.ts`).
 */
import { z } from "zod";
import type { FitSummaryRow } from "./companyJobPage";
import {
  CUSTOM_JOB_FACT_CHOICES_MAX, CUSTOM_JOB_FACT_ID, JOB_FACT_KEYS, JOB_FACT_SHORT_LABELS, NOT_SURE_LABEL, isJobFactKey,
  jobFactLabel, sanitizeJobFacts, type JobFactKey, type JobFacts,
} from "./jobFacts";

export const JOB_BRIEF_SCHEMA_VERSION = "job_brief.v1";
/** The fewest rows a brief must show to be used, and the most it may hold. */
export const JOB_BRIEF_MIN_ROWS = 3;
export const JOB_BRIEF_MAX_ROWS = 6;
export const JOB_BRIEF_LABEL_MAX = 40;
export const JOB_BRIEF_QUESTION_MAX = 120;
export const JOB_BRIEF_CHOICE_MAX = 40;
export const JOB_BRIEF_QUOTE_MAX = 200;
export const JOB_BRIEF_CHOICES_MIN = 2;
export const JOB_BRIEF_CHOICES_MAX = CUSTOM_JOB_FACT_CHOICES_MAX;
/** A row's id: snake_case, at most 32 characters (the key of its answer under `job_facts.custom`). */
export const JOB_BRIEF_ID = CUSTOM_JOB_FACT_ID;

/**
 * The video reading's numeric and closed-list estimates a row may name (`job_estimates` in
 * `server/agents/tasks/site-video-evidence.ts`). Never the free-text ones (the object's name, other items, the basis).
 */
export const JOB_BRIEF_ESTIMATE_FIELDS = ["object_largest_side_m", "object_mass_kg_low", "object_mass_kg_high", "object_surface",
  "pick_to_place_m", "pick_height_m", "place_height_m", "front_clearance_m", "cycle_seconds"] as const;
export type JobBriefEstimateField = (typeof JOB_BRIEF_ESTIMATE_FIELDS)[number];

/** Where a row's value comes from. The model names one; it never writes the value. */
export const JOB_BRIEF_EVIDENCE = ["site_answer", "video_estimate", "site_sentence", "ask_site"] as const;
export type JobBriefEvidence = (typeof JOB_BRIEF_EVIDENCE)[number];

export type JobBriefRow = { id: string; label: string } & (
  | { evidence: "site_answer"; answer_key: JobFactKey }
  | { evidence: "video_estimate"; estimate_fields: JobBriefEstimateField[] }
  | { evidence: "site_sentence"; quote: string }
  | { evidence: "ask_site"; question: string; choices: string[] });

/** The brief as the job record stores it (`job_brief`): its rows, when they were written and from which inputs. */
export interface StoredJobBrief {
  schemaVersion: typeof JOB_BRIEF_SCHEMA_VERSION;
  rows: JobBriefRow[];
  generatedAtIso: string;
  /** The digest of the inputs it was written from (`jobBriefDigest` in `server/utils/jobBrief.ts`); a changed input is a new brief. */
  inputDigest: string;
}

/* ---------------------------------------------------------------------------------------------- words it may not use */

/** Money, in any form: the packet states no price and asks nothing about a budget. */
const MONEY = /[$€£¥]|\b(?:prices?|priced|pricing|costs?|costing|budgets?|money|pay|pays|paying|paid|payments?|dollars?|euros?|fees?|quotes?|quoted|quotation|invoices?|roi|payback|return on investment|wages?|salar(?:y|ies)|afford\w*|cheap\w*|expensive|spend\w*|spent|capex|opex|financ\w*|funding|leas(?:e|ed|ing)|rent(?:s|al|ed|ing)?|subscriptions?|purchase\w*|buy(?:s|ing)?|bought)\b/i;
/** The site's identity or a way to reach anyone: a company reads none of it before an introduction the site asks for. */
const IDENTITY = /@|https?:|\bwww\.|\b(?:names?|named|surnames?|address(?:es)?|street|phone|telephone|mobile number|e-?mails?|contacts?|contacted|contacting|website|url|zip|postcode|postal|whatsapp|linkedin|instagram|facebook|twitter|your company|company name|business name|who are you)\b/i;
/** Makers and models of robots: the brief describes the job, never a robot. */
const ROBOT_BRANDS = /\b(?:universal robots|ur ?(?:3|5|10|16|20|30)e?|fanuc|abb|kuka|yaskawa|motoman|kawasaki|denso|epson|st[aä]ubli|nachi|omron|doosan|techman|franka|kinova|rethink|sawyer|baxter|boston dynamics|agility robotics|tesla|optimus|unitree|apptronik|sanctuary ai|figure ai|1x technologies|fetch robotics|locus robotics|otto motors|clearpath|vecna|pickle robot|dexterity|covariant|formic|ocado|geek\+|geekplus|hai robotics|exotec|autostore|berkshire grey|plus one robotics|mujin|osaro|righthand robotics|symbotic|amazon robotics|flexiv|aubo|jaka|dobot|ufactory|xarm|hello robot|ubtech|agibot|galbot)\b/i;

/** Why words may not be in a brief, or null when they may: money, the site's identity or contact details, a robot's make. */
export function jobBriefWordsRefused(text: string): "money" | "identity" | "robot_brand" | null {
  if (MONEY.test(text)) return "money";
  if (IDENTITY.test(text)) return "identity";
  if (ROBOT_BRANDS.test(text)) return "robot_brand";
  return null;
}

/* ------------------------------------------------------------------------------------------------ the row's shape */

const oneLine = (max: number) => z.string().transform(text => text.replace(/\s+/g, " ").trim()).pipe(z.string().min(1).max(max));
const jobBriefRowSchema = z.discriminatedUnion("evidence", [
  z.object({ evidence: z.literal("site_answer"), answer_key: z.string() }),
  z.object({ evidence: z.literal("video_estimate"), estimate_fields: z.array(z.string()).min(1).max(JOB_BRIEF_ESTIMATE_FIELDS.length * 2) }),
  z.object({ evidence: z.literal("site_sentence"), quote: oneLine(JOB_BRIEF_QUOTE_MAX) }),
  z.object({ evidence: z.literal("ask_site"), question: oneLine(JOB_BRIEF_QUESTION_MAX),
    choices: z.array(z.string()).min(JOB_BRIEF_CHOICES_MIN).max(JOB_BRIEF_CHOICES_MAX + 2) }),
]).and(z.object({ id: z.string().regex(JOB_BRIEF_ID), label: oneLine(JOB_BRIEF_LABEL_MAX) }));

/** A choice the code adds itself: the site's page always offers "Not sure". */
const NOT_SURE_LIKE = /^(?:not sure|unsure|don'?t know|do not know|unknown|n\/a|other)$/i;
const folded = (text: string) => text.replace(/\s+/g, " ").trim().toLowerCase();

/**
 * Whether a quote is in the site's sentence as it is stored now: case aside, and any run of spaces read as one. A quote
 * the sentence no longer holds (the site changed it, or the model reworded it) is never shown.
 */
export function quoteInSentence(quote: string, sentence: string): boolean {
  const needle = folded(quote);
  return needle.length >= 3 && folded(sentence).includes(needle);
}

/**
 * One row as the brief may hold it, or null. Every check is plain code: a snake_case id of at most 32 characters, a
 * one-line label of at most 40 characters with no figure in it (a label names a fact; the value is the code's), no
 * money, identity or robot make in any of the model's words, a catalog key the catalog has, estimate fields from the
 * reading's own list (and, when `context.estimates` is given, only those the reading made), a quote the site's sentence
 * holds (when `context.sentence` is given), and a question of at most 120 characters with two to four distinct choices
 * of at most 40 characters, "Not sure" aside (the code adds it).
 */
export function sanitizeJobBriefRow(raw: unknown, context: { sentence?: string; estimates?: ReadonlySet<JobBriefEstimateField> } = {}):
  JobBriefRow | null {
  const parsed = jobBriefRowSchema.safeParse(raw);
  if (!parsed.success) return null;
  const row = parsed.data;
  if (/\p{N}/u.test(row.label) || jobBriefWordsRefused(row.label)) return null;
  const base = { id: row.id, label: row.label };
  switch (row.evidence) {
    case "site_answer":
      return isJobFactKey(row.answer_key) ? { ...base, evidence: "site_answer", answer_key: row.answer_key } : null;
    case "video_estimate": {
      const known = [...new Set(row.estimate_fields)].filter((field): field is JobBriefEstimateField =>
        (JOB_BRIEF_ESTIMATE_FIELDS as readonly string[]).includes(field) && (!context.estimates || context.estimates.has(field as JobBriefEstimateField)));
      return known.length ? { ...base, evidence: "video_estimate", estimate_fields: known } : null;
    }
    case "site_sentence":
      if (jobBriefWordsRefused(row.quote) === "money" || jobBriefWordsRefused(row.quote) === "robot_brand") return null;
      if (context.sentence !== undefined && !quoteInSentence(row.quote, context.sentence)) return null;
      return { ...base, evidence: "site_sentence", quote: row.quote };
    case "ask_site": {
      if (jobBriefWordsRefused(row.question)) return null;
      const choices: string[] = [];
      for (const choice of row.choices) {
        const text = typeof choice === "string" ? choice.replace(/\s+/g, " ").trim() : "";
        if (!text || text.length > JOB_BRIEF_CHOICE_MAX || jobBriefWordsRefused(text)) return null;
        if (NOT_SURE_LIKE.test(text) || choices.some(other => folded(other) === folded(text))) continue;
        choices.push(text);
      }
      return choices.length >= JOB_BRIEF_CHOICES_MIN && choices.length <= JOB_BRIEF_CHOICES_MAX
        ? { ...base, evidence: "ask_site", question: row.question, choices } : null;
    }
  }
}

/**
 * The rows of a model's answer, or of a stored brief, that may be used: each one checked (`sanitizeJobBriefRow`), the
 * first of any repeated id and the first row for each catalog question kept, at most six, in the model's order.
 */
export function sanitizeJobBriefRows(raw: unknown, context: { sentence?: string; estimates?: ReadonlySet<JobBriefEstimateField> } = {}):
  JobBriefRow[] {
  if (!Array.isArray(raw)) return [];
  const rows: JobBriefRow[] = [];
  for (const item of raw.slice(0, JOB_BRIEF_MAX_ROWS * 3)) {
    if (rows.length >= JOB_BRIEF_MAX_ROWS) break;
    const row = sanitizeJobBriefRow(item, context);
    if (!row || rows.some(other => other.id === row.id)) continue;
    if (row.evidence === "site_answer" && rows.some(other => other.evidence === "site_answer" && other.answer_key === row.answer_key)) continue;
    rows.push(row);
  }
  return rows;
}

/** A stored `job_brief`, or null when it is not one: its rows checked again, as any stored value is untrusted. */
export function sanitizeStoredJobBrief(value: unknown): StoredJobBrief | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (raw.schemaVersion !== JOB_BRIEF_SCHEMA_VERSION || typeof raw.inputDigest !== "string" || !/^[a-f0-9]{64}$/.test(raw.inputDigest)) return null;
  const generatedAtIso = typeof raw.generatedAtIso === "string" && !Number.isNaN(Date.parse(raw.generatedAtIso)) ? raw.generatedAtIso : "";
  return { schemaVersion: JOB_BRIEF_SCHEMA_VERSION, rows: sanitizeJobBriefRows(raw.rows), generatedAtIso, inputDigest: raw.inputDigest };
}

/* ------------------------------------------------------------------------------------------- values, written by code */

/** The video reading's estimates in SI, as the server reads them from the stored reading (`videoEvidence` in `siteRobotFit.ts`). */
export interface JobBriefEstimates {
  largestSideM: number | null;
  massKg: { low: number; high: number } | null;
  surface: "matte" | "shiny" | "transparent" | "mixed" | null;
  pickToPlaceM: number | null;
  pickHeightM: number | null;
  placeHeightM: number | null;
  frontClearanceM: number | null;
  cycleSeconds: number | null;
}

/** The estimate fields the reading made, for the model's input and for checking its answer. */
export function estimateFieldsMade(estimates: JobBriefEstimates | null | undefined): JobBriefEstimateField[] {
  if (!estimates) return [];
  const made: Array<[JobBriefEstimateField, boolean]> = [
    ["object_largest_side_m", estimates.largestSideM !== null], ["object_mass_kg_low", estimates.massKg !== null],
    ["object_mass_kg_high", estimates.massKg !== null], ["object_surface", estimates.surface !== null],
    ["pick_to_place_m", estimates.pickToPlaceM !== null], ["pick_height_m", estimates.pickHeightM !== null],
    ["place_height_m", estimates.placeHeightM !== null], ["front_clearance_m", estimates.frontClearanceM !== null],
    ["cycle_seconds", estimates.cycleSeconds !== null],
  ];
  return made.filter(([, present]) => present).map(([field]) => field);
}

/** A length as a site says it: centimetres below a metre, metres with one decimal above (as `lengthText` on the server). */
const length = (metres: number) => metres < 1 ? `${Math.round(metres * 100)} cm` : `${Number(metres.toFixed(1))} m`;
/** A weight, or a range of weights: grams below a kilogram, one decimal below ten kilograms, whole kilograms above. */
function weight(low: number, high: number): string {
  const grams = high < 1;
  const figure = (kg: number) => grams ? String(Math.round(kg * 1000)) : kg < 10 ? String(Number(kg.toFixed(1))) : String(Math.round(kg));
  const [from, to] = [figure(low), figure(high)];
  return `about ${from === to ? from : `${from} to ${to}`} ${grams ? "g" : "kg"}`;
}
const SURFACE_WORDS: Readonly<Record<NonNullable<JobBriefEstimates["surface"]>, string>> = {
  matte: "matte surface", shiny: "shiny surface", transparent: "transparent", mixed: "mixed surfaces",
};

/**
 * The estimates a row names, in fixed words and a fixed order, from the stored numbers: "About 45 cm on its longest
 * side, about 8 to 11 kg". Only fields the reading made are said; null when it made none of them (the row is then not
 * shown). Never a number the reading did not give.
 */
export function estimateInWords(fields: readonly JobBriefEstimateField[], estimates: JobBriefEstimates | null | undefined): string | null {
  if (!estimates) return null;
  const named = new Set(fields);
  const parts: string[] = [];
  if (named.has("object_largest_side_m") && estimates.largestSideM !== null) parts.push(`about ${length(estimates.largestSideM)} on its longest side`);
  if ((named.has("object_mass_kg_low") || named.has("object_mass_kg_high")) && estimates.massKg)
    parts.push(weight(estimates.massKg.low, estimates.massKg.high));
  if (named.has("object_surface") && estimates.surface) parts.push(SURFACE_WORDS[estimates.surface]);
  if (named.has("pick_to_place_m") && estimates.pickToPlaceM !== null) parts.push(`moved about ${length(estimates.pickToPlaceM)}`);
  if (named.has("pick_height_m") && estimates.pickHeightM !== null)
    parts.push(estimates.pickHeightM === 0 ? "picked up from the floor" : `picked up about ${length(estimates.pickHeightM)} above the floor`);
  if (named.has("place_height_m") && estimates.placeHeightM !== null)
    parts.push(estimates.placeHeightM === 0 ? "put down on the floor" : `put down about ${length(estimates.placeHeightM)} above the floor`);
  if (named.has("front_clearance_m") && estimates.frontClearanceM !== null)
    parts.push(estimates.frontClearanceM === 0 ? "no open floor in front" : `about ${length(estimates.frontClearanceM)} of open floor in front`);
  if (named.has("cycle_seconds") && estimates.cycleSeconds !== null) parts.push(estimates.cycleSeconds < 120
    ? `about ${Math.round(estimates.cycleSeconds)} seconds a cycle` : `about ${Math.round(estimates.cycleSeconds / 60)} minutes a cycle`);
  if (!parts.length) return null;
  const text = parts.join(", ");
  return text[0].toUpperCase() + text.slice(1);
}

/**
 * The model's and the site's words in a brief that a company could read, each once, in row order: every label, every
 * quote and every choice of the brief's own questions (all of them, so one screening pass covers the brief whatever the
 * site taps). The server screens these for the site's identity before a company reads any.
 */
export function jobBriefWords(brief: StoredJobBrief): string[] {
  const words: string[] = [];
  const add = (text: string) => { if (!words.includes(text)) words.push(text); };
  for (const row of brief.rows) {
    add(row.label);
    if (row.evidence === "site_sentence") add(row.quote);
    if (row.evidence === "ask_site") row.choices.forEach(add);
  }
  return words;
}

/**
 * A brief row as a company reads it, or null when it cannot be shown. `shown` says whether a label, quote or choice
 * passed the screening (`jobBriefWords`). The value is never the model's: the site's answer in the catalog's words, the
 * estimate in fixed words from the stored numbers, the site's quoted words while the sentence still holds them, or the
 * choice the site tapped; "Not sure" and "Not stated" otherwise.
 */
function companyRow(row: JobBriefRow, inputs: JobBriefCompanyInputs, answers: JobFacts | null): FitSummaryRow | null {
  if (!inputs.shown(row.label)) return null;
  const key = `brief:${row.id}` as const;
  switch (row.evidence) {
    case "site_answer": {
      const code = answers?.[row.answer_key];
      const estimateBelow = inputs.estimated?.has(row.answer_key) ? { estimateBelow: true } : {};
      const base = { key: row.answer_key, label: row.label, source: "site" as const };
      if (code === "unsure") return { ...base, value: null, state: "unsure", ...estimateBelow };
      const label = code ? jobFactLabel(row.answer_key, code) : null;
      return label ? { ...base, value: label, state: "stated" } : { ...base, value: null, state: "not_stated", ...estimateBelow };
    }
    case "video_estimate": {
      const value = estimateInWords(row.estimate_fields, inputs.estimates);
      return value ? { key, label: row.label, value, state: "from_video", source: "video_estimate" } : null;
    }
    case "site_sentence":
      return quoteInSentence(row.quote, inputs.sentence) && inputs.shown(row.quote)
        ? { key, label: row.label, value: row.quote, state: "stated", source: "site_sentence" } : null;
    case "ask_site": {
      const answer = answers?.custom?.[row.id];
      const base = { key, label: row.label, source: "site" as const };
      if (answer === "unsure") return { ...base, value: null, state: "unsure" };
      if (typeof answer !== "number") return { ...base, value: null, state: "not_stated" };
      const choice = row.choices[answer];
      // A choice the site tapped that cannot be shown leaves the row out: never "Not stated" for an answer it gave.
      return choice !== undefined && inputs.shown(choice) ? { ...base, value: choice, state: "stated" } : null;
    }
  }
}

export interface JobBriefCompanyInputs {
  /** The site's stored quick answers (`job_facts`), with the brief's own under `custom`. */
  facts: unknown;
  /** The video reading's estimates, as stored. */
  estimates: JobBriefEstimates | null;
  /** The site's sentence as it is stored now, for the quotes. */
  sentence: string;
  /** The catalog questions whose Blueprint estimate the packet facts show (`packetFactsForCompany`). */
  estimated?: ReadonlySet<JobFactKey>;
  /** Whether screened words may be shown: a label, a quote or a choice. */
  shown: (words: string) => boolean;
  /** The row naming the job's object from the video reading, shown first as the catalog's rows show it. */
  objectRow?: FitSummaryRow | null;
}

/**
 * The fit summary from the job's brief, or null when fewer than three of its rows can be shown (the caller then shows
 * the catalog's rows, `fitSummary`). The object from the video first, as the catalog's rows have it; then the brief's
 * rows in its order; then any other catalog question the site answered (never "Not sure"), so no answer it gave is lost.
 */
export function jobBriefFitSummary(brief: StoredJobBrief | null, inputs: JobBriefCompanyInputs): FitSummaryRow[] | null {
  if (!brief) return null;
  const answers = sanitizeJobFacts(inputs.facts);
  const rows = brief.rows.map(row => companyRow(row, inputs, answers)).filter((row): row is FitSummaryRow => row !== null);
  if (rows.length < JOB_BRIEF_MIN_ROWS) return null;
  const asked = new Set(brief.rows.flatMap(row => row.evidence === "site_answer" ? [row.answer_key] : []));
  const extra = JOB_FACT_KEYS.filter(key => !asked.has(key) && answers?.[key] && answers[key] !== "unsure").flatMap(key => {
    const label = jobFactLabel(key, answers![key]!);
    return label ? [{ key, label: JOB_FACT_SHORT_LABELS[key], value: label, state: "stated" as const, source: "site" as const }] : [];
  });
  return [...(inputs.objectRow ? [inputs.objectRow] : []), ...rows, ...extra];
}

/**
 * The rows a brief would show without any screening, for the site's own page: whether the brief is used at all, so the
 * site is asked the brief's questions exactly when a company is shown the brief's rows (screening aside).
 */
export function jobBriefShowable(brief: StoredJobBrief | null, inputs: Pick<JobBriefCompanyInputs, "estimates" | "sentence">): boolean {
  if (!brief) return false;
  return (jobBriefFitSummary(brief, { ...inputs, facts: null, shown: () => true })?.length ?? 0) >= JOB_BRIEF_MIN_ROWS;
}

/* ------------------------------------------------------------------------------------- the questions the site is asked */

/** One question on the site's job page: a catalog question by its key, or one of the brief's own with its choices. */
export type JobBriefQuestion = { kind: "catalog"; key: JobFactKey } | { kind: "custom"; id: string; question: string; choices: string[] };

/** The questions a brief asks the site, in its order: the catalog questions it reads answers from, and its own. */
export function jobBriefQuestions(brief: StoredJobBrief): JobBriefQuestion[] {
  return brief.rows.flatMap((row): JobBriefQuestion[] => row.evidence === "site_answer" ? [{ kind: "catalog", key: row.answer_key }]
    : row.evidence === "ask_site" ? [{ kind: "custom", id: row.id, question: row.question, choices: [...row.choices] }] : []);
}

/** "Not sure", offered with every one of the brief's own questions. */
export const JOB_BRIEF_NOT_SURE = NOT_SURE_LABEL;

/** The brief's questions as the site's job page receives them: a short version to key the walk by, and the questions. */
export interface SiteJobBrief { version: string; questions: JobBriefQuestion[] }

/** The site's payload for a current brief (`siteJobBriefOf` on the server). */
export function siteJobBriefPayload(brief: StoredJobBrief): SiteJobBrief {
  return { version: brief.inputDigest.slice(0, 16), questions: jobBriefQuestions(brief) };
}

/** The status read's `jobBrief`, or null: a short version and well-formed questions only, as any payload is read. */
export function sanitizeSiteJobBrief(value: unknown): SiteJobBrief | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.version !== "string" || !/^[a-f0-9]{8,64}$/.test(raw.version) || !Array.isArray(raw.questions)) return null;
  const questions: JobBriefQuestion[] = [];
  for (const item of raw.questions.slice(0, JOB_BRIEF_MAX_ROWS)) {
    const question = item as Record<string, unknown> | null;
    if (question?.kind === "catalog" && isJobFactKey(question.key)) {
      if (!questions.some(other => other.kind === "catalog" && other.key === question.key)) questions.push({ kind: "catalog", key: question.key });
      continue;
    }
    if (question?.kind !== "custom") continue;
    const row = sanitizeJobBriefRow({ id: question.id, label: "Question", evidence: "ask_site", question: question.question, choices: question.choices });
    if (row?.evidence === "ask_site" && !questions.some(other => other.kind === "custom" && other.id === row.id))
      questions.push({ kind: "custom", id: row.id, question: row.question, choices: row.choices });
  }
  return { version: raw.version, questions };
}
