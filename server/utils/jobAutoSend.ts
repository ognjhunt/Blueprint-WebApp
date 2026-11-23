/**
 * The automatic send (package E, E4; owner, 2026-11-12: every step is automatic).
 *
 * When a job first becomes listed (`teamJobAccess(record).listed`, the whole E2 rule), one transaction:
 * - records one `companySends` row per approved deployment company, `sentBy: "system"`, id `system-<companyId>`;
 * - queues the new-job email (kind `robot_team_new_task`) to each of those companies that has not turned job emails
 *   off and is not suppressed (`companyWantsJobEmails`, owner 2026-11-20); the dispatch gate (`jobAlertIsCurrent`) re-checks listing, approval, preference and suppression;
 * - queues the site's one `job_sent` email ("Your job is with {n} deployment companies.");
 * - writes `company_auto_send = { schemaVersion: 1, sentAtIso, count }` on the job, so it happens once.
 * A job with no approved deployment company yet is left for a later pass. A company approved later sees listed jobs in
 * its library; it is not emailed about them. A worker sweep catches any moment that was missed.
 *
 * Nothing identifying the site is read or written here: the email carries the job's link only.
 */
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { buildOutboxEntry, CAPTURE_OUTBOX_COLLECTION } from "./captureOutbox";
import { AUTO_SEND_EVENT_ID, COMPANY_SENDS_COLLECTION, companyJobUrl, prepareSiteNotice } from "./jobCompanies";
import { companyMaySeeJobs } from "./companyTerms";
import { newJobEmail } from "./robotTeamAccessEmails";
import { ROBOT_TEAM_ACCESS_COLLECTION, type RobotTeamAccessRecord } from "./robotTeamEarlyAccess";
import { loadCompanyJobAccess } from "./teamJobAccess";
import { JOB_SHARED_LISTING_VERSION } from "./taskListingDetails";
import { captureUploadUrlFor } from "./captureUploadToken";
import { companyWantsJobEmails, NEW_JOB_ALERT_SCHEMA, newJobAlertKey, suppressedForJobAlerts } from "./newJobAlerts";
import { createAutomationLeaderLease, type AutomationLeaderLease } from "./automationLeaderLease";
import { recordWorkerLoopPass } from "./workerHeartbeat";

export const AUTO_SEND_FIELD = "company_auto_send";

export type AutoSendResult =
  | { sent: true; count: number; emailed: number; sentAtIso: string }
  | { sent: false; reason: "not_listed" | "already_sent" | "no_companies" | "store_unavailable" };

const isPullRequestPreview = () => process.env.IS_PULL_REQUEST?.trim().toLowerCase() === "true";


/** Whether a robotTeamAccess row is one the automatic send would send to: a valid id and `companyMaySeeJobs`. */
const companyRowMaySeeJobs = (row: { id: string; data: RobotTeamAccessRecord }) =>
  /^[a-f0-9]{64}$/.test(row.id) && companyMaySeeJobs(row.data);

const ANY_COMPANY_CACHE_MS = 60_000;
let anyCompanyCache: { atMs: number; value: boolean } | null = null;
/**
 * Whether at least one approved deployment company may see jobs right now, by the same rule the automatic send uses.
 * The site's job page says its job is posted only when this holds. A yes is cached for a minute, since every page view
 * asks; a no is read again each time, so the page says posted as soon as a company accepts the Terms.
 */
export async function anyCompanyMaySeeJobs(nowMs = Date.now()): Promise<boolean> {
  if (anyCompanyCache && nowMs - anyCompanyCache.atMs < ANY_COMPANY_CACHE_MS) return anyCompanyCache.value;
  if (!db) return false;
  const approved = await db.collection(ROBOT_TEAM_ACCESS_COLLECTION).where("status", "==", "approved").get();
  const value = approved.docs.some(doc => companyRowMaySeeJobs({ id: doc.id, data: (doc.data() ?? {}) as RobotTeamAccessRecord }));
  anyCompanyCache = value ? { atMs: nowMs, value } : null;
  return value;
}
/** For tests: forget the cached answer. */
export function resetAnyCompanyMaySeeJobsCache() { anyCompanyCache = null; }

/** Send one job to every approved deployment company, once. Idempotent: a second call finds the marker and does nothing. */
export async function sendJobToApprovedCompanies(requestId: string, now: () => Date = () => new Date()): Promise<AutoSendResult> {
  if (!db) return { sent: false, reason: "store_unavailable" };
  const store = db;
  const jobRef = store.collection("inboundRequests").doc(requestId);
  const captureUrl = captureUploadUrlFor(requestId, "owner");
  return store.runTransaction(async (tx): Promise<AutoSendResult> => {
    const { record, access } = await loadCompanyJobAccess(requestId, undefined, tx);
    if (!record || !access.listed) return { sent: false, reason: "not_listed" };
    if (record[AUTO_SEND_FIELD]?.sentAtIso) return { sent: false, reason: "already_sent" };
    const approved = await tx.get(store.collection(ROBOT_TEAM_ACCESS_COLLECTION).where("status", "==", "approved"));
    const companies = approved.docs
      .map(doc => ({ id: doc.id, data: (doc.data() ?? {}) as RobotTeamAccessRecord }))
      // Only companies that may see jobs: approved, deployment, and the current Terms accepted. A company that has not
      // accepted gets no row, no email and is not counted; once it accepts, the job is in its library like any other.
      .filter(companyRowMaySeeJobs)
      .sort((a, b) => a.id.localeCompare(b.id));
    if (!companies.length) return { sent: false, reason: "no_companies" };
    // Reads first: each company's saved preference and suppression, and the site's notice row.
    const emailed: Array<{ id: string; email: string }> = [];
    for (const company of companies) {
      const email = String(company.data.email ?? "").trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
      const user = company.data.preferencesAccountUid
        ? (await tx.get(store.collection("users").doc(company.data.preferencesAccountUid))).data()?.updatePreferences : undefined;
      if (!companyWantsJobEmails(company.data, user)) continue;
      const suppression = (await tx.get(store.collection("email_suppressions").doc(email))).data();
      if (suppressedForJobAlerts(suppression)) continue;
      emailed.push({ id: company.id, email });
    }
    const siteNotice = await prepareSiteNotice(tx, requestId, record,
      { milestone: "job_sent", eventId: AUTO_SEND_EVENT_ID, companyCount: companies.length }, captureUrl);
    const sentAtIso = now().toISOString();
    const jobUrl = companyJobUrl(requestId);
    for (const company of companies) {
      tx.set(jobRef.collection(COMPANY_SENDS_COLLECTION).doc(`system-${company.id}`), { schemaVersion: 1, companyId: company.id,
        sentAtIso, sentBy: "system", sentByEmail: null });
    }
    for (const company of emailed) {
      const message = newJobEmail({ to: company.email, jobUrl });
      tx.create(store.collection(CAPTURE_OUTBOX_COLLECTION).doc(newJobAlertKey(requestId, company.id)), buildOutboxEntry({
        idempotencyKey: newJobAlertKey(requestId, company.id), requestId, kind: "robot_team_new_task", to: company.email,
        subject: message.subject, body: message.body, replyTo: "hello@tryblueprint.io",
        jobAlert: { schema: NEW_JOB_ALERT_SCHEMA, jobId: requestId, companyId: company.id } }));
    }
    siteNotice?.();
    tx.set(jobRef, { [AUTO_SEND_FIELD]: { schemaVersion: 1, sentAtIso, count: companies.length } }, { merge: true });
    return { sent: true, count: companies.length, emailed: emailed.length, sentAtIso };
  });
}

/** Best effort, for a caller at the moment a job may have become listed: never throws. */
export async function sendJobToCompaniesIfListed(requestId: string): Promise<AutoSendResult | null> {
  if (isPullRequestPreview()) return null;
  try { return await sendJobToApprovedCompanies(requestId); }
  catch (error) {
    logger.warn({ error, requestId }, "Automatic send did not run; the sweep will try again");
    return null;
  }
}

/** Where the sweep stopped last time, so every unsent job is examined in turn, whatever is ahead of it. */
export const AUTO_SEND_CURSOR_DOC = "automationState/companyAutoSendCursor";

/**
 * One sweep pass over one page of jobs shared under the current listing record, starting after the job the previous
 * pass stopped at and wrapping to the start at the end. Jobs that can never be sent (withdrawn, held, no sentence)
 * no longer fill the head of every pass: the cursor walks past them.
 */
export async function sweepAutomaticSends(pageSize = 100): Promise<{ examined: number; sent: number; wrapped: boolean }> {
  if (!db) return { examined: 0, sent: 0, wrapped: false };
  const cursorRef = db.doc(AUTO_SEND_CURSOR_DOC);
  const after = (await cursorRef.get()).data()?.after;
  let query = db.collection("inboundRequests")
    .where("public_task_listing.consentVersion", "==", JOB_SHARED_LISTING_VERSION).orderBy("__name__").limit(pageSize);
  if (typeof after === "string" && after) query = query.startAfter(after);
  const snapshot = await query.get();
  const wrapped = snapshot.docs.length < pageSize;
  const due = snapshot.docs.filter(doc => !doc.data()?.[AUTO_SEND_FIELD]?.sentAtIso);
  let sent = 0;
  for (const doc of due) {
    const result = await sendJobToCompaniesIfListed(doc.id);
    if (result?.sent) sent += 1;
  }
  await cursorRef.set({ after: wrapped ? null : snapshot.docs[snapshot.docs.length - 1].id, updatedAtIso: new Date().toISOString() });
  return { examined: due.length, sent, wrapped };
}

/** The worker's sweep, on the automation leader lease, once a minute. */
export function startAutomaticSendWorker(options: { intervalMs?: number; lease?: AutomationLeaderLease } = {}) {
  // A pull request preview shares the production store and must never send anything.
  if (isPullRequestPreview()) return () => undefined;
  const lease = options.lease ?? createAutomationLeaderLease({ leaseName: "company-automatic-send-leader" });
  lease.start();
  let stopped = false, running = false, timer: ReturnType<typeof setTimeout> | undefined;
  const run = async () => {
    if (stopped) return;
    if (!running && lease.isLeader()) {
      running = true;
      try { await sweepAutomaticSends(); await recordWorkerLoopPass("automatic-send"); }
      catch (error) { logger.error({ err: error }, "Automatic send sweep failed; it will retry"); }
      finally { running = false; }
    }
    if (!stopped) { timer = setTimeout(run, options.intervalMs ?? 60_000); timer.unref?.(); }
  };
  timer = setTimeout(run, 20_000); timer.unref?.();
  return () => { stopped = true; if (timer) clearTimeout(timer); void lease.stop(); };
}
