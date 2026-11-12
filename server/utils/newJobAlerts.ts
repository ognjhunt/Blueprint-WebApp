/** The dispatch gate for optional new-job alerts already in the outbox. Nothing queues them any more (2026-11-12). */
import { createHash } from 'node:crypto';
import { dbAdmin as db } from '../../client/src/lib/firebaseAdmin';
import { approvedTaskDetails } from './taskListingDetails';
import { projectTaskBrowseCard } from './taskBrowse';
import { projectWebsiteCaptureRights } from './websiteTaskContext';
import type { InboundRequest } from '../types/inbound-request';
import type { OutboxEntry } from './captureOutbox';
import { savedUpdatePreferences } from './updatePreferences';
import { accessRecordId, type RobotTeamAccessRecord } from './robotTeamEarlyAccess';
import { categoryFacts, matchJob, registryFacts, type TargetingFacts } from './contactTargeting';
import type { RobotTeamRecord } from '../types/robot-team-registry';
export type JobAlertContext = { jobId: string; eventId: string; cardDigest: string };
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

function currentCard(jobId: string, record: Record<string, any>, context: JobAlertContext) {
  const card = approvedTaskDetails(record);
  if (!card || record.public_task_listing.wentLiveIso !== context.eventId || digest(card) !== context.cardDigest
    || !projectTaskBrowseCard(jobId, record as InboundRequest) || projectWebsiteCaptureRights(record).consent_revoked
    || card.opportunity !== 'open') return null;
  return card;
}
/**
 * Whether the automatic "New site job" email to opted-in approved companies still sends (frame of 2026-11-12):
 * it does not. Every approach to an outside company needs the owner's go-ahead first, so no fan-out queues it and a
 * row already queued is never sent. The rest of this file is kept, unused, until the owner decides otherwise.
 */
export const AUTOMATIC_NEW_JOB_ALERTS_SEND = false;

/** Shared queue/dispatch gate. All source, opt-out, profile and suppression reads participate in the transaction. */
export async function jobAlertIsCurrent(entry: Pick<OutboxEntry, 'kind' | 'to' | 'jobAlert'>,
  tx: FirebaseFirestore.Transaction): Promise<boolean> {
  if (entry.kind !== 'robot_team_new_task') return true;
  if (!AUTOMATIC_NEW_JOB_ALERTS_SEND) return false;
  if (!db || !entry.jobAlert) return false; // Retained pre-opt-in alerts have no authority.
  const email = entry.to.trim().toLowerCase();
  const [source, contact, suppression] = await Promise.all([
    tx.get(db.collection('inboundRequests').doc(entry.jobAlert.jobId)),
    tx.get(db.collection('robotTeamAccess').doc(accessRecordId(email))),
    tx.get(db.collection('email_suppressions').doc(email)),
  ]);
  const blocked = suppression.data();
  if (blocked?.global_suppressed === true || (blocked?.suppressed_scopes ?? []).some((scope: string) =>
    ['all', 'lifecycle', 'growth_campaign', 'optional_updates'].includes(scope))) return false;
  const record = contact.data() as RobotTeamAccessRecord | undefined;
  if (!record || record.status !== 'approved' || record.email.trim().toLowerCase() !== email) return false;
  const user = record.preferencesAccountUid
    ? (await tx.get(db.collection('users').doc(record.preferencesAccountUid))).data() : null;
  const preferences = savedUpdatePreferences(record.preferencesAccountUid ? user?.updatePreferences : record.updatePreferences);
  if (!preferences?.newJobAlerts) return false;
  const sourceRecord = source.data();
  const card = sourceRecord && currentCard(entry.jobAlert.jobId, sourceRecord, entry.jobAlert);
  if (!card) return false;
  const declaredTargeting = card.targeting ?? { categories: {}, requiredRecipient: {} };
  // A public-card label cannot grant evidence rights. Only the existing current rights projection supplies scopes.
  const rights = projectWebsiteCaptureRights(sourceRecord);
  const targeting = { ...declaredTargeting, rightsScopes: rights.consent_status === "unknown" ? undefined : rights.consent_scope };
  const categories = { ...targeting.categories,
    roles: targeting.categories.roles ?? ["robot_team"],
    regions: targeting.categories.regions ?? (card.region ? [card.region] : []),
    industries: targeting.categories.industries ?? (card.siteType ? [card.siteType] : []),
    taskFamilies: targeting.categories.taskFamilies ?? (card.taskFamily ? [card.taskFamily] : []),
  };
  // Account role is explicit; robot embodiments/task family/regions retain their per-field provenance.
  const facts: TargetingFacts = categoryFacts({ ...preferences.declaredCategories, roles: [user?.buyerType ?? 'robot_team'] }, preferences.source, preferences.updatedAtIso);
  if (Object.entries(targeting.requiredRecipient).some(([dimension, values]) => dimension !== 'roles' && values?.length)) {
    const teams = await tx.get(db.collection('robotTeams').where('contactEmail', '==', email).limit(10));
    // Never merge capabilities from unrelated robots into an imaginary robot.
    const outcomes = teams.docs.map(team => matchJob(preferences, { ...targeting, categories },
      { ...facts, ...registryFacts(team.data() as RobotTeamRecord) }, entry.jobAlert!.jobId, sourceRecord!.public_task_listing.approvedAtIso));
    return [matchJob(preferences, { ...targeting, categories }, facts, entry.jobAlert.jobId, sourceRecord!.public_task_listing.approvedAtIso), ...outcomes].some(result => result.status === 'eligible');
  }
  return matchJob(preferences, { ...targeting, categories }, facts,
    entry.jobAlert.jobId, sourceRecord!.public_task_listing.approvedAtIso).status === 'eligible';
}
