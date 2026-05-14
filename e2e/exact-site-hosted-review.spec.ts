import { test, expect } from "@playwright/test";

test("exact-site hosted review route keeps the sample-review selector path stable", async ({ page }) => {
  await page.goto("/exact-site-hosted-review", { waitUntil: "networkidle" });

  await expect(page).toHaveURL(/\/product$/);
  await expect(
    page.getByRole("heading", {
      name: /Turn the exact site into a decision-ready world model\./i,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Inspect sample proof/i }).first(),
  ).toHaveAttribute("href", "/proof");
  await expect(
    page.getByRole("link", { name: /Request evaluation/i }).first(),
  ).toHaveAttribute(
    "href",
    "/contact?persona=robot-team&buyerType=robot_team&interest=evaluation-package&path=hosted-evaluation&source=product",
  );
});
