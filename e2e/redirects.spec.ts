import { test, expect } from '@playwright/test';

test('legacy marketplace route redirects to the Sites library', async ({ page }) => {
  await page.goto('/marketplace');

  await expect(page).toHaveURL(/\/sites$/);
  await expect(
    page.getByRole('heading', { name: /Pick a captured place\./i }),
  ).toBeVisible();
});

test('legacy environments route redirects to proof instead of the removed catalog', async ({ page }) => {
  await page.goto('/environments');

  await expect(page).toHaveURL(/\/proof$/);
  await expect(
    page.getByRole('heading', { name: /Proof stays scoped\./i }),
  ).toBeVisible();
});

test('legacy contact route redirects to the canonical robot-team intake', async ({ request }) => {
  const response = await request.get(
    '/contact?persona=robot-team&source=server-redirect',
    { maxRedirects: 0 },
  );

  expect(response.status()).toBe(301);
  expect(response.headers().location).toBe(
    '/contact/robot-team?persona=robot-team&source=server-redirect',
  );
});

test('public routes work with trailing slashes', async ({ page }) => {
  await page.goto('/docs/');

  await expect(page).toHaveURL(/\/proof\/?$/);
  await expect(
    page.getByRole('heading', {
      name: /Proof stays scoped\./i,
    }),
  ).toBeVisible();
});

test('robots and sitemap are publicly reachable', async ({ request }) => {
  const robots = await request.get('/robots.txt');
  const sitemap = await request.get('/sitemap.xml');

  expect(robots.ok()).toBeTruthy();
  expect(await robots.text()).toContain('User-agent: *');
  expect(sitemap.ok()).toBeTruthy();
  const sitemapText = await sitemap.text();
  expect(sitemapText).toContain('https://tryblueprint.io/sites');
  expect(sitemapText).toContain('https://tryblueprint.io/pricing');
  expect(sitemapText).toContain('https://tryblueprint.io/proof');
  expect(sitemapText).not.toContain('https://tryblueprint.io/world-models');
});
