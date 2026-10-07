// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { diagnose, safeError, boundedResponse, archiveReceipt, PARENT } from './action-ledger-index-diagnostic.mjs';
const token = 'synthetic-existing-access-token';
const response = (body: any, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
describe('read-only index API diagnosis and explicit receipt archival', () => {
  it('preserves parameter detail while excluding known credentials, headers, email and JWT', () => {
    const value = safeError({ code: 3, message: `Unknown query parameter pageSize Bearer ${token} user@example.com`, details: [{ '@type': 'type.googleapis.com/google.rpc.BadRequest', fieldViolations: [{ field: '$alt', description: 'unsupported enum encoding' }], headers: { Authorization: token } }], headers: { token }, config: { token } }, [token]);
    expect(value).toMatchObject({ apiCode: 3, message: 'Unknown query parameter pageSize Bearer [redacted] [redacted-email]' });
    expect(value.details[0].violations[0]).toEqual({ field: '$alt', description: 'unsupported enum encoding' });
    expect(JSON.stringify(value)).not.toContain(token); expect(JSON.stringify(value)).not.toContain('headers');
  });
  it('bounds messages, details and response bytes', async () => {
    expect(safeError({ message: 'x '.repeat(1000) }).message.length).toBeLessThanOrEqual(512);
    await expect(boundedResponse(new Response('x'.repeat(65537)))).rejects.toThrow('response_size_limit');
  });
  it('makes exactly one same-parent documented GET after code3 and never a create', async () => {
    const client = { listIndexes: vi.fn().mockRejectedValue({ code: 3, message: 'bad parameter' }), createIndex: vi.fn() };
    const fetcher = vi.fn(async () => response({ indexes: [], nextPageToken: 'next' })); const rows: any[] = [];
    await diagnose({ client, token, fetcher, record: (x: any) => rows.push(x) });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toBe(`https://firestore.googleapis.com/v1/${PARENT}/indexes?pageSize=100`);
    expect(options).toMatchObject({ method: 'GET', redirect: 'error', headers: { Authorization: `Bearer ${token}` } });
    expect(rows.at(-1)).toMatchObject({ event: 'rest-list-result', furtherPages: true, completeInventory: false });
    expect(JSON.stringify(rows)).not.toContain(token); expect(client.createIndex).not.toHaveBeenCalled();
  });
  it.each([7, 16, 4, 14])('does not switch transports after API code %i', async code => {
    const fetcher = vi.fn(); await diagnose({ client: { listIndexes: vi.fn().mockRejectedValue({ code }) }, token, fetcher, record: () => {} });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('does not switch transports or claim full inventory/READY after SDK first-page success', async () => {
    const fetcher = vi.fn(), rows: any[] = [];
    await diagnose({ client: { listIndexes: vi.fn().mockResolvedValue([[], null, {}]) }, token, fetcher, record: (x: any) => rows.push(x) });
    expect(fetcher).not.toHaveBeenCalled(); expect(rows.at(-1)).toMatchObject({ completeInventory: false });
    expect(JSON.stringify(rows)).not.toContain('ready:true');
  });
  it('redacts REST error detail and does not claim success on an error status', async () => {
    const rows: any[] = []; await diagnose({ client: { listIndexes: vi.fn().mockRejectedValue({ code: 3 }) }, token, secrets: [token], fetcher: async () => response({ error: { code: 400, message: `invalid pageSize ${token}` } }, 400), record: (x: any) => rows.push(x) });
    expect(rows.at(-1)).toMatchObject({ event: 'rest-list-error', httpStatus: 400, apiCode: 400 });
    expect(JSON.stringify(rows)).not.toContain(token);
  });
  const bytes = Buffer.from(JSON.stringify({ schema: 'blueprint.action_ledger_index_operator_receipt.v1', event: 'synthetic-inspect' }) + '\n');
  const digest = createHash('sha256').update(bytes).digest('hex');
  function transport(postStatus = 200, corrupt = false) {
    return vi.fn(async (url: string, options: any) => {
      if (options.method === 'POST') return response({}, postStatus);
      if (url.includes('alt=media')) return new Response(corrupt ? 'changed' : bytes);
      return response({ bucket: 'blueprint-8c1ca.appspot.com', name: `operations/site-intake/20261007/action-ledger-index/receipts/${digest}.jsonl`, generation: '17', size: String(bytes.length) });
    });
  }
  it.each([200, 412])('archives create-only and independently pins retained content after status %i', async status => {
    const fetcher = transport(status), rows: any[] = [];
    await archiveReceipt({ bytes, expectedSha: digest, token, fetcher, record: (x: any) => rows.push(x) });
    expect(fetcher.mock.calls.filter(x => x[1].method === 'POST')).toHaveLength(1);
    expect(fetcher.mock.calls[0][0]).toContain('ifGenerationMatch=0');
    expect(fetcher.mock.calls.at(-1)[0]).toContain('generation=17');
    expect(rows.at(-1)).toMatchObject({ event: 'archive-verified', generation: '17', sha256: digest });
  });
  it('reconciles unknown upload acknowledgement through reads without another upload', async () => {
    const fetcher = transport(), rows: any[] = []; fetcher.mockImplementationOnce(async () => { throw Error('synthetic timeout'); });
    await archiveReceipt({ bytes, expectedSha: digest, token, fetcher, record: (x: any) => rows.push(x) });
    expect(fetcher.mock.calls.filter(x => x[1].method === 'POST')).toHaveLength(1);
    expect(rows.some(x => x.event === 'archive-acknowledgement-unknown')).toBe(true);
    expect(rows.at(-1).event).toBe('archive-verified');
  });
  it('never claims archive verified for different retained bytes', async () => {
    await expect(archiveReceipt({ bytes, expectedSha: digest, token, fetcher: transport(200, true), record: () => {} })).rejects.toThrow('archive_content_mismatch');
  });
  it('rejects wrong source digest before contacting company storage', async () => {
    const fetcher = vi.fn(); await expect(archiveReceipt({ bytes, expectedSha: '0'.repeat(64), token, fetcher, record: () => {} })).rejects.toThrow('archive_source_digest_invalid'); expect(fetcher).not.toHaveBeenCalled();
  });
});
