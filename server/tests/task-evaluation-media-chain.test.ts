// @vitest-environment node
import express from 'express';
import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createHash, createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import publicationFixture from './fixtures/pipeline-policy-canary-publication.v4.json';
import artifacts from './fixtures/native-result-media/artifacts.json';
import nativeManifest from './fixtures/native-result-media/manifest.json';
import { canonicalArtifactDigest } from '../utils/taskCandidateContract';
import { encodeTaskEvaluationRunPublication } from '../utils/taskEvaluationRunPublicationStorage';

const state=vi.hoisted(()=>({records:new Map<string,Record<string,any>>() }));
vi.mock('../../client/src/lib/firebaseAdmin', () => ({
 dbAdmin: {
  collection: (name: string) => ({
   doc: (id: string) => ({
    get: async () => ({
     exists: state.records.has(`${name}:${id}`),
     data: () => state.records.get(`${name}:${id}`),
    }),
   }),
  }),
 },
}));
import results from '../routes/task-evaluation-results';
import downloads from '../routes/task-evaluation-result-downloads';
const sha=(bytes:Uint8Array)=>'sha256:'+createHash('sha256').update(bytes).digest('hex');
const fixtureRoot=new URL('./fixtures/native-result-media/',import.meta.url);
const metadata=new Map(artifacts.map(artifact=>[artifact.artifact_id,artifact]));

async function listen(app:express.Express) {
 const server=createServer(app);await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const address=server.address();if(!address||typeof address==='string')throw new Error('fixture address');
 return {server,url:`http://127.0.0.1:${address.port}`};
}

describe('real Website routes through a controlled artifact origin',()=>{
 let servers:Server[]=[];let url:string;
 const missing=new Set<string>();const corrupt=new Set<string>();const offloaded=new Set<string>();
 const objectStore=new Map<string,Buffer>();const requests:Array<{id:string;range:string|null;signed:boolean}>=[];
 beforeEach(async()=>{
  servers=[];missing.clear();corrupt.clear();offloaded.clear();objectStore.clear();requests.length=0;state.records.clear();
  vi.stubEnv('ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN','fixture-chain-key');
  vi.stubEnv('TASK_EVALUATION_RESULT_DOWNLOAD_SIGNING_SECRET','fixture-ticket-key');
  const origin=express();
  origin.get('/runs/:runId/artifacts/:artifactId',async(req,res)=>{
   const id=req.params.artifactId;
   const signature='sha256='+createHmac('sha256','fixture-chain-key').update(`${req.header('x-blueprint-pipeline-timestamp')}.${req.header('x-blueprint-pipeline-client-id')}.${req.header('x-blueprint-pipeline-nonce')}.`).digest('hex');
   const signed=req.header('x-blueprint-pipeline-signature')===signature;
   requests.push({id,range:req.header('range')||null,signed});
   if(!signed)return void res.status(401).end();
   const descriptor=metadata.get(id);
   if(req.params.runId!=='scene-839873-canary-1'||!descriptor||missing.has(id))return void res.status(404).end();
   let bytes=offloaded.has(id)?objectStore.get(id):await readFile(new URL(descriptor.relative_path,fixtureRoot));
   if(!bytes)return void res.status(404).end();
   if(corrupt.has(id)){bytes=Buffer.from(bytes);bytes[0]^=1;}
   const range=req.header('range');const match=range&&/^bytes=(\d+)-(\d*)$/.exec(range);
   const start=match?Number(match[1]):0;const end=match&&match[2]?Math.min(Number(match[2]),bytes.length-1):bytes.length-1;
   res.set('content-type',descriptor.content_type).set('x-blueprint-artifact-sha256',descriptor.sha256).set('accept-ranges','bytes');
   if(match)res.status(206).set('content-range',`bytes ${start}-${end}/${bytes.length}`);
   res.set('content-length',String(end-start+1)).end(bytes.subarray(start,end+1));
  });
  const originServer=await listen(origin);servers.push(originServer.server);
  vi.stubEnv('TASK_EVALUATION_RESULT_ARTIFACT_URL_TEMPLATE',`${originServer.url}/runs/{run_id}/artifacts/{artifact_id}`);
  const publication:any=structuredClone(publicationFixture);publication.result_delivery.artifacts=artifacts;
  publication.result_delivery.delivery_digest=canonicalArtifactDigest(publication.result_delivery,'delivery_digest');
  publication.policy_canary_result.result_delivery_digest=publication.result_delivery.delivery_digest;
  publication.policy_canary_result.projection_digest=canonicalArtifactDigest(publication.policy_canary_result,'projection_digest');
  state.records.set('captureTaskEvaluationRuns:result',{record_id:'result',owner_user_id:'owner',organization_id:'team',access_visibility:'owner_only',publication_storage:encodeTaskEvaluationRunPublication(publication)});
  const app=express();app.use(express.json());app.use((req,res,next)=>{if(req.header('x-fixture-user'))res.locals.firebaseUser={uid:req.header('x-fixture-user'),tenantId:'team'};next();});
  app.use('/api/task-evaluation-results',results);app.use('/api/task-evaluation-result-downloads',downloads);
  const website=await listen(app);servers.push(website.server);url=website.url;
 });
 afterEach(async()=>{for(const server of servers.reverse()){server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}vi.unstubAllEnvs();});
 const ticket=async(id:string,user='owner')=>fetch(`${url}/api/task-evaluation-results/result/artifacts/${id}/ticket`,{method:'POST',headers:{'content-type':'application/json','x-fixture-user':user},body:'{}'});
 const getArtifact=async(id:string)=>{const receipt=await ticket(id);expect(receipt.status).toBe(201);const value=await receipt.json() as {download_url:string};return fetch(`${url}${value.download_url}`);};

 it('delivers a native-validated manifest and all four exact PNGs through real auth, tickets, and streaming',async()=>{
  const response=await fetch(`${url}/api/task-evaluation-results/result`,{headers:{'x-fixture-user':'owner'}});expect(response.status).toBe(200);
  const manifestResponse=await getArtifact('frame-manifest');const manifestBytes=new Uint8Array(await manifestResponse.arrayBuffer());
  expect(sha(manifestBytes)).toBe(metadata.get('frame-manifest')!.sha256);expect(JSON.parse(Buffer.from(manifestBytes).toString())).toEqual(nativeManifest);
  for(const artifact of artifacts.filter(row=>row.content_type==='image/png')){
   const frame=await getArtifact(artifact.artifact_id);const bytes=new Uint8Array(await frame.arrayBuffer());
   expect(sha(bytes)).toBe(artifact.sha256);expect(bytes.length).toBe(artifact.size_bytes);expect([...bytes.subarray(0,8)]).toEqual([137,80,78,71,13,10,26,10]);
  }
  expect(requests.every(request=>request.signed)).toBe(true);
 });
 it('does not infer frame availability from a valid manifest',async()=>{
  missing.add('frame-0-wrist');expect((await getArtifact('frame-manifest')).status).toBe(200);
  const response=await ticket('frame-0-wrist');expect(response.status).toBe(404);
 });
 it('reads an offloaded object through the same registry binding and recovers when its backing bytes return',async()=>{
  offloaded.add('frame-0-external');expect((await ticket('frame-0-external')).status).toBe(404);
  const descriptor=metadata.get('frame-0-external')!;objectStore.set(descriptor.artifact_id,await readFile(new URL(descriptor.relative_path,fixtureRoot)));
  const response=await getArtifact(descriptor.artifact_id);expect(sha(new Uint8Array(await response.arrayBuffer()))).toBe(descriptor.sha256);
 });
 it('refuses another owner before touching the artifact origin',async()=>{
  expect((await ticket('frame-manifest','other')).status).toBe(404);expect(requests).toHaveLength(0);
 });
 it('does not complete a corrupted object even when its origin repeats the expected digest header',async()=>{
  corrupt.add('frame-0-external');
  await expect((async()=>{const response=await getArtifact('frame-0-external');return response.arrayBuffer();})()).rejects.toThrow();
 });
});
