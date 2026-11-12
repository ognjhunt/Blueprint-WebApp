/**
 * Follow-up legs of the live lap, against the capture created in the first run.
 * Brief confirmation (owner attestation). (The robot-team leg, through the
 * agent API, was removed with that API on 2026-11-12.)
 */
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.LIVE_BASE_URL || "https://tryblueprint.io";
const report = JSON.parse(fs.readFileSync("/tmp/live-lap-report.json", "utf8"));
const captureUrl = report.captureUrl;
const notes = [];
const note = (m) => {
  notes.push(m);
  console.log(m);
};

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(captureUrl, { waitUntil: "domcontentloaded" });

  // The brief section only renders for an owner link with an unconfirmed brief.
  const summary = page.getByText(/Review your task brief|refine what to film/).first();
  await summary.waitFor({ timeout: 20_000 });
  await summary.click();

  await page.locator("#confirm-name").waitFor({ timeout: 15_000 });
  await page.locator("#confirm-name").fill("Beta Rehearsal (automated lap)");
  await page.getByRole("button", { name: /confirm it/i }).click();
  await page
    .getByText(/Thanks|confirmed|qualified/i)
    .first()
    .waitFor({ timeout: 45_000 });
  await page.screenshot({ path: "/tmp/bp-lap-shots/06-live-brief-confirmed.png" });
  note("PASS brief confirmed as the owner on production");
} catch (error) {
  note(`BRIEF CONFIRM FAILED: ${String(error).slice(0, 400)}`);
}
await browser.close();

fs.writeFileSync("/tmp/live-lap-followup.json", JSON.stringify(notes, null, 2));
console.log("FOLLOW-UP DONE");
