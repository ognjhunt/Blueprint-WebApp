import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { type gmail_v1 } from "googleapis";
import { communicationsDigest, communicationsDeliveryKey, communicationsEnvelopeSchema, FOUNDER_MAILBOX, verifyCommunicationsHandoff, communicationsBriefSchema,
  isFounderReplyOrigin } from "./communications-contract";
import { reviewCommunicationsPayload } from "./communications-review";
import { readEvaluationReadiness, siteReplyPromiseBlockers } from "./communications-readiness";
import { COMMUNICATIONS_ROOT } from "./communications-store";
import { existingFounderGmail, verifyFounderMailbox } from "./communications-gmail";
import { requireFounderDraftCapability } from "./communications-oauth-store";
import { extractHeader, extractPlainTextBody } from "../utils/human-reply-gmail";
import { resolveBundleStorage } from "../utils/siteCaptureBundleStorage";
import { logger } from "../logger";

const hash = z.string().regex(/^[a-f0-9]{64}$/);
const requestSchema = z.object({ expectedReviewDigest: hash, expectedRevisionId: hash.nullable(), mode: z.enum(["write", "reconcile"]).default("write") }).strict();
type DraftContent = { jobId: string; reviewDigest: string; payloadDigest: string; to: string; subject: string; body: string; messageId: string; mimeProfile?: "multipart-alternative-v1" | "multipart-signature-link-v2" | "multipart-founder-signature-v3"; threadId?: string; inReplyTo?: string };
export type GmailDraftPorts = {
  enabled(): boolean; requireCapability(): Promise<void>; verifyMailbox(): Promise<unknown>;
  allowsRevision(jobId: string, revisionId: string | null, reviewDigest: string): boolean;
  priorContact(email: string): Promise<boolean>;
  find(content: DraftContent, draftId?: string): Promise<{ draftId: string; messageId: string; threadId: string; authoredRfcMessageId: string; observedRfcMessageId: string } | null>;
  write(content: DraftContent, draftId?: string): Promise<{ draftId: string }>;
  copyDirection?: { ref: GmailDraftCopyDirectionRef; digest: string };
  signatureLink?: true;
  recipientDraftExists?(email: string): Promise<boolean>;
};
export type GmailDraftCopyDirectionRef = { uri: string; generation: string; sha256: string };
export type SameRunDraftSave = { version: "same-run-unsent-draft-v1"; ref: GmailDraftCopyDirectionRef; digest: string };
export type GmailDraftCopyDirection = {
  version: "blueprint.communications-gmail-draft-copy-direction.v1" | "blueprint.communications-gmail-draft-copy-direction.v2"; owner: "Nijel Hunt";
  approvedAt: string; expiresAt: string;
  direction: { kind: "direct_current_chat_human_reply"; text: string; sourceRef: string };
  binding: { mailbox: typeof FOUNDER_MAILBOX; composeApprovalReference: string };
  scope: { draftOnly: true; gmailCopiesAuthorized: true; sendsAuthorized: false; newInferenceAuthorized: false; accessChangesAuthorized: false;
    saveWithinRun?: true; prospectiveOnly?: true };
};
export class CommunicationsGmailDraftError extends Error { constructor(message: string, public status = 409) { super(message); } }
function fail(message: string): never { throw new CommunicationsGmailDraftError(message); }
const same = (a: unknown, b: unknown) => communicationsDigest(a) === communicationsDigest(b);
const recurringCopiesEnabled = () => process.env.BLUEPRINT_COMMUNICATIONS_GMAIL_DRAFTS_ENABLED === "true"
  && process.env.BLUEPRINT_COMMUNICATIONS_SEND_ENABLED !== "true"
  && process.env.BLUEPRINT_COMMUNICATIONS_AUTOMATIC_FIRST_CONTACT_ENABLED !== "true";

/** The separate protected copy direction does not change paid authority or the
 * original compose-consent reference. Nothing supplied by a model admits it. */
async function gmailDraftCopyDirection(db: FirebaseFirestore.Firestore, now: () => number) {
  const ref: GmailDraftCopyDirectionRef | undefined = (await db.doc(COMMUNICATIONS_ROOT).get()).data()?.gmailDraftCopyDirection;
  if (!ref) return null;
  const storage = resolveBundleStorage(), match = /^gs:\/\/blueprint-8c1ca\.appspot\.com\/(operations\/recovery\/[^\s]+\/agent-e2e-gmail-draft-copy-owner-direction\.json)$/.exec(ref.uri ?? "");
  if (!storage || storage.bucketName !== "blueprint-8c1ca.appspot.com" || !match
    || !/^[0-9]+$/.test(ref.generation) || !/^[a-f0-9]{64}$/.test(ref.sha256)) fail("gmail_draft_copy_direction_invalid");
  const before = await storage.info(match[1]);
  if (!before || before.generation !== ref.generation || !Number.isSafeInteger(before.size) || before.size < 1 || before.size > 32000) fail("gmail_draft_copy_direction_invalid");
  const raw = await storage.readText(match[1]), after = await storage.info(match[1]);
  if (raw === null || Buffer.byteLength(raw) !== before.size || after?.generation !== ref.generation
    || createHash("sha256").update(raw).digest("hex") !== ref.sha256) fail("gmail_draft_copy_direction_invalid");
  let authority: GmailDraftCopyDirection;
  try { authority = JSON.parse(raw); } catch { return fail("gmail_draft_copy_direction_invalid"); }
  if (!["blueprint.communications-gmail-draft-copy-direction.v1", "blueprint.communications-gmail-draft-copy-direction.v2"].includes(authority?.version) || authority.owner !== "Nijel Hunt"
    || !Number.isFinite(Date.parse(authority.approvedAt)) || Date.parse(authority.approvedAt) > now()
    || !Number.isFinite(Date.parse(authority.expiresAt)) || Date.parse(authority.expiresAt) <= now()
    || authority.direction?.kind !== "direct_current_chat_human_reply" || typeof authority.direction.text !== "string" || !authority.direction.text.trim()
    || !/^gs:\/\/blueprint-8c1ca\.appspot\.com\/operations\/recovery\//.test(authority.direction.sourceRef ?? "")
    || authority.binding?.mailbox !== FOUNDER_MAILBOX || !authority.binding.composeApprovalReference
    || authority.binding.composeApprovalReference !== process.env.BLUEPRINT_COMMUNICATIONS_GMAIL_DRAFT_APPROVAL_REF
    || authority.scope?.draftOnly !== true || authority.scope.gmailCopiesAuthorized !== true || authority.scope.sendsAuthorized !== false
    || authority.scope.newInferenceAuthorized !== false || authority.scope.accessChangesAuthorized !== false) fail("gmail_draft_copy_direction_invalid");
  const saveWithinRun = authority.version === "blueprint.communications-gmail-draft-copy-direction.v2"
    && authority.scope.saveWithinRun === true && authority.scope.prospectiveOnly === true;
  if (authority.version.endsWith(".v2") && !saveWithinRun) fail("gmail_draft_copy_direction_invalid");
  return { ref, digest: communicationsDigest(authority), expiresAt: authority.expiresAt, approvedAt: authority.approvedAt, saveWithinRun };
}

/** Prospective host action inside one communications run. Existing compose
 * consent and owner direction admit an unsent save, never inference or send. */
export async function prepareSameRunDraftSave(db: FirebaseFirestore.Firestore, now = () => Date.now(), basePorts = configuredGmailDraftPorts()): Promise<SameRunDraftSave> {
  if (process.env.BLUEPRINT_COMMUNICATIONS_SEND_ENABLED !== "false" || process.env.BLUEPRINT_COMMUNICATIONS_AUTOMATIC_FIRST_CONTACT_ENABLED !== "false") fail("gmail_draft_same_run_requires_send_off");
  const direction = await gmailDraftCopyDirection(db, now);
  if (!direction?.saveWithinRun) fail("gmail_draft_same_run_direction_missing");
  await basePorts.requireCapability(); await basePorts.verifyMailbox();
  if (!same(await gmailDraftCopyDirection(db, now), direction)) fail("gmail_draft_copy_direction_changed");
  return { version: "same-run-unsent-draft-v1", ref: direction.ref, digest: direction.digest };
}

export async function saveCommunicationsUnsentDraft(db: FirebaseFirestore.Firestore, jobId: string, bound: SameRunDraftSave,
  now = () => Date.now(), basePorts = configuredGmailDraftPorts(), canContinue = () => true) {
  if (!canContinue()) fail("gmail_draft_writes_disabled");
  const current = await prepareSameRunDraftSave(db, now, basePorts);
  if (!same(current, bound)) fail("gmail_draft_same_run_direction_changed");
  const job = (await db.doc(`${COMMUNICATIONS_ROOT}/jobs/${jobId}`).get()).data();
  const ledgerId = `communications_${jobId}`, ledger = (await db.doc(`action_ledger/${ledgerId}`).get()).data();
  // Old charged jobs never acquire this prospective action. An existing
  // manually saved draft cannot become an app copy by recovering old output.
  if (!job?.checkpoint?.sameRunDraftSave || !same(job.checkpoint.sameRunDraftSave, bound) || !ledger || !job.reviewDigest) fail("gmail_draft_same_run_job_binding_changed");
  const old = (await db.doc(`${COMMUNICATIONS_ROOT}/gmailDraftBindings/${jobId}`).get()).data();
  const ports: GmailDraftPorts = { ...basePorts, signatureLink: true, copyDirection: { ref: bound.ref, digest: bound.digest },
    enabled: () => canContinue() && process.env.BLUEPRINT_COMMUNICATIONS_SEND_ENABLED === "false" && process.env.BLUEPRINT_COMMUNICATIONS_AUTOMATIC_FIRST_CONTACT_ENABLED === "false",
    allowsRevision: (id, revision, digest) => id === jobId && revision === (ledger.draft_revision_id ?? null) && digest === job.reviewDigest,
    requireCapability: async () => {
      if (!canContinue()) fail("gmail_draft_writes_disabled");
      if (!same(await prepareSameRunDraftSave(db, now, basePorts), bound)) fail("gmail_draft_same_run_direction_changed");
      const [liveJob, liveLedger] = await Promise.all([
        db.doc(`${COMMUNICATIONS_ROOT}/jobs/${jobId}`).get(), db.doc(`action_ledger/${ledgerId}`).get(),
      ]);
      const saved = liveJob.data(), action = liveLedger.data();
      if (!canContinue()) fail("gmail_draft_writes_disabled");
      if (!saved?.checkpoint?.sameRunDraftSave || !same(saved.checkpoint.sameRunDraftSave, bound) || saved.state !== "pending_approval"
        || saved.reviewDigest !== job.reviewDigest || (saved.draftRevisionId ?? null) !== (ledger.draft_revision_id ?? null)
        || action?.status !== "pending_approval" || (action.draft_revision_id ?? null) !== (ledger.draft_revision_id ?? null)) fail("gmail_draft_same_run_job_binding_changed");
    },
    priorContact: async email => await basePorts.priorContact(email) || Boolean(await basePorts.recipientDraftExists?.(email)) };
  const result = await mirrorCommunicationsGmailDraft(db, ledgerId, "Nijel Hunt (same-run unsent draft direction)", {
    expectedReviewDigest: job.reviewDigest, expectedRevisionId: ledger.draft_revision_id ?? null,
    mode: old && ["writing", "unknown", "verified"].includes(old.state) ? "reconcile" : "write",
  }, ports, now());
  if (result.state !== "verified" || !("draftId" in result) || !result.draftId) fail("gmail_draft_same_run_readback_pending");
  return { state: "gmail_draft_saved" as const, ledgerId, gmailDraftId: result.draftId, gmailDraftCreated: true, sent: false, approved: false };
}
function draftWindowConfigured() {
  return Boolean(process.env.BLUEPRINT_COMMUNICATIONS_GMAIL_DRAFT_APPROVAL_REF?.trim())
    && ["JOB_ID", "REVIEW_DIGEST"].every(field => /^[a-f0-9]{64}$/.test(process.env[`BLUEPRINT_COMMUNICATIONS_GMAIL_DRAFT_APPROVED_${field}`] ?? ""))
    && (process.env.BLUEPRINT_COMMUNICATIONS_GMAIL_DRAFT_APPROVED_REVISION_ID === "null"
      || /^[a-f0-9]{64}$/.test(process.env.BLUEPRINT_COMMUNICATIONS_GMAIL_DRAFT_APPROVED_REVISION_ID ?? ""));
}
function draftWindowAllows(jobId: string, revisionId: string | null, reviewDigest: string) {
  // Literal "null" explicitly selects the original canonical draft. Missing or
  // empty configuration never authorizes that revision or a later edit.
  const configuredRevision = process.env.BLUEPRINT_COMMUNICATIONS_GMAIL_DRAFT_APPROVED_REVISION_ID;
  return draftWindowConfigured() && jobId === process.env.BLUEPRINT_COMMUNICATIONS_GMAIL_DRAFT_APPROVED_JOB_ID
    && revisionId === (configuredRevision === "null" ? null : configuredRevision)
    && reviewDigest === process.env.BLUEPRINT_COMMUNICATIONS_GMAIL_DRAFT_APPROVED_REVIEW_DIGEST;
}

/** Explicit delivery copy of an existing exact approved canonical revision.
 * No generation, approval, scheduler, draft/send endpoint or new first contact. */
export async function mirrorCommunicationsGmailDraft(db: FirebaseFirestore.Firestore, ledgerId: string, requestedBy: string,
  requestValue: unknown, ports: GmailDraftPorts = configuredGmailDraftPorts(), now = Date.now()) {
  if (!ports.enabled()) throw new CommunicationsGmailDraftError("gmail_draft_writes_disabled", 503);
  if (!requestedBy.trim() || requestedBy === "unknown-operator" || !/^communications_[a-f0-9]{64}$/.test(ledgerId)) fail("gmail_draft_operator_and_job_required");
  const request = requestSchema.parse(requestValue);
  if (!ports.allowsRevision(ledgerId.slice("communications_".length), request.expectedRevisionId, request.expectedReviewDigest)) fail("gmail_draft_outside_approved_revision_window");
  await ports.requireCapability(); await ports.verifyMailbox();
  const root = db.doc(COMMUNICATIONS_ROOT), ledgerRef = db.collection("action_ledger").doc(ledgerId);
  const draftRef = root.collection("gmailDraftBindings").doc(ledgerId.slice("communications_".length));
  const attemptId = randomUUID();
  const planned = await db.runTransaction(async tx => {
    const ledger = (await tx.get(ledgerRef)).data(); if (!ledger) fail("gmail_draft_canonical_ledger_missing");
    const envelope = communicationsEnvelopeSchema.parse(ledger!.action_payload?.communications), { job, brief, output } = envelope;
    const payload = ledger!.action_payload;
    const [native, prospect, handoff, receipt, prior, suppression, canonicalBrief, revision, firstTouch, founderSend, founderCheck] = await Promise.all([
      tx.get(root.collection("jobs").doc(job.jobId)), tx.get(db.collection("outboundProspects").doc(job.prospectId)),
      tx.get(root.collection("handoffs").doc(job.briefDigest)), tx.get(root.collection("sendReceipts").doc(communicationsDeliveryKey(job))),
      tx.get(draftRef), tx.get(db.collection("email_suppressions").doc(brief.contact.email.toLowerCase())),
      tx.get(root.collection("briefs").doc(job.briefId)), request.expectedRevisionId ? tx.get(root.collection("draftRevisions").doc(request.expectedRevisionId)) : Promise.resolve(null),
      tx.get(root.collection("firstTouches").doc(communicationsDeliveryKey(job))),
      tx.get(root.collection("founderSendObservations").doc(job.jobId)), tx.get(root.collection("founderSendChecks").doc(job.jobId)),
    ]);
    // Founder-sent threads are learning-only, and a founder-sent copy is
    // history: never write, update or re-verify either one.
    if (isFounderReplyOrigin(brief.replyOrigin)) fail("gmail_draft_founder_origin_reply_learning_only");
    if (founderSend.exists) fail("gmail_draft_founder_send_observed");
    // The founder may already have sent this job; a new copy could be sent twice.
    if (founderCheck.data()?.state === "requires_reconciliation") fail("gmail_draft_founder_send_requires_reconciliation");
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
    const old = prior.data();
    const content: DraftContent = { jobId: job.jobId, reviewDigest: review.digest!, payloadDigest: communicationsDigest(payload),
      to: payload.to, subject: payload.subject, body: payload.transportBody,
      messageId: `<blueprint-draft-${job.jobId}@tryblueprint.io>`,
      // A new delivery profile never relabels a retained text/plain attempt.
      ...(!old ? { mimeProfile: (ports.signatureLink || payload.communicationsDraftOnly === "founder-footerless-v2") ? "multipart-founder-signature-v3" as const : "multipart-alternative-v1" as const }
        : old.content?.mimeProfile ? { mimeProfile: old.content.mimeProfile } : {}),
      ...(payload.gmailThreadId ? { threadId: payload.gmailThreadId } : {}), ...(payload.inReplyTo ? { inReplyTo: payload.inReplyTo } : {}) };
    if (old && (old.jobId !== job.jobId || old.ledgerId !== ledgerId || old.prospectId !== job.prospectId)) fail("gmail_draft_binding_identity_changed");
    if (old?.state === "writing") return { state: request.mode === "reconcile" ? "reconcile" as const : "writing" as const, content: old.content as DraftContent, old };
    if (old?.state === "unknown" || old?.state === "verified" && same(old.content, content)) return { state: "reconcile" as const, content: old.content as DraftContent, old };
    // This window admits one preserved copy. A verified copy is observation-only;
    // changing the draft or approving another revision needs another owner scope.
    if (old?.state === "verified" || old?.draftId) fail("gmail_draft_approved_copy_already_exists");
    if (request.mode === "reconcile") return { state: "absent" as const, content, old };
    if (old && !["verified", "refused_before_write"].includes(old.state)) fail("gmail_draft_binding_requires_reconciliation");
    const row = { version: "blueprint.communications-gmail-draft-binding.v1", jobId: job.jobId, ledgerId, prospectId: job.prospectId,
      state: "writing", attemptId, content, deliveryKey: communicationsDeliveryKey(job), revisionId: request.expectedRevisionId, requestedBy, claimedAt: now,
      draftId: old?.draftId ?? null, confirmedContent: old?.state === "verified" ? old.content : old?.confirmedContent ?? null, confirmedReceipt: old?.receipt ?? old?.confirmedReceipt ?? null,
      sent: false, approved: false };
    if (ports.copyDirection) Object.assign(row, { copyDirection: ports.copyDirection });
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
      if (!ports.enabled() || !ports.allowsRevision(planned.content.jobId, planned.old.revisionId, planned.content.reviewDigest)) fail("gmail_draft_writes_disabled_or_window_changed");
      await ports.requireCapability();
      const [liveLedger, liveJob, liveReceipt, liveSource, liveSuppression, liveFounderSend, liveFounderCheck] = await Promise.all([
        ledgerRef.get(), root.collection("jobs").doc(planned.content.jobId).get(),
        root.collection("sendReceipts").doc(planned.old.deliveryKey).get(),
        db.collection("outboundProspects").doc(planned.old.prospectId).get(), db.collection("email_suppressions").doc(planned.content.to).get(),
        root.collection("founderSendObservations").doc(planned.content.jobId).get(),
        root.collection("founderSendChecks").doc(planned.content.jobId).get(),
      ]);
      const currentLedger=liveLedger.data(), currentSource=liveSource.data(), currentSuppression=liveSuppression.data();
      if (!ports.enabled() || !ports.allowsRevision(planned.content.jobId, planned.old.revisionId, planned.content.reviewDigest)
        || liveFounderSend.exists || liveFounderCheck.data()?.state === "requires_reconciliation"
        || currentLedger?.status!=="pending_approval" || currentLedger.approved_by || currentLedger.approved_at
        || currentLedger.sent_at || currentLedger.execution_attempts>0 || currentLedger.last_execution_at
        || communicationsDigest(currentLedger.action_payload)!==planned.content.payloadDigest
        || liveJob.data()?.state!=="pending_approval" || liveReceipt.exists || currentSource?.contactEmail?.toLowerCase()!==planned.content.to
        || ["closed","converted"].includes(currentSource?.stage) || currentSuppression?.global_suppressed===true
        || currentSuppression?.suppressed_scopes?.some((scope:string)=>["all","growth_campaign"].includes(scope))) fail("gmail_draft_source_changed_before_write");
      if (planned.old.draftId && !await ports.find(planned.old.confirmedContent, planned.old.draftId)) fail("gmail_draft_previous_copy_changed_manual_reconciliation_required");
      const envelope = communicationsEnvelopeSchema.parse(currentLedger!.action_payload.communications);
      if (envelope.job.intent === "reply" && envelope.evaluationReadiness) {
        const readiness = await readEvaluationReadiness(db, envelope.brief, Date.now());
        if (siteReplyPromiseBlockers(envelope.output.body, readiness).length) fail("gmail_draft_readiness_changed_before_write");
      }
      if (ports.copyDirection) {
        await ports.requireCapability();
        if (!ports.enabled()) fail("gmail_draft_copy_direction_changed");
      }
      submitted = true;
      const written = await ports.write(planned.content, planned.old.draftId ?? undefined);
      // Retain the accepted provider identity before a readback can fail. This
      // acknowledgement proves creation, not matching content or delivery.
      await db.runTransaction(async tx => {
        const current = (await tx.get(draftRef)).data();
        if (!current || current.state !== "writing" || current.attemptId !== planned.old.attemptId
          || !same(current.content, planned.content) || current.draftId && current.draftId !== written.draftId) fail("gmail_draft_writer_changed");
        tx.update(draftRef, { draftId: written.draftId, providerAcceptedAt: Date.now(), providerWriteSubmitted: true });
      });
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
    if (!submitted && planned.state === "claimed") throw new CommunicationsGmailDraftError("gmail_draft_source_or_capability_refused_before_write", 409);
    throw new CommunicationsGmailDraftError("gmail_draft_unknown_acknowledgement_reconcile_exact_job", 503);
  }
}

/** Stage eligible internal drafts without approval or inference. Existing
 * writing/unknown claims are observed only; no clock can license a new create. */
export async function runCommunicationsGmailDraftCopies(db: FirebaseFirestore.Firestore, now = () => Date.now(), basePorts = configuredGmailDraftPorts(), canContinue = () => true) {
  const direction = await gmailDraftCopyDirection(db, now);
  if (!direction) return;
  const enabled = () => canContinue() && (direction.saveWithinRun
    ? process.env.BLUEPRINT_COMMUNICATIONS_WORKER_ENABLED === "true" && process.env.BLUEPRINT_COMMUNICATIONS_SEND_ENABLED === "false"
      && process.env.BLUEPRINT_COMMUNICATIONS_AUTOMATIC_FIRST_CONTACT_ENABLED === "false"
    : recurringCopiesEnabled());
  if (!enabled()) return;
  const ports: GmailDraftPorts = { ...basePorts, copyDirection: direction,
    enabled: () => recurringCopiesEnabled() && canContinue() && now() < Date.parse(direction.expiresAt),
    allowsRevision: (jobId, revisionId, reviewDigest) => /^[a-f0-9]{64}$/.test(jobId) && /^[a-f0-9]{64}$/.test(reviewDigest)
      && (revisionId === null || /^[a-f0-9]{64}$/.test(revisionId)),
    requireCapability: async () => {
      if (!recurringCopiesEnabled() || !same(await gmailDraftCopyDirection(db, now), direction)) fail("gmail_draft_copy_direction_changed");
      await basePorts.requireCapability();
    } };
  let cursor: string | undefined;
  while (enabled()) {
    let query = db.doc(COMMUNICATIONS_ROOT).collection("jobs").where("state", "==", "pending_approval").orderBy("__name__").limit(50);
    if (cursor) query = query.startAfter(cursor);
    const page = await query.get();
    if (page.empty) return;
    for (const doc of page.docs) {
      cursor = doc.id;
      if (!enabled()) return;
      if (direction.saveWithinRun) {
        const bound = doc.data().checkpoint?.sameRunDraftSave;
        if (!bound) continue; // Historical/manual copies remain excluded.
        try { await saveCommunicationsUnsentDraft(db, doc.id, bound, now, basePorts, enabled); }
        catch (error) { logger.warn({ jobId: doc.id, code: error instanceof CommunicationsGmailDraftError ? error.message : "gmail_draft_same_run_readback_pending" }, "Same-run unsent draft waits for its exact durable receipt"); }
        continue;
      }
      const ledgerId = `communications_${doc.id}`, ledger = (await db.collection("action_ledger").doc(ledgerId).get()).data();
      if (!ledger || ledger.status !== "pending_approval" || !ledger.action_payload?.communications) continue;
      const old = (await db.doc(COMMUNICATIONS_ROOT).collection("gmailDraftBindings").doc(doc.id).get()).data();
      if (old?.state === "verified") continue; // One copy stays preserved across later revisions.
      try {
        await mirrorCommunicationsGmailDraft(db, ledgerId, "Nijel Hunt (retained recurring copy direction)", {
          expectedReviewDigest: doc.data().reviewDigest, expectedRevisionId: ledger.draft_revision_id ?? null,
          mode: ["writing", "unknown"].includes(old?.state) ? "reconcile" : "write",
        }, ports, now());
      } catch (error) {
        logger.warn({ jobId: doc.id, code: error instanceof CommunicationsGmailDraftError ? error.message : "gmail_draft_copy_reconciliation_required" }, "Canonical Gmail draft copy needs reconciliation");
      }
    }
  }
}

/** Read-only canonical metadata for the existing Approvals queue. This never
 * calls Gmail or mistakes a prior verification for fresh mailbox observation. */
export async function communicationsGmailDraftStatus(db: FirebaseFirestore.Firestore, ledgerId: string, payload: Record<string, unknown>, revisionId: string | null = null, reviewDigest: string | null = null) {
  let writesEnabled=/^communications_[a-f0-9]{64}$/.test(ledgerId)
    && draftWindowAllows(ledgerId.slice("communications_".length), revisionId, reviewDigest ?? "");
  if (writesEnabled) {
    try { await requireFounderDraftCapability(); } catch { writesEnabled=false; }
  }
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

/** Deterministic delivery view only; authored plain bytes remain canonical. */
function signatureLines(body: string) {
  const lines = body.replace(/\r\n/g, "\n").split("\n").filter(line => !/^Blueprint: https:\/\/tryblueprint\.io\/?$/.test(line));
  const index = lines.lastIndexOf("Blueprint");
  if (index < 1 || lines[index - 1] !== "Nijel Hunt") fail("gmail_draft_signature_missing");
  return { lines, index };
}
export function gmailDraftPlain(content: { body: string; mimeProfile?: string }) {
  if (!["multipart-signature-link-v2", "multipart-founder-signature-v3"].includes(content.mimeProfile ?? "")) return content.body;
  const { lines, index } = signatureLines(content.body);
  if (content.mimeProfile === "multipart-founder-signature-v3") {
    lines.splice(index - 1, 2, "--", "Nijel Hunt", "Founder at Blueprint", "Austin, TX");
  } else lines[index] = "Blueprint — https://tryblueprint.io/";
  return lines.join("\n");
}
function gmailDraftHtml(body: string, profile?: DraftContent["mimeProfile"]) {
  const escape = (value: string) => value.replace(/[&<>"']/g, character =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]!));
  if (profile === "multipart-founder-signature-v3") {
    const { lines, index } = signatureLines(body);
    const signature = '--<br>\n<a href="https://tryblueprint.io/"><img src="https://tryblueprint.io/brand/email-mark.png" alt="Blueprint" width="36" height="36" style="display:block;border:0;width:36px;height:36px"></a><br>\nNijel Hunt<br>\nFounder at <a href="https://tryblueprint.io/">Blueprint</a><br>\nAustin, TX';
    return `<html><body><div>${lines.slice(0, index - 1).map(escape).join("<br>\n")}<br>\n${signature}${lines.slice(index + 1).map(line => `<br>\n${escape(line)}`).join("")}</div></body></html>`;
  }
  if (profile === "multipart-signature-link-v2") {
    const { lines, index } = signatureLines(body);
    return `<html><body><div>${lines.map((line, number) => number === index
      ? '<a href="https://tryblueprint.io/" style="color:#0000ee;text-decoration:underline">Blueprint</a>' : escape(line)).join("<br>\n")}</div></body></html>`;
  }
  const lines = body.replace(/\r\n/g, "\n").split("\n").map(line => {
    const link = /^Blueprint: (https?:\/\/\S+)$/.exec(line);
    if (!link) return escape(line);
    let url: URL;
    try { url = new URL(link[1]); } catch { return escape(line); }
    if (url.username || url.password) return escape(line);
    return `Blueprint: <a href="${escape(url.href)}">${escape(link[1])}</a>`;
  });
  return `<html><body><div>${lines.join("<br>\n")}</div></body></html>`;
}
function gmailDraftBodyMatches(payload: gmail_v1.Schema$MessagePart | undefined, content: DraftContent) {
  const normalize = (value: string) => value.replace(/\r\n/g, "\n");
  if (!payload || payload.filename || payload.body?.attachmentId) return false;
  if (!content.mimeProfile) return payload.mimeType === "text/plain" && !(payload.parts?.length)
    && normalize(extractPlainTextBody(payload)) === normalize(content.body);
  if (!["multipart-alternative-v1", "multipart-signature-link-v2", "multipart-founder-signature-v3"].includes(content.mimeProfile) || payload.mimeType !== "multipart/alternative"
    || payload.body?.data || payload.parts?.length !== 2
    || payload.headers?.some(header => (header.name ?? "").toLowerCase() === "content-disposition"
      && !/^inline(?:;|$)/i.test(header.value ?? ""))) return false;
  const parts = payload.parts;
  const inline = (part: gmail_v1.Schema$MessagePart, mime: string) => part.mimeType === mime && !part.filename
    && !part.body?.attachmentId && typeof part.body?.data === "string" && !(part.parts?.length)
    && !(part.headers?.some(header => (header.name ?? "").toLowerCase() === "content-disposition"
      && !/^inline(?:;|$)/i.test(header.value ?? "")));
  const plain = parts.filter(part => inline(part, "text/plain")), html = parts.filter(part => inline(part, "text/html"));
  return plain.length === 1 && html.length === 1
    && normalize(Buffer.from(plain[0].body!.data!, "base64url").toString("utf8")) === normalize(gmailDraftPlain(content))
    && normalize(Buffer.from(html[0].body!.data!, "base64url").toString("utf8")) === gmailDraftHtml(content.body, content.mimeProfile);
}

export function configuredGmailDraftPorts(gmail?: gmail_v1.Gmail, mode: "automated" | "manual_approved_copy" = "automated"): GmailDraftPorts {
  const client = async () => gmail ??= await existingFounderGmail();
  const raw = (content: DraftContent) => {
    if ([content.to,content.subject,content.messageId,content.inReplyTo ?? ""].some(value => /[\r\n]/.test(value))) fail("gmail_draft_header_invalid");
    if (content.mimeProfile && !["multipart-alternative-v1", "multipart-signature-link-v2", "multipart-founder-signature-v3"].includes(content.mimeProfile)) fail("gmail_draft_mime_profile_invalid");
    const headers = [`From: Nijel Hunt <${FOUNDER_MAILBOX}>`, `To: ${content.to}`, `Reply-To: ${FOUNDER_MAILBOX}`, `Message-ID: ${content.messageId}`,
      `Subject: =?UTF-8?B?${Buffer.from(content.subject).toString("base64")}?=`, `X-Blueprint-Job-ID: ${content.jobId}`,
      `X-Blueprint-Review-Digest: ${content.reviewDigest}`, `X-Blueprint-Payload-Digest: ${content.payloadDigest}`,
      "MIME-Version: 1.0", ...(content.inReplyTo ? [`In-Reply-To: ${content.inReplyTo}`,`References: ${content.inReplyTo}`] : [])];
    if (!content.mimeProfile) return Buffer.from([...headers, "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64"].join("\r\n")
      + "\r\n\r\n" + Buffer.from(content.body).toString("base64")).toString("base64url");
    const boundary = `blueprint-${communicationsDigest(content).slice(0, 48)}`;
    const part = (mime: string, body: string) => `--${boundary}\r\nContent-Type: ${mime}; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n`
      + (Buffer.from(body).toString("base64").match(/.{1,76}/g) ?? []).join("\r\n") + "\r\n";
    const message = [...headers, `Content-Type: multipart/alternative; boundary="${boundary}"`].join("\r\n") + "\r\n\r\n"
      + part("text/plain", gmailDraftPlain(content)) + part("text/html", gmailDraftHtml(content.body, content.mimeProfile)) + `--${boundary}--\r\n`;
    return Buffer.from(message).toString("base64url");
  };
  return {
    // Only the authenticated explicit owner route selects manual mode. The
    // global switch continues to govern any automatic/default draft staging.
    enabled: () => draftWindowConfigured() && (mode === "manual_approved_copy" || process.env.BLUEPRINT_COMMUNICATIONS_GMAIL_DRAFTS_ENABLED === "true"),
    allowsRevision: draftWindowAllows,
    requireCapability: requireFounderDraftCapability, verifyMailbox: async () => verifyFounderMailbox(await client()),
    async priorContact(email) {
      const response = await (await client()).users.messages.list({ userId: "me", q: `in:anywhere -in:drafts {from:${JSON.stringify(email)} to:${JSON.stringify(email)}}`, maxResults: 1, includeSpamTrash: true });
      if (response.data.messages?.length) return true;
      if (response.data.resultSizeEstimate !== 0 || response.data.nextPageToken) fail("gmail_draft_prior_contact_unverified");
      return false;
    },
    async recipientDraftExists(email) {
      const response = await (await client()).users.drafts.list({ userId: "me", q: `to:${JSON.stringify(email)}`, maxResults: 1 });
      if (response.data.drafts?.length) return true;
      if (response.data.resultSizeEstimate !== 0 || response.data.nextPageToken) fail("gmail_draft_recipient_inventory_unverified");
      return false;
    },
    async find(content, draftId) {
      const api=await client();
      let draft: gmail_v1.Schema$Draft;
      if (!draftId) {
        // Inventory both authored and rewritten Message-IDs in the same bounded
        // recipient/subject window. A transport-ID hit cannot hide a sibling.
        const candidates=await api.users.drafts.list({userId:"me",q:`to:${JSON.stringify(content.to)} subject:${JSON.stringify(content.subject)}`,maxResults:2});
        if (candidates.data.nextPageToken) fail("gmail_draft_candidate_inventory_incomplete");
        const matches: gmail_v1.Schema$Draft[]=[];
        for (const candidate of candidates.data.drafts ?? []) {
          if (!candidate.id) fail("gmail_draft_candidate_identity_missing");
          const saved=(await api.users.drafts.get({userId:"me",id:candidate.id,format:"full"})).data;
          if (saved.id!==candidate.id) fail("gmail_draft_candidate_identity_changed");
          const headers=saved.message?.payload?.headers;
          // Count changed copies with the same job too: choosing a clean
          // sibling would conceal a duplicate or a manually altered copy.
          if (headers?.some(header=>(header.name ?? "").toLowerCase()==="x-blueprint-job-id" && header.value?.trim()===content.jobId)) matches.push(saved);
        }
        if (matches.length>1) fail("gmail_draft_multiple_copies_require_reconciliation");
        if (!matches.length) return null;
        draft=matches[0]; draftId=draft.id!;
      } else draft=(await api.users.drafts.get({userId:"me",id:draftId,format:"full"})).data;
      const message=draft.message, headers=message?.payload?.headers;
      const addresses=(value:string|null)=>(value?.match(/[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? []).map(address=>address.toLowerCase()).join();
      const get=(name:string)=>extractHeader(headers,name);
      const subject=(get("Subject") ?? "").replace(/=\?UTF-8\?B\?([A-Za-z0-9+/=]+)\?=/gi,(_,encoded:string)=>Buffer.from(encoded,"base64").toString("utf8"));
      if (draft.id!==draftId || !message?.id || !message.threadId || !message.labelIds?.includes("DRAFT") || message.labelIds.includes("SENT")
        || headers?.some(header=>["cc","bcc"].includes((header.name ?? "").toLowerCase()) && Boolean(header.value?.trim()))
        || ["from","to","reply-to","subject","message-id","x-blueprint-job-id","x-blueprint-review-digest","x-blueprint-payload-digest"].some(name=>headers?.filter(header=>(header.name ?? "").toLowerCase()===name).length!==1)
        || !gmailDraftBodyMatches(message.payload, content)
        || !/^<[^<>\x00-\x20\x7f@]+@[^<>\x00-\x20\x7f@]+>$/.test(get("Message-ID") ?? "") || get("X-Blueprint-Job-ID")!==content.jobId
        || get("X-Blueprint-Review-Digest")!==content.reviewDigest || get("X-Blueprint-Payload-Digest")!==content.payloadDigest
        || addresses(get("To"))!==content.to || addresses(get("From"))!==FOUNDER_MAILBOX
        || addresses(get("Reply-To"))!==FOUNDER_MAILBOX || subject!==content.subject
        || (content.threadId && content.threadId!==message.threadId) || (content.inReplyTo && get("In-Reply-To")!==content.inReplyTo)) fail("gmail_draft_readback_content_changed");
      return {draftId,messageId:message.id,threadId:message.threadId,authoredRfcMessageId:content.messageId,observedRfcMessageId:get("Message-ID")!,
        ...(content.mimeProfile ? { mimeProfile: content.mimeProfile, htmlSha256: createHash("sha256").update(gmailDraftHtml(content.body, content.mimeProfile)).digest("hex") } : {})};
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
