/**
 * Follow-up legs of the live lap, against the capture created in the first run.
 * Brief confirmation (owner attestation) -> status polling -> robot team
 * register + free plan.
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

// Robot team: register (free) and plan (free).
try {
  const stamp = Date.now();
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
  note(reg.ok ? "PASS robot team registered through the public agent API" : "FAIL robot team registration");

  const apiKey = regBody.agentKey;
  if (apiKey) {
    const plan = await fetch(`${BASE}/api/agent-team/plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ checkpointId: "rehearsal-checkpoint" }),
    });
    const planBody = await plan.json().catch(() => ({}));
    const candidates = planBody.candidates ?? planBody.plan?.candidates ?? [];
    note(
      `agent-team/plan -> ${plan.status} candidates=${candidates.length} ` +
        `top=${candidates[0]?.siteName ?? candidates[0]?.site_name ?? "-"}`,
    );
    note(plan.ok ? "PASS free ranked plan produced on production" : "FAIL plan");
  } else {
    note(`no agentKey in register response: ${JSON.stringify(regBody).slice(0, 300)}`);
  }
} catch (error) {
  note(`ROBOT LEG FAILED: ${String(error).slice(0, 300)}`);
}

fs.writeFileSync("/tmp/live-lap-followup.json", JSON.stringify(notes, null, 2));
console.log("FOLLOW-UP DONE");
