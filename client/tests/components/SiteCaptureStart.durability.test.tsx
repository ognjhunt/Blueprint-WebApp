// @vitest-environment jsdom
/** Lifecycle contract with an explicit in-memory durability fake; native IDB proof is the browser runner. */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SiteCaptureStart } from '@/components/site/SiteCaptureStart';
import { siteCaptureDraftKey } from '@/lib/siteCaptureDraft';
const state = vi.hoisted(() => ({ user: null as any, rows: new Map<string, any>(), writes: vi.fn() }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: state.user, loading: false }) }));
vi.mock('@/lib/analytics', () => ({ analyticsEvents: { contactFormSubmit: vi.fn(), contactFormError: vi.fn() } }));
vi.mock('@/lib/csrf', () => ({ withCsrfHeader: async (h: any) => h }));
vi.mock('@/lib/siteCaptureDurability', () => ({
    readDurableSiteCaptureRecovery: async (key: string) => state.rows.get(key) ?? null,
    writeDurableSiteCaptureRecovery: async (key: string, value: any, replace = false) => { const old = state.rows.get(key); if (!replace && old && (old.retired || old.value?.requestId !== value.requestId || old.value?.retryToken !== value.retryToken))
        throw new Error('retired'); state.writes(key, value); state.rows.set(key, { value: JSON.parse(JSON.stringify(value)), retired: false }); },
    retireDurableSiteCaptureRecovery: async (key: string) => { state.rows.set(key, { value: null, retired: true }); },
    durableSiteCaptureRecoveryKeys: async () => [...state.rows.keys()],
}));
const fetchMock = vi.fn();
let hold = false;
let release: undefined | (() => Promise<void>);
let queued = 0;
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); state.rows.clear(); state.writes.mockClear(); state.user = { uid: 'old-owned-fixture', email: 'owned@example.invalid', getIdToken: async () => 'owned-fixture-token' }; hold = false; release = undefined; queued = 0; vi.stubGlobal('FormData', window.FormData); vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset().mockResolvedValue({ ok: true, status: 200, json: async () => ({ workspaceType: 'site_operator', features: [] }) }); vi.stubGlobal('navigator', { userAgent: 'fixture', locks: { request: async (key: string, action: () => unknown) => { if (hold && key === siteCaptureDraftKey('old-owned-fixture', 'default')) {
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
