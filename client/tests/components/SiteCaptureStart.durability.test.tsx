// @vitest-environment jsdom
/** Lifecycle contract with an explicit in-memory durability fake; native IDB proof is the browser runner. */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SiteCaptureStart } from '@/components/site/SiteCaptureStart';
import { siteCaptureDraftKey } from '@/lib/siteCaptureDraft';
const state = vi.hoisted(() => ({ user: null as any, rows: new Map<string, any>(), writes: vi.fn(), retireFailure: false }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: state.user, loading: false }) }));
vi.mock('@/lib/analytics', () => ({ analyticsEvents: { contactFormSubmit: vi.fn(), contactFormError: vi.fn() } }));
vi.mock('@/lib/csrf', () => ({ withCsrfHeader: async (h: any) => h }));
vi.mock('@/lib/siteCaptureDurability', () => ({
    readDurableSiteCaptureRecovery: async (key: string) => state.rows.get(key) ?? null,
    writeDurableSiteCaptureRecovery: async (key: string, value: any, replace = false) => { const old = state.rows.get(key); if (!replace && old && (old.retired || old.value?.requestId !== value.requestId || old.value?.retryToken !== value.retryToken))
        throw new Error('retired'); state.writes(key, value); state.rows.set(key, { value: JSON.parse(JSON.stringify(value)), retired: false }); },
    retireDurableSiteCaptureRecovery: async (key: string) => { if (state.retireFailure) throw new Error("isolated retirement failure"); state.rows.set(key, { value: null, retired: true }); },
    durableSiteCaptureRecoveryKeys: async () => [...state.rows.keys()],
}));
const fetchMock = vi.fn();
let hold = false;
let release: undefined | (() => Promise<void>);
let queued = 0;
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); state.rows.clear(); state.retireFailure = false; state.writes.mockClear(); state.user = { uid: 'old-owned-fixture', email: 'owned@example.invalid', getIdToken: async () => 'owned-fixture-token' }; hold = false; release = undefined; queued = 0; vi.stubGlobal('FormData', window.FormData); vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset().mockResolvedValue({ ok: true, status: 200, json: async () => ({ workspaceType: 'site_operator', features: [] }) }); vi.stubGlobal('navigator', { userAgent: 'fixture', locks: { request: async (key: string, action: () => unknown) => { if (hold && key === siteCaptureDraftKey('old-owned-fixture', 'default')) {
            hold = false;
            queued++;
            return new Promise((resolve, reject) => { release = async () => { try {
                resolve(await action());
            }
            catch (e) {
                reject(e);
            } }; });
        } return action(); } } }); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
async function ready() { await screen.findByRole('form', { name: 'Start a site capture' }); await act(async () => { }); }
it('queued autosave checks mounted account inside the lock before writing', async () => {
    const view = render(<SiteCaptureStart />);
    await ready();
    const key = siteCaptureDraftKey('old-owned-fixture', 'default');
    const before = localStorage.getItem(key);
    const writes = state.writes.mock.calls.filter(c => c[0] === key).length;
    hold = true;
    fireEvent.change(document.querySelector('#start-task')!, { target: { value: 'Late old-account edit' } });
    await vi.waitFor(() => expect(queued).toBe(1));
    state.user = null;
    view.rerender(<SiteCaptureStart />);
    await ready();
    await act(async () => { await release!(); });
    expect(localStorage.getItem(key)).toBe(before);
    expect(state.writes.mock.calls.filter(c => c[0] === key)).toHaveLength(writes);
    expect(document.querySelector('#start-task')).toHaveValue('');
});
it('queued freeze checks mounted account inside the lock before dispatch', async () => {
    const view = render(<SiteCaptureStart />);
    await ready();
    fireEvent.change(document.querySelector('#start-task')!, { target: { value: 'Owned original task' } });
    fireEvent.change(document.querySelector('#start-location')!, { target: { value: 'Austin TX' } });
    await act(async () => { });
    const key = siteCaptureDraftKey('old-owned-fixture', 'default');
    const before = localStorage.getItem(key);
    hold = true;
    fireEvent.submit(screen.getByRole('form'));
    await vi.waitFor(() => expect(queued).toBe(1));
    state.user = null;
    view.rerender(<SiteCaptureStart />);
    await ready();
    await act(async () => { await release!(); });
    expect(localStorage.getItem(key)).toBe(before);
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(0);
});

it('clear exposes pending state until commit then survives remount with fresh empty authority', async () => {
    const view = render(<SiteCaptureStart />); await ready();
    fireEvent.change(document.querySelector('#start-task')!, {target:{value:'Clear only after durable acknowledgement'}});
    await act(async()=>{});
    const key=siteCaptureDraftKey('old-owned-fixture','default'),before=localStorage.getItem(key);
    hold=true;fireEvent.click(screen.getByRole('button',{name:"Clear this browser's draft"}));
    await screen.findByRole('status',{name:''});
    expect(screen.getByText(/Clearing this browser's draft/)).toBeVisible();
    expect(screen.getByRole('button',{name:'Clearing…',exact:true})).toBeDisabled();
    expect(document.querySelector('#start-task')).toBeDisabled();
    expect(localStorage.getItem(key)).toBe(before);
    fireEvent.submit(screen.getByRole('form'));
    expect(fetchMock.mock.calls.filter(c=>c[1]?.method==='POST')).toHaveLength(0);
    await act(async()=>{await release!();});
    await screen.findByText(/This browser's draft has been cleared/);
    const cleared=JSON.parse(localStorage.getItem(key)!);
    expect(cleared.requestId).not.toBe(JSON.parse(before!).requestId);
    expect(cleared.pending).toBeNull();expect(cleared.draft.task).toBe('');
    expect(state.rows.get(key).value).toEqual(cleared);
    view.unmount();render(<SiteCaptureStart />);await ready();
    expect(document.querySelector('#start-task')).toHaveValue('');
    expect(JSON.parse(localStorage.getItem(key)!).requestId).toBe(cleared.requestId);
});
it('failed clear explicitly reports failure without presenting completion or erasing the draft', async () => {
    render(<SiteCaptureStart />);await ready();
    fireEvent.change(document.querySelector('#start-task')!,{target:{value:'Retain after failed retirement'}});await act(async()=>{});
    const key=siteCaptureDraftKey('old-owned-fixture','default'),before=localStorage.getItem(key);
    state.retireFailure=true;fireEvent.click(screen.getByRole('button',{name:"Clear this browser's draft"}));
    await screen.findByRole('alert');
    expect(screen.getByRole('alert')).toHaveTextContent('could not confirm');
    expect(screen.queryByText(/has been cleared/)).not.toBeInTheDocument();
    expect(document.querySelector('#start-task')).toHaveValue('Retain after failed retirement');
    expect(localStorage.getItem(key)).toBe(before);
    state.retireFailure=false;fireEvent.click(screen.getByRole('button',{name:"Clear this browser's draft"}));
    await screen.findByText(/This browser's draft has been cleared/);
    expect(screen.queryByText(/cannot safely save or coordinate recovery details/)).not.toBeInTheDocument();
});
it('completed-job clear also exposes pending state until device recovery is committed', async () => {
    fetchMock.mockImplementation(async (_url,init)=>({ok:true,status:200,json:async()=>init?.method==='POST'?{captureUrl:'/capture-upload/owned-clear-fixture'}:{workspaceType:'site_operator',features:[]}}));
    render(<SiteCaptureStart />);await ready();
    for(const [id,value] of [['start-task','A saved description'],['start-location','Austin, TX']])fireEvent.change(document.querySelector('#'+id)!,{target:{value}});
    fireEvent.submit(screen.getByRole('form'));await screen.findByRole('link',{name:'Review your job brief'});
    hold=true;fireEvent.click(screen.getByRole('button',{name:"Clear this browser's draft"}));
    await screen.findByText(/Clearing this browser's draft/);expect(screen.getByRole('button',{name:'Clearing…',exact:true})).toBeDisabled();
    await act(async()=>{await release!();});await screen.findByText(/This browser's draft has been cleared/);
    expect(document.querySelector('#start-task')).toHaveValue('');
});
it('unreadable recovery clear reports failure and acknowledged retry mounts a fresh empty form', async () => {
    const key=siteCaptureDraftKey('old-owned-fixture','default');localStorage.setItem(key,'invalid-owned-fixture');
    render(<SiteCaptureStart />);await screen.findByText(/could not safely check saved recovery details/);
    state.retireFailure=true;fireEvent.click(screen.getByRole('button',{name:"Clear this browser's draft"}));
    await screen.findByRole('alert');expect(screen.getByRole('alert')).toHaveTextContent('could not confirm');
    expect(localStorage.getItem(key)).toBe('invalid-owned-fixture');expect(screen.queryByRole('form')).not.toBeInTheDocument();
    state.retireFailure=false;hold=true;fireEvent.click(screen.getByRole('button',{name:"Clear this browser's draft"}));
    await screen.findByText(/Clearing this browser's draft/);expect(screen.getByRole('button',{name:'Clearing…',exact:true})).toBeDisabled();
    await act(async()=>{await release!();});await screen.findByText(/This browser's draft has been cleared/);
    expect(document.querySelector('#start-task')).toHaveValue('');
    const fresh=JSON.parse(localStorage.getItem(key)!);expect(state.rows.get(key).value).toEqual(fresh);expect(fresh.pending).toBeNull();
});
it('account switch cancels queued ordinary clear without clearing or acknowledging the new scope', async () => {
    const view=render(<SiteCaptureStart />);await ready();
    fireEvent.change(document.querySelector('#start-task')!,{target:{value:'Old account retained when its queued clear is canceled'}});await act(async()=>{});
    const oldKey=siteCaptureDraftKey('old-owned-fixture','default'),oldBefore=localStorage.getItem(oldKey);
    hold=true;fireEvent.click(screen.getByRole('button',{name:"Clear this browser's draft"}));await screen.findByText(/Clearing this browser's draft/);
    state.user=null;view.rerender(<SiteCaptureStart />);await ready();
    fireEvent.change(document.querySelector('#start-task')!,{target:{value:'New anonymous work must survive old completion'}});await act(async()=>{});
    const newKey=siteCaptureDraftKey(null,'default'),newBefore=localStorage.getItem(newKey);
    await act(async()=>{await release!();});
    expect(localStorage.getItem(oldKey)).toBe(oldBefore);expect(localStorage.getItem(newKey)).toBe(newBefore);
    expect(document.querySelector('#start-task')).toHaveValue('New anonymous work must survive old completion');
    expect(screen.queryByText(/has been cleared/)).not.toBeInTheDocument();
});
it('account switch cancels queued unreadable-recovery clear without overwriting new recovery', async () => {
    const oldKey=siteCaptureDraftKey('old-owned-fixture','default');localStorage.setItem(oldKey,'invalid-owned-account-recovery');
    const view=render(<SiteCaptureStart />);await screen.findByText(/could not safely check saved recovery details/);
    hold=true;fireEvent.click(screen.getByRole('button',{name:"Clear this browser's draft"}));await screen.findByText(/Clearing this browser's draft/);
    state.user=null;view.rerender(<SiteCaptureStart />);await ready();
    fireEvent.change(document.querySelector('#start-task')!,{target:{value:'Separate account owns these answers'}});await act(async()=>{});
    const newKey=siteCaptureDraftKey(null,'default'),newBefore=localStorage.getItem(newKey);
    await act(async()=>{await release!();});
    expect(localStorage.getItem(oldKey)).toBe('invalid-owned-account-recovery');expect(localStorage.getItem(newKey)).toBe(newBefore);
    expect(document.querySelector('#start-task')).toHaveValue('Separate account owns these answers');
    expect(screen.queryByText(/has been cleared/)).not.toBeInTheDocument();
});

it('FIFO queued unavailable clear stays canceled after account A to B to A', async () => {
    const oldUser=state.user,key=siteCaptureDraftKey('old-owned-fixture','default');localStorage.setItem(key,'invalid-owned-recovery-before-old-intent');
    const view=render(<SiteCaptureStart />);await screen.findByText(/could not safely check saved recovery details/);
    // Model the real same-key FIFO, rather than allowing returning-A hydration
    // or editing to jump the clear queue. No new A work is claimed erased.
    const queues=new Map<string,Promise<unknown>>();
    vi.stubGlobal('navigator',{userAgent:'fixture',locks:{request:(scope:string,action:()=>unknown)=>{
      const request=(queues.get(scope)??Promise.resolve()).then(action);queues.set(scope,request.catch(()=>{}));return request;
    }}});
    let unlock!:()=>void;
    const blocker=navigator.locks.request(key,()=>new Promise<void>(resolve=>{unlock=resolve;}));
    await vi.waitFor(()=>expect(unlock).toBeDefined());
    fireEvent.click(screen.getByRole('button',{name:"Clear this browser's draft"}));await screen.findByText(/Clearing this browser's draft/);
    state.user=null;view.rerender(<SiteCaptureStart />);await ready();
    state.user=oldUser;view.rerender(<SiteCaptureStart />);
    expect(screen.getByText(/Loading your account and saved draft/)).toBeVisible();
    await act(async()=>{unlock();await blocker;});
    await screen.findByText(/could not safely check saved recovery details/);
    expect(localStorage.getItem(key)).toBe('invalid-owned-recovery-before-old-intent');
    expect(screen.queryByText(/has been cleared/)).not.toBeInTheDocument();
});
