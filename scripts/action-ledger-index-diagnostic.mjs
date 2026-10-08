/** Explicit read-only diagnosis; separately requested immutable receipt archive. */
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync, mkdtempSync, openSync, appendFileSync, fsyncSync, closeSync, lstatSync, fstatSync, readSync, constants } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

const PROJECT = 'blueprint-8c1ca', WORKER = 'srv-d9t8gg1t0dsc73am9q70';
export const PARENT = `projects/${PROJECT}/databases/(default)/collectionGroups/action_ledger`;
const OPERATOR_SHA = '654c31f561ded07d54c8e477f725f210c09af5699902c538949008921bfcc93d';
const OLD_PATH = '/tmp/blueprint-action-ledger-index-g1Gtmj/receipts.jsonl';
const OLD_SHA = '43debbd20d2e3821e6ce14552aaf775f4b1d43c79e778e3fe7dca0751d652ccd';
const BUCKET = 'blueprint-8c1ca.appspot.com';
const MANIFEST_SHA = '6a027ae610c35d0def5d5ce105abae6679f0d5d340d20b000cb14235eaa5fab7';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const refuse = code => { throw Error(code); };
export function redact(value, secrets = []) {
  let text = typeof value === 'string' ? value : '';
  for (const secret of secrets.filter(x => typeof x === 'string' && x.length > 6)) text = text.split(secret).join('[redacted]');
  return text.replace(/-----BEGIN[^]*?-----END [A-Z ]+-----/g, '[redacted-key]')
    .replace(/Bearer\s+[^\s"',}]+/gi, 'Bearer [redacted]')
    .replace(/[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[redacted-token]')
    .replace(/[A-Za-z0-9+/=_-]{64,}/g, '[redacted-long-value]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
    .replace(/[\x00-\x1f\x7f]/g, ' ').slice(0, 512);
}
export function safeError(error, secrets = []) {
  // GAX exposes decoded protobuf Any values as statusDetails. Never serialize
  // encoded Any.value, ErrorInfo.metadata, headers or the entire SDK error.
  const candidates = [error?.statusDetails, error?.details].flatMap(value => typeof value === 'string' ? [value] : Array.isArray(value) ? value.slice(0, 4) : []);
  const details = candidates.map(detail => typeof detail === 'string' ? redact(detail, secrets)
    : Array.isArray(detail?.fieldViolations) || typeof detail?.['@type'] === 'string'
      ? { type: redact(detail?.['@type'], secrets), violations: Array.isArray(detail?.fieldViolations) ? detail.fieldViolations.slice(0, 4).map(row => ({ field: redact(row?.field, secrets), description: redact(row?.description, secrets) })) : [] }
      : null).filter(detail => detail !== null).slice(0, 4);
  return { apiCode: typeof error?.code === 'number' ? error.code : null, message: redact(error?.message, secrets), details };
}
export async function boundedResponse(response, limit = 65536) {
  if (!response.body?.getReader) refuse('response_transport_unavailable');
  const reader = response.body.getReader(), chunks = []; let size = 0;
  try {
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength;
      if (size > limit) { await reader.cancel(); refuse('response_size_limit'); } chunks.push(Buffer.from(value)); }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}
export async function diagnose({ client, token, record, fetcher = fetch, secrets = [] }) {
  let code = null;
  record({ event: 'sdk-list-request', parent: PARENT, pageSizeOverride: false, filterPresent: false, method: 'GET', readOnly: true });
  try { const [rows, , response] = await client.listIndexes({ parent: PARENT }, { timeout: 10000, retry: null, autoPaginate: false });
    if (!Array.isArray(rows) || rows.length > 100) refuse('sdk_page_limit');
    record({ event: 'sdk-list-result', success: true, firstPageCount: rows.length, furtherPages: Boolean(response?.nextPageToken), completeInventory: false }); return;
  } catch (error) { const safe = safeError(error, secrets); code = safe.apiCode; record({ event: 'sdk-list-error', ...safe }); }
  // Compare the documented JSON GET only after INVALID_ARGUMENT, never use a
  // second transport to evade an IAM denial or change identity/resource scope.
  if (code !== 3) return;
  const url = `https://firestore.googleapis.com/v1/${PARENT}/indexes`;
  record({ event: 'rest-list-request', parent: PARENT, pageSizeOverride: false, method: 'GET', enumEncodingOption: false, readOnly: true });
  let response;
  try { response = await fetcher(url, { method: 'GET', redirect: 'error', signal: AbortSignal.timeout(10000), headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }); }
  catch { record({ event: 'rest-list-unavailable' }); return; }
  const bytes = await boundedResponse(response); let body;
  try { body = JSON.parse(bytes); } catch { refuse('rest_json_unavailable'); }
  if (response.status !== 200) record({ event: 'rest-list-error', httpStatus: response.status, ...safeError(body.error, secrets) });
  else {
    if (body.indexes != null && (!Array.isArray(body.indexes) || body.indexes.length > 100)) refuse('rest_page_invalid');
    record({ event: 'rest-list-result', httpStatus: 200, firstPageCount: body.indexes?.length ?? 0, furtherPages: Boolean(body.nextPageToken), completeInventory: false });
  }
  // Deliberately no absence, READY, create or task-continuation conclusion.
}
const valueType = value => value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
function indexShape(row) {
  const name = row?.name, parts = typeof name === 'string' && name.length <= 4096 ? name.split('/') : [];
  const structured = parts.length === 8 && parts[0] === 'projects' && parts[2] === 'databases' && parts[4] === 'collectionGroups' && parts[6] === 'indexes';
  const suffix = structured ? parts[7] : '';
  const disallowed = suffix.replace(/[A-Za-z0-9._~%-]/g, '');
  const queryScope = { 0: 'QUERY_SCOPE_UNSPECIFIED', 1: 'COLLECTION', 2: 'COLLECTION_GROUP', 3: 'COLLECTION_RECURSIVE' };
  return {
    rowType: valueType(row), fieldsType: valueType(row?.fields),
    queryScope: typeof row?.queryScope === 'number' ? queryScope[row.queryScope] ?? 'unrecognized-number'
      : typeof row?.queryScope === 'string' && Object.values(queryScope).includes(row.queryScope) ? row.queryScope : `unrecognized-${valueType(row?.queryScope)}`,
    name: { type: valueType(name), length: typeof name === 'string' ? Math.min(name.length, 4097) : null,
      structured, segmentCount: Math.min(parts.length, 10), exactParent: typeof name === 'string' && name.startsWith(`${PARENT}/indexes/`),
      projectMatches: structured ? parts[1] === PROJECT : null, databaseMatches: structured ? parts[3] === '(default)' : null,
      projectTokenKind: structured ? parts[1] === PROJECT ? 'expected-id' : /^[0-9]+$/.test(parts[1]) ? 'decimal-number' : 'other-id' : null,
      collectionTokenKind: structured ? parts[5] === 'action_ledger' ? 'expected-id' : parts[5] === '-' ? 'wildcard' : 'other-id' : null,
      collectionMatches: structured ? parts[5] === 'action_ledger' : null, suffixLength: structured ? Math.min(suffix.length, 513) : null,
      suffixAllowed: structured && /^[A-Za-z0-9._~%-]{1,512}$/.test(suffix),
      suffixCharacterClasses: [disallowed.includes('=') && 'equals', disallowed.includes(':') && 'colon', /\s/.test(disallowed) && 'whitespace',
        /[\x00-\x1f\x7f]/.test(disallowed) && 'control', /[^=:\s\x00-\x1f\x7f]/.test(disallowed) && 'other'].filter(Boolean) },
  };
}
export async function diagnoseScope({ client, record, secrets = [] }) {
  record({ event: 'scope-diagnostic-request', parent: PARENT, readOnly: true, pageSizeOverride: false,
    expectedResource: `${PARENT}/indexes/<opaque-id>`, expectedSuffix: '1..512 characters from A-Z a-z 0-9 . _ ~ % -' });
  let rows, response;
  try { [rows, , response] = await client.listIndexes({ parent: PARENT }, { timeout: 10000, retry: null, autoPaginate: false }); }
  catch (error) { record({ event: 'scope-diagnostic-error', apiCode: typeof error?.code === 'number' ? error.code : null,
    stage: 'list', permission: 'datastore.indexes.list' }); return; }
  if (!Array.isArray(rows) || rows.length > 100) refuse('sdk_page_limit');
  const shapes = new Map(); let omittedShapeRows = 0;
  for (const row of rows) {
    const shape = indexShape(row), key = JSON.stringify(shape);
    if (shapes.has(key)) shapes.get(key).count++;
    else if (shapes.size < 20) shapes.set(key, { shape, count: 1 });
    else omittedShapeRows++;
  }
  record({ event: 'scope-diagnostic-result', firstPageCount: rows.length, furtherPages: Boolean(response?.nextPageToken),
    shapes: [...shapes.values()], omittedShapeRows, completeInventory: false, indexReadyProven: false });
}
export function loadOperatorReceipt(source, expectedSha) {
  if (!/^\/tmp\/blueprint-action-ledger-index-[A-Za-z0-9]+\/receipts\.jsonl$/.test(source ?? '')) refuse('archive_source_path_invalid');
  if (!/^[a-f0-9]{64}$/.test(expectedSha ?? '')) refuse('archive_source_digest_invalid');
  let fd, bytes;
  try {
    const directory = lstatSync(dirname(source)), uid = process.getuid();
    if (!directory.isDirectory() || directory.isSymbolicLink() || directory.uid !== uid || (directory.mode & 0o777) !== 0o700) refuse('archive_source_file_invalid');
    // A FIFO can block before fstat and before the CLI watchdog is installed.
    fd = openSync(source, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const file = fstatSync(fd);
    if (!file.isFile() || file.uid !== uid || (file.mode & 0o777) !== 0o600 || file.size < 1 || file.size > 65536) refuse('archive_source_file_invalid');
    const buffer = Buffer.alloc(file.size + 1); let length = 0, read;
    while (length < buffer.length && (read = readSync(fd, buffer, length, buffer.length - length, length))) length += read;
    if (length !== file.size || fstatSync(fd).size !== file.size) refuse('archive_source_file_invalid');
    bytes = buffer.subarray(0, length);
  } catch { refuse('archive_source_file_invalid'); } finally { if (fd !== undefined) closeSync(fd); }
  if (sha(bytes) !== expectedSha) refuse('archive_source_digest_invalid');
  let rows;
  try { rows = new TextDecoder('utf-8', { fatal: true }).decode(bytes).trim().split('\n').map(line => JSON.parse(line)); }
  catch { refuse('archive_operator_schema_invalid'); }
  const start = rows[0];
  if (start?.schema !== 'blueprint.action_ledger_index_operator_receipt.v1' || start.event !== 'start'
    || !['inspect', 'ensure'].includes(start.mode) || start.readOnly !== (start.mode === 'inspect') || start.project !== PROJECT || start.parent !== PARENT
    || start.renderServiceId !== WORKER || !/^[a-f0-9]{40}$/.test(start.deploymentCommit ?? '') || start.scriptSha256 !== OPERATOR_SHA
    || start.manifestSha256 !== MANIFEST_SHA || start.receiptPath !== source) refuse('archive_operator_binding_invalid');
  const keys = ['schema', 'observedAtMs', 'event', 'mode', 'readOnly', 'project', 'parent', 'renderServiceId', 'deploymentCommit', 'scriptSha256', 'manifestSha256', 'receiptPath',
    'count', 'pages', 'targetCount', 'queryScope', 'fields', 'retryAllowed', 'operationName', 'done', 'errorCode', 'indexName', 'state', 'ready', 'acknowledgement', 'code', 'stage', 'permission', 'apiCode'];
  const events = ['start', 'inventory-complete', 'create-intent', 'create-acknowledged', 'create-acknowledgement-unknown', 'create-already-exists', 'operation-observed', 'index-observed', 'result', 'stopped'];
  if (rows.length > 128 || rows.some((row, i) => !row || Array.isArray(row) || row.schema !== 'blueprint.action_ledger_index_operator_receipt.v1'
    || !Number.isSafeInteger(row.observedAtMs) || row.observedAtMs < 1 || !events.includes(row.event) || (i > 0 && row.event === 'start')
    || Object.keys(row).some(key => !keys.includes(key)))) refuse('archive_operator_schema_invalid');
  // Interrupted journals remain evidence; no terminal/READY claim is required.
  return bytes;
}
export async function archiveReceipt({ bytes, expectedSha, token, fetcher = fetch, record }) {
  if (bytes.length > 65536 || !/^[a-f0-9]{64}$/.test(expectedSha) || sha(bytes) !== expectedSha) refuse('archive_source_digest_invalid');
  const rows = bytes.toString('utf8').trim().split('\n').map(line => JSON.parse(line));
  if (!rows.length || rows.some(row => !['blueprint.action_ledger_index_operator_receipt.v1', 'blueprint.action_ledger_index_diagnostic_receipt.v1'].includes(row.schema))) refuse('archive_source_schema_invalid');
  const object = `operations/site-intake/20261007/action-ledger-index/receipts/${expectedSha}.jsonl`;
  const metadataUrl = `https://storage.googleapis.com/storage/v1/b/${BUCKET}/o/${encodeURIComponent(object)}`;
  const request = (url, options = {}) => fetcher(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(10000), headers: { Authorization: `Bearer ${token}`, ...(options.headers ?? {}) } });
  record({ event: 'archive-intent', bucket: BUCKET, object, sha256: expectedSha, ifGenerationMatch: 0, retryAllowed: false });
  try {
    const response = await request(`https://storage.googleapis.com/upload/storage/v1/b/${BUCKET}/o?uploadType=media&name=${encodeURIComponent(object)}&ifGenerationMatch=0`, { method: 'POST', headers: { 'Content-Type': 'application/x-ndjson' }, body: bytes });
    await boundedResponse(response);
    record({ event: 'archive-acknowledgement', httpStatus: response.status, accepted: response.status === 200 || response.status === 201, existing: response.status === 412 });
  } catch { record({ event: 'archive-acknowledgement-unknown', retryAllowed: false }); }
  // Always independently pin metadata and retained content; no second upload.
  const metadata = await request(metadataUrl, { method: 'GET' });
  if (metadata.status !== 200) refuse('archive_metadata_unavailable');
  const row = JSON.parse(await boundedResponse(metadata));
  if (row.bucket !== BUCKET || row.name !== object || !/^[0-9]+$/.test(row.generation ?? '') || Number(row.size) !== bytes.length) refuse('archive_metadata_mismatch');
  const content = await request(`${metadataUrl}?alt=media&generation=${row.generation}`, { method: 'GET' });
  if (content.status !== 200 || sha(await boundedResponse(content)) !== expectedSha) refuse('archive_content_mismatch');
  record({ event: 'archive-verified', uri: `gs://${BUCKET}/${object}`, generation: row.generation, sha256: expectedSha, bytes: bytes.length });
}
export async function main(args = process.argv.slice(2), env = process.env) {
  const [operatorPath, mode = 'diagnose', receiptPath, expectedSha] = args;
  if (!operatorPath?.startsWith('/tmp/') || !operatorPath.endsWith('.mjs') || !['diagnose', 'diagnose-scope', 'archive-original', 'archive-diagnostic', 'archive-operator'].includes(mode)
    || (['archive-diagnostic', 'archive-operator'].includes(mode) ? args.length !== 4 : args.length > 2)) refuse('diagnostic_scope_invalid');
  if (sha(readFileSync(operatorPath)) !== OPERATOR_SHA) refuse('original_operator_digest_invalid');
  const operator = await import(pathToFileURL(operatorPath).href);
  operator.verifyManifest(readFileSync('firestore.indexes.json'));
  // Reject unsupported operator input before token acquisition or storage calls.
  const operatorReceipt = mode === 'archive-operator' ? loadOperatorReceipt(receiptPath, expectedSha) : null;
  if (env.RENDER_SERVICE_ID !== WORKER || !/^[a-f0-9]{40}$/.test(env.RENDER_GIT_COMMIT ?? '') || env.FIRESTORE_EMULATOR_HOST) refuse('existing_worker_binding_unavailable');
  let account; try { account = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON ?? '{}'); } catch { refuse('existing_firebase_binding_unavailable'); }
  if (account?.project_id !== PROJECT || account.type !== 'service_account' || !account.private_key || typeof account.client_email !== 'string' || !account.client_email.endsWith('.iam.gserviceaccount.com')) refuse('existing_firebase_binding_unavailable');
  const directory = mkdtempSync('/tmp/blueprint-action-ledger-index-diagnostic-'), path = `${directory}/receipts.jsonl`, fd = openSync(path, 'wx', 0o600);
  const record = event => { const row = { schema: 'blueprint.action_ledger_index_diagnostic_receipt.v1', observedAtMs: Date.now(), ...event }; appendFileSync(fd, JSON.stringify(row) + '\n'); fsyncSync(fd); console.log(JSON.stringify(row)); };
  const watchdog = setTimeout(() => { record({ event: 'stopped', code: 'diagnostic_deadline' }); closeSync(fd); process.exit(2); }, 60000); watchdog.unref();
  let client;
  try {
    const require = createRequire(`${process.cwd()}/package.json`), admin = require('firebase-admin');
    const token = await admin.credential.cert(account).getAccessToken();
    record({ event: 'start', mode, deploymentCommit: env.RENDER_GIT_COMMIT, sourceSha256: sha(readFileSync(new URL(import.meta.url))), originalOperatorSha256: OPERATOR_SHA, originalInspectReceiptSha256: OLD_SHA, sdkVersion: require('@google-cloud/firestore/package.json').version, firebaseAdminVersion: admin.SDK_VERSION, receiptPath: path });
    if (mode === 'diagnose' || mode === 'diagnose-scope') {
      ({ client } = operator.tokenBoundClient(require, token));
      const secrets = [token.access_token, account.private_key, account.client_email, ...account.private_key.split('\n').filter(x => x.length > 20)];
      if (mode === 'diagnose-scope') await diagnoseScope({ client, record, secrets });
      else await diagnose({ client, token: token.access_token, record, secrets });
    } else {
      const source = mode === 'archive-original' ? OLD_PATH : receiptPath;
      if (mode === 'archive-diagnostic' && !/^\/tmp\/blueprint-action-ledger-index-diagnostic-[A-Za-z0-9]+\/receipts\.jsonl$/.test(source ?? '')) refuse('archive_source_path_invalid');
      await archiveReceipt({ bytes: operatorReceipt ?? readFileSync(source), expectedSha: mode === 'archive-original' ? OLD_SHA : expectedSha, token: token.access_token, record });
    }
    console.log(JSON.stringify({ completed: true, mode, readOnly: mode === 'diagnose' || mode === 'diagnose-scope', indexMutation: false, indexReadyProven: false, receiptPath: path, receiptSha256: sha(readFileSync(path)) }));
  } catch (error) {
    record({ event: 'stopped', code: /^[a-z_]+$/.test(error.message) ? error.message : 'diagnostic_unavailable' }); process.exitCode = 2;
    console.log(JSON.stringify({ completed: false, indexMutation: false, receiptPath: path, receiptSha256: sha(readFileSync(path)) }));
  } finally { if (client) await client.close(); clearTimeout(watchdog); closeSync(fd); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(error => { console.error(JSON.stringify({ ok: false, code: /^[a-z_]+$/.test(error.message) ? error.message : 'diagnostic_unavailable' })); process.exitCode = 2; });
