const fs=require('node:fs'),crypto=require('node:crypto'),cp=require('node:child_process');
const req=require('node:module').createRequire(process.cwd()+'/package.json');
const report={schema_version:'blueprint.installed-research.v1',observed_at:new Date().toISOString(),errors:[]};
const root='dist/daily-research/release',pin='acb3657b2772588d7162d6b2631b63e41acadaba',archivePin='05ed6d182be79e32e2969c315eb9d6738b188c8c4c5aa904cc92bbe76b32711b';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
try{
  report.git_sha=cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',timeout:10000,stdio:['ignore','pipe','ignore']}).trim();
  const receipt=JSON.parse(fs.readFileSync('vendor/daily-research/receipt.json','utf8'));
  const installedManifest=fs.readFileSync(root+'/manifest.json');
  report.archive_sha256=sha(fs.readFileSync('vendor/daily-research/blueprint-research.tar'));
  if(report.archive_sha256!==archivePin)throw Error();
  const pinnedManifest=cp.execFileSync('tar',['-xOf','vendor/daily-research/blueprint-research.tar','manifest.json'],{timeout:10000,maxBuffer:1048576,stdio:['ignore','pipe','ignore']});
  const manifest=JSON.parse(pinnedManifest.toString('utf8'));
  report.source_commit=manifest.source_commit;report.manifest_verified=sha(installedManifest)===sha(pinnedManifest);
  report.archive_verified=receipt.sha256===archivePin&&receipt.source_commit===pin&&manifest.source_commit===pin;
  const files=Object.entries(manifest.files);report.packaged_file_count=files.length;
  report.packaged_files_verified=files.length===46&&files.every(([f,d])=>f.startsWith('tools/daily_research/')&&!f.split('/').includes('..')&&sha(fs.readFileSync(root+'/'+f))===d);
  report.python_sdk=JSON.parse(cp.execFileSync('dist/daily-research/venv/bin/python',['-I','-B','-c','import json,sys,importlib.metadata;print(json.dumps({"python":".".join(map(str,sys.version_info[:3])),"openai":importlib.metadata.version("openai")}))'],{encoding:'utf8',timeout:10000,stdio:['ignore','pipe','ignore']}));
}catch{report.errors.push('installed_package_unverified');}
try{
  const pids=fs.readdirSync('/proc').filter(p=>/^\d+$/.test(p));if(pids.length>4096)throw Error();
  let clocks=0,bridges=0,unreadable=0;
  for(const pid of pids){let args;try{args=fs.readFileSync(`/proc/${pid}/cmdline`,'utf8').split('\0');}catch{try{if(fs.existsSync(`/proc/${pid}`))unreadable++;}catch{}continue;}
    if(args.includes('tools.daily_research.render')&&args.includes('scheduler'))clocks++;
    if(args.some(a=>/(^|\/)firestore_bridge\.mjs$/.test(a)))bridges++;
  }
  report.research_processes={scheduler_count:clocks,private_bridge_count:bridges,unreadable_count:unreadable};
}catch{report.errors.push('research_process_inventory_unavailable');}
async function main(){let db,app;
  try{
    const account=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON||'null');if(account?.project_id!=='blueprint-8c1ca')throw Error();
    const {initializeApp,cert}=req('firebase-admin/app');app=initializeApp({credential:cert(account),projectId:'blueprint-8c1ca'},'research-installed-read-only');
    db=req('firebase-admin/firestore').initializeFirestore(app,{preferRest:true});
    const snap=await db.doc('blueprintDailyResearch/sites-first').get();const d=snap.data();
    report.control_state=!snap.exists?'absent':d.enabled===false?'disabled':d.enabled===true?'enabled':'invalid';
  }catch{report.errors.push('research_control_read_unavailable');}
  try{if(db)await db.terminate();if(app)await req('firebase-admin/app').deleteApp(app);}catch{report.errors.push('read_client_close_unavailable');}
  report.complete=report.errors.length===0&&/^[a-f0-9]{40}$/.test(process.argv[2]||'')&&report.git_sha===process.argv[2]&&report.archive_verified&&report.manifest_verified&&report.packaged_files_verified&&report.python_sdk?.openai==='3.22.1'&&['absent','disabled'].includes(report.control_state)&&report.research_processes?.scheduler_count===0&&report.research_processes?.private_bridge_count===0&&report.research_processes?.unreadable_count===0;
  console.log(JSON.stringify(report));process.exit(report.complete?0:2);
}
main().catch(()=>{console.log(JSON.stringify({schema_version:report.schema_version,error:'installed_probe_unavailable',complete:false}));process.exit(2);});
