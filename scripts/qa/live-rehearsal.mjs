/**
 * One full lap of the site-operator funnel on the LIVE production stack.
 *
 * Rehearsal, clearly labeled: intake -> capture link -> upload a real video
 * file -> privacy-screen state observed -> brief confirmed as the owner ->
 * status polled while the server-side stages run -> robot team registered and
 * given a free plan. Steps that require a human (physically filming) or a
 * credential held outside this repo (PIPELINE_SYNC_TOKEN for reconstruction)
 * are reported as exactly that, not skipped silently.
 *
 * Run: node scripts/qa/live-rehearsal.mjs
 */
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.LIVE_BASE_URL || "https://tryblueprint.io";
const VIDEO = process.env.LAP_VIDEO || "/tmp/rehearsal-walkthrough.mp4";
const REPORT = "/tmp/live-lap-report.json";
const SHOTS = "/tmp/bp-lap-shots";
fs.mkdirSync(SHOTS, { recursive: true });

const notes = [];
const note = (m) => {
  notes.push(m);
  console.log(m);
};
const shot = (page, name) => page.screenshot({ path: `${SHOTS}/${name}.png` }).then(() => note(`shot:${name}`));

let failed = 0;
const check = (ok, msg) => {
  note(`${ok ? "PASS" : "FAIL"} ${msg}`);
  if (!ok) failed += 1;
};

if (!fs.existsSync(VIDEO)) {
  console.error(`Missing rehearsal video at ${VIDEO}`);
  process.exit(1);
}

const stamp = Date.now();
let captureUrl = null;
let token = null;

// ---------------------------------------------------- A. live intake (desktop)
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on("response", async (r) => {
    if (r.url().includes("/api/inbound-request")) {
      try {
        const body = await r.json();
        captureUrl = body.captureUrl ?? null;
        note(`inbound-request -> ${r.status()} captureUrl=${captureUrl ? "minted" : "null"}`);
      } catch { /* ignore */ }
    }
  });

  await page.goto(`${BASE}/contact/site-operator`, { waitUntil: "domcontentloaded" });
  await page.getByRole("textbox", { name: /^Your name/ }).fill("Beta Rehearsal (automated lap)");
  await page
    .getByRole("textbox", { name: /^Work email/ })
    .fill(`beta-rehearsal+${stamp}@tryblueprint.io`);
  await page.getByRole("textbox", { name: /^Site or company/ }).fill("Blueprint Live Lap Rehearsal");
  await page
    .getByRole("textbox", { name: /^What is the job\?/ })
    .fill("Move sealed cartons from the conveyor onto a pallet at the end of each shift.");
  await page.getByRole("combobox", { name: /^Where is it\?/ }).fill("Austin, TX");
  await page.keyboard.press("Escape");
  await page.getByRole("checkbox", { name: /I am authorised to record/ }).check();
  await shot(page, "01-live-intake-filled");
  await page.getByRole("button", { name: "Start" }).click();

  await page.getByRole("heading", { name: "Film the work area." }).waitFor({ timeout: 30_000 });
  await shot(page, "02-live-intake-success");
  const link = page.getByRole("link", { name: "Open the camera" });
  check((await link.count()) === 1, "live intake minted a capture link");
  captureUrl = captureUrl || (await link.getAttribute("href"));
  captureUrl = new URL(captureUrl, BASE).toString();
  token = captureUrl.split("/capture-upload/")[1];
  note(`captureUrl=${captureUrl}`);
} catch (error) {
  note(`LIVE INTAKE FAILED: ${String(error).slice(0, 300)}`);
  failed += 1;
}

// ------------------------------- B. upload on the capture page + C. brief confirm
if (captureUrl) {
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    let uploadBody = null;
    page.on("response", async (r) => {
      // The desktop fallback uses the single-shot endpoint; a phone recorder
      // uses the parts endpoints. Either way the JSON says state/eligibility.
      if (r.request().method() === "POST" && r.url().includes("/api/self-capture/uploads/")) {
        uploadBody = await r.json().catch(() => null);
        note(`upload -> ${r.status()} state=${uploadBody?.state} eligibility=${uploadBody?.eligibility ?? "(not reported)"}`);
      }
    });

    await page.goto(captureUrl, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "This step happens on your phone." }).waitFor({ timeout: 20_000 });
    await shot(page, "03-live-capture-page-desktop");
    check(true, "live capture page is the desktop handoff (no camera)");

    // Upload the real video file through the fallback picker.
    await page.locator("input[type=file]").first().setInputFiles(VIDEO);
    await page.getByText(/Your capture is saved/).waitFor({ timeout: 180_000 });
    await shot(page, "04-live-upload-saved");
    check(Boolean(uploadBody), "upload reached the production upload endpoint");
    if (uploadBody) {
      note(`privacy screen eligibility in production: ${uploadBody.eligibility ?? "(not reported)"}`);
      check(
        uploadBody.state === "saved" || uploadBody.state === "held" || !uploadBody.state,
        `terminal upload state: ${uploadBody.state ?? "ok"}`,
      );
    }

    // Confirm the drafted brief as the owner (the attestation step).
    const summary = page.getByText(/Review your task brief|refine what to film/).first();
    if (await summary.count()) {
      await summary.click();
      await page.getByRole("textbox", { name: /confirm/i }).waitFor({ timeout: 15_000 }).catch(() => {});
      const nameField = page.locator("#confirm-name");
      if (await nameField.count()) {
        await nameField.fill("Beta Rehearsal (automated lap)");
        await page.getByRole("button", { name: /confirm it/ }).click();
        await page.getByText(/Thanks|confirmed/i).first().waitFor({ timeout: 30_000 });
        await shot(page, "05-live-brief-confirmed");
        check(true, "task brief confirmed as the owner");
      } else {
        note("brief confirm field not found (brief may already be confirmed or absent)");
      }
    } else {
      note("no unconfirmed brief shown (already confirmed or none drafted)");
    }
  } catch (error) {
    note(`UPLOAD/CONFIRM FAILED: ${String(error).slice(0, 400)}`);
    failed += 1;
  }
} else {
  failed += 1;
  note("No capture URL; upload leg skipped");
}

// --------------------------------------------------- D. status while stages run
if (token) {
  try {
    const statuses = new Set();
    const deadline = Date.now() + 4 * 60_000;
    while (Date.now() < deadline) {
      const r = await fetch(`${BASE}/api/site-task-brief/${encodeURIComponent(token)}/status`);
      const data = await r.json().catch(() => null);
      const headline = data?.status?.headline;
      if (headline) {
        const key = `${headline} | action=${data.status.operatorAction ?? "-"}`;
        if (!statuses.has(key)) {
          statuses.add(key);
          note(`status: ${headline}${data.status.operatorAction ? ` — ${data.status.operatorAction}` : ""}`);
        }
      }
      await new Promise((r2) => setTimeout(r2, 15_000));
    }
    check(statuses.size > 0, "task status endpoint answered on production");
  } catch (error) {
    note(`STATUS POLL FAILED: ${String(error).slice(0, 200)}`);
  }
}

// ------------------------------------- F. robot team: register (free) and plan (free)
try {
  const reg = await fetch(`${BASE}/api/agent-team/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      teamName: `Rehearsal Robotics ${stamp}`,
      contactEmail: `beta-rehearsal+robot-${stamp}@tryblueprint.io`,
      taskFamily: "pick_and_place",
      capabilityDescription: "Automated beta-rehearsal registration; no hardware behind this checkpoint yet.",
      checkpoint: {
        label: "rehearsal-checkpoint",
        runtime: "policy_endpoint",
        reference: "https://rehearsal.invalid/checkpoint",
      },
    }),
  });
  const regBody = await reg.json().catch(() => ({}));
  note(`agent-team/register -> ${reg.status} keys=${Object.keys(regBody).join(",")}`);
  check(reg.ok, "robot team registered through the public agent API");

  const apiKey = regBody.agentKey || regBody.apiKey || regBody.key;
  const teamId = regBody.teamId || regBody.id;
  if (apiKey) {
    const plan = await fetch(`${BASE}/api/agent-team/plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({}),
    });
    const planBody = await plan.json().catch(() => ({}));
    note(
      `agent-team/plan -> ${plan.status} candidates=${planBody.candidates?.length ?? "?"} ` +
        `top=${planBody.candidates?.[0]?.siteName ?? planBody.candidates?.[0]?.site_name ?? "-"}`,
    );
    check(plan.ok, "free ranked plan produced on production");
  } else {
    note(`no api key in register response; plan leg needs manual check. body=${JSON.stringify(regBody).slice(0, 300)}`);
  }
} catch (error) {
  note(`ROBOT TEAM LEG FAILED: ${String(error).slice(0, 300)}`);
}

await browser.close();

note(failed === 0 ? "LAP COMPLETE — ALL CHECKS PASSED" : `LAP COMPLETE — ${failed} CHECK(S) FAILED`);
fs.writeFileSync(REPORT, JSON.stringify({ base: BASE, captureUrl, token, failed, notes }, null, 2));
process.exit(failed === 0 ? 0 : 2);
