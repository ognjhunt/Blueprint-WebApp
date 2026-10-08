import { test, expect, chromium, type BrowserContext } from "@playwright/test";
import { mkdtemp, mkdir, writeFile, rm, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
// Opt-in only: real Express/Firestore/Storage emulators, synthetic video, no provider or mail.
// Private traces contain test bearer links; keep the output private and apply bounded retention.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = path.resolve(process.env.RELIABILITY_DURABILITY_OUTPUT || "output/reliability-program/intake-durability");
const sourcePaths = ["client/src/components/site/SiteCaptureStart.tsx", "client/src/lib/siteCaptureDraft.ts", "client/src/lib/siteCaptureDurability.ts", "client/src/contexts/AuthContext.tsx", "scripts/qa/reliability-local-app.ts"];
async function sourceReceipt() {
    return { commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", cwd: repositoryRoot }).trim(), files: Object.fromEntries(await Promise.all(sourcePaths.map(async (p) => [p, createHash("sha256").update(await readFile(path.join(repositoryRoot, p))).digest("hex")]))), backendRelaunchedForRun: true };
}
let launchedSource: Awaited<ReturnType<typeof sourceReceipt>>;
test.beforeAll(async () => {
    launchedSource = await sourceReceipt();
    await mkdir(outputRoot, {recursive:true, mode:0o700});
    await writeFile(path.join(outputRoot, "source-at-launch.json"), JSON.stringify(launchedSource,null,2));
});
test.afterAll(async () => {
    const after = await sourceReceipt();
    await writeFile(path.join(outputRoot, "source-after-run.json"), JSON.stringify(after,null,2));
    expect(after.files, "Source changed after launcher start; restart before scoring").toEqual(launchedSource.files);
});
for (const [index, boundary] of ["acknowledged-upload", "browser-kill-after-stored-upload"].entries())
    test(`${index === 0 ? "A-UJ-1" : "A-UJ-3"} normal UI ${boundary}`, async ({}, testInfo) => {
        const { execFileSync } = await import("node:child_process");
        const caseId = index === 0 ? "A-UJ-1" : "A-UJ-3";
        const source = await sourceReceipt();
        const profile = await mkdtemp(path.join(os.tmpdir(), "blueprint-owned-ui-upload-"));
        const output = path.join(outputRoot, `${caseId}-repeat-${testInfo.repeatEachIndex}`);
        await mkdir(output, { recursive: true });
        const fixture = path.join(output, `${caseId}-owned-synthetic.mp4`);
        execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=size=320x240:rate=30", "-t", "2", "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-y", fixture]);
        let context: BrowserContext;
        let submittedBody: Record<string, unknown> | null = null;
        let savedUrl: string | null = null;
        const intakeBodies: string[] = [];
        let durableUploadResponse: Record<string, unknown> | null = null;
        const start = async () => {
            context = await chromium.launchPersistentContext(profile, { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE, headless: true,
                extraHTTPHeaders: { "X-Forwarded-For": `192.0.2.${231 + index}` } });
            await context.route(/^https?:\/\/(?!127\.0\.0\.1(?::|\/)|localhost(?::|\/))/, route => route.abort("blockedbyclient"));
            await context.addInitScript(() => {
                try {
                    (window as any).__blueprintInitialStorage = Object.fromEntries(Object.entries(localStorage));
                }
                catch { /* about:blank has no origin */ }
            });
            await context.tracing.start({ screenshots: true, snapshots: true });
            context.on("request", request => {
                if (new URL(request.url()).pathname === "/api/inbound-request" && request.method() === "POST") {
                    submittedBody = request.postDataJSON();
                    intakeBodies.push(request.postData()!);
                }
            });
            context.on("response", async (response) => {
                if (new URL(response.url()).pathname === "/api/inbound-request" && response.ok())
                    savedUrl = (await response.json()).captureUrl;
            });
            return context.newPage();
        };
        let page = await start();
        try {
            if (boundary === "browser-kill-after-stored-upload") {
                // Pause only the response: request-stage route.fetch loses Chromium file-backed
                // multipart bytes. The actual browser request must reach the real upload handler.
                const cdp = await context!.newCDPSession(page);
                await cdp.send("Fetch.enable", { patterns: [{ urlPattern: "*/api/self-capture/uploads/*", requestStage: "Response" }] });
                cdp.on("Fetch.requestPaused", async (event) => {
                    if (event.request.method !== "POST" || !event.responseStatusCode) {
                        await cdp.send("Fetch.continueRequest", { requestId: event.requestId });
                        return;
                    }
                    const response = await cdp.send("Fetch.getResponseBody", { requestId: event.requestId });
                    durableUploadResponse = JSON.parse(response.base64Encoded ? Buffer.from(response.body, "base64").toString("utf8") : response.body);
                    await writeFile(path.join(output, `${caseId}-upload-response-diagnostic.json`), JSON.stringify({ status: event.responseStatusCode, body: durableUploadResponse }, null, 2));
                    // Remain paused until actual Chromium termination below; no fake response.
                });
            }
            await page.goto("http://127.0.0.1:4181/contact/site-operator", { waitUntil: "networkidle" });
            await page.locator("#start-task").fill("Owned synthetic test pattern: no observed robot task");
            await page.locator("#start-location").fill("Austin TX");
            await page.locator("#start-email").fill(`owned-upload-${index + 1}-${Date.now()}@example.invalid`);
            await page.locator("#start-company").fill("Owned isolated reliability fixture");
            await page.locator("#start-method-upload").check();
            await page.locator("#start-rights").check();
            await page.locator("#start-footage").setInputFiles(fixture);
            await page.getByRole("button", { name: "Start free assessment", exact: true }).click();
            if (boundary === "browser-kill-after-stored-upload") {
                await expect.poll(() => durableUploadResponse?.captureReceived).toBe(true);
                await writeFile(path.join(output, `${caseId}-before-kill-storage-private.json`), JSON.stringify({ profile, storage: await context!.storageState(), initialDiskValues: await page.evaluate(() => (window as any).__blueprintInitialStorage), source }, null, 2));
                await context!.tracing.stop({ path: path.join(output, `${caseId}-before-close.zip`) });
                const processes = execFileSync("ps", ["-eo", "pid=,args="], { encoding: "utf8" }).split("\n");
                const browserRoot = processes.find(line => line.includes("--user-data-dir=" + profile) && !line.includes("--type="));
                expect(browserRoot, "Exact owned Chromium process must exist before SIGKILL").toBeTruthy();
                const browserPid = Number(browserRoot!.trim().split(/\s+/)[0]);
                const closed = context!.waitForEvent("close");
                process.kill(browserPid, "SIGKILL");
                await closed;
                page = await start();
                await page.goto("http://127.0.0.1:4181/contact/site-operator", { waitUntil: "networkidle" });
                await writeFile(path.join(output, `${caseId}-after-kill-storage-private.json`), JSON.stringify({ profile, storage: await context!.storageState(), initialDiskValues: await page.evaluate(() => (window as any).__blueprintInitialStorage), source }, null, 2));
            }
            const returnButton = page.getByRole("button", { name: /^(Return to saved job|Recover saved job)$/ });
            if (await returnButton.isVisible())
                await returnButton.click();
            await expect(page.getByRole("link", { name: "Open your job and assessment", exact: true })).toBeVisible();
            const target = await page.getByRole("link", { name: "Open your job and assessment", exact: true }).getAttribute("href");
            expect(savedUrl).toBe(target);
            // Exercise a normal navigation away and return after verified acknowledgement.
            await page.goto("http://127.0.0.1:4181/");
            await page.goto("http://127.0.0.1:4181/contact/site-operator", { waitUntil: "networkidle" });
            if (await returnButton.isVisible())
                await returnButton.click();
            await expect(page.getByRole("link", { name: "Open your job and assessment", exact: true })).toBeVisible();
            const renewedTarget = await page.getByRole("link", { name: "Open your job and assessment", exact: true }).getAttribute("href");
            expect(new URL(renewedTarget!, "http://127.0.0.1:4181").pathname.split("/").pop()).toBeTruthy();
            expect(intakeBodies.every(body => body === intakeBodies[0])).toBe(true);
            expect(new Set(intakeBodies.map(body => JSON.parse(body).requestId)).size).toBe(1);
            const token = new URL(target!, "http://127.0.0.1:4181").pathname.split("/").pop()!;
            const statusResponse = await context!.request.get(`http://127.0.0.1:4181/api/self-capture/uploads/${encodeURIComponent(token)}/status`);
            expect(statusResponse.ok()).toBe(true);
            const status = await statusResponse.json();
            expect(status.captureReceived).toBe(true);
            expect(status.uploadState).toBe("processing_ready");
            const binding = JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString("utf8"));
            expect(binding.requestId).toBe(submittedBody?.requestId);
            expect(binding.captureId).toBe(status.captureId);
            const bucket = "demo-blueprint-reliability.appspot.com";
            const rawPrefix = `scenes/${binding.sceneId}/captures/${binding.captureId}/raw/`;
            const objectResponse = await context!.request.get(`http://127.0.0.1:9199/v0/b/${bucket}/o?prefix=${encodeURIComponent(rawPrefix)}`, { headers: { Authorization: "Bearer owner" } });
            expect(objectResponse.ok()).toBe(true);
            const objects = await objectResponse.json();
            const names = (objects.items || []).map((object: {
                name: string;
            }) => object.name);
            expect(names.some((name: string) => name.endsWith("walkthrough.mp4"))).toBe(true);
            expect(names.some((name: string) => name.endsWith("manifest.json"))).toBe(true);
            expect(names.some((name: string) => name.endsWith("capture_upload_complete.json"))).toBe(true);
            const rawVideoName = names.find((name: string) => name.endsWith("walkthrough.mp4"));
            const rawVideo = await context!.request.get(`http://127.0.0.1:9199/v0/b/${bucket}/o/${encodeURIComponent(rawVideoName)}?alt=media`, { headers: { Authorization: "Bearer owner" } });
            expect(rawVideo.ok()).toBe(true);
            const { readFile: readFixture } = await import("node:fs/promises");
            expect(await rawVideo.body()).toEqual(await readFixture(fixture));
            await page.getByRole("link", { name: "Open your job and assessment", exact: true }).click();
            await expect(page.getByRole("heading", { name: "A few details about the job", exact: true })).toBeVisible();
            await expect(page.getByText("Video received.", { exact: true })).toBeVisible();
            await writeFile(path.join(output, `${caseId}.json`), JSON.stringify({ caseId, parameters: { boundary, source: "owned-synthetic-pattern" },
                layer: "real-backend/firebase-emulators/no-provider", captureReceivedVerified: true, persistedOriginalAndManifestVerified: true,
                completionMarkerVerified: true, actualBrowserRestart: boundary === "browser-kill-after-stored-upload", browserTermination: boundary === "browser-kill-after-stored-upload" ? "SIGKILL" : null, source, intakePostCount: intakeBodies.length, originalBytesEqual: true, navigationAwayAndReturnVerified: true, repeat: testInfo.repeatEachIndex, providerDispatch: false,
                fullJourneyComplete: false, privateIdentifiersRedacted: true, notificationDelivery: false,
            }, null, 2));
            await context!.tracing.stop({ path: path.join(output, `${caseId}.zip`) });
        }
        catch (error) {
            await context!.tracing.stop({ path: path.join(output, `${caseId}-failed.zip`) }).catch(() => undefined);
            await page.screenshot({ path: path.join(output, `${caseId}-failed.png`), fullPage: true }).catch(() => undefined);
            throw error;
        }
        finally {
            await context!.close().catch(() => undefined);
            if (testInfo.status === testInfo.expectedStatus)
                await rm(profile, { recursive: true, force: true });
            else
                await writeFile(path.join(output, "retained-profile-private.json"), JSON.stringify({ profile, reason: "failed case reproducer", retention: "operator must remove within seven days" }));
        }
    });
// These native helper controls are additional evidence; they are not complete customer journeys.
test.describe("native strict recovery controls", () => {
    test.beforeEach(async ({ context, page }) => {
        await context.route(/^https?:\/\/(?!127\.0\.0\.1(?::|\/)|localhost(?::|\/))/, r => r.abort("blockedbyclient"));
        await context.tracing.start({screenshots:true,snapshots:true});
        await page.goto("/contact/site-operator", { waitUntil: "networkidle" });
        await expect(page.locator("#start-task")).toBeVisible();
    });
    test.afterEach(async ({context}, info) => {
        const out = path.join(outputRoot, "native-controls");
        await mkdir(out, { recursive: true });
        await context.tracing.stop({path:path.join(out, `${info.title}-${info.repeatEachIndex}.zip`)});
        await writeFile(path.join(out, `${info.title}-${info.repeatEachIndex}.json`), JSON.stringify({ caseId: info.title, status: info.status, source: await sourceReceipt(), layer: "actual-browser/native-strict-IDB/real-client-helpers", providerCalls: 0, fullJourneyComplete: false }, null, 2));
    });
    test('A-IDB-01 localmirrorloss restores exactidentity', async ({ page }) => { const result = await page.evaluate(async () => { const h = await import('/src/lib/siteCaptureDraft.ts'); const key = h.siteCaptureDraftKey(null, 'owned-loss-probe'); await h.hydrateSiteCaptureRecovery(key); const before = h.readSiteCaptureRecovery(key); before.draft.task = 'Owned synthetic task'; await h.withSiteCaptureRecoveryLock(key, () => h.writeSiteCaptureRecoveryDurably(key, before)); localStorage.removeItem(key); await h.hydrateSiteCaptureRecovery(key); const after = h.readSiteCaptureRecovery(key); return { sameId: before.requestId === after.requestId, sameRetry: before.retryToken === after.retryToken, task: after.draft.task }; }); expect(result).toEqual({ sameId: true, sameRetry: true, task: 'Owned synthetic task' }); });
    test('A-IDB-02 accountscopesretired stalewritersfenced', async ({ page }) => { const result = await page.evaluate(async () => { const h = await import('/src/lib/siteCaptureDraft.ts'), m = await import('/src/lib/siteCaptureDurability.ts'); const keys = ['default', 'authoring'].map(a => h.siteCaptureDraftKey('owned-program-account', a)); const other = h.siteCaptureDraftKey('different-owned-account', 'default'); for (const key of [...keys, other])
        await h.hydrateSiteCaptureRecovery(key); const before = keys.map(k => h.readSiteCaptureRecovery(k)); const cleared = await h.clearSiteCaptureRecoveryForAccount('owned-program-account'); const retired = await Promise.all(keys.map(k => m.readDurableSiteCaptureRecovery(k))); const stale = []; for (let i = 0; i < keys.length; i++) {
        try {
            await h.withSiteCaptureRecoveryLock(keys[i], () => h.writeSiteCaptureRecoveryDurably(keys[i], before[i]));
            stale.push(false);
        }
        catch {
            stale.push(true);
        }
    } const noLocal = keys.every(k => localStorage.getItem(k) === null); await h.hydrateSiteCaptureRecovery(keys[0]); const fresh = h.readSiteCaptureRecovery(keys[0]); const oldWrite = await h.withSiteCaptureRecoveryLock(keys[0], () => h.writeSiteCaptureRecoveryDurably(keys[0], before[0])); return { cleared, retired: retired.every(r => r.retired && r.value === null), stale: stale.every(Boolean), noLocal, freshIdentity: fresh.requestId !== before[0].requestId, oldWrite, otherPreserved: !!h.readSiteCaptureRecovery(other) }; }); expect(result).toEqual({ cleared: true, retired: true, stale: true, noLocal: true, freshIdentity: true, oldWrite: false, otherPreserved: true }); });
    test('A-IDB-03 strictcommitfailure preventsactualPOST', async ({ page }) => { let posts = 0; page.on('request', r => { if (r.method() === 'POST' && new URL(r.url()).pathname === '/api/inbound-request')
        posts++; }); await page.locator('#start-task').fill('Owned failed strict commit'); await page.locator('#start-location').fill('Austin TX'); await page.locator('#start-email').fill('durability-failure@example.invalid'); await page.locator('#start-company').fill('Owned fixture'); await page.evaluate(() => { const original = IDBDatabase.prototype.transaction; IDBDatabase.prototype.transaction = function (store, mode, ...options) { if (mode === 'readwrite')
        throw new Error('Owned isolated strictcommit failure'); return original.call(this, store, mode, ...options); }; }); await page.getByRole('button', { name: 'Start free assessment', exact: true }).click(); await expect(page.getByRole('alert')).toBeVisible(); expect(posts).toBe(0); });
    test('A-IDB-04 conflictingmirrors failclosed', async ({ page }) => { const result = await page.evaluate(async () => { const h = await import('/src/lib/siteCaptureDraft.ts'), m = await import('/src/lib/siteCaptureDurability.ts'); const key = h.siteCaptureDraftKey(null, 'owned-conflict'); await h.hydrateSiteCaptureRecovery(key); const original = h.readSiteCaptureRecovery(key); const changed = { ...original, requestId: 'capture-' + crypto.randomUUID() }; localStorage.setItem(key, JSON.stringify(changed)); let refused = false; try {
        await h.hydrateSiteCaptureRecovery(key);
    }
    catch {
        refused = true;
    } return { refused, localUnchanged: h.readSiteCaptureRecovery(key).requestId === changed.requestId, mirrorUnchanged: (await m.readDurableSiteCaptureRecovery(key)).value.requestId === original.requestId }; }); expect(result).toEqual({ refused: true, localUnchanged: true, mirrorUnchanged: true }); });
    test('A-IDB-05 namedfields excludebearerURLs', async ({ page }) => { const result = await page.evaluate(async () => { const h = await import('/src/lib/siteCaptureDraft.ts'), m = await import('/src/lib/siteCaptureDurability.ts'); const key = h.siteCaptureDraftKey(null, 'owned-fields'); await h.hydrateSiteCaptureRecovery(key); const row = { ...h.readSiteCaptureRecovery(key), captureUrl: 'https://signed.example.invalid/private-bearer', file: { bytes: 'excluded' } }; await h.withSiteCaptureRecoveryLock(key, () => h.writeSiteCaptureRecoveryDurably(key, row)); return { localSafe: !localStorage.getItem(key).includes('private-bearer'), mirrorSafe: !JSON.stringify(await m.readDurableSiteCaptureRecovery(key)).includes('private-bearer') }; }); expect(result).toEqual({ localSafe: true, mirrorSafe: true }); });
    test('A-IDB-06 queuedinactivefreeze writesnothing', async ({ page }) => { const result = await page.evaluate(async () => { const h = await import('/src/lib/siteCaptureDraft.ts'), m = await import('/src/lib/siteCaptureDurability.ts'); const key = h.siteCaptureDraftKey(null, 'owned-queue'); await h.hydrateSiteCaptureRecovery(key); const row = h.readSiteCaptureRecovery(key), before = localStorage.getItem(key); let release, started; const gate = new Promise(r => release = r), ready = new Promise(r => started = r); const held = navigator.locks.request(key, async () => { started(); await gate; }); await ready; let active = true; const candidate = { ...row, pending: { endpoint: '/api/inbound-request', acknowledged: false, body: JSON.stringify({ requestId: row.requestId, retryToken: row.retryToken, buyerType: 'site_operator', taskStatement: row.draft.task, siteLocation: row.draft.location, captureRegion: row.draft.region }) } }; const queued = h.freezeSiteCaptureRecovery(key, candidate, () => active); active = false; release(); await held; let refused = false; try {
        await queued;
    }
    catch {
        refused = true;
    } return { refused, unchanged: localStorage.getItem(key) === before, noPending: (await m.readDurableSiteCaptureRecovery(key)).value.pending === null }; }); expect(result).toEqual({ refused: true, unchanged: true, noPending: true }); });
    test('A-IDB-07 acceptedjob commitfailure staysrecoverable', async ({ page, context }) => { let uploads = 0; const bodies: string[] = []; page.on('request', r => { const p = new URL(r.url()).pathname; if (r.method() === 'POST' && p.startsWith('/api/self-capture/uploads/'))
        uploads++; if (r.method() === 'POST' && p === '/api/inbound-request')
        bodies.push(r.postData()!); }); const cdp = await context.newCDPSession(page); await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*/api/inbound-request', requestStage: 'Response' }] }); let injected = false; cdp.on('Fetch.requestPaused', async (e) => { if (!injected && e.responseStatusCode && e.responseStatusCode < 300) {
        injected = true;
        await page.evaluate(() => { (window as any).__originalIDBTransaction = IDBDatabase.prototype.transaction; IDBDatabase.prototype.transaction = function (store, mode, ...options) { if (mode === 'readwrite')
            throw new Error('Owned acceptance-commit failure'); return (window as any).__originalIDBTransaction.call(this, store, mode, ...options); }; });
    } await cdp.send('Fetch.continueResponse', { requestId: e.requestId }); }); await page.locator('#start-task').fill('Owned accepted description'); await page.locator('#start-location').fill('Austin TX'); await page.locator('#start-email').fill(`owned-accepted-${Date.now()}@example.invalid`); await page.locator('#start-company').fill('Owned fixture'); await page.getByRole('button', { name: 'Start free assessment', exact: true }).click(); await expect(page.getByRole('alert')).toContainText('Your job may already be saved'); expect(uploads).toBe(0); expect(bodies).toHaveLength(1); await page.evaluate(() => { IDBDatabase.prototype.transaction = (window as any).__originalIDBTransaction; }); await page.getByRole('button', { name: 'Recover saved job', exact: true }).click(); await expect(page.getByRole('link', { name: 'Open your job and assessment', exact: true })).toBeVisible(); expect(bodies).toHaveLength(2); expect(bodies[1]).toBe(bodies[0]); expect(uploads).toBe(0); await cdp.detach(); });
    for (const cancel of [true, false])
        test(`A-IDB-${cancel ? '08' : '09'} unknownscope hydration ${cancel ? 'cancelled' : 'activecontrol'}`, async ({ page }) => { const result = await page.evaluate(async (cancel) => { const h = await import('/src/lib/siteCaptureDraft.ts'), m = await import('/src/lib/siteCaptureDurability.ts'); const uid = 'owned-late-scope', key = h.siteCaptureDraftKey(uid, 'new-authoring'); const descriptor = Object.getOwnPropertyDescriptor(IDBTransaction.prototype, 'oncomplete'); let hold = true, release, readyResolve; const ready = new Promise(r => readyResolve = r); Object.defineProperty(IDBTransaction.prototype, 'oncomplete', { configurable: true, enumerable: descriptor.enumerable, get: descriptor.get, set(fn) { descriptor.set.call(this, function (event) { if (hold && this.mode === 'readonly') {
                hold = false;
                release = () => fn.call(this, event);
                readyResolve();
            }
            else
                fn.call(this, event); }); } }); let active = true; const hydration = h.hydrateSiteCaptureRecovery(key, () => active); await ready; const cleared = await h.clearSiteCaptureRecoveryForAccount(uid); if (cancel)
            active = false; release(); await hydration; Object.defineProperty(IDBTransaction.prototype, 'oncomplete', descriptor); const row = h.readSiteCaptureRecovery(key), mirror = await m.readDurableSiteCaptureRecovery(key); return { cleared, localPresent: !!row, mirrorPresent: !!mirror, onlyEmptyDraft: row ? Object.values(row.draft).filter(v => typeof v === 'string').every(v => v === '' || v === 'phone') : true, noPending: !row?.pending }; }, cancel); expect(result.cleared).toBe(true); expect(result.localPresent).toBe(!cancel); expect(result.mirrorPresent).toBe(!cancel); expect(result.onlyEmptyDraft).toBe(true); expect(result.noPending).toBe(true); });
    test("A-IDB-10 invalidpending rejection preserves both stores", async ({ page }) => {
        const result = await page.evaluate(async () => {
            const h = await import("/src/lib/siteCaptureDraft.ts"), m = await import("/src/lib/siteCaptureDurability.ts");
            const key = h.siteCaptureDraftKey(null, "owned-invalid-pending");
            await h.hydrateSiteCaptureRecovery(key);
            const good = h.readSiteCaptureRecovery(key);
            good.draft.task = "Owned retained task";
            await h.withSiteCaptureRecoveryLock(key, () => h.writeSiteCaptureRecoveryDurably(key, good));
            const before = localStorage.getItem(key), beforeMirror = JSON.stringify(await m.readDurableSiteCaptureRecovery(key));
            const bad = {...good, pending: {endpoint: "/api/inbound-request", acknowledged: false,
                body: JSON.stringify({requestId: good.requestId, retryToken: good.retryToken, buyerType: "site_operator",
                    taskStatement: "Conflicting task", siteLocation: good.draft.location, captureRegion: good.draft.region})}};
            let rejected = false;
            try { await h.withSiteCaptureRecoveryLock(key, () => h.writeSiteCaptureRecoveryDurably(key, bad)); }
            catch { rejected = true; }
            return {rejected, localPreserved: localStorage.getItem(key) === before,
                mirrorPreserved: JSON.stringify(await m.readDurableSiteCaptureRecovery(key)) === beforeMirror,
                stillReadable: h.readSiteCaptureRecovery(key)?.draft.task === good.draft.task};
        });
        expect(result).toEqual({rejected:true, localPreserved:true, mirrorPreserved:true, stillReadable:true});
    });

});
