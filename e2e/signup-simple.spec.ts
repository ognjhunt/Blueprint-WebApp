import { test, expect } from '@playwright/test';
for (const width of [1440, 390]) {
  test(`signup stays short and readable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/signup/business?buyerType=robot_team');
    await expect(page.getByRole('heading', { name: 'Create an account', exact: true })).toBeVisible();
    await page.getByLabel('Work email', { exact: true }).fill('preview@example.com');
    await page.getByLabel('Password', { exact: true }).fill('preview-password-123');
    await page.screenshot({ path: `output/qa/signup/account-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Set up your workspace', exact: true })).toBeFocused();
    await expect(page.getByRole('radio')).toHaveCount(2);
    await expect(page.getByRole('textbox')).toHaveCount(2);
    await expect(page.getByLabel('Test my robots on site tasks')).toBeChecked();
    await expect(page.getByText(/Requested lane|Proof path|Standardized benchmark|Company size|Progressive access/)).toHaveCount(0);
    await page.getByLabel('Your name', { exact: true }).fill('Alex Morgan');
    await page.getByLabel('Organization', { exact: true }).fill('Example Robotics');
    await expect(page.getByLabel('Your name')).toHaveCSS('color', 'rgb(34, 37, 30)');
    await expect(page.locator('.auth-shell')).toHaveCSS('background-color', 'rgb(246, 245, 239)');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `output/qa/signup/workspace-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: /Back/ }).click();
    await expect(page.getByLabel('Work email')).toHaveValue('preview@example.com');
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(page.getByLabel('Organization', { exact: true })).toHaveValue('Example Robotics');
  });
}
test('site signups point at the capture form, not a second intake', async ({ page }) => {
  await page.goto('/signup/business?buyerType=site_operator&intent=pilot-opportunity');
  await page.getByLabel('Work email').fill('preview@example.com');
  await page.getByLabel('Password', { exact: true }).fill('preview-password-123');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByLabel('Find a robot for my site')).toBeChecked();
  await expect(page.getByRole('textbox')).toHaveCount(2);
  await expect(page.getByRole('checkbox')).not.toBeChecked();
  await expect(page.getByText(/describe one job and film the work area/)).toBeVisible();
});
