import { expect, test } from "@playwright/test";

import { getOperatorQaFixtureForRequest } from "../scripts/qa/operator-surfaces";
import { csrfProtection } from "../server/middleware/csrf";

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

// Uses the existing dev-only operator fixture; no live auth or external effects.
test("saved communications draft stays visible and draft-only after a queue read failure", async ({ page }, testInfo) => {
  const body = "I'm building Blueprint. Is this workflow useful to discuss?";
  let failQueue = true;
  const writes: string[] = [];
  await page.route("**/*", async route => {
    const request = route.request(), url = new URL(request.url());
    if (["http:", "https:"].includes(url.protocol) && !["localhost", "127.0.0.1", "::1"].includes(url.hostname)) return route.fulfill({ status: 204, body: "" });
    if (!url.pathname.startsWith("/api/")) return route.continue();
    if (request.method() === "POST" && url.pathname !== "/api/analytics/ingest") writes.push(url.pathname);
    if (url.pathname === "/api/admin/leads/action-queue") {
      expect(request.headers().authorization).toBe("Bearer operator-qa-local-token");
      if (failQueue) return route.fulfill({ status: 500, json: { error: "Failed to fetch action queue" } });
      return route.fulfill({ json: { items: [{ id: "communications_saved-job", status: "pending_approval", lane: "outbound_prospect",
        action_type: "send_email", source_collection: "outboundProspects", source_doc_id: "saved-prospect", action_tier: 3, draft_output: {},
        action_payload: { to: "operator@facility.example", subject: "A workflow question", body, communications: { output: { body } } }, sending_enabled: false,
        outreach_review: { digest: "a".repeat(64), hardChecksPassed: true, blockers: [], semanticReviewRequired: { evidence: "Verify the source." } } }],
        summary: { total: 1, pending_approval: 1, failed: 0 } } });
    }
    const fixture = getOperatorQaFixtureForRequest(request.url(), request.method());
    return fixture ? route.fulfill({ status: fixture.status, json: fixture.body }) : route.fulfill({ status: 503, json: { error: "No live API calls in browser fixture" } });
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/admin/leads");
  await page.getByRole("tab", { name: "Approvals", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Could not load the action queue (500)" })).toBeVisible();
  await expect(page.getByText("No pending approvals or failed actions right now.")).toHaveCount(0);
  await expect(page.getByText("—", { exact: true })).toHaveCount(4);
  failQueue = false;
  await page.getByRole("button", { name: "Retry loading approvals" }).click();
  await expect(page.getByText("To: operator@facility.example", { exact: true })).toBeVisible();
  await expect(page.getByText(body, { exact: true })).toBeVisible();
  await expect(page.getByText("Tier 3", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve outreach" })).toBeDisabled();
  await expect(page.getByText(/Sending is disabled/)).toBeVisible();
  expect(writes).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("communications-approvals-draft-only.png"), fullPage: true });
});

test("owner repairs a saved draft after its CSRF cookie changes while sending remains disabled", async ({ page }, testInfo) => {
  const pageErrors: string[] = [];
  let failQueue = false;
  let csrfReads = 0, csrfRefusals = 0;
  const staleCsrf = "a".repeat(64), currentCsrf = "b".repeat(64);
  page.on("pageerror", error => { pageErrors.push(error.message); });
  const original = "I'm building Blueprint. We guarantee results. Is this useful?";
  const repaired = "I'm building Blueprint. Is this relevant?";
  const output = { disposition: "draft", subject: "A workflow question", body: original, reason: "One bounded question",
    usedFactIds: ["unknown"], refreshFactIds: [], requiresHumanReview: true,
    outreachContract: { senderIdentity: "I'm building Blueprint", value: { offer: "A public observation", limits: "Public sources only" },
      question: "Is this useful?", recipientChoice: "Your choice" } };
  const item: any = { id: "communications_saved-job", status: "pending_approval", lane: "outbound_prospect",
    action_type: "send_email", source_collection: "outboundProspects", source_doc_id: "saved-prospect", action_tier: 3,
    draft_output: output, sending_enabled: false, action_payload: { to: "operator@facility.example", subject: output.subject, body: original,
      communications: { output, brief: { facts: [{ id: "fact-1", claim: "A verified public workflow" }] } } },
    outreach_review: { digest: "a".repeat(64), hardChecksPassed: false, blockers: ["used_fact_missing", "pressure_or_guarantee"],
      semanticReviewRequired: { evidence: "Verify the source." } } };
  const actions: string[] = [];
  await page.route("**/*", async route => {
    const request = route.request(), url = new URL(request.url());
    if (["http:", "https:"].includes(url.protocol) && !["localhost", "127.0.0.1", "::1"].includes(url.hostname)) return route.fulfill({ status: 204, body: "" });
    if (!url.pathname.startsWith("/api/")) return route.continue();
    if (url.pathname === "/api/csrf") {
      csrfReads++;
      const cookie = request.headers().cookie?.match(/(?:^|;\s*)csrf_token=([a-f0-9]{64})(?:;|$)/)?.[1];
      const token = cookie ?? staleCsrf;
      return route.fulfill({ json: { csrfToken: token }, headers: { "Set-Cookie": `csrf_token=${token}; Path=/; HttpOnly; SameSite=Lax` } });
    }
    if (url.pathname.startsWith("/api/admin/leads/action-queue")) {
      expect(request.headers().authorization).toBe("Bearer operator-qa-local-token");
      if (request.method() === "POST") {
        // Run the production middleware against the actual browser cookie and
        // header before the fixture action can have any effect.
        let allowed = false, refusal: { status: number; body: unknown } | null = null;
        csrfProtection({ method: request.method(), headers: request.headers(),
          header: (name: string) => request.headers()[name.toLowerCase()] } as any,
          { status: (status: number) => ({ json: (body: unknown) => { refusal = { status, body }; } }) } as any,
          () => { allowed = true; });
        if (!allowed) {
          csrfRefusals++;
          return route.fulfill({ status: refusal!.status, json: refusal!.body });
        }
        actions.push(url.pathname);
        expect(url.pathname).toBe("/api/admin/leads/action-queue/communications_saved-job/revise");
        const input = request.postDataJSON();
        expect(Object.keys(input).sort()).toEqual(["expectedReviewDigest", "output"]);
        expect(input.expectedReviewDigest).toBe("a".repeat(64));
        expect(input.output).toMatchObject({ body: repaired, usedFactIds: ["fact-1"], requiresHumanReview: true, outreachContract: { question: "Is this relevant?" } });
        item.action_payload.body = input.output.body; item.action_payload.communications.output = input.output;
        item.outreach_review = { ...item.outreach_review, digest: "b".repeat(64), hardChecksPassed: true, blockers: [] };
        return route.fulfill({ json: { state: "pending_approval", review: item.outreach_review, sent: false, modelSessionCreated: false } });
      }
      if (failQueue) return route.fulfill({ status: 500, json: { error: "Read temporarily unavailable" } });
      return route.fulfill({ json: { items: [item], summary: { total: 1, pending_approval: 1, failed: 0 } } });
    }
    if (request.method() === "POST" && url.pathname !== "/api/analytics/ingest") actions.push(url.pathname);
    const fixture = getOperatorQaFixtureForRequest(request.url(), request.method());
    return fixture ? route.fulfill({ status: fixture.status, json: fixture.body }) : route.fulfill({ status: 503, json: { error: "No live API calls in browser fixture" } });
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/admin/leads");
  await page.getByRole("tab", { name: "Approvals", exact: true }).click();
  await expect(page.getByText(original, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Revise draft" }).click();
  await page.getByRole("textbox", { name: "Draft message", exact: true }).fill(repaired);
  failQueue = true;
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.getByText(/Showing the last loaded drafts/)).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Draft message", exact: true })).toHaveValue(repaired);
  await expect(page.getByRole("button", { name: "Approve outreach" })).toBeDisabled();
  failQueue = false;
  await page.getByRole("button", { name: "Retry loading approvals" }).click();
  await expect(page.getByText(/Showing the last loaded drafts/)).toHaveCount(0);
  await page.getByLabel(/unknown: Unknown fact/).click();
  await expect(page.getByLabel(/unknown: Unknown fact/)).toHaveCount(0);
  await page.getByLabel(/fact-1: A verified/).check();
  await page.getByText("Review anchors", { exact: true }).click();
  await page.getByRole("textbox", { name: "One learning question", exact: true }).fill("Is this relevant?");
  await expect.poll(() => csrfReads).toBeGreaterThan(0);
  // Another session/cookie refresh leaves the page's module token cache old.
  await page.context().addCookies([{ name: "csrf_token", value: currentCsrf,
    url: new URL(page.url()).origin, httpOnly: true, sameSite: "Lax" }]);
  await page.getByRole("button", { name: "Save and revalidate" }).click();
  await expect(page.getByText(repaired, { exact: true })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Revision saved. It is ready for human review." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve outreach" })).toBeDisabled();
  await expect(page.getByText("Tier 3", { exact: true })).toBeVisible();
  expect(actions).toEqual(["/api/admin/leads/action-queue/communications_saved-job/revise"]);
  expect(csrfReads).toBeGreaterThanOrEqual(2);
  expect(csrfRefusals).toBe(0);
  expect(pageErrors).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("communications-draft-revision-draft-only.png"), fullPage: true });
});
