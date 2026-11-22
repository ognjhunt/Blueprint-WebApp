// Second pass of production aggregates the audit agents asked for. Read-only
// (see fs_readonly.mjs): counts, states, versions and timestamps only.
import { count, selectFields, plain } from './fs_readonly.mjs';

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
  if (keys.length > 30 || keys.some((key) => !key.startsWith('(') && !ENUM.test(key))) return { distinct: keys.length, shown: false };
  return Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1]));
}
const present = (list, path) => list.filter((row) => get(row, path) != null).length;
const toMs = (value) => {
  if (value == null) return null;
  if (typeof value === 'number') return value > 1e12 ? value : value * 1000;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
};
const day = (ms) => (ms == null ? null : new Date(ms).toISOString().slice(0, 10));
function stats(values, unit = 3_600_000) {
  const sorted = values.filter((value) => value != null && value >= 0).sort((a, b) => a - b);
  if (!sorted.length) return { n: 0 };
  const at = (q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  const r = (ms) => Math.round((ms / unit) * 100) / 100;
  return { n: sorted.length, median: r(at(0.5)), p90: r(at(0.9)), min: r(sorted[0]), max: r(sorted.at(-1)) };
}
const safe = async (label, work) => { try { return await work(); } catch (error) { return `error: ${String(error.message).slice(0, 200)}`; } };

const out = {};
out.billableEvents = await safe('billableEvents', async () => ({ top_level: await count('billableEvents'), any_parent: await count('billableEvents', [], { allDescendants: true }) }));
out.companyViews_all_jobs = await safe('companyViews', () => count('companyViews', [], { allDescendants: true }));
out.companyResponses_all_jobs = await safe('companyResponses', () => count('companyResponses', [], { allDescendants: true }));
out.jobOutcomes_all_jobs = await safe('outcomes', async () => ({ outcomes: await count('outcomes', [], { allDescendants: true }), jobOutcomes: await count('jobOutcomes', [], { allDescendants: true }) }));

out.robotTeamAccess = await safe('robotTeamAccess', async () => {
  const list = await rows('robotTeamAccess', ['status', 'partnerRole', 'termsAcceptedByUid', 'termsAcceptance.termsVersion', 'termsAcceptance.privacyVersion', 'jobAlertsOff', 'emailPreferences.jobAlerts']);
  return { n: list.length, status: distribution(list, 'status'), partnerRole: distribution(list, 'partnerRole'),
    with_signed_in_terms_acceptance: present(list, 'termsAcceptedByUid'), terms_version: distribution(list, 'termsAcceptance.termsVersion') };
});

out.inboundRequests = await safe('inboundRequests', async () => {
  const list = await rows('inboundRequests', ['createdAt', 'request.buyerType', 'internal_test.created_at_iso',
    'company_auto_send.sentAtIso', 'request.privacy_version', 'request.privacyVersion', 'request.consent_attestation.statement_version',
    'request.consent_attestation.recorded_at_iso', 'public_task_listing.approvedAtIso', 'site_task_triage.disposition',
    'evaluation_readiness.rights_review_status', 'pipeline.rights_review_status', 'job_evidence_forward_pending',
    'workspace_task.archived']);
  const site = list.filter((row) => get(row, 'request.buyerType') === 'site_operator' && get(row, 'internal_test') == null);
  const since = (iso) => site.filter((row) => (toMs(get(row, 'createdAt')) ?? 0) >= Date.parse(iso)).length;
  return {
    site_jobs_not_internal: site.length,
    created_since_2026_11_12: since('2026-11-12T00:00:00Z'),
    created_since_2026_11_17: since('2026-11-17T00:00:00Z'),
    created_since_2026_11_21T01_45Z: since('2026-11-21T01:45:00Z'),
    by_iso_week_last_12: (() => {
      const counts = {};
      for (const row of site) {
        const ms = toMs(get(row, 'createdAt')); if (ms == null) continue;
        const d = new Date(ms); const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - ((d.getUTCDay() + 6) % 7)));
        const key = monday.toISOString().slice(0, 10); counts[key] = (counts[key] ?? 0) + 1;
      }
      return Object.fromEntries(Object.entries(counts).sort().slice(-12));
    })(),
    company_auto_send_sent: present(site, 'company_auto_send.sentAtIso'),
    privacy_version: distribution(site, 'request.privacy_version'),
    privacyVersion: distribution(site, 'request.privacyVersion'),
    triage_disposition: distribution(site, 'site_task_triage.disposition'),
    rights_review_status: distribution(site, 'evaluation_readiness.rights_review_status'),
    pipeline_rights_review_status: distribution(site, 'pipeline.rights_review_status'),
    job_evidence_forward_pending: distribution(site, 'job_evidence_forward_pending'),
    archived: distribution(site, 'workspace_task.archived'),
    v4_jobs_created_days: site.filter((row) => get(row, 'request.consent_attestation.statement_version') === '2026-11-12.v4').map((row) => day(toMs(get(row, 'createdAt')))).sort(),
  };
});

out.captureUploadSessions = await safe('captureUploadSessions', async () => {
  const list = await rows('captureUploadSessions', ['company_clip.permission_basis', 'company_clip.updated_at_epoch', 'company_simulation.permission_basis',
    'website_preparation.status.state', 'reconstruction.state', 'upload_transport', 'size_bytes', 'sizeBytes', 'video.size_bytes',
    'scene_preview.state', 'scene_preview.updated_at_epoch', 'created_at_iso', 'createdAt', 'updated_at_iso']);
  const size = (row) => get(row, 'size_bytes') ?? get(row, 'sizeBytes') ?? get(row, 'video.size_bytes');
  const bucket = (bytes) => bytes == null ? '(unknown)' : bytes < 200e6 ? '<200MB' : bytes < 400e6 ? '200-400MB' : bytes < 1e9 ? '400MB-1GB' : '>1GB';
  const buckets = {};
  for (const row of list) { const key = bucket(size(row)); buckets[key] = (buckets[key] ?? 0) + 1; }
  return { n: list.length, company_clip_permission_basis: distribution(list, 'company_clip.permission_basis'),
    company_simulation_permission_basis: distribution(list, 'company_simulation.permission_basis'),
    website_preparation_state: distribution(list, 'website_preparation.status.state'),
    reconstruction_state: distribution(list, 'reconstruction.state'), upload_transport: distribution(list, 'upload_transport'),
    scene_preview_state: distribution(list, 'scene_preview.state'), size_buckets: buckets };
});

out.siteAssessmentJobs = await safe('siteAssessmentJobs', async () => {
  const list = await rows('siteAssessmentJobs', ['state', 'createdAt', 'created_at_iso', 'createdAtIso', 'completedAt', 'completed_at_iso', 'completedAtIso', 'updatedAt', 'updatedAtIso']);
  const start = (row) => toMs(get(row, 'createdAt')) ?? toMs(get(row, 'created_at_iso')) ?? toMs(get(row, 'createdAtIso'));
  const end = (row) => toMs(get(row, 'completedAt')) ?? toMs(get(row, 'completed_at_iso')) ?? toMs(get(row, 'completedAtIso'));
  return { n: list.length, state: distribution(list, 'state'), with_start: list.filter((r) => start(r) != null).length,
    with_end: list.filter((r) => end(r) != null).length,
    start_to_complete_minutes: stats(list.map((row) => (start(row) != null && end(row) != null ? end(row) - start(row) : null)), 60_000) };
});

out.captureOutbox_since_2026_11_12 = await safe('captureOutbox', async () => {
  const list = (await rows('captureOutbox', ['kind', 'status', 'createdAtIso'])).filter((row) => (toMs(row.createdAtIso) ?? 0) >= Date.parse('2026-11-12T00:00:00Z'));
  const kinds = {};
  for (const row of list) { const key = `${row.kind} / ${row.status}`; kinds[key] = (kinds[key] ?? 0) + 1; }
  return { n: list.length, kind_and_status: Object.fromEntries(Object.entries(kinds).sort()) };
});

out.taskEvaluationLaunches_since_2026_11_14 = await safe('launches', async () => {
  const list = (await rows('taskEvaluationLaunches', ['state', 'created_at_iso', 'createdAt', 'createdAtIso'], { limit: 2000 }))
    .filter((row) => (toMs(row.created_at_iso) ?? toMs(row.createdAt) ?? toMs(row.createdAtIso) ?? 0) >= Date.parse('2026-11-14T00:00:00Z'));
  return { n: list.length, state: distribution(list, 'state') };
});

out.agentRuns_since_2026_11_01 = await safe('agentRuns', async () => {
  const list = (await rows('agentRuns', ['provider', 'status', 'createdAt', 'created_at', 'createdAtIso', 'startedAt'], { limit: 6000 }))
    .filter((row) => (toMs(row.createdAt) ?? toMs(row.created_at) ?? toMs(row.createdAtIso) ?? toMs(row.startedAt) ?? 0) >= Date.parse('2026-11-01T00:00:00Z'));
  return { n: list.length, provider: distribution(list, 'provider'), status: distribution(list, 'status') };
});

out.growth_campaign_events = await safe('growth_campaign_events', async () => {
  const list = await rows('growth_campaign_events', ['event_type', 'campaign_id', 'received_at', 'receivedAt', 'created_at'], { limit: 2000 });
  return { n: list.length, event_type: distribution(list, 'event_type'), campaign_id_unknown: list.filter((row) => row.campaign_id === 'unknown').length,
    latest: day(Math.max(0, ...list.map((row) => toMs(row.received_at) ?? toMs(row.receivedAt) ?? toMs(row.created_at) ?? 0)) || null) };
});

out.opsHeartbeats = await safe('opsHeartbeats', async () => {
  const list = await rows('opsHeartbeats', ['updatedAt', 'updatedAtIso', 'service']);
  return { n: list.length, service: distribution(list, 'service'), latest: list.map((row) => row.updatedAtIso ?? row.updatedAt).filter(Boolean).sort().slice(-3) };
});
out.durableDailyCaps = await safe('durableDailyCaps', () => count('durableDailyCaps'));

console.log(JSON.stringify(out, null, 1));
