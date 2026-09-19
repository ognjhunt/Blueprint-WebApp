/**
 * One-shot local walk of the site-operator flow against the dev server.
 *
 * Desktop: intake submit -> capture link -> handoff-first capture page (no camera).
 * Phone:   same link -> in-page camera -> record -> chunked upload -> saved.
 *
 * Run: node scripts/qa/local-flow-check.mjs   (server already listening on :5050)
 */
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.FLOW_BASE_URL || "http://localhost:5050";
const SHOTS = "/tmp/bp-flow-shots";
fs.mkdirSync(SHOTS, { recursive: true });

const notes = [];
const note = (msg) => {
  notes.push(msg);
  console.log(msg);
};
const shot = async (page, name) => {
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false });
  note(`shot:${SHOTS}/${name}.png`);
};

const PHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

async function dismissCookies(page) {
  const reject = page.getByRole("button", { name: "Reject all" });
  try {
    await reject.waitFor({ state: "visible", timeout: 4000 });
    await reject.click();
  } catch {
    /* no banner */
  }
}

let failed = 0;
const check = (ok, msg) => {
  note(`${ok ? "PASS" : "FAIL"} ${msg}`);
  if (!ok) failed += 1;
};

// ---------------------------------------------------------------- desktop
const desktop = await chromium.launch();
try {
  const page = await desktop.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(`${BASE}/contact/site-operator`, { waitUntil: "domcontentloaded" });
  await dismissCookies(page);

  await page.getByRole("textbox", { name: /^Your name/ }).fill("E2E Flow Check");
  await page
    .getByRole("textbox", { name: /^Work email/ })
    .fill(`e2e+flow-${Date.now()}@blueprint.test`);
  await page.getByRole("textbox", { name: /^Site or company/ }).fill("Blueprint Flow Test Co");
  await page
    .getByRole("textbox", { name: /^What is the job\?/ })
    .fill("Move sealed cartons from the conveyor onto a pallet at the end of each shift.");
  await page.getByRole("combobox", { name: /^Where is it\?/ }).fill("Austin, TX");
  await page.keyboard.press("Escape");
  await page.getByRole("checkbox", { name: /I am authorised to record/ }).check();
  await shot(page, "01-desktop-intake-filled");
  await page.getByRole("button", { name: "Start" }).click();

  await page.getByRole("heading", { name: "Film the work area." }).waitFor({ timeout: 20000 });
  await shot(page, "02-desktop-intake-success");
  const link = page.getByRole("link", { name: "Open the camera" });
  check((await link.count()) === 1, "desktop intake returned a capture link");
  const captureUrl = await link.getAttribute("href");
  note(`captureUrl=${captureUrl}`);
  const qr = await page.locator("img[alt*='Scan to record']").count();
  check(qr === 1, "intake success shows the phone QR");

  // The capture page on the same desktop: handoff first, no camera button.
  await page.goto(captureUrl, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "This step happens on your phone." }).waitFor({ timeout: 15000 });
  await shot(page, "03-desktop-capture-page");
  check(
    (await page.getByRole("button", { name: "Open the camera" }).count()) === 0,
    "desktop capture page offers no camera button",
  );
  check(
    (await page.getByRole("button", { name: "Copy the link" }).count()) === 1,
    "desktop capture page offers copy-link",
  );
  check(
    (await page.getByRole("button", { name: "Upload a video file" }).count()) === 1,
    "desktop capture page keeps the file fallback",
  );

  globalThis.__captureUrl = captureUrl;
} finally {
  await desktop.close();
}

const captureUrl = globalThis.__captureUrl;
if (!captureUrl) {
  console.error("No capture URL; aborting phone leg");
  process.exit(1);
}

// ------------------------------------------------------------------ phone
const phone = await chromium.launch({
  args: [
    "--use-fake-device-for-media-stream",
    "--use-fake-ui-for-media-stream",
    "--autoplay-policy=no-user-gesture-required",
  ],
});
try {
  const ctx = await phone.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: PHONE_UA,
    hasTouch: true,
    isMobile: true,
  });
  const page = await ctx.newPage();
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") note(`console:${m.type()}: ${m.text().slice(0, 300)}`);
  });
  page.on("pageerror", (e) => note(`pageerror: ${String(e).slice(0, 300)}`));
  page.on("response", async (r) => {
    const u = r.url();
    const partMatch = /\/parts\/(\d+)/.exec(u);
    if (partMatch) {
      note(`part ${partMatch[1]} -> ${r.status()}`);
    } else if (u.includes("/parts/complete")) {
      note(`complete -> ${r.status()}: ${(await r.text().catch(() => "")).slice(0, 300)}`);
    } else if (u.includes("/api/") && r.status() >= 400) {
      note(`${r.request().method()} ${u.replace(BASE, "")} -> ${r.status()}`);
    }
  });
  page.on("requestfailed", (r) => {
    if (r.url().includes("/api/self-capture")) {
      note(`FAILED ${r.request().method()} ${r.url().replace(BASE, "")}: ${r.failure()?.errorText}`);
    }
  });
  await page.goto(captureUrl, { waitUntil: "domcontentloaded" });

  const mp4 = await page.evaluate(() => {
    const types = [
      'video/mp4;codecs="avc1.42E01E"',
      "video/mp4;codecs=avc1",
      "video/mp4",
    ];
    return types.find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || null;
  });
  note(`browser mp4 record support: ${mp4 || "none"}`);

  await page.getByRole("button", { name: "Open the camera" }).click();
  try {
    await page.getByRole("button", { name: "Start recording" }).waitFor({ timeout: 15_000 });
  } catch {
    const state = await page.evaluate(() => ({
      text: document.body.innerText.slice(0, 1200),
      gUM: typeof navigator.mediaDevices?.getUserMedia,
    }));
    note(`post-click state: ${JSON.stringify(state)}`);
    await shot(page, "04b-phone-after-camera-click");
    throw new Error("camera did not reach ready");
  }
  // A live preview element with a stream attached. The fake device can take a
  // moment to present its first frame, so poll briefly rather than sample once.
  const previewOk = await page
    .waitForFunction(
      () => {
        const v = document.querySelector("video");
        return Boolean(v && v.srcObject && v.videoWidth > 0);
      },
      { timeout: 8_000 },
    )
    .then(() => true)
    .catch(() => false);
  check(previewOk, "camera preview is live (srcObject, frames flowing)");
  await shot(page, "05-phone-camera-open");

  await page.getByRole("button", { name: "Start recording" }).click();
  await page.getByRole("button", { name: "Finish" }).waitFor({ timeout: 10000 });
  await page.waitForTimeout(9_000); // at least two 4s parts
  await shot(page, "06-phone-recording");
  const pieces = await page
    .getByText(/piece?s? saved so far/)
    .first()
    .innerText()
    .catch(() => "");
  note(`recording status line: ${pieces.trim()}`);

  await page.getByRole("button", { name: "Finish" }).click();
  try {
    await page
      .locator("h2, p[role=alert]")
      .filter({ hasText: /^Saved|Saved, and we are checking|connection dropped|did not save|could not/i })
      .first()
      .waitFor({ timeout: 90_000 });
  } catch {
    const state = await page.evaluate(() => document.body.innerText.slice(0, 1500));
    note(`no terminal state; page text: ${state}`);
    await shot(page, "07b-phone-stuck");
  }
  await shot(page, "07-phone-saved");
  const terminal = await page.evaluate(() => document.body.innerText);
  // The parts bucket cannot be written with the dev project's billing off, so
  // locally the honest terminal state is the failed-and-retryable one. What
  // must never happen is a silent hang or a fake "saved".
  const saved = /^Saved\./m.test(terminal) || /Your capture is saved/.test(terminal);
  const retryable = /connection dropped|resume/i.test(terminal);
  check(saved || retryable, "phone recording reached an honest terminal state");
  note(`terminal state: ${saved ? "saved" : retryable ? "retryable (storage unavailable locally)" : "UNKNOWN"}`);

  // Server-side truth: the signed link should no longer be a blank record.
  const state = await page.evaluate(async (url) => {
    const r = await fetch(url, { credentials: "include" });
    return { status: r.status, body: await r.text() };
  }, `${captureUrl}`);
  note(`link GET after upload -> ${state.status}: ${state.body.slice(0, 300)}`);
} finally {
  await phone.close();
}

note(failed === 0 ? "ALL CHECKS PASSED" : `${failed} CHECK(S) FAILED`);
fs.writeFileSync(
  "/tmp/bp-flow-report.json",
  JSON.stringify({ base: BASE, captureUrl, failed, notes }, null, 2),
);
process.exit(failed === 0 ? 0 : 2);
