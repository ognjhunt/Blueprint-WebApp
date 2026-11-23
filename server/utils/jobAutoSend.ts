/**
 * The automatic send (package E, E4; owner, 2026-11-12: every step is automatic).
 *
 * When a job first becomes listed (`teamJobAccess(record).listed`, the whole E2 rule), one transaction:
 * - records one `companySends` row per approved deployment company, `sentBy: "system"`, id `system-<companyId>`;
 * - queues the new-job email (kind `robot_team_new_task`) to each of those companies that has not turned job emails
 *   off and is not suppressed (`companyWantsJobEmails`, owner 2026-11-20); the dispatch gate (`jobAlertIsCurrent`) re-checks listing, approval, preference and suppression;
 * The site gets no email of its own here: its job link email already said the job goes to approved deployment
 *   companies once the video is in, and how to stop (ledger AL38, 2026-11-23).
 * - writes `company_auto_send = { schemaVersion: 1, sentAtIso, count }` on the job, so it happens once.
 * A job with no approved deployment company yet is left for a later pass. A company that accepts the Terms after a job
 * was sent sees it in its library and gets ONE email about the jobs open to it (`emailOpenJobsToCompany`, audit B-03).
 * A worker sweep catches any moment that was missed.
 *
 * Nothing identifying the site is written here: the email carries the kind of job, the country and the job's link.
 */
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { buildOutboxEntry, CAPTURE_OUTBOX_COLLECTION } from "./captureOutbox";
import { COMPANY_SENDS_COLLECTION, companyJobUrl } from "./jobCompanies";
import { companyMaySeeJobs } from "./companyTerms";
import { newJobEmail, openJobsEmail } from "./robotTeamAccessEmails";
import { ROBOT_TEAM_ACCESS_COLLECTION, type RobotTeamAccessRecord } from "./robotTeamEarlyAccess";
import { loadCompanyJobAccess } from "./teamJobAccess";
import { countryOf } from "./companyJobPage";
import { JOB_SHARED_LISTING_VERSION } from "./taskListingDetails";
import { companyWantsJobEmails, NEW_JOB_ALERT_SCHEMA, newJobAlertKey, suppressedForJobAlerts } from "./newJobAlerts";
import { createAutomationLeaderLease, type AutomationLeaderLease } from "./automationLeaderLease";
import { createAccountSignInToken, JOB_EMAIL_SIGN_IN_TTL_SECONDS } from "./request-review-auth";
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
    const emailed: Array<{ id: string; email: string; revision: string | null }> = [];
    for (const company of companies) {
      const email = String(company.data.email ?? "").trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
      const user = company.data.preferencesAccountUid
        ? (await tx.get(store.collection("users").doc(company.data.preferencesAccountUid))).data()?.updatePreferences : undefined;
      if (!companyWantsJobEmails(company.data, user)) continue;
      const suppression = (await tx.get(store.collection("email_suppressions").doc(email))).data();
      if (suppressedForJobAlerts(suppression)) continue;
      emailed.push({ id: company.id, email, revision: typeof company.data.decidedAtIso === "string" ? company.data.decidedAtIso : null });
    }
    const sentAtIso = now().toISOString();
    const jobUrl = companyJobUrl(requestId);
    const country = await countryOf(record);
    for (const company of companies) {
      tx.set(jobRef.collection(COMPANY_SENDS_COLLECTION).doc(`system-${company.id}`), { schemaVersion: 1, companyId: company.id,
        sentAtIso, sentBy: "system", sentByEmail: null });
    }
    for (const company of emailed) {
      const message = newJobEmail({ to: company.email, jobUrl: jobEmailUrl(jobUrl, requestId, company), kind: access.details.taskFamily,
        country });
      tx.create(store.collection(CAPTURE_OUTBOX_COLLECTION).doc(newJobAlertKey(requestId, company.id)), buildOutboxEntry({
        idempotencyKey: newJobAlertKey(requestId, company.id), requestId, kind: "robot_team_new_task", to: company.email,
        subject: message.subject, body: message.body, replyTo: "hello@tryblueprint.io",
        jobAlert: { schema: NEW_JOB_ALERT_SCHEMA, jobId: requestId, companyId: company.id } }));
    }
    tx.set(jobRef, { [AUTO_SEND_FIELD]: { schemaVersion: 1, sentAtIso, count: companies.length } }, { merge: true });
    return { sent: true, count: companies.length, emailed: emailed.length, sentAtIso };
  });
}

/**
 * The job's page with this company's one-use sign-in link for it (owner, 2026-11-23): a company that is not signed in
 * is signed in on the way, and one that is goes straight to the job (`CompanyJob.tsx`). The link is bound to the
 * company's approved record and its decision, so a withdrawn or re-decided approval ends it.
 */
export function jobEmailUrl(jobUrl: string, jobId: string, company: { id: string; email: string; revision: string | null }): string {
  if (!company.revision) return jobUrl;
  const token = createAccountSignInToken({ email: company.email, sourceId: company.id, revision: company.revision, job: jobId },
    JOB_EMAIL_SIGN_IN_TTL_SECONDS);
  return `${jobUrl}?link=${encodeURIComponent(token)}`;
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

const OPEN_JOBS_PAGE = 200;

export const openJobsKey = (companyId: string) => `robot_team_open_jobs:${companyId}`;

/**
 * Once per company, right after it accepts the Terms (audit B-03): when a listed job was already sent before it could
 * see jobs, one email points it to Find jobs. It goes through the new-job email's own dispatch gate (`jobAlertIsCurrent`:
 * that job still listed, the company approved with the Terms accepted, job emails not turned off, not suppressed).
 * A job not yet sent is left to the send itself, which now includes this company. Best effort: never throws.
 */
export async function emailOpenJobsToCompany(companyId: string): Promise<boolean> {
  if (!db || isPullRequestPreview() || !/^[a-f0-9]{64}$/.test(companyId)) return false;
  const store = db;
  try {
    const ref = store.collection(CAPTURE_OUTBOX_COLLECTION).doc(openJobsKey(companyId));
    if ((await ref.get()).exists) return false;
    const company = (await store.collection(ROBOT_TEAM_ACCESS_COLLECTION).doc(companyId).get()).data() as RobotTeamAccessRecord | undefined;
    const email = String(company?.email ?? "").trim().toLowerCase();
    if (!company || !companyMaySeeJobs(company) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
    // Every page of shared jobs is read until one qualifies: a full first page of withdrawn or already-sent jobs
    // must not hide an open one behind it.
    let jobId: string | null = null;
    let after: FirebaseFirestore.QueryDocumentSnapshot | null = null;
    while (!jobId) {
      let query = store.collection("inboundRequests")
        .where("public_task_listing.consentVersion", "==", JOB_SHARED_LISTING_VERSION).orderBy("__name__").limit(OPEN_JOBS_PAGE);
      if (after) query = query.startAfter(after);
      const jobs = await query.get();
      for (const doc of jobs.docs) {
        if (!doc.data()?.[AUTO_SEND_FIELD]?.sentAtIso) continue;
        const sent = await doc.ref.collection(COMPANY_SENDS_COLLECTION).where("companyId", "==", companyId).limit(1).get();
        if (!sent.empty) continue;
        if ((await loadCompanyJobAccess(doc.id, doc.data())).access.listed) { jobId = doc.id; break; }
      }
      if (jobs.docs.length < OPEN_JOBS_PAGE) break;
      after = jobs.docs[jobs.docs.length - 1];
    }
    if (!jobId) return false;
    const message = openJobsEmail({ to: email });
    await ref.create(buildOutboxEntry({ idempotencyKey: ref.id, requestId: jobId, kind: "robot_team_new_task", to: email,
      subject: message.subject, body: message.body, replyTo: "hello@tryblueprint.io",
      jobAlert: { schema: NEW_JOB_ALERT_SCHEMA, jobId, companyId } }));
    return true;
  } catch (error) {
    logger.warn({ error }, "Could not queue the open-jobs email for a company");
    return false;
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
