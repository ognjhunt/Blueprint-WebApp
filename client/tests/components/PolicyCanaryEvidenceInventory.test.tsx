import {act,fireEvent,render,screen} from '@testing-library/react';
import {beforeEach,describe,expect,it,vi} from 'vitest';
const load=vi.hoisted(()=>vi.fn());
vi.mock('@/lib/policyCanaryEvidenceManifest',async original=>({...await original<typeof import('@/lib/policyCanaryEvidenceManifest')>(),loadCanaryEvidenceManifest:load}));
vi.mock('@/lib/taskEvaluationResults',async original=>({...await original<typeof import('@/lib/taskEvaluationResults')>(),createTaskEvaluationResultArtifactTicket:vi.fn()}));
import {PolicyCanaryEvidenceInventory} from '@/components/blueprint/app/PolicyCanaryEvidenceInventory';
const sha=(c:string)=>'sha256:'+c.repeat(64);
const descriptor={artifact_id:'manifest',sha256:sha('a'),size_bytes:50,content_type:'application/json',role:'evidence_manifest',relative_path:'manifest.json'};
const result:any={record_id:'result',access_visibility:'owner_only',publication:{run_id:'run',policy_candidates:[],policy_canary_result:{report:{evidence_manifest:descriptor}},result_delivery:{delivery_digest:sha('b'),episodes:[],artifacts:[descriptor],inline_compaction:{omitted_artifact_count:200}}}};
beforeEach(()=>load.mockReset());
describe('full artifact inventory recovery',()=>{
 it('reports compaction, keeps inline evidence on failure, then exposes the full verified inventory in bounded pages',async()=>{
  const frames=Array.from({length:201},(_,i)=>({...descriptor,artifact_id:`frame-${i}`,role:'frame',size_bytes:30}));
  load.mockRejectedValueOnce(new Error('private failure')).mockResolvedValueOnce(frames);
  render(<PolicyCanaryEvidenceInventory result={result} user={null}/>);
  expect(screen.getByText(/omits 200 additional descriptors/)).toBeTruthy();
  await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Load full evidence manifest',hidden:true})));
  expect(screen.getByText(/Inline descriptors remain available/)).toBeTruthy();expect(screen.queryByText('private failure')).toBeNull();
  await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Retry full evidence manifest',hidden:true})));
  expect(screen.getByText(/Full manifest bytes and run binding verified/)).toBeTruthy();
  expect(screen.getByRole('button',{name:'Show next 100 artifacts',hidden:true})).toBeTruthy();
 });
 it('shows Website acceptance separately from a pending producer snapshot',()=>{
  const value=structuredClone(result);value.publication.policy_canary_result.notification_delivery={status:'pending'};
  value.website_delivery={status:'available',notification:{status:'accepted',attempts:1,accepted_at_iso:'2026-09-07T00:00:00Z',delivered_at_iso:null}};
  render(<PolicyCanaryEvidenceInventory result={value} user={null}/>);
  expect(screen.getByText(/Accepted by email transport; inbox delivery not confirmed/)).toBeTruthy();
  expect(screen.getByText('pending · publication-time snapshot')).toBeTruthy();
 });
});
