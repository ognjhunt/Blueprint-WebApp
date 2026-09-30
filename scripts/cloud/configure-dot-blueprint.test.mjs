import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { seal, unseal, installCredentials, privateRead } from './configure-dot-blueprint.mjs';

function keys() {
  const pair = crypto.generateKeyPairSync('x25519');
  return { publicKey: pair.publicKey.export({ format: 'der', type: 'spki' }).toString('base64'),
    privateKey: pair.privateKey.export({ format: 'pem', type: 'pkcs8' }) };
}

function fixture() {
  return { github_dot_token: 'github_pat_test_fixture_only', operator_door_token: 'test-fixture-only',
    firebase_service_account_json: { type: 'service_account', project_id: 'blueprint-8c1ca',
      client_email: 'test@blueprint-8c1ca.iam.gserviceaccount.com', private_key_id: 'test-fixture-only',
      private_key: '-----BEGIN PRIVATE KEY-----\ntest-fixture-only\n-----END PRIVATE KEY-----' } };
}

test('encrypted transfer hides credentials and requires the recipient key', () => {
  const recipient = keys(), other = keys(), credentials = fixture();
  const envelope = seal(credentials, recipient.publicKey);
  assert(!JSON.stringify(envelope).includes(credentials.github_dot_token));
  assert.deepEqual(unseal(envelope, recipient.privateKey), credentials);
  assert.throws(() => unseal(envelope, other.privateKey));
  const ciphertext = Buffer.from(envelope.ciphertext, 'base64'); ciphertext[0] ^= 1;
  assert.throws(() => unseal({ ...envelope, ciphertext: ciphertext.toString('base64') }, recipient.privateKey));
});

test('installation saves private files, is repeatable, and preflights existing credentials', () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'dot-access-test-')); fs.chmodSync(folder, 0o700);
  try {
    const credentials = fixture(); installCredentials(credentials, folder);
    for (const name of ['github_dot_token', 'operator_door_token', 'firebase_service_account.json'])
      assert.equal(fs.statSync(path.join(folder, name)).mode & 0o777, 0o600);
    installCredentials(credentials, folder);
    assert.throws(() => installCredentials({ ...credentials, operator_door_token: 'different-fixture' }, folder));
    assert.equal(privateRead(path.join(folder, 'operator_door_token')), credentials.operator_door_token);
  } finally { fs.rmSync(folder, { recursive: true }); }
});

test('symlinks, broad permissions, extra credentials and the exposed key are rejected', () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'dot-access-test-')); fs.chmodSync(folder, 0o700);
  try {
    const credentials = fixture();
    assert.throws(() => installCredentials({ ...credentials, unexpected: 'not-allowed' }, folder));
    assert.throws(() => installCredentials({ ...credentials, firebase_service_account_json: {
      ...credentials.firebase_service_account_json, private_key_id: '64a7d0a29c3ea1de1cefa8923e140ba770424a91' } }, folder));
    const existing = path.join(folder, 'existing'); fs.writeFileSync(existing, 'existing-fixture', { mode: 0o600 });
    fs.symlinkSync(existing, path.join(folder, 'github_dot_token'));
    assert.throws(() => installCredentials(credentials, folder));
    assert(!fs.existsSync(path.join(folder, 'operator_door_token')));
    fs.chmodSync(existing, 0o644); assert.throws(() => privateRead(existing));
    fs.chmodSync(folder, 0o755); assert.throws(() => installCredentials(credentials, folder));
  } finally { fs.rmSync(folder, { recursive: true }); }
});
