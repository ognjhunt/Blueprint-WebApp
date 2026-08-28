import { expect, test } from "@playwright/test";

const offering = {
  id: "scene-839873-simple-relocation",
  dataSource: "pipeline",
  recordKind: "configured_scene_offering",
  status: "configured_controls_pending",
  title: "Scene 839873 simple relocation",
  summary: "A robot-neutral configured scene for relocating one rigid mug.",
  category: "Rigid object handling",
  sceneIdentity: { id: "scene-839873", version: "v1" },
  task: {
    identity: { id: "simple-relocation", version: "v1" },
    kind: "rigid_relocation",
    strategy: "pick_and_place",
  },
  presentation: {
    thumbnailUrl: "/api/site-worlds/scene-839873-simple-relocation/thumbnail",
    derivedAppearanceEvidence: true,
    captureOrPhysicalEvidence: false,
  },
  evaluationAction: {
    enabled: false,
    label: "Evaluation locked until controls pass",
    href: null,
  },
  proofBoundary: {
    configurationIsPolicyEvaluation: false,
    configurationIsDeploymentOrSafetyApproval: false,
  },
};

test.beforeEach(async ({ page }) => {
  await page.route("**/api/site-worlds?**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ items: [offering], count: 1 }),
  }));
  await page.route("**/api/site-worlds/scene-839873-simple-relocation", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(offering),
  }));
  await page.route("**/api/site-worlds/scene-839873-simple-relocation/thumbnail", (route) => route.fulfill({
    status: 200,
    contentType: "image/png",
    body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"),
  }));
});

test("shows an authorized controls-pending configuration and keeps evaluation locked", async ({ page }) => {
  await page.goto("/sites");

  await expect(page.getByRole("heading", { name: "Scene 839873 simple relocation" })).toBeVisible();
  await expect(page.getByText("Controls pending", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Evaluation locked until controls pass" })).toBeDisabled();
  await expect(page.getByAltText("Derived configured-scene view for Scene 839873 simple relocation")).toBeVisible();
});

test("shows the public proof boundary on the offering detail page", async ({ page }) => {
  await page.goto("/sites/scene-839873-simple-relocation");

  await expect(page.getByRole("heading", { name: "Scene 839873 simple relocation" })).toBeVisible();
  await expect(page.getByText("Configured — controls pending", { exact: true })).toBeVisible();
  await expect(page.getByText(/does not prove policy execution, ranking performance, physical success/)).toBeVisible();
});
