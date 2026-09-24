import { test, expect, type Page } from "@playwright/test";
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
const opening = {
  opportunity_id: "task-1",
  workflow: task.title,
  site_type: "Fulfillment",
  access_level: "anonymized",
  site_name: null,
  site_location: null,
  anonymized_summary: terms.successDefinition,
  benchmark_profile: "40 trials covering the agreed task conditions",
  task_targets: terms,
  pilot_budget_usd: 25000,
  deployment_budget_usd: null,
  target_date: "2026-10-01T12:00:00Z",
  data_use_permissions: {
    evaluateExistingPolicy: "granted",
    siteSpecificAdaptation: "not_granted",
    retainImprovements: "not_granted",
    generalModelTraining: "not_granted",
  },
  compute_responsibility: "Compute costs are agreed before work starts.",
  claim_ceiling: "Simulation does not establish physical performance.",
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
    else if (url.pathname === "/api/pilot-opportunities")
      data = {
        ok: true,
        opportunities: empty
          ? []
          : [
              opening,
              {
                ...opening,
                opportunity_id: "task-2",
                workflow: "Move totes to staging",
                site_type: "Distribution",
                task_targets: { successRate: null, cycleTimeSeconds: null },
                pilot_budget_usd: null,
              },
            ],
        proof_boundary: null,
      };
    else if (url.pathname === "/api/csrf")
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
        state: "selected",
        selectedResultId: body.resultId,
        notes: body.notes,
        siteVisitAnswer: body.siteVisitAnswer,
      };
      snapshot.tasks[0].results[0].selected = true;
      data = {
        ok: true,
        message:
          "Pilot team selected. Blueprint will coordinate the invitation and terms.",
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
              ["/app/opportunities", "Openings"],
              ["/app/opportunities/task-1", "Pack cartons into totes"],
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
        // Robot teams also get the task library and their runs and balance.
        await expect(
          page.getByRole("navigation").getByRole("link"),
        ).toHaveCount(role === "robot_team" ? 5 : 4);
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
test("site chooses an anonymous pilot team with a deliberate confirmation", async ({
  page,
}) => {
  await seed(page, "site_operator");
  await page.goto("/app/tasks/task-1");
  await page.getByRole("button", { name: "Invite to pilot →" }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("combobox", { name: "Robot-team on-site access" }).selectOption("subject_to_approval");
  await page
    .getByLabel("Decision notes")
    .fill("Review scope and pilot terms with this team.");
  await page.getByRole("button", { name: "Confirm pilot selection" }).click();
  await expect(page.getByRole("status")).toContainText("Pilot team selected");
  await expect(page.getByText("Pilot selected", { exact: true })).toBeVisible();
  await expect(page.getByText(/robot-team site access: possibly, subject to site approval/i)).toBeVisible();
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
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Request evaluation →" }).click();
  await expect(page).toHaveURL(/\/app\/evaluations\/application-/);
  await expect(page.getByText("Review pending", { exact: true })).toBeVisible();
  await expect(page.getByText(/Your request is saved/)).toBeVisible();
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
