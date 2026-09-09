import { expect, test } from "@playwright/test";

// Every submission is intercepted. These tests never send an inquiry or email.
test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(pathname === "/api/csrf" ? { csrfToken: "local-review-token" } : { ok: true }) });
  });
});

for (const viewport of [{ width: 1536, height: 1024 }, { width: 390, height: 844 }]) {
  test(`all public pages share the approved theme at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on("pageerror", (error) => {
      // Existing Express/Vite middleware emits an invalid dev-only HMR fallback
      // URL. The standalone preview and production build have no such fallback.
      if (/Failed to construct 'WebSocket': The URL 'ws:\/\/localhost:undefined\//.test(error.message)) return;
      errors.push(error.message);
    });
    for (const [name, path, heading] of [
      ["home", "/", "Your site."],
      ["site", "/contact/site-operator", "Let’s start with your site."],
      ["robot", "/contact/robot-team", "Bring your robot. Find the fit."],
      ["privacy", "/privacy", "Privacy Policy"],
      ["terms", "/terms", "Terms of Service"],
      ["not-found", "/this-page-does-not-exist", "That page isn’t here."],
    ]) {
      await page.goto(path);
      await expect(page.locator("h1")).toContainText(heading);
      await expect(page.locator(".minimal-site")).toHaveCSS("background-color", "rgb(246, 245, 239)");
      await expect(page.getByRole("link", { name: "Blueprint home" })).toHaveCSS("color", "rgb(34, 37, 30)");
      await expect(page.locator(".ms-footer")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect.poll(() => page.locator("img").evaluateAll((images) => images.filter((image) => !image.complete || image.naturalWidth === 0).map((image) => image.src))).toEqual([]);
      await page.screenshot({ path: `output/site-led-review/${name}-${viewport.width}.png`, fullPage: true });
    }
    expect(errors).toEqual([]);
  });
}

test("site inquiry validates, retains data on failure, then acknowledges a successful retry", async ({ page }) => {
  await page.goto("/contact/site-operator");
  let attempts = 0;
  let body: Record<string, string> = {};
  await page.route("**/api/contact", async (route) => {
    attempts++;
    body = route.request().postDataJSON();
    expect(route.request().headers()["x-csrf-token"]).toBe("local-review-token");
    await route.fulfill({ status: attempts === 1 ? 503 : 200, contentType: "application/json", body: JSON.stringify(attempts === 1 ? { error: "temporarily unavailable" } : { ok: true }) });
  });
  await page.getByRole("button", { name: "Send inquiry" }).click();
  expect(attempts).toBe(0);
  await page.getByLabel("Your name").fill("Test Person");
  await page.getByLabel("Work email").fill("person@example.com");
  await page.getByLabel("Company", { exact: true }).fill("Test Site");
  await page.getByLabel("What task do you want to automate?", { exact: true }).fill("A Raleigh pick-and-place workcell with two candidate configurations.");
  await page.getByLabel("Evaluation budget").selectOption("Approved");
  await page.getByLabel("Pilot window").fill("Q1 2027");
  await page.getByRole("button", { name: "Send inquiry" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByLabel("Company", { exact: true })).toHaveValue("Test Site");
  await page.getByRole("button", { name: "Send inquiry" }).click();
  await expect(page.getByRole("heading", { name: "Your inquiry is in." })).toBeVisible();
  expect(attempts).toBe(2);
  expect(body.engagementScope).toBe("site_operator");
  expect(body.requestSource).toBe("website-contact-form");
  expect(body.message).toContain("Evaluation budget: Approved");
  expect(body.message).toContain("Pilot window: Q1 2027");
});

test("robot application submits as a supplier without budget fields", async ({ page }) => {
  await page.goto("/contact/robot-team");
  await expect(page.getByLabel("Evaluation budget")).toHaveCount(0);
  await page.getByLabel("Your name").fill("Test Engineer");
  await page.getByLabel("Work email").fill("engineer@example.com");
  await page.getByLabel("Company", { exact: true }).fill("Test Robotics");
  await page.getByLabel("What does your system do?", { exact: true }).fill("Fixed-arm pick-and-place system; https://example.com/robot");
  const request = page.waitForRequest((req) => req.url().endsWith("/api/contact") && req.method() === "POST");
  await page.getByRole("button", { name: "Send application" }).click();
  expect((await request).postDataJSON()).toMatchObject({ engagementScope: "robot_team", projectType: "Robot team participation" });
  await expect(page.getByRole("heading", { name: "Your application is in." })).toBeVisible();
});

test("mobile navigation and keyboard-accessible method disclosure work", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  const nav = page.getByRole("navigation", { name: "Mobile navigation" });
  await expect(nav).toBeVisible();
  await nav.getByRole("link", { name: "How it works" }).focus();
  await page.keyboard.press("Escape");
  await expect(nav).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Open menu" })).toBeFocused();
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("navigation", { name: "Mobile navigation" }).getByRole("link", { name: "How it works" }).click();
  await expect(page).toHaveURL(/#how-it-works$/);
  await page.locator("summary").nth(2).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText(/clear reason to pause/)).toBeVisible();
});

test("old marketing links resolve to the minimal website without losing source context", async ({ page }) => {
  for (const [from, to] of [["/pricing", "/contact/site-operator"], ["/for-robot-teams", "/contact/robot-team"], ["/how-it-works", "/"], ["/about", "/"], ["/governance", "/privacy"]]) {
    await page.goto(`${from}?source=legacy-review`);
    await expect(page).toHaveURL(new RegExp(`${to.replaceAll("/", "\\/")}\\?source=legacy-review`));
    await expect(page.locator(".minimal-site h1")).toBeVisible();
  }
  await page.goto("/contact");
  await expect(page).toHaveURL(/\/contact\/site-operator/);
});

test("site owners can include links and upload more than one task clip", async ({ page }) => {
  await page.goto("/contact/site-operator");
  await page.getByLabel("Your name").fill("Video Reviewer");
  await page.getByLabel("Work email").fill("video@example.com");
  await page.getByLabel("Company", { exact: true }).fill("Test Site");
  await page.getByLabel("What task do you want to automate?", { exact: true }).fill("Two related pick-and-place tasks.");
  await page.getByLabel("Evaluation budget").selectOption("Approved");
  await page.getByLabel("Video links", { exact: true }).fill("https://example.com/task-demo");
  await page.getByLabel("Upload task videos").setInputFiles([
    { name: "task-one.mp4", mimeType: "video/mp4", buffer: Buffer.from("0000ftypisom0000test-one") },
    { name: "task-two.mov", mimeType: "video/quicktime", buffer: Buffer.from("0000ftypqt  0000test-two") },
  ]);
  await expect(page.getByRole("list", { name: "Selected task videos" }).getByRole("listitem")).toHaveCount(2);
  let receivedMultipart = false;
  await page.route("**/api/contact", async (route) => {
    expect(route.request().headers()["content-type"]).toContain("multipart/form-data; boundary=");
    expect(route.request().headers()["x-csrf-token"]).toBe("local-review-token");
    const content = route.request().postDataBuffer()!.toString();
    expect(content).toContain('filename="task-one.mp4"');
    expect(content).toContain('filename="task-two.mov"');
    expect(content).toContain("https://example.com/task-demo");
    receivedMultipart = true;
    await route.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify({ success: true }) });
  });
  await page.getByRole("button", { name: "Send inquiry" }).click();
  await expect(page.getByRole("heading", { name: "Your inquiry is in." })).toBeVisible();
  expect(receivedMultipart).toBe(true);
});
