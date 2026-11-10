// OFFLINE: actual sponsorship functions, existing fake Firestore, no providers or robot-quality evidence.
// Owner decision 2026-10-28: the received video is enough to prepare the scene.
// A seeded assessment is present only to show it neither gates nor binds the grant.
// @vitest-environment node
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import express from "express";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
vi.mock("../../client/src/lib/firebaseAdmin", async () => ({ default: {firestore:{FieldValue:{serverTimestamp:()=>"offline-time"}}},
  dbAdmin: (await import("./helpers/fake-firestore")).sharedFakeFirestore, storageAdmin: null }));
vi.mock("../logger", () => ({ logger: {info: vi.fn(),warn: vi.fn(),error: vi.fn(),debug: vi.fn()} }));
vi.mock("../agents/private-evidence", () => ({ hydrateAgentEvidence: async (value: unknown) => structuredClone(value) }));
const seams = vi.hoisted(() => ({ marker: true, onBinding: () => {}, binding: undefined as any }));
vi.mock("../utils/websiteBrowserUploadStatus", () => ({ verifiedPendingManifest: async () => JSON.stringify({ duration_seconds: 30 }),
  verifiedPendingMarker: async () => seams.marker }));
vi.mock("../utils/websiteCaptureBinding", () => ({ resolveWebsiteCaptureBinding: async (_r:string,_s:string,capture:string) => capture.startsWith("supplement-") ? seams.binding : undefined,
  assertWebsiteCaptureBindingInTransaction: async () => seams.onBinding() }));
vi.mock("../utils/captureFootageReview", () => ({buildCaptureFootageReviewer:vi.fn()}));
vi.mock("../utils/worldReconstruction", () => ({startWorldReconstruction:vi.fn(),advanceWorldReconstruction:vi.fn()}));
vi.mock("../utils/taskLifecycleNotifications", () => ({enqueueTaskLifecycleNotification:vi.fn(),reconstructionIsViewable:vi.fn()}));
vi.mock("../utils/pipelineSyncSecurity", () => ({createPipelineSyncRateLimiter:()=> (_r:unknown,_s:unknown,next:()=>void)=>next(),
  verifyPipelineSyncRequest:()=>({ok:true})}));
import { loadWebsiteSceneSponsorship, websiteSceneSponsorship, currentWebsitePreparationStatusContext, reserveWebsitePreparationSpend, amendWebsitePreparationRequestLimit,
  amendWebsitePreparationSpendLimit, sponsorshipValidUntil } from "../utils/websiteSceneSponsorship";
import { recordSceneExecutionWindowExtension } from "../utils/sceneExecutionWindowExtension";
import { advisoryContextDigest, advisoryJobId } from "../utils/siteAssessmentContext";
import { browserPendingDecisionKey } from "../utils/websiteBrowserPending";
import { RECORDING_CONSENT_VERSION } from "../utils/recordingConsent";
import { projectWebsiteTaskContext, projectWebsiteCaptureRights, legacyRoutingTaskContextDigest } from "../utils/websiteTaskContext";
const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
const source = {source_id: "video:one",kind:"video",canonical_ref:"gs://blueprint-8c1ca.appspot.com/scenes/site-one/captures/walkthrough-one/raw/walkthrough.mp4#generation=1",
  sha256:"a".repeat(64),checked_at:null,content:{duration_seconds:30,evidence:{summary:"A bin moves",observations:[
    {category:"motion",finding:"A bin moves",basis:"observed",start_seconds:1,end_seconds:2,uncertainty:null}],not_observable:["workload"]}}};
const fact = () => ({text:"A bin moves",basis:"observed",evidence:[{source_id:source.source_id,at_seconds:1,
  selector:{kind:"video_observation",observation_index:0,field_path:null}}]});
function packet() {return {schema_version:"site_assessment.v2",request_id:"one",sources:[source],raw_model_assessment:{
  status:"needs_operator_input",job:[fact()],objects_motions_conditions_variations:[],operator_success:[],known:[],estimates:[],
  missing:[{text:"Workload remains unknown",basis:"unknown",evidence:[]}],
  approaches:[{approach:"Explore handling a bin",disposition:"plausible",reasons:[fact()],remaining_checks:["Workload"]}],
  questions:[{question:"How many bins per hour?",decision_it_changes:"Required throughput"}],
  next_action:{kind:"ask_operator",action:"Clarify workload",why:{text:"Workload remains unknown",basis:"unknown",evidence:[]}}}};}
function seed(p = packet(), confirmed = true, claimed = true, requestExtras: Record<string, unknown> = {}, briefExtras: Record<string, unknown> = {}) {
  const pending = {schema_version:"website_browser_pending.v1",request_id:"one",scene_id:"site-one",capture_id:"walkthrough-one",
    state:"published",completed_at_iso:"2026-10-08T00:00:00Z",video:{object_name:"scenes/site-one/captures/walkthrough-one/raw/walkthrough.mp4",generation:"1",size_bytes:7,crc32c:"AAAAAA=="},
    manifest:{object_name:"scenes/site-one/captures/walkthrough-one/raw/manifest.json",generation:"2",size_bytes:500,crc32c:"AAAAAA==",sha256:`sha256:${"b".repeat(64)}`}};
  const record:any = {...(claimed ? {account_owner_uid:"owner"} : {}),request:{buyerType:"site_operator",capture_mode:"self_capture",taskDescription:"Move bins",
    consent_attestation:{granted:true,statement_version:RECORDING_CONSENT_VERSION,recorded_at_iso:"2026-10-08T00:00:00Z"},...requestExtras},
    site_task_triage:{disposition:"needs_conversation"},capture_privacy_source_bound_decision:{proceeded:true,eligibility:"unscreened",capture_id:"walkthrough-one",
      producer_source:{kind:"browser_pending",key:browserPendingDecisionKey(pending)}}};
  const brief = {requestId:"one",summary:"Move bins",confirmedAtIso:confirmed ? "2026-10-08T00:00:00Z" : null,operatorUnknown:["workload"],...briefExtras};
  const key=browserPendingDecisionKey(pending),context=advisoryContextDigest(record,brief),job=advisoryJobId("one",key,context);
  record.site_advisory={job_id:job,source_key:key,context_digest:context,state:"completed"};
  state.docs.set("inboundRequests/one",record);state.docs.set("siteTaskBriefs/one",brief);
  state.docs.set("captureUploadSessions/walkthrough-one",{browser_pending_delivery:pending});
  state.docs.set(`siteAssessmentJobs/${job}`,{schema_version:"site_assessment_job.v1",request_id:"one",capture_id:"walkthrough-one",
    source_key:key,context_digest:context,state:"completed",run_id:"assessment-one",packet_sha256:hash(p)});
  state.docs.set("agentRuns/assessment-one",{status:"completed",task_kind:"site_assessment",artifacts:{site_assessment_packet:p,
    site_assessment_packet_sha256:hash(p),source_admission:{schema_version:"site_assessment_source.v1",request_id:"one",capture_id:"walkthrough-one",
      source_key:key,context_digest:context,advisory_job_id:job,video_bytes:7,video_ref:source.canonical_ref,video_sha256:source.sha256,
      manifest:pending.manifest,duration_seconds:30}}});
  return {job,record};
}
beforeEach(() => {state.docs.clear();seams.marker=true;seams.onBinding=()=>{};seams.binding=undefined;
  vi.stubEnv("BLUEPRINT_WEBSITE_SCENE_SPONSORSHIP_JSON",JSON.stringify({owner:{user_id:"blueprint",organization_id:"blueprint"},
    upstream_max_spend_usd:1,native_max_spend_usd:1,max_total_spend_usd:2,max_paid_attempts:2,ttl_seconds:3600,provider_terms_reference:`sha256:${"c".repeat(64)}`}));});
afterEach(() => vi.unstubAllEnvs());
it("prepares the scene from the received video with no assessment at all",async()=>{
  const {job}=seed(packet(),false,false);
  delete (state.docs.get("inboundRequests/one") as any).site_advisory;
  state.docs.delete(`siteAssessmentJobs/${job}`);state.docs.delete("agentRuns/assessment-one");
  const grant=await loadWebsiteSceneSponsorship("one",true,"walkthrough-one",prepOptions());
  expect(grant).toMatchObject({purpose:"scene_preparation",sponsor:"blueprint",consent:{task_confirmed:false,spend_authorized:true}});
  expect(grant).not.toHaveProperty("assessment_preparation_proposal");
  expect(state.docs.get("inboundRequests/one")?.website_scene_sponsorship).toEqual(grant);
  expect(state.docs.get("inboundRequests/one")).not.toHaveProperty("account_owner_uid");
});
it.each(["queued","running","needs_review","unverified_claim","no_plausible_approach"])("prepares while the assessment is %s",async(change)=>{
  const p=packet();
  if(change==="unverified_claim")p.raw_model_assessment.job[0].evidence[0].selector.observation_index=9;
  if(change==="no_plausible_approach")p.raw_model_assessment.approaches[0].disposition="needs_evidence";
  const {job}=seed(p,false,false);
  if(["queued","running","needs_review"].includes(change))(state.docs.get(`siteAssessmentJobs/${job}`) as any).state=change;
  const grant=await loadWebsiteSceneSponsorship("one",true,"walkthrough-one",prepOptions());
  expect(grant).toMatchObject({purpose:"scene_preparation"});expect(grant).not.toHaveProperty("assessment_preparation_proposal");
});
it("still refuses preparation and every fresh reservation once rights end, without resetting past unknown spend",async()=>{
  seed(packet(),false,false);const grant=await loadWebsiteSceneSponsorship("one",true,"walkthrough-one",prepOptions());
  const record=state.docs.get("inboundRequests/one") as any;
  record.website_preparation_reservations={unknown:{admission:{maximum_cost_usd:1,request_count:1},settlement:null}};
  record.future_processing_allowed=false;
  const prior=structuredClone(record.website_preparation_reservations);
  await expect(reserveWebsitePreparationSpend("one",{task_context_digest:grant.task_context_digest,allocation_binding_digest:`sha256:${"d".repeat(64)}`,
    resource_class:"gpu_render",provider:"vast",maximum_cost_usd:1,request_count:1})).rejects.toThrow("source_revoked");
  expect(record.website_preparation_reservations).toEqual(prior);
  state.docs.clear();seed(packet(),false,false);
  (state.docs.get("inboundRequests/one") as any).request.consent_attestation.revoked_at_iso="2026-10-28T00:00:00Z";
  await expect(loadWebsiteSceneSponsorship("one",true,"walkthrough-one",prepOptions())).rejects.toThrow("source_revoked");
  expect(state.docs.get("inboundRequests/one")?.website_scene_sponsorship).toBeUndefined();
});
it("actual signed-route handler grants preparation while the assessment is queued and settles prior receipts after rights end",async()=>{
  const {job}=seed(packet(),false,false);
  (state.docs.get(`siteAssessmentJobs/${job}`) as any).state="queued";
  const app=express();app.use(express.json());app.use((await import("../routes/internal-capture-worlds")).default);
  const server=createServer(app);await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
  const base=`http://127.0.0.1:${(server.address() as any).port}/creator-captures/walkthrough-one`;
  const send=(operation:string,body:unknown)=>fetch(`${base}/${operation}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
  try {
    const created=await send("scene-sponsorship",{request_id:"one",scene_id:"site-one",...prepOptions()});
    expect(created.status).toBe(200);const grant=await created.json();
    const record=state.docs.get("inboundRequests/one") as any;expect(record.website_scene_sponsorship).toEqual(grant);
    record.future_processing_allowed=false;
    record.website_preparation_reservations={["d".repeat(64)]:{admission:{provider:"world_labs",resource_class:"provider_reconstruction_api",
      task_context_digest:`sha256:${"e".repeat(64)}`,maximum_cost_usd:1,request_count:1},settlement:null},
      otherUnknown:{admission:{maximum_cost_usd:2,request_count:1},settlement:null}};
    const unknown=structuredClone(record.website_preparation_reservations.otherUnknown);
    const settlement={task_context_digest:`sha256:${"e".repeat(64)}`,allocation_binding_digest:`sha256:${"d".repeat(64)}`,
      provider:"world_labs",operation_id:"completed-synthetic-operation",operation_done:true,total_credits:500,
      provider_receipt_digest:`sha256:${"f".repeat(64)}`};
    const settled=await send("preparation-settlement",{request_id:"one",scene_id:"site-one",settlement});
    expect(settled.status).toBe(200);expect(await settled.json()).toMatchObject({status:"settled",actual_cost_usd:0.4});
    const current=state.docs.get("inboundRequests/one") as any;
    expect(current.website_preparation_reservations.otherUnknown).toEqual(unknown);
    expect(current.website_scene_sponsorship).toEqual(grant);
    const invalid=await send("preparation-settlement",{request_id:"one",scene_id:"site-one",settlement:{...settlement,allocation_binding_digest:`sha256:${"0".repeat(64)}`}});
    expect(invalid.status).toBe(409);expect(await invalid.json()).toEqual({code:"website_scene_preparation_settlement_invalid"});
    const revoked=await send("scene-sponsorship",{request_id:"one",scene_id:"site-one",...prepOptions()});
    expect(revoked.status).toBe(409);expect(await revoked.json()).toEqual({code:"source_revoked"});
  } finally {await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});

it("holds a job that names several steps before any spend: no grant, no reservation, a typed refusal",async()=>{
  seed(packet(),false,false,{},{summary:"Take the plates to the kitchen then load the dishwasher"});
  await expect(loadWebsiteSceneSponsorship("one",true,"walkthrough-one",prepOptions()))
    .rejects.toThrow("website_multi_step_task_preparation_required");
  expect(state.docs.get("inboundRequests/one")?.website_scene_sponsorship).toBeUndefined();
  // The same job, split into one step by the site, is granted as any other.
  (state.docs.get("siteTaskBriefs/one") as any).summary="Pick up the tray and put it on the counter";
  const grant=await loadWebsiteSceneSponsorship("one",true,"walkthrough-one",prepOptions());
  expect(grant).toMatchObject({purpose:"scene_preparation"});
});
it("admits no new spend once the site names several steps for a job prepared before it was named",async()=>{
  // Preparation starts from the video before the site names the job; the grant then follows the brief.
  seed(packet(),false,false,{},{summary:"Your site task"});
  const grant=await loadWebsiteSceneSponsorship("one",true,"walkthrough-one",prepOptions());
  vi.stubEnv("TASK_EVALUATION_SCENE_PROVIDER_TERMS_JSON",JSON.stringify({vast:{digest:grant.consent.provider_terms_reference,
    label:"Synthetic",url:"https://example.com/terms"}}));
  (state.docs.get("siteTaskBriefs/one") as any).summary="Open the fridge and take out the milk";
  const named=prepOptions().expected_task_context_digest;
  const spend=(digest:string)=>({task_context_digest:digest,
    allocation_binding_digest:`sha256:${"d".repeat(64)}`,resource_class:"gpu_render",provider:"vast",maximum_cost_usd:1,request_count:1});
  const before=structuredClone((state.docs.get("inboundRequests/one") as any).website_preparation_reservations ?? null);
  expect(named).not.toBe(grant.task_context_digest);
  await expect(reserveWebsitePreparationSpend("one",spend(named)))
    .rejects.toThrow("website_multi_step_task_preparation_required");
  expect((state.docs.get("inboundRequests/one") as any).website_preparation_reservations ?? null).toEqual(before);
  await expect(loadWebsiteSceneSponsorship("one",true,"walkthrough-one",{purpose:"scene_preparation",
    expected_task_context_digest:named})).rejects.toThrow("website_multi_step_task_preparation_required");
  // Split into one step, the same grant admits spend again.
  (state.docs.get("siteTaskBriefs/one") as any).summary="Take the milk out of the fridge";
  expect(await reserveWebsitePreparationSpend("one",spend(prepOptions().expected_task_context_digest)))
    .toMatchObject({status:"admitted"});
});
it("the signed route returns the multi-step hold by name, so the Pipeline holds the capture rather than fails it",async()=>{
  // Screened as "other" for its wiping, and still several steps: held all the same.
  seed(packet(),false,false,{},{summary:"Put the mug in the sink, then wipe the counter"});
  const app=express();app.use(express.json());app.use((await import("../routes/internal-capture-worlds")).default);
  const server=createServer(app);await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
  const base=`http://127.0.0.1:${(server.address() as any).port}/creator-captures/walkthrough-one`;
  try {
    const refused=await fetch(`${base}/scene-sponsorship`,{method:"POST",headers:{"content-type":"application/json"},
      body:JSON.stringify({request_id:"one",scene_id:"site-one",...prepOptions()})});
    expect(refused.status).toBe(409);
    expect(await refused.json()).toEqual({code:"website_multi_step_task_preparation_required"});
  } finally {await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});

// SYNTHETIC offline preparation contract v2. Actual existing handlers, no production operations.
function prepOptions() {
  const brief=state.docs.get("siteTaskBriefs/one") as any,record=state.docs.get("inboundRequests/one") as any;
  return {purpose:"scene_preparation" as const,expected_task_context_digest:projectWebsiteTaskContext(brief,
    projectWebsiteCaptureRights(record),{purpose:"scene_preparation",inventory:state.docs.get("siteTaskItemInventories/one") ?? undefined} as any).context_digest};
}
import { projectWebsiteTaskContext, projectWebsiteCaptureRights, confirmationParentContextDigests } from "../utils/websiteTaskContext";
import { validateWebsiteSponsoredIntake, currentWebsitePreparationStatusContext, renewExpiredWebsiteSceneSponsorship,
  SPONSORSHIP_RENEWAL_ACK } from "../utils/websiteSceneSponsorship";
import { crossRuntimeDigest } from "../utils/crossRuntimeCanonical";
import { sceneIntakeCommand, sceneDigest, processSceneIntakeQueue } from "../utils/taskEvaluationSceneIntake";
it("v2 explicit current preparation admits unknown task/account without confirming or charging the site",async()=>{
  seed(packet(),false,false);const briefBefore=structuredClone(state.docs.get("siteTaskBriefs/one"));
  const opts=prepOptions();const grant=await (loadWebsiteSceneSponsorship as any)("one",true,"walkthrough-one",opts);
  expect(grant).toMatchObject({purpose:"scene_preparation",task_context_digest:opts.expected_task_context_digest,
    consent:{task_confirmed:false}});
  expect(grant).not.toHaveProperty("assessment_preparation_proposal");
  expect(state.docs.get("siteTaskBriefs/one")).toEqual(briefBefore);
  expect(state.docs.get("inboundRequests/one")).not.toHaveProperty("account_owner_uid");
  const stored=structuredClone(state.docs.get("inboundRequests/one")?.website_scene_sponsorship);
  const later=await loadWebsiteSceneSponsorship("one",false);
  expect(later).toEqual(grant);expect(state.docs.get("inboundRequests/one")?.website_scene_sponsorship).toEqual(stored);
});
it("v2 absent purpose leaves confirmation, site screen and account gates strict, whatever the assessment says",async()=>{
  seed(packet(),false,false);await expect(loadWebsiteSceneSponsorship("one",true)).rejects.toThrow("website_task_context_not_confirmed");
  seed(packet(),true,true);await expect(loadWebsiteSceneSponsorship("one",true)).rejects.toThrow("website_scene_site_not_qualified");
  seed(packet(),true,false);(state.docs.get("inboundRequests/one") as any).site_task_triage.disposition="qualified";
  await expect(loadWebsiteSceneSponsorship("one",true)).rejects.toThrow("website_scene_site_unclaimed");
});
it("v2 preparation cannot create a grant without the exact current expected context",async()=>{
  seed(packet(),false,false);
  for(const options of [{purpose:"scene_preparation"},{...prepOptions(),expected_task_context_digest:`sha256:${"0".repeat(64)}`}]) {
    await expect((loadWebsiteSceneSponsorship as any)("one",true,"walkthrough-one",options)).rejects.toThrow("website_task_context_changed");
    expect(state.docs.get("inboundRequests/one")?.website_scene_sponsorship).toBeUndefined();
  }
});
it("v2 current preparation grant never becomes a default/evaluation grant or renews after expiry",async()=>{
  seed(packet(),false,false);const first=await (loadWebsiteSceneSponsorship as any)("one",true,"walkthrough-one",prepOptions());
  await expect((loadWebsiteSceneSponsorship as any)("one",true,"walkthrough-one",{})).rejects.toThrow();
  vi.spyOn(Date,"now").mockReturnValue((first.expires_at_epoch+1)*1000);
  try {await expect(loadWebsiteSceneSponsorship("one",false)).rejects.toThrow("consent_expired");}
  finally {vi.restoreAllMocks();}
  expect(state.docs.get("inboundRequests/one")?.website_scene_sponsorship).toEqual(first);
});
it("sponsor-approved renewal re-issues an expired preparation grant under its identical policy and keeps reservations",async()=>{
  seed(packet(),false,false);const first=await (loadWebsiteSceneSponsorship as any)("one",true,"walkthrough-one",prepOptions());
  vi.stubEnv("TASK_EVALUATION_SCENE_PROVIDER_TERMS_JSON",JSON.stringify({vast:{digest:first.consent.provider_terms_reference,label:"Synthetic",url:"https://example.com/terms"}}));
  const spend={task_context_digest:first.task_context_digest,allocation_binding_digest:`sha256:${"d".repeat(64)}`,
    resource_class:"gpu_render" as const,provider:"vast" as const,maximum_cost_usd:1,request_count:1};
  await reserveWebsitePreparationSpend("one",spend);
  const renew=(extra:Record<string,unknown>={})=>renewExpiredWebsiteSceneSponsorship("one",{approved_by:"blueprint",
    approval_reference:"owner chat approval",ack:SPONSORSHIP_RENEWAL_ACK,apply:true,...extra});
  await expect(renew()).rejects.toThrow("website_scene_sponsorship_renewal_not_expired");
  vi.spyOn(Date,"now").mockReturnValue((first.expires_at_epoch+10)*1000);
  try {
    await expect(loadWebsiteSceneSponsorship("one",false)).rejects.toThrow("consent_expired");
    await expect(renew({approved_by:"someone-else"})).rejects.toThrow("website_scene_sponsorship_renewal_unauthorized");
    await expect(renew({ack:"yes"})).rejects.toThrow("website_scene_sponsorship_renewal_unacknowledged");
    const preview=await renew({apply:false});
    expect(state.docs.get("inboundRequests/one")?.website_scene_sponsorship).toEqual(first);
    const renewed=await renew();
    expect(renewed).toEqual(preview);
    expect(renewed).toMatchObject({policy_digest:first.policy_digest,task_context_digest:first.task_context_digest,
      preparation_max_total_spend_usd:first.preparation_max_total_spend_usd,max_paid_attempts:first.max_paid_attempts,
      consent:{task_confirmed:false},renewal:{parent_authority_digest:first.authority_digest,approved_by:"blueprint"}});
    expect(renewed.expires_at_epoch).toBeCloseTo(first.expires_at_epoch+10+3600,3);
    const stored=state.docs.get("inboundRequests/one") as any;
    expect(stored.website_scene_sponsorship_history).toEqual([first]);
    expect(Object.keys(stored.website_preparation_reservations)).toHaveLength(1);
    expect(await loadWebsiteSceneSponsorship("one",false)).toMatchObject({authority_digest:renewed.authority_digest});
    // The cap still counts the reservation made under the expired grant.
    await expect(reserveWebsitePreparationSpend("one",{...spend,allocation_binding_digest:`sha256:${"e".repeat(64)}`,
      task_context_digest:renewed.task_context_digest,maximum_cost_usd:1.5})).rejects.toThrow("website_scene_preparation_budget_exhausted");
    await expect(renew()).rejects.toThrow("website_scene_sponsorship_renewal_not_expired");
  } finally {vi.restoreAllMocks();}
});
it("renewal carries the owner's request-limit amendment to the renewed grant and archives the original",async()=>{
  seed(packet(),false,false);const first=await (loadWebsiteSceneSponsorship as any)("one",true,"walkthrough-one",prepOptions());
  vi.stubEnv("TASK_EVALUATION_SCENE_PROVIDER_TERMS_JSON",JSON.stringify({vast:{digest:first.consent.provider_terms_reference,label:"Synthetic",url:"https://example.com/terms"}}));
  const original=await amendWebsitePreparationRequestLimit("one",{authority_digest:first.authority_digest,
    max_requests:first.max_paid_attempts+2,approved_by:"blueprint",approval_reference:"owner raised the request limit"},true);
  vi.spyOn(Date,"now").mockReturnValue((first.expires_at_epoch+10)*1000);
  try {
    const before=structuredClone(state.docs.get("inboundRequests/one"));
    const preview=await renewExpiredWebsiteSceneSponsorship("one",{approved_by:"blueprint",
      approval_reference:"owner chat approval",ack:SPONSORSHIP_RENEWAL_ACK,apply:false});
    expect(state.docs.get("inboundRequests/one")).toEqual(before);
    expect(preview.preparation_amendments).toMatchObject({archived:[original],
      carried:{website_preparation_limit_amendment:{authority_digest:preview.authority_digest,
        max_requests:first.max_paid_attempts+2}},effective_limits:{max_requests:first.max_paid_attempts+2},
      history_length_before:0,history_length_after:1});
    const renewed=await renewExpiredWebsiteSceneSponsorship("one",{approved_by:"blueprint",
      approval_reference:"owner chat approval",ack:SPONSORSHIP_RENEWAL_ACK,apply:true});
    expect(renewed).toEqual(preview);
    const stored=state.docs.get("inboundRequests/one") as any;
    expect(stored.website_preparation_amendment_history).toEqual([original]);
    expect(stored.website_preparation_limit_amendment).toMatchObject({authority_digest:renewed.authority_digest,
      max_requests:first.max_paid_attempts+2,approved_by:"blueprint"});
    expect(stored.website_preparation_limit_amendment.approval_reference).toContain(original.amendment_digest);
    // The carried limit is live under the renewed grant: more requests than the grant's own limit.
    await expect(reserveWebsitePreparationSpend("one",{task_context_digest:renewed.task_context_digest,
      allocation_binding_digest:`sha256:${"d".repeat(64)}`,resource_class:"gpu_render",provider:"vast",
      maximum_cost_usd:0.1,request_count:first.max_paid_attempts+1})).resolves.toMatchObject({status:"admitted"});
  } finally {vi.restoreAllMocks();}
});
it("renewal previews and carries spend and chained request amendments without resetting reservations",async()=>{
  seed(packet(),false,false);const first=await (loadWebsiteSceneSponsorship as any)("one",true,"walkthrough-one",prepOptions());
  vi.stubEnv("TASK_EVALUATION_SCENE_PROVIDER_TERMS_JSON",JSON.stringify({vast:{digest:first.consent.provider_terms_reference,label:"Synthetic",url:"https://example.com/terms"}}));
  const approve={authority_digest:first.authority_digest,approved_by:"blueprint",approval_reference:"owner amendment"};
  const limit=await amendWebsitePreparationRequestLimit("one",{...approve,max_requests:first.max_paid_attempts+1},true);
  const extension=await amendWebsitePreparationRequestLimit("one",{...approve,max_requests:first.max_paid_attempts+2},true);
  const spend=await amendWebsitePreparationSpendLimit("one",{...approve,upstream_max_spend_usd:first.upstream_max_spend_usd*2},true);
  const reservation={task_context_digest:first.task_context_digest,allocation_binding_digest:`sha256:${"d".repeat(64)}`,
    resource_class:"gpu_render" as const,provider:"vast" as const,maximum_cost_usd:1,request_count:1};
  await reserveWebsitePreparationSpend("one",reservation);
  const before=structuredClone(state.docs.get("inboundRequests/one"));
  vi.spyOn(Date,"now").mockReturnValue((first.expires_at_epoch+10)*1000);
  try {
    const input={approved_by:"blueprint",approval_reference:"owner renewal",ack:SPONSORSHIP_RENEWAL_ACK};
    const preview=await renewExpiredWebsiteSceneSponsorship("one",{...input,apply:false});
    expect(state.docs.get("inboundRequests/one")).toEqual(before);
    expect(preview.preparation_amendments).toMatchObject({archived:[limit,extension,spend],
      effective_limits:{max_requests:first.max_paid_attempts+2,upstream_max_spend_usd:first.upstream_max_spend_usd*2},
      history_length_before:0,history_length_after:3});
    const renewed=await renewExpiredWebsiteSceneSponsorship("one",{...input,apply:true});
    expect(renewed).toEqual(preview);
    const stored=state.docs.get("inboundRequests/one") as any;
    expect(stored.website_preparation_limit_extension.prior_amendment_digest)
      .toBe(stored.website_preparation_limit_amendment.amendment_digest);
    expect(stored.website_preparation_reservations).toEqual(before?.website_preparation_reservations);
    await expect(reserveWebsitePreparationSpend("one",{...reservation,maximum_cost_usd:3,
      allocation_binding_digest:`sha256:${"e".repeat(64)}`})).rejects.toThrow("website_scene_preparation_budget_exhausted");
  } finally {vi.restoreAllMocks();}
});
it("renewal refuses an amendment that no longer verifies and writes nothing",async()=>{
  seed(packet(),false,false);const first=await (loadWebsiteSceneSponsorship as any)("one",true,"walkthrough-one",prepOptions());
  await amendWebsitePreparationRequestLimit("one",{authority_digest:first.authority_digest,max_requests:first.max_paid_attempts+2,
    approved_by:"blueprint",approval_reference:"owner raised the request limit"},true);
  (state.docs.get("inboundRequests/one") as any).website_preparation_limit_amendment.max_requests=32;
  vi.spyOn(Date,"now").mockReturnValue((first.expires_at_epoch+10)*1000);
  try {await expect(renewExpiredWebsiteSceneSponsorship("one",{approved_by:"blueprint",approval_reference:"owner chat approval",
    ack:SPONSORSHIP_RENEWAL_ACK,apply:true})).rejects.toThrow("website_preparation_amendment_invalid");}
  finally {vi.restoreAllMocks();}
  expect(state.docs.get("inboundRequests/one")?.website_scene_sponsorship).toEqual(first);
  expect(state.docs.get("inboundRequests/one")).not.toHaveProperty("website_preparation_amendment_history");
});
it("renewal refuses to re-scope a grant whose task changed after expiry",async()=>{
  seed(packet(),false,false);const first=await (loadWebsiteSceneSponsorship as any)("one",true,"walkthrough-one",prepOptions());
  (state.docs.get("siteTaskBriefs/one") as any).summary="Move bins and stack crates";
  vi.spyOn(Date,"now").mockReturnValue((first.expires_at_epoch+10)*1000);
  try {await expect(renewExpiredWebsiteSceneSponsorship("one",{approved_by:"blueprint",approval_reference:"owner chat approval",
    ack:SPONSORSHIP_RENEWAL_ACK,apply:true})).rejects.toThrow("website_scene_sponsorship_renewal_scope_changed");}
  finally {vi.restoreAllMocks();}
  expect(state.docs.get("inboundRequests/one")?.website_scene_sponsorship).toEqual(first);
});
it("renewal migrates only a proven legacy digest containing an unphotographed suggestion",async()=>{
  seed(packet(),false,false);const first=await (loadWebsiteSceneSponsorship as any)("one",true,"walkthrough-one",prepOptions());
  const item={itemId:"dish",label:"Dishs",locationNote:null,quantityHint:null,basis:"suggested",images:[]};
  state.docs.set("siteTaskItemInventories/one",{requestId:"one",items:[item]});
  const brief=state.docs.get("siteTaskBriefs/one") as any;
  const {context_digest:_context,...context}=projectWebsiteTaskContext(brief,projectWebsiteCaptureRights(state.docs.get("inboundRequests/one")),{purpose:"scene_preparation"});
  const oldContext=crossRuntimeDigest({...context,task_items:[{item_id:"dish",label:"Dishs",location_note:null,quantity_hint:null,basis:"suggested",images:[]}]});
  const {authority_digest:_authority,...payload}=first;
  const legacy={...payload,task_context_digest:oldContext};
  const original={...legacy,authority_digest:crossRuntimeDigest(legacy)};
  (state.docs.get("inboundRequests/one") as any).website_scene_sponsorship=original;
  vi.spyOn(Date,"now").mockReturnValue((first.expires_at_epoch+10)*1000);
  try {
    const input={approved_by:"blueprint",approval_reference:"owner renewal",ack:SPONSORSHIP_RENEWAL_ACK};
    const before=structuredClone(state.docs.get("inboundRequests/one"));
    const preview=await renewExpiredWebsiteSceneSponsorship("one",{...input,apply:false});
    expect(state.docs.get("inboundRequests/one")).toEqual(before);
    expect(preview).toMatchObject({task_context_digest:first.task_context_digest,
      task_context_projection_migration:{from:oldContext,to:first.task_context_digest,basis:"unphotographed_suggestions_excluded"}});
    // A changed suggestion, an owner statement or a photo cannot pass as the retained projection.
    for(const change of [{label:"Changed suggestion"},{basis:"owner_stated"},
      {images:[{imageId:"photo",storagePath:"scenes/site-one/items/dish/a.png",uploadedAtIso:"2026-10-08"}]}]) {
      state.docs.set("siteTaskItemInventories/one",{requestId:"one",items:[{...item,...change}]});
      await expect(renewExpiredWebsiteSceneSponsorship("one",{...input,apply:true})).rejects.toThrow("website_scene_sponsorship_renewal_scope_changed");
      expect(state.docs.get("inboundRequests/one")).toEqual(before);
    }
    state.docs.set("siteTaskItemInventories/one",{requestId:"one",items:[item]});
    expect(await renewExpiredWebsiteSceneSponsorship("one",{...input,apply:true})).toEqual(preview);
    expect(state.docs.get("inboundRequests/one")?.website_scene_sponsorship_history).toEqual([original]);
  } finally {vi.restoreAllMocks();}
});
it("renewal refuses a grant whose recorded policy cannot be rebuilt",async()=>{
  seed(packet(),false,false);const first=await (loadWebsiteSceneSponsorship as any)("one",true,"walkthrough-one",prepOptions());
  const {authority_digest:_d,...payload}=first;const forged={...payload,policy_digest:`sha256:${"f".repeat(64)}`};
  (state.docs.get("inboundRequests/one") as any).website_scene_sponsorship={...forged,authority_digest:crossRuntimeDigest(forged)};
  vi.spyOn(Date,"now").mockReturnValue((first.expires_at_epoch+10)*1000);
  try {await expect(renewExpiredWebsiteSceneSponsorship("one",{approved_by:"blueprint",approval_reference:"owner chat approval",
    ack:SPONSORSHIP_RENEWAL_ACK,apply:true})).rejects.toThrow("website_scene_sponsorship_renewal_policy_unproven");}
  finally {vi.restoreAllMocks();}
});
it("v2 current preparation spend uses purpose context and preserves unknown reservations",async()=>{
  seed(packet(),false,false);const grant=await (loadWebsiteSceneSponsorship as any)("one",true,"walkthrough-one",prepOptions());
  vi.stubEnv("TASK_EVALUATION_SCENE_PROVIDER_TERMS_JSON",JSON.stringify({vast:{digest:grant.consent.provider_terms_reference,label:"Synthetic",url:"https://example.com/terms"}}));
  const spend={task_context_digest:grant.task_context_digest,allocation_binding_digest:`sha256:${"d".repeat(64)}`,
    resource_class:"gpu_render" as const,provider:"vast" as const,maximum_cost_usd:0.1,request_count:1};
  expect(await reserveWebsitePreparationSpend("one",spend)).toMatchObject({status:"admitted"});
  expect(await reserveWebsitePreparationSpend("one",spend)).toMatchObject({status:"already_reserved"});
  (state.docs.get("inboundRequests/one") as any).request.consent_attestation.granted=false;
  await expect(reserveWebsitePreparationSpend("one",{...spend,allocation_binding_digest:`sha256:${"e".repeat(64)}`})).rejects.toThrow();
  expect(Object.keys((state.docs.get("inboundRequests/one") as any).website_preparation_reservations)).toHaveLength(1);
});
it("v2 context adds only purpose and proposal refresh cannot churn its digest",()=>{
  seed(packet(),false,false);const brief=state.docs.get("siteTaskBriefs/one") as any,rights=projectWebsiteCaptureRights(state.docs.get("inboundRequests/one"));
  const legacy=projectWebsiteTaskContext(brief,rights),prep=projectWebsiteTaskContext(brief,rights,{purpose:"scene_preparation"} as any);
  expect(prep).toMatchObject({confirmed:false,confirmed_at:null,purpose:"scene_preparation"});
  expect(prep.context_digest).not.toBe(legacy.context_digest);expect(legacy).not.toHaveProperty("purpose");
  expect(prep).not.toHaveProperty("assessment_preparation_proposal");
  const {purpose,_unused,...rest}=prep as any;const {context_digest,...payload}=rest;const {context_digest:old,...base}=legacy;
  expect(payload).toEqual(base);
});
it("v2 signed task-context data purpose and sponsorship admission are separate, with no assessment wait",async()=>{
  const {job}=seed(packet(),false,false);(state.docs.get(`siteAssessmentJobs/${job}`) as any).state="queued";
  const app=express();app.use(express.json());app.use((await import("../routes/internal-capture-worlds")).default);
  const server=createServer(app);await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
  const base=`http://127.0.0.1:${(server.address() as any).port}/creator-captures/walkthrough-one`;
  const send=(op:string,body:any)=>fetch(`${base}/${op}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
  try {
    const body={request_id:"one",scene_id:"site-one",purpose:"scene_preparation"};
    const data=await send("task-context",body);expect(data.status).toBe(200);
    expect(await data.json()).toMatchObject({purpose:"scene_preparation",confirmed:false,confirmed_at:null});
    expect((await send("task-context",{...body,purpose:"evaluation"})).status).toBe(400);
    const granted=await send("scene-sponsorship",{...body,expected_task_context_digest:prepOptions().expected_task_context_digest});
    expect(granted.status).toBe(200);
    expect(state.docs.get("inboundRequests/one")?.website_scene_sponsorship).toEqual(await granted.json());
  } finally {await new Promise<void>(resolve=>server.close(()=>resolve()));}
});

it("v2 child grant creation stores base root, then reopens and spends against full bound child without renewal",async()=>{
  seed();const record=state.docs.get("inboundRequests/one") as any;
  delete record.site_advisory;delete record.capture_privacy_source_bound_decision;record.site_task_triage.disposition="qualified";
  const child="supplement-synthetic-child";
  const parent={capture_id:"walkthrough-one",raw_bundle_digest:`sha256:${"a".repeat(64)}`,raw_manifest_uri:"gs://synthetic/scenes/site-one/captures/walkthrough-one/raw/manifest.json",upload_completion_digest:`sha256:${"b".repeat(64)}`,completion_generation:"1",completion_record_generation:"2",manifest_generation:"3"};
  const source={...parent,capture_id:child,raw_manifest_uri:`gs://synthetic/scenes/site-one/captures/${child}/raw/manifest.json`,raw_bundle_digest:`sha256:${"d".repeat(64)}`};
  seams.binding={schema_version:"website_capture_continuation.v1",original_capture_id:"walkthrough-one",capture_id:child,coordinate_frames_independent:true,
    lineage:[{child:source,parent,supplement:{parent_capture_id:parent.capture_id,parent_bundle_digest:parent.raw_bundle_digest,parent_manifest_uri:parent.raw_manifest_uri}}]};
  const brief=state.docs.get("siteTaskBriefs/one") as any;
  const full=projectWebsiteTaskContext(brief,projectWebsiteCaptureRights(record),{captureId:child,captureBinding:seams.binding});
  const returned=await loadWebsiteSceneSponsorship("one",true,child,{expected_task_context_digest:full.context_digest});
  const root=structuredClone((state.docs.get("inboundRequests/one") as any).website_scene_sponsorship);
  expect(root.capture_id).toBe("walkthrough-one");expect(root).not.toHaveProperty("continuation_parent_authority_digest");
  expect(root.task_context_digest).not.toBe(full.context_digest);expect(returned.task_context_digest).toBe(full.context_digest);
  expect(await loadWebsiteSceneSponsorship("one",false,child)).toEqual(returned);
  vi.stubEnv("TASK_EVALUATION_SCENE_PROVIDER_TERMS_JSON",JSON.stringify({vast:{digest:root.consent.provider_terms_reference,label:"Synthetic",url:"https://example.com/terms"}}));
  expect(await reserveWebsitePreparationSpend("one",{task_context_digest:returned.task_context_digest,allocation_binding_digest:`sha256:${"e".repeat(64)}`,
    resource_class:"gpu_render",provider:"vast",maximum_cost_usd:0.1,request_count:1},child)).toMatchObject({status:"admitted"});
  expect((state.docs.get("inboundRequests/one") as any).website_scene_sponsorship).toEqual(root);
  expect(returned.expires_at_epoch).toBe(root.expires_at_epoch);
});
it("v2 no-create sponsor request cannot create a missing grant and reopens an existing grant exactly",async()=>{
  seed(packet(),false,false);const app=express();app.use(express.json());app.use((await import("../routes/internal-capture-worlds")).default);
  const server=createServer(app);await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
  const url=`http://127.0.0.1:${(server.address() as any).port}/creator-captures/walkthrough-one/scene-sponsorship`;
  const send=(body:any)=>fetch(url,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
  const body={request_id:"one",scene_id:"site-one",...prepOptions()};
  try {
    const missing=await send({...body,create:false});expect(missing.status).toBe(409);expect(await missing.json()).toEqual({code:"website_scene_sponsorship_missing"});
    expect(state.docs.get("inboundRequests/one")?.website_scene_sponsorship).toBeUndefined();
    expect((await send({request_id:"one",scene_id:"site-one",create:false})).status).toBe(400);
    const created=await send(body);expect(created.status).toBe(200);const first=await created.json();
    const reopened=await send({...body,create:false});expect(reopened.status).toBe(200);expect(await reopened.json()).toEqual(first);
    expect(state.docs.get("inboundRequests/one")?.website_scene_sponsorship).toEqual(first);
  } finally {await new Promise<void>(resolve=>server.close(()=>resolve()));}
});

function syntheticPreparedIntake(grant:any) {
  const content=`sha256:${"a".repeat(64)}`;
  return {schema_version:"task_evaluation_scene_intake_request.v1",submission_id:grant.capture_id,owner:grant.owner,
    source:{kind:"gaussian_splat",binding_id:`website-splat-${content.slice(7,39)}`,content_digest:content},
    task:{task_id:`website-${grant.task_context_digest.slice(7,27)}`,strategy:"pick_and_place",subject:{geometry_origin:"removed_before_reconstruction"},
      support:{description:"SYNTHETIC support"},destination:{relation:"inside",visible_label:"SYNTHETIC target",position_world_m:[0,0,0],orientation_xyzw:[0,0,0,1]},
      success:{control_frequency_hz:15,maximum_episode_seconds:30,minimum_lift_m:0.01,pregrasp_clearance_m:0.01,
        minimum_planar_displacement_m:0.01,maximum_final_planar_target_error_m:0.1,maximum_retries:0,maximum_regrasps:0}},
    execution:{purpose:"scene_preparation",max_total_spend_usd:grant.max_total_spend_usd,max_paid_attempts:grant.max_paid_attempts,
      max_retries:0,expires_at_epoch:grant.expires_at_epoch,allowed_providers:["vast","openai"],policy_candidates:[],claim_scope:"development_only"},consent:grant.consent};
}
// Lead decision 2026-11-07: confirming a brief is consent state, not task content.
it("a preparation grant follows the site's confirmation of the same brief, never an edit",async()=>{
  seed(packet(),false,false,{},{taskFamily:"general_task"});
  const grant=await loadWebsiteSceneSponsorship("one",true,"walkthrough-one",prepOptions());
  expect(grant.consent.task_confirmed).toBe(false);
  const parent=grant.task_context_digest;
  const stored=structuredClone(state.docs.get("inboundRequests/one")?.website_scene_sponsorship);
  const brief=state.docs.get("siteTaskBriefs/one") as any;
  brief.confirmedAtIso="2026-11-07T14:30:45Z";
  const record=state.docs.get("inboundRequests/one") as any;
  // The unconfirmed projection with a null time (as this grant sealed it), or with none stored.
  expect(confirmationParentContextDigests(brief,projectWebsiteCaptureRights(record),{purpose:"scene_preparation"}))
    .toContain(parent);
  const successor=prepOptions().expected_task_context_digest;
  expect(successor).not.toBe(parent);
  const current=await loadWebsiteSceneSponsorship("one",false,"walkthrough-one",prepOptions());
  // The same allowance, clock and spend history, re-derived for the confirmed successor: the website's own reading.
  expect(current).toMatchObject({task_context_digest:successor,consent:{task_confirmed:true},
    max_total_spend_usd:grant.max_total_spend_usd,max_paid_attempts:grant.max_paid_attempts,
    expires_at_epoch:grant.expires_at_epoch,owner:grant.owner});
  expect(state.docs.get("inboundRequests/one")?.website_scene_sponsorship).toEqual(stored);
  // A stale request still saying unconfirmed is a binding error, not an unconfirmed brief.
  const content=`sha256:${"a".repeat(64)}`;
  const navigation=(consent:any,taskContextDigest:string)=>({schema_version:"task_evaluation_scene_intake_request.v1",
    submission_id:current.capture_id,owner:current.owner,consent,
    source:{kind:"gaussian_splat",binding_id:`website-splat-${content.slice(7,39)}`,content_digest:content},
    task:{task_id:`website-${taskContextDigest.slice(7,27)}`,strategy:"goal_region_navigation",geometry_origin:"kept_as_filmed",
      navigation_task_spec_digest:`sha256:${"1".repeat(64)}`,compiled_task_spec_digest:`sha256:${"2".repeat(64)}`,
      task_success_contract_digest:`sha256:${"3".repeat(64)}`,runtime_contract_digest:`sha256:${"4".repeat(64)}`,
      scene_revision_digest:`sha256:${"5".repeat(64)}`},
    execution:{purpose:"scene_preparation",max_total_spend_usd:current.max_total_spend_usd,max_paid_attempts:current.max_paid_attempts,
      max_retries:0,expires_at_epoch:current.expires_at_epoch,allowed_providers:["vast","openai"],policy_candidates:[],claim_scope:"development_only"}});
  expect(()=>validateWebsiteSponsoredIntake(navigation(grant.consent,parent),current)).toThrow("website_scene_sponsorship_binding_invalid");
  expect(()=>validateWebsiteSponsoredIntake(navigation(current.consent,successor),current)).not.toThrow();
  expect(()=>validateWebsiteSponsoredIntake(navigation(grant.consent,parent),grant)).toThrow("website_task_context_not_confirmed");
  // An edit of the confirmed brief is another task: the grant stays bound to the one it was issued for.
  brief.summary="Move every bin to the dock";
  expect(confirmationParentContextDigests(brief,projectWebsiteCaptureRights(record),{purpose:"scene_preparation"})
    .includes(parent)).toBe(false);
  await expect(loadWebsiteSceneSponsorship("one",false,"walkthrough-one",prepOptions())).rejects.toThrow("website_scene_sponsorship_changed");
});
// Lead decision 2026-11-07: a confirmation records consent and the site's answers to the screening gates.
it("a brief confirmed by accepting our proposal names its sealed parent on the signed read, and its grant follows",async()=>{
  seed(packet(),false,false,{},{taskFamily:"general_task",summary:"Walk down the aisle to its far end without touching the shelves.",
    proposed:[{fieldId:"taskShape",value:"single",basis:"description",reading:"One walk, one goal."}],
    unresolved:["sceneStability","objectVariety","deploymentTimeline","accessWindow"],
    operatorAnswers:null,operatorUnknown:null,successCriteria:null});
  const grant=await loadWebsiteSceneSponsorship("one",true,"walkthrough-one",prepOptions());
  const sealed=grant.task_context_digest;
  const app=express();app.use(express.json());app.use((await import("../routes/internal-capture-worlds")).default);
  const server=createServer(app);await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
  const read=async()=>(await fetch(`http://127.0.0.1:${(server.address() as any).port}/creator-captures/walkthrough-one/task-context`,
    {method:"POST",headers:{"content-type":"application/json"},
     body:JSON.stringify({request_id:"one",scene_id:"site-one",purpose:"scene_preparation"})})).json();
  try {
    expect((await read()).context_digest).toBe(sealed);
    // The site's one click: our description-based proposal becomes its answer; it knows no success criteria.
    const brief=state.docs.get("siteTaskBriefs/one") as any;
    Object.assign(brief,{confirmedAtIso:"2026-11-07T14:30:45.016Z",confirmedBy:"owner",operatorAnswers:{taskShape:"single"},
      operatorUnknown:[],successCriteria:{successDefinition:null,successRate:null,cycleTimeSeconds:null,unknown:true}});
    const successor=await read();
    expect(successor).toMatchObject({confirmed:true,operator_answers:{taskShape:"single"},unresolved:[],
      success_criteria:{unknown:true},confirmation_parent_context_digest:sealed});
    const current=await loadWebsiteSceneSponsorship("one",false,"walkthrough-one",
      {purpose:"scene_preparation",expected_task_context_digest:successor.context_digest});
    expect(current).toMatchObject({task_context_digest:successor.context_digest,consent:{task_confirmed:true},
      max_total_spend_usd:grant.max_total_spend_usd,max_paid_attempts:grant.max_paid_attempts,expires_at_epoch:grant.expires_at_epoch});
    expect(currentWebsitePreparationStatusContext({requestId:"one",captureId:"walkthrough-one",brief,
      record:state.docs.get("inboundRequests/one") as any}).context_digest).toBe(successor.context_digest);
    // A corrected answer is task content: the read names no parent and the grant stays with the task it was issued for.
    brief.operatorAnswers={taskShape:"multiple"};
    const corrected=await read();
    expect(corrected).not.toHaveProperty("confirmation_parent_context_digest");
    await expect(loadWebsiteSceneSponsorship("one",false,"walkthrough-one",
      {purpose:"scene_preparation",expected_task_context_digest:corrected.context_digest})).rejects.toThrow("website_scene_sponsorship_changed");
  } finally {await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
it("v2 false task consent stays rejected publicly and may only bind current signed preparation",async()=>{
  seed(packet(),false,false);const grant=await loadWebsiteSceneSponsorship("one",true,"walkthrough-one",prepOptions());
  const request=syntheticPreparedIntake(grant);
  const {accepted_by,accepted_at_epoch,...publicConsent}=request.consent;
  const publicCommand={submission_id:request.submission_id,source_session_id:request.submission_id,
    task:request.task,execution:request.execution,consent:publicConsent};
  expect(sceneIntakeCommand.safeParse(publicCommand).success).toBe(false);
  expect(sceneIntakeCommand.safeParse({...publicCommand,consent:{...publicConsent,task_confirmed:true}}).success).toBe(true);
  expect(()=>validateWebsiteSponsoredIntake(request,grant)).not.toThrow();
  for(const invalid of [
    {...request,execution:{...request.execution,purpose:undefined}},
    {...request,execution:{...request.execution,policy_candidates:[{id:"policy",artifact_digest:`sha256:${"a".repeat(64)}`}]}},
    {...request,task:{...request.task,robot_binding_id:"not-allowed"}},
    {...request,task:{...request.task,evaluation_source:{kind:"not-allowed"}}},
    {...request,consent:{...request.consent,task_confirmed:true}},
  ]) expect(()=>validateWebsiteSponsoredIntake(invalid,grant)).toThrow("website_scene_sponsorship_binding_invalid");
});
it("a designed subject the task adds binds like a removed one, and any other origin is refused",async()=>{
  seed(packet(),false,false);const grant=await loadWebsiteSceneSponsorship("one",true,"walkthrough-one",prepOptions());
  const request=syntheticPreparedIntake(grant);
  const origin=(geometry_origin:unknown)=>({...request,task:{...request.task,subject:{...request.task.subject,geometry_origin}}});
  expect(()=>validateWebsiteSponsoredIntake(origin("synthetic_design"),grant)).not.toThrow();
  for(const invalid of ["captured_in_scene",undefined])
    expect(()=>validateWebsiteSponsoredIntake(origin(invalid),grant)).toThrow("website_scene_sponsorship_binding_invalid");
});
// 2026-11-10: a scene whose rented machine is lost mid-run gets one more attempt, through the signed contract.
it("a new grant names one scene-configuration retry and the intake accepts 0 or 1, never more",async()=>{
  seed(packet(),false,false);const grant=await loadWebsiteSceneSponsorship("one",true,"walkthrough-one",prepOptions());
  expect(grant.scene_configuration_max_retries).toBe(1);
  const request=syntheticPreparedIntake(grant);
  const retries=(max_retries:unknown)=>({...request,execution:{...request.execution,max_retries}});
  // 0 is every intent issued before the allowance existed; it must keep validating.
  for(const accepted of [0,1]) expect(()=>validateWebsiteSponsoredIntake(retries(accepted),grant)).not.toThrow();
  for(const refused of [2,3,-1,true,"1",undefined])
    expect(()=>validateWebsiteSponsoredIntake(retries(refused),grant)).toThrow("website_scene_sponsorship_binding_invalid");
  // A grant issued before the allowance names no retry: a request may not claim one against it.
  const {scene_configuration_max_retries:_none,...earlier}=grant as any;
  expect(()=>validateWebsiteSponsoredIntake(retries(0),earlier)).not.toThrow();
  expect(()=>validateWebsiteSponsoredIntake(retries(1),earlier)).toThrow("website_scene_sponsorship_binding_invalid");
});
it("renewing a grant issued before the retry allowance restores it without one",async()=>{
  seed(packet(),false,false);const issued=await (loadWebsiteSceneSponsorship as any)("one",true,"walkthrough-one",prepOptions());
  const {authority_digest:_digest,scene_configuration_max_retries:_retries,...payload}=issued;
  const legacy={...payload,authority_digest:crossRuntimeDigest(payload)};
  (state.docs.get("inboundRequests/one") as any).website_scene_sponsorship=legacy;
  vi.stubEnv("TASK_EVALUATION_SCENE_PROVIDER_TERMS_JSON",JSON.stringify({vast:{digest:legacy.consent.provider_terms_reference,label:"Synthetic",url:"https://example.com/terms"}}));
  vi.spyOn(Date,"now").mockReturnValue((legacy.expires_at_epoch+10)*1000);
  try {
    const renewed=await renewExpiredWebsiteSceneSponsorship("one",{approved_by:"blueprint",
      approval_reference:"owner chat approval",ack:SPONSORSHIP_RENEWAL_ACK,apply:true});
    expect(renewed).not.toHaveProperty("scene_configuration_max_retries");
    expect(renewed.renewal).toMatchObject({parent_authority_digest:legacy.authority_digest});
  } finally {vi.restoreAllMocks();}
});
// Owner decision 2026-11-10: one hard money stop, the account's monthly limit. A flagged grant's own
// dollar figures warn instead of refusing, only for a reservation the Pipeline asks for.
async function withSignedRoute<T>(run:(send:(operation:string,body:unknown)=>Promise<Response>)=>Promise<T>) {
  const app=express();app.use(express.json());app.use((await import("../routes/internal-capture-worlds")).default);
  const server=createServer(app);await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
  const base=`http://127.0.0.1:${(server.address() as any).port}/creator-captures/walkthrough-one`;
  try { return await run((operation,body)=>fetch(`${base}/${operation}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)})); }
  finally {await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
}
async function budgetJob() {
  seed(packet(),false,false);const grant=await loadWebsiteSceneSponsorship("one",true,"walkthrough-one",prepOptions());
  vi.stubEnv("TASK_EVALUATION_SCENE_PROVIDER_TERMS_JSON",JSON.stringify({vast:{digest:grant.consent.provider_terms_reference,label:"Synthetic",url:"https://example.com/terms"}}));
  const spend=(n:string,maximum_cost_usd=0.6)=>({task_context_digest:grant.task_context_digest,allocation_binding_digest:`sha256:${n.repeat(64)}`,
    resource_class:"gpu_render" as const,provider:"vast" as const,maximum_cost_usd,request_count:1});
  return {grant,spend};
}
const alertRows=()=>[...state.docs.keys()].filter(key=>key.startsWith("opsWebsiteJobOverBudgetAlerts/"));
it("a flagged grant passes its upstream cap on a Pipeline-requested reservation, with a note and exactly one alert",async()=>{
  const {grant,spend}=await budgetJob();
  expect((grant as any).automatic_budget_extension).toBe(true);
  // The grant's own figures are unchanged: upstream $1 of a $2 preparation total, two paid attempts.
  expect(grant).toMatchObject({upstream_max_spend_usd:1,preparation_max_total_spend_usd:2,max_paid_attempts:2});
  await withSignedRoute(async send=>{
    const first=await send("preparation-spend",{request_id:"one",scene_id:"site-one",spend:spend("d")});
    expect(first.status).toBe(200);
    const second=await send("preparation-spend",{request_id:"one",scene_id:"site-one",spend:spend("e")});
    expect(second.status).toBe(200);expect(await second.json()).toMatchObject({status:"admitted",maximum_cost_usd:0.6});
    const rows=(state.docs.get("inboundRequests/one") as any).website_preparation_reservations;
    expect(rows["d".repeat(64)]).not.toHaveProperty("over_budget");
    expect(rows["e".repeat(64)].over_budget).toMatchObject({basis:"automatic_budget_extension",sponsorship_digest:grant.authority_digest,
      allowance:"preparation_upstream_cap",allowance_usd:1,allowance_exceeded:true,job_ceiling_exceeded:false,
      job_reserved_or_settled_before_usd:0.6});
    // The paid-attempt count still ends the job by itself: a third request is refused, flag or not.
    const third=await send("preparation-spend",{request_id:"one",scene_id:"site-one",spend:spend("f",0.1)});
    expect(third.status).toBe(409);expect(await third.json()).toEqual({code:"website_scene_preparation_budget_exhausted"});
    // The per-reservation limit is the schema's, unchanged.
    expect((await send("preparation-spend",{request_id:"one",scene_id:"site-one",spend:spend("a",1001)})).status).toBe(400);
  });
  expect(alertRows()).toHaveLength(1);
  const alert=vi.fn(async()=>({sent:true})),email=vi.fn();
  const deps={store:(await import("./helpers/fake-firestore")).sharedFakeFirestore as any,alert,email:email as any};
  expect(await scanOverBudgetWebsiteJobs(deps)).toEqual({due:1,alerted:1});
  expect(String((alert.mock.calls[0] as unknown as [string,string])[1])).toContain("request one passed its preparation allowance of $1.00");
  expect(email).not.toHaveBeenCalled();
  expect(await scanOverBudgetWebsiteJobs(deps)).toEqual({due:0,alerted:0});
});
it("a reservation the Pipeline did not request keeps every refusal on a flagged grant",async()=>{
  const {grant,spend}=await budgetJob();
  expect((grant as any).automatic_budget_extension).toBe(true);
  await reserveWebsitePreparationSpend("one",spend("d"));
  // The operator Atlas script and every other direct caller: no host account precheck, so no extension.
  await expect(reserveWebsitePreparationSpend("one",spend("e"))).rejects.toThrow("website_scene_preparation_budget_exhausted");
  expect((state.docs.get("inboundRequests/one") as any).website_preparation_reservations).not.toHaveProperty("e".repeat(64));
  expect(alertRows()).toHaveLength(0);
});
it("with the setting off, a new grant is unflagged and refuses at its upstream cap exactly as before",async()=>{
  vi.stubEnv("BLUEPRINT_WEBSITE_AUTOMATIC_BUDGET_EXTENSION","false");
  const {grant,spend}=await budgetJob();
  expect(grant).not.toHaveProperty("automatic_budget_extension");
  await withSignedRoute(async send=>{
    expect((await send("preparation-spend",{request_id:"one",scene_id:"site-one",spend:spend("d")})).status).toBe(200);
    const refused=await send("preparation-spend",{request_id:"one",scene_id:"site-one",spend:spend("e")});
    expect(refused.status).toBe(409);expect(await refused.json()).toEqual({code:"website_scene_preparation_budget_exhausted"});
  });
  expect(alertRows()).toHaveLength(0);
});
it("a flagged grant past its expiry admits nothing, even on a Pipeline-requested reservation",async()=>{
  const {grant,spend}=await budgetJob();
  vi.spyOn(Date,"now").mockReturnValue((grant.expires_at_epoch+10)*1000);
  try {
    await withSignedRoute(async send=>{
      const refused=await send("preparation-spend",{request_id:"one",scene_id:"site-one",spend:spend("d")});
      expect(refused.status).toBe(409);expect(await refused.json()).toEqual({code:"consent_expired"});
    });
  } finally {vi.restoreAllMocks();}
});
it("a renewal keeps what the expired grant named, whatever the setting says now",async()=>{
  const {grant}=await budgetJob();
  const renew=()=>renewExpiredWebsiteSceneSponsorship("one",{approved_by:"blueprint",approval_reference:"owner chat approval",
    ack:SPONSORSHIP_RENEWAL_ACK,apply:true});
  vi.stubEnv("BLUEPRINT_WEBSITE_AUTOMATIC_BUDGET_EXTENSION","false");
  vi.spyOn(Date,"now").mockReturnValue((grant.expires_at_epoch+10)*1000);
  try { expect((await renew() as any).automatic_budget_extension).toBe(true); } finally {vi.restoreAllMocks();}
  // A grant issued before the extension names none, and its renewal names none with the setting on.
  state.docs.clear();vi.unstubAllEnvs();
  vi.stubEnv("BLUEPRINT_WEBSITE_SCENE_SPONSORSHIP_JSON",JSON.stringify({owner:{user_id:"blueprint",organization_id:"blueprint"},
    upstream_max_spend_usd:1,native_max_spend_usd:1,max_total_spend_usd:2,max_paid_attempts:2,ttl_seconds:3600,provider_terms_reference:`sha256:${"c".repeat(64)}`}));
  const {grant:issued}=await budgetJob();
  const {authority_digest:_d,automatic_budget_extension:_e,...payload}=issued as any;
  const legacy={...payload,authority_digest:crossRuntimeDigest(payload)};
  (state.docs.get("inboundRequests/one") as any).website_scene_sponsorship=legacy;
  vi.spyOn(Date,"now").mockReturnValue((legacy.expires_at_epoch+10)*1000);
  try { expect(await renew()).not.toHaveProperty("automatic_budget_extension"); } finally {vi.restoreAllMocks();}
});
it("an intake names the automatic budget extension only when its grant does",async()=>{
  const {grant}=await budgetJob();
  const request=syntheticPreparedIntake(grant);
  const named=(value:unknown)=>({...request,execution:{...request.execution,automatic_budget_extension:value}});
  expect(()=>validateWebsiteSponsoredIntake(request,grant)).not.toThrow();
  expect(()=>validateWebsiteSponsoredIntake(named(true),grant)).not.toThrow();
  for(const refused of [false,"true",1])
    expect(()=>validateWebsiteSponsoredIntake(named(refused),grant)).toThrow("website_scene_sponsorship_binding_invalid");
  const {automatic_budget_extension:_none,...unflagged}=grant as any;
  expect(()=>validateWebsiteSponsoredIntake(request,unflagged)).not.toThrow();
  expect(()=>validateWebsiteSponsoredIntake(named(true),unflagged)).toThrow("website_scene_sponsorship_binding_invalid");
  // Only the Website sponsored execution may carry it; every other intake schema refuses the field.
  expect(websiteSceneExecution.safeParse(named(true).execution).success).toBe(true);
  expect(sceneIntakeCommand.shape.execution.safeParse(named(true).execution).success).toBe(false);
});
// The scene intake buys nothing itself; every paid launch under it is admitted on the host.
it.each([["flagged",true],["unflagged",false]])("a scene intake past the job ceiling on a %s grant",async(_label,flagged)=>{
  if(!flagged) vi.stubEnv("BLUEPRINT_WEBSITE_AUTOMATIC_BUDGET_EXTENSION","false");
  seed(packet(),false,false);state.docs.set("siteTaskItemInventories/one",{requestId:"one",items:[]});
  const grant=await loadWebsiteSceneSponsorship("one",true,"walkthrough-one",prepOptions());
  vi.stubEnv("TASK_EVALUATION_SCENE_PROVIDER_TERMS_JSON",JSON.stringify(Object.fromEntries(["vast","openai"].map(p=>[p,
    {digest:grant.consent.provider_terms_reference,label:"Synthetic",url:"https://example.com/terms"}]))));
  await withSignedRoute(async send=>{
    expect((await send("task-item-evidence",{request_id:"one",scene_id:"site-one",task_context_digest:grant.task_context_digest,
      evidence_digest:`sha256:${"b".repeat(64)}`,items:[]})).status).toBe(200);
    expect((await send("visual-scene",{request_id:"one",scene_id:"site-one",task_context_digest:grant.task_context_digest,
      world_id:"SYNTHETIC-world",operation_id:"SYNTHETIC-operation",model:"marble-1.1-plus",thumbnail_url:null,pano_url:null,
      launch_url:"https://marble.worldlabs.ai/world/SYNTHETIC"})).status).toBe(200);
    // The job already holds $39.50 of its $40 default ceiling; the intake's $1 construction allowance passes it.
    const record=state.docs.get("inboundRequests/one") as any;
    record.website_preparation_reservations={held:{admission:{maximum_cost_usd:39.5,request_count:1},settlement:{actual_cost_usd:39.5}}};
    if(flagged){
      // A Pipeline reservation past the upstream cap records the job's one alert for this grant first.
      const spent=await send("preparation-spend",{request_id:"one",scene_id:"site-one",spend:{task_context_digest:grant.task_context_digest,
        allocation_binding_digest:`sha256:${"d".repeat(64)}`,resource_class:"gpu_render",provider:"vast",maximum_cost_usd:0.4,request_count:1}});
      expect(spent.status).toBe(200);expect(alertRows()).toHaveLength(1);
    }
    const response=await send("prepared-scene",{request_id:"one",scene_id:"site-one",request:syntheticPreparedIntake(grant)});
    const alerts=alertRows();
    if(!flagged){
      expect(response.status).toBe(409);expect(await response.json()).toEqual({code:"website_scene_preparation_budget_exhausted"});
      expect(alerts).toHaveLength(0);
      return;
    }
    expect(response.status).toBe(202);const receipt=await response.json();
    expect((state.docs.get(`taskEvaluationSceneIntakes/${receipt.id}`) as any).over_budget).toMatchObject({
      basis:"automatic_budget_extension",sponsorship_digest:grant.authority_digest,allowance:"native_construction_allowance",
      allowance_usd:1,job_ceiling_usd:40,job_ceiling_exceeded:true,job_reserved_or_settled_before_usd:39.9});
    // Never a second alert for the same job and grant: the reservation's marker stands.
    expect(alerts).toHaveLength(1);
    expect((state.docs.get(alerts[0]) as any).reservation_key).toBe("d".repeat(64));
  });
});
import { scanOverBudgetWebsiteJobs } from "../utils/websitePreparationOpsAlerts";
import { websiteSceneExecution } from "../utils/taskEvaluationSceneIntake";
it("v2 actual signed item/visual/intake handlers retain purpose through transactions and outbox replay",async()=>{
  seed(packet(),false,false);state.docs.set("siteTaskItemInventories/one",{requestId:"one",items:[]});
  const grant=await loadWebsiteSceneSponsorship("one",true,"walkthrough-one",prepOptions());
  const request=syntheticPreparedIntake(grant);
  vi.stubEnv("TASK_EVALUATION_SCENE_PROVIDER_TERMS_JSON",JSON.stringify(Object.fromEntries(["vast","openai"].map(p=>[p,
    {digest:grant.consent.provider_terms_reference,label:"Synthetic",url:"https://example.com/terms"}]))));
  const app=express();app.use(express.json());app.use((await import("../routes/internal-capture-worlds")).default);
  const server=createServer(app);await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
  const base=`http://127.0.0.1:${(server.address() as any).port}/creator-captures/walkthrough-one`;
  const send=(op:string,body:any)=>fetch(`${base}/${op}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
  try {
    const item=await send("task-item-evidence",{request_id:"one",scene_id:"site-one",task_context_digest:grant.task_context_digest,
      evidence_digest:`sha256:${"b".repeat(64)}`,items:[]});expect(item.status).toBe(200);
    const visual=await send("visual-scene",{request_id:"one",scene_id:"site-one",task_context_digest:grant.task_context_digest,
      world_id:"SYNTHETIC-world",operation_id:"SYNTHETIC-operation",model:"marble-1.1-plus",thumbnail_url:null,pano_url:null,launch_url:"https://marble.worldlabs.ai/world/SYNTHETIC"});
    expect(visual.status).toBe(200);
    const body={request_id:"one",scene_id:"site-one",request};
    const first=await send("prepared-scene",body);expect(first.status).toBe(202);const receipt=await first.json();
    expect(receipt.request_digest).toBe(sceneDigest(request));
    const replay=await send("prepared-scene",body);expect(replay.status).toBe(202);expect(await replay.json()).toEqual(receipt);
    const stored=state.docs.get(`taskEvaluationSceneIntakes/${receipt.id}`) as any;
    expect(stored.command.consent.task_confirmed).toBe(false);expect(stored.state).toBe("forward_pending");
    expect(state.docs.get("siteTaskBriefs/one")?.confirmedAtIso).toBeNull();
    // A corrected prepared derivative gets immutable intake bytes, while the
    // customer job, source and existing funding reservations stay the same.
    const rootBefore = structuredClone(state.docs.get("inboundRequests/one"));
    stored.forward_attempt_count = 3;
    const corrected = structuredClone(request) as any;
    corrected.task.subject.website_preparation_revision = {
      capture_id: grant.capture_id, corrections_digest: `sha256:${"c".repeat(64)}` };
    const {submission_id: _oldSubmission, ...correctedBody} = corrected;
    corrected.submission_id = `website-correction-${sceneDigest(correctedBody).slice(7)}`;
    const correctionResponse = await send("prepared-scene", {...body, request: corrected});
    expect(correctionResponse.status).toBe(202);
    const correctionReceipt = await correctionResponse.json();
    expect(correctionReceipt.id).not.toBe(receipt.id);
    expect(await (await send("prepared-scene", {...body, request: corrected})).json()).toEqual(correctionReceipt);
    const revised = state.docs.get(`taskEvaluationSceneIntakes/${correctionReceipt.id}`) as any;
    expect(revised.source_session_id).toBe(grant.capture_id);
    expect(revised.command.source_session_id).toBe(grant.capture_id);
    expect(revised.request.execution).toEqual(request.execution);
    expect(revised.sponsorship_digest).toBe(grant.authority_digest);
    expect(stored.forward_attempt_count).toBe(3);
    expect(stored.request).toEqual(request);
    expect(state.docs.get("inboundRequests/one")).toEqual(rootBefore);
    const forged = structuredClone(corrected);
    forged.task.subject.website_preparation_revision.capture_id = "other-capture";
    expect((await send("prepared-scene", {...body, request: forged})).status).toBe(409);
    const {submission_id: _forgedSubmission, ...forgedBody} = forged;
    forged.submission_id = `website-correction-${sceneDigest(forgedBody).slice(7)}`;
    expect((await send("prepared-scene", {...body, request: forged})).status).toBe(409);
    // A re-queued assessment does not hold the prepared scene; withdrawn rights do.
    const job=(state.docs.get("inboundRequests/one") as any).site_advisory.job_id;
    (state.docs.get(`siteAssessmentJobs/${job}`) as any).state="queued";
    expect((await send("prepared-scene",body)).status).toBe(202);
    (state.docs.get("inboundRequests/one") as any).future_processing_allowed=false;
    expect((await send("prepared-scene",body)).status).toBe(409);
    expect((await send("visual-scene",{request_id:"one",scene_id:"site-one",task_context_digest:grant.task_context_digest,
      world_id:"SYNTHETIC-world",operation_id:"SYNTHETIC-operation",model:"marble-1.1-plus",thumbnail_url:null,pano_url:null,launch_url:"https://marble.worldlabs.ai/world/SYNTHETIC"})).status).toBe(409);
  } finally {await new Promise<void>(resolve=>server.close(()=>resolve()));}
});

it("v2 actual outbox worker reopens current prep authority and sends only the retained exact offline request",async()=>{
  seed(packet(),false,false);const grant=await loadWebsiteSceneSponsorship("one",true,"walkthrough-one",prepOptions());
  const request=syntheticPreparedIntake(grant),{accepted_by,accepted_at_epoch,...consent}=request.consent;
  state.docs.set("taskEvaluationSceneIntakes/SYNTHETIC-outbox",{owner_user_id:grant.owner.user_id,organization_id:grant.owner.organization_id,
    source_session_id:request.submission_id,website_request_id:"one",root_sponsorship_digest:grant.authority_digest,sponsorship_digest:grant.authority_digest,
    command:{submission_id:request.submission_id,source_session_id:request.submission_id,task:request.task,execution:request.execution,consent},
    request,request_digest:sceneDigest(request),state:"forward_pending",forward_attempt_count:0,next_forward_at_ms:0});
  vi.stubEnv("TASK_EVALUATION_SCENE_PROVIDER_TERMS_JSON",JSON.stringify(Object.fromEntries(["vast","openai"].map(p=>[p,
    {digest:grant.consent.provider_terms_reference,label:"Synthetic",url:"https://example.com/terms"}]))));
  vi.stubEnv("TASK_EVALUATION_LAUNCH_URL","https://pipeline.invalid/api/live-pipeline/task-evaluation-launches");
  vi.stubEnv("ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN","SYNTHETIC-test-token");
  const fetch=vi.fn(async(_url:any,options:any)=>{expect(JSON.parse(options.body)).toEqual(request);
    const receipt={schema_version:"task_evaluation_scene_intake_receipt.v1",status:"accepted",intent_id:"SYNTHETIC-intent",
      intent_digest:`sha256:${"a".repeat(64)}`,request_digest:sceneDigest(request),provider_mutation_performed_inside_http_request:false};
    return new Response(JSON.stringify({...receipt,receipt_digest:sceneDigest(receipt)}));});
  vi.stubGlobal("fetch",fetch);
  try {await processSceneIntakeQueue(1);expect(fetch).toHaveBeenCalledTimes(1);
    expect(state.docs.get("taskEvaluationSceneIntakes/SYNTHETIC-outbox")).toMatchObject({state:"accepted",forward_attempt_count:1});}
  finally {vi.unstubAllGlobals();}
});

it("v2 managed authoring keeps the exact preparation digest allowlist and cannot inherit a legacy hash",async()=>{
  seed(packet(),false,false,{capture_region:"us",sol_agents_api_consent:{granted:true,statement_version:"2026-09-24.v1"}});
  vi.stubEnv("BLUEPRINT_WEBSITE_AGENTS_API_POLICY_JSON",JSON.stringify({schema_version:"scene_configuration_agents_api_policy.v1",
    disclosure_scope:"task_asset_source_frames_and_metric_envelope",session_retention:"until_deleted",trace_retention:"provider_default",
    region:"us",budget_policy:"project_guard_accepted_uncertainty",project_guard_receipt_digest:`sha256:${"a".repeat(64)}`,ttl_seconds:60,maximum_review_cycles:1}));
  const brief=state.docs.get("siteTaskBriefs/one") as any,record=state.docs.get("inboundRequests/one");
  const legacy=projectWebsiteTaskContext(brief,projectWebsiteCaptureRights(record)).context_digest;
  vi.stubEnv("BLUEPRINT_WEBSITE_AGENTS_API_TASK_DIGESTS",JSON.stringify([legacy]));
  await expect(loadWebsiteSceneSponsorship("one",true,"walkthrough-one",prepOptions())).rejects.toThrow("website_agents_api_task_not_authorized");
  expect(state.docs.get("inboundRequests/one")?.website_scene_sponsorship).toBeUndefined();
  vi.stubEnv("BLUEPRINT_WEBSITE_AGENTS_API_TASK_DIGESTS",JSON.stringify([prepOptions().expected_task_context_digest]));
  expect(await loadWebsiteSceneSponsorship("one",true,"walkthrough-one",prepOptions())).toMatchObject({purpose:"scene_preparation",authoring_agent_runtime:"openai_agents_api"});
});
it("v2 existing legacy grant cannot be relabeled as preparation or renewed by an explicit purpose request",async()=>{
  seed();(state.docs.get("inboundRequests/one") as any).site_task_triage.disposition="qualified";
  const legacy=await loadWebsiteSceneSponsorship("one",true);
  await expect(loadWebsiteSceneSponsorship("one",true,"walkthrough-one",prepOptions())).rejects.toThrow("website_scene_sponsorship_changed");
  expect(state.docs.get("inboundRequests/one")?.website_scene_sponsorship).toEqual(legacy);
});

it("v2 status validates an actual loader-persisted expired base grant without any assessment",async()=>{
  seed(packet(),false,false);const first=await loadWebsiteSceneSponsorship("one",true,"walkthrough-one",prepOptions());
  const record=state.docs.get("inboundRequests/one") as any,brief=state.docs.get("siteTaskBriefs/one") as any;
  const before=structuredClone(record.website_scene_sponsorship);
  delete record.site_advisory;
  const input={requestId:"one",captureId:"walkthrough-one",brief,record};
  vi.spyOn(Date,"now").mockReturnValue((first.expires_at_epoch+1)*1000);
  try {expect(currentWebsitePreparationStatusContext(input).context_digest).toBe(first.task_context_digest);
    await expect(loadWebsiteSceneSponsorship("one",false)).rejects.toThrow("consent_expired");
    const forged={...record,website_scene_sponsorship:{...record.website_scene_sponsorship,max_total_spend_usd:999}};
    expect(()=>currentWebsitePreparationStatusContext({...input,record:forged})).toThrow("website_scene_sponsorship_binding_invalid");
    expect(record.website_scene_sponsorship).toEqual(before);
  } finally {vi.restoreAllMocks();}
});

it("prepares an arbitrary accepted task and grants its execution like any other once the site is qualified",async()=>{
  const {record}=seed();record.site_task_scope={supported:false,kind:null,reason:"deformable",disposition:"accepted_for_analysis"};
  const brief=state.docs.get("siteTaskBriefs/one") as any;
  const expected=projectWebsiteTaskContext(brief,projectWebsiteCaptureRights(record),{purpose:"scene_preparation"}).context_digest;
  const authority=websiteSceneSponsorship({requestId:"one",record,brief,purpose:"scene_preparation",expected_task_context_digest:expected,now:Date.now()/1000});
  expect(authority).toMatchObject({purpose:"scene_preparation"});
  // The site screen still decides; the task-kind reading never does.
  expect(()=>websiteSceneSponsorship({requestId:"one",record,brief,now:Date.now()/1000}))
    .toThrow("website_scene_site_not_qualified");
  record.site_task_triage.disposition="qualified";
  expect(()=>websiteSceneSponsorship({requestId:"one",record,brief,now:Date.now()/1000}))
    .not.toThrow("website_scene_site_not_qualified");
});

function currentPreparationRequest() {
  const context = projectWebsiteTaskContext(state.docs.get("siteTaskBriefs/one") as any,
    projectWebsiteCaptureRights(state.docs.get("inboundRequests/one")), {purpose:"scene_preparation"});
  return {purpose:"scene_preparation" as const,expected_task_context_digest:context.context_digest};
}
it("rejects a stale caller snapshot without any write",async()=>{
  vi.stubEnv("BLUEPRINT_SITE_VIDEO_EVIDENCE_ENABLED","true");seed(packet(),false,false);
  const options=currentPreparationRequest();
  (state.docs.get("siteTaskBriefs/one") as any).operatorAnswers={workload:"20"};
  const before=structuredClone([...state.docs]);
  await expect(loadWebsiteSceneSponsorship("one",true,"walkthrough-one",options)).rejects.toThrow("website_task_context_changed");
  expect([...state.docs]).toEqual(before);
});
it("refuses a revoked source and prepares with assessment evidence disabled",async()=>{
  for(const disabled of [false,true]) {
    state.docs.clear();seed(packet(),false,false);vi.stubEnv("BLUEPRINT_SITE_VIDEO_EVIDENCE_ENABLED",disabled?"false":"true");
    (state.docs.get("siteTaskBriefs/one") as any).taskFamily="general_task";
    if(!disabled)(state.docs.get("inboundRequests/one") as any).request.consent_attestation.revoked_at_iso="2026-10-27T00:00:00Z";
    const options=currentPreparationRequest(),before=structuredClone([...state.docs]);
    if(disabled) {expect(await loadWebsiteSceneSponsorship("one",true,"walkthrough-one",options)).toMatchObject({purpose:"scene_preparation"});continue;}
    await expect(loadWebsiteSceneSponsorship("one",true,"walkthrough-one",options)).rejects.toThrow("source_revoked");
    expect([...state.docs]).toEqual(before);
  }
});

async function legacyRoutingGrant(requestExtras: Record<string, unknown> = {}) {
  const {record,job}=seed(packet(),false,false,requestExtras);
  const current=projectWebsiteTaskContext(state.docs.get("siteTaskBriefs/one") as any,
    projectWebsiteCaptureRights(record),{purpose:"scene_preparation"});
  const grant=await loadWebsiteSceneSponsorship("one",true,"walkthrough-one",currentPreparationRequest());
  const {authority_digest:_digest,...payload}=grant;
  const old={...payload,task_context_digest:legacyRoutingTaskContextDigest(current)};
  const retained={...old,authority_digest:(await import("../utils/crossRuntimeCanonical")).crossRuntimeDigest(old)};
  state.docs.get("inboundRequests/one")!.website_scene_sponsorship=retained;
  return {current,retained,job};
}
it("continues only the exact old routing projection under its retained allowance",async()=>{
  const {current,retained}=await legacyRoutingGrant();
  const before=structuredClone([...state.docs]);
  const grant=await loadWebsiteSceneSponsorship("one",false,"walkthrough-one",currentPreparationRequest());
  expect(grant.task_context_digest).toBe(current.context_digest);
  expect(grant.assessment_parent_authority_digest).toBe(retained.authority_digest);
  for(const field of ["max_total_spend_usd","preparation_max_total_spend_usd","upstream_max_spend_usd","max_paid_attempts","expires_at_epoch","consent"])
    expect(grant[field]).toEqual(retained[field as keyof typeof retained]);
  const record=state.docs.get("inboundRequests/one")!;
  expect(currentWebsitePreparationStatusContext({requestId:"one",captureId:"walkthrough-one",brief:state.docs.get("siteTaskBriefs/one") as any,
    record}).context_digest).toBe(current.context_digest);
  expect([...state.docs]).toEqual(before);
});
it.each(["owner_facts","invalid_parent","different_projection"])("refuses a legacy routing continuation with changed %s",async(change)=>{
  const {retained}=await legacyRoutingGrant();
  const record=state.docs.get("inboundRequests/one")!;
  const brief=state.docs.get("siteTaskBriefs/one") as any;
  const {crossRuntimeDigest}=await import("../utils/crossRuntimeCanonical");
  if(change==="owner_facts")brief.operatorAnswers={workload:"20"};
  else if(change==="invalid_parent")retained.max_total_spend_usd=999;
  else {retained.task_context_digest=`sha256:${"f".repeat(64)}`;const {authority_digest:_digest,...payload}=retained;retained.authority_digest=crossRuntimeDigest(payload);}
  expect(()=>websiteSceneSponsorship({requestId:"one",record,brief,purpose:"scene_preparation",now:Date.now()/1000})).toThrow();
  expect(()=>currentWebsitePreparationStatusContext({requestId:"one",captureId:"walkthrough-one",record,brief})).toThrow();
});
it("keeps expired legacy routing authority closed to dispatch while allowing exact status evidence",async()=>{
  const {retained,current}=await legacyRoutingGrant();
  retained.expires_at_epoch=Date.now()/1000-1;
  const {authority_digest:_digest,...payload}=retained;
  retained.authority_digest=(await import("../utils/crossRuntimeCanonical")).crossRuntimeDigest(payload);
  await expect(loadWebsiteSceneSponsorship("one",false,"walkthrough-one",currentPreparationRequest())).rejects.toThrow("consent_expired");
  expect(currentWebsitePreparationStatusContext({requestId:"one",captureId:"walkthrough-one",record:state.docs.get("inboundRequests/one")!,
    brief:state.docs.get("siteTaskBriefs/one") as any}).context_digest).toBe(current.context_digest);
});

it("preserves the exact managed-agent task allowlist across the routing projection",async()=>{
  vi.stubEnv("BLUEPRINT_WEBSITE_AGENTS_API_POLICY_JSON",JSON.stringify({schema_version:"scene_configuration_agents_api_policy.v1",
    disclosure_scope:"task_asset_source_frames_and_metric_envelope",session_retention:"until_deleted",trace_retention:"provider_default",
    region:"us",budget_policy:"project_guard_accepted_uncertainty",project_guard_receipt_digest:`sha256:${"d".repeat(64)}`,
    ttl_seconds:60,maximum_review_cycles:1}));
  const extras={capture_region:"us",sol_agents_api_consent:{granted:true,statement_version:"2026-09-24.v1"}};
  seed(packet(),false,false,extras);
  vi.stubEnv("BLUEPRINT_WEBSITE_AGENTS_API_TASK_DIGESTS",JSON.stringify([currentPreparationRequest().expected_task_context_digest]));
  const {retained,current}=await legacyRoutingGrant(extras);
  vi.stubEnv("BLUEPRINT_WEBSITE_AGENTS_API_TASK_DIGESTS",JSON.stringify([retained.task_context_digest]));
  const grant=await loadWebsiteSceneSponsorship("one",false,"walkthrough-one",currentPreparationRequest());
  expect(grant).toMatchObject({task_context_digest:current.context_digest,authoring_agent_runtime:"openai_agents_api",
    assessment_parent_authority_digest:retained.authority_digest,max_total_spend_usd:retained.max_total_spend_usd,
    expires_at_epoch:retained.expires_at_epoch});
  vi.stubEnv("BLUEPRINT_WEBSITE_AGENTS_API_TASK_DIGESTS","[]");
  await expect(loadWebsiteSceneSponsorship("one",false,"walkthrough-one",currentPreparationRequest())).rejects.toThrow("website_agents_api_task_not_authorized");
});


it("prepares without using or rewriting unsupported advisory claims", async () => {
  const p=packet();
  p.raw_model_assessment.known.push({...fact(),evidence:[{...fact().evidence[0],selector:{kind:"video_observation",observation_index:9,field_path:null}}]} as never);
  seed(p);
  const grant=await loadWebsiteSceneSponsorship("one",true,"walkthrough-one",prepOptions());
  expect(grant).toMatchObject({purpose:"scene_preparation"});
  expect(grant).not.toHaveProperty("assessment_preparation_proposal");
  expect(state.docs.get("agentRuns/assessment-one")?.artifacts.site_assessment_packet).toEqual(p);
});

it("rebinds a verified child source without a new advisory or a fresh allowance", async () => {
  seed(packet(), false, false);
  let root = await loadWebsiteSceneSponsorship("one", true, "walkthrough-one", prepOptions());
  const record = state.docs.get("inboundRequests/one") as any;
  const brief = state.docs.get("siteTaskBriefs/one") as any;
  const child = `supplement-${"a".repeat(40)}`;
  // Old stored grants can retain an advisory proposal for their original source.
  // The child continuation needs no new proposal and must not send the old one as child authority.
  const {authority_digest: _originalDigest, ...legacyPayload} = root;
  legacyPayload.assessment_preparation_proposal = {schema_version:"site_assessment_preparation_proposal.v1",
    capture_id:"walkthrough-one",source_key:"retained-source",job_id:"retained-advisory"};
  root = {...legacyPayload,authority_digest:(await import("../utils/crossRuntimeCanonical")).crossRuntimeDigest(legacyPayload)};
  record.website_scene_sponsorship = root;
  const binding = { schema_version: "website_capture_continuation.v1", capture_id: child, original_capture_id: "walkthrough-one",
    coordinate_frames_independent: true, lineage: [{ child: {capture_id: child}, parent: {capture_id: "walkthrough-one"} }] };
  const context = projectWebsiteTaskContext(brief, projectWebsiteCaptureRights(record), { captureId: child,
    captureBinding: binding, purpose: "scene_preparation" });
  const input = { requestId: "one", brief, record, now: Date.now() / 1000, captureId: child, captureBinding: binding,
    purpose: "scene_preparation" as const, expected_task_context_digest: context.context_digest };
  const renewedContext = websiteSceneSponsorship(input);
  expect(renewedContext).toMatchObject({ capture_id: child, task_context_digest: context.context_digest,
    continuation_parent_authority_digest: root.authority_digest, expires_at_epoch: root.expires_at_epoch,
    max_total_spend_usd: root.max_total_spend_usd, max_paid_attempts: root.max_paid_attempts });
  expect(renewedContext).not.toHaveProperty("assessment_preparation_proposal");
  expect(record.website_scene_sponsorship).toEqual(root);
  // A replacement video does not authorize different task instructions under
  // the parent's per-task provider policy.
  const changed = { ...brief, summary: "A materially different robot job" };
  const changedContext = projectWebsiteTaskContext(changed, projectWebsiteCaptureRights(record), { captureId: child,
    captureBinding: binding, purpose: "scene_preparation" });
  expect(() => websiteSceneSponsorship({ ...input, brief: changed,
    expected_task_context_digest: changedContext.context_digest })).toThrow("website_scene_sponsorship_changed");
});

import { currentWebsiteSceneContext } from "../utils/websiteSceneSponsorship";
import { PLACEHOLDER_TASK_SUMMARY } from "../utils/siteTaskBrief";
// Owner decision 2026-10-28: preparation starts from the received video, before the
// site has named its job. A grant issued for the placeholder brief authorized no task
// instructions, so naming, correcting or confirming the task continues that grant.
it("a preparation grant issued before the task was named follows the site's naming, corrections and confirmation", async () => {
  seed(packet(), false, false, {}, { summary: PLACEHOLDER_TASK_SUMMARY });
  const root = await loadWebsiteSceneSponsorship("one", true, "walkthrough-one", prepOptions());
  const record = state.docs.get("inboundRequests/one") as any, brief = state.docs.get("siteTaskBriefs/one") as any;
  expect(record.website_scene_sponsorship).toEqual(root);
  brief.summary = "Pick up the glass vase and place it at the other end of the same table";
  brief.operatorAnswers = { workload: "daily" };
  const named = await loadWebsiteSceneSponsorship("one", true, "walkthrough-one", prepOptions());
  expect(named).toMatchObject({ purpose: "scene_preparation", task_context_digest: prepOptions().expected_task_context_digest,
    assessment_parent_authority_digest: root.authority_digest, expires_at_epoch: root.expires_at_epoch,
    max_total_spend_usd: root.max_total_spend_usd, max_paid_attempts: root.max_paid_attempts });
  expect(record.website_scene_sponsorship).toEqual(root);
  expect(currentWebsiteSceneContext({ requestId: "one", captureId: "walkthrough-one", brief, record }).context_digest)
    .toBe(named.task_context_digest);
  expect(currentWebsitePreparationStatusContext({ requestId: "one", captureId: "walkthrough-one", brief, record }).context_digest)
    .toBe(named.task_context_digest);
  brief.summary = "Pick up the glass vase and place it beside the chair";
  brief.confirmedAtIso = "2026-10-29T00:00:00Z";
  expect(await loadWebsiteSceneSponsorship("one", true, "walkthrough-one", prepOptions()))
    .toMatchObject({ consent: { task_confirmed: true }, assessment_parent_authority_digest: root.authority_digest });
});
it("a placeholder grant issued before its marker follows only a provable first naming", async () => {
  seed(packet(), false, false, {}, { summary: PLACEHOLDER_TASK_SUMMARY });
  const root = await loadWebsiteSceneSponsorship("one", true, "walkthrough-one", prepOptions());
  const record = state.docs.get("inboundRequests/one") as any, brief = state.docs.get("siteTaskBriefs/one") as any;
  delete record.website_scene_sponsorship_unnamed_task;
  brief.summary = "Pick up the glass vase and place it at the other end of the same table";
  expect(await loadWebsiteSceneSponsorship("one", true, "walkthrough-one", prepOptions()))
    .toMatchObject({ assessment_parent_authority_digest: root.authority_digest });
  // A fact the retained placeholder context cannot be shown to have held.
  brief.operatorAnswers = { workload: "daily" };
  await expect(loadWebsiteSceneSponsorship("one", true, "walkthrough-one", prepOptions())).rejects.toThrow("website_scene_sponsorship_changed");
});
it("a grant issued for a named task still refuses different task instructions", async () => {
  seed(packet(), false, false);
  const root = await loadWebsiteSceneSponsorship("one", true, "walkthrough-one", prepOptions());
  const record = state.docs.get("inboundRequests/one") as any, brief = state.docs.get("siteTaskBriefs/one") as any;
  expect(record).not.toHaveProperty("website_scene_sponsorship_unnamed_task");
  brief.summary = "Move bins and stack crates";
  await expect(loadWebsiteSceneSponsorship("one", true, "walkthrough-one", prepOptions())).rejects.toThrow("website_scene_sponsorship_changed");
  expect(() => currentWebsiteSceneContext({ requestId: "one", captureId: "walkthrough-one", brief, record })).toThrow("website_scene_sponsorship_changed");
  expect(record.website_scene_sponsorship).toEqual(root);
});

// Owner-approved, time-only extension of the bound scene intent (operator door -> Pipeline -> signed notice).
it("the Pipeline's non-creating grant read follows a verified intent extension; nothing else does",async()=>{
  seed(packet(),false,false);
  const grant=await loadWebsiteSceneSponsorship("one",true,"walkthrough-one",prepOptions());
  const record=state.docs.get("inboundRequests/one") as any;
  const intake={website_request_id:"one",source_session_id:"walkthrough-one",state:"accepted",
    root_sponsorship_digest:grant.authority_digest,sponsorship_digest:grant.authority_digest,
    request:{execution:{expires_at_epoch:grant.expires_at_epoch,max_total_spend_usd:grant.max_total_spend_usd}},
    receipt:{intent_id:"scene-one",intent_digest:`sha256:${"a".repeat(64)}`}} as any;
  intake.request_digest=crossRuntimeDigest(intake.request);
  intake.execution_window_extensions=[{schema_version:"task_evaluation_scene_execution_window_extension_notice.v1",
    intent_id:"scene-one",intent_digest:`sha256:${"a".repeat(64)}`,extension_digest:`sha256:${"7".repeat(64)}`,
    original_expires_at_epoch:grant.expires_at_epoch,expires_at_epoch:grant.expires_at_epoch+86400,
    issued_at_epoch:grant.expires_at_epoch+60,authorization_reference:"founder approval (time only)",
    authorized_via:"operator_door",received_at_iso:"2026-10-31T12:00:00Z"}];
  state.docs.set("taskEvaluationSceneIntakes/intake-one",intake);
  record.website_scene_sponsorship_execution_window={schema_version:"website_scene_sponsorship_execution_window.v1",
    scope:"execution_time_only",authority_digest:grant.authority_digest,intent_id:"scene-one",intake_id:"intake-one",
    extension_digest:`sha256:${"7".repeat(64)}`,original_expires_at_epoch:grant.expires_at_epoch,
    expires_at_epoch:grant.expires_at_epoch+86400};
  const stored=structuredClone(record.website_scene_sponsorship);
  const app=express();app.use(express.json());app.use((await import("../routes/internal-capture-worlds")).default);
  const server=createServer(app);await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
  const base=`http://127.0.0.1:${(server.address() as any).port}/creator-captures/walkthrough-one`;
  const read=()=>fetch(`${base}/scene-sponsorship`,{method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({request_id:"one",scene_id:"site-one",...prepOptions(),create:false})});
  const realNow=Date.now.bind(Date);
  const clock=vi.spyOn(Date,"now").mockReturnValue((grant.expires_at_epoch+3600)*1000);
  try {
    const response=await read();
    expect(response.status).toBe(200);
    // The same retained grant: digest, caps, attempts and raw expiry unchanged.
    expect(await response.json()).toEqual(grant);
    expect(record.website_scene_sponsorship).toEqual(stored);
    // Any other read still sees the grant's own expiry. A native paid reservation
    // follows the same window (tested below); its caps and terms are unchanged.
    await expect(loadWebsiteSceneSponsorship("one",false)).rejects.toThrow("consent_expired");
    // A revoked intake, or an extension the intake does not hold, ends it again.
    intake.revocation_requested=true;
    expect((await read()).status).toBe(409);
    delete intake.revocation_requested;const extensions=intake.execution_window_extensions;
    intake.execution_window_extensions=[];
    expect(await (await read()).json()).toEqual({code:"consent_expired"});
    // At the end of the extended window it is expired like any other grant.
    intake.execution_window_extensions=extensions;expect((await read()).status).toBe(200);
    clock.mockReturnValue((grant.expires_at_epoch+86400)*1000);
    expect(await (await read()).json()).toEqual({code:"consent_expired"});
  } finally {
    clock.mockImplementation(realNow);vi.restoreAllMocks();
    await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
  }
});

// Owner-approved 2026-11-03: a native/Marble paid reservation (the rigid probe's
// capped GPU run, for one) follows the same verified window. Only the clock moves.
const EXTENSION=`sha256:${"7".repeat(64)}`,INTENT_DIGEST=`sha256:${"a".repeat(64)}`;
function extensionRow(original:number,until:number,changes:Record<string,unknown>={}) {
  return {schema_version:"task_evaluation_scene_execution_window_extension_notice.v1",intent_id:"scene-one",
    intent_digest:INTENT_DIGEST,extension_digest:EXTENSION,original_expires_at_epoch:original,expires_at_epoch:until,
    issued_at_epoch:original+60,authorization_reference:"founder approval (time only)",authorized_via:"operator_door",
    ...changes};
}
/** The intake a verified extension is recorded on, and the job's mirror of it, as the signed notice writes them. */
function sceneWindow(grant:any,until=grant.expires_at_epoch+86400) {
  const intake={website_request_id:"one",source_session_id:"walkthrough-one",state:"completed",
    root_sponsorship_digest:grant.authority_digest,sponsorship_digest:grant.authority_digest,
    request:{execution:{expires_at_epoch:grant.expires_at_epoch,max_total_spend_usd:grant.max_total_spend_usd}},
    receipt:{intent_id:"scene-one",intent_digest:INTENT_DIGEST},
    execution_window_extensions:[{...extensionRow(grant.expires_at_epoch,until),received_at_iso:"2026-11-03T16:00:00Z"}]} as any;
  intake.request_digest=crossRuntimeDigest(intake.request);
  state.docs.set("taskEvaluationSceneIntakes/intake-one",intake);
  (state.docs.get("inboundRequests/one") as any).website_scene_sponsorship_execution_window={
    schema_version:"website_scene_sponsorship_execution_window.v1",scope:"execution_time_only",
    authority_digest:grant.authority_digest,intent_id:"scene-one",intake_id:"intake-one",extension_digest:EXTENSION,
    original_expires_at_epoch:grant.expires_at_epoch,expires_at_epoch:until};
  return intake;
}
const vastTerms=(grant:any)=>vi.stubEnv("TASK_EVALUATION_SCENE_PROVIDER_TERMS_JSON",JSON.stringify({
  vast:{digest:grant.consent.provider_terms_reference,label:"Synthetic",url:"https://example.com/terms"}}));
const gpu=(grant:any,key:string,changes:Record<string,unknown>={})=>({task_context_digest:grant.task_context_digest,
  allocation_binding_digest:`sha256:${key.repeat(64)}`,resource_class:"gpu_render" as const,provider:"vast" as const,
  maximum_cost_usd:.5,request_count:1,...changes});
const job=()=>state.docs.get("inboundRequests/one") as any;

it("a native paid reservation follows a verified intent window, on a completed intake, with every cap unchanged",async()=>{
  seed(packet(),false,false);
  const grant=await loadWebsiteSceneSponsorship("one",true,"walkthrough-one",prepOptions());
  vastTerms(grant);sceneWindow(grant);
  const stored=structuredClone(job().website_scene_sponsorship);
  const clock=vi.spyOn(Date,"now").mockReturnValue((grant.expires_at_epoch+3600)*1000);
  try {
    expect(await reserveWebsitePreparationSpend("one",gpu(grant,"d"))).toMatchObject({status:"admitted",
      sponsorship_digest:grant.authority_digest,maximum_cost_usd:.5,expires_at_epoch:grant.expires_at_epoch+86400});
    // The grant (digest, caps, attempts, raw expiry) is untouched, and its upstream cap ($1) and request limit (2) still bind.
    expect(job().website_scene_sponsorship).toEqual(stored);
    await expect(reserveWebsitePreparationSpend("one",gpu(grant,"e",{maximum_cost_usd:.6})))
      .rejects.toThrow("website_scene_preparation_budget_exhausted");
    expect(await reserveWebsitePreparationSpend("one",gpu(grant,"e"))).toMatchObject({status:"admitted"});
    await expect(reserveWebsitePreparationSpend("one",gpu(grant,"f",{maximum_cost_usd:.001})))
      .rejects.toThrow("website_scene_preparation_budget_exhausted");
    // Provider terms and rights are still checked inside the window.
    vi.stubEnv("TASK_EVALUATION_SCENE_PROVIDER_TERMS_JSON",JSON.stringify({vast:{digest:`sha256:${"6".repeat(64)}`,
      label:"Changed",url:"https://example.com/terms"}}));
    await expect(reserveWebsitePreparationSpend("one",gpu(grant,"f",{maximum_cost_usd:.001})))
      .rejects.toThrow("provider_terms_not_configured_or_changed");
    vastTerms(grant);
    job().request.consent_attestation.revoked_at_iso="2026-11-03T17:00:00Z";
    await expect(reserveWebsitePreparationSpend("one",gpu(grant,"f",{maximum_cost_usd:.001}))).rejects.toThrow("source_revoked");
    delete job().request.consent_attestation.revoked_at_iso;
    // At the end of the window it is expired like any other grant.
    clock.mockReturnValue((grant.expires_at_epoch+86400)*1000);
    await expect(reserveWebsitePreparationSpend("one",gpu(grant,"f",{maximum_cost_usd:.001}))).rejects.toThrow("consent_expired");
    expect(Object.keys(job().website_preparation_reservations)).toHaveLength(2);
  } finally {vi.restoreAllMocks();}
});

it.each([
  ["a revoked intent",(intake:any)=>{intake.revocation_requested=true;}],
  ["a revocation in progress",(intake:any)=>{intake.state="revocation_pending";}],
  ["no stored extension",(intake:any)=>{intake.execution_window_extensions=[];}],
  ["another intent's extension",(intake:any)=>{intake.receipt.intent_id="scene-two";}],
  ["an intake bound to another grant",(intake:any)=>{intake.root_sponsorship_digest=`sha256:${"6".repeat(64)}`;}],
  ["a mirror naming another intake",(_intake:any,record:any)=>{record.website_scene_sponsorship_execution_window.intake_id="intake-two";}],
  ["a mirror for another grant",(_intake:any,record:any)=>{
    record.website_scene_sponsorship_execution_window.authority_digest=`sha256:${"6".repeat(64)}`;}],
  ["a mirrored expiry no extension holds",(_intake:any,record:any)=>{record.website_scene_sponsorship_execution_window.expires_at_epoch+=1;}],
  ["another extension digest",(_intake:any,record:any)=>{
    record.website_scene_sponsorship_execution_window.extension_digest=`sha256:${"8".repeat(64)}`;}],
  ["an extension past the sealed expiry + 7 days",(intake:any,record:any,grant:any)=>{
    const until=grant.expires_at_epoch+8*86400;
    intake.execution_window_extensions=[{...extensionRow(grant.expires_at_epoch,until,{issued_at_epoch:grant.expires_at_epoch+2*86400}),
      received_at_iso:"2026-11-03T16:00:00Z"}];
    record.website_scene_sponsorship_execution_window.expires_at_epoch=until;}],
])("a window with %s keeps the reservation at the grant's own expiry and reserves nothing",async(_name,mutate)=>{
  seed(packet(),false,false);
  const grant=await loadWebsiteSceneSponsorship("one",true,"walkthrough-one",prepOptions());
  vastTerms(grant);mutate(sceneWindow(grant),job(),grant);
  vi.spyOn(Date,"now").mockReturnValue((grant.expires_at_epoch+3600)*1000);
  try {
    await expect(reserveWebsitePreparationSpend("one",gpu(grant,"d"))).rejects.toThrow("consent_expired");
    expect(job().website_preparation_reservations).toBeUndefined();
  } finally {vi.restoreAllMocks();}
});

it("an admission's expiry is the grant's own, or its verified window, never past the grant's expiry + 7 days",async()=>{
  seed(packet(),false,false);
  const grant=await loadWebsiteSceneSponsorship("one",true,"walkthrough-one",prepOptions());
  vastTerms(grant);
  expect(await reserveWebsitePreparationSpend("one",gpu(grant,"d",{maximum_cost_usd:.1})))
    .toMatchObject({status:"admitted",expires_at_epoch:grant.expires_at_epoch});
  sceneWindow(grant,grant.expires_at_epoch+7*86400);
  vi.spyOn(Date,"now").mockReturnValue((grant.expires_at_epoch+6.5*86400)*1000);
  try {
    expect(await reserveWebsitePreparationSpend("one",gpu(grant,"e",{maximum_cost_usd:.1})))
      .toMatchObject({status:"admitted",expires_at_epoch:grant.expires_at_epoch+7*86400});
  } finally {vi.restoreAllMocks();}
  expect(sponsorshipValidUntil({expires_at_epoch:100})).toBe(100);
  expect(sponsorshipValidUntil({expires_at_epoch:100},50)).toBe(100);
  expect(sponsorshipValidUntil({expires_at_epoch:100},100+30*86400)).toBe(100+7*86400);
});

// capture-447ae4f4: the parent grant's intent was extended, the grant renewed, and the
// renewal's re-issued intent extended in turn. The mirror binds the grant each intake records.
it("a renewed grant's own intent window is mirrored and funds a reservation; the parent's window does not",async()=>{
  seed(packet(),false,false);
  const first=await loadWebsiteSceneSponsorship("one",true,"walkthrough-one",prepOptions());
  vastTerms(first);
  const intake=(id:string,intent:string,grant:any)=>{
    const value={website_request_id:"one",source_session_id:"walkthrough-one",state:"completed",
      root_sponsorship_digest:grant.authority_digest,sponsorship_digest:grant.authority_digest,
      request:{execution:{expires_at_epoch:grant.expires_at_epoch,max_total_spend_usd:grant.max_total_spend_usd}},
      receipt:{intent_id:intent,intent_digest:INTENT_DIGEST}} as any;
    value.request_digest=crossRuntimeDigest(value.request);
    state.docs.set(`taskEvaluationSceneIntakes/${id}`,value);
  };
  const extend=(intent:string,grant:any,digit:string)=>recordSceneExecutionWindowExtension(
    {...extensionRow(grant.expires_at_epoch,grant.expires_at_epoch+6*86400),intent_id:intent,
      extension_digest:`sha256:${digit.repeat(64)}`} as any);
  intake("intake-parent","scene-parent",first);
  expect(await extend("scene-parent",first,"7")).toMatchObject({status:"recorded",sponsorship_window_mirrored:true});
  const clock=vi.spyOn(Date,"now").mockReturnValue((first.expires_at_epoch+10)*1000);
  try {
    await renewExpiredWebsiteSceneSponsorship("one",{approved_by:"blueprint",approval_reference:"owner chat approval",
      ack:SPONSORSHIP_RENEWAL_ACK,apply:true});
    const renewed=job().website_scene_sponsorship;
    expect(renewed.renewal.parent_authority_digest).toBe(first.authority_digest);
    clock.mockReturnValue((renewed.expires_at_epoch+3600)*1000);
    // The parent's window binds the parent grant only.
    await expect(reserveWebsitePreparationSpend("one",gpu(renewed,"d"))).rejects.toThrow("consent_expired");
    // The renewal's re-issued intake records the renewed grant as its root (prepared-scene route).
    intake("intake-renewal","scene-renewal",renewed);
    expect(await extend("scene-renewal",renewed,"9")).toMatchObject({status:"recorded",
      sponsorship_window_mirrored:true,spend_caps_changed:false});
    expect(job().website_scene_sponsorship_execution_window).toMatchObject({authority_digest:renewed.authority_digest,
      intake_id:"intake-renewal",expires_at_epoch:renewed.expires_at_epoch+6*86400});
    expect(job().website_scene_sponsorship).toEqual(renewed);
    expect(await reserveWebsitePreparationSpend("one",gpu(renewed,"d"))).toMatchObject({status:"admitted",
      sponsorship_digest:renewed.authority_digest,expires_at_epoch:renewed.expires_at_epoch+6*86400});
    // A later extension of the parent intent never re-points the mirror at the parent grant.
    expect(await extend("scene-parent",first,"8")).toMatchObject({status:"recorded",sponsorship_window_mirrored:false});
    expect(job().website_scene_sponsorship_execution_window.intake_id).toBe("intake-renewal");
  } finally {vi.restoreAllMocks();}
});
