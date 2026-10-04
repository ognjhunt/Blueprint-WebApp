// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
vi.mock("../../client/src/lib/firebaseAdmin", () => ({ dbAdmin: null, default: {} }));
import { communicationsDigest } from "../agents/communications-contract";
import { contactPublication, resolvePublicContact, verifyContactResolution, publicContactPriority } from "../agents/communications-contact-resolution";
import { contactResearchTask, requestNativeContactResearch, readNativeContactDiscovery, recoverableContactGap } from "../agents/communications-contact-research";
import { researchPublicationSource } from "../agents/communications-research";
import { communicationsNow, memoryFirestore } from "./fixtures/communications";
import { publishedResearchFixture } from "./fixtures/published-research";
import { CONTACT_PAGE_LIMIT, CONTACT_RESEARCH_PAGE_LIMIT } from "../agents/communications-contact-fetch";

function fixture() {
  const f = publishedResearchFixture({ actualProducer: true, unknowns: ["No public business contact has been identified."] });
  const source = researchPublicationSource(f.snapshot, { date: f.snapshot.row.date, candidateKey: f.candidate.candidate_key,
    packetDigest: f.snapshot.row.packet_digest, rawArtifactDigest: f.snapshot.row.raw_output_digest });
  const prospectId = "research-contact-fixture", db = memoryFirestore();
  return { ...f, source, prospectId, db };
}
describe("native agent contact-research recovery", () => {
  it.each(["contact_resolution_ambiguous_segment","contact_resolution_body_invalid","contact_resolution_total_size_limit"])
    ("returns a bounded extraction gap to the agent: %s",async reason=>{
      const f=fixture();expect(await requestNativeContactResearch(f.db,f.source,f.prospectId,reason,communicationsNow)).toBe(true);
      expect([...f.db.records.values()][0]).toMatchObject({state:"pending",attempts:0,separateSessionAuthorized:false,sent:false});
    });
  it("binds the original verified publication and stable CRM identity without contact or new-session authority", () => {
    const f=fixture(), task=contactResearchTask(f.source,f.prospectId);
    expect(task.publication).toEqual(contactPublication(f.source,f.prospectId));
    expect(task.publication.sheetsProspectId).toBe("BP-000042");
    expect(task.preference).toEqual(["relevant_professional_person","appropriate_team_inbox","general_business_inbox"]);
    expect(task).not.toHaveProperty("email");expect(task.maxAgentAttempts).toBe(2);
  });
  it("queues exactly once, preserves an active attempt, and never reopens an exhausted source", async () => {
    const f=fixture();
    expect(await requestNativeContactResearch(f.db,f.source,f.prospectId,"contact_resolution_missing_or_ambiguous",communicationsNow)).toBe(true);
    await requestNativeContactResearch(f.db,f.source,f.prospectId,"contact_resolution_visibility_unverified",communicationsNow+1);
    const entries=[...f.db.records.entries()].filter(([key])=>key.includes("/contactResearchRequests/"));expect(entries).toHaveLength(1);
    const [key]=entries[0];await f.db.doc(key).set({state:"running",attempts:1},{merge:true});
    await requestNativeContactResearch(f.db,f.source,f.prospectId,"contact_fetch_size_limit",communicationsNow+2);
    expect(f.db.records.get(key)).toMatchObject({state:"running",attempts:1});
    await f.db.doc(key).set({state:"exhausted",attempts:2},{merge:true});
    expect(await requestNativeContactResearch(f.db,f.source,f.prospectId,"contact_fetch_size_limit",communicationsNow+3)).toBe(false);
    await expect(readNativeContactDiscovery(f.db,f.source,f.prospectId)).rejects.toThrow("contact_agent_research_exhausted");
  });
  it.each(["recipient_suppressed","contact_resolution_recipient_restricted","verified_contact_conflicting_unknowns","lead_verification_required:missing"])("does not widen authority for %s", async reason=>{
    const f=fixture();expect(recoverableContactGap(reason)).toBe(false);
    expect(await requestNativeContactResearch(f.db,f.source,f.prospectId,reason,communicationsNow)).toBe(false);
    expect(f.db.records.size).toBe(0);
  });
  it("retains a complete oversized source within the recovery bound instead of promoting a truncated excerpt", async () => {
    const f=fixture(), body=`<p>${f.candidate.organization}: Business inquiries: ${f.prospect.contactEmail}</p>`+" ".repeat(CONTACT_PAGE_LIMIT);
    const read=vi.fn(async (url:string,_org:string,_deadline:number,options?:{maxBytes:number})=>{
      if(!options) throw Error("contact_fetch_size_limit");expect(options.maxBytes).toBe(CONTACT_RESEARCH_PAGE_LIMIT);
      return {requestedUrl:url,finalUrl:url,redirects:[],checkedAt:new Date(communicationsNow).toISOString(),status:200 as const,
        contentType:"text/html",bodyBase64:Buffer.from(body).toString("base64")};
    });
    const proof=await resolvePublicContact(f.source,f.prospectId,read,()=>communicationsNow);
    expect(Buffer.from(proof.pages[0].bodyBase64,"base64").toString()).toBe(body);
    expect(verifyContactResolution(proof,f.source,f.prospectId).email).toBe(f.prospect.contactEmail);
    expect(read.mock.calls[0][3]).toBeUndefined();expect(read.mock.calls[1][3]).toEqual({maxBytes:CONTACT_RESEARCH_PAGE_LIMIT});
  });
  it("does not accept a fabricated mutable completed summary as native receipt proof", async () => {
    const f=fixture(), task=contactResearchTask(f.source,f.prospectId), hash="a".repeat(64);
    const discovery={version:"blueprint.contact-research-discovery.v1",requestId:task.requestId,sourceDigest:task.sourceDigest,
      run:{date:"2026-10-01",runKey:"blueprint-researcher:2026-10-01",rowBlob:hash,rawArtifactDigest:hash,qaArtifactDigest:hash},
      sources:[{url:"https://facility.example/operations",callId:"call_actual",resultSha256:hash,rawSourceSha256:hash,checkedAt:new Date(communicationsNow).toISOString()}]};
    await f.db.doc(`blueprintCommunications/default/contactResearchRequests/${task.requestId}`).set({task,state:"sources_ready",attempts:1,discovery});
    await f.db.doc("blueprintDailyResearch/sites-first/runs/2026-10-01").set({state:"completed",blob:hash});
    const verify=vi.fn(async()=>{throw new Error("contact_research_run_unverified");});
    await expect(readNativeContactDiscovery(f.db,f.source,f.prospectId,verify)).rejects.toThrow("contact_research_run_unverified");
    expect(verify).toHaveBeenCalledWith(f.db,task,discovery);
    await expect(readNativeContactDiscovery(f.db,f.source,f.prospectId)).rejects.toThrow();
    expect(communicationsDigest(task.publication)).toHaveLength(64);
  });
  it("prefers a current relevant person, then appropriate task team, over a general inbox", async () => {
    const f=fixture(),name=f.candidate.organization,site=f.candidate.site,task=f.candidate.task;
    const general=`${name}. Business inquiries: info@facility.example`;
    const team=`${name}. Operations team for ${task}, business inquiries: operations@facility.example`;
    const person=`${name}, ${site}. Jane Example, Director of Operations, oversees ${task}. Business inquiries: jane@facility.example`;
    expect(publicContactPriority(person,f.candidate)).toBe(0);expect(publicContactPriority(team,f.candidate)).toBe(1);
    expect(publicContactPriority(general,f.candidate)).toBe(2);
    const read=async(url:string)=>({requestedUrl:url,finalUrl:url,redirects:[],checkedAt:new Date(communicationsNow).toISOString(),
      status:200 as const,contentType:"text/html",bodyBase64:Buffer.from(`<p>${general}</p><p>${team}</p><p>${person}</p>`).toString("base64")});
    const proof=await resolvePublicContact(f.source,f.prospectId,read,()=>communicationsNow);
    expect(verifyContactResolution(proof,f.source,f.prospectId).email).toBe("jane@facility.example");
  });
  it.each(["Former Jane Example, Director of Operations, oversees", "Jane Example, Director of Operations, no longer manages",
    "Jane Example, Director of Operations, is not responsible for"])
    ("does not rank stale, negated or unnamed remit as a relevant current person: %s", phrase=>{
      const f=fixture();expect(publicContactPriority(`${f.candidate.organization}, ${f.candidate.site}. ${phrase} ${f.candidate.task}. Business inquiries: public@facility.example`,f.candidate)).toBe(3);
    });
  it("does not promote a lowercase routing phrase to a named person",()=>{
    const f=fixture();expect(publicContactPriority(`${f.candidate.organization}, ${f.candidate.site}. operations team, director, manages ${f.candidate.task}. Business inquiries: operations@facility.example`,f.candidate)).toBe(1);
  });
  it("surfaces a quarantined native proof without waiting forever or resetting attempts",async()=>{
    const f=fixture(),task=contactResearchTask(f.source,f.prospectId);
    await f.db.doc(`blueprintCommunications/default/contactResearchRequests/${task.requestId}`).set({task,state:"blocked",attempts:1,reason:"contact_research_receipt_changed"});
    await expect(readNativeContactDiscovery(f.db,f.source,f.prospectId)).rejects.toThrow("contact_agent_research_proof_invalid");
    expect(await requestNativeContactResearch(f.db,f.source,f.prospectId,"contact_fetch_size_limit",communicationsNow)).toBe(false);
    expect([...f.db.records.values()][0]).toMatchObject({state:"blocked",attempts:1});
  });
  it("keeps equally preferred people ambiguous instead of guessing the decision owner", async()=>{
    const f=fixture(),quote=(name:string,email:string)=>`${f.candidate.organization}, ${f.candidate.site}. ${name}, Director of Operations, oversees ${f.candidate.task}. Business inquiries: ${email}`;
    const read=async(url:string)=>({requestedUrl:url,finalUrl:url,redirects:[],checkedAt:new Date(communicationsNow).toISOString(),status:200 as const,
      contentType:"text/html",bodyBase64:Buffer.from(`<p>${quote("Jane Example","jane@facility.example")}</p><p>${quote("John Sample","john@facility.example")}</p>`).toString("base64")});
    await expect(resolvePublicContact(f.source,f.prospectId,read,()=>communicationsNow)).rejects.toThrow("contact_resolution_missing_or_ambiguous");
  });
});
