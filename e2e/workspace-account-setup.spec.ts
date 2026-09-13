import { test, expect, type Page } from "@playwright/test";
async function account(page: Page, configured = false) {
  const state = {
    workspaceType: configured ? "site_operator" : (null as string | null),
    profile: {
      name: "Legacy Account",
      organization: "Existing Company",
      email: "legacy@example.com",
    },
    termsRequired: !configured,
    savedRecords: [{ id: "older-record", title: "Retained site request" }],
    failSave: false,
  };
  await page.addInitScript(() => {
    localStorage.removeItem("blueprint_workspace_qa_role");
    localStorage.setItem(
      "blueprint_cookie_consent",
      JSON.stringify({ necessary: true, analytics: false, marketing: false }),
    );
  });
  await page.route("**/api/**", async (route) => {
    const request = route.request(),
      pathname = new URL(request.url()).pathname;
    if (pathname === "/api/csrf")
      return route.fulfill({ json: { csrfToken: "fixture-csrf" } });
    if (pathname === "/api/workspace/setup") {
      if (request.method() === "POST") {
        if (state.failSave)
          return route.fulfill({
            status: 503,
            json: { error: "Could not save your workspace. Please try again." },
          });
        const body = request.postDataJSON();
        state.workspaceType = body.workspaceType;
        state.profile = {
          ...state.profile,
          name: body.name,
          organization: body.organization,
        };
        state.termsRequired = false;
        return route.fulfill({
          json: { ok: true, workspaceType: state.workspaceType },
        });
      }
      return route.fulfill({
        json: {
          workspaceType: state.workspaceType,
          profile: state.profile,
          termsRequired: state.termsRequired,
          access: { operations: true, capture: false },
        },
      });
    }
    if (pathname === "/api/workspace/") {
      if (!state.workspaceType)
        return route.fulfill({
          status: 403,
          json: {
            error: "Choose a workspace type to get started.",
            code: "workspace_setup_required",
          },
        });
      return route.fulfill({
        json: {
          role: state.workspaceType,
          profile: state.profile,
          tasks: [],
          evaluations: [],
          setups: [],
        },
      });
    }
    return route.fulfill({
      json: { ok: true, opportunities: [], sessions: [], job_requests: [] },
    });
  });
  return state;
}
for (const type of ["site_operator", "robot_team"] as const) {
  test(`legacy account completes ${type} setup from Overview and survives reload`, async ({
    page,
  }, info) => {
    const state = await account(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/app");
    await expect(
      page.getByRole("heading", { name: "Set up your workspace" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Try again", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Browse openings", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByText("Robot-team workspace", { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Open operations →" }),
    ).toBeVisible();
    await page
      .getByLabel("Organization", { exact: true })
      .fill("Workspace Company");
    await page.getByLabel("Workspace type", { exact: true }).selectOption(type);
    await page.getByRole("checkbox").check();
    await page.screenshot({
      path: info.outputPath("account-setup.png"),
      fullPage: true,
    });
    await page
      .getByRole("button", {
        name:
          type === "site_operator"
            ? "Continue to site setup →"
            : "Continue to robot setup →",
      })
      .click();
    await expect(page).toHaveURL(
      type === "site_operator"
        ? /\/app\/tasks\/new$/
        : /\/settings\?tab=robots$/,
    );
    await expect(
      page.getByRole("heading", {
        name: type === "site_operator" ? "Request a task" : "Saved setups",
        exact: true,
      }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("heading", {
        name: type === "site_operator" ? "Request a task" : "Saved setups",
        exact: true,
      }),
    ).toBeVisible();
    expect(state.workspaceType).toBe(type);
    expect(state.profile.organization).toBe("Workspace Company");
  });
}
test("Settings offers setup and a failed save keeps editable values", async ({
  page,
}) => {
  const state = await account(page);
  await page.goto("/settings");
  await expect(
    page.getByRole("heading", { name: "Set up your workspace" }),
  ).toBeVisible();
  await page
    .getByLabel("Workspace type", { exact: true })
    .selectOption("robot_team");
  await page.getByLabel("Organization", { exact: true }).fill("Retry Company");
  await page.getByRole("checkbox").check();
  state.failSave = true;
  await page.getByRole("button", { name: "Continue to robot setup →" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Could not save your workspace",
  );
  await expect(page.getByLabel("Organization", { exact: true })).toHaveValue(
    "Retry Company",
  );
  await expect(
    page.getByRole("button", { name: "Continue to robot setup →" }),
  ).toBeEnabled();
  await expect(page).toHaveURL(/\/settings$/);
  expect(state.workspaceType).toBeNull();
});
test("Settings can change workspace type without losing saved records", async ({
  page,
}) => {
  const state = await account(page, true),
    saved = JSON.stringify(state.savedRecords);
  await page.goto("/settings");
  await page.getByRole("link", { name: "Change workspace type →" }).click();
  await expect(
    page.getByRole("heading", { name: "Workspace setup" }),
  ).toBeVisible();
  await page
    .getByLabel("Workspace type", { exact: true })
    .selectOption("robot_team");
  await page
    .getByRole("button", { name: "Save workspace", exact: true })
    .click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(
    page.getByRole("tab", { name: "Robots & policies" }),
  ).toBeVisible();
  expect(state.workspaceType).toBe("robot_team");
  expect(JSON.stringify(state.savedRecords)).toBe(saved);
});
test("workspace setup is usable on mobile", async ({ page }, info) => {
  await account(page);
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.goto("/settings");
  await expect(
    page.getByRole("heading", { name: "Set up your workspace" }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Workspace type", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("account-setup-mobile.png"),
    fullPage: true,
  });
});
