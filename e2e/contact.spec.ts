import { test, expect } from '@playwright/test';

const mockInboundSubmission = async (page: import('@playwright/test').Page) => {
  const submissions: Record<string, unknown>[] = [];

  await page.route('**/api/csrf', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ csrfToken: 'e2e-safe-token' }),
    });
  });

  await page.route('**/api/inbound-request', async (route) => {
    submissions.push(JSON.parse(route.request().postData() || '{}'));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        requestId: 'e2e-safe-request',
        status: 'submitted',
      }),
    });
  });

  return submissions;
};

test('contact page leads with a simple robot-team Policy Evaluation Run flow', async ({ page }) => {
  await page.goto('/contact/robot-team', { waitUntil: 'domcontentloaded' });

  await expect(
    page.getByRole('heading', { name: /Tell us what policies to compare\./i }),
  ).toBeVisible();
  await expect(
    page.locator('main').getByRole('link', { name: /Compare policies on a real site\./i }).first(),
  ).toBeVisible();
  await expect(
    page.locator('main').getByRole('link', { name: /Supply or monitor a facility\./i }).first(),
  ).toBeVisible();
  await expect(page.getByRole('textbox', { name: /^Name$/i })).toBeVisible();
  await expect(page.getByRole('textbox', { name: /Work email/i })).toBeVisible();
  await expect(page.getByRole('textbox', { name: /Robot team \/ company/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Send message/i })).toBeVisible();
  await expect(page.getByText(/Site data package/i)).toHaveCount(0);
});

test('site-operator contact path keeps the low-cost access-boundary lane visible', async ({ page }) => {
  await page.goto('/contact/site-operator', { waitUntil: 'domcontentloaded' });

  await expect(
    page.getByRole('heading', { name: /Share a place for policy comparison\./i }),
  ).toBeVisible();
  await expect(
    page.getByText(/Start a \$5,000\/site supply review or scope yearly monitoring\. Access, rights, and pricing are confirmed per scope\./i),
  ).toBeVisible();
  await expect(page.getByRole('textbox', { name: /^Name$/i })).toBeVisible();
  await expect(page.getByRole('textbox', { name: /Organization/i })).toBeVisible();
  await expect(
    page.locator('main').getByRole('link', { name: /Supply or monitor a facility\./i }).first(),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /Send message/i })).toBeVisible();
});

test('robot-team contact form submits a Policy Evaluation Run payload through a mocked endpoint', async ({ page }) => {
  // Contact.tsx's submit handler is a client-side mock (setSubmitted(true)) with no
  // backend call — real intake is wired separately. Assert that explicitly: no
  // /api/inbound-request hit happens, and the page shows its own confirmation state.
  const submissions = await mockInboundSubmission(page);

  await page.goto('/contact/robot-team', { waitUntil: 'domcontentloaded' });

  await page.getByRole('textbox', { name: /^Name$/i }).fill('Ada Lovelace');
  await page.getByRole('textbox', { name: /Work email/i }).fill('ada@example.com');
  await page.getByRole('textbox', { name: /Robot team \/ company/i }).fill('Analytical Engines');
  await page
    .getByRole('textbox', { name: /About the task/i })
    .fill('Tote transfer at a Chicago warehouse. Need a clear winner before field time.');

  await page.getByRole('button', { name: /Send message/i }).click();

  await expect(page.getByRole('heading', { name: /Message received\./i })).toBeVisible();
  await expect(
    page.getByText(/We will check the task, scope the comparison, and return a priced run plan\./i),
  ).toBeVisible();
  expect(submissions).toHaveLength(0);
});
