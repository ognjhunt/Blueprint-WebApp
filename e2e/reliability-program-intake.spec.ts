import { expect, test, chromium, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
const origin = "http://127.0.0.1:42879";
const create = "/api/inbound-request";
const fixtureLink = "/capture-upload/reliability-fixture";
async function fill(page: Page) {
  await page.locator("#start-task").fill("Move sealed cartons to the pallet");
  await page.locator("#start-location").fill("Austin, TX");
  await page.locator("#start-email").fill("operator@example.test");
  await page.locator("#start-company").fill("Fixture site");
}
test.beforeEach(async ({ context }) => {
  await context.route("**/*", route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname === "/api/csrf") return route.fulfill({json: {csrfToken: "fixture"}});
    if (url.pathname.startsWith("/api/")) return route.fulfill({status: 503, json: {error: "Unstubbed isolated API"}});
    return route.continue();
  });
});
test("UI-RETURN-001 lost create response, reload, recover original identity", async ({ page }) => {
  const bodies: string[] = [];
  await page.route(`**${create}`, route => {
    bodies.push(route.request().postData()!);
    return bodies.length === 1 ? route.abort() : route.fulfill({json: {captureUrl: fixtureLink}});
  });
  await page.goto("/contact/site-operator"); await fill(page);
  await page.getByRole("button", {name: "Start free assessment"}).click();
  await expect(page.getByRole("alert")).toContainText("could not reach");
  await page.reload();
  await expect(page.locator("#start-task")).toHaveValue("Move sealed cartons to the pallet");
  await page.getByRole("button", {name: "Recover saved job"}).click();
  await expect(page.getByRole("link", {name: "Review your job brief"})).toHaveAttribute("href", fixtureLink);
  expect(bodies).toHaveLength(2); expect(bodies[1]).toBe(bodies[0]);
});
test("UI-RETURN-002 close tab and return preserves draft, without renewing consent", async ({ page, context }) => {
  await page.goto("/contact/site-operator"); await fill(page); await page.locator("#start-rights").check();
  await page.close(); const returning = await context.newPage(); await returning.goto("/contact/site-operator");
  await expect(returning.locator("#start-task")).toHaveValue("Move sealed cartons to the pallet");
  await expect(returning.locator("#start-rights")).not.toBeChecked();
  await returning.getByRole("button", {name: "Clear this browser's draft"}).click();
  await returning.reload(); await expect(returning.locator("#start-task")).toHaveValue("");
});
test("UI-RETURN-003 browser storage restore returns acknowledged same job and renews expired link", async ({ page, browser }) => {
  const bodies: string[] = [];
  await page.route(`**${create}`, route => {bodies.push(route.request().postData()!); return route.fulfill({json: {captureUrl: fixtureLink}});});
  await page.goto("/contact/site-operator"); await fill(page);
  await page.getByRole("button", {name: "Start free assessment"}).click();
  await expect(page.getByRole("link", {name: "Review your job brief"})).toBeVisible();
  const saved = await page.context().storageState();
  // New context models browser shutdown with persisted origin localStorage.
  const restored = await browser.newContext({storageState: saved});
  await restored.route("**/*", route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname === "/api/csrf") return route.fulfill({json: {csrfToken: "restored-fixture"}});
    if (url.pathname === create) { bodies.push(route.request().postData()!); return route.fulfill({json: {captureUrl: "/capture-upload/renewed-fixture"}}); }
    if (url.pathname.startsWith("/api/")) return route.fulfill({status: 503, json: {error: "Unstubbed isolated API"}});
    return route.continue();
  });
  const returning = await restored.newPage(); await returning.goto(`${origin}/contact/site-operator`);
  await returning.getByRole("button", {name: "Return to saved job"}).click();
  await expect(returning.getByRole("link", {name: "Review your job brief"})).toHaveAttribute("href", "/capture-upload/renewed-fixture");
  expect(bodies[1]).toBe(bodies[0]); await restored.close();
});
test("UI-RETURN-004 authoring routes cannot inherit a different provider's draft or consent", async ({ page }) => {
  await page.goto("/contact/site-operator"); await fill(page);
  await page.goto("/contact/site-operator?authoring=claude-opus-5-5");
  await expect(page.locator("#start-task")).toHaveValue("");
  await expect(page.locator("#start-claude-authoring")).not.toBeChecked();
  await page.goto("/contact/site-operator"); await expect(page.locator("#start-task")).toHaveValue("Move sealed cartons to the pallet");
});
test("UI-INTAKE-001 validation failure body stays visible and fields remain repairable", async ({ page }) => {
  await page.route(`**${create}`, route => route.fulfill({status: 400, json: {message: "Describe one recurring job before saving."}}));
  await page.goto("/contact/site-operator"); await fill(page);
  await page.getByRole("button", {name: "Start free assessment"}).click();
  await expect(page.getByRole("alert")).toHaveText("Describe one recurring job before saving.");
  await expect(page.locator("#start-task")).toBeEnabled();
  await page.locator("#start-task").fill("Corrected task");
});
test("UI-INTAKE-002 double click slow create dispatches one logical submission", async ({ page }) => {
  let count = 0; let finish!: () => void; const wait = new Promise<void>(resolve => {finish = resolve;});
  await page.route(`**${create}`, async route => { count++; await wait; return route.fulfill({json: {captureUrl: fixtureLink}}); });
  await page.goto("/contact/site-operator"); await fill(page);
  await page.getByRole("button", {name: "Start free assessment"}).dblclick();
  await expect(page.getByRole("button", {name: "Working…"})).toBeDisabled();
  finish(); await expect(page.getByRole("link", {name: "Review your job brief"})).toBeVisible(); expect(count).toBe(1);
});
test("UI-ACCESS-001 denied status cannot masquerade as upload receipt", async ({ page }) => {
  await page.route(`**${create}`, route => route.fulfill({json: {captureUrl: fixtureLink}}));
  await page.route("**/api/site-task-brief/reliability-fixture/status", route => route.fulfill({json: {captureReceived: true, status: {stage: "footage_received", headline: "Footage hint"}}}));
  await page.route("**/api/self-capture/uploads/reliability-fixture/status", route => route.fulfill({status: 403, json: {state: "ready", captureReceived: true, uploadState: "processing_ready"}}));
  await page.goto("/contact/site-operator"); await fill(page);
  await page.getByRole("button", {name: "Start free assessment"}).click();
  await expect(page.getByRole("heading", {name: "Your job description is saved."})).toBeVisible();
  await expect(page.getByRole("heading", {name: "Your recording is in."})).toHaveCount(0);
});


test("UI-RETURN-005 real browser termination during video transport returns to the same intake", async () => {
  const output = path.resolve("output/reliability-program/intake"); mkdirSync(output, {recursive:true});
  const video = path.join(output,"synthetic-transport.mp4");
  try {
    execFileSync(process.env.BLUEPRINT_TEST_FFMPEG || "ffmpeg", ["-hide_banner","-loglevel","error","-f","lavfi","-i","testsrc=size=320x240:rate=30","-t","2","-c:v","libx264","-pix_fmt","yuv420p","-y",video]);
  } catch { test.skip(true, "Local ffmpeg is required to generate a consent-free synthetic transport video"); return; }
  const launch = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? {executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE} : {};
  const firstBrowser=await chromium.launch(launch); const first=await firstBrowser.newContext();
  const bodies:string[]=[]; let began!:()=>void; const uploading=new Promise<void>(resolve=>{began=resolve;});
  await first.route("**/*", async route=>{
    const url=new URL(route.request().url()); if(url.origin!==origin) return route.abort();
    if(url.pathname==="/api/csrf") return route.fulfill({json:{csrfToken:"fixture"}});
    if(url.pathname===create) {bodies.push(route.request().postData()!);return route.fulfill({json:{captureUrl:fixtureLink}});}
    if(url.pathname==="/api/self-capture/uploads/reliability-fixture" && route.request().method()==="POST") {
      // The actual client decoded the generated MP4 and started its real XHR.
      // Keep the intercepted transport in flight until this browser terminates.
      began(); return;
    }
    if(url.pathname.startsWith("/api/")) return route.fulfill({status:503,json:{error:"isolated fixture"}});
    return route.continue();
  });
  try {
    const page=await first.newPage();await page.goto(`${origin}/contact/site-operator`);await fill(page);
    await page.locator("#start-method-upload").check();await page.locator("#start-footage").setInputFiles(video);
    await page.locator("#start-rights").check();await page.getByRole("button",{name:"Start free assessment",exact:true}).click();
    await uploading; const saved=await first.storageState();
    await firstBrowser.close();
    const resumedBrowser=await chromium.launch(launch);const resumed=await resumedBrowser.newContext({storageState:saved});
    let repeatedUploads=0;
    await resumed.route("**/*",route=>{
      const url=new URL(route.request().url());if(url.origin!==origin)return route.abort();
      if(url.pathname==="/api/csrf")return route.fulfill({json:{csrfToken:"resumed-fixture"}});
      if(url.pathname===create){bodies.push(route.request().postData()!);return route.fulfill({json:{captureUrl:fixtureLink}});}
      if(url.pathname==="/api/self-capture/uploads/reliability-fixture" && route.request().method()==="POST")repeatedUploads++;
      if(url.pathname==="/api/self-capture/uploads/reliability-fixture/status")return route.fulfill({json:{state:"pending",captureReceived:false}});
      if(url.pathname.startsWith("/api/"))return route.fulfill({status:503,json:{error:"isolated fixture"}});
      return route.continue();
    });
    try {
      const returning=await resumed.newPage();await returning.goto(`${origin}/contact/site-operator`);
      await returning.getByRole("button",{name:"Return to saved job"}).click();
      await expect(returning.getByRole("link",{name:"Open the uploader"})).toHaveAttribute("href",`${fixtureLink}?video=existing`);
      expect(bodies).toHaveLength(2);expect(bodies[1]).toBe(bodies[0]);expect(repeatedUploads).toBe(0);
      await expect(returning.getByRole("heading",{name:"Your recording is in."})).toHaveCount(0);
    } finally {await resumedBrowser.close();}
  } finally {await firstBrowser.close();}
});
