import { expect, test, type Page } from "@playwright/test";
import { buildContentSecurityPolicy } from "../server/utils/contentSecurityPolicy";

// The self-hosted SuperSplat viewer a site opens from its job page (owner decision 2026-10-29).
// The view route itself is covered in server/tests/website-atlas-auto-preview.test.ts; here the
// browser loads the real viewer page under the production policy and is served a scene.

// Software WebGL, so the scene renders on a CI machine without a GPU (Playwright adds this
// switch itself only on macOS).
test.use({
  launchOptions: {
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}),
    args: ["--enable-unsafe-swiftshader"],
  },
});

const SCENE = "/api/website-atlas-preview-views/fixture-request/walkthrough-fixture-request/scene.ply?expires=1&signature=fixture";
const VIEWER = `/splat-viewer/index.html?${new URLSearchParams({ content: SCENE })}`;

/** A small coloured ball of binary float32 gaussians, as the view route serves a splat. */
function ballSplat(count = 4000) {
  const properties = ["x", "y", "z", "f_dc_0", "f_dc_1", "f_dc_2", "opacity", "scale_0", "scale_1", "scale_2",
    "rot_0", "rot_1", "rot_2", "rot_3"];
  const header = `ply\nformat binary_little_endian 1.0\nelement vertex ${count}\n`
    + properties.map(name => `property float ${name}\n`).join("") + "end_header\n";
  const body = new Float32Array(count * properties.length);
  for (let index = 0; index < count; index += 1) {
    // Evenly spread over a sphere (a Fibonacci lattice), coloured by direction.
    const y = 1 - (2 * (index + 0.5)) / count, radius = Math.sqrt(1 - y * y), turn = index * 2.399963;
    const direction = [Math.cos(turn) * radius, y, Math.sin(turn) * radius];
    body.set([...direction.map(value => value * 1.5), ...direction.map(value => value * 1.2), 4, -3, -3, -3, 1, 0, 0, 0],
      index * properties.length);
  }
  return Buffer.concat([Buffer.from(header, "latin1"), Buffer.from(body.buffer)]);
}

const settings = { version: 2, tonemapping: "linear", highPrecisionRendering: false, background: { color: [0, 0, 0] },
  postEffectSettings: { sharpness: { enabled: false, amount: 0 }, bloom: { enabled: false, intensity: 0.1, blurLevel: 2 },
    grading: { enabled: false, brightness: 1, contrast: 1, saturation: 1, tint: [1, 1, 1] },
    vignette: { enabled: false, intensity: 0.5, inner: 0.3, outer: 0.75, curvature: 1 }, fringing: { enabled: false, intensity: 0.5 } },
  animTracks: [], cameras: [{ initial: { position: [0, 0, 6], target: [0, 0, 4], fov: 60 } }], annotations: [], startMode: "default" };

/** The viewer page with the production Content-Security-Policy, whatever the test server sends. */
async function underProductionPolicy(page: Page) {
  const violations: string[] = [];
  page.on("console", message => {
    if (/Content Security Policy|Refused to/i.test(message.text())) violations.push(message.text());
  });
  await page.route("**/splat-viewer/index.html*", async route => {
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(),
      "content-security-policy": buildContentSecurityPolicy({ isProduction: true }) } });
  });
  return violations;
}

test("renders a site's 3D preview under the production content security policy", async ({ page }) => {
  const violations = await underProductionPolicy(page);
  const splat = ballSplat();
  const fetched: string[] = [];
  await page.route("**/api/website-atlas-preview-views/**", async route => {
    const url = new URL(route.request().url());
    fetched.push(url.pathname.split("/").pop()!);
    if (url.pathname.endsWith("/settings.json")) return route.fulfill({ json: settings });
    return route.fulfill({ body: splat, headers: { "content-type": "application/octet-stream",
      "content-length": String(splat.length), "cache-control": "private, no-store" } });
  });
  await page.goto(VIEWER);
  // The viewer hides its loading bar only after drawing the loaded scene.
  await expect(page.locator(".sse-loadingWrap")).toHaveClass(/sse-hidden/, { timeout: 30_000 });
  expect(fetched.sort()).toEqual(["scene.ply", "settings.json"]);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("status")).toHaveCount(0);
  // A way back to the job is always on screen; the browser's Back works too.
  await expect(page.getByRole("link", { name: "Back to your job" })).toHaveAttribute("href", "/app/tasks/fixture-request");
  expect(violations).toEqual([]);
});

test("says the preview is being prepared, and asks for it while the viewer's code still loads", async ({ page }) => {
  // On a first view the server prepares the scene before any of it arrives, and only the
  // download has a progress bar: the page once stayed blank for that whole wait.
  const violations = await underProductionPolicy(page);
  let releaseViewer!: () => void;
  const viewerHeld = new Promise<void>(resolve => { releaseViewer = resolve; });
  await page.route("**/splat-viewer/index.js", async route => {
    await viewerHeld;
    await route.continue();
  });
  let releaseScene!: () => void;
  const sceneHeld = new Promise<void>(resolve => { releaseScene = resolve; });
  const splat = ballSplat();
  await page.route("**/api/website-atlas-preview-views/**", async route => {
    await sceneHeld;
    if (route.request().url().includes("/settings.json?")) return route.fulfill({ json: settings });
    return route.fulfill({ body: splat, headers: { "content-type": "application/octet-stream",
      "content-length": String(splat.length) } });
  });
  const sceneAsked = page.waitForRequest(request => request.url().includes("/scene.ply?"));
  await page.goto(VIEWER, { waitUntil: "commit" });
  await expect(page.getByRole("status")).toHaveText("Getting your 3D preview ready…");
  // The scene is requested before the viewer's 3.4 MB of code has arrived.
  await sceneAsked;
  releaseViewer();
  await expect(page.getByRole("status")).toBeVisible();
  releaseScene();
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(page.locator(".sse-loadingWrap")).toHaveClass(/sse-hidden/, { timeout: 30_000 });
  expect(violations).toEqual([]);
});

test("tells the site when its 3D preview cannot be loaded", async ({ page }) => {
  // A refused or failed scene request (an expired ticket, withdrawn consent, a server that
  // could not prepare the scene) once left an empty black viewer and no word why.
  const violations = await underProductionPolicy(page);
  await page.route("**/api/website-atlas-preview-views/**", route =>
    route.fulfill({ status: 503, json: { error: "3D preview is unavailable", code: "website_atlas_preview_unavailable" } }));
  await page.goto(VIEWER);
  await expect(page.getByRole("alert")).toHaveText(
    "This 3D preview could not be loaded. Go back to your job page and open it again in a minute.");
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Back to your job" })).toHaveAttribute("href", "/app/tasks/fixture-request");
  expect(violations).toEqual([]);
});

test("refuses a viewer link that does not come from Blueprint's view route", async ({ page }) => {
  await page.goto(`/splat-viewer/index.html?${new URLSearchParams({ content: "https://example.com/scene.ply" })}`);
  await expect(page.getByRole("alert")).toHaveText(
    "This 3D preview link is not valid. Open the preview again from your job page.");
  await expect(page.getByRole("link", { name: "Back to your jobs" })).toHaveAttribute("href", "/app/tasks");
});
