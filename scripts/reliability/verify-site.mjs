/** Offline site reliability gate. No server bootstrap, provider or production credentials. */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync, mkdtempSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const parent = path.join(root, 'work/site-reliability');
mkdirSync(parent, { recursive: true });
const out = mkdtempSync(path.join(parent, 'verification-'));
const preload = path.join(root, 'scripts/reliability/deny-egress.cjs');
const egress = path.join(out, 'unexpected-egress.jsonl');
const env = Object.fromEntries(['PATH', 'HOME', 'TMPDIR'].filter(k => process.env[k]).map(k => [k, process.env[k]]));
Object.assign(env, { NODE_ENV: 'test', BLUEPRINT_DISABLE_LOCAL_ENV_BOOTSTRAP: '1',
  BLUEPRINT_DISABLE_OPS_AUTOMATION_SCHEDULER: '1', NODE_OPTIONS: `--require=${preload}`,
  BLUEPRINT_TEST_EGRESS_LOG: egress });
const sources = [
  'client/tests/pages/ClaimSite.test.tsx', 'client/tests/components/ProtectedRoute.test.tsx',
  'server/tests/site-claim-route.test.ts', 'server/tests/site-task-brief-status.test.ts',
  'server/tests/site-task-brief-scope.test.ts', 'server/tests/film-link-handoff.test.ts',
  'server/tests/capture-outbox.test.ts', 'server/tests/email-provider-receipt.test.ts',
  'server/tests/site-video-judgment-provenance.test.ts', 'server/tests/site-video-cycle-provenance.test.ts',
  'server/tests/agent-ask-evidence-boundary.test.ts', 'server/tests/inbound-request-commit.test.ts',
  'server/tests/site-task-received-email.test.ts', 'server/tests/inbound-request-ownership.test.ts',
  'server/tests/pilot-recommendation-notifications.test.ts', 'server/tests/pilot-recommendation-route.test.ts',
  'server/tests/pilot-booking-notification.test.ts',
  'server/tests/task-item-routes.test.ts', 'server/tests/task-item-inventory.test.ts',
  'server/tests/task-item-initialization.test.ts', 'server/tests/task-item-mutations.test.ts',
  'server/tests/self-capture-status-failure.test.ts', 'server/tests/capture-link-at-submit.test.ts',
  'server/tests/site-capture-bundle-routes.test.ts',
];
for (const source of sources) if (!existsSync(path.join(root, source))) throw new Error(`Missing required suite: ${source}`);
// Validate the network guard separately; this expected denial is not an application attempt.
const guard = spawnSync(process.execPath, ['-e', 'try{require("node:net").connect(443,"fixture.invalid");process.exit(2)}catch(e){process.exit(e.code==="BLUEPRINT_TEST_EGRESS_DENIED"?0:3)}'],
  { cwd: root, env: { ...env, BLUEPRINT_TEST_EGRESS_LOG: path.join(out, 'guard-negative.jsonl') }, encoding: 'utf8', timeout: 10000 });
if (guard.status !== 0) throw new Error('Network negative control failed');
const report = path.join(out, 'vitest.json');
const started = new Date().toISOString();
const result = spawnSync(process.execPath, [path.join(root, 'node_modules/vitest/vitest.mjs'), 'run', ...sources,
  '--maxWorkers=1', '--minWorkers=1', '--reporter=json', `--outputFile=${report}`],
  { cwd: root, env, encoding: 'utf8', timeout: 180000, maxBuffer: 8 * 1024 * 1024 });
writeFileSync(path.join(out, 'runner.log'), `${result.stdout || ''}\n${result.stderr || ''}`);
let parsed;
try { parsed = JSON.parse(readFileSync(report, 'utf8')); } catch { parsed = null; }
const results = Array.isArray(parsed?.testResults) ? parsed.testResults : [];
const assertions = results.flatMap(r => Array.isArray(r?.assertionResults) ? r.assertionResults : []);
const seen = new Set(results.map(r => typeof r?.name === 'string' ? path.relative(root, r.name) : '<invalid>'));
const blocked = existsSync(egress) ? readFileSync(egress, 'utf8').trim().split('\n').filter(Boolean).length : 0;
const success = result.status === 0 && parsed?.success === true && assertions.length > 0
  && sources.every(s => seen.has(s)) && seen.size === sources.length
  && results.length === sources.length
  && results.every(r => r?.status === 'passed' && Array.isArray(r.assertionResults) && r.assertionResults.length > 0)
  && parsed.numTotalTests === assertions.length && parsed.numFailedTests === 0
  && parsed.numPendingTests === 0 && assertions.every(a => a?.status === 'passed') && blocked === 0;
const git = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
const summary = { schema: 'blueprint.site-reliability-verification.v1', started, finished: new Date().toISOString(),
  sourceSha: git.status === 0 ? git.stdout.trim() : null,
  trackedSourceDirty: spawnSync('git', ['diff', '--quiet', 'HEAD'], {cwd:root}).status !== 0,
  runnerSha256: createHash('sha256').update(readFileSync(fileURLToPath(import.meta.url))).digest('hex'),
  networkGuardSha256: createHash('sha256').update(readFileSync(preload)).digest('hex'), success, exitCode: result.status,
  signal: result.signal, runnerError: result.error?.message || null,
  requiredSuites: sources.length, discoveredSuites: seen.size, assertions: assertions.length,
  failed: assertions.filter(a => a?.status === 'failed').length,
  skippedOrUnknown: assertions.filter(a => a?.status !== 'passed' && a?.status !== 'failed').length,
  unexpectedEgress: blocked, networkNegativeControl: 'passed',
  sourceIdentities: sources.map(s => ({path:s,sha256:createHash('sha256').update(readFileSync(path.join(root,s))).digest('hex')})),
  evidence: {report:'vitest.json',log:'runner.log'},
  boundary:'Offline fixtures and installed SDK serialization; not live datastore/provider or physical proof.' };
writeFileSync(path.join(out, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify({ success, sourceSha:summary.sourceSha, assertions:summary.assertions, unexpectedEgress:blocked, output:out }));
process.exitCode = success ? 0 : 1;
