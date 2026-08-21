import { test, expect } from "@playwright/test";

test("homepage makes the months 0–2 deployment-preparation story obvious", async ({
  page,
}) => {
  await page.goto("/");

  // The kinetic rebuild renamed the hero headline, the primary CTA, and the
  // robot-team nav entry. Those are presentation. Every assertion below about
  // what the page may claim is unchanged, and still holds.
  await expect(
    page.getByRole("heading", {
      name: /The robot should arrive after the homework is done/i,
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
      name: /path to scaled deployment is 6\+ months/i,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: /Do the work once—not again for every robot company/i,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: /One workflow becomes one robot-ready work package/i,
    }),
  ).toBeVisible();
  await expect(
    page.getByText(
      /Onsite integration and the physical pilot stay with the OEM/i,
    ),
  ).toBeVisible();
  await expect(page.getByText(/12–24h/i)).toHaveCount(0);
});
