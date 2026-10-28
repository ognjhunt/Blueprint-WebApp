import { test, expect, chromium, type BrowserContext } from "@playwright/test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

/** Real application handlers and Firestore/Storage emulators. No providers or mail. */
const cases = ["phone", "visit"].flatMap(method => ["Austin, TX", "Toronto, Canada"].flatMap(location =>
  ["draft-reload", "lost-response", "saved-reload", "second-tab", "browser-restart"].map(boundary => ({ method, location, boundary }))));
for (const [index, parameters] of cases.entries()) test(`A-J-${String(index + 1).padStart(3, "0")} ${JSON.stringify(parameters)}`, async ({}, testInfo) => {
  const profile = await mkdtemp(path.join(os.tmpdir(), "blueprint-reliability-browser-"));
  const output = process.env.RELIABILITY_A_OUTPUT || "/workspace/reliability-program/A/journeys";
  await mkdir(output, { recursive: true });
  let context: BrowserContext;
  const start = async () => {
    context = await chromium.launchPersistentContext(profile, { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE, headless: true, extraHTTPHeaders: { "X-Forwarded-For": `192.0.2.${index + 1}` } });
    // External browser requests are blocked; application API uses real loopback handlers.
    await context.route("**/*", async route => {
      const host = new URL(route.request().url()).hostname;
      if (host !== "127.0.0.1" && host !== "localhost") return route.abort("blockedbyclient");
      return route.continue();
    });
    await context.tracing.start({ screenshots: true, snapshots: true });
    return context.newPage();
  };
  let page = await start();
  let submittedBodies: string[] = [];
  const responseDiagnostics: Array<{ httpStatus: number; message?: string; code?: string }> = [];
  const record = () => {
    page.on("response", async response => {
      if (new URL(response.url()).pathname === "/api/inbound-request") {
        const payload = await response.json().catch(() => ({}));
        responseDiagnostics.push({ httpStatus: response.status(), message: payload.message || payload.error, code: payload.code });
      }
    });
    page.on("request", request => {
    if (new URL(request.url()).pathname === "/api/inbound-request" && request.method() === "POST") {
      submittedBodies.push(request.postData()!);

    }
  });
  };
  record();
  try {
    await page.goto("http://127.0.0.1:4181/contact/site-operator");
    await page.getByText("Add job details and buying plans (optional)", { exact: true }).click();
    await page.locator("#start-task").fill("Move sealed cartons from the conveyor onto a pallet.");
    await page.locator("#start-location").fill(parameters.location);
    await page.locator("#start-email").fill(`reliability-${index + 1}@example.invalid`);
    await page.locator(`#start-method-${parameters.method}`).check();
    if (parameters.boundary === "draft-reload") {
      await page.reload();
      await expect(page.locator("#start-task")).toHaveValue("Move sealed cartons from the conveyor onto a pallet.");
      await expect(page.locator(`#start-method-${parameters.method}`)).toBeChecked();
    }
    if (parameters.boundary === "lost-response") {
      let lost = false;
      await page.route("**/api/inbound-request", async route => {
        if (!lost) {
          lost = true;
          const realResponse = await route.fetch();
          expect(realResponse.ok()).toBe(true);
          // Fault occurs after the actual handler persisted the customer record.
          return route.abort("connectionreset");
        }
        return route.continue();
      });
    }
    await expect(page.locator("#start-email")).toHaveValue(`reliability-${index + 1}@example.invalid`);
    await expect(page.locator("#start-location")).toHaveValue(parameters.location);
    if (parameters.location.startsWith("Austin")) await expect(page.locator("#start-region")).toHaveCount(0);
    else await expect(page.getByText(/During the beta we can only take walkthroughs/)).toBeVisible();
    await page.getByRole("button", { name: "Start free assessment", exact: true }).click();
    if (parameters.boundary === "lost-response") {
      await expect(page.getByRole("alert")).toContainText("could not reach Blueprint");
      await page.reload();
      await page.getByRole("button", { name: "Start free assessment", exact: true }).click();
    }
    const canRecord = parameters.location.startsWith("Austin") && parameters.method === "phone";
    const expectSaved = async () => {
      await expect(page.getByRole("heading", { name: !parameters.location.startsWith("Austin") ? "We have your site."
        : parameters.method === "visit" ? "We have it." : "Film the work area.", exact: true })).toBeVisible();
      await expect(page.getByRole("link", { name: "Open your job and assessment", exact: true })).toHaveCount(0);
    };
    await expectSaved();
    const privateLink = page.getByRole("link", { name: "Open your job page", exact: true });
    const target = canRecord ? await privateLink.getAttribute("href") : null;
    if (canRecord) expect(target).toMatch(/\/capture-upload\//);
    if (parameters.boundary === "lost-response") {
      expect(submittedBodies).toHaveLength(2);
      expect(submittedBodies[1]).toBe(submittedBodies[0]);
    }
    if (parameters.boundary === "saved-reload") await page.reload();
    if (parameters.boundary === "second-tab") {
      page = await context!.newPage();
      await page.goto("http://127.0.0.1:4181/contact/site-operator");
    }
    if (parameters.boundary === "browser-restart") {
      await context!.tracing.stop({ path: path.join(output, `A-J-${index + 1}-before-restart.zip`) });
      await context!.close();
      page = await start();
      await page.goto("http://127.0.0.1:4181/contact/site-operator");
    }
    await expectSaved();
    if (canRecord) {
      await expect(page.getByRole("link", { name: "Open your job page", exact: true })).toHaveAttribute("href", target!);
      await page.getByRole("link", { name: "Open your job page", exact: true }).click();
      await expect(page.getByText("Upload or record the job to continue.", { exact: false })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Your job summary", exact: true })).toHaveCount(0);
      // The retained owner link authorizes the capture route; a draft is not an assessment before video arrives.
      const token = new URL(page.url()).pathname.split("/").pop()!;
      const response = await context!.request.get(`http://127.0.0.1:4181/api/site-task-brief/${encodeURIComponent(token)}`);
      expect(response.ok()).toBe(true);
      expect(await response.json()).toMatchObject({ scope: "owner" });
    } else {
      // Visit requests and regions awaiting transfer terms must not expose an active recording path.
      await expect(page.getByRole("link", { name: "Open your job page", exact: true })).toHaveCount(0);
    }
    await writeFile(path.join(output, `A-J-${String(index + 1).padStart(3, "0")}.json`), JSON.stringify({
      caseId: `A-J-${String(index + 1).padStart(3, "0")}`, parameters, layer: "real-backend/firebase-emulators/no-provider",
      persistedProjectionAuthorized: canRecord ? true : null, submittedRequests: submittedBodies.length,
      uniqueIntakeIdentities: new Set(submittedBodies.map(body => JSON.parse(body).requestId)).size,
      privateIdentifiersRedacted: true, providerDispatch: false, notifications: "durable-outbox-only/no-delivery",
    }, null, 2));
    await context!.tracing.stop({ path: path.join(output, `A-J-${index + 1}.zip`) });
  } catch (error) {
    await context!.tracing.stop({ path: path.join(output, `A-J-${index + 1}-failed.zip`) }).catch(() => undefined);
    await page.screenshot({ path: path.join(output, `A-J-${index + 1}-failed.png`), fullPage: true }).catch(() => undefined);
    await writeFile(path.join(output, `A-J-${String(index + 1).padStart(3, "0")}-failure.json`), JSON.stringify({
      caseId: `A-J-${String(index + 1).padStart(3, "0")}`, parameters, responseDiagnostics,
      submittedRequests: submittedBodies.length, status: "failed", privateIdentifiersRedacted: true,
    }, null, 2));
    throw error;
  } finally {
    await context!.close();
    await rm(profile, { recursive: true, force: true });
  }
});
