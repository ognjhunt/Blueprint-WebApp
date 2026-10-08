// Explicit opt-in normal UI/real handlers/native Firestore/actual SDK harness.
// Durable fake objects, scripted provider transports/local sink; no live providers.
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
vi.mock("../logger", () => ({ attachRequestMeta: (value: any) => value, logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn((meta, message) => providers.errors.push(String(message ?? meta) + ":" + String(meta?.error?.message ?? ""))), debug: vi.fn() } }));
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
const base = "http://127.0.0.1:42878";
const workerPhase = process.env.RELIABILITY_SDK_WORKER_PHASE;
const restartOnly = process.env.RELIABILITY_ASSESSMENT_RESTART_ONLY === "1";
const output = path.resolve(restartOnly ? "output/reliability-program/sdk-worker-browser" : "output/reliability-program/sdk-browser");
const retained = path.join(output, `run-${new Date().toISOString().replace(/[^0-9TZ]/g, "")}`);
const fixture = path.resolve("output/reliability-program/sdk-browser-pattern.mp4");
const cases = [["SDK-UI-001", "upload_happy"], ["SDK-UI-002", "browser_termination_upload_return"]] as const;
const traces: Record<string, unknown>[] = [];
let server: Server, vite: ChildProcess, activeCase = "";
const requests: { method: string; route: string; status: number }[] = [];
let context: BrowserContext, page: Page;
let modelSpy: any, videoSpy: any, fetchGuard: any;
let parentWakeSpy:any;
const deferredParentWakes:(()=>void)[]=[];
let responseIndex = 0;
let chrome: ChildProcess | undefined;
async function stopBrowser(signal: NodeJS.Signals = "SIGTERM") {
  const owned = chrome;
  if (owned && owned.exitCode === null && owned.signalCode === null) {
    const stopped = new Promise<void>(resolve => owned.once("exit", () => resolve()));
    // This process handle was returned by our own spawn; never kill by name/port.
    if (signal === "SIGTERM" && context?.browser()?.isConnected()) {
      try {
        const session = await context.browser()!.newBrowserCDPSession();
        await session.send("Browser.close");
      } catch { owned.kill("SIGTERM"); }
    } else owned.kill(signal);
    await stopped;
  }
  await context?.browser()?.close().catch(() => undefined);
  if (chrome === owned) chrome = undefined;
  context = undefined!; page = undefined!;
}
async function openBrowser() {
  const profile = path.join(output, "profile");
  fs.mkdirSync(profile, {recursive: true});
  const portFile = path.join(profile, "DevToolsActivePort");
  fs.rmSync(portFile, {force: true});
  const executable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || chromium.executablePath();
  if (!path.isAbsolute(executable) || !fs.existsSync(executable)) throw new Error("Existing absolute Chromium executable required; do not install during replay");
  chrome = spawn(executable, ["--headless=new", "--no-sandbox", "--disable-gpu", "--remote-debugging-port=0",
    `--user-data-dir=${profile}`, "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1"], {stdio: "ignore"});
  await vi.waitFor(() => expect(fs.existsSync(portFile)).toBe(true), {timeout: 15_000});
  const port = Number(fs.readFileSync(portFile, "utf8").split("\n")[0]);
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  context = browser.contexts()[0];
  await context.route("**/*", route => new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort());
  page = await context.newPage();
  await page.setViewportSize({width: 1440, height: 900});
}
async function fill() {
  await page.goto(`${base}/contact/site-operator`);
  await page.locator("#start-task").fill("Inspect a synthetic test pattern. No robot capability is asserted.");
  await page.locator("#start-location").fill("Austin, TX");
  await page.locator("#start-email").fill(`${activeCase.toLowerCase()}@example.com`);
  await page.locator("#start-company").fill("Synthetic reliability fixture");
  if (await page.locator("#start-region").count()) await page.locator("#start-region").selectOption("us");
  await page.locator("#start-method-upload").check();
  await page.locator("#start-footage").setInputFiles(fixture);
  await page.locator("#start-rights").check();
}
function requestRows() { return [...state.docs.entries()].filter(([key]) => key.startsWith("inboundRequests/")); }
beforeAll(async () => {
  fs.mkdirSync(retained, { recursive: true });
  if(restartOnly){fs.chmodSync(output,0o700);fs.chmodSync(retained,0o700);}
  expect(emulatorMode).toBe(true);
  const sourcePaths = ["server/tests/reliability-program-assessment.browser.ts", "server/tests/helpers/reliability-local-storage.ts", "server/agents/runtime.ts", "server/agents/adapters/site-assessment.ts", "server/utils/siteAssessmentQueue.ts", "server/agents/private-evidence.ts", "server/utils/siteAssessmentPublic.ts", "server/routes/inbound-request.ts", "server/routes/self-capture-uploads.ts", "server/routes/site-task-brief.ts", "client/src/components/site/SiteCaptureStart.tsx", "client/src/pages/SelfCaptureUpload.tsx"];
  const catalog = {schema_version:"sdk_browser_join.v1", frozen_at:new Date().toISOString(), code_sha:execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(),
    sources:Object.fromEntries(sourcePaths.map(file=>[file,createHash("sha256").update(fs.readFileSync(file)).digest("hex")])),
    video_sha256:createHash("sha256").update(fs.readFileSync(fixture)).digest("hex"),
    layer:"normal-ui/real-handlers/native-Firestore-emulator/durable-fake-objects/actual-SDK/scripted-provider-transports/local-mail",
    cases:cases.map(([id,condition])=>({id,condition,repeats:3,split:"development_regression",hash:createHash("sha256").update(JSON.stringify({id,condition,version:1})).digest("hex"),expected:"one durable intake and source; actual SDK result persisted, current authorized customer report, local notification once; no actual task/perception/robot proof"})), original_journey_credit:0};
  if(!restartOnly) fs.writeFileSync(path.join(retained,"catalog.json"),JSON.stringify(catalog,null,2));
  if (restartOnly) fs.writeFileSync(path.join(retained,"restart-catalog.json"),JSON.stringify({schema_version:"sdk_worker_browser.v1",frozen_at:new Date().toISOString(),sources:catalog.sources,code_sha:catalog.code_sha,video_sha256:catalog.video_sha256,
    fault_seams:["TESTONLY parent/web tick deferred before claim in this case only", "actual private writer delegated then held after native completed-run readback before queue acknowledgement"],
    recovery:"fresh process executes ordinary cursor-wrap scan and subsequent tick; no cursor/job reset",
    observer_corrections:["attempt1 parent dispatcher won before child; isolated child ownership via explicit fault seam", "attempt2 first recovery scan wrapped durable cursor; record and execute next ordinary tick"],
    case:{id:"SDK-UI-003",condition:"native-worker-SIGKILL-after-private-run-commit-before-queue-publication",repeats:3,hash:createHash("sha256").update("SDK-UI-003:after-private-commit-before-queue-ack:v1").digest("hex"),
      expected:"normal UI upload; real SDK/private writer in separate process; literal SIGKILL after native completed-run readback while job running; fresh process publishes retained result with zero new model calls; current customer report and once per logical notification"},original_case_credit:0},null,2));
  vi.stubEnv("BLUEPRINT_CAPTURE_BUCKET","local-reliability-fixture");
  vi.stubEnv("APP_URL", base); vi.stubEnv("VITE_PUBLIC_APP_URL", base);
  vi.stubEnv("BLUEPRINT_SITE_VIDEO_EVIDENCE_ENABLED", "true");
  vi.stubEnv("BLUEPRINT_SITE_TASK_BRIEF_READING_ENABLED", "false");
  vi.stubEnv("BLUEPRINT_ALL_AUTOMATION_ENABLED", "false");
  vi.stubEnv("BLUEPRINT_DISABLE_LOCAL_ENV_BOOTSTRAP", "true");
  vi.stubEnv("FIELD_ENCRYPTION_KMS_KEY_NAME", "");
  vi.stubEnv("FIELD_ENCRYPTION_MASTER_KEY", Buffer.alloc(32, 7).toString("base64"));
  vi.stubEnv("OPENAI_API_KEY","synthetic-offline-provider"); vi.stubEnv("GEMINI_API_KEY","synthetic-offline-provider");
  const { OpenAIProvider, Usage, setTracingDisabled } = await import("@openai/agents"); setTracingDisabled(true);
  modelSpy = vi.spyOn(OpenAIProvider.prototype,"getModel").mockResolvedValue({async getResponse() {
    providers.calls++; responseIndex++;
    const packet={status:"needs_operator_input",job:[],objects_motions_conditions_variations:[],operator_success:[],known:[],estimates:[],missing:[{text:"A real task and success criteria are not observable from this synthetic test pattern.",basis:"unknown",evidence:[]}],approaches:[],questions:[],next_action:{kind:"ask_operator",action:"Provide a recording of the recurring task",why:{text:"Task evidence remains unknown",basis:"unknown",evidence:[]}}};
    return {output:responseIndex%2===1?[{type:"function_call",callId:"synthetic-video-tool",name:"analyze_site_video",arguments:JSON.stringify({question:"What task evidence is visible?",processing:"auto",sampling_fps:2})}]:[{type:"message",role:"assistant",status:"completed",content:[{type:"output_text",text:JSON.stringify(packet)}]}],usage:new Usage(),providerData:{usage:{input_tokens:20,output_tokens:10}}} as any;
  }, async *getStreamedResponse(){throw Error("unexpected_stream");}} as any);
  videoSpy = vi.spyOn(await import("../agents/adapters/gemini-video"),"analyseAgenticVideo").mockImplementation(async input=>{
    const bytes=Buffer.isBuffer(input.video.body)?input.video.body:Buffer.from(await new Response(input.video.body).arrayBuffer());
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(createHash("sha256").update(fs.readFileSync(fixture)).digest("hex"));
    return {text:JSON.stringify({summary:"Synthetic pattern; no real task evidence",observations:[],not_observable:["Work area", "Task success criteria", "Physical dimensions", "Robot capability"]}),usage:{promptTokenCount:20,candidatesTokenCount:10,thoughtsTokenCount:0,totalTokenCount:30},processing:{mode:"static",sampling_fps_requested:2,media_tool_calls:0,media_tool_responses:0}} as any;
  });
  const localFetch=globalThis.fetch;
  fetchGuard=vi.spyOn(globalThis,"fetch").mockImplementation((url,options)=>{if(new URL(typeof url==="string"?url:url instanceof URL?url.href:url.url).hostname!=="127.0.0.1") throw Error("external_network_refused"); return localFetch(url,options);});
  if (workerPhase) { reloadObjects();await refreshDocumentView();return; }
  if(restartOnly) {
    // TEST ONLY: isolate dispatch into fresh workers while preserving the real
    // producer/intent commit. Default six cases retain their normal web wakeups.
    parentWakeSpy=vi.spyOn(await import("../utils/siteAssessmentQueue"),"tickSiteAssessments")
      .mockImplementation(()=>new Promise<void>(resolve=>deferredParentWakes.push(resolve)));
  }
  const inbound = (await import("../routes/inbound-request")).default;
  const uploads = (await import("../routes/self-capture-uploads")).default;
  const brief = (await import("../routes/site-task-brief")).default;
  const { csrfCookieHandler, csrfProtection } = await import("../middleware/csrf");
  const app = express(); app.use(express.json());
  app.use((req, res, next) => {
    Object.defineProperty(req, "ip", {value: `192.0.2.${restartOnly?3:cases.findIndex(([id]) => id === activeCase) + 1}`});
    const method = req.method, route = req.path.replace(/\/[A-Za-z0-9_-]{80,}\.[A-Za-z0-9_-]+/g, "/[local-token]");
    res.on("finish", () => requests.push({ method, route, status: res.statusCode }));
    next();
  });
  app.get("/api/csrf", csrfCookieHandler);
  app.post("/api/analytics/ingest", (_req, res) => res.sendStatus(204));
  app.use("/api/inbound-request", csrfProtection, inbound);
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
beforeEach(async () => { if(workerPhase)return; await clearEmulator(); resetStorage(); providers.privacy = "cleared"; providers.calls = 0; providers.sent.length = 0;
  providers.errors.length = 0; responseIndex=0; videoSpy.mockClear(); requests.length = 0;
  parentWakeSpy?.mockClear();
  fs.rmSync(path.join(output, "profile"), { recursive: true, force: true });
});

// Same test module in an independent Vitest OS process. Existing actual writers
// and queue execute; the observer pauses only after a verified native commit.
if (workerPhase) it("fresh SDK worker process",async()=>{
  const control=process.env.RELIABILITY_SDK_WORKER_CONTROL!;
  const queue=await import("../utils/siteAssessmentQueue");
  if(workerPhase==="persist-and-pause") {
    const evidence=await import("../agents/private-evidence");const actual=evidence.persistAgentEvidence;
    vi.spyOn(evidence,"persistAgentEvidence").mockImplementation(async(...args)=>{
      await actual(...args);
      if(args[1].collection==="agentRuns" && args[2].status==="completed") {
        const stored=await (database as any).collection("agentRuns").doc(args[1].id).get();
        expect(stored.data()?.status).toBe("completed");await refreshDocumentView();
        const job=[...state.docs].find(([key])=>key.startsWith("siteAssessmentJobs/"))!;
        expect(job[1].state).toBe("running");
        fs.writeFileSync(`${control}-committed.json`,JSON.stringify({schema_version:"sdk_worker_commit.v1",pid:process.pid,phase:workerPhase,job:job[1],run:stored.data(),sol_calls:providers.calls,gem_calls:videoSpy.mock.calls.length,durable:durableSummary()},null,2));
        await new Promise<void>(()=>{});
      }
    });
  }
  const ticks:Record<string,unknown>[]=[];
  await queue.tickSiteAssessments(2);await refreshDocumentView();
  let job=[...state.docs].find(([key])=>key.startsWith("siteAssessmentJobs/"))!;
  ticks.push({state:job[1].state,cursor:state.docs.get("automationCursors/site_assessments"),sol_calls:providers.calls,gem_calls:videoSpy.mock.calls.length});
  if(workerPhase==="recover"&&job[1].state==="running") {
    // The crashed pass retained its scan cursor. The next ordinary empty sweep
    // clears that cursor; another real tick revisits the retained completed run.
    expect(providers.calls).toBe(0);expect(videoSpy).not.toHaveBeenCalled();
    await queue.tickSiteAssessments(2);await refreshDocumentView();job=[...state.docs].find(([key])=>key.startsWith("siteAssessmentJobs/"))!;
    ticks.push({state:job[1].state,cursor:state.docs.get("automationCursors/site_assessments"),sol_calls:providers.calls,gem_calls:videoSpy.mock.calls.length});
  }
  expect(job[1].state).toBe("completed");expect(providers.calls).toBe(0);expect(videoSpy).not.toHaveBeenCalled();
  fs.writeFileSync(`${control}-recovered.json`,JSON.stringify({schema_version:"sdk_worker_recovery.v1",pid:process.pid,phase:workerPhase,ticks,job:job[1],sol_calls:providers.calls,gem_calls:videoSpy.mock.calls.length,durable:durableSummary()},null,2));
});

if(restartOnly&&!workerPhase) describe("fresh worker restart joined customer path",()=>{
 for(let repeat=1;repeat<=3;repeat++) it(`SDK-UI-003 after-private-commit worker restart repeat${repeat}`,async()=>{
  activeCase="SDK-UI-003";const started=Date.now();let result="failed",child:ChildProcess|undefined;
  const control=path.join(retained,`worker-${repeat}`);const workerReceipts:Record<string,unknown>[]=[];const processEvidence:Record<string,unknown>[]=[];
  const launch=(phase:string)=>{
    const env:Record<string,string>={};for(const key of["PATH","HOME","TMPDIR"])if(process.env[key])env[key]=process.env[key]!;
    Object.assign(env,{NODE_ENV:"test",BLUEPRINT_DISABLE_LOCAL_ENV_BOOTSTRAP:"true",RELIABILITY_FIRESTORE_EMULATOR:"1",FIRESTORE_EMULATOR_HOST:"127.0.0.1:8085",RELIABILITY_ASSESSMENT_ONLY:"1",RELIABILITY_ASSESSMENT_RESTART_ONLY:"1",RELIABILITY_SDK_WORKER_PHASE:phase,RELIABILITY_SDK_WORKER_CONTROL:control});
    const fd=fs.openSync(`${control}-${phase}.log`,"w");
    child=spawn(process.execPath,["node_modules/vitest/vitest.mjs","run","--config","vitest.reliability-program.config.ts","--pool=forks","--maxWorkers=1","--minWorkers=1","-t","fresh SDK worker process"],{env,stdio:["ignore",fd,fd]});fs.closeSync(fd);
    return child;
  };
  try{
    await openBrowser();await context.tracing.start({screenshots:true,snapshots:true});await fill();
    await page.getByRole("button",{name:"Start free assessment",exact:true}).click();
    await vi.waitFor(async()=>{await refreshDocumentView();expect(requestRows()).toHaveLength(1);expect([...state.docs.values()].some(row=>row.schema_version==="site_assessment_job.v1"&&row.state==="queued")).toBe(true);},{timeout:20000});
    const requestId=requestRows()[0][0].split("/")[1];expect(providers.calls).toBe(0);expect(videoSpy).not.toHaveBeenCalled();
    const first=launch("persist-and-pause");
    await vi.waitFor(()=>{if(first.exitCode!==null)throw Error(`worker exited before checkpoint ${first.exitCode}`);expect(fs.existsSync(`${control}-committed.json`)).toBe(true);},{timeout:40000});
    const committed=JSON.parse(fs.readFileSync(`${control}-committed.json`,"utf8"));expect(committed.pid).not.toBe(process.pid);expect(committed.sol_calls).toBe(2);expect(committed.gem_calls).toBe(1);workerReceipts.push(committed);
    // The Vitest fork hosting the actual SDK is killed, then its launcher reaps it.
    const actualParent=Number(execFileSync("ps",["-p",String(committed.pid),"-o","ppid="],{encoding:"utf8"}).trim());expect(actualParent).toBe(first.pid);
    processEvidence.push({launcher_pid:first.pid,worker_pid:committed.pid,worker_ppid:actualParent,signal:"SIGKILL",at:new Date().toISOString()});
    process.kill(committed.pid,"SIGKILL");await new Promise<void>(resolve=>first.once("exit",code=>{processEvidence.push({launcher_pid:first.pid,exit_code:code});resolve();}));
    await refreshDocumentView();const preAck=[...state.docs.values()].find(row=>row.schema_version==="site_assessment_job.v1")!;expect(preAck.state).toBe("running");
    const second=launch("recover");await new Promise<void>((resolve,reject)=>{second.once("error",reject);second.once("exit",code=>code===0?resolve():reject(Error(`recovery worker exited ${code}`)));});
    const recovered=JSON.parse(fs.readFileSync(`${control}-recovered.json`,"utf8"));expect(recovered.pid).not.toBe(committed.pid);expect(recovered.pid).not.toBe(process.pid);expect(recovered.job.run_id).toBe(committed.job.run_id);expect(recovered.sol_calls).toBe(0);expect(recovered.gem_calls).toBe(0);workerReceipts.push(recovered);processEvidence.push({launcher_pid:second.pid,worker_pid:recovered.pid,phase:"recover",exit_code:second.exitCode});
    reloadObjects();await refreshDocumentView();
    await vi.waitFor(async()=>expect(page.url().includes("/capture-upload/")||await page.locator('a[href*="/capture-upload/"]').count()>0).toBe(true),{timeout:20000});
    const href=page.url().includes("/capture-upload/")?page.url():await page.locator('a[href*="/capture-upload/"]').first().getAttribute("href");await page.goto(href!);
    const token=href!.split("/capture-upload/")[1].split("?")[0];
    const status=await page.evaluate(async token=>{const response=await fetch(`/api/site-task-brief/${token}/status`);return{http:response.status,body:await response.json()};},token);
    expect(status.http).toBe(200);expect(status.body.siteAdvisory.state).toBe("ready");expect(status.body.status.stage).not.toBe("completed");
    await page.reload();await page.getByRole("heading",{name:"What remains uncertain",exact:true}).waitFor();
    const {hydrateAgentEvidence}=await import("../agents/private-evidence");const raw=await(database as any).collection("agentRuns").doc(recovered.job.run_id).get();
    const hydrated=await hydrateAgentEvidence(raw.data(),{collection:"agentRuns",id:recovered.job.run_id});expect(hydrated.artifacts.site_assessment_packet_sha256).toBe(recovered.job.packet_sha256);expect(hydrated.artifacts.capture_inference_reservations).toHaveLength(3);
    await retainNativeAccounting(hydrated,retained,`${activeCase}-${repeat}`);
    expect(requestRows()).toHaveLength(1);expect(requestRows()[0][0]).toBe(`inboundRequests/${requestId}`);expect(providers.calls).toBe(0);expect(videoSpy).not.toHaveBeenCalled();
    const {deliverOutbox}=await import("../utils/captureOutbox");await deliverOutbox();await deliverOutbox();await refreshDocumentView();
    const notices=[...state.docs.values()].filter(row=>["task_received","video_received"].includes(row.kind as string)&&row.status==="sent");expect(notices.filter(row=>row.kind==="task_received")).toHaveLength(1);expect(notices.filter(row=>row.kind==="video_received")).toHaveLength(1);
    expect(providers.sent.filter(row=>row.to==="sdk-ui-003@example.com").map(row=>row.subject).sort()).toEqual(notices.map(row=>row.subject).sort());
    fs.writeFileSync(`${control}-customer-result.json`,JSON.stringify({requestId,job:recovered.job,run:hydrated,status:status.body,durable:durableSummary()},null,2));result="passed";
  }catch(error){
    fs.writeFileSync(path.join(retained,`SDK-UI-003-${repeat}-primary-error.txt`),String(error instanceof Error?error.stack:error));throw error;
  }finally{
    if(child&&child.exitCode===null)child.kill("SIGTERM");await refreshDocumentView();
    if(page&&!page.isClosed())await page.screenshot({path:path.join(retained,`SDK-UI-003-${repeat}-${result}.png`)}).catch(()=>{});
    await context?.tracing.stop({path:path.join(retained,`SDK-UI-003-${repeat}-trace.zip`)}).catch(()=>{});
    traces.push({id:"SDK-UI-003",repeat,result,latency_ms:Date.now()-started,worker_restart:true,worker_receipts:workerReceipts,process_evidence:processEvidence,parent_web_wake_deferred_testonly:true,parent_wakes:parentWakeSpy.mock.calls.length,parent_model_calls:providers.calls,parent_gem_calls:videoSpy.mock.calls.length,transitions:structuredClone(requests),errors:[...providers.errors],durable:durableSummary()});await stopBrowser();
  }
 });
});
afterAll(async()=>{
  await stopBrowser(); vite?.kill("SIGTERM"); if(server){server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
  const report={schema_version:"sdk_browser_results.v1",generated_unique:restartOnly?1:2,deduplicated_unique:restartOnly?1:2,attempted_unique:new Set(traces.map(row=>row.id)).size,attempted:traces.length,passed:traces.filter(row=>row.result==="passed").length,failed:traces.filter(row=>row.result!=="passed").length,live_provider_calls:0,live_cost_usd:0,simulated_cost_usd:null,traces};
  fs.writeFileSync(path.join(retained,"results.json"),JSON.stringify(report,null,2));
  parentWakeSpy?.mockRestore();for(const resolve of deferredParentWakes)resolve();modelSpy?.mockRestore();videoSpy?.mockRestore();fetchGuard?.mockRestore();if(emulatorMode)await (database as any).terminate();vi.unstubAllEnvs();
});
if(!restartOnly&&!workerPhase) describe("supplemental normal UI through native persistence and actual SDK",()=>{
 for(const [id,kind] of cases) for(let repeat=1;repeat<=3;repeat++) it(`${id} ${kind} repeat${repeat}`,async()=>{
  activeCase=id;const started=Date.now();let result="failed";
  try {
   await openBrowser(); await context.tracing.start({screenshots:true,snapshots:true}); await fill();
   if(kind==="browser_termination_upload_return") faults.holdVideoWrites=true;
   await page.getByRole("button",{name:"Start free assessment",exact:true}).click();
   await vi.waitFor(async()=>{await refreshDocumentView();expect(requestRows()).toHaveLength(1);},{timeout:20000});
   const requestId=requestRows()[0][0].split("/")[1];
   if(kind==="browser_termination_upload_return") {
    await vi.waitFor(()=>expect(faults.videoWriteReached).toBe(true),{timeout:20000});
    expect([...state.docs.keys()].filter(key=>key.startsWith("siteAssessmentJobs/"))).toHaveLength(0);
    fs.writeFileSync(path.join(retained,`${id}-${repeat}-before-termination.json`),JSON.stringify({boundary:"video object write reached, not acknowledged",durable:durableSummary(),documents:[...state.docs]},null,2));
    await context.tracing.stop({path:path.join(retained,`${id}-${repeat}-before-termination-trace.zip`)});
    await stopBrowser("SIGKILL"); releaseVideoWrites();
    await vi.waitFor(async()=>{await refreshDocumentView();expect([...state.docs.values()].some(row=>(row.browser_pending_delivery as any)?.state==="published")).toBe(true);},{timeout:20000});
    reloadObjects();await openBrowser();await context.tracing.start({screenshots:true,snapshots:true});await page.goto(`${base}/contact/site-operator`);
    await page.getByRole("button",{name:"Return to saved job",exact:true}).click();
   }
   await vi.waitFor(async()=>expect(page.url().includes("/capture-upload/") || await page.locator('a[href*="/capture-upload/"]').count()>0).toBe(true),{timeout:20000});
   const href=page.url().includes("/capture-upload/")?page.url():await page.locator('a[href*="/capture-upload/"]').first().getAttribute("href");await page.goto(href!);
   const token=href!.split("/capture-upload/")[1].split("?")[0];
   const read=()=>page.evaluate(async token=>{const r=await fetch(`/api/site-task-brief/${token}/status`);return {http:r.status,body:await r.json()};},token);
   const queue=await import("../utils/siteAssessmentQueue");
   await vi.waitFor(async()=>{await queue.tickSiteAssessments(2);await refreshDocumentView();const jobs=[...state.docs].filter(([key])=>key.startsWith("siteAssessmentJobs/"));expect(jobs).toHaveLength(1);expect(jobs[0][1].state,JSON.stringify({job:jobs[0][1],errors:providers.errors})).toBe("completed");},{timeout:30000});
   const job=[...state.docs].find(([key])=>key.startsWith("siteAssessmentJobs/"))!;
   const run=await (database as any).collection("agentRuns").doc(job[1].run_id).get();expect(run.data()?.status).toBe("completed");
   const {hydrateAgentEvidence}=await import("../agents/private-evidence");const hydrated=await hydrateAgentEvidence(run.data(),{collection:"agentRuns",id:job[1].run_id as string});
   expect(hydrated.artifacts.source_admission).toMatchObject({advisory_job_id:job[0].split("/")[1],context_digest:job[1].context_digest,source_key:job[1].source_key});
   expect(hydrated.artifacts.site_assessment_packet_sha256).toBe(job[1].packet_sha256);expect(hydrated.artifacts.capture_inference_reservations).toHaveLength(3);
    await retainNativeAccounting(hydrated,retained,`${activeCase}-${repeat}`);
   const status=await read();expect(status.http).toBe(200);expect(status.body.siteAdvisory.state).toBe("ready");expect(status.body.status.stage).not.toBe("completed");
   await page.reload(); await page.getByRole("heading",{name:"What remains uncertain",exact:true}).waitFor();
   expect(await page.locator("body").innerText()).toContain("Some job facts and interpretations remain unresolved.");expect(await page.locator("body").innerText()).not.toMatch(/raw_model_assessment|gs:\/\//);
   const {deliverOutbox}=await import("../utils/captureOutbox");await deliverOutbox();await deliverOutbox();await refreshDocumentView();
   const customer=[...state.docs.values()].filter(row=>["task_received","video_received"].includes(row.kind as string)&&row.status==="sent");
   expect(customer.filter(row=>row.kind==="task_received")).toHaveLength(1);expect(customer.filter(row=>row.kind==="video_received")).toHaveLength(1);
   const customerMails=providers.sent.filter(row=>row.to===`${id.toLowerCase()}@example.com`);
   expect(customerMails.map(row=>row.subject).sort()).toEqual(customer.map(row=>row.subject).sort());
   expect(requestRows()).toHaveLength(1);expect(requestRows()[0][0]).toBe(`inboundRequests/${requestId}`);expect(providers.calls).toBe(2);expect(videoSpy).toHaveBeenCalledTimes(1);
   await queue.reconcileSiteAssessments();expect(providers.calls).toBe(2);expect(videoSpy).toHaveBeenCalledTimes(1);
   fs.writeFileSync(path.join(retained,`${id}-${repeat}-private-result.json`),JSON.stringify({job:job[1],run:hydrated,status:status.body,durable:durableSummary()},null,2));
   result="passed";
  }catch(error){
    fs.writeFileSync(path.join(retained,`${id}-${repeat}-primary-error.txt`),String(error instanceof Error?error.stack:error));throw error;
  }finally{
   await refreshDocumentView();if(page&&!page.isClosed()){await page.screenshot({path:path.join(retained,`${id}-${repeat}-${result}.png`)}).catch(()=>{});fs.writeFileSync(path.join(retained,`${id}-${repeat}-screen.txt`),await page.locator("body").innerText().catch(()=>"unavailable"));}
   await context?.tracing.stop({path:path.join(retained,`${id}-${repeat}-trace.zip`)}).catch(()=>{});
   traces.push({id,repeat,condition:kind,result,latency_ms:Date.now()-started,sol_calls_scripted:providers.calls,gemini_calls_scripted:videoSpy.mock.calls.length,local_mails:structuredClone(providers.sent),transitions:structuredClone(requests),errors:[...providers.errors],durable:durableSummary(),browser_termination:kind==="browser_termination_upload_return"?"literal SIGKILL before object acknowledgement / same native profile":"none",worker_restart:false});
   releaseVideoWrites();await stopBrowser();
  }
 });
});

// Supplemental accounting-runtime observer; the three frozen journeys are unchanged.
async function retainNativeAccounting(hydrated:any,directory:string,caseAttempt:string) {
 const admission=hydrated.artifacts.source_admission;
 const {humanDecisionDigest}=await import("../utils/human-reply-admission");
 const ref=(database as any).collection("captureCoverageReviews").doc(`budget-${humanDecisionDigest({capture_id:admission.capture_id})}`);
 const aggregate=(await ref.get()).data();const snapshots=await ref.collection("calls").get();
 const calls=snapshots.docs.map((doc:any)=>({id:doc.id,...doc.data()}));expect(calls).toHaveLength(3);
 for(const call of calls){expect(call.schema_version).toBe("capture_inference_call.v1");expect(call.id).toBe(call.admission_token);
  expect(call.request_id).toBe(admission.request_id);expect(call.capture_id).toBe(admission.capture_id);expect(call.run_id).toBe(hydrated.id);
  expect(call.context_digest).toBe(admission.context_digest);expect(call.video_sha256).toBe(admission.video_sha256);
  expect(call.source_digest).toBe(humanDecisionDigest({kind:"browser_pending",key:admission.source_key}));
  expect(["recorded","unknown"]).toContain(call.state);expect(call.raw_usage).not.toBeNull();expect(call.reserved_usd).toBeGreaterThan(0);
  if(call.state==="recorded")expect(Number.isFinite(call.cost_estimate_usd)).toBe(true);else expect(call.cost_estimate_usd).toBeNull();
 }
 expect(calls.filter((call:any)=>call.provider==="openai")).toHaveLength(2);expect(calls.filter((call:any)=>call.provider==="gemini")).toHaveLength(1);
 expect(aggregate.calls).toBe(3);expect(aggregate.pending_token).toBeNull();expect(aggregate.cap_usd).toBeNull();
 expect(hydrated.artifacts.capture_inference_reservations.every((row:any)=>row.spending_gated===false&&row.cap_usd===null)).toBe(true);
 fs.writeFileSync(path.join(directory,`${caseAttempt}-native-accounting.json`),JSON.stringify({aggregate,call_collection:ref.path+"/calls",calls,reservations:hydrated.artifacts.capture_inference_reservations},null,2));
}
