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
 *   approved record in `robotTeamAccess`). `recordedBy` says who recorded it; `noteForSite` is Blueprint's one
 *   sentence for the site, written only by an operator.
 * - `company_aliases` on the job: `{ [companyId]: "A" | "B" | … }`, assigned in a transaction the first time a
 *   company is sent the job or answers it, and never reassigned.
 * - `operator_listing_hold` on the job: Blueprint stopped showing the job to companies (`teamJobAccess` reads it).
 *
 * ## The privacy rule, by construction
 *
 * The site agreed its summary goes to approved companies "without saying who you are", and a company that a site
 * sees "an alias for each robot team". `projectSiteCompanyActivity` is the only way company records reach the site:
 * it builds a closed `SiteCompanyActivity` field by field from the alias letter, the dates, the state and Blueprint's
 * own note, and reads no other field. A company's name, email, website and words never enter it.
 */
import { randomUUID } from "node:crypto";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import {
  companyAliasName, isCompanyResponseState, isSiteNote,
  type CompanyResponseState, type SiteCompanyActivity, type SiteCompanyEntry,
} from "../../client/src/lib/companyResponses";
import { ROBOT_TEAM_ACCESS_COLLECTION, type RobotTeamAccessRecord } from "./robotTeamEarlyAccess";
import { teamJobAccess, type TeamJobClosedReason } from "./teamJobAccess";
import { projectWebsiteCaptureRights } from "./websiteTaskContext";
import type { AdminJobCompanies } from "../../client/src/types/jobCompanies";
export type { AdminJobCompanies };
import { operatorListingHold } from "./operatorListing";

export const COMPANY_SENDS_COLLECTION = "companySends";
export const COMPANY_RESPONSES_COLLECTION = "robotTeamInterest";
const JOBS = "inboundRequests";

export type JobCompaniesErrorCode = "job_not_found" | "not_visible" | "company_not_approved" | "send_not_found"
  | "consent_withdrawn" | "note_invalid" | "store_unavailable";

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
 * The company's alias on this job: the stored one, or the next letter, written in the caller's transaction (after its
 * reads). Never reassigned.
 */
function aliasInTransaction(tx: Tx, jobRef: FirebaseFirestore.DocumentReference, record: Data, companyId: string): string {
  const aliases = storedAliases(record);
  if (aliases[companyId]) return aliases[companyId];
  const taken = new Set(Object.values(aliases));
  let index = Object.keys(aliases).length;
  while (taken.has(aliasLetter(index))) index += 1;
  const alias = aliasLetter(index);
  tx.set(jobRef, { company_aliases: { [companyId]: alias } }, { merge: true });
  return alias;
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
  const result = await store.runTransaction(async tx => {
    const [jobSnap, companySnap] = [await tx.get(jobRef), await tx.get(companyRef)];
    const record = jobSnap.data();
    if (!jobSnap.exists || !record) throw new JobCompaniesError("job_not_found", "Site job not found.");
    if (projectWebsiteCaptureRights(record).consent_revoked)
      throw new JobCompaniesError("consent_withdrawn", "The site withdrew its permission, so this job is not sent to anyone.");
    if (!teamJobAccess(record).listed)
      throw new JobCompaniesError("not_visible", "This job is not shared and visible to companies right now, so it cannot be sent.");
    if (!companySnap.exists || !isApprovedDeploymentCompany(companySnap.data() as RobotTeamAccessRecord))
      throw new JobCompaniesError("company_not_approved", "Only an approved deployment company can be sent a job.");
    const alias = aliasInTransaction(tx, jobRef, record, companyId);
    const sentAtIso = now().toISOString();
    tx.set(jobRef.collection(COMPANY_SENDS_COLLECTION).doc(sendId), { schemaVersion: 1, companyId, sentAtIso,
      sentBy: actor.uid, sentByEmail: actor.email });
    return { sendId, alias, sentAtIso };
  });
  await notifySite(requestId, { milestone: "job_sent", eventId: `send-${sendId}` });
  return result;
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

/** Whether Blueprint's note for the site names the company: refused, since the site is never told who it is. */
function noteNamesCompany(note: string, company: Partial<RobotTeamAccessRecord>): boolean {
  const lower = note.toLowerCase();
  const website = text(company.website)?.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
  return [text(company.company), text(company.email), website, text(company.name)]
    .some(value => Boolean(value) && value!.length >= 2 && lower.includes(value!.toLowerCase()));
}

/**
 * Record an answer a company gave by email. Their words are kept for Blueprint only; the optional note is one plain
 * sentence for the site, which may not name the company. Refused after the site withdrew its permission.
 */
export async function recordCompanyResponseByOperator(requestId: string, input: { companyId: string;
  state: CompanyResponseState; inputs: string; noteForSite: string | null }, actor: OperatorActor,
now: () => Date = () => new Date()): Promise<{ alias: string; updatedAtIso: string }> {
  const store = requireDb();
  if (input.noteForSite !== null && !isSiteNote(input.noteForSite))
    throw new JobCompaniesError("note_invalid", "The note for the site must be one plain sentence of at most 240 characters, with no link or email address.");
  const jobRef = store.collection(JOBS).doc(requestId);
  const companyRef = store.collection(ROBOT_TEAM_ACCESS_COLLECTION).doc(input.companyId);
  const result = await store.runTransaction(async tx => {
    const [jobSnap, companySnap] = [await tx.get(jobRef), await tx.get(companyRef)];
    const record = jobSnap.data();
    if (!jobSnap.exists || !record) throw new JobCompaniesError("job_not_found", "Site job not found.");
    if (projectWebsiteCaptureRights(record).consent_revoked)
      throw new JobCompaniesError("consent_withdrawn", "The site withdrew its permission, so nothing new is recorded for it.");
    const company = companySnap.data() as RobotTeamAccessRecord | undefined;
    if (!company || !isApprovedDeploymentCompany(company))
      throw new JobCompaniesError("company_not_approved", "Only an approved deployment company's answer can be recorded.");
    if (input.noteForSite && noteNamesCompany(input.noteForSite, company))
      throw new JobCompaniesError("note_invalid", "The note for the site may not name the company: the site is told an alias only.");
    const alias = aliasInTransaction(tx, jobRef, record, input.companyId);
    const updatedAtIso = now().toISOString();
    tx.set(jobRef.collection(COMPANY_RESPONSES_COLLECTION).doc(input.companyId), {
      state: input.state, inputs: input.inputs, email: company.email ?? null, company: company.company ?? null,
      recordedBy: "operator", recordedByUid: actor.uid, recordedByEmail: actor.email,
      noteForSite: input.noteForSite, updatedAtIso,
    });
    return { alias, updatedAtIso };
  });
  await notifySite(requestId, { milestone: "company_answered", eventId: `${result.alias}-${input.state}`, companyAnswerState: input.state });
  return result;
}

/**
 * The company's own answer from the job library assigns its alias in the route's transaction (the route reads the
 * job first), so a company that answers without a send still appears to the site in order.
 */
export function assignAliasInTransaction(tx: Tx, jobRef: FirebaseFirestore.DocumentReference, record: Data, companyId: string): string {
  return aliasInTransaction(tx, jobRef, record, companyId);
}

/** After a company's own answer: the one email that tells the site. Never fails the caller. */
export async function notifySiteOfCompanyAnswer(requestId: string, alias: string, state: CompanyResponseState): Promise<void> {
  await notifySite(requestId, { milestone: "company_answered", eventId: `${alias}-${state}`, companyAnswerState: state });
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

async function notifySite(requestId: string, params: { milestone: "job_sent" | "company_answered"; eventId: string;
  companyAnswerState?: CompanyResponseState }): Promise<void> {
  try {
    const { enqueueTaskLifecycleNotification } = await import("./taskLifecycleNotifications");
    await enqueueTaskLifecycleNotification({ requestId, ...params });
  } catch (error) {
    logger.warn({ error, requestId, milestone: params.milestone }, "Could not queue the site's company email");
  }
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

/* ------------------------------------------------------------- what the site sees */

/** A stored instant, only when it is one: the site's dates never carry free text. */
const instant = (value: unknown): string | null =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?Z$/.test(value) ? value : null;

/**
 * The site's view of company activity on its job: built field by field from the alias letter, the dates, the state
 * and Blueprint's own note (only when an operator recorded the answer, and only when it is one plain sentence). It
 * reads no other field of a send or an answer, so a company's name, email, website and words cannot reach the site.
 * A voided send, and a record without an alias, is not shown. In date order; a send before an answer on the same day.
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
    if (!letter || !atIso || !isCompanyResponseState(state)) continue;
    const note = response.data.recordedBy === "operator" && isSiteNote(response.data.noteForSite) ? response.data.noteForSite : null;
    entries.push({ kind: "answered", alias: companyAliasName(letter), atIso, state, noteForSite: note });
  }
  entries.sort((a, b) => a.atIso.localeCompare(b.atIso) || (a.kind === b.kind ? 0 : a.kind === "sent" ? -1 : 1));
  return { entries, interested: entries.some(entry => entry.kind === "answered" && entry.state === "interested") };
}

/**
 * Read the job's sends and answers and project them for the site. A company recorded before aliases existed (an
 * answer from the library, earlier) is given its alias here, once, in the order it first appeared, so the site sees
 * every answer that exists.
 */
export async function loadSiteCompanyActivity(requestId: string): Promise<SiteCompanyActivity> {
  const store = requireDb();
  const jobRef = store.collection(JOBS).doc(requestId);
  const [job, sendRows, responseRows] = await Promise.all([jobRef.get(),
    jobRef.collection(COMPANY_SENDS_COLLECTION).limit(200).get(), jobRef.collection(COMPANY_RESPONSES_COLLECTION).limit(200).get()]);
  const record = job.data();
  if (!record || projectWebsiteCaptureRights(record).consent_revoked) return { entries: [], interested: false };
  const sends = sendRows.docs.map(doc => doc.data() as Data);
  const responses = responseRows.docs.map(doc => ({ id: doc.id, data: doc.data() as Data }));
  let aliases = storedAliases(record);
  const firstSeen = new Map<string, string>();
  for (const send of sends) if (typeof send.companyId === "string") firstSeen.set(send.companyId,
    [firstSeen.get(send.companyId), text(send.sentAtIso) ?? ""].filter(Boolean).sort()[0] ?? "");
  for (const response of responses) firstSeen.set(response.id,
    [firstSeen.get(response.id), text(response.data.updatedAtIso) ?? ""].filter(Boolean).sort()[0] ?? "");
  const missing = [...firstSeen.entries()].filter(([id]) => !aliases[id]).sort((a, b) => a[1].localeCompare(b[1])).map(([id]) => id);
  if (missing.length) {
    aliases = await store.runTransaction(async tx => {
      const current = (await tx.get(jobRef)).data() ?? {};
      let working = { ...current };
      for (const id of missing) {
        const alias = aliasInTransaction(tx, jobRef, working, id);
        working = { ...working, company_aliases: { ...storedAliases(working), [id]: alias } };
      }
      return storedAliases(working);
    });
  }
  return projectSiteCompanyActivity({ aliases, sends, responses });
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
  const [job, sendRows, responseRows, approved] = await Promise.all([jobRef.get(),
    jobRef.collection(COMPANY_SENDS_COLLECTION).limit(200).get(), jobRef.collection(COMPANY_RESPONSES_COLLECTION).limit(200).get(),
    store.collection(ROBOT_TEAM_ACCESS_COLLECTION).where("status", "==", "approved").limit(500).get()]);
  const record = job.data();
  if (!job.exists || !record) return null;
  const aliases = storedAliases(record);
  const names = new Map<string, Partial<RobotTeamAccessRecord>>(approved.docs.map(doc => [doc.id, doc.data() as RobotTeamAccessRecord]));
  const companies = approved.docs.filter(doc => isApprovedDeploymentCompany(doc.data() as RobotTeamAccessRecord))
    .map(doc => ({ id: doc.id, company: String(doc.data().company ?? ""), email: String(doc.data().email ?? "") }))
    .sort((a, b) => a.company.localeCompare(b.company));
  const sends = sendRows.docs.map(doc => ({ id: doc.id, data: doc.data() as Data }))
    .map(({ id, data }) => ({ sendId: id, companyId: String(data.companyId ?? ""), company: text(names.get(String(data.companyId))?.company),
      alias: aliases[String(data.companyId)] ?? null, sentAtIso: String(data.sentAtIso ?? ""), sentBy: text(data.sentByEmail) ?? text(data.sentBy),
      voidedAtIso: text(data.voidedAtIso), voidedBy: text(data.voidedBy) }))
    .sort((a, b) => a.sentAtIso.localeCompare(b.sentAtIso));
  const responses = responseRows.docs.map(doc => ({ id: doc.id, data: doc.data() as Data }))
    .map(({ id, data }) => ({ companyId: id, company: text(data.company), email: text(data.email), alias: aliases[id] ?? null,
      state: isCompanyResponseState(data.state) ? data.state : null, inputs: typeof data.inputs === "string" ? data.inputs : "",
      noteForSite: text(data.noteForSite), updatedAtIso: text(data.updatedAtIso),
      recordedBy: data.recordedBy === "operator" ? "operator" as const : "company" as const }))
    .sort((a, b) => String(a.updatedAtIso).localeCompare(String(b.updatedAtIso)));
  return { sharing: sharingInWords(record), hold: operatorListingHold(record),
    consentRevoked: projectWebsiteCaptureRights(record).consent_revoked === true, libraryUrl: libraryJobUrl(requestId),
    companies, sends, responses };
}
