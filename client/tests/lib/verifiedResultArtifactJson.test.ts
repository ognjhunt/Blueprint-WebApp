// @vitest-environment node
import { createHash, webcrypto } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
const ticket=vi.hoisted(()=>vi.fn());
vi.mock('@/lib/taskEvaluationResults',()=>({createTaskEvaluationResultArtifactTicket:ticket}));
import { fetchVerifiedResultArtifactJson, readVerifiedResultArtifactJson } from '@/lib/verifiedResultArtifactJson';
import { boundedResultArtifactRequest, resultRetryAfterSeconds } from '@/lib/resultArtifactRequest';
const descriptor=(bytes:Uint8Array)=>({artifact_id:'score',digest:'sha256:'+createHash('sha256').update(bytes).digest('hex'),size_bytes:bytes.length});
const bytes=Buffer.from('{"task_succeeded":false,"status":"scored"}');
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();ticket.mockReset();});

describe('bounded verified score receipts',()=>{
 it('verifies compact descriptor bytes before parsing the score',async()=>{
  vi.stubGlobal('crypto',webcrypto);
  expect(await readVerifiedResultArtifactJson(new Response(bytes),descriptor(bytes))).toEqual({task_succeeded:false,status:'scored'});
 });
 it('refuses an invalid or oversized descriptor before authorizing a request',()=>{
  expect(()=>fetchVerifiedResultArtifactJson(null,'run',{artifact_id:'score',sha256:'invalid',size_bytes:20})).toThrow(/metadata/);
  expect(()=>fetchVerifiedResultArtifactJson(null,'run',{...descriptor(bytes),size_bytes:256001})).toThrow(/metadata/);
  expect(()=>fetchVerifiedResultArtifactJson(null,'run',{...descriptor(bytes),sha256:'sha256:'+'0'.repeat(64)})).toThrow(/metadata/);
  expect(ticket).not.toHaveBeenCalled();
 });
 it('stops at the byte limit without reading or buffering the rest of a stream',async()=>{
  const cancel=vi.fn();let pull=0;
  const body=new ReadableStream({pull(c){pull++;c.enqueue(new Uint8Array(200));},cancel});
  await expect(readVerifiedResultArtifactJson(new Response(body),{...descriptor(bytes),size_bytes:100})).rejects.toThrow(/declared size/);
  expect(cancel).toHaveBeenCalledOnce();expect(pull).toBeLessThanOrEqual(2);
 });
 it('refuses a truncated stream, a wrong hash, wrong response size, and a partial response',async()=>{
  vi.stubGlobal('crypto',webcrypto);
  await expect(readVerifiedResultArtifactJson(new Response(bytes.subarray(0,-1)),descriptor(bytes))).rejects.toThrow(/truncated/);
  await expect(readVerifiedResultArtifactJson(new Response(bytes),{...descriptor(bytes),digest:'sha256:'+'0'.repeat(64)})).rejects.toThrow(/digest/);
  await expect(readVerifiedResultArtifactJson(new Response(bytes,{headers:{'content-length':'999'}}),descriptor(bytes))).rejects.toThrow(/does not match/);
  await expect(readVerifiedResultArtifactJson(new Response(bytes,{status:206}),descriptor(bytes))).rejects.toThrow(/does not match/);
 });
 it('cancels a pending read on owner change/unmount',async()=>{
  const cancel=vi.fn();const controller=new AbortController();
  const body=new ReadableStream({cancel});
  const result=readVerifiedResultArtifactJson(new Response(body),descriptor(bytes),controller.signal);
  controller.abort();await expect(result).rejects.toThrow();expect(cancel).toHaveBeenCalledOnce();
 });
 it('bounds hanging authorization work without allowing a late operation to issue a request',async()=>{
  vi.useFakeTimers();let aborted=false;
  const result=boundedResultArtifactRequest(signal=>new Promise((_resolve,reject)=>{signal.addEventListener('abort',()=>{aborted=true;reject(signal.reason);});}),undefined,50);
  const expectation=expect(result).rejects.toMatchObject({name:'TimeoutError'});
  await vi.advanceTimersByTimeAsync(50);await expectation;expect(aborted).toBe(true);
 });
 it('understands numeric and HTTP-date retry windows',()=>{
  expect(resultRetryAfterSeconds('42',0)).toBe(42);
  expect(resultRetryAfterSeconds('Thu, 01 Jan 1970 00:01:00 GMT',0)).toBe(60);
  expect(resultRetryAfterSeconds('not-a-date',0)).toBeNull();
 });
});
