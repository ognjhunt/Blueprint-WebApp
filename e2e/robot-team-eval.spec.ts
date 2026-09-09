import { expect, test } from "@playwright/test";

test("legacy robot-team evaluation URL reaches the supplier application", async ({ page }) => {
  await page.goto("/robot-team/eval");
  await expect(page).toHaveURL(/\/contact\/robot-team/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bring your robot. Find the fit.");
  await expect(page.getByRole("button", { name: "Send application" })).toBeVisible();
});

test("persona aliases separate site buyers from participating robot teams", async ({ page }) => {
  await page.goto("/for-robot-teams");
  await expect(page.getByText(/site-funded evaluations/)).toBeVisible();
  await expect(page.getByText(/applying does not guarantee either/)).toBeVisible();
  await expect(page.getByLabel("Evaluation budget")).toHaveCount(0);
  await page.goto("/for-site-operators");
  await expect(page).toHaveURL(/\/contact\/site-operator/);
  await expect(page.getByText(/paid evaluation/)).toBeVisible();
  await expect(page.getByLabel("Evaluation budget")).toBeVisible();
});

test("both persona destinations are usable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [path, button] of [["/for-robot-teams", "Send application"], ["/for-site-operators", "Send inquiry"]]) {
    await page.goto(path);
    await expect(page.getByRole("button", { name: button })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
