// @vitest-environment node
/** Offline semantic replay. SDK sink and serialized fake Firestore: never live-provider evidence. */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestore as db, sharedFakeFirestoreState as store } from "./helpers/fake-firestore";
const sdk = vi.hoisted(() => vi.fn());
const authority = vi.hoisted(() => vi.fn(async () => true));
vi.mock("resend", () => ({ Resend: class { emails = { send: sdk }; } }));
vi.mock("../../client/src/lib/firebaseAdmin", async () => ({default:{firestore:{FieldValue:{serverTimestamp:()=>"SERVER_TIMESTAMP"}}},dbAdmin:(await import("./helpers/fake-firestore")).sharedFakeFirestore}));
vi.mock("../logger", () => ({logger:{warn:vi.fn(),error:vi.fn(),info:vi.fn(),debug:vi.fn()}}));
vi.mock("../utils/pilotRecommendationNotifications", () => ({pilotRecommendationNotificationIsCurrent:authority}));
import { deliverOutbox, enqueueOutbox, reconcileOutboxDeliveries } from "../utils/captureOutbox";
const row = () => store.docs.get("captureOutbox/reliability:notice") as Record<string, any>;
const input = () => ({idempotencyKey:"reliability:notice",requestId:"reliability",kind:"task_received" as const,to:"sink@example.invalid",subject:"synthetic",body:"synthetic"});
type Case = {caseId:string;family:string;parameters:Record<string,any>;expectedTransitions:string[];assertions:string[];layer:string;providerMode:string;semanticHash:string;replayCommand:string};
const cases: Case[] = [];
const results: Record<string, any>[] = [];
function canonical(value:any):any { if(Array.isArray(value))return value.map(canonical);if(value && typeof value === "object")return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));return value; }
function define(family:string, name:string, parameters:Record<string,any>, expectedTransitions:string[], run:()=>Promise<void>) {
 const semanticHash=createHash("sha256").update(JSON.stringify(canonical({kind:"infrastructure",family,parameters,expectedTransitions,sourceId:null,split:null}))).digest("hex");
 const caseId=`B-${family}-${name}`;
 cases.push({caseId,family,parameters,expectedTransitions,assertions:["durable fake state matches transition", "provider effects bounded by persisted attempts", "no uncertain automatic replay"],layer:"fake-provider-integration/fake-firestore",providerMode:"mocked Resend SDK transport; actual sendEmail wrapper",semanticHash,replayCommand:`npx vitest run server/tests/reliability-queue-program.test.ts -t '${caseId}'`});
 it(caseId, async()=>{const start=performance.now();try{await run();results.push({caseId,status:"passed",attempted:true,repeat:1,latencyMs:performance.now()-start,providerCalls:sdk.mock.calls.length});}catch(error){results.push({caseId,status:"failed",attempted:true,repeat:1,latencyMs:performance.now()-start,providerCalls:sdk.mock.calls.length,error:error instanceof Error?error.message:"failed"});throw error;}});
}
beforeEach(()=>{store.docs.clear();sdk.mockReset().mockResolvedValue({data:{id:"synthetic-accepted"},error:null});authority.mockReset().mockResolvedValue(true);vi.stubEnv("RESEND_API_KEY","synthetic-sink-only");vi.stubEnv("RESEND_FROM_EMAIL","sink@example.invalid");vi.stubEnv("NODE_ENV","test");});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllEnvs();});
afterAll(()=>{const output=process.env.BLUEPRINT_RELIABILITY_B_OUTPUT;if(!output)return;mkdirSync(output,{recursive:true});writeFileSync(`${output}/cases.json`,JSON.stringify({schemaVersion:1,freezeVersion:"charter-v1",cases},null,2));writeFileSync(`${output}/results.json`,JSON.stringify({schemaVersion:1,layer:"actual outbox/email handlers, serialized in-memory Firestore, mocked Resend SDK",generated:cases.length,deduplicated:new Set(cases.map(c=>c.semanticHash)).size,attempted:results.length,passed:results.filter(r=>r.status==="passed").length,failed:results.filter(r=>r.status==="failed").length,skipped:0,blocked:0,partiallyExecuted:0,results},null,2));});
function failWrite(status:string){const original=db.runTransaction.bind(db);return vi.spyOn(db,"runTransaction").mockImplementation(async (callback:any)=>original(async(tx:any)=>callback({...tx,set:(ref:any,data:any,options:any)=>{if(data.status===status)throw new Error(`synthetic-write-failed-${status}`);return tx.set(ref,data,options);}})));}

describe("provider failure semantics",()=>{
 const outcomes=[
  ...[400,401,403,404,409,422,429].map(status=>({name:`rejection-${status}`,status,unknown:false})),
  ...[408,500,503].map(status=>({name:`uncertain-${status}`,status,unknown:true})),
  {name:"missing-receipt",status:null,unknown:true},
  {name:"transport-exception",status:null,unknown:true},
 ];
 for(const outcome of outcomes)for(const attempts of [0,4,5])define("provider-failures",`${outcome.name}-attempts${attempts}`,{providerHttpStatus:outcome.status,boundary:outcome.name,persistedAttempts:attempts},["pending","dispatching",outcome.unknown?"unknown":attempts===5?"failed":"pending"],async()=>{
  await enqueueOutbox(input());row().attempts=attempts;
  sdk.mockImplementation(async()=>{if(outcome.name==="transport-exception")throw new Error("synthetic connection closed after possible acceptance");return {data:null,error:outcome.status===null?null:{statusCode:outcome.status,message:`synthetic ${outcome.status}`}};});
  await deliverOutbox();expect(row()).toMatchObject({status:outcome.unknown?"unknown":attempts===5?"failed":"pending",attempts:attempts+1});expect(sdk).toHaveBeenCalledTimes(1);
  if(outcome.unknown || attempts===5){await deliverOutbox();expect(sdk).toHaveBeenCalledTimes(1);}else{sdk.mockResolvedValue({data:{id:"recovered"},error:null});await deliverOutbox();expect(row()).toMatchObject({status:"sent",attempts:attempts+2});expect(sdk).toHaveBeenCalledTimes(2);}
 });
});

describe("ordering semantics",()=>{
 for(const field of ["idempotencyKey","requestId","kind","to","subject","body","replyTo"])define("ordering",`changed-${field}-before-dispatch`,{field,boundary:"claim-to-dispatch",change:"successor"},["pending","claimed","pending"],async()=>{
  await enqueueOutbox(input());authority.mockImplementation(async()=>{row()[field]="successor";return true;});
  // Change before the dispatch transaction reads the row, rather than after digest validation.
  const original=db.runTransaction.bind(db);let transactions=0;vi.spyOn(db,"runTransaction").mockImplementation(async(callback:any)=>{transactions++;if(transactions===2)row()[field]="successor";return original(callback);});
  await deliverOutbox();expect(row().status).toBe("pending");expect(row().attempts).toBe(0);expect(sdk).not.toHaveBeenCalled();
 });
 for(const field of ["idempotencyKey","requestId","kind","to","subject","body","replyTo","deliveryToken","deliveryDigest"])define("ordering",`changed-${field}-during-provider`,{field,boundary:"dispatch-to-ack",change:"successor"},["pending","dispatching","dispatching","unknown"],async()=>{
  await enqueueOutbox(input());sdk.mockImplementation(async()=>{row()[field]="successor";return {data:{id:"old-accepted"},error:null};});
  await deliverOutbox();expect(row().status).toBe("dispatching");expect(row().deliveryMessageId).toBeUndefined();expect([...store.docs.keys()].filter(k=>k.includes("/deliveryReceipts/"))).toHaveLength(1);row().deliveryLeaseUntilMs=0;await deliverOutbox();expect(row().status).toBe("unknown");expect(sdk).toHaveBeenCalledTimes(1);
 });
 for(const callers of [2,3,8])define("ordering",`concurrent-callers-${callers}`,{actors:callers,ordering:"overlapping queue passes"},["pending","claimed","dispatching","sent"],async()=>{await enqueueOutbox(input());await Promise.all(Array.from({length:callers},()=>deliverOutbox()));expect(sdk).toHaveBeenCalledTimes(1);expect(row()).toMatchObject({status:"sent",attempts:1});});
 for(const kind of ["task_received","video_received","scene_ready","results_ready"] as const)define("ordering",`duplicate-intent-${kind}`,{kind,ordering:"producer duplicate before and after delivery"},["pending","sent","sent"],async()=>{const event={...input(),kind};await enqueueOutbox(event);await enqueueOutbox(event);await deliverOutbox();await enqueueOutbox(event);await deliverOutbox();expect(sdk).toHaveBeenCalledTimes(1);expect(row()).toMatchObject({status:"sent",attempts:1});});
 for(const outcome of ["accepted","rejected","unknown"])define("ordering",`expired-dispatch-late-${outcome}`,{ordering:"expired dispatch reconciled before receipt",outcome},["dispatching","unknown",outcome==="accepted"?"sent":outcome==="rejected"?"pending":"unknown"],async()=>{await enqueueOutbox(input());sdk.mockImplementation(async()=>{row().deliveryLeaseUntilMs=0;await reconcileOutboxDeliveries();expect(row().status).toBe("unknown");return outcome==="accepted"?{data:{id:"late"},error:null}:{data:null,error:{statusCode:outcome==="rejected"?429:500,message:"synthetic"}};});await deliverOutbox();expect(row().status).toBe(outcome==="accepted"?"sent":outcome==="rejected"?"pending":"unknown");expect(sdk).toHaveBeenCalledTimes(1);});
 for(const terminal of ["sent","failed","cancelled"])define("ordering",`terminal-${terminal}-before-late-acceptance`,{ordering:"terminal write during provider",terminal},["dispatching",terminal],async()=>{await enqueueOutbox(input());sdk.mockImplementation(async()=>{row().status=terminal;return {data:{id:"late"},error:null};});await deliverOutbox();expect(row().status).toBe(terminal);await deliverOutbox();expect(sdk).toHaveBeenCalledTimes(1);});
 define("ordering","transaction-callback-retry",{ordering:"discard callback writes then commit same callback"},["pending","dispatching","sent"],async()=>{await enqueueOutbox(input());const original=db.runTransaction.bind(db);vi.spyOn(db,"runTransaction").mockImplementation(async(callback:any)=>{await callback({get:(ref:any)=>ref.get(),set:()=>undefined});return original(callback);});await deliverOutbox();expect(row()).toMatchObject({status:"sent",attempts:1});expect(sdk).toHaveBeenCalledTimes(1);});
});

describe("worker durable boundary replay",()=>{
 const boundaries=["claim-write-failure","dispatch-write-failure","authority-read-failure","accepted-ack-write-failure","expired-claim","expired-dispatch","active-claim","active-dispatch","terminal-sent","terminal-failed"];
 for(const boundary of boundaries)for(const attempts of [0,4,5])define("worker-lifecycle",`${boundary}-attempts${attempts}`,{boundary,persistedAttempts:attempts,restart:"new queue invocation same persisted fake rows"},["persisted-boundary","recover-or-preserve-terminal"],async()=>{
  await enqueueOutbox(input());row().attempts=attempts;
  if(boundary==="terminal-sent" || boundary==="terminal-failed"){row().status=boundary==="terminal-sent"?"sent":"failed";await deliverOutbox();expect(row().status).toBe(boundary==="terminal-sent"?"sent":"failed");expect(sdk).not.toHaveBeenCalled();return;}
  if(boundary.includes("claim") && !boundary.includes("failure")){row().status="claimed";row().deliveryLeaseUntilMs=boundary==="expired-claim"?0:Date.now()+600000;}
  if(boundary.includes("dispatch") && !boundary.includes("failure")){row().status="dispatching";row().deliveryLeaseUntilMs=boundary==="expired-dispatch"?0:Date.now()+600000;}
  if(boundary==="active-claim" || boundary==="active-dispatch" || boundary==="expired-dispatch"){await deliverOutbox();expect(row().status).toBe(boundary==="active-claim"?"claimed":boundary==="active-dispatch"?"dispatching":"unknown");expect(sdk).not.toHaveBeenCalled();expect(row().attempts).toBe(attempts);return;}
  if(attempts===6){await deliverOutbox();expect(row().status).toBe("failed");expect(sdk).not.toHaveBeenCalled();return;}
  if(boundary==="expired-claim"){await deliverOutbox();expect(row()).toMatchObject({status:"sent",attempts:attempts+1});expect(sdk).toHaveBeenCalledTimes(1);return;}
  const failingStatus=boundary==="claim-write-failure"?"claimed":boundary==="dispatch-write-failure"?"dispatching":"sent";
  const spy=boundary==="authority-read-failure"?null:failWrite(failingStatus);
  if(boundary==="authority-read-failure")authority.mockRejectedValueOnce(new Error("synthetic authority unavailable"));
  await expect(deliverOutbox()).rejects.toThrow(/synthetic/);spy?.mockRestore();
  const accepted=boundary==="accepted-ack-write-failure";
  expect(row().attempts).toBe(attempts+(accepted?1:0));expect(sdk).toHaveBeenCalledTimes(accepted?1:0);
  row().deliveryLeaseUntilMs=0;await deliverOutbox();await deliverOutbox();
  expect(row().status).toBe(accepted?"unknown":"sent");expect(sdk).toHaveBeenCalledTimes(1);expect(row().attempts).toBe(attempts+1);
 });
});
