import { test, expect } from '@playwright/test';

test('public example explains matched variations and private results', async ({ page }) => {
  await page.goto('/how-it-works#evaluation-example');
  const example = page.locator('#evaluation-example');
  await expect(example.getByRole('heading', { name: 'Same task. Different policies.' })).toBeVisible();
  await expect(example.getByRole('button', { name: 'Starting position' })).toHaveAttribute('aria-pressed', 'true');
  await example.getByRole('button', { name: 'Lighting', exact: true }).click();
  await expect(example.getByText('Change the brightness', { exact: false })).toBeVisible();
  await expect(example.getByRole('img', { name: /varied lighting/ })).toHaveCount(2);
  await example.getByRole('button', { name: 'Camera view' }).focus();
  await page.keyboard.press('Enter');
  await expect(example.getByRole('button', { name: 'Camera view' })).toHaveAttribute('aria-pressed', 'true');
  await expect(example.getByRole('img', { name: /varied camera view/ })).toHaveCount(2);
  await example.getByText('How results stay private', { exact: true }).click();
  await expect(example.getByText(/without competitor scores/)).toBeVisible();
  await expect(example.getByText(/do not show measured results/)).toBeVisible();
  await expect(example.locator('video')).toHaveCount(0);
});

test('homepage links directly to the example without sign-in', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'See an evaluation example' }).click();
  await expect(page).toHaveURL(/\/how-it-works#evaluation-example$/);
  await expect(page.getByRole('heading', { name: 'Same task. Different policies.' })).toBeInViewport();
});

for (const width of [1440, 390]) {
  test(`example fits the public page at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/how-it-works');
    await expect(page.locator('#evaluation-example')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `output/qa/public-eval/how-it-works-${width}.png`, fullPage: true });
  });
}
