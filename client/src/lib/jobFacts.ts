/**
 * A few quick questions for the site (PACKAGE_E E1).
 *
 * Asked on the site's job page, one at a time. Every question has
 * "Not sure", and skipping never holds a job. The answers are stored on the job as `job_facts` with
 * exactly the codes below, and a deployment company reads them in the same words
 * (`jobFactsInWords`). The weight answer's upper bound turns a conditional first-look row into a
 * plain yes or no (`client/src/lib/firstLookWords.ts`).
 *
 * One list, read by the job page, the company's page, the save route and its tests.
 */

export const JOB_FACTS_HEADING = "A few quick questions help companies answer";
/** The one nudge, added to the site's email when a company answers "Need more details" (E1). */
export const JOB_FACTS_NUDGE = "A few quick answers on your job page may be all they need.";

const GENERAL_JOB_FACT_KEYS = ["weight", "size", "perHour", "hours", "timing"] as const;
export const JOB_FACT_KEYS = [...GENERAL_JOB_FACT_KEYS, "peakPerMinute", "maxLoadedWeightKg", "palletPattern",
  "incomingLoads", "pickupHandoff", "packPresentation", "itemsPerCase", "machineAccess", "machineCycleSeconds", "inspectionTarget",
  "route", "routeObstacles", "variation", "areaChange"] as const;
export type JobFactKey = (typeof JOB_FACT_KEYS)[number];

export const NOT_SURE_LABEL = "Not sure";
const unsure = [{ code: "unsure", label: NOT_SURE_LABEL }] as const;

export const JOB_FACT_NUMBERS: Partial<Record<JobFactKey, { unit: string; min: number; max: number; whole?: boolean }>> = {
  peakPerMinute: { unit: "items/min", min: 0.01, max: 1_000_000 },
  maxLoadedWeightKg: { unit: "kg", min: 0.001, max: 100_000 },
  itemsPerCase: { unit: "items/case", min: 1, max: 100_000, whole: true },
  machineCycleSeconds: { unit: "seconds", min: 0.01, max: 86_400 },
};

export const JOB_FACT_CHOICES = {
  weight: [
    { code: "under_5kg", label: "Under 5 kg (11 lb)" },
    { code: "5_15kg", label: "5 to 15 kg (11 to 33 lb)" },
    { code: "15_30kg", label: "15 to 30 kg (33 to 66 lb)" },
    { code: "over_30kg", label: "Over 30 kg (66 lb)" },
    { code: "unsure", label: NOT_SURE_LABEL },
  ],
  size: [
    { code: "under_30cm", label: "Under 30 cm (1 ft)" },
    { code: "30_60cm", label: "30 to 60 cm (1 to 2 ft)" },
    { code: "over_60cm", label: "Over 60 cm (2 ft)" },
    { code: "unsure", label: NOT_SURE_LABEL },
  ],
  perHour: [
    { code: "under_60", label: "Fewer than 60" },
    { code: "60_300", label: "60 to 300" },
    { code: "over_300", label: "More than 300" },
    { code: "unsure", label: NOT_SURE_LABEL },
  ],
  hours: [
    { code: "one_shift", label: "One shift" },
    { code: "two_shifts", label: "Two shifts" },
    { code: "around_the_clock", label: "Around the clock" },
    { code: "unsure", label: NOT_SURE_LABEL },
  ],
  timing: [
    { code: "asap", label: "As soon as possible" },
    { code: "3_months", label: "Within three months" },
    { code: "this_year", label: "This year" },
    { code: "just_looking", label: "Just looking" },
    { code: "unsure", label: NOT_SURE_LABEL },
  ],
  peakPerMinute: unsure,
  maxLoadedWeightKg: unsure,
  palletPattern: [
    { code: "fixed", label: "One stack pattern" },
    { code: "varies", label: "Changes by product or order" },
    { code: "flexible", label: "Any stable stack is fine" },
    ...unsure,
  ],
  incomingLoads: [
    { code: "uniform", label: "Same size and pattern" },
    { code: "varies_between", label: "Varies from pallet to pallet" },
    { code: "mixed", label: "Mixed sizes on the same pallet" },
    ...unsure,
  ],
  pickupHandoff: [
    { code: "fixed", label: "Fixed location" },
    { code: "conveyor", label: "Moving conveyor" },
    { code: "mobile", label: "Cart or mobile robot" },
    ...unsure,
  ],
  packPresentation: [
    { code: "fixed", label: "Same position each time" },
    { code: "mixed", label: "Position or orientation varies" },
    ...unsure,
  ],
  itemsPerCase: unsure,
  machineAccess: [
    { code: "open", label: "No door or lid to move" },
    { code: "automatic", label: "Machine opens it automatically" },
    { code: "operator", label: "An operator opens it" },
    { code: "robot", label: "Robot needs to open or close it" },
    ...unsure,
  ],
  machineCycleSeconds: unsure,
  inspectionTarget: [
    { code: "appearance", label: "Surface or appearance defects" },
    { code: "dimensions", label: "Size or shape" },
    { code: "assembly", label: "Missing or misaligned parts" },
    { code: "multiple", label: "Several of these" },
    ...unsure,
  ],
  route: [
    { code: "one_room", label: "Within one room" },
    { code: "one_floor", label: "Between rooms on one floor" },
    { code: "floors", label: "Between floors" },
    { code: "outdoors", label: "Outdoors or between buildings" },
    ...unsure,
  ],
  routeObstacles: [
    { code: "open", label: "Open floor only" },
    { code: "doors", label: "Doors" },
    { code: "lifts", label: "Lifts or elevators" },
    { code: "ramps", label: "Slopes or ramps" },
    { code: "several", label: "Several of these" },
    ...unsure,
  ],
  variation: [
    { code: "same", label: "Same every time" },
    { code: "set_kinds", label: "A few set kinds" },
    { code: "varies", label: "Different each time" },
    ...unsure,
  ],
  areaChange: [
    { code: "yes", label: "Yes" },
    { code: "a_little", label: "A little" },
    { code: "no", label: "No, it stays as it is" },
    ...unsure,
  ],
} as const satisfies Record<JobFactKey, ReadonlyArray<{ code: string; label: string }>>;

type NumericJobFactKey = "peakPerMinute" | "maxLoadedWeightKg" | "itemsPerCase" | "machineCycleSeconds";
export type JobFactCode<K extends JobFactKey> = (typeof JOB_FACT_CHOICES)[K][number]["code"]
  | (K extends NumericJobFactKey ? `${number}` : never) | (K extends "maxLoadedWeightKg" ? `${number}lb` : never);

export const KG_PER_LB = 0.45359237;
/** A number as the quick questions take it: up to seven digits, and up to three decimal places. */
const TYPED_NUMBER = /^\d{1,7}(?:\.\d{1,3})?$/;
/**
 * The heaviest load typed in pounds is stored as the site typed it, "44lb" (stress test, 2026-11-24: "44 lb" was shown as
 * "19.958 kg", a precision nobody gave); in kilograms, as the number. Older answers typed in pounds were stored converted.
 */
const POUNDS = /^(\d{1,7}(?:\.\d{1,3})?)lb$/;

/** A converted weight, rounded as a person would say it: whole kilograms from 10 kg, two significant figures below. */
const roughKg = (kg: number) => String(kg >= 10 ? Math.round(kg) : Number(kg.toPrecision(2)));

/**
 * The number a numeric answer means, in its question's unit (kilograms for the heaviest load, whatever unit the site
 * typed it in); null for a choice, "Not sure" or anything unknown.
 */
export function jobFactNumber(key: JobFactKey, code: unknown): number | null {
  if (!JOB_FACT_NUMBERS[key] || !isJobFactCode(key, code) || code === "unsure") return null;
  const pounds = key === "maxLoadedWeightKg" ? POUNDS.exec(code) : null;
  return pounds ? Number(pounds[1]) * KG_PER_LB : Number(code);
}

/** The answer as the site typed it, for its own number box: the number and its unit. Null for no typed number. */
export function typedJobFactNumber(key: JobFactKey, code: unknown): { value: string; unit: "lb" | "kg" | null } | null {
  if (!JOB_FACT_NUMBERS[key] || !isJobFactCode(key, code) || code === "unsure") return null;
  const pounds = key === "maxLoadedWeightKg" ? POUNDS.exec(code) : null;
  return pounds ? { value: pounds[1], unit: "lb" } : { value: code, unit: key === "maxLoadedWeightKg" ? "kg" : null };
}

const QUESTIONS_BY_JOB_TYPE: Readonly<Partial<Record<string, readonly JobFactKey[]>>> = {
  Palletizing: ["maxLoadedWeightKg", "peakPerMinute", "palletPattern", "hours", "timing"],
  Depalletizing: ["incomingLoads", "maxLoadedWeightKg", "peakPerMinute", "hours", "timing"],
  "Pallet handling": ["pickupHandoff", "maxLoadedWeightKg", "peakPerMinute", "hours", "timing"],
  "Material handling": ["pickupHandoff", "maxLoadedWeightKg", "peakPerMinute", "hours", "timing"],
  "Case packing": ["itemsPerCase", "packPresentation", "peakPerMinute", "hours", "timing"],
  Packaging: ["packPresentation", "peakPerMinute", "weight", "hours", "timing"],
  "Machine tending": ["machineAccess", "machineCycleSeconds", "weight", "hours", "timing"],
  "Quality inspection": ["inspectionTarget", "peakPerMinute", "hours", "timing"],
};

/** The questions for a job type the keyword match gave (`anonymizedOpportunityDraft`); the general five otherwise. */
export function jobFactKeysForType(taskFamily: string | undefined): readonly JobFactKey[] {
  return taskFamily && Object.hasOwn(QUESTIONS_BY_JOB_TYPE, taskFamily) ? QUESTIONS_BY_JOB_TYPE[taskFamily]! : GENERAL_JOB_FACT_KEYS;
}

/**
 * The kinds of job the video reading can give (`job_kind` in `server/agents/tasks/site-video-evidence.ts`). The reading
 * watched the job and read the site's description, so once it gives a kind, the kind decides the questions.
 */
export const READER_JOB_KINDS = ["pick_and_place", "palletizing", "machine_tending", "transport", "other"] as const;
export type ReaderJobKind = (typeof READER_JOB_KINDS)[number];

/**
 * The questions for each kind of job the reading gives. A job that moves between places is asked where it goes and
 * what is on the way; a job that does something other than carrying (folding, wiping, scraping batter) is asked
 * whether the work changes and whether its area can change, not a weight or a size.
 */
const QUESTIONS_BY_KIND: Readonly<Record<ReaderJobKind, readonly JobFactKey[]>> = {
  pick_and_place: GENERAL_JOB_FACT_KEYS,
  palletizing: QUESTIONS_BY_JOB_TYPE.Palletizing!,
  machine_tending: QUESTIONS_BY_JOB_TYPE["Machine tending"]!,
  transport: ["route", "routeObstacles", "weight", "perHour", "hours", "timing"],
  other: ["variation", "areaChange", "perHour", "hours", "timing"],
};

/**
 * The kinds each keyword job type is a narrower case of. Where the reading's kind agrees with the keyword match, the
 * keyword's own questions stay (a case packing job is asked how many items go in a case); where they disagree, the
 * reading wins.
 */
export const KINDS_OF_JOB_TYPE: Readonly<Partial<Record<string, readonly ReaderJobKind[]>>> = {
  Palletizing: ["palletizing"],
  Depalletizing: ["palletizing"],
  "Pallet handling": ["palletizing"],
  "Material handling": ["pick_and_place"],
  "Case packing": ["pick_and_place"],
  Packaging: ["pick_and_place"],
  "Machine tending": ["machine_tending"],
  "Quality inspection": ["pick_and_place", "other"],
};

/**
 * Keyword types whose questions are not a narrower case of the reading's own, even where the kinds agree (owner,
 * 2026-11-25: "Move the lamp from the round bedside table to the glass shelf on the wall." was asked where the robot
 * picks up the load, the heaviest loaded item and the peak incoming rate). "Material handling" is matched by any words
 * about moving things, and its questions are about a flow of loads; one object moved now and then is asked the reading's
 * own questions. Case packing and packaging keep theirs: a case packing job is still asked how many items go in a case.
 */
const READING_QUESTIONS_WIN_OVER: ReadonlySet<string> = new Set(["Material handling"]);

/**
 * The questions for a job: from the video reading's kind once it gives one, the keyword match only until then. A job
 * that moves between places with nothing carried is not asked a weight. The site's page and the company's page both
 * choose with this, so they show the same questions.
 */
export function jobFactKeysFor(taskFamily: string | undefined, reading?: Pick<JobReading, "kind" | "object"> | null): readonly JobFactKey[] {
  const kind = reading?.kind ?? null;
  if (!kind) return jobFactKeysForType(taskFamily);
  if (taskFamily && !READING_QUESTIONS_WIN_OVER.has(taskFamily) && KINDS_OF_JOB_TYPE[taskFamily]?.includes(kind))
    return jobFactKeysForType(taskFamily);
  const keys = QUESTIONS_BY_KIND[kind];
  return kind === "transport" && !reading?.object ? keys.filter(key => key !== "weight") : keys;
}

/**
 * The question as the site reads it on its job page, before the video reading names the job's object
 * (`jobFactQuestion` names it once it does). Weight and size ask for the heaviest and the biggest, since a job may
 * handle more than one thing; how often asks for times the job is done, which fits any kind of job.
 */
export const JOB_FACT_QUESTIONS: Readonly<Record<JobFactKey, string>> = {
  weight: "How heavy is the heaviest thing the robot handles?",
  size: "How big is the biggest thing the robot handles, on its longest side?",
  perHour: "How many times an hour is the job done?",
  hours: "How many hours a day does this job run?",
  timing: "When would you want this?",
  peakPerMinute: "How many items arrive per minute at the busiest time?",
  maxLoadedWeightKg: "How heavy is the heaviest loaded item?",
  palletPattern: "Does the pallet always use the same stack pattern?",
  incomingLoads: "What are the incoming pallets like?",
  pickupHandoff: "Where does the robot pick up the load?",
  packPresentation: "Do items arrive in the same position for packing?",
  itemsPerCase: "How many items go in each case?",
  machineAccess: "Who opens the machine door or lid?",
  machineCycleSeconds: "How long is the machine’s own cycle?",
  inspectionTarget: "What should the inspection catch?",
  route: "Where does the robot need to go?",
  routeObstacles: "What is on the way?",
  variation: "Is the work the same every time?",
  areaChange: "Could the work area be changed to suit a robot?",
};

/**
 * What the video reading says about the job: its kind, the main object ("cake batter") and the other kinds of item it
 * says the job probably handles too, as plain noun phrases. The questions use the kind to choose themselves and the
 * names for their words. Null until a reading gives a kind or an object.
 */
export interface JobReading { kind: ReaderJobKind | null; object: string | null; others: string[] }

/** The status read's `jobReading`, or null: a known kind, a short name and at most five short other names, nothing else. */
export function sanitizeJobReading(value: unknown): JobReading | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const short = (item: unknown): item is string => typeof item === "string" && item.trim().length > 0 && item.length <= 60;
  const kind = (READER_JOB_KINDS as readonly unknown[]).includes(raw.kind) ? raw.kind as ReaderJobKind : null;
  const object = short(raw.object) ? raw.object.trim() : null;
  if (!kind && !object) return null;
  return { kind, object, others: (Array.isArray(raw.others) ? raw.others : []).filter(short).map(item => item.trim()).slice(0, 5) };
}

const PLURAL_WORDS = new Set(["people", "children", "men", "women", "feet", "teeth", "mice", "geese"]);
/** A name that reads as plural ("cardboard boxes", but not "glass" or "chassis"), so its question says "are". */
export function looksPlural(name: string): boolean {
  const last = name.trim().split(/\s+/).pop()?.toLowerCase() ?? "";
  return PLURAL_WORDS.has(last) || (/[^s]s$/.test(last) && !/(?:us|is|ics)$/.test(last));
}

const listInWords = (items: readonly string[]) =>
  items.length > 1 ? `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}` : items[0] ?? "";

/**
 * The question in the site's words, naming the job's object once the video reading names it: "How heavy is the cake
 * batter?" rather than "the item". Weight, size and whether it is the same every time; the other questions read the
 * same for any object. Without a name, the question asks for the heaviest or biggest thing the robot handles.
 */
export function jobFactQuestion(key: JobFactKey, reading?: Pick<JobReading, "object"> | null): string {
  const name = reading?.object;
  if ((key !== "weight" && key !== "size" && key !== "variation") || !name) return JOB_FACT_QUESTIONS[key];
  const plural = looksPlural(name);
  if (key === "variation") return `${plural ? "Are" : "Is"} the ${name} the same every time?`;
  return key === "weight"
    ? `How heavy ${plural ? "are" : "is"} the ${name}?`
    : `How big ${plural ? "are" : "is"} the ${name}, on ${plural ? "their" : "its"} longest side?`;
}

/**
 * A line under a named weight or size question when the answer could mean more than one thing: other kinds of item the
 * reading says the job probably handles, or a plural object. The answer is then for the heaviest or the biggest.
 */
export function jobFactQuestionHint(key: JobFactKey, reading?: Pick<JobReading, "object" | "others"> | null): string | null {
  const name = reading?.object;
  if ((key !== "weight" && key !== "size") || !name) return null;
  const most = key === "weight" ? "heaviest" : "biggest";
  if (reading.others.length) return `Your video suggests the job may also handle ${listInWords(reading.others)}. Answer for the ${most}.`;
  return looksPlural(name) ? `If they vary, answer for the ${most}.` : null;
}

/** The same answer as a company reads it, one short label per line. */
export const JOB_FACT_SHORT_LABELS: Readonly<Record<JobFactKey, string>> = {
  weight: "Weight",
  size: "Size, longest side",
  perHour: "Times an hour",
  hours: "Hours a day",
  timing: "When",
  peakPerMinute: "Peak incoming rate",
  maxLoadedWeightKg: "Heaviest loaded item",
  palletPattern: "Pallet pattern",
  incomingLoads: "Incoming pallets",
  pickupHandoff: "Pickup",
  packPresentation: "Item presentation",
  itemsPerCase: "Case pack count",
  machineAccess: "Machine access",
  machineCycleSeconds: "Machine cycle",
  inspectionTarget: "Inspection target",
  route: "Where it goes",
  routeObstacles: "On the way",
  variation: "How much it varies",
  areaChange: "Work area can change",
};

/**
 * The site's answer to one of its job brief's own questions (`client/src/lib/jobBrief.ts`, `ask_site` rows): the index of
 * the choice it tapped, or "unsure" for "Not sure". Stored under `job_facts.custom`, by the brief row's id.
 */
export type CustomJobFactAnswer = number | "unsure";
/** A brief row's id as `job_facts.custom` keys it (`JOB_BRIEF_ID` in `jobBrief.ts`). */
export const CUSTOM_JOB_FACT_ID = /^[a-z][a-z0-9_]{0,31}$/;
/** The most choices a brief's own question offers, besides "Not sure". */
export const CUSTOM_JOB_FACT_CHOICES_MAX = 4;
const CUSTOM_JOB_FACTS_MAX = 12;

export type JobFacts = { [Key in JobFactKey]?: JobFactCode<Key> } & { updatedAtIso: string;
  /** Answers to the job brief's own questions, by row id; absent when there are none. */
  custom?: Readonly<Record<string, CustomJobFactAnswer>> };

/** Whether a stored value can be an answer to a brief's own question: a choice index, or "unsure". */
export function isCustomJobFactAnswer(value: unknown): value is CustomJobFactAnswer {
  return value === "unsure" || (typeof value === "number" && Number.isInteger(value) && value >= 0 && value < CUSTOM_JOB_FACT_CHOICES_MAX);
}

/** The well-formed answers to the brief's own questions in a stored value, or null when there are none. */
export function sanitizeCustomJobFacts(value: unknown): Record<string, CustomJobFactAnswer> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const answers: Record<string, CustomJobFactAnswer> = {};
  for (const [id, answer] of Object.entries(value as Record<string, unknown>).slice(0, CUSTOM_JOB_FACTS_MAX * 4)) {
    if (Object.keys(answers).length >= CUSTOM_JOB_FACTS_MAX) break;
    if (CUSTOM_JOB_FACT_ID.test(id) && isCustomJobFactAnswer(answer)) answers[id] = answer;
  }
  return Object.keys(answers).length ? answers : null;
}

/** The weight range's bounds in kg; null where the answer gives none (over 30 kg has no upper bound). */
export const WEIGHT_RANGE_KG: Readonly<Record<JobFactCode<"weight">, { lower: number; upper: number | null } | null>> = {
  under_5kg: { lower: 0, upper: 5 },
  "5_15kg": { lower: 5, upper: 15 },
  "15_30kg": { lower: 15, upper: 30 },
  over_30kg: { lower: 30, upper: null },
  unsure: null,
};

/** The upper bound of the site's weight answer, in kg. Null for no answer, "over 30 kg" and "not sure". */
export function weightUpperBoundKg(facts: Partial<JobFacts> | null | undefined): number | null {
  const max = jobFactNumber("maxLoadedWeightKg", facts?.maxLoadedWeightKg);
  if (max !== null) return max;
  const code = facts?.weight;
  if (!code || !isJobFactCode("weight", code)) return null;
  return WEIGHT_RANGE_KG[code]?.upper ?? null;
}

/** The lower bound of the site's weight answer, in kg. Null for no answer and "not sure". */
export function weightLowerBoundKg(facts: Partial<JobFacts> | null | undefined): number | null {
  const code = facts?.weight;
  if (!code || !isJobFactCode("weight", code)) return null;
  const lower = WEIGHT_RANGE_KG[code]?.lower ?? null;
  const upper = weightUpperBoundKg(facts);
  return lower !== null && upper !== null && lower > upper ? null : lower;
}

export function isJobFactKey(value: unknown): value is JobFactKey {
  return typeof value === "string" && (JOB_FACT_KEYS as readonly string[]).includes(value);
}

export function isJobFactCode<K extends JobFactKey>(key: K, value: unknown): value is JobFactCode<K> {
  if (typeof value !== "string") return false;
  const numeric = JOB_FACT_NUMBERS[key];
  if (numeric && value !== "unsure") {
    const pounds = key === "maxLoadedWeightKg" ? POUNDS.exec(value) : null;
    if (!pounds && !TYPED_NUMBER.test(value)) return false;
    const number = pounds ? Number(pounds[1]) * KG_PER_LB : Number(value);
    return number >= numeric.min && number <= numeric.max && (!numeric.whole || Number.isInteger(number));
  }
  return (JOB_FACT_CHOICES[key] as ReadonlyArray<{ code: string }>).some(choice => choice.code === value);
}

export function jobFactLabel<K extends JobFactKey>(key: K, code: string): string | null {
  const choice = (JOB_FACT_CHOICES[key] as ReadonlyArray<{ code: string; label: string }>).find(item => item.code === code);
  const numeric = JOB_FACT_NUMBERS[key];
  if (numeric && !choice && isJobFactCode(key, code)) {
    // What the site typed, then the conversion, rounded: "44 lb (about 20 kg)".
    const typed = typedJobFactNumber(key, code);
    if (typed?.unit === "lb") return `${Number(typed.value)} lb (about ${roughKg(Number(typed.value) * KG_PER_LB)} kg)`;
    return `${Number(code)} ${numeric.unit}`;
  }
  return choice ? choice.label : null;
}

/**
 * Only the known answers of a stored value, or null when there are none. Anything else on the record
 * (an unknown key, an unknown code, text) is dropped, never shown. Answers to the job brief's own questions are kept
 * under `custom` as an id and a choice index (or "unsure"), never as words.
 */
export function sanitizeJobFacts(value: unknown): JobFacts | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const facts: Record<string, string> = {};
  for (const key of JOB_FACT_KEYS) if (isJobFactCode(key, raw[key])) facts[key] = raw[key] as string;
  const custom = sanitizeCustomJobFacts(raw.custom);
  if (Object.keys(facts).length === 0 && !custom) return null;
  const updatedAtIso = typeof raw.updatedAtIso === "string" && !Number.isNaN(Date.parse(raw.updatedAtIso)) ? raw.updatedAtIso : "";
  return { ...(facts as Omit<JobFacts, "updatedAtIso" | "custom">), ...(custom ? { custom } : {}), updatedAtIso };
}

/**
 * The site's answers in the same words on both pages: one line per answered question, in question order. Only the
 * job's own questions (chosen as the site's page chose them, `jobFactKeysFor`) and the general five are said.
 */
export function jobFactsInWords(facts: unknown, taskFamily?: string, reading?: Pick<JobReading, "kind" | "object"> | null): string[] {
  const clean = sanitizeJobFacts(facts);
  if (!clean) return [];
  const lines: string[] = [];
  const visible = taskFamily || reading?.kind ? new Set([...jobFactKeysFor(taskFamily, reading), ...GENERAL_JOB_FACT_KEYS]) : JOB_FACT_KEYS;
  for (const key of visible) {
    const code = clean[key];
    const label = code ? jobFactLabel(key, code) : null;
    if (label) lines.push(`${JOB_FACT_SHORT_LABELS[key]}: ${label}`);
  }
  return lines;
}
