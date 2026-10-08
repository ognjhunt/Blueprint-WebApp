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
vi.mock('../utils/pilotRecommendationNotifications', () => ({ pilotRecommendationNotificationIsCurrent: vi.fn(async () => true) }));
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
  state.docs.set(`robotTeamAccess/${accessRecordId(email)}`, { name: 'Ada', email, status: 'approved', newJobAlertsOptIn: preferences?.newJobAlerts === true, updatedAtIso: event, updatePreferences: preferences });
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
  it('queues only opted-in relevant unsuppressed approved contacts and deduplicates retries', async () => {
    contact('yes@example.com', preference({ interests: { regions: ['US'], industries: ['warehouse'] } }));
    contact('no@example.com', preference({ newJobAlerts: false }));
    contact('unknown@example.com', preference({ interests: { embodiments: ['arm'] } }));
    contact('excluded@example.com', preference({ interests: { regions: ['EU'] } }));
    contact('old@example.com', undefined); state.docs.get(`robotTeamAccess/${accessRecordId('old@example.com')}`)!.updatePreferences = null;
    contact('blocked@example.com'); state.docs.set('email_suppressions/blocked@example.com', { suppressed_scopes: ['optional_updates'] });
    await resumeNewJobFanout();
    expect(alerts()).toHaveLength(1); expect(alerts()[0][1].to).toBe('yes@example.com');
    state.docs.get('inboundRequests/job')!.newJobAlertFanout = newJobFanoutIntent(event);
    await resumeNewJobFanout(); await resumeNewJobFanout();
    expect(alerts()).toHaveLength(1); expect(send).not.toHaveBeenCalled();
  });
  it('treats partial registry rows as unknown and continues to a sourced sibling', async () => {
    contact('partial@example.com'); contact('sibling@example.com');
    (state.docs.get('inboundRequests/job')!.public_task_listing as any).details.targeting = {
      categories: {}, requiredRecipient: { embodiments: ['arm'] },
    };
    state.docs.set('robotTeams/partial', { contactEmail: 'partial@example.com', capability: { embodiment: 'arm' } });
    state.docs.set('robotTeams/empty', { contactEmail: 'sibling@example.com' });
    state.docs.set('robotTeams/sourced', { contactEmail: 'sibling@example.com', capability: { embodiment: 'arm' },
      fieldProvenance: { embodiment: { grade: 'self_reported', source: 'intake:sourced', observedAt: event } } });
    await resumeNewJobFanout();
    expect(alerts()).toHaveLength(1); expect(alerts()[0][1].to).toBe('sibling@example.com');
    await deliverOutbox(); expect(send).toHaveBeenCalledTimes(1);
  });
  it('pages beyond 500 and resumes after a partial page failure without duplicate intents', async () => {
    for (let i = 0; i < 605; i++) contact(`team${i}@example.com`);
    const transaction = vi.spyOn(db, 'runTransaction');
    const original = db.runTransaction.bind(db);
    let calls = 0;
    transaction.mockImplementation(async fn => { if (++calls === 23) throw new Error('temporary write failure'); return original(fn); });
    await expect(resumeNewJobFanout(5,100)).rejects.toThrow('temporary write failure');
    transaction.mockRestore();
    (state.docs.get('inboundRequests/job')!.newJobAlertFanout as any).leaseUntilMs = 0;
    for (let i = 0; i < 16; i++) await resumeNewJobFanout(5,100);
    expect(alerts()).toHaveLength(605);
    expect(new Set(alerts().map(([, row]) => row.to)).size).toBe(605);
    expect((state.docs.get('inboundRequests/job')!.newJobAlertFanout as any).status).toBe('complete');
  });
  it.each(['opt-out', 'suppression', 'withdrawal', 'card-change', 'account-opt-out'])('rechecks %s at dispatch after queue', async reason => {
    const email = 'ada@example.com'; contact(email); await resumeNewJobFanout();
    fence.mockImplementationOnce(async () => {
      if (reason === 'opt-out') (state.docs.get(`robotTeamAccess/${accessRecordId(email)}`)!.updatePreferences as any).newJobAlerts = false;
      if (reason === 'suppression') state.docs.set(`email_suppressions/${email}`, { global_suppressed: true });
      if (reason === 'withdrawal') state.docs.get('inboundRequests/job')!.capture_rights = { consent_revoked: true };
      if (reason === 'card-change') (state.docs.get('inboundRequests/job')!.public_task_listing as any).details.title = 'Changed approved card';
      if (reason === 'account-opt-out') {
        state.docs.get(`robotTeamAccess/${accessRecordId(email)}`)!.preferencesAccountUid = 'uid';
        state.docs.set('users/uid', { buyerType: 'robot_team', updatePreferences: preference({ newJobAlerts: false }) });
      }
      return true;
    });
    await deliverOutbox(); expect(send).not.toHaveBeenCalled(); expect(alerts()[0][1].status).toBe('cancelled');
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
