import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';

// Licensed research media stays local for this internal preview.
const internalPreview = process.env.BLUEPRINT_INTERNAL_EPISODE_PREVIEW === '1';
const hasEpisodes = internalPreview && existsSync('client/public/proof/cup-evaluation/02-groot-external.mp4');

test('public example explains recorded conditions and private results', async ({ page }) => {
  test.skip(!internalPreview, 'Recorded episodes require the explicit internal-preview server.');
  await page.goto('/how-it-works#evaluation-example');
  const example = page.locator('#evaluation-example');
  await expect(example.getByRole('heading', { name: 'Same task. Different policies.' })).toBeVisible();
  await expect(example.getByRole('button', { name: 'Cup shifted 2 cm' })).toHaveAttribute('aria-pressed', 'true');
  await expect(example.getByText('Met recorded criteria', { exact: true })).toHaveCount(1);
  await expect(example.getByText('Did not meet criteria', { exact: true })).toHaveCount(1);
  await example.getByRole('button', { name: 'Baseline', exact: true }).click();
  await expect(example.getByText('Did not meet criteria', { exact: true })).toHaveCount(2);
  await example.getByRole('button', { name: 'Lighting', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(example.getByRole('button', { name: 'Lighting' })).toHaveAttribute('aria-pressed', 'true');
  await expect(example.getByRole('heading', { name: 'Contact threshold exceeded' })).toBeVisible();
  await expect(example.getByRole('heading', { name: 'Did not settle' })).toBeVisible();
  await example.getByText('How results stay private', { exact: true }).click();
  await expect(example.getByText(/without competitor scores/)).toBeVisible();
  await expect(example.getByText(/do not establish a policy winner/)).toBeVisible();
  await expect(example.locator('video')).toHaveCount(2);
});

test('homepage links directly to the example without sign-in', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'See an evaluation example' }).click();
  await expect(page).toHaveURL(/\/how-it-works#evaluation-example$/);
  await expect(page.getByRole('heading', { name: 'Same task. Different policies.' })).toBeInViewport();
});

for (const width of [1440, 390]) {
  test(`example fits the public page at ${width}px`, async ({ page }) => {
    test.skip(!hasEpisodes, 'Internal preview media is not distributed with the repository.');
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/how-it-works');
    await expect(page.locator('#evaluation-example')).toBeVisible();
    await expect.poll(() => page.locator('video').evaluateAll(videos => videos.every(video => Boolean((video as HTMLVideoElement).poster)))).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `output/qa/public-eval/actual-episodes-${width}.png`, fullPage: true });
    await page.locator('#evaluation-example').screenshot({ path: `output/qa/public-eval/actual-example-${width}.png` });
  });
}

for (const condition of ['Baseline', 'Cup shifted 2 cm', 'Lighting']) {
  test(`both original videos play for ${condition}`, async ({ page }) => {
    test.skip(!hasEpisodes, 'Internal preview media is not distributed with the repository.');
    await page.goto('/how-it-works#evaluation-example');
    await page.getByRole('button', { name: condition, exact: true }).click();
    const videos = page.locator('#evaluation-example video');
    for (const video of await videos.all()) {
      await video.evaluate(async (element: HTMLVideoElement) => { element.muted = true; await element.play(); });
      await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime)).toBeGreaterThan(0);
      await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.videoWidth)).toBe(1280);
      expect(await video.evaluate((element: HTMLVideoElement) => element.error)).toBeNull();
    }
    await page.getByRole('button', { name: condition === 'Baseline' ? 'Lighting' : 'Baseline', exact: true }).click();
    await expect.poll(() => videos.evaluateAll(elements => elements.every((v: HTMLVideoElement) => v.paused && v.currentTime === 0))).toBe(true);
  });
}

test('a failed media load offers recovery without changing the score', async ({ page }) => {
  test.skip(!hasEpisodes, 'Internal preview media is not distributed with the repository.');
  await page.route('**/02-pi05-external.mp4', route => route.abort());
  await page.goto('/how-it-works#evaluation-example');
  await page.locator('video').first().evaluate((element: HTMLVideoElement) => element.load());
  await expect(page.getByText('This episode could not load.')).toBeVisible();
  await expect(page.getByText('Did not meet criteria', { exact: true })).toBeVisible();
  await page.unroute('**/02-pi05-external.mp4');
  await page.getByRole('button', { name: 'Try loading again' }).click();
  await expect(page.getByText('This episode could not load.')).toHaveCount(0);
  await expect.poll(() => page.locator('video').first().evaluate((v: HTMLVideoElement) => v.readyState)).toBeGreaterThanOrEqual(2);
});


test('public walkthrough has illustrations and no research media', async ({ page }) => {
  test.skip(internalPreview, 'Public build coverage runs without the internal preview flag.');
  await page.goto('/how-it-works#evaluation-example');
  const example = page.locator('#evaluation-example');
  await expect(example.getByText('Illustrative walkthrough', { exact: true })).toBeVisible();
  await expect(example.locator('video')).toHaveCount(0);
  await example.getByRole('button', { name: 'Lighting', exact: true }).click();
  await expect(example.getByRole('img', { name: /varied lighting/ })).toHaveCount(2);
  await expect(example.getByText(/do not show measured results/)).toBeVisible();
});
