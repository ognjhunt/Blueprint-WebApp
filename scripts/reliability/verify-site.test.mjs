/** Validator fault tests, not site journey evidence. Runs only synthetic reports.
 * Usage: node --test scripts/reliability/verify-site.test.mjs
 * ADP-010/day-7: a missing required suite must not become a successful closeout.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const sourceDir = path.dirname(fileURLToPath(import.meta.url));
const runnerSource = readFileSync(path.join(sourceDir, 'verify-site.mjs'), 'utf8');
const sourceList = runnerSource.match(/const sources = \[([\s\S]*?)\];/);
assert.ok(sourceList, 'The test must discover the runner’s actual required suite list');
const sources = [...sourceList[1].matchAll(/['"]([^'"]+\.(?:tsx?|jsx?))['"]/g)].map(m => m[1]);
assert.ok(sources.length > 0);

const reporter = `
import fs from 'node:fs';
import path from 'node:path';
const {mode, sources} = JSON.parse(fs.readFileSync('mutation.json', 'utf8'));
const destination = process.argv.find(s => s.startsWith('--outputFile=')).slice('--outputFile='.length);
const rows = sources.map(name => ({name:path.resolve(name), status:'passed',
  assertionResults:[{title:'synthetic validator control',status:'passed'}]}));
if (mode === 'zero_global') rows.forEach(r => r.assertionResults = []);
if (mode === 'zero_one_suite') rows[0].assertionResults = [];
if (mode === 'missing_suite') rows.pop();
if (mode === 'duplicate_suite') rows.push({...rows[0]});
if (mode === 'failed_suite') rows[0].status = 'failed';
if (mode === 'skipped_assertion') rows[0].assertionResults[0].status = 'pending';
if (mode === 'failed_assertion') rows[0].assertionResults[0].status = 'failed';
if (mode === 'unknown_assertion') rows[0].assertionResults[0] = null;
const total = rows.reduce((n,r) => n+r.assertionResults.length,0);
if (mode === 'malformed_assertions') rows[0].assertionResults = {};
const report = {success:true,numTotalTests:mode === 'wrong_count' ? total+1 : total,
  numFailedTests:0,numPendingTests:0,testResults:mode === 'malformed_rows' ? {} : rows};
// Simulate the application's unexpected-egress signal without opening a socket.
// Actual preload denial has its own negative control in every runner invocation.
if (mode === 'egress_logged') fs.appendFileSync(process.env.BLUEPRINT_TEST_EGRESS_LOG,
  JSON.stringify({event:'synthetic-validator-egress-signal'})+'\\n');
fs.writeFileSync(destination, mode === 'malformed_json' ? 'broken JSON' : JSON.stringify(report));
if (process.env.BLUEPRINT_RELIABILITY_TEST_SECRET) throw new Error('Inherited credential-like env leaked');
process.exitCode = mode === 'nonzero_exit' ? 1 : 0;
`;

const cases = [
  'all_pass', 'zero_global', 'zero_one_suite', 'missing_suite', 'duplicate_suite',
  'failed_suite', 'skipped_assertion', 'failed_assertion', 'unknown_assertion',
  'wrong_count', 'malformed_assertions', 'malformed_rows', 'malformed_json',
  'egress_logged', 'nonzero_exit', 'missing_source',
];

for (const mode of cases) {
  test(`verification aggregator: ${mode}`, () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'blueprint-validator-test-'));
    try {
      mkdirSync(path.join(root, 'scripts/reliability'), {recursive:true});
      for (const filename of ['verify-site.mjs', 'deny-egress.cjs']) {
        copyFileSync(path.join(sourceDir, filename), path.join(root, 'scripts/reliability', filename));
      }
      for (const source of sources) {
        mkdirSync(path.dirname(path.join(root, source)), {recursive:true});
        writeFileSync(path.join(root, source), '// Synthetic validator-only placeholder.\n');
      }
      if (mode === 'missing_source') rmSync(path.join(root, sources[0]));
      mkdirSync(path.join(root, 'node_modules/vitest'), {recursive:true});
      writeFileSync(path.join(root, 'node_modules/vitest/vitest.mjs'), reporter);
      writeFileSync(path.join(root, 'mutation.json'), JSON.stringify({mode, sources}));
      const child = spawnSync(process.execPath, [path.join(root, 'scripts/reliability/verify-site.mjs')], {
        cwd:root, encoding:'utf8', timeout:15000,
        env:{...process.env, BLUEPRINT_RELIABILITY_TEST_SECRET:'synthetic-must-not-propagate'},
      });
      assert.equal(child.error, undefined, child.stderr);
      assert.equal(child.status, mode === 'all_pass' ? 0 : 1, child.stdout + child.stderr);
      if (mode === 'missing_source') {
        assert.match(child.stderr, /Missing required suite:/);
        return;
      }
      const outputRoot = path.join(root, 'work/site-reliability');
      const directories = readdirSync(outputRoot).filter(name => name.startsWith('verification-'));
      assert.equal(directories.length, 1);
      const summary = JSON.parse(readFileSync(path.join(outputRoot, directories[0], 'summary.json'), 'utf8'));
      assert.equal(summary.success, mode === 'all_pass');
      assert.equal(summary.networkNegativeControl, 'passed');
      assert.equal(summary.requiredSuites, sources.length);
      if (mode === 'egress_logged') assert.equal(summary.unexpectedEgress, 1);
      if (mode === 'all_pass') {
        assert.equal(summary.discoveredSuites, sources.length);
        assert.equal(summary.assertions, sources.length);
        assert.equal(summary.unexpectedEgress, 0);
      }
    } finally {
      rmSync(root, {recursive:true, force:true});
    }
  });
}
