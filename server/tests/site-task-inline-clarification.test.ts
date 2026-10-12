// @vitest-environment node
import {beforeEach,describe,expect,it,vi} from "vitest";
import {sharedFakeFirestoreState,sharedFakeFirestore} from "./helpers/fake-firestore";
const source=vi.hoisted(()=>({view:null as any}));
vi.mock("../../client/src/lib/firebaseAdmin",async()=>({dbAdmin:(await import("./helpers/fake-firestore")).sharedFakeFirestore}));
vi.mock("../utils/siteAssessmentPublic",()=>({loadCurrentSiteAssessmentView:vi.fn(async()=>source.view)}));
import {readSiteClarification,submitSiteClarification} from "../utils/siteTaskClarifications";
const packet="a".repeat(64), jobId="advisory-"+"b".repeat(64);
beforeEach(()=>{
 sharedFakeFirestoreState.docs.clear();
 sharedFakeFirestoreState.docs.set("inboundRequests/inline-owner",{request:{buyerType:"site_operator"},siteTaskGates:{},site_task_triage:{disposition:"qualified"},site_advisory:{job_id:jobId,state:"completed",source_key:"source-a",context_digest:"context-a"}});
 sharedFakeFirestoreState.docs.set("siteTaskBriefs/inline-owner",{summary:"Open a rack",operatorAnswers:{}});
 sharedFakeFirestoreState.docs.set("siteAssessmentJobs/"+jobId,{schema_version:"site_assessment_job.v1",request_id:"inline-owner",source_key:"source-a",context_digest:"context-a",state:"completed",packet_sha256:packet});
 source.view={customerAdvisory:{state:"ready",sections:[],unknowns:["Video analysis is not independently verified.","Question to resolve: How much force is required? Decision it changes: Gripper choice"],nextAction:"Measure force",correlationId:"fixture"},decisionAssessment:{decisionEvidence:{schemaVersion:"site_decision_evidence.v1",packetSha256:packet,qualificationSha256:"c".repeat(64)}},compatibleDecisionAssessments:[]};
});
describe("source-specific inline clarification",()=>{
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
  sharedFakeFirestoreState.docs.set("siteAssessmentJobs/"+jobId,{schema_version:"site_assessment_job.v1",request_id:"inline-owner",source_key:"source-a",context_digest:"context-a",state:"completed",packet_sha256:"d".repeat(64)});
  await expect(submitSiteClarification("inline-owner",before.revision,"The measured pull force is 30 N.")).rejects.toThrow("clarification_revision_changed");
  expect((sharedFakeFirestoreState.docs.get("inboundRequests/inline-owner") as any).site_task_clarification).toBeUndefined();
 });
 it("rejects packet authority replaced between the reader and write transaction",async()=>{
  const view=await readSiteClarification("inline-owner");
  const run=sharedFakeFirestore.runTransaction.bind(sharedFakeFirestore);
  const spy=vi.spyOn(sharedFakeFirestore,"runTransaction").mockImplementation(async callback=>{
   sharedFakeFirestoreState.docs.set("siteAssessmentJobs/"+jobId,{schema_version:"site_assessment_job.v1",request_id:"inline-owner",source_key:"source-a",context_digest:"context-a",state:"completed",packet_sha256:"d".repeat(64)});
   return run(callback);
  });
  try{await expect(submitSiteClarification("inline-owner",view.revision,"The measured pull force is 30 N.")).rejects.toThrow("clarification_revision_changed");}
  finally{spy.mockRestore();}
  expect((sharedFakeFirestoreState.docs.get("inboundRequests/inline-owner") as any).site_task_clarification).toBeUndefined();
 });
 it("never turns a caveat or unavailable assessment into an answer request",async()=>{
  source.view.customerAdvisory.unknowns=["Some job facts remain unresolved."];expect((await readSiteClarification("inline-owner")).needed).toBe(false);
  source.view.customerAdvisory.unknowns=["Question to resolve: How much force is required?"];source.view.customerAdvisory.state="unavailable";
  expect((await readSiteClarification("inline-owner")).questions).toEqual([]);
 });
});
