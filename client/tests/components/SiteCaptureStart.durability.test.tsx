// @vitest-environment jsdom
/** Lifecycle contract with an explicit in-memory durability fake; native IDB proof is the browser runner. */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SiteCaptureStart } from '@/components/site/SiteCaptureStart';
import { newSiteCaptureRecovery, siteCaptureDraftKey, SITE_CAPTURE_DRAFT_TTL_MS } from '@/lib/siteCaptureDraft';

/** The country, chosen in its select: typed text is never read for a country (the privacy gate). */
function chooseCountry(value: "us" | "non_us") {
  fireEvent.change(document.querySelector("#start-region")!, { target: { value } });
}

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
    chooseCountry("us");
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

// Owner, 2026-11-12: the form never shows a "clear this browser's draft" control. A saved copy it cannot use starts a
// fresh draft on load, and a job this browser already saved offers "Start a new job", which replaces only this device's
// copy of it once both stores hold the fresh draft.
async function saveJob() {
    fetchMock.mockImplementation(async (_url,init)=>({ok:true,status:200,json:async()=>init?.method==='POST'?{captureUrl:'/capture-upload/owned-new-job-fixture'}:{workspaceType:'site_operator',features:[]}}));
    const first=render(<SiteCaptureStart />);await ready();
    for(const [id,value] of [['start-task','A saved description'],['start-location','Austin, TX']])fireEvent.change(document.querySelector('#'+id)!,{target:{value}});
    chooseCountry('us');
    fireEvent.submit(screen.getByRole('form'));await screen.findByRole('heading',{name:'Now film the job.'});
    first.unmount();
    const view=render(<SiteCaptureStart />);await ready();
    await screen.findByRole('button',{name:'Return to saved job'});
    return view;
}
it('an unreadable saved copy starts a fresh draft in both stores, with nothing to clear', async () => {
    const key=siteCaptureDraftKey('old-owned-fixture','default');localStorage.setItem(key,'invalid-owned-fixture');
    render(<SiteCaptureStart />);await ready();
    expect(document.querySelector('#start-task')).toBeEnabled();expect(document.querySelector('#start-task')).toHaveValue('');
    const fresh=JSON.parse(localStorage.getItem(key)!);
    expect(fresh.pending).toBeNull();expect(state.rows.get(key).value).toEqual(fresh);
    expect(screen.queryByRole('button',{name:/clear/i})).toBeNull();
    expect(document.body).not.toHaveTextContent(/recovery details|browser's draft/i);
    expect(fetchMock.mock.calls.filter(c=>c[1]?.method==='POST')).toHaveLength(0);
});
it('a saved copy older than the limit starts a fresh draft instead of stopping the form', async () => {
    const key=siteCaptureDraftKey('old-owned-fixture','default');
    const old={...newSiteCaptureRecovery(),savedAt:Date.now()-SITE_CAPTURE_DRAFT_TTL_MS-60_000};
    old.draft={...old.draft,task:'A draft from last month'};
    localStorage.setItem(key,JSON.stringify(old));state.rows.set(key,{value:JSON.parse(JSON.stringify(old)),retired:false});
    render(<SiteCaptureStart />);await ready();
    expect(document.querySelector('#start-task')).toBeEnabled();expect(document.querySelector('#start-task')).toHaveValue('');
    const fresh=JSON.parse(localStorage.getItem(key)!);
    expect(fresh.requestId).not.toBe(old.requestId);expect(fresh.pending).toBeNull();expect(state.rows.get(key).value).toEqual(fresh);
    expect(document.body).not.toHaveTextContent(/could not safely check|clear this browser/i);
});
it('a saved job offers Start a new job, shown only once both stores hold the fresh draft', async () => {
    await saveJob();
    const key=siteCaptureDraftKey('old-owned-fixture','default'),before=localStorage.getItem(key);
    expect(JSON.parse(before!).pending.acknowledged).toBe(true);
    expect(screen.getByText('Your job is saved. Return to the same job to check its current status.')).toBeInTheDocument();
    hold=true;fireEvent.click(screen.getByRole('button',{name:'Start a new job ›'}));
    await vi.waitFor(()=>expect(queued).toBe(1));
    expect(screen.getByRole('button',{name:'Starting a new job…'})).toBeDisabled();
    expect(screen.getByRole('button',{name:'Return to saved job'})).toBeDisabled();
    expect(document.querySelector('#start-task')).toBeDisabled();
    expect(localStorage.getItem(key)).toBe(before);
    await act(async()=>{await release!();});
    await vi.waitFor(()=>expect(screen.queryByRole('button',{name:'Return to saved job'})).toBeNull());
    expect(document.querySelector('#start-task')).toBeEnabled();expect(document.querySelector('#start-task')).toHaveValue('');
    const fresh=JSON.parse(localStorage.getItem(key)!);
    expect(fresh.requestId).not.toBe(JSON.parse(before!).requestId);expect(fresh.pending).toBeNull();expect(fresh.draft.task).toBe('');
    expect(state.rows.get(key).value).toEqual(fresh);
    // Only this device's copy changed: the saved job was sent once and is not touched.
    expect(fetchMock.mock.calls.filter(c=>c[1]?.method==='POST')).toHaveLength(1);
});
it('a failed Start a new job keeps the saved job and says this browser could not save', async () => {
    await saveJob();
    const key=siteCaptureDraftKey('old-owned-fixture','default'),before=localStorage.getItem(key);
    state.retireFailure=true;fireEvent.click(screen.getByRole('button',{name:'Start a new job ›'}));
    await screen.findByText(/cannot safely save or coordinate recovery details/);
    expect(screen.getByRole('button',{name:'Return to saved job'})).toBeEnabled();
    expect(screen.getByRole('button',{name:'Start a new job ›'})).toBeEnabled();
    expect(localStorage.getItem(key)).toBe(before);
    state.retireFailure=false;fireEvent.click(screen.getByRole('button',{name:'Start a new job ›'}));
    await vi.waitFor(()=>expect(document.querySelector('#start-task')).toBeEnabled());
    expect(screen.queryByText(/cannot safely save or coordinate recovery details/)).toBeNull();
});
it('an account switch drops a queued Start a new job without touching either account', async () => {
    const view=await saveJob();
    const oldKey=siteCaptureDraftKey('old-owned-fixture','default'),oldBefore=localStorage.getItem(oldKey);
    hold=true;fireEvent.click(screen.getByRole('button',{name:'Start a new job ›'}));await vi.waitFor(()=>expect(queued).toBe(1));
    state.user=null;view.rerender(<SiteCaptureStart />);await ready();
    fireEvent.change(document.querySelector('#start-task')!,{target:{value:'New anonymous work must survive the old account'}});await act(async()=>{});
    const newKey=siteCaptureDraftKey(null,'default'),newBefore=localStorage.getItem(newKey);
    await act(async()=>{await release!();});
    expect(localStorage.getItem(oldKey)).toBe(oldBefore);expect(localStorage.getItem(newKey)).toBe(newBefore);
    expect(document.querySelector('#start-task')).toHaveValue('New anonymous work must survive the old account');
});
it('FIFO: a Start a new job queued before switching accounts A to B to A stays dropped', async () => {
    const oldUser=state.user,view=await saveJob();
    const key=siteCaptureDraftKey('old-owned-fixture','default'),before=localStorage.getItem(key);
    // Model the real same-key FIFO, so returning-A hydration queues behind the old request rather than jumping it.
    const queues=new Map<string,Promise<unknown>>();
    vi.stubGlobal('navigator',{userAgent:'fixture',locks:{request:(scope:string,action:()=>unknown)=>{
      const request=(queues.get(scope)??Promise.resolve()).then(action);queues.set(scope,request.catch(()=>{}));return request;
    }}});
    let unlock!:()=>void;
    const blocker=navigator.locks.request(key,()=>new Promise<void>(resolve=>{unlock=resolve;}));
    await vi.waitFor(()=>expect(unlock).toBeDefined());
    fireEvent.click(screen.getByRole('button',{name:'Start a new job ›'}));
    expect(screen.getByRole('button',{name:'Starting a new job…'})).toBeDisabled();
    state.user=null;view.rerender(<SiteCaptureStart />);await ready();
    state.user=oldUser;view.rerender(<SiteCaptureStart />);
    expect(screen.getByText(/Loading your account and saved draft/)).toBeVisible();
    await act(async()=>{unlock();await blocker;});
    await screen.findByRole('button',{name:'Return to saved job'});
    expect(localStorage.getItem(key)).toBe(before);
    expect(screen.getByRole('button',{name:'Start a new job ›'})).toBeEnabled();
});
