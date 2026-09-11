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
      ["how", "/how-it-works", "Find the right fit."],
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

const clearSiteGates = async (page: import("@playwright/test").Page) => {
  await page.locator("#gate-serviceArea").selectOption("austin_metro");
  await page.locator("#gate-sceneStability").selectOption("stable");
  await page.locator("#gate-taskShape").selectOption("single");
  await page.locator("#gate-objectVariety").selectOption("under_10");
  await page.locator("#gate-deploymentTimeline").selectOption("this_quarter");
  await page.locator("#gate-accessWindow").selectOption("scheduled");
};

test("site inquiry validates, retains data on failure, then acknowledges a successful retry", async ({ page }) => {
  await page.goto("/contact/site-operator");
  let attempts = 0;
  let body: Record<string, any> = {};
  await page.route("**/api/inbound-request", async (route) => {
    attempts++;
    body = route.request().postDataJSON();
    expect(route.request().headers()["x-csrf-token"]).toBe("local-review-token");
    await route.fulfill({ status: attempts === 1 ? 503 : 202, contentType: "application/json", body: JSON.stringify(attempts === 1 ? { message: "temporarily unavailable" } : { ok: true }) });
  });
  await page.getByRole("button", { name: "Send inquiry" }).click();
  expect(attempts).toBe(0);
  await clearSiteGates(page);
  await page.locator("#prose-taskDescription").fill("A Raleigh pick-and-place workcell with two candidate configurations.");
  await page.locator("#contact-name").fill("Test Person");
  await page.locator("#contact-email").fill("person@example.com");
  await page.locator("#contact-company").fill("Test Site");
  await page.locator("#contact-site-address").fill("1100 E 5th St, Austin, TX");
  await page.getByRole("button", { name: "Send inquiry" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.locator("#contact-company")).toHaveValue("Test Site");
  await page.getByRole("button", { name: "Send inquiry" }).click();
  await expect(page.getByRole("status").getByText(/clears the screen/i)).toBeVisible();
  expect(attempts).toBe(2);
  expect(body.buyerType).toBe("site_operator");
  // Enum answers, so the verdict on them is reproducible.
  expect(body.siteTaskGates.serviceArea).toBe("austin_metro");
  expect(body.siteTaskGates.accessWindow).toBe("scheduled");
});

test("robot application answers the robot gates, not the site's", async ({ page }) => {
  await page.goto("/contact/robot-team");
  await expect(page.locator("#gate-serviceArea")).toHaveCount(0);
  await page.locator("#gate-hardwareMaturity").selectOption({ index: 1 });
  await page.locator("#gate-deploymentGeography").selectOption({ index: 1 });
  await page.locator("#gate-engineerCapacity").selectOption({ index: 1 });
  await page.locator("#gate-deploymentTimeline").selectOption({ index: 1 });
  await page.locator("#prose-capabilityDescription").fill("Fixed-arm pick-and-place system; https://example.com/robot");
  await page.locator("#contact-name").fill("Test Engineer");
  await page.locator("#contact-email").fill("engineer@example.com");
  await page.locator("#contact-company").fill("Test Robotics");
  const request = page.waitForRequest((req) => req.url().endsWith("/api/inbound-request") && req.method() === "POST");
  await page.route("**/api/inbound-request", async (route) => {
    await route.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  await page.getByRole("button", { name: "Send application" }).click();
  const payload = (await request).postDataJSON();
  expect(payload.buyerType).toBe("robot_team");
  expect(payload.siteTaskGates.hardwareMaturity).toBeTruthy();
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
  await expect(page).toHaveURL(/\/how-it-works$/);
  await expect(page.locator("h1")).toContainText("Find the right fit.");
  await page.goto("/");
  await page.locator("summary").nth(2).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText(/clear reason to pause/)).toBeVisible();
});

test("old marketing links resolve to the minimal website without losing source context", async ({ page }) => {
  for (const [from, to] of [["/pricing", "/contact/site-operator"], ["/for-robot-teams", "/contact/robot-team"], ["/about", "/"], ["/governance", "/privacy"]]) {
    await page.goto(`${from}?source=legacy-review`);
    await expect(page).toHaveURL(new RegExp(`${to.replaceAll("/", "\\/")}\\?source=legacy-review`));
    await expect(page.locator(".minimal-site h1")).toBeVisible();
  }
  await page.goto("/contact");
  await expect(page).toHaveURL(/\/contact\/site-operator/);
});

test("site owners can share task footage by link", async ({ page }) => {
  // Link rather than upload, deliberately: taking worker footage before a
  // consent record exists would bypass what /governance promises, and a link
  // leaves custody with the site.
  await page.goto("/contact/site-operator");
  await clearSiteGates(page);
  await page.locator("#prose-taskDescription").fill("Two related pick-and-place tasks.");
  await page.locator("#taskVideoUrl").fill("https://example.com/task-demo");
  await page.locator("#contact-name").fill("Video Reviewer");
  await page.locator("#contact-email").fill("video@example.com");
  await page.locator("#contact-company").fill("Test Site");
  await page.locator("#contact-site-address").fill("1100 E 5th St, Austin, TX");
  let body: Record<string, any> = {};
  await page.route("**/api/inbound-request", async (route) => {
    body = route.request().postDataJSON();
    await route.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  await page.getByRole("button", { name: "Send inquiry" }).click();
  await expect(page.getByRole("status").getByText(/clears the screen/i)).toBeVisible();
  expect(body.taskVideoUrl).toBe("https://example.com/task-demo");
});
