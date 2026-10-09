/** Optional alerts use existing contacts, source records and captureOutbox. No sends here. */
import { createHash, randomUUID } from 'node:crypto';
import { dbAdmin as db } from '../../client/src/lib/firebaseAdmin';
import { approvedTaskDetails } from './taskListingDetails';
import { projectTaskBrowseCard } from './taskBrowse';
import { projectWebsiteCaptureRights } from './websiteTaskContext';
import type { InboundRequest } from '../types/inbound-request';
import { automationBatch } from './automationBatch';
import { buildOutboxEntry, CAPTURE_OUTBOX_COLLECTION, type OutboxEntry } from './captureOutbox';
import { savedUpdatePreferences } from './updatePreferences';
import { accessRecordId, type RobotTeamAccessRecord } from './robotTeamEarlyAccess';
import { categoryFacts, matchJob, registryFacts, type TargetingFacts } from './contactTargeting';
import { newTaskEmail } from './robotTeamAccessEmails';
import { appendCommercialEmailFooter } from './email-suppression';
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
/** Shared queue/dispatch gate. All source, opt-out, profile and suppression reads participate in the transaction. */
export async function jobAlertIsCurrent(entry: Pick<OutboxEntry, 'kind' | 'to' | 'jobAlert'>,
  tx: FirebaseFirestore.Transaction): Promise<boolean> {
  if (entry.kind !== 'robot_team_new_task') return true;
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

export function newJobFanoutIntent(eventId: string) {
  return { status: 'pending', eventId, cursor: null, leaseUntilMs: 0, token: null };
}
/** One bounded contact page per source per worker tick. Cursor advances only after all durable recipient intents. */
export async function resumeNewJobFanout(limit = 20, pageSize = 50) {
  if (!db) return;
  const sources = await automationBatch(db, db.collection('inboundRequests').where('newJobAlertFanout.status', '==', 'pending'),
    'new_job_alert_fanout', Math.min(limit, 5));
  for (const source of sources.docs) {
    const token = randomUUID();
    const claimed = await db.runTransaction(async tx => {
      const record = (await tx.get(source.ref)).data();
      const intent = record?.newJobAlertFanout;
      const details = approvedTaskDetails(record);
      if (!intent || intent.status !== 'pending' || intent.leaseUntilMs > Date.now()) return null;
      const context: JobAlertContext = { jobId: source.id, eventId: intent.eventId, cardDigest: digest(details) };
      if (!record || !currentCard(source.id, record, context)) {
        tx.update(source.ref, { newJobAlertFanout: { ...intent, status: 'cancelled' } }); return null;
      }
      tx.update(source.ref, { newJobAlertFanout: { ...intent, token, leaseUntilMs: Date.now() + 300_000 } });
      return { cursor: intent.cursor as string | null, context, card: details! };
    });
    if (!claimed) continue;
    const size = Math.max(1, Math.min(pageSize, 100));
    let query = db.collection('robotTeamAccess').where('status', '==', 'approved').where('newJobAlertsOptIn', '==', true).orderBy('__name__').limit(size);
    if (claimed.cursor) query = query.startAfter(claimed.cursor);
    const page = await query.get();
    for (const contact of page.docs) {
      const record = contact.data() as RobotTeamAccessRecord;
      if (!record.email) continue;
      const message = newTaskEmail(record, claimed.card);
      const entry = buildOutboxEntry({
        idempotencyKey: `robot_team_new_task:${digest([source.id, claimed.context.eventId, record.email.trim().toLowerCase()])}`,
        requestId: source.id, kind: 'robot_team_new_task', to: record.email.trim().toLowerCase(),
        subject: message.subject, body: appendCommercialEmailFooter({ text: message.body, email: record.email, scope: 'optional_updates' }),
        replyTo: 'hello@tryblueprint.io', jobAlert: claimed.context,
      });
      await db.runTransaction(async tx => {
        const ref = db!.collection(CAPTURE_OUTBOX_COLLECTION).doc(entry.idempotencyKey);
        const existing = await tx.get(ref);
        if (existing.exists || !await jobAlertIsCurrent(entry, tx)) return;
        tx.create(ref, entry);
      });
    }
    await db.runTransaction(async tx => {
      const intent = (await tx.get(source.ref)).data()?.newJobAlertFanout;
      if (intent?.token !== token || intent.eventId !== claimed.context.eventId) return;
      tx.update(source.ref, { newJobAlertFanout: { ...intent,
        cursor: page.docs.length ? page.docs[page.docs.length - 1].id : claimed.cursor,
        status: page.docs.length < size ? 'complete' : 'pending', leaseUntilMs: 0,
      } });
    });
  }
}
