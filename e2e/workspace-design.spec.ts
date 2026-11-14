import { test, expect, type Page } from "@playwright/test";
import { mockExternalFonts } from "./helpers/static-assets";
import { processingFailure, projectPreparationOutcome } from "../server/utils/taskPreparationOutcome";
test.beforeEach(mockExternalFonts);
const outcomeCases = [processingFailure({label: "Reconstruction status", digest: `sha256:${"a".repeat(64)}`}),
  projectPreparationOutcome({category: "robot_incompatibility", reason: "robot_carry_path_rejected",
    basis: "conservative_configuration_check", robot_id: "franka_panda", evidence_digest: `sha256:${"b".repeat(64)}`}),
  projectPreparationOutcome({category: "insufficient_evidence", reason: "task_evidence_incomplete",
    basis: "missing_evidence", robot_id: null, evidence_digest: `sha256:${"c".repeat(64)}`})];
for (const width of [1440, 390]) for (const outcome of outcomeCases) {
  test(`full owner page outcome ${outcome.category} assigns the same next action at ${width}px`, async ({page}, info) => {
    await seed(page, "site_operator");
    const token = "outcome-owner";
    const writes: string[] = [];
    let statusAvailable = true;
    let stopped = true;
    await page.route("**/api/**", async route => {
      const {pathname} = new URL(route.request().url());
      if (route.request().method() !== "GET") writes.push(pathname);
      if (pathname === `/api/self-capture/uploads/${token}/status`) return route.fulfill({json: {
        ok: true, state: "ready", accepts: ["mov", "mp4"], captureReceived: true, uploadState: "processing_ready",
      }});
      if (pathname === `/api/site-task-brief/${token}`) return route.fulfill({json: {
        ready: true, scope: "owner", brief: {summary: "Move a ball from floor to tabletop", captureMode: "self_capture",
          proposed: [], unresolved: [], confirmedAtIso: null},
      }});
      if (pathname === `/api/site-task-brief/${token}/status`) {
        if (!statusAvailable) return route.fulfill({status: 503, json: {error: "Status unavailable"}});
        return route.fulfill({json: {
          scope: "owner", captureReceived: true, status: stopped
            ? {decision: outcome.category, headline: outcome.title, operatorAction: null, missingViews: [], nextUpdateIso: null, outcome}
            : {decision: "confirm_brief", headline: "Review your saved job brief.", operatorAction: null, missingViews: [], nextUpdateIso: null},
        }});
      }
      if (pathname === `/api/job-workflow/owner/${token}`) return route.fulfill({json: {
        schemaVersion: "job_marketplace.v1", revision: "workflow-1", stage: "job_submitted", briefAgreed: false,
        optionsAssessed: false, reviewRequired: false, nextAction: "Review the saved brief.", actionOwner: "site",
        requirements: {}, review: null,
      }});
      return route.fallback();
    });
    await page.setViewportSize({width, height: 1024});
    // The failed-read case below steps through the page's poll and its hold on the page's own clock.
    const failedRead = width === 1440 && outcome.category === "processing_failure";
    if (failedRead) await page.clock.install();
    await page.goto(`/capture-upload/${token}`);
    await expect(page.getByRole("region", {name: "Preparation outcome"})).toContainText(outcome.scope);
    await expect(page.getByText("Next action · Blueprint", {exact: true})).toHaveCount(0);
    await expect(page.getByText(outcome.nextStep)).toHaveCount(1);
    await expect(page.getByRole("region", {name: "Preparation outcome"}).getByText(outcome.nextStep)).toBeVisible();
    await expect(page.getByText("Video received.", {exact: true})).toBeVisible();
    // The brief is unconfirmed, so its confirmation stays reachable during Blueprint's stop.
    await expect(page.getByText("Saved job brief", {exact: true})).toHaveCount(0);
    await expect(page.getByText("Confirm your task: the one step that lets Blueprint run it", {exact: true})).toBeVisible();
    await expect(page.getByRole("region", {name: "Confirm your job brief"})).toHaveCount(0);
    await expect(page.getByRole("button", {name: /confirm it|Retry processing/})).toHaveCount(0);
    await expect(page.getByText(/Review the saved brief\.|checking whether it covers|If another recording is needed/)).toHaveCount(0);
    expect(writes).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({path: info.outputPath(`owner-outcome-${outcome.category}-${width}.png`), fullPage: true});
    if (failedRead) {
      statusAvailable = false;
      // A 503 after a good read keeps that status, said as of the time it was read (LAST_STATUS_HOLD_MS, 45 s)...
      await page.clock.fastForward(6_000);
      await expect(page.getByText(/^This is your job as of .+\. We could not check for anything newer just now and are trying again\.$/)).toBeVisible();
      await expect(page.getByRole("region", {name: "Preparation outcome"})).toContainText(outcome.scope);
      // ...and past the hold the status is unknown again.
      await page.clock.fastForward(45_000);
      await expect(page.getByText("Checking the current job status. Your saved job remains available.", {exact: true})).toBeVisible();
      await expect(page.getByText(/^This is your job as of /)).toHaveCount(0);
      await expect(page.getByRole("region", {name: "Preparation outcome"})).toHaveCount(0);
      await expect(page.getByText(outcome.title, {exact: true})).toHaveCount(0);
      await expect(page.getByRole("region", {name: "Confirm your job brief"})).toHaveCount(0);
      statusAvailable = true;
      stopped = false;
      await page.clock.fastForward(6_000);
      const correction = page.getByText("Confirm your task: the one step that lets Blueprint run it", {exact: true});
      await expect(correction).toBeVisible();
      await expect(page.getByText("Blueprint is preparing your reconstruction.", {exact: true})).toBeVisible();
      await expect(page.getByRole("region", {name: "Confirm your job brief"})).not.toBeVisible();
      await expect(page.getByText("Next action · You", {exact: true})).toHaveCount(0);
      await correction.click();
      await expect(page.getByRole("button", {name: "This is right — confirm it", exact: true})).toBeVisible();
      expect(writes).toEqual([]);
    }
  });
}
// One row of the account's "Your jobs" list (2026-11-12): the job page holds everything else.
const task = {
  id: "task-1",
  title: "Pack cartons into totes",
  siteName: "Packing line",
  location: "Austin",
  archived: false,
  recordingPermissionWithdrawn: false,
  createdAt: "2026-09-10T12:00:00Z",
};
async function seed(
  page: Page,
  role: "site_operator" | "robot_team",
  empty = false,
) {
  const snapshot: any = {
    role,
    profile: {
      name: "Alex Morgan",
      organization:
        role === "site_operator" ? "Acme Operations" : "Atlas Robotics",
      email: "alex@example.com",
    },
    tasks:
      role === "site_operator" && !empty
        ? [
            structuredClone(task),
            { ...structuredClone(task), id: "task-2", title: "Move totes to staging" },
            { ...structuredClone(task), id: "task-past", title: "Bin transfer", archived: true },
          ]
        : [],
  };
  await page.addInitScript((role) => {
    localStorage.setItem("blueprint_workspace_qa_role", role);
    localStorage.setItem(
      "blueprint_cookie_consent",
      JSON.stringify({ necessary: true, analytics: false, marketing: false }),
    );
  }, role);
  await page.route("**/api/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      body = request.method() === "GET" ? null : request.postDataJSON();
    let data: any = {};
    if (url.pathname === "/api/workspace/") data = snapshot;
    else if (url.pathname === "/api/csrf")
      data = { csrfToken: "local-only-csrf" };
    else if (url.pathname === "/api/workspace/profile") {
      snapshot.profile = { ...snapshot.profile, ...body };
      data = { ok: true };
    } else if (/^\/api\/workspace\/tasks\/[^/]+\/task-link$/.test(url.pathname))
      data = { url: `/capture-upload/fixture-${url.pathname.split("/")[4]}` };
    else if (url.pathname === "/api/capture-uploads") data = { sessions: [] };
    else if (url.pathname === "/api/task-evaluation-runs")
      data = { ok: true, job_requests: [] };
    else if (url.pathname === "/api/marketplace/entitlements/current")
      data = { entitlements: [] };
    else if (url.pathname.startsWith("/api/"))
      data = {
        ok: true,
        items: [],
        sessions: [],
        records: [],
        entitlements: [],
        job_requests: [],
      };
    await route.fulfill({ json: data });
  });
  return snapshot;
}
test("a new task starts from the public capture form, not a second intake", async ({
  page,
}) => {
  await seed(page, "site_operator");
  await page.goto("/app/tasks/new");
  await expect(page).toHaveURL(/\/contact\/site-operator/);
  await expect(page.getByRole("form", { name: "Start a site capture" })).toBeVisible();
});

test("empty workspaces and API errors are clear and do not invent records", async ({
  page,
}) => {
  await seed(page, "site_operator", true);
  await page.goto("/app");
  await expect(
    page.getByRole("heading", { name: "Start with one job" }),
  ).toBeVisible();
  await page.route("**/api/workspace/", (route) =>
    route.fulfill({
      status: 503,
      json: { error: "Workspace temporarily unavailable" },
    }),
  );
  await page.reload();
  await expect(page.getByRole("alert")).toContainText(
    "Workspace temporarily unavailable",
  );
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
});

test("a site's jobs list opens each open job on its job page, and nothing else", async ({ page }) => {
  await seed(page, "site_operator");
  await page.goto("/app");
  await expect(page.getByRole("heading", { level: 1, name: "Your jobs" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pack cartons into totes" })).toBeVisible();
  await expect(page.getByText("Bin transfer")).toHaveCount(0);
  const open = page.getByRole("button", { name: "Open your job page" });
  await expect(open).toHaveCount(2);
  await open.first().click();
  await expect(page).toHaveURL(/\/capture-upload\/fixture-task-1$/);
});

test("an old signed-in job page link lands on the jobs list", async ({ page }) => {
  await seed(page, "site_operator");
  await page.goto("/app/tasks/task-1");
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole("heading", { level: 1, name: "Your jobs" })).toBeVisible();
});
