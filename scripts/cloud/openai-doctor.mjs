#!/usr/bin/env node
// Read-only Agents API access check. Never creates agents, sessions, or turns.
import { spawnSync } from 'node:child_process';
import { lstatSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function inspectOpenAIAccess({ env = process.env, execute = spawnSync } = {}) {
  let key = env.OPENAI_API_KEY;
  if (!key && env.OPENAI_API_KEY_FILE) {
    try {
      const file = lstatSync(env.OPENAI_API_KEY_FILE);
      if (!file.isFile() || file.isSymbolicLink() || file.size > 16384 || (file.mode & 0o077)) {
        return { ready: false, detail: 'Credential file must be a private regular file (mode 0600)' };
      }
      key = readFileSync(env.OPENAI_API_KEY_FILE, 'utf8').trim();
    } catch { return { ready: false, detail: 'Credential file is unreadable' }; }
  }
  if (!key || /[\r\n]/.test(key)) {
    return { ready: false, detail: 'OPENAI_API_KEY is missing or malformed in this environment' };
  }
  // curl honors the cloud HTTPS proxy. Headers arrive on stdin, never argv.
  // --disable ignores user curl configuration; redirects remain disabled.
  const escaped = key.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
  const config = `header = "Authorization: Bearer ${escaped}"\nheader = "OpenAI-Beta: agents=v1"\n`;
  const result = execute('curl', ['--disable', '--config', '-', '--silent', '--show-error',
    '--max-time', '20', '--max-filesize', '65536', '--proto', '=https',
    '--request', 'GET', '--write-out', '\n%{http_code}',
    'https://api.openai.com/v1/agents/sessions?limit=1'],
  { input: config, encoding: 'utf8', timeout: 25000, maxBuffer: 65540 });
  // Provider bodies and raw errors may echo credentials; never report them.
  if (result.error || result.status !== 0) {
    return { ready: false, detail: 'OpenAI HTTPS request failed; check curl and proxy/network access' };
  }
  const output = result.stdout || '';
  const status = Number(output.slice(output.lastIndexOf('\n') + 1));
  let valid = false;
  try { valid = Array.isArray(JSON.parse(output.slice(0, output.lastIndexOf('\n'))).data); } catch { /* fail closed */ }
  return { ready: status === 200 && valid, httpStatus: status,
    detail: status === 200 && valid ? 'Agents API read access verified; creation and inference remain unproven'
      : status === 401 ? 'Credential rejected by OpenAI'
        : status === 403 ? 'Agents API access denied; check project access and key permissions'
          : 'Agents API read access could not be verified' };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = inspectOpenAIAccess();
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.ready ? 0 : 1;
}
