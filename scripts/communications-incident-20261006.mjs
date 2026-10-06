/** Owner-operated, private incident evidence. Never loaded by a worker or route. */
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';

export const ROOT = 'blueprintCommunications/default';
export const CONTROL = 'blueprintDailyResearch/sites-first';
export const LAP = `${ROOT}/intakeState/workerLap`;
export const INCIDENT = 'blueprint.communications-incident-20261006.v1';
export const STOPPED_SOURCE = 'cdc97c4c6852a815b71910ece823c7179d9fbb445879e78f06a15dd587efb2b6';
export function canonical(value) {
  return value === null || typeof value !== 'object' ? JSON.stringify(value)
    : Array.isArray(value) ? `[${value.map(canonical).join(',')}]`
      : `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
}
export function sha(value) { return createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : canonical(value)).digest('hex'); }
export function refuse(code) { throw new Error(code); }
export function row(snapshot) {
  const value = snapshot.exists ? JSON.parse(JSON.stringify(snapshot.data())) : null;
  return { path: snapshot.ref.path, updateTime: snapshot.updateTime
    ? { seconds: snapshot.updateTime.seconds, nanoseconds: snapshot.updateTime.nanoseconds } : null, value, sha256: sha(value) };
}
export const QUERIES = [
  ['jobs', `${ROOT}/jobs`, 101], ['refresh', `${ROOT}/refreshRequests`, 101],
  ['scanners', `${ROOT}/intakeState`, 51], ['research', `${CONTROL}/runs`, 101],
  ['workItems', `${CONTROL}/workItems`, 101],
  ['draftWriters', `${ROOT}/gmailDraftBindings`, 51, ['state', 'in', ['writing', 'unknown']]],
  ['sendWriters', `${ROOT}/sendReceipts`, 51, ['state', 'in', ['attempting', 'unknown']]],
];
export function query(db, definition) {
  const [, path, cap, filter] = definition;
  let q = db.collection(path);
  if (filter) q = q.where(...filter);
  return q.limit(cap);
}
export async function inventory(db, tx) {
  const docs = await Promise.all([CONTROL, `${ROOT}/draftBudgetState/current`].map(async path => row(await tx.get(db.doc(path)))));
  const queries = await Promise.all(QUERIES.map(async definition => {
    const result = await tx.get(query(db, definition));
    if (result.size >= definition[2]) refuse('inventory_overflow');
    return { name: definition[0], complete: true, rows: result.docs.map(row) };
  }));
  const state = docs[1].value;
  for (const id of new Set([state?.activeAdmissionId, state?.recurringActiveAdmissionId].filter(Boolean))) {
    if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,200}$/.test(id)) refuse('admission_pointer_invalid');
    docs.push(row(await tx.get(db.doc(`${ROOT}/draftBudgetAdmissions/${id}`))));
  }
  return { docs, queries };
}
export async function readSource(db, tx, saved) {
  const hash = saved.value?.blob;
  if (!/^[a-f0-9]{64}$/.test(hash ?? '')) refuse('source_blob_missing');
  const manifest = await tx.get(db.doc(`${CONTROL}/blobs/${hash}`)), m = manifest.data();
  if (m?.sha256 !== hash || m.codec !== 'gzip' || !Number.isInteger(m.bytes) || m.bytes < 0 || m.bytes > 8_388_608
    || !Number.isInteger(m.chunks) || m.chunks < 1 || m.chunks > 33) refuse('source_manifest_invalid');
  const chunks = await Promise.all(Array.from({ length: m.chunks }, (_, i) => tx.get(db.doc(`${manifest.ref.path}/chunks/${i}`))));
  const zipped = Buffer.concat(chunks.map(chunk => {
    const bytes = chunk.data()?.bytes;
    if (!Buffer.isBuffer(bytes) || bytes.length > 262_144) refuse('source_chunk_invalid');
    return bytes;
  }));
  if (zipped.length !== m.compressed_bytes) refuse('source_compressed_size_invalid');
  const bytes = gunzipSync(zipped, { maxOutputLength: 8_388_608 });
  if (bytes.length !== m.bytes || sha(bytes) !== hash) refuse('source_digest_invalid');
  const value = JSON.parse(bytes.toString('utf8'));
  if (value.date !== saved.value.date || canonical(value.metadata) !== canonical(saved.value.metadata)) refuse('source_row_binding_invalid');
  return { path: saved.path, blobSha256: hash, value };
}
export async function inspect(db, now = Date.now) {
  return db.runTransaction(async tx => {
    const packet = await inventory(db, tx);
    const sources = await Promise.all(packet.queries.find(q => q.name === 'research').rows.map(saved => readSource(db, tx, saved)));
    return { schema: INCIDENT, project: 'blueprint-8c1ca', observedAtMs: now(), ...packet, sources };
  }, { readOnly: true });
}
export function privateWrite(path, value) {
  const bytes = JSON.stringify(value, null, 2) + '\n';
  writeFileSync(path, bytes, { mode: 0o600, flag: 'wx' });
  return sha(bytes);
}
export function existingAdmin() {
  // Resolve existing deployment dependencies. No installation, dotenv or ADC bootstrap.
  const require = createRequire(`${process.cwd()}/package.json`);
  const admin = require('firebase-admin');
  const account = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON ?? '{}');
  if (account.project_id !== 'blueprint-8c1ca' || !account.private_key || !account.client_email) refuse('existing_firebase_binding_unavailable');
  const app = admin.initializeApp({ credential: admin.credential.cert(account), storageBucket: 'blueprint-8c1ca.appspot.com' }, `incident-${process.pid}`);
  return { app, db: app.firestore(), bucket: app.storage().bucket() };
}
async function main() {
  const [mode = 'inspect', output] = process.argv.slice(2);
  if (mode !== 'inspect' || !output?.startsWith('/tmp/')) refuse('usage_inspect_private_output_required');
  const { app, db } = existingAdmin();
  try {
    const packet = await inspect(db), digest = privateWrite(output, packet);
    console.log(JSON.stringify({ ok: true, readOnly: true, schema: INCIDENT, observedAtMs: packet.observedAtMs,
      packetSha256: digest, queries: packet.queries.map(q => ({ name: q.name, count: q.rows.length, complete: q.complete })) }));
  } finally { await app.delete(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(JSON.stringify({ ok: false, code: /^[a-z_]+$/.test(error.message) ? error.message : 'incident_inspection_unavailable' })); process.exitCode = 2; });
}
