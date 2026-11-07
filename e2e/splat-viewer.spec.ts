import { expect, test, type Page } from "@playwright/test";
import { createRequire } from "node:module";
import { buildContentSecurityPolicy } from "../server/utils/contentSecurityPolicy";

const { PNG } = createRequire(import.meta.url)("pngjs");

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

/**
 * The same ball as PlayCanvas's compressed PLY, the scene preview's format
 * (website_scene_preview.build_preview): per 256 consecutive gaussians, 18 float bounds;
 * per gaussian, 11-10-11 position and log scale, smallest-three rotation and 8-8-8-8 colour.
 */
function compressedBallSplat(count = 4000) {
  const SH_C0 = 0.28209479177387814;
  const rows = Array.from({ length: count }, (_, index) => {
    const y = 1 - (2 * (index + 0.5)) / count, radius = Math.sqrt(1 - y * y), turn = index * 2.399963;
    const direction = [Math.cos(turn) * radius, y, Math.sin(turn) * radius];
    return { position: direction.map(value => value * 1.5), colour: direction.map(value => 0.5 + SH_C0 * value * 1.2) };
  });
  const chunks = Math.ceil(count / 256), chunk = new Float32Array(chunks * 18), vertex = new Uint32Array(count * 4);
  const unorm = (value: number, low: number, high: number, bits: number) =>
    Math.round((high > low ? (value - low) / (high - low) : 0) * ((1 << bits) - 1));
  for (let index = 0; index < chunks; index += 1) {
    const members = rows.slice(index * 256, (index + 1) * 256);
    const low = (pick: (row: typeof rows[number]) => number[]) => [0, 1, 2].map(axis => Math.min(...members.map(row => pick(row)[axis]!)));
    const high = (pick: (row: typeof rows[number]) => number[]) => [0, 1, 2].map(axis => Math.max(...members.map(row => pick(row)[axis]!)));
    const bounds = [...low(row => row.position), ...high(row => row.position), -3, -3, -3, -3, -3, -3,
      ...low(row => row.colour), ...high(row => row.colour)];
    chunk.set(bounds, index * 18);
    members.forEach((row, offset) => {
      const [p, c] = [row.position.map((value, axis) => unorm(value, bounds[axis]!, bounds[axis + 3]!, axis === 1 ? 10 : 11)),
        row.colour.map((value, axis) => unorm(value, bounds[axis + 12]!, bounds[axis + 15]!, 8))];
      // The identity rotation: w (index 0) largest, x, y, z stored as 0·√2/2 + 0.5. Alpha is sigmoid(4).
      const alpha = Math.round(255 / (1 + Math.exp(-4)));
      vertex.set([((p[0]! << 21) | (p[1]! << 11) | p[2]!) >>> 0, ((0 << 30) | (512 << 20) | (512 << 10) | 512) >>> 0, 0,
        ((c[0]! << 24) | (c[1]! << 16) | (c[2]! << 8) | alpha) >>> 0], (index * 256 + offset) * 4);
    });
  }
  const header = `ply\nformat binary_little_endian 1.0\nelement chunk ${chunks}\n`
    + ["min_x", "min_y", "min_z", "max_x", "max_y", "max_z", "min_scale_x", "min_scale_y", "min_scale_z", "max_scale_x",
      "max_scale_y", "max_scale_z", "min_r", "min_g", "min_b", "max_r", "max_g", "max_b"].map(name => `property float ${name}\n`).join("")
    + `element vertex ${count}\n` + ["packed_position", "packed_rotation", "packed_scale", "packed_color"]
      .map(name => `property uint ${name}\n`).join("") + "end_header\n";
  return Buffer.concat([Buffer.from(header, "latin1"), Buffer.from(chunk.buffer), Buffer.from(vertex.buffer)]);
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

test("renders the scene preview a job page links to, through the same host page", async ({ page }) => {
  // "View your scene" (owner ask 2026-11-07): the job page's link names the scene preview with
  // source=scene, and the viewer asks for its splat and start view with that same selector.
  const violations = await underProductionPolicy(page);
  const splat = ballSplat();
  const fetched: string[] = [];
  await page.route("**/api/website-atlas-preview-views/**", async route => {
    const url = new URL(route.request().url());
    fetched.push(`${url.pathname.split("/").pop()}:${url.searchParams.get("source")}`);
    if (url.pathname.endsWith("/settings.json")) return route.fulfill({ json: settings });
    return route.fulfill({ body: splat, headers: { "content-type": "application/octet-stream",
      "content-length": String(splat.length), "cache-control": "private, no-store" } });
  });
  const scene = SCENE.replace("scene.ply?", "scene.ply?source=scene&");
  await page.goto(`/splat-viewer/index.html?${new URLSearchParams({ content: scene })}`);
  await expect(page.locator(".sse-loadingWrap")).toHaveClass(/sse-hidden/, { timeout: 30_000 });
  expect(fetched.sort()).toEqual(["scene.ply:scene", "settings.json:scene"]);
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(violations).toEqual([]);
});

test("renders a compressed scene preview the same as the float scene it packs", async ({ page }) => {
  // The scene preview is PlayCanvas's compressed PLY, so every Gaussian of an Atlas splat fits
  // its size cap. The vendored viewer reads it on its compressed path; it should draw the same
  // ball as the float splat above, without an error or a policy violation.
  const violations = await underProductionPolicy(page);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  let splat = ballSplat();
  await page.route("**/api/website-atlas-preview-views/**", async route => {
    if (route.request().url().includes("/settings.json?")) return route.fulfill({ json: settings });
    return route.fulfill({ body: splat, headers: { "content-type": "application/octet-stream",
      "content-length": String(splat.length), "cache-control": "private, no-store" } });
  });
  const scene = SCENE.replace("scene.ply?", "scene.ply?source=scene&");
  const rendered = async () => {
    await page.goto(`/splat-viewer/index.html?${new URLSearchParams({ content: scene })}`);
    await expect(page.locator(".sse-loadingWrap")).toHaveClass(/sse-hidden/, { timeout: 30_000 });
    await expect(page.getByRole("alert")).toHaveCount(0);
    // The viewer flies its camera from the moment it opens; pressing the start of its timeline
    // pauses it there, so both scenes are drawn from the same place.
    const timeline = await page.locator(".sse-timelineContainer").boundingBox();
    await page.mouse.click(timeline!.x + 1, timeline!.y + timeline!.height / 2);
    await page.waitForTimeout(1_500);
    return PNG.sync.read(await page.screenshot());
  };
  const float = await rendered();
  splat = compressedBallSplat();
  const compressed = await rendered();
  expect(errors).toEqual([]);
  expect(violations).toEqual([]);
  // The ball is drawn (most of the frame is the black background, a good part is not) ...
  const lit = (image: { data: Buffer }) => {
    let count = 0;
    for (let offset = 0; offset < image.data.length; offset += 4)
      if (image.data[offset]! + image.data[offset + 1]! + image.data[offset + 2]! > 60) count += 1;
    return count / (image.data.length / 4);
  };
  expect(lit(compressed)).toBeGreaterThan(0.02);
  // ... and it is the float splat's ball, to within quantization.
  let difference = 0;
  for (let offset = 0; offset < float.data.length; offset += 4)
    for (let channel = 0; channel < 3; channel += 1) difference += Math.abs(float.data[offset + channel]! - compressed.data[offset + channel]!);
  expect(difference / (float.data.length / 4 * 3)).toBeLessThan(1);
  expect(Math.abs(lit(compressed) - lit(float))).toBeLessThan(0.005);
});

for (const first of ["viewer", "scene"] as const) test(`says the preview is being prepared until the viewer takes over (${first} first)`, async ({ page }) => {
  // On a first view the server prepares the scene before any of it arrives, and only the
  // download has a progress bar: the page once stayed blank for that whole wait. A prepared
  // scene can instead answer before the viewer's code has arrived; the status stays until
  // the viewer, with its own progress bar, is up.
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
  if (first === "viewer") releaseViewer();
  else {
    const sceneAnswered = page.waitForResponse(response => response.url().includes("/scene.ply?"));
    releaseScene();
    await sceneAnswered;
  }
  await page.waitForTimeout(500);
  await expect(page.getByRole("status")).toHaveText("Getting your 3D preview ready…");
  releaseViewer();
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
