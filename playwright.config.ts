import { defineConfig } from '@playwright/test';

const port = Number(process.env.PLAYWRIGHT_PORT || 4173);
const baseURL = `http://127.0.0.1:${port}`;
const operatorQaFakeAuthEnabled = process.env.VITE_BLUEPRINT_OPERATOR_QA_FAKE_AUTH === '1';
const webServerEnvPrefix = [
  operatorQaFakeAuthEnabled ? 'VITE_BLUEPRINT_OPERATOR_QA_FAKE_AUTH=1' : '',
  process.env.BLUEPRINT_DISABLE_OPS_AUTOMATION_SCHEDULER === '1'
    ? 'BLUEPRINT_DISABLE_OPS_AUTOMATION_SCHEDULER=1'
    : '',
]
  .filter(Boolean)
  .join(' ');

export default defineConfig({
  testDir: './e2e',
  // operator-surfaces.spec.ts renders authenticated internal/admin surfaces
  // and requires VITE_BLUEPRINT_OPERATOR_QA_FAKE_AUTH=1 (no real Firebase
  // credentials exist in CI or most dev setups) plus its own isolated
  // server/port — both set up by `npm run qa:operator`
  // (scripts/qa/run-operator-surfaces.ts), which targets this file directly.
  // Exclude it from the default sweep so a plain `playwright test` run
  // doesn't try to load it without that bypass and fail on missing auth.
  testIgnore: operatorQaFakeAuthEnabled ? undefined : ['**/operator-surfaces.spec.ts'],
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL,
    trace: 'on-first-retry',
    // Sandboxed/cloud environments that pre-provision a system Chromium can
    // point this at the binary instead of downloading the pinned browser
    // build. Unset (the CI/dev default) keeps Playwright's own browsers.
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } }
      : {}),
  },
  webServer: {
    command: `${webServerEnvPrefix ? `${webServerEnvPrefix} ` : ''}PORT=${port} npx tsx server/index.ts`,
    url: baseURL,
    reuseExistingServer: !process.env.CI && !operatorQaFakeAuthEnabled,
    timeout: 300_000,
  },
});
