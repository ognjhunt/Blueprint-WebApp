// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
vi.mock("../../client/src/lib/firebaseAdmin", async () => ({dbAdmin:(await import("./helpers/fake-firestore")).sharedFakeFirestore,storageAdmin:null}));
vi.mock("../config/env", () => ({isSiteVideoEvidenceEnabled:()=>true}));
vi.mock("../logger", () => ({logger:{warn:vi.fn(),info:vi.fn(),error:vi.fn()}}));
import { retrySiteAssessment, describeSiteAssessmentRetry } from "../utils/siteAssessmentQueue";
import { browserPendingDecisionKey, type BrowserPending } from "../utils/websiteBrowserPending";
import { advisoryContextDigest, advisoryJobId } from "../utils/siteAssessmentContext";
import { inferenceProgrammeContextDigest } from "../utils/inferenceProgrammeAdmission";
import { humanDecisionDigest } from "../utils/human-reply-admission";
import { RECORDING_CONSENT_VERSION } from "../utils/recordingConsent";
import { reserveCaptureCoverageInference, grantInferenceProgrammeTechnicalContinuation } from "../utils/captureCoverageInferenceBudget";
const requestId="retry-fixture",captureId=`walkthrough-${requestId}`,oldRun="site-assessment-old",programmePath="inferencePrograms/retry-programme";
const budgetPath=`captureCoverageReviews/budget-${humanDecisionDigest({capture_id:captureId})}`;
const read=(path:string):any=>state.docs.get(path);
let jobId:string,sourceKey:string,context:string,oldCall:Awaited<ReturnType<typeof reserveCaptureCoverageInference>>;
const pending:BrowserPending={schema_version:"website_browser_pending.v1",request_id:requestId,scene_id:`site-${requestId}`,capture_id:captureId,
 state:"published",completed_at_iso:"2026-10-08T00:00:00Z",video:{object_name:`scenes/site-${requestId}/captures/${captureId}/raw/walkthrough.mov`,generation:"1",size_bytes:7,crc32c:"AAAAAA=="},
 manifest:{object_name:`scenes/site-${requestId}/captures/${captureId}/raw/manifest.json`,generation:"2",size_bytes:100,crc32c:"AAAAAA==",sha256:`sha256:${"b".repeat(64)}`}};
const metadata=(runId:string)=>({capture_id:captureId,assessment_run_id:runId,assessment_request_id:requestId,assessment_video_sha256:"a".repeat(64),assessment_source:{kind:"browser_pending",key:sourceKey}});
const access=(raw:any)=>{if(raw.account_owner_uid!=="synthetic-owner")throw Error("private denial");};
const retry=()=>retrySiteAssessment({requestId,expectedJobId:jobId,expectedRunId:oldRun,retryIdentity:"owner-retry-one",assertAccess:access});
beforeEach(async()=>{
 state.docs.clear();vi.stubEnv("BLUEPRINT_OPENAI_AGENT_MAX_INFERENCE_COST_USD","5");sourceKey=browserPendingDecisionKey(pending);
 const raw:any={account_owner_uid:"synthetic-owner",inference_program_id:"retry-programme",request:{buyerType:"site_operator",taskDescription:"Move a carton",
  consent_attestation:{granted:true,statement_version:RECORDING_CONSENT_VERSION,recorded_at_iso:"2026-10-08T00:00:00Z"}},
  capture_privacy_source_bound_decision:{proceeded:true,eligibility:"unscreened",capture_id:captureId,producer_source:{kind:"browser_pending",key:sourceKey}}};
 context=advisoryContextDigest(raw,null);jobId=advisoryJobId(requestId,sourceKey,context);
 raw.site_advisory={job_id:jobId,source_key:sourceKey,context_digest:context,state:"running"};
 state.docs.set(`inboundRequests/${requestId}`,raw);state.docs.set(`captureUploadSessions/${captureId}`,{browser_pending_delivery:structuredClone(pending)});
 state.docs.set(`siteAssessmentJobs/${jobId}`,{schema_version:"site_assessment_job.v1",request_id:requestId,capture_id:captureId,scene_id:`site-${requestId}`,
  source_key:sourceKey,context_digest:context,state:"running",run_id:oldRun,claim_id:"old-claim",packet_sha256:null,correlation_id:"bp-advisory-synthetic"});
 state.docs.set(`agentRuns/${oldRun}`,{task_kind:"site_assessment",status:"running",metadata:{capture_id:captureId,advisory_job_id:jobId},
  input:{input:{context:{request_id:requestId,advisory_job_id:jobId,advisory_claim_id:"old-claim"}}},artifacts:{source_admission:{request_id:requestId,capture_id:captureId,
   advisory_job_id:jobId,source_key:sourceKey,context_digest:context,video_sha256:"a".repeat(64)}}});
 const reviewId="d".repeat(64),history={requestId,sceneId:`site-${requestId}`,captureId,state:"waiting_prerequisite",attempts:3,started_at:123,claim_token:"historical-claim",
  binding:{source:{kind:"browser_pending",key:sourceKey},brief_digest:humanDecisionDigest(null),capture_id:captureId},reason:null,finding:null};
 state.docs.set(`captureCoverageReviews/${reviewId}`,history);
 state.docs.set(programmePath,{schema_version:"inference_program.v1",status:"active",authority_ref:"synthetic-authority",ledger_sha256:`sha256:${"f".repeat(64)}`,
 request_id:requestId,capture_id:captureId,context_digest:inferenceProgrammeContextDigest(raw,null),video_sha256:"a".repeat(64),expires_at_ms:Date.now()+60000,cap_micro_usd:5000000,
 capture_history_reconciliation:{schema_version:"capture_history_reconciliation.v1",status:"accepted",receipt_sha256:`sha256:${"e".repeat(64)}`,source_commit:"f".repeat(40),reviewed_by:"synthetic-reviewer",
  authority_ref:"synthetic-receipt",request_id:requestId,capture_id:captureId,history_digest:humanDecisionDigest([{review_id:reviewId,...history}]),reviews:[{review_id:reviewId,attempts:3,disposition:"verified_zero_provider"}]},
 slots:[{id:"original-gem",provider:"gemini",model:"gemini-3.8-flash",reserved_micro_usd:1818624,state:"unknown"},
 {id:"original-sol",provider:"openai",model:"gpt-6.1-sol",reserved_micro_usd:331920,state:"recorded"},
 ...[1,2,3].map(n=>({id:`held-sol-${n}`,provider:"openai",model:"gpt-6.1-sol",reserved_micro_usd:331920,state:"held"})),
 {id:"new-gem",provider:"gemini",model:"gemini-3.8-flash",reserved_micro_usd:1818624,state:"held"}]});
 oldCall=await reserveCaptureCoverageInference("gpt-6.1-sol",metadata(oldRun),"openai",{});await oldCall.assertDispatchAllowed();
 read(`agentRuns/${oldRun}`).artifacts.capture_inference_reservations=[oldCall.receipt];
 read(`agentRuns/${oldRun}`).status="failed";read(`siteAssessmentJobs/${jobId}`).state="needs_review";raw.site_advisory.state="needs_review";
});
it("explicit retry preserves unknown full exposure and immutable old run, then permits only remaining held slots",async()=>{
 vi.spyOn(Date,"now").mockReturnValue(read(programmePath).expires_at_ms+1);
 try {
 await expect(retry()).rejects.toThrow("advisory_retry_unavailable");
 await grantInferenceProgrammeTechnicalContinuation({programmeId:"retry-programme",expectedAuthorityDigest:read(budgetPath).inference_programme_authority_digest,
  continuationIdentity:"explicit-technical-window",authorityRef:"synthetic-authority",operatorRef:"synthetic-authorized-operator",effectiveExpiresAtMs:Date.now()+7200000});
 const old=structuredClone(read(`agentRuns/${oldRun}`)),before=structuredClone(read(budgetPath)),original=structuredClone(read(programmePath).slots.slice(0,2));
 expect(await describeSiteAssessmentRetry(requestId,access)).toEqual({available:true,job_id:jobId,run_id:oldRun});
 expect(read(budgetPath)).toEqual(before);
 read(`siteAssessmentJobs/${jobId}`).retry_history=[{receipt_sha256:"mismatched-history"}];
 expect((await describeSiteAssessmentRetry(requestId,access)).available).toBe(false);
 delete read(`siteAssessmentJobs/${jobId}`).retry_history;
 const accepted=await retry();expect(accepted.state).toBe("queued");expect(accepted.job_id).toBe(jobId);expect(accepted.run_id).not.toBe(oldRun);
 expect(read(`agentRuns/${oldRun}`)).toEqual(old);expect(read(`agentRuns/${accepted.run_id}`)).toBeUndefined();
 expect(read(budgetPath)).toMatchObject({pending_token:null,exposure_usd:0.33192,calls:1});
 expect(read(programmePath).slots.slice(0,2)).toEqual(original);
 expect(read(programmePath).slots.find((row:any)=>row.id==="held-sol-1")).toMatchObject({state:"unknown",run_id:oldRun,reserved_micro_usd:331920,admission_token:before.pending_token});
 expect(read(budgetPath).assessment_recoveries).toHaveLength(1);expect(read(`siteAssessmentJobs/${jobId}`).retry_history).toEqual(read(budgetPath).assessment_recoveries);
 expect(await retry()).toEqual(accepted);expect(read(budgetPath).assessment_recoveries).toHaveLength(1);
 const job=read(`siteAssessmentJobs/${jobId}`);job.state="running";job.claim_id="new-claim";
 state.docs.set(`agentRuns/${accepted.run_id}`,{task_kind:"site_assessment",status:"running",metadata:{capture_id:captureId,advisory_job_id:jobId},input:{input:{context:{request_id:requestId}}}});
 const next=await reserveCaptureCoverageInference("gpt-6.1-sol",metadata(accepted.run_id),"openai",{});await next.assertDispatchAllowed();
 const pending=read(budgetPath).pending_token;
 await expect(oldCall.assertDispatchAllowed()).rejects.toThrow();
 await expect(oldCall.record({input_tokens:100,output_tokens:10})).rejects.toThrow("coverage_budget_admission_changed");
 expect(read(budgetPath).pending_token).toBe(pending);
 expect(next.receipt.capture_exposure_usd).toBeCloseTo(0.66384);expect(read(budgetPath).calls).toBe(2);
 expect(read(programmePath).slots.filter((row:any)=>row.run_id===oldRun&&row.state==="unknown")).toHaveLength(1);
 }finally{vi.restoreAllMocks();}
});
it.each(["access","withdrawal","source","context","expiry","cap","slot","running","unknown-run","history","missing-intent","duplicate-token"])("refuses %s without changing any accounting",async defect=>{
 if(defect==="access")read(`inboundRequests/${requestId}`).account_owner_uid="different-owner";
 if(defect==="withdrawal")read(`inboundRequests/${requestId}`).consent_revoked=true;
 if(defect==="source")read(`captureUploadSessions/${captureId}`).browser_pending_delivery.video.generation="3";
 if(defect==="context")read(`inboundRequests/${requestId}`).request.taskDescription="Changed";
 if(defect==="expiry")read(programmePath).expires_at_ms=Date.now()-1;
 if(defect==="cap")read(programmePath).cap_micro_usd=4900000;
 if(defect==="slot")read(programmePath).slots.find((row:any)=>row.id==="held-sol-2").state="unknown";
 if(defect==="running")read(`agentRuns/${oldRun}`).status="running";
 if(defect==="unknown-run")state.docs.set("agentRuns/unbound",{task_kind:"site_assessment",status:"failed",metadata:{capture_id:captureId},input:{input:{context:{request_id:requestId}}}});
 if(defect==="missing-intent")delete read(`agentRuns/${oldRun}`).artifacts.capture_inference_reservations;
 if(defect==="duplicate-token")read(programmePath).slots.find((row:any)=>row.id==="new-gem").admission_token=read(budgetPath).pending_token;
 if(defect==="history")read(`captureCoverageReviews/${"d".repeat(64)}`).attempts=4;
 const before=structuredClone(read(budgetPath)),programme=structuredClone(read(programmePath));
 expect((await describeSiteAssessmentRetry(requestId,access)).available).toBe(false);
 await expect(retry()).rejects.toThrow();expect(read(budgetPath)).toEqual(before);expect(read(programmePath)).toEqual(programme);
});
it("rejects stale expected run and rotated owner even when the retry identity was accepted",async()=>{
 const result=await retry();await expect(retrySiteAssessment({requestId,expectedJobId:jobId,expectedRunId:"different",retryIdentity:"owner-retry-one",assertAccess:access})).rejects.toThrow("advisory_retry_conflict");
 read(`inboundRequests/${requestId}`).account_owner_uid="different-owner";
 await expect(retry()).rejects.toThrow("advisory_retry_not_authorized");expect(read(`siteAssessmentJobs/${jobId}`).run_id).toBe(result.run_id);
});

it.each(["receipt","old-source","slot-reset","brief-rotation"])("refuses %s after explicit recovery, including identity replay",async defect=>{
 const accepted=await retry(),job=read(`siteAssessmentJobs/${jobId}`);
 if(defect==="receipt")read(budgetPath).assessment_recoveries[0].receipt_sha256="f".repeat(64);
 if(defect==="old-source")read(`agentRuns/${oldRun}`).artifacts.source_admission.video_sha256="c".repeat(64);
 if(defect==="slot-reset")read(programmePath).slots.find((row:any)=>row.id==="held-sol-1").state="held";
 if(defect==="brief-rotation")state.docs.set(`siteTaskBriefs/${requestId}`,{operatorTaskDetails:null,successCriteria:null,operatorAnswers:null,unrelated:"changed full programme context"});
 await expect(retry()).rejects.toThrow("advisory_retry_unavailable");
 if(defect!=="brief-rotation"){
  job.state="running";job.claim_id="new-claim";
  state.docs.set(`agentRuns/${accepted.run_id}`,{task_kind:"site_assessment",status:"running",metadata:{capture_id:captureId,advisory_job_id:jobId},input:{input:{context:{request_id:requestId}}}});
  await expect(reserveCaptureCoverageInference("gpt-6.1-sol",metadata(accepted.run_id),"openai",{})).rejects.toThrow();
 }
 expect(read(budgetPath).calls).toBe(1);expect(read(budgetPath).exposure_usd).toBe(0.33192);
});
