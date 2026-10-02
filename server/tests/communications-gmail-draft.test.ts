// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../../client/src/lib/firebaseAdmin", () => ({ dbAdmin: null, authAdmin: null, default: {} }));
const capability = vi.hoisted(() => vi.fn());
vi.mock("../agents/communications-oauth-store", () => ({ requireFounderDraftCapability: capability }));
import { communicationsFixture, communicationsNow, memoryFirestore } from "./fixtures/communications";
import { appendFirstContactFooter } from "../agents/communications-first-contact-footer";
import { communicationsDeliveryKey } from "../agents/communications-contract";
import { reviewCommunicationsPayload } from "../agents/communications-review";
import { mirrorCommunicationsGmailDraft, reconcileEndedGmailDraftWriter, configuredGmailDraftPorts, communicationsGmailDraftStatus, type GmailDraftPorts } from "../agents/communications-gmail-draft";
beforeEach(()=>{vi.stubEnv("BLUEPRINT_COMMUNICATIONS_FIRST_CONTACT_POSTAL_LINE","Blueprint Robotics, Inc. · Synthetic test location, ZZ 00000");capability.mockReset().mockResolvedValue(undefined);});
afterEach(()=>vi.unstubAllEnvs());
function fixture() {
 const {job,brief,handoff,output}=communicationsFixture(), ledgerId=`communications_${job.jobId}`;
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
 const receipt={draftId:"gmail-draft-1",messageId:"gmail-message-1",threadId:"gmail-thread-1"};
 const ports:GmailDraftPorts={enabled:()=>true,allowsRevision:()=>true,requireCapability:vi.fn(async()=>{}),verifyMailbox:vi.fn(async()=>{}),priorContact:vi.fn(async()=>false),write:vi.fn(async content=>{copied=structuredClone(content);return{draftId:receipt.draftId};}),find:vi.fn(async content=>copied&&content.payloadDigest===copied.payloadDigest?receipt:null)};
 const input={expectedReviewDigest:reviewDigest,expectedRevisionId:revisionId,mode:"write"};
 return{db,job,brief,ledgerId,input,ports,payload,root,receipt,setCopied:(v:any)=>{copied=v;}};
}
describe("manual Gmail draft copy of the exact canonical revision",()=>{
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
 it("uses Gmail draft create/get only, preserves headers/footer and refuses a changed sender",async()=>{
  const f=fixture();let full:any=null;
  const api:any={users:{drafts:{create:vi.fn(async(params:any,options:any)=>{
   expect(options.retry).toBe(false);const raw=Buffer.from(params.requestBody.message.raw,"base64url").toString("utf8"),[headerText,body]=raw.split("\r\n\r\n");
   const headers=headerText.split("\r\n").map(line=>{const at=line.indexOf(":");return{name:line.slice(0,at),value:line.slice(at+1).trim()};});
   full={id:"draft-1",message:{id:"message-1",threadId:"thread-1",labelIds:["DRAFT"],payload:{mimeType:"text/plain",headers,body:{data:Buffer.from(body,"base64").toString("base64url")}}}};return{data:{id:"draft-1"}};
  }),get:vi.fn(async()=>({data:full})),send:vi.fn()},messages:{send:vi.fn()}}};
  const ports=configuredGmailDraftPorts(api), content:any={jobId:f.job.jobId,reviewDigest:f.input.expectedReviewDigest,payloadDigest:"c".repeat(64),to:f.payload.to,subject:f.payload.subject,body:f.payload.transportBody,messageId:`<blueprint-draft-${f.job.jobId}@tryblueprint.io>`};
  await ports.write(content);expect(await ports.find(content,"draft-1")).toEqual({draftId:"draft-1",messageId:"message-1",threadId:"thread-1"});
  for(const name of ["Cc","Bcc","To"]){
   full.message.payload.headers.push({name,value:"extra@example.reserved.invalid"});
   await expect(ports.find(content,"draft-1")).rejects.toThrow("readback_content_changed");full.message.payload.headers.pop();
  }
  full.message.payload.parts=[{mimeType:"application/pdf",filename:"added.pdf",body:{attachmentId:"fixture-attachment"}}];
  await expect(ports.find(content,"draft-1")).rejects.toThrow("readback_content_changed");delete full.message.payload.parts;
  const from=full.message.payload.headers.find((header:any)=>header.name==="From");from.value+=" attacker@example.reserved.invalid";
  await expect(ports.find(content,"draft-1")).rejects.toThrow("readback_content_changed");expect(api.users.drafts.send).not.toHaveBeenCalled();expect(api.users.messages.send).not.toHaveBeenCalled();
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
