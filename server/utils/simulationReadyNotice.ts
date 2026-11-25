/**
 * "The simulation of the site is ready" (owner, 2026-11-25). A job is shared as soon as its sound-free video, the site's
 * sentence and its brief (or the catalog's rows, `jobBrief.ts`) exist; its simulation follows later. When the simulation
 * of a job already shared becomes ready, each company that already answered the job (`robotTeamInterest`) or opened it
 * (`companyViews`) gets ONE email saying so, ever: outbox kind `company_simulation_ready`, document id
 * `company_simulation_ready:{jobId}:{companyId}`, so a second revision, a second capture or a second pass sends nothing more.
 *
 * - Owed: `recordWebsiteCompanySimulation` marks it on the job (`company_simulation_ready_notice.owed`) in the same
 *   transaction that first stores a simulation for the job's capture. A newer revision of a stored simulation owes
 *   nothing.
 * - Queued: `queueSimulationReadyNotices`, called by the Pipeline's acceptance route at once and by the automatic-send
 *   worker's sweep for a marker a lost call left owed. One transaction reads the whole sharing rule (`loadCompanyJobAccess`:
 *   the job must be listed and its simulation stored, `evaluationAvailable`), the companies that answered or opened it,
 *   and queues a row for each that may still see jobs, has not turned job emails off and is not suppressed (the new-job
 *   email's own rules, `newJobAlerts.ts`); then it closes the marker. A job not listed when its simulation arrives owes no
 *   one: no company could have opened it, and each that opens it later sees the simulation there.
 * - Sent: the outbox re-checks the same rules at dispatch (`simulationReadyNoticeIsCurrent`), so a withdrawal, a hold or a
 *   company's approval ending after the row was queued stops it.
 * - Internal test jobs (`internalTestJob.ts`, `internalTestCompany.ts`): on a test job the only recipient is Blueprint's
 *   internal test company, at the internal test inbox; the outbox lets this kind through to that inbox only
 *   (`internalTestRowMayBeDelivered`). A real company is never sent one about a test job, nor the test company about a
 *   real job.
 *
 * Nothing about the site: the job's title as its page leads with it (`companyJobHeadline`) and the job's link.
 */
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { jobTitleForDisplay } from "../../client/src/types/taskBrowse";
import { logger } from "../logger";
import { companyMaySeeJobs } from "./companyTerms";
import { isInternalTestCompanyRow } from "./internalTestCompany";
import { isInternalTestJob } from "./internalTestJob";
import { companyWantsJobEmails, suppressedForJobAlerts } from "./newJobAlerts";
import { accessRecordId, ROBOT_TEAM_ACCESS_COLLECTION } from "./robotTeamEarlyAccess";
import { loadCompanyJobAccess } from "./teamJobAccess";

import { SIMULATION_READY_NOTICE_FIELD, type SimulationReadyNoticeMarker } from "./simulationReadyNoticeMarker";
export { owedSimulationReadyNotice, SIMULATION_READY_NOTICE_FIELD, type SimulationReadyNoticeMarker } from "./simulationReadyNoticeMarker";

export const SIMULATION_READY_NOTICE_KIND = "company_simulation_ready" as const;
export const simulationReadyNoticeKey = (jobId: string, companyId: string) => `${SIMULATION_READY_NOTICE_KIND}:${jobId}:${companyId}`;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type Tx = FirebaseFirestore.Transaction;

/**
 * The company's address when it may be sent this notice about this job, else null: on an internal test job only the
 * internal test company; on any other job an approved deployment company under the current Terms (`companyMaySeeJobs`),
 * at the address its record is keyed by, that has not turned job emails off and is not suppressed. Reads inside `tx`.
 */
async function noticeRecipient(tx: Tx, job: Record<string, any>, companyId: string, company: Record<string, any> | undefined):
  Promise<{ email: string; revision: string | null } | null> {
  if (!db) return null;
  const eligible = isInternalTestJob(job) ? isInternalTestCompanyRow(companyId, company) : companyMaySeeJobs(company as never);
  if (!eligible || !company) return null;
  const email = String(company.email ?? "").trim().toLowerCase();
  if (!EMAIL.test(email) || accessRecordId(email) !== companyId) return null;
  const user = company.preferencesAccountUid
    ? (await tx.get(db.collection("users").doc(String(company.preferencesAccountUid)))).data()?.updatePreferences : undefined;
  if (!companyWantsJobEmails(company, user)) return null;
  if (suppressedForJobAlerts((await tx.get(db.collection("email_suppressions").doc(email))).data())) return null;
  return { email, revision: typeof company.decidedAtIso === "string" ? company.decidedAtIso : null };
}

/** The job's access as the notice reads it: for an internal test job, as the internal test company reads it. */
const accessOptions = (job: Record<string, any>) => isInternalTestJob(job) ? { internalTestCompany: true } : undefined;

export type SimulationReadyQueueResult = { queued: number; closed: boolean; reason?: string };

/**
 * Queue the owed notices of one job, once (see the header). Idempotent: without an owed marker it does nothing, and each
 * row's id is fixed by job and company.
 */
export async function queueSimulationReadyNotices(jobId: string, now: () => Date = () => new Date()): Promise<SimulationReadyQueueResult> {
  if (!db) return { queued: 0, closed: false, reason: "store_unavailable" };
  const store = db;
  const jobRef = store.collection("inboundRequests").doc(jobId);
  const first = (await jobRef.get()).data();
  if (first?.[SIMULATION_READY_NOTICE_FIELD]?.owed !== true) return { queued: 0, closed: false, reason: "not_owed" };
  const [{ buildOutboxEntry, CAPTURE_OUTBOX_COLLECTION }, { companyJobHeadline, knownSiteIdentity }, { loadScreenings },
    { jobEmailUrl }, { companyJobUrl, COMPANY_RESPONSES_COLLECTION }, { COMPANY_JOB_VIEWS_COLLECTION }, { simulationReadyEmail },
    { CUSTOMER_JOB_EMAIL_IDENTITY }] = await Promise.all([import("./captureOutbox"), import("./companyJobPage"),
    import("./freeTextScreening"), import("./jobAutoSend"), import("./jobCompanies"), import("./companyJobViews"),
    import("./robotTeamAccessEmails"), import("./emailLayout")]);
  // The title's object name only once the model pass over it has succeeded, as in the new-job email.
  const known = await knownSiteIdentity(first).catch(() => null);
  const screenings = await loadScreenings(jobId);
  return store.runTransaction(async (tx): Promise<SimulationReadyQueueResult> => {
    const record = (await tx.get(jobRef)).data();
    const marker = record?.[SIMULATION_READY_NOTICE_FIELD];
    if (!record || marker?.owed !== true) return { queued: 0, closed: false, reason: "not_owed" };
    const { access } = await loadCompanyJobAccess(jobId, record, tx, accessOptions(record));
    const atIso = now().toISOString();
    const close = (fields: Partial<SimulationReadyNoticeMarker>) =>
      tx.set(jobRef, { [SIMULATION_READY_NOTICE_FIELD]: { ...marker, owed: false, ...fields } }, { merge: true });
    if (!access.listed || !access.evaluationAvailable) {
      const reason = access.reason ?? "not_listed";
      close({ closedAtIso: atIso, closedReason: reason });
      return { queued: 0, closed: true, reason };
    }
    const [answers, views] = [await tx.get(jobRef.collection(COMPANY_RESPONSES_COLLECTION).limit(5000)),
      await tx.get(jobRef.collection(COMPANY_JOB_VIEWS_COLLECTION).limit(5000))];
    const companyIds = [...new Set([...answers.docs, ...views.docs].map(doc => doc.id))].filter(id => /^[a-f0-9]{64}$/.test(id)).sort();
    const planned: Array<{ ref: FirebaseFirestore.DocumentReference; companyId: string; email: string; revision: string | null }> = [];
    for (const companyId of companyIds) {
      const company = (await tx.get(store.collection(ROBOT_TEAM_ACCESS_COLLECTION).doc(companyId))).data();
      const recipient = await noticeRecipient(tx, record, companyId, company);
      if (!recipient) continue;
      const ref = store.collection(CAPTURE_OUTBOX_COLLECTION).doc(simulationReadyNoticeKey(jobId, companyId));
      if ((await tx.get(ref)).exists) continue;
      planned.push({ ref, companyId, ...recipient });
    }
    const title = companyJobHeadline(record, access.details.taskFamily, jobTitleForDisplay(access.details.title), known, screenings);
    for (const row of planned) {
      const message = simulationReadyEmail({ to: row.email, title,
        jobUrl: jobEmailUrl(companyJobUrl(jobId), jobId, { id: row.companyId, email: row.email, revision: row.revision }) });
      tx.create(row.ref, buildOutboxEntry({ idempotencyKey: row.ref.id, requestId: jobId, kind: SIMULATION_READY_NOTICE_KIND,
        to: row.email, subject: message.subject, body: message.body, replyTo: CUSTOMER_JOB_EMAIL_IDENTITY.replyTo }));
    }
    close({ queuedAtIso: atIso, queued: planned.length });
    return { queued: planned.length, closed: true };
  });
}

const isPullRequestPreview = () => process.env.IS_PULL_REQUEST?.trim().toLowerCase() === "true";

/** Best effort, for the acceptance route the moment a simulation is stored: never throws; the sweep catches a lost call. */
export async function queueSimulationReadyNoticesSoon(jobId: string): Promise<SimulationReadyQueueResult | null> {
  // A pull request preview shares the production store and must never send anything.
  if (isPullRequestPreview()) return null;
  try { return await queueSimulationReadyNotices(jobId); }
  catch (error) {
    logger.warn({ error, requestId: jobId }, "The simulation-ready notices were not queued; the sweep will try again");
    return null;
  }
}

/** One sweep pass over jobs whose notice is still owed (a single-field equality query, no extra index). */
export async function sweepSimulationReadyNotices(limit = 50): Promise<{ examined: number; queued: number }> {
  const summary = { examined: 0, queued: 0 };
  if (!db || isPullRequestPreview()) return summary;
  const owed = await db.collection("inboundRequests").where(`${SIMULATION_READY_NOTICE_FIELD}.owed`, "==", true).limit(limit).get();
  for (const doc of owed.docs) {
    summary.examined += 1;
    const result = await queueSimulationReadyNoticesSoon(doc.id);
    summary.queued += result?.queued ?? 0;
  }
  return summary;
}

/** The company a row's id names, for the job it was queued for, or null. */
export function parseSimulationReadyNoticeKey(jobId: string, key: string | undefined): string | null {
  const prefix = `${SIMULATION_READY_NOTICE_KIND}:${jobId}:`;
  const companyId = key?.startsWith(prefix) ? key.slice(prefix.length) : "";
  return /^[a-f0-9]{64}$/.test(companyId) ? companyId : null;
}

/**
 * The outbox's check before it sends one (every other kind passes): the row's id names this job and the company its
 * address is keyed by; that company may still be sent it (`noticeRecipient`); and the job is still listed for it with
 * its simulation stored. Reads only.
 */
export async function simulationReadyNoticeIsCurrent(entry: { kind: string; requestId: string; to: string; idempotencyKey?: string },
  tx: Tx): Promise<boolean> {
  if (entry.kind !== SIMULATION_READY_NOTICE_KIND) return true;
  const companyId = parseSimulationReadyNoticeKey(entry.requestId, entry.idempotencyKey);
  if (!companyId || !db) return false;
  const job = (await tx.get(db.collection("inboundRequests").doc(entry.requestId))).data();
  if (!job) return false;
  const company = (await tx.get(db.collection(ROBOT_TEAM_ACCESS_COLLECTION).doc(companyId))).data();
  const recipient = await noticeRecipient(tx, job, companyId, company);
  if (!recipient || recipient.email !== String(entry.to ?? "").trim().toLowerCase()) return false;
  const { access } = await loadCompanyJobAccess(entry.requestId, job, tx, accessOptions(job));
  return access.listed && access.evaluationAvailable;
}
