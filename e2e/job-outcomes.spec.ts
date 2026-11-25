import { test, expect } from "@playwright/test";
import { mockExternalFonts } from "./helpers/static-assets";
import { createJobOutcomeToken } from "../server/utils/jobOutcomeToken";

test.beforeEach(mockExternalFonts);

test("an outcome link opens a confirm page that names only the answer", async ({ page }) => {
  const token = createJobOutcomeToken({ requestId: "e2e-req", companyId: "e2e-co", by: "site", state: "site_visit" });
  await page.goto(`/api/job-outcomes/${token}`);
  await expect(page.getByRole("heading", { name: "Record your answer" })).toBeVisible();
  await expect(page.getByText("Site visit booked or done")).toBeVisible();
  await expect(page.getByRole("button", { name: "Record this answer" })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("e2e-co");
});

test("a Not going ahead link asks for one reason, each one press, or none", async ({ page }) => {
  const token = createJobOutcomeToken({ requestId: "e2e-req", companyId: "e2e-co", by: "company", state: "not_going_ahead" });
  await page.goto(`/api/job-outcomes/${token}`);
  await expect(page.getByText("Not going ahead", { exact: true })).toBeVisible();
  await expect(page.getByText("What is the main reason? Press one.")).toBeVisible();
  for (const name of ["Cost", "Not a fit for the job", "Timing", "Chose another option", "Another reason", "Rather not say"])
    await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Record this answer" })).toHaveCount(0);
});

test("a bad outcome link says it no longer works, and the one other way to answer", async ({ page }) => {
  const response = await page.goto("/api/job-outcomes/not-a.real-token");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "This link no longer works." })).toBeVisible();
  await expect(page.getByText("You can email hello@tryblueprint.io instead.", { exact: true })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("not-a.real-token");
});

test("the thank-you page says what was recorded", async ({ page }) => {
  await page.goto("/job-outcome/thanks?answer=not_going_ahead");
  await expect(page.getByRole("heading", { name: "Thanks. We've recorded: Not going ahead." })).toBeVisible();
  await page.goto("/job-outcome/thanks?answer=not_going_ahead&reason=timing");
  await expect(page.getByRole("heading", { name: "Thanks. We've recorded: Not going ahead (Timing)." })).toBeVisible();
});
