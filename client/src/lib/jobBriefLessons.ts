/**
 * Lessons for the job brief (owner, 2026-11-25: "Every 'Need more details' question and every 'Not a fit' reason is a
 * signal. Feed them back so that the next similar job asks the site those things up front. The packet improves without
 * anyone hand-tuning it.").
 *
 * A lesson is generic and site-agnostic: one short plain question any site could answer about its own job, with a stable
 * topic id, or one reason from the closed list below. Lessons are kept per kind of job (`READER_JOB_KINDS`), counted, and
 * the job brief of the next job of that kind reads the top ones (`server/utils/jobBrief.ts`). This module is the pure
 * part: the closed list, the word checks a lesson must pass, and the bounded store. The runs that write lessons, with
 * their identity passes and their hold on the job's cap, are `server/utils/jobBriefLessons.ts`.
 */
import { JOB_BRIEF_QUESTION_MAX, jobBriefWordsRefused } from "./jobBrief";
import { JOB_FACT_QUESTIONS, READER_JOB_KINDS, isJobFactKey, type JobFactKey, type ReaderJobKind } from "./jobFacts";

export const JOB_BRIEF_LESSONS_SCHEMA_VERSION = "job_brief_lessons.v1";

/**
 * Why a company says a job is not a fit: one of these. From the research on what deployment companies decide on
 * (`Robot deployment readiness needs`, "Make every company reply comparable at a glance": job type not offered, item
 * outside limits, rate too low, region not served, environment, other; and the facts of its gates (a) and (b): how much
 * the items vary, layout and space, connections to other machines, people near the work, timing).
 */
export const JOB_BRIEF_LESSON_REASONS = ["job_type_not_offered", "object_outside_limits", "object_varies", "rate_mismatch",
  "space_or_layout", "environment", "integration_needed", "people_nearby", "timing", "region_not_served", "other"] as const;
export type JobBriefLessonReason = (typeof JOB_BRIEF_LESSON_REASONS)[number];

/** Each reason in plain words, as the lesson lane, the job brief and staff read it. Written here, never by a model. */
export const JOB_BRIEF_LESSON_REASON_WORDS: Readonly<Record<JobBriefLessonReason, string>> = {
  job_type_not_offered: "The company does not do this kind of job",
  object_outside_limits: "The object is too heavy, too large, or shaped or packed in a way a robot cannot handle",
  object_varies: "The objects or the work vary too much",
  rate_mismatch: "The job is done too rarely or too fast for a robot",
  space_or_layout: "There is not enough space, or the layout does not suit a robot",
  environment: "The surroundings do not suit a robot: heat, cold, water, dust, light or outdoors",
  integration_needed: "The job needs connecting to other machines or systems",
  people_nearby: "People work too close to the job",
  timing: "When the site wants it running does not suit the company",
  region_not_served: "The company does not work where the site is",
  other: "Another reason",
};

/**
 * The reasons a site could answer something about up front, which the job brief reads. Not the others: a kind of job a
 * company does not offer, or where it works, is not about the job; connections to other machines are for a site visit
 * (the brief never asks what a visit has to measure); "other" says nothing.
 */
export const JOB_BRIEF_LESSON_REASONS_FOR_BRIEF: ReadonlySet<JobBriefLessonReason> = new Set(["object_outside_limits",
  "object_varies", "rate_mismatch", "space_or_layout", "environment", "people_nearby", "timing"]);

export function isJobBriefLessonReason(value: unknown): value is JobBriefLessonReason {
  return typeof value === "string" && (JOB_BRIEF_LESSON_REASONS as readonly string[]).includes(value);
}

export function isReaderJobKind(value: unknown): value is ReaderJobKind {
  return typeof value === "string" && (READER_JOB_KINDS as readonly string[]).includes(value);
}

/* ------------------------------------------------------------------------------------------------- one lesson */

/** A new topic's id: snake_case, three to thirty-two lowercase letters and underscores. A catalog key is a topic too. */
export const JOB_BRIEF_LESSON_TOPIC = /^[a-z][a-z_]{2,31}$/;
/** Words about where the site is, which a lesson never asks (the identity words are `jobBriefWordsRefused`'s). */
const PLACE = /\b(?:locat\w*|cit(?:y|ies)|regions?|countr(?:y|ies)|towns?|neighbo\w*|county|province)\b/i;

/** A lesson as a run keeps it: a question with its topic, or a reason. */
export type JobBriefLesson = { type: "question"; topic: string; question: string } | { type: "reason"; reason: JobBriefLessonReason };

/** The lesson's key: a company counts once per job for each (`q:<topic>`, `r:<reason>`). */
export function jobBriefLessonKey(lesson: JobBriefLesson): string {
  return lesson.type === "question" ? `q:${lesson.topic}` : `r:${lesson.reason}`;
}

/**
 * Why a lesson's question may not be kept, or null when it may: not one line of eight to 120 characters ending in a
 * question mark; a figure (a lesson is about the kind of job, never this job's numbers); a capitalised word after the
 * first (it reads as a name, as in the brief); money, identity or a robot's make (`jobBriefWordsRefused`); or a word
 * about where the site is. The identity passes are the server's (`server/utils/jobBriefLessons.ts`).
 */
export function jobBriefLessonQuestionRefused(text: string): "shape" | "figure" | "capital" | "money" | "identity" | "robot_brand" | "place" | null {
  if (typeof text !== "string" || /[\r\n]/.test(text)) return "shape";
  const question = text.trim();
  if (question.length < 8 || question.length > JOB_BRIEF_QUESTION_MAX || !question.endsWith("?") || question.indexOf("?") !== question.length - 1)
    return "shape";
  if (/\p{N}/u.test(question)) return "figure";
  // Sentence case: a capital letter anywhere after the first word reads as a name (a short acronym in capitals aside).
  const later = question.replace(/^\s*\S+/, "");
  if ([...later.matchAll(/\p{Lu}\p{L}*/gu)].some(match => !/^\p{Lu}{2,3}s?$/u.test(match[0]))) return "capital";
  const refused = jobBriefWordsRefused(question);
  if (refused) return refused;
  return PLACE.test(question) ? "place" : null;
}

/** Why a topic id may not be kept, or null: a catalog key, or a snake_case id whose words pass the same checks. */
export function jobBriefLessonTopicRefused(topic: unknown): "shape" | "money" | "identity" | "robot_brand" | "place" | null {
  if (isJobFactKey(topic)) return null;
  if (typeof topic !== "string" || !JOB_BRIEF_LESSON_TOPIC.test(topic) || topic.endsWith("_") || topic.includes("__")) return "shape";
  const words = topic.replace(/_/g, " ");
  return jobBriefWordsRefused(words) ?? (PLACE.test(words) ? "place" : null);
}

/**
 * The model's answer as a lesson, or null: for "Need more details" a topic and a question that pass the checks above
 * (for a catalog key the catalog's own question is kept, never the model's words); for "Not a fit" a reason from the
 * closed list. `extraCheck`: the server's identity passes over the question and the topic's words.
 */
export function sanitizeJobBriefLesson(raw: unknown, answer: "need_more_details" | "not_a_fit",
  extraCheck: (words: string) => boolean = () => true): JobBriefLesson | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  if (answer === "not_a_fit") return isJobBriefLessonReason(value.reason) ? { type: "reason", reason: value.reason } : null;
  const topic = typeof value.topic === "string" ? value.topic.trim() : null;
  if (!topic || jobBriefLessonTopicRefused(topic) || !extraCheck(topic.replace(/_/g, " "))) return null;
  if (isJobFactKey(topic)) return { type: "question", topic, question: JOB_FACT_QUESTIONS[topic as JobFactKey] };
  const question = typeof value.question === "string" ? value.question.replace(/\s+/g, " ").trim() : "";
  if (jobBriefLessonQuestionRefused(question) || !extraCheck(question)) return null;
  return { type: "question", topic, question };
}

/* ------------------------------------------------------------------------------------------------- the store */

/** The most question topics kept for one kind of job; reasons are the closed list. */
export const JOB_BRIEF_LESSON_QUESTIONS_MAX = 40;
/** The most lessons the job brief reads for a job. */
export const JOB_BRIEF_LESSONS_IN_BRIEF = 8;

export interface StoredLessonQuestion { topic: string; question: string; count: number; firstSeenAtIso: string; lastSeenAtIso: string }
export interface StoredLessonReason { reason: JobBriefLessonReason; count: number; firstSeenAtIso: string; lastSeenAtIso: string }

/**
 * The lessons of one kind of job, as `jobBriefLessons/<kind>` holds them: the top question topics (at most
 * `JOB_BRIEF_LESSON_QUESTIONS_MAX`) and the reasons, each with how many companies gave it (once per company per job) and
 * when it was first and last given. No job, no company and no company's words: only the checked lesson.
 */
export interface JobBriefLessonStore {
  schemaVersion: typeof JOB_BRIEF_LESSONS_SCHEMA_VERSION;
  kind: ReaderJobKind;
  questions: StoredLessonQuestion[];
  reasons: StoredLessonReason[];
  updatedAtIso: string | null;
}

export function emptyJobBriefLessonStore(kind: ReaderJobKind): JobBriefLessonStore {
  return { schemaVersion: JOB_BRIEF_LESSONS_SCHEMA_VERSION, kind, questions: [], reasons: [], updatedAtIso: null };
}

const iso = (value: unknown): string | null => typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : null;
const positive = (value: unknown): number | null => Number.isInteger(value) && (value as number) > 0 ? value as number : null;
/** Most given first, then most recently given. */
const byWeight = (a: { count: number; lastSeenAtIso: string }, b: { count: number; lastSeenAtIso: string }) =>
  b.count - a.count || b.lastSeenAtIso.localeCompare(a.lastSeenAtIso);

/**
 * A stored lesson document, checked again as any stored value is untrusted: each question's topic and words pass the
 * word checks again (`jobBriefLessonQuestionRefused`; the identity passes ran when it was written), each reason is on the
 * closed list, each count is a positive whole number; the first of a repeated topic or reason is kept. An empty store
 * for anything else.
 */
export function sanitizeJobBriefLessonStore(value: unknown, kind: ReaderJobKind): JobBriefLessonStore {
  const store = emptyJobBriefLessonStore(kind);
  if (!value || typeof value !== "object" || Array.isArray(value)) return store;
  const raw = value as Record<string, unknown>;
  if (raw.schemaVersion !== JOB_BRIEF_LESSONS_SCHEMA_VERSION || raw.kind !== kind) return store;
  for (const item of Array.isArray(raw.questions) ? raw.questions.slice(0, JOB_BRIEF_LESSON_QUESTIONS_MAX * 2) : []) {
    const entry = item as Record<string, unknown> | null;
    const count = positive(entry?.count), first = iso(entry?.firstSeenAtIso), last = iso(entry?.lastSeenAtIso);
    const lesson = sanitizeJobBriefLesson(entry, "need_more_details");
    if (!lesson || lesson.type !== "question" || !count || !first || !last) continue;
    if (store.questions.some(other => other.topic === lesson.topic)) continue;
    store.questions.push({ topic: lesson.topic, question: lesson.question, count, firstSeenAtIso: first, lastSeenAtIso: last });
  }
  for (const item of Array.isArray(raw.reasons) ? raw.reasons.slice(0, JOB_BRIEF_LESSON_REASONS.length * 2) : []) {
    const entry = item as Record<string, unknown> | null;
    const count = positive(entry?.count), first = iso(entry?.firstSeenAtIso), last = iso(entry?.lastSeenAtIso);
    if (!isJobBriefLessonReason(entry?.reason) || !count || !first || !last) continue;
    if (store.reasons.some(other => other.reason === entry!.reason)) continue;
    store.reasons.push({ reason: entry!.reason as JobBriefLessonReason, count, firstSeenAtIso: first, lastSeenAtIso: last });
  }
  store.questions.sort(byWeight).splice(JOB_BRIEF_LESSON_QUESTIONS_MAX);
  store.reasons.sort(byWeight);
  store.updatedAtIso = iso(raw.updatedAtIso);
  return store;
}

/**
 * The store with one more company's lesson counted. A topic already kept keeps its first words; a new topic, when the
 * store is full, takes the place of the least given and least recent one (so the top lessons stay, and a new one can
 * still enter). The caller counts a company once per job per topic.
 */
export function addJobBriefLesson(store: JobBriefLessonStore, lesson: JobBriefLesson, atIso: string): JobBriefLessonStore {
  const next: JobBriefLessonStore = { ...store, questions: store.questions.map(entry => ({ ...entry })),
    reasons: store.reasons.map(entry => ({ ...entry })), updatedAtIso: atIso };
  if (lesson.type === "reason") {
    const found = next.reasons.find(entry => entry.reason === lesson.reason);
    if (found) { found.count += 1; found.lastSeenAtIso = atIso; }
    else next.reasons.push({ reason: lesson.reason, count: 1, firstSeenAtIso: atIso, lastSeenAtIso: atIso });
    next.reasons.sort(byWeight);
    return next;
  }
  const found = next.questions.find(entry => entry.topic === lesson.topic);
  if (found) { found.count += 1; found.lastSeenAtIso = atIso; }
  else {
    next.questions.sort(byWeight);
    if (next.questions.length >= JOB_BRIEF_LESSON_QUESTIONS_MAX) next.questions.splice(JOB_BRIEF_LESSON_QUESTIONS_MAX - 1);
    next.questions.push({ topic: lesson.topic, question: lesson.question, count: 1, firstSeenAtIso: atIso, lastSeenAtIso: atIso });
  }
  next.questions.sort(byWeight);
  return next;
}

/** One lesson as the job brief reads it: what companies looking at similar jobs asked, or why they said no, and how many. */
export type JobBriefLessonForBrief = { question: string; count: number } | { reason: string; count: number };

/**
 * The top lessons of a kind for the job brief, at most `JOB_BRIEF_LESSONS_IN_BRIEF`, most given first: each question in
 * its kept words, and each reason a site could answer something about (`JOB_BRIEF_LESSON_REASONS_FOR_BRIEF`) in the
 * fixed words above.
 */
export function jobBriefLessonsForBrief(store: JobBriefLessonStore, limit = JOB_BRIEF_LESSONS_IN_BRIEF): JobBriefLessonForBrief[] {
  const weighed = [
    ...store.questions.map(entry => ({ entry, lesson: { question: entry.question, count: entry.count } })),
    ...store.reasons.filter(entry => JOB_BRIEF_LESSON_REASONS_FOR_BRIEF.has(entry.reason))
      .map(entry => ({ entry, lesson: { reason: JOB_BRIEF_LESSON_REASON_WORDS[entry.reason], count: entry.count } })),
  ];
  return weighed.sort((a, b) => byWeight(a.entry, b.entry)).slice(0, Math.max(0, limit)).map(({ lesson }) => lesson);
}
