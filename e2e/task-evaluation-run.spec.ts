import { expect, test, type Page } from "@playwright/test";

import { validDecisionEnvelope } from "../server/tests/helpers/decision-evidence-fixtures";
import { seedCookieConsent } from "./helpers/cookie-consent";

const digest = `sha256:${"a".repeat(64)}`;

// The intake form is long enough that filling it can outlast CookieConsent's
// 1500ms reveal timer. When it does, the fixed bottom banner lands on top of
// the submit button and intercepts the click, so this spec passes or fails on
// how quickly the runner types. Seeding consent puts the page in the state a
// returning browser is already in and removes the race without suppressing the
// banner's own behaviour, which brand-polish still exercises.
test.beforeEach(seedCookieConsent);

async function fillIntake(page: Page, decisionQuestion: string) {
  await page.getByLabel("Testbed ID").fill("testbed-001");
  await page.getByLabel("Testbed version").fill("2026-07-29.1");
  await page.getByLabel("Testbed manifest digest").fill(digest);
  await page.getByLabel("Site ID").fill("site-001");
  await page.getByLabel("Task ID").fill("task-001");
  await page.getByLabel("Task description").fill("Move a tote to the target fixture.");
  await page.getByLabel("Site and task conditions (one per line)").fill("dry floor\nday shift");
  await page.getByLabel("What decision do you need to make?").fill(decisionQuestion);
  await page.getByLabel("Candidates or policies, if applicable (one per line)").fill("Candidate A\nCandidate B");
  await page.getByLabel("Decision-relevant claims (one per line)").fill("Candidate A can reach the fixture.\nCandidate A will outperform candidate B onsite.");
  await page.getByLabel("Primary success metric").fill("reach success rate");
  await page.getByLabel("Minimum value").fill("0.95");
  await page.getByLabel("Unit").fill("ratio");
  await page.getByLabel("Acceptable risk or confidence requirement").fill("At most five percent false-safe risk.");
  await page.getByLabel("Unacceptable failures").fill("Fixture collision");
  await page.getByLabel("Consequence of a false-safe").fill("Could damage the fixture.");
  await page.getByLabel("Budget ceiling (USD)").fill("5000");
  await page.getByLabel("Rights, privacy, and provider restrictions (one per line)").fill("No raw video outside Blueprint storage");
  await page.getByRole("button", { name: "Request a Task Evaluation Run" }).click();
}

function installRunApi(page: Page, outcome: "planning_then_partial" | "abstained") {
  let requestId = "request-e2e";
  let decisionId = "decision-e2e";
  let planning = outcome === "planning_then_partial";
  let submittedBody: Record<string, unknown> | null = null;

  page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === "/api/csrf") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ csrfToken: "e2e-csrf" }) });
      return;
    }
    if (url.pathname === "/api/task-evaluation-runs" && request.method() === "POST") {
      submittedBody = request.postDataJSON() as Record<string, unknown>;
      requestId = String(submittedBody.request_id);
      decisionId = String(submittedBody.decision_id);
      await route.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify({ ok: true, request_id: requestId, decision_id: decisionId, status: "submitted" }) });
      return;
    }
    if (url.pathname === `/api/task-evaluation-runs/${requestId}/status`) {
      const base = {
        ok: true,
        job_id: requestId,
        request_id: requestId,
        decision_id: decisionId,
        decision_question: String(submittedBody?.decision_question || "Task decision"),
        testbed_id: "testbed-001",
        testbed_version: "2026-07-29.1",
        created_at_iso: "2026-07-29T12:00:00-05:00",
        updated_at_iso: "2026-07-29T14:00:00-05:00",
      };
      if (planning) {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ...base, status: "planning", decision_projection: null }) });
        return;
      }
      const envelope = outcome === "abstained"
        ? validDecisionEnvelope({
            request_id: requestId,
            decision_id: decisionId,
            state: "abstained",
            overall: {
              outcome: "abstained",
              summary: "The qualified evidence cannot decide between the candidates.",
              decided_claim_ids: [],
              unresolved_claim_ids: ["onsite-outperformance"],
              selected_candidate_ids: [],
            },
          })
        : validDecisionEnvelope({ request_id: requestId, decision_id: decisionId });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ...base,
          status: envelope.state,
          decision_projection: { supported: true, envelope },
        }),
      });
      return;
    }
    await route.fulfill({ status: 599, contentType: "application/json", body: JSON.stringify({ error: `Unmocked E2E API: ${request.method()} ${url.pathname}` }) });
  });

  return {
    submitted: () => submittedBody,
    makeDecisionAvailable: () => {
      planning = false;
    },
  };
}

test("authenticated intake progresses from planning to a partial decision", async ({ page }) => {
  const api = installRunApi(page, "planning_then_partial");
  await page.goto("/app/runs/new");
  await expect(page.getByRole("heading", { name: /Describe the decision/i })).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/MuJoCo|Isaac|Cosmos|OSCAR/);

  await fillIntake(page, "Should candidate A receive field time?");
  await expect(page).toHaveURL(/\/app\/runs\/request-/);
  await expect(page.getByText("Decision not available yet")).toBeVisible();
  await expect(page.getByText(/current state is planning/i)).toBeVisible();
  expect(JSON.stringify(api.submitted())).not.toMatch(/mujoco|isaac|cosmos|oscar/i);

  api.makeDecisionAvailable();
  await page.reload();
  await expect(page.getByText("Partial decision")).toBeVisible();

  // The decision envelope is split across Decision / Evidence / Limits tabs,
  // with Decision first so the outcome leads. Everything asserted below is the
  // envelope's bounding: what the result does not cover and what would settle
  // it. That lives under Limits, so open it before asserting on it.
  await page.getByRole("tab", { name: "Limits" }).click();
  await expect(page.getByRole("heading", { name: "Validation envelope and unsupported conditions" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Next cheapest experiment" })).toBeVisible();
  await expect(page.getByText(/safe for autonomous production deployment/i)).toBeVisible();
});

test("authenticated intake can end in explicit abstention without a winner", async ({ page }) => {
  installRunApi(page, "abstained");
  await page.goto("/app/runs/new");
  await fillIntake(page, "Which candidate should receive field time?");

  // Wait for the run record before asserting on the outcome. getByText is a
  // substring match, and the intake itself describes abstention as a possible
  // outcome, so an assertion evaluated before navigation can match the form
  // instead of the result. Anchor on the URL, then match the outcome label
  // exactly so only the envelope's own title can satisfy it.
  await expect(page).toHaveURL(/\/app\/runs\/request-/);
  await expect(page.getByText("Explicit abstention", { exact: true })).toBeVisible();
  await expect(page.getByText(/No candidate or winner is inferred/i)).toBeVisible();
  await expect(page.getByText(/Selected winner/i)).toHaveCount(0);
});
