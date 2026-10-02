import { randomUUID } from "node:crypto";
import { z } from "zod";
import { type gmail_v1 } from "googleapis";
import { communicationsDigest, communicationsDeliveryKey, communicationsEnvelopeSchema, FOUNDER_MAILBOX, verifyCommunicationsHandoff, communicationsBriefSchema } from "./communications-contract";
import { reviewCommunicationsPayload } from "./communications-review";
import { COMMUNICATIONS_ROOT } from "./communications-store";
import { existingFounderGmail, verifyFounderMailbox } from "./communications-gmail";
import { requireFounderDraftCapability } from "./communications-oauth-store";
import { extractHeader, extractPlainTextBody } from "../utils/human-reply-gmail";

const hash = z.string().regex(/^[a-f0-9]{64}$/);
const requestSchema = z.object({ expectedReviewDigest: hash, expectedRevisionId: hash.nullable(), mode: z.enum(["write", "reconcile"]).default("write") }).strict();
type DraftContent = { jobId: string; reviewDigest: string; payloadDigest: string; to: string; subject: string; body: string; messageId: string; threadId?: string; inReplyTo?: string };
export type GmailDraftPorts = {
  enabled(): boolean; requireCapability(): Promise<void>; verifyMailbox(): Promise<unknown>;
  priorContact(email: string): Promise<boolean>;
  find(content: DraftContent, draftId?: string): Promise<{ draftId: string; messageId: string; threadId: string } | null>;
  write(content: DraftContent, draftId?: string): Promise<{ draftId: string }>;
};
export class CommunicationsGmailDraftError extends Error { constructor(message: string, public status = 409) { super(message); } }
const fail = (message: string): never => { throw new CommunicationsGmailDraftError(message); };
const same = (a: unknown, b: unknown) => communicationsDigest(a) === communicationsDigest(b);

/** Manual, disabled-by-default delivery copy of an existing canonical revision.
 * No generation, approval, scheduler, draft/send endpoint or new first contact. */
export async function mirrorCommunicationsGmailDraft(db: FirebaseFirestore.Firestore, ledgerId: string, requestedBy: string,
  requestValue: unknown, ports: GmailDraftPorts = configuredGmailDraftPorts(), now = Date.now()) {
  if (!ports.enabled()) throw new CommunicationsGmailDraftError("gmail_draft_writes_disabled", 503);
  if (!requestedBy.trim() || requestedBy === "unknown-operator" || !/^communications_[a-f0-9]{64}$/.test(ledgerId)) fail("gmail_draft_operator_and_job_required");
  const request = requestSchema.parse(requestValue);
  await ports.requireCapability(); await ports.verifyMailbox();
  const root = db.doc(COMMUNICATIONS_ROOT), ledgerRef = db.collection("action_ledger").doc(ledgerId);
  const draftRef = root.collection("gmailDraftBindings").doc(ledgerId.slice("communications_".length));
  const attemptId = randomUUID();
  const planned = await db.runTransaction(async tx => {
    const ledger = (await tx.get(ledgerRef)).data(); if (!ledger) fail("gmail_draft_canonical_ledger_missing");
    const envelope = communicationsEnvelopeSchema.parse(ledger!.action_payload?.communications), { job, brief, output } = envelope;
    const payload = ledger!.action_payload;
    const [native, prospect, handoff, receipt, prior, suppression, canonicalBrief, revision, firstTouch] = await Promise.all([
      tx.get(root.collection("jobs").doc(job.jobId)), tx.get(db.collection("outboundProspects").doc(job.prospectId)),
      tx.get(root.collection("handoffs").doc(job.briefDigest)), tx.get(root.collection("sendReceipts").doc(communicationsDeliveryKey(job))),
      tx.get(draftRef), tx.get(db.collection("email_suppressions").doc(brief.contact.email.toLowerCase())),
      tx.get(root.collection("briefs").doc(job.briefId)), request.expectedRevisionId ? tx.get(root.collection("draftRevisions").doc(request.expectedRevisionId)) : Promise.resolve(null),
      tx.get(root.collection("firstTouches").doc(communicationsDeliveryKey(job))),
    ]);
    const saved = native.data(), source = prospect.data(), suppressed = suppression.data();
    if (ledger!.action_type !== "send_email" || ledger!.action_tier !== 3 || ledger!.lane !== "outbound_prospect"
      || ledger!.source_collection !== "outboundProspects" || ledger!.source_doc_id !== job.prospectId
      || ledgerId !== `communications_${job.jobId}` || ledger!.status !== "pending_approval" || saved?.state !== "pending_approval"
      || saved.ledgerId !== ledgerId || !same(saved.output, output) || saved.briefDigest !== job.briefDigest
      || ledger!.approved_by || ledger!.approved_at || ledger!.sent_at || ledger!.last_execution_at || ledger!.execution_attempts > 0
      || receipt.exists || ledger!.first_contact_authority || (saved.lease?.until ?? 0) > now
      || !same(communicationsBriefSchema.parse(canonicalBrief.data()), brief)
      || (revision && (!revision.exists || revision.data()?.ledgerId !== ledgerId || revision.data()?.jobId !== job.jobId || !same(revision.data()?.output, output)))
      || (job.intent === "outreach" && firstTouch.exists && firstTouch.data()?.jobId !== job.jobId)
      || !source || source.siteId !== brief.siteId || source.taskId !== brief.taskId || source.caseId !== brief.caseId || source.contactEmail?.toLowerCase() !== brief.contact.email.toLowerCase()
      || source.communications?.jobId !== job.jobId || source.communications?.briefDigest !== job.briefDigest
      || ["closed", "converted"].includes(source.stage) || ["unknown", "opted_out"].includes(brief.consent.status)
      || suppressed?.global_suppressed === true || suppressed?.suppressed_scopes?.some((scope: string) => ["all", "growth_campaign"].includes(scope))) fail("gmail_draft_source_suppressed_sent_or_changed");
    verifyCommunicationsHandoff(handoff.data(), brief);
    const review = reviewCommunicationsPayload(payload, now);
    if (!review.hardChecksPassed || review.digest !== request.expectedReviewDigest || saved.reviewDigest !== review.digest
      || (ledger!.draft_revision_id ?? null) !== request.expectedRevisionId || (saved.draftRevisionId ?? null) !== request.expectedRevisionId) fail("gmail_draft_revision_changed_reload_approvals");
    const content: DraftContent = { jobId: job.jobId, reviewDigest: review.digest!, payloadDigest: communicationsDigest(payload),
      to: payload.to, subject: payload.subject, body: payload.transportBody,
      messageId: `<blueprint-draft-${job.jobId}@tryblueprint.io>`,
      ...(payload.gmailThreadId ? { threadId: payload.gmailThreadId } : {}), ...(payload.inReplyTo ? { inReplyTo: payload.inReplyTo } : {}) };
    const old = prior.data();
    if (old && (old.jobId !== job.jobId || old.ledgerId !== ledgerId || old.prospectId !== job.prospectId)) fail("gmail_draft_binding_identity_changed");
    if (old?.state === "writing") return { state: "writing" as const, content, old };
    if (old?.state === "unknown" || old?.state === "verified" && same(old.content, content)) return { state: "reconcile" as const, content: old.content as DraftContent, old };
    if (request.mode === "reconcile") return { state: "absent" as const, content, old };
    if (old && !["verified", "refused_before_write"].includes(old.state)) fail("gmail_draft_binding_requires_reconciliation");
    const row = { version: "blueprint.communications-gmail-draft-binding.v1", jobId: job.jobId, ledgerId, prospectId: job.prospectId,
      state: "writing", attemptId, content, deliveryKey: communicationsDeliveryKey(job), revisionId: request.expectedRevisionId, requestedBy, claimedAt: now,
      draftId: old?.draftId ?? null, confirmedContent: old?.state === "verified" ? old.content : old?.confirmedContent ?? null, confirmedReceipt: old?.receipt ?? old?.confirmedReceipt ?? null,
      sent: false, approved: false };
    tx.set(draftRef, row); return { state: "claimed" as const, content, old: row };
  });
  if (planned.state === "writing") return { state: "writing", sent: false, gmailDraftCreated: false };
  if (planned.state === "absent") return { state: "absent", sent: false, gmailDraftCreated: false };
  let submitted = false;
  const mark = async (state: "verified" | "unknown" | "refused_before_write", receipt: unknown = null) => db.runTransaction(async tx => {
    const current = (await tx.get(draftRef)).data();
    if (!current || current.attemptId !== planned.old.attemptId || !same(current.content, planned.content)
      || !["writing", "unknown", "verified"].includes(current.state)) fail("gmail_draft_writer_changed");
    if (state !== "verified" && current.state !== "writing") return;
    tx.update(draftRef, { state, ...(state === "verified" ? { receipt, draftId: (receipt as any).draftId, verifiedAt: Date.now() } : state === "unknown" ? { uncertainAt: Date.now(), providerWriteSubmitted: true }
        : { refusedAt: Date.now(), providerWriteSubmitted: false, refusal: "source_or_capability_refused_before_write" }) });
  });
  try {
    if (planned.state === "claimed") {
      // Check immediately before a provider write. Prior contact excludes this
      // draft's own DRAFT copy, so later edits do not become false first contact.
      if (!planned.content.threadId && await ports.priorContact(planned.content.to)) fail("gmail_draft_prior_contact_requires_reply_context");
      if (!ports.enabled()) fail("gmail_draft_writes_disabled");
      await ports.requireCapability();
      const [liveLedger, liveJob, liveReceipt, liveSource, liveSuppression] = await Promise.all([
        ledgerRef.get(), root.collection("jobs").doc(planned.content.jobId).get(),
        root.collection("sendReceipts").doc(planned.old.deliveryKey).get(),
        db.collection("outboundProspects").doc(planned.old.prospectId).get(), db.collection("email_suppressions").doc(planned.content.to).get(),
      ]);
      const currentLedger=liveLedger.data(), currentSource=liveSource.data(), currentSuppression=liveSuppression.data();
      if (!ports.enabled() || currentLedger?.status!=="pending_approval" || currentLedger.approved_by || currentLedger.approved_at
        || currentLedger.sent_at || currentLedger.execution_attempts>0 || currentLedger.last_execution_at
        || communicationsDigest(currentLedger.action_payload)!==planned.content.payloadDigest
        || liveJob.data()?.state!=="pending_approval" || liveReceipt.exists || currentSource?.contactEmail?.toLowerCase()!==planned.content.to
        || ["closed","converted"].includes(currentSource?.stage) || currentSuppression?.global_suppressed===true
        || currentSuppression?.suppressed_scopes?.some((scope:string)=>["all","growth_campaign"].includes(scope))) fail("gmail_draft_source_changed_before_write");
      if (planned.old.draftId && !await ports.find(planned.old.confirmedContent, planned.old.draftId)) fail("gmail_draft_previous_copy_changed_manual_reconciliation_required");
      submitted = true;
      const written = await ports.write(planned.content, planned.old.draftId ?? undefined);
      const receipt = await ports.find(planned.content, written.draftId);
      if (!receipt) fail("gmail_draft_readback_unverified");
      await mark("verified", receipt);
      return { state: "verified", draftId: receipt.draftId, reviewDigest: planned.content.reviewDigest, revisionId: planned.old.revisionId, sent: false, approved: false };
    }
    // Unknown create/update is observation-only, including a process restart.
    const receipt = await ports.find(planned.content, planned.old.draftId ?? undefined);
    if (!receipt) return { state: "unknown", sent: false, gmailDraftCreated: false };
    await mark("verified", receipt);
    return { state: "verified", draftId: receipt.draftId, reviewDigest: planned.content.reviewDigest, revisionId: planned.old.revisionId, sent: false, approved: false };
  } catch (error) {
    if (planned.state === "claimed") await mark(submitted ? "unknown" : "refused_before_write");
    if (error instanceof CommunicationsGmailDraftError) throw error;
    throw new CommunicationsGmailDraftError("gmail_draft_unknown_acknowledgement_reconcile_exact_job", 503);
  }
}

/** Read-only canonical metadata for the existing Approvals queue. This never
 * calls Gmail or mistakes a prior verification for fresh mailbox observation. */
export async function communicationsGmailDraftStatus(db: FirebaseFirestore.Firestore, ledgerId: string, payload: Record<string, unknown>) {
  const writesEnabled=process.env.BLUEPRINT_COMMUNICATIONS_GMAIL_DRAFTS_ENABLED === "true"
    && Boolean(process.env.BLUEPRINT_COMMUNICATIONS_GMAIL_DRAFT_APPROVAL_REF);
  const base={writesEnabled, state:"unavailable", draftId:null as string|null, verifiedAt:null as string|null, currentRevisionVerified:false};
  if (!/^communications_[a-f0-9]{64}$/.test(ledgerId)) return base;
  try {
    const saved=await db.doc(COMMUNICATIONS_ROOT).collection("gmailDraftBindings").doc(ledgerId.slice("communications_".length)).get();
    if (!saved.exists) return {...base,state:"not_copied"};
    const row=saved.data()!;
    if (row.version!=="blueprint.communications-gmail-draft-binding.v1" || row.ledgerId!==ledgerId
      || row.jobId!==ledgerId.slice("communications_".length) || !["verified","writing","unknown","refused_before_write"].includes(row.state)) return base;
    const current=row.content?.payloadDigest===communicationsDigest(payload) && row.content?.to===payload.to
      && row.content?.subject===payload.subject && row.content?.body===payload.transportBody && row.content?.jobId===row.jobId;
    return {...base,state:row.state==="verified" && !current ? "stale" : row.state,
      draftId:typeof row.draftId==="string" ? row.draftId : null,
      verifiedAt:typeof row.verifiedAt==="number" && Number.isFinite(row.verifiedAt) ? new Date(row.verifiedAt).toISOString() : null,
      currentRevisionVerified:row.state==="verified" && current};
  } catch { return base; }
}

/** Operator-only recovery after proof the exact writer process ended. No TTL
 * can admit another creator while an earlier Gmail request may still finish. */
export async function reconcileEndedGmailDraftWriter(db: FirebaseFirestore.Firestore, jobId: string, attemptId: string,
  requestedBy: string, processEndedEvidenceRef: string) {
  if (!/^[a-f0-9]{64}$/.test(jobId) || !attemptId || !requestedBy || !/^[A-Za-z0-9_.:/-]{1,500}$/.test(processEndedEvidenceRef)) fail("gmail_draft_writer_recovery_evidence_required");
  const ref = db.doc(COMMUNICATIONS_ROOT).collection("gmailDraftBindings").doc(jobId);
  return db.runTransaction(async tx => {
    const current = (await tx.get(ref)).data();
    if (current?.state === "unknown" && current.attemptId === attemptId && current.processEndedEvidenceRef === processEndedEvidenceRef) return "existing";
    if (current?.state !== "writing" || current.attemptId !== attemptId) fail("gmail_draft_writer_recovery_identity_changed");
    tx.update(ref, { state: "unknown", processEndedEvidenceRef, recoveredBy: requestedBy, recoveredAt: Date.now() }); return "reconciled";
  });
}

export function configuredGmailDraftPorts(gmail?: gmail_v1.Gmail): GmailDraftPorts {
  const client = async () => gmail ??= await existingFounderGmail();
  const raw = (content: DraftContent) => {
    if ([content.to,content.subject,content.messageId,content.inReplyTo ?? ""].some(value => /[\r\n]/.test(value))) fail("gmail_draft_header_invalid");
    const headers = [`From: Nijel Hunt <${FOUNDER_MAILBOX}>`, `To: ${content.to}`, `Reply-To: ${FOUNDER_MAILBOX}`, `Message-ID: ${content.messageId}`,
      `Subject: =?UTF-8?B?${Buffer.from(content.subject).toString("base64")}?=`, `X-Blueprint-Job-ID: ${content.jobId}`,
      `X-Blueprint-Review-Digest: ${content.reviewDigest}`, `X-Blueprint-Payload-Digest: ${content.payloadDigest}`,
      "MIME-Version: 1.0", "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64",
      ...(content.inReplyTo ? [`In-Reply-To: ${content.inReplyTo}`,`References: ${content.inReplyTo}`] : [])];
    return Buffer.from(headers.join("\r\n")+"\r\n\r\n"+Buffer.from(content.body).toString("base64")).toString("base64url");
  };
  return {
    enabled: () => process.env.BLUEPRINT_COMMUNICATIONS_GMAIL_DRAFTS_ENABLED === "true" && Boolean(process.env.BLUEPRINT_COMMUNICATIONS_GMAIL_DRAFT_APPROVAL_REF),
    requireCapability: requireFounderDraftCapability, verifyMailbox: async () => verifyFounderMailbox(await client()),
    async priorContact(email) {
      const response = await (await client()).users.messages.list({ userId: "me", q: `in:anywhere -in:drafts {from:${JSON.stringify(email)} to:${JSON.stringify(email)}}`, maxResults: 1, includeSpamTrash: true });
      if (response.data.messages?.length) return true;
      if (response.data.resultSizeEstimate !== 0 || response.data.nextPageToken) fail("gmail_draft_prior_contact_unverified");
      return false;
    },
    async find(content, draftId) {
      const api=await client();
      if (!draftId) {
        const found=await api.users.drafts.list({userId:"me",q:`rfc822msgid:${content.messageId}`,maxResults:2});
        if ((found.data.drafts?.length ?? 0)>1 || found.data.nextPageToken) fail("gmail_draft_multiple_copies_require_reconciliation");
        draftId=found.data.drafts?.[0]?.id ?? undefined;
        if (!draftId) return null;
      }
      const draft=(await api.users.drafts.get({userId:"me",id:draftId,format:"full"})).data, message=draft.message, headers=message?.payload?.headers;
      const addresses=(value:string|null)=>(value?.match(/[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? []).map(address=>address.toLowerCase()).join();
      const get=(name:string)=>extractHeader(headers,name), normalize=(value:string)=>value.replace(/\r\n/g,"\n");
      const subject=(get("Subject") ?? "").replace(/=\?UTF-8\?B\?([A-Za-z0-9+/=]+)\?=/gi,(_,encoded:string)=>Buffer.from(encoded,"base64").toString("utf8"));
      if (draft.id!==draftId || !message?.id || !message.threadId || !message.labelIds?.includes("DRAFT") || message.labelIds.includes("SENT")
        || headers?.some(header=>["cc","bcc"].includes((header.name ?? "").toLowerCase()) && Boolean(header.value?.trim()))
        || ["from","to","reply-to","subject","message-id","x-blueprint-job-id","x-blueprint-review-digest","x-blueprint-payload-digest"].some(name=>headers?.filter(header=>(header.name ?? "").toLowerCase()===name).length!==1)
        || message.payload?.mimeType!=="text/plain" || Boolean(message.payload.filename) || Boolean(message.payload.body?.attachmentId)
        || (message.payload.parts?.length ?? 0)>0
        || get("Message-ID")!==content.messageId || get("X-Blueprint-Job-ID")!==content.jobId
        || get("X-Blueprint-Review-Digest")!==content.reviewDigest || get("X-Blueprint-Payload-Digest")!==content.payloadDigest
        || addresses(get("To"))!==content.to || addresses(get("From"))!==FOUNDER_MAILBOX
        || addresses(get("Reply-To"))!==FOUNDER_MAILBOX || subject!==content.subject || normalize(extractPlainTextBody(message.payload))!==normalize(content.body)
        || (content.threadId && content.threadId!==message.threadId) || (content.inReplyTo && get("In-Reply-To")!==content.inReplyTo)) fail("gmail_draft_readback_content_changed");
      return {draftId,messageId:message.id,threadId:message.threadId};
    },
    async write(content,draftId) {
      const api=await client(), requestBody={message:{raw:raw(content),...(content.threadId?{threadId:content.threadId}:{})}};
      const response=draftId ? await api.users.drafts.update({userId:"me",id:draftId,requestBody},{retry:false})
        : await api.users.drafts.create({userId:"me",requestBody},{retry:false});
      if (!response.data.id) fail("gmail_draft_create_receipt_missing");
      if (draftId && response.data.id!==draftId) fail("gmail_draft_update_identity_changed");
      return {draftId:response.data.id!};
    },
  };
}
