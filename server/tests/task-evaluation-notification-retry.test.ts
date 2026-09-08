// @vitest-environment node
import express from 'express';
import { createServer, type Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fixture from './fixtures/pipeline-policy-canary-publication.v4.json';
import { canonicalArtifactDigest } from '../utils/taskCandidateContract';
const harness=vi.hoisted(()=>{
 const records=new Map<string,any>();let tail=Promise.resolve();
 const reference=(collection:string,id:string)=>({key:`${collection}:${id}`,id,get:async()=>({exists:records.has(`${collection}:${id}`),data:()=>structuredClone(records.get(`${collection}:${id}`))})});
 const write=(ref:any,value:any,options?:{merge?:boolean})=>records.set(ref.key,options?.merge?{...records.get(ref.key),...structuredClone(value)}:structuredClone(value));
 const db={collection:(name:string)=>({doc:(id:string)=>reference(name,id)}),runTransaction:(callback:any)=>{
  const result=tail.then(()=>callback({get:(ref:any)=>ref.get(),set:write,create:(ref:any,value:any)=>{if(records.has(ref.key))throw new Error('duplicate');write(ref,value);}}));
  tail=result.then(()=>undefined,()=>undefined);return result;
 }};
 return {records,db,send:vi.fn()};
});
vi.mock('../../client/src/lib/firebaseAdmin',()=>({dbAdmin:harness.db}));
vi.mock('../utils/transactional-notifications',()=>({dispatchTransactionalEmailNotification:harness.send}));
vi.mock('../middleware/verifyFirebaseToken',()=>({default:(_req:unknown,res:any,next:()=>void)=>res.locals.firebaseUser?next():res.status(401).json({error:'fixture authentication required'})}));
import router from '../routes/task-evaluation-results';
import { retryTaskEvaluationResultNotification } from '../utils/taskEvaluationNotificationRetry';
let digest:string;let server:Server;let url:string;
const sent={status:'sent',sent_at:'2026-09-07T00:00:00Z',provider_message_id:'fixture-message'};
const retry=(requestId='retry-1',actor={uid:'owner',isOps:false},expectedDigest=digest)=>retryTaskEvaluationResultNotification({db:harness.db as any,recordId:'result',requestId,actor,expectedDigest});
beforeEach(async()=>{
 harness.records.clear();harness.send.mockReset().mockResolvedValue(sent);
 const publication:any=structuredClone(fixture);
 publication.result_delivery.delivery_digest=canonicalArtifactDigest(publication.result_delivery,'delivery_digest');
 publication.policy_canary_result.result_delivery_digest=publication.result_delivery.delivery_digest;
 publication.policy_canary_result.projection_digest=canonicalArtifactDigest(publication.policy_canary_result,'projection_digest');digest=publication.policy_canary_result.projection_digest;
 harness.records.set('captureTaskEvaluationRuns:result',{record_id:'result',owner_user_id:'owner',organization_id:'team',access_visibility:'owner_only',publication});
 harness.records.set(`taskEvaluationPolicyRuns:${publication.run_id}`,{run_id:publication.run_id,run_kind:'internal_policy_canary',owner_user_id:'owner',team_namespace:'team',result_record_id:'result',request_digest:publication.request_digest,delivery_digest:publication.result_delivery.delivery_digest,state:'blocked',notification_recipient_user_id:'owner',notification:{email:'owner@example.test'},notification_delivery:{terminal_state:'blocked',status:'failed',attempts:1,run_result_digest:digest}});
 const app=express();app.use(express.json());app.use((req,res,next)=>{if(req.header('x-fixture-user'))res.locals.firebaseUser={uid:req.header('x-fixture-user'),tenantId:'team'};next();});app.use('/api/task-evaluation-results',router);
 server=createServer(app);await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();if(!address||typeof address==='string')throw new Error('fixture address');url=`http://127.0.0.1:${address.port}`;
});
afterEach(async()=>{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));});
describe('explicit result email recovery',()=>{
 it('requires authenticated explicit authorization at the route and prevents recipient override',async()=>{
  const body={request_id:'request',expected_result_digest:digest,authorize_email_retry:true};
  const post=(value:unknown,user?:string)=>fetch(`${url}/api/task-evaluation-results/result/notification-retries`,{method:'POST',headers:{'content-type':'application/json',...(user?{'x-fixture-user':user}:{})},body:JSON.stringify(value)});
  expect((await post(body)).status).toBe(401);expect((await post({...body,authorize_email_retry:false},'owner')).status).toBe(400);
  expect((await post({...body,recipient_email:'other@example.test'},'owner')).status).toBe(400);expect((await post(body,'other')).status).toBe(403);expect(harness.send).not.toHaveBeenCalled();
  const response=await post(body,'owner');expect(response.status).toBe(200);expect(await response.json()).toMatchObject({status:'accepted',attempt:2});
 });
 it('replays one request without sending again and preserves the original failed receipt',async()=>{
  const original=structuredClone(harness.records.get('captureTaskEvaluationRuns:result'));
  const first=await retry();expect(first.status).toBe('accepted');expect(await retry()).toEqual(first);expect(harness.send).toHaveBeenCalledTimes(1);
  expect(harness.records.get('captureTaskEvaluationRuns:result')).toEqual(original);
  const receipts=[...harness.records.entries()].filter(([key])=>key.startsWith('taskEvaluationResultNotificationRetries:')).map(([,value])=>value);
  expect(receipts[0].prior_notification.status).toBe('failed');expect(receipts[0].receipt.status).toBe('accepted');
  expect(harness.send.mock.calls[0][0]).toMatchObject({recipientEmail:'owner@example.test'});
 });
 it('does not send twice under concurrent requests',async()=>{
  let finish!:(value:any)=>void;harness.send.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
  const first=retry('one');await vi.waitFor(()=>expect(harness.send).toHaveBeenCalledOnce());
  expect((await retry('one')).status).toBe('dispatching');
  await expect(retry('two')).rejects.toMatchObject({code:'result_notification_retry_requires_reconciliation'});
  finish(sent);await first;expect(harness.send).toHaveBeenCalledOnce();
 });
 it('enforces the total attempt cap and refuses changed result digests',async()=>{
  await expect(retry('bad',{uid:'owner',isOps:false},'sha256:'+'0'.repeat(64))).rejects.toMatchObject({status:409});
  harness.send.mockResolvedValue({status:'failed'});expect((await retry('one')).attempt).toBe(2);expect((await retry('two')).attempt).toBe(3);
  await expect(retry('three')).rejects.toMatchObject({status:429});expect(harness.send).toHaveBeenCalledTimes(2);
 });
 it('preserves an ambiguous outcome and requires reconciliation instead of blind resend',async()=>{
  harness.send.mockRejectedValue(new Error('ambiguous fixture transport outcome'));expect((await retry()).status).toBe('unknown');
  await expect(retry('different')).rejects.toMatchObject({code:'result_notification_retry_requires_reconciliation'});expect(harness.send).toHaveBeenCalledOnce();
 });
 it('does not attach a late send receipt to changed ownership',async()=>{
  let finish!:(value:any)=>void;harness.send.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));const pending=retry();await vi.waitFor(()=>expect(harness.send).toHaveBeenCalledOnce());
  const run=[...harness.records.entries()].find(([key])=>key.startsWith('taskEvaluationPolicyRuns:'))![1];run.owner_user_id='other';harness.records.get('captureTaskEvaluationRuns:result').owner_user_id='other';
  finish(sent);await pending;expect(run.notification_delivery.attempts).toBe(1);
  const receipt=[...harness.records.entries()].find(([key])=>key.startsWith('taskEvaluationResultNotificationRetries:'))![1];expect(receipt.applied_to_current_run).toBe(false);
 });
});
