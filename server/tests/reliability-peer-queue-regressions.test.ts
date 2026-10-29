// @vitest-environment node
/** Minimized peer92d reproductions; actual queue/recovery, fake Firestore and provider. */
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {sharedFakeFirestoreState as store} from './helpers/fake-firestore';
const m=vi.hoisted(()=>({send:vi.fn(),read:vi.fn(),save:vi.fn()}));
vi.mock('../../client/src/lib/firebaseAdmin',async()=>({dbAdmin:(await import('./helpers/fake-firestore')).sharedFakeFirestore,default:{firestore:{FieldValue:{serverTimestamp:()=> 'SYNTHETIC'}}}}));
vi.mock('../logger',()=>({logger:{info:vi.fn(),warn:vi.fn(),error:vi.fn(),debug:vi.fn()}}));
vi.mock('../utils/email',()=>({sendEmail:m.send}));
vi.mock('../utils/pilotRecommendationNotifications',()=>({pilotRecommendationNotificationIsCurrent:async()=>true}));
vi.mock('../utils/field-encryption',()=>({decryptFieldValue:async(v:unknown)=>v}));
vi.mock('../utils/siteTaskBrief',()=>({getBrief:async(id:string)=>store.docs.get(`siteTaskBriefs/${id}`)||null,draftBrief:(v:unknown)=>v,saveBrief:m.save}));
vi.mock('../utils/siteTaskBriefReading',()=>({readBriefFromDescription:m.read}));
vi.mock('../config/env',async original=>({...await original<object>(),isSiteTaskBriefReadingEnabled:()=>true}));
import {deliverOutbox,enqueueOutbox} from '../utils/captureOutbox';
import {recoverCaptureReviews} from '../utils/captureReviewRecovery';
const row=()=>store.docs.get('captureOutbox/peer-minimal:task_received')!;
beforeEach(()=>{store.docs.clear();m.send.mockReset().mockResolvedValue({sent:true,provider:'fake',messageId:'accepted'});m.read.mockReset().mockResolvedValue(true);m.save.mockReset().mockImplementation(async(v:any)=>store.docs.set(`siteTaskBriefs/${v.requestId}`,v));});
afterEach(()=>vi.restoreAllMocks());
const enqueue=()=>enqueueOutbox({idempotencyKey:'peer-minimal:task_received',requestId:'peer-minimal',kind:'task_received',to:'sink@example.invalid',subject:'Synthetic',body:'Synthetic'});
describe('malformed adapter receipts retain provider uncertainty',()=>{
 const outputs=[['null',null],['undefined',undefined],['missing sent',{}],['string sent',{sent:'true',provider:'fake',messageId:'id'}],['accepted missing provider',{sent:true,provider:null,messageId:'id'}],['accepted blank provider',{sent:true,provider:' ',messageId:'id'}],['accepted missing id',{sent:true,provider:'fake',messageId:null}],['accepted numeric id',{sent:true,provider:'fake',messageId:123}]] as const;
 for(const [name,value] of outputs)it(name,async()=>{await enqueue();m.send.mockResolvedValue(value);await deliverOutbox();expect(row()).toMatchObject({status:'unknown',attempts:1,lastError:'delivery_outcome_unknown'});const receipts=[...store.docs.entries()].filter(([key])=>key.includes('/deliveryReceipts/'));expect(receipts).toHaveLength(1);expect(receipts[0][1]).toMatchObject({status:'unknown',provider:null,messageId:null});await deliverOutbox();expect(m.send).toHaveBeenCalledTimes(1);});
 it('valid acceptance stays sent',async()=>{await enqueue();await deliverOutbox();expect(row()).toMatchObject({status:'sent',attempts:1,deliveryMessageId:'accepted'});});
});
function pending(id:string,dueAtMs=0){store.docs.set(`inboundRequests/${id}`,{briefReviewPending:true,briefReviewWork:{attempts:0,dueAtMs},request:{taskStatement:'Synthetic owned task',capture_mode:'self_capture'}});}
describe('durable fair brief recovery scan',()=>{
 it('rotates past unavailable lease to process another customer',async()=>{pending('a-leased',Date.now()+100000);pending('b-ready');await recoverCaptureReviews({limit:1});await recoverCaptureReviews({limit:1});expect(m.read).toHaveBeenCalledTimes(1);expect(store.docs.get('inboundRequests/b-ready')).toMatchObject({briefReviewPending:false,briefReviewWork:{state:'completed',attempts:1}});expect(store.docs.get('inboundRequests/a-leased')).toMatchObject({briefReviewPending:true,briefReviewWork:{attempts:0}});});
 it('retains cursor across module reload and worker restart',async()=>{pending('a-leased',Date.now()+100000);pending('b-ready');await recoverCaptureReviews({limit:1});vi.resetModules();const restarted=await import('../utils/captureReviewRecovery');await restarted.recoverCaptureReviews({limit:1});expect(store.docs.get('inboundRequests/b-ready')).toMatchObject({briefReviewPending:false});});
 it('wraps exhausted persisted cursor in same pass to visit newly due work',async()=>{pending('a-ready');store.docs.set('automationCursors/capture_brief_recovery',{last_id:'z-old'});await recoverCaptureReviews({limit:1});expect(m.read).toHaveBeenCalledTimes(1);expect(store.docs.get('inboundRequests/a-ready')).toMatchObject({briefReviewPending:false,briefReviewWork:{state:'completed'}});});
});
