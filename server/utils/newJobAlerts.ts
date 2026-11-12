/**
 * The dispatch gate for the new-job email to approved deployment companies (package E, E4). The automatic send
 * (`jobAutoSend.ts`) queues it; this re-checks, in the dispatch transaction, everything that must still hold: the job
 * is listed under the whole sharing rule, the company is still an approved deployment company at that address, it
 * still wants job emails, and the address is not suppressed.
 */
import { dbAdmin as db } from '../../client/src/lib/firebaseAdmin';
import type { OutboxEntry } from './captureOutbox';
import { savedUpdatePreferences } from './updatePreferences';
import { accessRecordId, type RobotTeamAccessRecord } from './robotTeamEarlyAccess';
import { loadCompanyJobAccess } from './teamJobAccess';

/** The context a new-job email carries. Rows queued before 2026-11-12 carry another shape and are never sent. */
export const NEW_JOB_ALERT_SCHEMA = 'job-alert-2026-11-12';
export type JobAlertContext = { schema: typeof NEW_JOB_ALERT_SCHEMA; jobId: string; companyId: string };

/** One new-job email per company per job, ever. */
export const newJobAlertKey = (jobId: string, companyId: string) => `robot_team_new_task:${jobId}:${companyId}`;

/**
 * Whether the automatic new-job email sends (owner, 2026-11-12: "all 11 steps should be automated and not need a
 * human in the loop"). It does: a job is shared with every approved deployment company as soon as it is listed, and
 * the companies that asked for job emails are told. The gate below still decides each email at dispatch.
 */
export const AUTOMATIC_NEW_JOB_ALERTS_SEND = true;

/** The suppression scopes that stop an optional job email. */
export function suppressedForJobAlerts(blocked: Record<string, any> | undefined): boolean {
  return blocked?.global_suppressed === true || (blocked?.suppressed_scopes ?? []).some((scope: string) =>
    ['all', 'lifecycle', 'growth_campaign', 'optional_updates'].includes(scope));
}

/** Shared dispatch gate. Every read participates in the transaction. Other kinds pass. */
export async function jobAlertIsCurrent(entry: Pick<OutboxEntry, 'kind' | 'to' | 'jobAlert'>,
  tx: FirebaseFirestore.Transaction): Promise<boolean> {
  if (entry.kind !== 'robot_team_new_task') return true;
  if (!AUTOMATIC_NEW_JOB_ALERTS_SEND) return false;
  const alert = entry.jobAlert as Partial<JobAlertContext> | undefined;
  if (!db || !alert || alert.schema !== NEW_JOB_ALERT_SCHEMA || typeof alert.jobId !== 'string' || typeof alert.companyId !== 'string')
    return false;
  const email = entry.to.trim().toLowerCase();
  if (accessRecordId(email) !== alert.companyId) return false;
  const [contact, suppression] = await Promise.all([
    tx.get(db.collection('robotTeamAccess').doc(alert.companyId)),
    tx.get(db.collection('email_suppressions').doc(email)),
  ]);
  if (suppressedForJobAlerts(suppression.data())) return false;
  const record = contact.data() as RobotTeamAccessRecord | undefined;
  if (!record || record.status !== 'approved' || record.partnerRole === 'technology'
    || String(record.email ?? '').trim().toLowerCase() !== email) return false;
  const user = record.preferencesAccountUid
    ? (await tx.get(db.collection('users').doc(record.preferencesAccountUid))).data() : null;
  const preferences = savedUpdatePreferences(record.preferencesAccountUid ? user?.updatePreferences : record.updatePreferences);
  if (preferences ? !preferences.newJobAlerts : record.newJobAlertsOptIn !== true) return false;
  const { access } = await loadCompanyJobAccess(alert.jobId, undefined, tx);
  return access.listed;
}
