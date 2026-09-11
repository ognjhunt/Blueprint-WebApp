/**
 * The contact screens now screen.
 *
 * Both personas answer structured gate questions that post to
 * `/api/inbound-request` instead of free text to `/api/contact`, and a blocked
 * site sees which condition failed and what would flip it before it submits.
 */
import { test, expect } from "@playwright/test";

const mockIntakeSubmission = async (page: import("@playwright/test").Page) => {
  const submissions: Record<string, unknown>[] = [];

  await page.route("**/api/csrf", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ csrfToken: "e2e-safe-token" }),
    });
  });

  await page.route("**/api/inbound-request", async (route) => {
    submissions.push(JSON.parse(route.request().postData() || "{}"));
    await route.fulfill({
      status: 202,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, requestId: "e2e", status: "submitted" }),
    });
  });

  return submissions;
};

const clearEverySiteGate = async (page: import("@playwright/test").Page) => {
  await page.locator("#gate-serviceArea").selectOption("austin_metro");
  await page.locator("#gate-sceneStability").selectOption("stable");
  await page.locator("#gate-taskShape").selectOption("single");
  await page.locator("#gate-objectVariety").selectOption("under_10");
  await page.locator("#gate-deploymentTimeline").selectOption("this_quarter");
  await page.locator("#gate-accessWindow").selectOption("scheduled");
};

test("site-operator page leads with the questions that can end a submission", async ({
  page,
}) => {
  await page.goto("/contact/site-operator", { waitUntil: "domcontentloaded" });

  await expect(
    page.getByRole("heading", { name: /Let’s start with your site/i }),
  ).toBeVisible();
  await expect(page.locator("#gate-serviceArea")).toBeVisible();
  // The spec tier stays hidden until the gates pass.
  await expect(page.locator("#spec-cycleTime")).toHaveCount(0);
});

test("robot-team page asks its own gates, not the site's", async ({ page }) => {
  await page.goto("/contact/robot-team", { waitUntil: "domcontentloaded" });

  await expect(
    page.getByRole("heading", { name: /Bring your robot. Find the fit/i }),
  ).toBeVisible();
  await expect(page.locator("#gate-serviceArea")).toHaveCount(0);
  await expect(page.locator("#gate-hardwareMaturity")).toBeVisible();
  await expect(page.getByRole("button", { name: /Send application/i })).toBeVisible();
});

test("a blocking answer names the change that would flip it, before submitting", async ({
  page,
}) => {
  await page.goto("/contact/site-operator", { waitUntil: "domcontentloaded" });

  await page.locator("#gate-serviceArea").selectOption("outside_texas");

  await expect(page.getByText(/Not yet/i).first()).toBeVisible();
  await expect(page.getByText(/Expansion beyond Texas/i).first()).toBeVisible();
});

test("clearing the gates reveals the spec tier and reports the verdict", async ({ page }) => {
  await page.goto("/contact/site-operator", { waitUntil: "domcontentloaded" });
  await clearEverySiteGate(page);

  await expect(page.getByText(/clears the screen/i).first()).toBeVisible();
  await expect(page.locator("#spec-cycleTime")).toBeVisible();
  await expect(page.locator("#spec-lighting")).toBeVisible();
});

test("the form posts structured gate answers rather than prose", async ({ page }) => {
  const submissions = await mockIntakeSubmission(page);

  await page.goto("/contact/site-operator", { waitUntil: "domcontentloaded" });
  await clearEverySiteGate(page);

  await page.locator("#spec-cycleTime").selectOption("thirty_to_two_min");
  await page
    .locator("#prose-taskDescription")
    .fill("Totes come off the conveyor and get stacked onto a pallet, same way each time.");
  await page.locator("#contact-name").fill("Dana Whitfield");
  await page.locator("#contact-email").fill("dana@example.com");
  await page.locator("#contact-company").fill("Riverside Logistics");
  await page.locator("#contact-site-address").fill("1100 E 5th St, Austin, TX");

  await page.getByRole("button", { name: /Send inquiry/i }).click();

  await expect.poll(() => submissions.length).toBe(1);
  const payload = submissions[0] as Record<string, any>;

  expect(payload.siteTaskGates).toMatchObject({
    serviceArea: "austin_metro",
    sceneStability: "stable",
    taskShape: "single",
    objectVariety: "under_10",
    deploymentTimeline: "this_quarter",
    accessWindow: "scheduled",
  });
  expect(payload.siteTaskSpec).toMatchObject({ cycleTime: "thirty_to_two_min" });
  expect(payload.buyerType).toBe("site_operator");
  expect(payload.taskDescription).toContain("Totes come off the conveyor");
});

test("submission failure keeps the answers so a visitor can retry", async ({ page }) => {
  await page.route("**/api/csrf", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ csrfToken: "e2e-safe-token" }),
    });
  });
  await page.route("**/api/inbound-request", async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ message: "Service temporarily unavailable" }),
    });
  });

  await page.goto("/contact/site-operator", { waitUntil: "domcontentloaded" });
  await clearEverySiteGate(page);
  await page
    .locator("#prose-taskDescription")
    .fill("Totes come off the conveyor and get stacked onto a pallet.");
  await page.locator("#contact-name").fill("Dana Whitfield");
  await page.locator("#contact-email").fill("dana@example.com");
  await page.locator("#contact-company").fill("Riverside Logistics");
  await page.locator("#contact-site-address").fill("1100 E 5th St, Austin, TX");
  await page.getByRole("button", { name: /Send inquiry/i }).click();

  await expect(page.getByRole("alert")).toContainText(/Service temporarily unavailable/i);
  await expect(page.locator("#contact-company")).toHaveValue("Riverside Logistics");
  await expect(page.locator("#gate-serviceArea")).toHaveValue("austin_metro");
});
