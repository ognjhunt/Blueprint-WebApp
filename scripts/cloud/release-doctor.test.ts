// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { inspectReleaseEnvironment, REPOSITORY } from './release-doctor.mjs';

function fixture(overrides: Record<string, unknown> = {}) {
  const responses: Record<string, unknown> = {
    [`repos/${REPOSITORY}`]: { full_name: REPOSITORY, permissions: { push: true } },
    [`repos/${REPOSITORY}/actions/workflows/deploy.yml`]: { state: 'active' },
    [`repos/${REPOSITORY}/actions/workflows/deploy.yml/runs?per_page=1`]: {
      workflow_runs: [{ id: 123, conclusion: 'success' }],
    },
    [`repos/${REPOSITORY}/actions/secrets?per_page=100`]: {
      total_count: 1, secrets: [{ name: 'RENDER_API_KEY' }],
    },
    [`repos/${REPOSITORY}/actions/variables?per_page=100`]: {
      total_count: 2, variables: [
        { name: 'RENDER_SERVICE_ID', value: 'srv-privatewebid' },
        { name: 'RENDER_WORKER_SERVICE_ID', value: 'srv-privateworkerid' },
      ],
    },
    ...overrides,
  };
  const calls: string[][] = [];
  const execute = (command: string, args: string[]) => {
    calls.push([command, ...args]);
    if (command === 'gh' && args[0] === 'api') {
      const data = responses[args.at(-1)!];
      return data === null ? { ok: false, stdout: 'secret-must-not-leak' }
        : { ok: true, stdout: JSON.stringify(data) };
    }
    if (command === 'node') return { ok: true, stdout: 'v22.0.0' };
    if (command === 'git' && args[0] === 'remote') {
      return { ok: true, stdout: `https://github.com/${REPOSITORY}.git` };
    }
    if (command === 'git' && args[0] === 'ls-remote') {
      return { ok: true, stdout: `${'a'.repeat(40)}\trefs/heads/main\n` };
    }
    return { ok: true, stdout: '' };
  };
  return { execute, present: () => true, calls };
}

describe('cloud release access', () => {
  it('uses Actions deployment credentials without requiring local Render secrets', () => {
    const f = fixture();
    const report = inspectReleaseEnvironment({ ...f, auditDeployConfig: true });
    expect(report.ready).toBe(true);
    expect(JSON.stringify(report)).not.toContain('srv-private');
    expect(f.calls.filter((call) => call[1] === 'api').every((call) => call[2] === '--method' && call[3] === 'GET')).toBe(true);
    expect(f.calls.some((call) => call.includes('push') || call.includes('merge'))).toBe(false);
  });

  it('fails before release work when authentication or write permission is missing', () => {
    for (const repo of [null, { full_name: REPOSITORY, permissions: { push: false } }]) {
      const report = inspectReleaseEnvironment(fixture({ [`repos/${REPOSITORY}`]: repo }));
      expect(report.ready).toBe(false);
      expect(JSON.stringify(report)).not.toContain('secret-must-not-leak');
    }
  });

  it('distinguishes unreadable metadata from missing configuration', () => {
    const path = `repos/${REPOSITORY}/actions/secrets?per_page=100`;
    const denied = inspectReleaseEnvironment({ ...fixture({ [path]: null }), auditDeployConfig: true });
    const absent = inspectReleaseEnvironment({ ...fixture({ [path]: { total_count: 0, secrets: [] } }), auditDeployConfig: true });
    expect(denied.ready).toBe(false);
    expect(denied.checks.at(-1)?.detail).toContain('absence is unproven');
    expect(absent.ready).toBe(false);
    expect(absent.checks.at(-1)?.detail).toContain('missing or invalid');
  });

  it('rejects partial metadata, invalid service IDs, and a disabled deploy workflow', () => {
    for (const overrides of [
      { [`repos/${REPOSITORY}/actions/secrets?per_page=100`]: { total_count: 101, secrets: [] } },
      { [`repos/${REPOSITORY}/actions/variables?per_page=100`]: { total_count: 0, variables: [] } },
      { [`repos/${REPOSITORY}/actions/workflows/deploy.yml`]: { state: 'disabled_manually' } },
    ]) expect(inspectReleaseEnvironment({ ...fixture(overrides), auditDeployConfig: true }).ready).toBe(false);
  });

  it('does not make network calls or certify release access in offline mode', () => {
    const f = fixture();
    const report = inspectReleaseEnvironment({ ...f, offline: true });
    expect(report.ready).toBe(false);
    expect(f.calls.some((call) => call.includes('api') || call.includes('ls-remote'))).toBe(false);
  });

  it('fails on git credential failures even when API authentication works', () => {
    const f = fixture();
    const report = inspectReleaseEnvironment({ ...f, execute: (command: string, args: string[]) =>
      args[0] === 'ls-remote' ? { ok: false, stdout: 'secret-must-not-leak' } : f.execute(command, args) });
    expect(report.ready).toBe(false);
    expect(JSON.stringify(report)).not.toContain('secret-must-not-leak');
  });

  it('rejects credential-bearing or unrelated remotes without probing or echoing them', () => {
    const f = fixture();
    const report = inspectReleaseEnvironment({ ...f, execute: (command: string, args: string[]) =>
      args[0] === 'remote' ? { ok: true, stdout: `https://secret-must-not-leak@github.com/${REPOSITORY}.git` }
        : f.execute(command, args) });
    expect(report.ready).toBe(false);
    expect(JSON.stringify(report)).not.toContain('secret-must-not-leak');
    expect(f.calls.some((call) => call.includes('ls-remote'))).toBe(false);
  });
});
