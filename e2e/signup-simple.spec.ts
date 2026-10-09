import { mockExternalFonts } from "./helpers/static-assets";
import { test, expect } from '@playwright/test';
test.beforeEach(mockExternalFonts);
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("blueprint_cookie_consent", JSON.stringify({ necessary: true, analytics: false, marketing: false })));
});
for (const width of [1440, 390]) {
  test(`public signup requires an invitation at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/signup/business?buyerType=robot_team');
    await expect(page.getByRole('heading', { name: 'Access by invitation', exact: true })).toBeVisible();
    await expect(page.getByLabel('Work email', { exact: true })).toHaveCount(0);
    await expect(page.getByLabel('Password', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /Show us a task/ })).toHaveAttribute('href', '/contact/site-operator');
    await expect(page.getByRole('link', { name: /Register robot-team interest/ })).toHaveAttribute('href', '/contact/robot-team');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
test('valid invitations fix the email and team type despite query overrides', async ({ page }) => {
  await page.route('**/api/csrf', route => route.fulfill({ json: { csrfToken: 'test' } }));
  await page.route('**/api/account-invitations/inspect', route => route.fulfill({ json: { email: 'approved@example.com', name: 'Alex', organization: 'Approved Co', workspaceType: 'robot_team', returnTo: '/contact/robot-team' } }));
  await page.goto('/signup/business?invitation=fixture&buyerType=site_operator&email=other@example.com');
  await expect(page.getByRole('heading', { name: 'Create your account', exact: true })).toBeVisible();
  await expect(page.getByLabel('Work email')).toHaveValue('approved@example.com');
  await expect(page.getByLabel('Work email')).toHaveAttribute('readonly', '');
  await expect(page.getByRole('radio')).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: /I agree/ })).not.toBeChecked();
});
test('expired or revoked invitations expose no account-creation form', async ({ page }) => {
  await page.route('**/api/csrf', route => route.fulfill({ json: { csrfToken: 'test' } }));
  await page.route('**/api/account-invitations/inspect', route => route.fulfill({ status: 403, json: { error: 'Account creation requires a current Blueprint invitation.' } }));
  await page.goto('/signup/business?invitation=expired');
  await expect(page.getByRole('alert')).toContainText('current Blueprint invitation');
  await expect(page.getByLabel('Password', { exact: true })).toHaveCount(0);
});
