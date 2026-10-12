// @vitest-environment node
import {beforeEach,describe,expect,it,vi} from "vitest";
import {sharedFakeFirestoreState,sharedFakeFirestore} from "./helpers/fake-firestore";
const source=vi.hoisted(()=>({view:null as any}));
vi.mock("../../client/src/lib/firebaseAdmin",async()=>({dbAdmin:(await import("./helpers/fake-firestore")).sharedFakeFirestore}));
vi.mock("../utils/siteAssessmentPublic",()=>({loadCurrentSiteAssessmentView:vi.fn(async()=>source.view)}));
vi.mock("../utils/siteAssessmentQueue",()=>({enqueueNewPublishedSiteAssessment:vi.fn()}));
vi.mock("../utils/taskLifecycleNotifications",()=>({enqueueTaskLifecycleNotification:vi.fn(async()=>{})}));
import {advisoryContextDigest} from "../utils/siteAssessmentContext";
import {browserPendingDecisionKey,type BrowserPending} from "../utils/websiteBrowserPending";
import {readSiteClarification,submitSiteClarification} from "../utils/siteTaskClarifications";
import {recordSiteTaskCallOutcome} from "../utils/siteTaskBrief";
const packet="a".repeat(64), jobId="advisory-"+"b".repeat(64);
let sourceKey:string, contextDigest:string;
const pending:BrowserPending={schema_version:"website_browser_pending.v1",request_id:"inline-owner",scene_id:"site-inline-owner",capture_id:"walkthrough-inline-owner",state:"published",completed_at_iso:"2026-10-12T00:00:00.000Z",video:{object_name:"fixture.mp4",generation:"1",size_bytes:20,crc32c:"AAAAAA=="},manifest:{object_name:"manifest.json",generation:"2",size_bytes:20,crc32c:"AAAAAA==",sha256:"sha256:"+"e".repeat(64)}};
beforeEach(()=>{
 sharedFakeFirestoreState.docs.clear();
 const request={request:{buyerType:"site_operator",taskStatement:"Open a rack",consent_attestation:{granted:true,statement_version:"2026-09-18.v1",recorded_at_iso:"2026-10-11T00:00:00Z"}},siteTaskGates:{},site_task_triage:{disposition:"qualified"}};
 const brief={summary:"Open a rack",operatorAnswers:{}};
 sourceKey=browserPendingDecisionKey(pending);contextDigest=advisoryContextDigest(request,brief);
 sharedFakeFirestoreState.docs.set("inboundRequests/inline-owner",{...request,site_advisory:{job_id:jobId,state:"completed",source_key:sourceKey,context_digest:contextDigest},capture_privacy_source_bound_decision:{proceeded:true,eligibility:"approved",capture_id:"walkthrough-inline-owner",producer_source:{kind:"browser_pending",key:sourceKey}}});
 sharedFakeFirestoreState.docs.set("siteTaskBriefs/inline-owner",brief);
 sharedFakeFirestoreState.docs.set("captureUploadSessions/walkthrough-inline-owner",{browser_pending_delivery:structuredClone(pending)});
 sharedFakeFirestoreState.docs.set("siteAssessmentJobs/"+jobId,{schema_version:"site_assessment_job.v1",request_id:"inline-owner",source_key:sourceKey,context_digest:contextDigest,state:"completed",packet_sha256:packet});
 source.view={customerAdvisory:{state:"ready",sections:[],unknowns:["Video analysis is not independently verified.","Question to resolve: How much force is required? Decision it changes: Gripper choice"],nextAction:"Measure force",correlationId:"fixture"},decisionAssessment:{decisionEvidence:{schemaVersion:"site_decision_evidence.v1",packetSha256:packet,qualificationSha256:"c".repeat(64)}},compatibleDecisionAssessments:[]};
});
describe("source-specific inline clarification",()=>{
 it("reviews an assessment-mode answer under the same mode and packet guard",async()=>{
  const context=sharedFakeFirestoreState.docs.get("inboundRequests/inline-owner") as any;
  context.site_task_brief_confirmed_at="2026-10-12T00:00:00Z";
  context.site_advisory.context_digest=advisoryContextDigest(context,sharedFakeFirestoreState.docs.get("siteTaskBriefs/inline-owner"));
  (sharedFakeFirestoreState.docs.get("siteAssessmentJobs/"+jobId) as any).context_digest=context.site_advisory.context_digest;
  const view=await readSiteClarification("inline-owner","assessment");
  const saved=await submitSiteClarification("inline-owner",view.revision,"30 N","assessment");
  await recordSiteTaskCallOutcome({requestId:"inline-owner",clarificationId:saved.id,note:"Measurement reviewed",resolvedBy:"fixture-reviewer"});
  expect((sharedFakeFirestoreState.docs.get("inboundRequests/inline-owner") as any).site_task_clarification).toMatchObject({mode:"assessment",state:"reviewed"});
 });
 it("binds analysis-only questions and mode without triage checklist fallback",async()=>{
  (sharedFakeFirestoreState.docs.get("inboundRequests/inline-owner") as any).site_task_triage={disposition:"needs_conversation",open_questions:["Generic conversation topic"],unanswered_field_ids:["layout_change"]};
  const context=sharedFakeFirestoreState.docs.get("inboundRequests/inline-owner") as any;
  context.site_advisory.context_digest=advisoryContextDigest(context,sharedFakeFirestoreState.docs.get("siteTaskBriefs/inline-owner"));
  (sharedFakeFirestoreState.docs.get("siteAssessmentJobs/"+jobId) as any).context_digest=context.site_advisory.context_digest;
  const view=await readSiteClarification("inline-owner","assessment"),legacy=await readSiteClarification("inline-owner");
  expect(view.questions).toEqual(["How much force is required? Decision it changes: Gripper choice"]);
  expect(legacy.questions).toContain("Generic conversation topic");expect(view.revision).not.toBe(legacy.revision);
  await expect(submitSiteClarification("inline-owner",view.revision,"30 N")).rejects.toThrow("clarification_revision_changed");
  const saved=await submitSiteClarification("inline-owner",view.revision,"30 N","assessment");
  expect(saved.state).toBe("review_required");expect(context.site_task_clarification).toBeUndefined();
  expect((sharedFakeFirestoreState.docs.get("inboundRequests/inline-owner") as any).site_task_clarification).toMatchObject({mode:"assessment",questions:view.questions});
  expect((await readSiteClarification("inline-owner")).revision).toBe(legacy.revision);
 });
 it("never asks triage checklist questions when current video analysis has none",async()=>{
  (sharedFakeFirestoreState.docs.get("inboundRequests/inline-owner") as any).site_task_triage={disposition:"needs_conversation",open_questions:["Generic topic"]};
  source.view.customerAdvisory.unknowns=["Acceptance and workload are unknown"];
  expect(await readSiteClarification("inline-owner","assessment")).toMatchObject({questions:[],needed:false});
 });
 it("exposes actual customer questions without caveats or private basis",async()=>{
  const view=await readSiteClarification("inline-owner");
  expect(view).toMatchObject({needed:true,questions:["How much force is required? Decision it changes: Gripper choice"]});
  expect(JSON.stringify(view)).not.toMatch(/packetSha256|qualificationSha256|advisoryBasis|Video analysis/);
 });
 it("retains an owner answer for review without clearing any gate or creating another intake",async()=>{
  const original=structuredClone(sharedFakeFirestoreState.docs.get("inboundRequests/inline-owner"));
  const view=await readSiteClarification("inline-owner");const saved=await submitSiteClarification("inline-owner",view.revision,"The measured pull force is 30 N.");
  expect(saved.state).toBe("review_required");
  const row=sharedFakeFirestoreState.docs.get("inboundRequests/inline-owner") as any;
  expect(row.site_task_clarification).toMatchObject({revision:view.revision,explanation:"The measured pull force is 30 N.",submitted_by:"owner_link",questions:view.questions});
  expect(sharedFakeFirestoreState.docs.get(`inboundRequests/inline-owner/clarifications/${saved.id}`)).toMatchObject({assessment_basis:{requestId:"inline-owner",evidence:{packetSha256:packet}}});
  expect(JSON.stringify(await readSiteClarification("inline-owner"))).not.toContain("packetSha256");
  expect(row.siteTaskGates).toEqual((original as any).siteTaskGates);expect(row.site_task_triage).toEqual((original as any).site_task_triage);
  expect(await submitSiteClarification("inline-owner",view.revision,"The measured pull force is 30 N.")).toEqual(saved);
 });
 it("rejects a stale packet even when its public question text stays the same",async()=>{
  const before=await readSiteClarification("inline-owner");source.view.decisionAssessment.decisionEvidence.packetSha256="d".repeat(64);
  sharedFakeFirestoreState.docs.set("siteAssessmentJobs/"+jobId,{schema_version:"site_assessment_job.v1",request_id:"inline-owner",source_key:sourceKey,context_digest:contextDigest,state:"completed",packet_sha256:"d".repeat(64)});
  await expect(submitSiteClarification("inline-owner",before.revision,"The measured pull force is 30 N.")).rejects.toThrow("clarification_revision_changed");
  expect((sharedFakeFirestoreState.docs.get("inboundRequests/inline-owner") as any).site_task_clarification).toBeUndefined();
 });
 it("rejects packet authority replaced between the reader and write transaction",async()=>{
  const view=await readSiteClarification("inline-owner");
  const run=sharedFakeFirestore.runTransaction.bind(sharedFakeFirestore);
  const spy=vi.spyOn(sharedFakeFirestore,"runTransaction").mockImplementation(async callback=>{
   sharedFakeFirestoreState.docs.set("siteAssessmentJobs/"+jobId,{schema_version:"site_assessment_job.v1",request_id:"inline-owner",source_key:sourceKey,context_digest:contextDigest,state:"completed",packet_sha256:"d".repeat(64)});
   return run(callback);
  });
  try{await expect(submitSiteClarification("inline-owner",view.revision,"The measured pull force is 30 N.")).rejects.toThrow("clarification_revision_changed");}
  finally{spy.mockRestore();}
  expect((sharedFakeFirestoreState.docs.get("inboundRequests/inline-owner") as any).site_task_clarification).toBeUndefined();
 });
 it.each(["task", "reservation", "recording", "privacy"])("rejects a %s change between source read and write",async change=>{
  const view=await readSiteClarification("inline-owner");
  const run=sharedFakeFirestore.runTransaction.bind(sharedFakeFirestore);
  const spy=vi.spyOn(sharedFakeFirestore,"runTransaction").mockImplementation(async callback=>{
   if(change==="task") (sharedFakeFirestoreState.docs.get("inboundRequests/inline-owner") as any).request.taskStatement="Operate a different station";
   if(change==="privacy") (sharedFakeFirestoreState.docs.get("inboundRequests/inline-owner") as any).capture_privacy_source_bound_decision.proceeded=false;
   if(change==="reservation") (sharedFakeFirestoreState.docs.get("captureUploadSessions/walkthrough-inline-owner") as any).browser_upload_reservation={id:"replacement"};
   if(change==="recording") (sharedFakeFirestoreState.docs.get("captureUploadSessions/walkthrough-inline-owner") as any).browser_pending_delivery.video.generation="9";
   return run(callback);
  });
  try{await expect(submitSiteClarification("inline-owner",view.revision,"30 N")).rejects.toThrow("clarification_revision_changed");}
  finally{spy.mockRestore();}
  expect((sharedFakeFirestoreState.docs.get("inboundRequests/inline-owner") as any).site_task_clarification).toBeUndefined();
 });
 it("accepts a concise measurement but rejects an empty answer",async()=>{
  const view=await readSiteClarification("inline-owner");
  await expect(submitSiteClarification("inline-owner",view.revision," ")).rejects.toThrow("clarification_invalid");
  expect((await submitSiteClarification("inline-owner",view.revision,"30 N")).state).toBe("review_required");
 });
 it("never turns a caveat or unavailable assessment into an answer request",async()=>{
  source.view.customerAdvisory.unknowns=["Some job facts remain unresolved."];expect((await readSiteClarification("inline-owner")).needed).toBe(false);
  source.view.customerAdvisory.unknowns=["Question to resolve: How much force is required?"];source.view.customerAdvisory.state="unavailable";
  expect((await readSiteClarification("inline-owner")).questions).toEqual([]);
 });
});
