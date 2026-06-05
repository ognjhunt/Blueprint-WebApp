import { test, expect } from '@playwright/test';

test('legacy marketplace route redirects to the Sites library', async ({ page }) => {
  await page.goto('/marketplace');

  await expect(page).toHaveURL(/\/sites$/);
  await expect(
    page.getByRole('heading', { name: /Browse captured sites for robot evaluation\./i }),
  ).toBeVisible();
});

test('legacy environments route redirects to proof instead of the removed catalog', async ({ page }) => {
  await page.goto('/environments');

  await expect(page).toHaveURL(/\/proof$/);
  await expect(
    page.getByRole('heading', { name: /See what supports the site data and policy runs\./i }),
  ).toBeVisible();
});

test('public routes work with trailing slashes', async ({ page }) => {
  await page.goto('/docs/');

  await expect(page).toHaveURL(/\/proof\/?$/);
  await expect(
    page.getByRole('heading', {
      name: /See what supports the site data and policy runs\./i,
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
