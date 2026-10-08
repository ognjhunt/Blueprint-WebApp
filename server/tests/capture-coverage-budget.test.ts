// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState } from "./helpers/fake-firestore";
vi.mock("../../client/src/lib/firebaseAdmin", async () => ({ dbAdmin: (await import("./helpers/fake-firestore")).sharedFakeFirestore, storageAdmin: null }));
import { SiteAssessmentBudget, normalizeSiteAssessmentUsage } from "../agents/adapters/site-assessment-budget";
import { reserveCaptureCoverageInference } from "../utils/captureCoverageInferenceBudget";
import { browserPendingDecisionKey, type BrowserPending } from "../utils/websiteBrowserPending";
import { inferenceProgrammeContextDigest } from "../utils/inferenceProgrammeAdmission";
import { humanDecisionDigest } from "../utils/human-reply-admission";
import { RECORDING_CONSENT_VERSION } from "../utils/recordingConsent";
import { SITE_ASSESSMENT_MODEL } from "../agents/provider-config";

const publishedPending:BrowserPending={schema_version:"website_browser_pending.v1",request_id:"one",scene_id:"site-one",capture_id:"walkthrough-one",state:"published",completed_at_iso:"2026-10-08T00:00:00Z",
 video:{object_name:"scenes/site-one/captures/walkthrough-one/raw/walkthrough.mov",generation:"1",size_bytes:7,crc32c:"AAAAAA=="},manifest:{object_name:"scenes/site-one/captures/walkthrough-one/raw/manifest.json",generation:"2",size_bytes:100,crc32c:"AAAAAA==",sha256:`sha256:${"a".repeat(64)}`}};
const source = { kind: "browser_pending", key: browserPendingDecisionKey(publishedPending) }, brief = { summary: "Move racks" };
const metadata = { capture_id: "walkthrough-one", review_id: "a".repeat(64), coverage_claim_token: "owned-claim" };
const path = `captureCoverageReviews/${metadata.review_id}`;
const usage = { promptTokenCount: 100, candidatesTokenCount: 10, thoughtsTokenCount: 0 };
function seed() {
  sharedFakeFirestoreState.docs.set("captureUploadSessions/walkthrough-one",{browser_pending_delivery:structuredClone(publishedPending)});
  sharedFakeFirestoreState.docs.set(path, { state: "running", attempts: 1, claim_token: "owned-claim", captureId: metadata.capture_id,
    requestId: "one", binding: { source: structuredClone(source), brief_digest: humanDecisionDigest(brief) } });
  sharedFakeFirestoreState.docs.set("siteTaskBriefs/one", structuredClone(brief));
  sharedFakeFirestoreState.docs.set("inboundRequests/one", { request: { consent_attestation: { granted: true,
    statement_version: RECORDING_CONSENT_VERSION, recorded_at_iso: "2026-10-01T00:00:00Z" } },
    capture_privacy_source_bound_decision: { proceeded: true, capture_id: metadata.capture_id, producer_source: structuredClone(source) } });
}
beforeEach(() => { vi.restoreAllMocks(); sharedFakeFirestoreState.docs.clear(); vi.stubEnv("BLUEPRINT_OPENAI_AGENT_MAX_INFERENCE_COST_USD", "5"); seed(); });
describe("durable customer inference accounting without spending gates",()=>{
 const budgetPath=`captureCoverageReviews/budget-${humanDecisionDigest({capture_id:metadata.capture_id})}`;
 const read=(path:string):any=>sharedFakeFirestoreState.docs.get(path);
 const assessmentMetadata={capture_id:metadata.capture_id,assessment_run_id:"assessment-one",assessment_request_id:"one",assessment_source:source,assessment_video_sha256:"a".repeat(64)};
 function seedAssessment(){sharedFakeFirestoreState.docs.set("agentRuns/assessment-one",{task_kind:"site_assessment",status:"running",input:{input:{context:{request_id:"one"}}}});}
 it("allows distinct coverage and SDK calls beyond the old cap and without programme approval",async()=>{
  vi.stubEnv("BLUEPRINT_OPENAI_AGENT_MAX_INFERENCE_COST_USD","0.001");
  read("inboundRequests/one").inference_program_id="expired-or-unavailable";
  const programme={status:"revoked",expires_at_ms:0,cap_micro_usd:1,slots:[{state:"unknown"}]};sharedFakeFirestoreState.docs.set("inferencePrograms/expired-or-unavailable",programme);
  seedAssessment();
  for(let n=0;n<4;n++){const call=await reserveCaptureCoverageInference("gemini-3.8-flash",n%2?metadata:assessmentMetadata);await call.assertDispatchAllowed();await call.record(usage);}
  expect(read(budgetPath).calls).toBe(4);expect(read(budgetPath).exposure_usd).toBeCloseTo(4*1.818624);expect(read(budgetPath).pending_token).toBeNull();
  expect(read("inferencePrograms/expired-or-unavailable")).toEqual(programme);
 });
 it("retains unknown response costs while permitting a different authorized call",async()=>{
  const first=await reserveCaptureCoverageInference("gemini-3.8-flash",metadata);await first.record(undefined);
  const next=await reserveCaptureCoverageInference("gemini-3.8-flash",metadata);await next.record(usage);
  const calls=[...sharedFakeFirestoreState.docs.entries()].filter(([key])=>key.startsWith(budgetPath+"/calls/"));
  expect(calls).toHaveLength(2);expect(calls[0][1]).toMatchObject({state:"unknown",cost_estimate_usd:null,reserved_usd:1.818624});expect(read(budgetPath).exposure_usd).toBeCloseTo(3.637248);
 });
 it("does not replay a concurrently unresolved action or let an old receipt clear a new action",async()=>{
  const first=await reserveCaptureCoverageInference("gemini-3.8-flash",metadata);
  await expect(reserveCaptureCoverageInference("gemini-3.8-flash",metadata)).rejects.toThrow("call_in_flight");
  await first.record(usage);const next=await reserveCaptureCoverageInference("gemini-3.8-flash",metadata);const token=read(budgetPath).pending_token;
  await expect(first.assertDispatchAllowed()).rejects.toThrow();await expect(first.record(usage)).rejects.toThrow();expect(read(budgetPath).pending_token).toBe(token);await next.record(usage);
 });
 it("does not discard historical unknown records or require zero-spend proof",async()=>{
  read(path).attempts=3;sharedFakeFirestoreState.docs.set("agentRuns/unknown-old",{task_kind:"site_assessment",status:"failed",metadata:{capture_id:metadata.capture_id},artifacts:{usage:null}});
  const old=structuredClone(read("agentRuns/unknown-old"));const call=await reserveCaptureCoverageInference("gemini-3.8-flash",metadata);await call.record(usage);
  expect(read("agentRuns/unknown-old")).toEqual(old);expect(read(path).attempts).toBe(3);
 });
 it.each(["withdrawal","claim","source","brief"])("rechecks %s before dispatch without refunding intent",async fault=>{
  const call=await reserveCaptureCoverageInference("gemini-3.8-flash",metadata),before=structuredClone(read(budgetPath));
  if(fault==="withdrawal")read("inboundRequests/one").consent_revoked=true;
  if(fault==="claim")read(path).claim_token="different";
  if(fault==="source")read("inboundRequests/one").capture_privacy_source_bound_decision.producer_source.key="different";
  if(fault==="brief")read("siteTaskBriefs/one").summary="different";
  await expect(call.assertDispatchAllowed()).rejects.toThrow();expect(read(budgetPath)).toEqual(before);
  // Honest already-received usage can still settle after access ends.
  await call.record(usage);expect(read(budgetPath).pending_token).toBeNull();
 });
 it("rechecks browser session replacement and task context at final SDK dispatch",async()=>{
  seedAssessment();const call=await reserveCaptureCoverageInference(SITE_ASSESSMENT_MODEL,assessmentMetadata,"openai",{});
  read("captureUploadSessions/walkthrough-one").browser_stored_upload={newer:true};await expect(call.assertDispatchAllowed()).rejects.toThrow("source_changed");
 });
 it("increases gross exposure for above-estimate known usage exactly once",async()=>{
  const call=await reserveCaptureCoverageInference("gemini-3.8-flash",metadata);
  const raw={promptTokenCount:2000000,candidatesTokenCount:2000000,thoughtsTokenCount:0,totalTokenCount:4000000};
  await call.record(raw);expect(read(budgetPath).exposure_usd).toBeCloseTo(9);
  const persisted=[...sharedFakeFirestoreState.docs.entries()].find(([key])=>key.startsWith(budgetPath+"/calls/"))![1];
  expect(persisted).toMatchObject({state:"recorded",reserved_usd:1.818624,cost_estimate_usd:9,above_estimate:true,priced_output_tokens:2000000,raw_usage:raw});
  await expect(call.record(raw)).rejects.toThrow();expect(read(budgetPath).exposure_usd).toBeCloseTo(9);
  const next=await reserveCaptureCoverageInference("gemini-3.8-flash",metadata);expect(next.receipt.capture_exposure_usd).toBeCloseTo(9+1.818624);
 });
 it("keeps known usage, response bodies and missing usage separate in cost telemetry",()=>{
  const budget=new SiteAssessmentBudget(99999,0.0001);budget.authorize("openai",SITE_ASSESSMENT_MODEL,{});budget.record("openai",SITE_ASSESSMENT_MODEL,{usage:null});
  budget.authorize("gemini","gemini-3.8-flash");budget.record("gemini","gemini-3.8-flash",{usage});
  const artifacts=budget.artifacts();expect(artifacts.inference_reservation.hard_cost_cap_usd).toBeNull();expect(artifacts.inference_reservation.spending_gated).toBe(false);
  expect(artifacts.usage.cost_usd).toBeNull();expect(artifacts.inference_reservation.unknown_usage_reserved_cost_usd).toBeGreaterThan(0);
 });
});
describe("provider usage normalization retains unexplained exposure",()=>{
 it.each([
  [{promptTokenCount:114,candidatesTokenCount:10,totalTokenCount:12400},12286,"unattributed_total_upper_bound"],
  [{promptTokenCount:114,candidatesTokenCount:10,thoughtsTokenCount:0,totalTokenCount:12400},12286,"unattributed_total_upper_bound"],
  [{promptTokenCount:114,candidatesTokenCount:10},null,"unknown"],
  [{promptTokenCount:114,candidatesTokenCount:10,thoughtsTokenCount:0,totalTokenCount:123},null,"unknown"],
  [{promptTokenCount:114,candidatesTokenCount:10,thoughtsTokenCount:0,totalTokenCount:"124"},null,"unknown"],
  [{promptTokenCount:114,candidatesTokenCount:10,thoughtsTokenCount:0,totalTokenCount:124},10,"reported_complete"],
  [{promptTokenCount:114,candidatesTokenCount:10,thoughtsTokenCount:7,totalTokenCount:131},17,"reported_complete"],
  [{promptTokenCount:114,candidatesTokenCount:10,thoughtsTokenCount:-1,totalTokenCount:124},null,"unknown"],
 ])("normalizes actual counter shape %j conservatively",(raw,output,status)=>{
  const budget=new SiteAssessmentBudget();budget.authorize("gemini","gemini-3.8-flash");budget.record("gemini","gemini-3.8-flash",{usage:raw});
  expect(budget.calls[0].usage).toBe(raw);expect(budget.calls[0].output_tokens).toBe(output);expect(budget.calls[0].usage_pricing_status).toBe(status);
  expect(budget.calls[0].cost_usd===null).toBe(output===null);expect(normalizeSiteAssessmentUsage("gemini",raw).status).toBe(status);
  const artifacts=budget.artifacts();expect(artifacts.usage_samples[0].priced_output_tokens).toBe(output);
  expect(artifacts.usage_samples[0].usage_pricing_status).toBe(status);
  expect(artifacts.usage.completion_tokens).toBe(status==="unattributed_total_upper_bound"?null:output);
  expect(artifacts.provider_responses[0].output_tokens).toBe(status==="unattributed_total_upper_bound"?null:output);
 });
 it("keeps unattributed above-estimate output separate from observed completion",()=>{
  const raw={promptTokenCount:114,candidatesTokenCount:10,totalTokenCount:100000};
  const budget=new SiteAssessmentBudget();budget.authorize("gemini","gemini-3.8-flash");budget.record("gemini","gemini-3.8-flash",{usage:raw});
  const artifacts=budget.artifacts();expect(artifacts.usage.completion_tokens).toBeNull();
  expect(artifacts.usage_samples[0]).toMatchObject({output_tokens:null,priced_output_tokens:99886,usage_pricing_status:"unattributed_total_upper_bound",above_estimate:true,raw_usage:raw});
  expect(artifacts.provider_responses[0]).toMatchObject({output_tokens:null,priced_output_tokens:99886,above_estimate:true});
  expect(artifacts.cost_status).toBe("usage_upper_bound_pricing_estimate");expect(()=>budget.authorize("gemini","gemini-3.8-flash")).not.toThrow();
 });
 it("ignores retired optional pricing bounds rather than denying an authorized call",()=>{
  const budget=new SiteAssessmentBudget();expect(()=>budget.authorize("gemini","gemini-3.8-flash",{inference_bound:{input_tokens:-1,payload_sha256:"invalid"}})).not.toThrow();
  expect(budget.calls[0].reserved_usd).toBe(1.818624);
 });
 it("reports usage above a prior estimate without imposing a monetary stop",()=>{
  const budget=new SiteAssessmentBudget();budget.authorize("gemini","gemini-3.8-flash");
  budget.record("gemini","gemini-3.8-flash",{usage:{promptTokenCount:1048577,candidatesTokenCount:32769,thoughtsTokenCount:0}});
  expect(budget.calls[0].cost_usd).toBeGreaterThan(0);expect(budget.calls[0].usage_pricing_status).toBe("reported_complete");expect(budget.calls[0].above_estimate).toBe(true);
  expect(()=>budget.authorize("gemini","gemini-3.8-flash")).not.toThrow();
 });
});
