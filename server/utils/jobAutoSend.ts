/**
 * The automatic send (package E, E4; owner, 2026-11-12: every step is automatic).
 *
 * When a job first becomes listed (`teamJobAccess(record).listed`, the whole E2 rule), one transaction:
 * - records one `companySends` row per approved deployment company, `sentBy: "system"`, id `system-<companyId>`;
 * - queues the new-job email (kind `robot_team_new_task`) to each of those companies that asked for job emails and is
 *   not suppressed; the dispatch gate (`jobAlertIsCurrent`) re-checks listing, approval, preference and suppression;
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
import { AUTO_SEND_EVENT_ID, COMPANY_SENDS_COLLECTION, companyJobUrl, isApprovedDeploymentCompany, prepareSiteNotice } from "./jobCompanies";
import { newJobEmail } from "./robotTeamAccessEmails";
import { ROBOT_TEAM_ACCESS_COLLECTION, type RobotTeamAccessRecord } from "./robotTeamEarlyAccess";
import { loadCompanyJobAccess } from "./teamJobAccess";
import { JOB_SHARED_LISTING_VERSION } from "./taskListingDetails";
import { savedUpdatePreferences } from "./updatePreferences";
import { captureUploadUrlFor } from "./captureUploadToken";
import { NEW_JOB_ALERT_SCHEMA, newJobAlertKey, suppressedForJobAlerts } from "./newJobAlerts";
import { createAutomationLeaderLease, type AutomationLeaderLease } from "./automationLeaderLease";

export const AUTO_SEND_FIELD = "company_auto_send";

export type AutoSendResult =
  | { sent: true; count: number; emailed: number; sentAtIso: string }
  | { sent: false; reason: "not_listed" | "already_sent" | "no_companies" | "store_unavailable" };

/** The company asked for job emails: its saved preference, or the opt-in mirrored onto its record. */
export function companyOptedIn(record: Partial<RobotTeamAccessRecord>, userPreferences?: unknown): boolean {
  const saved = savedUpdatePreferences(record.preferencesAccountUid ? userPreferences : record.updatePreferences);
  return saved ? saved.newJobAlerts === true : record.newJobAlertsOptIn === true;
}

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
      .filter(row => /^[a-f0-9]{64}$/.test(row.id) && isApprovedDeploymentCompany(row.data))
      .sort((a, b) => a.id.localeCompare(b.id));
    if (!companies.length) return { sent: false, reason: "no_companies" };
    // Reads first: each opted-in company's saved preference and suppression, and the site's notice row.
    const emailed: Array<{ id: string; email: string }> = [];
    for (const company of companies) {
      const email = String(company.data.email ?? "").trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
      const user = company.data.preferencesAccountUid
        ? (await tx.get(store.collection("users").doc(company.data.preferencesAccountUid))).data()?.updatePreferences : undefined;
      if (!companyOptedIn(company.data, user)) continue;
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
  try { return await sendJobToApprovedCompanies(requestId); }
  catch (error) {
    logger.warn({ error, requestId }, "Automatic send did not run; the sweep will try again");
    return null;
  }
}

/** One sweep pass: every job shared under the current listing record that has not been sent yet. */
export async function sweepAutomaticSends(limit = 50): Promise<{ examined: number; sent: number }> {
  if (!db) return { examined: 0, sent: 0 };
  const snapshot = await db.collection("inboundRequests")
    .where("public_task_listing.consentVersion", "==", JOB_SHARED_LISTING_VERSION).limit(500).get();
  const due = snapshot.docs.filter(doc => !doc.data()?.[AUTO_SEND_FIELD]?.sentAtIso).slice(0, limit);
  let sent = 0;
  for (const doc of due) {
    const result = await sendJobToCompaniesIfListed(doc.id);
    if (result?.sent) sent += 1;
  }
  return { examined: due.length, sent };
}

/** The worker's sweep, on the automation leader lease, once a minute. */
export function startAutomaticSendWorker(options: { intervalMs?: number; lease?: AutomationLeaderLease } = {}) {
  // A pull request preview shares the production store and must never send anything.
  if (process.env.IS_PULL_REQUEST?.trim().toLowerCase() === "true") return () => undefined;
  const lease = options.lease ?? createAutomationLeaderLease({ leaseName: "company-automatic-send-leader" });
  lease.start();
  let stopped = false, running = false, timer: ReturnType<typeof setTimeout> | undefined;
  const run = async () => {
    if (stopped) return;
    if (!running && lease.isLeader()) {
      running = true;
      try { await sweepAutomaticSends(); }
      catch (error) { logger.error({ err: error }, "Automatic send sweep failed; it will retry"); }
      finally { running = false; }
    }
    if (!stopped) { timer = setTimeout(run, options.intervalMs ?? 60_000); timer.unref?.(); }
  };
  timer = setTimeout(run, 20_000); timer.unref?.();
  return () => { stopped = true; if (timer) clearTimeout(timer); void lease.stop(); };
}
