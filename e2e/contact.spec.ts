/**
 * The contact paths now serve the structured intakes.
 *
 * `/contact/site-operator` and `/contact/robot-team` used to render a free-text
 * inquiry form that posted to `/api/contact`. They now render the screening
 * intakes, which post gate answers to `/api/inbound-request` — the difference
 * that makes a submission qualifiable rather than a message in a queue. The old
 * form still exists at `/contact/general` for everything that is neither a site
 * task nor a robot team.
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

test("site-operator path presents the screening questions", async ({ page }) => {
  await page.goto("/contact/site-operator", { waitUntil: "domcontentloaded" });

  await expect(
    page.getByRole("heading", { name: /Six questions decide this/i }),
  ).toBeVisible();
  // The cheapest possible no is asked first.
  await expect(page.locator("#gate-serviceArea")).toBeVisible();
  await expect(page.getByText(/These questions are the screen/i)).toBeVisible();
});

test("robot-team path presents its own mirror of the screen", async ({ page }) => {
  await page.goto("/contact/robot-team", { waitUntil: "domcontentloaded" });

  // The robot side screens on whether a team would actually deploy, not on
  // whether a room works — so it must not show the site gates.
  await expect(page.locator("#gate-serviceArea")).toHaveCount(0);
  await expect(page.locator("form")).toBeVisible();
});

test("a blocking answer shows the site what would flip it, before submitting", async ({
  page,
}) => {
  await page.goto("/contact/site-operator", { waitUntil: "domcontentloaded" });

  // Outside the service area is the one answer that ends a submission outright.
  await page.locator("#gate-serviceArea").selectOption("outside_texas");

  await expect(page.getByText(/Not yet/i).first()).toBeVisible();
  // The rejection names the change that would flip it rather than dead-ending.
  await expect(page.getByText(/Expansion beyond Texas/i)).toBeVisible();
});

test("the legacy inquiry form is still reachable at /contact/general", async ({ page }) => {
  await page.goto("/contact/general", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("textbox", { name: /^Your name$/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Send inquiry/i })).toBeVisible();
});

test("the intake posts structured gate answers rather than prose", async ({ page }) => {
  const submissions = await mockIntakeSubmission(page);

  await page.goto("/contact/site-operator", { waitUntil: "domcontentloaded" });

  // Clear every gate so the spec tier and the prose fields appear.
  await page.locator("#gate-serviceArea").selectOption("austin_metro");
  await page.locator("#gate-sceneStability").selectOption("stable");
  await page.locator("#gate-taskShape").selectOption("single");
  await page.locator("#gate-objectVariety").selectOption("under_10");
  await page.locator("#gate-deploymentTimeline").selectOption("this_quarter");
  await page.locator("#gate-accessWindow").selectOption("scheduled");

  await expect(page.getByText(/Clears the screen/i).first()).toBeVisible();

  await page
    .locator("#prose-taskDescription")
    .fill("Totes come off the conveyor and get stacked onto a pallet, same way each time.");
  await page.locator("#contact-name").fill("Dana Whitfield");
  await page.locator("#contact-email").fill("dana@example.com");
  await page.locator("#contact-company").fill("Riverside Logistics");
  await page.locator("#contact-site-address").fill("1100 E 5th St, Austin, TX");

  await page.locator("form").getByRole("button").last().click();

  await expect.poll(() => submissions.length).toBe(1);
  const payload = submissions[0] as Record<string, any>;

  // The point of the whole change: enum answers, not a prose blob.
  expect(payload.siteTaskGates).toMatchObject({
    serviceArea: "austin_metro",
    sceneStability: "stable",
    taskShape: "single",
    objectVariety: "under_10",
    deploymentTimeline: "this_quarter",
    accessWindow: "scheduled",
  });
  expect(payload.buyerType).toBe("site_operator");
  expect(payload.taskDescription).toContain("Totes come off the conveyor");
});
