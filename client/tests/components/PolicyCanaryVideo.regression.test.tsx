import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {PrimaryDownload} from "@/components/blueprint/app/PolicyCanaryPrimarySummary";
import {EvidenceVideo} from '@/components/blueprint/app/PolicyCanaryEpisodeExplorer';
const ticket=vi.hoisted(()=>vi.fn());
vi.mock('@/lib/taskEvaluationResults',async original=>({...await original<typeof import('@/lib/taskEvaluationResults')>(),createTaskEvaluationResultArtifactTicket:ticket}));
const props:any={artifact:{artifact_id:'fixture-video',size_bytes:100},camera:'external',policy:'A',user:{uid:'owner-a'},recordId:'run-a',selectedTimeSeconds:null,timebaseOffsetSeconds:null};
beforeEach(()=>{ticket.mockReset();vi.useFakeTimers();});
afterEach(()=>{cleanup();vi.useRealTimers();});
const flush=async(ms=0)=>{await act(async()=>{await vi.advanceTimersByTimeAsync(ms);});};
describe('media lifecycle isolation',()=>{
 it('does not display a late ticket after owner or run change',async()=>{
  let finish!:(url:string)=>void; ticket.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
  const view=render(<EvidenceVideo {...props}/>);
  fireEvent.click(screen.getByRole('button',{name:'Load External camera video for A'}));
  view.rerender(<EvidenceVideo {...props} user={{uid:'owner-b'}} recordId='run-b'/>);
  await act(async()=>finish('/api/local-expiring-media'));
  expect(screen.queryByLabelText('External camera evidence for A')).toBeNull();
  expect(screen.getByText('Not loaded')).toBeTruthy();
 });
 it('bounds stalled metadata loading and offers an explicit fresh authorization',async()=>{
  ticket.mockResolvedValue('/api/slow-fixture');
  render(<EvidenceVideo {...props}/>);fireEvent.click(screen.getByRole('button',{name:'Load External camera video for A'}));await flush();
  expect(screen.queryByText('Ready')).toBeNull();await flush(30000);
  expect(screen.getByText(/Media loading timed out/)).toBeTruthy();
  expect(screen.getByRole('button',{name:'Retry External camera video for A'})).toBeTruthy();
  await flush(120000);expect(ticket).toHaveBeenCalledTimes(1);
 });
 it('does not start an old-owner attachment download after logout',async()=>{
  let finish!:(url:string)=>void; ticket.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
  const click=vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>undefined);
  const view=render(<PrimaryDownload artifact={props.artifact} label="Manifest" user={props.user} recordId="run-a"/>);
  fireEvent.click(screen.getByRole('button',{name:'Manifest'}));
  view.rerender(<PrimaryDownload artifact={props.artifact} label="Manifest" user={null} recordId="run-a"/>);
  await act(async()=>finish('/api/local-old-owner'));
  expect(click).not.toHaveBeenCalled();click.mockRestore();
 });

});
