// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
const mocks=vi.hoisted(()=>({create:vi.fn(),requests:[] as any[],history:vi.fn(),learning:null as any,read:vi.fn()}));
vi.mock("../../client/src/lib/firebaseAdmin",()=>({dbAdmin:{doc:(path:string)=>({get:async()=>{mocks.read(path);return {data:()=>({learning:mocks.learning})};}})}}));
vi.mock("openai",()=>({default:class {
 responses={create:(input:any)=>{mocks.requests.push(structuredClone(input));return mocks.create(input);}};
 chat={completions:{create:(input:any)=>{mocks.requests.push(structuredClone(input));return mocks.create(input);}}};
}}));
vi.mock("../research-learning/company-history",()=>({runCompanyHistoryTool:mocks.history}));
import {getCompanyHistoryAccess,openAiResponsesHistoryTools,runOperatorTool} from "../agents/operator-tools";
beforeEach(()=>{vi.resetModules();vi.stubEnv("OPENAI_API_KEY","offline-fixture");vi.stubEnv("DEEPSEEK_API_KEY","offline-fixture");
 vi.stubEnv("ZAI_API_KEY","offline-fixture");mocks.create.mockReset();mocks.history.mockReset();mocks.requests.length=0;mocks.read.mockReset();mocks.learning={
  version:"blueprint.research-learning-worker.v1",enabled:true,startDate:"2026-10-01",
  binding:{version:"blueprint.research-learning-consumer-binding.v1",principalId:"blueprint-learning-host",role:"daily_research",
    sourceSnapshotId:"a".repeat(64),crmIds:["BP-000001"],prospectIds:[],discoveryCapabilityIds:["summary-capability"],detailCapabilityIds:[],expiresAt:"2099-10-03T00:00:00.000Z"},
  businessScope:{principalId:"blueprint-learning-host",subjectKeys:["blueprint:research-learning"],expiresAt:"2099-10-02T13:00:00.000Z"},
};});
afterEach(()=>vi.unstubAllEnvs());
describe("agent-chosen read-only company history tools",()=>{
 it("reuses the exact retained backend read binding without widening zero-native scope or renewing expiry",async()=>{
  const task:any={kind:"capture_dispatch",metadata:{principalId:"MODEL",companyWide:false,historyEmbedding:{authorized:true}},input:{principalId:"MODEL"}};
  const access=await getCompanyHistoryAccess(task);
  expect(access).toEqual({principalId:"blueprint-learning-host",companyWide:false,expiresAt:"2099-10-02T13:00:00.000Z",sourceSnapshotId:"a".repeat(64),crmIds:["BP-000001"],prospectIds:[],capabilityIds:[],discoveryCapabilityIds:["summary-capability"],businessSubjectKeys:["blueprint:research-learning"]});
  expect(mocks.read).toHaveBeenCalledWith("blueprintDailyResearch/sites-first");
  expect(access).not.toHaveProperty("embeddingAuthority");
  expect(await getCompanyHistoryAccess({kind:"capture_video_privacy"})).toBeNull();
  expect(await getCompanyHistoryAccess({kind:"inbound_qualification"})).toBeNull();
  await expect(runOperatorTool("search_company_history",{query:""})).rejects.toMatchObject({code:"permission_denied"});
  expect(mocks.history).not.toHaveBeenCalled();
 });
 it.each(["missing","expired","wrong-principal"])("denies %s retained binding despite a company task/model grant",async reason=>{
  if(reason==="missing")mocks.learning=null;
  if(reason==="expired")mocks.learning.businessScope.expiresAt="2000-01-01T00:00:00Z";
  if(reason==="wrong-principal")mocks.learning.binding.principalId="MODEL";
  expect(await getCompanyHistoryAccess({kind:"operator_thread",metadata:{companyWide:true,expiresAt:"2099-12-31T00:00:00Z"}} as any)).toBeNull();
 });
 it("uses whole-company access only from an exact retained owner grant with its original shorter expiry",async()=>{
  mocks.learning.history_access={version:"blueprint.company-history-access.v1",principalId:"blueprint-learning-host",scope:"company_business_history",authorityRef:"existing-owner-approved-read",expiresAt:"2099-10-02T12:00:00.000Z"};
  expect(await getCompanyHistoryAccess({kind:"capture_dispatch"})).toEqual({principalId:"blueprint-learning-host",companyWide:true,sourceSnapshotId:"a".repeat(64),expiresAt:"2099-10-02T12:00:00.000Z",businessSubjectKeys:["blueprint:research-learning"]});
  mocks.learning.history_access.principalId="MODEL";expect(await getCompanyHistoryAccess({kind:"capture_dispatch"})).toBeNull();
 });
 it.each(["openai_responses","deepseek_chat","zai_glm"] as const)("lets %s choose a query, paginate then fetch records under mutation quarantine",async provider=>{
  const query={query:"retained operator outcome",filters:{city:"Seattle",industry:"industrial kitchen"},page_size:2};
  const calls=[{name:"search_company_history",args:query,id:"search"},
   {name:"search_company_history",args:{...query,cursor:"company-owned-cursor"},id:"page"},
   {name:"fetch_company_history_record",args:{record_id:"selected-canonical-record"},id:"fetch"}];
  for(const call of calls)mocks.create.mockResolvedValueOnce(provider==="openai_responses"
   ?{id:call.id,output:[{type:"function_call",call_id:call.id,name:call.name,arguments:JSON.stringify(call.args)}],usage:{input_tokens:100,output_tokens:20}}
   :{id:call.id,choices:[{message:{role:"assistant",content:"",tool_calls:[{id:call.id,type:"function",function:{name:call.name,arguments:JSON.stringify(call.args)}}]}}],usage:{prompt_tokens:100,completion_tokens:20}});
  mocks.create.mockResolvedValueOnce(provider==="openai_responses"?{id:"final",output:[],output_text:'{"done":true}',usage:{input_tokens:100,output_tokens:20}}
   :{id:"final",choices:[{message:{role:"assistant",content:'{"done":true}'}}],usage:{prompt_tokens:100,completion_tokens:20}});
  mocks.history.mockResolvedValueOnce({ok:true,rows:[{record_id:"first"}],next_cursor:"company-owned-cursor",coverage:{complete:false},semantic:{status:"not_authorized"}})
   .mockResolvedValueOnce({ok:true,rows:[{record_id:"selected-canonical-record"}],next_cursor:null,coverage:{complete:true},semantic:{status:"not_authorized"}})
   .mockResolvedValueOnce({ok:true,record:{record_id:"selected-canonical-record",canonical_ref:"company-owned/source"}});
  const task:any={kind:"capture_dispatch",provider,runtime:provider,model:provider==="openai_responses"?"gpt-5.6-sol":provider==="zai_glm"?"glm-5":"deepseek-v4-pro",
   input:{},metadata:{mutation_reconciliation_required:true,company_history_grant:{principalId:"MODEL",companyWide:false}},
   session_policy:{lane:"task"},tool_policy:{mode:"mixed"},definition:{build_prompt:()=>"Inspect relevant authorized retained outcomes.",output_schema:z.object({done:z.boolean()})}};
  const result=provider==="openai_responses"?await (await import("../agents/adapters/openai-responses")).runOpenAIResponsesTask(task)
   :await (await import("../agents/adapters/deepseek-chat")).runDeepSeekChatTask(task);
  expect(result.status).toBe("completed");expect(mocks.history.mock.calls.map(([name,args])=>({name,args}))).toEqual(calls.map(({name,args})=>({name,args})));
  for(const [, ,access]of mocks.history.mock.calls){expect(access).toMatchObject({principalId:"blueprint-learning-host",companyWide:false,prospectIds:[],expiresAt:"2099-10-02T13:00:00.000Z"});expect(access).not.toHaveProperty("embeddingAuthority");}
  expect(mocks.requests[0].tools.map((tool:any)=>tool.name??tool.function.name)).toEqual(openAiResponsesHistoryTools.map(tool=>tool.name));
  expect(JSON.stringify(mocks.requests.at(-1))).toContain("selected-canonical-record");
  expect(result.artifacts?.mutation_reconciliation_required).toBe(true);
 });
});
