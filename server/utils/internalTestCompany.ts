/**
 * The internal test company (owner, 2026-11-25): ONE company record Blueprint keeps so it can test the company side
 * end to end on its own internal test jobs (`internalTestJob.ts`).
 *
 * The condition it exists under:
 * - It sees ONLY internal test jobs. No real site ever sees it, and it never sees, answers or is sent a real job.
 * - Its emails go only to one inbox, the server setting `BLUEPRINT_INTERNAL_TEST_COMPANY_EMAIL` (set on the web and
 *   worker services, never in the repository). The site-side emails of a test job go to that same inbox, since a test
 *   job has no site contact. Nothing about the pair goes to anyone else (`internalTestRowMayBeDelivered`, read by the
 *   outbox before every send).
 * - Its introductions are test events, never billable (`billableEvents.ts`, `TEST_NO_CHARGE_STATUS`): the owner's
 *   totals and the CSV leave them out (`ownerTotals.ts`).
 *
 * How it is recognised:
 * - The marker is the access record's top-level `internal_test_company` field (`{ created_at_iso, created_by }`). It is
 *   written by the signed internal route (`server/routes/internal-test-company.ts`) and by nothing else
 *   (`server/tests/internal-test-company-marker.test.ts` scans the code for writers).
 * - `isInternalTestCompany`: the marker AND the record's email is the configured inbox AND it is approved AND a
 *   deployment company. With no setting nothing is the test company (fail closed).
 * - Any present marker takes the record out of the ordinary company rule (`companyMaySeeJobs` is false for it), so a
 *   marked record that does not match the setting is neither the test company nor an ordinary company.
 * - Every surface opens a job to it only for the pair (the test company AND an internal test job), through
 *   `teamJobAccess`'s `internalTestCompany` flag, which closes every real job (`internal_test_company`).
 *
 * The test company is Blueprint's own, never an outside company, so the pair does not ask it for the Terms acceptance an
 * outside company gives before it sees a job.
 */
import { createHash } from "node:crypto";
import { isInternalTestJob } from "./internalTestJob";

export const INTERNAL_TEST_COMPANY_FIELD = "internal_test_company" as const;

/** The server setting naming the test company's one inbox (web and worker services; never in the repository). */
export const INTERNAL_TEST_COMPANY_EMAIL_SETTING = "BLUEPRINT_INTERNAL_TEST_COMPANY_EMAIL";

/** The test company's name on its record, as the pair's emails and the site's page name it. */
export const INTERNAL_TEST_COMPANY_NAME = "Blueprint internal test company";

/** What the test company is given as the site's name in a test introduction: never any real site's details. */
export const INTERNAL_TEST_SITE_NAME = "Blueprint internal test site";

/** Who an answer the internal route records on the test company's behalf was submitted by. */
export const INTERNAL_TEST_ANSWER_SUBMITTER = "blueprint_internal_test";

/** Who the marker says asked: the only identity the internal route can prove is the Pipeline sync signature it verified. */
export const INTERNAL_TEST_COMPANY_CREATED_BY = "pipeline_sync_signature";

/** The marker as the internal route writes it. */
export interface InternalTestCompanyMarker {
  created_at_iso: string;
  created_by: string;
}

/**
 * The outbox kinds the pair uses: the new-job email and a clarification (to the test company), the site's notice of the
 * answer, and both introduction emails. A test job's row of any other kind is cancelled, as before.
 */
export const INTERNAL_TEST_DELIVERABLE_KINDS: ReadonlySet<string> = new Set(["robot_team_new_task", "job_clarification",
  "company_answered", "introduction_made_company", "introduction_made_site"]);

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The configured inbox, normalized (trimmed, lowercased), or null when it is unset or not an email address. */
export function internalTestCompanyEmail(): string | null {
  const value = String(process.env[INTERNAL_TEST_COMPANY_EMAIL_SETTING] ?? "").trim().toLowerCase();
  return value && EMAIL.test(value) ? value : null;
}

/** The test company's record id: `accessRecordId` of the inbox (sha256 of the lowercased email), or null without one. */
export function internalTestCompanyId(): string | null {
  const email = internalTestCompanyEmail();
  return email ? createHash("sha256").update(email).digest("hex") : null;
}

/** Whether an address is the configured inbox (normalized). False when the setting is unset. */
export function isInternalTestInbox(address: unknown): boolean {
  const inbox = internalTestCompanyEmail();
  return Boolean(inbox) && typeof address === "string" && address.trim().toLowerCase() === inbox;
}

/** Whether a record carries the marker. Any present value counts, so a malformed marker still fails closed. */
export function hasInternalTestCompanyMarker(record: unknown): boolean {
  if (!record || typeof record !== "object") return false;
  const marker = (record as Record<string, unknown>)[INTERNAL_TEST_COMPANY_FIELD];
  return marker !== undefined && marker !== null && marker !== false;
}

/**
 * Whether a company record is the internal test company: the marker as the route writes it, the configured inbox as its
 * email, approved, and a deployment company. With no setting, nothing is.
 */
export function isInternalTestCompany(record: unknown): boolean {
  const inbox = internalTestCompanyEmail();
  if (!inbox || !record || typeof record !== "object") return false;
  const raw = record as Record<string, unknown>;
  const marker = raw[INTERNAL_TEST_COMPANY_FIELD];
  return Boolean(marker) && typeof marker === "object" && !Array.isArray(marker)
    && typeof raw.email === "string" && raw.email.trim().toLowerCase() === inbox
    && raw.status === "approved" && raw.partnerRole === "deployment";
}

/** The same, for a record read by its id: the id must be the configured inbox's (`internalTestCompanyId`). */
export function isInternalTestCompanyRow(companyId: unknown, record: unknown): boolean {
  return typeof companyId === "string" && companyId === internalTestCompanyId() && isInternalTestCompany(record);
}

/** The pair: the internal test company and an internal test job. The only pair any test-company surface opens. */
export function isInternalTestPair(companyId: unknown, company: unknown, job: unknown): boolean {
  return isInternalTestJob(job) && isInternalTestCompanyRow(companyId, company);
}

/** The access options (`loadCompanyJobAccess`) for a path that holds the job and the company: the flag for the pair only. */
export function internalTestPairAccessOptions(job: unknown, companyId: unknown, company: unknown):
  { internalTestCompany: true } | undefined {
  return isInternalTestPair(companyId, company, job) ? { internalTestCompany: true } : undefined;
}

/**
 * The access options for a site-side path that reads the job with no company in hand (the site's notice of an answer, the
 * site's list of companies): on an internal test job, as the internal test company reads it, the one company such a job
 * is shown to; on every other job, none.
 */
export function internalTestJobAccessOptions(job: unknown): { internalTestCompany: true } | undefined {
  return isInternalTestJob(job) ? { internalTestCompany: true } : undefined;
}

/**
 * Whether a row of an internal test job may be delivered: its recipient is exactly the configured inbox and its kind is
 * one the pair uses. Every other row of a test job is cancelled, as is every row when the setting is unset.
 */
export function internalTestRowMayBeDelivered(entry: { kind?: unknown; to?: unknown }): boolean {
  return INTERNAL_TEST_DELIVERABLE_KINDS.has(String(entry.kind ?? "")) && isInternalTestInbox(entry.to);
}

type Readable = { collection(name: string): { doc(id: string): any } };

/**
 * The internal test company's record, read from the store (inside `tx` when given), or null when the setting is unset,
 * the record is missing or it is not the test company. Throws when the read fails.
 */
export async function loadInternalTestCompany(store: Readable | null | undefined, tx?: { get(ref: any): Promise<any> }):
  Promise<{ id: string; record: Record<string, any> } | null> {
  const id = internalTestCompanyId();
  if (!store || !id) return null;
  const ref = store.collection("robotTeamAccess").doc(id);
  const record = (tx ? await tx.get(ref) : await ref.get())?.data?.();
  return isInternalTestCompanyRow(id, record) ? { id, record } : null;
}

/** Whether the company with this id is the internal test company, read from the store. False when it cannot be read. */
export async function loadIsInternalTestCompany(store: Readable | null | undefined, companyId: unknown): Promise<boolean> {
  if (typeof companyId !== "string" || companyId !== internalTestCompanyId()) return false;
  try { return Boolean(await loadInternalTestCompany(store)); } catch { return false; }
}
