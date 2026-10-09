// OFFLINE: actual admission/sponsorship functions, existing fake Firestore, no providers or robot-quality evidence.
// @vitest-environment node
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import express from "express";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { sharedFakeFirestore as db, sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
vi.mock("../../client/src/lib/firebaseAdmin", async () => ({ default: {},
  dbAdmin: (await import("./helpers/fake-firestore")).sharedFakeFirestore, storageAdmin: null }));
vi.mock("../logger", () => ({ logger: {info: vi.fn(),warn: vi.fn(),error: vi.fn(),debug: vi.fn()} }));
vi.mock("../agents/private-evidence", () => ({ hydrateAgentEvidence: async (value: unknown) => structuredClone(value) }));
const seams = vi.hoisted(() => ({ marker: true, onBinding: () => {} }));
vi.mock("../utils/websiteBrowserUploadStatus", () => ({ verifiedPendingManifest: async () => JSON.stringify({ duration_seconds: 30 }),
  verifiedPendingMarker: async () => seams.marker }));
vi.mock("../utils/websiteCaptureBinding", () => ({ resolveWebsiteCaptureBinding: async () => undefined,
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
function seed(p = packet()) {
  const pending = {schema_version:"website_browser_pending.v1",request_id:"one",scene_id:"site-one",capture_id:"walkthrough-one",
    state:"published",completed_at_iso:"2026-10-08T00:00:00Z",video:{object_name:"scenes/site-one/captures/walkthrough-one/raw/walkthrough.mp4",generation:"1",size_bytes:7,crc32c:"AAAAAA=="},
    manifest:{object_name:"scenes/site-one/captures/walkthrough-one/raw/manifest.json",generation:"2",size_bytes:500,crc32c:"AAAAAA==",sha256:`sha256:${"b".repeat(64)}`}};
  const record:any = {account_owner_uid:"owner",request:{buyerType:"site_operator",capture_mode:"self_capture",taskDescription:"Move bins",
    consent_attestation:{granted:true,statement_version:RECORDING_CONSENT_VERSION,recorded_at_iso:"2026-10-08T00:00:00Z"}},
    site_task_triage:{disposition:"needs_conversation"},capture_privacy_source_bound_decision:{proceeded:true,eligibility:"unscreened",capture_id:"walkthrough-one",
      producer_source:{kind:"browser_pending",key:browserPendingDecisionKey(pending)}}};
  const brief = {requestId:"one",summary:"Move bins",confirmedAtIso:"2026-10-08T00:00:00Z",operatorUnknown:["workload"]};
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
beforeEach(() => {state.docs.clear();seams.marker=true;seams.onBinding=()=>{};
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
