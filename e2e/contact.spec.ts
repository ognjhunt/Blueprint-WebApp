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

test('contact page leads with capture and world-model requests', async ({ page }) => {
  await page.goto('/contact', { waitUntil: 'domcontentloaded' });

  await expect(
    page.getByRole('heading', { name: /Request a real-site robot eval\./i }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: /I build\/deploy robots/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /I run\/represent a site/i })).toBeVisible();
  await expect(
    page.getByPlaceholder('Site, task, robot type, threshold, or pilot workflow'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /Request site data/i }).first()).toBeVisible();
  await expect(
    page.getByText(/Site data package/i).first(),
  ).toBeVisible();
  await expect(page.getByRole('radio', { name: /Policy evaluation/i })).toBeVisible();
  await expect(page.getByRole('radio', { name: /New capture request/i })).toBeVisible();
  await expect(page.getByText(/Required first pass/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /Add Site\/Task\/Scenario\/Eval intake/i })).toBeVisible();
  await expect(page.getByText(/Proof boundaries visible/i)).toHaveCount(0);
});

test('site-operator contact path keeps the free access-boundary lane visible', async ({ page }) => {
  await page.goto('/contact/site-operator', { waitUntil: 'domcontentloaded' });

  await expect(page.getByRole('link', { name: /I run\/represent a site/i })).toBeVisible();
  await expect(page.getByText(/Site-operator participation is free/i)).toBeVisible();
  await expect(page.getByRole('textbox', { name: /Facility name/i })).toBeVisible();
  await expect(page.getByRole('textbox', { name: /Access rules/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Submit site free/i }).last()).toBeVisible();
});

test('robot-team contact form submits a structured real-site fit payload through a mocked endpoint', async ({ page }) => {
  const submissions = await mockInboundSubmission(page);

  await page.goto('/contact', { waitUntil: 'domcontentloaded' });

  await page.getByPlaceholder('First name*').fill('Ada');
  await page.getByPlaceholder('Last name*').fill('Lovelace');
  await page.getByPlaceholder('Company name*').fill('Analytical Engines');
  await page.getByPlaceholder('Work email*').fill('ada@example.com');
  await page.getByRole('textbox', { name: /Your role/i }).fill('Autonomy lead');
  await page
    .getByRole('textbox', { name: /What real-site data or robot task should Blueprint help with\?/i })
    .fill('Qualify a tote picking workflow.');
  await page.getByRole('textbox', { name: /Site or facility/i }).fill('Warehouse in Chicago');
  await page.getByRole('button', { name: /Add Site\/Task\/Scenario\/Eval intake/i }).click();
  await page.getByRole('textbox', { name: /Known geometry or assets/i }).fill('CAD for dock and staging lanes.');
  await page.getByRole('textbox', { name: /Visual conditions/i }).fill('Mixed LED light and reflective tape.');
  await page.getByRole('textbox', { name: /Required success rate/i }).fill('97% over 200 attempts');
  await page.getByRole('textbox', { name: /Cycle-time threshold/i }).fill('45 seconds per tote');
  await page.getByRole('textbox', { name: /Intervention-rate threshold/i }).fill('fewer than 1 per shift');
  await page.getByRole('textbox', { name: /Safety constraints/i }).fill('operator signoff and exclusion zones');
  await page.getByRole('textbox', { name: /Required evidence/i }).fill('simulator traces and action logs');
  await page.getByRole('textbox', { name: /Robot or policy tested/i }).fill('Unitree G1 policy API endpoint.');
  await page
    .getByRole('textbox', { name: /Validation expectations/i })
    .fill('Compare policy trace, action logs, human demo, and short pilot result.');

  await page.getByRole('button', { name: /Request site data/i }).last().click();

  await expect(page.getByText(/Site data request received/i)).toBeVisible();
  expect(submissions).toHaveLength(1);
  expect(submissions[0]).toMatchObject({
    buyerType: 'robot_team',
    requestedLanes: ['deeper_evaluation'],
    siteName: 'Warehouse in Chicago',
    taskStatement: 'Qualify a tote picking workflow.',
    realSiteRobotEvalFit: {
      siteCardInput: {
        knownGeometryAssets: 'CAD for dock and staging lanes.',
        visualConditions: 'Mixed LED light and reflective tape.',
        safetyConstraints: 'operator signoff and exclusion zones',
      },
      taskCardInput: {
        requiredMetrics:
          'Success-rate threshold: 97% over 200 attempts\nCycle-time threshold: 45 seconds per tote\nIntervention-rate threshold: fewer than 1 per shift',
      },
      evalCardInput: {
        robotOrPolicyTested: 'Unitree G1 policy API endpoint.',
        resultsValidationExpectations:
          'Required evidence: simulator traces and action logs\nValidation expectations: Compare policy trace, action logs, human demo, and short pilot result.',
      },
    },
  });
});

test('site-operator contact form submits free access-boundary details through a mocked endpoint', async ({ page }) => {
  const submissions = await mockInboundSubmission(page);

  await page.goto('/contact/site-operator', { waitUntil: 'domcontentloaded' });

  await page.getByPlaceholder('First name*').fill('Nina');
  await page.getByPlaceholder('Last name*').fill('Operator');
  await page.getByPlaceholder('Operator or company*').fill('Brightleaf Ops');
  await page.getByPlaceholder('Work email*').fill('nina@example.com');
  await page.getByRole('textbox', { name: /Facility name/i }).fill('Brightleaf Books');
  await page.getByRole('textbox', { name: /Site location/i }).fill('Durham, NC');
  await page.getByRole('textbox', { name: /Access rules/i }).fill('Escorted weekdays, no capture near the cash office.');
  await page.getByRole('button', { name: /Add privacy, rights, or commercialization details/i }).click();
  await page.getByRole('textbox', { name: /Rights and ownership notes/i }).fill('Owner approval required before release.');
  await page.getByRole('textbox', { name: /Privacy and security notes/i }).fill('Redact faces and skip employee-only rooms.');
  await page.getByRole('textbox', { name: /Commercialization preference/i }).fill('Keep private until owner review.');

  await page.getByRole('button', { name: /Submit site free/i }).last().click();

  await expect(page.getByText(/Site claim received/i)).toBeVisible();
  expect(submissions).toHaveLength(1);
  expect(submissions[0]).toMatchObject({
    buyerType: 'site_operator',
    siteName: 'Brightleaf Books',
    siteLocation: 'Durham, NC',
    operatingConstraints: 'Escorted weekdays, no capture near the cash office.',
    captureRights: 'Owner approval required before release.',
    privacySecurityConstraints: 'Redact faces and skip employee-only rooms.',
    derivedScenePermission: 'Keep private until owner review.',
  });
});
