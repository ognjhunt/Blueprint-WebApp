/**
 * A few quick questions for the site (PACKAGE_E E1).
 *
 * Asked on the site's job page under the job sentence, as taps, never typing. Every question has
 * "Not sure", and skipping never holds a job. The answers are stored on the job as `job_facts` with
 * exactly the codes below, and a deployment company reads them in the same words
 * (`jobFactsInWords`). The weight answer's upper bound turns a conditional first-look row into a
 * plain yes or no (`client/src/lib/firstLookWords.ts`).
 *
 * One list, read by the job page, the company's page, the save route and its tests.
 */

export const JOB_FACTS_HEADING = "A few quick questions help companies answer";
/** The one nudge, added to the site's email when a company answers "Would need something" (E1). */
export const JOB_FACTS_NUDGE = "A few quick answers on your job page may be all they need.";

export const JOB_FACT_KEYS = ["weight", "size", "perHour", "hours", "timing"] as const;
export type JobFactKey = (typeof JOB_FACT_KEYS)[number];

export const NOT_SURE_LABEL = "Not sure";

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
} as const satisfies Record<JobFactKey, ReadonlyArray<{ code: string; label: string }>>;

export type JobFactCode<K extends JobFactKey> = (typeof JOB_FACT_CHOICES)[K][number]["code"];

/** The question as the site reads it on its job page. */
export const JOB_FACT_QUESTIONS: Readonly<Record<JobFactKey, string>> = {
  weight: "How heavy is the item?",
  size: "How big is it, on its longest side?",
  perHour: "How many an hour?",
  hours: "How many hours a day does this job run?",
  timing: "When would you want this?",
};

/** The same answer as a company reads it, one short label per line. */
export const JOB_FACT_SHORT_LABELS: Readonly<Record<JobFactKey, string>> = {
  weight: "Weight",
  size: "Size, longest side",
  perHour: "How many an hour",
  hours: "Hours a day",
  timing: "When",
};

export interface JobFacts {
  weight?: JobFactCode<"weight">;
  size?: JobFactCode<"size">;
  perHour?: JobFactCode<"perHour">;
  hours?: JobFactCode<"hours">;
  timing?: JobFactCode<"timing">;
  updatedAtIso: string;
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
  const code = facts?.weight;
  if (!code || !isJobFactCode("weight", code)) return null;
  return WEIGHT_RANGE_KG[code]?.upper ?? null;
}

/** The lower bound of the site's weight answer, in kg. Null for no answer and "not sure". */
export function weightLowerBoundKg(facts: Partial<JobFacts> | null | undefined): number | null {
  const code = facts?.weight;
  if (!code || !isJobFactCode("weight", code)) return null;
  return WEIGHT_RANGE_KG[code]?.lower ?? null;
}

export function isJobFactKey(value: unknown): value is JobFactKey {
  return typeof value === "string" && (JOB_FACT_KEYS as readonly string[]).includes(value);
}

export function isJobFactCode<K extends JobFactKey>(key: K, value: unknown): value is JobFactCode<K> {
  return typeof value === "string"
    && (JOB_FACT_CHOICES[key] as ReadonlyArray<{ code: string }>).some(choice => choice.code === value);
}

export function jobFactLabel<K extends JobFactKey>(key: K, code: string): string | null {
  const choice = (JOB_FACT_CHOICES[key] as ReadonlyArray<{ code: string; label: string }>).find(item => item.code === code);
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
export function jobFactsInWords(facts: unknown): string[] {
  const clean = sanitizeJobFacts(facts);
  if (!clean) return [];
  const lines: string[] = [];
  for (const key of JOB_FACT_KEYS) {
    const code = clean[key];
    const label = code ? jobFactLabel(key, code) : null;
    if (label) lines.push(`${JOB_FACT_SHORT_LABELS[key]}: ${label}`);
  }
  return lines;
}
