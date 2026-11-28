/**
 * Pilot offers (owner, 2026-11-28): the one path that saves a company's standing offer, shows a site the offers that fit
 * its job on paper, records the site's request, and turns the company's confirmation into an introduction.
 *
 * Records (Admin SDK only; the client never reads them, so the rules' catch-all denial covers them):
 * - `pilotOffers/{companyId}`: `{ schemaVersion: 1, companyId, published, revision, kinds, limits, terms, statementVersion,
 *   acceptedByUid, updatedAtIso, publishedAtIso? }`. The company's name and website are read from `robotTeamAccess` when
 *   an offer is shown, never copied here.
 * - `inboundRequests/{id}/pilotRequests/{companyId}`: `{ schemaVersion: 1, offerRevision, offerSnapshot, requestedAtIso,
 *   introductionStatementVersion, state, refusal?, decidedAtIso?, introducedAtIso? }`. `state` is stored as
 *   `requested`, `confirmed` or `refused`; `question` and `declined` are read from the company's own answer given after
 *   the request through the ordinary answer path, which is unchanged.
 *
 * What crosses, by construction: a site sees an offer's company name and website (as an applicant row shows them, with
 * the same filter for contact details), the offer's own terms and an opaque `offerRef`; never the company's id or its
 * contact details. A company sees the site's request and its own terms as of the request; never the site's name, place
 * or contact details. Those cross only through `requestIntroduction`, the one place they ever do.
 *
 * Confirm is two steps (spec addendum A2): (1) an ordinary Apply through `recordCompanyAnswer`, under the company's
 * response line, which assigns the company's alias; (2) `requestIntroduction` for the site's earlier press, under the
 * introduction sentence the site was shown and recorded with it. If (2) refuses, the Apply stands as an ordinary
 * application the site can accept, and the request records why.
 *
 * Nothing here holds a job or adds a gate: a withdrawn or unlisted job, and a company that is not approved or whose Terms
 * are not current, are refused exactly as the answer and Accept paths refuse them.
 */
import { createHash, createHmac } from "node:crypto";
import { z } from "zod";

import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { CHARGE_MODELS, COMPANY_START_WINDOWS, INTRODUCIBLE_RESPONSE_STATES } from "../../client/src/lib/companyResponses";
import {
  PILOT_HOURS_LIMITS, PILOT_MAX_KG_MAX, PILOT_MAX_KG_MIN, PILOT_OFFER_JOB_TYPES, PILOT_OFFER_STATEMENT_VERSION,
  PILOT_REQUEST_EMAIL_BODY, PILOT_REQUEST_EMAIL_LINE, PILOT_REQUEST_EMAIL_SUBJECT, PILOT_SIZE_LIMITS, PILOT_WEEKS_MAX,
  PILOT_WEEKS_MIN, SITE_PROVIDES, US_STATE_CODES, isPilotSitePays, sanitizePilotOfferBody,
  type CompanyPilotRequest, type PilotOfferBody, type PilotOfferView, type PilotRequestRefusal, type PilotRequestState,
  type PilotSheet, type SitePilotOffer, type SitePilotOffers,
} from "../../client/src/lib/pilotOffers";
import { pilotOfferFit, type PilotFitJob } from "../../client/src/lib/pilotOfferFit";
import { applicantNameHoldsContactDetails, applicantWebsiteOrigin } from "../../client/src/lib/companyApplicant";
import type { SiteCompanyActivity } from "../../client/src/lib/companyResponses";
import { companyMaySeeJobs } from "./companyTerms";
import { hasInternalTestCompanyMarker, isInternalTestCompanyRow } from "./internalTestCompany";
import { isInternalTestJob } from "./internalTestJob";
import { accessRecordId, ROBOT_TEAM_ACCESS_COLLECTION } from "./robotTeamEarlyAccess";
import { loadCompanyJobAccess } from "./teamJobAccess";
import { readJobFacts } from "./jobFacts";
import { jobReadingOf } from "./siteRobotFit";
import { introductionAttemptOf, introductionCompanyKey } from "./jobIntroductionGate";

export const PILOT_OFFERS_COLLECTION = "pilotOffers";
export const PILOT_REQUESTS_COLLECTION = "pilotRequests";
export const PILOT_REQUEST_EMAIL_KIND = "pilot_requested_company" as const;
export const pilotRequestEmailKey = (jobId: string, companyId: string) => `${PILOT_REQUEST_EMAIL_KIND}:${jobId}:${companyId}`;

const JOBS = "inboundRequests";
const COMPANY_ID = /^[a-f0-9]{64}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Far above any real count of published offers; a single-field query, no extra index. */
const OFFER_READ_LIMIT = 2000;
type Tx = FirebaseFirestore.Transaction;
type Data = Record<string, any>;

function requireDb() {
  if (!db) throw new Error("pilot_offer_store_unavailable");
  return db;
}

/* ------------------------------------------------------------------ the company's offer */

const unique = <T>(list: T[]) => new Set(list).size === list.length;

/** The offer as the company's form sends it (`PUT /api/site-worlds/pilot-offer`). Strict: unknown fields are refused. */
export const pilotOfferInputSchema = z.object({
  published: z.boolean(),
  kinds: z.array(z.enum(PILOT_OFFER_JOB_TYPES)).min(1).max(PILOT_OFFER_JOB_TYPES.length).refine(unique),
  limits: z.object({
    maxKg: z.number().min(PILOT_MAX_KG_MIN).max(PILOT_MAX_KG_MAX).nullable(),
    maxSide: z.enum(PILOT_SIZE_LIMITS).nullable(),
    minHours: z.enum(PILOT_HOURS_LIMITS).nullable(),
    states: z.union([z.literal("all_us"), z.array(z.string().refine(code => US_STATE_CODES.includes(code))).min(1)
      .max(US_STATE_CODES.length).refine(unique)]),
  }).strict(),
  terms: z.object({
    weeks: z.number().int().min(PILOT_WEEKS_MIN).max(PILOT_WEEKS_MAX),
    sitePays: z.union([z.object({ kind: z.literal("nothing") }).strict(),
      z.object({ kind: z.enum(["once", "monthly"]), low: z.number(), high: z.number() }).strict()]).refine(isPilotSitePays),
    siteProvides: z.array(z.enum(SITE_PROVIDES)).max(SITE_PROVIDES.length).refine(unique),
    earliestStart: z.enum(COMPANY_START_WINDOWS),
    afterPilot: z.enum(CHARGE_MODELS),
  }).strict(),
  // The statement the company read under the form; the only one an offer is published under.
  statementVersion: z.literal(PILOT_OFFER_STATEMENT_VERSION),
}).strict();
export type PilotOfferInput = z.infer<typeof pilotOfferInputSchema>;

/** Why an offer was refused, naming the part that failed. */
export function pilotOfferRefusal(issues: ReadonlyArray<{ code: string; path: ReadonlyArray<PropertyKey> }>): string {
  const [field, detail] = issues[0]?.path ?? [];
  if (!issues[0] || issues[0].code === "unrecognized_keys") return "Your pilot offer could not be read. Reload the page and send it again.";
  if (field === "statementVersion") return "The wording on this page has changed. Reload the page, read it, then save again.";
  if (field === "kinds") return "Choose at least one kind of job you take.";
  if (field === "limits") {
    if (detail === "maxKg") return `Enter the heaviest item in kg, from ${PILOT_MAX_KG_MIN} to ${PILOT_MAX_KG_MAX.toLocaleString("en-US")}, or leave it empty.`;
    if (detail === "states") return "Choose where you work: every US state, or at least one state.";
    return "Choose each limit from its list.";
  }
  if (field === "terms") {
    if (detail === "weeks") return `Enter the pilot's length in whole weeks, from ${PILOT_WEEKS_MIN} to ${PILOT_WEEKS_MAX}.`;
    if (detail === "sitePays") return "Enter what the site pays in US dollars, with at most two decimals and the lower amount first, or choose Nothing.";
    return "Choose each term from its list.";
  }
  return "Your pilot offer could not be read. Reload the page and send it again.";
}

/** A digest of what the offer says, so a request records which terms the site saw. */
export function pilotOfferRevision(body: PilotOfferBody): string {
  return createHash("sha256").update(JSON.stringify({ kinds: body.kinds, limits: body.limits, terms: body.terms })).digest("hex");
}

/** The stored offer as its company's form reads it, or null. */
export function pilotOfferViewOf(stored: Data | undefined): PilotOfferView | null {
  const body = sanitizePilotOfferBody(stored);
  if (!stored || !body) return null;
  return { ...body, published: stored.published === true, revision: String(stored.revision ?? ""),
    statementVersion: String(stored.statementVersion ?? ""), updatedAtIso: String(stored.updatedAtIso ?? "") };
}

/** Only an approved deployment company under the current Terms has an offer, and never Blueprint's internal test company. */
export function companyMayOffer(companyId: string, company: Data | undefined): boolean {
  return Boolean(company) && companyMaySeeJobs(company as never) && !hasInternalTestCompanyMarker(company)
    && !isInternalTestCompanyRow(companyId, company);
}

export async function readPilotOffer(companyId: string): Promise<PilotOfferView | null> {
  const store = requireDb();
  return pilotOfferViewOf((await store.collection(PILOT_OFFERS_COLLECTION).doc(companyId).get()).data());
}

export type SavePilotOfferResult = { ok: true; offer: PilotOfferView } | { ok: false; reason: "company_not_approved" };

/** Save the company's offer: re-checks the company in the same transaction as the write. */
export async function savePilotOffer(input: { companyId: string; uid: string; offer: PilotOfferInput },
  now: () => Date = () => new Date()): Promise<SavePilotOfferResult> {
  const store = requireDb();
  const ref = store.collection(PILOT_OFFERS_COLLECTION).doc(input.companyId);
  return store.runTransaction(async (tx): Promise<SavePilotOfferResult> => {
    const company = (await tx.get(store.collection(ROBOT_TEAM_ACCESS_COLLECTION).doc(input.companyId))).data();
    const prior = (await tx.get(ref)).data();
    if (!companyMayOffer(input.companyId, company)) return { ok: false, reason: "company_not_approved" };
    const body = sanitizePilotOfferBody(input.offer);
    if (!body) throw new Error("pilot_offer_invalid");
    const atIso = now().toISOString();
    const stored = { schemaVersion: 1, companyId: input.companyId, published: input.offer.published, revision: pilotOfferRevision(body),
      ...body, statementVersion: input.offer.statementVersion, acceptedByUid: input.uid, updatedAtIso: atIso,
      ...(input.offer.published ? { publishedAtIso: typeof prior?.publishedAtIso === "string" ? prior.publishedAtIso : atIso }
        : typeof prior?.publishedAtIso === "string" ? { publishedAtIso: prior.publishedAtIso } : {}) };
    tx.set(ref, stored);
    return { ok: true, offer: pilotOfferViewOf(stored)! };
  });
}

/* ------------------------------------------------------------------ what the site sees */

/** The opaque reference the site's page and its press carry for one offer on one job: never the company's id. */
export function pilotOfferRef(jobId: string, companyId: string): string {
  const secret = String(process.env.TASK_EVALUATION_RESULT_DOWNLOAD_SIGNING_SECRET || "").trim();
  const message = `pilot-offer:${jobId}:${companyId}`;
  const digest = secret ? createHmac("sha256", secret).update(message).digest("hex") : createHash("sha256").update(message).digest("hex");
  return `p-${digest.slice(0, 32)}`;
}

/** The company's name and website as an applicant row shows them (`applicantShownToSite`), or null: never a contact detail. */
export function offerCompanyShownToSite(company: Data | undefined): { name: string; website: string | null } | null {
  const name = typeof company?.company === "string" ? company.company.trim().slice(0, 120) : "";
  if (!name) return null;
  const stated = typeof company?.website === "string" ? company.website.trim().slice(0, 300) : null;
  if (applicantNameHoldsContactDetails(name, stated)) return null;
  return { name, website: applicantWebsiteOrigin(stated) };
}

/** The job's facts the fit reads: the site's answers, the reading's kind, the keyword type and the state on record. */
export async function pilotFitJobOf(record: Data, taskFamily: string): Promise<PilotFitJob> {
  const { companyStateOf } = await import("./companyJobPage");
  return { kind: jobReadingOf(record)?.kind ?? null, taskFamily, facts: readJobFacts(record),
    usState: await companyStateOf(record).catch(() => null) };
}

const instant = (value: unknown): string | null =>
  typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : null;

/**
 * Where a stored request stands, with the company's own answer after it: Need more details reads `question`, Not a fit
 * reads `declined`, each only while the request is still waiting on the company.
 */
export function pilotRequestStateOf(request: Data, answer: Data | undefined): PilotRequestState {
  const stored = request.state === "confirmed" || request.state === "refused" ? request.state : "requested";
  if (stored !== "requested") return stored;
  const answeredAfter = instant(answer?.updatedAtIso) && instant(request.requestedAtIso)
    && String(answer!.updatedAtIso) >= String(request.requestedAtIso);
  if (answeredAfter && answer?.state === "declined") return "declined";
  if (answeredAfter && answer?.state === "needs_something") return "question";
  return "requested";
}

/** When the introduction to this company on this job was made (its company email was sent), else null. Reads only. */
export async function introductionMadeAtIso(jobId: string, companyId: string, tx?: Tx): Promise<string | null> {
  const store = requireDb();
  const read = (ref: FirebaseFirestore.DocumentReference) => (tx ? tx.get(ref) : ref.get()).then(snap => snap.data());
  const intro = await read(store.collection(JOBS).doc(jobId).collection("introductions").doc(companyId));
  if (!intro || typeof intro.cancelledAtIso === "string") return null;
  const { CAPTURE_OUTBOX_COLLECTION } = await import("./captureOutbox");
  const row = await read(store.collection(CAPTURE_OUTBOX_COLLECTION).doc(introductionCompanyKey(jobId, companyId, introductionAttemptOf(intro))));
  return row?.status === "sent" ? instant(row.sentAtIso) ?? instant(intro.requestedAtIso) : null;
}

/** The pilot sheet, only once the introduction is made: the site's own sentence and rule, and the terms as of the request. */
export function pilotSheetOf(request: Data, words: { sentence: string; done: string | null }): PilotSheet | null {
  const snapshot = sanitizePilotOfferBody(request.offerSnapshot);
  const requestedAtIso = instant(request.requestedAtIso);
  if (!snapshot || !requestedAtIso) return null;
  return { sentence: words.sentence, done: words.done?.trim() ? words.done.trim() : null, terms: snapshot.terms, requestedAtIso };
}

/**
 * The offers the site's page shows (spec 3): every published offer of an approved deployment company under the current
 * Terms that fits the job on paper, and every offer the site already asked for, as it was then. Nothing for a job that
 * is not listed, or an internal test job (no real company may act on one). Reads only.
 */
export async function pilotOffersForSite(jobId: string, record: Data, input: { taskFamily: string; listed: boolean;
  activity?: SiteCompanyActivity; brief?: { summary?: unknown; successCriteria?: any } | null }): Promise<SitePilotOffers | null> {
  if (!input.listed || isInternalTestJob(record)) return null;
  const store = requireDb();
  const jobRef = store.collection(JOBS).doc(jobId);
  const [published, requests, introductions, { introductionStatementVersionOf }, fitJob, { siteSentenceSource, siteSuccessRuleSource },
    { storedAliases, COMPANY_RESPONSES_COLLECTION }] = await Promise.all([
    store.collection(PILOT_OFFERS_COLLECTION).where("published", "==", true).limit(OFFER_READ_LIMIT).get(),
    jobRef.collection(PILOT_REQUESTS_COLLECTION).limit(OFFER_READ_LIMIT).get(),
    jobRef.collection("introductions").limit(OFFER_READ_LIMIT).get(),
    import("./jobIntroductions"), pilotFitJobOf(record, input.taskFamily), import("./companyJobPage"), import("./jobCompanies")]);
  const requested = new Map(requests.docs.map(doc => [doc.id, doc.data() as Data]));
  const introduced = new Set(introductions.docs.filter(doc => typeof doc.data()?.cancelledAtIso !== "string").map(doc => doc.id));
  const ids = [...new Set([...published.docs.map(doc => doc.id), ...requested.keys()])].filter(id => COMPANY_ID.test(id)).sort();
  const offers = new Map(published.docs.map(doc => [doc.id, doc.data() as Data]));
  const aliases = storedAliases(record);
  const words = { sentence: siteSentenceSource(input.brief), done: siteSuccessRuleSource(input.brief) || null };
  const shown: SitePilotOffer[] = [];
  for (const companyId of ids) {
    const company = (await store.collection(ROBOT_TEAM_ACCESS_COLLECTION).doc(companyId).get()).data();
    const name = offerCompanyShownToSite(company);
    if (!name) continue;
    const request = requested.get(companyId);
    if (request) {
      const offer = sanitizePilotOfferBody(request.offerSnapshot);
      const requestedAtIso = instant(request.requestedAtIso);
      if (!offer || !requestedAtIso) continue;
      const answer = (await jobRef.collection(COMPANY_RESPONSES_COLLECTION).doc(companyId).get()).data();
      const state = pilotRequestStateOf(request, answer);
      const alias = aliases[companyId] ? `Company ${aliases[companyId]}` : null;
      const entry = alias ? input.activity?.entries.find(row => row.kind === "answered" && row.alias === alias) : undefined;
      const reason = state === "declined" && entry?.kind === "answered" ? entry.reason : undefined;
      const introducedAtIso = state === "confirmed" ? await introductionMadeAtIso(jobId, companyId) : null;
      const sheet = introducedAtIso ? pilotSheetOf(request, words) : null;
      shown.push({ offerRef: pilotOfferRef(jobId, companyId), company: name, offer,
        unknown: pilotOfferFit(offer, fitJob).unknown,
        request: { state, requestedAtIso, ...(reason ? { reason } : {}), ...(introducedAtIso ? { introducedAtIso } : {}),
          ...(sheet ? { sheet } : {}) } });
      continue;
    }
    // A company the site already accepted is met through its application, not offered again here.
    if (introduced.has(companyId) || !companyMayOffer(companyId, company)) continue;
    const offer = sanitizePilotOfferBody(offers.get(companyId));
    if (!offer) continue;
    const fit = pilotOfferFit(offer, fitJob);
    if (!fit.fits) continue;
    shown.push({ offerRef: pilotOfferRef(jobId, companyId), company: name, offer, unknown: fit.unknown,
      ...(fit.weightPartly ? { weightPartly: true as const } : {}) });
  }
  return { offers: shown, introductionStatementVersion: await introductionStatementVersionOf(record) };
}

/* ------------------------------------------------------------------ the site's request */

export type PilotRequestResult = { ok: true; requestedAtIso: string; already?: true }
  | { ok: false; reason: PilotRequestRefusal; statementVersion?: string };

/** The company an `offerRef` names on this job: a published offer or one already asked for. Null when none does. */
async function companyForOfferRef(jobId: string, offerRef: string): Promise<string | null> {
  const store = requireDb();
  const [published, requests] = await Promise.all([
    store.collection(PILOT_OFFERS_COLLECTION).where("published", "==", true).limit(OFFER_READ_LIMIT).get(),
    store.collection(JOBS).doc(jobId).collection(PILOT_REQUESTS_COLLECTION).limit(OFFER_READ_LIMIT).get()]);
  const ids = new Set([...published.docs, ...requests.docs].map(doc => doc.id).filter(id => COMPANY_ID.test(id)));
  return [...ids].find(id => pilotOfferRef(jobId, id) === offerRef) ?? null;
}

/** The company's address when it may be emailed about the site's request: keyed by it, and never suppressed. */
async function requestEmailRecipient(tx: Tx, companyId: string, company: Data | undefined): Promise<string | null> {
  const store = requireDb();
  const email = String(company?.email ?? "").trim().toLowerCase();
  if (!EMAIL.test(email) || accessRecordId(email) !== companyId) return null;
  const blocked = (await tx.get(store.collection("email_suppressions").doc(email))).data();
  return blocked?.global_suppressed === true || (Array.isArray(blocked?.suppressed_scopes) && blocked.suppressed_scopes.includes("all"))
    ? null : email;
}

/** The email to the company: the job's one-use link (`jobEmailUrl`, as the new-job email), and no figure. */
export function pilotRequestEmail(params: { jobUrl: string }): { subject: string; body: string } {
  return { subject: PILOT_REQUEST_EMAIL_SUBJECT,
    body: [PILOT_REQUEST_EMAIL_BODY, "", "Open the job:", params.jobUrl, "", PILOT_REQUEST_EMAIL_LINE].join("\n") };
}

/**
 * The site's one press for one offer (owner link only; the route checks the link). One transaction re-reads the whole
 * sharing rule, the company, its offer and the fit, and writes the request and the company's email, all or nothing. A
 * second press finds the request and changes nothing. `statementVersion` is the introduction sentence the page showed
 * beside the button: it must be the one true for this job, and it is recorded for the introduction made on confirm.
 */
export async function requestPilot(input: { requestId: string; offerRef: string; statementVersion: string },
  now: () => Date = () => new Date()): Promise<PilotRequestResult> {
  const store = requireDb();
  const companyId = await companyForOfferRef(input.requestId, input.offerRef);
  if (!companyId) return { ok: false, reason: "offer_unavailable" };
  const jobRef = store.collection(JOBS).doc(input.requestId);
  const [{ introductionStatementVersionOf }, { buildOutboxEntry, CAPTURE_OUTBOX_COLLECTION }, { jobEmailUrl },
    { companyJobUrl }, { CUSTOMER_JOB_EMAIL_IDENTITY }, { projectWebsiteCaptureRights }] = await Promise.all([
    import("./jobIntroductions"), import("./captureOutbox"), import("./jobAutoSend"), import("./jobCompanies"),
    import("./emailLayout"), import("./websiteCaptureRights")]);
  return store.runTransaction(async (tx): Promise<PilotRequestResult> => {
    const stored = (await tx.get(jobRef)).data() ?? null;
    if (stored && (projectWebsiteCaptureRights(stored).consent_revoked || stored.capture_withdrawal)) return { ok: false, reason: "withdrawn" };
    const { record, access } = await loadCompanyJobAccess(input.requestId, stored, tx);
    if (!record || !access.listed || isInternalTestJob(record)) return { ok: false, reason: "not_listed" };
    const requestRef = jobRef.collection(PILOT_REQUESTS_COLLECTION).doc(companyId);
    const outboxRef = store.collection(CAPTURE_OUTBOX_COLLECTION).doc(pilotRequestEmailKey(input.requestId, companyId));
    const [prior, offerStored, company, intro, queued] = [(await tx.get(requestRef)).data(),
      (await tx.get(store.collection(PILOT_OFFERS_COLLECTION).doc(companyId))).data(),
      (await tx.get(store.collection(ROBOT_TEAM_ACCESS_COLLECTION).doc(companyId))).data(),
      (await tx.get(jobRef.collection("introductions").doc(companyId))).data(), (await tx.get(outboxRef)).exists];
    // A second press: the request stands as it is (a refused one may be asked again).
    if (prior && prior.state !== "refused" && instant(prior.requestedAtIso))
      return { ok: true, requestedAtIso: String(prior.requestedAtIso), already: true };
    if (intro && typeof intro.cancelledAtIso !== "string") return { ok: false, reason: "already_introduced" };
    const offer = sanitizePilotOfferBody(offerStored);
    if (!offer || offerStored?.published !== true || !companyMayOffer(companyId, company) || !offerCompanyShownToSite(company))
      return { ok: false, reason: "offer_unavailable" };
    const fitJob = await pilotFitJobOf(record, access.details.taskFamily);
    if (!pilotOfferFit(offer, fitJob).fits) return { ok: false, reason: "offer_unavailable" };
    // The sentence beside the button must be the one true for this job (`introductionStatementVersionFor`).
    const statementVersion = await introductionStatementVersionOf(record);
    if (input.statementVersion !== statementVersion) return { ok: false, reason: "statement_not_current", statementVersion };
    const recipient = queued ? null : await requestEmailRecipient(tx, companyId, company);
    const requestedAtIso = now().toISOString();
    tx.set(requestRef, { schemaVersion: 1, offerRevision: pilotOfferRevision(offer), offerSnapshot: offer, requestedAtIso,
      introductionStatementVersion: statementVersion, state: "requested" });
    if (recipient) {
      const message = pilotRequestEmail({ jobUrl: jobEmailUrl(companyJobUrl(input.requestId), input.requestId,
        { id: companyId, email: recipient, revision: typeof company?.decidedAtIso === "string" ? company.decidedAtIso : null }) });
      tx.create(outboxRef, buildOutboxEntry({ idempotencyKey: outboxRef.id, requestId: input.requestId, kind: PILOT_REQUEST_EMAIL_KIND,
        to: recipient, subject: message.subject, body: message.body, replyTo: CUSTOMER_JOB_EMAIL_IDENTITY.replyTo }));
    }
    return { ok: true, requestedAtIso };
  });
}

/** The company a row's id names, for the job it was queued for, or null. */
export function parsePilotRequestEmailKey(jobId: string, key: string | undefined): string | null {
  const prefix = `${PILOT_REQUEST_EMAIL_KIND}:${jobId}:`;
  const companyId = key?.startsWith(prefix) ? key.slice(prefix.length) : "";
  return COMPANY_ID.test(companyId) ? companyId : null;
}

/**
 * The outbox's check before it sends one (every other kind passes): the site's request still waits on the company, the
 * job is still listed and not withdrawn, the company may still offer and is still at the address its record is keyed
 * by, and that address is not suppressed. Reads only.
 */
export async function pilotRequestEmailIsCurrent(entry: { kind: string; requestId: string; to: string; idempotencyKey?: string },
  tx: Tx): Promise<boolean> {
  if (entry.kind !== PILOT_REQUEST_EMAIL_KIND) return true;
  const companyId = parsePilotRequestEmailKey(entry.requestId, entry.idempotencyKey);
  if (!companyId || !db) return false;
  const jobRef = db.collection(JOBS).doc(entry.requestId);
  const job = (await tx.get(jobRef)).data();
  if (!job) return false;
  const request = (await tx.get(jobRef.collection(PILOT_REQUESTS_COLLECTION).doc(companyId))).data();
  const company = (await tx.get(db.collection(ROBOT_TEAM_ACCESS_COLLECTION).doc(companyId))).data();
  const { COMPANY_RESPONSES_COLLECTION } = await import("./jobCompanies");
  const answer = (await tx.get(jobRef.collection(COMPANY_RESPONSES_COLLECTION).doc(companyId))).data();
  const recipient = await requestEmailRecipient(tx, companyId, company);
  const { access } = await loadCompanyJobAccess(entry.requestId, job, tx);
  const { projectWebsiteCaptureRights } = await import("./websiteCaptureRights");
  return Boolean(request) && pilotRequestStateOf(request!, answer) === "requested" && access.listed && !isInternalTestJob(job)
    && !projectWebsiteCaptureRights(job).consent_revoked && !job.capture_withdrawal
    && companyMayOffer(companyId, company) && recipient !== null && recipient === String(entry.to ?? "").trim().toLowerCase();
}

/* ------------------------------------------------------------------ the company's side */

/** The site's request as the company's job page reads it: its own terms as of the request, and nothing of the site. */
export async function companyPilotRequestOf(jobId: string, companyId: string, answer: Data | undefined):
  Promise<{ request: CompanyPilotRequest; stored: Data } | null> {
  const store = requireDb();
  const stored = (await store.collection(JOBS).doc(jobId).collection(PILOT_REQUESTS_COLLECTION).doc(companyId).get()).data();
  const snapshot = sanitizePilotOfferBody(stored?.offerSnapshot);
  const requestedAtIso = instant(stored?.requestedAtIso);
  if (!stored || !snapshot || !requestedAtIso) return null;
  const state = pilotRequestStateOf(stored, answer);
  const introducedAtIso = state === "confirmed" ? await introductionMadeAtIso(jobId, companyId) : null;
  return { stored, request: { state, requestedAtIso, terms: snapshot.terms,
    ...(state === "refused" && typeof stored.refusal === "string" ? { refusal: stored.refusal } : {}),
    ...(introducedAtIso ? { introducedAtIso } : {}),
    ...(instant(stored.decidedAtIso) ? { decidedAtIso: String(stored.decidedAtIso) } : {}) } };
}

export type PilotConfirmResult = { ok: true; introduced: boolean; refusal?: string }
  | { ok: false; reason: "no_request" | "answer_refused"; error?: string };

/**
 * The company's Confirm on a job whose site asked for its pilot (spec addendum A2): an ordinary Apply under the company's
 * response line, carrying the offer's earliest start and how it charges after a pilot, then the introduction for the
 * site's press. A company that confirms with no request is told to apply instead; it is never introduced without one.
 */
export async function confirmPilotRequest(input: { taskId: string; companyId: string; company: Data; email: string; uid: string;
  statementVersion: string }, now: () => Date = () => new Date()): Promise<PilotConfirmResult> {
  const store = requireDb();
  const jobRef = store.collection(JOBS).doc(input.taskId);
  const requestRef = jobRef.collection(PILOT_REQUESTS_COLLECTION).doc(input.companyId);
  const { COMPANY_RESPONSES_COLLECTION, storedAliases } = await import("./jobCompanies");
  const request = (await requestRef.get()).data();
  const snapshot = sanitizePilotOfferBody(request?.offerSnapshot);
  if (!request || !snapshot || !instant(request.requestedAtIso)) return { ok: false, reason: "no_request" };
  if (request.state === "confirmed") return { ok: true, introduced: true };
  // (1) The Apply. An earlier application keeps its own words and details; the offer fills only what it left out.
  const prior = (await jobRef.collection(COMPANY_RESPONSES_COLLECTION).doc(input.companyId).get()).data();
  const applied = prior && INTRODUCIBLE_RESPONSE_STATES.includes(prior.state) && prior.recordedBy === "company";
  const kept = applied && prior.details && typeof prior.details === "object" ? prior.details as Data : {};
  const details = { ...kept, startWindow: kept.startWindow ?? snapshot.terms.earliestStart,
    chargeModel: kept.chargeModel ?? snapshot.terms.afterPilot };
  const { recordCompanyAnswer } = await import("./companyAnswer");
  const answered = await recordCompanyAnswer({ taskId: input.taskId, companyId: input.companyId, company: input.company,
    email: input.email, submittedBy: input.uid, state: "interested", inputs: applied && typeof prior.inputs === "string" ? prior.inputs : "",
    statementVersion: input.statementVersion, details, internalTestCompany: false });
  if (!answered.ok) return { ok: false, reason: "answer_refused", error: answered.error };
  // (2) The introduction for the site's earlier press, under the sentence it was shown and recorded with it.
  const [answer, job] = [(await jobRef.collection(COMPANY_RESPONSES_COLLECTION).doc(input.companyId).get()).data(), (await jobRef.get()).data()];
  const letter = storedAliases(job)[input.companyId];
  const { requestIntroduction } = await import("./jobIntroductions");
  const result = letter && answer ? await requestIntroduction({ requestId: input.taskId, alias: letter, actor: "site",
    statementVersion: String(request.introductionStatementVersion ?? ""), answerAtIso: String(answer.updatedAtIso ?? "") })
    : { ok: false as const, reason: "not_interested" as const };
  const decidedAtIso = now().toISOString();
  await store.runTransaction(async tx => {
    const current = (await tx.get(requestRef)).data();
    // Another press may have confirmed meanwhile: a confirmed request is never recast as refused.
    if (!current || current.requestedAtIso !== request.requestedAtIso || current.state === "confirmed") return;
    tx.set(requestRef, result.ok ? { state: "confirmed", decidedAtIso, introducedAtIso: result.introducedAtIso }
      : { state: "refused", refusal: result.reason, decidedAtIso }, { merge: true });
  });
  if (!result.ok) logger.info({ requestId: input.taskId, reason: result.reason }, "A pilot confirmation stands as an application; the introduction was not made");
  return result.ok ? { ok: true, introduced: true } : { ok: true, introduced: false, refusal: result.reason };
}
