// @vitest-environment node
import { createServer, type Server } from "node:http";
import express from "express";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHash } from "node:crypto";
import { buildBrowserDelivery } from "../utils/websiteCaptureDelivery";
import { projectWebsiteTaskContext, projectWebsiteCaptureRights } from "../utils/websiteTaskContext";
import { crossRuntimeArtifactDigest, crossRuntimeDigest } from "../utils/crossRuntimeCanonical";
import { buildPipelineSyncSignature } from "../utils/pipelineSyncSecurity";
import oldPipelineRouter from "../routes/internal-capture-worlds";
import { createWebsitePreparationRouter, websitePreparationRawBody } from "../routes/internal-website-preparation";
import { canNotifyCurrentWebsitePreparationIssue, drainPendingWebsitePreparationNotifications,
  loadCurrentWebsitePreparationStatus, mergeWebsitePreparationStatus, syncWebsitePreparationStatus,
  websitePreparationEventId, websitePreparationSelectorSchema, type WebsitePreparationDeps, type WebsitePreparationReceipt,
  type WebsitePreparationSelector, type StoredWebsitePreparation } from "../utils/websitePreparationStatus";

// Production verifier controls use in-memory Firestore/GCS and a retained observer projection.
// No real database, credentials, transport, provider or mail is used.
const runtime = vi.hoisted(() => ({records: new Map<string, any>(), objects: new Map<string, {metadata: any; bytes: Buffer}>(),
  observation: null as any, beforeTransaction: null as (() => void) | null, txReads: [] as string[], txWrites: 0}));
vi.mock("../../client/src/lib/firebaseAdmin", async original => {
  const actual = await original<typeof import("../../client/src/lib/firebaseAdmin")>();
  const snap = (key: string) => ({exists: runtime.records.has(key), data: () => runtime.records.get(key)});
  const query = (field: string, _operator: string, value: unknown) => ({field, value,
    bound:100, cursor:"", limit(bound:number){this.bound=bound;return this;},orderBy(){return this;},
    startAfter(cursor:string){this.cursor=cursor;return this;},async get() {
    const docs = [...runtime.records.entries()].filter(([key, row]) => key.startsWith("captureUploadSessions/")
      && field.split(".").reduce((v: any, part: string) => v?.[part], row) === value)
      .sort(([a],[b])=>a.localeCompare(b)).filter(([key])=>key.split("/")[1]>this.cursor).slice(0,this.bound)
      .map(([key]) => ({...snap(key),id:key.split("/")[1]}));return {docs};
  }});
  const store = {collection(collection: string) {return {doc(id: string) {const key = `${collection}/${id}`;
    return {key,async get(){return snap(key);},async set(value:any){runtime.records.set(key,{...runtime.records.get(key),...value});}};},where:query};},
    async runTransaction(action: (tx:any)=>Promise<unknown>) {
      runtime.beforeTransaction?.(); const writes: [string,any][]=[];
      const tx={async get(ref:any){runtime.txReads.push(ref.key??ref.field); return ref.key?snap(ref.key):ref.get();},
        set(ref:any,value:any){writes.push([ref.key,value]);}};
      const result=await action(tx);for(const [key,value] of writes){runtime.records.set(key,{...runtime.records.get(key),...value});runtime.txWrites++;}
      return result;
    }};
  return {...actual, dbAdmin: store, storageAdmin: {bucket() {
    return {file(name: string, options?: {generation?: string}) {
      const read = () => {
        const row = runtime.objects.get(name);
        if (!row || options?.generation && options.generation !== row.metadata.generation)
          throw Object.assign(Error("missing"), {code: 404});
        return row;
      };
      return {async getMetadata() {return [read().metadata];}, async download() {return [read().bytes];}};
    }};
  }}};
});
vi.mock("../utils/websiteCaptureOwnerTransport", () => ({withWebsiteOwnerDeps:async (_ms:number,action:(deps:any)=>Promise<unknown>)=>action({})}));
vi.mock("../utils/websiteCaptureOwnerObservation", () => ({observeWebsiteCaptureOwner:async()=>runtime.observation}));

const selector: WebsitePreparationSelector = {request_id: "r1", scene_id: "site-r1", capture_id: "walkthrough-r1",
  completion_marker_generation: "90071992547409931", producer_delivery_key: `sha256:${"a".repeat(64)}`,
  source_payload_sha256: "b".repeat(64), task_context_digest: `sha256:${"c".repeat(64)}`};
const codes = {preparing:"preparation_in_progress",awaiting_inputs:"preparation_inputs_pending",
  failed_retryable:"preparation_retryable_failure",authority_ended:"preparation_authority_ended",handed_off:"preparation_handed_off"};
function receipt(state: WebsitePreparationReceipt["state"] = "failed_retryable", attempt = 1, revision = 3,
  selected = selector): WebsitePreparationReceipt {
  const value = {...selected, schema_version:"website_preparation_status.v1" as const, state, code:codes[state],
    attempt_count:attempt, revision, correlation_id:crossRuntimeDigest({selected,attempt,revision})};
  return {...value,status_digest:crossRuntimeArtifactDigest(value,"status_digest")};
}
function harness(expectedSelector = selector) {
  let stored: StoredWebsitePreparation | null = null;
  let canonical: unknown = receipt("failed_retryable",1,3,expectedSelector); let unavailable = false; let authorized = true;
  let fingerprint = "current-source"; let reads = 0; let beforeCommit: (()=>void)|null = null;
  let changeAtSecondRead: unknown = null; const notices = new Map<string, unknown>();
  const deps: WebsitePreparationDeps = {
    async readLedger() {reads++;if(unavailable)throw Error("private raw provider error /unsafe/path");
      return reads%2===0 && changeAtSecondRead ? changeAtSecondRead : canonical;},
    async verifyCurrent(input) {if(!authorized||crossRuntimeDigest(input)!==crossRuntimeDigest(expectedSelector))throw Error("stale_source");
      return {fingerprint,owner:"owner1"};},
    async readStored() {return stored;},
    async commit(input,status,authority) {beforeCommit?.();if(!authorized||fingerprint!==authority.fingerprint)throw Error("authority_changed");
      stored=mergeWebsitePreparationStatus(stored,input,status);},
    async pending() {return stored?.notification?.state==="pending" ? [stored] : [];},
    async acknowledge(_capture,eventId) {if(stored?.notification?.eventId===eventId) stored={...stored,notification:{eventId,state:"enqueued"}};},
    async findEvent(requestId,eventId) {return stored?.selector.request_id===requestId&&stored.notification?.eventId===eventId ? stored : null;},
  };
  return {deps,notices,get stored(){return stored;},get reads(){return reads;},
    ledger(v:unknown){canonical=v;},unavailable(){unavailable=true;},revoke(){authorized=false;},
    sourceChange(){fingerprint="new-source";},race(f:()=>void){beforeCommit=f;},
    unstable(v:unknown){changeAtSecondRead=v;},
    enqueue:vi.fn(async (intent:{eventId:string})=> {notices.set(intent.eventId,intent);return "enqueued" as const;})};
}
let server: Server|null=null;
afterEach(async()=>{if(server){await new Promise<void>(resolve=>server!.close(()=>resolve()));server=null;}vi.unstubAllEnvs();vi.unstubAllGlobals();runtime.beforeTransaction=null;});
beforeEach(()=>{vi.stubEnv("PIPELINE_SYNC_TOKEN","isolated-test-secret");vi.stubEnv("PIPELINE_SYNC_ALLOW_LEGACY_BEARER","true");});
async function route(h:ReturnType<typeof harness>, body:string|Buffer=JSON.stringify(selector), headers:Record<string,string>={}, mount=true, capture="walkthrough-r1") {
  const app=express();app.use(websitePreparationRawBody);
  const globalJson=express.json();app.use((req,res,next)=>{
    if ((req as typeof req & {websitePreparationBodyAdmitted?:boolean}).websitePreparationBodyAdmitted) return next();
    return globalJson(req,res,next);
  });
  if(mount && process.env.RELIABILITY_PREPARATION_BASELINE !== "1") app.use("/api/internal/pipeline",createWebsitePreparationRouter(h.deps));
  else app.use("/api/internal/pipeline", oldPipelineRouter);
  server=createServer(app);await new Promise<void>(resolve=>server!.listen(0,"127.0.0.1",resolve));
  const address=server.address();if(!address||typeof address==="string")throw Error("missing_port");
  const timestamp=new Date().toISOString();
  const signed={"content-type":"application/json","X-Blueprint-Pipeline-Timestamp":timestamp,
    "X-Blueprint-Pipeline-Signature":buildPipelineSyncSignature({secret:"isolated-test-secret",timestamp,body:body.toString()})};
  return fetch(`http://127.0.0.1:${address.port}/api/internal/pipeline/creator-captures/${capture}/preparation-status`,
    {method:"POST",body:body as BodyInit,headers:{...signed,...headers}});
}

describe("source-bound preparation contract v1: local isolated replay",()=>{
  it("PREP-001 absent baseline callback cannot publish the actual retryable failure",async()=>{
    const h=harness();const response=await route(h,JSON.stringify(selector),{},false);
    expect(response.status).toBe(404);expect(h.stored).toBeNull();expect(await loadCurrentWebsitePreparationStatus("r1","walkthrough-r1",h.deps))
      .toEqual({state:"unavailable",correlationId:null});
  });
  it("PREP-002 signed callback rereads ledger and commits sanitized retryable hold plus intent",async()=>{
    const h=harness();const response=await route(h);expect(response.status).toBe(200);
    expect(await response.json()).toEqual({schema_version:"website_preparation_status_acceptance.v1",
      accepted:true,...selector,status_digest:receipt().status_digest,state:"failed_retryable",native_execution_complete:false,
      correlation_id:`bp-prep-${receipt().status_digest.slice(7,23)}`});
    expect(h.reads).toBe(2);expect(h.stored?.notification?.state).toBe("pending");
    expect(h.stored).not.toHaveProperty("world_reconstruction");expect(h.stored).not.toHaveProperty("assessment");
  });
  it("PREP-003 status truth in callback is rejected rather than trusted",async()=>{
    const h=harness();const response=await route(h,JSON.stringify({...selector,state:"handed_off"}));
    expect(response.status).toBe(400);expect(h.reads).toBe(0);expect(h.stored).toBeNull();
  });
  it("PREP-004 legacy bearer is rejected even when globally enabled",async()=>{
    const h=harness();const response=await route(h,JSON.stringify(selector),{"X-Blueprint-Pipeline-Timestamp":"",
      "X-Blueprint-Pipeline-Signature":"","X-Blueprint-Pipeline-Token":"isolated-test-secret"});
    expect(response.status).toBe(401);expect(h.stored).toBeNull();
  });
  it("PREP-005 modified raw bytes cannot reach ledger",async()=>{
    const h=harness();const response=await route(h,JSON.stringify(selector),{"X-Blueprint-Pipeline-Signature":"a".repeat(64)});
    expect(response.status).toBe(401);expect(h.reads).toBe(0);
  });
  it("PREP-006 escaped duplicate keys rejected before source processing",async()=>{
    const h=harness();const body=JSON.stringify(selector).replace('"request_id":"r1",','"request_id":"r1","request\\u005fid":"r1",');
    expect((await route(h,body)).status).toBe(400);expect(h.reads).toBe(0);
  });
  it("PREP-007 wrong capture callback cannot mutate requested source",async()=>{
    const h=harness();expect((await route(h,JSON.stringify({...selector,capture_id:"walkthrough-other"}))).status).toBe(400);
    expect(h.stored).toBeNull();
  });
  it("PREP-008 unstable latest ledger is unavailable, not a current failure",async()=>{
    const h=harness();h.unstable(receipt("preparing",2,4));await expect(syncWebsitePreparationStatus(selector,h.deps)).rejects.toThrow();
    expect(h.stored).toBeNull();
  });
  it("PREP-009 callback restart/replay preserves one logical notification",async()=>{
    const h=harness();await syncWebsitePreparationStatus(selector,h.deps);
    expect(await drainPendingWebsitePreparationNotifications(h.enqueue,h.deps)).toEqual({enqueued:1,pending:0});
    await syncWebsitePreparationStatus(selector,h.deps);h.ledger(receipt("failed_retryable",2,6));
    await syncWebsitePreparationStatus(selector,h.deps);
    expect(await drainPendingWebsitePreparationNotifications(h.enqueue,h.deps)).toEqual({enqueued:0,pending:0});
    expect(h.notices.size).toBe(1);expect(await canNotifyCurrentWebsitePreparationIssue("r1",websitePreparationEventId(selector),h.deps)).toBe(true);
  });
  it("PREP-010 enqueue uncertainty survives process replacement and safe retry",async()=>{
    const h=harness();await syncWebsitePreparationStatus(selector,h.deps);
    expect(await drainPendingWebsitePreparationNotifications(async()=>"unavailable",h.deps)).toEqual({enqueued:0,pending:1});
    expect(h.stored?.notification?.state).toBe("pending");
    expect(await drainPendingWebsitePreparationNotifications(h.enqueue,{...h.deps})).toEqual({enqueued:1,pending:0});
  });
  it("PREP-011 newest claimed attempt replaces old failure in customer poll",async()=>{
    const h=harness();await syncWebsitePreparationStatus(selector,h.deps);h.ledger(receipt("preparing",2,4));
    expect((await loadCurrentWebsitePreparationStatus("r1","walkthrough-r1",h.deps)).state).toBe("preparing");
    expect(await canNotifyCurrentWebsitePreparationIssue("r1",websitePreparationEventId(selector),h.deps)).toBe(false);
  });
  it("PREP-012 lost canonical access hides retained failure and denies dispatch",async()=>{
    const h=harness();await syncWebsitePreparationStatus(selector,h.deps);h.unavailable();
    expect(await loadCurrentWebsitePreparationStatus("r1","walkthrough-r1",h.deps)).toEqual({state:"unavailable",correlationId:null});
    await expect(canNotifyCurrentWebsitePreparationIssue("r1",websitePreparationEventId(selector),h.deps)).rejects.toThrow("website_preparation_unavailable");
    expect(await drainPendingWebsitePreparationNotifications(h.enqueue,h.deps)).toEqual({enqueued:0,pending:1});expect(h.enqueue).not.toHaveBeenCalled();
  });
  it("PREP-013 withdrawal before callback prevents persistence",async()=>{
    const h=harness();h.revoke();await expect(syncWebsitePreparationStatus(selector,h.deps)).rejects.toThrow();expect(h.stored).toBeNull();
  });
  it("PREP-014 withdrawal after observation is transactionally refused",async()=>{
    const h=harness();h.race(()=>h.revoke());await expect(syncWebsitePreparationStatus(selector,h.deps)).rejects.toThrow();expect(h.stored).toBeNull();
  });
  it("PREP-015 source replacement after observation is transactionally refused",async()=>{
    const h=harness();h.race(()=>h.sourceChange());await expect(syncWebsitePreparationStatus(selector,h.deps)).rejects.toThrow();expect(h.stored).toBeNull();
  });
  it("PREP-016 old source cannot bootstrap an empty current status",async()=>{
    const h=harness();await expect(syncWebsitePreparationStatus({...selector,completion_marker_generation:"1"},h.deps)).rejects.toThrow();expect(h.stored).toBeNull();
  });
  it("PREP-017 old context cannot bootstrap a current source",async()=>{
    const h=harness();await expect(syncWebsitePreparationStatus({...selector,task_context_digest:`sha256:${"d".repeat(64)}`},h.deps)).rejects.toThrow();expect(h.stored).toBeNull();
  });
  it("PREP-018 lower attempt cannot replace current preparing",async()=>{
    const h=harness();h.ledger(receipt("preparing",2,6));await syncWebsitePreparationStatus(selector,h.deps);
    h.ledger(receipt());await expect(syncWebsitePreparationStatus(selector,h.deps)).rejects.toThrow();expect(h.stored?.status.state).toBe("preparing");
  });
  it("PREP-019 same revision cannot change meaning or digest",async()=>{
    const h=harness();await syncWebsitePreparationStatus(selector,h.deps);h.ledger(receipt("handed_off",1,3));
    await expect(syncWebsitePreparationStatus(selector,h.deps)).rejects.toThrow();expect(h.stored?.status.state).toBe("failed_retryable");
  });
  it("PREP-020 handed-off canonical stage is not native completion",async()=>{
    const h=harness();h.ledger(receipt("handed_off"));const response=await route(h);expect(await response.json()).toMatchObject({state:"handed_off",native_execution_complete:false});
    expect(h.stored?.notification).toBeNull();
  });
  it("PREP-021 awaiting prerequisite stays awaiting and is not terminal failure",async()=>{
    const h=harness();h.ledger(receipt("awaiting_inputs"));await syncWebsitePreparationStatus(selector,h.deps);
    expect((await loadCurrentWebsitePreparationStatus("r1","walkthrough-r1",h.deps)).state).toBe("awaiting_inputs");
  });
  it("PREP-022 malformed canonical receipt cannot publish safe-looking failure",async()=>{
    const h=harness();h.ledger({...receipt(),provider_error:"secret path"});expect((await route(h)).status).toBe(503);expect(h.stored).toBeNull();
  });
  it("PREP-023 withdrawn intent cannot enqueue despite retained valid failure",async()=>{
    const h=harness();await syncWebsitePreparationStatus(selector,h.deps);h.revoke();
    expect(await drainPendingWebsitePreparationNotifications(h.enqueue,h.deps)).toEqual({enqueued:0,pending:1});expect(h.enqueue).not.toHaveBeenCalled();
  });
  it("PREP-024 wrong-account reader does not disclose persisted failure",async()=>{
    const h=harness();await syncWebsitePreparationStatus(selector,h.deps);
    expect(await loadCurrentWebsitePreparationStatus("other","walkthrough-r1",h.deps)).toEqual({state:"unavailable",correlationId:null});
    expect(await canNotifyCurrentWebsitePreparationIssue("other",websitePreparationEventId(selector),h.deps)).toBe(false);
  });
  it("PREP-025 failed route returns only safe retry diagnosis",async()=>{
    const h=harness();h.unavailable();const response=await route(h);expect(response.status).toBe(503);
    const rejected=await response.json();expect(rejected).toEqual({code:"website_preparation_status_unavailable"});
    expect(rejected).not.toHaveProperty("accepted");expect(h.stored).toBeNull();
  });
});

function productionFixture() {
  runtime.records.clear();runtime.objects.clear();runtime.beforeTransaction=null;runtime.txReads=[];runtime.txWrites=0;
  const sha=(bytes:Buffer)=>`sha256:${createHash("sha256").update(bytes).digest("hex")}`;
  const request={account_owner_uid:"owner1",request:{buyerType:"site_operator",capture_mode:"self_capture",consent_attestation:{
    granted:true,statement_version:"2026-09-18.v1",recorded_at_iso:"2026-09-29T00:00:00.000Z"}}};
  const brief={requestId:"r1",summary:"Move sealed cartons",confirmedAtIso:"2026-09-29T00:00:00.000Z",operatorAnswers:{},unresolved:[]};
  const prefix="scenes/site-r1/captures/walkthrough-r1/raw";
  const video={object_name:`${prefix}/walkthrough.mp4`,generation:"90071992547409932",size_bytes:7,crc32c:"AAAAAA=="};
  const manifestBytes=Buffer.from(JSON.stringify({request_id:"r1",scene_id:"site-r1",capture_id:"walkthrough-r1",
    capture_rights:projectWebsiteCaptureRights(request),video_uri:video.object_name}));
  const manifest={object_name:`${prefix}/manifest.json`,generation:"90071992547409933",size_bytes:manifestBytes.length,
    crc32c:"AAAAAA==",sha256:sha(manifestBytes)};
  const pending={schema_version:"website_browser_pending.v1",request_id:"r1",scene_id:"site-r1",capture_id:"walkthrough-r1",
    state:"published",video,manifest,completed_at_iso:"2026-09-29T00:00:00.000Z"};
  const delivery=buildBrowserDelivery({requestId:"r1",sceneId:"site-r1",captureId:"walkthrough-r1",rawPrefix:prefix,
    video,manifest,completedAtIso:pending.completed_at_iso});
  const add=(name:string,generation:string,bytes:Buffer)=>runtime.objects.set(name,{metadata:{name,generation,size:String(bytes.length),crc32c:"AAAAAA=="},bytes});
  add(video.object_name,video.generation,Buffer.from("video-1"));add(manifest.object_name,manifest.generation,manifestBytes);
  add(`${prefix}/capture_upload_complete.json`,selector.completion_marker_generation,delivery.markerBytes);
  add(delivery.objectName,"90071992547409934",delivery.recordBytes);
  runtime.records.set("inboundRequests/r1",request);runtime.records.set("siteTaskBriefs/r1",brief);
  runtime.records.set("captureUploadSessions/walkthrough-r1",{browser_pending_delivery:pending});
  runtime.observation={capture_rights:projectWebsiteCaptureRights(request),capture_owner:{user_id:"owner1"},
    completion_marker:{object_name:`${prefix}/capture_upload_complete.json`,generation:selector.completion_marker_generation,
      sha256:sha(delivery.markerBytes)},producer_delivery:{kind:"website_browser_capture_delivery",delivery_key:delivery.record.delivery_key,raw_video:video}};
  const selected={...selector,producer_delivery_key:delivery.record.delivery_key,
    task_context_digest:projectWebsiteTaskContext(brief as never,projectWebsiteCaptureRights(request),{captureId:"walkthrough-r1"}).context_digest};
  let canonical=receipt("failed_retryable",1,3,selected);let reads=0;
  vi.stubEnv("CAPTURE_LIFECYCLE_PIPELINE_BASE_URL","https://pipeline.invalid");vi.stubEnv("CAPTURE_UPLOAD_INTAKE_FORWARD_TOKEN","isolated-read-token");
  vi.stubGlobal("fetch",vi.fn(async (_url:string,options:RequestInit)=>{reads++;
    expect(JSON.parse(String(options.body))).toEqual(selected);
    return new Response(JSON.stringify(canonical),{headers:{"content-type":"application/json"}});
  }));
  return {selected,video,pending,request,brief,get reads(){return reads;},ledger(next:WebsitePreparationReceipt){canonical=next;}};
}
describe("production source verifier + transaction with isolated Firestore/GCS doubles",()=>{
  it("PREP-026 real verifier accepts only current canonical browser video/marker/pending and persists intent",async()=>{
    const f=productionFixture();await syncWebsitePreparationStatus(f.selected);
    expect(runtime.records.get("captureUploadSessions/walkthrough-r1").website_preparation.status.state).toBe("failed_retryable");
    expect(runtime.txReads).toContain("inboundRequests/r1");expect(runtime.txWrites).toBe(1);
  });
  it("PREP-027 historical observer cannot authorize a later canonical video",async()=>{
    const f=productionFixture();runtime.objects.get(f.video.object_name)!.metadata.generation="90071992547409999";
    await expect(syncWebsitePreparationStatus(f.selected)).rejects.toThrow();expect(runtime.txWrites).toBe(0);
  });
  it("PREP-028 historical observer cannot authorize a later canonical marker",async()=>{
    const f=productionFixture();runtime.objects.get(runtime.observation.completion_marker.object_name)!.metadata.generation="90071992547409999";
    await expect(syncWebsitePreparationStatus(f.selected)).rejects.toThrow();expect(runtime.txWrites).toBe(0);
  });
  it("PREP-029 a newer browser write reservation denies old-source bootstrap",async()=>{
    const f=productionFixture();runtime.records.get("captureUploadSessions/walkthrough-r1").browser_upload_reservation={id:"new-write"};
    await expect(syncWebsitePreparationStatus(f.selected)).rejects.toThrow();expect(runtime.txWrites).toBe(0);
  });
  it("PREP-030 stored interrupted manifest write denies old-source bootstrap",async()=>{
    const f=productionFixture();runtime.records.get("captureUploadSessions/walkthrough-r1").browser_stored_upload={video:f.video};
    await expect(syncWebsitePreparationStatus(f.selected)).rejects.toThrow();expect(runtime.txWrites).toBe(0);
  });
  it("PREP-031 transaction sees withdrawal after exact source observation",async()=>{
    const f=productionFixture();runtime.beforeTransaction=()=>{f.request.request.consent_attestation.granted=false;};
    await expect(syncWebsitePreparationStatus(f.selected)).rejects.toThrow();expect(runtime.txWrites).toBe(0);
  });
  it("PREP-032 transaction sees owner replacement after exact source observation",async()=>{
    const f=productionFixture();runtime.beforeTransaction=()=>{f.request.account_owner_uid="owner2";};
    await expect(syncWebsitePreparationStatus(f.selected)).rejects.toThrow();expect(runtime.txWrites).toBe(0);
  });
  it("PREP-033 transaction sees task context change after exact source observation",async()=>{
    const f=productionFixture();runtime.beforeTransaction=()=>{f.brief.summary="Changed task";};
    await expect(syncWebsitePreparationStatus(f.selected)).rejects.toThrow();expect(runtime.txWrites).toBe(0);
  });
  it("PREP-034 transaction sees newer source reservation after exact source observation",async()=>{
    const f=productionFixture();runtime.beforeTransaction=()=>{runtime.records.get("captureUploadSessions/walkthrough-r1").browser_upload_reservation={id:"new-write"};};
    await expect(syncWebsitePreparationStatus(f.selected)).rejects.toThrow();expect(runtime.txWrites).toBe(0);
  });
  it("PREP-035 dispatch uses supplied transaction for rights/source and performs no nested writes",async()=>{
    const f=productionFixture();await syncWebsitePreparationStatus(f.selected);
    let reads=0;const tx={async get(ref:any){reads++; return ref.key ? {data:()=>runtime.records.get(ref.key)} : ref.get();}};
    expect(await canNotifyCurrentWebsitePreparationIssue("r1",websitePreparationEventId(f.selected),tx as never)).toBe(true);
    expect(reads).toBeGreaterThanOrEqual(5);expect(runtime.txWrites).toBe(1);
  });
});

describe("supplementary boundary controls, frozen before replay",()=>{
  it("PREP-036 maximum120 request retains derived125scene/132capture identifiers through actual parser",async()=>{
    const request="r".repeat(120);const selected={...selector,request_id:request,scene_id:`site-${request}`,capture_id:`walkthrough-${request}`};
    const h=harness(selected);expect(websitePreparationSelectorSchema.parse(selected)).toEqual(selected);
    expect((await route(h,JSON.stringify(selected),{},true,selected.capture_id)).status).toBe(200);
    expect(h.stored?.selector).toEqual(selected);
  });
  it("PREP-037 request121 is rejected without ledger/source processing",async()=>{
    const request="r".repeat(121);const selected={...selector,request_id:request,scene_id:`site-${request}`,capture_id:`walkthrough-${request}`};
    const h=harness(selected);expect(websitePreparationSelectorSchema.safeParse(selected).success).toBe(false);
    expect((await route(h,JSON.stringify(selected),{},true,selected.capture_id)).status).toBe(400);expect(h.reads).toBe(0);
  });
  it("PREP-038 five-second read timeout cannot enter a late durable commit",async()=>{
    const h=harness();let resolveRead!:(value:unknown)=>void;
    h.deps.readLedger=()=>new Promise(resolve=>{resolveRead=resolve;});
    const commit=vi.spyOn(h.deps,"commit");vi.useFakeTimers();
    try {
      const result=syncWebsitePreparationStatus(selector,h.deps).catch(error=>error.message);
      await vi.advanceTimersByTimeAsync(5001);expect(await result).toBe("website_preparation_unavailable");
      resolveRead(receipt());await vi.advanceTimersByTimeAsync(1);expect(commit).not.toHaveBeenCalled();expect(h.stored).toBeNull();
    } finally {vi.useRealTimers();}
  });
  it("PREP-039 invalid UTF8 signed replacement cannot bypass exact raw parser",async()=>{
    const h=harness();const body=Buffer.concat([Buffer.from('{"request_id":"'),Buffer.from([0xff]),Buffer.from('"}')]);
    expect((await route(h,body)).status).toBe(400);expect(h.reads).toBe(0);
  });
  it("PREP-040 oversized callback is rejected before HMAC/ledger",async()=>{
    const h=harness();expect((await route(h," ".repeat(4097))).status).toBe(413);expect(h.reads).toBe(0);
  });
});

describe("explicit supplementary rotating-notification scan control",()=>{
  it("PREP-041 unavailable earlier rows cannot starve a later current durable notification",async()=>{
    const f=productionFixture();await syncWebsitePreparationStatus(f.selected);
    // Existing current row sorts after these two unavailable source rows. They are never delivered.
    runtime.records.set("captureUploadSessions/a-blocked",{website_preparation_notification_pending:true});
    runtime.records.set("captureUploadSessions/b-blocked",{website_preparation_notification_pending:true});
    const enqueue=vi.fn(async()=>"enqueued" as const);
    expect(await drainPendingWebsitePreparationNotifications(enqueue,undefined,2)).toEqual({enqueued:0,pending:0});
    expect(enqueue).not.toHaveBeenCalled();
    expect(await drainPendingWebsitePreparationNotifications(enqueue,undefined,2)).toEqual({enqueued:1,pending:0});
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(runtime.records.get("captureUploadSessions/walkthrough-r1").website_preparation_notification_pending).toBe(false);
  });
});
