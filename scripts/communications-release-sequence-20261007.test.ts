import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { sha, CONTROL, LAP } from './communications-incident-20261006.mjs';
import { boundProof, continuousRelease, packagedLease, predecessorGuard, retainOwnedIntent } from './communications-release-sequence-20261007.mjs';

let directory: string, Store: any, LeaseChannel: any;
beforeAll(async () => {
  directory = mkdtempSync(join(tmpdir(), 'outreach-release-test-'));
  // Native module loading avoids Vite's outside-workspace transform sandbox.
  ({ Store, LeaseChannel } = await packagedLease(directory, (path: string) => createRequire(import.meta.url)(fileURLToPath(path))));
});
afterAll(() => rmSync(directory, { recursive: true, force: true }));

function fixture() {
  let clock = 1791345600000, heartbeat: (() => void) | null = null;
  const predecessor = { owner: 'research-release:incident-synthetic', generation: 6696, expires_at_ms: 0 };
  const docs: any = {
    [CONTROL]: { lease: { ...predecessor } },
    [LAP]: { schema_version: 'blueprint.communications-worker-lap.v1', phase: 'complete',
      lease: { owner: 'communications-worker-lap:synthetic', generation: 259, until: 0 },
      startedAt: clock - 1000, renewedAt: clock - 1000, completedAt: clock - 1 },
  };
  const writes: any[] = [];
  let failAck = false;
  const db: any = {
    doc: (path: string) => ({ path, get: async () => snapshot(path) }),
    runTransaction: async (fn: any) => {
      const pending: any[] = [];
      const result = await fn({ get: async (ref: any) => snapshot(ref.path),
        set: (ref: any, value: any) => pending.push([ref.path, structuredClone(value)]) });
      for (const [path, value] of pending) { docs[path] = { ...docs[path], ...value }; writes.push(value); }
      if (failAck) { failAck = false; throw Error('synthetic_commit_ack_lost'); }
      return result;
    },
  };
  const snapshot = (path: string) => ({ exists: !!docs[path], data: () => structuredClone(docs[path]) });
  const guard = predecessorGuard(db, predecessor);
  const store = new Store(guard.db, () => clock, 'research-release:synthetic-controller');
  const channel = new LeaseChannel(store, {
    setIntervalImpl: (fn: () => void, ms: number) => { expect(ms).toBe(20000); heartbeat = fn; return fn; },
    clearIntervalImpl: () => { heartbeat = null; },
  });
  let deployed = 0, failed = 0, released = false;
  const steps: any = {
    preflight: async () => {},
    releaseIncident: async () => ({ state: 'release-fence', lease: predecessor }),
    channel: () => channel,
    acquired: () => guard.acquired(),
    acquireReadback: async () => { expect(docs[CONTROL].lease.owner).toBe(store.owner); },
    deploy: async () => { deployed++; return { id: 1 }; },
    verify: async () => {},
    releaseReadback: async () => {
      expect(docs[CONTROL].lease).toMatchObject({ owner: 'research-release:synthetic-controller', generation: 6697, expires_at_ms: 0 });
      released = true;
    },
    failed: async () => { failed++; },
  };
  return { docs, db, predecessor, store, channel, steps, writes,
    advance: (ms: number) => { clock += ms; }, tick: async () => { heartbeat?.(); await channel.tail; },
    loseAck: () => { failAck = true; }, status: () => ({ deployed, failed, released, heartbeat }) };
}

describe('real packaged canonical release lease consumer', () => {
  it('renews across a deployment longer than the original incident TTL and releases after verification', async () => {
    const f = fixture();
    f.steps.deploy = async (assert: any) => {
      for (let i = 0; i < 20; i++) { f.advance(20000); await f.tick(); await assert(); }
      expect(f.store.generation).toBe(6697);
      expect(f.docs[CONTROL].lease.expires_at_ms).toBeGreaterThan(1791346000000);
      return { id: 123 };
    };
    const result = await continuousRelease(f.steps);
    expect(result.state).toBe('deployed_and_release_lease_released');
    expect(result.workerResumeAuthorized).toBe(false);
    expect(f.writes).toHaveLength(22); // one acquire, twenty real renewals, one release
    expect(f.status()).toMatchObject({ failed: 0, released: true, heartbeat: null });
  });

  it.each([0, 1791345700000])('rejects an intervening successor even with expiry %s', async expiry => {
    const f = fixture();
    f.docs[CONTROL].lease = { owner: 'research-release:successor', generation: 6697, expires_at_ms: expiry };
    await expect(continuousRelease(f.steps)).rejects.toThrow('release_predecessor_changed');
    expect(f.writes).toHaveLength(0);
    expect(f.status()).toMatchObject({ deployed: 0, failed: 1, heartbeat: null });
  });

  it('retains unfinished lap ownership rather than treating expiry as drain', async () => {
    const f = fixture(); f.docs[LAP].phase = 'active';
    await expect(continuousRelease(f.steps)).rejects.toThrow('communications_worker_lap_active');
    expect(f.writes).toHaveLength(0);
    expect(f.status().deployed).toBe(0);
  });

  it('does not retry an ambiguous acquire ACK or start deployment', async () => {
    const f = fixture(); f.loseAck();
    await expect(continuousRelease(f.steps)).rejects.toThrow('synthetic_commit_ack_lost');
    expect(f.writes).toHaveLength(1);
    expect(f.docs[CONTROL].lease.generation).toBe(6697);
    expect(f.status()).toMatchObject({ deployed: 0, failed: 1, released: false, heartbeat: null });
  });

  it('awaits a delayed acquisition ACK and cannot start a heartbeat after cleanup', async () => {
    const f = fixture(), original = f.db.runTransaction;
    let acknowledge: (() => void) | null = null, first = true;
    f.db.runTransaction = async (...args: any[]) => {
      const value = await original(...args);
      if (first) { first = false; await new Promise<void>(resolve => { acknowledge = resolve; }); }
      return value;
    };
    const completion = continuousRelease(f.steps);
    while (!acknowledge) await new Promise(resolve => setTimeout(resolve, 0));
    expect(f.status()).toMatchObject({ deployed: 0, heartbeat: null, released: false });
    acknowledge!();
    await completion;
    expect(f.status()).toMatchObject({ heartbeat: null, released: true });
  });

  it('stops after lost heartbeat and never releases a successor', async () => {
    const f = fixture();
    f.steps.deploy = async (assert: any) => {
      f.docs[CONTROL].lease = { owner: 'research-release:successor', generation: 6698, expires_at_ms: 0 };
      f.advance(20000); await f.tick();
      await expect(assert()).rejects.toThrow('firestore_lease_lost');
      return { id: 123 };
    };
    await expect(continuousRelease(f.steps)).rejects.toThrow('firestore_lease_lost');
    expect(f.writes).toHaveLength(1);
    expect(f.docs[CONTROL].lease.owner).toBe('research-release:successor');
    expect(f.status().released).toBe(false);
  });

  it('retains lease on unverified deployment and stops renewal without replaying recovery', async () => {
    const f = fixture(); f.steps.verify = async () => { throw Error('release_off_readback_missing'); };
    await expect(continuousRelease(f.steps)).rejects.toThrow('release_off_readback_missing');
    expect(f.writes).toHaveLength(1);
    expect(f.docs[CONTROL].lease.expires_at_ms).toBeGreaterThan(0);
    expect(f.status()).toMatchObject({ failed: 1, released: false, heartbeat: null });
  });

  it('admits zero dispatches when intent retention loses lease ownership', async () => {
    const f = fixture(); let dispatches = 0;
    f.steps.deploy = async (assert: any) => {
      await retainOwnedIntent(assert, async () => {
        f.docs[CONTROL].lease = { owner: 'research-release:successor', generation: 6698, expires_at_ms: 0 };
      });
      dispatches++;
      return { id: 123 };
    };
    await expect(continuousRelease(f.steps)).rejects.toThrow('firestore_lease_lost');
    expect(dispatches).toBe(0);
    expect(f.docs[CONTROL].lease.owner).toBe('research-release:successor');
  });

  it('never calls normal acquisition when exact incident release was refused', async () => {
    const f = fixture(); f.steps.releaseIncident = async () => { throw Error('release_fence_ownership_changed'); };
    await expect(continuousRelease(f.steps)).rejects.toThrow('release_fence_ownership_changed');
    expect(f.writes).toHaveLength(0); expect(f.status().deployed).toBe(0);
  });
});

describe('private proof byte bindings and real deployment hold consumer', () => {
  it('preserves missing/unknown context and refuses altered retained proof bytes', () => {
    const canonical = Buffer.from('{}\n'), proof = Buffer.from('{"unknown":null}\n');
    const provider = Buffer.from(JSON.stringify({ canonicalFileSha256: sha(canonical) }));
    const authority = Buffer.from(JSON.stringify({ canonicalFileSha256: sha(canonical),
      providerFileSha256: sha(provider), processProofFileSha256: sha(proof) }));
    const files = { 'canonical.json': canonical, 'provider.json': provider,
      'process-proof.json': proof, 'authority.json': authority };
    expect(boundProof(files).proof.unknown).toBeNull();
    expect(() => boundProof({ ...files, 'process-proof.json': Buffer.from('{}') })).toThrow('owner_packet_file_binding_changed');
  });

  const workflow = readFileSync('.github/workflows/deploy.yml', 'utf8');
  const node = workflow.split("cat > /tmp/outreach-release-holds.mjs <<'NODE'\n")[1].split('          NODE')[0];
  async function holdConsumer(change: (key: string, row: any) => any = (_key, row) => row, env: any = {}, recipeChange: any = (row: any) => row) {
    const writes: string[] = [], calls: string[] = [];
    const source = node.replace(/          /g, '').replace(/import \{[^\n]+\} from 'node:fs';\n/, '');
    await runInNewContext(`(async () => {${source}})()`, {
      process: { env: { RENDER_API_KEY: 'synthetic', RENDER_SERVICE_ID: 'srv-d4vnmk3e5dus73aiohk0',
        RENDER_WORKER_SERVICE_ID: 'srv-d9t8gg1t0dsc73am9q70', ...env }, argv: ['node', 'synthetic', 'after'] },
      AbortSignal: { timeout: () => null },
      fetch: async (url: string, options: any) => {
        expect(options.redirect).toBe('error'); calls.push(url);
        const key = url.split('/').at(-1)!;
        if (key.startsWith('srv-')) {
          const worker = key === 'srv-d9t8gg1t0dsc73am9q70';
          return { status: 200, json: async () => recipeChange({ id: key, type: worker ? 'background_worker' : 'web_service',
            serviceDetails: { envSpecificDetails: { startCommand: worker ? 'npm run start:worker' : 'npm run start' } },
            autoDeploy: 'no', branch: 'main' }) };
        }
        const row = change(key, { key, value: ['BLUEPRINT_DISABLE_LOCAL_ENV_BOOTSTRAP', 'BLUEPRINT_TASK_EVALUATION_LAUNCH_FORWARD_ONLY_WORKER'].includes(key)
          ? 'true' : key === 'NODE_OPTIONS' ? '' : 'false' });
        return { status: row === null ? 404 : 200, json: async () => row };
      },
      mkdirSync: () => {}, writeFileSync: (_path: string, bytes: string) => writes.push(bytes),
    });
    return { writes, calls };
  }
  it('real workflow verifies fixed authenticated OFF flags and bootstrap skip on both services', async () => {
    const { calls, writes } = await holdConsumer();
    expect(calls).toHaveLength(10);
    expect(JSON.parse(writes[0]).sendsAuthorized).toBe(false);
    expect(workflow.indexOf('Verify outreach release holds before deploying')).toBeLessThan(workflow.indexOf('Trigger exact-SHA Render deploy through API'));
    expect(workflow).toContain("vars.BLUEPRINT_AUTOMATIC_DEPLOY_ENABLED == 'true'");
  });
  it.each(['BLUEPRINT_DAILY_RESEARCH_WORKER_ENABLED', 'BLUEPRINT_COMMUNICATIONS_WORKER_ENABLED',
    'BLUEPRINT_RUN_OPS_AUTOMATION_IN_WEB', 'BLUEPRINT_DISABLE_LOCAL_ENV_BOOTSTRAP',
    'BLUEPRINT_TASK_EVALUATION_LAUNCH_FORWARD_ONLY_WORKER', 'NODE_OPTIONS'])('blocks changed effective hold input %s', async key => {
    await expect(holdConsumer((current, row) => current === key ? { ...row, value: row.value === 'true' ? 'false' : 'true' } : row))
      .rejects.toThrow('outreach_release_hold_changed');
  });
  it('accepts only the supported absent Web escape hatch, not missing worker flags or bootstrap skip', async () => {
    await expect(holdConsumer((key, row) => key === 'BLUEPRINT_RUN_OPS_AUTOMATION_IN_WEB' ? null : row)).resolves.toBeDefined();
    await expect(holdConsumer((key, row) => key === 'BLUEPRINT_COMMUNICATIONS_WORKER_ENABLED' ? null : row)).rejects.toThrow('outreach_release_hold_changed');
  });
  it('refuses a different valid service binding before issuing any reads', async () => {
    await expect(holdConsumer(undefined, { RENDER_WORKER_SERVICE_ID: 'srv-synthetic-successor' })).rejects.toThrow('outreach_release_service_binding_changed');
  });
  it('rejects a changed effective start command or Render auto deploy', async () => {
    await expect(holdConsumer(undefined, {}, (row: any) => ({ ...row, autoDeploy: 'yes' }))).rejects.toThrow('outreach_release_recipe_changed');
    await expect(holdConsumer(undefined, {}, (row: any) => ({ ...row,
      serviceDetails: { envSpecificDetails: { startCommand: 'node --require synthetic dist/worker.js' } } }))).rejects.toThrow('outreach_release_recipe_changed');
  });
});

describe('native proof preparation source boundary (offline)', () => {
  it('rejects altered native helper bytes before initializing any credential or provider client', async () => {
    const root = mkdtempSync(join(tmpdir(), 'outreach-native-source-'));
    try {
      mkdirSync(`${root}/scripts`);
      writeFileSync(`${root}/scripts/communications-incident-20261006.mjs`, 'synthetic altered bytes');
      await expect(promisify(execFile)(process.execPath, ['scripts/communications-release-native-proof-20261007.mjs', root,
        'gs://blueprint-8c1ca.appspot.com/operations/communications/incident-20261006/synthetic', '1', '0'.repeat(64), `${root}/output`],
      { env: { PATH: process.env.PATH, FIREBASE_SERVICE_ACCOUNT_JSON: 'synthetic-not-json' }, timeout: 5000 }))
        .rejects.toMatchObject({ stderr: expect.stringContaining('reviewed_native_helper_bytes_changed') });
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
  it('refuses a nonprivate native output before reading source or initializing clients', async () => {
    await expect(promisify(execFile)(process.execPath, ['scripts/communications-release-native-proof-20261007.mjs', '/tmp/synthetic',
      'synthetic', '1', '0'.repeat(64), '/workspace/synthetic-output'],
    { env: { PATH: process.env.PATH, FIREBASE_SERVICE_ACCOUNT_JSON: 'synthetic-not-json' }, timeout: 5000 }))
      .rejects.toMatchObject({ stderr: expect.stringContaining('private_exact_directories_required') });
  });
});
