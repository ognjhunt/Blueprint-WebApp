import { test, expect } from "@playwright/test";

async function fillJobDescription(page: import("@playwright/test").Page, value: string) {
  const field = page.locator("#start-task");
  if (!(await field.isVisible())) {
    await page.getByText("Add job details and buying plans (optional)", { exact: true }).click();
  }
  await field.fill(value);
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
  await page.locator("#start-location").fill("Austin, TX");
  await page.locator("#start-email").fill("qa@example.invalid");
  await page.getByRole("button", { name: "Start free assessment", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("could not reach Blueprint");
  await page.reload();
  await expect(page.locator("#start-task")).toHaveValue("Move sealed cartons onto a pallet");
  await page.getByRole("button", { name: "Recover saved job", exact: true }).click();
  await expect(page.getByRole("link", { name: "Open your job page", exact: true })).toHaveAttribute("href", "/capture-upload/synthetic-recovery");
  expect(posts).toHaveLength(2);
  expect(posts[1]).toBe(posts[0]);
  await page.reload();
  await page.getByRole("button", { name: "Return to saved job", exact: true }).click();
  await expect(page.getByRole("link", { name: "Open your job page", exact: true })).toHaveAttribute("href", "/capture-upload/synthetic-recovery");
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
    await page.locator("#start-location").fill("Austin TX");
    await page.locator("#start-email").fill("qa@example.invalid");

    await page.locator("#start-method-upload").check();
    await expect(page.locator("#start-password")).toHaveCount(0);
    await page.locator("#start-footage").setInputFiles(fixture);
    await page.getByRole("button", { name: "Start free assessment", exact: true }).click();
    await expect.poll(() => interrupted).toBe(true);
    await context.tracing.stop({ path: testInfo.outputPath("before-browser-close.zip") });
    await context.close();
    context = await start();
    page = await context.newPage();
    await page.goto("http://127.0.0.1:4181/contact/site-operator");
    expect(posts).toHaveLength(1);
    await page.getByRole("button", { name: "Return to saved job", exact: true }).click();
    if (receipt === "received-pending") {
      await expect(page.getByRole("heading", { name: "Video received. Processing is not confirmed." })).toBeVisible();
      await expect(page.getByRole("link", { name: "Open your job and assessment", exact: true })).toHaveAttribute("href", "/capture-upload/synthetic-upload-restart");
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
