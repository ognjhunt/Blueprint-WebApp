import { expect, test } from "@playwright/test";

const preferences = (page: import("@playwright/test").Page) => page.evaluate(() => JSON.parse(localStorage.getItem("blueprint_cookie_consent") || "null"));

test("cookie banner matches the public theme and rejects optional cookies", async ({ page }) => {
  await page.goto("/");
  const banner = page.getByRole("region", { name: "Cookie preferences" });
  await expect(banner).toBeVisible();
  await expect(banner).toHaveCSS("background-color", "rgb(246, 245, 239)");
  await expect(banner.getByRole("button", { name: "Accept all", exact: true })).toHaveCSS("background-color", "rgb(32, 61, 46)");
  await banner.getByRole("button", { name: "Reject all", exact: true }).click();
  expect(await preferences(page)).toMatchObject({ analytics: false, marketing: false, necessary: true });
  await page.reload();
  await expect(banner).toHaveCount(0);
});

test("custom preferences are keyboard accessible and persist on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto("/");
  const banner = page.getByRole("region", { name: "Cookie preferences" });
  await banner.getByRole("button", { name: "Customize", exact: true }).click();
  await expect(banner.getByRole("button", { name: "Hide details", exact: true })).toHaveAttribute("aria-expanded", "true");
  await expect(banner.getByRole("checkbox", { name: /^Necessary/ })).toBeDisabled();
  await banner.getByRole("checkbox", { name: /^Analytics/ }).uncheck();
  await banner.getByRole("checkbox", { name: /^Marketing/ }).check();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await banner.getByRole("button", { name: "Save preferences", exact: true }).click();
  expect(await preferences(page)).toMatchObject({ analytics: false, marketing: true, necessary: true });
});

test("accept all and close preserve their explicit consent outcomes", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Accept all", exact: true }).click();
  expect(await preferences(page)).toMatchObject({ analytics: true, marketing: true, necessary: true });
  await page.evaluate(() => localStorage.removeItem("blueprint_cookie_consent"));
  await page.reload();
  await page.getByRole("button", { name: "Reject optional cookies and close", exact: true }).click();
  expect(await preferences(page)).toMatchObject({ analytics: false, marketing: false, necessary: true });
});
