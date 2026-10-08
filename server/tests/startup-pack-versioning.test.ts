// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sharedFakeFirestore, sharedFakeFirestoreState } from './helpers/fake-firestore';
vi.mock('../../client/src/lib/firebaseAdmin', async () => {
  const { sharedFakeFirestore } = await import('./helpers/fake-firestore');
  return { dbAdmin:sharedFakeFirestore, default:{firestore:{FieldValue:{serverTimestamp:()=> '2026-10-08T00:00:00Z'}}} };
});
// Context resolution is real; these enrichment ports must not invoke providers.
vi.mock('../retrieval/embeddings', () => ({embedTexts:vi.fn(() => {throw Error('paid_call_forbidden')})}));
vi.mock('../retrieval/venueIndexer', () => ({searchVenue:vi.fn(() => {throw Error('paid_call_forbidden')})}));
vi.mock('../agents/ops-documents', () => ({getOpsDocumentsByIds: async()=>[], listOpsDocuments:async()=>[]}));
import { createStartupPack, updateStartupPack, getStartupPack } from '../agents/startup-packs';
import { resolveStartupContext } from '../agents/knowledge';
beforeEach(()=>sharedFakeFirestoreState.docs.clear());
describe('live versioned prompt context', () => {
  it('next resolution sees an update and rollback without rebuilding or provider calls', async () => {
    const pack = await createStartupPack({name:'Instructions',operator_notes:'Use concise copy.'});
    await expect(updateStartupPack(pack.id,{operator_notes:"unguarded"})).rejects.toThrow("expected_version_required_for_prompt_update");
    const read = () => resolveStartupContext({startupContext:{startupPackIds:[pack.id]}});
    expect((await read()).operator_notes).toContain('Use concise copy.');
    await updateStartupPack(pack.id,{operator_notes:'Use detailed copy.',expected_version:1});
    expect((await read()).operator_notes).toContain('Use detailed copy.');
    expect((await read()).attached_startup_packs[0].version).toBe(2);
    await expect(updateStartupPack(pack.id,{operator_notes:'stale',expected_version:1})).rejects.toThrow('startup_pack_version_conflict');
    const previous = await getStartupPack(pack.id,1);
    await updateStartupPack(pack.id,{operator_notes:previous!.operator_notes,expected_version:2});
    expect((await read()).operator_notes).toContain('Use concise copy.');
    expect((await getStartupPack(pack.id,2))?.operator_notes).toBe('Use detailed copy.');
    expect((await read()).attached_startup_packs[0].version).toBe(3);
  });
  it('failed transaction publishes neither current nor history', async () => {
    const pack = await createStartupPack({name:'Instructions',operator_notes:'before'});
    const spy = vi.spyOn(sharedFakeFirestore,'runTransaction').mockRejectedValueOnce(Error('store_failed'));
    await expect(updateStartupPack(pack.id,{operator_notes:'after',expected_version:1})).rejects.toThrow('store_failed');
    spy.mockRestore();
    expect((await getStartupPack(pack.id))?.version).toBe(1);
    expect(await getStartupPack(pack.id,2)).toBeNull();
  });
});
