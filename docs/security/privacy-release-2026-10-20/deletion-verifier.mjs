// Bounded production QA; execution requires the release owner's confirmed SHA.
// Never prints passwords/tokens, records browser traces, sends mail, or erases an account.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

delete process.env.DEBUG;
delete process.env.PWDEBUG;
const base = 'https://tryblueprint.io';
const projectId = 'blueprint-8c1ca';
const root = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const expectedSha = argv[argv.indexOf('--expected-sha') + 1];
const execute = argv.includes('--execute-live');
const fixturePath = path.join(root, 'deletion-fixture-owner.json');
const privateDir = path.join(root, '.private');
const secretPath = path.join(privateDir, 'deletion-fixture-credentials.json');
const evidencePath = path.join(root, 'deletion-live-evidence.json');
const lockPath = path.join(root, 'deletion-execution.lock');
const check = (condition, code) => { if (!condition) { const e = new Error(code); e.safeCode = code; throw e; } };
const readJson = async p => JSON.parse(await fs.readFile(p, 'utf8'));
const writeJson = async (p, value, exclusive = false) => {
  await fs.writeFile(p, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600, flag: exclusive ? 'wx' : 'w' });
  await fs.chmod(p, 0o600);
};
const exists = async p => fs.stat(p).then(() => true, () => false);
const version = async () => {
  const response = await fetch(`${base}/version.json?privacy_qa=${Date.now()}`, {
    signal: AbortSignal.timeout(20_000), redirect: 'error', headers: { 'Cache-Control': 'no-cache' },
  });
  check(response.ok, 'version_endpoint_failed');
  const body = await response.json();
  check(body.git_sha === expectedSha, 'deployed_sha_does_not_match');
  return { git_sha: body.git_sha, checkedAtIso: new Date().toISOString() };
};

if (!execute) {
  console.log(JSON.stringify({ status: 'prepared_not_executed', command: 'node output/qa/privacy-live/deletion-verifier.mjs --expected-sha <release-owner-confirmed-40-character-SHA> --execute-live', scope: 'One synthetic account; browser login; request and receipt; known-document readback; unprivileged admin 403.' }));
  process.exit(0);
}

let browser, firebaseApp, lock;
let stage = 'preflight';
let fixture;
const report = { schemaVersion: 'privacy_live_deletion_verification.v1', startedAtIso: new Date().toISOString(), status: 'running', expectedSha, baseUrl: base, firebaseProjectId: projectId, syntheticFixtureOnly: true, actualErasureExecuted: false, mailRequested: false, checks: {}, safeNetwork: [] };
try {
  check(/^[a-f0-9]{40}$/.test(expectedSha || ''), 'confirmed_full_sha_required');
  check(Boolean(process.env.CODEX_THREAD_ID), 'verified_owner_required');
  check(!process.env.FIREBASE_AUTH_EMULATOR_HOST && !process.env.FIRESTORE_EMULATOR_HOST, 'emulator_environment_refused');
  check(Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS), 'existing_google_credentials_required');
  const credentialStat = await fs.stat(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  check(credentialStat.isFile(), 'credentials_not_regular_file');
  const credentialMetadata = await readJson(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  check(credentialMetadata.type === 'service_account' && credentialMetadata.project_id === projectId, 'credential_project_or_type_mismatch');
  await fs.mkdir(root, { recursive: true, mode: 0o700 });
  await fs.mkdir(privateDir, { recursive: true, mode: 0o700 });
  await fs.chmod(privateDir, 0o700);
  lock = await fs.open(lockPath, 'wx', 0o600);
  await lock.writeFile(JSON.stringify({ ownerThreadId: process.env.CODEX_THREAD_ID, startedAtIso: report.startedAtIso }));
  report.verifierSha256 = crypto.createHash('sha256').update(await fs.readFile(fileURLToPath(import.meta.url))).digest('hex');
  report.releaseBefore = await version();
  const { chromium } = await import('playwright');
  browser = await chromium.launch({ headless: true });
  const { initializeApp, applicationDefault, deleteApp } = await import('firebase-admin/app');
  const { getAuth } = await import('firebase-admin/auth');
  const { getFirestore } = await import('firebase-admin/firestore');
  firebaseApp = initializeApp({ credential: applicationDefault(), projectId }, `privacy-qa-${crypto.randomBytes(6).toString('hex')}`);
  const auth = getAuth(firebaseApp);
  const db = getFirestore(firebaseApp);
  if (process.env.BLUEPRINT_FIRESTORE_PREFER_REST === '1') db.settings({ preferRest: true });

  stage = 'fixture_preparation';
  if (await exists(fixturePath)) {
    fixture = await readJson(fixturePath);
    check(fixture.ownerThreadId === process.env.CODEX_THREAD_ID, 'fixture_owner_changed');
    check(fixture.deployedSha === expectedSha && fixture.projectId === projectId, 'fixture_release_or_project_changed');
    check(/^privacy-qa-[a-f0-9]{12}-[a-f0-9]{12}$/.test(fixture.uid), 'fixture_uid_not_synthetic');
    check(fixture.email === `${fixture.uid}@example.invalid`, 'fixture_email_not_reserved');
    check(await exists(secretPath), 'fixture_private_credentials_missing');
  } else {
    check(!(await exists(secretPath)), 'orphan_fixture_credentials_preserved');
    const uid = `privacy-qa-${expectedSha.slice(0, 12)}-${crypto.randomBytes(6).toString('hex')}`;
    fixture = { schemaVersion: 'privacy_qa_fixture_owner.v1', synthetic: true, uid, email: `${uid}@example.invalid`, projectId, deployedSha: expectedSha, ownerThreadId: process.env.CODEX_THREAD_ID, purpose: 'Owner-authorized live account deletion REQUEST verification; no actual erasure or mail.', createdIntentAtIso: new Date().toISOString(), state: 'create_intent', requestId: `deletion_${crypto.createHash('sha256').update(uid).digest('hex')}`, preservation: 'Retain exact fixture and pending request for operator review. Exclude this exact UID from account-notice recipient lists. This local manifest is creation evidence, not a production test-account flag.' };
    await writeJson(secretPath, { uid, email: fixture.email, password: `Pq!${crypto.randomBytes(36).toString('base64url')}9a` }, true);
    await writeJson(fixturePath, fixture, true);
  }
  const credentials = await readJson(secretPath);
  check(credentials.uid === fixture.uid && credentials.email === fixture.email, 'credential_fixture_mismatch');
  let before;
  try { before = await auth.getUser(fixture.uid); }
  catch (error) { check(error?.code === 'auth/user-not-found', 'fixture_lookup_failed'); }
  if (!before) {
    check(fixture.state === 'create_intent', 'previous_fixture_missing_do_not_recreate');
    stage = 'fixture_create';
    await auth.createUser({ uid: fixture.uid, email: fixture.email, password: credentials.password, displayName: 'Synthetic privacy QA - no real person', emailVerified: false, disabled: false });
    fixture.state = 'created';
    fixture.createdAtIso = new Date().toISOString();
    await writeJson(fixturePath, fixture);
  }
  const created = await auth.getUser(fixture.uid);
  check(created.email === fixture.email && !created.disabled && !created.emailVerified, 'fixture_identity_state_mismatch');
  check(Object.keys(created.customClaims || {}).length === 0, 'fixture_has_custom_claims');
  report.fixture = { uid: fixture.uid, email: fixture.email, ownerThreadId: fixture.ownerThreadId, requestId: fixture.requestId, createdAtIso: created.metadata.creationTime, customClaimKeys: [], emailVerified: false };
  if (await exists(evidencePath)) report.previousAttempt = await readJson(evidencePath);
  await writeJson(evidencePath, report);

  stage = 'real_browser_sign_in';
  const context = await browser.newContext({ viewport: { width: 1365, height: 1000 }, serviceWorkers: 'block' });
  const page = await context.newPage();
  page.setDefaultTimeout(35_000);
  let ownAuthorization = null;
  let authPostCount = 0;
  const ownPosts = [];
  const listeners = [];
  page.on('response', response => {
    const promise = (async () => {
      const url = new URL(response.url());
      if (url.hostname === 'identitytoolkit.googleapis.com' && url.pathname.endsWith('accounts:signInWithPassword')) {
        authPostCount += 1;
        report.checks.realPasswordSignInStatus = response.status();
      }
      if (url.origin === base && url.pathname === '/api/account-deletion') {
        const request = response.request();
        ownAuthorization = request.headers()['authorization'] || ownAuthorization;
        report.safeNetwork.push({ method: request.method(), path: url.pathname, status: response.status() });
        if (request.method() === 'POST') {
          const headers = request.headers();
          ownPosts.push({ status: response.status(), confirmationOnly: JSON.stringify(request.postDataJSON()) === JSON.stringify({ confirmation: 'DELETE' }), csrfPresent: Boolean(headers['x-csrf-token']), bearerPresent: Boolean(headers['authorization']), body: await response.json() });
        }
      }
    })();
    listeners.push(promise);
  });
  await page.goto(`${base}/settings?privacy=1`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Sign in', exact: true }).waitFor();
  const reject = page.getByRole('button', { name: 'Reject all', exact: true });
  if (await reject.waitFor({ state: 'visible', timeout: 2500 }).then(() => true, () => false)) await reject.click();
  await page.getByLabel('Email', { exact: true }).fill(credentials.email);
  await page.getByLabel('Password', { exact: true }).fill(credentials.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL(url => !url.pathname.startsWith('/sign-in'), { timeout: 45_000 });
  if (new URL(page.url()).pathname !== '/settings' || new URL(page.url()).searchParams.get('privacy') !== '1') {
    await page.goto(`${base}/settings?privacy=1`, { waitUntil: 'domcontentloaded' });
  }
  await page.getByRole('heading', { name: 'Delete my account and data', exact: true }).waitFor();
  await Promise.all(listeners);
  check(authPostCount === 1 && report.checks.realPasswordSignInStatus === 200, 'real_password_sign_in_not_proven');
  report.checks.realPasswordSignInCount = authPostCount;
  const receiptHeading = page.getByRole('heading', { name: 'Deletion requested', exact: true });
  const submit = page.getByRole('button', { name: 'Request account and data deletion', exact: true });
  await Promise.race([submit.waitFor(), receiptHeading.waitFor()]);
  stage = 'browser_deletion_request';
  if (await submit.isVisible()) {
    check(await submit.isDisabled(), 'confirmation_not_required');
    await page.getByLabel('Type DELETE to confirm the request', { exact: true }).fill('DELETE');
    await submit.click();
    await receiptHeading.waitFor();
    await Promise.all(listeners);
    check(ownPosts.length === 1 && ownPosts[0].status === 202, 'request_not_accepted_once');
    check(ownPosts[0].csrfPresent && ownPosts[0].bearerPresent && ownPosts[0].confirmationOnly, 'normal_auth_csrf_confirmation_not_proven');
    check(ownPosts[0].body.request?.id === fixture.requestId && ownPosts[0].body.request?.status === 'requested', 'receipt_identity_mismatch');
    report.acceptedReceipt = ownPosts[0].body;
    report.checks.browserSubmission = { status: 202, confirmationRequired: true, csrfPresent: true, bearerPresent: true };
  } else {
    check(await exists(evidencePath), 'unexplained_existing_receipt');
    report.checks.browserSubmission = { resumedExistingSyntheticRequest: true };
  }
  check(await page.getByText(fixture.requestId, { exact: true }).isVisible(), 'receipt_reference_not_visible');
  check(await page.getByText(/This receipt does not confirm deletion/).isVisible(), 'request_only_boundary_missing');
  const beforeReloadResponse = page.waitForResponse(response => new URL(response.url()).origin === base && new URL(response.url()).pathname === '/api/account-deletion' && response.request().method() === 'GET');
  await page.reload({ waitUntil: 'domcontentloaded' });
  const reloaded = await beforeReloadResponse;
  check(reloaded.status() === 200, 'receipt_reload_request_failed');
  const reloadedReceipt = await reloaded.json();
  check(reloadedReceipt.request?.id === fixture.requestId && reloadedReceipt.request?.status === 'requested', 'receipt_reload_mismatch');
  await receiptHeading.waitFor();
  await page.screenshot({ path: path.join(root, 'deletion-request-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'mobile_horizontal_overflow');
  await page.screenshot({ path: path.join(root, 'deletion-request-mobile.png'), fullPage: true });
  report.reloadedReceipt = reloadedReceipt;
  report.checks.reloadRestoredSameRequest = true;
  report.checks.mobileNoHorizontalOverflow = true;

  stage = 'independent_known_document_readback';
  const stored = await db.collection('accountDeletionRequests').doc(fixture.requestId).get();
  check(stored.exists, 'known_request_document_missing');
  const record = stored.data();
  check(record.accountUid === fixture.uid && record.accountEmail === fixture.email && record.id === fixture.requestId && record.status === 'requested', 'stored_request_does_not_match');
  report.firestoreReadback = { path: `projects/${projectId}/databases/(default)/documents/accountDeletionRequests/${fixture.requestId}`, schemaVersion: record.schemaVersion, id: record.id, accountUid: record.accountUid, accountEmail: record.accountEmail, status: record.status, requestedAtIso: record.requestedAtIso, reviewerUid: record.reviewerUid, checkedAtIso: new Date().toISOString() };
  const profile = await db.collection('users').doc(fixture.uid).get();
  const profileData = profile.data() || {};
  report.profileReadback = { exists: profile.exists, uidMatches: profileData.uid === fixture.uid, emailMatches: profileData.email === fixture.email, finishedOnboarding: profileData.finishedOnboarding ?? null };
  const retained = await auth.getUser(fixture.uid);
  check(!retained.disabled && retained.email === fixture.email, 'fixture_unexpectedly_disabled_or_changed');
  check(Object.keys(retained.customClaims || {}).length === 0, 'fixture_became_privileged');
  report.checks.accountRemainsActive = true;

  stage = 'unprivileged_admin_denial';
  check(Boolean(ownAuthorization), 'own_session_header_not_observed');
  const denied = await context.request.get(`${base}/api/account-deletion/admin`, { headers: { Authorization: ownAuthorization }, timeout: 20_000 });
  ownAuthorization = null;
  check(denied.status() === 403, 'unprivileged_admin_queue_not_denied');
  report.checks.unprivilegedAdminQueueStatus = 403;
  report.checks.adminQueueReadback = 'Not attempted: no existing ops identity was independently approved for this run.';
  report.releaseAfter = await version();
  fixture.state = 'pending_request_retained_for_operator_review';
  fixture.requestVerifiedAtIso = new Date().toISOString();
  await writeJson(fixturePath, fixture);
  report.status = 'passed';
  report.finishedAtIso = new Date().toISOString();
  await writeJson(evidencePath, report);
  console.log(JSON.stringify({ status: report.status, deployedSha: expectedSha, fixtureUid: fixture.uid, requestId: fixture.requestId, requestStatus: 'requested', unprivilegedAdminStatus: 403, evidencePath, actualErasureExecuted: false }));
  await db.terminate();
  await deleteApp(firebaseApp);
  firebaseApp = null;
} catch (error) {
  report.status = 'failed';
  report.failedStage = stage;
  report.failureCode = error?.safeCode || (typeof error?.code === 'string' && /^[a-z0-9_/-]+$/i.test(error.code) ? error.code : 'operation_failed_details_not_printed');
  report.finishedAtIso = new Date().toISOString();
  if (fixture) report.retainedFixture = { uid: fixture.uid, requestId: fixture.requestId };
  if (lock) await writeJson(evidencePath, report).catch(() => {});
  console.log(JSON.stringify({ status: 'failed', stage, code: report.failureCode, evidencePath, fixturePreserved: Boolean(fixture) }));
  process.exitCode = 1;
} finally {
  if (browser) await browser.close().catch(() => {});
  if (firebaseApp) { const { deleteApp } = await import('firebase-admin/app'); await deleteApp(firebaseApp).catch(() => {}); }
  if (lock) { await lock.close(); await fs.unlink(lockPath); }
}
