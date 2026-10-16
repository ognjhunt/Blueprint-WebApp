// @vitest-environment node
import express from "express";
import type { Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({ records: new Map<string, Record<string, any>>(), decrypt: vi.fn() }));
vi.mock("../../client/src/lib/firebaseAdmin", () => ({ dbAdmin: {
  collection: (name: string) => ({
    doc: (id: string) => ({ key: `${name}/${id}`, get: async () => {
      const value=fixture.records.get(`${name}/${id}`);return {exists:Boolean(value),data:()=>value};
    }}),
    where: (field: string, _op: string, expected: unknown) => ({ get: async () => ({docs:
      [...fixture.records.entries()].filter(([key,value])=>key.startsWith(`${name}/`) && field.split(".").reduce((v,k)=>v?.[k],value)===expected)
        .map(([,value])=>({data:()=>value})),
    })}),
  }),
  runTransaction: async (run: (transaction: Record<string, any>) => Promise<unknown>) => run({
    get: async (ref: { get: () => Promise<unknown> }) => ref.get(),
    create: (ref: { key: string }, value: Record<string, any>) => {
      if (fixture.records.has(ref.key)) throw new Error("already exists");fixture.records.set(ref.key, value);
    },
  }),
} }));
vi.mock("../utils/checkpointPolicyCredentials", () => ({
  POLICY_CREDENTIAL_COLLECTION:"checkpointPolicyCredentials",decryptCheckpointPolicyCredential:fixture.decrypt,
}));
vi.mock("../utils/rate-limit-redis",()=>({createRateLimitRedisStore:()=>undefined}));
import router from "../routes/internal-checkpoint-policy-credentials";
import { agentExecutionAdmissionDigest } from "../utils/agentExecutionAdmission";
import { buildPipelineSyncSignature } from "../utils/pipelineSyncSecurity";
import { reservationTtlMs, executionTtlMs, executionHeartbeatTtlMs } from "../utils/agentRunRecord";
import { createHash } from "node:crypto";

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
  fixture.records.set(`checkpointPolicyCredentials/${credentialRef}`,{credential_ref:credentialRef,team_id:"synthetic-team",checkpoint_id:"synthetic-checkpoint",owner_uid:"synthetic-owner",kind:"bearer",reference:"https://policy.example.test",revoked:false,expires_at_iso:new Date(now+86_400_000).toISOString()});
  fixture.records.set("robotCheckpoints/synthetic-checkpoint",{teamId:"synthetic-team",reference:"https://policy.example.test",policyCredential:{ref:credentialRef},status:"active"});
  fixture.records.set("evaluationRuns/synthetic-run",{runId:"synthetic-run",teamId:"synthetic-team",checkpointId:"synthetic-checkpoint",state:"requested",moneyResolved:false,cancellationRequested:false,
    dispatch:{pipelineRunId:"claiming-worker-run",startedAtIso:new Date(now-1000).toISOString(),executionDeadlineAtMs:now+executionTtlMs()},requestedAtIso:new Date(now-1000).toISOString(),settlementDueAtMs:now+reservationTtlMs(),executionAdmission:{envelope:{canonical_execution_request:canonical}}});
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
  it("honors a healthy execution deadline after the queue reservation expired",async()=>{const run=fixture.records.get("evaluationRuns/synthetic-run")!;run.requestedAtIso=new Date(now-reservationTtlMs()-1000).toISOString();run.dispatch.startedAtIso=run.requestedAtIso;run.settlementDueAtMs=now-1;expect((await request()).status).toBe(200);});
  it.each([now,now-1,Number.NaN])("refuses expired or invalid execution deadline %s",async due=>{fixture.records.get("evaluationRuns/synthetic-run")!.dispatch.executionDeadlineAtMs=due;expect((await request()).status).toBe(409);expect(fixture.decrypt).not.toHaveBeenCalled();});
  it("uses a bounded execution deadline for legacy claimed records",async()=>{const run=fixture.records.get("evaluationRuns/synthetic-run")!;delete run.settlementDueAtMs;delete run.dispatch.executionDeadlineAtMs;expect((await request()).status).toBe(200);});
  it("never uses a legacy fallback to revive an expired legacy worker",async()=>{const run=fixture.records.get("evaluationRuns/synthetic-run")!;delete run.settlementDueAtMs;delete run.dispatch.executionDeadlineAtMs;run.dispatch.startedAtIso=new Date(now-executionTtlMs()).toISOString();expect((await request()).status).toBe(409);expect(fixture.decrypt).not.toHaveBeenCalled();});
  it("refuses an unstarted or stale-heartbeat worker before decryption",async()=>{const run=fixture.records.get("evaluationRuns/synthetic-run")!;delete run.dispatch.startedAtIso;expect((await request()).status).toBe(409);run.dispatch.startedAtIso=new Date(now-1000).toISOString();run.dispatch.lastHeartbeatAtIso=new Date(now-executionHeartbeatTtlMs()).toISOString();expect((await request()).status).toBe(409);expect(fixture.decrypt).not.toHaveBeenCalled();});
});
describe("a team evaluation's single-use bearer lease",()=>{
  // The Pipeline's bearer_lease_id: "policy-access-" plus the first 32 hex digits of
  // SHA-256 over the compact, key-sorted JSON of the three claim values.
  const leaseId="policy-access-"+createHash("sha256").update(
    `{"credential_ref":"${credentialRef}","job_id":"synthetic-job-1","pipeline_run_id":"claiming-worker-run"}`).digest("hex").slice(0,32);
  const release=(overrides:Record<string,unknown>={})=>request({action:"bearer_lease_release",lease_id:leaseId,...overrides});
  beforeEach(()=>{fixture.records.get("evaluationRuns/synthetic-run")!.teamEvaluationPurpose="scored";});
  it("releases the token once, bound to the claimed run, and never again",async()=>{
    const first=await release();
    expect(first.status).toBe(200);
    const row=await first.json();
    expect(row.lease).toEqual({lease_id:leaseId,single_use:true,status:"released",release_count:1,
      credential_ref:credentialRef,job_id:"synthetic-job-1",pipeline_run_id:"claiming-worker-run"});
    expect(row.credential).toEqual({job_id:"synthetic-job-1",endpoint_url:"https://policy.example.test",bearer_token:"synthetic-test-only"});
    expect(fixture.records.get(`checkpointPolicyBearerLeases/${leaseId}`)).toMatchObject({status:"released",release_count:1});
    const second=await release();
    expect(second.status).toBe(409);
    const refused = await second.json();
    expect(refused.code).toBe("policy_credential_lease_consumed");
    expect(JSON.stringify(refused)).not.toContain("synthetic-test-only");
  });
  it("leaves the lease unspent when the token cannot be decrypted, so the claim can retry",async()=>{
    fixture.decrypt.mockRejectedValueOnce(new Error("kms unavailable"));
    expect((await release()).status).toBe(409);
    expect(fixture.records.has(`checkpointPolicyBearerLeases/${leaseId}`)).toBe(false);
    expect((await release()).status).toBe(200);
  });
  it("refuses a lease id that is not this claim's without spending or decrypting",async()=>{
    const response=await release({lease_id:"policy-access-"+"0".repeat(32)});
    expect(response.status).toBe(409);
    expect(fixture.records.has(`checkpointPolicyBearerLeases/${leaseId}`)).toBe(false);
    expect(fixture.decrypt).not.toHaveBeenCalled();
  });
  it("does not spend the lease on an expired token",async()=>{
    fixture.records.get(`checkpointPolicyCredentials/${credentialRef}`)!.expires_at_iso=new Date(now).toISOString();
    expect((await release()).status).toBe(409);
    expect(fixture.records.has(`checkpointPolicyBearerLeases/${leaseId}`)).toBe(false);
  });
  it.each(["cancel", "revoke", "retire"])("rechecks live authority after decryption races with %s", async change => {
    fixture.decrypt.mockImplementationOnce(async () => {
      if (change === "cancel") fixture.records.get("evaluationRuns/synthetic-run")!.cancellationRequested = true;
      if (change === "revoke") fixture.records.get(`checkpointPolicyCredentials/${credentialRef}`)!.revoked = true;
      if (change === "retire") fixture.records.get("robotCheckpoints/synthetic-checkpoint")!.status = "retired";
      return { kind: "bearer", token: "synthetic-test-only" };
    });
    const response = await release();
    expect(response.status).toBe(409);
    expect(fixture.records.has(`checkpointPolicyBearerLeases/${leaseId}`)).toBe(false);
    expect(JSON.stringify(await response.json())).not.toContain("synthetic-test-only");
  });
  it("never returns a team evaluation's token through access",async()=>{
    const response=await request();
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe("policy_credential_lease_required");
    expect(fixture.decrypt).not.toHaveBeenCalled();
  });
});
