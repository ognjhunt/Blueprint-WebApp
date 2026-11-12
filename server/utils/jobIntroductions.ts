/**
 * Introductions (package E, E6): the site presses "Introduce us" beside a company that answered Interested, and both
 * sides are emailed each other's details. No person at Blueprint is in the loop.
 *
 * `requestIntroduction` is one transaction that re-checks everything (the whole sharing rule, the company's approval as
 * a deployment company, a standing Interested answer the company itself gave under the current line
 * `company-response-2026-11-12`), enforces at most three introductions per job, and writes, all or nothing:
 * - `inboundRequests/{id}/introductions/{companyId}` = `{ schemaVersion: 1, alias, requestedAtIso, by: "site",
 *   siteShared: { name, contactName, email, phone?, location }, companyShared: { company, contactName, email, website? },
 *   outcomes: [] }` (`outcomes` is appended to by the outcome questions, E8; never rewritten here);
 * - the billable event (E7, `billableEvents.ts`): no price, nothing charged;
 * - the email to the company (`introduction_made_company`), with the site's details and the job link;
 * - the email to the site (`introduction_made_site`), with the company's details, in the site side's words.
 *
 * This is the only place the site's name and contact details go to a company, and only to the one it chose.
 */
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { COMPANY_RESPONSE_LABELS, INTRODUCIBLE_RESPONSE_STATES, MAX_INTRODUCTIONS_PER_JOB,
  type CompanyResponseState } from "../../client/src/lib/companyResponses";
import { buildOutboxEntry, CAPTURE_OUTBOX_COLLECTION } from "./captureOutbox";
import { buildIntroductionBillableEvent, writeIntroductionBillableEvent } from "./billableEvents";
import { COMPANY_RESPONSES_COLLECTION, INTRODUCTIONS_COLLECTION, answerConsentsToIntroduction, companyJobUrl,
  isApprovedDeploymentCompany, storedAliases } from "./jobCompanies";
import { introductionCompanyEmail, type IntroductionSiteDetails } from "./robotTeamAccessEmails";
import { ROBOT_TEAM_ACCESS_COLLECTION, type RobotTeamAccessRecord } from "./robotTeamEarlyAccess";
import { loadCompanyJobAccess } from "./teamJobAccess";
import { introductionCompanyKey, INTRODUCTION_COMPANY_KIND } from "./jobIntroductionGate";
import { captureUploadUrlFor } from "./captureUploadToken";
import { decryptFieldValue } from "./field-encryption";

export type IntroductionRefusal = "not_listed" | "not_interested" | "consent_missing" | "limit_reached"
  | "already_introduced" | "company_not_approved";
export type IntroductionResult = { ok: true; introducedAtIso: string } | { ok: false; reason: IntroductionRefusal };

export const INTRODUCTION_SITE_KIND = "introduction_made_site";
export const introductionSiteKey = (requestId: string, companyId: string) => `${requestId}:${INTRODUCTION_SITE_KIND}:${companyId}`;

/** The site's email in the site side's words (`introductionSiteEmail.ts`). Injectable for tests. */
export type SiteIntroductionEmail = (input: { jobUrl: string;
  company: { name: string; contactName: string; email: string; website: string | null } }) => { subject: string; body: string };

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

/** The site's details as the one chosen company is given them. */
async function siteDetailsOf(record: Record<string, any>, decrypt: (value: unknown) => Promise<string>): Promise<IntroductionSiteDetails> {
  const [siteName, company, first, last, email, location] = [await decrypt(record.request?.siteName),
    await decrypt(record.contact?.company), await decrypt(record.contact?.firstName), await decrypt(record.contact?.lastName),
    await decrypt(record.contact?.email), await decrypt(record.request?.siteLocation)];
  const name = siteName && siteName !== "Untitled site" ? siteName : company || "The site";
  return { name, contactName: [first, last].filter(Boolean).join(" ") || null, email,
    phone: null, location: location && location !== "Location pending" ? location : null };
}

export async function requestIntroduction(input: { requestId: string; alias: string; actor: "site" },
  deps: IntroductionDeps = {}): Promise<IntroductionResult> {
  if (!db) throw new Error("introduction_store_unavailable");
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
      await tx.get(jobRef.collection(INTRODUCTIONS_COLLECTION).limit(MAX_INTRODUCTIONS_PER_JOB + 1))];
    if (introSnap.exists) return { ok: false, reason: "already_introduced" };
    const company = companySnap.data() as RobotTeamAccessRecord | undefined;
    if (!company || !isApprovedDeploymentCompany(company)) return { ok: false, reason: "company_not_approved" };
    const answer = answerSnap.data();
    // A standing `interested` or `tested_can_do` answer (E9).
    if (!INTRODUCIBLE_RESPONSE_STATES.includes(answer?.state)) return { ok: false, reason: "not_interested" };
    if (!answerConsentsToIntroduction(answer)) return { ok: false, reason: "consent_missing" };
    // The count lives on the job document, which this transaction has read: two presses at once both write it, so
    // Firestore retries one of them and it sees the other's count. The collection count is a floor for older jobs.
    const used = Math.max(introductions.size, Number.isInteger(record.introductions_used) ? Number(record.introductions_used) : 0);
    if (used >= MAX_INTRODUCTIONS_PER_JOB) return { ok: false, reason: "limit_reached" };
    const companyEmail = String(company.email ?? "").trim().toLowerCase();
    const companyShared = { company: text(company.company) ?? "", contactName: text(company.name) ?? "", email: companyEmail,
      ...(text(company.website) ? { website: text(company.website)! } : {}) };
    const site = await siteDetailsOf(record, decrypt);
    const companyRowRef = store.collection(CAPTURE_OUTBOX_COLLECTION).doc(introductionCompanyKey(input.requestId, companyId));
    const siteRowRef = store.collection(CAPTURE_OUTBOX_COLLECTION).doc(introductionSiteKey(input.requestId, companyId));
    const [companyRow, siteRow] = [await tx.get(companyRowRef), await tx.get(siteRowRef)];
    const requestedAtIso = now().toISOString();
    tx.set(jobRef, { introductions_used: used + 1 }, { merge: true });
    tx.create(jobRef.collection(INTRODUCTIONS_COLLECTION).doc(companyId), { schemaVersion: 1, alias: letter, requestedAtIso,
      by: input.actor, siteShared: { name: site.name, contactName: site.contactName, email: site.email,
        ...(site.phone ? { phone: site.phone } : {}), location: site.location }, companyShared, outcomes: [] });
    writeIntroductionBillableEvent(tx, buildIntroductionBillableEvent(input.requestId, companyId, requestedAtIso));
    if (!companyRow.exists && EMAIL.test(companyEmail)) {
      const message = introductionCompanyEmail({ site, jobUrl: companyJobUrl(input.requestId), contactName: companyShared.contactName,
        answerLabel: COMPANY_RESPONSE_LABELS[answer!.state as CompanyResponseState] });
      tx.create(companyRowRef, buildOutboxEntry({ idempotencyKey: companyRowRef.id, requestId: input.requestId,
        kind: INTRODUCTION_COMPANY_KIND, to: companyEmail, subject: message.subject, body: message.body,
        replyTo: EMAIL.test(site.email) ? site.email : "hello@tryblueprint.io" }));
    }
    if (!siteRow.exists && EMAIL.test(site.email)) {
      const message = siteEmail({ jobUrl: captureUploadUrlFor(input.requestId, "owner"), company: { name: companyShared.company,
        contactName: companyShared.contactName, email: companyEmail, website: companyShared.website ?? null } });
      tx.create(siteRowRef, buildOutboxEntry({ idempotencyKey: siteRowRef.id, requestId: input.requestId,
        kind: INTRODUCTION_SITE_KIND, to: site.email, subject: message.subject, body: message.body,
        replyTo: EMAIL.test(companyEmail) ? companyEmail : "hello@tryblueprint.io" }));
    } else if (!EMAIL.test(site.email)) {
      logger.warn({ requestId: input.requestId }, "The site has no usable email; its introduction email is not queued");
    }
    return { ok: true, introducedAtIso: requestedAtIso };
  });
}
