/**
 * Sends and responses: which approved deployment companies Blueprint sent a site's job to, what each answered, and
 * what the site is told of it (package C1, 2026-11-12).
 *
 * ## What happens (automatic since 2026-11-12, package E)
 *
 * When a job first becomes listed, `jobAutoSend.ts` records one send per approved deployment company (`sentBy:
 * "system"`) and emails the companies that asked for job emails. A company answers on the job's own page. Staff no
 * longer record a send or an answer by hand (2026-11-22); rows they recorded before are still read. Introductions are
 * `jobIntroductions.ts`.
 *
 * ## Records (Admin SDK only; the rules stay default-deny)
 *
 * - `inboundRequests/{id}/companySends/{sendId}`: `{ schemaVersion: 1, companyId, sentAtIso, sentBy, sentByEmail,
 *   voidedAtIso?, voidedBy? }`. `sentBy` is `"system"` for the automatic send (id `system-<companyId>`), else the
 *   operator's uid. Never deleted; a mistaken send is voided.
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
 * it builds a closed `SiteCompanyActivity` field by field from the alias letter, the dates, the state and the
 * company's reason (`siteReasonOf`), and reads no other field. The reason is the company's own words about its answer,
 * only when given under the current line, with the company's known identity (its name, its person's name, email,
 * website and their domains) and any other email, phone number or link taken out by `removeIdentifyingDetails`. Never
 * the company's name, email or website, and no note of Blueprint's (a note could name the company; an operator with
 * something to say writes to the site).
 */
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import {
  COMPANY_NAME_STATEMENT_VERSIONS, COMPANY_RESPONSE_STATEMENT_VERSIONS, COMPANY_RESPONSE_STATES, replyByIso,
  CHARGE_MODELS, COMPANY_ESTIMATE_STATEMENT_VERSIONS, SIMILAR_JOBS, isApplicationEstimate, type CompanyReplyDetails, COMPANY_START_WINDOWS, INTRODUCIBLE_RESPONSE_STATES, companyAliasName, isCompanyResponseState,
  type CompanyResponseState, type IntroducedCompany, type SiteCompanyActivity, type SiteCompanyEntry,
} from "../../client/src/lib/companyResponses";
import { ROBOT_TEAM_ACCESS_COLLECTION, type RobotTeamAccessRecord } from "./robotTeamEarlyAccess";
import { teamJobAccess, type TeamJobClosedReason } from "./teamJobAccess";
import { companyMaySeeJobs } from "./companyTerms";
import { introductionAttemptOf, introductionCompanyKey, RETRYABLE_CANCEL_REASONS } from "./jobIntroductionGate";
import { projectWebsiteCaptureRights } from "./websiteCaptureRights";
import type { AdminJobCompanies } from "../../client/src/types/jobCompanies";
export type { AdminJobCompanies };
import { operatorListingHold } from "./operatorListing";
import { REMOVED, removeIdentifyingDetails, type KnownSiteIdentity } from "../../client/src/lib/contactRedaction";
import { COMPANY_JOB_VIEWS_COLLECTION } from "./companyJobViews";
import { clarificationOnReply, questionOnReply } from "./jobClarifications";

export const COMPANY_SENDS_COLLECTION = "companySends";
export const INTRODUCTIONS_COLLECTION = "introductions";
/** The event id of the site's one `job_sent` email for the automatic send. */
export const AUTO_SEND_EVENT_ID = "companies";
export const COMPANY_RESPONSES_COLLECTION = "robotTeamInterest";
const JOBS = "inboundRequests";

export type JobCompaniesErrorCode = "job_not_found" | "store_unavailable";

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

/** The company's page for the job (`/jobs/:jobId`): the page an approved, signed-in company opens and answers it on. */
export function companyJobUrl(requestId: string): string {
  const origin = (process.env.VITE_PUBLIC_APP_URL?.trim() || process.env.APP_URL?.trim() || "https://tryblueprint.io").replace(/\/+$/, "");
  return `${origin}/jobs/${encodeURIComponent(requestId)}`;
}
/** Kept name: the address an operator gives a company is now the job's own page. */
export const libraryJobUrl = companyJobUrl;

function requireDb() {
  if (!db) throw new JobCompaniesError("store_unavailable", "The job store is unavailable. Try again.");
  return db;
}

/* --------------------------------------------------------------- writes */

/** One notice per company and response state, including when the company edits its question. */
const answerEventId = (alias: string, state: CompanyResponseState) => `${alias}-${state}`;

/** An introduction to this company is on record for the job (made or cancelled): "Introduce us" is not offered again. */
async function introductionOnRecord(tx: Tx, jobRef: FirebaseFirestore.DocumentReference, companyId: string): Promise<boolean> {
  return (await tx.get(jobRef.collection(INTRODUCTIONS_COLLECTION).doc(companyId))).exists;
}

/**
 * The company's own answer from the job library, inside the route's transaction (call after the route's own reads,
 * before its writes): the company's alias (assigned with its first answer if it was never sent the job) and the site's
 * email, written atomically with the answer. Returns the alias and a function that performs both writes.
 */
export async function prepareCompanyAnswerInTransaction(tx: Tx, jobRef: FirebaseFirestore.DocumentReference, requestId: string,
  record: Data, companyId: string, state: CompanyResponseState, captureUrl: string): Promise<{ alias: string; write: () => void }> {
  const plan = planAlias(record, companyId);
  // The company's own answer is given under the current line (the route accepts no other), so it consents to an
  // introduction; its "Need more details" note is the question the site answers on its job page.
  const notice = await prepareSiteNotice(tx, requestId, record, { milestone: "company_answered",
    eventId: answerEventId(plan.alias, state), companyAnswerState: state,
    introductionOffered: !(await introductionOnRecord(tx, jobRef, companyId)), questionOnPage: true }, captureUrl);
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
export async function prepareSiteNotice(tx: Tx, requestId: string, record: Data, params: { milestone: "company_answered";
  eventId: string; companyAnswerState?: CompanyResponseState; introductionOffered?: boolean;
  questionOnPage?: boolean }, captureUrl: string): Promise<(() => void) | null> {
  const store = requireDb();
  const { buildTaskLifecycleNotification } = await import("./taskLifecycleNotifications");
  const { buildOutboxEntry, CAPTURE_OUTBOX_COLLECTION } = await import("./captureOutbox");
  const { decryptFieldValue } = await import("./field-encryption");
  const build = buildTaskLifecycleNotification as (input: Record<string, unknown>) => ReturnType<typeof buildTaskLifecycleNotification>;
  const key = build({ requestId, to: "", captureUrl, ...params }).idempotencyKey;
  const ref = store.collection(CAPTURE_OUTBOX_COLLECTION).doc(key);
  const existing = await tx.get(ref);
  if (existing.exists) return null;
  if (projectWebsiteCaptureRights(record).consent_revoked || !teamJobAccess(record).listed) return null;
  const to = String(await decryptFieldValue(record.contact?.email ?? "")).trim();
  const notice = build({ requestId, to, captureUrl, ...params });
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
  if (kind === "job_sent" && eventId === AUTO_SEND_EVENT_ID) {
    // The automatic send's one email: true while at least one system send stands.
    const query = jobRef.collection(COMPANY_SENDS_COLLECTION).where("sentBy", "==", "system");
    const rows = transaction ? await transaction.get(query) : await query.get();
    return rows.docs.some(doc => !text(doc.data()?.voidedAtIso));
  }
  if (kind === "job_sent") {
    const sendId = /^send-(.+)$/.exec(eventId)?.[1];
    if (!sendId) return false;
    const ref = jobRef.collection(COMPANY_SENDS_COLLECTION).doc(sendId);
    const send = (transaction ? await transaction.get(ref) : await ref.get()).data();
    return Boolean(send) && !text(send!.voidedAtIso);
  }
  const match = new RegExp(`^([A-Z]{1,3})-(${COMPANY_RESPONSE_STATES.join("|")})$`).exec(eventId);
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

/** The latest edit on a legacy answer cannot supply its original answer time. */
export function firstAnswerTimestamp(prior: Data | undefined, answeredAtIso: string): string | null {
  return prior ? instant(prior.firstAnsweredAtIso) : answeredAtIso;
}

function firstRecordedAnswer(responses: readonly { data: Data }[]): string | null {
  const dates = responses.filter(({ data }) => isCompanyResponseState(data.state)
    && (data.recordedBy === "company" || data.recordedBy === "operator")).map(({ data }) => instant(data.firstAnsweredAtIso));
  if (dates.some(date => date === null)) return null;
  return dates.sort()[0] ?? null;
}

function jobStartTime(value: unknown): string | null {
  const date = value instanceof Date ? value : (value as { toDate?: () => Date } | null)?.toDate?.();
  return date instanceof Date && Number.isFinite(date.getTime()) ? date.toISOString() : instant(value);
}

/** What the site's view needs to know about each company beyond its answer: introductions and whether one may be asked. */
export interface SiteCompanyIntroductionFacts {
  /** `introductions/{companyId}` documents: when asked, and what the site was given. */
  introductions: ReadonlyArray<{ id: string; data: Data }>;
  /** Companies that are approved deployment companies right now. */
  approvedDeploymentCompanies: ReadonlySet<string>;
  /** The job is listed right now (`loadCompanyJobAccess`). */
  listed: boolean;
}

/** The company's details as the site is given them, only from an introduction document's `companyShared`. */
function introducedCompany(intro: Data | undefined): IntroducedCompany | undefined {
  const shared = isRecord(intro?.companyShared) ? intro!.companyShared : null;
  const name = text(shared?.company), email = text(shared?.email);
  if (!name || !email) return undefined;
  const website = text(shared?.website);
  return { name, contactName: text(shared?.contactName) ?? "", email, ...(website ? { website } : {}) };
}

/* ------------------------------------------------------------- the company's reason, for the site */

/** The longest reason the site is shown: the answer form's own limit. */
const REASON_MAX = 2000;

/**
 * What Blueprint holds about a company, as the identity to take out of its words: its name (also each distinctive
 * capitalised word of it), its person's name, its email and the email's domain, its website and the website's host
 * (with and without "www."). From every record given (the approved access record, and the answer's own copy of the
 * company's name and email), so a company no longer approved is taken out of its words all the same.
 */
export function knownCompanyIdentity(...records: Array<Data | null | undefined>): KnownSiteIdentity {
  const organisations: string[] = [], people: string[] = [], contacts: string[] = [];
  for (const record of records) {
    const company = text(record?.company), person = text(record?.name), email = text(record?.email), website = text(record?.website);
    if (company) organisations.push(company);
    if (person) people.push(person);
    if (email) contacts.push(email, ...(email.includes("@") ? [email.slice(email.lastIndexOf("@") + 1)] : []));
    if (website) {
      contacts.push(website, website.replace(/^[a-z][a-z0-9+.-]*:\/\//i, ""));
      try {
        const host = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(website) ? website : `https://${website}`).hostname;
        if (host) contacts.push(host, host.replace(/^www\./i, ""));
      } catch { /* not a web address: the typed value alone */ }
    }
  }
  return { names: [...organisations, ...people], organisations, addresses: [], contacts };
}

/**
 * Whether the company's words may be read by the site: an answer the company gave on its job page under the current
 * line, which tells it "The site is told your answer" (and its accepted Terms: "A site sees your answer under an
 * alias"), or one Blueprint recorded from the company's email since the staff form says the site reads the words
 * (`wordsShownToSite`). An answer given under the older line ("The site is told your response, not your company's name
 * or your words"), with no line, or recorded by staff under "staff only, never shown to the site" never shows its words.
 */
export function answerWordsMayReachSite(answer: Data | null | undefined): boolean {
  return (answer?.recordedBy === "company" && COMPANY_RESPONSE_STATEMENT_VERSIONS.includes(String(answer.statementVersion)))
    || (answer?.recordedBy === "operator" && answer.wordsShownToSite === true);
}

/**
 * The company's reason as the site may read it, or null: its words about its answer with its known identity taken out
 * (each name becomes "the company"; emails, phone numbers, websites and links become "[removed]"). Null when the words
 * may not reach the site (`answerWordsMayReachSite`), when there are none, when nothing worth reading is left once the
 * details are out, or when the removal fails: the site's page then says so plainly (`NO_REASON_SHOWN`).
 */
export function siteReasonOf(answer: Data | null | undefined, identity: KnownSiteIdentity): string | null {
  if (!answerWordsMayReachSite(answer)) return null;
  const words = typeof answer!.inputs === "string" ? answer!.inputs.trim().slice(0, REASON_MAX) : "";
  if (!words) return null;
  try {
    // A web address whose host was taken out leaves no path behind ("[removed]/contact" is "[removed]").
    const shown = removeIdentifyingDetails(words, identity, { nameAs: "company" })
      .replace(/\[removed\]\/\S*?(?=[.,;:!?)]*(?:\s|$))/g, REMOVED).trim();
    const left = shown.split(REMOVED).join(" ").replace(/\bthe company\b/gi, " ").replace(/[^\p{L}\p{N}]+/gu, "");
    return left.length >= 3 ? shown : null;
  } catch (error) {
    logger.warn({ err: error }, "A company's words could not be cleared for the site; the site is told no reason is shown");
    return null;
  }
}

/**
 * An answer the site may ask to be introduced to: `interested` or `tested_can_do` (E9), given by the company itself
 * under the current line, or recorded by Blueprint from the company's email (2026-11-20). The company's consent to the
 * exchange is the current Terms it accepted, which every introduction checks (`companyMaySeeJobs`): "It sees your
 * company's name and your contact details only when it asks for an introduction after you answered Interested or
 * Tested it: can do." An answer the company gave under the older line ("not your company's name") stays refused until
 * it answers again: that line promised the opposite.
 */
export function answerConsentsToIntroduction(answer: Data | null | undefined): boolean {
  if (!answer || !INTRODUCIBLE_RESPONSE_STATES.includes(answer.state)) return false;
  return (answer.recordedBy === "company" && COMPANY_RESPONSE_STATEMENT_VERSIONS.includes(String(answer.statementVersion)))
    || answer.recordedBy === "operator";
}

/**
 * The company's name and website as the site may read them with its answer, or null: only for an answer the company
 * gave itself under a line that says the site sees them (`COMPANY_NAME_STATEMENT_VERSIONS`), from its approved record.
 */
export function applicantShownToSite(answer: Data | null | undefined, company: Data | undefined): { name: string; website: string | null } | null {
  if (answer?.recordedBy !== "company" || !COMPANY_NAME_STATEMENT_VERSIONS.includes(String(answer.statementVersion))) return null;
  const name = typeof company?.company === "string" ? company.company.trim().slice(0, 120) : "";
  if (!name) return null;
  const website = typeof company?.website === "string" && /^https?:\/\/[^\s]+$/i.test(company.website.trim()) ? company.website.trim().slice(0, 300) : null;
  return { name, website };
}

/**
 * The site's view of company activity on its job: built field by field from the alias letter, the dates, the state and
 * the company's reason with its identity taken out (`siteReasonOf`, from the company records in `companies` and the
 * answer's own copy of its name and email). It reads no other field of a send or an answer, so no company's name,
 * email or website, and no note, can reach the site, except a company's details on an answer the site asked to be
 * introduced to (E6). A voided send, a record without an alias, and an answer recorded before C1 (no `recordedBy`) are
 * not shown. The automatic send is one count line (`sent`), not one entry per company. In date order; a send before an
 * answer at the same instant.
 */
/**
 * An application at a glance, as the site may read it (owner, 2026-11-23): how the company charges, how many similar
 * jobs it has done and what a visit must confirm (its identity taken out of those words), and the estimate only under a
 * line that says the site sees it (`COMPANY_ESTIMATE_STATEMENT_VERSIONS`). Only for an application, never another answer.
 */
function applicationAtAGlance(answer: Data, identity: ReturnType<typeof knownCompanyIdentity>): Partial<CompanyReplyDetails> {
  if (!INTRODUCIBLE_RESPONSE_STATES.includes(answer.state)) return {};
  const details = (answer.details && typeof answer.details === "object" ? answer.details : {}) as Data;
  const chargeModel = CHARGE_MODELS.find(model => model === details.chargeModel);
  const similarJobs = SIMILAR_JOBS.find(band => band === details.similarJobs);
  const visit = typeof details.visitMustConfirm === "string" ? siteReasonOf({ ...answer, inputs: details.visitMustConfirm }, identity) : null;
  const estimate = chargeModel && chargeModel !== "undecided" && COMPANY_ESTIMATE_STATEMENT_VERSIONS.includes(String(answer.statementVersion))
    && isApplicationEstimate(details.estimate) ? { lowUsd: details.estimate.lowUsd, highUsd: details.estimate.highUsd } : null;
  return { ...(chargeModel ? { chargeModel } : {}), ...(estimate ? { estimate } : {}), ...(similarJobs ? { similarJobs } : {}),
    ...(visit ? { visitMustConfirm: visit } : {}) };
}

/** The site's own marks after an introduction: the dates it said a visit happened and a pilot was agreed. */
function progressOf(intro: Data): { visitAtIso?: string; pilotAtIso?: string } | null {
  const raw = intro.progress && typeof intro.progress === "object" ? intro.progress as Data : {};
  const progress = { ...(instant(raw.visitAtIso) ? { visitAtIso: instant(raw.visitAtIso)! } : {}),
    ...(instant(raw.pilotAtIso) ? { pilotAtIso: instant(raw.pilotAtIso)! } : {}) };
  return Object.keys(progress).length ? progress : null;
}

export function projectSiteCompanyActivity(input: { aliases: Record<string, string>;
  sends: ReadonlyArray<Data>; responses: ReadonlyArray<{ id: string; data: Data }>;
  startedAtIso?: string | null;
  views?: number | null;
  /** Company records by id (`robotTeamAccess`), only to take each company's identity out of its words. */
  companies?: ReadonlyMap<string, Data> } & Partial<SiteCompanyIntroductionFacts>): SiteCompanyActivity {
  const entries: SiteCompanyEntry[] = [];
  const sentTo = new Set<string>();
  let firstAtIso: string | null = null;
  for (const send of input.sends) {
    const atIso = instant(send.sentAtIso);
    if (!atIso || text(send.voidedAtIso) || typeof send.companyId !== "string") continue;
    sentTo.add(send.companyId);
    if (!firstAtIso || atIso < firstAtIso) firstAtIso = atIso;
    const letter = input.aliases[send.companyId];
    if (send.sentBy === "system" || !letter) continue;
    entries.push({ kind: "sent", alias: companyAliasName(letter), atIso });
  }
  // An introduction cancelled at dispatch (G3) is as if it was never made: it does not count among those made and the
  // answer shows without it. It is offered again only when Blueprint's own email to the company failed or was never sent.
  const cancelledRows = (input.introductions ?? []).filter(row => typeof row.data.cancelledAtIso === "string");
  const cancelled = new Set(cancelledRows.map(row => row.id));
  const retryable = new Set(cancelledRows.filter(row => RETRYABLE_CANCEL_REASONS.has(String(row.data.cancelReason))).map(row => row.id));
  const introductions = new Map((input.introductions ?? []).filter(row => !cancelled.has(row.id)).map(row => [row.id, row.data]));
  const used = introductions.size;
  for (const response of input.responses) {
    const letter = input.aliases[response.id];
    const atIso = instant(response.data.updatedAtIso);
    const state = response.data.state;
    const recordedBy = response.data.recordedBy;
    if (!letter || !atIso || !isCompanyResponseState(state) || (recordedBy !== "company" && recordedBy !== "operator")) continue;
    const intro = introductions.get(response.id);
    // Introduced only once made: the company's email was sent (H2's commit point), which the loader reads from the
    // company's outbox row as `madeAtIso`. Until then the site is told the request is in progress, and no details.
    const introducedAtIso = intro ? instant(intro.madeAtIso) : null;
    const company = introducedAtIso ? introducedCompany(intro) : undefined;
    const canIntroduce = !intro && (!cancelled.has(response.id) || retryable.has(response.id)) && input.listed === true
      && answerConsentsToIntroduction(response.data) && Boolean(input.approvedDeploymentCompanies?.has(response.id));
    const identity = knownCompanyIdentity(input.companies?.get(response.id), response.data);
    const reason = siteReasonOf(response.data, identity);
    const question = questionOnReply(response.data);
    const questionText = question && siteReasonOf({ ...response.data, inputs: question.text }, identity);
    const canAnswer = question && questionText && input.listed && input.approvedDeploymentCompanies?.has(response.id);
    const answer = question ? clarificationOnReply(response.data, question.id) : undefined;
    const startWindow = response.data.details?.startWindow;
    const verified = siteReasonOf({ ...response.data, inputs: response.data.details?.verified }, identity);
    const details = answerWordsMayReachSite(response.data) ? {
      ...(verified ? { verified } : {}),
      ...(COMPANY_START_WINDOWS.some(window => window === startWindow) ? { startWindow } : {}),
      ...applicationAtAGlance(response.data, identity),
    } : {};
    const applicant = applicantShownToSite(response.data, input.companies?.get(response.id));
    entries.push({ kind: "answered", alias: companyAliasName(letter), atIso, state, canIntroduce,
      ...(applicant ? { applicant } : {}),
      ...(reason ? { reason } : {}),
      ...(Object.keys(details).length ? { details } : {}),
      ...(canAnswer ? { question: { id: question.id, text: questionText, ...(answer ? { answer } : {}),
        ...(!answer && replyByIso(response.data.questionAskedAtIso) ? { replyByIso: replyByIso(response.data.questionAskedAtIso)! } : {}) } } : {}),
      ...(introducedAtIso ? { introducedAtIso } : {}), ...(company ? { company } : {}),
      // What the site said happened after the introduction (`markIntroductionProgress`): a visit, a pilot.
      ...(intro && progressOf(intro) ? { progress: progressOf(intro)! } : {}),
      ...(intro && !introducedAtIso ? { introductionPending: true } : {}),
      // Cancelled before the company's email went (H2), so the site's details were never given to it.
      ...(cancelled.has(response.id) ? { introductionCancelled: true } : {}) });
  }
  entries.sort((a, b) => a.atIso.localeCompare(b.atIso) || (a.kind === b.kind ? 0 : a.kind === "sent" ? -1 : 1));
  const firstAnswerAtIso = firstRecordedAnswer(input.responses);
  return { entries, interested: entries.some(entry => entry.kind === "answered" && INTRODUCIBLE_RESPONSE_STATES.includes(entry.state)),
    sent: sentTo.size && firstAtIso ? { count: sentTo.size, firstAtIso } : null,
    ...(input.startedAtIso ? { startedAtIso: input.startedAtIso } : {}),
    ...(input.views || input.views === null ? { views: input.views } : {}),
    ...(firstAnswerAtIso ? { firstAnswerAtIso } : {}),
    introductions: { used } };
}

/**
 * Read the job's sends, answers and introductions and project them for the site. Reads only: it writes nothing, ever
 * (aliases are assigned where a send or an answer is recorded). A withdrawn job shows nothing.
 */
export async function loadSiteCompanyActivity(requestId: string): Promise<SiteCompanyActivity> {
  const store = requireDb();
  const jobRef = store.collection(JOBS).doc(requestId);
  const record = (await jobRef.get()).data();
  const empty = { entries: [], interested: false, sent: null, introductions: { used: 0 } };
  if (!record || projectWebsiteCaptureRights(record).consent_revoked) return empty;
  const [sends, responses, introductions, approved, views, { access }] = await Promise.all([readAll(jobRef.collection(COMPANY_SENDS_COLLECTION)),
    readAll(jobRef.collection(COMPANY_RESPONSES_COLLECTION)), readAll(jobRef.collection(INTRODUCTIONS_COLLECTION)),
    readAll(store.collection(ROBOT_TEAM_ACCESS_COLLECTION).where("status", "==", "approved")),
    readAll(jobRef.collection(COMPANY_JOB_VIEWS_COLLECTION)).catch(() => null),
    import("./teamJobAccess").then(({ loadCompanyJobAccess }) => loadCompanyJobAccess(requestId, record))]);
  // The introduced companies' details are decrypted here, only for the site's own page (`introductionShared.ts`).
  // An introduction is made when the company's email of its current attempt is sent (`jobIntroductionGate.ts`, H2):
  // that outbox row is the one fact read. Before then the company's details are not even opened.
  const { openShared } = await import("./introductionShared");
  const { CAPTURE_OUTBOX_COLLECTION } = await import("./captureOutbox");
  const opened = await Promise.all(introductions.map(async row => {
    if (typeof row.data.cancelledAtIso === "string")
      return { id: row.id, data: { cancelledAtIso: row.data.cancelledAtIso, cancelReason: row.data.cancelReason ?? null } };
    const companyRow = (await store.collection(CAPTURE_OUTBOX_COLLECTION)
      .doc(introductionCompanyKey(requestId, row.id, introductionAttemptOf(row.data))).get()).data();
    const madeAtIso = companyRow?.status === "sent" ? instant(companyRow.sentAtIso) ?? instant(row.data.requestedAtIso) : null;
    return { id: row.id, data: { ...row.data, madeAtIso,
      companyShared: madeAtIso ? await openShared(row.data.companyShared) : null } };
  }));
  // Every company that answered, approved or not, so its identity is taken out of its words.
  const answered = await Promise.all(responses.map(row => store.collection(ROBOT_TEAM_ACCESS_COLLECTION).doc(row.id).get()));
  const companies = new Map(answered.filter(snap => snap.exists).map(snap => [snap.id, (snap.data() ?? {}) as Data]));
  return projectSiteCompanyActivity({ aliases: storedAliases(record), sends: sends.map(row => row.data), responses,
    introductions: opened, listed: access.listed, companies,
    approvedDeploymentCompanies: new Set(approved.filter(row => companyMaySeeJobs(row.data)).map(row => row.id)),
    startedAtIso: jobStartTime(record.createdAt), views: views?.length ?? null });
}

/* ------------------------------------------------------------- the operator's panel */


const CLOSED_WORDS: Partial<Record<TeamJobClosedReason, string>> = {
  operator_paused: "the site paused or closed it",
  blueprint_hold: "Blueprint stopped showing it",
  consent_withdrawn: "the site withdrew its permission",
  rights_blocked: "the rights review blocked the capture",
  rights_needs_review: "the rights review has not cleared the capture",
  development_only: "a development capture",
  older_statement: "the job was sent under an older statement",
  no_job_sentence: "the site has not said what the job is yet",
  video_required: "the job's video is not available to companies yet",
  authority_ended: "Blueprint's authority to work on it ended",
  closed_by_site: "the site closed the job",
  job_ended: "the job ended because what was needed from the site never came",
};

/** The job's sharing state in words, as `teamJobAccess` decides it. */
export function sharingInWords(record: Data, access = teamJobAccess(record)): AdminJobCompanies["sharing"] {
  const shared = isRecord(record.public_task_listing) && record.public_task_listing.enabled === true;
  if (access.listed) return { state: "shared_visible", words: "Shared and visible to approved companies.", reason: null };
  if (!shared) return { state: "not_shared", words: "Not shared: the site has not accepted the current statement.", reason: access.reason };
  const why = CLOSED_WORDS[access.reason] ?? "it is not under the current sharing record";
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
  const companies = approvedRows.filter(row => companyMaySeeJobs(row.data))
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
      updatedAtIso: text(data.updatedAtIso), statementVersion: text(data.statementVersion),
      recordedBy: data.recordedBy === "operator" ? "operator" as const : data.recordedBy === "company" ? "company" as const
        : "before_c1" as const }))
    .sort((a, b) => String(a.updatedAtIso).localeCompare(String(b.updatedAtIso)));
  const [introductionRows, events, { latestOutcome, OUTCOME_STATE_LABELS }] = await Promise.all([
    readAll(jobRef.collection(INTRODUCTIONS_COLLECTION)),
    import("./billableEvents").then(({ listJobBillableEvents }) => listJobBillableEvents(requestId)),
    import("./jobOutcomes")]);
  const { openShared } = await import("./introductionShared");
  const introductions = (await Promise.all(introductionRows.map(async ({ id, data }) => ({ id, data,
    companyShared: await openShared(data.companyShared) })))).map(({ id, data, companyShared }) => {
    const latest = latestOutcome(data as never).latest;
    return { companyId: id, company: text(companyShared.company) ?? text(names.get(id)?.company), alias: text(data.alias),
      requestedAtIso: String(data.requestedAtIso ?? ""),
      ...(typeof data.cancelledAtIso === "string" ? { cancelledAtIso: data.cancelledAtIso, cancelReason: text(data.cancelReason) } : {}),
      latestOutcome: latest ? { by: latest.by, state: latest.state, atIso: latest.atIso,
        label: (OUTCOME_STATE_LABELS as Record<string, string>)[latest.state] ?? latest.state } : null };
  }).sort((a, b) => a.requestedAtIso.localeCompare(b.requestedAtIso));
  const billableEvents = events.map(event => ({ id: event.id, kind: event.kind, companyId: event.companyId,
    company: text(names.get(event.companyId)?.company), atIso: event.atIso, madeAtIso: text(event.madeAtIso), priceUsd: null,
    status: event.status }));
  const auto = isRecord(record.company_auto_send) && text(record.company_auto_send.sentAtIso)
    ? { sentAtIso: String(record.company_auto_send.sentAtIso), count: Number(record.company_auto_send.count) || 0 } : null;
  const { loadCompanyJobAccess } = await import("./teamJobAccess");
  const { access } = await loadCompanyJobAccess(requestId, record);
  return { sharing: sharingInWords(record, access), hold: operatorListingHold(record),
    consentRevoked: projectWebsiteCaptureRights(record).consent_revoked === true, libraryUrl: libraryJobUrl(requestId),
    companies, sends, responses, autoSend: auto, introductions, billableEvents,
    startedAtIso: jobStartTime(record.createdAt), firstAnswerAtIso: firstRecordedAnswer(responseRows) };
}
