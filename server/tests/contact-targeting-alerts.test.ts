// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sharedFakeFirestoreState as state, sharedFakeFirestore as db } from './helpers/fake-firestore';
import { listedTaskCard } from './helpers/listedTaskCard';
vi.mock('../../client/src/lib/firebaseAdmin', async () => {
  const { sharedFakeFirestore } = await import('./helpers/fake-firestore');
  return { dbAdmin: sharedFakeFirestore, default: { firestore: { FieldValue: { serverTimestamp: () => 'NOW' } } } };
});
vi.mock('../logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
const send = vi.hoisted(() => vi.fn(async (): Promise<any> => ({ sent: true, provider: 'resend', messageId: 'test' })));
const fence = vi.hoisted(() => vi.fn(async () => true));
vi.mock('../utils/email', () => ({ sendEmail: send }));
vi.mock('../utils/taskStatusUpdates', () => ({ enqueueDueTaskStatusUpdates: vi.fn(), taskStatusUpdateIsCurrent: vi.fn(async () => true), acknowledgeTaskStatusUpdate: vi.fn() }));
vi.mock('../utils/taskLifecycleNotifications', () => ({ reconcileSceneReadyNotifications: vi.fn(), reconcileWebsitePreparationNotifications: vi.fn() }));
vi.mock('../utils/agentRunResultNotifications', () => ({ reconcileAgentRunResultNotifications: vi.fn() }));
vi.mock('../utils/taskEvaluationNotificationRetry', () => ({ reconcileTaskEvaluationNotificationRetries: vi.fn() }));
vi.mock('../utils/taskLifecycleNotificationAuthority', () => ({ taskLifecycleNotificationIsCurrent: fence }));
import { buildUpdatePreferences } from '../utils/updatePreferences';
import { accessRecordId, recordAccessApplication, inviteRobotTeam } from '../utils/robotTeamEarlyAccess';
import { categoryFacts, matchJob, matchClauses } from '../utils/contactTargeting';
import { newJobFanoutIntent, resumeNewJobFanout, jobAlertIsCurrent } from '../utils/newJobAlerts';
import { deliverOutbox } from '../utils/captureOutbox';
const event = '2026-10-08T00:00:00.000Z';
const preference = (extra = {}) => buildUpdatePreferences({ newsletter: false, newJobAlerts: true, interests: {}, declaredCategories: {}, requirements: {}, ...extra }, 'settings');
function job() {
  state.docs.set('inboundRequests/job', { requestId: 'job', request: { buyerType: 'site_operator' },
    public_task_listing: { ...listedTaskCard(), wentLiveIso: event }, newJobAlertFanout: newJobFanoutIntent(event) });
}
function contact(email: string, preferences: any = preference()) {
  state.docs.set(`robotTeamAccess/${accessRecordId(email)}`, { name: 'Ada', email, status: 'approved',
    decidedAtIso: event, decidedBy: 'fixture-ops', appliedAtIso: event,
    newJobAlertsOptIn: preferences?.newJobAlerts === true, updatedAtIso: event, updatePreferences: preferences });
}
const alerts = () => [...state.docs].filter(([key]) => key.startsWith('captureOutbox/'));
beforeEach(() => { state.docs.clear(); send.mockClear(); fence.mockReset().mockResolvedValue(true); job(); });
describe('exact targeting with provenance', () => {
  it('composes all/any clauses; excluded, unknown and inferred never qualify', () => {
    const facts = categoryFacts({ regions: ['US'], policyCategories: ['WAM', 'VLA'], embodiments: ['arm'] }, 'intake', event);
    expect(matchClauses(facts, [{ dimension: 'policyCategories', values: ['wam','vla'], operator: 'all' }]).status).toBe('eligible');
    expect(matchClauses(facts, [{ dimension: 'regions', values: ['EU'], operator: 'any' }]).status).toBe('excluded');
    expect(matchClauses(facts, [{ dimension: 'industries', values: ['warehouse'], operator: 'any' }]).status).toBe('unknown');
    facts.regions!.provenance!.grade = 'inferred';
    expect(matchClauses(facts, [{ dimension: 'regions', values: ['US'], operator: 'any' }]).status).toBe('unknown');
  });
  it('hard retention/training/rights requirements cannot be satisfied by matching interests', () => {
    const prefs = preference({ interests: { policyCategories: ['WAM'] }, requirements: { maxRetentionDays: 30, noTraining: true, requiredRightsScopes: ['robot_evaluation'] } });
    const card = { categories: { policyCategories: ['WAM'] }, requiredRecipient: {} };
    expect(matchJob(prefs, card, {}, 'owner-card', event).status).toBe('unknown');
    expect(matchJob(prefs, { ...card, retentionDays: 31, trainingUseAllowed: false, rightsScopes: ['robot_evaluation'] }, {}, 'owner-card', event).status).toBe('excluded');
    expect(matchJob(prefs, { ...card, retentionDays: 30, trainingUseAllowed: false, rightsScopes: ['robot_evaluation'] }, {}, 'owner-card', event).status).toBe('eligible');
  });
});
describe('existing contact/outbox safety', () => {
  // The frame of 2026-11-12: every approach to an outside company needs the owner's go-ahead first, so the automatic
  // "New site job" email no longer sends. These replace the tests of who it was queued for (opted-in, relevant,
  // unsuppressed, paged, rechecked at dispatch): now it is queued for no one, and a row queued before the stop is
  // cancelled at dispatch without a send.
  it('queues the automatic new-job email for no one, however relevant, opted in and approved the contact is', async () => {
    contact('yes@example.com', preference({ interests: { regions: ['US'], industries: ['warehouse'] } }));
    for (let i = 0; i < 120; i++) contact(`team${i}@example.com`);
    for (let i = 0; i < 5; i++) await resumeNewJobFanout(5, 50);
    expect(alerts()).toHaveLength(0);
    expect((state.docs.get('inboundRequests/job')!.newJobAlertFanout as any).status).toBe('complete');
    await deliverOutbox(); expect(send).not.toHaveBeenCalled();
  });
  it('cancels a new-job email queued before the stop, at dispatch, without sending it', async () => {
    const email = 'ada@example.com'; contact(email);
    state.docs.set('captureOutbox/legacy-alert', { idempotencyKey: 'legacy-alert', requestId: 'job', kind: 'robot_team_new_task', to: email,
      subject: 'New site job on Blueprint: Example', body: 'Example', status: 'pending', attempts: 0, nextAttemptAtMs: 0,
      jobAlert: { jobId: 'job', eventId: event, cardDigest: 'x' } });
    await deliverOutbox(); expect(send).not.toHaveBeenCalled();
    expect((state.docs.get('captureOutbox/legacy-alert') as any).status).not.toBe('sent');
  });
  it('retained legacy optional alerts have no dispatch authority; essential notices remain separate', async () => {
    expect(await db.runTransaction(tx => jobAlertIsCurrent({kind:'robot_team_new_task',to:'ada@example.com'},tx))).toBe(false);
    expect(await db.runTransaction(tx => jobAlertIsCurrent({kind:'robot_team_access_received',to:'ada@example.com'},tx))).toBe(true);
  });
  it('does not subscribe existing contacts on reapplication or invitation', async () => {
    const email = 'ada@example.com'; contact(email, preference({ newJobAlerts: false, newsletter: false }));
    const application = { name: 'Ada', email, company:'Company', website:null,robot:'arm',workWanted:'pick',region:null,optionalUpdates:true };
    await recordAccessApplication(application);
    await inviteRobotTeam({ name:'Ada',email,company:'Company',note:null,invitedBy:'ops' });
    expect((state.docs.get(`robotTeamAccess/${accessRecordId(email)}`)!.updatePreferences as any).newJobAlerts).toBe(false);
  });
});
