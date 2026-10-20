import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const expectedSha = process.argv[2];
if (!/^[a-f0-9]{40}$/.test(expectedSha || '')) throw new Error('Pass the exact approved 40-character deployed SHA.');
const base = 'https://tryblueprint.io';
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const output = path.resolve('output/qa/privacy-live', `${stamp}-${expectedSha.slice(0, 12)}`);
await mkdir(output, { recursive: true });
const report = {
  schema: 'blueprint.live-public-privacy-verification.v1', expectedSha,
  startedAt: new Date().toISOString(), baseUrl: base,
  authorizationScope: 'Fresh anonymous public-browser cookie consent and refund/legal QA. No authentication, user-session access, provider configuration changes, or mocked analytics requests.',
  checks: [], phases: {}, network: [], failures: [],
  limitations: [
    'Observed requests cover these synthetic anonymous journeys only; this does not certify every Google Analytics Enhanced Measurement configuration or event.',
    'No authenticated deletion was exercised by this script; root owns the separately authorized synthetic-account proof.',
    'Only sanitized provider host/path classifications, statuses and marker booleans are retained; no credential values, request bodies, query strings, fragments, or cookie values are recorded.',
  ],
};
let browser;
let phase = 'startup';
const marker = `privacy-audit-${Date.now()}`;
function category(url) {
  if (url.pathname === '/api/analytics/ingest' && url.hostname.endsWith('tryblueprint.io')) return 'blueprint-analytics';
  if (url.hostname === 'www.googletagmanager.com') return 'google-tag-script';
  if (url.hostname.endsWith('google-analytics.com')) return 'google-analytics';
  if (url.hostname.endsWith('posthog.com') || /\/posthog(?:\/|$)/.test(url.pathname)) return 'posthog';
  return null;
}
function observedDataHasMarker(request) {
  const candidates = [request.url(), request.postData() || ''];
  return candidates.some((value) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      if (value.includes(marker)) return true;
      try { value = decodeURIComponent(value); } catch { break; }
    }
    return false;
  });
}
const requestRecords = new WeakMap();
const responseReads = [];
function recordPage(page) {
  page.on('request', (request) => {
    const url = new URL(request.url()), kind = category(url);
    if (!kind) return;
    const record = { phase, kind, method: request.method(), host: url.hostname,
      path: kind === 'posthog' ? '[posthog endpoint]' : url.pathname,
      syntheticMarkerPresent: observedDataHasMarker(request), startedAt: new Date().toISOString() };
    report.network.push(record); requestRecords.set(request, record);
  });
  page.on('response', (response) => {
    const record = requestRecords.get(response.request());
    if (!record) return;
    record.status = response.status();
    if (record.kind === 'blueprint-analytics') responseReads.push((async () => {
      try {
        const body = await response.json();
        record.ingestionResult = {
          persisted: typeof body.persisted === 'boolean' ? body.persisted : null,
          disabled: typeof body.disabled === 'boolean' ? body.disabled : null,
          ok: typeof body.ok === 'boolean' ? body.ok : null,
        };
      } catch { record.ingestionResult = { responseBodyVerified: false }; }
    })());
  });
  page.on('requestfailed', (request) => { const record = requestRecords.get(request); if (record) record.failure = request.failure()?.errorText || 'request_failed'; });
  page.on('pageerror', (error) => {
    report.failures.push({ phase, kind: 'pageerror', name: error.name,
      message: error.message.replace(/https?:\/\/[^\s]+/g, '[url]').slice(0, 220) });
  });
}
async function version() {
  const response = await fetch(`${base}/version.json`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`version HTTP ${response.status}`);
  const data = await response.json();
  if (data.git_sha !== expectedSha) throw new Error(`Release mismatch: expected ${expectedSha}, observed ${data.git_sha}`);
  return { git_sha: data.git_sha, built_at_iso: data.built_at_iso };
}
async function snapshot(page, context) {
  const storage = await page.evaluate(() => {
    const raw = localStorage.getItem('blueprint_cookie_consent');
    const choice = raw ? JSON.parse(raw) : null;
    return { consent: choice ? { analytics: choice.analytics, marketing: choice.marketing, necessary: choice.necessary } : null,
      hasAnalyticsId: localStorage.getItem('bp.analytics.anonymousId') !== null };
  });
  return { ...storage, analyticsCookieNames: (await context.cookies()).map((cookie) => cookie.name).filter((name) => /^(?:_ga|_gid|_gat|_gcl_|ph_)/.test(name)) };
}
function countIn(name) { return report.network.filter((event) => event.phase === name).length; }
function passed(name, data = {}) { report.checks.push({ name, status: 'passed', ...data }); }

try {
  report.versionBefore = await version();
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
  const context = await browser.newContext({ viewport: { width: 1365, height: 900 } });
  const page = await context.newPage(); recordPage(page);
  const banner = page.getByRole('region', { name: 'Cookie preferences' });

  phase = 'before-choice';
  await page.goto(`${base}/privacy`, { waitUntil: 'domcontentloaded' });
  await expect(banner).toBeVisible({ timeout: 20000 });
  await page.waitForTimeout(4500);
  expect(countIn(phase)).toBe(0);
  report.phases[phase] = await snapshot(page, context);
  expect(report.phases[phase].hasAnalyticsId).toBe(false);
  expect(report.phases[phase].analyticsCookieNames).toEqual([]);
  await page.screenshot({ path: path.join(output, 'desktop-cookie-choice.png'), fullPage: false });
  passed('No optional analytics requests, identifiers or analytics cookies before choice');

  await banner.getByRole('button', { name: 'Reject all', exact: true }).click();
  phase = 'rejected';
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4500);
  await expect(banner).toHaveCount(0);
  expect(countIn(phase)).toBe(0);
  report.phases[phase] = await snapshot(page, context);
  expect(report.phases[phase].consent).toEqual({ analytics: false, marketing: false, necessary: true });
  passed('Reject all persists through reload and keeps analytics off');

  await page.getByRole('button', { name: 'Cookie settings', exact: true }).click();
  await expect(banner.getByRole('checkbox', { name: /^Analytics/ })).not.toBeChecked();
  await expect(banner.getByRole('checkbox', { name: /^Marketing/ })).not.toBeChecked();
  await banner.getByRole('button', { name: 'Hide details', exact: true }).click();
  phase = 'accepted';
  await banner.getByRole('button', { name: 'Accept all', exact: true }).click();
  await page.goto(`${base}/privacy?privacy_audit_probe=${marker}#${marker}`, { waitUntil: 'domcontentloaded' });
  await expect.poll(() => report.network.filter((event) => event.phase === 'accepted' && event.kind === 'blueprint-analytics' && event.status >= 200 && event.status < 300).length, { timeout: 25000 }).toBeGreaterThan(0);
  await page.waitForTimeout(5000);
  report.phases[phase] = await snapshot(page, context);
  expect(report.phases[phase].consent).toEqual({ analytics: true, marketing: true, necessary: true });
  expect(report.phases[phase].hasAnalyticsId).toBe(true);
  passed('Accept all permits real Blueprint analytics HTTP requests and survives navigation; persistence is recorded separately from response booleans');

  phase = 'history-marker-probe';
  await page.evaluate((value) => history.pushState({}, '', `/privacy?privacy_audit_probe=${value}#${value}`), `${marker}-history`);
  await page.waitForTimeout(5000);
  report.markerProbe = {
    exercised: true,
    analyticsRequestsContainingSyntheticQueryOrFragmentMarker: report.network.filter((event) => event.syntheticMarkerPresent).length,
    googleCollectorRequestsObserved: report.network.filter((event) => event.kind === 'google-analytics').length,
    assertion: 'Diagnostic observation only; no claim that remote Enhanced Measurement settings are comprehensively verified.',
  };

  await page.getByRole('button', { name: 'Cookie settings', exact: true }).click();
  await expect(banner.getByRole('checkbox', { name: /^Analytics/ })).toBeChecked();
  await expect(banner.getByRole('checkbox', { name: /^Marketing/ })).toBeChecked();
  phase = 'withdrawn-same-document';
  await banner.getByRole('button', { name: 'Reject all', exact: true }).click();
  await page.waitForTimeout(5000);
  expect(countIn(phase)).toBe(0);
  report.phases[phase] = await snapshot(page, context);
  expect(report.phases[phase].consent).toEqual({ analytics: false, marketing: false, necessary: true });
  expect(report.phases[phase].hasAnalyticsId).toBe(false);
  expect(report.phases[phase].analyticsCookieNames).toEqual([]);
  passed('Withdrawal stops new optional requests and clears identifiers/cookies in the already-loaded document');
  phase = 'withdrawn-after-navigation';
  await page.goto(`${base}/how-it-works`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4500);
  expect(countIn(phase)).toBe(0);
  report.phases[phase] = await snapshot(page, context);
  expect(report.phases[phase].hasAnalyticsId).toBe(false);
  expect(report.phases[phase].analyticsCookieNames).toEqual([]);
  passed('Reopening preserves selected choices; withdrawal persists, stops analytics and clears optional identifiers/cookies');
  await context.close();

  phase = 'mobile-refunds';
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 1 });
  const mobilePage = await mobile.newPage(); recordPage(mobilePage);
  await mobilePage.goto(`${base}/beta`, { waitUntil: 'domcontentloaded' });
  await mobilePage.getByRole('button', { name: 'Reject all', exact: true }).click({ timeout: 20000 });
  const cost = mobilePage.locator('#scope');
  await expect(cost).toContainText('Nothing. The beta is free');
  await cost.getByRole('link', { name: 'Refunds for prior purchases and pilot cancellations' }).click();
  await expect(mobilePage).toHaveURL(`${base}/refunds`);
  await expect(mobilePage.getByRole('heading', { name: 'Refunds and cancellations', exact: true })).toBeVisible();
  await expect(mobilePage.getByRole('heading', { name: 'Purchases made before the free beta', exact: true })).toBeVisible();
  await expect(mobilePage.getByRole('link', { name: 'applicable Terms of Service' })).toHaveAttribute('href', /\/terms(?:\/previous)?$/);
  await expect(mobilePage.getByRole('link', { name: 'hello@tryblueprint.io', exact: true }).first()).toHaveAttribute('href', /^mailto:/);
  expect(await mobilePage.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await mobilePage.screenshot({ path: path.join(output, 'mobile-refunds.png'), fullPage: true });
  passed('Mobile refund route is linked next to beta cost, renders prior-purchase terms/contact and has no horizontal overflow');

  phase = 'legal-links';
  await mobilePage.goto(`${base}/privacy`, { waitUntil: 'domcontentloaded' });
  await expect(mobilePage.getByRole('link', { name: 'account deletion in Settings' })).toHaveAttribute('href', '/settings?privacy=1');
  await expect(mobilePage.getByRole('link', { name: 'previous version', exact: true })).toHaveAttribute('href', '/privacy/previous');
  await expect(mobilePage.getByRole('link', { name: 'Refunds', exact: true })).toHaveAttribute('href', '/refunds');
  await expect(mobilePage.getByText(/stay off until you allow the corresponding category/)).toBeVisible();
  const terms = mobilePage.getByRole('navigation', { name: 'Footer navigation' }).getByRole('link', { name: 'Terms', exact: true });
  await terms.click();
  await expect(mobilePage).toHaveURL(`${base}/terms`);
  await expect(mobilePage.getByRole('heading', { level: 1 })).toContainText(/Terms/i);
  passed('Privacy exposes deletion settings, previous policy, refunds and working terms navigation');
  expect(report.network.filter((event) => ['mobile-refunds', 'legal-links'].includes(event.phase))).toEqual([]);
  await mobile.close();
  report.versionAfter = await version();
  if (report.failures.length) throw new Error('Browser errors were observed; inspect the sanitized failure entries.');
  report.status = 'passed';
} catch (error) {
  report.status = 'failed';
  report.failures.push({ phase, kind: 'assertion', message: String(error?.message || error).replace(/https?:\/\/[^\s]+/g, '[url]').slice(0, 1000) });
  process.exitCode = 1;
} finally {
  await browser?.close();
  await Promise.allSettled(responseReads);
  const positiveEvents = report.network.filter((event) => ['accepted', 'history-marker-probe'].includes(event.phase));
  const providerCounts = (kind) => {
    const events = positiveEvents.filter((event) => event.kind === kind);
    return { requests: events.length, successfulHttpResponses: events.filter((event) => event.status >= 200 && event.status < 300).length };
  };
  report.positiveControls = {
    blueprintAnalytics: {
      ...providerCounts('blueprint-analytics'),
      responsesWithPersistedTrue: positiveEvents.filter((event) => event.kind === 'blueprint-analytics' && event.ingestionResult?.persisted === true).length,
      responsesWithDisabledTrue: positiveEvents.filter((event) => event.kind === 'blueprint-analytics' && event.ingestionResult?.disabled === true).length,
    },
    googleTagScript: providerCounts('google-tag-script'),
    googleAnalyticsCollector: providerCounts('google-analytics'),
    posthog: providerCounts('posthog'),
    interpretation: 'Each provider is observed independently. Blueprint 202 responses do not establish GA/PostHog collection or durable Blueprint persistence.',
  };
  if (report.markerProbe) report.markerProbe.analyticsRequestsContainingSyntheticQueryOrFragmentMarker = report.network.filter((event) => event.syntheticMarkerPresent).length;
  report.finishedAt = new Date().toISOString();
  for (const name of new Set(report.network.map((event) => event.phase))) {
    report.phases[name] = { ...report.phases[name], requests: report.network.filter((event) => event.phase === name).length };
  }
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ status: report.status, expectedSha, reportPath: path.join(output, 'report.json'), checks: report.checks, phases: report.phases, markerProbe: report.markerProbe, positiveControls: report.positiveControls, failures: report.failures }, null, 2));
}
