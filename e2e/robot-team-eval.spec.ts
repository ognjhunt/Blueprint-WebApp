import { expect, test } from "@playwright/test";

test("legacy robot-team evaluation URL reaches the supplier application", async ({ page }) => {
  await page.goto("/robot-team/eval");
  await expect(page).toHaveURL(/\/contact\/robot-team/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bring your robot. Find the fit.");
  await expect(page.getByRole("button", { name: "Send application" })).toBeVisible();
});

test("persona aliases separate site buyers from participating robot teams", async ({ page }) => {
  await page.goto("/for-robot-teams");
  // The robot persona's own copy. It used to read "site-funded manipulation
  // evaluations" and "applying does not guarantee either" -- a form, and then a
  // wait for us. The offer now starts immediately, so the copy contract is the
  // plan being free rather than the application being provisional.
  await expect(page.getByText(/ranked, priced, and free to look at/)).toBeVisible();
  await expect(page.getByText(/they are not a gate/)).toBeVisible();
  // And the route that needs no form at all is on the page, because a team
  // whose agent does this must be able to find it without asking us.
  await expect(page.getByText(/POST \/api\/agent-team\/register/)).toBeVisible();
  // The robot side screens on whether a team would deploy, not on whether a
  // room works, so it must never show the site gates or be asked who records
  // a walkthrough -- a robot team is never captured.
  await expect(page.locator("#gate-serviceArea")).toHaveCount(0);
  await expect(page.locator("#capture-mode")).toHaveCount(0);
  await expect(page.locator("#gate-hardwareMaturity")).toBeVisible();
  await page.goto("/for-site-operators");
  await expect(page).toHaveURL(/\/contact\/site-operator/);
  await expect(page.getByText(/paid evaluation/)).toBeVisible();
  // The site marker is the capture-mode question. Service area is only asked
  // once a visit is requested, so it is not the persona tell any more.
  await expect(page.locator("#capture-mode")).toBeVisible();
});

test("both persona destinations are usable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [path, button] of [["/for-robot-teams", "Send application"], ["/for-site-operators", "Send inquiry"]]) {
    await page.goto(path);
    await expect(page.getByRole("button", { name: button })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
