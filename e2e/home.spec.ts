import { test, expect } from "@playwright/test";

test("homepage leads with real demand made deployment-ready, then the boundary", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: /Real jobs, fully specified/i,
    }),
  ).toBeVisible();

  const nav = page.getByRole("banner").getByRole("navigation");
  await expect(nav.getByRole("link", { name: /^For sites$/i })).toBeVisible();
  await expect(nav.getByRole("link", { name: /^For robot teams$/i })).toBeVisible();
  await expect(nav.getByRole("link", { name: /^How it works$/i })).toBeVisible();
  await expect(nav.getByRole("link", { name: /^Pricing$/i })).toBeVisible();
  await expect(
    page.getByRole("contentinfo").getByRole("link", { name: /^For Site Operators$/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /^Prepare a deployment$/i }).first(),
  ).toBeVisible();
  await expect(
    page
      .getByRole("contentinfo")
      .getByRole("link", { name: /^Request a Task Evaluation Run$/i }),
  ).toBeVisible();

  await expect(
    page.getByRole("heading", {
      name: /Don.t send engineers to scope a deployment/i,
    }),
  ).toBeVisible();
  await expect(
    page.getByText(/your deployment team starts when the robot arrives/i),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /A qualified deployable workcell/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /Do the work once\. Not once per vendor/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /Robot teams say what they can do/i }),
  ).toBeVisible();

  // The half Blueprint does not touch is on the page, with the physical reason.
  await expect(page.getByText(/Blueprint owns the site\. You own the robot/i)).toBeVisible();
  await expect(page.getByText(/Stays with the robot company/i)).toBeVisible();
  await expect(
    page.getByText(/cannot be finished before the hardware is in the building/i),
  ).toBeVisible();

  // The promise is stated as a number the product can be held to.
  await expect(
    page.getByText(/OEM engineering hours before the robot arrives/i).first(),
  ).toBeVisible();

  // The cross-vendor record is described as an outcome, never as an asset held today.
  await expect(
    page.getByText(/This record does not exist yet/i),
  ).toBeVisible();

  // The one charted figure still carries its source and evidence grade.
  await expect(page.getByText(/Illustrative model/i).first()).toBeVisible();
});
