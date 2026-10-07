/** Explicit operator command only. Never imported by a route or worker. */
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { appendFileSync, closeSync, fsyncSync, mkdtempSync, openSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const PROJECT = 'blueprint-8c1ca';
export const PARENT = `projects/${PROJECT}/databases/(default)/collectionGroups/action_ledger`;
const DATABASE = `projects/${PROJECT}/databases/(default)`;
const WORKER = 'srv-d9t8gg1t0dsc73am9q70';
const MANIFEST_SHA256 = '91b3fcdc84a63fbd1c63de6d3f9d12f52f1bed0a9ddcde1d33d474f0e75e6647';
export const FIELDS = Object.freeze(['lane', 'status', 'created_at', '__name__'].map(fieldPath => Object.freeze({ fieldPath, order: 'ASCENDING' })));
const RPC = { timeout: 10000, retry: null };
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const refuse = code => { throw Error(code); };
const resource = (name, prefix) => typeof name === 'string' && name.startsWith(prefix) && /^[A-Za-z0-9._~%-]{1,512}$/.test(name.slice(prefix.length));
const indexName = name => resource(name, `${PARENT}/indexes/`);
function inventoryIndexName(name) {
  const prefix = `${DATABASE}/collectionGroups/`;
  if (typeof name !== 'string' || !name.startsWith(prefix)) return false;
  const parts = name.slice(prefix.length).split('/');
  return parts.length === 3 && parts[1] === 'indexes' && !['.', '..', '-'].includes(parts[0])
    && resource(parts[0], '') && resource(parts[2], '');
}
const operationName = name => resource(name, `${DATABASE}/operations/`);
const enumIs = (value, label, number) => value === label || value === number;
const stateOf = row => enumIs(row.state, 'READY', 2) ? 'READY' : enumIs(row.state, 'CREATING', 1) ? 'CREATING' : enumIs(row.state, 'NEEDS_REPAIR', 3) ? 'NEEDS_REPAIR' : 'UNKNOWN';
function exact(row) {
  return row && enumIs(row.queryScope, 'COLLECTION', 1)
    && (row.apiScope == null || enumIs(row.apiScope, 'ANY_API', 0))
    && Array.isArray(row.fields) && row.fields.length === 4
    && row.fields.every((field, i) => field.fieldPath === FIELDS[i].fieldPath && enumIs(field.order, 'ASCENDING', 1)
      && !field.vectorConfig && (field.arrayConfig == null || enumIs(field.arrayConfig, 'ARRAY_CONFIG_UNSPECIFIED', 0)));
}
export function verifyManifest(bytes) {
  if (sha(bytes) !== MANIFEST_SHA256) refuse('reviewed_manifest_mismatch');
  const manifest = JSON.parse(bytes.toString('utf8'));
  const matches = manifest.indexes.filter(row => row.collectionGroup === 'action_ledger' && row.queryScope === 'COLLECTION'
    && JSON.stringify(row.fields) === JSON.stringify(FIELDS.slice(0, 3)));
  if (matches.length !== 1) refuse('reviewed_index_manifest_invalid');
  return true;
}
function failure(error, stage) {
  const code = typeof error?.code === 'number' ? error.code : null;
  const e = Error(code === 7 || code === 403 ? 'index_api_permission_denied' : 'index_api_unavailable');
  e.stage = stage; e.apiCode = code;
  e.permission = { list: 'datastore.indexes.list', create: 'datastore.indexes.create', get: 'datastore.indexes.get', operation: 'datastore.operations.get' }[stage];
  return e;
}
export async function runIndexOperation({ client, mode, record, wait = ms => new Promise(r => setTimeout(r, ms)), maxObservations = 12 }) {
  if (!['inspect', 'ensure'].includes(mode) || !Number.isInteger(maxObservations) || maxObservations < 1 || maxObservations > 12) refuse('operator_scope_invalid');
  const started = Date.now();
  const checkBudget = () => { if (Date.now() - started > 240000) refuse('index_observation_time_limit'); };
  async function api(stage, call) {
    checkBudget();
    try { return await call(); } catch (error) { throw failure(error, stage); }
  }
  async function inventory() {
    let pageToken = ''; const seen = new Set(); const found = new Map(); let count = 0;
    for (let page = 0; page < 20; page++) {
      // Native index administration currently accepts only the default (0)
      // page size. Bound returned inventory locally instead of overriding it.
      const [rows, next, response] = await api('list', () => client.listIndexes({ parent: PARENT, ...(pageToken ? { pageToken } : {}) }, { ...RPC, autoPaginate: false }));
      if (!Array.isArray(rows) || rows.length > 100 || (count += rows.length) > 2000) refuse('index_inventory_limit');
      for (const row of rows) {
        if (!inventoryIndexName(row?.name)) refuse('index_inventory_scope_invalid');
        // Live listing can include other collections in this same database.
        // Their fields/state confer no target authority and are not evaluated.
        if (indexName(row.name) && exact(row)) found.set(row.name, row);
      }
      pageToken = response?.nextPageToken ?? next?.pageToken ?? '';
      if (typeof pageToken !== 'string' || pageToken.length > 8192 || (pageToken && seen.has(pageToken))) refuse('index_inventory_pagination_invalid');
      if (!pageToken) {
        if (found.size > 1) refuse('duplicate_target_index');
        record({ event: 'inventory-complete', count, pages: page + 1, targetCount: found.size });
        return [...found.values()][0] ?? null;
      }
      seen.add(pageToken);
    }
    refuse('index_inventory_limit');
  }
  let row = await inventory(); let operation = null; let acknowledgement = 'NOT_ATTEMPTED';
  if (!row && mode === 'ensure') {
    // Synchronously fsynced by the CLI recorder before the only create attempt.
    record({ event: 'create-intent', parent: PARENT, queryScope: 'COLLECTION', fields: FIELDS, retryAllowed: false });
    try {
      const [lro, raw] = await client.createIndex({ parent: PARENT, index: { queryScope: 'COLLECTION', fields: FIELDS.map(field => ({ ...field })) } }, { ...RPC });
      operation = raw?.name ?? lro?.name;
      if (!operationName(operation)) refuse('index_operation_scope_invalid');
      acknowledgement = 'ACKNOWLEDGED'; record({ event: 'create-acknowledged', operationName: operation });
    } catch (error) {
      if (error?.message === 'index_operation_scope_invalid') throw error;
      if (error?.code === 7 || error?.code === 403) throw failure(error, 'create');
      acknowledgement = error?.code === 6 || error?.code === 409 ? 'ALREADY_EXISTS' : 'UNKNOWN';
      record({ event: acknowledgement === 'UNKNOWN' ? 'create-acknowledgement-unknown' : 'create-already-exists', retryAllowed: false });
    }
  }
  let result = { ready: false, state: row ? stateOf(row) : mode === 'inspect' ? 'ABSENT' : 'NOT_OBSERVED', acknowledgement, operationName: operation, indexName: null };
  for (let attempt = 0; attempt < (mode === 'inspect' ? 1 : maxObservations); attempt++) {
    if (operation) {
      const [observed] = await api('operation', () => client.getOperation({ name: operation }, { ...RPC }));
      if (observed?.name !== operation || typeof observed.done !== 'boolean') refuse('index_operation_readback_invalid');
      record({ event: 'operation-observed', operationName: operation, done: observed.done, errorCode: typeof observed.error?.code === 'number' ? observed.error.code : null });
      if (observed.error) refuse('index_operation_failed');
    }
    if (!row) row = await inventory();
    if (row) {
      const [observed] = await api('get', () => client.getIndex({ name: row.name }, { ...RPC }));
      if (observed?.name !== row.name || !indexName(observed.name) || !exact(observed)) refuse('index_readback_mismatch');
      const state = stateOf(observed);
      record({ event: 'index-observed', indexName: observed.name, queryScope: 'COLLECTION', fields: FIELDS, state });
      result = { ...result, state, ready: state === 'READY', indexName: observed.name };
      if (state === 'NEEDS_REPAIR' || state === 'UNKNOWN') refuse('index_state_requires_investigation');
      if (result.ready || mode === 'inspect') break;
    }
    if (attempt + 1 < maxObservations && mode !== 'inspect') { checkBudget(); await wait(10000); }
  }
  record({ event: 'result', ...result });
  return result;
}

// Public auth APIs: use Firebase Admin's existing token, never ADC discovery,
// new scopes, impersonation, private-key re-export or a new identity.
export function tokenBoundClient(require, token) {
  if (typeof token?.access_token !== 'string' || !token.access_token || !Number.isFinite(token.expires_in) || token.expires_in < 600) refuse('existing_token_unavailable');
  const { GoogleAuth, OAuth2Client } = require('google-auth-library');
  const { v1 } = require('@google-cloud/firestore');
  const authClient = new OAuth2Client({ eagerRefreshThresholdMillis: 0, forceRefreshOnFailure: false });
  authClient.setCredentials({ access_token: token.access_token, expiry_date: Date.now() + token.expires_in * 1000 });
  const auth = new GoogleAuth({ authClient, projectId: PROJECT });
  const client = new v1.FirestoreAdminClient({ auth, projectId: PROJECT, apiEndpoint: 'firestore.googleapis.com', fallback: 'rest' });
  return { client, authClient };
}
export async function main(args = process.argv.slice(2), env = process.env) {
  const [mode = 'plan'] = args;
  if (args.length > 1 || !['plan', 'inspect', 'ensure'].includes(mode)) refuse('usage_plan_inspect_or_ensure');
  verifyManifest(readFileSync(resolve('firestore.indexes.json')));
  if (mode === 'plan') {
    console.log(JSON.stringify({ schema: 'blueprint.action_ledger_index_operator.v1', readOnly: true, network: false, project: PROJECT, parent: PARENT, queryScope: 'COLLECTION', fields: FIELDS, manifestSha256: MANIFEST_SHA256 }));
    return;
  }
  if (env.RENDER_SERVICE_ID !== WORKER || !/^[a-f0-9]{40}$/.test(env.RENDER_GIT_COMMIT ?? '') || env.FIRESTORE_EMULATOR_HOST) refuse('existing_worker_binding_unavailable');
  let account; try { account = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON ?? '{}'); } catch { refuse('existing_firebase_binding_unavailable'); }
  if (account?.type !== 'service_account' || account.project_id !== PROJECT || typeof account.private_key !== 'string' || !account.private_key || typeof account.client_email !== 'string' || !account.client_email.endsWith('.iam.gserviceaccount.com')) refuse('existing_firebase_binding_unavailable');
  const directory = mkdtempSync('/tmp/blueprint-action-ledger-index-');
  const path = `${directory}/receipts.jsonl`; const fd = openSync(path, 'wx', 0o600);
  const schema = 'blueprint.action_ledger_index_operator_receipt.v1';
  const record = event => { const receipt = { schema, observedAtMs: Date.now(), ...event }; appendFileSync(fd, JSON.stringify(receipt) + '\n'); fsyncSync(fd); console.log(JSON.stringify(receipt)); };
  // Also bounds credential acquisition and SDK cleanup. Abrupt interruption
  // leaves the fsynced intent intact; recovery starts with inspect, never a
  // blind create retry. No automatic cancellation/deletion is performed.
  const watchdog = setTimeout(() => {
    record({ event: 'stopped', code: 'operator_deadline', retryAllowed: false });
    closeSync(fd); process.exit(2);
  }, 300000);
  watchdog.unref();
  const require = createRequire(`${process.cwd()}/package.json`); let client;
  try {
    record({ event: 'start', mode, readOnly: mode === 'inspect', project: PROJECT, parent: PARENT, renderServiceId: WORKER, deploymentCommit: env.RENDER_GIT_COMMIT, scriptSha256: sha(readFileSync(new URL(import.meta.url))), manifestSha256: MANIFEST_SHA256, receiptPath: path });
    const admin = require('firebase-admin');
    let token;
    try { token = await admin.credential.cert(account).getAccessToken(); } catch { refuse('existing_firebase_token_unavailable'); }
    ({ client } = tokenBoundClient(require, token));
    const result = await runIndexOperation({ client, mode, record });
    const digest = sha(readFileSync(path));
    console.log(JSON.stringify({ ok: result.ready, ...result, receiptPath: path, receiptSha256: digest, portableFormat: 'jsonl', archiveRequired: true }));
    process.exitCode = result.ready ? 0 : 3;
  } catch (error) {
    const safe = { event: 'stopped', code: /^[a-z_]+$/.test(error.message) ? error.message : 'index_operator_unavailable', stage: error.stage ?? null, permission: error.permission ?? null, apiCode: error.apiCode ?? null };
    record(safe); console.log(JSON.stringify({ ok: false, ...safe, receiptPath: path, receiptSha256: sha(readFileSync(path)) })); process.exitCode = 2;
  } finally { if (client) await client.close(); clearTimeout(watchdog); closeSync(fd); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(JSON.stringify({ ok: false, code: /^[a-z_]+$/.test(error.message) ? error.message : 'index_operator_unavailable' })); process.exitCode = 2; });
}
