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
  await page.route("**/api/site-worlds/sessions", async (route) => {
    observedBody = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({
        error:
          "The site-world registration does not include a reachable runtime handle.",
        blockers: [
          "The site-world registration does not include a reachable runtime handle.",
        ],
      }),
    });
  });

  await page.goto("/for-robot-teams");

  await expect(
    page.getByRole("heading", {
      name: "Evaluate robot policies before field time.",
    }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Evaluation setup" })).toBeVisible();
  await expect(page.getByText("Policy API endpoint").first()).toBeVisible();
  await expect(page.getByText("Docker container").first()).toBeVisible();
  await expect(page.getByText("Model checkpoint").first()).toBeVisible();
  await expect(page.getByText(/do not prove safety validation/i)).toBeVisible();

  await page
    .getByLabel("Policy / checkpoint labels")
    .fill("warehouse-policy, baseline-policy, ignored-fourth");
  await page.getByLabel("Episode count").selectOption("500");
  await page
    .getByLabel("Observation schema ref")
    .fill("gs://robot-team/schemas/top-observation.v1.json");
  await page
    .getByLabel("Action schema ref")
    .fill("gs://robot-team/schemas/top-action.v1.json");
  await page.getByLabel("Control frequency").fill("20 Hz");
  await page.getByLabel("Robot embodiment").fill("mobile manipulator");
  await page.getByLabel("Task instruction").fill("pick tote from shelf");
  await page
    .getByLabel("Success criteria")
    .fill("tote placed without safety event");

  for (const [label, value] of Object.entries(policyApiFields)) {
    await page.getByLabel(label).fill(value);
  }

  await page.getByRole("button", { name: /Create hosted session/i }).click();
  await expect(
    page.getByText(/Hosted session access is request-gated/i),
  ).toBeVisible();
  await expect(page.getByText(/confirm runtime access, rights, pricing/i)).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Submit intake request/i }).first(),
  ).toHaveAttribute("href", /source=robot-team-eval/);

  expect(observedBody?.sessionMode).toBe("runtime_only");
  expect(observedBody?.requestedOutputs).toEqual([
    "policy_ranking",
    "failure_taxonomy",
    "ood_uncertainty_flags",
    "validation_targets",
  ]);
  const policy = observedBody?.policy as Record<string, unknown>;
  const submission = policy.robotTeamTestSubmission as Record<string, unknown>;
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
      name: "Evaluate robot policies before field time.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Create hosted session/i }),
  ).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(() => {
    return (
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth + 1
    );
  });
  expect(hasHorizontalOverflow).toBe(false);
});
