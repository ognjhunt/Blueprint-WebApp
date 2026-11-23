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
  "incomingLoads", "pickupHandoff", "packPresentation", "itemsPerCase", "machineAccess", "machineCycleSeconds", "inspectionTarget"] as const;
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
} as const satisfies Record<JobFactKey, ReadonlyArray<{ code: string; label: string }>>;

type NumericJobFactKey = "peakPerMinute" | "maxLoadedWeightKg" | "itemsPerCase" | "machineCycleSeconds";
export type JobFactCode<K extends JobFactKey> = (typeof JOB_FACT_CHOICES)[K][number]["code"] | (K extends NumericJobFactKey ? `${number}` : never);

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

export function jobFactKeysForType(taskFamily: string | undefined): readonly JobFactKey[] {
  return taskFamily && Object.hasOwn(QUESTIONS_BY_JOB_TYPE, taskFamily) ? QUESTIONS_BY_JOB_TYPE[taskFamily]! : GENERAL_JOB_FACT_KEYS;
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
};

/**
 * What the video reading calls the job's main object ("cake batter"), and the other kinds of item it says the job
 * probably handles too, as plain noun phrases. Only on the site's own status read; the questions use it for their words.
 */
export interface JobObject { name: string; others: string[] }

/** The status read's `jobObject`, or null: a short name and at most five short other names, nothing else. */
export function sanitizeJobObject(value: unknown): JobObject | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const short = (item: unknown): item is string => typeof item === "string" && item.trim().length > 0 && item.length <= 60;
  if (!short(raw.name)) return null;
  return { name: raw.name.trim(), others: (Array.isArray(raw.others) ? raw.others : []).filter(short).map(item => item.trim()).slice(0, 5) };
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
 * batter?" rather than "the item". Weight and size only; the other questions read the same for any object. Without a
 * name, the question asks for the heaviest or biggest thing the robot handles.
 */
export function jobFactQuestion(key: JobFactKey, object?: JobObject | null): string {
  if ((key !== "weight" && key !== "size") || !object?.name) return JOB_FACT_QUESTIONS[key];
  const plural = looksPlural(object.name);
  return key === "weight"
    ? `How heavy ${plural ? "are" : "is"} the ${object.name}?`
    : `How big ${plural ? "are" : "is"} the ${object.name}, on ${plural ? "their" : "its"} longest side?`;
}

/**
 * A line under a named weight or size question when the answer could mean more than one thing: other kinds of item the
 * reading says the job probably handles, or a plural object. The answer is then for the heaviest or the biggest.
 */
export function jobFactQuestionHint(key: JobFactKey, object?: JobObject | null): string | null {
  if ((key !== "weight" && key !== "size") || !object?.name) return null;
  const most = key === "weight" ? "heaviest" : "biggest";
  if (object.others.length) return `Your video suggests the job may also handle ${listInWords(object.others)}. Answer for the ${most}.`;
  return looksPlural(object.name) ? `If they vary, answer for the ${most}.` : null;
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
};

export type JobFacts = { [Key in JobFactKey]?: JobFactCode<Key> } & { updatedAtIso: string };

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
  const max = facts?.maxLoadedWeightKg;
  if (max !== "unsure" && isJobFactCode("maxLoadedWeightKg", max)) return Number(max);
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
    if (!/^\d{1,7}(?:\.\d{1,3})?$/.test(value)) return false;
    const number = Number(value);
    return number >= numeric.min && number <= numeric.max && (!numeric.whole || Number.isInteger(number));
  }
  return (JOB_FACT_CHOICES[key] as ReadonlyArray<{ code: string }>).some(choice => choice.code === value);
}

export function jobFactLabel<K extends JobFactKey>(key: K, code: string): string | null {
  const choice = (JOB_FACT_CHOICES[key] as ReadonlyArray<{ code: string; label: string }>).find(item => item.code === code);
  const numeric = JOB_FACT_NUMBERS[key];
  if (numeric && !choice && isJobFactCode(key, code)) return `${Number(code)} ${numeric.unit}`;
  return choice ? choice.label : null;
}

/**
 * Only the known answers of a stored value, or null when there are none. Anything else on the record
 * (an unknown key, an unknown code, text) is dropped, never shown.
 */
export function sanitizeJobFacts(value: unknown): JobFacts | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const facts: Record<string, string> = {};
  for (const key of JOB_FACT_KEYS) if (isJobFactCode(key, raw[key])) facts[key] = raw[key] as string;
  if (Object.keys(facts).length === 0) return null;
  const updatedAtIso = typeof raw.updatedAtIso === "string" && !Number.isNaN(Date.parse(raw.updatedAtIso)) ? raw.updatedAtIso : "";
  return { ...(facts as Omit<JobFacts, "updatedAtIso">), updatedAtIso };
}

/** The site's answers in the same words on both pages: one line per answered question, in question order. */
export function jobFactsInWords(facts: unknown, taskFamily?: string): string[] {
  const clean = sanitizeJobFacts(facts);
  if (!clean) return [];
  const lines: string[] = [];
  const visible = taskFamily ? new Set([...jobFactKeysForType(taskFamily), ...GENERAL_JOB_FACT_KEYS]) : JOB_FACT_KEYS;
  for (const key of visible) {
    const code = clean[key];
    const label = code ? jobFactLabel(key, code) : null;
    if (label) lines.push(`${JOB_FACT_SHORT_LABELS[key]}: ${label}`);
  }
  return lines;
}
