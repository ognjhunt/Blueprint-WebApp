import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// Explicit content and backend/helper paths use related tests plus safety tests.
// Unknown paths, route composition, UI, rules, dependencies and CI fail to full.
export function releaseScope(files) {
  if (!files.length) return 'full';
  const content = /^(client\/src\/data\/(deploymentMarket|qualifyingEnvironments)\.ts|client\/src\/lib\/captureGroundedLanguage\.ts)$/;
  if (files.every(file => content.test(file))) return 'content';
  // Backend/helper releases get their dependency-related tests plus the fixed
  // safety floor. Route composition, UI, rules, migrations, dependencies,
  // workflow and unknown paths retain full browser/integration verification.
  const targetedCode = /^(server\/(utils|agents)\/.+\.ts|client\/src\/lib\/.+\.ts|server\/routes\/client-runtime-config\.ts|server\/tests\/.+\.test\.ts|client\/tests\/lib\/.+\.test\.ts)$/;
  return files.every(file => targetedCode.test(file) || content.test(file)) ? 'code' : 'full';
}
export function changedFiles(base) {
  execFileSync('git', ['rev-parse', '--verify', `${base}^{commit}`]);
  return execFileSync('git', ['diff', '--name-only', '-z', base, 'HEAD'], {encoding:'utf8'})
    .split('\0').filter(Boolean);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const mode = process.argv[2];
  const base = process.env.RELEASE_BASE;
  // A missing/zero push base is deliberately broad, never an empty green test run.
  const files = base && !/^0+$/.test(base) ? changedFiles(base) : [];
  const scope = files.some(file => !existsSync(file)) ? 'full' : releaseScope(files);
  if (mode === 'scope') {
    if (!process.env.GITHUB_OUTPUT) throw Error('github_output_missing');
    appendFileSync(process.env.GITHUB_OUTPUT, `scope=${scope}\n`);
    console.log(JSON.stringify({scope, changedFiles:files.length}));
  } else if (mode === 'test') {
    const start = Date.now();
    if (scope === 'full') execFileSync('npm', ['run','test:coverage'], {stdio:'inherit'});
    else {
      const safety = ['server/tests/auth-middleware.test.ts','server/tests/agent-spend-policy.test.ts',
        'server/tests/agent-spend-atomic.test.ts','server/tests/capture-owner-route-auth.test.ts',
        'server/tests/agent-spend-ledger.test.ts','server/tests/agent-private-evidence.test.ts',
        'server/tests/agent-task-prompts.test.ts'];
      for (const file of [...files, ...safety]) if (!existsSync(file)) throw Error(`release_file_missing:${file}`);
      // --passWithNoTests is deliberately absent: no related coverage fails closed.
      const sources = files.filter(file => !/\.(test|spec)\.[tj]sx?$/.test(file));
      const changedTests = files.filter(file => /\.(test|spec)\.[tj]sx?$/.test(file));
      if (sources.length) execFileSync('npx', ['vitest','related','--run',...sources], {stdio:'inherit'});
      if (changedTests.length) execFileSync('npx', ['vitest','run',...changedTests], {stdio:'inherit'});
      execFileSync('npx', ['vitest','run',...safety], {stdio:'inherit'});
    }
    console.log(JSON.stringify({scope,elapsedMs:Date.now()-start}));
  } else throw Error('usage: checks.mjs scope|test');
}
