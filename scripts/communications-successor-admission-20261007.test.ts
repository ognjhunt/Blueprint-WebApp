import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {sha} from './communications-incident-20261006.mjs';
import {mcpReceipt,mcpReadScope} from './communications-incident-mcp-20261006.mjs';
import {checkFence as historicalFence} from './communications-incident-recovery-20261006.mjs';
import {verifyWebSourceProof as historicalSource} from './communications-incident-web-source-20261007.mjs';
import {WORKER,WEB,PARENT,SCHEMA,WRITERS,APPROVAL,TARGET_DIGEST,AUDIT_DIGEST,LAP_DIGEST,BASELINE_DIGEST,ENTRY_SHA256,checkFence,checkWorker,authorityScope} from './communications-successor-admission-20261007.mjs';
import {WEB_SOURCE_POLICY_DIGEST,WEB_SOURCE_RECIPE,verifyWebSourceProof} from './communications-successor-web-source-20261007.mjs';
import {preparePlatform,assembleProof} from './communications-successor-operator-20261007.mjs';

const NOW=1791358500000,WORKSPACE='tea-synthetic';
const source=JSON.parse(gunzipSync(readFileSync('scripts/communications-successor-web-source-20261007.fixture.json.gz')).toString());
const baseline=JSON.parse(readFileSync('scripts/communications-successor-baseline-20261007.fixture.json','utf8'));
const get=(url:string,body:any,status=200)=>({method:'GET',url,body,status,observedAtMs:NOW-10});
function call(tool:string,args:any,body:any){return [{tool,arguments:{workspaceId:WORKSPACE,...args},requestedAtUtc:new Date(NOW-11).toISOString(),respondedAtUtc:new Date(NOW-10).toISOString(),result:{content:[{type:'text',text:JSON.stringify(body)}]}}];}
export function fixture(){
  const workerDeploy={id:'dep-worker',status:'live',commit:{id:source.commit}},webDeploy={id:'dep-web',status:'live',commit:{id:source.commit}};
  const workerService={id:WORKER,type:'background_worker',suspended:'not_suspended',serviceDetails:{envSpecificDetails:{startCommand:'npm run start:worker'}}};
  const webService={id:WEB,type:'web_service',suspended:'not_suspended',ownerId:WORKSPACE,repo:WEB_SOURCE_RECIPE.repo,branch:WEB_SOURCE_RECIPE.branch,
    serviceDetails:{env:'node',runtime:'node',envSpecificDetails:{buildCommand:WEB_SOURCE_RECIPE.buildCommand,startCommand:WEB_SOURCE_RECIPE.startCommand}}};
  const off='Ops automation scheduler not started in web process; it runs in the blueprint-webapp-worker service';
  const logs={hasMore:false,logs:[{timestamp:new Date(NOW-20).toISOString(),labels:[{name:'resource',value:WEB},{name:'instance',value:'web-synthetic'}],
    message:JSON.stringify({service:'blueprint-webapp',route:'ops-automation-scheduler',msg:`${off} (set BLUEPRINT_RUN_OPS_AUTOMATION_IN_WEB=1 to opt this process in)`})}]};
  const original={schema:'blueprint.render-mcp-reads.v1',parentThread:PARENT,incident:'lap259-20261006',webSourceProof:structuredClone(source),receipts:{
    workerService:call('mcp__codex_apps__render_get_service',{serviceId:WORKER},workerService),workerDeploy:call('mcp__codex_apps__render_get_deploy',{serviceId:WORKER,deployId:workerDeploy.id},workerDeploy),
    webService:call('mcp__codex_apps__render_get_service',{serviceId:WEB},webService),webDeploy:call('mcp__codex_apps__render_get_deploy',{serviceId:WEB,deployId:webDeploy.id},webDeploy),
    webLogs:call('mcp__codex_apps__render_list_logs',{resource:[WEB]},logs)}};
  const receipts=[mcpReceipt(original.receipts.workerService,`https://api.render.com/v1/services/${WORKER}`),mcpReceipt(original.receipts.workerDeploy,`https://api.render.com/v1/services/${WORKER}/deploys/dep-worker`),
    mcpReceipt(original.receipts.webService,`https://api.render.com/v1/services/${WEB}`),mcpReceipt(original.receipts.webDeploy,`https://api.render.com/v1/services/${WEB}/deploys/dep-web`),mcpReceipt(original.receipts.webLogs,`https://api.render.com/v1/logs?ownerId=${WORKSPACE}&resource=${WEB}`)];
  const owner:any={schema:'blueprint.successor-oct6-cleanup-authority.v1',parentThread:PARENT,incident:'lap259-20261006',action:'archive_verify_delete_stopped_oct6',actor:'synthetic-founder',approvalReference:APPROVAL.response,approvalTranscript:APPROVAL,
    stoppedTargetDigest:TARGET_DIGEST,expectedReleaseCommit:source.commit,expectedWebCommit:source.commit,expectedWorkerEntrySha256:ENTRY_SHA256,expectedWebSourcePolicyDigest:WEB_SOURCE_POLICY_DIGEST,expectedWebSourceProofDigest:sha(source),
    expectedHistoricalAuditDigest:AUDIT_DIGEST,expectedLapSha256:LAP_DIGEST,expectedBaselineRuntimeDigests:{[WORKER]:BASELINE_DIGEST},expectedWorkerServiceIds:[WORKER],expectedSourceFailures:[],
    expectedWorkerInstanceAliases:{[WORKER]:[{restInstanceId:`${WORKER}-ab123`,nativeInstanceId:`${WORKER}-aaaaaaaaaa-ab123`}]},frozenWriters:WRITERS,writerFreezeEvidence:{syntheticOnly:true},expectedMcpReadScope:Object.fromEntries(receipts.map(r=>[r.url,mcpReadScope(r)]))};
  const ci={schema:'blueprint.render-incident-ci-receipts.v1',parentThread:PARENT,incident:'lap259-20261006',readOnly:true,receipts:[
    {name:'worker-instances',...get(`https://api.render.com/v1/services/${WORKER}/instances`,[{id:`${WORKER}-ab123`,createdAt:new Date(NOW-100).toISOString()}])},
    {name:'web-instances',...get(`https://api.render.com/v1/services/${WEB}/instances`,[{id:'web-synthetic',createdAt:new Date(NOW-100).toISOString()}])},
    ...['BLUEPRINT_DAILY_RESEARCH_WORKER_ENABLED','BLUEPRINT_COMMUNICATIONS_WORKER_ENABLED'].map((key,i)=>({name:i?'communications-enabled':'daily-enabled',...get(`https://api.render.com/v1/services/${WORKER}/env-vars/${key}`,{key,value:'false'})})),
    {name:'web-ops-enabled',...get(`https://api.render.com/v1/services/${WEB}/env-vars/BLUEPRINT_RUN_OPS_AUTOMATION_IN_WEB`,null,404)}]};
  const runtime={schema:'blueprint.disabled-worker-runtime.v1',observedAtMs:NOW-1,pid:7,parentPid:1,state:'S',startTicks:'100',bootId:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',cwd:'/opt/render/project/src',executable:'/opt/node/bin/node',entry:'/opt/render/project/src/dist/worker.js',entrySha256:ENTRY_SHA256,commandSha256:'b'.repeat(64),serviceId:WORKER,instanceId:`${WORKER}-aaaaaaaaaa-ab123`,sourceCommit:source.commit,rootInventoryComplete:true,runtimeRootCount:1,opsForwardOnly:'true',nodeOptions:null,
    bootstrapProtection:{mode:'disabled',inputs:{NODE_ENV:'production',VITEST:null,BLUEPRINT_DISABLE_LOCAL_ENV_BOOTSTRAP:'true',PAPERCLIP_ENV_FILE:null},paths:[]},filesystem:{target:{mountNamespace:'mnt:[77]',rootDevice:'1',rootInode:'2'},collector:{mountNamespace:'mnt:[77]',rootDevice:'1',rootInode:'2'}},flags:{BLUEPRINT_DAILY_RESEARCH_WORKER_ENABLED:'false',BLUEPRINT_COMMUNICATIONS_WORKER_ENABLED:'false'}};
  const platform=preparePlatform(original,ci,baseline,owner),{proof,authority}=assembleProof(platform,runtime,()=>NOW);
  return {proof,authority,platform,runtime,original,ci,owner};
}
describe('versioned successor admission over actual eadd source',()=>{
  it('accepts complete raw Git/MCP and current instance proof while historical admission remains closed',()=>{
    const f=fixture();expect(()=>checkFence(f.proof,f.authority,NOW)).not.toThrow();expect(()=>verifyWebSourceProof(source)).not.toThrow();
    expect(()=>historicalFence(f.proof,f.authority,NOW)).toThrow();expect(()=>historicalSource(source)).toThrow();
    expect(f.proof.schema).toBe(SCHEMA);expect(sha(baseline)).toBe(BASELINE_DIGEST);
  });
  const mutations:[string,(f:any)=>void][]=[
    ['unapproved commit',f=>f.authority.expectedReleaseCommit='a'.repeat(40)],['wrong policy',f=>f.authority.expectedWebSourcePolicyDigest='a'.repeat(64)],
    ['altered source tree',f=>f.proof.web.sourceProof.trees[0].base64=Buffer.from('forged').toString('base64')],['missing source tree',f=>f.proof.web.sourceProof.trees.pop()],
    ['wrong approval',f=>f.authority.approvalReference='unapproved'],['changed target',f=>f.authority.stoppedTargetDigest='a'.repeat(64)],['changed audit',f=>f.authority.expectedHistoricalAuditDigest='a'.repeat(64)],
    ['changed lap',f=>f.authority.expectedLapSha256='a'.repeat(64)],['changed baseline',f=>f.proof.services[0].baselineRuntime.observedAtMs++],
    ['missing coverage',f=>f.proof.services[0].runtimes=[]],['extra current instance',f=>f.proof.services[0].instances.body.push({id:`${WORKER}-cd456`,createdAt:new Date(NOW-100).toISOString()})],
    ['unpinned aliases',f=>delete f.authority.expectedWorkerInstanceAliases],['generic suffix alias',f=>f.authority.expectedWorkerInstanceAliases[WORKER][0].nativeInstanceId=`${WORKER}-unapproved-ab123`],
    ['null alias identifiers',f=>{f.authority.expectedWorkerInstanceAliases[WORKER][0]={restInstanceId:null,nativeInstanceId:null};f.proof.services[0].instances.body[0].id=null;f.proof.services[0].runtimes[0].instanceId=null;}],
    ['future instance creation',f=>f.proof.services[0].instances.body[0].createdAt=new Date(NOW+10000).toISOString()],
    ['old instance',f=>f.proof.services[0].instances.body[0].id=baseline.instanceId],['stale persisted flags',f=>f.proof.services[0].admissionFlags.BLUEPRINT_COMMUNICATIONS_WORKER_ENABLED.observedAtMs=NOW-300001],
    ['stale native process',f=>f.proof.services[0].runtimes[0].observedAtMs=NOW-300001],['process precedes receipts',f=>f.proof.services[0].runtimes[0].observedAtMs=NOW-12],
    ['wrong bundle',f=>f.proof.services[0].runtimes[0].entrySha256='a'.repeat(64)],['wrong runtime commit',f=>f.proof.services[0].runtimes[0].sourceCommit='a'.repeat(40)],
    ['live runtime flag',f=>f.proof.services[0].runtimes[0].flags.BLUEPRINT_DAILY_RESEARCH_WORKER_ENABLED='true'],['preloaded startup code',f=>f.proof.services[0].runtimes[0].nodeOptions='--import=/tmp/unknown.js'],
    ['bootstrap override allowed',f=>f.proof.services[0].runtimes[0].bootstrapProtection.inputs.BLUEPRINT_DISABLE_LOCAL_ENV_BOOTSTRAP=null],['filesystem changed',f=>f.proof.services[0].runtimes[0].filesystem.target.rootInode='3'],
    ['missing Web log coverage',f=>f.proof.web.startupLogs.mcp.calls[0].result.content[0].text=JSON.stringify({hasMore:false,logs:[]})],['partial logs',f=>f.proof.web.startupLogs.body.hasMore=true],
    ['missing writer hold',f=>f.authority.frozenWriters=f.authority.frozenWriters.slice(1)],['foreign MCP scope',f=>f.authority.expectedMcpReadScope[Object.keys(f.authority.expectedMcpReadScope)[0]].workspaceId='tea-other'],
  ];
  it.each(mutations)('refuses %s even when per-proof digest is refreshed',(name,change)=>{
    const f=structuredClone(fixture());change(f);f.authority.processProofDigest=sha(f.proof);if(name.includes('source tree'))f.authority.expectedWebSourceProofDigest=sha(f.proof.web.sourceProof);
    expect(()=>checkFence(f.proof,f.authority,NOW)).toThrow();
  });
  it('keeps the complete immutable authority scope and permits only explicit fresh-proof byte pins to rotate',()=>{
    const f=fixture(),fresh={...f.authority,expectedMcpReceiptDigests:{fresh:'a'.repeat(64)},processProofDigest:'a'.repeat(64),processProofFileSha256:'b'.repeat(64),canonicalFileSha256:'c'.repeat(64),providerFileSha256:'d'.repeat(64)};
    expect(sha(authorityScope(fresh))).toBe(sha(authorityScope(f.authority)));
    for(const [key,value] of [['expectedReleaseCommit','a'.repeat(40)],['stoppedTargetDigest','a'.repeat(64)],['cleanupReadbackFileSha256','a'.repeat(64)]])expect(sha(authorityScope({...fresh,[key as string]:value}))).not.toBe(sha(authorityScope(f.authority)));
  });
  it('preserves worker freshness independently of source verifier and rejects native proof before complete platform',()=>{
    const f=fixture();expect(()=>checkWorker(f.proof.services[0],f.authority,NOW)).not.toThrow();
    expect(()=>assembleProof(f.platform,{...f.runtime,observedAtMs:NOW-20},()=>NOW)).toThrow('runtime_after_complete_platform_required');
  });
  it('keeps all nine historical helper bytes exactly pinned',()=>{
    const code=readFileSync('scripts/communications-release-native-proof-20261007.mjs','utf8');
    const pins=[...code.matchAll(/'([^']+\.(?:mjs|py))':'([a-f0-9]{64})'/g)];expect(pins).toHaveLength(9);
    for(const [,name,digest] of pins)expect(sha(readFileSync(`scripts/${name}`))).toBe(digest);
  });
});
