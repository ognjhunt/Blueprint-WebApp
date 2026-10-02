const fs=require('node:fs'),crypto=require('node:crypto');
const {isDeepStrictEqual}=require('node:util');
const {pathToFileURL}=require('node:url');
const req=require('node:module').createRequire(process.cwd()+'/package.json');
const ROOT='blueprintDailyResearch/sites-first';
const TEST='baseline-20261002-attempt-0001',DAY='2026-10-01';
const CASE=ROOT+'/canaries/'+TEST;
const report={schema_version:'blueprint.repair-claim-probe.v1',observed_at:new Date().toISOString(),errors:[]};
const normalize=c=>Object.fromEntries(Object.entries(c||{}).filter(([k])=>k!=='lease'));
async function main(){let db,app;
 try{
  const base='/tmp/blueprint-research-repair-b62c27d2/release';
  const manifest=JSON.parse(fs.readFileSync(base+'/manifest.json','utf8'));
  const path='tools/daily_research/firestore_bridge.mjs';
  const pins={'tools/daily_research/firestore_bridge.mjs':'3a10f95a1fa6c9d9887defdba4f46763a02b271348366a9206e3f3578ab123f2',
   'tools/daily_research/publisher.mjs':'480c3b89ded71802af57140c9bd28088ef5bbc1c3115836696596b3a7a65b46e'};
  if(manifest.source_commit!=='b62c27d2aa9a4c455a05b0e9b598f39e8e8d68b6'||!Object.entries(pins).every(([f,d])=>manifest.files[f]===d&&crypto.createHash('sha256').update(fs.readFileSync(base+'/'+f)).digest('hex')===d))throw Error();
  const {Store}=await import(pathToFileURL(base+'/'+path).href);
  const account=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON||'null');
  if(account?.project_id!=='blueprint-8c1ca')throw Error();
  const {initializeApp,cert}=req('firebase-admin/app');
  app=initializeApp({credential:cert(account),projectId:'blueprint-8c1ca'},'repair-claim-read-only');
  db=req('firebase-admin/firestore').initializeFirestore(app,{preferRest:true});
  const store=new Store(db);
  const [normal,control,run,origin,summary,active]=await Promise.all([
   db.doc(ROOT).get(),db.doc(CASE).get(),db.doc(CASE+'/runs/'+DAY).get(),
   db.doc(ROOT+'/runs/'+DAY).get(),store.summary(),store.activeQA()]);
  const n=normal.data(),c=control.data(),r=run.data(),o=origin.data();
  report.documents_present=[normal,control,run,origin].every(s=>s.exists);
  report.repair={number:r?.repair_number,state:r?.repair_state,request_digest:r?.repair_request_digest,
   deadline_ms:r?.repair_deadline_ms,session_id:r?.session_id,root_turn_id:r?.turn_id,
   claim_present:!!r?.repair_claims?.[r?.repair_number],
   claim_digest_matches:!!r?.repair_claims?.[r?.repair_number]&&/^[a-f0-9]{64}$/.test(r?.repair_request_digest||'')&&r.repair_claims[r.repair_number]===r.repair_request_digest};
  report.canary_control_enabled=c?.enabled===true;
  report.canary_workflow_enabled=c?.workflow?.enabled===true;
  report.canary_lease_active=Number.isSafeInteger(c?.lease?.expires_at_ms)&&c.lease.expires_at_ms>Date.now();
  report.origin_guard={control_matches:isDeepStrictEqual(normalize(n),c?.canary?.origin_control),
   row_blob_matches:o?.blob===c?.canary?.origin_row_blob,row_state:o?.state,
   row_cleanup_required:o?.cleanup_required,summary,active_qa_present:!!active};
 }catch{report.errors.push('repair_claim_read_unavailable');}
 try{if(db)await db.terminate();if(app)await req('firebase-admin/app').deleteApp(app);}catch{report.errors.push('read_client_close_unavailable');}
 report.complete=report.errors.length===0&&report.documents_present===true;
 console.log(JSON.stringify(report));process.exit(report.complete?0:2);
}
main().catch(()=>{console.log(JSON.stringify({schema_version:report.schema_version,complete:false,error:'repair_claim_probe_unavailable'}));process.exit(2);});
