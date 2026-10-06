// Exact parent-operated evidence retention; no provider/database/control mutation.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const [sourceRoot, canonicalPath, providerPath] = process.argv.slice(2);
if (![sourceRoot, canonicalPath, providerPath].every(value => typeof value === 'string' && value.startsWith('/tmp/'))) throw Error('explicit_private_paths_required');
const { existingAdmin, sha, privateWrite, INCIDENT } = await import(pathToFileURL(`${sourceRoot}/scripts/communications-incident-20261006.mjs`).href);
const { archiveFiles, verifyArchive } = await import(pathToFileURL(`${sourceRoot}/scripts/communications-incident-recovery-20261006.mjs`).href);
const inputs = [
  ['runtime-before-fence.json', '/tmp/lap259-runtime-before-fence-1833.json', 'f78dcbc9cc341219328ba6e78b10c0eeefe52fa1feada1c201be84560a9f8b2c'],
  ['canonical-before-fence.json', canonicalPath, '9ba30aa5692885c939a2efa31b1e38d9313df208397fe33c47adf9a8182c0f0b'],
  ['provider-before-fence.json', providerPath, '1d556ffbc9393e5087b257abd219aeb2414000df0e83ae2e45afe7171b3f7324'],
];
const files = Object.fromEntries(inputs.map(([name, path, digest]) => {
  const bytes = readFileSync(path);
  if (bytes.length > 20_000_000 || sha(bytes) !== digest) throw Error('retained_input_digest_changed');
  return [name, bytes];
}));
const baseline = JSON.parse(files['runtime-before-fence.json']), canonical = JSON.parse(files['canonical-before-fence.json']), provider = JSON.parse(files['provider-before-fence.json']);
if (baseline.schema !== 'blueprint.disabled-worker-runtime.v1' || baseline.sourceCommit !== 'c4db1d2f61970efda3a226c9715345718a2064f5'
  || canonical.schema !== INCIDENT || canonical.project !== 'blueprint-8c1ca' || provider.readOnly !== true
  || provider.canonicalFileSha256 !== sha(files['canonical-before-fence.json'])) throw Error('retained_packet_binding_changed');
files['retention-manifest.json'] = Buffer.from(JSON.stringify({ schema: 'blueprint.incident-pre-fence-files.v1',
  incident: 'lap259-20261006', parentThread: '01a0fe81-486b-7714-9e81-983a66bd80c4',
  sourceCommit: '42689320a674422adc36641d78c5c8ccc85b1982', purpose: 'exact_pre_change_evidence_preservation_only',
  records: inputs.map(([name]) => ({ name, bytes: files[name].length, sha256: sha(files[name]) })),
  processFenceEstablished: false, recoveryAuthorized: false, paidAdmissionAuthorized: false, sendsAuthorized: false }) + '\n');
const { app, bucket } = existingAdmin();
try {
  const archive = await archiveFiles(bucket, files);
  await verifyArchive(bucket, archive);
  const receiptPath = '/tmp/lap259-pre-fence-company-archive-20261006.json';
  privateWrite(receiptPath, { schema: 'blueprint.incident-pre-fence-preservation.v1', incident: 'lap259-20261006',
    parentThread: '01a0fe81-486b-7714-9e81-983a66bd80c4', purpose: 'retain_exact_pre_change_evidence_only', archive,
    observedAtMs: Date.now(), processFenceEstablished: false, recoveryAuthorized: false, paidAdmissionAuthorized: false, sendsAuthorized: false });
  console.log(JSON.stringify({ ok: true, state: 'pre_fence_bytes_retained_and_verified', bucket: archive.bucket,
    bindingDigest: archive.bindingDigest, objectCount: archive.objects.length, receiptPath,
    manifest: archive.objects.find(object => object.name.endsWith('/retention-manifest.json')) }));
} finally { await app.delete(); }
