/**
 * Outreach audit, 2026-11-27: a site's journey walked in a browser against the local stack, as a person at a site
 * would, desktop and phone, for what the core journey (`site-answer-journey.spec.ts`) does not reach:
 * - the simulation section once a room-only package is delivered, and after the job's window ends (gap 5; fixed
 *   2026-11-27: the page says it is the room without the job's object, and stays "ready" after the window ends);
 * - what the withdrawal tells the site about the copy Blueprint keeps;
 * - a draft started with no video;
 * - a video over the upload limit (only when the server runs with a small `SELF_CAPTURE_MAX_UPLOAD_BYTES`, passed to
 *   this process as `OUTREACH_SITE_MAX_UPLOAD_BYTES`).
 *
 * Same harness as the core journey: real handlers, Firebase emulators, a scripted video model, nothing sent.
 * It writes the delivered package and a past grant straight to the Firestore EMULATOR, as the Pipeline's signed
 * callbacks would; nothing leaves this machine.
 */
import { expect, test, type Page } from "@playwright/test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { crossRuntimeArtifactDigest } from "../server/utils/crossRuntimeCanonical";
import { VIDEO_TOO_LARGE } from "../client/src/lib/captureVideoLimit";
import { PROJECT, VIDEO, localOnly, publishCompanyClip, startWithVideo, tick } from "./site-answer-journey-helpers";

const ORIGIN = "http://127.0.0.1:4183";
const db = () => getFirestore(getApps()[0] ?? initializeApp({ projectId: PROJECT }));
const simulationSection = (page: Page) => page.locator("#site-job-simulation").locator("xpath=..");

function roomOnlyPackage(captureId: string) {
  const value = { schema_version: "website_company_simulation.v1", capture_id: captureId,
    simulation_revision: `sha256:${"4".repeat(64)}`, state: "ready", format: "zip_usd_scene_object_success_rule",
    content_type: "application/zip", digest: `sha256:${"5".repeat(64)}`, size_bytes: 1234,
    files: ["README.txt", "scene.usda", "scene/room.usdz", "scene/room_collision.usdz"],
    permission_basis: "site_sharing_statement", statement_version: "2026-11-23.v6", updated_at_epoch: 1_794_000_000,
    object_included: false };
  return { ...value, simulation_digest: crossRuntimeArtifactDigest(value, "simulation_digest") };
}

const pageText = async (page: Page) => (await page.locator("main, body").first().innerText()).replace(/\s+/g, " ");

for (const [label, viewport] of [["desktop", { width: 1280, height: 900 }], ["phone", { width: 390, height: 844 }]] as const) {
  test(`${label}: the site's page from video to a room-only simulation, the window's end, and withdrawal`, async ({ page, request }) => {
    test.setTimeout(240_000);
    await page.setViewportSize(viewport);
    const missing: string[] = [];
    await localOnly(page.context(), missing);
    const stamp = Date.now();
    const started = await startWithVideo(page, `outreach-site-${label}-${stamp}@example.invalid`, `Testville ${stamp}, TX`);
    const { requestId } = started;
    const captureId = `walkthrough-${requestId}`;
    console.log(`[${label}] done screen:`, (await pageText(page)).slice(0, 600));
    await started.link.click();
    await expect(page.getByRole("heading", { level: 1, name: "Your job", exact: true })).toBeVisible();
    console.log(`[${label}] job page, video in:`, (await pageText(page)).slice(0, 900));

    await tick(request, requestId);
    await publishCompanyClip(request, requestId);
    await page.reload();
    await expect(page.getByText("Your job is ready for deployment companies, but no approved company can see it yet.")).toBeVisible();
    console.log(`[${label}] listed, no company approved:`, (await pageText(page)).slice(0, 1600));

    // The Pipeline delivers a room-only package (object_included: false), as it did for 7 of the 9 built.
    await db().doc(`captureUploadSessions/${captureId}`).set({ company_simulation: roomOnlyPackage(captureId) }, { merge: true });
    await page.reload();
    const section = simulationSection(page);
    await expect(section).toContainText("The simulation of your site is ready.");
    const roomOnly = (await section.innerText()).replace(/\s+/g, " ");
    console.log(`[${label}] room-only package delivered, simulation section:`, roomOnly);
    // Fixed 2026-11-27 (D2): the site reads what the company reads, and its rule as its own words.
    await expect(section).toContainText("It shows your room without the job's object in it, so it does not check what counts as done.");
    // This job gave no success rule, so no rule line: the client test covers "You said done means".
    expect(roomOnly).not.toContain("Done means: ");
    if (label === "phone") {
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
      await page.screenshot({ path: path.join(process.env.OUTREACH_SITE_SHOTS ?? tmpdir(), `outreach-site-${label}-room-only.png`), fullPage: true });
    }

    // The job's 7-day window ends (a grant already past), and the production sweep runs.
    const nowEpoch = Math.floor(Date.now() / 1000);
    await db().doc(`inboundRequests/${requestId}`).set({ website_scene_sponsorship: { schema_version: "website_scene_sponsorship.v1",
      request_id: requestId, authority_digest: `sha256:${"6".repeat(64)}`, expires_at_epoch: nowEpoch - 3600 } }, { merge: true });
    const swept = await request.post(`${ORIGIN}/api/reliability/job-window-sweep?requestId=${encodeURIComponent(requestId)}&atMs=${Date.now()}`);
    const sweepResult = await swept.json();
    console.log(`[${label}] window sweep:`, JSON.stringify(sweepResult));
    await page.reload();
    console.log(`[${label}] after the window, simulation section:`, (await simulationSection(page).innerText().catch(() => "(none)")).replace(/\s+/g, " "));
    // Fixed 2026-11-27 (D4): the delivered package stays ready; companies can still download it.
    await expect(simulationSection(page)).toContainText("The simulation of your site is ready.");
    await expect(simulationSection(page)).not.toContainText("The time for this job ran out.");

    // Withdrawal: what the site reads about each copy.
    await page.locator("section.job-more").getByText("Stop using my video", { exact: true }).click();
    console.log(`[${label}] withdrawal confirm:`, (await page.locator("section.job-more").innerText()).replace(/\s+/g, " "));
    await page.getByRole("button", { name: "Yes, stop using my video" }).click();
    await expect(page.getByText("Video withdrawn.", { exact: true })).toBeVisible();
    console.log(`[${label}] after withdrawal:`, (await pageText(page)).slice(0, 1200));
    expect(missing).toEqual([]);
  });
}

test("a draft with no video: what the site is asked and told", async ({ page }) => {
  const missing: string[] = [];
  await localOnly(page.context(), missing);
  await page.context().setExtraHTTPHeaders({ "X-Forwarded-For": `10.78.${Math.floor(Math.random() * 250) + 1}.9` });
  await page.goto("/contact/site-operator", { waitUntil: "networkidle" });
  console.log("[draft] start form:", (await pageText(page)).slice(0, 1500));
  await page.locator("#start-task").fill("Pick up the sealed carton from the table and place it on the cart.");
  await page.locator("#start-location").fill("Testville, TX");
  await page.locator("#start-email").fill(`outreach-site-draft-${Date.now()}@example.invalid`);
  await page.locator("#start-region").selectOption("us");
  const button = page.getByRole("button", { name: /^(Send video|Next: film the job|Save my job)$/ });
  console.log("[draft] button:", await button.innerText());
  const posted = page.waitForRequest(request => request.method() === "POST" && /\/api\/inbound-request$/.test(new URL(request.url()).pathname));
  await button.click();
  const body = (await posted).postDataJSON();
  console.log("[draft] recorded:", JSON.stringify({ description: body.descriptionAuthority?.statementVersion,
    recording: body.consentAttestation?.statementVersion ?? null, descriptionOnly: body.descriptionOnly }));
  await page.waitForLoadState("networkidle");
  console.log("[draft] after:", (await pageText(page)).slice(0, 1200));
  expect(missing).toEqual([]);
});

test("a video over the upload limit: what the site reads", async ({ page }) => {
  const limit = Number(process.env.OUTREACH_SITE_MAX_UPLOAD_BYTES ?? "");
  test.skip(!Number.isFinite(limit) || limit <= 0, "Needs the server's SELF_CAPTURE_MAX_UPLOAD_BYTES passed as OUTREACH_SITE_MAX_UPLOAD_BYTES");
  const missing: string[] = [];
  await localOnly(page.context(), missing);
  const big = path.join(mkdtempSync(path.join(tmpdir(), "outreach-site-")), "too-big.mp4");
  const head = readFileSync(VIDEO);
  writeFileSync(big, Buffer.concat([head, Buffer.alloc(limit + 64 * 1024 - head.length, 0)]));
  await page.context().setExtraHTTPHeaders({ "X-Forwarded-For": `10.79.${Math.floor(Math.random() * 250) + 1}.9` });
  await page.goto("/contact/site-operator", { waitUntil: "networkidle" });
  await page.locator("#start-method-upload").click();
  await page.locator("#start-footage").setInputFiles(big);
  console.log("[too big] after choosing:", (await page.locator("form").first().innerText()).replace(/\s+/g, " ").slice(0, 600));
  await page.locator("#start-task").fill("Pick up the sealed carton from the table and place it on the cart.");
  await page.locator("#start-location").fill("Testville, TX");
  await page.locator("#start-email").fill(`outreach-site-big-${Date.now()}@example.invalid`);
  await page.locator("#start-region").selectOption("us");
  const uploaded = page.waitForResponse(response => response.request().method() === "POST" && /\/api\/self-capture\/uploads\/[^/]+$/.test(new URL(response.url()).pathname));
  await page.getByRole("button", { name: "Send video" }).click();
  const response = await uploaded;
  console.log("[too big] server:", response.status(), await response.text());
  // Fixed 2026-11-27 (D1): 413 with a sentence the site can act on, shown alone.
  expect(response.status()).toBe(413);
  await expect(page.getByText(VIDEO_TOO_LARGE)).toBeVisible();
  console.log("[too big] the site reads:", (await pageText(page)).slice(0, 1000));
  expect(await pageText(page)).not.toContain("We couldn't confirm your video arrived");
  // The same file cannot be sent again: the way on is a smaller video on the job page.
  await expect(page.getByRole("button", { name: "Try the selected video again" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Upload the video" }).first()).toBeVisible();
  expect(missing).toEqual([]);
});
