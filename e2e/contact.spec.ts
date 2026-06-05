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

test('contact page leads with a simple robot-team Task Evaluation Run flow', async ({ page }) => {
  await page.goto('/contact', { waitUntil: 'domcontentloaded' });

  await expect(
    page.getByRole('heading', { name: /Request a Task Evaluation Run\./i }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: /Robot teams/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /Site operators/i })).toBeVisible();
  await expect(page.getByRole('textbox', { name: /First name/i })).toBeVisible();
  await expect(page.getByRole('textbox', { name: /Work email/i })).toBeVisible();
  await expect(page.getByRole('textbox', { name: /^Company$/i })).toBeVisible();
  await expect(page.getByRole('textbox', { name: /Robot \/ policy name/i })).toBeVisible();
  await expect(page.getByRole('textbox', { name: /Target site or site type/i })).toBeVisible();
  await expect(page.getByRole('textbox', { name: /Task \+ threshold/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Request evaluation/i })).toBeVisible();
  await expect(page.getByText(/Human and agent friendly/i)).toHaveCount(0);
  await expect(page.getByText(/Site data package/i)).toHaveCount(0);
});

test('site-operator contact path keeps the free access-boundary lane visible', async ({ page }) => {
  await page.goto('/contact/site-operator', { waitUntil: 'domcontentloaded' });

  await expect(
    page.getByRole('heading', { name: /Submit a Site for Robot Evaluation\./i }),
  ).toBeVisible();
  await expect(page.getByText(/Submitting a site is free/i)).toBeVisible();
  await expect(page.getByRole('textbox', { name: /Facility name or site type/i })).toBeVisible();
  await expect(page.getByRole('textbox', { name: /City \/ location/i })).toBeVisible();
  await expect(page.getByText(/Private review only/i)).toBeVisible();
  await expect(page.getByText(/Anonymized marketplace use/i)).toBeVisible();
  await expect(page.getByText(/Ask before each robot-team use/i)).toBeVisible();
  await expect(page.getByText(/Not sure yet/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /Submit site free/i })).toBeVisible();
});

test('robot-team contact form submits a Task Evaluation Run payload through a mocked endpoint', async ({ page }) => {
  const submissions = await mockInboundSubmission(page);

  await page.goto('/contact', { waitUntil: 'domcontentloaded' });

  await page.getByPlaceholder('First name*').fill('Ada');
  await page.getByPlaceholder('Company*').fill('Analytical Engines');
  await page.getByPlaceholder('Work email*').fill('ada@example.com');
  await page.getByRole('textbox', { name: /Robot \/ policy name/i }).fill('Unitree G1 policy API');
  await page.getByRole('textbox', { name: /Target site or site type/i }).fill('Warehouse in Chicago');
  await page
    .getByRole('textbox', { name: /Task \+ threshold/i })
    .fill('Tote transfer. Need >=97% simulated success before pilot.');
  await page.getByRole('button', { name: /Add optional details/i }).click();
  await page.getByRole('combobox', { name: /Preferred policy access method/i }).selectOption('Policy API endpoint');
  await page.getByRole('textbox', { name: /Scenario count/i }).fill('50 normal, 25 edge cases');

  await page.getByRole('button', { name: /Request evaluation/i }).click();

  await expect(page.getByText(/Task Evaluation Run request received/i)).toBeVisible();
  expect(submissions).toHaveLength(1);
  expect(submissions[0]).toMatchObject({
    buyerType: 'robot_team',
    commercialRequestPath: 'hosted_evaluation',
    requestedLanes: ['deeper_evaluation'],
    proofPathPreference: 'exact_site_required',
    siteName: 'Warehouse in Chicago',
    taskStatement: 'Tote transfer. Need >=97% simulated success before pilot.',
    targetRobotTeam: 'Unitree G1 policy API',
    realSiteRobotEvalFit: {
      evalCardInput: {
        robotOrPolicyTested: 'Unitree G1 policy API',
        preferredReviewPath: 'Policy API endpoint',
      },
    },
  });
});

test('site-operator contact form submits free access-boundary details through a mocked endpoint', async ({ page }) => {
  const submissions = await mockInboundSubmission(page);

  await page.goto('/contact/site-operator', { waitUntil: 'domcontentloaded' });

  await page.getByPlaceholder('First name*').fill('Nina');
  await page.getByPlaceholder('Company or operator*').fill('Brightleaf Ops');
  await page.getByPlaceholder('Work email*').fill('nina@example.com');
  await page.getByRole('textbox', { name: /Facility name or site type/i }).fill('Brightleaf Books');
  await page.getByRole('textbox', { name: /City \/ location/i }).fill('Durham, NC');
  await page.locator('label').filter({ hasText: 'Ask before each robot-team use' }).click();
  await page
    .getByRole('textbox', { name: /Privacy, safety, or commercialization notes/i })
    .fill('Redact faces and skip employee-only rooms.');

  await page.getByRole('button', { name: /Submit site free/i }).click();

  await expect(page.getByText(/Site submission received/i)).toBeVisible();
  expect(submissions).toHaveLength(1);
  expect(submissions[0]).toMatchObject({
    buyerType: 'site_operator',
    commercialRequestPath: 'site_claim',
    siteName: 'Brightleaf Books',
    siteLocation: 'Durham, NC',
    operatingConstraints: 'Ask before each robot-team use',
    privacySecurityConstraints: 'Redact faces and skip employee-only rooms.',
  });
});
