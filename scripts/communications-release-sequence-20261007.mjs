/** One bounded release owner. Existing incident CAS → canonical Pipeline lease
 * and heartbeat → existing CI-gated deployment → verified own-lease release.
 * No worker activation, recovery replay, sends, provider calls or new credentials.
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { CONTROL, sha, refuse, existingAdmin, privateWrite } from './communications-incident-20261006.mjs';
import { checkFence, fenceLease, archiveFiles, verifyArchive } from './communications-incident-recovery-20261006.mjs';

const runFile = promisify(execFile);
const REPO = 'ognjhunt/Blueprint-WebApp', WORKFLOW = 'deploy.yml';
const HOLD_STEP = 'Verify outreach release holds remain off';
const PREFIX = 'gs://blueprint-8c1ca.appspot.com/operations/communications/incident-20261006/';
const MAX_RUN_MS = 60 * 60_000;
const FILES = ['canonical', 'provider', 'process-proof', 'authority'];

export function boundProof(files) {
  const [packet, provider, proof, authority] = FILES.map(name => JSON.parse(files[`${name}.json`]));
  if (sha(files['canonical.json']) !== provider.canonicalFileSha256
    || sha(files['canonical.json']) !== authority.canonicalFileSha256
    || sha(files['provider.json']) !== authority.providerFileSha256
    || sha(files['process-proof.json']) !== authority.processProofFileSha256) refuse('owner_packet_file_binding_changed');
  return { packet, provider, proof, authority };
}

/** Additional predecessor check inside the existing acquire transaction. The
 * Pipeline Store still performs every normal lap, expiry and generation check.
 * Guard every Firestore transaction retry, including an expired successor.
 */
export function predecessorGuard(db, expected) {
  let acquiring = true;
  return {
    db: {
      doc: (...args) => db.doc(...args),
      runTransaction: (fn, ...args) => db.runTransaction(async tx => {
        if (acquiring) {
          const lease = (await tx.get(db.doc(CONTROL))).data()?.lease;
          if (lease?.owner !== expected.owner || lease?.generation !== expected.generation
            || lease?.expires_at_ms !== 0) refuse('release_predecessor_changed');
        }
        return fn(tx);
      }, ...args),
    },
    acquired: () => { acquiring = false; },
  };
}

export async function retainOwnedIntent(assertLease, retainIntent) {
  await retainIntent();
  // Storage waits must not admit an external mutation after ownership was lost.
  await assertLease();
}

export async function continuousRelease(steps) {
  await steps.preflight();
  const released = await steps.releaseIncident();
  if (released?.state !== 'release-fence' || released.lease?.expires_at_ms !== 0) refuse('incident_release_readback_missing');
  const channel = steps.channel(released.lease);
  // Await the canonical SDK's bounded transaction rather than abandoning a
  // Promise that could later acquire ownership and start a heartbeat.
  const call = request => channel.call(request);
  let acquired = false;
  try {
    await steps.retainAcquireIntent?.();
    await call({ op: 'acquire', scope: 'research_release' });
    acquired = true;
    steps.acquired();
    await call({ op: 'assert_lease' });
    await steps.acquireReadback();
    // Deployment runs outside the channel queue so the existing heartbeat can
    // keep renewing while the workflow is building, deploying and reading back.
    const deployment = await steps.deploy(() => call({ op: 'assert_lease' }));
    await call({ op: 'assert_lease' });
    await steps.verify(deployment);
    await steps.acquireReadback();
    await call({ op: 'release' });
    await steps.releaseReadback();
    return { state: 'deployed_and_release_lease_released', deployment,
      sendsAuthorized: false, paidAdmissionAuthorized: false, workerResumeAuthorized: false };
  } catch (error) {
    // Ambiguous acquire/deploy ACK is observe-only. Never replay an acquisition,
    // release an unverified deployment, or release somebody else's generation.
    await steps.failed(error, acquired);
    throw error;
  } finally {
    // close() would release on failure. Stop only the timer; uncertain writes
    // retain the existing CAS protection and are never retried by this owner.
    channel.clearInterval(channel.heartbeat); channel.heartbeat = null;
    await channel.tail;
  }
}

async function gh(args) {
  const { stdout } = await runFile('gh', args, { timeout: 20_000, maxBuffer: 4_000_000 });
  return stdout;
}
async function api(path, ...args) { return JSON.parse(await gh(['api', `repos/${REPO}/${path}`, ...args])); }
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function packagedLease(directory, importModule = path => import(path)) {
  const receipt = JSON.parse(readFileSync('vendor/daily-research/receipt.json'));
  const archive = readFileSync(`vendor/daily-research/${receipt.archive}`);
  if (archive.length !== receipt.bytes || sha(archive) !== receipt.sha256) refuse('reviewed_lease_package_changed');
  const tar = async name => Buffer.from((await runFile('tar', ['-xOf', `vendor/daily-research/${receipt.archive}`, name],
    { encoding: 'buffer', timeout: 10_000, maxBuffer: 8_000_000 })).stdout);
  const manifest = JSON.parse(await tar('manifest.json'));
  if (manifest.source_commit !== receipt.source_commit) refuse('reviewed_lease_source_changed');
  const target = `${directory}/lease-package`;
  mkdirSync(target, { mode: 0o700 });
  // Imports must resolve from the same verified archive; never install a new
  // package or execute the bridge's livePublisher/main entrypoint.
  for (const [path, digest] of Object.entries(manifest.files)) {
    if (!/^tools\/daily_research\/[a-zA-Z0-9_/-]+\.mjs$/.test(path)) continue;
    const bytes = await tar(path);
    if (sha(bytes) !== digest) refuse('reviewed_lease_file_changed');
    const local = `${target}/${path}`;
    mkdirSync(resolve(local, '..'), { recursive: true, mode: 0o700 });
    writeFileSync(local, bytes, { mode: 0o600, flag: 'wx' });
  }
  privateWrite(`${directory}/lease-package-receipt.json`, receipt);
  return importModule(pathToFileURL(`${target}/tools/daily_research/firestore_bridge.mjs`).href);
}

async function proofFiles(input, generation, digest, bucket) {
  const download = async (uri, gen, expected, size) => {
    if (!uri?.startsWith(PREFIX) || !/^[0-9]+$/.test(gen ?? '') || !/^[a-f0-9]{64}$/.test(expected ?? '')) refuse('generation_pinned_release_proof_required');
    const file = bucket.file(uri.slice('gs://blueprint-8c1ca.appspot.com/'.length), { generation: gen });
    const [metadata] = await file.getMetadata(), [bytes] = await file.download();
    if (String(metadata.generation) !== gen || Number(metadata.size) !== bytes.length
      || bytes.length > 20_000_000 || (size !== undefined && size !== bytes.length)
      || sha(bytes) !== expected) refuse('release_proof_download_changed');
    return bytes;
  };
  if (input?.startsWith('/tmp/') && resolve(input) === input) {
    return Object.fromEntries(FILES.map(name => [`${name}.json`, readFileSync(`${input}/${name}.json`)]));
  }
  const manifest = JSON.parse(await download(input, generation, digest));
  if (manifest.schema !== 'blueprint.outreach-release-proof-files.v1' || !Array.isArray(manifest.files)
    || manifest.files.length !== FILES.length) refuse('release_proof_inventory_invalid');
  const result = {};
  for (const name of FILES.map(name => `${name}.json`)) {
    const rows = manifest.files.filter(row => row.name === name);
    if (rows.length !== 1) refuse('release_proof_inventory_invalid');
    const row = rows[0]; result[name] = await download(row.uri, row.generation, row.sha256, row.bytes);
  }
  return result;
}

async function main() {
  const [mode, input, target, directory, generation, digest] = process.argv.slice(2);
  if (mode !== 'release' || !/^[a-f0-9]{40}$/.test(target ?? '')
    || !directory?.startsWith('/tmp/') || resolve(directory) !== directory) refuse('exact_bounded_release_command_required');
  mkdirSync(directory, { mode: 0o700 });
  const { app, db, bucket } = existingAdmin();
  let runId = null, workflowEnabled = false, store, guard;
  const started = Date.now();
  const journal = (stage, value) => privateWrite(`${directory}/${stage}.json`, value);
  const retain = async names => {
    const archive = await archiveFiles(bucket, Object.fromEntries(names.map(name => [`release-${name}.json`, readFileSync(`${directory}/${name}.json`)])));
    await verifyArchive(bucket, archive); return archive;
  };
  try {
    const files = await proofFiles(input, generation, digest, bucket);
    for (const [name, bytes] of Object.entries(files)) writeFileSync(`${directory}/${name}`, bytes, { mode: 0o600, flag: 'wx' });
    const { proof, authority } = boundProof(files);
    checkFence(proof, authority, Date.now());
    const { Store, LeaseChannel } = await packagedLease(directory);
    const owner = `research-release:web-worker-${randomUUID()}`;
    const exactOwnLease = async released => {
      const lease = (await db.doc(CONTROL).get()).data()?.lease;
      if (lease?.owner !== store.owner || lease?.generation !== store.generation
        || (released ? lease.expires_at_ms !== 0 : lease.expires_at_ms <= Date.now())) refuse('release_lease_readback_changed');
      return lease;
    };
    let heldLease;
    const result = await continuousRelease({
      preflight: async () => {
        const [workflow, head, ci, active, variables] = await Promise.all([
          api(`actions/workflows/${WORKFLOW}`), api('commits/main'),
          api(`actions/workflows/ci.yml/runs?head_sha=${target}&status=completed&per_page=20`),
          api('actions/runs?branch=main&per_page=50'),
          api('actions/variables?per_page=100'),
        ]);
        if (workflow.state !== 'disabled_manually' || head.sha !== target
          || !ci.workflow_runs.some(run => run.conclusion === 'success' && run.head_sha === target && run.head_branch === 'main')
          || active.workflow_runs.some(run => run.status !== 'completed' && ['CI', 'Deploy (Render, CI-gated)'].includes(run.name))
          || variables.total_count > 100 || variables.variables.some(row => row.name === 'BLUEPRINT_AUTOMATIC_DEPLOY_ENABLED'
            && row.value !== 'false')) refuse('exact_held_release_preflight_failed');
        journal('preflight', { target, workflowId: workflow.id, workflowState: workflow.state, observedAtMs: Date.now() });
        const archive = await archiveFiles(bucket, files); await verifyArchive(bucket, archive);
        journal('proof-retention', archive);
      },
      releaseIncident: async () => {
        const released = await fenceLease(db, 'release-fence', authority, proof);
        journal('incident-release', released); return released;
      },
      channel: predecessor => {
        journal('acquire-intent', { owner, predecessor, intendedGeneration: predecessor.generation + 1,
          scope: 'research_release', automaticRetryAuthorized: false });
        guard = predecessorGuard(db, predecessor);
        store = new Store(guard.db, Date.now, owner);
        return new LeaseChannel(store);
      },
      acquired: () => guard.acquired(),
      retainAcquireIntent: () => retain(['incident-release', 'acquire-intent']),
      acquireReadback: async () => { heldLease = await exactOwnLease(false); journal(`lease-${Date.now()}`, heldLease); },
      deploy: async assertLease => {
        await assertLease();
        if ((await api('commits/main')).sha !== target) refuse('release_main_changed');
        // Enable only for this one exact dispatch; restore the existing hold
        // immediately. Parent's writer freeze covers this short dispatch window.
        journal('workflow-restoration-intent', { target, workflow: WORKFLOW, restore: 'disabled_manually' });
        await retainOwnedIntent(assertLease, () => retain(['acquire-intent', 'workflow-restoration-intent']));
        workflowEnabled = true;
        await gh(['workflow', 'enable', WORKFLOW, '--repo', REPO]);
        try {
          await assertLease();
          journal('dispatch-intent', { target, token: owner, atMs: Date.now(), retryAuthorized: false });
          await retainOwnedIntent(assertLease, () => retain(['dispatch-intent']));
          try {
            await gh(['workflow', 'run', WORKFLOW, '--repo', REPO, '--ref', 'main',
              '-f', `ref=${target}`, '-f', 'clear_cache=false', '-f', 'release_hold=true', '-f', `release_token=${owner}`]);
          } catch {
            journal('dispatch-ack-unknown', { target, token: owner, automaticRetryAuthorized: false });
          }
        } finally {
          await gh(['workflow', 'disable', WORKFLOW, '--repo', REPO]); workflowEnabled = false;
        }
        const [restored, variables] = await Promise.all([api(`actions/workflows/${WORKFLOW}`), api('actions/variables?per_page=100')]);
        if (restored.state !== 'disabled_manually' || variables.total_count > 100
          || variables.variables.some(row => row.name === 'BLUEPRINT_AUTOMATIC_DEPLOY_ENABLED' && row.value !== 'false')) refuse('release_deploy_hold_not_restored');
        journal('dispatch-submitted', { target, atMs: Date.now(), retryAuthorized: false });
        const discoveryDeadline = Date.now() + 90_000;
        while (Date.now() - started < MAX_RUN_MS) {
          await assertLease();
          if (!runId) {
            const runs = await api(`actions/workflows/${WORKFLOW}/runs?event=workflow_dispatch&head_sha=${target}&per_page=20`);
            const matches = runs.workflow_runs.filter(run => run.head_sha === target && run.display_title === owner
              && Date.parse(run.created_at) >= started - 5000);
            if (matches.length > 1) refuse('release_dispatch_identity_ambiguous');
            if (matches.length === 1) { runId = matches[0].id; journal('workflow-run', matches[0]); }
            if (!runId && Date.now() > discoveryDeadline) refuse('release_dispatch_ack_unresolved');
          }
          if (runId) {
            const run = await api(`actions/runs/${runId}`);
            if (run.status === 'completed') {
              if (run.conclusion !== 'success' || run.run_attempt !== 1 || run.head_sha !== target) refuse('release_deployment_unverified');
              return run;
            }
          }
          await pause(5000);
        }
        refuse('bounded_release_deadline_exceeded');
      },
      verify: async run => {
        const jobs = await api(`actions/runs/${run.id}/jobs?per_page=100`);
        const job = jobs.jobs.find(row => row.name === 'Trigger CI-gated Render deploy');
        const step = job?.steps?.find(row => row.name === HOLD_STEP);
        if (job?.conclusion !== 'success' || step?.conclusion !== 'success') refuse('release_off_readback_missing');
        const version = await fetch('https://tryblueprint.io/version.json', { signal: AbortSignal.timeout(20_000), redirect: 'error' });
        if (!version.ok || (await version.json()).git_sha !== target) refuse('release_public_version_changed');
        journal('deployment-readback', { target, runId: run.id, jobs, observedAtMs: Date.now(), admissionRemainsOff: true });
      },
      releaseReadback: async () => {
        // Store.release clears its local generation; compare the retained value.
        const lease = (await db.doc(CONTROL).get()).data()?.lease;
        if (lease?.owner !== heldLease.owner || lease?.generation !== heldLease.generation || lease?.expires_at_ms !== 0) refuse('release_lease_readback_changed');
        journal('lease-released', lease);
      },
      failed: async (error, acquired) => {
        journal('failed-observe-only', { code: /^[a-z_]+$/.test(error.message) ? error.message : 'release_sequence_unavailable',
          target, runId, acquired, standingAuthority: false, automaticRetryAuthorized: false,
          owner, acknowledgedGeneration: store?.generation ?? null,
          acquireIntent: store ? JSON.parse(readFileSync(`${directory}/acquire-intent.json`)) : null,
          sendsAuthorized: false, paidAdmissionAuthorized: false, workerResumeAuthorized: false });
        if (!runId) {
          const runs = await api(`actions/workflows/${WORKFLOW}/runs?event=workflow_dispatch&head_sha=${target}&per_page=20`).catch(() => null);
          const matches = runs?.workflow_runs?.filter(run => run.head_sha === target && run.display_title === owner) ?? [];
          if (matches.length === 1) { runId = matches[0].id; journal('failed-owned-workflow-readback', matches[0]); }
        }
        if (runId) {
          const run = await api(`actions/runs/${runId}`).catch(() => null);
          if (run && run.status !== 'completed') await gh(['run', 'cancel', String(runId), '--repo', REPO]).catch(() => {});
        }
        await retain(['failed-observe-only', 'acquire-intent']);
      },
    });
    journal('complete', result);
    const retained = await archiveFiles(bucket, Object.fromEntries(['complete', 'deployment-readback', 'lease-released', 'proof-retention']
      .map(name => [`release-${name}.json`, readFileSync(`${directory}/${name}.json`)])));
    await verifyArchive(bucket, retained);
    console.log(JSON.stringify({ ok: true, target, runId, state: result.state, retained,
      sendsAuthorized: false, paidAdmissionAuthorized: false, workerResumeAuthorized: false }));
  } finally {
    if (workflowEnabled) {
      await gh(['workflow', 'disable', WORKFLOW, '--repo', REPO]);
      if ((await api(`actions/workflows/${WORKFLOW}`)).state !== 'disabled_manually') refuse('release_deploy_hold_not_restored');
    }
    await app.delete();
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(error => {
  console.error(JSON.stringify({ ok: false, code: /^[a-z_]+$/.test(error.message) ? error.message : 'release_sequence_unavailable' }));
  process.exitCode = 2;
});
