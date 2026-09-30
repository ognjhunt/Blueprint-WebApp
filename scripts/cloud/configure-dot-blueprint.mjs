#!/usr/bin/env node
// Transfer only owner-approved credentials to dot; never print secret values.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const CONTEXT = Buffer.from('blueprint-dot-access-v1');
const DOOR = 'https://paperclip.tryblueprint.io/api/live-pipeline/operator/v1';
const MAX_BYTES = 65536;
const EXPOSED_FIREBASE_KEY = '64a7d0a29c3ea1de1cefa8923e140ba770424a91';

export function privateRead(filename) {
  const fd = fs.openSync(filename, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const info = fs.fstatSync(fd);
    if (!info.isFile() || info.uid !== process.getuid() || (info.mode & 0o077) || info.size > MAX_BYTES)
      throw new Error('Unsafe private file');
    return fs.readFileSync(fd, 'utf8');
  } finally { fs.closeSync(fd); }
}

export function privateDirectory(folder) {
  fs.mkdirSync(folder, { mode: 0o700 });
  return folder;
}

function checkedDirectory(folder) {
  if (!fs.existsSync(folder)) privateDirectory(folder);
  const info = fs.lstatSync(folder);
  if (!info.isDirectory() || info.isSymbolicLink() || info.uid !== process.getuid() || (info.mode & 0o077))
    throw new Error('Unsafe private directory');
}

export function writeOnce(filename, contents, mode = 0o600) {
  if (fs.existsSync(filename) || fs.lstatSync(path.dirname(filename)).isSymbolicLink()) {
    if (privateRead(filename) !== contents) throw new Error('Existing file was preserved');
    return;
  }
  const fd = fs.openSync(filename, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, mode);
  try { fs.writeFileSync(fd, contents); } finally { fs.closeSync(fd); }
}

function publicKey(encoded) {
  const key = crypto.createPublicKey({ key: Buffer.from(encoded, 'base64'), type: 'spki', format: 'der' });
  if (key.asymmetricKeyType !== 'x25519') throw new Error('Expected X25519 public key');
  return key;
}

export function seal(credentials, recipient) {
  const peer = publicKey(recipient);
  const ephemeral = crypto.generateKeyPairSync('x25519');
  const salt = crypto.randomBytes(32), iv = crypto.randomBytes(12);
  const shared = crypto.diffieHellman({ privateKey: ephemeral.privateKey, publicKey: peer });
  const key = crypto.hkdfSync('sha256', shared, salt, CONTEXT, 32);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(CONTEXT);
  const payload = Buffer.from(JSON.stringify({ version: 1, recipient, credentials }));
  const ciphertext = Buffer.concat([cipher.update(payload), cipher.final()]);
  const result = { version: 1, publicKey: ephemeral.publicKey.export({ format: 'der', type: 'spki' }).toString('base64'),
    salt: salt.toString('base64'), iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64') };
  shared.fill(0); payload.fill(0);
  return result;
}

export function unseal(envelope, privatePem) {
  if (envelope.version !== 1) throw new Error('Unsupported transfer');
  const privateKey = crypto.createPrivateKey(privatePem);
  if (privateKey.asymmetricKeyType !== 'x25519') throw new Error('Expected X25519 private key');
  const shared = crypto.diffieHellman({ privateKey, publicKey: publicKey(envelope.publicKey) });
  const salt = Buffer.from(envelope.salt, 'base64'), iv = Buffer.from(envelope.iv, 'base64');
  const tag = Buffer.from(envelope.tag, 'base64'), ciphertext = Buffer.from(envelope.ciphertext, 'base64');
  if (salt.length !== 32 || iv.length !== 12 || tag.length !== 16 || ciphertext.length > MAX_BYTES)
    throw new Error('Invalid transfer');
  const key = crypto.hkdfSync('sha256', shared, salt, CONTEXT, 32);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAAD(CONTEXT); decipher.setAuthTag(tag);
  const clear = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  const payload = JSON.parse(clear.toString('utf8'));
  const recipient = crypto.createPublicKey(privateKey).export({ format: 'der', type: 'spki' }).toString('base64');
  clear.fill(0); shared.fill(0);
  if (payload.version !== 1 || payload.recipient !== recipient) throw new Error('Wrong recipient');
  return payload.credentials;
}

function credentialFiles(credentials, folder) {
  const names = Object.keys(credentials).sort().join(',');
  if (names !== 'firebase_service_account_json,github_dot_token,operator_door_token') throw new Error('Unexpected credentials');
  const github = credentials.github_dot_token, door = credentials.operator_door_token;
  if (typeof github !== 'string' || !/^github_pat_[A-Za-z0-9_]+$/.test(github)) throw new Error('Invalid GitHub credential');
  if (typeof door !== 'string' || !door || door.length > 16384 || /\s/.test(door)) throw new Error('Invalid operator credential');
  const firebase = credentials.firebase_service_account_json;
  if (firebase?.type !== 'service_account' || firebase.project_id !== 'blueprint-8c1ca' ||
      !/^[^@]+@blueprint-8c1ca\.iam\.gserviceaccount\.com$/.test(firebase.client_email) ||
      !firebase.private_key?.startsWith('-----BEGIN PRIVATE KEY-----') || firebase.private_key_id === EXPOSED_FIREBASE_KEY)
    throw new Error('Invalid Firebase credential');
  return [[path.join(folder, 'github_dot_token'), github], [path.join(folder, 'operator_door_token'), door],
    [path.join(folder, 'firebase_service_account.json'), JSON.stringify(firebase)]];
}

export function installCredentials(credentials, folder) {
  checkedDirectory(folder);
  const files = credentialFiles(credentials, folder);
  // Validate all existing targets before creating any file; never replace credentials.
  for (const [filename, contents] of files) {
    try { if (privateRead(filename) !== contents) throw new Error('Existing credential differs'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  for (const [filename, contents] of files) writeOnce(filename, contents);
  return files.map(([filename]) => ({ file: filename, mode: '0600' }));
}

function environment(folder) {
  checkedDirectory(folder);
  const env = { ...process.env };
  env.GH_TOKEN = privateRead(path.join(folder, 'github_dot_token')).trim();
  env.BLUEPRINT_OPERATOR_DOOR_TOKEN = privateRead(path.join(folder, 'operator_door_token')).trim();
  env.BLUEPRINT_OPERATOR_DOOR_URL = DOOR;
  const firebase = path.join(folder, 'firebase_service_account.json'); privateRead(firebase);
  // Remove inherited credentials so the saved files are the source of truth.
  delete env.FIREBASE_SERVICE_ACCOUNT_JSON;
  env.GOOGLE_APPLICATION_CREDENTIALS = firebase;
  env.GOOGLE_CLOUD_PROJECT = env.FIREBASE_PROJECT_ID = 'blueprint-8c1ca';
  const openai = path.join(folder, 'openai_api_key');
  if (fs.existsSync(openai)) {
    env.OPENAI_API_KEY = privateRead(openai).trim(); env.OPENAI_API_KEY_FILE = openai;
  }
  return env;
}

function bounded(command, args, env, input) {
  const result = spawnSync(command, args, { env, input, encoding: 'utf8', timeout: 25000, maxBuffer: MAX_BYTES });
  if (result.status !== 0 || result.error) return null;
  try { return JSON.parse(result.stdout); } catch { return null; }
}

function httpsRead(url, token) {
  const config = `url = ${JSON.stringify(url)}\nheader = ${JSON.stringify(`Authorization: Bearer ${token}`)}\n`;
  return bounded('curl', ['--disable', '--silent', '--fail', '--max-time', '20', '--max-filesize', String(MAX_BYTES), '--proto', '=https', '--config', '-'], process.env, config);
}

async function doctor(folder, env) {
  const github = {};
  for (const repo of ['Blueprint-WebApp', 'BlueprintCapturePipeline']) {
    const result = bounded('gh', ['api', `repos/ognjhunt/${repo}`, '--jq', '{push:.permissions.push}'], env);
    github[repo] = { authenticated: result !== null, pushPermission: result?.push === true };
  }
  const workflow = bounded('gh', ['api', 'repos/ognjhunt/Blueprint-WebApp/actions/workflows/deploy.yml', '--jq', '{state:.state}'], env);
  const identity = httpsRead(`${DOOR}/whoami`, env.BLUEPRINT_OPERATOR_DOOR_TOKEN);
  const status = httpsRead(`${DOOR}/status`, env.BLUEPRINT_OPERATOR_DOOR_TOKEN);
  const scopes = Array.isArray(identity?.scopes) ? identity.scopes.filter(s => ['read', 'operate', 'deploy'].includes(s)) : [];
  let firebaseRead = false;
  try {
    const require = createRequire(path.join(folder, 'firebase-runtime', 'package.json'));
    const { GoogleAuth } = require('google-auth-library');
    const credentials = JSON.parse(privateRead(env.GOOGLE_APPLICATION_CREDENTIALS));
    const auth = new GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/datastore'], clientOptions: { timeout: 15000 } });
    const token = await auth.getAccessToken();
    // The supported SDK signs/authenticates. curl bounds the read response, and
    // a field mask avoids retrieving partner document fields for this probe.
    if (token) firebaseRead = httpsRead('https://firestore.googleapis.com/v1/projects/blueprint-8c1ca/databases/(default)/documents/siteTaskBriefs?pageSize=1&mask.fieldPaths=blueprintAccessDoctorProbe', token) !== null;
  } catch { /* Never print SDK errors or document contents. */ }
  let openai = null;
  const openaiDoctor = path.join(folder, 'openai-doctor.mjs');
  if (fs.existsSync(openaiDoctor)) {
    privateRead(openaiDoctor);
    openai = bounded(process.execPath, [openaiDoctor], env);
  }
  const ready = Object.values(github).every(r => r.authenticated && r.pushPermission) && workflow?.state === 'active' &&
    scopes.includes('read') && status !== null && firebaseRead;
  console.log(JSON.stringify({ ready, github, deploymentWorkflow: workflow?.state ?? 'unverified',
    operatorDoor: { authenticated: identity !== null, statusReadable: status !== null, scopes },
    firebase: { readVerified: firebaseRead }, openai }, null, 2));
  return ready ? 0 : 1;
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === 'pack') {
    const [recipient, firebaseFile, output] = args;
    if (!recipient || !firebaseFile || !output) throw new Error('Missing pack arguments');
    const folder = path.join(os.homedir(), '.blueprint-secrets'); checkedDirectory(folder);
    const credentials = { github_dot_token: privateRead(path.join(folder, 'github_dot_token')).trim(),
      operator_door_token: privateRead(path.join(folder, 'operator_door_token')).trim(),
      firebase_service_account_json: JSON.parse(privateRead(firebaseFile)) };
    credentialFiles(credentials, folder);
    if (path.dirname(output) !== folder) throw new Error('Output must remain in the private credential directory');
    writeOnce(output, JSON.stringify(seal(credentials, recipient)));
    console.log(JSON.stringify({ encryptedBundle: output, recipientPublicKey: recipient })); return 0;
  }
  if (os.homedir() !== '/home/agent') throw new Error('Run this on dot’s /home/agent VM');
  const folder = '/home/agent/.blueprint-secrets'; checkedDirectory(folder);
  if (command === 'prepare') {
    const filename = path.join(folder, 'dot-transfer-private.pem');
    if (!fs.existsSync(filename)) {
      const pair = crypto.generateKeyPairSync('x25519');
      writeOnce(filename, pair.privateKey.export({ format: 'pem', type: 'pkcs8' }));
    }
    const privateKey = crypto.createPrivateKey(privateRead(filename));
    if (privateKey.asymmetricKeyType !== 'x25519') throw new Error('Unexpected transfer key');
    const recipient = crypto.createPublicKey(privateKey).export({ format: 'der', type: 'spki' }).toString('base64');
    console.log(`DOT_PUBLIC_KEY=${recipient}`); return 0;
  }
  if (command === 'install') {
    const input = fs.readFileSync(0, 'utf8'); if (Buffer.byteLength(input) > MAX_BYTES) throw new Error('Transfer too large');
    const envelope = JSON.parse(input);
    const credentials = unseal(envelope, privateRead(path.join(folder, 'dot-transfer-private.pem')));
    const installed = installCredentials(credentials, folder);
    const source = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8');
    writeOnce(path.join(folder, 'configure-dot-blueprint.mjs'), source);
    const launcher = '#!/usr/bin/env python3\nimport os, sys\n' +
      `os.execv(${JSON.stringify(process.execPath)}, [${JSON.stringify(process.execPath)}, '/home/agent/.blueprint-secrets/configure-dot-blueprint.mjs', 'run'] + sys.argv[1:])\n`;
    writeOnce(path.join(folder, 'with-blueprint'), launcher, 0o700);
    const runtime = path.join(folder, 'firebase-runtime'); checkedDirectory(runtime);
    const npm = spawnSync('npm', ['install', '--prefix', runtime, '--ignore-scripts', '--no-audit', '--no-fund', '--omit=dev', 'google-auth-library@10.9.1'],
      { encoding: 'utf8', timeout: 120000, maxBuffer: MAX_BYTES });
    if (npm.status !== 0) throw new Error('Firebase dependency installation failed; saved credentials were preserved');
    const env = environment(folder);
    const helper = spawnSync('gh', ['auth', 'setup-git', '--hostname', 'github.com'], { env, encoding: 'utf8', timeout: 20000, maxBuffer: MAX_BYTES });
    if (helper.status !== 0) throw new Error('Git credential helper setup failed; saved credentials were preserved');
    console.log(JSON.stringify({ installed, launcher: path.join(folder, 'with-blueprint') }));
    return doctor(folder, env);
  }
  const env = environment(folder);
  if (command === 'doctor') return doctor(folder, env);
  if (command === 'run' && args.length) {
    const child = spawnSync(args[0], args.slice(1), { env, stdio: 'inherit' });
    return child.status ?? 1;
  }
  throw new Error('Usage: prepare | install | doctor | run COMMAND [ARGS...]');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = await main(); }
  catch {
    console.error('Dot access setup failed. Existing credentials were preserved; no secret was printed.');
    process.exitCode = 1;
  }
}
