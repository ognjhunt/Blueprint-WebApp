#!/usr/bin/env node
// Read-only checks. No dotenv, credential values, pushes, merges, or deploys.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPOSITORY = 'ognjhunt/Blueprint-WebApp';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export function run(command, args, cwd = ROOT) {
  const result = spawnSync(command, args, {
    cwd, encoding: 'utf8', timeout: 20000, maxBuffer: 1024 * 1024,
    env: { ...process.env, GH_DEBUG: '', GIT_TRACE: '0', GIT_TRACE_CURL: '0',
      GIT_TERMINAL_PROMPT: '0', GIT_SSH_COMMAND: 'ssh -oBatchMode=yes -oConnectTimeout=10' },
  });
  // Raw stderr can contain credentials. It never enters the report.
  return { ok: result.status === 0 && !result.error, stdout: result.stdout || '' };
}

export function inspectReleaseEnvironment({ execute = run, present = existsSync,
  offline = false, auditDeployConfig = false, root = ROOT } = {}) {
  const checks = [];
  const add = (status, name, detail, fix) => checks.push({ status, name, detail, ...(fix ? { fix } : {}) });
  const gh = (path) => {
    const result = execute('gh', ['api', '--method', 'GET', path], root);
    if (!result.ok) return null;
    try { return JSON.parse(result.stdout); } catch { return null; }
  };
  const node = execute('node', ['--version'], root);
  add(node.ok && /^v(?:2[0-9]|[3-9][0-9])\./.test(node.stdout.trim()) ? 'PASS' : 'FAIL',
    'node', 'Node 20 or newer is required', 'Install Node 20 or newer');
  for (const command of ['npm', 'git', 'gh']) {
    add(execute(command, ['--version'], root).ok ? 'PASS' : 'FAIL', command,
      'command availability', `Install ${command}`);
  }
  const dependencies = ['tsx', 'vitest', '@playwright/test', 'typescript'];
  add(dependencies.every((pkg) => present(resolve(root, 'node_modules', pkg, 'package.json'))) ? 'PASS' : 'FAIL',
    'dependencies', 'WebApp development dependencies', 'Run bash scripts/cloud/setup-webapp.sh');
  const remote = execute('git', ['remote', 'get-url', '--push', 'origin'], root);
  const url = remote.stdout.trim();
  const https = /^https:\/\/github\.com\/ognjhunt\/Blueprint-WebApp(?:\.git)?$/.test(url);
  const ssh = /^git@github\.com:ognjhunt\/Blueprint-WebApp(?:\.git)?$/.test(url);
  add(remote.ok && (https || ssh) ? 'PASS' : 'FAIL', 'repository',
    `origin targets ${REPOSITORY}; transport=${https ? 'HTTPS' : ssh ? 'SSH' : 'unrecognized'}`,
    `Use an origin for ${REPOSITORY}; never put a token in the URL`);

  if (offline) {
    add('WARN', 'access', 'Offline checks do not verify GitHub or deployment access',
      'Run node scripts/cloud/release-doctor.mjs before release work');
    return { ready: false, offline, checks };
  }

  const repo = gh(`repos/${REPOSITORY}`);
  const canWrite = repo?.full_name === REPOSITORY && repo?.permissions?.push === true;
  add(canWrite ? 'PASS' : 'FAIL', 'GitHub repository access',
    canWrite ? 'Authenticated repository write permission' : 'Repository write access could not be verified',
    'Connect GitHub or supply a scoped GH_TOKEN personal environment value; allow api.github.com');
  if (remote.ok && (https || ssh)) {
    const reachable = execute('git', ['ls-remote', url, 'refs/heads/main'], root);
    add(reachable.ok && /^[0-9a-f]{40}\s+refs\/heads\/main\s*$/.test(reachable.stdout.trim()) ? 'PASS' : 'FAIL',
      'git transport', 'Noninteractive access to origin/main (read access only)',
      'In an isolated cloud clone, use HTTPS and gh auth setup-git --hostname github.com; allow github.com');
  }
  const workflow = gh(`repos/${REPOSITORY}/actions/workflows/deploy.yml`);
  add(workflow?.state === 'active' ? 'PASS' : 'FAIL', 'deployment owner',
    workflow?.state === 'active' ? 'GitHub Actions deploy.yml is active; local Render variables are unnecessary'
      : 'Cannot verify an active deploy.yml workflow',
    'Check GitHub Actions read access and the repository deployment workflow');
  const runs = gh(`repos/${REPOSITORY}/actions/workflows/deploy.yml/runs?per_page=1`);
  const latest = runs?.workflow_runs?.[0];
  add(latest?.conclusion === 'success' ? 'PASS' : 'WARN', 'last deployment workflow',
    latest?.conclusion === 'success' ? `Successful workflow run ${latest.id}` : 'Latest deployment is pending, failed, or unreadable',
    'Inspect the deployment workflow and its deploy-verification artifact; do not infer a deploy from a merge');

  if (auditDeployConfig) {
    const secrets = gh(`repos/${REPOSITORY}/actions/secrets?per_page=100`);
    const vars = gh(`repos/${REPOSITORY}/actions/variables?per_page=100`);
    // An unreadable list is not proof that a setting is absent. Pagination is
    // rejected rather than treating a partial first page as an exhaustive list.
    const complete = Array.isArray(secrets?.secrets) && secrets.total_count <= 100
      && Array.isArray(vars?.variables) && vars.total_count <= 100;
    const configured = complete && secrets.secrets.some((item) => item.name === 'RENDER_API_KEY')
      && ['RENDER_SERVICE_ID', 'RENDER_WORKER_SERVICE_ID'].every((name) =>
        vars.variables.some((item) => item.name === name && /^srv-[a-z0-9]+$/.test(item.value || '')));
    add(configured ? 'PASS' : 'FAIL', 'Actions deployment configuration',
      !complete ? 'Configuration metadata is unreadable or incomplete; absence is unproven'
        : configured ? 'Render secret and both service variables exist in Actions (values omitted)'
          : 'A required Render secret or service variable is missing or invalid in Actions',
      'Have the repository owner audit Actions secrets/variables; secret values are never needed here');
  }
  return { ready: checks.every((check) => check.status !== 'FAIL'), offline, checks };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.some((arg) => !['--offline', '--json', '--audit-deploy-config'].includes(arg))) {
    console.error('Usage: node scripts/cloud/release-doctor.mjs [--offline] [--json] [--audit-deploy-config]');
    process.exitCode = 2;
  } else {
    const report = inspectReleaseEnvironment({ offline: args.includes('--offline'),
      auditDeployConfig: args.includes('--audit-deploy-config') });
    if (args.includes('--json')) console.log(JSON.stringify(report, null, 2));
    else {
      for (const check of report.checks) {
        console.log(`${check.status.padEnd(4)} ${check.name}: ${check.detail}`);
        if (check.status !== 'PASS' && check.fix) console.log(`     ${check.fix}`);
      }
      console.log(report.offline ? 'Offline toolchain check only; release access remains unverified.'
        : report.ready ? 'Release access checks passed. CI, merge authorization, and exact-SHA deploy proof remain required.'
          : 'Release access checks failed. Resolve access before promising a push, merge, or deployment.');
    }
    process.exitCode = report.checks.some((check) => check.status === 'FAIL') ? 1 : 0;
  }
}
