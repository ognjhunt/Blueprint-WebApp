/** Offline bounded profile of the real saved-output consumer. Builds a temporary
 * fixture bundle with Firebase disabled; no credentials, sockets or live writes.
 * Run with node scripts/communications-recovery-memory-profile.mjs /tmp/proof.json.
 * This measures recovery overhead, not native Render headroom or worker RSS. */
import { build } from 'esbuild';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';

const [mode, output] = process.argv.slice(2);
if (mode !== '--fixture-child') {
  if (!mode?.startsWith('/tmp/') || resolve(mode) !== mode || output) throw Error('absolute_tmp_output_required');
  const directory = mkdtempSync(join(tmpdir(), 'communications-memory-'));
  try {
    const bundle = join(directory, 'fixture.cjs');
    await build({ stdin: { contents: `export { savedRecoveryFixture } from './server/tests/fixtures/communications-saved-recovery';
      export { recoverCommunicationsDraftInProcess } from './server/agents/communications-inprocess-recovery';
      export { sampleCommunicationsRecoveryMemory, communicationsMemoryCounters } from './server/agents/communications-recovery-memory';`,
      resolveDir: process.cwd(), sourcefile: 'synthetic-memory-profile.ts' }, outfile: bundle,
      bundle: true, platform: 'node', format: 'cjs', packages: 'external', plugins: [{ name: 'offline-firebase', setup(b) {
        b.onResolve({ filter: /firebaseAdmin(?:\.[cm]?[jt]s)?$/ }, () => ({ path: 'offline-firebase', namespace: 'offline' }));
        b.onLoad({ filter: /.*/, namespace: 'offline' }, () => ({ contents: 'export const dbAdmin=null; export const authAdmin=null; export const storageAdmin=null; export default {};', loader: 'js' }));
      } }] });
    const child = spawnSync(process.execPath, ['--expose-gc', '--max-old-space-size=192', '--max-semi-space-size=4',
      new URL(import.meta.url).pathname, '--fixture-child', bundle], { encoding: 'utf8', timeout: 60000,
      maxBuffer: 1000000, env: { PATH: process.env.PATH, NODE_PATH: resolve('node_modules'), NODE_ENV: 'test' } });
    if (child.status !== 0) throw Error(`offline_profile_failed:${child.stderr.slice(-1500)}`);
    const proof = JSON.parse(child.stdout);
    proof.bundleSha256 = createHash('sha256').update(readFileSync(bundle)).digest('hex');
    const bytes = Buffer.from(JSON.stringify(proof, null, 2) + '\n');
    writeFileSync(mode, bytes, { flag: 'wx', mode: 0o600 });
    console.log(JSON.stringify({ output: mode, sha256: createHash('sha256').update(bytes).digest('hex'),
      measurements: proof.measurements, plateau: proof.plateau, effects: proof.effects }));
  } finally { rmSync(directory, { recursive: true, force: true }); }
} else {
  globalThis.fetch = async () => { throw Error('live_transport_forbidden'); };
  process.env.RENDER_GIT_COMMIT = 'a'.repeat(40);
  for (const key of ['BLUEPRINT_COMMUNICATIONS_WORKER_ENABLED', 'BLUEPRINT_DAILY_RESEARCH_WORKER_ENABLED',
    'BLUEPRINT_COMMUNICATIONS_SEND_ENABLED', 'BLUEPRINT_COMMUNICATIONS_AUTOMATIC_FIRST_CONTACT_ENABLED']) process.env[key] = 'false';
  const beforeModules = process.memoryUsage();
  const { savedRecoveryFixture, recoverCommunicationsDraftInProcess: recover, sampleCommunicationsRecoveryMemory: take,
    communicationsMemoryCounters } = createRequire(import.meta.url)(output);
  global.gc();
  const modulesLoaded = take('modules_loaded'), rows = [], peaks = [];
  let stagePeak = 0, offlineGets = 0;
  // Synthetic admission counters are explicit. Actual RSS and actual cloud
  // cgroup observations remain in the measurements and are never discounted.
  const sample = stage => {
    const observed = take(stage); stagePeak = Math.max(stagePeak, observed.rss);
    return { ...observed, cgroup: { current: observed.rss, limit: 536870912,
      counters: communicationsMemoryCounters(`anon ${observed.rss}\nfile 0\nkernel 0\nshmem 0\nfile_mapped 0\nfile_dirty 0\nfile_writeback 0\ninactive_file 0\nactive_file 0\nunevictable 0`) } };
  };
  const modes = ['success', 'failure', 'cancelled', 'request_cancelled'];
  for (let index = 0; index < 144; index++) {
    const kind = modes[index % modes.length], f = await savedRecoveryFixture(kind === 'request_cancelled' ? 'success' : kind);
    const controller = new AbortController(); stagePeak = 0;
    if (kind === 'request_cancelled') {
      const run = f.db.runTransaction.bind(f.db);
      f.db.runTransaction = fn => run(tx => fn({ ...tx, get: async ref => {
        const value = await tx.get(ref); if (ref.path.startsWith('action_ledger/')) controller.abort(); return value;
      } }));
    }
    try {
      const result = await recover(f.input, 'synthetic-owner', f.deps, { sample, signal: controller.signal });
      if (kind === 'success') {
        if (result.state !== 'pending_approval' || (await recover(f.input, 'synthetic-owner', f.deps, { sample })).state !== 'no_op') throw Error('duplicate_proof_failed');
        if (f.requests.length !== 3) throw Error('duplicate_provider_call');
      } else if (!['blocked', 'retry'].includes(result.state)) throw Error('failure_proof_failed');
    } catch (error) { if (kind !== 'request_cancelled' || !error.message.includes('request_cancelled')) throw error; }
    if (kind === 'request_cancelled' && f.db.records.has(`action_ledger/communications_${f.input.jobId}`)) throw Error('cancelled_write');
    if (f.db.records.get(f.budgetPath).actualModelMicros !== 14755
      || f.db.records.get('blueprintCommunications/default/intakeState/workerLap').phase !== 'complete') throw Error('accounting_or_drain_changed');
    offlineGets += f.requests.length;
    f.db.records.clear(); f.requests.length = 0;
    global.gc();
    rows.push({ index, kind, warmup: index < 16, ...take('after_job_gc') }); peaks.push(stagePeak);
  }
  const measured = rows.slice(16), median = values => values.toSorted((a, b) => a - b)[Math.floor(values.length / 2)];
  const first = measured.slice(0, 32), last = measured.slice(-32);
  const plateau = Object.fromEntries(['rss', 'heapUsed', 'external'].map(key => [key, {
    firstWindowMedian: median(first.map(r => r[key])), lastWindowMedian: median(last.map(r => r[key])),
    growth: median(last.map(r => r[key])) - median(first.map(r => r[key])), max: Math.max(...measured.map(r => r[key])) }]));
  if (plateau.rss.growth > 8 * 1024 * 1024 || plateau.heapUsed.growth > 2 * 1024 * 1024) throw Error('offline_memory_not_plateaued');
  console.log(JSON.stringify({ schema: 'blueprint.communications-recovery-memory-profile.v1', observedAt: new Date().toISOString(),
    mode: 'synthetic_offline_existing_process', syntheticAdmissionCounters: true, nativeRenderFeasibilityProven: false,
    nodeArguments: process.execArgv,
    iterations: 144, warmup: 16, kinds: modes, beforeModules, modulesLoaded, rows,
    measurements: { maxSampledRss: Math.max(...peaks), processLifetimeMaxRss: process.resourceUsage().maxRSS * 1024 }, plateau,
    effects: { offlineGets, paidCalls: 0, liveDatabaseWrites: 0, gmailWrites: 0, sends: 0 } }));
}
