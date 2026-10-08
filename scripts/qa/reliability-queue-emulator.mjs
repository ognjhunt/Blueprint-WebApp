/** 20 joined HTTP-intake -> persisted outbox -> separate-process worker traces. */
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import admin from 'firebase-admin';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const output='/workspace/reliability-program/B/emulator';mkdirSync(output,{recursive:true,mode:0o700});
const project='demo-blueprint-reliability-b', url='http://127.0.0.1:4182';
if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8080')throw new Error('Local Firestore emulator required');
const app=admin.initializeApp({projectId:project},'reliability-b-controller');const db=admin.firestore(app);
const env=Object.fromEntries(['PATH','HOME','TMPDIR'].filter(key=>process.env[key]).map(key=>[key,process.env[key]]));
Object.assign(env,{NODE_ENV:'test',BLUEPRINT_DISABLE_LOCAL_ENV_BOOTSTRAP:'1',CODEX_LOCAL_AVAILABLE:'0',BLUEPRINT_DISABLE_OPS_AUTOMATION_SCHEDULER:'1',BLUEPRINT_SITE_VIDEO_EVIDENCE_ENABLED:'0',GOOGLE_CLOUD_PROJECT:project,GCLOUD_PROJECT:project,FIRESTORE_EMULATOR_HOST:'127.0.0.1:8080',FIREBASE_STORAGE_EMULATOR_HOST:'127.0.0.1:9199',FIREBASE_STORAGE_BUCKET:`${project}.appspot.com`,FIELD_ENCRYPTION_MASTER_KEY:Buffer.alloc(32,1).toString('base64'),BLUEPRINT_REQUEST_REVIEW_TOKEN_SECRET:'owned-local-reliability-fixture-secret-never-production',APP_URL:url,RESEND_API_KEY:'synthetic-local-sink-only',RESEND_FROM_EMAIL:'sink@example.invalid'});
const sink=`${output}/sink.jsonl`;writeFileSync(sink,'',{mode:0o600});
const runId=Date.now().toString(36);
const codeSha=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const traces=[];
function worker(requestId,mode){return new Promise((resolve,reject)=>{const child=spawn(process.execPath,['--import','tsx',path.join(root,'scripts/qa/reliability-queue-worker.ts')],{cwd:root,env:{...env,RELIABILITY_WORKER_MODE:mode,RELIABILITY_REQUEST_ID:requestId,RELIABILITY_SINK_FILE:sink},stdio:['ignore','pipe','pipe']});let stdout='',stderr='';child.stdout.on('data',chunk=>stdout+=chunk);child.stderr.on('data',chunk=>stderr+=chunk);const timer=setTimeout(()=>{child.kill('SIGTERM');reject(new Error('Bounded local worker timed out'));},60000);child.on('error',reject);child.on('close',code=>{clearTimeout(timer);resolve({mode,exitCode:code,stdout,stderr});});});}
const calls=id=>readFileSync(sink,'utf8').split('\n').filter(Boolean).map(line=>JSON.parse(line)).filter(row=>row.requestId===id).length;
async function post(body){const csrf=await fetch(`${url}/api/csrf`,{redirect:"error"});const token=(await csrf.json()).csrfToken;const cookie=csrf.headers.get('set-cookie')?.split(';')[0];return fetch(`${url}/api/inbound-request`,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json','x-csrf-token':token,...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(body)});}
const scenarios=['happy','rejected-recovery','unknown-quarantine','crash-after-claim','crash-after-dispatch','crash-after-acceptance','concurrent-workers','retired-notice','changed-message','ack-write-failure'];
for(const scenario of scenarios)for(const producerMode of ['single-submit','duplicate-submit']){
 const requestId=`b-emulator-${runId}-${scenario}-${producerMode}`;const caseId=`B-journey-${scenario}-${producerMode}`;const start=performance.now();const trace={caseId,runId,requestId,codeSha,scenario,producerMode,layer:'actual Express intake / real Firestore emulator / separate worker processes',providerMode:'fake Resend SDK HTTP sink',status:'partial',steps:[]};
 try{
 const body={requestId,retryToken:createHash('sha256').update(requestId).digest('hex'),firstName:'Synthetic',lastName:'Owner',email:`${requestId}@example.invalid`,company:'Owned synthetic fixture',roleTitle:'Site operator',buyerType:'site_operator',accountSignup:false,budgetBucket:'Undecided/Unsure',requestedLanes:[],siteName:'Owned synthetic site',siteLocation:'Austin, TX',taskStatement:'Move cartons onto a pallet',taskDescription:'Move cartons onto a pallet',siteTaskGates:{},siteTaskSpec:{},captureMode:'self_capture',captureRegion:'us',consentAttestation:{granted:true,statementVersion:'2026-09-18.v1'},context:{sourcePageUrl:`${url}/sites`}};
 const response=await post(body);trace.steps.push({kind:'normal intake HTTP',status:response.status});assert.equal(response.status,201);
 if(producerMode==='duplicate-submit'){const duplicate=await post(body);trace.steps.push({kind:'same retry identity HTTP',status:duplicate.status});assert.equal(duplicate.status,200);}
 const ref=db.collection('captureOutbox').doc(`${requestId}:task_received`);assert.equal((await db.collection('inboundRequests').doc(requestId).get()).exists,true);assert.equal((await ref.get()).data()?.status,'pending');trace.steps.push({kind:'durable intake and notification intent confirmed'});
 if(scenario==='retired-notice')await ref.set({kind:'progress_update'},{merge:true});
 const firstMode=scenario==='rejected-recovery'?'rejected':scenario==='unknown-quarantine'?'unknown':scenario==='happy'||scenario==='concurrent-workers'||scenario==='retired-notice'?'accepted':scenario;
 const firstWorkers=scenario==='concurrent-workers'?await Promise.all([worker(requestId,'accepted'),worker(requestId,'accepted')]):[await worker(requestId,firstMode)];trace.steps.push(...firstWorkers);
 const expectedFirstExit=scenario.startsWith('crash-')?73:scenario==='ack-write-failure'?74:0;for(const receipt of firstWorkers)assert.equal(receipt.exitCode,expectedFirstExit);
 if(scenario.startsWith('crash-')||scenario==='ack-write-failure'||scenario==='changed-message')await ref.set({deliveryLeaseUntilMs:0},{merge:true});
 const recoveryWorker=await worker(requestId,'accepted');trace.steps.push(recoveryWorker);assert.equal(recoveryWorker.exitCode,0);
 const row=(await ref.get()).data();const expected=scenario==='retired-notice'?'cancelled':['unknown-quarantine','crash-after-dispatch','crash-after-acceptance','changed-message','ack-write-failure'].includes(scenario)?'unknown':'sent';assert.equal(row?.status,expected);const expectedCalls=scenario==='retired-notice'||scenario==='crash-after-dispatch'?0:scenario==='rejected-recovery'?2:1;assert.equal(calls(requestId),expectedCalls);trace.outcome={status:row.status,attempts:row.attempts,sinkCalls:calls(requestId)};trace.durableEvidence={requestExists:true,outboxStatus:row.status,attempts:row.attempts,deliveryReceipts:(await ref.collection("deliveryReceipts").get()).size,simulatedReceiptIdPresent:typeof row.deliveryMessageId === "string",rowDigest:createHash("sha256").update(JSON.stringify(row)).digest("hex")};trace.status='passed';
 }catch(error){trace.status='failed';trace.error=error.message;}
 trace.latencyMs=performance.now()-start;traces.push(trace);writeFileSync(`${output}/traces.json`,JSON.stringify({runId,project,providerMode:'simulated',costUsd:0,traces},null,2),{mode:0o600});
}
await db.terminate();await app.delete();console.log(JSON.stringify({layer:'real isolated emulator backend/fake provider',attempted:traces.length,passed:traces.filter(t=>t.status==='passed').length,failed:traces.filter(t=>t.status==='failed').length,costUsd:0}));if(traces.some(t=>t.status!=='passed'))process.exitCode=1;
