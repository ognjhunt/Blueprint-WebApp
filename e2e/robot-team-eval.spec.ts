import { expect, test } from "@playwright/test";

// The library reads from the real API; in this suite it is answered locally so
// the page's structure is what is under test, not tonight's inventory.
test.beforeEach(async ({ page }) => {
  await page.route("**/api/site-worlds/tasks", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ items: [] }) }),
  );
});

test("legacy robot-team evaluation URL reaches the task library, not an application", async ({ page }) => {
  await page.goto("/robot-team/eval");
  await expect(page).toHaveURL(/\/contact\/robot-team/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Find work your robot could do.");
  await expect(page.getByRole("region", { name: "Task library" })).toBeVisible();
  // The setup form is one click in, and the six-question application is gone.
  await page.getByText("Already have a robot policy to evaluate? Register it and see a plan", { exact: true }).click();
  await expect(page.getByRole("button", { name: "See what we would run" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Send application" })).toHaveCount(0);
  await expect(page.locator("#gate-hardwareMaturity")).toHaveCount(0);
});

test("persona aliases separate site buyers from participating robot teams", async ({ page }) => {
  await page.goto("/for-robot-teams");
  await expect(page.getByText("Choose a real site task, see what an evaluation of your robot would cost and tell you, then run it.")).toBeVisible();
  // The two deployment facts matching needs are on the setup form; the rest
  // of the old interview is not asked anywhere on the page.
  await page.getByText("Already have a robot policy to evaluate? Register it and see a plan", { exact: true }).click();
  await expect(page.getByLabel("Where is the hardware today?")).toBeVisible();
  await expect(page.getByLabel("Would you deploy in the Austin metro?")).toBeVisible();
  await expect(page.getByText(/Who commits the deployment engineering/)).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Operate a site? Start here" })).toBeVisible();

  await page.goto("/for-site-operators");
  await expect(page).toHaveURL(/\/contact\/site-operator/);
  // The site page leads with the capture form; a robot team is never captured
  // and a site is never asked the robot's questions.
  await expect(page.getByRole("form", { name: "Start a site capture" })).toBeVisible();
  await expect(page.locator("#capture-mode")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Building robots? Find a task" })).toBeVisible();
});

test("both persona destinations are usable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/for-robot-teams");
  await page.getByText("Already have a robot policy to evaluate? Register it and see a plan", { exact: true }).click();
  await expect(page.getByRole("button", { name: "See what we would run" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  await page.goto("/for-site-operators");
  await expect(page.getByRole("button", { name: "Start", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
