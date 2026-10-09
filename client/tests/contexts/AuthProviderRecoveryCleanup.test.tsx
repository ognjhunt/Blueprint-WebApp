/** Actual AuthProvider session wiring; Firebase and durable-cleanup API are mocks.
 * Browser storage durability and isolation are verified separately by intake tests.
 */
import {act, cleanup, render, waitFor} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const fixture=vi.hoisted(()=>({listener:null as null|((user:any)=>Promise<void>),clear:vi.fn(),oldClear:vi.fn(),logout:vi.fn(),onAuth:vi.fn(),context:null as any}));
vi.mock('wouter',()=>({useLocation:()=>['/app',vi.fn()]}));
vi.mock('@/lib/operatorQaAuth',()=>({resolveOperatorQaAuth:()=>({enabled:false})}));
vi.mock('@/lib/siteCaptureDraft',()=>({clearSiteCaptureRecoveryForAccount:fixture.clear,
 // Retired exports let the pre-repair provider execute to demonstrate its wrong API call.
 clearSiteCaptureDraft:fixture.oldClear,siteCaptureDraftKey:(uid:string)=>`legacy:${uid}`}));
vi.mock('@/lib/firebase',()=>({auth:{},browserLocalPersistence:{},firebasePersistence:vi.fn(async()=>{}),
 onAuthStateChanged:fixture.onAuth,getUserData:vi.fn(async()=>({finishedOnboarding:true})),logOut:fixture.logout}));
import {AuthProvider,useAuth} from '@/contexts/AuthContext';
function Probe(){fixture.context=useAuth();return <div>{fixture.context.currentUser?.uid??'anonymous'}</div>;}
const user=(uid:string)=>({uid,getIdTokenResult:async()=>({claims:{}})});
beforeEach(()=>{fixture.listener=null;fixture.context=null;fixture.clear.mockReset().mockResolvedValue(true);fixture.oldClear.mockReset();fixture.logout.mockReset().mockResolvedValue(undefined);fixture.onAuth.mockReset().mockImplementation((_auth:any,listener:any)=>{fixture.listener=listener;return ()=>{};});});
afterEach(()=>cleanup());
async function open(uid:string|null='account-a'){render(<AuthProvider><Probe/></AuthProvider>);await waitFor(()=>expect(fixture.listener).not.toBeNull());await act(async()=>{await fixture.listener!(uid?user(uid):null);});await waitFor(()=>expect(fixture.context).not.toBeNull());}
async function emit(uid:string|null){await act(async()=>{await fixture.listener!(uid?user(uid):null);});}
describe('account recovery cleanup on session boundaries',()=>{
 it('does not clear the initial account or same-account token refresh',async()=>{await open();await emit('account-a');expect(fixture.clear).not.toHaveBeenCalled();expect(fixture.oldClear).not.toHaveBeenCalled();});
 it('clears only the previous account on account switch',async()=>{await open();await emit('account-b');await waitFor(()=>expect(fixture.clear).toHaveBeenCalledWith('account-a'));expect(fixture.clear).toHaveBeenCalledTimes(1);expect(fixture.clear).not.toHaveBeenCalledWith('account-b');expect(fixture.clear).not.toHaveBeenCalledWith(null);expect(fixture.oldClear).not.toHaveBeenCalled();});
 it('clears the previous account when its session expires',async()=>{await open();await emit(null);await waitFor(()=>expect(fixture.clear).toHaveBeenCalledWith('account-a'));expect(fixture.clear).toHaveBeenCalledTimes(1);expect(fixture.context.currentUser).toBeNull();});
 it('signs out immediately and awaits owned cleanup before reporting completion',async()=>{await open();let release!:(ok:boolean)=>void;fixture.clear.mockImplementationOnce(()=>new Promise<boolean>(resolve=>{release=resolve;}));let finished=false,pending!:Promise<void>;act(()=>{pending=fixture.context.logout().then(()=>{finished=true;});});await waitFor(()=>expect(fixture.clear).toHaveBeenCalledWith('account-a'));expect(fixture.logout).toHaveBeenCalledTimes(1);expect(fixture.context.currentUser).toBeNull();expect(finished).toBe(false);await act(async()=>{release(true);await pending;});expect(fixture.logout).toHaveBeenCalledTimes(1);expect(finished).toBe(true);expect(fixture.context.currentUser).toBeNull();expect(fixture.clear).toHaveBeenCalledTimes(1);});
 it('preserves signout and reports truthful cleanup failure when recovery removal cannot complete',async()=>{await open();fixture.clear.mockResolvedValueOnce(false);const consoleError=vi.spyOn(console,'error').mockImplementation(()=>{});await act(async()=>{await expect(fixture.context.logout()).rejects.toThrow('Signed out, but saved recovery details could not be cleared');});expect(fixture.logout).toHaveBeenCalledTimes(1);expect(fixture.context.currentUser).toBeNull();consoleError.mockRestore();});
 it('keeps a failed Firebase signout visible without clearing the active account recovery',async()=>{await open();fixture.logout.mockRejectedValueOnce(new Error('local auth unavailable'));const consoleError=vi.spyOn(console,'error').mockImplementation(()=>{});await act(async()=>{await expect(fixture.context.logout()).rejects.toThrow('Failed to sign out');});expect(fixture.clear).not.toHaveBeenCalled();expect(fixture.context.currentUser.uid).toBe('account-a');consoleError.mockRestore();});
 it('still clears authenticated UI context when the durable cleanup API rejects',async()=>{await open();fixture.clear.mockRejectedValueOnce(new Error('local storage unavailable'));await act(async()=>{await expect(fixture.context.logout()).rejects.toThrow('Signed out, but saved recovery details could not be cleared');});expect(fixture.logout).toHaveBeenCalledTimes(1);expect(fixture.context.currentUser).toBeNull();});
 it('does not target anonymous drafts when signing out without a current account',async()=>{await open(null);await act(async()=>{await fixture.context.logout();});expect(fixture.clear).not.toHaveBeenCalled();expect(fixture.logout).toHaveBeenCalledTimes(1);});
 it('does not clear twice when the SDK emits signout while explicit logout finishes',async()=>{await open();fixture.logout.mockImplementationOnce(async()=>{await fixture.listener!(null);});await act(async()=>{await fixture.context.logout();});expect(fixture.clear).toHaveBeenCalledTimes(1);expect(fixture.clear).toHaveBeenCalledWith('account-a');});
});
