// OFFLINE: actual admission/sponsorship functions, existing fake Firestore, no providers or robot-quality evidence.
// @vitest-environment node
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import express from "express";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { sharedFakeFirestore as db, sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
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
import { assessmentProposesPreparation, loadAssessmentPreparationProposal, assertAssessmentPreparationCurrent } from "../utils/siteAssessmentPreparation";
import { loadWebsiteSceneSponsorship, reserveWebsitePreparationSpend } from "../utils/websiteSceneSponsorship";
import { advisoryContextDigest, advisoryJobId } from "../utils/siteAssessmentContext";
import { browserPendingDecisionKey } from "../utils/websiteBrowserPending";
import { RECORDING_CONSENT_VERSION } from "../utils/recordingConsent";
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
function seed(p = packet(), confirmed = true, claimed = true, requestExtras: Record<string, unknown> = {}) {
  const pending = {schema_version:"website_browser_pending.v1",request_id:"one",scene_id:"site-one",capture_id:"walkthrough-one",
    state:"published",completed_at_iso:"2026-10-08T00:00:00Z",video:{object_name:"scenes/site-one/captures/walkthrough-one/raw/walkthrough.mp4",generation:"1",size_bytes:7,crc32c:"AAAAAA=="},
    manifest:{object_name:"scenes/site-one/captures/walkthrough-one/raw/manifest.json",generation:"2",size_bytes:500,crc32c:"AAAAAA==",sha256:`sha256:${"b".repeat(64)}`}};
  const record:any = {...(claimed ? {account_owner_uid:"owner"} : {}),request:{buyerType:"site_operator",capture_mode:"self_capture",taskDescription:"Move bins",
    consent_attestation:{granted:true,statement_version:RECORDING_CONSENT_VERSION,recorded_at_iso:"2026-10-08T00:00:00Z"},...requestExtras},
    site_task_triage:{disposition:"needs_conversation"},capture_privacy_source_bound_decision:{proceeded:true,eligibility:"unscreened",capture_id:"walkthrough-one",
      producer_source:{kind:"browser_pending",key:browserPendingDecisionKey(pending)}}};
  const brief = {requestId:"one",summary:"Move bins",confirmedAtIso:confirmed ? "2026-10-08T00:00:00Z" : null,operatorUnknown:["workload"]};
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
it("allows existing scene preparation with owner questions, preserving advisory and physical-execution limits",async()=>{
  const {record}=seed();const prepared=await loadAssessmentPreparationProposal("one","walkthrough-one");
  expect(prepared?.proposal).toMatchObject({questions_pending:true,scope:"scene_preparation_only",robot_suitability_verified:false,physical_trial_authorized:false});
  const grant=await loadWebsiteSceneSponsorship("one",true);
  expect(grant.assessment_preparation_proposal).toEqual(prepared?.proposal);
  expect(state.docs.get("inboundRequests/one")?.site_task_triage).toEqual(record.site_task_triage);
  const original=state.docs.get("inboundRequests/one")?.website_scene_sponsorship as any;
  expect((await loadWebsiteSceneSponsorship("one",true)).expires_at_epoch).toBe(original.expires_at_epoch);
});
it.each(["no_robot","process_change"])("does not start the robot-preparation branch for %s",async(kind)=>{
  const p=packet();p.raw_model_assessment.next_action.kind=kind;seed(p);
  await expect(loadWebsiteSceneSponsorship("one",true)).rejects.toThrow("website_assessment_preparation_pending");
  expect(state.docs.get("inboundRequests/one")?.website_scene_sponsorship).toBeUndefined();
});
it("rejects unsupported factual bindings and leaves ambiguous approaches pending",async()=>{
  const p=packet();p.raw_model_assessment.job[0].evidence[0].selector.observation_index=9;
  expect(await assessmentProposesPreparation(p,30)).toBe(false);
  const ambiguous=packet();ambiguous.raw_model_assessment.approaches[0].disposition="needs_evidence";
  expect(await assessmentProposesPreparation(ambiguous,30)).toBe(false);
});
it.each(["queued","running","needs_review"])("requires durable completion instead of treating %s as a positive assessment",async(status)=>{
  const {job}=seed();(state.docs.get(`siteAssessmentJobs/${job}`) as any).state=status;
  await expect(loadWebsiteSceneSponsorship("one",true)).rejects.toThrow("pending");
});
it("refuses stale source, context, packet and missing marker independently",async()=>{
  for(const change of [()=>{(state.docs.get("captureUploadSessions/walkthrough-one") as any).browser_pending_delivery.video.generation="3";},
    ()=>{(state.docs.get("siteTaskBriefs/one") as any).operatorAnswers={workload:"20"};},
    ()=>{(state.docs.get("agentRuns/assessment-one") as any).artifacts.site_assessment_packet.request_id="other";},()=>{seams.marker=false;}]) {
    state.docs.clear();seed();seams.marker=true;change();
    await expect(loadWebsiteSceneSponsorship("one",true)).rejects.toThrow("pending");
    expect(state.docs.get("inboundRequests/one")?.website_scene_sponsorship).toBeUndefined();
  }
});
it("revalidates the private run inside the grant transaction before any write",async()=>{
  seed();seams.onBinding=()=>{(state.docs.get("agentRuns/assessment-one") as any).status="failed";};
  await expect(loadWebsiteSceneSponsorship("one",true)).rejects.toThrow("pending");
  expect(state.docs.get("inboundRequests/one")?.website_scene_sponsorship).toBeUndefined();
});
it("withdrawal and a new source hold every fresh preparation reservation without resetting past unknown spend",async()=>{
  seed();const grant=await loadWebsiteSceneSponsorship("one",true);
  const record=state.docs.get("inboundRequests/one") as any;
  record.website_preparation_reservations={unknown:{admission:{maximum_cost_usd:1,request_count:1},settlement:null}};
  record.future_processing_allowed=false;
  const prior=structuredClone(record.website_preparation_reservations);
  await expect(reserveWebsitePreparationSpend("one",{task_context_digest:grant.task_context_digest,allocation_binding_digest:`sha256:${"d".repeat(64)}`,
    resource_class:"gpu_render",provider:"vast",maximum_cost_usd:1,request_count:1})).rejects.toThrow("pending");
  expect(record.website_preparation_reservations).toEqual(prior);
});
it("transaction snapshot refuses a concurrent customer answer and retains the existing native producer",async()=>{
  seed();const prepared=await loadAssessmentPreparationProposal("one","walkthrough-one");
  (state.docs.get("siteTaskBriefs/one") as any).operatorAnswers={rate:"20"};
  await expect(db.runTransaction(tx=>assertAssessmentPreparationCurrent(tx as any,prepared,state.docs.get("inboundRequests/one")!,
    {requestId:"one",captureId:"walkthrough-one"}))).rejects.toThrow("pending");
  expect(await loadAssessmentPreparationProposal("native","native-capture")).toBeNull();
});
it("actual signed-route handler returns a typed hold and settles prior receipts after assessment authority ends",async()=>{
  const {job}=seed();
  (state.docs.get(`siteAssessmentJobs/${job}`) as any).state="queued";
  const app=express();app.use(express.json());app.use((await import("../routes/internal-capture-worlds")).default);
  const server=createServer(app);await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
  const base=`http://127.0.0.1:${(server.address() as any).port}/creator-captures/walkthrough-one`;
  const send=(operation:string,body:unknown)=>fetch(`${base}/${operation}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
  try {
    const pending=await send("scene-sponsorship",{request_id:"one",scene_id:"site-one"});
    expect(pending.status).toBe(409);expect(await pending.json()).toEqual({code:"website_assessment_preparation_pending"});
    const record=state.docs.get("inboundRequests/one") as any;record.future_processing_allowed=false;
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
    expect(current.website_scene_sponsorship).toBeUndefined();
    const invalid=await send("preparation-settlement",{request_id:"one",scene_id:"site-one",settlement:{...settlement,allocation_binding_digest:`sha256:${"0".repeat(64)}`}});
    expect(invalid.status).toBe(409);expect(await invalid.json()).toEqual({code:"website_scene_preparation_settlement_invalid"});
  } finally {await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});
it("refreshes the returned proposal for a later positive assessment without renewing or mutating the stored allowance",async()=>{
  const {job}=seed();const first=await loadWebsiteSceneSponsorship("one",true);
  const record=state.docs.get("inboundRequests/one") as any;
  const root=structuredClone(record.website_scene_sponsorship);
  record.website_preparation_reservations={unknown:{admission:{maximum_cost_usd:1},settlement:null}};
  const reservations=structuredClone(record.website_preparation_reservations);
  const run=structuredClone(state.docs.get("agentRuns/assessment-one")) as any;
  const later=packet();later.raw_model_assessment.questions.push({question:"What final state is required?",decision_it_changes:"Scorer target"});
  run.artifacts.site_assessment_packet=later;run.artifacts.site_assessment_packet_sha256=hash(later);
  state.docs.set("agentRuns/assessment-two",run);
  Object.assign(state.docs.get(`siteAssessmentJobs/${job}`)!,{run_id:"assessment-two",packet_sha256:hash(later)});
  const second=await loadWebsiteSceneSponsorship("one",false);
  expect(second.assessment_preparation_proposal.run_id).toBe("assessment-two");
  expect(second.assessment_parent_authority_digest).toBe(first.authority_digest);
  expect(second.expires_at_epoch).toBe(first.expires_at_epoch);
  expect((state.docs.get("inboundRequests/one") as any).website_scene_sponsorship).toEqual(root);
  expect((state.docs.get("inboundRequests/one") as any).website_preparation_reservations).toEqual(reservations);
  const legacy=structuredClone(root);delete legacy.assessment_preparation_proposal;delete legacy.authority_digest;
  const {crossRuntimeDigest}=await import("../utils/crossRuntimeCanonical");legacy.authority_digest=crossRuntimeDigest(legacy);
  (state.docs.get("inboundRequests/one") as any).website_scene_sponsorship=legacy;
  expect((await loadWebsiteSceneSponsorship("one",false)).assessment_preparation_proposal.run_id).toBe("assessment-two");
  expect((state.docs.get("inboundRequests/one") as any).website_scene_sponsorship).toEqual(legacy);
});
it("does not relabel an existing browser grant as legacy after the canonical source session is lost",async()=>{
  for (const remove of [()=>state.docs.delete("captureUploadSessions/walkthrough-one"),
    ()=>{delete (state.docs.get("captureUploadSessions/walkthrough-one") as any).browser_pending_delivery;}]) {
    state.docs.clear();seed();const grant=await loadWebsiteSceneSponsorship("one",true);remove();
    await expect(loadWebsiteSceneSponsorship("one",false)).rejects.toThrow("pending");
    await expect(reserveWebsitePreparationSpend("one",{task_context_digest:grant.task_context_digest,allocation_binding_digest:`sha256:${"d".repeat(64)}`,
      resource_class:"gpu_render",provider:"vast",maximum_cost_usd:1,request_count:1})).rejects.toThrow("pending");
    expect((state.docs.get("inboundRequests/one") as any).website_preparation_reservations).toBeUndefined();
  }
});
it("publication wins over a legacy classification before the final grant transaction",async()=>{
  seed();const session=structuredClone(state.docs.get("captureUploadSessions/walkthrough-one"))!;
  const record=state.docs.get("inboundRequests/one") as any;
  delete record.site_advisory;delete record.capture_privacy_source_bound_decision;
  record.site_task_triage.disposition="qualified";state.docs.delete("captureUploadSessions/walkthrough-one");
  expect(await loadAssessmentPreparationProposal("one","walkthrough-one")).toBeNull();
  seams.onBinding=()=>{state.docs.set("captureUploadSessions/walkthrough-one",session);};
  await expect(loadWebsiteSceneSponsorship("one",true)).rejects.toThrow("pending");
  expect((state.docs.get("inboundRequests/one") as any).website_scene_sponsorship).toBeUndefined();
});

// SYNTHETIC offline preparation contract v2. Actual existing handlers, no production operations.
function prepOptions() {
  const brief=state.docs.get("siteTaskBriefs/one") as any,record=state.docs.get("inboundRequests/one") as any;
  return {purpose:"scene_preparation" as const,expected_task_context_digest:projectWebsiteTaskContext(brief,
    projectWebsiteCaptureRights(record),{purpose:"scene_preparation",inventory:state.docs.get("siteTaskItemInventories/one") ?? undefined} as any).context_digest};
}
import { projectWebsiteTaskContext, projectWebsiteCaptureRights } from "../utils/websiteTaskContext";
import { validateWebsiteSponsoredIntake, currentWebsitePreparationStatusContext } from "../utils/websiteSceneSponsorship";
import { sceneIntakeCommand, sceneDigest, processSceneIntakeQueue } from "../utils/taskEvaluationSceneIntake";
it("v2 explicit current preparation admits unknown task/account without confirming or charging the site",async()=>{
  seed(packet(),false,false);const briefBefore=structuredClone(state.docs.get("siteTaskBriefs/one"));
  const opts=prepOptions();const grant=await (loadWebsiteSceneSponsorship as any)("one",true,"walkthrough-one",opts);
  expect(grant).toMatchObject({purpose:"scene_preparation",task_context_digest:opts.expected_task_context_digest,
    consent:{task_confirmed:false},assessment_preparation_proposal:{questions_pending:true,physical_trial_authorized:false}});
  expect(state.docs.get("siteTaskBriefs/one")).toEqual(briefBefore);
  expect(state.docs.get("inboundRequests/one")).not.toHaveProperty("account_owner_uid");
  const stored=structuredClone(state.docs.get("inboundRequests/one")?.website_scene_sponsorship);
  const later=await loadWebsiteSceneSponsorship("one",false);
  expect(later).toEqual(grant);expect(state.docs.get("inboundRequests/one")?.website_scene_sponsorship).toEqual(stored);
});
it("v2 absent purpose leaves confirmation and account gates strict",async()=>{
  seed(packet(),false,false);await expect(loadWebsiteSceneSponsorship("one",true)).rejects.toThrow("website_task_context_not_confirmed");
  seed(packet(),true,false);await expect(loadWebsiteSceneSponsorship("one",true)).rejects.toThrow("website_scene_site_unclaimed");
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
it("v2 signed task-context data purpose and sponsorship admission are separate",async()=>{
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
    const held=await send("scene-sponsorship",{...body,expected_task_context_digest:prepOptions().expected_task_context_digest});
    expect(held.status).toBe(409);expect(await held.json()).toEqual({code:"website_assessment_preparation_pending"});
    expect(state.docs.get("inboundRequests/one")?.website_scene_sponsorship).toBeUndefined();
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
    const job=(state.docs.get("inboundRequests/one") as any).site_advisory.job_id;
    (state.docs.get(`siteAssessmentJobs/${job}`) as any).state="queued";
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
  seed();const legacy=await loadWebsiteSceneSponsorship("one",true);
  await expect(loadWebsiteSceneSponsorship("one",true,"walkthrough-one",prepOptions())).rejects.toThrow("website_scene_sponsorship_changed");
  expect(state.docs.get("inboundRequests/one")?.website_scene_sponsorship).toEqual(legacy);
});

it("v2 status validates an actual loader-persisted expired base grant and rejects inherited child proposal/advisory drift",async()=>{
  seed(packet(),false,false);const first=await loadWebsiteSceneSponsorship("one",true,"walkthrough-one",prepOptions());
  const record=state.docs.get("inboundRequests/one") as any,brief=state.docs.get("siteTaskBriefs/one") as any;
  const prepared=await loadAssessmentPreparationProposal("one","walkthrough-one");
  const before=structuredClone(record.website_scene_sponsorship);
  const input={requestId:"one",captureId:"walkthrough-one",brief,record,assessmentPreparationProposal:prepared!.proposal};
  vi.spyOn(Date,"now").mockReturnValue((first.expires_at_epoch+1)*1000);
  try {expect(currentWebsitePreparationStatusContext(input).context_digest).toBe(first.task_context_digest);
    await expect(loadWebsiteSceneSponsorship("one",false)).rejects.toThrow("consent_expired");
    const child="supplement-synthetic-child";
    const parent={capture_id:"walkthrough-one",raw_bundle_digest:`sha256:${"a".repeat(64)}`,raw_manifest_uri:"gs://synthetic/scenes/site-one/captures/walkthrough-one/raw/manifest.json",upload_completion_digest:`sha256:${"b".repeat(64)}`,completion_generation:"1",completion_record_generation:"2",manifest_generation:"3"};
    const source={...parent,capture_id:child,raw_manifest_uri:`gs://synthetic/scenes/site-one/captures/${child}/raw/manifest.json`,raw_bundle_digest:`sha256:${"d".repeat(64)}`};
    const captureBinding={schema_version:"website_capture_continuation.v1",original_capture_id:"walkthrough-one",capture_id:child,coordinate_frames_independent:true,
      lineage:[{child:source,parent,supplement:{parent_capture_id:parent.capture_id,parent_bundle_digest:parent.raw_bundle_digest,parent_manifest_uri:parent.raw_manifest_uri}}]};
    const full=projectWebsiteTaskContext(brief,projectWebsiteCaptureRights(record),{purpose:"scene_preparation",captureId:child,captureBinding});
    expect(full.context_digest).not.toBe(first.task_context_digest);
    expect(()=>currentWebsitePreparationStatusContext({...input,captureId:child,captureBinding})).toThrow("website_assessment_preparation_pending");
    // Even a coherently edited pointer/proposal cannot override actual current request facts.
    const proposal={...prepared!.proposal,context_digest:"f".repeat(64)};
    const forged={...record,site_advisory:{...record.site_advisory,context_digest:proposal.context_digest}};
    expect(()=>currentWebsitePreparationStatusContext({...input,record:forged,assessmentPreparationProposal:proposal})).toThrow("website_assessment_preparation_pending");
    expect(record.website_scene_sponsorship).toEqual(before);
  } finally {vi.restoreAllMocks();}
});
