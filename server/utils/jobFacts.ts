/**
 * `job_facts` on a site's job (PACKAGE_E E1): the site's tap answers to a few quick questions.
 *
 * The code lists, labels and words live in `client/src/lib/jobFacts.ts` so both pages read the same
 * ones; this file adds what only the server does: validate a choice or bounded measurement, write it,
 * and read the stored value back for a payload. Free text is never accepted: an answer to a question of the job's
 * brief (`client/src/lib/jobBrief.ts`) is the index of the choice tapped, under `custom`.
 */
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { projectWebsiteCaptureRights } from "./websiteCaptureRights";
import {
  CUSTOM_JOB_FACT_ID, JOB_FACT_KEYS, isCustomJobFactAnswer, isJobFactCode, isJobFactKey, sanitizeJobFacts, type CustomJobFactAnswer,
  type JobFactKey, type JobFacts,
} from "../../client/src/lib/jobFacts";

export {
  JOB_FACT_CHOICES, JOB_FACT_KEYS, JOB_FACT_QUESTIONS, JOB_FACTS_NUDGE, WEIGHT_RANGE_KG, jobFactsInWords,
  sanitizeJobFacts, weightLowerBoundKg, weightUpperBoundKg, type JobFactKey, type JobFacts,
} from "../../client/src/lib/jobFacts";

export const JOB_FACTS_FIELD = "job_facts";

export type JobFactTap = { key: JobFactKey; code: string };
export type JobFactTapRefusal = "body_not_object" | "unexpected_field" | "unknown_question" | "unknown_answer";

/** Exactly `{ key, code }` with a known question and a valid answer for it. */
export function parseJobFactTap(body: unknown): { ok: true; tap: JobFactTap } | { ok: false; reason: JobFactTapRefusal } {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, reason: "body_not_object" };
  const raw = body as Record<string, unknown>;
  if (Object.keys(raw).some(field => field !== "key" && field !== "code")) return { ok: false, reason: "unexpected_field" };
  if (!isJobFactKey(raw.key)) return { ok: false, reason: "unknown_question" };
  if (!isJobFactCode(raw.key, raw.code)) return { ok: false, reason: "unknown_answer" };
  return { ok: true, tap: { key: raw.key, code: raw.code as string } };
}

/** One tap on a question of the job's brief: the row's id, and the index of the choice tapped or "unsure". */
export type CustomJobFactTap = { id: string; code: CustomJobFactAnswer };

/**
 * Exactly `{ custom, code }`: a brief row's id and a choice index or "unsure". Whether the job's current brief asks
 * that question, with that many choices, is checked when it is saved (`saveCustomJobFactTap`).
 */
export function parseCustomJobFactTap(body: unknown): { ok: true; tap: CustomJobFactTap } | { ok: false; reason: JobFactTapRefusal } {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, reason: "body_not_object" };
  const raw = body as Record<string, unknown>;
  if (Object.keys(raw).some(field => field !== "custom" && field !== "code")) return { ok: false, reason: "unexpected_field" };
  if (typeof raw.custom !== "string" || !CUSTOM_JOB_FACT_ID.test(raw.custom)) return { ok: false, reason: "unknown_question" };
  if (!isCustomJobFactAnswer(raw.code)) return { ok: false, reason: "unknown_answer" };
  return { ok: true, tap: { id: raw.custom, code: raw.code } };
}

/** The stored answers of a job record, known codes only, or null. For the site's and the company's payloads. */
export function readJobFacts(record: Record<string, unknown> | null | undefined): JobFacts | null {
  return sanitizeJobFacts(record?.[JOB_FACTS_FIELD]);
}

export class JobFactsRefused extends Error {
  constructor(readonly code: "job_missing" | "consent_withdrawn" | "store_unavailable" | "unknown_question" | "unknown_answer") { super(code); }
}

/**
 * Write one tap onto the job, in one transaction that re-reads the job: a job whose site withdrew is
 * refused, and nothing is written. Returns the stored answers after the write.
 */
export async function saveJobFactTap(requestId: string, tap: JobFactTap, now = new Date()): Promise<JobFacts> {
  if (!db) throw new JobFactsRefused("store_unavailable");
  const store = db;
  const ref = store.collection("inboundRequests").doc(requestId);
  return store.runTransaction(async tx => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) throw new JobFactsRefused("job_missing");
    const record = (snapshot.data() ?? {}) as Record<string, unknown>;
    if (projectWebsiteCaptureRights(record).consent_revoked) throw new JobFactsRefused("consent_withdrawn");
    const current = readJobFacts(record);
    const next: Record<string, string> = {};
    for (const key of JOB_FACT_KEYS) if (current?.[key]) next[key] = current[key] as string;
    next[tap.key] = tap.code;
    // The answers to the job brief's own questions stay as they are.
    const stored = { ...next, ...(current?.custom ? { custom: current.custom } : {}), updatedAtIso: now.toISOString() } as JobFacts;
    // `update` with the whole map replaces the field's value, so nothing but known codes remains under it;
    // every other field on the job is untouched.
    tx.update(ref, { [JOB_FACTS_FIELD]: stored });
    return stored;
  });
}

/**
 * Write one tap on a question of the job's brief, in one transaction that re-reads the job and its sentence: refused
 * for a withdrawn site, and refused (nothing written) unless the brief the site's page shows now asks that question
 * (`siteJobBriefOf`: current, and used) and the choice is one of its choices. The catalog answers stay as they are.
 */
export async function saveCustomJobFactTap(requestId: string, tap: CustomJobFactTap, now = new Date()): Promise<JobFacts> {
  if (!db) throw new JobFactsRefused("store_unavailable");
  const store = db;
  const { siteJobBriefOf } = await import("./jobBrief");
  const ref = store.collection("inboundRequests").doc(requestId);
  const briefRef = store.collection("siteTaskBriefs").doc(requestId);
  return store.runTransaction(async tx => {
    const [snapshot, briefSnapshot] = [await tx.get(ref), await tx.get(briefRef)];
    if (!snapshot.exists) throw new JobFactsRefused("job_missing");
    const record = (snapshot.data() ?? {}) as Record<string, any>;
    if (projectWebsiteCaptureRights(record).consent_revoked) throw new JobFactsRefused("consent_withdrawn");
    const row = siteJobBriefOf(record, briefSnapshot.data() ?? null)?.rows.find(item => item.id === tap.id);
    if (row?.evidence !== "ask_site") throw new JobFactsRefused("unknown_question");
    if (tap.code !== "unsure" && tap.code >= row.choices.length) throw new JobFactsRefused("unknown_answer");
    const current = readJobFacts(record);
    const next: Record<string, unknown> = {};
    for (const key of JOB_FACT_KEYS) if (current?.[key]) next[key] = current[key];
    const stored = { ...next, custom: { ...(current?.custom ?? {}), [tap.id]: tap.code }, updatedAtIso: now.toISOString() } as JobFacts;
    tx.update(ref, { [JOB_FACTS_FIELD]: stored });
    return stored;
  });
}
