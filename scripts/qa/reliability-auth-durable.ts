/** Real Auth + Firestore + Storage emulators; diagnostic fixture creation, no normal-UI claim. */
import assert from 'node:assert/strict';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const project='demo-blueprint-reliability-d';
assert.equal(process.env.GOOGLE_CLOUD_PROJECT,project);assert.equal(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:8080');
assert.equal(process.env.FIREBASE_STORAGE_EMULATOR_HOST,'127.0.0.1:9199');assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST,'127.0.0.1:9099');
assert.equal(process.env.BLUEPRINT_LOCAL_WEBAPP_ROUTE_PROOF_AUTH_TOKEN,undefined);
assert(!Object.keys(process.env).some(key=>/^(OPENAI_API_KEY|DEEPSEEK_API_KEY|ANTHROPIC_API_KEY|RESEND_API_KEY|FIREBASE_SERVICE_ACCOUNT_JSON|GOOGLE_APPLICATION_CREDENTIALS)$/.test(key)));
const root=process.env.RELIABILITY_AUTH_APP_ROOT!,output=process.env.RELIABILITY_AUTH_OUTPUT!;
const local=(hostname:string)=>['127.0.0.1','localhost','::1','[::1]'].includes(hostname);
let blockedExternalAttempts=0;
function checkTarget(input:any,options?:any){const hostname=options?.hostname ?? options?.host ?? (input instanceof URL?input.hostname:typeof input==='string'?new URL(input).hostname:input?.hostname ?? input?.host ?? 'localhost');if(!local(String(hostname).replace(/:\d+$/,''))){blockedExternalAttempts++;throw new Error('External dispatch blocked by D isolated harness');}}
for(const transport of [http,https]){const request=transport.request.bind(transport),get=transport.get.bind(transport);transport.request=((input:any,...args:any[])=>{checkTarget(input,args[0]);return (request as any)(input,...args);}) as any;transport.get=((input:any,...args:any[])=>{checkTarget(input,args[0]);return (get as any)(input,...args);}) as any;}
const fetchBefore=globalThis.fetch;globalThis.fetch=((input:any,options?:any)=>{checkTarget(input instanceof Request?input.url:input);return fetchBefore(input,{...options,redirect:'error'});}) as typeof fetch;
for(const port of [8080,9199,9099])await new Promise<void>((resolve,reject)=>{const socket=net.connect(port,'127.0.0.1');socket.setTimeout(2000);socket.once('connect',()=>{socket.destroy();resolve();});socket.once('error',reject);socket.once('timeout',()=>{socket.destroy();reject(new Error('D local emulator unavailable'));});});
const load=(relative:string)=>import(pathToFileURL(path.join(root,relative)).href);
const [{default:express},firebaseModule,{default:verify},{default:workspace},{default:brief},{csrfProtection,csrfCookieHandler},{createCaptureUploadToken}]=await Promise.all([import('express'),load('client/src/lib/firebaseAdmin.ts'),load('server/middleware/verifyFirebaseToken.ts'),load('server/routes/workspace.ts'),load('server/routes/site-task-brief.ts'),load('server/middleware/csrf.ts'),load('server/utils/captureUploadToken.ts')]);
// tsx can unwrap the Firebase SDK default carrying __esModule. Its initialized
// app still owns the production handlers' exact emulator instances.
const db=firebaseModule.dbAdmin ?? firebaseModule.firestore?.();
const auth=firebaseModule.authAdmin ?? firebaseModule.auth?.();
const admin=firebaseModule.default ?? firebaseModule;
assert(db&&auth);assert.equal(db.projectId,project);const app=express();app.use(express.json());app.get('/api/csrf',csrfCookieHandler);app.use('/api/workspace',csrfProtection,verify,workspace);app.use('/api/site-task-brief',brief);
const server=http.createServer(app);await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${(server.address() as net.AddressInfo).port}`;
const codeSha=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();const runId=Date.now().toString(36);
const sourceDigests=Object.fromEntries(await Promise.all(['server/middleware/verifyFirebaseToken.ts','server/routes/workspace.ts','server/routes/site-task-brief.ts','server/utils/taskLifecycleNotifications.ts'].map(async file=>[file,createHash('sha256').update(await readFile(path.join(root,file))).digest('hex')])));
const workingTreeDirty=Boolean(execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim());
const canonical=(v:any):any=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>[k,canonical(x)])):v;
const scenarios=[
 ['D2-001','owner_read',200],['D2-002','wrong_uid_read',404],['D2-003','invalid_token',401],['D2-004','missing_token',401],
 ['D2-005','disabled_old_token',401],['D2-006','revoked_old_token',401],['D2-007','deleted_old_token',401],['D2-008','unverified_owner',404],
 ['D2-009','withdrawn_workspace',200],['D2-010','withdrawn_signed_owner',200],['D2-011','withdrawn_signed_film',200],
 ['D2-012','withdrawn_derived_brief',409],['D2-013','withdrawn_derived_items',409],['D2-014','withdrawn_derived_followup',409],['D2-015','wrong_uid_withdrawal',404],['D3-001','withdrawn_notice_enqueue',200],
] as const;
const cases=scenarios.map(([caseId,scenario,expectedStatus])=>{const c:any={kind:'integration-journey',caseId,family:scenario==='withdrawn_notice_enqueue'?'notification-accounting':'access-consent',parameters:{scenario,actor:scenario.includes('wrong_uid')?'other_account':'owner',expectedStatus,diagnosticFixtureCreation:true},expectedTransitions:['ordinary emulator identity','authenticated HTTP','durable authorization or withdrawal boundary'],sourceId:null,split:null,layer:'real-handlers/Auth-Firestore-Storage-emulators',providerMode:'no-provider/no-mail',replayCommand:'node scripts/qa/reliability-auth-durable.mjs',labelVersion:scenario==='withdrawn_notice_enqueue'?'D3.v1':'D2.v1'};c.semanticHash=createHash('sha256').update(JSON.stringify(canonical({kind:c.kind,family:c.family,parameters:c.parameters,expectedTransitions:c.expectedTransitions,sourceId:null,split:null}))).digest('hex');return c;});
await mkdir(output,{recursive:true,mode:0o700});await writeFile(path.join(output,'cases-v2.json'),JSON.stringify(cases,null,2),{mode:0o600});
async function signIn(email:string){const response=await fetch(`http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=local-fixture-key`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:'LocalFixturePassword123!',returnSecureToken:true})});assert.equal(response.status,200);return (await response.json() as any).idToken;}
async function request(route:string,token:string|null,method='GET'){const headers:any={...(token?{Authorization:`Bearer ${token}`}:{})};if(method!=='GET'){const response=await fetch(`${base}/api/csrf`);const body=await response.json() as any;headers['x-csrf-token']=body.csrfToken;headers.Cookie=response.headers.get('set-cookie')!.split(';')[0];headers['Content-Type']='application/json';}const response=await fetch(`${base}${route}`,{method,headers,...(method!=='GET'?{body:'{}'}:{})});return {status:response.status,body:await response.json() as any};}
const traces:any[]=[];
try{for(const c of cases){if(process.env.RELIABILITY_AUTH_CASE_FILTER&&!new RegExp(process.env.RELIABILITY_AUTH_CASE_FILTER).test(c.caseId))continue;const start=performance.now(),scenario=c.parameters.scenario;
 const requestId=`d2-${runId}-${c.caseId.toLowerCase()}`,owner=`owner-${requestId}`,other=`other-${requestId}`,email=`${owner}@example.invalid`;
 const trace:any={caseId:c.caseId,runId,codeSha,workingTreeDirty,sourceDigests,layer:c.layer,providerMode:c.providerMode,fixtureMode:'diagnostic seeded owned emulator records; not normal UI',status:'partial',steps:[]};
 try{await auth.createUser({uid:owner,email,password:'LocalFixturePassword123!',emailVerified:scenario!=='unverified_owner'});await auth.createUser({uid:other,email:`${other}@example.invalid`,password:'LocalFixturePassword123!',emailVerified:true});
 const ownerToken=await signIn(email),otherToken=await signIn(`${other}@example.invalid`);trace.steps.push({kind:'real Auth emulator email/password identities',identityCount:2,tokenStorage:'memory only'});
 const requestRef=db.collection('inboundRequests').doc(requestId);await requestRef.set({account_owner_uid:owner,requestId,request:{buyerType:'site_operator',capture_mode:'self_capture',taskStatement:'Owned synthetic job',siteTaskGates:{},consent_attestation:{granted:true,statement_version:'2026-09-18.v1',recorded_at_iso:new Date().toISOString()}},contact:{email},site_task_brief_confirmed_at:new Date().toISOString(),capture_coverage:{covers_scene:true}});
 await db.collection('users').doc(owner).set({buyerType:'site_operator',name:'Synthetic Owner'});await db.collection('users').doc(other).set({buyerType:'site_operator',name:'Synthetic Other'});
 await db.collection('siteTaskBriefs').doc(requestId).set({requestId,summary:'Synthetic mixed-source brief',proposed:[],unresolved:[],captureMode:'self_capture',draftedFrom:['observation'],draftedAtIso:new Date().toISOString(),confirmedAtIso:new Date().toISOString()});
 await db.collection('captureUploadSessions').doc(`walkthrough-${requestId}`).set({world_reconstruction:{state:'ready',assets:{launchUrl:'https://example.invalid/synthetic-scene',thumbnailUrl:'https://example.invalid/synthetic-thumbnail'}}});
 await db.collection('evaluationRuns').doc(`run-${requestId}`).set({runId:`run-${requestId}`,teamId:'synthetic-team',sceneId:requestId,state:'completed',result:{observed:{episodesRun:10,episodesSucceeded:8}}});trace.steps.push({kind:'real durable emulator fixtures persisted',source:'owned synthetic diagnostic data'});
 let token:string|null=ownerToken,route=`/api/workspace/tasks/${requestId}`,method='GET';
 if(scenario==='wrong_uid_read')token=otherToken;if(scenario==='invalid_token')token='invalid-local-token';if(scenario==='missing_token')token=null;
 if(scenario==='disabled_old_token')await auth.updateUser(owner,{disabled:true});
 if(scenario==='revoked_old_token'){await new Promise(resolve=>setTimeout(resolve,1200));await auth.revokeRefreshTokens(owner);}
 if(scenario==='deleted_old_token')await auth.deleteUser(owner);
 if(scenario==='wrong_uid_withdrawal'){token=otherToken;route+='/recording-consent/withdraw';method='POST';}
 if(scenario.startsWith('withdrawn_')){const withdrawal=await request(`${route}/recording-consent/withdraw`,ownerToken,'POST');assert.equal(withdrawal.status,202);assert.equal(withdrawal.body.receipt.deletionConfirmed,false);assert.equal((await requestRef.get()).data()?.consent_revoked,true);trace.steps.push({kind:'real owner withdrawal handler and durable tombstone',status:withdrawal.status,deletionConfirmed:false});
 if(scenario!=='withdrawn_workspace'){const signed=createCaptureUploadToken({requestId,sceneId:`site-${requestId}`,captureId:`walkthrough-${requestId}`,scope:scenario==='withdrawn_signed_film'?'film':'owner'});const endpoint=scenario==='withdrawn_derived_brief'?'':scenario==='withdrawn_derived_items'?'/items':scenario==='withdrawn_derived_followup'?'/follow-up':'/status';route=`/api/site-task-brief/${signed}${endpoint}`;token=null;}}
 if(scenario==='withdrawn_notice_enqueue'){
   const lifecycle=await load('server/utils/taskLifecycleNotifications.ts');
   const intent=await lifecycle.enqueueTaskLifecycleNotification({requestId,milestone:'scene_ready'});
   const queued=await db.collection('captureOutbox').where('requestId','==',requestId).get();
   trace.steps.push({kind:'actual capture scene-notice producer after durable withdrawal',enqueued:intent.enqueued,durableIntentCount:queued.size});
   assert.equal(intent.enqueued,false);assert.equal(queued.size,0);
 }
 const result=await request(route,token,method);trace.steps.push({kind:'actual HTTP through scoped production handlers',status:result.status});assert.equal(result.status,c.parameters.expectedStatus);
 if(scenario==='owner_read'){assert.equal(result.body.sceneReady,true);assert.equal(result.body.thumbnailUrl,'https://example.invalid/synthetic-thumbnail');}
 if(scenario==='withdrawn_workspace'){assert.equal(result.body.thumbnailUrl,null);assert.equal(result.body.sceneReady,false);assert.deepEqual(result.body.results,[]);assert.match(result.body.readiness.headline,/consent was withdrawn/);}
 if(scenario==='withdrawn_signed_owner'||scenario==='withdrawn_signed_film'){assert.equal(result.body.sceneViewUrl,null);assert.equal(result.body.summary,null);assert.match(result.body.status.headline,/consent was withdrawn/);}
 if(scenario==='wrong_uid_withdrawal')assert.equal((await requestRef.get()).data()?.consent_revoked,undefined);
 const persisted=(await requestRef.get()).data();trace.durableEvidence={requestExists:true,revoked:persisted?.consent_revoked===true,ownerBindingRetained:persisted?.account_owner_uid===owner,requestDigest:createHash('sha256').update(JSON.stringify(persisted)).digest('hex')};trace.status='passed';
 }catch(error:any){trace.status='failed';trace.error=String(error.message).replace(/https?:\/\/[^\s]+/g,'[URL redacted]');}
 trace.latencyMs=performance.now()-start;traces.push(trace);await writeFile(path.join(output,'traces-v2.json'),JSON.stringify({runId,project,codeSha,providerMode:'none',fixtureMode:'diagnostic',paidProviderDispatches:0,blockedExternalAttempts,traces},null,2),{mode:0o600});
}}finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await db.terminate();await Promise.all(admin.apps.map((a:any)=>a?.delete()));}
const failed=traces.filter(t=>t.status==='failed');console.log(JSON.stringify({attempted:traces.length,passed:traces.length-failed.length,failed:failed.length,codeSha,project,layer:'real Auth/Firestore/Storage emulators',providerDispatches:0,blockedExternalAttempts}));if(failed.length&&!process.env.RELIABILITY_AUTH_EXPECT_BASELINE_FAILURE)process.exitCode=1;
