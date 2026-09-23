import { test, expect } from "@playwright/test";

// The capturer network and its app pages are retired for now: sites film their
// own tasks. Every old entry point must land on the site start page, and no
// public page may link back to them.
const retired = [
  "/capture",
  "/capture-app",
  "/capture-app/launch-access",
  "/launch-map",
  "/signup/capturer",
  "/earn",
];

for (const path of retired) {
  test(`${path} lands on the site start page`, async ({ page }) => {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/contact\/site-operator(\?|$)/);
  });
}

test("sign-in no longer offers capture app access", async ({ page }) => {
  await page.goto("/sign-in", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Sign in", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /capture app access/i })).toHaveCount(0);
});
