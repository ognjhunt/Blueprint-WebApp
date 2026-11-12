/**
 * Sends and responses: which approved deployment companies Blueprint sent a site's job to, what each answered, and
 * what the site is told of it (package C1, 2026-11-12).
 *
 * ## What happens, by hand
 *
 * The product sends nothing to a company. An operator emails an approved company the address of the job in the job
 * library, from their own mailbox, and records that send here. The company answers in the library (signed in, as
 * today) or by email, and the operator records an emailed answer here. A company sees the same summary it could see
 * before: the library card, behind `teamJobAccess(record).listed`.
 *
 * ## Records (Admin SDK only; the rules stay default-deny)
 *
 * - `inboundRequests/{id}/companySends/{sendId}`: `{ schemaVersion: 1, companyId, sentAtIso, sentBy, sentByEmail,
 *   voidedAtIso?, voidedBy? }`. Never deleted; a mistaken send is voided.
 * - `inboundRequests/{id}/robotTeamInterest/{companyId}`: the answer, one per company (`companyId` is the id of the
 *   approved record in `robotTeamAccess`). `recordedBy` says who recorded it ("company" or "operator"). An answer
 *   without it was given before this code, when the product said nothing reached the site: it is never shown to a
 *   site and gets no alias.
 * - `company_aliases` on the job: `{ [companyId]: "A" | "B" | … }`, assigned only inside the transaction that records
 *   a send or an answer, the first time a company is sent the job or answers it, and never reassigned. Reading the
 *   site's page writes nothing.
 * - `operator_listing_hold` on the job: Blueprint stopped showing the job to companies (`teamJobAccess` reads it).
 *
 * ## The privacy rule, by construction
 *
 * The site agreed its summary goes to approved companies "without saying who you are", and a company that a site
 * sees "an alias for each robot team". `projectSiteCompanyActivity` is the only way company records reach the site:
 * it builds a closed `SiteCompanyActivity` field by field from the alias letter, the dates and the state, and reads no
 * other field. No free text from anyone reaches the site's page: not the company's name, email, website or words,
 * and no note of Blueprint's (a note could name the company; an operator with something to say writes to the site).
 */
import { randomUUID } from "node:crypto";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import {
  companyAliasName, isCompanyResponseState,
  type CompanyResponseState, type SiteCompanyActivity, type SiteCompanyEntry,
} from "../../client/src/lib/companyResponses";
import { ROBOT_TEAM_ACCESS_COLLECTION, type RobotTeamAccessRecord } from "./robotTeamEarlyAccess";
import { teamJobAccess, type TeamJobClosedReason } from "./teamJobAccess";
import { projectWebsiteCaptureRights } from "./websiteTaskContext";
import type { AdminJobCompanies } from "../../client/src/types/jobCompanies";
export type { AdminJobCompanies };
import { operatorListingHold } from "./operatorListing";
import { captureUploadUrlFor } from "./captureUploadToken";

export const COMPANY_SENDS_COLLECTION = "companySends";
export const COMPANY_RESPONSES_COLLECTION = "robotTeamInterest";
const JOBS = "inboundRequests";

export type JobCompaniesErrorCode = "job_not_found" | "not_visible" | "company_not_approved" | "send_not_found"
  | "consent_withdrawn" | "not_sent" | "store_unavailable";

export class JobCompaniesError extends Error {
  constructor(readonly code: JobCompaniesErrorCode, message: string) {
    super(message);
    this.name = "JobCompaniesError";
  }
}

export interface OperatorActor { uid: string | null; email: string | null }

type Tx = FirebaseFirestore.Transaction;
type Data = Record<string, any>;
const isRecord = (value: unknown): value is Data => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown): string | null => typeof value === "string" && value.trim() ? value.trim() : null;

/* ------------------------------------------------------------------ aliases */

/** 0 → "A", 25 → "Z", 26 → "AA", 27 → "AB", … */
export function aliasLetter(index: number): string {
  let value = Math.max(0, Math.floor(index));
  let letters = "";
  do {
    letters = String.fromCharCode(65 + (value % 26)) + letters;
    value = Math.floor(value / 26) - 1;
  } while (value >= 0);
  return letters;
}

/** The job's stored aliases, only well-formed entries. */
export function storedAliases(record: Data | null | undefined): Record<string, string> {
  const raw = isRecord(record?.company_aliases) ? record!.company_aliases : {};
  return Object.fromEntries(Object.entries(raw).filter((entry): entry is [string, string] =>
    typeof entry[1] === "string" && /^[A-Z]{1,3}$/.test(entry[1])));
}

/**
 * The company's alias on this job: the stored one, or the next letter. Pure: the caller writes a new one with
 * `writeAlias` in the same transaction, after all its reads. Never reassigned.
 */
function planAlias(record: Data, companyId: string): { alias: string; isNew: boolean } {
  const aliases = storedAliases(record);
  if (aliases[companyId]) return { alias: aliases[companyId], isNew: false };
  const taken = new Set(Object.values(aliases));
  let index = Object.keys(aliases).length;
  while (taken.has(aliasLetter(index))) index += 1;
  return { alias: aliasLetter(index), isNew: true };
}

function writeAlias(tx: Tx, jobRef: FirebaseFirestore.DocumentReference, companyId: string, plan: { alias: string; isNew: boolean }) {
  if (plan.isNew) tx.set(jobRef, { company_aliases: { [companyId]: plan.alias } }, { merge: true });
}

/* ------------------------------------------------------------- companies */

/** An approved company that deploys robots: approved, and not a technology (robot-software) partner. */
export function isApprovedDeploymentCompany(record: Partial<RobotTeamAccessRecord> | null | undefined): boolean {
  return record?.status === "approved" && record.partnerRole !== "technology";
}

/** The address of the job in the job library: the page an approved, signed-in company opens it on. */
export function libraryJobUrl(requestId: string): string {
  const origin = (process.env.VITE_PUBLIC_APP_URL?.trim() || process.env.APP_URL?.trim() || "https://tryblueprint.io").replace(/\/+$/, "");
  return `${origin}/contact/robot-team#job-${encodeURIComponent(requestId)}`;
}

function requireDb() {
  if (!db) throw new JobCompaniesError("store_unavailable", "The job store is unavailable. Try again.");
  return db;
}

/* --------------------------------------------------------------- writes */

/**
 * Record that an operator sent the job to an approved deployment company. Refused unless the job is shared and
 * visible to companies at this moment (`teamJobAccess(record).listed`), and for a company that is not approved.
 */
export async function recordCompanySend(requestId: string, companyId: string, actor: OperatorActor,
  now: () => Date = () => new Date()): Promise<{ sendId: string; alias: string; sentAtIso: string }> {
  const store = requireDb();
  const jobRef = store.collection(JOBS).doc(requestId);
  const companyRef = store.collection(ROBOT_TEAM_ACCESS_COLLECTION).doc(companyId);
  const sendId = randomUUID();
  const captureUrl = captureUploadUrlFor(requestId, "owner");
  return store.runTransaction(async tx => {
    const [jobSnap, companySnap] = [await tx.get(jobRef), await tx.get(companyRef)];
    const record = jobSnap.data();
    if (!jobSnap.exists || !record) throw new JobCompaniesError("job_not_found", "Site job not found.");
    if (projectWebsiteCaptureRights(record).consent_revoked)
      throw new JobCompaniesError("consent_withdrawn", "The site withdrew its permission, so this job is not sent to anyone.");
    if (!teamJobAccess(record).listed)
      throw new JobCompaniesError("not_visible", "This job is not shared and visible to companies right now, so it cannot be sent.");
    if (!companySnap.exists || !isApprovedDeploymentCompany(companySnap.data() as RobotTeamAccessRecord))
      throw new JobCompaniesError("company_not_approved", "Only an approved deployment company can be sent a job.");
    const plan = planAlias(record, companyId);
    // The site's email, written in this same transaction: it exists if and only if the send is recorded.
    const notice = await prepareSiteNotice(tx, requestId, record, { milestone: "job_sent", eventId: `send-${sendId}` }, captureUrl);
    const sentAtIso = now().toISOString();
    writeAlias(tx, jobRef, companyId, plan);
    tx.set(jobRef.collection(COMPANY_SENDS_COLLECTION).doc(sendId), { schemaVersion: 1, companyId, sentAtIso,
      sentBy: actor.uid, sentByEmail: actor.email });
    notice?.();
    return { sendId, alias: plan.alias, sentAtIso };
  });
}

/** Void a mistaken send. It stays on record; the site no longer sees it. */
export async function voidCompanySend(requestId: string, sendId: string, actor: OperatorActor,
  now: () => Date = () => new Date()): Promise<{ voidedAtIso: string }> {
  const store = requireDb();
  const ref = store.collection(JOBS).doc(requestId).collection(COMPANY_SENDS_COLLECTION).doc(sendId);
  return store.runTransaction(async tx => {
    const send = (await tx.get(ref)).data();
    if (!send) throw new JobCompaniesError("send_not_found", "That send is not recorded on this job.");
    if (text(send.voidedAtIso)) return { voidedAtIso: send.voidedAtIso as string };
    const voidedAtIso = now().toISOString();
    tx.set(ref, { voidedAtIso, voidedBy: actor.email ?? actor.uid }, { merge: true });
    return { voidedAtIso };
  });
}

/**
 * Record an answer a company gave by email. Their words are kept for Blueprint only. Refused for a withdrawn job, for
 * a company that is not an approved deployment company, and for one with no standing (not voided) send on this job:
 * an answer the operator records is always about a job Blueprint sent that company.
 */
export async function recordCompanyResponseByOperator(requestId: string, input: { companyId: string;
  state: CompanyResponseState; inputs: string }, actor: OperatorActor,
now: () => Date = () => new Date()): Promise<{ alias: string; updatedAtIso: string }> {
  const store = requireDb();
  const jobRef = store.collection(JOBS).doc(requestId);
  const companyRef = store.collection(ROBOT_TEAM_ACCESS_COLLECTION).doc(input.companyId);
  const captureUrl = captureUploadUrlFor(requestId, "owner");
  return store.runTransaction(async tx => {
    const [jobSnap, companySnap, sendRows] = [await tx.get(jobRef), await tx.get(companyRef),
      await tx.get(jobRef.collection(COMPANY_SENDS_COLLECTION).where("companyId", "==", input.companyId))];
    const record = jobSnap.data();
    if (!jobSnap.exists || !record) throw new JobCompaniesError("job_not_found", "Site job not found.");
    if (projectWebsiteCaptureRights(record).consent_revoked)
      throw new JobCompaniesError("consent_withdrawn", "The site withdrew its permission, so nothing new is recorded for it.");
    const company = companySnap.data() as RobotTeamAccessRecord | undefined;
    if (!company || !isApprovedDeploymentCompany(company))
      throw new JobCompaniesError("company_not_approved", "Only an approved deployment company's answer can be recorded.");
    if (!sendRows.docs.some(doc => !text(doc.data()?.voidedAtIso)))
      throw new JobCompaniesError("not_sent", "This job was not sent to that company (or the send was voided), so its answer cannot be recorded here.");
    const plan = planAlias(record, input.companyId);
    const notice = await prepareSiteNotice(tx, requestId, record, { milestone: "company_answered",
      eventId: answerEventId(plan.alias, input.state), companyAnswerState: input.state }, captureUrl);
    const updatedAtIso = now().toISOString();
    writeAlias(tx, jobRef, input.companyId, plan);
    tx.set(jobRef.collection(COMPANY_RESPONSES_COLLECTION).doc(input.companyId), {
      state: input.state, inputs: input.inputs, email: company.email ?? null, company: company.company ?? null,
      recordedBy: "operator", recordedByUid: actor.uid, recordedByEmail: actor.email, updatedAtIso,
    });
    notice?.();
    return { alias: plan.alias, updatedAtIso };
  });
}

/**
 * The answer email's key: one email per company per state, ever. An answer that goes back to an earlier state (a
 * company interested, then not a fit, then interested again) is shown on the site's page as it stands, but is not
 * emailed again: the second "interested" has the key of the first.
 */
const answerEventId = (alias: string, state: CompanyResponseState) => `${alias}-${state}`;

/**
 * The company's own answer from the job library, inside the route's transaction (call after the route's own reads,
 * before its writes): the company's alias (assigned with its first answer if it was never sent the job) and the site's
 * email, written atomically with the answer. Returns the alias and a function that performs both writes.
 */
export async function prepareCompanyAnswerInTransaction(tx: Tx, jobRef: FirebaseFirestore.DocumentReference, requestId: string,
  record: Data, companyId: string, state: CompanyResponseState, captureUrl: string): Promise<{ alias: string; write: () => void }> {
  const plan = planAlias(record, companyId);
  const notice = await prepareSiteNotice(tx, requestId, record, { milestone: "company_answered",
    eventId: answerEventId(plan.alias, state), companyAnswerState: state }, captureUrl);
  return { alias: plan.alias, write: () => { writeAlias(tx, jobRef, companyId, plan); notice?.(); } };
}

/**
 * Stop showing the job to companies, or show it again. While held, `teamJobAccess` says the job is not listed: the
 * library card, the response route and the site's own sentence ("not visible right now") all follow.
 */
export async function setOperatorListingHold(requestId: string, held: boolean, reason: string | null, actor: OperatorActor,
  now: () => Date = () => new Date()): Promise<{ held: boolean; atIso: string }> {
  const store = requireDb();
  const ref = store.collection(JOBS).doc(requestId);
  return store.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new JobCompaniesError("job_not_found", "Site job not found.");
    const atIso = now().toISOString();
    tx.set(ref, { operator_listing_hold: { held, atIso, by: actor.uid, byEmail: actor.email, reason: held ? reason : null } }, { merge: true });
    return { held, atIso };
  });
}

/* ------------------------------------------------------------- the site's emails */

/**
 * The site's email about a send or an answer, as a durable intent of the transaction that records it
 * (`buildOutboxEntry`, as `robotTeamAccessEmails.prepareAccessEmail` does): the row exists if and only if the activity
 * committed. Read inside the transaction (after the caller's reads, before any write); returns the write, or null when
 * there is nothing to queue: the row already exists (one per key), the job is not visible to companies or was withdrawn
 * at this moment, or the site has no usable email. Whether it is still true is decided again at dispatch
 * (`taskLifecycleNotificationIsCurrent`): held, hidden or withdrawn by then, it is cancelled, never sent.
 */
async function prepareSiteNotice(tx: Tx, requestId: string, record: Data, params: { milestone: "job_sent" | "company_answered";
  eventId: string; companyAnswerState?: CompanyResponseState }, captureUrl: string): Promise<(() => void) | null> {
  const store = requireDb();
  const { buildTaskLifecycleNotification } = await import("./taskLifecycleNotifications");
  const { buildOutboxEntry, CAPTURE_OUTBOX_COLLECTION } = await import("./captureOutbox");
  const { decryptFieldValue } = await import("./field-encryption");
  const key = buildTaskLifecycleNotification({ requestId, to: "", captureUrl, ...params }).idempotencyKey;
  const ref = store.collection(CAPTURE_OUTBOX_COLLECTION).doc(key);
  const existing = await tx.get(ref);
  if (existing.exists) return null;
  if (projectWebsiteCaptureRights(record).consent_revoked || !teamJobAccess(record).listed) return null;
  const to = String(await decryptFieldValue(record.contact?.email ?? "")).trim();
  const notice = buildTaskLifecycleNotification({ requestId, to, captureUrl, ...params });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    logger.warn({ requestId, milestone: params.milestone }, "The site has no usable email; its company email is not queued");
    return null;
  }
  return () => tx.create(ref, buildOutboxEntry(notice));
}

/**
 * At dispatch: the email is still true. A send email, while that send stands (not voided); an answer email, while the
 * company's current answer is still that state. Visibility and withdrawal are checked by the caller.
 */
export async function companyNoticeStillTrue(requestId: string, kind: "job_sent" | "company_answered", idempotencyKey: string,
  record: Data, transaction?: Tx): Promise<boolean> {
  const store = requireDb();
  const prefix = `${requestId}:${kind}:`;
  if (!idempotencyKey.startsWith(prefix)) return false;
  const eventId = idempotencyKey.slice(prefix.length);
  const jobRef = store.collection(JOBS).doc(requestId);
  if (kind === "job_sent") {
    const sendId = /^send-(.+)$/.exec(eventId)?.[1];
    if (!sendId) return false;
    const ref = jobRef.collection(COMPANY_SENDS_COLLECTION).doc(sendId);
    const send = (transaction ? await transaction.get(ref) : await ref.get()).data();
    return Boolean(send) && !text(send!.voidedAtIso);
  }
  const match = /^([A-Z]{1,3})-(interested|declined|needs_something)$/.exec(eventId);
  if (!match) return false;
  const companyId = Object.entries(storedAliases(record)).find(([, alias]) => alias === match[1])?.[0];
  if (!companyId) return false;
  const ref = jobRef.collection(COMPANY_RESPONSES_COLLECTION).doc(companyId);
  const response = (transaction ? await transaction.get(ref) : await ref.get()).data();
  return response?.state === match[2];
}

/* ------------------------------------------------------------- reading every row */

/** Rows per page when reading a job's sends and answers, or the approved companies. Small in tests. */
let pageSize = 200;
export function setJobCompaniesPageSizeForTests(size: number): void { pageSize = Math.max(1, Math.floor(size)); }

/**
 * Every document a query matches, in document-id order, page by page: never a first page taken as the whole record
 * (`server/AGENTS.md`: page relevant history rather than stopping at a result count).
 */
async function readAll(query: FirebaseFirestore.Query): Promise<Array<{ id: string; data: Data }>> {
  const rows: Array<{ id: string; data: Data }> = [];
  let after: string | null = null;
  for (;;) {
    let page = query.orderBy("__name__").limit(pageSize);
    if (after) page = page.startAfter(after);
    const snapshot = await page.get();
    for (const doc of snapshot.docs) rows.push({ id: doc.id, data: (doc.data() ?? {}) as Data });
    if (snapshot.docs.length < pageSize) return rows;
    after = snapshot.docs[snapshot.docs.length - 1].id;
  }
}

/* ------------------------------------------------------------- what the site sees */

/** A stored instant, only when it is one: the site's dates never carry free text. */
const instant = (value: unknown): string | null =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?Z$/.test(value) ? value : null;

/**
 * The site's view of company activity on its job: built field by field from the alias letter, the dates and the state.
 * It reads no other field of a send or an answer, so no free text (a company's name, email, website or words, or any
 * note) can reach the site. A voided send, a record without an alias, and an answer recorded before this code (no
 * `recordedBy`) are not shown. In date order; a send before an answer at the same instant.
 */
export function projectSiteCompanyActivity(input: { aliases: Record<string, string>;
  sends: ReadonlyArray<Data>; responses: ReadonlyArray<{ id: string; data: Data }> }): SiteCompanyActivity {
  const entries: SiteCompanyEntry[] = [];
  for (const send of input.sends) {
    const letter = typeof send.companyId === "string" ? input.aliases[send.companyId] : undefined;
    const atIso = instant(send.sentAtIso);
    if (!letter || !atIso || text(send.voidedAtIso)) continue;
    entries.push({ kind: "sent", alias: companyAliasName(letter), atIso });
  }
  for (const response of input.responses) {
    const letter = input.aliases[response.id];
    const atIso = instant(response.data.updatedAtIso);
    const state = response.data.state;
    const recordedBy = response.data.recordedBy;
    if (!letter || !atIso || !isCompanyResponseState(state) || (recordedBy !== "company" && recordedBy !== "operator")) continue;
    entries.push({ kind: "answered", alias: companyAliasName(letter), atIso, state });
  }
  entries.sort((a, b) => a.atIso.localeCompare(b.atIso) || (a.kind === b.kind ? 0 : a.kind === "sent" ? -1 : 1));
  return { entries, interested: entries.some(entry => entry.kind === "answered" && entry.state === "interested") };
}

/**
 * Read the job's sends and answers and project them for the site. Reads only: it writes nothing, ever (aliases are
 * assigned where a send or an answer is recorded). A withdrawn job shows nothing.
 */
export async function loadSiteCompanyActivity(requestId: string): Promise<SiteCompanyActivity> {
  const store = requireDb();
  const jobRef = store.collection(JOBS).doc(requestId);
  const record = (await jobRef.get()).data();
  if (!record || projectWebsiteCaptureRights(record).consent_revoked) return { entries: [], interested: false };
  const [sends, responses] = await Promise.all([readAll(jobRef.collection(COMPANY_SENDS_COLLECTION)),
    readAll(jobRef.collection(COMPANY_RESPONSES_COLLECTION))]);
  return projectSiteCompanyActivity({ aliases: storedAliases(record), sends: sends.map(row => row.data), responses });
}

/* ------------------------------------------------------------- the operator's panel */


const CLOSED_WORDS: Partial<Record<TeamJobClosedReason, string>> = {
  operator_paused: "the site paused or closed it",
  blueprint_hold: "Blueprint stopped showing it",
  consent_withdrawn: "the site withdrew its permission",
  rights_blocked: "the rights review blocked the capture",
  rights_needs_review: "the rights review has not cleared the capture",
  development_only: "a development capture",
};

/** The job's sharing state in words, as `teamJobAccess` decides it. */
export function sharingInWords(record: Data): AdminJobCompanies["sharing"] {
  const shared = isRecord(record.public_task_listing) && record.public_task_listing.enabled === true;
  const access = teamJobAccess(record);
  if (access.listed) return { state: "shared_visible", words: "Shared and visible to approved companies.", reason: null };
  if (!shared) return { state: "not_shared", words: "Not shared: the site has not shared a summary.", reason: access.reason };
  const why = CLOSED_WORDS[access.reason] ?? "the summary is not a current grant";
  return { state: "shared_not_visible", words: `Shared, but not visible to companies right now: ${why}.`, reason: access.reason };
}

/** Everything the operator's "Deployment companies" panel shows. Admin only: it carries company names and words. */
export async function loadAdminJobCompanies(requestId: string): Promise<AdminJobCompanies | null> {
  const store = requireDb();
  const jobRef = store.collection(JOBS).doc(requestId);
  const [job, sendRows, responseRows, approvedRows] = await Promise.all([jobRef.get(),
    readAll(jobRef.collection(COMPANY_SENDS_COLLECTION)), readAll(jobRef.collection(COMPANY_RESPONSES_COLLECTION)),
    readAll(store.collection(ROBOT_TEAM_ACCESS_COLLECTION).where("status", "==", "approved"))]);
  const record = job.data();
  if (!job.exists || !record) return null;
  const aliases = storedAliases(record);
  const names = new Map<string, Partial<RobotTeamAccessRecord>>(approvedRows.map(row => [row.id, row.data as RobotTeamAccessRecord]));
  const companies = approvedRows.filter(row => isApprovedDeploymentCompany(row.data as RobotTeamAccessRecord))
    .map(row => ({ id: row.id, company: String(row.data.company ?? ""), email: String(row.data.email ?? "") }))
    .sort((a, b) => a.company.localeCompare(b.company));
  const sends = sendRows
    .map(({ id, data }) => ({ sendId: id, companyId: String(data.companyId ?? ""), company: text(names.get(String(data.companyId))?.company),
      alias: aliases[String(data.companyId)] ?? null, sentAtIso: String(data.sentAtIso ?? ""), sentBy: text(data.sentByEmail) ?? text(data.sentBy),
      voidedAtIso: text(data.voidedAtIso), voidedBy: text(data.voidedBy) }))
    .sort((a, b) => a.sentAtIso.localeCompare(b.sentAtIso));
  const responses = responseRows
    .map(({ id, data }) => ({ companyId: id, company: text(data.company), email: text(data.email), alias: aliases[id] ?? null,
      state: isCompanyResponseState(data.state) ? data.state : null, inputs: typeof data.inputs === "string" ? data.inputs : "",
      updatedAtIso: text(data.updatedAtIso),
      recordedBy: data.recordedBy === "operator" ? "operator" as const : data.recordedBy === "company" ? "company" as const
        : "before_c1" as const }))
    .sort((a, b) => String(a.updatedAtIso).localeCompare(String(b.updatedAtIso)));
  return { sharing: sharingInWords(record), hold: operatorListingHold(record),
    consentRevoked: projectWebsiteCaptureRights(record).consent_revoked === true, libraryUrl: libraryJobUrl(requestId),
    companies, sends, responses };
}
