import { expect, test } from "@playwright/test";

const policyApiFields = {
  "Policy API endpoint Endpoint URL": "https://robot-team.example/policy",
  "Policy API endpoint Auth handling / redacted secret ref":
    "Bearer token in redacted secret ref robot-policy-prod",
  "Policy API endpoint Observation schema URI or JSON ref":
    "gs://robot-team/schemas/observation.v1.json",
  "Policy API endpoint Action schema URI or JSON ref":
    "gs://robot-team/schemas/action.v1.json",
  "Policy API endpoint Rate-limit / runtime constraints": "200 ms p95, 10 rps",
  "Policy API endpoint Callback / log URI":
    "gs://robot-team/blueprint/callbacks/",
  "Policy API endpoint Owner contact": "robot-owner@example.com",
};

test("robot-team eval route is simple and submits normalized policy payload", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });

  let observedBody: Record<string, unknown> | null = null;
  await page.route("**/api/contact", async (route) => {
    observedBody = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true }),
    });
  });

  await page.goto("/robot-team/eval");

  await expect(
    page.getByRole("heading", {
      name: "Compare policies on one site task.",
    }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Start with the essentials." })).toBeVisible();
  await expect(page.getByText("API").first()).toBeVisible();
  await expect(page.getByText("Docker").first()).toBeVisible();
  await expect(page.getByText("Checkpoint").first()).toBeVisible();
  await expect(page.getByText(/Same task\. Same robot\. Same episode count\./i)).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Private robots without handing over either side's IP.",
    }),
  ).toBeVisible();
  await expect(page.getByText(/the full scoring harness, hidden failure labels/i)).toBeVisible();
  await expect(
    page.getByLabel("6 Protect hardware and site IP"),
  ).toHaveValue("customer_hosted_sealed_eval_capsule");
  await expect(page.getByText(/raw captures, full scenes, scoring harnesses/i)).toBeVisible();

  await page.getByLabel("Name", { exact: true }).fill("Jordan Lee");
  await page.getByLabel("Work email").fill("jordan@example.com");
  await page.getByLabel("Team or company").fill("Example Robotics");

  await page
    .getByLabel("2 Add policies")
    .fill("warehouse-policy, baseline-policy, ignored-fourth");
  await page.getByLabel("4 Choose episodes").selectOption("500");
  await page
    .getByLabel("6 Protect hardware and site IP")
    .selectOption("physical_robot_evidence_bridge");
  await page.getByText("Advanced details").click();
  await page
    .getByLabel("Site IP protection")
    .selectOption("redacted_anchor_packet");
  await page
    .getByLabel("Observation schema", { exact: true })
    .fill("gs://robot-team/schemas/top-observation.v1.json");
  await page
    .getByLabel("Action schema", { exact: true })
    .fill("gs://robot-team/schemas/top-action.v1.json");
  await page.getByLabel("Control frequency").fill("20 Hz");
  await page.getByLabel("3 Tell us the robot").fill("mobile manipulator");
  await page.getByLabel("Task instruction").fill("pick tote from shelf");
  await page
    .getByLabel("Success criteria")
    .fill("tote placed without safety event");
  await page
    .getByLabel("Customer-hosted connector ref")
    .fill("gs://robot-team/blueprint/connector-contract.json");

  for (const [label, value] of Object.entries(policyApiFields)) {
    await page.getByLabel(label).fill(value);
  }

  await page.getByRole("button", { name: /Send request/i }).click();
  await expect(
    page.getByText(/Request received\. Blueprint will confirm the real site/i),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Contact instead/i }).first(),
  ).toHaveAttribute("href", /source=robot-team-eval/);

  expect(observedBody).toMatchObject({
    name: "Jordan Lee",
    email: "jordan@example.com",
    company: "Example Robotics",
    projectType: "Policy Evaluation Run",
    requestSource: "robot-team-eval",
  });
  const submission = observedBody?.robotTeamTestSubmission as Record<string, unknown>;
  expect(submission.siteWorldId).toBeNull();
  expect(submission.sitePackageTarget).toBe("My exact site");
  expect(submission.schemaVersion).toBe(
    "blueprint.robot_team_test_submission.v1",
  );
  expect(submission.selectedModalities).toEqual(["policy_api_endpoint"]);
  expect(submission.policyLabels).toEqual([
    "warehouse-policy",
    "baseline-policy",
    "ignored-fourth",
  ]);
  expect(submission.episodeCount).toBe("500");
  expect(submission.validationMode).toBe("comparative_policy_eval");
  expect(submission.hardwareIntegrationMode).toBe(
    "physical_robot_evidence_bridge",
  );
  expect(submission.siteIpProtectionLevel).toBe("redacted_anchor_packet");
  expect(submission.customerHostedConnectorRef).toBe(
    "gs://robot-team/blueprint/connector-contract.json",
  );
  expect(submission.privateHardwareIntegration).toMatchObject({
    integrationMode: "physical_robot_evidence_bridge",
    siteIpProtectionLevel: "redacted_anchor_packet",
    blueprintIpControls: {
      rawCaptureBundleSharedWithCustomer: false,
      fullScoringHarnessSharedByDefault: false,
    },
  });
  expect(submission.observationSchemaRef).toBe(
    "gs://robot-team/schemas/top-observation.v1.json",
  );
  expect(submission.actionSchemaRef).toBe(
    "gs://robot-team/schemas/top-action.v1.json",
  );
  expect(submission.controlFrequency).toBe("20 Hz");
  expect(submission.robotEmbodiment).toBe("mobile manipulator");
  expect(submission.taskInstruction).toBe("pick tote from shelf");
  expect(submission.successCriteria).toBe("tote placed without safety event");
});

test("robot-team eval route is usable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/robot-team/eval");

  await expect(
    page.getByRole("heading", {
      name: "Compare policies on one site task.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Send request/i }),
  ).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(() => {
    return (
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth + 1
    );
  });
  expect(hasHorizontalOverflow).toBe(false);
});
