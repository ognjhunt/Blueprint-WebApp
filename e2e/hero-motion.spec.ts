import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", (route) => route.fulfill({ json: { ok: true } }));
});

test("all four action clips decode, advance, and freeze with the shared pause control", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  for (const [label, id] of [["fixed arm", "arm"], ["humanoid", "humanoid"], ["wheeled humanoid", "wheeled-humanoid"], ["mobile manipulator", "mobile-manipulator"]]) {
    await page.getByRole("button", { name: `Show ${label}`, exact: true }).click();
    await page.getByRole("button", { name: "Play scene rotation" }).click();
    const clip = page.locator(".ms-scene-art.is-active video");
    await expect(clip).toHaveAttribute("src", `/images/site-led/embodiments/motion/${id}-smooth-v2.mp4`);
    await expect(clip).toHaveClass(/is-ready/);
    await expect.poll(() => clip.evaluate((video: HTMLVideoElement) => video.currentTime)).toBeGreaterThan(1);
    expect(await clip.evaluate((video: HTMLVideoElement) => ({ width: video.videoWidth, muted: video.muted, inline: video.playsInline }))).toEqual({ width: 1536, muted: true, inline: true });
    await page.getByRole("button", { name: "Pause scene rotation" }).click();
    const pausedAt = await clip.evaluate((video: HTMLVideoElement) => video.currentTime);
    await page.waitForTimeout(200);
    expect(await clip.evaluate((video: HTMLVideoElement) => video.paused)).toBe(true);
    expect(await clip.evaluate((video: HTMLVideoElement) => video.currentTime)).toBeCloseTo(pausedAt, 2);
    await page.screenshot({ path: `output/hero-motion-review/${id}.png` });
  }
});

test("reduced motion loads only original stills, including when changed during playback", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => { if (request.url().endsWith(".mp4")) requests.push(request.url()); });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Show humanoid", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Show humanoid", exact: true }).click();
  await expect(page.locator("video")).toHaveCount(0);
  expect(requests).toEqual([]);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.getByRole("button", { name: "Play scene rotation" }).click();
  await expect(page.locator(".ms-scene-art.is-active video")).toHaveClass(/is-ready/);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("video")).toHaveCount(0);
  await expect(page.getByRole("img")).toHaveAccessibleName(/bipedal humanoid/);
});

test("offscreen hero pauses decoding and failed media keeps the still artwork", async ({ page }) => {
  // The short desktop homepage cannot scroll its entire hero out of view.
  await page.setViewportSize({ width: 390, height: 400 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const clip = page.locator(".ms-scene-art.is-active video");
  await expect.poll(() => clip.evaluate((video: HTMLVideoElement) => video.currentTime)).toBeGreaterThan(0.5);
  await page.locator(".ms-footer").scrollIntoViewIfNeeded();
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  expect(await page.locator(".ms-rotating-hero").evaluate((hero) => hero.getBoundingClientRect().bottom)).toBeLessThan(0);
  await expect.poll(() => clip.evaluate((video: HTMLVideoElement) => video.paused)).toBe(true);
  await page.route("**/motion/*.mp4", (route) => route.abort());
  await page.reload();
  await page.evaluate(() => scrollTo(0, 0));
  await expect(page.locator(".ms-scene-art.is-active img")).toBeVisible();
  await expect.poll(() => page.locator(".ms-scene-art.is-active img").evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(1536);
  await expect(page.locator("video.is-ready")).toHaveCount(0);
});
