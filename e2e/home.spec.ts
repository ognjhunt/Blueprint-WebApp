import { test, expect } from "@playwright/test";

test("homepage makes the months 0–2 deployment-preparation story obvious", async ({
  page,
}) => {
  await page.goto("/");

  // The runway rebuild renamed the hero headline and the section findings.
  // Those are presentation. Every assertion below about what the page may
  // claim is unchanged, and still holds.
  await expect(
    page.getByRole("heading", {
      name: /Robots aren't the bottleneck\. Deploying them is/i,
    }),
  ).toBeVisible();
  const nav = page.getByRole("banner").getByRole("navigation");
  await expect(nav.getByRole("link", { name: /^For sites$/i })).toBeVisible();
  await expect(
    nav.getByRole("link", { name: /^For robot teams$/i }),
  ).toBeVisible();
  await expect(
    nav.getByRole("link", { name: /^How it works$/i }),
  ).toBeVisible();
  await expect(nav.getByRole("link", { name: /^Pricing$/i })).toBeVisible();
  await expect(
    page
      .getByRole("contentinfo")
      .getByRole("link", { name: /^For Site Operators$/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /^Prepare a deployment$/i }).first(),
  ).toBeVisible();
  // The run intake stays reachable under its full name from the footer.
  await expect(
    page
      .getByRole("contentinfo")
      .getByRole("link", { name: /^Request a Task Evaluation Run$/i }),
  ).toBeVisible();

  await expect(
    page.getByRole("heading", {
      name: /China ships 97 of every 100 humanoids/i,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: /Two of the six months happen before the robot is crated/i,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: /Do the work once\. Not once per vendor/i,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: /One workflow in\. One qualified deployment out/i,
    }),
  ).toBeVisible();

  // The physical boundary stays on the page, not in the terms.
  await expect(
    page.getByText(
      /Onsite integration, commissioning, and the physical pilot stay with the robot company/i,
    ),
  ).toBeVisible();

  // Every charted figure carries a primary source and an evidence grade.
  await expect(
    page.getByRole("link", { name: /IFR World Robotics 2025/i }).first(),
  ).toBeVisible();
  await expect(page.getByText(/Illustrative model/i).first()).toBeVisible();

  // The leading-edge share never travels without its caveat, and the volume
  // figure the site refuses to chart is named as excluded rather than dropped.
  await expect(page.getByText(/A shipped humanoid is not a working one/i)).toBeVisible();
  await expect(page.getByText(/deliberately not charted here/i)).toBeVisible();

  await expect(page.getByText(/12–24h/i)).toHaveCount(0);
});
