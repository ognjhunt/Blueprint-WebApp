import { test, expect } from '@playwright/test';


test('public example explains recorded conditions and private results', async ({ page }) => {
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
    await page.goto('/how-it-works#evaluation-example');
    await page.getByRole('button', { name: condition, exact: true }).click();
    const videos = page.locator('#evaluation-example video');
    for (const video of await videos.all()) {
      await video.evaluate(async (element: HTMLVideoElement) => { element.muted = true; await element.play(); });
      await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime)).toBeGreaterThan(0);
      await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.videoWidth)).toBe(1280);
      expect(await video.evaluate((element: HTMLVideoElement) => element.error)).toBeNull();
    }
    const next = condition === 'Baseline' ? 'Lighting' : 'Baseline';
    await page.getByRole('button', { name: next, exact: true }).click();
    // Switching mounts the other condition's episodes rather than reusing the
    // elements, so no playback carries across the swap.
    const nextPrefix = next === 'Baseline' ? '00-' : '04-';
    await expect.poll(() => videos.evaluateAll(elements => elements.every(
      (v: HTMLVideoElement) => v.querySelector('source')?.getAttribute('src')?.includes(nextPrefix) === true,
    ))).toBe(true);
  });
}

test('both episodes start together once the section is in view', async ({ page }) => {
  await page.goto('/how-it-works');
  const videos = page.locator('#evaluation-example video');
  // Nothing should run before the reader reaches the section: each episode is
  // ~4 MB behind preload="none".
  await expect(videos.first()).toHaveJSProperty('paused', true);
  await page.locator('#evaluation-example').scrollIntoViewIfNeeded();
  // Started for the reader, so the pair stays in step for the comparison.
  await expect.poll(() => videos.evaluateAll(elements => elements.every((v: HTMLVideoElement) => !v.paused))).toBe(true);
  expect(await videos.evaluateAll(elements => elements.every((v: HTMLVideoElement) => v.muted && v.loop))).toBe(true);
});

test('a reader who pauses an episode keeps it paused', async ({ page }) => {
  await page.goto('/how-it-works#evaluation-example');
  const videos = page.locator('#evaluation-example video');
  await expect.poll(() => videos.evaluateAll(elements => elements.every((v: HTMLVideoElement) => !v.paused))).toBe(true);

  await videos.first().evaluate((v: HTMLVideoElement) => v.pause());
  // Scroll the section away and back; the reader's pause outranks the observer.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.locator('#evaluation-example').scrollIntoViewIfNeeded();
  await expect(videos.first()).toHaveJSProperty('paused', true);
  // The episode the reader did not touch is unaffected.
  await expect.poll(() => videos.nth(1).evaluate((v: HTMLVideoElement) => v.paused)).toBe(false);
});

test('reduced motion holds the episodes on their posters', async ({ page }) => {
  // Set explicitly rather than through the `reducedMotion` fixture, which does
  // not reach the page under this config — matchMedia still reported
  // no-preference, so the assertions below passed for the wrong reason.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/how-it-works#evaluation-example');
  const videos = page.locator('#evaluation-example video');
  await page.locator('#evaluation-example').scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);

  await expect(videos.first()).toHaveJSProperty('paused', true);
  await expect(videos.nth(1)).toHaveJSProperty('paused', true);
  // Nothing is fetched either: NETWORK_EMPTY/NETWORK_IDLE rather than loading.
  expect(await videos.evaluateAll(elements => elements.every((v: HTMLVideoElement) => v.networkState !== v.NETWORK_LOADING))).toBe(true);
  // The episodes stay watchable on request rather than being withheld.
  expect(await videos.evaluateAll(elements => elements.every((v: HTMLVideoElement) => v.controls))).toBe(true);
});

test('a failed media load offers recovery without changing the score', async ({ page }) => {
  await page.route('**/02-pi05-external.mp4', route => route.abort());
  await page.goto('/how-it-works#evaluation-example');
  await page.locator('video').first().evaluate((element: HTMLVideoElement) => element.load());
  // Scoped to the broken episode: playback now starts on its own for whatever
  // is in view, so recovery has to be asserted per episode rather than by the
  // only overlay on the page.
  const brokenEpisode = page.locator('#evaluation-example figure').first();
  await expect(brokenEpisode.getByText('This episode could not load.')).toBeVisible();
  await expect(brokenEpisode.getByText('Did not meet criteria', { exact: true })).toBeVisible();
  await page.unroute('**/02-pi05-external.mp4');
  await brokenEpisode.getByRole('button', { name: 'Try loading again' }).click();
  await expect(brokenEpisode.getByText('This episode could not load.')).toHaveCount(0);
  await expect.poll(() => page.locator('video').first().evaluate((v: HTMLVideoElement) => v.readyState)).toBeGreaterThanOrEqual(2);
});
