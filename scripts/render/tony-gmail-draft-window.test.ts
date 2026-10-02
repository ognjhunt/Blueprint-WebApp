// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { configureTonyDraftWindow } from "./tony-gmail-draft-window.mjs";

function provider(initial = new Map<string, string>()) {
  const values = initial;
  const request = vi.fn(async (url: string, options: any) => {
    expect(url).toMatch(/^https:\/\/api.render.com\/v1\/services\/srv-d4vnmk3e5dus73aiohk0\/env-vars\/BLUEPRINT_COMMUNICATIONS_GMAIL_DRAFT(?:S_ENABLED|_APPROVAL_REF|_APPROVED_JOB_ID|_APPROVED_REVISION_ID|_APPROVED_REVIEW_DIGEST)$/);
    const key=url.split("/").at(-1)!;
    if(options.method==="PUT") values.set(key,JSON.parse(options.body).value);
    return values.has(key) ? {ok:true,status:200,json:async()=>({key,value:values.get(key)})} : {ok:false,status:404};
  });
  return {values,request};
}
describe("fixed Tony Render configuration",()=>{
 it("prepares off, opens only the reviewed scope and closes without any provider deploy or mailbox call",async()=>{
  const p=provider(), enabled="BLUEPRINT_COMMUNICATIONS_GMAIL_DRAFTS_ENABLED";
  expect(await configureTonyDraftWindow("prepare-consent","existing-actions-key",p.request)).toMatchObject({writes:5,draftFlagConfigured:false,runtimeObserved:false,deployTriggered:false,mailboxWrites:0,sends:0});
  const prepared=new Map(p.values);
  expect(await configureTonyDraftWindow("open-one-draft","existing-actions-key",p.request)).toMatchObject({writes:1,draftFlagConfigured:true});
  expect([...p.values].filter(([key])=>key!==enabled)).toEqual([...prepared].filter(([key])=>key!==enabled));
  expect(await configureTonyDraftWindow("close-one-draft","existing-actions-key",p.request)).toMatchObject({writes:1,draftFlagConfigured:false});
  p.request.mockClear();expect(await configureTonyDraftWindow("inspect","existing-actions-key",p.request)).toMatchObject({writes:0});
  expect(p.request.mock.calls.every(([,options])=>options.method!=="PUT")).toBe(true);
 });
 it("refuses an absent or conflicting approved scope before any write",async()=>{
  const absent=provider();await expect(configureTonyDraftWindow("open-one-draft","key",absent.request)).rejects.toThrow("prepare_consent_required");
  expect(absent.request.mock.calls.some(([,options])=>options.method==="PUT")).toBe(false);
  const conflict=provider(new Map([["BLUEPRINT_COMMUNICATIONS_GMAIL_DRAFT_APPROVAL_REF","another-owner-window"]]));
  await expect(configureTonyDraftWindow("prepare-consent","key",conflict.request)).rejects.toThrow("conflicting_approval_window");
  expect(conflict.request.mock.calls.some(([,options])=>options.method==="PUT")).toBe(false);
 });
 it("does not parse, log or propagate an unsuccessful provider response body",async()=>{
  const text=vi.fn(async()=>"SECRET_RESPONSE_VALUE"), request=vi.fn(async()=>({ok:false,status:503,text}));
  await expect(configureTonyDraftWindow("close-one-draft","key",request)).rejects.toThrow("HTTP503");
  expect(request).toHaveBeenCalledTimes(1);expect(text).not.toHaveBeenCalled();
 });
});
