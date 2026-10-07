/** Synthetic API contract fixture only: every transport is intercepted. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const sdkRequire = createRequire(require.resolve('@google-cloud/firestore'));
const fetchPath = sdkRequire.resolve('node-fetch');
const fetchExport = require(fetchPath);
let transport = () => { throw Error('network_escape_refused'); };
const dispatch = (...args) => transport(...args);
export async function runWireScenario(scenario) {
const source = process.env.BLUEPRINT_TEST_OPERATOR_SOURCE
  ? pathToFileURL(process.env.BLUEPRINT_TEST_OPERATOR_SOURCE) : new URL('../action-ledger-index-operator.mjs', import.meta.url);
const { tokenBoundClient, runIndexOperation, PARENT, FIELDS } = await import(source.href);
assert(['ready', 'absent', 'pagination', 'oversized', 'create-denied'].includes(scenario));
const name = `${PARENT}/indexes/synthetic-default-page`;
const row = { name, queryScope: 'COLLECTION', fields: FIELDS, state: 'READY' };
const calls = []; let lists = 0;
const intercept = async (url, options) => {
  const uri = new URL(url); assert.equal(uri.hostname, 'firestore.googleapis.com');
  calls.push({ method: options.method, path: uri.pathname, pageSize: uri.searchParams.get('pageSize'), pageToken: uri.searchParams.get('pageToken') });
  let payload, status = 200;
  if (options.method === 'POST') {
    assert.equal(scenario, 'create-denied'); assert.equal(uri.pathname, `/v1/${PARENT}/indexes`);
    status = 403; payload = { error: { code: 403, status: 'PERMISSION_DENIED', message: 'synthetic create refusal' } };
  } else {
    assert.equal(options.method, 'GET');
    if (uri.pathname === `/v1/${PARENT}/indexes`) {
      lists++;
      // Reproduce the observed production API contract through actual SDK
      // serialization/decoding; no request reaches a real endpoint.
      if (uri.searchParams.has('pageSize') && uri.searchParams.get('pageSize') !== '0') {
        status = 400; payload = { error: { code: 400, status: 'INVALID_ARGUMENT', message: 'Invalid page size. Only 0 is supported.' } };
      } else if (scenario === 'pagination' && lists === 1) payload = { nextPageToken: 'synthetic-next' };
      else if (scenario === 'oversized') payload = { indexes: Array.from({ length: 101 }, (_, i) => ({ ...row, name: `${PARENT}/indexes/synthetic-${i}` })) };
      else payload = { indexes: scenario === 'absent' || scenario === 'create-denied' ? [] : [row] };
    } else { assert.equal(uri.pathname, `/v1/${name}`); payload = row; }
  }
  return new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } });
};
transport = intercept;
const http = require('node:http'), https = require('node:https');
const originalHttp = http.request, originalHttps = https.request, originalFetch = globalThis.fetch;
const originalExport = require.cache[fetchPath].exports, originalDefault = fetchExport.default;
// Cached GAX retains the export object, then reads .default for each fresh
// service stub. Preserve that object's identity for cold and preloaded SDKs.
fetchExport.default = dispatch; require.cache[fetchPath].exports = fetchExport;
http.request = https.request = globalThis.fetch = () => { throw Error('network_escape_refused'); };
const events = []; let client, result, error;
try {
  ({ client } = tokenBoundClient(require, { access_token: 'synthetic-access-token', expires_in: 3600 }));
  result = await runIndexOperation({ client, mode: scenario === 'create-denied' ? 'ensure' : 'inspect', record: event => events.push(event), wait: async () => {}, maxObservations: 1 });
}
catch (caught) { error = { code: caught.message, stage: caught.stage ?? null, apiCode: caught.apiCode ?? null }; }
finally {
  try { if (client) await client.close(); }
  finally { fetchExport.default = originalDefault; require.cache[fetchPath].exports = originalExport;
    transport = () => { throw Error('network_escape_refused'); };
    http.request = originalHttp; https.request = originalHttps; globalThis.fetch = originalFetch; }
}
const posts = calls.filter(call => call.method === 'POST').length;
assert.equal(posts, scenario === 'create-denied' ? 1 : 0);
if (scenario === 'oversized') { assert.equal(error?.code, 'index_inventory_limit'); assert(!events.some(event => event.event === 'inventory-complete')); }
else if (scenario === 'create-denied') { assert.equal(error?.code, 'index_api_permission_denied'); assert.equal(error?.stage, 'create'); assert.equal(error?.apiCode, 7); }
else { assert.equal(error, undefined); assert.equal(result.ready, scenario !== 'absent'); assert.equal(result.state, scenario === 'absent' ? 'ABSENT' : 'READY'); }
assert(calls.filter(call => call.path.endsWith('/indexes')).every(call => call.pageSize === null));
if (scenario === 'pagination') assert(calls.some(call => call.pageToken === 'synthetic-next'));
return { schema: 'blueprint.synthetic_index_default_page_wire.v1', scenario, sdk: sdkRequire('@google-cloud/firestore/package.json').version, gax: sdkRequire('google-gax/package.json').version, calls, result, error, posts, network: 'fully intercepted nested node-fetch; http/https and direct fetch refused' };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(JSON.stringify(await runWireScenario(process.argv[2])));
