import { test, expect } from "@playwright/test";

test("exact-site hosted review route keeps the sample-review selector path stable", async ({ page }) => {
  await page.goto("/exact-site-hosted-review", { waitUntil: "networkidle" });

  await expect(page).toHaveURL(/\/exact-site-hosted-review$/);
  await expect(
    page.getByRole("heading", {
      name: /Review before you buy\./i,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Inspect sample review/i }).first(),
  ).toHaveAttribute("href", "/sample-evaluation");
  await expect(
    page.getByRole("link", { name: /Request hosted review/i }).first(),
  ).toHaveAttribute(
    "href",
    "/contact?persona=robot-team&buyerType=robot_team&interest=evaluation-package&path=hosted-evaluation&source=hosted-review",
  );
});
