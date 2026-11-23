// Production funnel and timing aggregates for the audit. Read-only (see fs_readonly.mjs).
//
// It selects only states, booleans, version strings and timestamps. It prints
// only counts and durations. A value distribution is printed only when the
// field looks like an enumeration (few distinct values, identifier characters);
// otherwise only how many distinct values there are.
import { selectFields, plain } from './fs_readonly.mjs';

const ENUM = /^[A-Za-z0-9_.:\-]{1,60}$/;
const get = (row, path) => path.split('.').reduce((value, key) => (value == null ? undefined : value[key]), row);
const rows = async (collection, fields, options) =>
  (await selectFields(collection, fields, options)).map((doc) => {
    const out = {};
    for (const [key, value] of Object.entries(doc)) out[key] = plain(value);
    return out;
  });

function distribution(list, path) {
  const counts = new Map();
  for (const row of list) {
    const value = get(row, path);
    const key = value === undefined ? '(absent)' : value === null ? '(null)' : String(value);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const keys = [...counts.keys()];
  if (keys.length > 30 || keys.some((key) => !key.startsWith('(') && !ENUM.test(key))) {
    return { distinct: keys.length, shown: false };
  }
  return Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1]));
}

const toMs = (value) => {
  if (value == null) return null;
  if (typeof value === 'number') return value > 1e12 ? value : value * 1000;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
};
const month = (ms) => (ms == null ? '(no time)' : new Date(ms).toISOString().slice(0, 7));
const day = (ms) => (ms == null ? null : new Date(ms).toISOString().slice(0, 10));
function byMonth(list, paths) {
  const counts = {};
  for (const row of list) {
    let ms = null;
    for (const path of paths) { ms = toMs(get(row, path)); if (ms != null) break; }
    const key = month(ms);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort());
}
function stats(values) {
  const sorted = values.filter((value) => value != null && value >= 0).sort((a, b) => a - b);
  if (!sorted.length) return { n: 0 };
  const at = (q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  const hours = (ms) => Math.round((ms / 3_600_000) * 100) / 100;
  return { n: sorted.length, median_h: hours(at(0.5)), p90_h: hours(at(0.9)), min_h: hours(sorted[0]), max_h: hours(sorted.at(-1)) };
}
const latest = (list, paths) => {
  let best = null;
  for (const row of list) for (const path of paths) { const ms = toMs(get(row, path)); if (ms != null && (best == null || ms > best)) best = ms; }
  return day(best);
};

const out = {};

// ---- jobs
const jobs = await rows('inboundRequests', [
  'createdAt', 'request.buyerType', 'request.capture_region', 'request.descriptionOnly',
  'internal_test.created_at_iso', 'public_task_listing.enabled', 'public_task_listing.approvedAtIso',
  'public_task_listing.consentVersion', 'capture_withdrawal.requestedAtIso',
  'website_job_window_ending.window_ended_at_epoch', 'website_job_no_grant_ending.waiting_on',
  'request.consent_attestation.granted', 'request.consent_attestation.statement_version',
  'request.claude_authoring_consent.granted', 'request.sol_agents_api_consent.granted',
  'site_task_brief_confirmed_at',
]);
const isInternal = (row) => get(row, 'internal_test') != null;
const siteJobs = jobs.filter((row) => get(row, 'request.buyerType') === 'site_operator');
const realSiteJobs = siteJobs.filter((row) => !isInternal(row));
out.inboundRequests = {
  total: jobs.length,
  by_buyerType: distribution(jobs, 'request.buyerType'),
  by_month_created: byMonth(jobs, ['createdAt']),
  site_operator_total: siteJobs.length,
  site_operator_internal_test: siteJobs.filter(isInternal).length,
  site_operator_not_internal: realSiteJobs.length,
};
const describe = (list) => ({
  n: list.length,
  by_month_created: byMonth(list, ['createdAt']),
  capture_region: distribution(list, 'request.capture_region'),
  descriptionOnly: distribution(list, 'request.descriptionOnly'),
  recording_statement_version: distribution(list, 'request.consent_attestation.statement_version'),
  recording_statement_granted: distribution(list, 'request.consent_attestation.granted'),
  listing_enabled: distribution(list, 'public_task_listing.enabled'),
  listing_consentVersion: distribution(list, 'public_task_listing.consentVersion'),
  listed_with_approvedAt: list.filter((row) => get(row, 'public_task_listing.approvedAtIso')).length,
  withdrawn: list.filter((row) => get(row, 'capture_withdrawal') != null).length,
  window_ended: list.filter((row) => get(row, 'website_job_window_ending') != null).length,
  no_grant_ending_waiting_on: distribution(list, 'website_job_no_grant_ending.waiting_on'),
  claude_authoring_consent_granted: distribution(list, 'request.claude_authoring_consent.granted'),
  sol_agents_api_consent_granted: distribution(list, 'request.sol_agents_api_consent.granted'),
  created_to_listed_hours: stats(list.map((row) => {
    const start = toMs(get(row, 'createdAt')); const end = toMs(get(row, 'public_task_listing.approvedAtIso'));
    return start != null && end != null ? end - start : null;
  })),
});
out.site_jobs_not_internal = describe(realSiteJobs);
out.site_jobs_internal_test = { n: siteJobs.filter(isInternal).length, by_month_created: byMonth(siteJobs.filter(isInternal), ['createdAt']) };
out.non_us_site_jobs_not_internal = describe(realSiteJobs.filter((row) => get(row, 'request.capture_region') === 'non_us'));

// ---- uploads and the company simulation record
const sessions = await rows('captureUploadSessions', [
  'status', 'createdAt', 'created_at_iso', 'completed_at_iso', 'uploadedAtIso', 'updated_at_iso',
  'company_simulation.state', 'company_simulation.updated_at_epoch', 'company_simulation.permission_basis',
  'company_simulation.size_bytes',
]);
out.captureUploadSessions = {
  n: sessions.length,
  status: distribution(sessions, 'status'),
  by_month_created: byMonth(sessions, ['createdAt', 'created_at_iso']),
  with_company_simulation: sessions.filter((row) => get(row, 'company_simulation') != null).length,
  company_simulation_permission_basis: distribution(sessions.filter((row) => get(row, 'company_simulation') != null), 'company_simulation.permission_basis'),
  company_simulation_latest: latest(sessions, ['company_simulation.updated_at_epoch']),
  created_to_company_simulation_hours: stats(sessions.map((row) => {
    const start = toMs(get(row, 'createdAt')) ?? toMs(get(row, 'created_at_iso'));
    const end = toMs(get(row, 'company_simulation.updated_at_epoch'));
    return start != null && end != null ? end - start : null;
  })),
  created_to_upload_complete_hours: stats(sessions.map((row) => {
    const start = toMs(get(row, 'createdAt')) ?? toMs(get(row, 'created_at_iso'));
    const end = toMs(get(row, 'completed_at_iso')) ?? toMs(get(row, 'uploadedAtIso'));
    return start != null && end != null ? end - start : null;
  })),
};

// ---- emails
const outbox = await rows('captureOutbox', ['kind', 'status', 'createdAtIso', 'sentAtIso']);
const kinds = {};
for (const row of outbox) {
  const key = `${row.kind ?? '(absent)'} / ${row.status ?? '(absent)'}`;
  kinds[key] = (kinds[key] ?? 0) + 1;
}
out.captureOutbox = {
  n: outbox.length,
  kind_and_status: Object.fromEntries(Object.entries(kinds).sort()),
  by_month_created: byMonth(outbox, ['createdAtIso']),
  queued_to_sent_hours: stats(outbox.map((row) => {
    const start = toMs(row.createdAtIso); const end = toMs(row.sentAtIso);
    return start != null && end != null ? end - start : null;
  })),
  latest_sent: latest(outbox, ['sentAtIso']),
};

// ---- companies
const companies = await rows('robotTeamAccess', ['status', 'createdAt', 'createdAtIso', 'approvedAtIso', 'decidedAtIso', 'updatedAtIso', 'jobAlerts', 'jobEmails', 'termsAcceptance.version']);
out.robotTeamAccess = {
  n: companies.length, status: distribution(companies, 'status'),
  terms_version: distribution(companies, 'termsAcceptance.version'),
  latest: latest(companies, ['createdAt', 'createdAtIso', 'approvedAtIso', 'decidedAtIso', 'updatedAtIso']),
};

// ---- accounts
const users = await rows('users', ['role', 'workspaceType', 'accountType', 'buyerType', 'onboardingStep', 'createdAt', 'createdDate'], { limit: 2000 });
out.users = {
  n: users.length, role: distribution(users, 'role'), workspaceType: distribution(users, 'workspaceType'),
  accountType: distribution(users, 'accountType'), buyerType: distribution(users, 'buyerType'),
  onboardingStep: distribution(users, 'onboardingStep'), by_month_created: byMonth(users, ['createdAt', 'createdDate']),
};

// ---- retired systems: are they still being written?
async function activity(collection, timeFields, enumFields = [], options = {}) {
  const list = await rows(collection, [...timeFields, ...enumFields], { limit: 6000, ...options });
  const result = { n: list.length, latest: latest(list, timeFields), by_month: byMonth(list, timeFields) };
  for (const field of enumFields) result[field] = distribution(list, field);
  return result;
}
out.taskEvaluationLaunches = await activity('taskEvaluationLaunches', ['createdAt', 'created_at_iso', 'createdAtIso'], ['status', 'state']);
out.taskEvaluationPolicyRuns = await activity('taskEvaluationPolicyRuns', ['createdAt', 'created_at_iso', 'createdAtIso'], ['status', 'state']);
out.taskEvaluationSceneIntakes = await activity('taskEvaluationSceneIntakes', ['createdAt', 'created_at_iso', 'createdAtIso'], ['status', 'state']);
out.captureTaskEvaluationRuns = await activity('captureTaskEvaluationRuns', ['createdAt', 'created_at_iso', 'createdAtIso'], ['status', 'state']);
out.agentRuns = await activity('agentRuns', ['createdAt', 'created_at', 'createdAtIso', 'startedAt'], ['task', 'kind', 'status', 'provider', 'model']);
out.opsActionLogs = await activity('opsActionLogs', ['createdAt', 'created_at', 'timestamp'], ['action', 'type', 'status']);
out.growth_events = await activity('growth_events', ['createdAt', 'created_at', 'timestamp'], ['event', 'type']);
out.growth_campaign_events = await activity('growth_campaign_events', ['createdAt', 'created_at', 'timestamp'], ['event', 'type']);
out.growthCampaigns = await activity('growthCampaigns', ['createdAt', 'created_at', 'updatedAt'], ['status']);
out.marketplaceEntitlements = await activity('marketplaceEntitlements', ['createdAt', 'created_at', 'grantedAt'], ['status']);
out.betaCohortAdmissions = await activity('betaCohortAdmissions', ['createdAt', 'created_at', 'admittedAtIso'], ['status']);
out.siteAssessmentJobs = await activity('siteAssessmentJobs', ['createdAt', 'created_at', 'createdAtIso'], ['status', 'state']);
out.siteTaskFollowups = await activity('siteTaskFollowups', ['createdAt', 'createdAtIso', 'updatedAtIso'], ['status', 'kind']);
out.evaluationRuns = await activity('evaluationRuns', ['createdAt', 'created_at', 'createdAtIso'], ['status']);
out.progressEvents_all_jobs = await activity('progressEvents', ['createdAt', 'created_at', 'at', 'atIso'], ['stage', 'type', 'kind', 'status'], { allDescendants: true });
out.calls_all_parents = await activity('calls', ['createdAt', 'created_at', 'atIso'], ['kind', 'provider', 'status'], { allDescendants: true });

console.log(JSON.stringify(out, null, 1));
