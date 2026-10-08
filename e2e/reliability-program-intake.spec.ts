import { expect, test, chromium, type Page } from "@playwright/test";
import { copyFileSync, mkdirSync } from "node:fs";
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
  await expect(returning.getByRole("status").filter({hasText:"has been cleared"})).toBeVisible();
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

test("UI-CROSS-TAB-001 concurrent Start with delayed storage events shares exact frozen authority", async ({ context }) => {
  // Missing event delivery is a controlled adversarial ordering, not a mocked browser storage implementation.
  await context.addInitScript(() => window.addEventListener("storage", event => event.stopImmediatePropagation(), true));
  const bodies: string[]=[];
  const createRoutes: import("@playwright/test").Route[]=[];
  await context.route(`**${create}`,async route=>{
    bodies.push(route.request().postData()!);createRoutes.push(route);
    if(createRoutes.length===2) await Promise.all(createRoutes.map(held=>held.fulfill({json:{captureUrl:fixtureLink}})));
  });
  const first=await context.newPage(), second=await context.newPage();
  await Promise.all([first.goto(`${origin}/contact/site-operator`),second.goto(`${origin}/contact/site-operator`)]);
  await fill(first);await fill(second);await second.locator("#start-task").fill("A different stale-tab task");
  // Hold create replies until both normal UI submissions are in flight. This
  // avoids cached CSRF tokens and racing two physical page clicks.
  await first.getByRole("button",{name:"Start free assessment"}).click();
  await expect(first.getByRole("button",{name:"Working…"})).toBeVisible();
  await second.getByRole("button",{name:"Start free assessment"}).click();
  await expect(first.getByRole("link",{name:"Review your job brief"})).toBeVisible();
  await expect(second.getByRole("link",{name:"Review your job brief"})).toBeVisible();
  expect(bodies).toHaveLength(2);expect(bodies[1]).toBe(bodies[0]);
  expect(await first.evaluate(()=>Object.entries(localStorage).find(([key])=>key.startsWith("bp-site-capture:"))?.[1]))
    .toBe(await second.evaluate(()=>Object.entries(localStorage).find(([key])=>key.startsWith("bp-site-capture:"))?.[1]));
});

test("UI-CROSS-TAB-002 stale edits after lost response preserve winner across reload", async ({ context }) => {
  const first=await context.newPage(), second=await context.newPage();
  await second.addInitScript(()=>window.addEventListener("storage",event=>event.stopImmediatePropagation(),true));
  const bodies:string[]=[];
  await context.route(`**${create}`,route=>{bodies.push(route.request().postData()!);return bodies.length===1?route.abort():route.fulfill({json:{captureUrl:fixtureLink}});});
  await Promise.all([first.goto(`${origin}/contact/site-operator`),second.goto(`${origin}/contact/site-operator`)]);
  await fill(first);await fill(second);
  await first.getByRole("button",{name:"Start free assessment"}).click();await expect(first.getByRole("alert")).toBeVisible();
  await second.locator("#start-task").fill("Stale edits must not replace frozen task");
  await second.reload();await expect(second.locator("#start-task")).toHaveValue("Move sealed cartons to the pallet");
  await second.getByRole("button",{name:"Recover saved job"}).click();
  await expect(second.getByRole("link",{name:"Review your job brief"})).toBeVisible();
  expect(bodies).toHaveLength(2);expect(bodies[1]).toBe(bodies[0]);
});

test("UI-CROSS-TAB-003 clear in another tab survives an old acknowledgement before fresh explicit Start",async({context})=>{
  const first=await context.newPage(), second=await context.newPage();const bodies:string[]=[];
  let finish!:()=>void;const wait=new Promise<void>(resolve=>{finish=resolve;});
  await context.route(`**${create}`,async route=>{
    bodies.push(route.request().postData()!);if(bodies.length===1)await wait;
    return route.fulfill({json:{captureUrl:fixtureLink}});
  });
  await Promise.all([first.goto(`${origin}/contact/site-operator`),second.goto(`${origin}/contact/site-operator`)]);
  await fill(first);await first.getByRole("button",{name:"Start free assessment"}).click();
  await expect(first.getByRole("button",{name:"Working…"})).toBeVisible();
  await expect(second.getByRole("button",{name:"Recover saved job"})).toBeVisible();
  await second.getByRole("button",{name:"Clear this browser's draft"}).click();
  await expect(second.locator("#start-task")).toHaveValue("");await fill(second);
  await second.locator("#start-task").fill("An explicitly new job after clearing");
  const snapshot=()=>second.evaluate(()=>JSON.parse(Object.entries(localStorage).find(([key])=>key.startsWith("bp-site-capture:"))![1]));
  const durableSnapshot=()=>second.evaluate(()=>new Promise<unknown>((resolve,reject)=>{
    const open=indexedDB.open("blueprint-site-capture-recovery-v1",1);
    open.onerror=()=>reject(open.error);
    open.onupgradeneeded=()=>{open.transaction!.abort();reject(new Error("Expected existing checkpoint database"));};
    open.onsuccess=()=>{
      const db=open.result,tx=db.transaction("recovery","readonly"),request=tx.objectStore("recovery").get("bp-site-capture:v1:anonymous:default");
      request.onsuccess=()=>resolve(request.result?.value??null);request.onerror=()=>reject(request.error);
      tx.oncomplete=()=>db.close();tx.onabort=()=>{db.close();reject(tx.error);};
    };
  }));
  await expect.poll(async()=>(await snapshot()).draft.task).toBe("An explicitly new job after clearing");
  await expect.poll(async()=>await durableSnapshot()).toEqual(await snapshot());
  const fresh=await snapshot();finish();
  // A retired generation cannot retain an acknowledgement or present success.
  await expect(first.getByRole("alert")).toContainText("could not retain its confirmation");
  await expect(first.getByRole("link",{name:"Review your job brief"})).toHaveCount(0);
  expect((await snapshot()).requestId).toBe(fresh.requestId);expect((await snapshot()).pending).toBeNull();
  expect(await snapshot()).toEqual(fresh);expect(await durableSnapshot()).toEqual(fresh);
  await second.reload();await expect(second.locator("#start-task")).toHaveValue("An explicitly new job after clearing");
  // Reload retains the actual checkpoint as well as displayed default values.
  await expect.poll(async()=>(await snapshot()).draft).toEqual(fresh.draft);
  await expect.poll(async()=>await durableSnapshot()).toEqual(await snapshot());
  // An unsubmitted recording grant is never restored by recovery.
  await expect(second.locator("#start-rights")).not.toBeChecked();
  await second.locator("#start-rights").check();
  await second.getByRole("button",{name:"Start free assessment"}).click();
  await expect(second.getByRole("link",{name:"Review your job brief"})).toBeVisible();
  expect(bodies).toHaveLength(2);expect(JSON.parse(bodies[1]).requestId).toBe(fresh.requestId);
  expect(JSON.parse(bodies[1]).requestId).not.toBe(JSON.parse(bodies[0]).requestId);
  expect(JSON.parse(bodies[1]).taskStatement).toBe("An explicitly new job after clearing");
});

test("UI-CROSS-TAB-004 missing browser coordination has a fresh-customer next step without dispatch",async({context,page})=>{
  // Capability fault is simulated; the customer UI executes in actual Chromium.
  await context.addInitScript(()=>Object.defineProperty(navigator,"locks",{value:undefined,configurable:true}));
  let posts=0;await context.route(`**${create}`,route=>{posts++;return route.abort();});
  await page.goto("/contact/site-operator");
  await expect(page.getByRole("status").filter({hasText:"could not safely check"})).toContainText("supported browser with local storage enabled");
  await expect(page.locator("#start-task")).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Start free assessment"})).toHaveCount(0);
  await expect(page.getByRole("link",{name:"Talk to a person"})).toHaveAttribute("href","mailto:hello@tryblueprint.io");
  expect(posts).toBe(0);
});


test("UI-RETURN-005 real browser termination during video transport returns to the same intake", async () => {
  const output = path.resolve("output/reliability-program/intake"); mkdirSync(output, {recursive:true});
  const video = path.join(output,"synthetic-transport.mp4");
  // Checked-in synthetic video keeps this mandatory check independent of FFmpeg installation.
  copyFileSync(path.resolve("e2e/fixtures/synthetic-transport.mp4"), video);
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

// A held real WebLock makes the clear/leave boundary deterministic without
// replacing IndexedDB or intercepting any persistence calls.
async function holdRecoveryLock(context: import("@playwright/test").BrowserContext) {
  const holder=await context.newPage();await holder.goto("/contact/site-operator");
  await expect(holder.locator("#start-task")).toBeEnabled();
  await holder.evaluate(()=>{
    (window as any).reliabilityHeld=false;
    void navigator.locks.request("bp-site-capture:v1:anonymous:default",async()=>{
      (window as any).reliabilityHeld=true;
      await new Promise<void>(resolve=>{(window as any).reliabilityRelease=resolve;});
    });
  });
  await expect.poll(()=>holder.evaluate(()=>(window as any).reliabilityHeld)).toBe(true);
  return {release:()=>holder.evaluate(()=>(window as any).reliabilityRelease()),holder};
}
async function recoveryMirrors(page:Page) {
  return page.evaluate(async()=>{
    const key="bp-site-capture:v1:anonymous:default", local=JSON.parse(localStorage.getItem(key)!);
    const durable=await new Promise<any>((resolve,reject)=>{
      const request=indexedDB.open("blueprint-site-capture-recovery-v1",1);
      request.onerror=()=>reject(request.error);
      request.onupgradeneeded=()=>{request.transaction!.abort();reject(new Error("Expected existing recovery database"));};
      request.onsuccess=()=>{const db=request.result,tx=db.transaction("recovery","readonly"),read=tx.objectStore("recovery").get(key);
        read.onsuccess=()=>resolve(read.result);read.onerror=()=>reject(read.error);tx.oncomplete=()=>db.close();tx.onabort=()=>{db.close();reject(tx.error);};};
    });
    return {local,durable};
  });
}
test("UI-CLEAR-001 acknowledged clear commits both stores before reload",async({page,context})=>{
  await page.goto("/contact/site-operator");await fill(page);
  await expect.poll(async()=>(await recoveryMirrors(page)).durable.value.draft.task).toBe("Move sealed cartons to the pallet");
  const lock=await holdRecoveryLock(context),original=await recoveryMirrors(page);
  await page.getByRole("button",{name:"Clear this browser's draft"}).click();
  await expect(page.getByRole("status").filter({hasText:"Clearing this browser's draft"})).toBeVisible();
  await expect(page.getByRole("button",{name:"Clearing…",exact:true})).toBeDisabled();
  await expect(page.locator("#start-task")).toBeDisabled();
  await expect(page.getByRole("button",{name:"Start free assessment"})).toBeDisabled();
  await expect(page.getByRole("status").filter({hasText:"has been cleared"})).toHaveCount(0);
  expect(await recoveryMirrors(page)).toEqual(original);
  await lock.release();await expect(page.getByRole("status").filter({hasText:"has been cleared"})).toBeVisible();
  await expect(page.locator("#start-task")).toHaveValue("");
  const cleared=await recoveryMirrors(page);expect(cleared.durable.retired).toBe(false);expect(cleared.durable.value).toEqual(cleared.local);
  expect(cleared.local.requestId).not.toBe(original.local.requestId);expect(cleared.local.pending).toBeNull();
  for(const field of ["task","location","email","company"])expect(cleared.local.draft[field]).toBe("");
  await page.reload();await expect(page.locator("#start-task")).toHaveValue("");
  const returned=await recoveryMirrors(page);expect(returned.local.requestId).toBe(cleared.local.requestId);expect(returned.durable.value).toEqual(returned.local);
  await expect(lock.holder.locator("#start-task")).toHaveValue("");
});
test("UI-CLEAR-002 reload before clear acknowledgement preserves unretired draft",async({page,context})=>{
  await page.goto("/contact/site-operator");await fill(page);
  await expect.poll(async()=>(await recoveryMirrors(page)).durable.value.draft.task).toBe("Move sealed cartons to the pallet");
  const lock=await holdRecoveryLock(context),original=await recoveryMirrors(page);
  await page.getByRole("button",{name:"Clear this browser's draft"}).click();
  await expect(page.getByRole("status").filter({hasText:"has been cleared"})).toHaveCount(0);
  const loaded=page.waitForEvent("domcontentloaded"),navigation=page.reload();
  await loaded;await lock.release();await navigation;
  await expect(page.locator("#start-task")).toHaveValue("Move sealed cartons to the pallet");
  const returned=await recoveryMirrors(page);expect(returned.local.requestId).toBe(original.local.requestId);expect(returned.local.draft).toEqual(original.local.draft);
  expect(returned.durable.value).toEqual(returned.local);expect(returned.durable.retired).toBe(false);
  await expect(page.getByRole("status").filter({hasText:"has been cleared"})).toHaveCount(0);
});
