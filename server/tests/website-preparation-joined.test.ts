// @vitest-environment node
/** One joined synthetic-source replay. No live storage, video perception, provider or email. */
import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import express from "express";
import { afterEach, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState } from "./helpers/fake-firestore";

const seams = vi.hoisted(() => ({objects:new Map<string,{metadata:Record<string,any>;bytes:Buffer}>(),
  revision:1,send:vi.fn(async()=>({sent:true,provider:"local-sink",messageId:"synthetic-preparation-receipt"}))}));
vi.mock("../../client/src/lib/firebaseAdmin", async()=>{
  const {sharedFakeFirestore,FAKE_FIELD_DELETE}=await import("./helpers/fake-firestore");
  return {default:{firestore:{FieldValue:{serverTimestamp:()=>"SERVER_TIMESTAMP",delete:()=>FAKE_FIELD_DELETE}}},
    dbAdmin:sharedFakeFirestore,storageAdmin:{bucket:()=>({file:(name:string,options?:{generation?:string})=>{
      const current=()=>{const row=seams.objects.get(name);if(!row||options?.generation&&options.generation!==row.metadata.generation)
        throw Object.assign(Error("missing synthetic generation"),{code:404});return row;};
      return {getMetadata:async()=>[current().metadata],download:async()=>[current().bytes],exists:async()=>[seams.objects.has(name)]};
    }})}};
});
vi.mock("../utils/websiteCaptureOwnerTransport",()=>({withWebsiteOwnerDeps:async(_timeout:number,action:(deps:any)=>Promise<unknown>)=>action({
  bucket:"blueprint-reliability-synthetic",now:()=>Math.floor(Date.now()/1000),
  readRequest:async(id:string)=>{const data=sharedFakeFirestoreState.docs.get(`inboundRequests/${id}`);
    return data?{data,updateTime:{seconds:seams.revision,nanoseconds:0}}:null;},
  readMetadata:async(name:string,generation:string|null)=>{const row=seams.objects.get(name);
    if(!row||generation&&row.metadata.generation!==generation)throw Error("missing synthetic metadata");return row.metadata;},
  readPinned:async(name:string,generation:string)=>{const row=seams.objects.get(name);
    if(!row||row.metadata.generation!==generation)throw Error("missing synthetic pinned object");return {metadata:row.metadata,bytes:row.bytes};},
})}));
vi.mock("../utils/email",()=>({sendEmail:seams.send}));
vi.mock("../utils/field-encryption",()=>({decryptFieldValue:async(value:unknown)=>value,encryptFieldValue:async(value:unknown)=>value}));
vi.mock("../logger",()=>({logger:{info:vi.fn(),warn:vi.fn(),error:vi.fn(),debug:vi.fn()}}));

import { buildBrowserDelivery } from "../utils/websiteCaptureDelivery";
import { observeWebsiteCaptureOwner } from "../utils/websiteCaptureOwnerObservation";
import { withWebsiteOwnerDeps } from "../utils/websiteCaptureOwnerTransport";
import { projectWebsiteCaptureRights,projectWebsiteTaskContext } from "../utils/websiteTaskContext";
import { websitePreparationRawBody,createWebsitePreparationRouter } from "../routes/internal-website-preparation";
import { captureOwnerRawBody } from "../utils/captureOwnerRawBody";
import { createCaptureUploadToken } from "../utils/captureUploadToken";
import { deliverOutbox,reconcileOutboxDeliveries } from "../utils/captureOutbox";
import { reconcileWebsitePreparationNotifications } from "../utils/taskLifecycleNotifications";
import { buildPipelineSyncSignature } from "../utils/pipelineSyncSecurity";
import { draftBrief } from "../utils/siteTaskBrief";
import { crossRuntimeDigest } from "../utils/crossRuntimeCanonical";
const briefRouter=(await import("../routes/site-task-brief")).default;
const internalRouter=(await import("../routes/internal-capture-worlds")).default;
const sha=(bytes:Buffer)=>`sha256:${createHash("sha256").update(bytes).digest("hex")}`;
const output=process.env.RELIABILITY_PREPARATION_JOINED_OUTPUT || path.resolve("output/reliability-program/customer-failure-contract/joined");
let server:Server|undefined,child:ChildProcess|undefined;
const trace:{stage:string;details:unknown}[]=[];let traceWrites=Promise.resolve();
async function record(stage:string,details:unknown){trace.push({stage,details});traceWrites=traceWrites.then(()=>writeFile(path.join(output,"joined-trace.json"),JSON.stringify({
  schema_version:"website_preparation_joined_trace.v1",layer:"actual local producer/ledger/signed handlers with synthetic owner/GCS/Firestore and local email sink",
  final_assessment_executed:false,defined_semantic_cases:1,complete_joined_cases:trace.some(row=>row.stage==="withdrawal-overrides-retained-status")?1:0,stages:trace},null,2),{mode:0o600}));await traceWrites;}
async function stopServer(){if(server){const current=server;server=undefined;await new Promise<void>(resolve=>current.close(()=>resolve()));}}
afterEach(async()=>{await stopServer();if(child&&!child.killed){child.kill("SIGTERM");await new Promise<void>(resolve=>{child!.once("exit",()=>resolve());setTimeout(resolve,2000);});}
  vi.unstubAllEnvs();});
async function app(){const application=express();
  application.use((req,res,next)=>{if(req.path.endsWith("/preparation-status"))res.on("finish",()=>{
    void record("observed-webapp-callback-http",{method:req.method,code:res.statusCode});});next();});
  application.use(captureOwnerRawBody);application.use(websitePreparationRawBody);
  const json=express.json();application.use((req,res,next)=>{
    if((req as any).captureOwnerBodyAdmitted||(req as any).websitePreparationBodyAdmitted)return next();return json(req,res,next);});
  application.use("/api/internal/pipeline",createWebsitePreparationRouter());application.use("/api/internal/pipeline",internalRouter);
  application.use("/api/site-task-brief",briefRouter);server=createServer(application);
  await new Promise<void>(resolve=>server!.listen(0,"127.0.0.1",resolve));
  return `http://127.0.0.1:${(server.address() as any).port}`;}
async function fixture(baseUrl:string){
  const requestId="joined-preparation-20261008",sceneId=`site-${requestId}`,captureId=`walkthrough-${requestId}`;
  const request={requestId,account_owner_uid:"synthetic-owner-1",claimed_at_iso:null,
    request:{buyerType:"site_operator",capture_mode:"self_capture",siteTaskGates:{},taskStatement:"Move sealed cartons",
      consent_attestation:{granted:true,statement_version:"2026-09-18.v1",recorded_at_iso:"2026-10-07T00:00:00.000Z"}},
    contact:{email:"owner@example.test",firstName:"Synthetic"},site_task_brief_confirmed_at:"2026-10-07T00:00:00.000Z",
    site_task_triage:{disposition:"qualified"},capture_coverage:{covers_scene:true,missing_coverage:[],supplement_would_finish:false}};
  const brief={...draftBrief({requestId,summary:"Move sealed cartons",captureMode:"self_capture",proposed:[]}),
    confirmedAtIso:"2026-10-07T00:00:00.000Z",confirmedBy:"Synthetic"};
  sharedFakeFirestoreState.docs.set(`inboundRequests/${requestId}`,request);
  sharedFakeFirestoreState.docs.set(`siteTaskBriefs/${requestId}`,brief);
  const prefix=`scenes/${sceneId}/captures/${captureId}/raw`,videoBytes=Buffer.from("video-1");
  const video={object_name:`${prefix}/walkthrough.mp4`,generation:"90071992547409932",size_bytes:videoBytes.length,crc32c:"AAAAAA=="};
  const manifestBytes=Buffer.from(JSON.stringify({request_id:requestId,scene_id:sceneId,capture_id:captureId,
    capture_source:"browser_self_capture",site_submission_id:requestId,video_uri:video.object_name,capture_rights:projectWebsiteCaptureRights(request)}));
  const manifest={object_name:`${prefix}/manifest.json`,generation:"90071992547409933",size_bytes:manifestBytes.length,crc32c:"AAAAAA==",sha256:sha(manifestBytes)};
  const completedAtIso="2026-10-07T00:00:00.000Z";
  const delivery=buildBrowserDelivery({requestId,sceneId,captureId,rawPrefix:prefix,video,manifest,completedAtIso});
  const pending={schema_version:"website_browser_pending.v1",request_id:requestId,scene_id:sceneId,capture_id:captureId,
    state:"published",completed_at_iso:completedAtIso,video,manifest};
  sharedFakeFirestoreState.docs.set(`captureUploadSessions/${captureId}`,{browser_pending_delivery:pending});
  const add=(name:string,generation:string,bytes:Buffer)=>seams.objects.set(name,{metadata:{name,generation,size:String(bytes.length),crc32c:"AAAAAA=="},bytes});
  add(video.object_name,video.generation,videoBytes);add(manifest.object_name,manifest.generation,manifestBytes);
  add(`${prefix}/capture_upload_complete.json`,"90071992547409931",delivery.markerBytes);add(delivery.objectName,"90071992547409934",delivery.recordBytes);
  const owner=await withWebsiteOwnerDeps(3000,deps=>observeWebsiteCaptureOwner({request_id:requestId,scene_id:sceneId,capture_id:captureId,
    completion_marker_generation:"90071992547409931"},deps));
  const context=projectWebsiteTaskContext(brief,projectWebsiteCaptureRights(request),{captureId});
  const value={schema_version:"website_preparation_joined_fixture.v1",owner_observation:owner,task_context:context,
    request_record:request,brief_record:brief,callback_base_url:baseUrl,
    callback_secret:"synthetic-joined-callback-secret",forward_token:"synthetic-joined-read-secret",
    objects:[...seams.objects].map(([object_name,row])=>({object_name,generation:row.metadata.generation,
      size_bytes:row.bytes.length,crc32c:row.metadata.crc32c,sha256:sha(row.bytes),bytes_base64:row.bytes.toString("base64")}))};
  await writeFile(path.join(output,"shared-fixture.json"),JSON.stringify(value,null,2),{mode:0o600});
  await record("same-source-fixture-exported",{source_projection_digest:owner.source_projection_digest,
    delivery_key:delivery.record.delivery_key,task_context_digest:context.context_digest,object_count:value.objects.length});
  return {requestId,sceneId,captureId,request,video,value};
}
async function startProducer(resumeOnly=false){const exporter=process.env.RELIABILITY_PREPARATION_EXPORTER;
  const python=process.env.RELIABILITY_PREPARATION_PYTHON;
  if(!exporter||!python)throw Error("joined replay blocked: existing authorized Pipeline exporter/python path required");
  child=spawn(python,[exporter,"--fixture",path.join(output,"shared-fixture.json"),"--state-root",path.join(output,"producer-state"),
    "--ready-file",path.join(output,"pipeline-ready.json"),...(resumeOnly?["--resume-only"]:[])],{
    env:{PATH:"/usr/bin:/bin",PYTHONDONTWRITEBYTECODE:"1",PYTHONPATH:process.env.RELIABILITY_PREPARATION_PIPELINE_PYTHONPATH || "",
      JOINED_FORWARD_TOKEN:"synthetic-joined-read-secret",JOINED_CALLBACK_TOKEN:"synthetic-joined-callback-secret"},stdio:["pipe","pipe","pipe"]});
  let stdout="",stderr="";
  child.stdout!.on("data",chunk=>{stdout+=chunk;});child.stderr!.on("data",chunk=>{stderr+=chunk;});
  return new Promise<{base_url:string;selectors:Record<string,unknown>;ledger:Record<string,unknown>;provider_calls:number}>((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error(`joined exporter unavailable: ${stderr.slice(-1000)}`)),20000);
    child!.once("exit",code=>{clearTimeout(timer);reject(Error(`joined exporter exited ${code}: ${stderr.slice(-1000)}`));});
    child!.stdout!.on("data",()=>{for(const line of stdout.split("\n")){try{const value=JSON.parse(line);
      if(value.event==="ready"||value.schema_version==="website_preparation_joined_ready.v1"){clearTimeout(timer);resolve(value);return;}}catch{}}});
  });}
async function producerCommand(command:string){
  if(!child?.stdin||!child.stdout)throw Error("producer process unavailable");
  const current=child;
  return new Promise<any>((resolve,reject)=>{
    let buffer="";const timeout=setTimeout(()=>{current.stdout!.off("data",handler);reject(Error(`producer command ${command} timed out`));},15000);
    const handler=(chunk:Buffer)=>{buffer+=chunk.toString();for(const line of buffer.split("\n")){
      try{const value=JSON.parse(line);if(value.command===command){clearTimeout(timeout);current.stdout!.off("data",handler);resolve(value);return;}}catch{}}};
    current.stdout!.on("data",handler);current.stdin!.write(`${JSON.stringify({command})}\n`);
  });
}
async function stopProducer(){if(!child)return;const current=child;child=undefined;
  const exited=new Promise<void>(resolve=>current.once("exit",()=>resolve()));current.stdin?.write(JSON.stringify({command:"stop"})+"\n");
  const timeout=setTimeout(()=>current.kill("SIGTERM"),2000);await exited;clearTimeout(timeout);
}
async function callback(baseUrl:string,captureId:string,selectors:Record<string,unknown>){const body=JSON.stringify(selectors),timestamp=new Date().toISOString();
  const response=await fetch(`${baseUrl}/api/internal/pipeline/creator-captures/${captureId}/preparation-status`,{method:"POST",body,
    headers:{"content-type":"application/json","X-Blueprint-Pipeline-Timestamp":timestamp,
      "X-Blueprint-Pipeline-Signature":buildPipelineSyncSignature({secret:"synthetic-joined-callback-secret",timestamp,body})}});
  return {code:response.status,body:await response.json()};}

it.skipIf(!process.env.RELIABILITY_PREPARATION_EXPORTER && process.env.RELIABILITY_PREPARATION_EXPORT_ONLY !== "1")("PREP-JOINED-001 default-skip producer failure reaches customer and one durable local notice",async()=>{
  await mkdir(output,{recursive:true,mode:0o700});trace.length=0;sharedFakeFirestoreState.docs.clear();seams.objects.clear();seams.send.mockClear();
  vi.stubEnv("CAPTURE_LIFECYCLE_PIPELINE_BASE_URL","");vi.stubEnv("CAPTURE_UPLOAD_INTAKE_FORWARD_URL","");
  vi.stubEnv("CAPTURE_UPLOAD_INTAKE_FORWARD_TOKEN","");
  vi.stubEnv("PIPELINE_SYNC_TOKEN","synthetic-joined-callback-secret");vi.stubEnv("FIREBASE_STORAGE_BUCKET","blueprint-reliability-synthetic");
  let base=await app();const source=await fixture(base);
  if(process.env.RELIABILITY_PREPARATION_EXPORT_ONLY==="1")throw Error("joined replay partial: fixture exported; producer has not run");
  const producer=await startProducer();
  const lost=await producerCommand("deliver");expect(lost.result).toMatchObject({delivered:false,remaining_pending:1,delivery_counts:{attempted:1,delivered:0}});
  expect(trace.some(row=>row.stage==="observed-webapp-callback-http"&&(row.details as any).code===503)).toBe(true);
  expect(producer.provider_calls).toBe(0);expect(producer.ledger).toMatchObject({status:"failed_retryable",attempt_count:1});
  await record("actual-producer-delivery-unavailable",{response:lost,observed_consumer_status:503,provider_calls:producer.provider_calls,ledger:producer.ledger});
  vi.stubEnv("CAPTURE_LIFECYCLE_PIPELINE_BASE_URL",producer.base_url);
  vi.stubEnv("CAPTURE_UPLOAD_INTAKE_FORWARD_TOKEN","synthetic-joined-read-secret");
  expect(producer.selectors.producer_delivery_key).toBe((source.value.owner_observation as any).producer_delivery.delivery_key);
  expect(producer.selectors.task_context_digest).toBe(source.value.task_context.context_digest);
  await record("actual-producer-failure-ready",{selectors_digest:crossRuntimeDigest(producer.selectors),base_url_mode:"ephemeral-loopback",provider_mode:"no-provider"});
  const delivery=await producerCommand("deliver");
  expect(delivery.result).toMatchObject({delivered:true,remaining_pending:0,delivery_counts:{attempted:1,delivered:1},
    acceptance:{schema_version:"website_preparation_status_acceptance.v1",accepted:true,...producer.selectors}});
  await record("actual-producer-pending-delivery-retry",delivery);
  const accepted=await callback(base,source.captureId,producer.selectors);expect(accepted.code).toBe(200);expect(accepted.body.accepted).toBe(true);
  expect(accepted.body.native_execution_complete).toBe(false);
  const statusKey=`captureUploadSessions/${source.captureId}`;
  expect((sharedFakeFirestoreState.docs.get(statusKey) as any).website_preparation.status.state).toBe("failed_retryable");
  expect((sharedFakeFirestoreState.docs.get(statusKey) as any).website_preparation_notification_pending).toBe(true);
  await record("signed-callback-durable-status",{code:accepted.code,status_digest:accepted.body.status_digest});
  const token=()=>createCaptureUploadToken({requestId:source.requestId,sceneId:source.sceneId,captureId:source.captureId});
  const customer=async()=>{const response=await fetch(`${base}/api/site-task-brief/${token()}/status`);return {code:response.status,body:await response.json()};};
  const observed=await customer();expect(observed.code).toBe(200);expect(observed.body.status.headline).toContain("Job preparation encountered a problem.");
  expect(observed.body.status.headline).not.toMatch(/results are in|robot can|are preparing/i);
  await record("normal-customer-get",{code:observed.code,status:observed.body.status});
  // Persist/restore the mocked database across actual Express server restart before notification enqueue.
  await writeFile(path.join(output,"webapp-database-checkpoint.json"),JSON.stringify([...sharedFakeFirestoreState.docs]),{mode:0o600});
  await stopServer();sharedFakeFirestoreState.docs.clear();
  for(const [key,row] of JSON.parse(await readFile(path.join(output,"webapp-database-checkpoint.json"),"utf8")))sharedFakeFirestoreState.docs.set(key,row);
  base=await app();await stopProducer();
  source.value.callback_base_url=base;
  await writeFile(path.join(output,"shared-fixture.json"),JSON.stringify(source.value,null,2),{mode:0o600});
  const restored=await startProducer(true);vi.stubEnv("CAPTURE_LIFECYCLE_PIPELINE_BASE_URL",restored.base_url);
  expect(restored.selectors).toEqual(producer.selectors);
  expect(restored.ledger.attempt_count).toBe(producer.ledger.attempt_count);expect(restored.ledger.revision).toBe(producer.ledger.revision);
  expect(restored.provider_calls).toBe(0);const restartedDelivery=await producerCommand("deliver");
  expect(restartedDelivery.result).toMatchObject({delivered:true,remaining_pending:0,delivery_counts:{attempted:0,delivered:0}});
  expect((await callback(base,source.captureId,producer.selectors)).code).toBe(200);
  await reconcileWebsitePreparationNotifications();await deliverOutbox();expect(seams.send).toHaveBeenCalledTimes(1);
  const noticeRows=[...sharedFakeFirestoreState.docs].filter(([key])=>key.startsWith("captureOutbox/")&&key.split("/").length===2&&key.includes(":preparation_needs_attention:"));
  expect(noticeRows).toHaveLength(1);expect(noticeRows[0][1]).toMatchObject({status:"sent",attempts:1});
  const receipts=[...sharedFakeFirestoreState.docs.keys()].filter(key=>key.startsWith(`${noticeRows[0][0]}/deliveryReceipts/`));
  expect(receipts).toHaveLength(1);
  await reconcileWebsitePreparationNotifications();await deliverOutbox();expect(seams.send).toHaveBeenCalledTimes(1);
  await record("restart-recovery-local-notification",{database_mode:"JSON checkpoint of in-memory Firestore double",notice_count:noticeRows.length,local_deliveries:seams.send.mock.calls.length});
  // A new canonical video must invalidate the old source callback and customer error.
  const old=seams.objects.get(source.video.object_name)!.metadata.generation;
  seams.objects.get(source.video.object_name)!.metadata.generation="90071992547409999";
  expect((await callback(base,source.captureId,producer.selectors)).code).toBe(503);
  const staleCustomer=await customer();await record("stale-source-customer-response",staleCustomer);
  expect(staleCustomer.code).toBe(503);expect(staleCustomer.body.code).toBe("task_status_unavailable");
  expect(staleCustomer.body.status).toBeUndefined();expect(JSON.stringify(staleCustomer.body)).not.toContain("Job preparation encountered a problem.");
  seams.objects.get(source.video.object_name)!.metadata.generation=old;
  await record("old-source-refused",{callback:503,current_current_customer_status:"unavailable"});
  // Current withdrawal wins over retained callback/source/status and prevents any future send.
  const request=sharedFakeFirestoreState.docs.get(`inboundRequests/${source.requestId}`) as any;request.consent_revoked=true;seams.revision++;
  expect((await callback(base,source.captureId,producer.selectors)).code).toBe(503);
  const withdrawn=await customer();await record("withdrawal-customer-response",withdrawn);expect(withdrawn.code).toBe(200);expect(withdrawn.body.status.headline).toContain("Recording consent was withdrawn.");
  expect(withdrawn.body.summary).toBeNull();expect(withdrawn.body.sceneViewUrl).toBeNull();
  expect(withdrawn.body.status.headline).not.toContain("Job preparation encountered a problem.");
  await reconcileOutboxDeliveries();await deliverOutbox();expect(seams.send).toHaveBeenCalledTimes(1);
  await record("withdrawal-overrides-retained-status",{callback:503,customer_status:withdrawn.body.status,additional_deliveries:0});
  await writeFile(path.join(output,"webapp-final-documents.json"),JSON.stringify([...sharedFakeFirestoreState.docs]),{mode:0o600});
});
