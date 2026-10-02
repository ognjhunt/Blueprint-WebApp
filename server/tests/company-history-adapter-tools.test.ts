// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
const mocks=vi.hoisted(()=>({create:vi.fn(),requests:[] as any[],history:vi.fn()}));
vi.mock("openai",()=>({default:class {
 responses={create:(input:any)=>{mocks.requests.push(structuredClone(input));return mocks.create(input);}};
 chat={completions:{create:(input:any)=>{mocks.requests.push(structuredClone(input));return mocks.create(input);}}};
}}));
vi.mock("../research-learning/company-history",()=>({runCompanyHistoryTool:mocks.history}));
import {getCompanyHistoryAccess,openAiResponsesHistoryTools,runOperatorTool} from "../agents/operator-tools";
beforeEach(()=>{vi.resetModules();vi.stubEnv("OPENAI_API_KEY","offline-fixture");vi.stubEnv("DEEPSEEK_API_KEY","offline-fixture");
 vi.stubEnv("ZAI_API_KEY","offline-fixture");mocks.create.mockReset();mocks.history.mockReset();mocks.requests.length=0;});
afterEach(()=>vi.unstubAllEnvs());
describe("agent-chosen read-only company history tools",()=>{
 it("constructs access from backend task kind and ignores model metadata/input grants",async()=>{
  const task:any={kind:"capture_dispatch",metadata:{principalId:"MODEL",companyWide:false,historyEmbedding:{authorized:true}},input:{principalId:"MODEL"}};
  expect(getCompanyHistoryAccess(task)).toMatchObject({principalId:"blueprint-company-agent-runtime",companyWide:true});
  expect(getCompanyHistoryAccess(task)).not.toHaveProperty("embeddingAuthority");
  expect(getCompanyHistoryAccess({kind:"capture_video_privacy"})).toBeNull();
  expect(getCompanyHistoryAccess({kind:"inbound_qualification"})).toBeNull();
  await expect(runOperatorTool("search_company_history",{query:""})).rejects.toMatchObject({code:"permission_denied"});
  expect(mocks.history).not.toHaveBeenCalled();
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
  for(const [, ,access]of mocks.history.mock.calls){expect(access).toMatchObject({principalId:"blueprint-company-agent-runtime",companyWide:true});expect(access).not.toHaveProperty("embeddingAuthority");}
  expect(mocks.requests[0].tools.map((tool:any)=>tool.name??tool.function.name)).toEqual(openAiResponsesHistoryTools.map(tool=>tool.name));
  expect(JSON.stringify(mocks.requests.at(-1))).toContain("selected-canonical-record");
  expect(result.artifacts?.mutation_reconciliation_required).toBe(true);
 });
});
