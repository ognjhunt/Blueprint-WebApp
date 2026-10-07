// Read-only native proof preparation; release/deploy remain in the cloud owner.
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
const [code, uri, generation, digest, output] = process.argv.slice(2);
if (!code?.startsWith('/tmp/') || resolve(code) !== code || !output?.startsWith('/tmp/') || resolve(output) !== output)
  throw Error('private_exact_directories_required');
const hashes = {
 'communications-incident-20261006.mjs':'5a0801e9b3402821f5e1a650663b6128874c147fd151a49455590f25b36027d9',
 'communications-incident-provider-20261006.py':'98a51b3fe56cd248cdd5b9cbcd74a8bfa8698ba2c29fcb94a2f40dff396a0cc2',
 'communications-incident-summary-20261006.mjs':'82613479a8950a27cdf3af4f110b810001cd1a4d66371ad024069e2f7776398c',
 'communications-incident-admission-20261006.mjs':'44aac8ed6a05aaf33b98b8167e88616f2337bd9a4d026ac8a5d9e457acbaf53e',
 'communications-incident-recovery-20261006.mjs':'b3382b26d27fcb6486cda10523074afbf8aa98cb85e84d8e08f56ffbecf674d8',
 'communications-incident-cleanup-20261006.py':'278d7d8ddb42260bd6b84cc1b0c8432fdbd46d635023d7bf768b056df3eea1b1',
 'communications-incident-mcp-20261006.mjs':'040a9e6a7f3660447c264577a32cd317f6fb95312bd48404e9e216d31e859aeb',
 'communications-incident-operator-20261006.mjs':'0053c94e5b6dd59c09ed0dd1586b81295c85c89e2e52ffa005aafea123f55178',
 'communications-incident-web-source-20261007.mjs':'8723fd6ce153dd997644bbf26a8acea16b4348ada4ed1f0caea256bf923047ca',
};
for (const [name, expected] of Object.entries(hashes)) {
  if (createHash('sha256').update(readFileSync(`${code}/scripts/${name}`)).digest('hex') !== expected)
    throw Error('reviewed_native_helper_bytes_changed');
}
const load = name => import(pathToFileURL(`${code}/scripts/${name}`).href);
const { existingAdmin, sha, privateWrite } = await load('communications-incident-20261006.mjs');
const { AUDIT, checkFence, archiveFiles, verifyArchive } = await load('communications-incident-recovery-20261006.mjs');
const { assembleProof } = await load('communications-incident-operator-20261006.mjs');
const { inspectRuntime } = await load('communications-incident-admission-20261006.mjs');
const prefix = 'gs://blueprint-8c1ca.appspot.com/operations/communications/incident-20261006/';
if (!uri?.startsWith(prefix) || !/^[0-9]+$/.test(generation ?? '') || !/^[a-f0-9]{64}$/.test(digest ?? ''))
  throw Error('generation_pinned_fresh_platform_required');
mkdirSync(output, { mode: 0o700 });
const { app, db, bucket } = existingAdmin();
try {
  const file = bucket.file(uri.slice('gs://blueprint-8c1ca.appspot.com/'.length), { generation });
  const [metadata] = await file.getMetadata(), [bytes] = await file.download();
  if (String(metadata.generation) !== generation || Number(metadata.size) !== bytes.length || bytes.length > 20_000_000 || sha(bytes) !== digest)
    throw Error('fresh_platform_bytes_changed');
  const platform = JSON.parse(bytes);
  const audit = (await db.doc(AUDIT).get()).data();
  await verifyArchive(bucket, audit.archive);
  const files = {};
  for (const name of ['canonical', 'provider', 'authority']) {
    const rows = audit.archive.objects.filter(row => row.name.endsWith(`/${name}.json`));
    if (rows.length !== 1) throw Error('original_recovery_bytes_missing');
    const row = rows[0];
    const [original] = await bucket.file(row.name, { generation: row.generation }).download();
    if (sha(original) !== row.sha256 || original.length !== row.bytes) throw Error('original_recovery_bytes_changed');
    files[`${name}.json`] = original;
  }
  const runtime = await inspectRuntime();
  privateWrite(`${output}/native-runtime.json`, runtime);
  const fresh = assembleProof(platform, runtime);
  const authority = { ...JSON.parse(files['authority.json']),
    expectedMcpReceiptDigests: fresh.authority.expectedMcpReceiptDigests,
    processProofDigest: sha(fresh.proof),
    canonicalFileSha256: sha(files['canonical.json']), providerFileSha256: sha(files['provider.json']) };
  // Immutable audit authority, Web/policy and MCP scope stay unchanged. Only
  // permitted per-proof hashes rotate. No old observation receives a new date.
  privateWrite(`${output}/process-proof.json`, fresh.proof);
  files['process-proof.json'] = readFileSync(`${output}/process-proof.json`);
  authority.processProofFileSha256 = sha(files['process-proof.json']);
  checkFence(fresh.proof, authority, Date.now());
  privateWrite(`${output}/authority.json`, authority);
  files['authority.json'] = readFileSync(`${output}/authority.json`);
  const archive = await archiveFiles(bucket, files); await verifyArchive(bucket, archive);
  const manifest = { schema: 'blueprint.outreach-release-proof-files.v1', files: archive.objects.map(row => ({
    name: row.name.split('/').at(-1), uri: `gs://${archive.bucket}/${row.name}`,
    generation: row.generation, bytes: row.bytes, sha256: row.sha256,
  })) };
  const hash = privateWrite(`${output}/release-proof-manifest.json`, manifest);
  const retained = await archiveFiles(bucket, { 'release-proof-manifest.json': readFileSync(`${output}/release-proof-manifest.json`) });
  await verifyArchive(bucket, retained);
  const object = retained.objects[0];
  checkFence(fresh.proof, authority, Date.now());
  console.log(JSON.stringify({ ok: true, nativeFactsFresh: true, dbMutation: false, recoveryReplayed: false,
    uri: `gs://${retained.bucket}/${object.name}`, generation: object.generation, sha256: hash, bytes: object.bytes,
    proofObservedAtMs: fresh.proof.observedAtMs, workerResumeAuthorized: false, sendsAuthorized: false, paidAdmissionAuthorized: false }));
} finally { await app.delete(); }
