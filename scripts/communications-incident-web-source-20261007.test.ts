import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { collectWebSourceProof, verifyWebSourceProof, checkWebSourceProof, WEB_SOURCE_POLICY_DIGEST,
  WEB_SOURCE_INVENTORY_SHA256, WEB_SOURCE_EXCLUSIONS } from './communications-incident-web-source-20261007.mjs';
import { sha } from './communications-incident-20261006.mjs';

const git = (...args: string[]) => execFileSync('git', args);
// HEAD is available in shallow CI checkouts. Its full tracked content must
// satisfy the fixed ce8 policy even after this source-only repair is merged.
const head = git('rev-parse', 'HEAD').toString().trim();
const proof = collectWebSourceProof(process.cwd(), head);
const authority = (value: any = proof) => ({ expectedWebCommit: value.commit,
  expectedWebSourcePolicyDigest: WEB_SOURCE_POLICY_DIGEST, expectedWebSourceProofDigest: sha(value) });
function candidate(path: string, mode = '100644', remove = false) {
  const directory = mkdtempSync(join(tmpdir(), 'incident-source-candidate-'));
  try {
    git('init', '--bare', '--quiet', directory);
    const objects = resolve(git('rev-parse', '--git-path', 'objects').toString().trim());
    mkdirSync(join(directory, 'objects/info'), { recursive: true });
    writeFileSync(join(directory, 'objects/info/alternates'), objects + '\n');
    const run = (args: string[], input?: string) => execFileSync('git', ['-C', directory, ...args], { input,
      env: { ...process.env, GIT_NO_REPLACE_OBJECTS: '1', GIT_AUTHOR_NAME: 'Synthetic', GIT_COMMITTER_NAME: 'Synthetic',
        GIT_DIR: directory, GIT_INDEX_FILE: join(directory, 'index'), GIT_OBJECT_DIRECTORY: join(directory, 'objects'),
        GIT_ALTERNATE_OBJECT_DIRECTORIES: objects,
        GIT_AUTHOR_EMAIL: 'synthetic@example.invalid', GIT_COMMITTER_EMAIL: 'synthetic@example.invalid' } });
    run(['read-tree', head]);
    if (remove) run(['update-index', '--index-info'], `0 ${'0'.repeat(40)}\t${path}\n`);
    else {
      const blob = run(['hash-object', '-w', '--stdin'], 'synthetic changed content\n').toString().trim();
      run(['update-index', '--add', '--cacheinfo', mode, blob, path]);
    }
    const tree = run(['write-tree']).toString().trim();
    const commit = run(['commit-tree', tree, '-p', head, '-m', 'Synthetic offline source candidate']).toString().trim();
    return collectWebSourceProof(directory, commit);
  } finally { rmSync(directory, { recursive: true, force: true }); }
}
describe('exact immutable Web source policy', () => {
  it('proves the real current Git commit and complete source-only merged tree', () => {
    expect(verifyWebSourceProof(proof)).toEqual({ commit: head, policyDigest: WEB_SOURCE_POLICY_DIGEST,
      inventorySha256: WEB_SOURCE_INVENTORY_SHA256 });
    expect(checkWebSourceProof(proof, authority())).toMatchObject({ commit: head });
  });
  it.each(['scripts/communications-incident-admission-20261006.mjs',
    'scripts/communications-incident-web-source-20261007.mjs',
    'docs/verification/communications-incident-local-sequence-20261006.md'])
    ('admits a different actual commit changing only reviewed nonruntime %s', path => {
      const value = candidate(path);
      expect(value.commit).not.toBe(head);
      expect(checkWebSourceProof(value, authority(value))).toMatchObject({ commit: value.commit });
    });
  it.each(['server/index.ts', 'server/config/bootstrap-env.ts', 'server/utils/opsAutomationScheduler.ts',
    'server/routes.ts', 'package.json', 'package-lock.json', 'render.yaml', 'scripts/prepare-daily-research.mjs',
    'scripts/unreviewed-runtime.mjs', 'client/src/pages/Home.tsx'])
    ('rejects a valid actual Git commit with changed unreviewed %s', path => {
      const value = candidate(path);
      expect(() => checkWebSourceProof(value, authority(value))).toThrow('web_source_runtime_content_changed');
    });
  it('rejects deletion, mode changes and symlink replacement of excluded files', () => {
    expect(() => verifyWebSourceProof(candidate('server/index.ts', '100644', true))).toThrow('web_source_runtime_content_changed');
    for (const mode of ['100755', '120000']) {
      expect(() => verifyWebSourceProof(candidate(WEB_SOURCE_EXCLUSIONS[1], mode))).toThrow('web_source_exclusion_not_regular');
    }
  });
  it.each([
    (v: any) => { v.commit = 'a'.repeat(40); },
    (v: any) => { v.commitBase64 = Buffer.from('tree ' + 'a'.repeat(40) + '\n').toString('base64'); },
    (v: any) => { v.trees.pop(); },
    (v: any) => { v.trees.push(v.trees[0]); },
    (v: any) => { v.trees[0].base64 = Buffer.from('unreviewed').toString('base64'); },
    (v: any) => { v.trees[0].base64 += '\n'; },
    (v: any) => { v.policyDigest = 'b'.repeat(64); },
    (v: any) => { v.repository = 'foreign/repository'; },
    (v: any) => { v.trees.push({ oid: createHash('sha1').update('tree 0\0').digest('hex'), base64: '' }); },
  ])('rejects forged, omitted, duplicate, unused or relabelled Git source objects', change => {
    const value = structuredClone(proof); change(value);
    expect(() => checkWebSourceProof(value, authority(value))).toThrow();
  });
  it('requires all explicit owner pins and never infers approval from source evidence', () => {
    for (const field of ['expectedWebCommit', 'expectedWebSourcePolicyDigest', 'expectedWebSourceProofDigest']) {
      const owner: any = authority(); delete owner[field];
      expect(() => checkWebSourceProof(proof, owner)).toThrow('web_source_owner_pin_missing');
    }
    expect(() => checkWebSourceProof(undefined, authority())).toThrow('web_source_owner_pin_missing');
  });
  it.each([
    ['traversal', '100644 ..'], ['slash', '100644 bad/child'], ['backslash', '100644 bad\\child'],
    ['mode', '100666 bad'], ['duplicate', '100644 same', '100644 same'],
    ['file/directory collision', '100644 same', '40000 same'],
    ['ordering', '100644 z', '100644 a'],
  ])('rejects validly hashed Git objects containing %s ambiguity', (_name, ...entries) => {
    const bytes = Buffer.concat(entries.map(entry => Buffer.concat([Buffer.from(entry + '\0'), Buffer.alloc(20, 1)])));
    const oid = (type: string, value: Buffer) => createHash('sha1').update(`${type} ${value.length}\0`).update(value).digest('hex');
    const root = oid('tree', bytes), value = structuredClone(proof);
    const commit = Buffer.from(Buffer.from(value.commitBase64, 'base64').toString().replace(/^tree [a-f0-9]{40}/, `tree ${root}`));
    value.commit = oid('commit', commit); value.commitBase64 = commit.toString('base64');
    value.trees = [{ oid: root, base64: bytes.toString('base64') }];
    expect(() => checkWebSourceProof(value, authority(value))).toThrow();
  });
});
