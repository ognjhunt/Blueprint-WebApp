import { test, expect, devices } from "@playwright/test";
import fs from "node:fs/promises";

for (const device of ["desktop", "mobile"] as const) {
  test.describe(device, () => {
    if (device === "mobile") {
      const { defaultBrowserType: _browser, ...mobile } = devices["iPhone 13"];
      test.use(mobile);
    } else test.use({ viewport: { width: 1440, height: 1000 } });

    test("recovers a private filming draft after a lost response", async ({ page, context, baseURL }) => {
      const token = "synthetic-description-only";
      const bodies: string[] = [];
      await context.route("**/*", async route => {
        const request = route.request();
        const url = new URL(request.url());
        const send = (json: object, status = 200) => route.fulfill({ status, json });
        if (url.origin !== new URL(baseURL!).origin) return send({});
        if (url.pathname === "/api/csrf") return send({ csrfToken: "synthetic-csrf" });
        if (url.pathname === "/api/inbound-request" && request.method() === "POST") {
          bodies.push(request.postData()!);
          if (bodies.length === 1) return send({ message: "The response was lost." }, 503);
          return send({ ok: true, captureUrl: `/capture-upload/${token}` }, 201);
        }
        if (url.pathname.startsWith("/api/")) return send({});
        return route.continue();
      });

      await page.goto("/contact/site-operator");
      const save = page.getByRole("button", { name: "Next: film the job" });
      await expect(page.getByText("Film or upload a video to post your job.")).toBeVisible();
      await page.getByText("Add details (optional)", { exact: true }).click();
      await page.locator("#start-location").fill("Austin");
      await page.locator("#start-region").selectOption("us");
      await page.getByRole("textbox", { name: "Your email" }).fill("qa@example.invalid");
      await page.getByLabel("The job in one sentence").fill("Move cartons from a conveyor onto a pallet.");
      await save.click();
      await expect(page.getByText("The response was lost.", { exact: true })).toBeVisible();
      await page.reload();
      await page.getByRole("button", { name: "Recover saved job" }).click();

      await expect(page.getByRole("heading", { name: "Now film the job.", exact: true })).toBeVisible();
      const capture = page.getByRole("link", { name: device === "mobile" ? "Open the camera" : "Open my job page ›", exact: true });
      await expect(capture).toHaveAttribute("href", `/capture-upload/${token}`);
      expect(bodies).toHaveLength(2);
      expect(bodies[1]).toBe(bodies[0]);
      expect(JSON.parse(bodies[0])).toMatchObject({
        taskStatement: "Move cartons from a conveyor onto a pallet.", taskConfirmation: { granted: true, statementVersion: "2026-11-07.v1" },
        siteLocation: "Austin", captureRegion: "us", descriptionOnly: true,
        descriptionAuthority: { granted: true, statementVersion: "2026-11-11.v3" }, consentAttestation: null, hasExistingFootage: false,
      });
    });

    // Owner direction 2026-11-11: the sentence is optional; a typed one, in the
    // site's words, confirms the brief when it is submitted.
    test("capture setup takes an optional typed task, then continues to required video", async ({ page, context, baseURL }, testInfo) => {
      const token = "synthetic-description-owner";
      const mutations: Array<{ path: string; body: any }> = [];
      const errors: string[] = [];
      let recordingGranted = false;
      page.on("pageerror", error => errors.push(error.message));
      await context.addInitScript(() => {
        if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = async () => { throw new Error("QA prohibits opening a camera"); };
      });
      await context.route("**/*", async route => {
        const request = route.request(), url = new URL(request.url());
        const send = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
        if (url.origin !== new URL(baseURL!).origin) return send({});
        if (url.pathname === "/api/analytics/ingest") return send({ ok: true });
        if (request.method() !== "GET" && request.method() !== "HEAD") {
          const body = request.postDataJSON();
          mutations.push({ path: url.pathname, body });
          if (url.pathname === "/api/inbound-request") return send({ ok: true, requestId: body.requestId, captureUrl: `/capture-upload/${token}` }, 201);
          if (url.pathname === `/api/self-capture/uploads/${token}/recording-consent`) {
            recordingGranted = true;
            return send({ ok: true });
          }
          return send({ error: "Unexpected mutation blocked by QA" }, 409);
        }
        if (url.pathname === "/api/csrf") return send({ csrfToken: "synthetic-csrf" });
        if (url.pathname === `/api/site-task-brief/${token}`) return send({ ready: true, scope: "owner", account: null,
          brief: { summary: "Move sealed cartons from a conveyor onto a pallet.", captureMode: "self_capture", proposed: [], unresolved: [], confirmedAtIso: null } });
        if (url.pathname === `/api/self-capture/uploads/${token}/status`) return send({ ok: true, state: recordingGranted ? "ready" : "held",
          recordingConsentAvailable: !recordingGranted, captureReceived: false, uploadState: "not_received", accepts: ["mov", "mp4"],
          detail: "Confirm recording permission before adding footage.", holdReason: "recording_consent_required", blockers: [], openQuestions: [] });
        if (url.pathname === `/api/site-task-brief/${token}/status`) return send({ ok: true, captureReceived: false,
          status: { decision: "confirm_brief", headline: "Check your job brief.", operatorAction: "Review your job brief.", missingViews: [], nextUpdateIso: null } });
        if (url.pathname.startsWith("/api/")) return send({ ok: true, items: [], questions: [] });
        return route.continue();
      });
      const output = process.env.DESCRIPTION_INTAKE_QA_OUTPUT || testInfo.outputDir;
      await fs.mkdir(output, { recursive: true });
      const shot = async (name: string) => {
        const path = `${output}/${device}-${name}.png`;
        await page.screenshot({ path, fullPage: true });
        await testInfo.attach(`${device}-${name}`, { path, contentType: "image/png" });
      };
      await page.goto("/contact/site-operator");
      await expect(page.getByRole("heading", { level: 1, name: "Start a job" })).toBeVisible();
      await expect(page.locator("#start-task")).toBeAttached();
      await shot("intake");
      // Nothing is sent without the country and the email.
      await page.getByRole("button", { name: /^(Send video|Next: film the job|Save my job)$/ }).click();
      expect(mutations).toHaveLength(0);
      if (!await page.locator("#start-task").isVisible()) await page.getByText("Add details (optional)", { exact: true }).click();
      await page.locator("#start-task").fill("Move sealed cartons from a conveyor onto a pallet.");
      await expect(page.getByRole("checkbox", { name: "This is the task I want Blueprint to evaluate.", exact: true })).toHaveCount(0);
      await page.locator("#start-location").fill("Austin, TX");
      await page.locator("#start-email").fill("qa@example.invalid");
      await expect(page.locator("#start-rights")).toHaveCount(0);
      // Typed text is never read for a country (the privacy gate): the site chooses it.
      await page.locator("#start-region").selectOption("us");
      await page.getByRole("button", { name: /^(Send video|Next: film the job|Save my job)$/ }).click();
      if (device === "mobile") {
        await expect(page).toHaveURL(`/capture-upload/${token}`);
      } else {
        const captureLink = page.getByRole("link", { name: "Open my job page ›", exact: true });
        await expect(captureLink).toBeVisible();
        await expect(page.getByRole("link", { name: "Open my job", exact: true })).toHaveCount(0);
        await shot("saved");
        await captureLink.click();
      }
      expect(mutations).toHaveLength(1);
      expect(mutations[0].body).toMatchObject({ taskStatement: "Move sealed cartons from a conveyor onto a pallet.",
        taskConfirmation: { granted: true, statementVersion: "2026-11-07.v1" }, descriptionOnly: true, descriptionAuthority: { granted: true, statementVersion: "2026-11-11.v3" }, consentAttestation: null, hasExistingFootage: false });
      expect(mutations[0].body.matchFee).toBeUndefined();
      await expect(page.getByText("A video is required to post your job and build its simulation.")).toBeVisible();
      await expect(page.getByText("Check your job brief.", { exact: true })).toHaveCount(0);
      await expect(page.getByRole("heading", { name: "Your job summary", exact: true })).toHaveCount(0);
      await expect(page.getByRole("button", { name: /Open the camera|Choose or record|Upload a video file/ })).toHaveCount(0);
      await shot("capture-before-permission");
      // Recording statement v4, word for word, above the one button that agrees to it.
      await expect(page.getByText("By sending, you agree to our Terms and Privacy Policy and confirm you're allowed to film and share this site. We share your job, including this video and the simulation we build from it, with robot deployment companies we've approved.", { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Agree and continue" }).click();
      await expect(page.getByRole("button", { name: /Choose or record a video|Upload a video file/ })).toBeVisible();
      await expect(page.getByRole("button", { name: "Add footage when you are ready (optional)" })).toHaveCount(0);
      await expect(page.getByRole("heading", { name: "Delivery proposals", exact: true })).toHaveCount(0);
      expect(mutations.map(row => row.path)).toEqual(["/api/inbound-request", `/api/self-capture/uploads/${token}/recording-consent`]);
      expect(mutations[1].body).toEqual({ granted: true, statementVersion: "2026-11-12.v4" });
      expect(errors).toEqual([]);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      expect(overflow).toBe(false);
      await shot("capture-after-permission");
      await fs.writeFile(`${output}/${device}-evidence.json`, JSON.stringify({ mockedOnly: true, mutations, errors, overflow }, null, 2));
    });
  });
}
