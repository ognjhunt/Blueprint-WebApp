import { test, expect, type Page } from "@playwright/test";
import { mockExternalFonts } from "./helpers/static-assets";
test.beforeEach(mockExternalFonts);
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
    if (pathname === "/api/site-worlds/tasks")
      return route.fulfill({ json: { items: [], access: { gated: true, status: "none", signedIn: true,
        emailVerified: true, allowed: false, staff: false } } });
    if (pathname === "/api/workspace/setup") {
      if (request.method() === "POST") {
        if (state.failSave)
          return route.fulfill({
            status: 503,
            json: { error: "Could not save your account. Please try again." },
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
          access: { operations: false, capture: false },
        },
      });
    }
    if (pathname === "/api/workspace/") {
      if (!state.workspaceType)
        return route.fulfill({
          status: 403,
          json: {
            error: "Choose an account type to get started.",
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
      page.getByRole("heading", { name: "Set up your account" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Try again", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Find jobs", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByText("Deployment company account", { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Open operations →" }),
    ).toHaveCount(0);
    await page
      .getByLabel("Business name", { exact: true })
      .fill("Workspace Company");
    await page.getByLabel("Account type", { exact: true }).selectOption(type);
    if (type === "site_operator") {
      await expect(page.getByRole("heading", { name: "Start with your site and job" })).toBeVisible();
      await expect(page.getByLabel("Business name", { exact: true })).toHaveCount(0);
      await page.getByRole("link", { name: "Start a job →" }).click();
    } else {
      await page.getByRole("checkbox").check();
      await page.screenshot({ path: info.outputPath("account-setup.png"), fullPage: true });
      await page.getByRole("button", { name: "Continue →" }).click();
    }
    await expect(page).toHaveURL(
      type === "site_operator"
        ? /\/contact\/site-operator$/
        : /\/contact\/robot-team$/,
    );
    await expect(
      page.getByRole("heading", {
        name: type === "site_operator" ? "Start a job" : "Apply to see jobs",
        exact: true,
      }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("heading", {
        name: type === "site_operator" ? "Start a job" : "Apply to see jobs",
        exact: true,
      }),
    ).toBeVisible();
    expect(state.workspaceType).toBe(type === "site_operator" ? null : type);
    expect(state.profile.organization).toBe(type === "site_operator" ? "Existing Company" : "Workspace Company");
  });
}
test("Settings offers setup and a failed save keeps editable values", async ({
  page,
}) => {
  const state = await account(page);
  await page.goto("/settings");
  await expect(
    page.getByRole("heading", { name: "Set up your account" }),
  ).toBeVisible();
  await page
    .getByLabel("Account type", { exact: true })
    .selectOption("robot_team");
  await page.getByLabel("Company", { exact: true }).fill("Retry Company");
  await page.getByRole("checkbox").check();
  state.failSave = true;
  await page.getByRole("button", { name: "Continue →" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Could not save your account",
  );
  await expect(page.getByLabel("Company", { exact: true })).toHaveValue(
    "Retry Company",
  );
  await expect(
    page.getByRole("button", { name: "Continue →" }),
  ).toBeEnabled();
  await expect(page).toHaveURL(/\/settings$/);
  expect(state.workspaceType).toBeNull();
});
test("the account type can still change at /settings?setup=1 without losing saved records", async ({
  page,
}) => {
  const state = await account(page, true),
    saved = JSON.stringify(state.savedRecords);
  await page.goto("/settings");
  // Settings itself no longer offers the switch (launch copy d-036): a site never needs it.
  await expect(page.getByRole("heading", { name: "Account type", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /Change workspace type/ })).toHaveCount(0);
  await page.goto("/settings?setup=1");
  await expect(
    page.getByRole("heading", { name: "Account type", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Account type", { exact: true })
    .selectOption("robot_team");
  await page
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await expect(page).toHaveURL(/\/settings$/);
  // A company's settings have no robots-and-policies tab any more (2026-11-12); its account line says what it is.
  await expect(page.locator("p.ws-section", { hasText: "Deployment company account" })).toBeVisible();
  expect(state.workspaceType).toBe("robot_team");
  expect(JSON.stringify(state.savedRecords)).toBe(saved);
});
test("workspace setup is usable on mobile", async ({ page }, info) => {
  await account(page);
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.goto("/settings");
  await expect(
    page.getByRole("heading", { name: "Set up your account" }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Account type", { exact: true }),
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

for (const role of ["site_operator", "robot_team"] as const) {
  test(`${role} settings keeps customer navigation out of the admin queue`, async ({ page }) => {
    const state = await account(page, true);
    state.workspaceType = role;
    await page.goto("/settings");
    await expect(page.locator('a[href^="/admin/"]')).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Open operations →" })).toHaveCount(0);
    // Settings repeats none of the sidebar's links (launch copy d-039); the sidebar is the way round.
    await expect(page.getByRole("link", { name: /Your jobs →|Open overview →|Find jobs →|Browse jobs →/ })).toHaveCount(0);
    const nav = page.getByRole("navigation", { name: role === "site_operator" ? "Site account" : "Deployment company account" });
    // A site's overview is its one jobs list (2026-11-12).
    await nav.getByRole("link", { name: role === "site_operator" ? "Your jobs" : "Overview", exact: true }).click();
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByRole("heading", { name: role === "site_operator" ? "Your jobs" : "Overview", exact: true })).toBeVisible();
    await page.goto("/settings");
    if (role === "robot_team") {
      await nav.getByRole("link", { name: "Find jobs", exact: true }).click();
      // The robot-team library pages under /app are gone (2026-11-12); the job library is the robot-team page.
      await expect(page).toHaveURL(/\/contact\/robot-team$/);
      await expect(page.locator("#robot-team-title")).toBeVisible();
    } else {
      await expect(nav.getByRole("link", { name: "Find jobs", exact: true })).toHaveCount(0);
    }
    await page.goto("/settings?setup=1");
    await expect(page.getByRole("heading", { name: "Account type", exact: true })).toBeVisible();
    await expect(page.locator('a[href^="/admin/"]')).toHaveCount(0);
  });
}
