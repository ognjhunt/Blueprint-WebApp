// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { runIndexOperation, PARENT, FIELDS, verifyManifest, main } from './job-evidence-index-operator.mjs';

const name = `${PARENT}/indexes/synthetic`;
const operation = 'projects/blueprint-8c1ca/databases/(default)/operations/synthetic';
const index = (state: string | number = 'READY') => ({ name, queryScope: 'COLLECTION', fields: FIELDS.map((x: any) => ({ ...x })), state });
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
  return { events, promise: runIndexOperation({ client, mode, record: (event: any) => events.push(event),
    wait: async () => {}, maxObservations: 2, ...extra }) };
}

describe('fixed job-evidence index operator', () => {
  it('pins the reviewed manifest and required descending document-name order', () => {
    expect(verifyManifest(readFileSync(new URL('./fixtures/job-evidence-index-reviewed-firestore.indexes.json', import.meta.url)))).toBe(true);
    expect(FIELDS).toEqual([
      { fieldPath: 'job_evidence_binding.job_id', order: 'ASCENDING' },
      { fieldPath: 'created_at_iso', order: 'DESCENDING' },
      { fieldPath: '__name__', order: 'DESCENDING' },
    ]);
    expect(() => verifyManifest(Buffer.from('{}'))).toThrow('reviewed_manifest_mismatch');
  });
  it('refuses a live operation outside the existing worker before acquiring credentials', async () => {
    await expect(main(['ensure'], {})).rejects.toThrow('existing_worker_binding_unavailable');
    await expect(main(['ensure', '--project=other'], {})).rejects.toThrow('usage_plan_inspect_or_ensure');
  });
  it('inspects absence without any write', async () => {
    const c = fake();
    expect(await invoke(c, 'inspect').promise).toMatchObject({ ready: false, state: 'ABSENT' });
    expect(c.createIndex).not.toHaveBeenCalled();
  });
  it('reuses an exact READY index including numeric SDK orders without a create', async () => {
    const numeric = { ...index(2), queryScope: 1, fields: FIELDS.map(field => ({ fieldPath: field.fieldPath,
      order: field.order === 'ASCENDING' ? 1 : 2 })) };
    const c = fake([numeric]); c.getIndex.mockResolvedValue([numeric]);
    expect(await invoke(c).promise).toMatchObject({ ready: true, indexName: name });
    expect(c.createIndex).not.toHaveBeenCalled();
  });
  it('creates only after durable intent and complete paginated absence, then requires READY readback', async () => {
    const c = fake();
    c.listIndexes.mockResolvedValueOnce([[], null, { nextPageToken: 'next' }])
      .mockResolvedValueOnce([[], null, {}]).mockResolvedValue([[index()], null, {}]);
    const run = invoke(c);
    expect(await run.promise).toMatchObject({ ready: true, operationName: operation });
    expect(c.createIndex).toHaveBeenCalledTimes(1);
    expect(c.createIndex).toHaveBeenCalledWith({ parent: PARENT, index: { queryScope: 'COLLECTION', fields: FIELDS } },
      expect.objectContaining({ retry: null, timeout: 10000 }));
    expect(run.events.findIndex(row => row.event === 'inventory-complete')).toBeLessThan(run.events.findIndex(row => row.event === 'create-intent'));
    expect(run.events.findIndex(row => row.event === 'create-intent')).toBeLessThan(run.events.findIndex(row => row.event === 'create-acknowledged'));
    expect(c.getOperation).toHaveBeenCalled(); expect(c.getIndex).toHaveBeenCalled();
    expect(c.deleteIndex).not.toHaveBeenCalled(); expect(c.updateIndex).not.toHaveBeenCalled();
  });
  it('does not create when durable intent recording fails', async () => {
    const c = fake();
    await expect(invoke(c, 'ensure', { record: (row: any) => { if (row.event === 'create-intent') throw Error('receipt_failed'); } }).promise).rejects.toThrow('receipt_failed');
    expect(c.createIndex).not.toHaveBeenCalled();
  });
  it.each([
    { queryScope: 'COLLECTION_GROUP' },
    { fields: FIELDS.map(field => ({ ...field, order: 'ASCENDING' })) },
    { fields: FIELDS.slice().reverse() },
  ])('does not qualify another query scope or order as the target: %j', async change => {
    const c = fake([{ ...index(), ...change }]);
    expect(await invoke(c, 'inspect').promise).toMatchObject({ ready: false, state: 'ABSENT' });
    expect(c.createIndex).not.toHaveBeenCalled();
  });
  it('refuses changed independent readback instead of claiming READY', async () => {
    const c = fake([index()]);
    c.getIndex.mockResolvedValue([{ ...index(), fields: FIELDS.map(field => ({ ...field, order: 'ASCENDING' })) }]);
    await expect(invoke(c).promise).rejects.toThrow('index_readback_mismatch');
    expect(c.createIndex).not.toHaveBeenCalled();
  });
  it('refuses foreign resources and incomplete target definitions before creating', async () => {
    for (const row of [{ ...index(), name: name.replace('blueprint-8c1ca', 'other-project') }, { ...index(), fields: [] }]) {
      const c = fake([row]);
      await expect(invoke(c).promise).rejects.toThrow();
      expect(c.createIndex).not.toHaveBeenCalled();
    }
  });
  it('reconciles unknown create acknowledgement read-only without purchasing another operation', async () => {
    const c = fake(); c.createIndex.mockRejectedValue({ code: 4 });
    const run = invoke(c);
    expect(await run.promise).toMatchObject({ ready: false, acknowledgement: 'UNKNOWN' });
    expect(c.createIndex).toHaveBeenCalledTimes(1);
    expect(run.events.some(row => row.event === 'create-acknowledgement-unknown')).toBe(true);
  });
  it('keeps a pending index pending and redacts denied API details', async () => {
    const pending = fake([index('CREATING')]); pending.getIndex.mockResolvedValue([index('CREATING')]);
    expect(await invoke(pending).promise).toMatchObject({ ready: false, state: 'CREATING' });
    const denied = fake(); denied.createIndex.mockRejectedValue({ code: 7, message: 'private-provider-error' });
    const run = invoke(denied);
    await expect(run.promise).rejects.toMatchObject({ message: 'index_api_permission_denied', permission: 'datastore.indexes.create' });
    expect(denied.createIndex).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(run.events)).not.toContain('private-provider-error');
  });
});
