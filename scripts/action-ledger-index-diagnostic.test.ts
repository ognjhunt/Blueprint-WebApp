// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, symlinkSync, readFileSync } from 'node:fs';
import * as diagnostic from './action-ledger-index-diagnostic.mjs';
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
  it('retains decoded field violations from the installed SDK public error decoder', () => {
    const require = createRequire(import.meta.url);
    const sdkRequire = createRequire(require.resolve('@google-cloud/firestore'));
    const { GoogleError } = sdkRequire('google-gax');
    const decoded = GoogleError.parseHttpError({ error: { code: 400, status: 'INVALID_ARGUMENT', message: 'Request contains an invalid argument.', details: [
      { '@type': 'type.googleapis.com/google.rpc.BadRequest', fieldViolations: [{ field: '$alt', description: `unsupported enum encoding ${token}` }] },
      { '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'SYNTHETIC', domain: 'synthetic', metadata: { credential: token, email: 'user@example.com' } },
    ] } });
    expect(decoded.code).toBe(3);
    expect(decoded.statusDetails[0].fieldViolations[0].field).toBe('$alt');
    const safe = safeError(decoded, [token]);
    expect(safe.details[0].violations).toEqual([{ field: '$alt', description: 'unsupported enum encoding [redacted]' }]);
    expect(JSON.stringify(safe)).not.toContain(token);
    expect(JSON.stringify(safe)).not.toContain('credential');
    expect(JSON.stringify(safe)).not.toContain('type_url');
    expect(JSON.stringify(safe)).not.toContain('user@example.com');
  });
  it('makes exactly one same-parent documented GET after code3 and never a create', async () => {
    const client = { listIndexes: vi.fn().mockRejectedValue({ code: 3, message: 'bad parameter' }), createIndex: vi.fn() };
    const fetcher = vi.fn(async () => response({ indexes: [], nextPageToken: 'next' })); const rows: any[] = [];
    await diagnose({ client, token, fetcher, record: (x: any) => rows.push(x) });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toBe(`https://firestore.googleapis.com/v1/${PARENT}/indexes`);
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
  it('uses the supported SDK default and retains the local100-row bound', async () => {
    const client = { listIndexes: vi.fn(async request => {
      if (request.pageSize) throw { code: 3, message: 'Invalid page size. Only 0 is supported.' };
      return [Array.from({ length: 101 }, () => ({})), null, {}];
    }) }, fetcher = vi.fn(), rows: any[] = [];
    await diagnose({ client, token, fetcher, record: (x: any) => rows.push(x) });
    expect(client.listIndexes).toHaveBeenCalledWith({ parent: PARENT }, expect.objectContaining({ retry: null, autoPaginate: false, timeout: 10000 }));
    expect(rows.some(row => row.event === 'sdk-list-result')).toBe(false);
    expect(rows.at(-1)).toMatchObject({ event: 'sdk-list-error', apiCode: null, message: 'sdk_page_limit' });
    expect(fetcher).not.toHaveBeenCalled();
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

describe('scope-only diagnosis and exact operator receipt input', () => {
  it('reports bounded shape categories and recognized enums without names or definitions', async () => {
    const secretName = 'private-project-identity', secretField = 'private-index-field';
    const client = { listIndexes: vi.fn().mockResolvedValue([[
      { name: `${PARENT}/indexes/opaque-valid`, queryScope: 1, fields: [{ fieldPath: secretField }] },
      { name: `${PARENT}/indexes/opaque=`, queryScope: 'COLLECTION_GROUP' },
      { name: `projects/${secretName}/databases/(default)/collectionGroups/other/indexes/opaque`, queryScope: 999 },
      { queryScope: 'secret-enum-value' },
    ], null, { nextPageToken: 'secret-page-token' }]), createIndex: vi.fn() };
    const rows: any[] = [];
    await diagnostic.diagnoseScope({ client, record: (row: any) => rows.push(row) });
    expect(client.listIndexes).toHaveBeenCalledWith({ parent: PARENT }, { timeout: 10000, retry: null, autoPaginate: false });
    expect(client.createIndex).not.toHaveBeenCalled();
    const result = rows.at(-1);
    expect(result).toMatchObject({ event: 'scope-diagnostic-result', firstPageCount: 4, furtherPages: true, completeInventory: false, indexReadyProven: false });
    expect(result.shapes.map((row: any) => row.shape.queryScope)).toEqual(['COLLECTION', 'COLLECTION_GROUP', 'unrecognized-number', 'unrecognized-string']);
    expect(result.shapes[1].shape.name).toMatchObject({ exactParent: true, suffixAllowed: false, suffixCharacterClasses: ['equals'] });
    expect(result.shapes[2].shape.name).toMatchObject({ projectMatches: false, collectionMatches: false });
    expect(result.shapes[3].shape.name.type).toBe('undefined');
    for (const value of [secretName, secretField, 'opaque-valid', 'secret-enum-value', 'secret-page-token']) expect(JSON.stringify(rows)).not.toContain(value);
  });
  it('caps distinct shapes, reports truncation, and does not print SDK row keys', async () => {
    const rows: any[] = [], definitions = Array.from({ length: 30 }, (_, i) => ({ name: `${PARENT}/indexes/${'a'.repeat(i + 1)}`, queryScope: 1, privateKey: 'not-an-index-secret' }));
    await diagnostic.diagnoseScope({ client: { listIndexes: vi.fn().mockResolvedValue([definitions, null, {}]) }, record: (row: any) => rows.push(row) });
    expect(rows.at(-1).shapes).toHaveLength(20);
    expect(rows.at(-1).omittedShapeRows).toBe(10);
    expect(JSON.stringify(rows)).not.toContain('privateKey');
    expect(JSON.stringify(rows)).not.toContain('not-an-index-secret');
  });
  it.each([null, {}, Array.from({ length: 101 }, () => ({}))])('refuses invalid or oversized scope pages without another request', async definitions => {
    const client = { listIndexes: vi.fn().mockResolvedValue([definitions, null, {}]) };
    await expect(diagnostic.diagnoseScope({ client, record: () => {} })).rejects.toThrow('sdk_page_limit');
    expect(client.listIndexes).toHaveBeenCalledTimes(1);
  });
  it('does not retry or switch transports on a scope diagnostic API refusal', async () => {
    const client = { listIndexes: vi.fn().mockRejectedValue({ code: 7, message: `denied ${token}` }) }, rows: any[] = [];
    await diagnostic.diagnoseScope({ client, record: (row: any) => rows.push(row), secrets: [token] });
    expect(client.listIndexes).toHaveBeenCalledTimes(1);
    expect(rows.at(-1)).toMatchObject({ event: 'scope-diagnostic-error', apiCode: 7 });
    expect(JSON.stringify(rows)).not.toContain(token);
    expect(rows.some(row => row.event === 'scope-diagnostic-result')).toBe(false);
  });
  function receipt(directory: string, changes: any = {}, extra: any[] = []) {
    const path = `${directory}/receipts.jsonl`, bytes = Buffer.from([
      { schema: 'blueprint.action_ledger_index_operator_receipt.v1', observedAtMs: 1791406800000, event: 'start', mode: 'inspect', readOnly: true,
        project: 'blueprint-8c1ca', parent: PARENT, renderServiceId: 'srv-d9t8gg1t0dsc73am9q70', deploymentCommit: 'efd2e685819328c4c3060cec7d105142612adf63',
        scriptSha256: 'ba1e24ddef8e560114560cc938ec764815bcd57671f58ff9fe9c4ae11c48b096', manifestSha256: '91b3fcdc84a63fbd1c63de6d3f9d12f52f1bed0a9ddcde1d33d474f0e75e6647', receiptPath: path, ...changes },
      ...extra,
    ].map(row => JSON.stringify(row)).join('\n') + '\n');
    writeFileSync(path, bytes, { mode: 0o600 });
    return { path, bytes, expectedSha: createHash('sha256').update(bytes).digest('hex') };
  }
  it('reads the original private operator path exactly, including interrupted journals', () => {
    const directory = mkdtempSync('/tmp/blueprint-action-ledger-index-');
    try {
      const source = receipt(directory);
      expect(diagnostic.loadOperatorReceipt(source.path, source.expectedSha)).toEqual(source.bytes);
      expect(() => diagnostic.loadOperatorReceipt(source.path, '0'.repeat(64))).toThrow('archive_source_digest_invalid');
    } finally { rmSync(directory, { recursive: true }); }
  });
  it.each([
    { schema: 'blueprint.action_ledger_index_diagnostic_receipt.v1' }, { project: 'other-project' }, { parent: PARENT.replace('action_ledger', 'other') },
    { renderServiceId: 'other-worker' }, { scriptSha256: '0'.repeat(64) }, { manifestSha256: '0'.repeat(64) },
    { receiptPath: '/tmp/other.jsonl' }, { mode: 'plan' }, { readOnly: false }, { event: 'result' }, { deploymentCommit: 'unknown' },
  ])('rejects another schema/source/worker/resource binding before any upload: %j', changes => {
    const directory = mkdtempSync('/tmp/blueprint-action-ledger-index-');
    try { const source = receipt(directory, changes); expect(() => diagnostic.loadOperatorReceipt(source.path, source.expectedSha)).toThrow('archive_operator_binding_invalid'); }
    finally { rmSync(directory, { recursive: true }); }
  });
  it('rejects mixed-schema rows and extra fields even when the digest matches', () => {
    const directory = mkdtempSync('/tmp/blueprint-action-ledger-index-');
    try {
      const source = receipt(directory, {}, [{ schema: 'blueprint.action_ledger_index_diagnostic_receipt.v1', observedAtMs: 1791406800001, event: 'stopped' }]);
      expect(() => diagnostic.loadOperatorReceipt(source.path, source.expectedSha)).toThrow('archive_operator_schema_invalid');
      const extra = receipt(directory, { customerData: 'unapproved-file' });
      expect(() => diagnostic.loadOperatorReceipt(extra.path, extra.expectedSha)).toThrow('archive_operator_schema_invalid');
    } finally { rmSync(directory, { recursive: true }); }
  });
  it('rejects arbitrary paths, symlinks and oversized sources before read/upload', () => {
    const directory = mkdtempSync('/tmp/blueprint-action-ledger-index-'), other = mkdtempSync('/tmp/non-operator-');
    try {
      const wrong = receipt(other);
      expect(() => diagnostic.loadOperatorReceipt(wrong.path, wrong.expectedSha)).toThrow('archive_source_path_invalid');
      symlinkSync(wrong.path, `${directory}/receipts.jsonl`);
      expect(() => diagnostic.loadOperatorReceipt(`${directory}/receipts.jsonl`, wrong.expectedSha)).toThrow('archive_source_file_invalid');
      rmSync(`${directory}/receipts.jsonl`);
      writeFileSync(`${directory}/receipts.jsonl`, 'x'.repeat(65537), { mode: 0o600 });
      expect(() => diagnostic.loadOperatorReceipt(`${directory}/receipts.jsonl`, wrong.expectedSha)).toThrow('archive_source_file_invalid');
    } finally { rmSync(directory, { recursive: true }); rmSync(other, { recursive: true }); }
  });
  it('the actual archive CLI rejects a private FIFO before authentication within its bounded child test', () => {
    const proof = JSON.parse(process.env.BLUEPRINT_TEST_FIFO_PROOF
      ? readFileSync(process.env.BLUEPRINT_TEST_FIFO_PROOF, 'utf8')
      : execFileSync('python3', [new URL('./fixtures/action-ledger-index-operator-fifo.py', import.meta.url).pathname], { timeout: 5000, encoding: 'utf8' }));
    expect(proof).toMatchObject({ passed: true, exitCode: 2, code: 'archive_source_file_invalid', beforeAuthentication: true });
    expect(proof.sourceSha256).toBe(createHash('sha256').update(readFileSync(new URL('./action-ledger-index-diagnostic.mjs', import.meta.url))).digest('hex'));
    expect(proof.elapsedSeconds).toBeLessThan(1.5);
  });
  async function actualMain(args: string[], transport: any) {
    const require = createRequire(import.meta.url), sdk = createRequire(require.resolve('@google-cloud/firestore'));
    const fetchPath = sdk.resolve('node-fetch'), fetchExport = require(fetchPath), originalDefault = fetchExport.default;
    const originalExport = require.cache[fetchPath]!.exports;
    const http = require('node:http'), https = require('node:https');
    const originalHttp = http.request, originalHttps = https.request, originalFetch = globalThis.fetch, originalLog = console.log, originalExit = process.exitCode;
    const admin = require('firebase-admin'), cert = vi.spyOn(admin.credential, 'cert').mockReturnValue({ getAccessToken: async () => ({ access_token: token, expires_in: 3600 }) } as any);
    const rows: any[] = [], copies = mkdtempSync('/tmp/index-archive-review-source-'), operatorPath = `${copies}/operator.mjs`;
    writeFileSync(operatorPath, readFileSync(new URL('./action-ledger-index-operator.mjs', import.meta.url)), { mode: 0o600 });
    fetchExport.default = transport; require.cache[fetchPath]!.exports = fetchExport;
    http.request = https.request = () => { throw Error('network_escape_refused'); };
    globalThis.fetch = transport; console.log = line => rows.push(JSON.parse(line));
    try {
      await diagnostic.main([operatorPath, ...args], {
        RENDER_SERVICE_ID: 'srv-d9t8gg1t0dsc73am9q70', RENDER_GIT_COMMIT: 'efd2e685819328c4c3060cec7d105142612adf63',
        FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({ type: 'service_account', project_id: 'blueprint-8c1ca', client_email: 'synthetic@blueprint-8c1ca.iam.gserviceaccount.com', private_key: 'synthetic-not-a-private-key' }),
      });
      const final = rows.at(-1);
      expect(createHash('sha256').update(readFileSync(final.receiptPath)).digest('hex')).toBe(final.receiptSha256);
      expect(JSON.stringify(rows)).not.toContain(token);
      expect(JSON.stringify(rows)).not.toContain('synthetic-not-a-private-key');
      return { rows, final, authCalls: cert.mock.calls.length };
    } finally {
      fetchExport.default = originalDefault; require.cache[fetchPath]!.exports = originalExport;
      http.request = originalHttp; https.request = originalHttps; globalThis.fetch = originalFetch;
      console.log = originalLog; process.exitCode = originalExit; cert.mockRestore();
      rmSync(copies, { recursive: true });
      for (const row of rows) if (row.receiptPath?.startsWith('/tmp/blueprint-action-ledger-index-diagnostic-')) rmSync(row.receiptPath.replace(/\/receipts\.jsonl$/, ''), { recursive: true, force: true });
    }
  }
  it.each([200, 412, 'unknown'])('the actual archive-operator entrypoint retains exact source and pins readback after %s', async acknowledgement => {
    const directory = mkdtempSync('/tmp/blueprint-action-ledger-index-');
    try {
      const source = receipt(directory), calls: any[] = [], object = `operations/site-intake/20261007/action-ledger-index/receipts/${source.expectedSha}.jsonl`;
      const result = await actualMain(['archive-operator', source.path, source.expectedSha], async (url: string, options: any) => {
        const uri = new URL(url); calls.push({ url, method: options.method });
        expect(uri.hostname).toBe('storage.googleapis.com'); expect(options.redirect).toBe('error'); expect(options.headers.Authorization).toBe(`Bearer ${token}`);
        if (options.method === 'POST') {
          expect(uri.searchParams.get('ifGenerationMatch')).toBe('0'); expect(uri.searchParams.get('name')).toBe(object); expect(options.body).toEqual(source.bytes);
          if (acknowledgement === 'unknown') throw Error('synthetic acknowledgement loss');
          return response({}, acknowledgement as number);
        }
        expect(options.method).toBe('GET');
        expect(decodeURIComponent(uri.pathname)).toBe(`/storage/v1/b/blueprint-8c1ca.appspot.com/o/${object}`);
        if (uri.searchParams.get('alt') === 'media') { expect(uri.searchParams.get('generation')).toBe('17'); return new Response(source.bytes); }
        return response({ bucket: 'blueprint-8c1ca.appspot.com', name: object, generation: '17', size: String(source.bytes.length) });
      });
      expect(result.final).toMatchObject({ completed: true, mode: 'archive-operator', readOnly: false, indexMutation: false, indexReadyProven: false });
      expect(result.rows.find(row => row.event === 'archive-verified')).toMatchObject({ generation: '17', sha256: source.expectedSha });
      expect(calls.map(call => call.method)).toEqual(['POST', 'GET', 'GET']);
      expect(readFileSync(source.path)).toEqual(source.bytes);
    } finally { rmSync(directory, { recursive: true }); }
  });
  it('the actual diagnose-scope entrypoint uses one installed-SDK GET and excludes foreign resource strings', async () => {
    const calls: any[] = [];
    const result = await actualMain(['diagnose-scope'], async (url: string, options: any) => {
      const uri = new URL(url); calls.push({ url, method: options.method });
      expect(uri.hostname).toBe('firestore.googleapis.com'); expect(uri.pathname).toBe(`/v1/${PARENT}/indexes`);
      expect(options.method).toBe('GET'); expect(uri.searchParams.has('pageSize')).toBe(false);
      return response({ indexes: [{ name: 'projects/private-project/databases/(default)/collectionGroups/private-collection/indexes/private-id', queryScope: 'COLLECTION_GROUP' }] });
    });
    expect(calls).toHaveLength(1); expect(result.final).toMatchObject({ completed: true, readOnly: true, indexMutation: false, indexReadyProven: false });
    const shape = result.rows.find(row => row.event === 'scope-diagnostic-result').shapes[0].shape;
    expect(shape).toMatchObject({ queryScope: 'COLLECTION_GROUP', name: { projectMatches: false, collectionMatches: false } });
    expect(JSON.stringify(result.rows)).not.toContain('private-project'); expect(JSON.stringify(result.rows)).not.toContain('private-collection');
    expect(JSON.stringify(result.rows)).not.toContain('private-id');
  });
  it('the actual SDK scope error never retains provider resource names, field paths or error detail', async () => {
    let calls = 0;
    const result = await actualMain(['diagnose-scope'], async (url: string, options: any) => {
      calls++; const uri = new URL(url);
      expect(uri.hostname).toBe('firestore.googleapis.com'); expect(options.method).toBe('GET');
      return response({ error: { code: 400, status: 'INVALID_ARGUMENT', message: 'private-resource-name private-field-path',
        details: [{ '@type': 'type.googleapis.com/google.rpc.BadRequest', fieldViolations: [{ field: 'private-field-path', description: 'private-resource-name' }] }] } }, 400);
    });
    expect(calls).toBe(1);
    expect(result.rows.find(row => row.event === 'scope-diagnostic-error')).toMatchObject({ apiCode: 3, stage: 'list', permission: 'datastore.indexes.list' });
    expect(result.rows.some(row => row.event === 'scope-diagnostic-result')).toBe(false);
    expect(JSON.stringify(result.rows)).not.toContain('private-resource-name'); expect(JSON.stringify(result.rows)).not.toContain('private-field-path');
    expect(JSON.stringify(result.rows)).not.toContain('fieldViolations');
  });
});
