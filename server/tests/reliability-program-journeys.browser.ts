// Explicit opt-in browser/real-handler harness. Disposable file-backed storage
// fakes, fake model outcomes/local notification sink; no production credentials.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";
import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { chromium, type BrowserContext, type Page } from "@playwright/test";
import { state, resetStorage, reloadDocuments, reloadObjects, faults, durableSummary, database, emulatorMode, refreshDocumentView, clearEmulator, releaseVideoWrites } from "./helpers/reliability-local-storage";

const providers = vi.hoisted(() => ({ privacy: "cleared", calls: 0, errors: [] as string[], sent: [] as {to: string; subject: string}[] }));
vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const local = await import("./helpers/reliability-local-storage");
  return { default: { firestore: { FieldValue: local.fieldValue } }, dbAdmin: local.database, storageAdmin: { bucket: () => local.bucket }, authAdmin: null };
});
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn((meta, message) => providers.errors.push(String(message ?? meta) + ":" + String(meta?.error?.message ?? ""))), debug: vi.fn() } }));
vi.mock("../utils/email", () => ({ sendEmail: vi.fn(async (params: { to: string; subject: string }) => {
  if (typeof params.to !== "string" || !params.to.includes("@")) throw new Error("fixture_invalid_recipient");
  providers.sent.push({to: params.to, subject: params.subject}); return { sent: true, provider: "local_sink", messageId: `fixture-${providers.sent.length}` };
}) }));
vi.mock("../utils/slack", () => ({ notifySlackInboundRequest: vi.fn(async () => false),
  notifySlackFootageNeedsReview: vi.fn(async () => false), notifySlackScreeningCallNeeded: vi.fn(async () => false) }));
vi.mock("../utils/growth-events", () => ({ logGrowthEvent: vi.fn(async () => ({ ok: true, persisted: false })) }));
vi.mock("../utils/rate-limit-redis", () => ({ getRateLimitRedisClient: () => null }));
vi.mock("../utils/lifecycle-cadence", () => ({ createLifecycleCadenceForInboundRequest: vi.fn(async () => null) }));
vi.mock("../utils/highIntentLeadEnrichment", () => ({ runHighIntentLeadEnrichmentForRequest: vi.fn(async () => null) }));
vi.mock("../agents", () => ({ runInboundQualificationForRequest: vi.fn(async () => null) }));
vi.mock("../agents/private-evidence", () => ({ hydrateAgentEvidence: vi.fn(async value => value) }));
vi.mock("../agents/runtime", () => ({ runAgentTask: vi.fn(async () => { providers.calls++; return { status: "completed", output: {
  covers_scene: false, missing_views: ["The generated test pattern contains no work area"], supplement_would_finish: false,
  unreadable_reasons: ["Synthetic transport fixture"], confidence: 1, views: [{ id: "work-area", status: "not_seen", timestamp_seconds: null, note: "Synthetic pattern contains no work area" }],
} }; }) }));
vi.mock("../utils/capturePrivacyScreen", () => ({ screenCaptureForPrivacy: vi.fn(async () => ({
  proceed: providers.privacy === "cleared", outcome: providers.privacy, eligibility: providers.privacy === "unknown" ? "pending" : "eligible",
  detail: providers.privacy === "cleared" ? null : "Local privacy review held this fixture", retryable: providers.privacy === "unknown", evidence: null,
})) }));

const base = "http://127.0.0.1:42878";
const output = path.resolve("output/reliability-program/journeys");
const runId = `journeys-${new Date().toISOString().replace(/[^0-9TZ]/g, "")}`;
const retained = path.join(output, "runs", runId);
const fixture = path.resolve("output/reliability-program/journeys-fixture.mp4");
const cases = [
  ["UI-001", "phone_desktop"], ["UI-002", "phone_mobile"], ["UI-003", "visit_us"], ["UI-004", "visit_non_us"],
  ["UI-005", "phone_non_us"], ["UI-006", "upload_clear_desktop"], ["UI-007", "upload_clear_mobile"],
  ["UI-008", "upload_privacy_held"], ["UI-009", "upload_privacy_unknown"], ["UI-010", "upload_manifest_retry"],
  ["UI-011", "upload_storage_unavailable"], ["UI-012", "missing_email"], ["UI-013", "unknown_country"],
  ["UI-014", "missing_task"], ["UI-015", "invalid_video_extension"], ["UI-016", "double_click"],
  ["UI-017", "slow_create"], ["UI-018", "create_error_body"], ["UI-019", "lost_response_reload"],
  ["UI-020", "browser_termination_upload_return"], ["UI-021", "forced_termination_email_return_worker_restart"],
] as const;
const traces: Record<string, unknown>[] = [];
let server: Server, vite: ChildProcess;
let activeCase = "", createError = false, loseReply = false, createDelay = 0;
const requests: { method: string; route: string; status: number }[] = [];
let context: BrowserContext, page: Page;

let chrome: ChildProcess | undefined;
async function stopBrowser(signal: NodeJS.Signals = "SIGTERM") {
  if (chrome && chrome.exitCode === null && chrome.signalCode === null) {
    const stopped = new Promise<void>(resolve => chrome!.once("exit", () => resolve()));
    if (signal === "SIGTERM" && context?.browser()) {
      const session = await context.browser()!.newBrowserCDPSession();
      await session.send("Browser.close").catch(() => chrome?.kill("SIGTERM"));
    } else chrome.kill(signal);
    await stopped;
  }
  await context?.browser()?.close().catch(() => undefined);
}
async function openBrowser(mobile = false) {
  const profile = path.join(output, "profile");
  fs.mkdirSync(profile, {recursive: true});
  const portFile = path.join(profile, "DevToolsActivePort");
  fs.rmSync(portFile, {force: true});
  chrome = spawn(chromium.executablePath(), ["--headless=new", "--no-sandbox", "--disable-gpu", "--remote-debugging-port=0",
    `--user-data-dir=${profile}`, "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1"], {stdio: "ignore"});
  await vi.waitFor(() => expect(fs.existsSync(portFile)).toBe(true), {timeout: 15_000});
  const port = Number(fs.readFileSync(portFile, "utf8").split("\n")[0]);
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  context = browser.contexts()[0];
  await context.route("**/*", route => new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort());
  page = await context.newPage();
  await page.setViewportSize({width: mobile ? 390 : 1440, height: 900});
  if (mobile) {
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setUserAgentOverride", {userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1", platform: "iPhone"});
    await cdp.send("Emulation.setTouchEmulationEnabled", {enabled: true});
  }
}
async function runFreshWorker(stage: string) {
  const receiptPath = path.join(output, `${activeCase}-${stage}-worker.json`);
  const log = fs.openSync(path.join(output, `${activeCase}-${stage}-worker.log`), "w");
  const env: Record<string,string> = {};
  for (const key of ["PATH", "HOME", "TMPDIR"]) if(process.env[key]) env[key] = process.env[key]!;
  Object.assign(env, {NODE_ENV: "test", BLUEPRINT_DISABLE_LOCAL_ENV_BOOTSTRAP: "true", RELIABILITY_FIRESTORE_EMULATOR: "1",
    FIRESTORE_EMULATOR_HOST: "127.0.0.1:8085", RELIABILITY_WORKER_ONLY: "1", RELIABILITY_WORKER_RECEIPT: receiptPath});
  const child = spawn(process.execPath, ["node_modules/vitest/vitest.mjs", "run", "--config", "vitest.reliability-program.config.ts"], {env, stdio:["ignore", log, log]});
  const code = await new Promise<number|null>(resolve => child.once("exit", resolve));
  fs.closeSync(log); expect(code).toBe(0); return JSON.parse(fs.readFileSync(receiptPath,"utf8"));
}
async function fill(kind: string) {
  await page.goto(`${base}/contact/site-operator`);
  await page.locator("#start-task").fill(kind === "missing_task" ? "" : "Inspect a synthetic test pattern. No robot capability is asserted.");
  await page.locator("#start-location").fill(kind.includes("non_us") ? "Toronto, Canada" : kind === "unknown_country" ? "Unknown location" : "Austin, TX");
  await page.locator("#start-email").fill(kind === "missing_email" ? "" : `${activeCase.toLowerCase()}@example.com`);
  await page.locator("#start-company").fill("Synthetic reliability fixture");
  if (kind !== "unknown_country" && await page.locator("#start-region").count()) {
    await page.locator("#start-region").selectOption(kind.includes("non_us") ? "non_us" : "us");
  }
  if (kind.startsWith("visit")) await page.locator("#start-method-visit").check();
  if (kind.startsWith("upload") || (kind === "browser_termination_upload_return" || kind === "forced_termination_email_return_worker_restart") || kind === "invalid_video_extension") {
    await page.locator("#start-method-upload").check();
    if (kind === "invalid_video_extension") await page.locator("#start-footage").setInputFiles({ name: "bad.txt", mimeType: "text/plain", buffer: Buffer.from("invalid") });
    else await page.locator("#start-footage").setInputFiles(fixture);
    await page.locator("#start-rights").check();
  }
}
function requestRows() { return [...state.docs.entries()].filter(([key]) => key.startsWith("inboundRequests/")); }

beforeAll(async () => {
  fs.mkdirSync(retained, { recursive: true });
  // v2 frozen definitions: production wiring and fixture faults corrected before scoring.
  // Forced-kill automatic local draft loss is retained as a separate diagnostic;
  // UI020 scores orderly shutdown; UI021 scores real killed-browser email recovery.
  const sourcePaths = ["client/src/components/site/SiteCaptureStart.tsx", "client/src/lib/siteCaptureDraft.ts",
    "server/routes/inbound-request.ts", "server/routes/self-capture-uploads.ts", "server/routes/site-task-brief.ts",
    "server/utils/captureCoverageQueue.ts", "server/utils/captureCoverageReview.ts", "server/utils/captureReviewRecovery.ts", "server/utils/captureParts.ts", "server/utils/field-encryption.ts", "server/utils/captureOutbox.ts", "server/agents/tasks/capture-coverage.ts",
    "server/tests/helpers/reliability-local-storage.ts", "server/tests/reliability-program-journeys.browser.ts",
    "server/tests/reliability-program-worker-resume.browser.ts"];
  const catalog = {schema: "blueprint.journey-catalog.v3", version: 3, frozen_at: new Date().toISOString(), run_id: runId, code_sha: execFileSync("git", ["rev-parse", "HEAD"], {encoding: "utf8"}).trim(),
    source_sha256: Object.fromEntries(sourcePaths.map(file => [file, createHash("sha256").update(fs.readFileSync(file)).digest("hex")])),
    fixture_sha256: createHash("sha256").update(fs.readFileSync(fixture)).digest("hex"),
    layer: emulatorMode ? "normal-ui-real-express-firestore-emulator-fake-objectstore-local-provider" : "normal-ui-real-express-file-backed-fakes-local-provider",
    corrections: ["Match signed-link route registration, not added CSRF", "Distinct synthetic actors retain real rate limiter", "Correlate customer/operator receipt purposes", "Use actual browser_pending_delivery field and contract-valid provider fixture", "UI020 orderly native restart; SIGKILL automatic-local-return failure retained; UI021 separate email route", "Require actual upload response before final state; held UI checked against retained/not-processing semantics", "Strict recipient sink rejects encrypted objects; prior permissive delivery evidence invalidated"],
    cases: cases.map(([id, condition]) => ({id, condition, source: "generated-synthetic-transport-fixture", split: "development_regression",
      expected: condition.startsWith("missing_") || ["unknown_country", "invalid_video_extension", "create_error_body"].includes(condition)
        ? "Refuse safely without a durable intake" : condition === "upload_storage_unavailable" ? "One durable intake; video receipt unknown; safe status failure"
        : "One durable intake and private return route; current persisted status; no repeated customer notification; upload evidence if applicable",
      hash: createHash("sha256").update(JSON.stringify({condition, version: 3})).digest("hex")}))};
  fs.writeFileSync(path.join(retained, "catalog.json"), JSON.stringify(catalog, null, 2));
  fs.writeFileSync(path.join(output, "catalog.json"), JSON.stringify(catalog, null, 2));
  vi.stubEnv("APP_URL", base); vi.stubEnv("VITE_PUBLIC_APP_URL", base);
  vi.stubEnv("BLUEPRINT_SITE_VIDEO_EVIDENCE_ENABLED", "true");
  vi.stubEnv("BLUEPRINT_SITE_TASK_BRIEF_READING_ENABLED", "false");
  vi.stubEnv("BLUEPRINT_ALL_AUTOMATION_ENABLED", "false");
  vi.stubEnv("BLUEPRINT_DISABLE_LOCAL_ENV_BOOTSTRAP", "true");
  vi.stubEnv("FIELD_ENCRYPTION_KMS_KEY_NAME", "");
  vi.stubEnv("FIELD_ENCRYPTION_MASTER_KEY", Buffer.alloc(32, 7).toString("base64"));
  const inbound = (await import("../routes/inbound-request")).default;
  const uploads = (await import("../routes/self-capture-uploads")).default;
  const brief = (await import("../routes/site-task-brief")).default;
  const { csrfCookieHandler, csrfProtection } = await import("../middleware/csrf");
  const app = express(); app.use(express.json());
  app.use((req, res, next) => {
    Object.defineProperty(req, "ip", {value: `192.0.2.${cases.findIndex(([id]) => id === activeCase) + 1}`});
    const method = req.method, route = req.path.replace(/\/[A-Za-z0-9_-]{80,}\.[A-Za-z0-9_-]+/g, "/[local-token]");
    res.on("finish", () => requests.push({ method, route, status: res.statusCode }));
    next();
  });
  app.get("/api/csrf", csrfCookieHandler);
  app.post("/api/analytics/ingest", (_req, res) => res.sendStatus(204));
  app.use("/api/inbound-request", (req, res, next) => {
    if (createError) return res.status(503).json({ message: "Local storage unavailable. Retry this job.", code: "local_create_fault" });
    if (loseReply) {
      const json = res.json.bind(res); res.json = function(body) { loseReply = false; res.socket?.destroy(); return res; };
      res.locals.originalJson = json;
    }
    if (createDelay) setTimeout(next, createDelay); else next();
  }, csrfProtection, inbound);
  app.use("/api/self-capture/uploads", uploads);
  app.use("/api/site-task-brief", brief);
  app.use("/api", (_req, res) => res.status(404).json({ error: "Unconfigured isolated route" }));
  server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const apiPort = (server.address() as { port: number }).port;
  const env: Record<string, string> = {};
  for (const key of ["PATH", "HOME", "TMPDIR"]) if (process.env[key]) env[key] = process.env[key]!;
  Object.assign(env, { RELIABILITY_API_PORT: String(apiPort), VITE_FIREBASE_API_KEY: "local-fixture-key",
    VITE_FIREBASE_AUTH_DOMAIN: "fixture.invalid", VITE_FIREBASE_PROJECT_ID: "local-reliability",
    VITE_FIREBASE_STORAGE_BUCKET: "fixture.invalid", VITE_FIREBASE_MESSAGING_SENDER_ID: "123456", VITE_FIREBASE_APP_ID: "1:123456:web:fixture" });
  const log = fs.openSync(path.join(output, "vite.log"), "w");
  vite = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--config", "vite.reliability-program.config.ts", "--port", "42878"], { env, stdio: ["ignore", log, log] });
  await vi.waitFor(async () => expect((await fetch(base)).status).toBe(200), { timeout: 60_000, interval: 200 });
});
beforeEach(async () => { await clearEmulator(); resetStorage(); providers.privacy = "cleared"; providers.calls = 0; providers.sent.length = 0;
  providers.errors.length = 0; requests.length = 0; createError = false; loseReply = false; createDelay = 0;
  fs.rmSync(path.join(output, "profile"), { recursive: true, force: true });
});
afterAll(async () => {
  await stopBrowser();
  vite?.kill("SIGTERM"); if (server) { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
  const report = { schema: "blueprint.journey-results.v3", run_id: runId, code_hashes: JSON.parse(fs.readFileSync(path.join(retained, "catalog.json"), "utf8")).source_sha256, generated: cases.length,
    attempted: traces.length, passed: traces.filter(t => t.result === "passed").length, failed: traces.filter(t => t.result === "failed").length,
    live_provider_calls: 0, live_cost_usd: 0, simulated_cost_usd: null, traces };
  fs.writeFileSync(path.join(retained, "results.json"), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(output, "results.json"), JSON.stringify(report, null, 2));
  if (emulatorMode) await (database as any).terminate();
  vi.unstubAllEnvs();
});

describe("normal customer UI joined to real handlers and disposable durable storage", () => {
  for (const [id, kind] of cases) it(`${id} ${kind}`, async () => {
    activeCase = id; const started = Date.now(); let result = "failed"; let privateReturnUrl: string | undefined;
    try {
      await openBrowser(kind.includes("mobile")); await fill(kind);
      if (kind === "upload_privacy_held") providers.privacy = "held";
      if (kind === "upload_privacy_unknown") providers.privacy = "unknown";
      if (kind === "upload_manifest_retry") faults.manifestOnce = true;
      if (kind === "upload_storage_unavailable") faults.storageUnavailable = true;
      if (kind === "slow_create") createDelay = 300;
      if ((kind === "browser_termination_upload_return" || kind === "forced_termination_email_return_worker_restart")) faults.holdVideoWrites = true;
      if (kind === "create_error_body") createError = true;
      if (kind === "lost_response_reload") loseReply = true;
      const button = page.getByRole("button", { name: "Start free assessment", exact: true });
      if (kind === "double_click") await button.dblclick(); else await button.click();
      if (["missing_email", "missing_task", "unknown_country", "invalid_video_extension"].includes(kind)) {
        await new Promise(resolve => setTimeout(resolve, 200)); expect(requestRows()).toHaveLength(0);
      } else if (kind === "create_error_body") {
        await vi.waitFor(async () => expect(await page.getByText("Local storage unavailable. Retry this job.").count()).toBeGreaterThan(0));
        expect(requestRows()).toHaveLength(0);
      } else {
        await vi.waitFor(async () => { await refreshDocumentView(); expect(requestRows()).toHaveLength(1); });
        const requestId = requestRows()[0][1].requestId as string;
        expect((requestRows()[0][1].request as Record<string, unknown>).capture_mode).toBe(kind.startsWith("visit") ? "site_visit" : "self_capture");
        expect((requestRows()[0][1].request as Record<string, unknown>).capture_region).toBe(kind.includes("non_us") ? "non_us" : "us");
        if (kind === "lost_response_reload") {
          await page.reload();
          await page.getByRole("button", { name: /recover|return|resume|retry/i }).first().click();
          await vi.waitFor(async () => expect(await page.getByRole("heading", {name: "Your job description is saved."}).count()).toBeGreaterThan(0));
        } else if ((kind === "browser_termination_upload_return" || kind === "forced_termination_email_return_worker_restart")) {
          await vi.waitFor(() => expect(faults.videoWriteReached).toBe(true), {timeout: 20_000});
          expect([...state.docs.values()].some(row => (row.browser_pending_delivery as {state?: string} | undefined)?.state === "published")).toBe(false);
          await stopBrowser(kind === "browser_termination_upload_return" ? "SIGTERM" : "SIGKILL"); releaseVideoWrites();
          await vi.waitFor(async () => {await refreshDocumentView(); expect([...state.docs.values()].some(row => row.browser_pending_delivery)).toBe(true);}, {timeout: 20_000});
          reloadDocuments(); reloadObjects(); await openBrowser();
          await page.goto(`${base}/contact/site-operator`);
          if (kind === "browser_termination_upload_return") {
            await page.getByRole("button", {name: "Return to saved job"}).click();
          } else {
            const worker = await runFreshWorker("first");
            providers.calls += worker.model_calls_simulated; providers.sent.push(...worker.mails);
            const reentered = await runFreshWorker("restart");
            expect(reentered.model_calls_simulated).toBe(0); expect(reentered.mails).toHaveLength(0);
            expect(reentered.process_id).not.toBe(worker.process_id);
            await refreshDocumentView();
            const receipt = [...state.docs.values()].find(row => row.kind === "task_received" && row.status === "sent");
            expect(receipt?.requestId).toBe(requestId);
            const emailedUrl = String(receipt!.body).split("\n").find(line => line.startsWith(`${base}/capture-upload/`));
            expect(emailedUrl).toBeTruthy(); privateReturnUrl = emailedUrl; await page.goto(emailedUrl!);
          }
        }
        await vi.waitFor(async () => { await refreshDocumentView(); expect(requestRows()).toHaveLength(1); });
        expect(requestRows()[0][1].requestId).toBe(requestId);
        if (kind.startsWith("upload")) {
          await vi.waitFor(() => expect(requests.some(row => row.method === "POST" && row.route === "/api/self-capture/uploads/[local-token]" && row.status >= 200)).toBe(true), {timeout: 20_000});
        }
        if ((kind.startsWith("upload") && kind !== "upload_storage_unavailable") || (kind === "browser_termination_upload_return" || kind === "forced_termination_email_return_worker_restart")) {
          await vi.waitFor(async () => { await refreshDocumentView(); expect([...state.docs.keys()].some(key => key.startsWith("captureUploadSessions/") && Boolean(state.docs.get(key)?.browser_stored_upload || state.docs.get(key)?.browser_pending_delivery))).toBe(true); }, { timeout: 20_000 });
        }
        if (kind === "upload_manifest_retry") {
          await page.getByRole("button", {name: "Retry processing", exact: true}).click();
          await vi.waitFor(async () => {await refreshDocumentView(); expect([...state.docs.values()].some(row => (row.browser_pending_delivery as {state?: string} | undefined)?.state === "published")).toBe(true);}, {timeout: 10_000});
        }
        reloadDocuments(); reloadObjects(); expect(requestRows()).toHaveLength(1);
        const { recoverCaptureReviews } = await import("../utils/captureReviewRecovery");
        await recoverCaptureReviews();
        const { reconcileCoverageReviews } = await import("../utils/captureCoverageQueue");
        await reconcileCoverageReviews();
        const { deliverOutbox } = await import("../utils/captureOutbox");
        await deliverOutbox(); await deliverOutbox();
        await refreshDocumentView();
        const statuses = [...state.docs.entries()].filter(([key]) => key.startsWith("captureOutbox/") && !key.includes("/deliveryReceipts/"));
        for (const [, row] of statuses) {expect(typeof row.to).toBe("string"); expect(row.status).toBe("sent");}
        if ((kind === "browser_termination_upload_return" || kind === "forced_termination_email_return_worker_restart") || kind.startsWith("upload_clear")) {
          const coverageMail = statuses.filter(([,row]) => row.kind === "coverage_shortfall");
          expect(coverageMail).toHaveLength(1);
          expect(coverageMail[0][1].to).toBe(`${id.toLowerCase()}@example.com`);
        }
        const taskMail = statuses.filter(([, row]) => row.kind === "task_received");
        const linkEligible = true; // Current description authority permits a read-only job link for every submitted region/method.
        expect(taskMail).toHaveLength(linkEligible ? 1 : 0);
        const customerMail = providers.sent.filter(mail => mail.to === `${id.toLowerCase()}@example.com`);
        const operatorMail = providers.sent.filter(mail => mail.to === "ops@tryblueprint.io");
        expect(operatorMail).toHaveLength(1);
        expect(customerMail.length).toBe(linkEligible ? statuses.filter(([, row]) => row.status === "sent" && row.to === `${id.toLowerCase()}@example.com`).length : 1);
        expect(new Set(customerMail.map(mail => mail.subject)).size).toBe(customerMail.length);
        if (linkEligible) {
          if (!privateReturnUrl) await vi.waitFor(async () => expect(await page.locator('a[href*="/capture-upload/"]').count()).toBeGreaterThan(0));
          const href = privateReturnUrl ?? await page.locator('a[href*="/capture-upload/"]').first().getAttribute("href");
          const token = href!.split("/capture-upload/")[1].split("?")[0];
          const persistedStatus = await page.evaluate(async token => {
            const response = await fetch(`/api/site-task-brief/${token}/status`);
            return {http: response.status, body: await response.json()};
          }, token);
          if (kind === "upload_storage_unavailable") {
            expect(persistedStatus.http).toBe(503); expect(persistedStatus.body.code).toBe("task_status_unavailable");
            expect(await page.getByRole("heading", {name: "Your recording is in."}).count()).toBe(0);
            result = "passed"; return;
          }
          expect(persistedStatus.http).toBe(200);
          expect(persistedStatus.body.status.stage).not.toBe("completed");
          if ((kind === "browser_termination_upload_return" || kind === "forced_termination_email_return_worker_restart") || kind.startsWith("upload_clear")) {
            expect(persistedStatus.body.captureReceived).toBe(true);
            expect([...state.docs.values()].some(row => (row.browser_pending_delivery as {state?: string} | undefined)?.state === "published")).toBe(true);
            expect([...state.docs.values()].some(row => (row.capture_coverage as {covers_scene?: boolean} | undefined)?.covers_scene === false)).toBe(true);
          }
          await page.goto(href!);
          if (kind === "upload_privacy_held" || kind === "upload_privacy_unknown") {
            expect(persistedStatus.body.captureReceived).toBe(true);
            expect(persistedStatus.body.uploadState).not.toBe("processing_ready");
            expect(providers.calls).toBe(0);
            await vi.waitFor(async () => expect(await page.locator("body").innerText()).toMatch(/processing/i), {timeout: 10_000});
          } else {
            await vi.waitFor(async () => expect(await page.locator("body").innerText()).toContain(persistedStatus.body.status.headline), {timeout: 10_000});
          }
        }
      }
      result = "passed";
    } finally {
      if (result === "failed" && page && !page.isClosed()) {
        await page.screenshot({ path: path.join(retained, `${id}-failure.png`) }).catch(() => undefined);
        fs.writeFileSync(path.join(retained, `${id}-screen.txt`), await page.locator("body").innerText().catch(() => "unavailable"));
      }
      traces.push({ id, kind, result, layer: emulatorMode ? "normal-ui-real-express-firestore-emulator-fake-objectstore-local-provider" : "normal-ui-real-express-file-backed-fakes-local-provider", latency_ms: Date.now() - started,
        provider_calls_simulated: providers.calls, notification_calls_local_sink: providers.sent.length, errors: [...providers.errors], browser_termination: kind === "browser_termination_upload_return" ? "orderly-CDP-browser-close-native-profile-mid-object-write" : kind === "forced_termination_email_return_worker_restart" ? "SIGKILL-queued-email-return-with-fresh-worker-process" : null,
        transitions: [...requests], effects: [...state.docs.entries()].filter(([key]) => key.startsWith("captureOutbox/")).map(([,row]) => ({kind: row.kind, status: row.status, recipient: row.to === `${id.toLowerCase()}@example.com` ? "customer" : "other-local-sink"})), durable: durableSummary(), private_video_used: false });
      releaseVideoWrites(); await stopBrowser();
    }
  });
});
