import { test, expect, type Page } from "@playwright/test";
import { mockExternalFonts } from "./helpers/static-assets";
import { anonymizedOpportunityDraft } from "../client/src/types/taskBrowse";
import { processingFailure, projectPreparationOutcome } from "../server/utils/taskPreparationOutcome";
test.beforeEach(mockExternalFonts);
const outcomeCases = [processingFailure({label: "Reconstruction status", digest: `sha256:${"a".repeat(64)}`}),
  projectPreparationOutcome({category: "robot_incompatibility", reason: "robot_carry_path_rejected",
    basis: "conservative_configuration_check", robot_id: "franka_panda", evidence_digest: `sha256:${"b".repeat(64)}`}),
  projectPreparationOutcome({category: "insufficient_evidence", reason: "task_evidence_incomplete",
    basis: "missing_evidence", robot_id: null, evidence_digest: `sha256:${"c".repeat(64)}`})];
for (const width of [1440, 390]) for (const outcome of outcomeCases) {
  test(`preparation outcome ${outcome.category} is readable at ${width}px`, async ({page}, info) => {
    const snapshot = await seed(page, "site_operator");
    snapshot.tasks = [{...structuredClone(task), results: [], pilotRecommended: false,
      status: outcome.title, nextStep: outcome.nextStep,
      readiness: {decision: outcome.category, headline: outcome.title, operatorAction: null,
        missingViews: [], nextUpdateIso: null, outcome}}];
    await page.setViewportSize({width, height: 1024});
    await page.goto("/app/tasks/task-1");
    const notice = page.getByRole("region", {name: "Preparation outcome"});
    await expect(notice).toBeVisible();
    await expect(notice.getByText(outcome.scope, {exact: true})).toBeVisible();
    await expect(notice.getByText(/Next step — Blueprint/)).toBeVisible();
    await expect(page.getByRole("heading", {name: "No evaluation results yet"})).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({path: info.outputPath(`outcome-${outcome.category}-${width}.png`), fullPage: true});
  });
}
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
        requirements: {}, review: null, proposals: [], selection: null, agreement: null, outcome: null,
      }});
      return route.fallback();
    });
    await page.setViewportSize({width, height: 1024});
    await page.goto(`/capture-upload/${token}`);
    await expect(page.getByRole("region", {name: "Preparation outcome"})).toContainText(outcome.scope);
    await expect(page.getByText("Next action · Blueprint", {exact: true})).toHaveCount(0);
    await expect(page.getByText(outcome.nextStep)).toHaveCount(1);
    await expect(page.getByRole("region", {name: "Preparation outcome"}).getByText(outcome.nextStep)).toBeVisible();
    await expect(page.getByText("Video received.", {exact: true})).toBeVisible();
    await expect(page.getByText("Saved job brief", {exact: true})).toBeVisible();
    await expect(page.getByRole("region", {name: "Confirm your job brief"})).toHaveCount(0);
    await expect(page.getByRole("button", {name: /confirm it|Retry processing/})).toHaveCount(0);
    await expect(page.getByText(/Review the saved brief\.|checking whether it covers|If another recording is needed/)).toHaveCount(0);
    expect(writes).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({path: info.outputPath(`owner-outcome-${outcome.category}-${width}.png`), fullPage: true});
    if (width === 1440 && outcome.category === "processing_failure") {
      statusAvailable = false;
      await expect(page.getByText("Checking the current job status. Your saved job remains available.", {exact: true})).toBeVisible();
      await expect(page.getByRole("region", {name: "Preparation outcome"})).toHaveCount(0);
      await expect(page.getByText(outcome.title, {exact: true})).toHaveCount(0);
      await expect(page.getByRole("region", {name: "Confirm your job brief"})).toHaveCount(0);
      statusAvailable = true;
      stopped = false;
      const correction = page.getByText("Review or correct job details (optional)", {exact: true});
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
const terms = {
  successRate: 95,
  cycleTimeSeconds: 30,
  pilotBudgetUsd: 25000,
  deploymentBudgetUsd: null,
  targetDate: "2026-10-01T12:00:00Z",
  successDefinition:
    "Pick mixed cartons from the conveyor and place each carton into the correct tote. No drops or damaged cartons.",
};
const result = {
  id: "application-1",
  teamAlias: "Team A",
  status: "decided",
  successRate: 96,
  cycleTimeSeconds: 27,
  sampleCount: 40,
  evidenceLabel: "Simulation",
  targetsMet: true,
  selected: false,
};
const setup = {
  id: "setup-1",
  name: "Atlas M2",
  embodiment: "Mobile manipulator",
  policyName: "Policy",
  version: "v4.2",
  delivery: "container",
  reference: "https://registry.example.com/atlas/policy:v4.2",
  notes: "",
  updatedAt: "2026-09-13T12:00:00Z",
};
const task = {
  id: "task-1",
  title: "Pack cartons into totes",
  siteName: "Packing line",
  location: "Austin",
  siteType: "Fulfillment",
  status: "Review results",
  nextStep: "Review team results",
  terms,
  visibility: "anonymized",
  published: true,
  archived: false,
  potentialMatches: 2,
  capture: {
    id: "visit-1",
    status: "confirmed",
    startsAt: "2026-09-16T15:00:00Z",
    endsAt: "2026-09-16T16:00:00Z",
    capturerName: "Jordan Lee",
    changeStatus: null,
    canMessage: true,
  },
  results: [
    result,
    {
      ...result,
      id: "application-2",
      teamAlias: "Team B",
      successRate: 93,
      cycleTimeSeconds: 29,
      targetsMet: false,
    },
    {
      ...result,
      id: "application-3",
      teamAlias: "Team C",
      successRate: null,
      cycleTimeSeconds: null,
      sampleCount: null,
      targetsMet: null,
      status: "running",
    },
  ],
  pilot: { state: "not_selected", selectedResultId: null, notes: null },
  // Blueprint has recommended one bookable pilot (server `pilotRecommended`).
  pilotRecommended: true,
  createdAt: "2026-09-10T12:00:00Z",
};
const evaluation = {
  ...result,
  taskId: "task-1",
  title: task.title,
  siteType: "Fulfillment",
  location: null,
  setupName: "Atlas M2 · Policy v4.2",
  terms,
  outcome: null,
  archived: false,
  createdAt: "2026-09-13T12:00:00Z",
  runId: null,
};
// GET /api/workspace/openings/task-1. This is exactly what the server returns
// for a job started from the public form: the site-approved card and nothing
// more. server/tests/team-evaluation-request-journey.test.ts proves that from
// the real intake, brief confirmation and Pipeline sync; any other job id is
// refused below the way the server refuses a job that is not open.
const opening = {
  ...anonymizedOpportunityDraft(task.title),
  id: "task-1",
  publishedAtIso: "2026-09-10T12:00:00Z",
  thumbnailUrl: null,
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
            {
              ...structuredClone(task),
              id: "task-2",
              title: "Move totes to staging",
              status: "Capture scheduled",
              results: [],
              published: false,
              pilotRecommended: false,
            },
            {
              ...structuredClone(task),
              id: "task-past",
              title: "Bin transfer",
              archived: true,
              pilot: {
                state: "deployed",
                selectedResultId: "old",
                notes: "Pilot completed",
              },
            },
          ]
        : [],
    evaluations:
      role === "robot_team" && !empty
        ? [
            structuredClone(evaluation),
            {
              ...structuredClone(evaluation),
              id: "eval-2",
              title: "Tote transfer",
              successRate: null,
              cycleTimeSeconds: null,
              status: "running",
            },
            {
              ...structuredClone(evaluation),
              id: "eval-past",
              title: "Bin picking",
              archived: true,
              outcome: "not_selected",
              successRate: 89,
            },
          ]
        : [],
    setups: role === "robot_team" && !empty ? [structuredClone(setup)] : [],
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
    else if (url.pathname.startsWith("/api/workspace/openings/")) {
      if (!empty && url.pathname === "/api/workspace/openings/task-1")
        data = { opening };
      else
        return route.fulfill({
          status: 404,
          json: {
            error: "This job is not open to evaluation requests.",
            code: "job_not_open",
          },
        });
    } else if (url.pathname === "/api/csrf")
      data = { csrfToken: "local-only-csrf" };
    else if (url.pathname === "/api/workspace/profile") {
      snapshot.profile = { ...snapshot.profile, ...body };
      data = { ok: true };
    } else if (url.pathname === "/api/workspace/setups") {
      snapshot.setups = snapshot.setups.filter(
        (item: any) => item.id !== body.id,
      );
      snapshot.setups.push({ ...body, updatedAt: new Date().toISOString() });
      data = body;
    } else if (
      url.pathname.startsWith("/api/workspace/setups/") &&
      request.method() === "DELETE"
    ) {
      snapshot.setups = snapshot.setups.filter(
        (item: any) => item.id !== url.pathname.split("/").pop(),
      );
      data = { ok: true };
    } else if (url.pathname === "/api/workspace/tasks") {
      snapshot.tasks.unshift({
        ...structuredClone(task),
        ...body,
        id: body.id,
        title: body.title,
        terms: body.terms,
        status: "In review",
        results: [],
        capture: null,
        published: false,
      });
      data = { requestId: body.id, ok: true };
    } else if (url.pathname === "/api/workspace/evaluations") {
      snapshot.evaluations.unshift({
        ...structuredClone(evaluation),
        id: body.id,
        successRate: null,
        cycleTimeSeconds: null,
        status: "requested",
      });
      data = { requestId: body.id, ok: true };
    } else if (url.pathname.endsWith("/pilot")) {
      snapshot.tasks[0].pilot = {
        state: ({ start: "pilot", complete: "pilot_complete", deploy: "deployed" } as Record<string, string>)[body.action] ?? "selected",
        selectedResultId: body.resultId,
        notes: body.notes,
        siteVisitAnswer: body.siteVisitAnswer,
      };
      snapshot.tasks[0].results[0].selected = true;
      data = {
        ok: true,
        message:
          "Partner selected for a pilot. Blueprint passes on your invitation; you and the partner agree the pilot's dates and terms directly.",
      };
    } else if (url.pathname.endsWith("/capture")) {
      snapshot.tasks.find(
        (task: any) => task.id === url.pathname.split("/")[4],
      ).capture.changeStatus = "pending_review";
      data = {
        ok: true,
        message:
          body.action === "message"
            ? "Message queued for capture coordination."
            : "Cancellation requested. Your visit remains scheduled until confirmed.",
      };
    } else if (url.pathname.endsWith("/edit-request"))
      data = {
        ok: true,
        message: "Edit requested. Current task criteria remain in effect.",
      };
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
for (const role of ["site_operator", "robot_team"] as const) {
  for (const width of [1440, 390]) {
    test(`${role} screens follow the reference design at ${width}px`, async ({
      page,
    }, info) => {
      await seed(page, role);
      await page.setViewportSize({ width, height: 1024 });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const routes =
        role === "site_operator"
          ? [
              ["/app", "Overview"],
              ["/onboarding", "Finish setup"],
              ["/app/tasks", "Your tasks"],
              ["/app/tasks/task-1", "Pack cartons into totes"],
              ["/app/tasks/task-1?tab=capture", "Pack cartons into totes"],
              ["/app/history", "History"],
              ["/settings", "Settings"],
              ["/app/captures", "Captures"],
            ]
          : [
              ["/app", "Overview"],
              ["/onboarding", "Finish setup"],
              ["/app/library", "Task library"],
              ["/app/opportunities/task-1", opening.title],
              ["/app/evaluations/application-1", "Pack cartons into totes"],
              ["/app/history", "History"],
              ["/settings", "Settings"],
              ["/settings?tab=robots", "Settings"],
            ];
      for (const [path, title] of routes) {
        await page.goto(path);
        await expect(
          page.getByRole("heading", { level: 1, name: title, exact: true }),
        ).toBeVisible();
        await expect(page.locator(".workspace-shell")).toHaveCSS(
          "background-color",
          "rgb(246, 245, 239)",
        );
        await expect(page.locator("main")).toHaveCount(1);
        if (
          !(await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ))
        )
          throw new Error(
            JSON.stringify(
              await page.evaluate(() => ({
                viewport: innerWidth,
                root: document.documentElement.scrollWidth,
                overflow: [...document.querySelectorAll("*")]
                  .filter(
                    (element) =>
                      element.getBoundingClientRect().right > innerWidth + 1,
                  )
                  .map((element) => ({
                    tag: element.tagName,
                    cls: element.className,
                    width: element.getBoundingClientRect().width,
                  }))
                  .slice(0, 15),
              })),
            ),
          );
        if (role === "robot_team")
          await expect(page.getByText("Team B", { exact: true })).toHaveCount(
            0,
          );
        await page.screenshot({
          path: info.outputPath(`${path.replace(/[^a-z0-9]+/gi, "-")}.png`),
          fullPage: true,
        });
      }
      expect(errors).toEqual([]);
      if (width === 390) {
        await page.getByRole("button", { name: "Open navigation" }).click();
        await expect(page.getByRole("navigation")).toBeVisible();
        // Both personas get four: Overview, Tasks or Task library, History, Settings.
        await expect(
          page.getByRole("navigation").getByRole("link"),
        ).toHaveCount(4);
      }
    });
  }
}
test("a new task starts from the public capture form, not a second intake", async ({
  page,
}) => {
  await seed(page, "site_operator");
  await page.goto("/app/tasks/new");
  await expect(page).toHaveURL(/\/contact\/site-operator/);
  await expect(page.getByRole("form", { name: "Start a site capture" })).toBeVisible();
});

for (const width of [1440, 390]) {
  test(`owned job progress is readable without duplicate detail at ${width}px`, async ({ page }, info) => {
    const snapshot = await seed(page, "robot_team");
    snapshot.tasks = [{
      ...structuredClone(task),
      title: "Task statement pending",
      siteName: "6801 Burnet Road, Austin, TX",
      location: "6801 Burnet Road, Austin, TX",
      status: "In review",
      terms: { ...terms, successRate: null, cycleTimeSeconds: null, pilotBudgetUsd: null },
      results: [],
      readiness: {
        decision: "assessing",
        headline: "We can assess this job. Your capture covers the work area and we are preparing it.",
        operatorAction: null, missingViews: [], nextUpdateIso: null,
      },
      siteAdvisory: {
        state: "ready", schemaVersion: "site_customer_advisory.v1", sections: [],
        correlationId: "fixture-support-reference",
        unknowns: [
          "Video analysis and supplied statements are not independently verified measurements or proof of robot suitability.",
          "Some job facts and interpretations remain unresolved. Clarify them before choosing an approach.",
        ],
        nextAction: "Clarify unresolved job facts and success criteria.",
      },
    }];
    await page.setViewportSize({ width, height: 1024 });
    await page.goto("/app/tasks/task-1");
    await expect(page.getByText("6801 Burnet Road, Austin, TX", { exact: true })).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Open your job page", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "No evaluation results yet" })).toHaveCount(1);
    await expect(page.getByRole("heading", { name: "Evaluation results", exact: true })).toHaveCount(0);
    await expect(page.getByText("fixture-support-reference", { exact: true })).not.toBeVisible();
    await expect(page.getByRole("link", { name: "Contact Blueprint about this job" })).not.toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`task-detail-${width}.png`), fullPage: true });
    // The site sends its video and nothing else: the assessment's questions stay with Blueprint.
    await expect(page.getByText(/Open questions/)).toHaveCount(0);
    await expect(page.getByText(snapshot.tasks[0].siteAdvisory.unknowns[0], { exact: true })).toHaveCount(0);
    await page.getByText("Processing details", { exact: true }).click();
    await expect(page.getByRole("link", { name: "Contact Blueprint about this job" })).toHaveCSS("color", "rgb(32, 61, 46)");
    await expect(page.getByText("Reference: fixture-support-reference", { exact: true })).toBeVisible();
    await page.getByRole("tab", { name: "Overview", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Success criteria", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Request an edit" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });
}
test("site can coordinate a visit without a false completion", async ({
  page,
}) => {
  await seed(page, "site_operator");
  await page.goto("/app/tasks/task-1?tab=capture");
  await page.getByRole("button", { name: "Cancel visit", exact: true }).click();
  await page.getByRole("textbox", { name: "Reason" }).fill("Site closed");
  await page.getByRole("button", { name: "Submit request" }).click();
  await expect(page.getByRole("status")).toContainText(
    "remains scheduled until confirmed",
  );
});
test("site reviews results and continues to the pilot on the job page", async ({
  page,
}) => {
  await seed(page, "site_operator");
  await page.goto("/app/tasks/task-1");
  await expect(page.getByRole("button", { name: /Invite to pilot/ })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Pilot", exact: true })).toBeVisible();
  await expect(page.getByText(/Review the proposed approach, cost, support and evidence on your job page\. If you go ahead, you agree pilot terms directly with the deployment company\./)).toBeVisible();
  await expect(page.getByRole("button", { name: "Review the proposal on your job page →" })).toBeVisible();
  // No proposal action appears before Blueprint has a pilot proposal.
  await page.goto("/app/tasks/task-2");
  await expect(page.getByText(/No pilot is planned yet\./)).toBeVisible();
  await expect(page.getByRole("button", { name: /Review the proposal on your job page/ })).toHaveCount(0);
});
test("robot team saves a setup and requests an evaluation from an opening", async ({
  page,
}) => {
  await seed(page, "robot_team");
  await page.goto("/settings?tab=robots");
  await page.getByRole("button", { name: "+ Add setup" }).click();
  await page.getByRole("combobox", { name: "Robot model", exact: true }).selectOption("model");
  await page.getByLabel("Robot model URL", { exact: true }).fill("https://example.com/robot.urdf");
  await page.getByLabel("Setup name", { exact: true }).fill("Atlas M3");
  await page.getByLabel("Embodiment", { exact: true }).fill("Fixed arm");
  await page.getByLabel("Policy name", { exact: true }).fill("Packing");
  await page.getByLabel("Version or checkpoint", { exact: true }).fill("v5");
  await page
    .getByLabel("Reference URL", { exact: true })
    .fill("https://example.com/policy-v5");
  await page.getByRole("button", { name: "Save setup" }).click();
  await expect(page.getByText("Atlas M3", { exact: true })).toBeVisible();
  await page.goto("/app/opportunities/task-1");
  await page
    .getByLabel("Robot & policy", { exact: true })
    .selectOption({ label: "Atlas M3 · Packing v5" });
  await page.getByRole("checkbox", { name: /free during the beta/ }).check();
  await page.getByRole("checkbox", { name: /license Blueprint to run this policy/ }).check();
  await page.getByRole("button", { name: "Request evaluation →" }).click();
  await expect(page).toHaveURL(/\/app\/evaluations\/application-/);
  await expect(page.getByText("Review pending", { exact: true })).toBeVisible();
  await expect(page.getByText(/Your request is saved/)).toBeVisible();
});
test("a job that is not open shows no request form", async ({ page }) => {
  await seed(page, "robot_team");
  await page.goto("/app/opportunities/task-2");
  await expect(
    page.getByRole("heading", { name: "Opening unavailable" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Request evaluation →" }),
  ).toHaveCount(0);
});
test("empty workspaces and API errors are clear and do not invent records", async ({
  page,
}) => {
  await seed(page, "site_operator", true);
  await page.goto("/app");
  await expect(
    page.getByRole("heading", { name: "Start with one task" }),
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

test("settings tabs support keyboard navigation", async ({ page }) => {
  await seed(page, "robot_team");
  await page.goto("/settings");
  const tab = page.getByRole("tab", { name: "Account", exact: true });
  await tab.focus();
  await tab.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "Robots & policies" }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByRole("heading", { name: "Saved setups" }),
  ).toBeVisible();
});

test("existing connection page uses the shared workspace design", async ({
  page,
}) => {
  await seed(page, "robot_team");
  await page.goto("/app/connect/chatgpt");
  await expect(
    page.getByRole("heading", { name: "Connect Blueprint to ChatGPT" }),
  ).toBeVisible();
  await expect(page.locator(".workspace-shell")).toHaveCSS(
    "background-color",
    "rgb(246, 245, 239)",
  );
  await expect(page.getByRole("alert")).toContainText(
    "Start the connection from ChatGPT",
  );
  await expect(page.locator("main")).toHaveCount(1);
});


test("a selected team progresses only through explicit site-reported outcomes", async ({ page }, info) => {
  const snapshot = await seed(page, "site_operator");
  snapshot.tasks[0].pilot = { state: "selected", selectedResultId: "application-1", notes: null };
  snapshot.tasks[0].pilotBooking = { recommendationId: "synthetic-booking", bookedAtIso: "2026-10-18T00:00:00Z",
    contact: { name: "Synthetic team", organization: "Fixture Robotics", email: "team@example.test", phone: null },
    consentWithdrawn: false };
  await page.goto("/app/tasks/task-1?tab=results");
  await expect(page.getByRole("heading", { name: "Delivery partner selected", exact: true })).toBeVisible();
  await expect(page.getByText("Outcome recorded by your site.")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "team@example.test" })).toBeVisible();
  for (const label of ["Record pilot start", "Record pilot outcome", "Record deployment"]) {
    await page.getByRole("button", { name: new RegExp(label) }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("textbox", { name: "Decision notes" }).fill(`Synthetic local browser test: ${label}`);
    await dialog.getByRole("button", { name: "Save decision" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText("Outcome recorded by your site.")).toBeVisible();
  }
  await expect(page.getByRole("heading", { name: "Deployed", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Record deployment/ })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath("booked-pilot-site-reported-outcome.png"), fullPage: true });
});
