// @vitest-environment node
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectedRuntime, readRuntimeProof } from './read-daily-research-runtime.mjs';

const deployRef = 'a'.repeat(40), workerServiceId = 'srv-syntheticworker', ownerId = 'tea-syntheticowner';
const deployedAt = '2026-10-06T06:00:00.000Z', started = Date.parse(deployedAt);
const expected = { source_commit: 'b'.repeat(40), archive_sha256: 'c'.repeat(64), manifest_sha256: 'd'.repeat(64),
  files_map_sha256: 'e'.repeat(64), file_count: 1 };
const proof = { schema_version: 'blueprint.daily-research-installed-runtime.v1', code: 'research_installed_runtime_verified',
  ...expected, render_git_commit: deployRef, files_verified: true,
  flags: { send_enabled: false, automatic_first_contact_enabled: false, hypothesis_drafts_enabled: false } };
const receipt = (observed = proof, startup_logged_at = '2026-10-06T06:00:01.000Z', checked_at = '2026-10-06T06:00:02.000Z') => ({
  schema_version: 'blueprint.daily-research-deploy-readback.v1', code: 'research_readback_runtime_verified',
  startup_logged_at, checked_at, service_suspended: 'not_suspended', proof: observed });
const input = { apiKey: 'SYNTHETIC_PRIVATE_KEY', workerServiceId, deployRef, deployedAt, expected };
const service = { id: workerServiceId, ownerId, type: 'background_worker', suspended: 'not_suspended' };
const entry = (value = proof, changes = {}) => ({ id: 'synthetic-log', timestamp: '2026-10-06T06:00:01.000Z',
  message: JSON.stringify({ ...value, private_context: 'SYNTHETIC_PRIVATE_LEAD', flags: { ...value.flags, secret: 'SYNTHETIC_SECRET' } }),
  labels: [{ name: 'resource', value: workerServiceId }, { name: 'type', value: 'app' }], ...changes });
const page = logs => ({ logs, hasMore: false, nextStartTime: deployedAt, nextEndTime: '2026-10-06T06:00:02.000Z' });
function harness(responses) {
  let clock = started + 2_000;
  const fetchImpl = vi.fn(async () => new Response(JSON.stringify(responses.shift()), { status: 200 }));
  const sleep = vi.fn(async ms => { clock += ms; });
  return { fetchImpl, sleep, now: () => clock };
}
const roots = [];
afterEach(() => { roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })); });

describe('normal deploy installed-runtime readback (synthetic GETs only)', () => {
  it('reads only worker metadata and schema-filtered logs; returns only the actual aggregate', async () => {
    const h = harness([service, page([entry()])]);
    const actual = await readRuntimeProof(input, h);
    expect(actual).toEqual(receipt());
    expect(Object.keys(actual).sort()).toEqual(['schema_version', 'code', 'startup_logged_at', 'checked_at', 'service_suspended', 'proof'].sort());
    expect(JSON.stringify(actual)).not.toMatch(/PRIVATE|SECRET/);
    expect(h.fetchImpl).toHaveBeenCalledTimes(2);
    for (const [url, options] of h.fetchImpl.mock.calls) {
      expect(url.startsWith('https://api.render.com/v1/')).toBe(true);
      expect(options.method).toBe('GET'); expect(options.redirect).toBe('error');
    }
    const query = new URL(h.fetchImpl.mock.calls[1][0]).searchParams;
    expect(Object.fromEntries(query)).toEqual({ ownerId, resource: workerServiceId, type: 'app',
      text: proof.schema_version, direction: 'backward', startTime: deployedAt, endTime: '2026-10-06T06:00:02.000Z', limit: '20' });
  });
  it('records true flag booleans without creating a global activation restriction', async () => {
    const changed = { ...proof, flags: { send_enabled: true, automatic_first_contact_enabled: true, hypothesis_drafts_enabled: true } };
    expect(await readRuntimeProof(input, harness([service, page([entry(changed)])]))).toEqual(receipt(changed));
  });
  it('follows only bounded timestamp pagination to find the matching deployment', async () => {
    const first = { ...page([entry({ ...proof, render_git_commit: 'f'.repeat(40) })]), hasMore: true,
      nextStartTime: deployedAt, nextEndTime: '2026-10-06T06:00:01.500Z' };
    const h = harness([service, first, page([entry()])]);
    expect(await readRuntimeProof(input, h)).toEqual(receipt());
    expect(new URL(h.fetchImpl.mock.calls[2][0]).searchParams.get('endTime')).toBe(first.nextEndTime);
    expect(h.sleep).not.toHaveBeenCalled();
  });
  it('waits for log lag but stops after exactly twelve filtered log requests', async () => {
    const h = harness([service, ...Array.from({ length: 12 }, () => page([]))]);
    await expect(readRuntimeProof(input, h)).rejects.toMatchObject({ code: 'research_readback_startup_proof_unavailable' });
    expect(h.fetchImpl).toHaveBeenCalledTimes(13); expect(h.sleep).toHaveBeenCalledTimes(11);
    expect(h.now() - (started + 2_000)).toBe(55_000);
  });
  it('rejects API access errors without returning provider bodies or secret-bearing exceptions', async () => {
    const fetchImpl = vi.fn(async () => new Response('SYNTHETIC_PRIVATE_PROVIDER_BODY', { status: 403 }));
    await expect(readRuntimeProof(input, { fetchImpl, now: () => started + 2_000 })).rejects.toMatchObject({ code: 'research_readback_api_access_unavailable' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await expect(readRuntimeProof(input, { fetchImpl: async () => { throw new Error(input.apiKey); }, now: () => started + 2_000 }))
      .rejects.toThrow('research_readback_api_read_unavailable');
  });
  it('bounds an unexpected API response before retaining its entire body', async () => {
    const fetchImpl = vi.fn(async () => new Response('SYNTHETIC_PRIVATE'.repeat(20_000), { status: 200 }));
    await expect(readRuntimeProof(input, { fetchImpl, now: () => started + 2_000 }))
      .rejects.toMatchObject({ code: 'research_readback_api_response_invalid' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it.each(['suspended', true, undefined])('refuses to claim a running worker from suspended=%s', suspended => {
    return expect(readRuntimeProof(input, harness([{ ...service, suspended }]))).rejects.toMatchObject({ code: 'research_readback_worker_not_running' });
  });
  it.each(['source_commit', 'archive_sha256', 'manifest_sha256', 'files_map_sha256', 'file_count'])('rejects a mismatched %s', key => {
    return expect(readRuntimeProof(input, harness([service, page([entry({ ...proof, [key]: 'wrong' })])])))
      .rejects.toMatchObject({ code: 'research_readback_runtime_mismatch' });
  });
  it('requires actual startup success and typed flags', async () => {
    await expect(readRuntimeProof(input, harness([service, page([entry({ ...proof, files_verified: false })])])))
      .rejects.toMatchObject({ code: 'research_readback_startup_verification_failed' });
    await expect(readRuntimeProof(input, harness([service, page([entry({ ...proof, flags: { ...proof.flags, send_enabled: 'false' } })])])))
      .rejects.toMatchObject({ code: 'research_readback_proof_invalid' });
  });
  it('ignores unrelated resources and older same-SHA startup events', async () => {
    const h = harness([service, page([entry(proof, { labels: [{ name: 'resource', value: 'srv-other' }] }),
      entry(proof, { timestamp: '2026-10-06T05:59:59.000Z' })]), page([entry()])]);
    expect(await readRuntimeProof(input, h)).toEqual(receipt(proof, '2026-10-06T06:00:01.000Z', '2026-10-06T06:00:07.000Z'));
    expect(h.sleep).toHaveBeenCalledTimes(1);
  });
  it.each([undefined, null, 'invalid', '2026-02-30T06:00:01Z', '2026-10-06T06:00:01'])('refuses a missing or invalid startup timestamp %s', timestamp => {
    return expect(readRuntimeProof(input, harness([service, page([entry(proof, { timestamp })])])))
      .rejects.toMatchObject({ code: 'research_readback_api_response_invalid' });
  });
  it('preserves the actual timestamp precision and distinguishes it from GET completion time', async () => {
    const timestamp = '2026-10-05T23:00:01.123456-07:00';
    const h = harness([service, page([entry(proof, { timestamp })])]);
    const fetched = h.fetchImpl;
    h.fetchImpl = async (...args) => {
      const response = await fetched(...args);
      await h.sleep(500);
      return response;
    };
    expect(await readRuntimeProof(input, h)).toEqual(receipt(proof, timestamp, '2026-10-06T06:00:03.000Z'));
  });
  it('rejects a pagination cursor that escapes the actual deployment window', () => {
    return expect(readRuntimeProof(input, harness([service, { ...page([]), hasMore: true, nextStartTime: '2026-10-05T00:00:00Z' }])))
      .rejects.toMatchObject({ code: 'research_readback_pagination_invalid' });
  });
  it('checks actual tiny vendored archive members without installing and rejects changed bytes', () => {
    const root = mkdtempSync(join(tmpdir(), 'readback-vendor-test-')); roots.push(root);
    const name = 'tools/daily_research/tiny.py', body = '# synthetic\n', sha = bytes => createHash('sha256').update(bytes).digest('hex');
    const manifest = JSON.stringify({ schema_version: 'blueprint.research-standalone.v1', source_commit: expected.source_commit,
      activation_performed: false, example_enabled: false, files: { [name]: sha(body) } });
    const archive = spawnSync('python3', ['-c', "import io,json,sys,tarfile\nv=json.load(sys.stdin); b=io.BytesIO()\nwith tarfile.open(fileobj=b,mode='w',format=tarfile.USTAR_FORMAT) as t:\n for n,s in [('manifest.json',v['manifest']),(v['name'],v['body'])]:\n  raw=s.encode(); i=tarfile.TarInfo(n); i.size=len(raw); i.mode=0o644; t.addfile(i,io.BytesIO(raw))\nsys.stdout.buffer.write(b.getvalue())"], { input: JSON.stringify({ manifest, name, body }) });
    expect(archive.status).toBe(0);
    writeFileSync(join(root, 'blueprint-research.tar'), archive.stdout);
    writeFileSync(join(root, 'receipt.json'), JSON.stringify({ source_commit: expected.source_commit, archive: 'blueprint-research.tar', bytes: archive.stdout.length, sha256: sha(archive.stdout) }));
    expect(expectedRuntime(root)).toEqual({ source_commit: expected.source_commit, archive_sha256: sha(archive.stdout),
      manifest_sha256: sha(manifest), files_map_sha256: sha(JSON.stringify({ [name]: sha(body) })), file_count: 1 });
    writeFileSync(join(root, 'blueprint-research.tar'), 'changed bytes');
    expect(() => expectedRuntime(root)).toThrow('research_readback_vendor_invalid');
  });
  it('reads the actual pinned portable archive with every member digest checked', () => {
    const receipt = JSON.parse(readFileSync('vendor/daily-research/receipt.json', 'utf8'));
    expect(expectedRuntime()).toMatchObject({ source_commit: receipt.source_commit, archive_sha256: receipt.sha256 });
    expect(expectedRuntime().file_count).toBeGreaterThan(0);
  });
  it('checks out and invokes readback only after existing exact-SHA live verification, preserving old rollback absence', () => {
    const workflow = readFileSync('.github/workflows/deploy.yml', 'utf8');
    expect(workflow.indexOf('Checkout the exact verified deployment for runtime readback')).toBeGreaterThan(workflow.indexOf('wait_for_deploy worker'));
    expect(workflow).toContain('ref: ${{ steps.ref.outputs.deploy_ref }}');
    expect(workflow).toContain('actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5');
    expect(workflow).toContain('node scripts/read-daily-research-runtime.mjs > "${evidence}"');
    expect(workflow).toContain('research_readback_observer_unavailable_at_commit');
  });
});
