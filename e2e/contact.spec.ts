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
  await page.goto('/contact', { waitUntil: 'domcontentloaded' });

  await expect(
    page.getByRole('heading', { name: /Request a Policy Evaluation Run\./i }),
  ).toBeVisible();
  await expect(page.locator('main').getByRole('link', { name: /Robot teams/i }).first()).toBeVisible();
  await expect(page.locator('main').getByRole('link', { name: /Site operators/i }).first()).toBeVisible();
  await expect(page.getByRole('textbox', { name: /Robot \/ policy name/i })).toBeVisible();
  await expect(page.getByRole('textbox', { name: /Target site or site type/i })).toBeVisible();
  await expect(page.getByRole('textbox', { name: /Task \+ threshold/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Request evaluation/i })).toBeVisible();
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
  await expect(page.getByText(/Ask before each robot-team use/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /Submit site free/i })).toBeVisible();
});

test('robot-team contact form submits a Policy Evaluation Run payload through a mocked endpoint', async ({ page }) => {
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
  await page.getByRole('textbox', { name: /Policy \/ checkpoint labels/i }).fill('policy_v1, policy_v2');
  await page.getByRole('combobox', { name: /Preferred policy access method/i }).selectOption('Policy API endpoint');
  await page.getByRole('textbox', { name: /Episode count/i }).fill('500');
  await page.getByRole('combobox', { name: /Validation mode/i }).selectOption('Comparative policy eval');
  await page.getByRole('textbox', { name: /Observation schema/i }).fill('RGB-D and robot state');
  await page.getByRole('textbox', { name: /Action schema/i }).fill('base, arm, gripper');
  await page.getByRole('textbox', { name: /Control frequency/i }).fill('20 Hz');

  await page.getByRole('button', { name: /Request evaluation/i }).click();

  await expect(page.getByText(/Policy Evaluation Run request received/i)).toBeVisible();
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
      scenarioCardInput: {
        normalScenario: '500 requested WAM-eval episodes',
      },
      evalCardInput: {
        robotOrPolicyTested: 'Unitree G1 policy API',
        preferredReviewPath: 'Policy API endpoint',
      },
    },
  });
});
