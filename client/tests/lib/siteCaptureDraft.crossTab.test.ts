// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
// Explicit unit contract fake: native strict IndexedDB execution is a separate layer.
const durability = vi.hoisted(() => ({ rows: new Map<string, { value: any; retired: boolean }>() }));
vi.mock("@/lib/siteCaptureDurability", () => ({
  readDurableSiteCaptureRecovery: async (key: string) => {
    const row = durability.rows.get(key);
    return row ? JSON.parse(JSON.stringify(row)) : null;
  },
  writeDurableSiteCaptureRecovery: async (key: string, value: any, replaceIdentity = false) => {
    const current = durability.rows.get(key);
    if (!replaceIdentity && current && (current.retired || current.value?.requestId !== value.requestId
      || current.value?.retryToken !== value.retryToken)) throw new Error("Fixture durability transaction aborted");
    const { task, location, email, company, method, region, regionManuallySet } = value.draft;
    durability.rows.set(key, { retired: false, value: {
      version: value.version, savedAt: value.savedAt, requestId: value.requestId, retryToken: value.retryToken,
      draft: { task, location, email, company, method, region, regionManuallySet },
      pending: value.pending ? { body: value.pending.body, endpoint: value.pending.endpoint, acknowledged: value.pending.acknowledged } : null,
    } });
  },
  retireDurableSiteCaptureRecovery: async (key: string) => { durability.rows.set(key, { value: null, retired: true }); },
  durableSiteCaptureRecoveryKeys: async () => [...durability.rows.keys()],
}));
import { newSiteCaptureRecovery, readSiteCaptureRecovery, writeSiteCaptureRecovery, siteCaptureDraftKey, freezeSiteCaptureRecovery, forgetSiteCaptureRecovery } from "@/lib/siteCaptureDraft";
const key = siteCaptureDraftKey(null, "default");
function frozen() {
  const value = newSiteCaptureRecovery();
  value.draft = {...value.draft, task:"Move cartons",location:"Austin, TX",region:"us",email:"fixture@example.test"};
  value.pending = {endpoint:"/api/inbound-request",acknowledged:false,body:JSON.stringify({requestId:value.requestId,retryToken:value.retryToken,buyerType:"site_operator",taskStatement:value.draft.task,siteLocation:value.draft.location,captureRegion:value.draft.region})};
  return value;
}
beforeEach(() => {
  durability.rows.clear();
  localStorage.clear();
  const queues=new Map<string,Promise<unknown>>();
  vi.stubGlobal("navigator",{locks:{request:async(name:string, action:()=>unknown)=>{
    const result=(queues.get(name)??Promise.resolve()).then(action);
    queues.set(name,result.catch(()=>{}));return result;
  }}});
});
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});
it("CROSS-TAB-001 stale same-identity autosave cannot erase frozen authority", () => {
  const winner=frozen();writeSiteCaptureRecovery(key,winner);
  writeSiteCaptureRecovery(key,{...winner,pending:null,draft:{...winner.draft,task:"Edited in stale tab"}});
  expect(readSiteCaptureRecovery(key)).toEqual(winner);
});
it("CROSS-TAB-002 stale different-identity autosave cannot erase frozen authority", () => {
  const winner=frozen();writeSiteCaptureRecovery(key,winner);
  writeSiteCaptureRecovery(key,newSiteCaptureRecovery());
  expect(readSiteCaptureRecovery(key)).toEqual(winner);
});
it("CROSS-TAB-003 acknowledgements cannot be downgraded by stale pending writes", () => {
  const winner=frozen();winner.pending!.acknowledged=true;writeSiteCaptureRecovery(key,winner);
  writeSiteCaptureRecovery(key,{...winner,pending:{...winner.pending!,acknowledged:false}});
  expect(readSiteCaptureRecovery(key)?.pending?.acknowledged).toBe(true);
});
it("CROSS-TAB-004 two contenders adopt one frozen whole snapshot under the shared lock",async()=>{
  const first=frozen(),second=frozen();second.draft.task="Other tab task";
  second.pending!.body=JSON.stringify({...JSON.parse(second.pending!.body),taskStatement:second.draft.task});
  const [winner,loser]=await Promise.all([freezeSiteCaptureRecovery(key,first),freezeSiteCaptureRecovery(key,second)]);
  expect(winner.adopted).toBe(false);expect(loser.adopted).toBe(true);expect(loser.value).toEqual(winner.value);
});
it("CROSS-TAB-005 a matching receipt cannot replace frozen draft fields or lower their timestamp",()=>{
  const winner=frozen();writeSiteCaptureRecovery(key,winner);
  writeSiteCaptureRecovery(key,{...winner,savedAt:winner.savedAt-100,draft:{...winner.draft,task:"Changed"}});
  expect(readSiteCaptureRecovery(key)).toEqual(winner);
});
it("CROSS-TAB-006 only an explicit unacknowledged refusal releases the matching frozen row",()=>{
  const winner=frozen();writeSiteCaptureRecovery(key,winner);
  expect(writeSiteCaptureRecovery(key,{...winner,pending:null},{releasePendingBody:winner.pending!.body})).toBe(true);
  winner.pending!.acknowledged=true;writeSiteCaptureRecovery(key,winner);
  expect(writeSiteCaptureRecovery(key,{...winner,pending:null},{releasePendingBody:winner.pending!.body})).toBe(false);
  expect(readSiteCaptureRecovery(key)?.pending?.acknowledged).toBe(true);
});
it("CROSS-TAB-011 a stale refusal cannot release a newer frozen body",()=>{
  const winner=frozen();writeSiteCaptureRecovery(key,winner);
  expect(writeSiteCaptureRecovery(key,{...winner,pending:null},{releasePendingBody:"older refused body"})).toBe(false);
  expect(readSiteCaptureRecovery(key)).toEqual(winner);
});
it("CROSS-TAB-007 unreadable bytes survive autosave and freeze attempts",async()=>{
  localStorage.setItem(key,"{torn");expect(writeSiteCaptureRecovery(key,frozen())).toBe(false);
  await expect(freezeSiteCaptureRecovery(key,frozen())).rejects.toThrow("could not be read");
  expect(localStorage.getItem(key)).toBe("{torn");
});
it("CROSS-TAB-008 missing Web Locks blocks unsafe creation",async()=>{
  vi.stubGlobal("navigator",{});await expect(freezeSiteCaptureRecovery(key,frozen())).rejects.toThrow("cannot safely coordinate");
  expect(localStorage.getItem(key)).toBeNull();
});
it("CROSS-TAB-009 failed storage persistence cannot authorize dispatch",async()=>{
  vi.spyOn(Storage.prototype,"setItem").mockImplementation(()=>{throw new Error("fixture quota");});
  await expect(freezeSiteCaptureRecovery(key,frozen())).rejects.toThrow("No job was submitted");
});
it("CROSS-TAB-010 denied reads expose a safe failure without private exception content",async()=>{
  vi.spyOn(Storage.prototype,"getItem").mockImplementation(()=>{throw new Error("private fixture detail");});
  await expect(freezeSiteCaptureRecovery(key,frozen())).rejects.toThrow("No new job was submitted");
});
it("CROSS-TAB-014 late acknowledgement cannot resurrect an explicitly cleared identity",()=>{
  const old=frozen();writeSiteCaptureRecovery(key,old);forgetSiteCaptureRecovery(key);
  const fresh=newSiteCaptureRecovery();writeSiteCaptureRecovery(key,fresh);
  expect(writeSiteCaptureRecovery(key,{...old,pending:{...old.pending!,acknowledged:true}})).toBe(false);
  expect(readSiteCaptureRecovery(key)).toEqual(fresh);
});
it("CROSS-TAB-015 stale autosave cannot replace an explicitly cleared identity",()=>{
  const old=frozen();writeSiteCaptureRecovery(key,old);forgetSiteCaptureRecovery(key);
  const fresh=newSiteCaptureRecovery();writeSiteCaptureRecovery(key,fresh);
  expect(writeSiteCaptureRecovery(key,{...old,pending:null})).toBe(false);expect(readSiteCaptureRecovery(key)).toEqual(fresh);
});
it("CROSS-TAB-016 retired pending authority cannot freeze under the fresh cleared identity",async()=>{
  const old=frozen();writeSiteCaptureRecovery(key,old);forgetSiteCaptureRecovery(key);
  const fresh=newSiteCaptureRecovery();writeSiteCaptureRecovery(key,fresh);
  await expect(freezeSiteCaptureRecovery(key,old)).rejects.toThrow("changed in another tab");
  expect(readSiteCaptureRecovery(key)).toEqual(fresh);
});
