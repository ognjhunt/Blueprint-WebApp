import { act, cleanup, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const auth=vi.hoisted(()=>({user:{uid:'owner',tenantId:'team-a'} as {uid:string;tenantId:string}|null}));
vi.mock('@/contexts/AuthContext',()=>({useAuth:()=>({currentUser:auth.user,loading:false})}));
vi.mock('@/lib/firebaseAuthHeaders',()=>({withFirebaseAuthHeaders:async()=>({})}));
import { TaskEvaluationResultReadError, taskEvaluationResultRetry, useTaskEvaluationResult } from '@/lib/taskEvaluationResults';
const record=(status?:string)=>({record_id:'result',access_visibility:'owner_only',publication:{run_id:'run'},...(status?{website_delivery:{notification:{status}}}:{})});
let client:QueryClient;
const wrapper=({children}:{children:ReactNode})=><QueryClientProvider client={client}>{children}</QueryClientProvider>;
const tick=async(ms=1)=>{await act(async()=>{await vi.advanceTimersByTimeAsync(ms);});};
beforeEach(()=>{vi.useFakeTimers();auth.user={uid:'owner',tenantId:'team-a'};client=new QueryClient({defaultOptions:{queries:{gcTime:0}}});});
afterEach(()=>{cleanup();client.clear();vi.useRealTimers();vi.unstubAllGlobals();});
describe('sealed result read recovery',()=>{
 it('does not retry permission refusals or record binding errors',()=>{
  for(const code of [401,403,404,409])expect(taskEvaluationResultRetry(0,new TaskEvaluationResultReadError(code))).toBe(false);
  expect(taskEvaluationResultRetry(0,new TaskEvaluationResultReadError(503))).toBe(true);
  expect(taskEvaluationResultRetry(3,new Error('network'))).toBe(false);
 });
 it('clears a cached private result on permission refusal',async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(record()))).mockResolvedValue(new Response('',{status:401}));vi.stubGlobal('fetch',fetcher);
  const view=renderHook(()=>useTaskEvaluationResult('result'),{wrapper});await tick(20);
  expect(view.result.current.result?.record_id).toBe('result');
  act(()=>{void client.invalidateQueries({queryKey:['task-evaluation-result']});});await tick(20);
  expect(view.result.current.result).toBeNull();expect(view.result.current.error).toBeInstanceOf(TaskEvaluationResultReadError);
  await tick(120000);expect(fetcher).toHaveBeenCalledTimes(2);
 });
 it('retains the last result after bounded transient retries are exhausted',async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(record()))).mockImplementation(async()=>new Response('',{status:503}));vi.stubGlobal('fetch',fetcher);
  const view=renderHook(()=>useTaskEvaluationResult('result'),{wrapper});await tick(20);
  act(()=>{void client.invalidateQueries({queryKey:['task-evaluation-result']});});await tick(8000);
  expect(view.result.current.result?.record_id).toBe('result');expect(view.result.current.error).toBeTruthy();
  const calls=fetcher.mock.calls.length;await tick(120000);expect(fetcher).toHaveBeenCalledTimes(calls);
 });
 it('cancels an outstanding result read when tenant identity changes',async()=>{
  let finish!:(value:Response)=>void;let oldSignal!:AbortSignal;
  const fetcher=vi.fn().mockImplementationOnce((_url,options)=>{oldSignal=options.signal;return new Promise(resolve=>{finish=resolve;});}).mockResolvedValue(new Response('',{status:404}));vi.stubGlobal('fetch',fetcher);
  const view=renderHook(()=>useTaskEvaluationResult('result'),{wrapper});await tick(20);
  auth.user={uid:'owner',tenantId:'team-b'};view.rerender();await tick(20);
  expect(oldSignal.aborted).toBe(true);
  await act(async()=>finish(new Response(JSON.stringify(record()))));await tick(20);
  expect(view.result.current.result).toBeNull();expect(view.result.current.notFound).toBe(true);
 });
 it('polls a pending Website delivery receipt and stops when it is terminal',async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(record('accepted')))).mockResolvedValueOnce(new Response(JSON.stringify(record('delivered'))));vi.stubGlobal('fetch',fetcher);
  const view=renderHook(()=>useTaskEvaluationResult('result'),{wrapper});await tick(20);
  expect(view.result.current.result?.website_delivery?.notification?.status).toBe('accepted');await tick(30000);
  expect(view.result.current.result?.website_delivery?.notification?.status).toBe('delivered');await tick(120000);expect(fetcher).toHaveBeenCalledTimes(2);
 });
});

const pending = () => ({schema_version:'task_evaluation_result_pending.v1',record_id:'result',status:'publication_pending',run:{run_id:'run',run_kind:'internal_policy_canary',claim_ceiling:'diagnostic_policy_execution',state:'running',phase:'awaiting_operator_results',terminal:false,progress:{completed_episodes:4,total_episodes:20},error:null,href:'/app/evaluation-runs/run'}});
it('polls a registered pending run into its actual result without inventing a publication',async()=>{
 const fetcher=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(pending()),{status:202})).mockResolvedValueOnce(new Response(JSON.stringify(record())));vi.stubGlobal('fetch',fetcher);
 const view=renderHook(()=>useTaskEvaluationResult('result'),{wrapper});await tick(20);
 expect(view.result.current.result).toBeNull();expect(view.result.current.pending?.run.progress?.completed_episodes).toBe(4);expect(view.result.current.notFound).toBe(false);
 await tick(15000);expect(view.result.current.pending).toBeNull();expect(view.result.current.result?.publication.run_id).toBe('run');
 await tick(120000);expect(fetcher).toHaveBeenCalledTimes(2);
});
it('rejects a pending progress link that does not match its run',async()=>{
 const value=pending();value.run.href='https://example.invalid/leak';vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify(value),{status:202})));
 const view=renderHook(()=>useTaskEvaluationResult('result'),{wrapper});await tick(20);
 expect(view.result.current.pending).toBeNull();expect(view.result.current.error).toBeInstanceOf(TaskEvaluationResultReadError);
});
it('removes cached pending private progress after permission is refused',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(pending()),{status:202})).mockResolvedValue(new Response('',{status:404})));
 const view=renderHook(()=>useTaskEvaluationResult('result'),{wrapper});await tick(20);expect(view.result.current.pending).toBeTruthy();await tick(15000);
 expect(view.result.current.pending).toBeNull();expect(view.result.current.notFound).toBe(true);
});
