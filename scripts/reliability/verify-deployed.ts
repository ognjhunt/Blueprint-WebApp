/** Non-destructive presentation/reload smoke. Never submits a production intake. */
import { chromium } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, chmod } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
const origin = "https://tryblueprint.io";
const args = process.argv.slice(2);
function option(name: string, fallback = "") {
  const index = args.indexOf(name); return index < 0 ? fallback : args[index + 1] || "";
}
const expectedSha = option("--expected-sha");
const mode = option("--mode", "candidate");
const verifyClear = args.includes("--verify-clear");
if (!/^[a-f0-9]{40}$/.test(expectedSha) || !["baseline", "candidate"].includes(mode)) {
  throw new Error("Usage: npx tsx scripts/reliability/verify-deployed.ts --expected-sha <40-char SHA> --mode baseline|candidate [--output <ignored folder>]");
}
const output = path.resolve(option("--output", `output/reliability-program/deployed-${mode}`));
const digest = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
const report: Record<string, any> = {
  schema: "blueprint.reliability.deployed-presentation.v3", selector_contract: "address-region-and-explicit-start.v1",
  contract_correction: { prior: "v2 visible country text and unchecked recording checkbox", obsolete_assertions: ["Country: United States.", "#start-rights unchecked"], invariant: "Address-derived region survives return; no frozen submission/recording grant before explicit Start; durable clear is acknowledged and survives return.", limitation: "No upload consent or backend authority proof; missing checkbox is never reported as unchecked." }, started_at: new Date().toISOString(),
  origin, expected_sha: expectedSha, mode, script_sha256: digest(await readFile(fileURLToPath(import.meta.url))),
  source_checkout_sha: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", shell: false }).trim(),
  layer: "production-ui/local-draft-only", providers: "no paid provider dispatch", notifications: "no send",
  mutation_policy: "All non-GET/HEAD requests and all external requests are aborted in a fresh browser context. No submit click, account login or uploaded evidence.",
  probes: [], blocked_requests: { mutations: 0, external: 0, attempted_intake_mutations: 0 }, checks: {}, artifacts: [],
};
await mkdir(output, { recursive: true, mode: 0o700 });
async function getPublicMetadata(endpoint: string) {
  const started = Date.now();
  try {
    const response = await fetch(`${origin}${endpoint}`, { method: "GET", redirect: "error", signal: AbortSignal.timeout(20000), headers: { "Cache-Control": "no-cache" } });
    const raw = await response.text();
    let parsed: Record<string, unknown> = {}; if (raw.length <= 32768) { try { parsed = JSON.parse(raw); } catch {} }
    const metadata = Object.fromEntries(["git_sha", "built_at_iso", "status", "blocker_count", "timestamp"].filter(key => key in parsed).map(key => [key, parsed[key]]));
    const probe = { endpoint, http_status: response.status, elapsed_ms: Date.now() - started, response_sha256: digest(raw), metadata };
    report.probes.push(probe); return probe;
  } catch {
    const probe = { endpoint, http_status: null, elapsed_ms: Date.now() - started, error_code: "public_get_failed" };
    report.probes.push(probe); return probe;
  }
}
let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
let stage = "public_metadata";
try {
  const before = await getPublicMetadata("/version.json");
  report.serving_sha_before = "metadata" in before ? before.metadata.git_sha ?? null : null;
  report.checks.identity_before = report.serving_sha_before === expectedSha;
  const health = await getPublicMetadata("/health");
  const ready = await getPublicMetadata("/health/ready");
  report.checks.health = health.http_status === 200;
  report.checks.ready = ready.http_status === 200;
  if (!report.checks.identity_before) {
    report.blocker = "expected_serving_sha_mismatch";
  } else {
    stage = "browser_launch";
    browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {});
    const context = await browser.newContext({ viewport: { width: 1280, height: 1000 }, serviceWorkers: "block", acceptDownloads: false });
    await context.route("**/*", route => {
      const request = route.request(); const url = new URL(request.url());
      if (!["GET", "HEAD"].includes(request.method())) {
        report.blocked_requests.mutations++;
        if (url.origin === origin && ["/api/inbound-request", "/api/workspace/capture-start"].includes(url.pathname)) report.blocked_requests.attempted_intake_mutations++;
        return route.abort("blockedbyclient");
      }
      if (url.origin !== origin) { report.blocked_requests.external++; return route.abort("blockedbyclient"); }
      return route.continue();
    });
    const page = await context.newPage(); page.setDefaultTimeout(20000);
    stage = "ordinary_form_load";
    await page.goto(`${origin}/contact/site-operator`, { waitUntil: "domcontentloaded", timeout: 45000 });
    const mirrors = () => page.evaluate(async () => {
        const key = "bp-site-capture:v1:anonymous:default";
        // Drain preceding scoped autosaves before comparing the two mirrors.
        return navigator.locks.request(key, async () => {
        const raw = localStorage.getItem(key);
        const local = raw ? JSON.parse(raw) : null;
        const durable = await new Promise<any>((resolve, reject) => {
          const request = indexedDB.open("blueprint-site-capture-recovery-v1", 1);
          request.onerror = () => reject(request.error);
          request.onupgradeneeded = () => { request.transaction!.abort(); reject(new Error("Expected existing recovery database")); };
          request.onsuccess = () => {
            const db = request.result, tx = db.transaction("recovery", "readonly"), read = tx.objectStore("recovery").get(key);
            let value: any;
            read.onsuccess = () => { value = read.result; };
            read.onerror = () => reject(read.error);
            tx.oncomplete = () => { db.close(); resolve(value); };
            tx.onabort = () => { db.close(); reject(tx.error); };
          };
        });
        return { local, durable };
        });
      });
    const noFrozenSubmission = (rows: any) => Boolean(rows.local && rows.durable?.retired === false
      && rows.local.pending === null && rows.durable.value?.pending === null);
    const noRecordingGrant = (rows: any) => noFrozenSubmission(rows) && [rows.local, rows.durable.value].every(value =>
      value.consentAttestation?.granted !== true && value.consent_attestation?.granted !== true
      && value.draft?.consentAttestation?.granted !== true && value.draft?.consent_attestation?.granted !== true);
    stage = "draft_fill";
    const fields = { "#start-task": "Move sealed cartons for a reliability smoke", "#start-location": "Austin, TX", "#start-email": "reliability-fixture@example.test", "#start-company": "Reliability smoke fixture" };
    for (const [selector, value] of Object.entries(fields)) await page.locator(selector).fill(value);
    report.checks.ordinary_form_loaded = true;
    stage = "country_before";
    const drafted = await mirrors();
    report.checks.country_inferred_before = drafted.local?.draft?.region === "us" && drafted.durable?.value?.draft?.region === "us";
    // No Start or recovery submission is sent. Optional Clear operates only
    // on this newly created anonymous browser context's synthetic local draft.
    stage = "draft_reload";
    await page.reload({ waitUntil: "domcontentloaded", timeout: 45000 });
    stage = "draft_return_fields";
    report.reload_fields = {};
    for (const [selector, expected] of Object.entries(fields)) {
      const actual = await page.locator(selector).inputValue();
      report.reload_fields[selector] = { restored: actual === expected, observed: actual === expected ? "retained_expected_fixture" : actual === "" ? "empty" : "different" };
    }
    report.checks.draft_restored = Object.values(report.reload_fields).every((field: any) => field.restored);
    stage = "pre_start_authority";
    const restored = await mirrors();
    report.checks.country_inferred_after = restored.local?.draft?.region === "us" && restored.durable?.value?.draft?.region === "us";
    report.recording_checkbox = { count: await page.locator("#start-rights").count(), unchecked: null, reason: "Current product uses explicit Start; recording permission is granted only when submitting footage. This probe sends no submission." };
    const agreement = page.locator(".ms-form-note").filter({ hasText: "By selecting Start free assessment" });
    report.checks.explicit_start_agreement_visible = await agreement.isVisible()
      && await agreement.getByRole("link", { name: "Terms", exact: true }).isVisible()
      && await agreement.getByRole("link", { name: "Privacy Policy", exact: true }).isVisible()
      && await page.getByRole("button", { name: "Start free assessment", exact: true }).isVisible();
    report.checks.current_consent_surface_matches = report.recording_checkbox.count === 0;
    report.checks.no_frozen_submission_before_start = noFrozenSubmission(drafted) && noFrozenSubmission(restored);
    report.checks.no_recording_grant_before_start = noRecordingGrant(drafted) && noRecordingGrant(restored);
    report.checks.recovery_eligibility_copy = await page.getByText("You can recover this draft here for up to seven days.", { exact: false }).isVisible();
    stage = "draft_screenshot";
    const screenshot = path.join(output, "draft-after-reload.png");
    await page.screenshot({ path: screenshot, fullPage: true });
    await chmod(screenshot, 0o600);
    report.artifacts.push({ path: "draft-after-reload.png", sha256: digest(await readFile(screenshot)), format: "PNG", contains: "public page and synthetic local draft only" });
    if (verifyClear) {
      stage = "clear_before";
      const original = await mirrors();
      stage = "clear_commit";
      await page.getByRole("button", { name: "Clear this browser's draft", exact: true }).click();
      await page.getByRole("status").filter({ hasText: "This browser's draft has been cleared." }).waitFor({ state: "visible" });
      stage = "clear_verify";
      const committed = await mirrors();
      report.checks.clear_acknowledged = true;
      report.checks.clear_stores_agree = Boolean(committed.local && committed.durable?.retired === false
        && JSON.stringify(committed.durable.value) === JSON.stringify(committed.local));
      report.checks.clear_fresh_identity = Boolean(original.local?.requestId && committed.local?.requestId
        && original.local.requestId !== committed.local.requestId);
      report.checks.clear_empty_draft = Boolean(committed.local?.pending === null
        && ["task", "location", "email", "company"].every(field => committed.local?.draft?.[field] === ""));
      stage = "clear_return";
      await page.reload({ waitUntil: "domcontentloaded", timeout: 45000 });
      await page.locator("#start-task").waitFor({ state: "visible" });
      report.checks.clear_return_empty = (await Promise.all(Object.keys(fields).map(selector => page.locator(selector).inputValue()))).every(value => value === "");
      const returned = await mirrors();
      report.checks.clear_return_no_frozen_submission = noFrozenSubmission(returned);
      report.checks.clear_return_no_recording_grant = noRecordingGrant(returned);
      report.checks.clear_return_identity_retained = Boolean(committed.local?.requestId && returned.local?.requestId === committed.local.requestId
        && returned.durable?.retired === false && JSON.stringify(returned.durable.value) === JSON.stringify(returned.local));
      report.checks.clear_no_intake_mutation = report.blocked_requests.attempted_intake_mutations === 0;
      report.clear_acknowledgment_passed = ["clear_acknowledged", "clear_stores_agree", "clear_fresh_identity", "clear_empty_draft", "clear_return_empty",
        "clear_return_no_frozen_submission", "clear_return_no_recording_grant", "clear_return_identity_retained", "clear_no_intake_mutation"].every(key => report.checks[key] === true);
    }
    // Erase only this isolated context's local synthetic draft. Clearing local
    // storage via evaluate performs no network request and affects no user session.
    stage = "isolated_context_cleanup";
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    report.local_context_cleaned = true; await context.close();
    stage = "identity_after";
    const after = await getPublicMetadata("/version.json");
    report.serving_sha_after = "metadata" in after ? after.metadata.git_sha ?? null : null;
    report.checks.identity_after = report.serving_sha_after === expectedSha;
  }
} catch (error) {
  report.blocker = "presentation_probe_incomplete";
  report.failure = { stage, error_class: error instanceof Error && error.name === "TimeoutError" ? "timeout"
    : error instanceof SyntaxError ? "invalid_local_json" : error instanceof TypeError ? "type_error" : "probe_error" };
} finally {
  if (browser) await browser.close();
  report.completed_at = new Date().toISOString();
  const identityPassed = report.checks.identity_before && report.checks.identity_after;
  const presentationPassed = identityPassed && report.checks.health && report.checks.ready && report.checks.ordinary_form_loaded
    && report.checks.draft_restored && report.checks.country_inferred_before && report.checks.country_inferred_after
    && report.checks.explicit_start_agreement_visible && report.checks.current_consent_surface_matches && report.checks.no_frozen_submission_before_start && report.checks.no_recording_grant_before_start && report.checks.recovery_eligibility_copy
    && (!verifyClear || report.clear_acknowledgment_passed);
  report.candidate_presentation_passed = Boolean(presentationPassed);
  report.outcome = report.blocker ? "blocked" : presentationPassed ? "presentation_passed" : "presentation_failed";
  report.claim_ceiling = "Serving identity, health/ready and non-destructive local draft return" + (verifyClear ? ", durable local clear acknowledgment and empty return" : "")
    + " only; no backend job, upload durability, assessment, worker or notification result proven.";
  await writeFile(path.join(output, "result.json"), `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify({ outcome: report.outcome, mode, serving_sha: report.serving_sha_before ?? null, expected_sha: expectedSha, draft_restored: report.checks.draft_restored ?? null, candidate_presentation_passed: report.candidate_presentation_passed, result: path.join(output, "result.json") }));
  // Baseline reports expected defects without pretending the candidate gate is
  // green. Identity/readiness/incomplete-probe failure remains nonzero in either mode.
  if (report.blocker || !identityPassed || !report.checks.health || !report.checks.ready || (mode === "candidate" && !presentationPassed)) process.exitCode = 1;
}
