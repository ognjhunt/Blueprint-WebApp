// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { runIndexOperation, PARENT, FIELDS, verifyManifest, tokenBoundClient, main } from './action-ledger-index-operator.mjs';

const name = `${PARENT}/indexes/synthetic`;
const operation = 'projects/blueprint-8c1ca/databases/(default)/operations/synthetic';
const index = (state: any = 'READY') => ({ name, queryScope: 'COLLECTION', fields: FIELDS.map((x: any) => ({ ...x })), state });
function fake(rows: any[] = []) {
  return {
    listIndexes: vi.fn(async () => [rows, null, {}]),
    getIndex: vi.fn(async () => [index()]),
    createIndex: vi.fn(async () => [{ name: operation }, { name: operation }]),
    getOperation: vi.fn(async () => [{ name: operation, done: true }]),
    deleteIndex: vi.fn(), updateIndex: vi.fn(),
  };
}
function invoke(client: any, mode = 'ensure', extra: any = {}) {
  const events: any[] = [];
  const record = (event: any) => events.push(event);
  return { events, promise: runIndexOperation({ client, mode, record, wait: async () => {}, maxObservations: 2, ...extra }) };
}

describe('fixed action-ledger index operator', () => {
  it('binds its fixed fields to the exact reviewed manifest', () => {
    expect(verifyManifest(readFileSync('firestore.indexes.json'))).toBe(true);
    expect(() => verifyManifest(Buffer.from('{}'))).toThrow('reviewed_manifest_mismatch');
  });
  it('refuses live execution outside the existing worker before credential acquisition', async () => {
    await expect(main(['ensure'], {})).rejects.toThrow('existing_worker_binding_unavailable');
    await expect(main(['ensure', '--project=other'], {})).rejects.toThrow('usage_plan_inspect_or_ensure');
  });
  it('requires durable intent recording to succeed before creating', async () => {
    const c = fake();
    await expect(invoke(c, 'ensure', { record: (event: any) => { if (event.event === 'create-intent') throw Error('synthetic_receipt_disk_full'); } }).promise).rejects.toThrow('synthetic_receipt_disk_full');
    expect(c.createIndex).not.toHaveBeenCalled();
  });
  it('accepts real SDK numeric enum responses and rejects failed target states', async () => {
    const c = fake([{ ...index(1), queryScope: 1, apiScope: 0, fields: FIELDS.map((x: any) => ({ fieldPath: x.fieldPath, order: 1 })) }]);
    c.getIndex.mockResolvedValue([{ ...index(2), queryScope: 1, apiScope: 0, fields: FIELDS.map((x: any) => ({ fieldPath: x.fieldPath, order: 1 })) }]);
    expect(await invoke(c).promise).toMatchObject({ ready: true });
    c.getIndex.mockResolvedValue([index('NEEDS_REPAIR')]);
    await expect(invoke(c).promise).rejects.toThrow('index_state_requires_investigation');
    expect(c.createIndex).not.toHaveBeenCalled();
  });
  it('rejects duplicate exact indexes without a create', async () => {
    const c = fake([index(), { ...index(), name: `${PARENT}/indexes/second` }]);
    await expect(invoke(c).promise).rejects.toThrow('duplicate_target_index');
    expect(c.createIndex).not.toHaveBeenCalled();
  });
  it('handles the observed36-row mixed-collection page and evaluates only the exact target parent', async () => {
    const others = Array.from({ length: 35 }, (_, i) => ({
      name: `projects/blueprint-8c1ca/databases/(default)/collectionGroups/other_${i}/indexes/index-${String(i).padStart(6, '0')}`,
      get queryScope() { throw Error('unrelated_scope_must_not_be_evaluated'); },
      get fields() { throw Error('unrelated_fields_must_not_be_evaluated'); },
      get state() { throw Error('unrelated_state_must_not_be_evaluated'); },
    }));
    const c = fake([...others, index()]), run = invoke(c, 'inspect');
    expect(await run.promise).toMatchObject({ ready: true, indexName: name });
    expect(run.events.find(row => row.event === 'inventory-complete')).toMatchObject({ count: 36, pages: 1, targetCount: 1 });
    expect(c.getIndex).toHaveBeenCalledTimes(1); expect(c.getIndex).toHaveBeenCalledWith({ name }, expect.anything());
    expect(c.createIndex).not.toHaveBeenCalled(); expect(c.deleteIndex).not.toHaveBeenCalled(); expect(c.updateIndex).not.toHaveBeenCalled();
  });
  it('never qualifies identical fields/state from another collection as an action_ledger match', async () => {
    const c = fake([{ ...index(), name: name.replace('/action_ledger/', '/action_ledger_extra/') }]);
    const run = invoke(c, 'inspect'); expect(await run.promise).toMatchObject({ ready: false, state: 'ABSENT', indexName: null });
    expect(run.events.find(row => row.event === 'inventory-complete')).toMatchObject({ count: 1, targetCount: 0 });
    expect(c.getIndex).not.toHaveBeenCalled(); expect(c.createIndex).not.toHaveBeenCalled();
  });
  it('finishes mixed-collection pagination before evaluating the later exact target', async () => {
    const c = fake();
    c.listIndexes.mockResolvedValueOnce([[{ ...index(), name: name.replace('/action_ledger/', '/other/') }], null, { nextPageToken: 'next' }])
      .mockResolvedValueOnce([[index()], null, {}]);
    expect(await invoke(c, 'inspect').promise).toMatchObject({ ready: true });
    expect(c.listIndexes).toHaveBeenCalledTimes(2); expect(c.getIndex).toHaveBeenCalledTimes(1); expect(c.createIndex).not.toHaveBeenCalled();
  });
  it('rejects duplicate exact targets within mixed collection inventory without a get or write', async () => {
    const c = fake([{ ...index(), name: name.replace('/action_ledger/', '/other/') }, index(), { ...index(), name: `${PARENT}/indexes/second` }]);
    await expect(invoke(c).promise).rejects.toThrow('duplicate_target_index');
    expect(c.getIndex).not.toHaveBeenCalled(); expect(c.createIndex).not.toHaveBeenCalled();
  });
  it.each([
    name.replace('/(default)/', '/other-db/'), name.replace('/blueprint-8c1ca/', '/other-project/'),
    name.replace('/collectionGroups/', '/wrong-marker/'), name.replace('/action_ledger/', '//'), name + '/extra',
    name.replace('/indexes/', '/fields/'), name.replace('/action_ledger/', '/./'), name.replace('/action_ledger/', '/../'),
  ])('rejects foreign database/project or malformed resource before absence/get/write: %s', invalidName => {
    const c = fake([{ ...index(), name: invalidName }]); const run = invoke(c, 'inspect');
    expect(c.getIndex).not.toHaveBeenCalled();
    return expect(run.promise).rejects.toThrow('index_inventory_scope_invalid').then(() => {
      expect(run.events.some(row => row.event === 'inventory-complete')).toBe(false); expect(c.createIndex).not.toHaveBeenCalled();
    });
  });
  it('inspects absence without a create', async () => {
    const c = fake(); const r = invoke(c, 'inspect');
    expect(await r.promise).toMatchObject({ ready: false, state: 'ABSENT' });
    expect(c.createIndex).not.toHaveBeenCalled();
  });
  it('requires exact getIndex READY even when listed READY', async () => {
    const c = fake([index()]); c.getIndex.mockResolvedValue([index('CREATING')]);
    expect(await invoke(c).promise).toMatchObject({ ready: false, state: 'CREATING' });
    expect(c.createIndex).not.toHaveBeenCalled();
  });
  it('uses an existing exact READY index without a create', async () => {
    const c = fake([index()]);
    expect(await invoke(c).promise).toMatchObject({ ready: true, indexName: name });
    expect(c.getIndex).toHaveBeenCalledWith({ name }, expect.objectContaining({ retry: null, timeout: 10000 }));
    expect(c.createIndex).not.toHaveBeenCalled();
  });
  it('creates once after complete absence then independently reads operation and READY', async () => {
    const c = fake(); c.listIndexes.mockResolvedValueOnce([[], null, {}]).mockResolvedValue([[index()], null, {}]);
    const r = invoke(c); expect(await r.promise).toMatchObject({ ready: true, operationName: operation });
    expect(c.createIndex).toHaveBeenCalledTimes(1);
    expect(c.createIndex).toHaveBeenCalledWith({ parent: PARENT, index: { queryScope: 'COLLECTION', fields: FIELDS } }, expect.objectContaining({ retry: null, timeout: 10000 }));
    expect(c.getOperation).toHaveBeenCalled();
    expect(r.events.findIndex(x => x.event === 'create-intent')).toBeLessThan(r.events.findIndex(x => x.event === 'create-acknowledged'));
    expect(c.deleteIndex).not.toHaveBeenCalled(); expect(c.updateIndex).not.toHaveBeenCalled();
  });
  it('finishes bounded pagination before creating and finds a later-page match', async () => {
    const c = fake(); c.listIndexes.mockResolvedValueOnce([[], { pageToken: 'next' }, { nextPageToken: 'next' }]).mockResolvedValue([[index()], null, {}]);
    expect(await invoke(c).promise).toMatchObject({ ready: true });
    expect(c.listIndexes.mock.calls[1][0]).toMatchObject({ parent: PARENT, pageToken: 'next' });
    expect(c.listIndexes.mock.calls[0][1]).toMatchObject({ autoPaginate: false, retry: null });
    expect(c.listIndexes.mock.calls.every(call => !Object.hasOwn(call[0], 'pageSize'))).toBe(true);
    expect(c.createIndex).not.toHaveBeenCalled();
  });
  it.each(['ready', 'absent', 'pagination', 'oversized', 'create-denied', 'mixed', 'mixed-pagination'])('uses the real installed SDK default-page wire contract: %s', async scenario => {
    const require = createRequire(import.meta.url), sdkRequire = createRequire(require.resolve('@google-cloud/firestore'));
    // The whole test suite may have loaded GAX before this fixture.
    sdkRequire('google-gax/build/src/fallbackServiceStub');
    const fetchPath = sdkRequire.resolve('node-fetch'), fetchExport = require(fetchPath), originalDefault = fetchExport.default;
    const originalExport = require.cache[fetchPath].exports;
    const { runWireScenario } = await import('./fixtures/action-ledger-index-list-wire.mjs');
    const receipt = await runWireScenario(scenario);
    expect(receipt.scenario).toBe(scenario);
    expect(receipt.calls.filter(call => call.path.endsWith('/indexes')).every(call => call.pageSize === null)).toBe(true);
    expect(require.cache[fetchPath].exports).toBe(originalExport);
    expect(fetchExport.default).toBe(originalDefault);
  });
  it('refuses pagination loops without creating', async () => {
    const c = fake(); c.listIndexes.mockResolvedValue([[], { pageToken: 'same' }, { nextPageToken: 'same' }]);
    await expect(invoke(c).promise).rejects.toThrow('index_inventory_pagination_invalid');
    expect(c.createIndex).not.toHaveBeenCalled();
  });
  it('refuses truncated inventory without creating', async () => {
    const c = fake(); let n = 0; c.listIndexes.mockImplementation(async () => [[], { pageToken: `next${n++}` }, { nextPageToken: `next${n}` }]);
    await expect(invoke(c).promise).rejects.toThrow('index_inventory_limit');
    expect(c.createIndex).not.toHaveBeenCalled();
  });
  it.each([
    { queryScope: 'COLLECTION_GROUP' }, { fields: FIELDS.slice().reverse() },
    { fields: [...FIELDS.slice(0, 3), { fieldPath: '__name__', order: 'DESCENDING' }] },
    { apiScope: 'DATASTORE_MODE_API' },
  ])('never treats different scope/order/API as the target: %j', async change => {
    const c = fake([{ ...index(), ...change }]);
    expect(await invoke(c, 'inspect').promise).toMatchObject({ ready: false, state: 'ABSENT' });
  });
  it('rejects cross-project index names before any mutation', async () => {
    const c = fake([{ ...index(), name: name.replace('blueprint-8c1ca', 'other-project') }]);
    await expect(invoke(c).promise).rejects.toThrow('index_inventory_scope_invalid');
    expect(c.createIndex).not.toHaveBeenCalled();
  });
  it('reports create permission denial without changing IAM or retrying', async () => {
    const c = fake(); c.createIndex.mockRejectedValue({ code: 7, message: 'SECRET-DO-NOT-PRINT' });
    const r = invoke(c);
    await expect(r.promise).rejects.toMatchObject({ message: 'index_api_permission_denied', permission: 'datastore.indexes.create', stage: 'create' });
    expect(c.createIndex).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(r.events)).not.toContain('SECRET-DO-NOT-PRINT');
  });
  it('records unknown acknowledgement, does not retry create, and permits only readback', async () => {
    const c = fake(); c.createIndex.mockRejectedValue({ code: 4 });
    const r = invoke(c); expect(await r.promise).toMatchObject({ ready: false, acknowledgement: 'UNKNOWN' });
    expect(c.createIndex).toHaveBeenCalledTimes(1);
    expect(r.events.some(x => x.event === 'create-acknowledgement-unknown')).toBe(true);
  });
  it('recovers an already-exists race through readback without another create', async () => {
    const c = fake(); c.createIndex.mockRejectedValue({ code: 6 });
    c.listIndexes.mockResolvedValueOnce([[], null, {}]).mockResolvedValue([[index()], null, {}]);
    expect(await invoke(c).promise).toMatchObject({ ready: true, acknowledgement: 'ALREADY_EXISTS' });
    expect(c.createIndex).toHaveBeenCalledTimes(1);
  });
  it('never claims pending operation alone means READY', async () => {
    const c = fake(); c.getOperation.mockResolvedValue([{ name: operation, done: false }]);
    expect(await invoke(c).promise).toMatchObject({ ready: false, state: 'NOT_OBSERVED' });
    expect(c.createIndex).toHaveBeenCalledTimes(1);
  });
  it('stops on operation failure without rebuilding or deleting', async () => {
    const c = fake(); c.getOperation.mockResolvedValue([{ name: operation, done: true, error: { code: 9, message: 'private' } }]);
    await expect(invoke(c).promise).rejects.toThrow('index_operation_failed');
    expect(c.createIndex).toHaveBeenCalledTimes(1); expect(c.deleteIndex).not.toHaveBeenCalled();
  });
  it('refuses changed exact readback instead of claiming success', async () => {
    const c = fake([index()]); c.getIndex.mockResolvedValue([{ ...index(), queryScope: 'COLLECTION_GROUP' }]);
    await expect(invoke(c).promise).rejects.toThrow('index_readback_mismatch');
  });
  it('replays a pending index read-only and only claims final READY', async () => {
    const c = fake([index('CREATING')]); c.getIndex.mockResolvedValueOnce([index('CREATING')]).mockResolvedValue([index()]);
    expect(await invoke(c).promise).toMatchObject({ ready: true });
    expect(c.createIndex).not.toHaveBeenCalled();
  });
  it('uses the real installed SDK with exactly the supplied access-token client', async () => {
    const require = createRequire(`${process.cwd()}/package.json`);
    const { client, authClient } = tokenBoundClient(require, { access_token: 'synthetic-not-a-token', expires_in: 3600 });
    try {
      expect(await client.auth.getClient()).toBe(authClient);
      expect(authClient.credentials.access_token).toBe('synthetic-not-a-token');
      expect(authClient.credentials.refresh_token).toBeUndefined();
      expect(authClient.forceRefreshOnFailure).toBe(false);
      expect(client._opts.fallback).toBe(true);
    } finally { await client.close(); }
  });
});
