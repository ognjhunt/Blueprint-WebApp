import {describe,expect,it,vi} from 'vitest';
import {execFileSync} from 'node:child_process';
const observation=vi.hoisted(()=>({fenceCalls:0,decodedSource:null as any}));
// Admission/Git decoding have their own real positive and refusal suite. These
// synthetic ledger tests isolate CAS and journal effects without private rows.
vi.mock('./communications-successor-admission-20261007.mjs',async original=>{
  const m:any=await original();return {...m,checkFence:(proof:any,_authority:any,now:number)=>{observation.fenceCalls++;if(now-proof.observedAtMs>300000)throw Error('evidence_not_fresh');}};
});
vi.mock('./communications-incident-20261006.mjs',async original=>{
  const m:any=await original();return {...m,readSource:async()=>structuredClone(observation.decodedSource)};
});
import {CONTROL,LAP,ROOT,QUERIES,STOPPED_SOURCE,sha,INCIDENT} from './communications-incident-20261006.mjs';
import {AUDIT,CLEANUP} from './communications-incident-recovery-20261006.mjs';
import {cleanupPhase} from './communications-successor-cleanup-20261007.mjs';
const NOW=1791358500000;
const saved=(path:string,value:any)=>({path,value,sha256:sha(value),updateTime:{seconds:1,nanoseconds:2}});
function fixture(){
  observation.fenceCalls=0;
  const oldLap={schema_version:'blueprint.communications-worker-lap.v1',phase:'active',lease:{owner:'communications-worker-lap:synthetic',generation:259,until:1791299565642},startedAt:1791299385642,renewedAt:1791299385642,completedAt:null};
  const audit={atMs:NOW-10000,originalLap:{value:oldLap}},lap={...oldLap,phase:'complete',lease:{...oldLap.lease,until:0},completedAt:audit.atMs,recoveryRef:AUDIT};
  const source={path:`${CONTROL}/runs/2026-10-06`,blobSha256:STOPPED_SOURCE,value:{date:'2026-10-06',state:'cancelled',turn_status:'cancelled',session_id:'sess_synthetic',environment_id:'env_synthetic',turn_id:'turn_synthetic',metadata:{synthetic:true},evidence_digest:'a'.repeat(64),cleanup_required:true}};
  observation.decodedSource=structuredClone(source);
  const docs=[saved(CONTROL,{lease:{owner:'settled-synthetic',generation:6698,expires_at_ms:0},unknownAccounting:'preserved'}),saved(`${ROOT}/draftBudgetState/current`,{})];
  const queries=QUERIES.map(([name])=>({name,complete:true,rows:name==='scanners'?[saved(LAP,lap)]:name==='research'?[saved(source.path,{blob:STOPPED_SOURCE,state:'cancelled'})]:[]}));
  const packet={schema:INCIDENT,project:'blueprint-8c1ca',observedAtMs:NOW,docs,queries,sources:[source]};
  const provider={schema:'blueprint.communications-incident-provider-20261006.v1',readOnly:true,observedAtMs:NOW,findall:[],sessions:[{sessionId:'sess_synthetic',complete:true,session:{id:'sess_synthetic',status:'idle',metadata:source.value.metadata,required_actions:[]},turns:[{id:'turn_synthetic',status:'cancelled'}],items:[],artifacts:[],environment:{id:'env_synthetic'}}]};
  const values=new Map<any,any>([...docs,...queries.flatMap(q=>q.rows),saved(AUDIT,audit)].map(r=>[r.path,structuredClone(r.value)]));
  const writes:any[]=[],snapshot=(path:string)=>({ref:{path},exists:values.has(path),data:()=>values.get(path),updateTime:{seconds:1,nanoseconds:2}});
  let retry=false,clock=NOW;
  const db:any={doc:(path:string)=>({path}),collection:(path:string)=>({path,where(){return this;},limit(cap:number){return {path,cap};}}),runTransaction:async(fn:any)=>{
    const attempt=async(commit:boolean)=>{const staged:any[]=[];const result=await fn({get:async(ref:any)=>ref.cap?{size:[...values.keys()].filter(k=>k.startsWith(ref.path+'/')&&!k.slice(ref.path.length+1).includes('/')).length,docs:[...values.keys()].filter(k=>k.startsWith(ref.path+'/')&&!k.slice(ref.path.length+1).includes('/')).map(snapshot)}:snapshot(ref.path),
      set:(ref:any,value:any,opts:any)=>staged.push({path:ref.path,value,merge:opts?.merge}),create:(ref:any,value:any)=>staged.push({path:ref.path,value})});
      if(commit){for(const w of staged){values.set(w.path,w.merge?{...values.get(w.path),...structuredClone(w.value)}:structuredClone(w.value));writes.push(structuredClone(w));}}return result;};
    if(retry){await attempt(false);clock=NOW+300001;}return attempt(true);}};
  const target={sourceBlobSha256:STOPPED_SOURCE,sessionId:'sess_synthetic',environmentId:'env_synthetic'};
  const authority:any={action:'archive_verify_delete_stopped_oct6',expectedLapSha256:sha(lap),expectedHistoricalAuditDigest:sha(audit),expectedSourceFailures:[],stoppedTargetDigest:sha(target),approvalReference:'synthetic-authorized-target',expectedReleaseCommit:'a'.repeat(40)};
  const proof={observedAtMs:NOW-1},readback={observedAtMs:NOW,targetDigest:sha(target),sourceBlobSha256:STOPPED_SOURCE,files:[{name:'synthetic.json',bytes:1,sha256:'a'.repeat(64)}]},archive={syntheticVerified:true};
  return {db,values,writes,packet,provider,proof,authority,readback,archive,now:()=>clock,setRetry:()=>{retry=true;}};
}
describe('supported successor cleanup journal CAS',()=>{
  it('claims once, treats lost ACK as observe-only, and releases only its exact own generation',async()=>{
    const f=fixture(),args=[f.packet,f.provider,f.proof,f.authority,f.archive,f.readback,f.now] as const;
    await cleanupPhase(f.db,'cleanup-archive',...args);
    expect(await cleanupPhase(f.db,'cleanup-submit',...args)).toMatchObject({submitDelete:true,state:'delete_claimed_once'});
    const claimed=f.values.get(CLEANUP),before=f.writes.length;
    expect(claimed.releaseFence.generation).toBe(6699);expect(claimed.releaseFence.owner).toMatch(/^research-release:successor-cleanup-oct6-/);
    expect(await cleanupPhase(f.db,'cleanup-submit',...args)).toMatchObject({submitDelete:false,state:'delete_already_claimed_observe_only'});expect(f.writes).toHaveLength(before);
    f.values.get(CONTROL).lease={...claimed.releaseFence,generation:6700,owner:'foreign-successor'};
    await expect(cleanupPhase(f.db,'release-cleanup-fence',...args)).rejects.toThrow('cleanup_fence_ownership_changed');expect(f.writes).toHaveLength(before);
    f.values.get(CONTROL).lease=claimed.releaseFence;await cleanupPhase(f.db,'release-cleanup-fence',...args);
    expect(f.values.get(CONTROL).lease.expires_at_ms).toBe(0);expect(f.values.get(CONTROL).unknownAccounting).toBe('preserved');
    const after=f.writes.length;f.values.get(CONTROL).lease={owner:'ordinary-successor',generation:6700,expires_at_ms:NOW+1000};
    await cleanupPhase(f.db,'release-cleanup-fence',...args);expect(f.writes).toHaveLength(after);expect(f.values.get(CONTROL).lease.owner).toBe('ordinary-successor');
  });
  it.each(['audit','lap','source','foreign lease','archive','approval','active provider'])('refuses changed %s before further writes',async kind=>{
    const f=fixture(),args=[f.packet,f.provider,f.proof,f.authority,f.archive,f.readback,f.now] as const;
    await cleanupPhase(f.db,'cleanup-archive',...args);const before=f.writes.length;
    if(kind==='audit')f.values.get(AUDIT).atMs++;
    if(kind==='lap')f.values.get(LAP).lease.generation=260;
    if(kind==='source')observation.decodedSource.value.metadata={changed:true};
    if(kind==='foreign lease')f.values.get(CONTROL).lease={owner:'foreign',generation:6701,expires_at_ms:NOW+1000};
    if(kind==='archive')f.archive.syntheticVerified=false;
    if(kind==='approval')f.authority.approvalReference='foreign';
    if(kind==='active provider')f.provider.sessions[0].turns[0].status='in_progress';
    await expect(cleanupPhase(f.db,'cleanup-submit',...args)).rejects.toThrow();expect(f.writes).toHaveLength(before);
  });
  it('rechecks native proof freshness on transaction retry and commits no stale claim',async()=>{
    const f=fixture();f.setRetry();await expect(cleanupPhase(f.db,'cleanup-archive',f.packet,f.provider,f.proof,f.authority,f.archive,f.readback,f.now)).rejects.toThrow('evidence_not_fresh');
    expect(observation.fenceCalls).toBe(3);expect(f.writes).toHaveLength(0);expect(f.values.has(CLEANUP)).toBe(false);
  });
  it('adopts the real Python adapter with UTF-8 source binding and unchanged provider implementation',()=>{
    const script=String.raw`
import copy,hashlib,importlib.util,json,pathlib
p=pathlib.Path('scripts/communications-successor-cleanup-20261007.py')
s=importlib.util.spec_from_file_location('successor',p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
row={'date':'2026-10-06','state':'cancelled','turn_status':'cancelled','evidence_digest':'a'*64,'description':'synthetic unicode \u2014 description','metadata':{},'session_id':'sess_synthetic','environment_id':'env_synthetic'}
raw=json.dumps(row,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False)
m.historical.SOURCE=hashlib.sha256(raw.encode()).hexdigest()
class Bridge:
 def __init__(self,snapshot):self.snapshot=snapshot;self.calls=[]
 def call(self,op,**kwargs):assert op=='snapshot' and kwargs=={'day':'2026-10-06'};self.calls.append(op);return self.snapshot
for snapshot in [{'row':row},{'row':row,'source_row_json':raw}]:
 b=Bridge(snapshot);assert m.source(b)==(row,raw.encode());assert b.calls==['snapshot']
bad=[{'row':{**row,'description':'changed'},'source_row_json':raw},{'row':row,'source_row_json':None},{'row':row,'source_row_json':json.dumps(row,sort_keys=True,separators=(',',':'))},{'row':row,'source_row_json':'{'},{'row':{**row,'state':'running'}}]
for snapshot in bad:
 try:m.source(Bridge(snapshot));raise AssertionError('accepted unsupported source')
 except (ValueError,TypeError):pass
assert m.historical.source is m.source and m.historical.operator is m.operator
assert m.historical.main.__code__.co_filename.endswith('communications-incident-cleanup-20261006.py')
try:m.operator('recover',pathlib.Path('/tmp/synthetic'));raise AssertionError('recovery allowed')
except ValueError as e:assert str(e)=='successor_cleanup_mode_invalid'
print(json.dumps({'ok':True,'providerCalls':0,'databaseWrites':0,'negativeCases':len(bad)}))
`;
    const result=JSON.parse(execFileSync('python3',['-c',script],{env:{PATH:process.env.PATH!,PYTHONDONTWRITEBYTECODE:'1'}}).toString());
    expect(result).toMatchObject({ok:true,providerCalls:0,databaseWrites:0});
  });
  it('runs the adopted wrapper through unknown DELETE acknowledgement and suppresses replay',()=>{
    const script=String.raw`
import contextlib,hashlib,importlib.util,io,json,pathlib,sys,tempfile,types
s=importlib.util.spec_from_file_location('successor',pathlib.Path('scripts/communications-successor-cleanup-20261007.py'));m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
row={'date':'2026-10-06','state':'cancelled','turn_status':'cancelled','turn_id':'turn_synthetic','evidence_digest':'a'*64,'metadata':{},'session_id':'sess_synthetic','environment_id':'env_synthetic'}
raw=json.dumps(row,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False);m.historical.SOURCE=hashlib.sha256(raw.encode()).hexdigest()
class Bridge:
 def call(self,op,**kw):assert op=='snapshot';return {'row':row}
 def close(self):pass
class Provider:
 def __init__(self,*args,**kw):assert kw=={'read_only':True};self.client=types.SimpleNamespace(close=lambda:None)
 def get(self,kind,id):return {'id':id,'status':'idle','metadata':{},'required_actions':[]}
 def listing(self,kind,id):return [{'id':'turn_synthetic','status':'cancelled'}] if kind=='turns' else []
 def delete_session(self,id,day,digest):
  self.client.http.hook(types.SimpleNamespace(method='DELETE',url='https://api.openai.com/v1/agents/sessions/'+id))
  effects['deletes']+=1;raise TimeoutError('synthetic unknown acknowledgement')
effects={'deletes':0,'claims':0}
class Http:
 def __init__(self,**kw):assert kw['follow_redirects'] is False;self.hook=kw['event_hooks']['request'][0]
class Client:
 def __init__(self,**kw):assert kw['max_retries']==0;self.http=kw['http_client'];self.beta=types.SimpleNamespace(agents=object())
 def close(self):pass
fake_store=types.ModuleType('tools.daily_research.firestore');fake_store.Bridge=Bridge;sys.modules['tools.daily_research.firestore']=fake_store
fake_runner=types.ModuleType('tools.daily_research.runner');fake_runner.Provider=Provider;fake_runner.PROJECT='synthetic';sys.modules['tools.daily_research.runner']=fake_runner
fake_openai=types.ModuleType('openai');fake_openai.OpenAI=Client;fake_openai.DefaultHttpxClient=Http;sys.modules['openai']=fake_openai
def command(argv,**kw):
 assert argv[:3]==['node','--import','tsx'] and argv[3].endswith('/communications-successor-cleanup-20261007.mjs') and argv[4]=='cleanup-submit'
 effects['claims']+=1;return types.SimpleNamespace(returncode=0,stdout=json.dumps({'ok':True,'submitDelete':effects['claims']==1,'state':'synthetic_claim'}))
m.subprocess.run=command
with tempfile.TemporaryDirectory() as tmp:
 p=pathlib.Path(tmp);(p/'cleanup-readback.json').write_text(json.dumps({'inventory':m.historical.terminal_inventory(Provider(read_only=True),row)}))
 for expected in ['delete_ack_unknown_observe_only','delete_already_claimed_observe_only']:
  sys.argv=['cleanup','delete','--directory',tmp];out=io.StringIO()
  with contextlib.redirect_stdout(out):m.historical.main()
  result=json.loads(out.getvalue());assert result['state']==expected and result['resubmitDelete'] is False
assert effects=={'deletes':1,'claims':2}
print(json.dumps({'ok':True,'syntheticDeletes':effects['deletes'],'realProviderCalls':0,'realDatabaseWrites':0}))
`;
    const result=JSON.parse(execFileSync('python3',['-c',script],{env:{PATH:process.env.PATH!,PYTHONDONTWRITEBYTECODE:'1',OPENAI_API_KEY:'synthetic-key'}}).toString());
    expect(result).toMatchObject({ok:true,syntheticDeletes:1,realProviderCalls:0,realDatabaseWrites:0});
  });
});
