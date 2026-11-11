import { test, expect } from "@playwright/test";

/** The optional sentence: typing it confirms the brief (owner direction 2026-11-11). */
async function fillJobDescription(page: import("@playwright/test").Page, value: string) {
  await page.getByRole("button", { name: "Add details (optional) ›" }).click(); await page.locator("#start-task").fill(value); await page.getByRole("button", { name: "Done", exact: true }).click();
}

/** Real browser UI, intercepted API. Never counted as isolated-backend proof. */
test("lost create response survives reload with the same private retry identity", async ({ page, context }, testInfo) => {
  const posts: string[] = [];
  await context.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/inbound-request") {
      posts.push(route.request().postData()!);
      if (posts.length === 1) return route.abort("connectionreset");
      return route.fulfill({ status: 201, json: { captureUrl: "/capture-upload/synthetic-recovery" } });
    }
    if (url.pathname === "/api/csrf") return route.fulfill({ json: { csrfToken: "synthetic" } });
    if (url.pathname.startsWith("/api/") || url.hostname === "photon.komoot.io") return route.fulfill({ json: {} });
    return route.continue();
  });
  await context.tracing.start({ screenshots: true, snapshots: true });
  await page.goto("/contact/site-operator");
  await fillJobDescription(page, "Move sealed cartons onto a pallet");
  await page.locator("#start-location").fill("Austin, TX"); await page.locator("#start-region").selectOption("us");
  await page.locator("#start-email").fill("qa@example.invalid");
  await page.getByRole("button", { name: /^(Send video|Next: film the job|Save my job)$/ }).click();
  await expect(page.getByRole("alert")).toContainText("could not reach Blueprint");
  await page.reload();
  await expect(page.locator("#start-task")).toHaveValue("Move sealed cartons onto a pallet");
  await page.getByRole("button", { name: "Recover saved job", exact: true }).click();
  await expect(page.getByRole("link", { name: "Open my job page ›", exact: true })).toHaveAttribute("href", "/capture-upload/synthetic-recovery");
  expect(posts).toHaveLength(2);
  expect(posts[1]).toBe(posts[0]);
  await page.reload();
  await page.getByRole("button", { name: "Return to saved job", exact: true }).click();
  await expect(page.getByRole("link", { name: "Open my job page ›", exact: true })).toHaveAttribute("href", "/capture-upload/synthetic-recovery");
  expect(posts).toHaveLength(3);
  expect(posts[2]).toBe(posts[0]);
  await context.tracing.stop({ path: testInfo.outputPath("recovery-trace.zip") });
});

// A server-owned capture subject now exists before account setup. A restart
// recovers the same private job and reconciles its receipt without a new account
// or another upload. API interception remains synthetic transport evidence.
for (const receipt of ["not-received", "received-pending"] as const) test(`browser process restart during upload reconciles ${receipt} on same job`, async ({}, testInfo) => {
  const { chromium } = await import("@playwright/test");
  const { mkdtemp, rm } = await import("node:fs/promises");
  const os = await import("node:os");
  const path = await import("node:path");
  const profile = await mkdtemp(path.join(os.tmpdir(), "blueprint-owned-restart-"));
  const { execFileSync } = await import("node:child_process");
  const fixture = path.join(profile, "synthetic-owned.mp4");
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=size=320x240:rate=30", "-t", "2", "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-y", fixture]);
  const posts: string[] = [];
  const accountMutations: string[] = [];
  let uploadAttempts = 0;
  let interrupted = false;
  const start = async () => {
    const context = await chromium.launchPersistentContext(profile, { headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
    await context.route("**/*", async route => {
      const request = route.request(), url = new URL(request.url());
      if (request.method() !== "GET" && (url.hostname === "identitytoolkit.googleapis.com"
          || url.pathname.startsWith("/api/workspace/"))) accountMutations.push(url.pathname);
      if (url.pathname === "/api/inbound-request") {
        posts.push(request.postData()!);
        return route.fulfill({ status: 201, json: { captureUrl: "/capture-upload/synthetic-upload-restart" } });
      }
      if (url.pathname === "/api/self-capture/uploads/synthetic-upload-restart" && request.method() === "POST") {
        uploadAttempts++;
        interrupted = true;
        return; // Keep the fake transport open until the real browser process closes.
      }
      if (url.pathname.endsWith("/status")) return route.fulfill({ json: receipt === "received-pending"
        ? { captureReceived: true, state: "processing_pending", processingRetryAvailable: true }
        : { captureReceived: false, state: "ready" } });
      if (url.pathname === "/api/csrf") return route.fulfill({ json: { csrfToken: "synthetic" } });
      if (url.pathname.startsWith("/api/") || url.hostname !== "127.0.0.1") return route.fulfill({ json: {} });
      return route.continue();
    });
    await context.tracing.start({ screenshots: true, snapshots: true });
    return context;
  };
  let context = await start();
  try {
    let page = await context.newPage();
    await page.goto("http://127.0.0.1:4181/contact/site-operator");
    await fillJobDescription(page, "Move sealed cartons onto a pallet");
    await page.locator("#start-location").fill("Austin TX"); await page.locator("#start-region").selectOption("us");
    await page.locator("#start-email").fill("qa@example.invalid");

    await page.locator("#start-method-upload").click();
    await expect(page.locator("#start-password")).toHaveCount(0);
    await page.locator("#start-footage").setInputFiles(fixture);
    await page.getByRole("button", { name: /^(Send video|Next: film the job|Save my job)$/ }).click();
    await expect.poll(() => interrupted).toBe(true);
    await context.tracing.stop({ path: testInfo.outputPath("before-browser-close.zip") });
    await context.close();
    context = await start();
    page = await context.newPage();
    await page.goto("http://127.0.0.1:4181/contact/site-operator");
    expect(posts).toHaveLength(1);
    await page.getByRole("button", { name: "Return to saved job", exact: true }).click();
    if (receipt === "received-pending") {
      // A received recording whose processing is unconfirmed reads as received,
      // with the processing state behind its optional details.
      await expect(page.getByRole("heading", { name: "We have your video.", exact: true })).toBeVisible();
      await expect(page.getByText("Blueprint will continue from this saved recording", { exact: false })).toBeVisible();
      await expect(page.getByRole("link", { name: "Open my job", exact: true })).toHaveAttribute("href", "/capture-upload/synthetic-upload-restart");
    } else {
      await expect(page.getByRole("heading", { name: "Your job is saved. Check your video upload." })).toBeVisible();
      await expect(page.getByRole("link", { name: "Open the uploader", exact: true })).toHaveAttribute("href", "/capture-upload/synthetic-upload-restart?video=existing");
    }
    expect(posts).toHaveLength(2);
    expect(posts[1]).toBe(posts[0]);
    expect(uploadAttempts).toBe(1);
    expect(accountMutations).toEqual([]);
    await expect(page.locator("#start-password")).toHaveCount(0);
    await context.tracing.stop({ path: testInfo.outputPath("after-browser-restart.zip") });
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});

/**
 * The start form on a phone, as the owner met it (2026-11-11): "Use my location", then an email we cannot send to.
 * Every API and the address lookup are answered in the browser. Screenshots go to BLUEPRINT_SHOTS when it is set.
 */
test.describe("the start form on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    geolocation: { latitude: 30.4417, longitude: -97.7206 }, permissions: ["geolocation"] });
  const FILLED = "4201 West Parmer Lane, Austin, Texas, United States";
  const shots = process.env.BLUEPRINT_SHOTS;
  async function open(page: import("@playwright/test").Page, posts: string[], answer: (body: string) => { status: number; json: unknown } = () => ({ status: 201, json: { captureUrl: null } })) {
    await page.context().route("**/*", async route => {
      const url = new URL(route.request().url());
      if (url.pathname === "/api/inbound-request") { const body = route.request().postData()!; posts.push(body); return route.fulfill(answer(body)); }
      if (url.pathname === "/api/csrf") return route.fulfill({ json: { csrfToken: "synthetic" } });
      if (url.hostname === "photon.komoot.io" && url.pathname === "/reverse") return route.fulfill({ json: { features: [{ properties: {
        housenumber: "4201", street: "West Parmer Lane", city: "Austin", state: "Texas", country: "United States", countrycode: "US" } }] } });
      if (url.pathname.startsWith("/api/") || url.hostname === "photon.komoot.io") return route.fulfill({ json: {} });
      if (url.hostname !== "127.0.0.1") return route.abort();
      return route.continue();
    });
    await page.goto("/contact/site-operator");
    await page.locator("#start-email").waitFor();
  }
  async function useMyLocation(page: import("@playwright/test").Page) {
    await page.getByRole("button", { name: "Use my location" }).click();
    await expect(page.locator("#start-location")).toHaveValue(FILLED);
    await expect(page.getByText("Current address filled. Check it before continuing.")).toBeVisible();
  }

  test("takes the country from \"Use my location\" and keeps it after a refusal", async ({ page }) => {
    const posts: string[] = [];
    await open(page, posts, () => ({ status: 422, json: { message: "Correct task" } }));
    await useMyLocation(page);
    await expect(page.locator("#start-region")).toHaveCount(0);
    if (shots) await page.screenshot({ path: `${shots}/public-04e-use-my-location.png`, fullPage: true });
    await page.locator("#start-email").fill("owner@example.invalid");
    await page.getByRole("button", { name: "Next: film the job" }).click();
    await expect(page.getByText("Correct task")).toBeVisible();
    await expect(page.locator("#start-region")).toHaveCount(0);
    expect(JSON.parse(posts[0])).toMatchObject({ siteLocation: FILLED, captureRegion: "us" });
  });

  test("hints about yeet@gmail.com under the field and still creates the job", async ({ page }) => {
    const posts: string[] = [];
    await open(page, posts);
    await useMyLocation(page);
    await page.locator("#start-email").fill("yeet@gmail.com");
    await page.locator("#start-email").blur();
    const help = page.locator("#start-email-help");
    await expect(help).toHaveText("Gmail names are usually 6 to 30 characters. Check it's right; we send your job link there.");
    await expect(help).toHaveClass(/bare-helper/);
    await expect(page.locator("#start-email-error")).toHaveCount(0);
    if (shots) await page.screenshot({ path: `${shots}/public-04b-email-gmail-hint.png`, fullPage: true });
    await page.getByRole("button", { name: "Next: film the job" }).click();
    await expect.poll(() => posts.length).toBe(1);
    expect(JSON.parse(posts[0])).toMatchObject({ email: "yeet@gmail.com", captureRegion: "us" });
  });

  for (const [shot, email, sentence] of [
    ["public-04c-email-temporary", "yeet@mailinator.com", "We can't send to a temporary email address. Use one you check."],
    ["public-04d-email-check", "owner@example", "Check your email address."],
  ] as const) test(`says why ${email} cannot be used, under the email field, before anything is sent`, async ({ page }) => {
    const posts: string[] = [];
    await open(page, posts);
    await useMyLocation(page);
    await page.locator("#start-email").fill(email);
    await page.getByRole("button", { name: "Next: film the job" }).click();
    const error = page.locator("#start-email-error");
    await expect(error).toHaveText(sentence);
    await expect(page.locator("#start-email")).toBeFocused();
    await expect(page.locator("#start-email")).toHaveAttribute("aria-invalid", "true");
    // Directly under the field, 8 px below it.
    const [field, line] = await Promise.all([page.locator("#start-email").boundingBox(), error.boundingBox()]);
    expect(Math.round(line!.y - (field!.y + field!.height))).toBeGreaterThanOrEqual(8);
    await expect(page.getByText(/Job reference/)).toHaveCount(0);
    await expect(page.locator("#start-region")).toHaveCount(0);
    expect(posts).toHaveLength(0);
    if (shots) await page.screenshot({ path: `${shots}/${shot}.png`, fullPage: true });
  });

  test("catches a script that fills every rendered input", async ({ page }) => {
    const posts: string[] = [];
    await open(page, posts, () => ({ status: 202, json: { ok: true, requestId: "fake-id", status: "submitted" } }));
    await page.locator("#start-location").fill("Austin, TX");
    await page.getByRole("button", { name: "Next: film the job" }).click();
    await page.locator("#start-region").selectOption("us");
    await page.locator("#start-email").fill("bot@example.invalid");
    // A script: every rendered text input still empty gets a value, whether or not a person could see it.
    const filled = await page.evaluate(() => [...document.querySelectorAll<HTMLInputElement>('form input[type="text"], form input[type="email"]')]
      .filter(input => input.getClientRects().length > 0 && !input.value)
      .map(input => { input.value = "https://spam.example"; return input.name; }));
    expect(filled).toContain("honeypot");
    await page.getByRole("button", { name: "Next: film the job" }).click();
    await expect.poll(() => posts.length).toBe(1);
    expect(JSON.parse(posts[0]).honeypot).toBe("https://spam.example");
  });

  test("hides the bot trap from people: no text, no keyboard stop, no autofill", async ({ page }) => {
    const posts: string[] = [];
    await open(page, posts);
    const text = await page.locator("body").innerText();
    expect(text).not.toMatch(/Leave this field/i);
    // Select everything and copy, as a person would.
    await page.keyboard.press("ControlOrMeta+A");
    const copied = await page.evaluate(() => String(window.getSelection()));
    expect(copied).not.toMatch(/Leave this field/i);
    // An autofill-like fill: every input a person can see gets a value; the trap is not among them.
    const inputs = page.locator('form input:not([type="file"]):not([type="checkbox"]):not([type="hidden"])');
    // "Visible" as a person sees it: on the page, not merely rendered (the trap is rendered, off-screen, 1 px).
    for (let index = 0; index < await inputs.count(); index++) {
      const input = inputs.nth(index);
      const box = await input.boundingBox();
      if (box && box.x + box.width > 0 && box.width > 1 && await input.isEditable()) await input.fill(index === 0 ? "Austin, TX" : "owner@example.invalid");
    }
    // And nothing on the trap that browser autofill or a password manager reads as a field to fill.
    await expect(page.locator('input[name="honeypot"]')).toHaveAttribute("autocomplete", "off");
    await expect(page.locator('input[name="honeypot"]')).toHaveAttribute("data-lpignore", "true");
    await expect(page.locator('input[name="honeypot"]')).toHaveValue("");
    // Rendered, off-screen: present in the layout for a script, nowhere a person looks.
    const box = await page.locator('input[name="honeypot"]').boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x + box!.width).toBeLessThanOrEqual(0);
    expect(await page.locator("[data-bot-trap]").innerText()).toBe("");
    // Not in what a screen reader is given, and never reached with the Tab key.
    expect(JSON.stringify(await page.locator("form").ariaSnapshot())).not.toMatch(/honeypot|Leave this field/i);
    await page.locator("#start-location").focus();
    for (let step = 0; step < 25; step++) {
      await page.keyboard.press("Tab");
      expect(await page.evaluate(() => (document.activeElement as HTMLInputElement | null)?.name)).not.toBe("honeypot");
    }
  });
});
