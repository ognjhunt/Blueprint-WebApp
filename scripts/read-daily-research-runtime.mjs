import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Official GET schemas (checked 2026-10-06):
// https://api-docs.render.com/reference/retrieve-service
// https://api-docs.render.com/reference/list-logs
// https://api-docs.render.com/openapi/render-public-api-1.json
// No service mutation, provider call, activation or credential setup occurs here.
const SCHEMA = 'blueprint.daily-research-installed-runtime.v1';
const SOURCE = /^[a-f0-9]{40}$/, DIGEST = /^[a-f0-9]{64}$/;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export class ReadbackFailure extends Error { constructor(code) { super(code); this.code = code; } }
const fail = code => { throw new ReadbackFailure(code); };
const time = value => {
  if (typeof value !== 'string') return NaN;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) return NaN;
  const [year, month, day, hour, minute, second] = match.slice(1, 7).map(Number);
  const calendar = new Date(0);
  calendar.setUTCFullYear(year, month - 1, day); calendar.setUTCHours(hour, minute, second, 0);
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day
    || calendar.getUTCHours() !== hour || calendar.getUTCMinutes() !== minute || calendar.getUTCSeconds() !== second) return NaN;
  return Date.parse(value);
};

/** Compute expectations from the exact checked-out vendor bytes, without installing. */
export function expectedRuntime(vendorRoot = 'vendor/daily-research') {
  try {
    const receipt = JSON.parse(readFileSync(resolve(vendorRoot, 'receipt.json'), 'utf8'));
    const archive = readFileSync(resolve(vendorRoot, 'blueprint-research.tar'));
    if (!object(receipt) || receipt.archive !== 'blueprint-research.tar' || typeof receipt.source_commit !== 'string' || !SOURCE.test(receipt.source_commit)
      || typeof receipt.sha256 !== 'string' || !DIGEST.test(receipt.sha256) || archive.length !== receipt.bytes || sha(archive) !== receipt.sha256
      || archive.length > 20 * 1024 * 1024) fail('research_readback_vendor_invalid');
    const members = new Map();
    for (let offset = 0; offset + 512 <= archive.length;) {
      const header = archive.subarray(offset, offset + 512);
      if (header.every(byte => byte === 0)) {
        if (archive.subarray(offset).some(byte => byte !== 0)) fail('research_readback_vendor_invalid');
        break;
      }
      const field = (start, end) => header.subarray(start, end).toString('ascii').split('\0', 1)[0].trim();
      const octal = (start, end) => /^[0-7]+$/.test(field(start, end)) ? parseInt(field(start, end), 8) : NaN;
      const size = octal(124, 136), name = field(0, 100);
      const checksum = [...header].reduce((sum, byte, index) => sum + (index >= 148 && index < 156 ? 32 : byte), 0);
      if (field(345, 500) || field(156, 157) !== '0' || header.subarray(257, 263).toString('ascii') !== 'ustar\0'
        || octal(148, 156) !== checksum || !Number.isSafeInteger(size) || size < 0 || size > 4 * 1024 * 1024
        || offset + 512 + size > archive.length || members.has(name) || members.size > 500) fail('research_readback_vendor_invalid');
      members.set(name, archive.subarray(offset + 512, offset + 512 + size));
      offset += 512 + Math.ceil(size / 512) * 512;
    }
    const raw = members.get('manifest.json');
    if (!raw || raw.length > 1024 * 1024 || members.keys().next().value !== 'manifest.json') fail('research_readback_vendor_invalid');
    const manifest = JSON.parse(raw.toString('utf8'));
    if (!object(manifest) || manifest.schema_version !== 'blueprint.research-standalone.v1'
      || manifest.source_commit !== receipt.source_commit || manifest.activation_performed !== false
      || manifest.example_enabled !== false || !object(manifest.files)) fail('research_readback_vendor_invalid');
    const names = Object.keys(manifest.files).sort(), actual = Object.create(null);
    if (!names.length || members.size !== names.length + 1) fail('research_readback_vendor_invalid');
    for (const name of names) {
      if (!name.startsWith('tools/daily_research/') || name.includes('\\') || name.split('/').some(part => !part || part === '.' || part === '..')
        || typeof manifest.files[name] !== 'string' || !DIGEST.test(manifest.files[name]) || !members.has(name)) fail('research_readback_vendor_invalid');
      actual[name] = sha(members.get(name));
      if (actual[name] !== manifest.files[name]) fail('research_readback_vendor_invalid');
    }
    return { source_commit: manifest.source_commit, archive_sha256: sha(archive), manifest_sha256: sha(raw),
      files_map_sha256: sha(JSON.stringify(actual)), file_count: names.length };
  } catch (error) { if (error instanceof ReadbackFailure) throw error; fail('research_readback_vendor_invalid'); }
}

/** Project only the startup observer's allowlisted fields; logger context never escapes. */
function validatedProof(value, expected, deployRef) {
  if (!object(value) || value.schema_version !== SCHEMA || value.render_git_commit !== deployRef) return null;
  if (value.code !== 'research_installed_runtime_verified' || value.files_verified !== true) fail('research_readback_startup_verification_failed');
  for (const key of Object.keys(expected)) if (value[key] !== expected[key]) fail('research_readback_runtime_mismatch');
  if (!object(value.flags) || ['send_enabled', 'automatic_first_contact_enabled', 'hypothesis_drafts_enabled']
    .some(key => typeof value.flags[key] !== 'boolean')) fail('research_readback_proof_invalid');
  return { schema_version: SCHEMA, code: value.code, source_commit: value.source_commit, render_git_commit: value.render_git_commit,
    archive_sha256: value.archive_sha256, manifest_sha256: value.manifest_sha256, files_map_sha256: value.files_map_sha256,
    file_count: value.file_count, files_verified: value.files_verified, flags: {
      send_enabled: value.flags.send_enabled, automatic_first_contact_enabled: value.flags.automatic_first_contact_enabled,
      hypothesis_drafts_enabled: value.flags.hypothesis_drafts_enabled } };
}

/** At most twelve bounded GETs of filtered logs, with a sixty-second total deadline. */
export async function readRuntimeProof({ apiKey, workerServiceId, deployRef, deployedAt, expected },
  { fetchImpl = fetch, now = Date.now, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  if (typeof apiKey !== 'string' || !apiKey || !/^srv-[a-z0-9]+$/.test(workerServiceId ?? '')
    || !SOURCE.test(deployRef ?? '') || !Number.isFinite(time(deployedAt))) fail('research_readback_configuration_invalid');
  const started = time(deployedAt), deadline = now() + 60_000;
  if (started > now() || now() - started > 2 * 60 * 60_000) fail('research_readback_deploy_window_invalid');
  async function get(url) {
    try {
      const response = await fetchImpl(url, { method: 'GET', redirect: 'error', headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(Math.max(1, Math.min(5_000, deadline - now()))) });
      if (response.status === 401 || response.status === 403) fail('research_readback_api_access_unavailable');
      if (response.status !== 200) fail('research_readback_api_read_unavailable');
      const reader = response.body?.getReader();
      if (!reader) fail('research_readback_api_response_invalid');
      const chunks = []; let size = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 256 * 1024) { await reader.cancel(); fail('research_readback_api_response_invalid'); }
        chunks.push(value);
      }
      return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch (error) { if (error instanceof ReadbackFailure) throw error; fail('research_readback_api_read_unavailable'); }
  }
  const service = await get(`https://api.render.com/v1/services/${workerServiceId}`);
  if (!object(service) || service.id !== workerServiceId || !/^(tea|usr)-[a-z0-9]+$/.test(service.ownerId ?? '')
    || service.type !== 'background_worker') fail('research_readback_service_invalid');
  if (service.suspended !== 'not_suspended') fail('research_readback_worker_not_running');
  let startTime = deployedAt, endTime = new Date(now()).toISOString();
  for (let attempt = 0; attempt < 12 && now() < deadline; attempt++) {
    const url = new URL('https://api.render.com/v1/logs');
    for (const [key, value] of Object.entries({ ownerId: service.ownerId, resource: workerServiceId, type: 'app', text: SCHEMA,
      direction: 'backward', startTime, endTime, limit: '20' })) url.searchParams.set(key, value);
    const page = await get(url.href);
    const checkedAt = new Date(now()).toISOString();
    if (!object(page) || !Array.isArray(page.logs) || page.logs.length > 20 || typeof page.hasMore !== 'boolean') fail('research_readback_api_response_invalid');
    for (const log of page.logs) {
      if (!object(log) || typeof log.message !== 'string' || !Array.isArray(log.labels)
        || !Number.isFinite(time(log.timestamp))) fail('research_readback_api_response_invalid');
      if (!log.labels.some(label => label?.name === 'resource' && label.value === workerServiceId)
        || !log.labels.some(label => label?.name === 'type' && label.value === 'app')
        || time(log.timestamp) < started || time(log.timestamp) > time(endTime)) continue;
      let value;
      try { value = JSON.parse(log.message); } catch { fail('research_readback_proof_invalid'); }
      const proof = validatedProof(value, expected, deployRef);
      if (proof) return { schema_version: 'blueprint.daily-research-deploy-readback.v1', code: 'research_readback_runtime_verified',
        startup_logged_at: log.timestamp, checked_at: checkedAt, service_suspended: service.suspended, proof };
    }
    if (page.hasMore) {
      if (!Number.isFinite(time(page.nextStartTime)) || !Number.isFinite(time(page.nextEndTime))
        || time(page.nextStartTime) < started || time(page.nextEndTime) > time(endTime)
        || time(page.nextEndTime) >= time(endTime) || time(page.nextStartTime) > time(page.nextEndTime)) fail('research_readback_pagination_invalid');
      startTime = page.nextStartTime; endTime = page.nextEndTime;
    } else {
      if (attempt < 11 && now() < deadline) await sleep(Math.min(5_000, deadline - now()));
      startTime = deployedAt; endTime = new Date(now()).toISOString();
    }
  }
  fail('research_readback_startup_proof_unavailable');
}

async function main() {
  try {
    const deployRef = process.env.DEPLOY_REF;
    if (!SOURCE.test(deployRef ?? '') || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() !== deployRef) {
      fail('research_readback_checkout_mismatch');
    }
    const evidence = JSON.parse(readFileSync('/tmp/deploy-evidence/deploy-verification.json', 'utf8'));
    const workerDeploy = JSON.parse(readFileSync('/tmp/deploy-evidence/render-worker-deploy.json', 'utf8'));
    if (evidence.deploy_ref !== deployRef || evidence.web_render_commit !== deployRef || evidence.worker_render_commit !== deployRef
      || evidence.web_render_deploy_status !== 'live' || evidence.worker_render_deploy_status !== 'live'
      || workerDeploy.id !== evidence.worker_render_deploy_id || workerDeploy.status !== 'live' || workerDeploy.commit?.id !== deployRef) {
      fail('research_readback_deploy_evidence_invalid');
    }
    const proof = await readRuntimeProof({ apiKey: process.env.RENDER_API_KEY, workerServiceId: process.env.RENDER_WORKER_SERVICE_ID,
      deployRef, deployedAt: workerDeploy.createdAt, expected: expectedRuntime() });
    process.stdout.write(JSON.stringify(proof) + '\n');
  } catch (error) {
    process.stdout.write(JSON.stringify({ schema_version: 'blueprint.daily-research-deploy-readback.v1',
      code: error instanceof ReadbackFailure ? error.code : 'research_readback_local_evidence_invalid', proof: null }) + '\n');
    process.exitCode = 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
