/**
 * `job_facts` on a site's job (PACKAGE_E E1): the site's tap answers to a few quick questions.
 *
 * The code lists, labels and words live in `client/src/lib/jobFacts.ts` so both pages read the same
 * ones; this file adds what only the server does: validate one tap, write it, and read the stored
 * value back for a payload. No free text and no typed number is ever accepted or stored.
 */
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { projectWebsiteCaptureRights } from "./websiteCaptureRights";
import {
  JOB_FACT_KEYS, isJobFactCode, isJobFactKey, sanitizeJobFacts, type JobFactKey, type JobFacts,
} from "../../client/src/lib/jobFacts";

export {
  JOB_FACT_CHOICES, JOB_FACT_KEYS, JOB_FACT_QUESTIONS, JOB_FACTS_NUDGE, WEIGHT_RANGE_KG, jobFactsInWords,
  sanitizeJobFacts, weightLowerBoundKg, weightUpperBoundKg, type JobFactKey, type JobFacts,
} from "../../client/src/lib/jobFacts";

export const JOB_FACTS_FIELD = "job_facts";

export type JobFactTap = { key: JobFactKey; code: string };
export type JobFactTapRefusal = "body_not_object" | "unexpected_field" | "unknown_question" | "unknown_answer";

/** One tap, exactly `{ key, code }` with a known question and one of its codes. Anything else is refused. */
export function parseJobFactTap(body: unknown): { ok: true; tap: JobFactTap } | { ok: false; reason: JobFactTapRefusal } {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, reason: "body_not_object" };
  const raw = body as Record<string, unknown>;
  if (Object.keys(raw).some(field => field !== "key" && field !== "code")) return { ok: false, reason: "unexpected_field" };
  if (!isJobFactKey(raw.key)) return { ok: false, reason: "unknown_question" };
  if (!isJobFactCode(raw.key, raw.code)) return { ok: false, reason: "unknown_answer" };
  return { ok: true, tap: { key: raw.key, code: raw.code as string } };
}

/** The stored answers of a job record, known codes only, or null. For the site's and the company's payloads. */
export function readJobFacts(record: Record<string, unknown> | null | undefined): JobFacts | null {
  return sanitizeJobFacts(record?.[JOB_FACTS_FIELD]);
}

export class JobFactsRefused extends Error {
  constructor(readonly code: "job_missing" | "consent_withdrawn" | "store_unavailable") { super(code); }
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
    const stored = { ...next, updatedAtIso: now.toISOString() } as JobFacts;
    // `update` with the whole map replaces the field's value, so nothing but known codes remains under it;
    // every other field on the job is untouched.
    tx.update(ref, { [JOB_FACTS_FIELD]: stored });
    return stored;
  });
}
