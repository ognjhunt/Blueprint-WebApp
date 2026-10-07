/** Successor policy: eadd runtime content, exact approved commit, complete immutable Git proof.
 * Historical v1 remains unchanged. Only these reviewed operational files may differ. */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { sha, refuse, privateWrite } from './communications-incident-20261006.mjs';

export const WEB_SOURCE_BASELINE = 'eadd0bf38364fd3c8dca968ea0c6690d25e18270';
export const WEB_SOURCE_INVENTORY_SHA256 = '1a3ce581af92617b45930d57c29f83372be3a453ee9205a1fa4407855244648c';
// Exact existing service recipe observed through authenticated Render reads.
// This validates configuration; it never changes it or substitutes render.yaml.
export const WEB_SOURCE_RECIPE = Object.freeze({ repo: 'https://github.com/ognjhunt/Blueprint-WebApp',
  branch: 'main', env: 'node', runtime: 'node', buildCommand: 'npm install; npm run build', startCommand: 'npm run start' });
// Exact, reviewed nonruntime files only. Keep their Git objects in the proof.
// All other source, assets, dependencies, build/start recipes and configuration
// stay locked. The verifier runs from its separately reviewed execution pin.
export const WEB_SOURCE_EXCLUSIONS = Object.freeze([
  'docs/verification/communications-incident-local-sequence-20261006.md',
  'scripts/communications-incident-20261006.mjs',
  'scripts/communications-incident-admission-20261006.mjs',
  'scripts/communications-incident-admission-20261006.test.ts',
  'scripts/communications-incident-cleanup-20261006.py',
  'scripts/communications-incident-mcp-20261006.mjs',
  'scripts/communications-incident-operator-20261006.mjs',
  'scripts/communications-incident-provider-20261006.py',
  'scripts/communications-incident-recovery-20261006.mjs',
  'scripts/communications-incident-recovery-20261006.test.ts',
  'scripts/communications-incident-summary-20261006.mjs',
  'scripts/communications-incident-web-source-20261007.mjs',
  'scripts/communications-incident-web-source-20261007.test.ts',
  'scripts/communications-incident-web-source-20261007.fixture.json.gz',
  'scripts/communications-successor-web-source-20261007.mjs',
  'scripts/communications-successor-admission-20261007.mjs',
  'scripts/communications-successor-cleanup-20261007.mjs',
  'scripts/communications-successor-cleanup-20261007.py',
  'scripts/communications-successor-operator-20261007.mjs',
  'scripts/communications-successor-admission-20261007.test.ts',
  'scripts/communications-successor-cleanup-20261007.test.ts',
  'scripts/communications-successor-web-source-20261007.fixture.json.gz',
  'scripts/communications-successor-baseline-20261007.fixture.json',
  'docs/verification/communications-successor-admission-20261007.md',
]);
export const WEB_SOURCE_POLICY_DIGEST = sha({ baseline: WEB_SOURCE_BASELINE,
  inventorySha256: WEB_SOURCE_INVENTORY_SHA256, exclusions: WEB_SOURCE_EXCLUSIONS,
  recipe: WEB_SOURCE_RECIPE,
  schema: 'blueprint.web-runtime-source-policy.v2' });
const SCHEMA = 'blueprint.web-runtime-source-proof.v2', oidPattern = /^[a-f0-9]{40}$/;
const gitOid = (type, bytes) => createHash('sha1').update(`${type} ${bytes.length}\0`).update(bytes).digest('hex');
function objectBytes(encoded, limit) {
  if (typeof encoded !== 'string' || encoded.length > limit * 2) refuse('web_source_object_invalid');
  const bytes = Buffer.from(encoded, 'base64');
  if (!bytes.length || bytes.length > limit || bytes.toString('base64') !== encoded) refuse('web_source_object_invalid');
  return bytes;
}
export function verifyWebSourceProof(proof) {
  if (proof?.schema !== SCHEMA || proof.repository !== 'ognjhunt/Blueprint-WebApp'
    || !oidPattern.test(proof.commit ?? '') || proof.policyDigest !== WEB_SOURCE_POLICY_DIGEST
    || !Array.isArray(proof.trees) || !proof.trees.length || proof.trees.length > 3000) refuse('web_source_proof_unbound');
  const commit = objectBytes(proof.commitBase64, 100000);
  if (gitOid('commit', commit) !== proof.commit) refuse('web_source_commit_identity_changed');
  const root = /^tree ([a-f0-9]{40})\n/.exec(commit.toString('utf8'))?.[1];
  if (!root) refuse('web_source_commit_tree_missing');
  const trees = new Map(), visited = new Set(), inventory = [], paths = new Set();
  let total = 0;
  for (const tree of proof.trees) {
    // Empty trees are valid Git objects; their presence is part of the inventory.
    if (!oidPattern.test(tree?.oid ?? '') || typeof tree.base64 !== 'string' || trees.has(tree.oid)) refuse('web_source_tree_invalid');
    const bytes = tree.base64 === '' ? Buffer.alloc(0) : objectBytes(tree.base64, 2000000);
    total += bytes.length;
    if (total > 20000000 || gitOid('tree', bytes) !== tree.oid) refuse('web_source_tree_identity_changed');
    trees.set(tree.oid, bytes);
  }
  const excluded = new Set(WEB_SOURCE_EXCLUSIONS), decoder = new TextDecoder('utf-8', { fatal: true });
  function walk(oid, prefix, ancestors) {
    if (!trees.has(oid) || ancestors.has(oid) || ancestors.size > 64) refuse('web_source_tree_incomplete');
    const bytes = trees.get(oid), names = new Set(), next = new Set([...ancestors, oid]);
    visited.add(oid);
    let at = 0, previous;
    while (at < bytes.length) {
      const zero = bytes.indexOf(0, at);
      if (zero < 0 || zero + 21 > bytes.length) refuse('web_source_tree_invalid');
      const header = bytes.subarray(at, zero), space = header.indexOf(32);
      const mode = header.subarray(0, space).toString('ascii');
      let name; try { name = decoder.decode(header.subarray(space + 1)); } catch { refuse('web_source_path_invalid'); }
      if (space < 1 || !['40000', '100644', '100755', '120000', '160000'].includes(mode)
        || !name || /[\\/\0\r\n\t]/.test(name) || ['.', '..', '.git'].includes(name) || names.has(name)) refuse('web_source_path_invalid');
      const key = Buffer.from(name + (mode === '40000' ? '/' : '\0'));
      if (previous && Buffer.compare(previous, key) >= 0) refuse('web_source_tree_order_invalid');
      previous = key; names.add(name);
      const path = prefix + name, object = bytes.subarray(zero + 1, zero + 21).toString('hex');
      at = zero + 21;
      if (paths.has(path) || paths.size >= 20000 || path.length > 4096) refuse('web_source_path_invalid');
      paths.add(path);
      const type = mode === '40000' ? 'tree' : mode === '160000' ? 'commit' : 'blob';
      if (excluded.has(path)) {
        if (mode !== '100644' || type !== 'blob') refuse('web_source_exclusion_not_regular');
      } else inventory.push({ path, mode, type, ...(type !== 'tree' ? { sha: object } : {}) });
      if (type === 'tree') walk(object, path + '/', next);
    }
  }
  walk(root, '', new Set());
  if (visited.size !== trees.size) refuse('web_source_unused_tree_objects');
  inventory.sort((a, b) => Buffer.compare(Buffer.from(a.path), Buffer.from(b.path)));
  if (sha(inventory) !== WEB_SOURCE_INVENTORY_SHA256) refuse('web_source_runtime_content_changed');
  return { commit: proof.commit, policyDigest: WEB_SOURCE_POLICY_DIGEST, inventorySha256: WEB_SOURCE_INVENTORY_SHA256 };
}
export function checkWebSourceProof(proof, authority) {
  if (authority?.expectedWebCommit !== proof?.commit
    || authority?.expectedWebSourcePolicyDigest !== WEB_SOURCE_POLICY_DIGEST
    || !proof || authority?.expectedWebSourceProofDigest !== sha(proof)) refuse('web_source_owner_pin_missing');
  return verifyWebSourceProof(proof);
}
/** Collect immutable objects only; every accepting consumer verifies policy. */
export function collectWebSourceProof(repository, commit) {
  if (!oidPattern.test(commit ?? '')) refuse('exact_web_source_commit_required');
  const git = args => execFileSync('git', ['-C', repository, ...args],
    { maxBuffer: 20000000, env: { ...process.env, GIT_NO_REPLACE_OBJECTS: '1' } });
  const raw = git(['cat-file', 'commit', commit]), root = /^tree ([a-f0-9]{40})\n/.exec(raw.toString())?.[1];
  if (!root) refuse('web_source_commit_tree_missing');
  const ids = [...new Set([root, ...git(['ls-tree', '-r', '-t', '--format=%(objecttype) %(objectname)', commit])
    .toString().split('\n').filter(line => line.startsWith('tree ')).map(line => line.slice(5))])].sort();
  const batch = execFileSync('git', ['-C', repository, 'cat-file', '--batch'],
    { input: ids.join('\n') + '\n', maxBuffer: 20000000, env: { ...process.env, GIT_NO_REPLACE_OBJECTS: '1' } });
  let at = 0;
  const trees = ids.map(oid => {
    const end = batch.indexOf(10, at), fields = batch.subarray(at, end).toString().split(' '), size = Number(fields[2]);
    if (end < at || fields[0] !== oid || fields[1] !== 'tree' || !Number.isSafeInteger(size) || size < 0
      || batch[end + 1 + size] !== 10) refuse('web_source_git_read_incomplete');
    const bytes = batch.subarray(end + 1, end + 1 + size); at = end + size + 2;
    return { oid, base64: bytes.toString('base64') };
  });
  if (at !== batch.length) refuse('web_source_git_read_incomplete');
  const proof = { schema: SCHEMA, repository: 'ognjhunt/Blueprint-WebApp', commit,
    policyDigest: WEB_SOURCE_POLICY_DIGEST, commitBase64: raw.toString('base64'), trees };
  return proof;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [mode, repository, commit, output] = process.argv.slice(2);
    if (mode !== 'create' || !repository || !output?.startsWith('/tmp/')) refuse('explicit_private_source_proof_required');
    const proof = collectWebSourceProof(repository, commit); verifyWebSourceProof(proof);
    const fileSha256 = privateWrite(output, proof);
    console.log(JSON.stringify({ ok: true, readOnly: true, commit, policyDigest: WEB_SOURCE_POLICY_DIGEST,
      sourceProofDigest: sha(proof), fileSha256 }));
  } catch (error) {
    console.error(JSON.stringify({ ok: false, code: /^[a-z_]+$/.test(error.message) ? error.message : 'web_source_proof_unavailable' })); process.exitCode = 2;
  }
}
