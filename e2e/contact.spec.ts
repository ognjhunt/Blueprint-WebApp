import { test, expect } from "@playwright/test";

const mockContactSubmission = async (page: import("@playwright/test").Page) => {
  const submissions: Record<string, unknown>[] = [];

  await page.route("**/api/csrf", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ csrfToken: "e2e-safe-token" }),
    });
  });

  await page.route("**/api/contact", async (route) => {
    submissions.push(JSON.parse(route.request().postData() || "{}"));
    await route.fulfill({
      status: 202,
      contentType: "application/json",
      body: JSON.stringify({ success: true, sent: true, offWaitlistUrl: null }),
    });
  });

  return submissions;
};

test("robot-team contact page offers supplier participation", async ({
  page,
}) => {
  await page.goto("/contact/robot-team", { waitUntil: "domcontentloaded" });

  await expect(
    page.getByRole("heading", {
      name: /Bring your robot. Find the fit/i,
    }),
  ).toBeVisible();
  await expect(page.getByText(/Tell us what your system can do/i)).toBeVisible();
  await expect(page.getByRole("textbox", { name: /^Your name$/i })).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: /Work email/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: /^Company$/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Send application/i }),
  ).toBeVisible();
  await expect(page.getByText(/Site data package/i)).toHaveCount(0);
});

test("site-operator contact path presents the same Task Evaluation Run", async ({
  page,
}) => {
  await page.goto("/contact/site-operator", { waitUntil: "domcontentloaded" });

  await expect(
    page.getByRole("heading", {
      name: /Let’s start with your site/i,
    }),
  ).toBeVisible();
  await expect(
    page.getByText(/paid evaluation/i),
  ).toBeVisible();
  await expect(page.getByRole("textbox", { name: /^Your name$/i })).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: /^Company$/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Send inquiry/i }),
  ).toBeVisible();
  await expect(page.getByText(/Robot Match/i)).toHaveCount(0);
});

test("robot-team contact form submits a Task Evaluation Run payload through a mocked endpoint", async ({
  page,
}) => {
  const submissions = await mockContactSubmission(page);

  await page.goto("/contact/robot-team", { waitUntil: "domcontentloaded" });

  await page.getByRole("textbox", { name: /^Your name$/i }).fill("Ada Lovelace");
  await page
    .getByRole("textbox", { name: /Work email/i })
    .fill("ada@example.com");
  await page
    .getByRole("textbox", { name: /^Company$/i })
    .fill("Analytical Engines");
  await page
    .getByRole("textbox", { name: /What does your system do/i })
    .fill(
      "Tote transfer at a Chicago warehouse. Need to decide whether field time is justified.",
    );

  await page.getByRole("button", { name: /Send application/i }).click();

  await expect(
    page.getByRole("heading", { name: /Your application is in/i }),
  ).toBeVisible();
  await expect(
    page.getByText(
      /review your system and follow up/i,
    ),
  ).toBeVisible();

  expect(submissions).toHaveLength(1);
  expect(submissions[0]).toMatchObject({
    name: "Ada Lovelace",
    email: "ada@example.com",
    company: "Analytical Engines",
    engagementScope: "robot_team",
    requestSource: "website-contact-form",
  });
});

test("contact form surfaces a retryable error when intake submission fails", async ({
  page,
}) => {
  await page.route("**/api/csrf", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ csrfToken: "e2e-safe-token" }),
    });
  });
  await page.route("**/api/contact", async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Service temporarily unavailable" }),
    });
  });

  await page.goto("/contact/robot-team", { waitUntil: "domcontentloaded" });

  await page.getByRole("textbox", { name: /^Your name$/i }).fill("Ada Lovelace");
  await page
    .getByRole("textbox", { name: /Work email/i })
    .fill("ada@example.com");
  await page
    .getByRole("textbox", { name: /^Company$/i })
    .fill("Analytical Engines");
  await page.getByRole("textbox", { name: /What does your system do/i }).fill("Fixed-arm pick-and-place system.");
  await page.getByRole("button", { name: /Send application/i }).click();

  await expect(page.getByRole("alert")).toContainText(
    /Service temporarily unavailable/i,
  );
  // The form stays visible so the visitor can retry without losing input.
  await expect(
    page.getByRole("button", { name: /Send application/i }),
  ).toBeVisible();
});
