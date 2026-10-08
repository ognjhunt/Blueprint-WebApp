/** Disposable child worker: actual outbox + Firestore emulator, fake SDK HTTP sink. */
import { appendFileSync } from "node:fs";
import { createHash } from "node:crypto";
if (process.env.NODE_ENV !== "test" || process.env.BLUEPRINT_DISABLE_LOCAL_ENV_BOOTSTRAP !== "1" || process.env.CODEX_LOCAL_AVAILABLE !== "0") throw new Error("Local secrets/env/model bootstrap prohibited");
const project = process.env.GOOGLE_CLOUD_PROJECT;
if (project !== "demo-blueprint-reliability-b" || process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8080"
  || process.env.FIREBASE_STORAGE_EMULATOR_HOST !== "127.0.0.1:9199") throw new Error("B disposable emulator required");
if (Object.keys(process.env).some(key => /^(OPENAI_API_KEY|DEEPSEEK_API_KEY|ANTHROPIC_API_KEY|FIREBASE_SERVICE_ACCOUNT_JSON|GOOGLE_APPLICATION_CREDENTIALS)$/.test(key))) throw new Error("Live credentials prohibited");
const mode = process.env.RELIABILITY_WORKER_MODE || "accepted";
const sink = process.env.RELIABILITY_SINK_FILE!;
const requestId = process.env.RELIABILITY_REQUEST_ID!;
if (!sink?.startsWith("/workspace/reliability-program/B/") || !/^b-emulator-[a-z0-9-]+$/.test(requestId)) throw new Error("Private B output and synthetic ID required");
const originalFetch = globalThis.fetch;
let calls = 0;
globalThis.fetch = (async(input:any, options?:RequestInit) => {
 const url = new URL(input instanceof Request ? input.url : String(input));
 if (url.href === "https://api.resend.com/emails") {
  calls++;
  appendFileSync(sink, JSON.stringify({requestId, mode, call:calls, providerMode:"simulated SDK HTTP sink", at:new Date().toISOString(), payloadDigest:createHash("sha256").update(String(options?.body)).digest("hex")})+"\n", {mode:0o600});
  if(mode === "crash-after-acceptance") process.exit(73);
  if(mode === "rejected") return new Response(JSON.stringify({name:"rate_limit_exceeded",message:"synthetic",statusCode:429}),{status:429});
  if(mode === "unknown") return new Response(JSON.stringify({name:"application_error",message:"synthetic",statusCode:500}),{status:500});
  if(mode === "changed-message") await db!.collection("captureOutbox").doc(`${requestId}:task_received`).set({body:"synthetic successor"},{merge:true});
  return new Response(JSON.stringify({id:`sink-${requestId}`}),{status:200});
 }
 if (!["127.0.0.1","localhost"].includes(url.hostname)) throw new Error("External dispatch prohibited");
 return originalFetch(input,{...options,redirect:"error"});
}) as typeof fetch;
const {dbAdmin:db} = await import("../../client/src/lib/firebaseAdmin");
if(!db)throw new Error("Emulator db unavailable");
const originalTransaction=db.runTransaction.bind(db);
let injected=false;
(db as any).runTransaction=async(callback:any,...args:any[])=>{
 let marker:string|null=null;
 const result=await (originalTransaction as any)(async(transaction:any)=>callback(new Proxy(transaction,{get(target,key){if(key==="set")return(ref:any,data:any,opts:any)=>{if(ref.path===`captureOutbox/${requestId}:task_received`){marker=data.status;if(mode==="ack-write-failure" && data.status==="sent" && !injected){injected=true;throw new Error("synthetic acknowledgement persistence failure");}}return target.set(ref,data,opts);};const value=target[key];return typeof value==="function"?value.bind(target):value;}})),...args);
 if(!injected && ((mode==="crash-after-claim" && marker==="claimed") || (mode==="crash-after-dispatch" && marker==="dispatching"))){injected=true;process.exit(73);}
 return result;
};
const {deliverOutbox}=await import("../../server/utils/captureOutbox");
try {
 const summary=await deliverOutbox({limit:100});
 const snapshot=await db.collection("captureOutbox").doc(`${requestId}:task_received`).get();
 console.log(JSON.stringify({requestId,layer:"real Firestore emulator/actual outbox worker",providerMode:"fake SDK HTTP sink",summary,row:{status:snapshot.data()?.status,attempts:snapshot.data()?.attempts},calls}));
} catch(error) {
 console.log(JSON.stringify({requestId,error:error instanceof Error?error.message:"worker failed",calls}));
 process.exitCode=mode==="ack-write-failure"?74:1;
} finally { await db.terminate(); }
