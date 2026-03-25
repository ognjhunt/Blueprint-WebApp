import { test, expect } from '@playwright/test';

test('legacy marketplace route now returns the site 404 page', async ({ page }) => {
  await page.goto('/marketplace');

  await expect(page).toHaveURL(/\/marketplace$/);
  await expect(page.getByRole('heading', { name: /Page not found/i })).toBeVisible();
});

test('legacy environments route redirects to the world models catalog', async ({ page }) => {
  await page.goto('/environments');

  await expect(page).toHaveURL(/\/world-models$/);
  await expect(
    page.getByRole('heading', { name: /Train on exact sites your team needs before deployment\./i }),
  ).toBeVisible();
});

test('public routes work with trailing slashes', async ({ page }) => {
  await page.goto('/docs/');

  await expect(page).toHaveURL(/\/docs\/?$/);
  await expect(
    page.getByRole('heading', {
      name: /What stays stable, what the package contains, and what can vary by site\./i,
    }),
  ).toBeVisible();
});

test('robots and sitemap are publicly reachable', async ({ request }) => {
  const robots = await request.get('/robots.txt');
  const sitemap = await request.get('/sitemap.xml');

  expect(robots.ok()).toBeTruthy();
  expect(await robots.text()).toContain('User-agent: *');
  expect(sitemap.ok()).toBeTruthy();
  expect(await sitemap.text()).toContain('https://tryblueprint.io/world-models');
});
