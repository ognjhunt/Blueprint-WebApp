import { test, expect } from "@playwright/test";
import { mockExternalFonts } from "./helpers/static-assets";
import { createJobOutcomeToken } from "../server/utils/jobOutcomeToken";

test.beforeEach(mockExternalFonts);

test("an outcome link opens a confirm page that names only the answer", async ({ page }) => {
  const token = createJobOutcomeToken({ requestId: "e2e-req", companyId: "e2e-co", by: "site", state: "quote_given" });
  await page.goto(`/api/job-outcomes/${token}`);
  await expect(page.getByRole("heading", { name: "Record your answer" })).toBeVisible();
  await expect(page.getByText("Quote given")).toBeVisible();
  await expect(page.getByRole("button", { name: "Record this answer" })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("e2e-co");
});

test("a bad outcome link says only that it no longer works", async ({ page }) => {
  const response = await page.goto("/api/job-outcomes/not-a.real-token");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "This link no longer works." })).toBeVisible();
});

test("the thank-you page says what was recorded", async ({ page }) => {
  await page.goto("/job-outcome/thanks?answer=not_going_ahead");
  await expect(page.getByRole("heading", { name: "Thanks. We've recorded: Not going ahead." })).toBeVisible();
});
