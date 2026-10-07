// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
vi.mock("../../client/src/lib/firebaseAdmin", () => ({ dbAdmin: null, authAdmin: null, default: {} }));
const capability = vi.hoisted(() => vi.fn());
const copyStorage = vi.hoisted(() => ({ raw: "", generation: "1" }));
vi.mock("../agents/communications-oauth-store", () => ({ requireFounderDraftCapability: capability }));
vi.mock("../utils/siteCaptureBundleStorage", () => ({ resolveBundleStorage: () => ({ bucketName: "blueprint-8c1ca.appspot.com",
 info: async () => ({ generation: copyStorage.generation, size: Buffer.byteLength(copyStorage.raw) }), readText: async () => copyStorage.raw }) }));
import { communicationsFixture, communicationsNow, memoryFirestore, syntheticQualification } from "./fixtures/communications";
import { launchHypothesisDraft, archivedLaunchHypothesisDraft } from "./fixtures/hypothesis";
import { founderOutreachFixture } from "./fixtures/founder-outreach";
import { appendFirstContactFooter } from "../agents/communications-first-contact-footer";
import { communicationsDeliveryKey, communicationsDigest } from "../agents/communications-contract";
import { reviewCommunicationsPayload } from "../agents/communications-review";
import { mirrorCommunicationsGmailDraft, reconcileEndedGmailDraftWriter, configuredGmailDraftPorts, communicationsGmailDraftStatus, runCommunicationsGmailDraftCopies,
 prepareSameRunDraftSave, saveCommunicationsUnsentDraft, type GmailDraftPorts } from "../agents/communications-gmail-draft";
beforeEach(()=>{vi.stubEnv("BLUEPRINT_COMMUNICATIONS_FIRST_CONTACT_POSTAL_LINE","Blueprint Robotics, Inc. · Synthetic test location, ZZ 00000");capability.mockReset().mockResolvedValue(undefined);});
afterEach(()=>vi.unstubAllEnvs());
function fixture(launch: boolean | "historical" = false) {
 const {job,brief,handoff}=communicationsFixture();
 let { output } = communicationsFixture();
 if (launch) {
  brief.qualification = syntheticQualification();
  brief.contact.recipient = { kind: "inbox", addressee: "the packing team", person: null };
  output = launch === "historical" ? archivedLaunchHypothesisDraft(brief) : launchHypothesisDraft(brief);
  job.briefDigest = communicationsDigest(brief);
  const { jobId: _, ...identity } = job;
  job.jobId = communicationsDigest(identity); handoff.briefDigest = job.briefDigest;
 }
 const ledgerId=`communications_${job.jobId}`;
 const payload={from:"nijel@tryblueprint.io",replyTo:"nijel@tryblueprint.io",to:brief.contact.email.toLowerCase(),emailTransport:"founder_gmail",subject:output.subject,body:output.body,transportBody:appendFirstContactFooter(output.body,brief.contact.email),outreachContext:brief.outreachContext,outreachContract:output.outreachContract,communications:{version:"blueprint.communications.v1",job,brief,output,thread:null,approvalState:"pending_approval"}};
 const reviewDigest=reviewCommunicationsPayload(payload,communicationsNow).digest!, revisionId="a".repeat(64), root="blueprintCommunications/default";
 const db=memoryFirestore(new Map([
 [`action_ledger/${ledgerId}`,{status:"pending_approval",action_type:"send_email",action_tier:3,lane:"outbound_prospect",source_collection:"outboundProspects",source_doc_id:job.prospectId,action_payload:payload,draft_revision_id:revisionId,execution_attempts:0}],
 [`${root}/jobs/${job.jobId}`,{...job,state:"pending_approval",ledgerId,output,reviewDigest,draftRevisionId:revisionId}],
 [`${root}/handoffs/${job.briefDigest}`,handoff],
 [`${root}/briefs/${job.briefId}`,brief],
 [`${root}/draftRevisions/${revisionId}`,{ledgerId,jobId:job.jobId,output}],
 [`outboundProspects/${job.prospectId}`,{contactEmail:brief.contact.email,siteId:brief.siteId,taskId:brief.taskId,caseId:brief.caseId,stage:"drafted",communications:{jobId:job.jobId,briefDigest:job.briefDigest}}],
 ]));
 let copied:any=null;
 const receipt={draftId:"gmail-draft-1",messageId:"gmail-message-1",threadId:"gmail-thread-1",authoredRfcMessageId:`<blueprint-draft-${job.jobId}@tryblueprint.io>`,observedRfcMessageId:"<gmail-rewritten@example.reserved.invalid>"};
 const ports:GmailDraftPorts={enabled:()=>true,allowsRevision:()=>true,requireCapability:vi.fn(async()=>{}),verifyMailbox:vi.fn(async()=>{}),priorContact:vi.fn(async()=>false),write:vi.fn(async content=>{copied=structuredClone(content);return{draftId:receipt.draftId};}),find:vi.fn(async content=>copied&&content.payloadDigest===copied.payloadDigest?receipt:null)};
 const input={expectedReviewDigest:reviewDigest,expectedRevisionId:revisionId,mode:"write"};
 return{db,job,brief,ledgerId,input,ports,payload,root,receipt,setCopied:(v:any)=>{copied=v;}};
}
describe("separate retained recurring Gmail copy direction",()=>{
 it.each([true, "historical"] as const)("copies a launch-framed hypothesis (%s) only through the exact founder draft scope, with no approval or send", async launch => {
  const f = fixture(launch);
  expect(f.payload.outreachContract?.version).toBe(launch === "historical" ? "blueprint.outreach.v3" : "blueprint.outreach.v4");
  expect(reviewCommunicationsPayload(f.payload, communicationsNow).hardChecksPassed).toBe(true);
  expect(await mirrorCommunicationsGmailDraft(f.db, f.ledgerId, "authenticated-founder", f.input, f.ports, communicationsNow))
   .toMatchObject({ state: "verified", sent: false, approved: false });
  await mirrorCommunicationsGmailDraft(f.db, f.ledgerId, "authenticated-founder", f.input, f.ports, communicationsNow);
  expect(f.ports.write).toHaveBeenCalledOnce();
  expect(f.db.records.get(`action_ledger/${f.ledgerId}`).approved_by).toBeUndefined();
 });
 function recurring() {
  const f=fixture();copyStorage.generation="1";
  vi.stubEnv("BLUEPRINT_COMMUNICATIONS_GMAIL_DRAFTS_ENABLED","true");vi.stubEnv("BLUEPRINT_COMMUNICATIONS_SEND_ENABLED","false");vi.stubEnv("BLUEPRINT_COMMUNICATIONS_AUTOMATIC_FIRST_CONTACT_ENABLED","false");
  vi.stubEnv("BLUEPRINT_COMMUNICATIONS_GMAIL_DRAFT_APPROVAL_REF","unchanged-existing-compose-consent");
  const authority:any={version:"blueprint.communications-gmail-draft-copy-direction.v1",owner:"Nijel Hunt",approvedAt:new Date(communicationsNow-1000).toISOString(),expiresAt:new Date(communicationsNow+60000).toISOString(),
   direction:{kind:"direct_current_chat_human_reply",text:"Synthetic fixture copy-only direction",sourceRef:"gs://blueprint-8c1ca.appspot.com/operations/recovery/synthetic/human-copy-direction.json"},
   binding:{mailbox:"nijel@tryblueprint.io",composeApprovalReference:"unchanged-existing-compose-consent"},scope:{draftOnly:true,gmailCopiesAuthorized:true,sendsAuthorized:false,newInferenceAuthorized:false,accessChangesAuthorized:false}};
  const retain=()=>{copyStorage.raw=JSON.stringify(authority);f.db.records.set(f.root,{gmailDraftCopyDirection:{uri:"gs://blueprint-8c1ca.appspot.com/operations/recovery/synthetic/agent-e2e-gmail-draft-copy-owner-direction.json",generation:"1",sha256:createHash("sha256").update(copyStorage.raw).digest("hex")},recurringDraftBudgetDirection:{unchangedPaidAuthority:true}});};retain();
  delete f.db.records.get(`action_ledger/${f.ledgerId}`).draft_revision_id;delete f.db.records.get(`${f.root}/jobs/${f.job.jobId}`).draftRevisionId;
  return{...f,authority,retain};
 }
 it("stages an unrevised canonical pending draft without send approval or changing paid/compose authority, then preserves its copy",async()=>{
  const f=recurring(), before=structuredClone([...f.db.records]);
  await runCommunicationsGmailDraftCopies(f.db,()=>communicationsNow,f.ports);await runCommunicationsGmailDraftCopies(f.db,()=>communicationsNow,f.ports);
  expect(f.ports.write).toHaveBeenCalledTimes(1);expect(f.ports.find).toHaveBeenCalledTimes(1);
  expect(vi.mocked(f.ports.write).mock.calls[0][0].body).toBe(f.payload.transportBody);
  expect(f.db.records.get(`${f.root}/gmailDraftBindings/${f.job.jobId}`)).toMatchObject({state:"verified",revisionId:null,copyDirection:{digest:expect.any(String)},sent:false,approved:false});
  expect([...f.db.records].filter(([path])=>!path.includes("/gmailDraftBindings/"))).toEqual(before);
  expect(process.env.BLUEPRINT_COMMUNICATIONS_GMAIL_DRAFT_APPROVAL_REF).toBe("unchanged-existing-compose-consent");
 });
 it.each(["unknown","writing"])("observes an existing %s claim through GET-only recovery without repeating create",async state=>{
  const f=recurring();vi.mocked(f.ports.write).mockImplementationOnce(async content=>{f.setCopied(content);throw Error("accepted create but acknowledgement lost");});
  await runCommunicationsGmailDraftCopies(f.db,()=>communicationsNow,f.ports);
  expect(f.db.records.get(`${f.root}/gmailDraftBindings/${f.job.jobId}`).state).toBe("unknown");
  f.db.records.get(`${f.root}/gmailDraftBindings/${f.job.jobId}`).state=state;
  await runCommunicationsGmailDraftCopies(f.db,()=>communicationsNow,f.ports);
  expect(f.ports.write).toHaveBeenCalledTimes(1);expect(f.db.records.get(`${f.root}/gmailDraftBindings/${f.job.jobId}`).state).toBe("verified");
 });
 it.each(["disabled","expired","hash","generation","compose_binding","send_scope","access_scope","send_enabled","suppressed","sent"])("refuses %s without a provider write",async kind=>{
  const f=recurring();
  if(kind==="expired")f.authority.expiresAt=new Date(communicationsNow).toISOString();
  if(kind==="compose_binding")f.authority.binding.composeApprovalReference="replacement-consent-ref";
  if(kind==="send_scope")f.authority.scope.sendsAuthorized=true;if(kind==="access_scope")f.authority.scope.accessChangesAuthorized=true;
  f.retain();if(kind==="hash")copyStorage.raw+=" ";if(kind==="generation")copyStorage.generation="2";
  if(kind==="disabled")vi.stubEnv("BLUEPRINT_COMMUNICATIONS_GMAIL_DRAFTS_ENABLED","false");if(kind==="send_enabled")vi.stubEnv("BLUEPRINT_COMMUNICATIONS_SEND_ENABLED","true");
  if(kind==="suppressed")f.db.records.set(`email_suppressions/${f.brief.contact.email.toLowerCase()}`,{global_suppressed:true});
  if(kind==="sent")f.db.records.get(`action_ledger/${f.ledgerId}`).sent_at=communicationsNow;
  await runCommunicationsGmailDraftCopies(f.db,()=>communicationsNow,f.ports).catch(()=>undefined);expect(f.ports.write).not.toHaveBeenCalled();
 });
 it("rechecks a revoked/expired direction after the claim and before the provider write",async()=>{
  const f=recurring();let current=communicationsNow;
  vi.mocked(f.ports.priorContact).mockImplementationOnce(async()=>{current+=60001;return false;});
  await runCommunicationsGmailDraftCopies(f.db,()=>current,f.ports);
  expect(f.ports.write).not.toHaveBeenCalled();expect(f.db.records.get(`${f.root}/gmailDraftBindings/${f.job.jobId}`)).toMatchObject({state:"refused_before_write",providerWriteSubmitted:false});
 });
});
describe("same-run unsent Gmail draft action",()=>{
 async function direct() {
  const f=fixture(); copyStorage.generation="1";
  vi.stubEnv("BLUEPRINT_COMMUNICATIONS_SEND_ENABLED","false");vi.stubEnv("BLUEPRINT_COMMUNICATIONS_AUTOMATIC_FIRST_CONTACT_ENABLED","false");
  vi.stubEnv("BLUEPRINT_COMMUNICATIONS_GMAIL_DRAFTS_ENABLED","false");vi.stubEnv("BLUEPRINT_COMMUNICATIONS_GMAIL_DRAFT_APPROVAL_REF","unchanged-existing-compose-consent");
  const authority:any={version:"blueprint.communications-gmail-draft-copy-direction.v2",owner:"Nijel Hunt",approvedAt:new Date(communicationsNow-1000).toISOString(),expiresAt:new Date(communicationsNow+60000).toISOString(),
   direction:{kind:"direct_current_chat_human_reply",text:"Save eligible prospective drafts inside the same run",sourceRef:"gs://blueprint-8c1ca.appspot.com/operations/recovery/synthetic/human-copy-direction.json"},
   binding:{mailbox:"nijel@tryblueprint.io",composeApprovalReference:"unchanged-existing-compose-consent"},scope:{draftOnly:true,gmailCopiesAuthorized:true,sendsAuthorized:false,newInferenceAuthorized:false,accessChangesAuthorized:false,saveWithinRun:true,prospectiveOnly:true}};
  const retain=()=>{copyStorage.raw=JSON.stringify(authority);f.db.records.set(f.root,{gmailDraftCopyDirection:{uri:"gs://blueprint-8c1ca.appspot.com/operations/recovery/synthetic/agent-e2e-gmail-draft-copy-owner-direction.json",generation:"1",sha256:createHash("sha256").update(copyStorage.raw).digest("hex")}});};retain();
  f.ports.recipientDraftExists=vi.fn(async()=>false);
  const binding=await prepareSameRunDraftSave(f.db,()=>communicationsNow,f.ports);
  f.db.records.get(`${f.root}/jobs/${f.job.jobId}`).checkpoint={createClaimedAt:null,sessionId:null,turnId:null,sameRunDraftSave:binding};
  const save=(now=()=>communicationsNow)=>saveCommunicationsUnsentDraft(f.db,f.job.jobId,binding,now,f.ports);
  return{...f,authority,retain,binding,save};
 }
 it("saves without a separate copy window or approval and rechecks the actual unsent copy on replay",async()=>{
  const f=await direct();
  expect(await f.save()).toMatchObject({state:"gmail_draft_saved",gmailDraftId:"gmail-draft-1",sent:false,approved:false});
  await f.save();expect(f.ports.write).toHaveBeenCalledOnce();expect(f.ports.find).toHaveBeenCalledTimes(2);
  expect(vi.mocked(f.ports.write).mock.calls[0][0].mimeProfile).toBe("multipart-signature-link-v2");
  expect(f.db.records.get(`action_ledger/${f.ledgerId}`).status).toBe("pending_approval");
  expect(f.db.records.get(`action_ledger/${f.ledgerId}`).approved_by).toBeUndefined();
  expect(process.env.BLUEPRINT_COMMUNICATIONS_GMAIL_DRAFT_APPROVED_JOB_ID).toBeUndefined();
 });
 it("reconciles a lost create ACK using the retained binding instead of making another copy",async()=>{
  const f=await direct();vi.mocked(f.ports.write).mockImplementationOnce(async content=>{f.setCopied(content);throw Error("synthetic_lost_ack");});
  await expect(f.save()).rejects.toThrow("gmail_draft_unknown_acknowledgement_reconcile_exact_job");expect(f.db.records.get(`${f.root}/gmailDraftBindings/${f.job.jobId}`).state).toBe("unknown");
  expect(await f.save()).toMatchObject({state:"gmail_draft_saved",gmailDraftId:"gmail-draft-1"});expect(f.ports.write).toHaveBeenCalledOnce();
 });
 it.each(["historical", "recipient_draft", "opt_out", "changed_direction", "expired", "send_enabled"])("refuses %s without creating mail",async kind=>{
  const f=await direct();
  if(kind==="historical")delete f.db.records.get(`${f.root}/jobs/${f.job.jobId}`).checkpoint.sameRunDraftSave;
  if(kind==="recipient_draft")vi.mocked(f.ports.recipientDraftExists!).mockResolvedValue(true);
  if(kind==="opt_out")vi.mocked(f.ports.priorContact).mockImplementation(async()=>{f.db.records.set(`email_suppressions/${f.brief.contact.email}`,{global_suppressed:true});return false;});
  if(kind==="changed_direction"){f.authority.direction.text="Changed direction";f.retain();}
  if(kind==="expired"){f.authority.expiresAt=new Date(communicationsNow).toISOString();f.retain();}
  if(kind==="send_enabled")vi.stubEnv("BLUEPRINT_COMMUNICATIONS_SEND_ENABLED","true");
  await expect(f.save()).rejects.toThrow();expect(f.ports.write).not.toHaveBeenCalled();
 });
 it("does not claim success when the provider accepts a write but readback cannot verify it",async()=>{
  const f=await direct();vi.mocked(f.ports.find).mockResolvedValue(null);
  await expect(f.save()).rejects.toThrow("gmail_draft_readback_unverified");
  await expect(f.save()).rejects.toThrow();expect(f.ports.write).toHaveBeenCalledOnce();
 });
 it("restarts through the same durable action and excludes historical manual copies",async()=>{
  const f=await direct();vi.stubEnv("BLUEPRINT_COMMUNICATIONS_WORKER_ENABLED","true");
  await runCommunicationsGmailDraftCopies(f.db,()=>communicationsNow,f.ports);
  expect(f.ports.write).toHaveBeenCalledOnce();
  await runCommunicationsGmailDraftCopies(f.db,()=>communicationsNow,f.ports);expect(f.ports.write).toHaveBeenCalledOnce();
  const old=await direct();delete old.db.records.get(`${old.root}/jobs/${old.job.jobId}`).checkpoint.sameRunDraftSave;
  await runCommunicationsGmailDraftCopies(old.db,()=>communicationsNow,old.ports);expect(old.ports.write).not.toHaveBeenCalled();
 });
 it("preserves a manually edited copy rather than overwriting it on a later run",async()=>{
  const f=await direct();await f.save();vi.mocked(f.ports.find).mockRejectedValue(Error("gmail_draft_readback_content_changed"));
  await expect(f.save()).rejects.toThrow("gmail_draft_unknown_acknowledgement_reconcile_exact_job");expect(f.ports.write).toHaveBeenCalledOnce();
 });
 it("refuses a restart save when its active worker lap stops during contact lookup",async()=>{
  const f=await direct();vi.stubEnv("BLUEPRINT_COMMUNICATIONS_WORKER_ENABLED","true");let continuing=true;
  vi.mocked(f.ports.priorContact).mockImplementation(async()=>{continuing=false;return false;});
  await runCommunicationsGmailDraftCopies(f.db,()=>communicationsNow,f.ports,()=>continuing);
  expect(f.ports.write).not.toHaveBeenCalled();
  expect(f.db.records.get(`${f.root}/gmailDraftBindings/${f.job.jobId}`)).toMatchObject({state:"refused_before_write",providerWriteSubmitted:false});
 });
 it.each(["removed", "replaced"])("refuses a prospective profile %s during awaited contact lookup",async kind=>{
  const f=await direct();
  vi.mocked(f.ports.priorContact).mockImplementation(async()=>{
   const checkpoint=f.db.records.get(`${f.root}/jobs/${f.job.jobId}`).checkpoint;
   if(kind==="removed")delete checkpoint.sameRunDraftSave;else checkpoint.sameRunDraftSave={...f.binding,digest:"b".repeat(64)};
   return false;
  });
  await expect(f.save()).rejects.toThrow("gmail_draft_same_run_job_binding_changed");expect(f.ports.write).not.toHaveBeenCalled();
  expect(f.db.records.get(`${f.root}/gmailDraftBindings/${f.job.jobId}`)).toMatchObject({state:"refused_before_write",providerWriteSubmitted:false});
 });
});
describe("manual Gmail draft copy of the exact canonical revision",()=>{
 it("copies the explicitly scoped original null revision once and refuses unset or edited revisions",async()=>{
  const f=fixture();
  delete f.db.records.get(`action_ledger/${f.ledgerId}`).draft_revision_id;
  delete f.db.records.get(`${f.root}/jobs/${f.job.jobId}`).draftRevisionId;
  const input={...f.input,expectedRevisionId:null};
  vi.stubEnv("BLUEPRINT_COMMUNICATIONS_GMAIL_DRAFTS_ENABLED","false");
  vi.stubEnv("BLUEPRINT_COMMUNICATIONS_GMAIL_DRAFT_APPROVAL_REF","synthetic-owner-reviewed-copy");
  vi.stubEnv("BLUEPRINT_COMMUNICATIONS_GMAIL_DRAFT_APPROVED_JOB_ID",f.job.jobId);
  vi.stubEnv("BLUEPRINT_COMMUNICATIONS_GMAIL_DRAFT_APPROVED_REVIEW_DIGEST",input.expectedReviewDigest);
  for(const marker of ["","undefined","NULL"]){
   vi.stubEnv("BLUEPRINT_COMMUNICATIONS_GMAIL_DRAFT_APPROVED_REVISION_ID",marker);
   expect(configuredGmailDraftPorts(undefined,"manual_approved_copy").enabled()).toBe(false);
  }
  vi.stubEnv("BLUEPRINT_COMMUNICATIONS_GMAIL_DRAFT_APPROVED_REVISION_ID","null");
  const manual=configuredGmailDraftPorts(undefined,"manual_approved_copy");
  expect(manual.allowsRevision(f.job.jobId,f.input.expectedRevisionId,input.expectedReviewDigest)).toBe(false);
  expect(manual.allowsRevision(f.job.jobId,null,"b".repeat(64))).toBe(false);
  expect(manual.allowsRevision("b".repeat(64),null,input.expectedReviewDigest)).toBe(false);
  f.ports.enabled=manual.enabled;f.ports.allowsRevision=manual.allowsRevision;f.ports.requireCapability=manual.requireCapability;
  await mirrorCommunicationsGmailDraft(f.db,f.ledgerId,"synthetic-owner",input,f.ports,communicationsNow);
  await mirrorCommunicationsGmailDraft(f.db,f.ledgerId,"synthetic-owner",input,f.ports,communicationsNow);
  expect(f.ports.write).toHaveBeenCalledOnce();
  expect(f.db.records.get(`${f.root}/gmailDraftBindings/${f.job.jobId}`)).toMatchObject({state:"verified",revisionId:null,sent:false,approved:false});
 });
 it("admits an explicit exact approved copy with the global automated staging flag off",async()=>{
  const f=fixture();vi.stubEnv("BLUEPRINT_COMMUNICATIONS_GMAIL_DRAFTS_ENABLED","false");
  vi.stubEnv("BLUEPRINT_COMMUNICATIONS_GMAIL_DRAFT_APPROVAL_REF","owner-reviewed-compose-only");
  vi.stubEnv("BLUEPRINT_COMMUNICATIONS_GMAIL_DRAFT_APPROVED_JOB_ID",f.job.jobId);
  vi.stubEnv("BLUEPRINT_COMMUNICATIONS_GMAIL_DRAFT_APPROVED_REVISION_ID",f.input.expectedRevisionId);
  vi.stubEnv("BLUEPRINT_COMMUNICATIONS_GMAIL_DRAFT_APPROVED_REVIEW_DIGEST",f.input.expectedReviewDigest);
  const manual=configuredGmailDraftPorts(undefined,"manual_approved_copy");
  expect(configuredGmailDraftPorts().enabled()).toBe(false);
  expect(manual.enabled()).toBe(true);
  f.ports.enabled=manual.enabled;f.ports.allowsRevision=manual.allowsRevision;f.ports.requireCapability=manual.requireCapability;
  expect(await communicationsGmailDraftStatus(f.db,f.ledgerId,f.payload,f.input.expectedRevisionId,f.input.expectedReviewDigest)).toMatchObject({writesEnabled:true});
  expect(await communicationsGmailDraftStatus(f.db,`communications_${"b".repeat(64)}`,f.payload,f.input.expectedRevisionId,f.input.expectedReviewDigest)).toMatchObject({writesEnabled:false});
  expect(await communicationsGmailDraftStatus(f.db,`invalid_prefix_${f.job.jobId}`,f.payload,f.input.expectedRevisionId,f.input.expectedReviewDigest)).toMatchObject({writesEnabled:false});
  expect(await mirrorCommunicationsGmailDraft(f.db,f.ledgerId,"owner",f.input,f.ports,communicationsNow)).toMatchObject({state:"verified",sent:false,approved:false});
  await mirrorCommunicationsGmailDraft(f.db,f.ledgerId,"owner",f.input,f.ports,communicationsNow);
  expect(f.ports.write).toHaveBeenCalledTimes(1);
  expect(process.env.BLUEPRINT_COMMUNICATIONS_GMAIL_DRAFTS_ENABLED).toBe("false");
  capability.mockRejectedValueOnce(new Error("founder_draft_scope_unverified"));
  expect(await communicationsGmailDraftStatus(f.db,f.ledgerId,f.payload,f.input.expectedRevisionId,f.input.expectedReviewDigest)).toMatchObject({writesEnabled:false});
 });
 it("rechecks the exact matching compose capability before any provider write",async()=>{
  const f=fixture();vi.mocked(f.ports.requireCapability).mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("founder_draft_scope_unverified"));
  await expect(mirrorCommunicationsGmailDraft(f.db,f.ledgerId,"owner",f.input,f.ports,communicationsNow)).rejects.toThrow("gmail_draft_source_or_capability_refused_before_write");
  expect(f.ports.write).not.toHaveBeenCalled();
  expect(f.db.records.get(`${f.root}/gmailDraftBindings/${f.job.jobId}`)).toMatchObject({state:"refused_before_write",providerWriteSubmitted:false});
 });
 it("stays fully inactive by default before credential, database or Gmail calls",async()=>{
  const f=fixture();f.ports.enabled=()=>false;
  await expect(mirrorCommunicationsGmailDraft(f.db,f.ledgerId,"owner",f.input,f.ports,communicationsNow)).rejects.toThrow("gmail_draft_writes_disabled");
  expect(f.ports.requireCapability).not.toHaveBeenCalled();expect(f.ports.write).not.toHaveBeenCalled();
 });
 it("copies the saved transport/footer once, then verifies an identical replay without approval or send",async()=>{
  const f=fixture(), source=structuredClone([...f.db.records]);
  expect(await mirrorCommunicationsGmailDraft(f.db,f.ledgerId,"owner",f.input,f.ports,communicationsNow)).toMatchObject({state:"verified",draftId:"gmail-draft-1",sent:false,approved:false});
  expect(vi.mocked(f.ports.write).mock.calls[0][0].body).toBe(f.payload.transportBody);
  await mirrorCommunicationsGmailDraft(f.db,f.ledgerId,"owner",f.input,f.ports,communicationsNow);
  expect(f.ports.write).toHaveBeenCalledTimes(1);
  expect([...f.db.records].filter(([path])=>!path.includes("/gmailDraftBindings/"))).toEqual(source);
 });
 it("keeps the approved verified copy unchanged when a later canonical revision appears",async()=>{
  const f=fixture();await mirrorCommunicationsGmailDraft(f.db,f.ledgerId,"owner",f.input,f.ports,communicationsNow);
  const payload=structuredClone(f.payload);payload.communications.output.body+=" Thank you.";payload.body=payload.communications.output.body;
  payload.transportBody=appendFirstContactFooter(payload.body,f.brief.contact.email);
  const reviewDigest=reviewCommunicationsPayload(payload,communicationsNow).digest!, revisionId="b".repeat(64);
  f.db.records.set(`action_ledger/${f.ledgerId}`,{...f.db.records.get(`action_ledger/${f.ledgerId}`),action_payload:payload,draft_revision_id:revisionId});
  f.db.records.set(`${f.root}/jobs/${f.job.jobId}`,{...f.db.records.get(`${f.root}/jobs/${f.job.jobId}`),output:payload.communications.output,reviewDigest,draftRevisionId:revisionId});
  f.db.records.set(`${f.root}/draftRevisions/${revisionId}`,{ledgerId:f.ledgerId,jobId:f.job.jobId,output:payload.communications.output});
  const input={expectedReviewDigest:reviewDigest,expectedRevisionId:revisionId,mode:"write"};
  await expect(mirrorCommunicationsGmailDraft(f.db,f.ledgerId,"owner",input,f.ports,communicationsNow)).rejects.toThrow("approved_copy_already_exists");
  expect(f.ports.write).toHaveBeenCalledTimes(1);
 });
 it("admits only the configured job, immutable revision and reviewed payload before mailbox access",async()=>{
  const f=fixture();vi.stubEnv("BLUEPRINT_COMMUNICATIONS_GMAIL_DRAFTS_ENABLED","true");
  vi.stubEnv("BLUEPRINT_COMMUNICATIONS_GMAIL_DRAFT_APPROVAL_REF","BP-APPROVAL-GMAIL-DRAFT-20261002-TONY");
  const configured=configuredGmailDraftPorts();expect(configured.enabled()).toBe(false);
  vi.stubEnv("BLUEPRINT_COMMUNICATIONS_GMAIL_DRAFT_APPROVED_JOB_ID",f.job.jobId);
  vi.stubEnv("BLUEPRINT_COMMUNICATIONS_GMAIL_DRAFT_APPROVED_REVISION_ID",f.input.expectedRevisionId);
  vi.stubEnv("BLUEPRINT_COMMUNICATIONS_GMAIL_DRAFT_APPROVED_REVIEW_DIGEST",f.input.expectedReviewDigest);
  f.ports.enabled=configured.enabled;f.ports.allowsRevision=configured.allowsRevision;
  expect(await communicationsGmailDraftStatus(f.db,f.ledgerId,f.payload,f.input.expectedRevisionId,f.input.expectedReviewDigest)).toMatchObject({writesEnabled:true,state:"not_copied"});
  for(const input of [{...f.input,expectedRevisionId:"b".repeat(64)},{...f.input,expectedReviewDigest:"b".repeat(64)}]) {
   await expect(mirrorCommunicationsGmailDraft(f.db,f.ledgerId,"owner",input,f.ports,communicationsNow)).rejects.toThrow("outside_approved_revision_window");
  }
  await expect(mirrorCommunicationsGmailDraft(f.db,`communications_${"b".repeat(64)}`,"owner",f.input,f.ports,communicationsNow)).rejects.toThrow("outside_approved_revision_window");
  expect(f.ports.requireCapability).not.toHaveBeenCalled();expect(f.ports.write).not.toHaveBeenCalled();
  expect(await mirrorCommunicationsGmailDraft(f.db,f.ledgerId,"owner",f.input,f.ports,communicationsNow)).toMatchObject({state:"verified"});
  expect(await communicationsGmailDraftStatus(f.db,f.ledgerId,f.payload,f.input.expectedRevisionId,f.input.expectedReviewDigest)).toMatchObject({writesEnabled:true,state:"verified",currentRevisionVerified:true});
 });
 it("recovers an unknown create acknowledgement through exact readback and never creates twice",async()=>{
  const f=fixture();vi.mocked(f.ports.write).mockImplementationOnce(async content=>{f.setCopied(content);throw new Error("connection ended after accepted draft create");});
  await expect(mirrorCommunicationsGmailDraft(f.db,f.ledgerId,"owner",f.input,f.ports,communicationsNow)).rejects.toThrow("unknown_acknowledgement");
  expect(await mirrorCommunicationsGmailDraft(f.db,f.ledgerId,"owner",f.input,f.ports,communicationsNow)).toMatchObject({state:"verified",sent:false});
  expect(f.ports.write).toHaveBeenCalledTimes(1);
 });
 it("retains an accepted draft ID before a failed readback and reconciles only that copy",async()=>{
  const f=fixture();vi.mocked(f.ports.find).mockRejectedValueOnce(new Error("readback failed after accepted create"));
  await expect(mirrorCommunicationsGmailDraft(f.db,f.ledgerId,"owner",f.input,f.ports,communicationsNow)).rejects.toThrow("unknown_acknowledgement");
  expect(f.db.records.get(`${f.root}/gmailDraftBindings/${f.job.jobId}`)).toMatchObject({state:"unknown",draftId:f.receipt.draftId,providerWriteSubmitted:true,providerAcceptedAt:expect.any(Number)});
  expect(await mirrorCommunicationsGmailDraft(f.db,f.ledgerId,"owner",{...f.input,mode:"reconcile"},f.ports,communicationsNow)).toMatchObject({state:"verified",draftId:f.receipt.draftId});
  expect(vi.mocked(f.ports.find).mock.calls.at(-1)?.[1]).toBe(f.receipt.draftId);expect(f.ports.write).toHaveBeenCalledTimes(1);
 });
 it("keeps a missing unknown draft unresolved instead of another POST",async()=>{
  const f=fixture();vi.mocked(f.ports.write).mockRejectedValueOnce(new Error("unknown acknowledgement"));
  await expect(mirrorCommunicationsGmailDraft(f.db,f.ledgerId,"owner",f.input,f.ports,communicationsNow)).rejects.toThrow();
  expect(await mirrorCommunicationsGmailDraft(f.db,f.ledgerId,"owner",f.input,f.ports,communicationsNow)).toMatchObject({state:"unknown"});expect(f.ports.write).toHaveBeenCalledTimes(1);
 });
 it.each(["revision","suppressed","sent"])("refuses a %s source before Gmail mutation",async reason=>{
  const f=fixture();if(reason==="revision")f.input.expectedReviewDigest="b".repeat(64);
  if(reason==="suppressed")f.db.records.set(`email_suppressions/${f.brief.contact.email.toLowerCase()}`,{global_suppressed:true});
  if(reason==="sent")f.db.records.set(`${f.root}/sendReceipts/${communicationsDeliveryKey(f.job)}`,{state:"unknown"});
  await expect(mirrorCommunicationsGmailDraft(f.db,f.ledgerId,"owner",f.input,f.ports,communicationsNow)).rejects.toThrow();expect(f.ports.write).not.toHaveBeenCalled();
 });
 it("retains a known pre-write refusal without pretending a provider acknowledgement is unknown",async()=>{
  const f=fixture();vi.mocked(f.ports.priorContact).mockResolvedValueOnce(true);
  await expect(mirrorCommunicationsGmailDraft(f.db,f.ledgerId,"owner",f.input,f.ports,communicationsNow)).rejects.toThrow("prior_contact_requires_reply_context");
  expect(f.ports.write).not.toHaveBeenCalled();expect(f.db.records.get(`${f.root}/gmailDraftBindings/${f.job.jobId}`)).toMatchObject({state:"refused_before_write",providerWriteSubmitted:false});
  expect(await mirrorCommunicationsGmailDraft(f.db,f.ledgerId,"owner",f.input,f.ports,communicationsNow)).toMatchObject({state:"verified"});expect(f.ports.write).toHaveBeenCalledTimes(1);
 });
 it("preserves rewritten Gmail Message-ID provenance with exact identity/body and refuses changed copies",async()=>{
  const f=fixture();let full:any=null;
  const api:any={users:{drafts:{create:vi.fn(async(params:any,options:any)=>{
   expect(options.retry).toBe(false);const raw=Buffer.from(params.requestBody.message.raw,"base64url").toString("utf8"),[headerText,body]=raw.split("\r\n\r\n");
   const headers=headerText.split("\r\n").map(line=>{const at=line.indexOf(":");return{name:line.slice(0,at),value:line.slice(at+1).trim()};});
   full={id:"draft-1",message:{id:"message-1",threadId:"thread-1",labelIds:["DRAFT"],payload:{mimeType:"text/plain",headers,body:{data:Buffer.from(body,"base64").toString("base64url")}}}};return{data:{id:"draft-1"}};
  }),get:vi.fn(async()=>({data:full})),send:vi.fn()},messages:{send:vi.fn()}}};
  const ports=configuredGmailDraftPorts(api), content:any={jobId:f.job.jobId,reviewDigest:f.input.expectedReviewDigest,payloadDigest:"c".repeat(64),to:f.payload.to,subject:f.payload.subject,body:f.payload.transportBody,messageId:`<blueprint-draft-${f.job.jobId}@tryblueprint.io>`};
  await ports.write(content);
  // Observed live shape: Gmail rewrites this one transport field; the eight
  // headers stay unique and every stable identity/body predicate still matches.
  const messageId=full.message.payload.headers.find((header:any)=>header.name==="Message-ID");messageId.value="<gmail-rewritten.20261002@mail.gmail.com>";
  expect(await ports.find(content,"draft-1")).toEqual({draftId:"draft-1",messageId:"message-1",threadId:"thread-1",authoredRfcMessageId:content.messageId,observedRfcMessageId:messageId.value});
  messageId.value="invalid-message-id";await expect(ports.find(content,"draft-1")).rejects.toThrow("readback_content_changed");messageId.value="<gmail-rewritten.20261002@mail.gmail.com>";
  for(const name of ["Cc","Bcc","To"]){
   full.message.payload.headers.push({name,value:"extra@example.reserved.invalid"});
   await expect(ports.find(content,"draft-1")).rejects.toThrow("readback_content_changed");full.message.payload.headers.pop();
  }
  full.message.payload.parts=[{mimeType:"application/pdf",filename:"added.pdf",body:{attachmentId:"fixture-attachment"}}];
  await expect(ports.find(content,"draft-1")).rejects.toThrow("readback_content_changed");delete full.message.payload.parts;
  for(const changedBody of [content.body+"\n",content.body.replace("Synthetic test location","Changed test location")]){
   full.message.payload.body.data=Buffer.from(changedBody).toString("base64url");await expect(ports.find(content,"draft-1")).rejects.toThrow("readback_content_changed");
  }
  full.message.payload.body.data=Buffer.from(content.body).toString("base64url");
  const from=full.message.payload.headers.find((header:any)=>header.name==="From");from.value+=" attacker@example.reserved.invalid";
  await expect(ports.find(content,"draft-1")).rejects.toThrow("readback_content_changed");expect(api.users.drafts.send).not.toHaveBeenCalled();expect(api.users.messages.send).not.toHaveBeenCalled();
 });
 it.each(["named", "inbox", "dated", "future", "direct"] as const)("copies natural %s paragraphs/signature as exact plain text and escaped HTML, then verifies both alternatives",async kind=>{
  const f=fixture(), founder=founderOutreachFixture(kind === "direct" ? "named" : kind);let full:any;
  const api:any={users:{drafts:{create:vi.fn(async({requestBody}:any,options:any)=>{
   expect(options.retry).toBe(false);
   const raw=Buffer.from(requestBody.message.raw,"base64url").toString("utf8");
   const at=raw.indexOf("\r\n\r\n"), headerText=raw.slice(0,at);
   const headers=headerText.split("\r\n").map(line=>{const i=line.indexOf(":");return{name:line.slice(0,i),value:line.slice(i+1).trim()};});
   const boundary=/boundary="([^"]+)"/.exec(headerText)![1];
   const parts=raw.slice(at+4).split(`--${boundary}`).slice(1,-1).map(part=>{
    const split=part.indexOf("\r\n\r\n"), mimeType=/Content-Type: ([^;]+)/.exec(part)![1];
    return{mimeType,body:{data:Buffer.from(part.slice(split+4).trim(),"base64").toString("base64url")}};
   });
   full={id:"rich-draft",message:{id:"rich-message",threadId:"rich-thread",labelIds:["DRAFT"],payload:{mimeType:"multipart/alternative",headers,parts}}};
   return{data:{id:full.id}};
  }),get:vi.fn(async()=>({data:full})),send:vi.fn()},messages:{send:vi.fn()}}};
  const ports=configuredGmailDraftPorts(api), content:any={jobId:f.job.jobId,reviewDigest:f.input.expectedReviewDigest,payloadDigest:"c".repeat(64),
   to:f.payload.to,subject:founder.output.subject,
   body:appendFirstContactFooter(founder.output.body,f.brief.contact.email)+"\n<unsafe>&\"'",messageId:`<blueprint-draft-${f.job.jobId}@tryblueprint.io>`,mimeProfile:kind === "direct" ? "multipart-signature-link-v2" : "multipart-alternative-v1"};
  await ports.write(content);
  const parts=full.message.payload.parts;
  const plain=Buffer.from(parts[0].body.data,"base64url").toString();
  if(kind === "direct")expect(plain).toContain("Nijel Hunt\nBlueprint — https://tryblueprint.io/");else expect(plain).toBe(content.body);
  const html=Buffer.from(parts[1].body.data,"base64url").toString();
  expect(html).toContain(kind === "direct" ? '<a href="https://tryblueprint.io/" style="color:#0000ee;text-decoration:underline">Blueprint</a>' : '<a href="https://tryblueprint.io/">https://tryblueprint.io</a>');
  if(kind === "direct"){expect(html.match(/<a /g)).toHaveLength(1);expect(html).not.toMatch(/<img|utm_|tracking|redirect|<button/);}
  expect(html).toContain("&lt;unsafe&gt;&amp;&quot;&#39;");expect(html).not.toContain("<unsafe>");
  expect(html).toContain("If you’d rather I don’t follow up, just let me know.");expect(html).not.toContain("Unsubscribe from");
  expect(html).toContain("<br>\n<br>\n");
  expect(html).toContain(kind === "direct" ? "Thanks,<br>\nNijel Hunt<br>\n<a" : "Thanks,<br>\nNijel Hunt<br>\nBlueprint");
  expect(html.match(/Nijel Hunt/g)).toHaveLength(1);
  expect(html).not.toMatch(/<script|<style/);
  expect(await ports.find(content,full.id)).toMatchObject({draftId:full.id,mimeProfile:content.mimeProfile,htmlSha256:createHash("sha256").update(html).digest("hex")});
  const original=structuredClone(full);
  for(const change of ["html","plain","attachment","root_attachment","duplicate","recipient"]){
   full=structuredClone(original);
   if(change==="html")full.message.payload.parts[1].body.data=Buffer.from(html.replace("https://tryblueprint.io/","https://changed.example/")).toString("base64url");
   if(change==="plain")full.message.payload.parts[0].body.data=Buffer.from(content.body+"\n").toString("base64url");
   if(change==="attachment")full.message.payload.parts[1].body.attachmentId="hidden-attachment";
   if(change==="root_attachment")full.message.payload.headers.push({name:"Content-Disposition",value:"attachment"});
   if(change==="duplicate")full.message.payload.parts.push(structuredClone(parts[1]));
   if(change==="recipient")full.message.payload.headers.push({name:"Cc",value:"extra@example.reserved.invalid"});
   await expect(ports.find(content,full.id)).rejects.toThrow("readback_content_changed");
  }
  expect(api.users.drafts.create).toHaveBeenCalledOnce();expect(api.users.drafts.send).not.toHaveBeenCalled();expect(api.users.messages.send).not.toHaveBeenCalled();
 });
 it("recovers a legacy unknown copy by exact recipient/subject and stable headers, refusing duplicates or incomplete inventory",async()=>{
  const f=fixture();let content:any;
  vi.mocked(f.ports.write).mockImplementationOnce(async value=>{content=structuredClone(value);throw new Error("legacy lost create acknowledgement");});
  await expect(mirrorCommunicationsGmailDraft(f.db,f.ledgerId,"owner",f.input,f.ports,communicationsNow)).rejects.toThrow("unknown_acknowledgement");
  // Retained pre-profile attempts remain exact text/plain observations.
  delete content.mimeProfile; delete f.db.records.get(`${f.root}/gmailDraftBindings/${f.job.jobId}`).content.mimeProfile;
  const full:any={id:"existing-draft",message:{id:"existing-message",threadId:"existing-thread",labelIds:["DRAFT"],payload:{mimeType:"text/plain",body:{data:Buffer.from(content.body).toString("base64url")},headers:[
   {name:"From",value:"Nijel Hunt <nijel@tryblueprint.io>"},{name:"To",value:content.to},{name:"Reply-To",value:"nijel@tryblueprint.io"},{name:"Subject",value:content.subject},
   {name:"Message-ID",value:"<gmail-rewritten.20261002@mail.gmail.com>"},{name:"X-Blueprint-Job-ID",value:content.jobId},{name:"X-Blueprint-Review-Digest",value:content.reviewDigest},{name:"X-Blueprint-Payload-Digest",value:content.payloadDigest},
  ]}}};
  let candidates:any={drafts:[{id:full.id}]};
  const api:any={users:{drafts:{list:vi.fn(async({q}:any)=>({data:q.startsWith("rfc822msgid:")
   ? {drafts:candidates.drafts.filter((d:any)=>d.id==="second-copy")} : candidates})),get:vi.fn(async({id}:any)=>{
   const copy=structuredClone(full);copy.id=id;
   // Mixed transport IDs must still count as two copies of this Blueprint job.
   if(id==="second-copy")copy.message.payload.headers.find((h:any)=>h.name==="Message-ID").value=content.messageId;
   return{data:copy};
  }),create:vi.fn(),update:vi.fn(),send:vi.fn()},messages:{send:vi.fn()}}};
  f.ports.find=configuredGmailDraftPorts(api).find;
  const reconcile={...f.input,mode:"reconcile"};
  candidates={drafts:[{id:full.id}],nextPageToken:"unread-more"};await expect(mirrorCommunicationsGmailDraft(f.db,f.ledgerId,"owner",reconcile,f.ports,communicationsNow)).rejects.toThrow("candidate_inventory_incomplete");
  expect(api.users.drafts.get).not.toHaveBeenCalled();
  candidates={drafts:[{id:full.id},{id:"second-copy"}]};await expect(mirrorCommunicationsGmailDraft(f.db,f.ledgerId,"owner",reconcile,f.ports,communicationsNow)).rejects.toThrow("multiple_copies_require_reconciliation");
  expect(f.db.records.get(`${f.root}/gmailDraftBindings/${f.job.jobId}`)).toMatchObject({state:"unknown",draftId:null});
  candidates={drafts:[{id:full.id}]};
  expect(await mirrorCommunicationsGmailDraft(f.db,f.ledgerId,"owner",reconcile,f.ports,communicationsNow)).toMatchObject({state:"verified",draftId:full.id,sent:false,approved:false});
  expect(api.users.drafts.list).toHaveBeenCalledWith({userId:"me",q:`to:${JSON.stringify(content.to)} subject:${JSON.stringify(content.subject)}`,maxResults:2});
  expect(f.db.records.get(`${f.root}/gmailDraftBindings/${f.job.jobId}`).receipt).toMatchObject({authoredRfcMessageId:content.messageId,observedRfcMessageId:"<gmail-rewritten.20261002@mail.gmail.com>"});
  expect(f.ports.write).toHaveBeenCalledTimes(1);for(const method of [api.users.drafts.create,api.users.drafts.update,api.users.drafts.send,api.users.messages.send])expect(method).not.toHaveBeenCalled();
 });
 it("fences a still-running writer and needs exact process-ended proof for observation-only recovery",async()=>{
  const f=fixture();let release!:()=>void;const wait=new Promise<void>(resolve=>{release=resolve;});
  vi.mocked(f.ports.write).mockImplementationOnce(async content=>{f.setCopied(content);await wait;return{draftId:f.receipt.draftId};});
  const active=mirrorCommunicationsGmailDraft(f.db,f.ledgerId,"owner",f.input,f.ports,communicationsNow);
  await vi.waitFor(()=>expect(f.ports.write).toHaveBeenCalledTimes(1));
  expect(await mirrorCommunicationsGmailDraft(f.db,f.ledgerId,"owner",f.input,f.ports,communicationsNow)).toMatchObject({state:"writing"});
  const binding=f.db.records.get(`${f.root}/gmailDraftBindings/${f.job.jobId}`);
  await expect(reconcileEndedGmailDraftWriter(f.db,f.job.jobId,"wrong-attempt","owner","operations/process-ended")).rejects.toThrow();
  release();await active;expect(f.ports.write).toHaveBeenCalledTimes(1);expect(binding.state).toBe("writing");
 });
});
