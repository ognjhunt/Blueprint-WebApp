// @vitest-environment node
import express from "express";
import type { Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({ records: new Map<string, Record<string, any>>(), decrypt: vi.fn() }));
vi.mock("../../client/src/lib/firebaseAdmin", () => ({ dbAdmin: {
  collection: (name: string) => ({
    doc: (id: string) => ({ get: async () => {
      const value=fixture.records.get(`${name}/${id}`);return {exists:Boolean(value),data:()=>value};
    }}),
    where: (field: string, _op: string, expected: unknown) => ({ get: async () => ({docs:
      [...fixture.records.entries()].filter(([key,value])=>key.startsWith(`${name}/`) && field.split(".").reduce((v,k)=>v?.[k],value)===expected)
        .map(([,value])=>({data:()=>value})),
    })}),
  }),
} }));
vi.mock("../utils/checkpointPolicyCredentials", () => ({
  POLICY_CREDENTIAL_COLLECTION:"checkpointPolicyCredentials",decryptCheckpointPolicyCredential:fixture.decrypt,
}));
vi.mock("../utils/rate-limit-redis",()=>({createRateLimitRedisStore:()=>undefined}));
import router from "../routes/internal-checkpoint-policy-credentials";
import { agentExecutionAdmissionDigest } from "../utils/agentExecutionAdmission";
import { buildPipelineSyncSignature } from "../utils/pipelineSyncSecurity";
import { reservationTtlMs } from "../utils/agentRunRecord";

const now=Date.parse("2026-09-30T07:00:00Z");
const credentialRef="policy-credential-00000000-0000-4000-8000-000000000000";
let server:Server;
let baseUrl:string;
let body:Record<string,unknown>;
beforeEach(async()=>{
  vi.useFakeTimers({toFake:["Date"]});vi.setSystemTime(now);
  vi.stubEnv("PIPELINE_SYNC_TOKEN","offline-synthetic-signer");
  fixture.records.clear();fixture.decrypt.mockReset().mockResolvedValue({kind:"bearer",token:"synthetic-test-only"});
  const canonical={job_id:"synthetic-job-1",customer:{id:"synthetic-team"},robot_profile:{robot_profile_id:"synthetic-checkpoint"},
    execution_authorization:{authorized_by_user_id:"synthetic-owner"},policy_package:{policy_api_endpoint:{endpoint_url:"https://policy.example.test",credential_ref:credentialRef,credential_kind:"bearer"}}};
  fixture.records.set(`checkpointPolicyCredentials/${credentialRef}`,{credential_ref:credentialRef,team_id:"synthetic-team",checkpoint_id:"synthetic-checkpoint",owner_uid:"synthetic-owner",kind:"bearer",reference:"https://policy.example.test"});
  fixture.records.set("robotCheckpoints/synthetic-checkpoint",{teamId:"synthetic-team",reference:"https://policy.example.test",policyCredential:{ref:credentialRef},status:"active"});
  fixture.records.set("evaluationRuns/synthetic-run",{teamId:"synthetic-team",checkpointId:"synthetic-checkpoint",state:"requested",moneyResolved:false,cancellationRequested:false,
    dispatch:{pipelineRunId:"claiming-worker-run"},requestedAtIso:new Date(now-1000).toISOString(),settlementDueAtMs:now+reservationTtlMs(),executionAdmission:{envelope:{canonical_execution_request:canonical}}});
  body={action:"access",job_id:canonical.job_id,canonical_request_digest:agentExecutionAdmissionDigest(canonical),pipeline_run_id:"claiming-worker-run"};
  const app=express();app.use(express.json());app.use(router);
  server=await new Promise<Server>(resolve=>{const value=app.listen(0,"127.0.0.1",()=>resolve(value));});
  const address=server.address();if(!address||typeof address==="string")throw new Error("Missing fixture port");baseUrl=`http://127.0.0.1:${address.port}`;
});
afterEach(async()=>{await new Promise<void>(resolve=>server.close(()=>resolve()));vi.useRealTimers();vi.unstubAllEnvs();});
async function request(overrides:Record<string,unknown>={}){
  const data={...body,...overrides},raw=JSON.stringify(data),timestamp=new Date().toISOString();
  return fetch(`${baseUrl}/checkpoint-policy-credentials/${credentialRef}`,{method:"POST",headers:{"content-type":"application/json","X-Blueprint-Pipeline-Timestamp":timestamp,
    "X-Blueprint-Pipeline-Signature":buildPipelineSyncSignature({secret:"offline-synthetic-signer",timestamp,body:raw})},body:raw});
}
describe("signed checkpoint credential delivery",()=>{
  it.each(["access","registry_lease","bind_admission"])("requires an explicit claiming pipeline run ID before %s decryption",async action=>{expect((await request({action,pipeline_run_id:undefined})).status).toBe(400);expect(fixture.decrypt).not.toHaveBeenCalled();});
  it.each(["access","registry_lease","bind_admission"])("refuses a different worker run before %s even with a valid shared signature",async action=>{expect((await request({action,pipeline_run_id:"different-worker-run"})).status).toBe(409);expect(fixture.decrypt).not.toHaveBeenCalled();});
  it("delivers only to the matching active claimed run",async()=>{const response=await request();expect(response.status).toBe(200);expect((await response.json()).ok).toBe(true);expect(fixture.decrypt).toHaveBeenCalledOnce();});
  it("honors the dispatch-extended settlement deadline after the original deadline",async()=>{const run=fixture.records.get("evaluationRuns/synthetic-run")!;run.requestedAtIso=new Date(now-reservationTtlMs()-1000).toISOString();expect((await request()).status).toBe(200);});
  it.each([now,now-1,Number.NaN])("refuses expired or invalid stored settlement deadline %s",async due=>{fixture.records.get("evaluationRuns/synthetic-run")!.settlementDueAtMs=due;expect((await request()).status).toBe(409);expect(fixture.decrypt).not.toHaveBeenCalled();});
  it("falls back to the original deadline for legacy records without settlementDueAtMs",async()=>{delete fixture.records.get("evaluationRuns/synthetic-run")!.settlementDueAtMs;expect((await request()).status).toBe(200);});
  it("never uses a legacy fallback to revive an expired legacy run",async()=>{const run=fixture.records.get("evaluationRuns/synthetic-run")!;delete run.settlementDueAtMs;run.requestedAtIso=new Date(now-reservationTtlMs()).toISOString();expect((await request()).status).toBe(409);expect(fixture.decrypt).not.toHaveBeenCalled();});
});
