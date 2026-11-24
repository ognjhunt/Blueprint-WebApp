/**
 * Introductions (package E, E6): the site presses "Introduce us" beside a company that answered Interested, and both
 * sides are emailed each other's details. No person at Blueprint is in the loop.
 *
 * `requestIntroduction` is one transaction that re-checks everything (the whole sharing rule, the company's approval as
 * a deployment company under the current Terms, a standing Interested answer the company itself gave under the current
 * line `company-response-2026-11-12` or Blueprint recorded from its email: `answerConsentsToIntroduction`), and
 * writes, all or nothing (one introduction per company; no limit per job: owner,
 * 2026-11-12, "if they want to talk to 1 that should be fine if they want to go through the steps with 8 that should be
 * fine"):
 * - `inboundRequests/{id}/introductions/{companyId}` = `{ schemaVersion: 1, alias, requestedAtIso, by: "site",
 *   siteShared: { name, contactName, email, phone?, location }, companyShared: { company, contactName, email, website? },
 *   each field encrypted at rest (`introductionShared.ts`; this covers the introduction record; the two emails' outbox
 *   rows hold the details in plain text until each is sent or cancelled, when `captureOutbox.ts` clears them),
 *   outcomes: [] }` (`outcomes` is appended to by the outcome questions, E8; never rewritten here);
 * - the billable event (E7, `billableEvents.ts`): no price, nothing charged;
 * - the email to the company (`introduction_made_company`), with the site's details and the job link;
 * - the email to the site (`introduction_made_site`), with the company's details, in the site side's words.
 *
 * This is the only place the site's name and contact details go to a company, and only to the one it chose.
 */
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { CHARGE_MODELS, COMPANY_ESTIMATE_STATEMENT_VERSIONS, COMPANY_RESPONSE_LABELS, SITE_RESPONSE_LABELS, INTRODUCIBLE_RESPONSE_STATES,
  isApplicationEstimate, type AcceptedEstimate, type CompanyResponseState } from "../../client/src/lib/companyResponses";
import { buildOutboxEntry, CAPTURE_OUTBOX_COLLECTION } from "./captureOutbox";
import { billableEventRef, buildIntroductionBillableEvent, writeIntroductionBillableEvent } from "./billableEvents";
import { COMPANY_RESPONSES_COLLECTION, INTRODUCTIONS_COLLECTION, answerConsentsToIntroduction, companyJobUrl,
  storedAliases } from "./jobCompanies";
import { companyMaySeeJobs } from "./companyTerms";
import { HELD_STATUS } from "./jobIntroductionGate";
import { introductionCompanyEmail, type IntroductionSiteDetails } from "./robotTeamAccessEmails";
import { ROBOT_TEAM_ACCESS_COLLECTION, type RobotTeamAccessRecord } from "./robotTeamEarlyAccess";
import { loadCompanyJobAccess } from "./teamJobAccess";
import { introductionAttemptOf, introductionCompanyKey, introductionSiteEmailKey, INTRODUCTION_COMPANY_KIND,
  RETRYABLE_CANCEL_REASONS } from "./jobIntroductionGate";
import { captureUploadUrlFor } from "./captureUploadToken";
import { decryptFieldValue } from "./field-encryption";
import { sealShared } from "./introductionShared";
import { INTRODUCTION_REQUEST_STATEMENT_2026_11_12_VERSION, INTRODUCTION_REQUEST_STATEMENT_VERSION,
  isIntroductionStatementVersion } from "../../client/src/lib/siteIntroductions";

export type IntroductionRefusal = "statement_not_current" | "not_listed" | "not_interested" | "consent_missing"
  | "already_introduced" | "company_not_approved";
export type IntroductionResult = { ok: true; introducedAtIso: string } | { ok: false; reason: IntroductionRefusal };

export const INTRODUCTION_SITE_KIND = "introduction_made_site";
export const introductionSiteKey = (requestId: string, companyId: string, attempt = 0) =>
  introductionSiteEmailKey(requestId, companyId, attempt);

/** The site's email in the site side's words (`introductionSiteEmail.ts`). Injectable for tests. */
export type SiteIntroductionEmail = (input: { jobUrl: string;
  company: { name: string; contactName: string; email: string; website: string | null };
  /** The company's stored answer as its fixed label ("Interested", "Tested it: can do"). */
  answerLabel?: string | null }) => { subject: string; body: string };

export interface IntroductionDeps {
  now?: () => Date;
  decrypt?: (value: unknown) => Promise<string>;
  siteEmail?: SiteIntroductionEmail;
}

const text = (value: unknown): string | null => typeof value === "string" && value.trim() ? value.trim() : null;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** "A", "Company A" or "company a" → "A". */
export function aliasLetterOf(alias: string): string | null {
  const letter = alias.trim().replace(/^company\s+/i, "").toUpperCase();
  return /^[A-Z]{1,3}$/.test(letter) ? letter : null;
}

async function defaultDecrypt(value: unknown): Promise<string> {
  if (value == null || value === "") return "";
  return String(await decryptFieldValue(value as never) ?? "").trim();
}

async function defaultSiteEmail(): Promise<SiteIntroductionEmail> {
  const { introductionMadeSiteEmail } = await import("./introductionSiteEmail");
  return introductionMadeSiteEmail;
}

/** The intake stores "there" and "—" for a name the start form left blank (`inbound-request.ts`); they name nobody. */
const typedName = (value: string) => value && value.toLowerCase() !== "there" && value !== "—" ? value : "";

/** The site's details as the one chosen company is given them. */
async function siteDetailsOf(record: Record<string, any>, decrypt: (value: unknown) => Promise<string>): Promise<IntroductionSiteDetails> {
  const [siteName, company, first, last, email, location] = [await decrypt(record.request?.siteName),
    await decrypt(record.contact?.company), await decrypt(record.contact?.firstName), await decrypt(record.contact?.lastName),
    await decrypt(record.contact?.email), await decrypt(record.request?.siteLocation)];
  const name = siteName && siteName !== "Untitled site" ? siteName : company || "The site";
  return { name, contactName: [typedName(first), typedName(last)].filter(Boolean).join(" ") || null, email,
    phone: null, location: location && location !== "Location pending" ? location : null };
}

/**
 * The sentence beside Accept that is true for this job (2026-11-24), by what the company would be given
 * (`siteDetailsOf`): the current one (the site's email and the place it gave) when the record holds no name of the
 * site's own and no person's, as for every job from the start form, which asks for none; else the sentence of
 * 2026-11-12 (the name, the address and the contact details), every word of which is then true. Each says exactly what
 * the company receives, so nothing the site did not agree to is given.
 */
export function introductionStatementVersionFor(site: IntroductionSiteDetails): string {
  const named = Boolean(site.contactName) || (site.name !== "The site" && site.name !== site.location);
  return named ? INTRODUCTION_REQUEST_STATEMENT_2026_11_12_VERSION : INTRODUCTION_REQUEST_STATEMENT_VERSION;
}

/** The sentence a job's page shows beside Accept (`introductionStatementVersionFor`), read from the job's record. */
export async function introductionStatementVersionOf(record: Record<string, any>, deps: Pick<IntroductionDeps, "decrypt"> = {}):
  Promise<string> {
  return introductionStatementVersionFor(await siteDetailsOf(record, deps.decrypt ?? defaultDecrypt));
}

/**
 * The estimate the company's answer gave when the site pressed Accept, as the site read it then, so the site's page can
 * say when it changed after (stress test, 2026-11-24). Only for an answer under a line that shows the site its estimate
 * (`COMPANY_ESTIMATE_STATEMENT_VERSIONS`): null when that answer gave none; undefined for any other answer (nothing is
 * recorded, and the site was shown no estimate).
 */
export function estimateAtAccept(answer: Record<string, any> | undefined): AcceptedEstimate | null | undefined {
  if (!answer || !COMPANY_ESTIMATE_STATEMENT_VERSIONS.includes(String(answer.statementVersion))) return undefined;
  const details = answer.details && typeof answer.details === "object" ? answer.details as Record<string, unknown> : {};
  const chargeModel = CHARGE_MODELS.find(model => model === details.chargeModel);
  return chargeModel && chargeModel !== "undecided" && isApplicationEstimate(details.estimate)
    ? { chargeModel, estimate: { lowUsd: details.estimate.lowUsd, highUsd: details.estimate.highUsd } } : null;
}

/** The introductions read to count those that stand (recorded on the job); far above any real count. */
const INTRODUCTION_READ_LIMIT = 1000;

export async function requestIntroduction(input: { requestId: string; alias: string; actor: "site";
  /** The recorded statement beside "Introduce us" the site agreed to: it must be the current one. */
  statementVersion?: string | null },
  deps: IntroductionDeps = {}): Promise<IntroductionResult> {
  if (!db) throw new Error("introduction_store_unavailable");
  // Pressing the button is the site's agreement to give the company its details, under the sentence it was shown: one
  // of the recorded versions here, and below, inside the transaction, the one that is true for this job.
  if (!isIntroductionStatementVersion(input.statementVersion)) return { ok: false, reason: "statement_not_current" };
  const store = db;
  const now = deps.now ?? (() => new Date());
  const decrypt = deps.decrypt ?? defaultDecrypt;
  const siteEmail = deps.siteEmail ?? await defaultSiteEmail();
  const letter = aliasLetterOf(input.alias);
  const jobRef = store.collection("inboundRequests").doc(input.requestId);
  return store.runTransaction(async (tx): Promise<IntroductionResult> => {
    const { record, access } = await loadCompanyJobAccess(input.requestId, undefined, tx);
    if (!record || !access.listed) return { ok: false, reason: "not_listed" };
    const companyId = letter ? Object.entries(storedAliases(record)).find(([, value]) => value === letter)?.[0] : undefined;
    if (!companyId) return { ok: false, reason: "not_interested" };
    const [companySnap, answerSnap, introSnap, introductions] = [
      await tx.get(store.collection(ROBOT_TEAM_ACCESS_COLLECTION).doc(companyId)),
      await tx.get(jobRef.collection(COMPANY_RESPONSES_COLLECTION).doc(companyId)),
      await tx.get(jobRef.collection(INTRODUCTIONS_COLLECTION).doc(companyId)),
      await tx.get(jobRef.collection(INTRODUCTIONS_COLLECTION).limit(INTRODUCTION_READ_LIMIT))];
    // One introduction per company per job. One cancelled at dispatch (G3) is not made again, except when Blueprint's
    // own email to the company failed or was never sent, or the company changed its answer before its email went
    // (`RETRYABLE_CANCEL_REASONS`): then the site may press again (for a changed answer, once the company applied again,
    // checked below), and the new attempt has its own emails' keys and its own billable event; the earlier stays void.
    const earlier = introSnap.data();
    const retry = introSnap.exists && typeof earlier?.cancelledAtIso === "string" && RETRYABLE_CANCEL_REASONS.has(String(earlier?.cancelReason));
    if (introSnap.exists && !retry) return { ok: false, reason: "already_introduced" };
    const attempt = retry ? introductionAttemptOf(earlier) + 1 : 0;
    // The billable event is the money record of the attempt: one on record (even void, even without its introduction
    // record) refuses too, so an attempt is never recorded twice and an event is never rewritten.
    if ((await tx.get(billableEventRef(input.requestId, companyId, attempt))).exists) return { ok: false, reason: "already_introduced" };
    const company = companySnap.data() as RobotTeamAccessRecord | undefined;
    if (!company || !companyMaySeeJobs(company)) return { ok: false, reason: "company_not_approved" };
    const answer = answerSnap.data();
    // A standing `interested` or `tested_can_do` answer (E9).
    if (!INTRODUCIBLE_RESPONSE_STATES.includes(answer?.state)) return { ok: false, reason: "not_interested" };
    if (!answerConsentsToIntroduction(answer)) return { ok: false, reason: "consent_missing" };
    // There is no limit per job. The count of introductions on record that were not cancelled is kept on the job. Two
    // presses at once both write the job document, which this transaction has read, so Firestore retries one of them,
    // and a second press for the same company then finds its introduction (`already_introduced`).
    const used = introductions.docs.filter(doc => typeof doc.data()?.cancelledAtIso !== "string").length;
    const companyEmail = String(company.email ?? "").trim().toLowerCase();
    const companyShared = { company: text(company.company) ?? "", contactName: text(company.name) ?? "", email: companyEmail,
      ...(text(company.website) ? { website: text(company.website)! } : {}) };
    const site = await siteDetailsOf(record, decrypt);
    // The sentence the site agreed to must be the one true for what this job gives (`introductionStatementVersionFor`):
    // a page showing another (an old tab, or a record that changed) is refused before anything is recorded.
    const statementVersion = introductionStatementVersionFor(site);
    if (input.statementVersion !== statementVersion) return { ok: false, reason: "statement_not_current" };
    const companyRowRef = store.collection(CAPTURE_OUTBOX_COLLECTION).doc(introductionCompanyKey(input.requestId, companyId, attempt));
    const siteRowRef = store.collection(CAPTURE_OUTBOX_COLLECTION).doc(introductionSiteKey(input.requestId, companyId, attempt));
    const [companyRow, siteRow] = [await tx.get(companyRowRef), await tx.get(siteRowRef)];
    const requestedAtIso = now().toISOString();
    tx.set(jobRef, { introductions_used: used + 1 }, { merge: true });
    // A retry replaces the cancelled record (its details were already removed); the void event keeps the earlier attempt.
    const introRef = jobRef.collection(INTRODUCTIONS_COLLECTION).doc(companyId);
    tx[retry ? "set" : "create"](introRef, { schemaVersion: 1, alias: letter, requestedAtIso,
      by: input.actor, ...(attempt > 0 ? { attempt } : {}),
      // Not personal, so stored plainly: the recorded statement the site agreed to by pressing the button.
      statementVersion,
      // Both sides' details are encrypted at rest on this record (`introductionShared.ts`). The emails below use the plain
      // values; their outbox rows are cleared of them once sent or cancelled (`captureOutbox.ts`).
      siteShared: await sealShared({ name: site.name, contactName: site.contactName, email: site.email, phone: site.phone,
        location: site.location }),
      companyShared: await sealShared(companyShared), outcomes: [],
      // The company's own figures as the site read them beside Accept (not personal, so plain), for "Changed after you
      // accepted"; only under a line that shows the site an estimate.
      ...(estimateAtAccept(answer) !== undefined ? { estimateAtAccept: estimateAtAccept(answer) } : {}) });
    writeIntroductionBillableEvent(tx, buildIntroductionBillableEvent(input.requestId, companyId, requestedAtIso, attempt));
    if (!companyRow.exists && EMAIL.test(companyEmail)) {
      const message = introductionCompanyEmail({ site, jobUrl: companyJobUrl(input.requestId), contactName: companyShared.contactName,
        answerLabel: COMPANY_RESPONSE_LABELS[answer!.state as CompanyResponseState],
        // The word of the sentence the site agreed to: "the place you gave us", or the older "address".
        placeLabel: statementVersion === INTRODUCTION_REQUEST_STATEMENT_VERSION ? "Place" : "Address" });
      tx.create(companyRowRef, buildOutboxEntry({ idempotencyKey: companyRowRef.id, requestId: input.requestId,
        kind: INTRODUCTION_COMPANY_KIND, to: companyEmail, subject: message.subject, body: message.body,
        replyTo: EMAIL.test(site.email) ? site.email : "hello@tryblueprint.io" }));
    }
    if (!siteRow.exists && EMAIL.test(site.email)) {
      const message = siteEmail({ jobUrl: captureUploadUrlFor(input.requestId, "owner"), company: { name: companyShared.company,
        contactName: companyShared.contactName, email: companyEmail, website: companyShared.website ?? null },
        answerLabel: SITE_RESPONSE_LABELS[answer!.state as CompanyResponseState] });
      // One commit point (H2): the site's "Meet {company}" is held until the company's email is sent. With no company
      // email to send, it is left pending, and its dispatch check cancels the introduction as a whole.
      const siteEntry = buildOutboxEntry({ idempotencyKey: siteRowRef.id, requestId: input.requestId,
        kind: INTRODUCTION_SITE_KIND, to: site.email, subject: message.subject, body: message.body,
        replyTo: EMAIL.test(companyEmail) ? companyEmail : "hello@tryblueprint.io" });
      tx.create(siteRowRef, EMAIL.test(companyEmail) ? { ...siteEntry, status: HELD_STATUS } : siteEntry);
    } else if (!EMAIL.test(site.email)) {
      logger.warn({ requestId: input.requestId }, "The site has no usable email; its introduction email is not queued");
    }
    return { ok: true, introducedAtIso: requestedAtIso };
  });
}

/**
 * After an introduction, the site says how it went (owner, 2026-11-23: the site's job reads like a shipment tracker,
 * posted → companies looking → responses → introduced → visit → pilot). Blueprint cannot see a visit or a pilot, so
 * only the site's own press records one: the date it pressed, or none again when it takes the press back. Only on an
 * introduction that went ahead (made, not cancelled), for a job that is still the site's own (not withdrawn).
 */
export type IntroductionStep = "visit" | "pilot";
export const INTRODUCTION_STEPS: readonly IntroductionStep[] = ["visit", "pilot"];
export type IntroductionProgressResult = { ok: true; progress: { visitAtIso?: string; pilotAtIso?: string } }
  | { ok: false; reason: "not_introduced" | "withdrawn" };

export async function markIntroductionProgress(input: { requestId: string; alias: string; step: IntroductionStep; done: boolean },
  now: () => Date = () => new Date()): Promise<IntroductionProgressResult> {
  if (!db) throw new Error("introduction_store_unavailable");
  const store = db;
  const letter = aliasLetterOf(input.alias);
  const jobRef = store.collection("inboundRequests").doc(input.requestId);
  return store.runTransaction(async (tx): Promise<IntroductionProgressResult> => {
    const record = (await tx.get(jobRef)).data();
    if (!record) return { ok: false, reason: "not_introduced" };
    const { projectWebsiteCaptureRights } = await import("./websiteCaptureRights");
    if (projectWebsiteCaptureRights(record).consent_revoked || record.capture_withdrawal) return { ok: false, reason: "withdrawn" };
    const companyId = letter ? Object.entries(storedAliases(record)).find(([, value]) => value === letter)?.[0] : undefined;
    if (!companyId) return { ok: false, reason: "not_introduced" };
    const ref = jobRef.collection(INTRODUCTIONS_COLLECTION).doc(companyId);
    const intro = (await tx.get(ref)).data();
    if (!intro || typeof intro.cancelledAtIso === "string") return { ok: false, reason: "not_introduced" };
    const prior = intro.progress && typeof intro.progress === "object" ? intro.progress as Record<string, unknown> : {};
    const field = `${input.step}AtIso`;
    const keep = Object.fromEntries(INTRODUCTION_STEPS.map(step => `${step}AtIso`)
      .filter(key => key !== field && typeof prior[key] === "string").map(key => [key, prior[key] as string]));
    const progress = { ...keep, ...(input.done ? { [field]: typeof prior[field] === "string" ? prior[field] : now().toISOString() } : {}) };
    tx.update(ref, { progress: { ...progress, updatedAtIso: now().toISOString(), markedBy: "site" } });
    return { ok: true, progress: Object.fromEntries(Object.entries(progress).filter(([key]) => key === "visitAtIso" || key === "pilotAtIso")) };
  });
}
