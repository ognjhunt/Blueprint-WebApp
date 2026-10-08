import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const project = process.env.RELIABILITY_PROJECT ?? 'demo-blueprint-reliability';
if (!/^demo-blueprint-reliability(?:-a|-b)?$/.test(project)) throw new Error('Only dedicated demo projects supported');
const port = Number(process.env.RELIABILITY_APP_PORT ?? '4181');
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid local app port');
// The launcher never inherits credentials, provider keys, dotenv, or live service addresses.
const env = Object.fromEntries(['PATH', 'HOME', 'TMPDIR'].filter(key => process.env[key]).map(key => [key, process.env[key]]));
Object.assign(env, {
  NODE_ENV: 'test', BLUEPRINT_DISABLE_LOCAL_ENV_BOOTSTRAP: '1', GOOGLE_CLOUD_PROJECT: project, GCLOUD_PROJECT: project,
  FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080', FIREBASE_STORAGE_EMULATOR_HOST: '127.0.0.1:9199',
  FIREBASE_STORAGE_BUCKET: `${project}.appspot.com`,
  FIELD_ENCRYPTION_MASTER_KEY: Buffer.alloc(32, 1).toString('base64'), BLUEPRINT_REQUEST_REVIEW_TOKEN_SECRET: 'owned-local-reliability-fixture-secret-never-production',
  APP_URL: `http://127.0.0.1:${port}`, RELIABILITY_APP_PORT: String(port),
  BLUEPRINT_DISABLE_OPS_AUTOMATION_SCHEDULER: '1', BLUEPRINT_SITE_VIDEO_EVIDENCE_ENABLED: '0',
  BLUEPRINT_BETA_ENABLED: 'false',
  VITE_FIREBASE_API_KEY: 'local-fixture-key', VITE_FIREBASE_AUTH_DOMAIN: 'localhost', VITE_FIREBASE_PROJECT_ID: project,
  VITE_FIREBASE_STORAGE_BUCKET: `${project}.appspot.com`, VITE_FIREBASE_MESSAGING_SENDER_ID: '123456', VITE_FIREBASE_APP_ID: '1:123456:web:fixture',
});
const child = spawn(process.execPath, ['--import', 'tsx', path.join(root, 'scripts/qa/reliability-local-app.ts')], { cwd: root, env, stdio: 'inherit' });
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => child.kill(signal));
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
