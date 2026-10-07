/** Prepare complete successor proof and cleanup export. Inspect modes are read-only.
 * Cleanup submission is a separate explicit command; no activation or recovery.
 */
import { readFileSync, mkdirSync, writeFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { sha, refuse, privateWrite, existingAdmin } from './communications-incident-20261006.mjs';
import { mcpReceipt, mcpReadScope } from './communications-incident-mcp-20261006.mjs';
import { archiveFiles, verifyArchive } from './communications-incident-recovery-20261006.mjs';
import { WORKER, WEB, PARENT, SCHEMA, checkDirection, checkFence, inspectRuntime } from './communications-successor-admission-20261007.mjs';
import { checkWebSourceProof, collectWebSourceProof, verifyWebSourceProof } from './communications-successor-web-source-20261007.mjs';
export const PLATFORM = 'blueprint.render-successor-platform.v1';
const GS_PREFIX = 'gs://blueprint-8c1ca.appspot.com/operations/communications/incident-20261006/';
const BASE = 'https://api.render.com/v1/services/';
function cleanSource(target) {
  if (realpathSync(new URL('.',import.meta.url).pathname) !== realpathSync(resolve('scripts'))
    || execFileSync('git',['rev-parse','HEAD']).toString().trim() !== target
    || execFileSync('git',['status','--porcelain','--untracked-files=no']).toString().trim()) refuse('successor_execution_source_changed');
}
export function preparePlatform(mcp, ci, baseline, owner) {
  checkDirection(owner);
  if (mcp?.schema !== 'blueprint.render-mcp-reads.v1' || mcp.parentThread !== PARENT || mcp.incident !== owner.incident
    || ci?.schema !== 'blueprint.render-incident-ci-receipts.v1' || ci.parentThread !== PARENT || ci.incident !== owner.incident
    || ci.readOnly !== true || !Array.isArray(ci.receipts) || ci.receipts.length !== 5) refuse('platform_source_packet_unbound');
  const one = name => { const rows=ci.receipts.filter(r=>r.name===name); if(rows.length!==1)refuse('platform_receipt_inventory_incomplete');return rows[0]; };
  const reads=mcp.receipts;
  const workerService=mcpReceipt(reads.workerService,BASE+WORKER),webService=mcpReceipt(reads.webService,BASE+WEB);
  const deploy=(calls,id)=>{const arg=calls?.[0]?.arguments;if(!arg?.deployId)refuse('actual_deploy_id_required');return mcpReceipt(calls,`${BASE}${id}/deploys/${arg.deployId}`);};
  const workerDeploy=deploy(reads.workerDeploy,WORKER),webDeploy=deploy(reads.webDeploy,WEB);
  const logs=mcpReceipt(reads.webLogs,`https://api.render.com/v1/logs?ownerId=${encodeURIComponent(webService.body.ownerId)}&resource=${WEB}`);
  const receipts=[workerService,workerDeploy,webService,webDeploy,logs];
  const scope=Object.fromEntries(receipts.map(r=>[r.url,mcpReadScope(r)]));
  if(sha(scope)!==sha(owner.expectedMcpReadScope))refuse('successor_mcp_scope_changed');
  const authorityTemplate={...owner,expectedMcpReceiptDigests:Object.fromEntries(receipts.map(r=>[r.url,sha(r.mcp)]))};
  if(owner.expectedBaselineRuntimeDigests?.[WORKER]!==sha(baseline))refuse('original_baseline_authority_changed');
  const worker={serviceId:WORKER,service:workerService,deploy:workerDeploy.body,deployCommit:workerDeploy.body?.commit?.id,deployReceipt:workerDeploy,
    instances:one('worker-instances'),baselineRuntime:baseline,admissionFlags:{BLUEPRINT_DAILY_RESEARCH_WORKER_ENABLED:one('daily-enabled'),BLUEPRINT_COMMUNICATIONS_WORKER_ENABLED:one('communications-enabled')}};
  const web={service:webService,deploy:webDeploy.body,deployReceipt:webDeploy,instances:one('web-instances'),opsFlag:one('web-ops-enabled'),startupLogs:logs,sourceProof:mcp.webSourceProof};
  checkWebSourceProof(web.sourceProof,owner);
  if(worker.deployCommit!==owner.expectedReleaseCommit||web.deploy?.commit?.id!==owner.expectedReleaseCommit)refuse('successor_deploy_source_changed');
  const observations=[...receipts,worker.instances,...Object.values(worker.admissionFlags),web.instances,web.opsFlag];
  if(observations.some(r=>!Number.isSafeInteger(r.observedAtMs)))refuse('actual_platform_times_required');
  return {schema:PLATFORM,parentThread:PARENT,incident:owner.incident,readOnly:true,observedAtMs:Math.max(...observations.map(r=>r.observedAtMs)),worker,web,authorityTemplate,originalMcp:mcp,originalCi:ci,originalBaseline:baseline};
}
export function assembleProof(platform,runtime,now=Date.now) {
  if(platform?.schema!==PLATFORM||platform.parentThread!==PARENT||platform.readOnly!==true)refuse('successor_platform_packet_unbound');
  checkDirection(platform.authorityTemplate);
  if(platform.worker?.instances?.body?.length!==1||runtime.observedAtMs<platform.observedAtMs)refuse('runtime_after_complete_platform_required');
  const proof={schema:SCHEMA,lane:'complete_successor_disabled_admission',parentThread:PARENT,incident:platform.incident,observedAtMs:now(),
    frozenWriters:platform.authorityTemplate.frozenWriters,writerFreezeEvidence:platform.authorityTemplate.writerFreezeEvidence,services:[{...platform.worker,runtimes:[runtime]}],web:platform.web};
  const authority={...platform.authorityTemplate,processProofDigest:sha(proof)};checkFence(proof,authority,now());return {proof,authority};
}
export async function verifyAdoption(target) {
  cleanSource(target);
  verifyWebSourceProof(collectWebSourceProof(process.cwd(),target));
  const before=inspectRuntime(target);
  const {CommunicationsAgentsAPI}=await import('../server/agents/communications-api.ts');
  const {COMMUNICATIONS_HISTORY_DEFINITION,communicationsMcpDefinition,communicationsHypothesisDefinition}=await import('../server/agents/communications-saved-agent.ts');
  const {COMMUNICATIONS_FRAMING_VERSION,COMMUNICATIONS_FOUNDER_FRAMING_DIGEST}=await import('../server/agents/communications-launch-framing.ts');
  if(COMMUNICATIONS_FRAMING_VERSION!=='blueprint.outreach-framing.v3'||COMMUNICATIONS_FOUNDER_FRAMING_DIGEST!=='db4243dba5c5fabc91641ddd3382cd3ba4f347488cc557155130e7242d6a5960')refuse('actual_framing_definition_changed');
  const api=new CommunicationsAgentsAPI({apiKey:process.env.OPENAI_API_KEY,allowPaidInference:false,requestTimeoutMs:15000,
    fetch:(url,init={})=>{if((init.method??'GET')!=='GET')refuse('adoption_mutation_forbidden');return fetch(url,init);}});
  const p=await api.preflight(),base=p.gmailMcp?communicationsMcpDefinition(p.gmailMcp):COMMUNICATIONS_HISTORY_DEFINITION;
  const h=communicationsHypothesisDefinition(base,COMMUNICATIONS_FRAMING_VERSION);
  const {Store}=await import(pathToFileURL(resolve('dist/daily-research/release/tools/daily_research/firestore_bridge.mjs')).href);
  if(typeof Store.prototype.screenSnapshot!=='function')refuse('installed_screen_reader_missing');
  const after=inspectRuntime(target),identity=({observedAtMs,state,...fields})=>fields;
  if(sha(identity(before))!==sha(identity(after)))refuse('runtime_identity_changed');cleanSource(target);
  return {schema:'blueprint.postdeploy-communications-adoption.v2',readOnly:true,target,runtime:after,observationStartedAtMs:before.observedAtMs,observationFinishedAtMs:after.observedAtMs,
    framingVersion:COMMUNICATIONS_FRAMING_VERSION,founderFramingDigest:COMMUNICATIONS_FOUNDER_FRAMING_DIGEST,model:p.model,project:p.project,savedBinding:p.binding,currentSessionBase:base.version,
    hypothesisDefinition:h.version,hypothesisInstructionsDigest:h.instructionsDigest,installedScreenSnapshotReader:true,installedArchiveBytesVerified:false,liveScreenProcessingProven:false,
    newInference:false,gmailDraftCreated:false,sent:false,admissionAuthorized:false};
}
async function main() {
  const [mode,...args]=process.argv.slice(2);
  if(mode==='verify-adoption') {
    const [target,output]=args;if(!output?.startsWith('/tmp/'))refuse('private_adoption_output_required');
    const result=await verifyAdoption(target);const digest=privateWrite(output,result);console.log(JSON.stringify({ok:true,readOnly:true,target,fileSha256:digest,paidCalls:0,gmailDrafts:0}));return;
  }
  if(mode==='prepare-platform') {
    const [mcpFile,ciFile,baselineFile,directionFile,directory]=args;
    if(!directory?.startsWith('/tmp/')||resolve(directory)!==directory)refuse('private_new_operator_directory_required');mkdirSync(directory,{mode:0o700});
    const originals=Object.fromEntries([['mcp-original.json',mcpFile],['ci-original.json',ciFile],['baseline-original.json',baselineFile],['owner-direction.json',directionFile]].map(([name,path])=>[name,readFileSync(path)]));
    const packet=preparePlatform(...Object.values(originals).map(bytes=>JSON.parse(bytes)));
    privateWrite(`${directory}/platform.json`,packet);originals['platform.json']=readFileSync(`${directory}/platform.json`);
    const {app,bucket}=existingAdmin();try{const archive=await archiveFiles(bucket,originals);await verifyArchive(bucket,archive);privateWrite(`${directory}/platform-retention.json`,archive);
      const object=archive.objects.find(o=>o.name.endsWith('/platform.json'));console.log(JSON.stringify({ok:true,noDbMutation:true,platformUri:`gs://${archive.bucket}/${object.name}`,generation:object.generation,sha256:object.sha256,bytes:object.bytes}));}finally{await app.delete();}return;
  }
  if(mode!=='inspect-from-platform')refuse('explicit_successor_inspection_mode_required');
  const [uri,generation,digest,directory]=args;
  if(!uri?.startsWith(GS_PREFIX)||!/^\d+$/.test(generation??'')||! /^[a-f0-9]{64}$/.test(digest??'')||!directory?.startsWith('/tmp/')||resolve(directory)!==directory)refuse('generation_pinned_successor_platform_required');
  mkdirSync(directory,{mode:0o700});const {app,bucket}=existingAdmin();let bytes;
  try{const file=bucket.file(uri.slice('gs://blueprint-8c1ca.appspot.com/'.length),{generation});const [metadata]=await file.getMetadata();[bytes]=await file.download();
    if(String(metadata.generation)!==generation||Number(metadata.size)!==bytes.length||bytes.length>20000000||sha(bytes)!==digest)refuse('platform_download_binding_changed');}finally{await app.delete();}
  const platform=JSON.parse(bytes);cleanSource(platform.authorityTemplate?.expectedReleaseCommit);
  privateWrite(`${directory}/platform.json`,platform);
  const {proof,authority}=assembleProof(platform,inspectRuntime(platform.authorityTemplate.expectedReleaseCommit));
  privateWrite(`${directory}/process-proof.json`,proof);
  const here=new URL('.',import.meta.url),env={...process.env,PYTHONDONTWRITEBYTECODE:'1',PYTHONPATH:resolve('dist/daily-research/release')};
  const run=(stage,command,argv,childEnv=process.env)=>{
    let stdout;try{stdout=execFileSync(command,argv,{env:childEnv,timeout:180000,stdio:['ignore','pipe','pipe']});}
    catch(e){writeFileSync(`${directory}/${stage}-stdout.txt`,e.stdout??'',{mode:0o600,flag:'wx'});writeFileSync(`${directory}/${stage}-stderr.txt`,e.stderr??'',{mode:0o600,flag:'wx'});refuse(`${stage}_inspection_unavailable`);}
    writeFileSync(`${directory}/${stage}-stdout.txt`,stdout,{mode:0o600,flag:'wx'});
  };
  run('canonical',process.execPath,[new URL('communications-incident-20261006.mjs',here).pathname,'inspect',`${directory}/canonical.json`]);
  const python=resolve('dist/daily-research/venv/bin/python');
  run('provider',python,[new URL('communications-incident-provider-20261006.py',here).pathname,'--canonical',`${directory}/canonical.json`,'--output',`${directory}/provider.json`],env);
  run('cleanup-export',python,[new URL('communications-successor-cleanup-20261007.py',here).pathname,'inspect','--directory',directory],env);
  const bound={...authority,processProofFileSha256:sha(readFileSync(`${directory}/process-proof.json`)),canonicalFileSha256:sha(readFileSync(`${directory}/canonical.json`)),providerFileSha256:sha(readFileSync(`${directory}/provider.json`)),cleanupReadbackFileSha256:sha(readFileSync(`${directory}/cleanup-readback.json`))};
  checkFence(proof,bound,Date.now());cleanSource(bound.expectedReleaseCommit);privateWrite(`${directory}/authority.json`,bound);
  console.log(JSON.stringify({ok:true,readOnly:true,dbMutation:false,providerMutation:false,cleanupArchiveClaimed:false,deleteSubmitted:false,source:bound.expectedReleaseCommit,proofObservedAtMs:proof.observedAtMs,directory}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{console.error(JSON.stringify({ok:false,code:/^[a-z_]+$/.test(e.message)?e.message:'successor_operator_unavailable'}));process.exitCode=2;});
