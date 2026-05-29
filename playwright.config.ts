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
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  webServer: {
    command: `${webServerEnvPrefix ? `${webServerEnvPrefix} ` : ''}PORT=${port} npx tsx server/index.ts`,
    url: baseURL,
    reuseExistingServer: !process.env.CI && !operatorQaFakeAuthEnabled,
    timeout: 120_000,
  },
});
