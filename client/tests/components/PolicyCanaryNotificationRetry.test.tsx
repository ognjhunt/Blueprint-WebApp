import { act, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/csrf',()=>({withCsrfHeader:async()=>({})}));
vi.mock('@/lib/firebaseAuthHeaders',()=>({withFirebaseAuthHeaders:async()=>({})}));
import { PolicyCanaryNotificationRetry } from '@/components/blueprint/app/PolicyCanaryNotificationRetry';
const result:any={record_id:'result',publication:{run_id:'run',policy_canary_result:{projection_digest:'sha256:'+'a'.repeat(64)}}};
const user:any={uid:'owner'};
function mount(){const client=new QueryClient();return render(<QueryClientProvider client={client}><PolicyCanaryNotificationRetry result={result} user={user}/></QueryClientProvider>);}
afterEach(()=>vi.unstubAllGlobals());
describe('explicit notification retry controls',()=>{
 it('never sends on render and reuses the same idempotency key after a lost response',async()=>{
  const calls:any[]=[];const fetcher=vi.fn().mockImplementation(async(_url,options)=>{
   const body=JSON.parse(options.body);calls.push(body);
   if(calls.length===1)throw new TypeError('fixture response lost');
   return new Response(JSON.stringify({record_id:'result',request_id:body.request_id,run_result_digest:body.expected_result_digest,status:'accepted'}));
  });vi.stubGlobal('fetch',fetcher);mount();expect(fetcher).not.toHaveBeenCalled();
  await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Retry result email'})));
  expect(screen.getByText(/response was unavailable/)).toBeTruthy();
  await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Check email retry status'})));
  expect(calls).toHaveLength(2);expect(calls[0].request_id).toBe(calls[1].request_id);expect(calls[0].authorize_email_retry).toBe(true);
  expect(screen.getByText(/Inbox delivery is not yet confirmed/)).toBeTruthy();
 });
 it('stops at the server attempt cap without exposing its response body',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('private transport details',{status:429})));mount();
  await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Retry result email'})));
  expect(screen.getByText(/bounded email retry limit/)).toBeTruthy();expect(screen.getByRole('button')).toBeDisabled();expect(screen.queryByText('private transport details')).toBeNull();
 });
});
