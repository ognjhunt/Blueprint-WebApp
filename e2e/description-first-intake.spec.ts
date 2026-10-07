import { test, expect, devices } from "@playwright/test";
import fs from "node:fs/promises";

for (const device of ["desktop", "mobile"] as const) {
  test.describe(device, () => {
    if (device === "mobile") {
      const { defaultBrowserType: _browser, ...mobile } = devices["iPhone 13"];
      test.use(mobile);
    } else test.use({ viewport: { width: 1440, height: 1000 } });

    test("description save and return require no recording, fee or upload", async ({ page, context, baseURL }, testInfo) => {
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
      await expect(page.locator("#start-task")).toBeVisible();
      await shot("intake");
      await page.locator("#start-task").fill("Move sealed cartons from a conveyor onto a pallet.");
      await page.locator("#start-location").fill("Austin, TX");
      await page.locator("#start-email").fill("qa@example.invalid");
      await page.locator("#start-company").fill("Synthetic QA site");
      await expect(page.locator("#start-rights")).not.toBeChecked();
      await expect(page.getByText(/Country: United States\./)).toBeVisible();
      await expect(page.locator("#start-region")).toHaveCount(0);
      await page.getByRole("button", { name: "Start free assessment", exact: true }).click();
      await expect(page.getByRole("link", { name: "Review your job brief", exact: true })).toBeVisible();
      expect(mutations).toHaveLength(1);
      expect(mutations[0].body).toMatchObject({ descriptionOnly: true, descriptionAuthority: { granted: true, statementVersion: "2026-10-06.v1" }, consentAttestation: null, hasExistingFootage: false });
      expect(mutations[0].body.matchFee).toBeUndefined();
      await shot("saved");
      await page.getByRole("link", { name: "Review your job brief", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Review your job brief", exact: true })).toBeVisible();
      await expect(page.getByText("Move sealed cartons from a conveyor onto a pallet.", { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: /Open the camera|Choose or record|Upload a video file/ })).toHaveCount(0);
      await shot("brief-before-permission");
      await page.getByText("Add footage when you have permission (optional)", { exact: true }).click();
      await expect(page.getByRole("button", { name: "Confirm recording permission" })).toBeDisabled();
      await page.getByRole("checkbox", { name: /I am authorized to record this site/ }).check();
      await page.getByRole("button", { name: "Confirm recording permission" }).click();
      await expect(page.getByRole("button", { name: "Add footage when you are ready (optional)" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Review your job brief", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: /Open the camera|Choose or record|Upload a video file/ })).toHaveCount(0);
      expect(mutations.map(row => row.path)).toEqual(["/api/inbound-request", `/api/self-capture/uploads/${token}/recording-consent`]);
      expect(errors).toEqual([]);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      expect(overflow).toBe(false);
      await shot("brief-after-permission");
      await fs.writeFile(`${output}/${device}-evidence.json`, JSON.stringify({ mockedOnly: true, mutations, errors, overflow }, null, 2));
    });
  });
}
