/** Credential-free controller for diagnostic auth/withdrawal emulator proof. */
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const project='demo-blueprint-reliability-d';
const appRoot=process.env.RELIABILITY_AUTH_APP_ROOT ?? root;
if(!/^\/workspace\/reliability-(?:d|main|d-baseline)$/.test(appRoot))throw new Error('Owned app worktree required');
const output=process.env.RELIABILITY_AUTH_OUTPUT ?? '/workspace/reliability-program/D/durable/candidate';
if(!output.startsWith('/workspace/reliability-program/D/durable/'))throw new Error('Private D output required');
const env=Object.fromEntries(['PATH','HOME','TMPDIR'].filter(key=>process.env[key]).map(key=>[key,process.env[key]]));
Object.assign(env,{NODE_ENV:'test',LOG_LEVEL:'silent',CODEX_LOCAL_AVAILABLE:'0',BLUEPRINT_DISABLE_LOCAL_ENV_BOOTSTRAP:'1',GOOGLE_CLOUD_PROJECT:project,GCLOUD_PROJECT:project,
 FIRESTORE_EMULATOR_HOST:'127.0.0.1:8080',FIREBASE_STORAGE_EMULATOR_HOST:'127.0.0.1:9199',FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9099',FIREBASE_STORAGE_BUCKET:`${project}.appspot.com`,
 FIELD_ENCRYPTION_MASTER_KEY:Buffer.alloc(32,1).toString('base64'),BLUEPRINT_REQUEST_REVIEW_TOKEN_SECRET:'owned-local-reliability-fixture-secret-never-production',
 BLUEPRINT_SITE_VIDEO_EVIDENCE_ENABLED:'0',BLUEPRINT_DISABLE_OPS_AUTOMATION_SCHEDULER:'1',BLUEPRINT_BETA_ENABLED:'false',
 BLUEPRINT_TRANSACTIONAL_EMAIL_NOTIFICATIONS_ENABLED:'0',BLUEPRINT_TRANSACTIONAL_PUSH_NOTIFICATIONS_ENABLED:'0',
 RELIABILITY_AUTH_APP_ROOT:appRoot,RELIABILITY_AUTH_OUTPUT:output,RELIABILITY_AUTH_CASE_FILTER:process.env.RELIABILITY_AUTH_CASE_FILTER ?? '',
 RELIABILITY_AUTH_EXPECT_BASELINE_FAILURE:process.env.RELIABILITY_AUTH_EXPECT_BASELINE_FAILURE ?? ''});
const child=spawn(process.execPath,['--import','tsx',path.join(root,'scripts/qa/reliability-auth-durable.ts')],{cwd:root,env,stdio:'inherit'});
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>child.kill(signal));
child.once('exit',code=>process.exitCode=code ?? 1);
