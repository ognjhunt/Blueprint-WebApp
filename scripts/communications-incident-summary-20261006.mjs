/** Local private JSON only: redacted provider evidence, no SDK or network. */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const statuses = list => list.reduce((result, row) => {
  const value = row.status;
  const state = ['completed', 'cancelled', 'failed', 'in_progress', 'queued', 'running', 'requires_action'].includes(value) ? value : 'unknown';
  result[state] = (result[state] ?? 0) + 1; return result;
}, {});
const safeEnum = value => typeof value === 'string' && /^[a-z_]{1,64}$/.test(value) ? value : 'unknown';
export function summarize(canonicalBytes, providerBytes) {
  const canonical = JSON.parse(canonicalBytes), provider = JSON.parse(providerBytes);
  if (canonical.schema !== 'blueprint.communications-incident-20261006.v1'
    || provider.schema !== 'blueprint.communications-incident-provider-20261006.v1'
    || provider.canonicalFileSha256 !== sha(canonicalBytes) || !Array.isArray(provider.sessions)) throw Error('packet_binding_invalid');
  return { schema: 'blueprint.communications-incident-summary.v1', readOnly: true,
    canonicalFileSha256: sha(canonicalBytes), providerFileSha256: sha(providerBytes), observedAtMs: provider.observedAtMs,
    sessions: provider.sessions.map(remote => ({ sessionRefSha256: sha(remote.sessionId),
      absent: remote.absent === true && remote.statusCode === 404, complete: remote.complete === true,
      sessionStatus: ['idle', 'busy', 'running', 'in_progress', 'failed'].includes(remote.session?.status) ? remote.session.status : 'unknown',
      requiredActionCount: Array.isArray(remote.session?.required_actions) ? remote.session.required_actions.length : null,
      turnCount: Array.isArray(remote.turns) ? remote.turns.length : null,
      turnStates: Array.isArray(remote.turns) ? statuses(remote.turns) : null,
      subagentTurnCount: Array.isArray(remote.turns) ? remote.turns.filter(t => t.subagent_id).length : null,
      itemCount: Array.isArray(remote.items) ? remote.items.length : null,
      activeItemCount: Array.isArray(remote.items) ? remote.items.filter(i => ['in_progress', 'queued', 'running', 'requires_action'].includes(i.status)).length : null,
      itemShapes: Array.isArray(remote.items) ? remote.items.reduce((counts, item) => {
        const shape = `${safeEnum(item.type)}:${item.status === undefined ? 'missing' : safeEnum(item.status)}`;
        counts[shape] = (counts[shape] ?? 0) + 1; return counts;
      }, {}) : null,
      artifactCount: Array.isArray(remote.artifacts) ? remote.artifacts.length : null,
      environmentBound: Boolean(remote.environment?.id),
      environmentStatus: ['connected', 'disconnected', 'deleted', 'stopped', 'running', 'pending'].includes(remote.environment?.status) ? remote.environment.status : 'unknown',
      researchDates: (canonical.sources ?? []).filter(s => s.value?.session_id === remote.sessionId).map(s => s.value.date),
      pairedEnvironments: (remote.environments ?? []).map(e => ({ environmentRefSha256: sha(e.environmentId),
        absent: e.absent === true && e.statusCode === 404, status: safeEnum(e.environment?.status) })),
    })), findall: (provider.findall ?? []).map(child => ({ childRefSha256: sha(child.findallId),
      absent: child.absent === true && child.statusCode === 404,
      isActive: typeof child.receipt?.status?.is_active === 'boolean' ? child.receipt.status.is_active : null })) };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [canonicalPath, providerPath] = process.argv.slice(2);
    if (!canonicalPath?.startsWith('/tmp/') || !providerPath?.startsWith('/tmp/')) throw Error('private_packet_paths_required');
    console.log(JSON.stringify(summarize(readFileSync(canonicalPath), readFileSync(providerPath))));
  } catch { console.error(JSON.stringify({ ok: false, code: 'packet_summary_unavailable' })); process.exitCode = 2; }
}
