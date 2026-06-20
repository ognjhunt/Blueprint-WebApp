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

test("robot-team eval interface renders and submits normalized hosted-session policy", async ({
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
        error: "Runtime path is request-gated.",
        blockers: ["Runtime path is request-gated."],
      }),
    });
  });

  await page.goto("/for-robot-teams");

  await expect(
    page.getByRole("heading", { name: "Robot-team test interface" }),
  ).toBeVisible();
  await expect(page.getByText("Policy API endpoint").first()).toBeVisible();
  await expect(page.getByText("Docker container").first()).toBeVisible();
  await expect(page.getByText("Recorded action traces").first()).toBeVisible();
  await expect(page.getByText("High-level skill traces").first()).toBeVisible();
  await expect(page.getByText("Teleop demos").first()).toBeVisible();
  await expect(page.getByText("Sim controller plugin").first()).toBeVisible();
  await expect(page.getByText("Model checkpoint").first()).toBeVisible();
  await expect(
    page.getByText(/does not prove deployment readiness/i),
  ).toBeVisible();

  await page
    .getByLabel("Policy labels")
    .fill("warehouse-policy, baseline-policy, ignored-fourth, ignored-fifth");
  await page.getByLabel("Episode count").selectOption("custom");
  await page.getByLabel("Custom episode count").fill("250");
  await page
    .getByLabel("Validation mode")
    .selectOption("comparative_policy_eval");
  await page
    .getByLabel("Observation schema ref")
    .fill("gs://robot-team/schemas/top-observation.v1.json");
  await page
    .getByLabel("Action schema ref")
    .fill("gs://robot-team/schemas/top-action.v1.json");
  await page.getByLabel("Control frequency").fill("20 Hz");
  await page.getByLabel("Robot embodiment").fill("mobile manipulator");
  await page.getByLabel("Gripper").fill("parallel jaw");
  await page.getByLabel("Camera setup").fill("wrist RGB-D and mast stereo");
  await page
    .getByLabel("Intrinsics / extrinsics ref")
    .fill("gs://robot-team/calibration/cameras.json");
  await page.getByLabel("Site package target").fill("cold-storage pick aisle");
  await page.getByLabel("Task instruction").fill("pick tote from shelf");
  await page
    .getByLabel("Start-state constraints")
    .fill("robot starts at aisle entry");
  await page
    .getByLabel("Success criteria")
    .fill("tote placed without safety event");

  for (const [label, value] of Object.entries(policyApiFields)) {
    await page.getByLabel(label).fill(value);
  }

  await page.getByRole("button", { name: /Create hosted session/i }).click();
  await expect(page.getByText(/Runtime path is request-gated/i)).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Submit intake request/i }),
  ).toHaveAttribute("href", /source=robot-team-eval/);
  const intakeHref = await page
    .getByRole("link", { name: /Submit intake request/i })
    .getAttribute("href");
  expect(decodeURIComponent(intakeHref || "")).toContain(
    "endpointUrl=https://robot-team.example/policy",
  );
  expect(decodeURIComponent(intakeHref || "")).toContain(
    "policyLabels=warehouse-policy, baseline-policy, ignored-fourth",
  );
  expect(decodeURIComponent(intakeHref || "")).toContain(
    "validationMode=comparative_policy_eval",
  );

  expect(observedBody?.sessionMode).toBe("runtime_only");
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
  expect(submission.episodeCount).toBe("custom");
  expect(submission.customEpisodeCount).toBe("250");
  expect(submission.validationMode).toBe("comparative_policy_eval");
  expect(submission.observationSchemaRef).toBe(
    "gs://robot-team/schemas/top-observation.v1.json",
  );
  expect(submission.actionSchemaRef).toBe(
    "gs://robot-team/schemas/top-action.v1.json",
  );
  expect(submission.controlFrequency).toBe("20 Hz");
  expect(submission.robotEmbodiment).toBe("mobile manipulator");
  expect(submission.gripper).toBe("parallel jaw");
  expect(submission.cameraSetup).toBe("wrist RGB-D and mast stereo");
  expect(submission.intrinsicsExtrinsicsRef).toBe(
    "gs://robot-team/calibration/cameras.json",
  );
  expect(submission.sitePackageTarget).toBe("cold-storage pick aisle");
  expect(submission.taskInstruction).toBe("pick tote from shelf");
  expect(submission.startStateConstraints).toBe("robot starts at aisle entry");
  expect(submission.successCriteria).toBe("tote placed without safety event");
  expect(submission.pipelineDatasetSchemaRefs).toContain(
    "robot_team_test_submission_modalities.v0.1",
  );
});

test("robot-team eval canonical submission route is usable on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/robot-team/eval");

  await expect(
    page.getByRole("heading", { name: "Robot-team test interface" }),
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
