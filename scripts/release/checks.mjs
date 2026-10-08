import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// Only explicitly bounded, non-authority content enters the short path.
// Unknown paths, auth, budget, storage, dependencies and CI always fail to full.
export function releaseScope(files) {
  return files.length > 0 && files.every(file =>
    /^(client\/src\/data\/(deploymentMarket|qualifyingEnvironments)\.ts|client\/src\/lib\/captureGroundedLanguage\.ts)$/.test(file)
  ) ? 'content' : 'full';
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
  const scope = releaseScope(files);
  if (mode === 'scope') {
    if (!process.env.GITHUB_OUTPUT) throw Error('github_output_missing');
    appendFileSync(process.env.GITHUB_OUTPUT, `scope=${scope}\n`);
    console.log(JSON.stringify({scope, changedFiles:files.length}));
  } else if (mode === 'test') {
    const start = Date.now();
    if (scope === 'full') execFileSync('npm', ['run','test:coverage'], {stdio:'inherit'});
    else {
      const safety = ['server/tests/auth-middleware.test.ts','server/tests/agent-spend-policy.test.ts',
        'server/tests/agent-spend-atomic.test.ts','server/tests/capture-owner-route-auth.test.ts'];
      for (const file of [...files, ...safety]) if (!existsSync(file)) throw Error(`release_file_missing:${file}`);
      // --passWithNoTests is deliberately absent: no related coverage fails closed.
      execFileSync('npx', ['vitest','related','--run',...files], {stdio:'inherit'});
      execFileSync('npx', ['vitest','run',...safety], {stdio:'inherit'});
    }
    console.log(JSON.stringify({scope,elapsedMs:Date.now()-start}));
  } else throw Error('usage: checks.mjs scope|test');
}
