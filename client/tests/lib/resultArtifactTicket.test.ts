// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/contexts/AuthContext',()=>({useAuth:()=>({currentUser:null})}));
vi.mock('@/lib/csrf',()=>({withCsrfHeader:async(headers:Record<string,string>)=>headers}));
vi.mock('@/lib/firebaseAuthHeaders',()=>({withFirebaseAuthHeaders:async(_user:unknown,headers:Record<string,string>)=>headers}));
import { createTaskEvaluationResultArtifactTicket } from '@/lib/taskEvaluationResults';
afterEach(()=>vi.unstubAllGlobals());
describe('artifact ticket bindings',()=>{
 it('accepts only the exact same-origin record/artifact route',async()=>{
  for(const url of ['/api/task-evaluation-result-downloads/run/score?expires=1&signature=fixture','https://storage.example/private?secret=hidden','//storage.example/private','/api/task-evaluation-result-downloads/other/score?expires=1','/api/task-evaluation-result-downloads/run/other?expires=1']) {
   vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({download_url:url}),{status:201})));
   const result=createTaskEvaluationResultArtifactTicket(null,'run','score');
   if(url.startsWith('/api/task-evaluation-result-downloads/run/score?')) await expect(result).resolves.toBe(url);
   else await expect(result).rejects.toThrow('invalid download binding');
  }
 });
 it.each([401,403,404,429,503])('returns a bounded actionable HTTP %s error',async status=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('private origin error text',{status,headers:{'retry-after':'42'}})));
  await expect(createTaskEvaluationResultArtifactTicket(null,'run','score')).rejects.toMatchObject({status,retryAfterSeconds:42});
 });
 it('does not authorize after cancellation',async()=>{
  const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);const controller=new AbortController();controller.abort();
  await expect(createTaskEvaluationResultArtifactTicket(null,'run','score',{signal:controller.signal})).rejects.toThrow();expect(fetcher).not.toHaveBeenCalled();
 });
 it('refreshes once only for an explicit CSRF refusal',async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({error:'Invalid CSRF token'}),{status:403})).mockResolvedValueOnce(new Response(JSON.stringify({download_url:'/api/task-evaluation-result-downloads/run/score?fixture=ok'}),{status:201}));vi.stubGlobal('fetch',fetcher);
  await expect(createTaskEvaluationResultArtifactTicket(null,'run','score')).resolves.toContain('fixture=ok');expect(fetcher).toHaveBeenCalledTimes(2);
 });
 it('does not loop when refreshed CSRF is also refused',async()=>{
  const fetcher=vi.fn().mockImplementation(async()=>new Response(JSON.stringify({error:'Invalid CSRF token'}),{status:403}));vi.stubGlobal('fetch',fetcher);
  await expect(createTaskEvaluationResultArtifactTicket(null,'run','score')).rejects.toMatchObject({status:403});expect(fetcher).toHaveBeenCalledTimes(2);
 });

});
