import { expect, test } from "@playwright/test";

import { getOperatorQaFixtureForRequest } from "../scripts/qa/operator-surfaces";

test("admitted agent cancellation and cleanup retain honest status and diagnosis", async ({ page }, testInfo) => {
  const admission = (taskId: string, title: string) => ({ task_id: taskId, run_id: `run-${taskId}`, title,
    runtime: "openai_agents_api", source_commit: "a".repeat(40), enabled: true, expires_at: Date.now() / 1000 + 600 });
  const rows = [
    { admission: admission("completed-task", "Saved failure investigation"),
      engineering_handoff: { handoff_id: "repair-fixture", state: "handed_off", issue_id: "issue-fixture", engineering_complete: false }, run: {
      status: "completed", cancel_requested: false, cleanup_requested: false,
      output: { disposition: "investigate", summary: "The retained job names an ambiguous parent.",
        next_actions: ["Resolve the parent binding before resubmission."], uncertainty: [], evidence_references: [`sha256:${"b".repeat(64)}`] },
      artifacts: { agent_execution: { state: "completed", cleanup_state: "not_requested", updated_at: 100 } },
    } },
    { admission: admission("pending-task", "Pending investigation"), run: {
      status: "running", cancel_requested: false, cleanup_requested: false, output: null,
      artifacts: { agent_execution: { state: "running", cleanup_state: "not_requested", updated_at: 100 } },
    } },
  ];
  const actions: string[] = [];
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => {
    // The existing Express/Vite QA server has no standalone HMR port.
    // Match only that known development-client failure; application errors
    // still fail this browser flow.
    if (!/^Failed to construct 'WebSocket': The URL 'ws:\/\/localhost:undefined\/\?token=[A-Za-z0-9_-]+' is invalid\.$/.test(error.message)) {
      pageErrors.push(error.message);
    }
  });
  await page.route("**/*", async (route) => {
    const request = route.request(); const url = new URL(request.url());
    if (["http:", "https:"].includes(url.protocol) && !["localhost", "127.0.0.1", "::1"].includes(url.hostname)) {
      return route.fulfill({ status: 204, body: "" });
    }
    if (!url.pathname.startsWith("/api/")) return route.continue();
    if (url.pathname.startsWith("/api/admin/agent/adp/tasks")) {
      expect(request.headers().authorization).toBe("Bearer operator-qa-local-token");
      if (request.method() === "POST") {
        expect(request.postData()).toBe("{}");
        actions.push(url.pathname);
        if (url.pathname.endsWith("pending-task/cancel")) rows[1].run.cancel_requested = true;
        else if (url.pathname.endsWith("completed-task/cleanup")) {
          rows[0].run.cleanup_requested = true;
          rows[0].run.artifacts.agent_execution.cleanup_state = "deleted";
        } else throw new Error(`Unadmitted browser action: ${url.pathname}`);
      }
      return route.fulfill({ json: { tasks: rows } });
    }
    if (url.pathname === "/api/admin/agent/sessions") return route.fulfill({ json: { ok: true, sessions: [] } });
    if (url.pathname === "/api/admin/agent/context/options") return route.fulfill({ json: {
      ok: true, repoDocs: [], knowledgePages: [], blueprints: [], opsDocuments: [], startupPacks: [], profiles: [], environments: [], recentCreativeRuns: [],
    } });
    if (url.pathname === "/api/admin/agent/cache-efficiency") return route.fulfill({ status: 503, json: { error: "No telemetry in this fixture" } });
    if (url.pathname.startsWith("/api/admin/agent/")) return route.fulfill({ json: { ok: true, configured: false } });
    const fixture = getOperatorQaFixtureForRequest(request.url(), request.method());
    return fixture ? route.fulfill({ status: fixture.status, json: fixture.body }) : route.fulfill({ status: 503, json: { error: "No live API calls in browser fixture" } });
  });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/admin/leads");
  await page.getByRole("tab", { name: "Agent", exact: true }).click();
  const pending = page.getByRole("article", { name: "Pending investigation" });
  const completed = page.getByRole("article", { name: "Saved failure investigation" });
  await expect(completed.getByText("The retained job names an ambiguous parent.")).toBeVisible();
  await expect(completed.getByText("Engineering follow-up: handed off")).toBeVisible();
  await expect(completed.getByText("A reviewed release is still required before the original workflow can resume.")).toBeVisible();
  await pending.getByRole("button", { name: "Cancel task" }).click();
  await expect(pending.getByRole("status")).toContainText("running · Cancellation requested");
  await expect(pending.getByRole("button", { name: "Cancel task" })).toBeDisabled();
  rows[1].run.status = "cancelled";
  rows[1].run.artifacts.agent_execution.state = "cancelled";
  await expect(pending.getByRole("status")).toContainText("cancelled");
  await completed.getByRole("button", { name: "Clean up session" }).click();
  await expect(completed.getByRole("status")).toContainText("completed · Session cleanup confirmed");
  await expect(completed.getByText("The retained job names an ambiguous parent.")).toBeVisible();
  expect(actions).toEqual(["/api/admin/agent/adp/tasks/pending-task/cancel", "/api/admin/agent/adp/tasks/completed-task/cleanup"]);
  expect(pageErrors).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("adp-agent-tasks.png"), fullPage: false });
});
