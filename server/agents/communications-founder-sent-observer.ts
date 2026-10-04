import { createHash } from "node:crypto";
import { type gmail_v1 } from "googleapis";
import {
  communicationsBriefSchema, communicationsDeliveryKey, communicationsDigest, communicationsJobSchema, FOUNDER_MAILBOX,
  FOUNDER_SEND_OBSERVATION_VERSION, founderDraftBindingIdentity, founderSendEvidenceDigest, founderSentContentSha256,
  verifyFounderSendObservation, type CommunicationsBrief, type CommunicationsJob, type FounderSendObservation,
} from "./communications-contract";
import { COMMUNICATIONS_ROOT } from "./communications-store";
import { addresses, existingFounderGmail, subjectText, verifyFounderMailbox } from "./communications-gmail";
import { requireFounderReadCapability } from "./communications-oauth-store";
import { FOUNDER_GMAIL_READ_SCOPE } from "./communications-connection";
import { firstContactRecipientKey } from "./communications-first-contact";
import { extractPlainTextBody } from "../utils/human-reply-gmail";
import { resolveBundleStorage } from "../utils/siteCaptureBundleStorage";

/** Default off. Owner decision 2026-10-04: reply learning may read founder-sent
 * drafts; system sending and automatic first contact stay off. This module
 * reads Gmail only. It never sends, drafts, labels, approves or writes receipts. */
export const FOUNDER_SENT_OBSERVER_FLAG = "BLUEPRINT_COMMUNICATIONS_FOUNDER_SENT_OBSERVER_ENABLED";
export const FOUNDER_SENT_DIRECTION_FIELD = "founderSentObservationDirection";
export const FOUNDER_SENT_DIRECTION_VERSION = "blueprint.communications-founder-sent-observation-direction.v1";
export const FOUNDER_SENT_DIRECTION_KIND = "founder-sent-draft-observation";
const DIRECTION_OBJECT = /^gs:\/\/blueprint-8c1ca\.appspot\.com\/(operations\/recovery\/[^\s]+\/founder-sent-draft-observation-owner-direction\.json)$/;
const CHECK_VERSION = "blueprint.communications-founder-send-check.v1";
const PAGE_SIZE = 5, MINUTE = 60000, HOUR = 60 * MINUTE, DAY = 24 * HOUR;
const BACKOFF_BASE = 15 * MINUTE, BACKOFF_CAP = DAY;
// "Absent" means the Gmail draft is gone and no matching SENT message exists.
// Three checks spanning a day separate a deleted draft from indexing delay.
const ABSENT_RECHECK = 12 * HOUR, ABSENT_CHECKS = 3, ABSENT_WINDOW = DAY;
const MAX_THREAD_MESSAGES = 50;
const TERMINAL_STATES = ["observed", "draft_absent_unsent", "requires_reconciliation", "system_send_owned"];
const DIRECTION_SCOPE = Object.freeze({ readOnly: true, observeFounderSentDrafts: true, replyIntakeAuthorized: true,
  sendsAuthorized: false, automaticFirstContactAuthorized: false, approvalsAuthorized: false,
  newInferenceAuthorized: false, accessChangesAuthorized: false });

export type FounderSentObservationDirection = {
  version: typeof FOUNDER_SENT_DIRECTION_VERSION; owner: "Nijel Hunt"; approvedAt: string; expiresAt: string;
  direction: { kind: typeof FOUNDER_SENT_DIRECTION_KIND; text: string; sourceRef: string };
  binding: { mailbox: typeof FOUNDER_MAILBOX; readScope: typeof FOUNDER_GMAIL_READ_SCOPE };
  scope: typeof DIRECTION_SCOPE;
};
type DirectionRef = { uri: string; generation: string; sha256: string };
type AdmittedDirection = { ref: DirectionRef; digest: string; expiresAt: string };

export type FounderSentThreadMessage = {
  gmailMessageId: string; threadId: string; labelIds: string[]; internalDate: number;
  from: string[]; to: string[]; cc: string[]; bcc: string[];
  rfcMessageIds: string[]; subject: string; body: string; blueprintJobIds: string[];
};
export type FounderSentThread = { threadId: string; messages: FounderSentThreadMessage[] };
/** Read-only Gmail port. Tests inject fakes; production uses the founder binding. */
export type FounderSentObserverPorts = {
  requireCapability(): Promise<void>;
  verifyMailbox(): Promise<unknown>;
  /** false only for a provider 404. */
  draftExists(draftId: string): Promise<boolean>;
  /** null only for a provider 404. */
  readThread(threadId: string): Promise<FounderSentThread | null>;
};
export type FounderSentObserverOutcome = { jobId: string; state: string; reason?: string };
export type FounderSentObserverResult = {
  state: "disabled" | "blocked" | "stopped" | "completed"; reason?: string; outcomes: FounderSentObserverOutcome[];
};

/** `stop` marks provider access failures that halt the whole tick. */
export class FounderSentObserverError extends Error {
  constructor(message: string, readonly stop = false) { super(message); }
}
function fail(code: string, stop = false): never { throw new FounderSentObserverError(code, stop); }
function safeCode(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : "";
  return /^[a-z_][a-z0-9_]*$/.test(message) ? message : fallback;
}
function providerStatus(error: unknown) {
  const value = (error as any)?.response?.status ?? (error as any)?.status ?? (error as any)?.code;
  return typeof value === "number" ? value : typeof value === "string" && /^\d{3}$/.test(value) ? Number(value) : undefined;
}
function accessDenied(error: unknown) {
  if (error instanceof FounderSentObserverError && error.stop) return error.message;
  const status = providerStatus(error);
  return status === 401 || status === 403 ? `founder_sent_gmail_http_${status}` : null;
}

/** Same send/automatic-first-contact check as Gmail draft staging. */
export function founderSentObserverEnabled() {
  return process.env[FOUNDER_SENT_OBSERVER_FLAG] === "true"
    && process.env.BLUEPRINT_COMMUNICATIONS_SEND_ENABLED !== "true"
    && process.env.BLUEPRINT_COMMUNICATIONS_AUTOMATIC_FIRST_CONTACT_ENABLED !== "true";
}

/** Owner direction pinned by generation and sha256, like the draft-copy
 * direction. Nothing supplied by a model, request or mailbox admits it. */
async function founderSentDirection(db: FirebaseFirestore.Firestore, now: () => number): Promise<AdmittedDirection | null> {
  const saved = (await db.doc(COMMUNICATIONS_ROOT).get()).data()?.[FOUNDER_SENT_DIRECTION_FIELD];
  if (!saved) return null;
  const ref: DirectionRef = { uri: saved.uri, generation: saved.generation, sha256: saved.sha256 };
  const storage = resolveBundleStorage(), match = DIRECTION_OBJECT.exec(typeof ref.uri === "string" ? ref.uri : "");
  if (!storage || storage.bucketName !== "blueprint-8c1ca.appspot.com" || !match
    || typeof ref.generation !== "string" || !/^[0-9]+$/.test(ref.generation)
    || typeof ref.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(ref.sha256)) fail("founder_sent_direction_invalid");
  const before = await storage.info(match[1]);
  if (!before || before.generation !== ref.generation || !Number.isSafeInteger(before.size) || before.size < 1 || before.size > 32000) fail("founder_sent_direction_invalid");
  const raw = await storage.readText(match[1]), after = await storage.info(match[1]);
  if (raw === null || Buffer.byteLength(raw) !== before.size || after?.generation !== ref.generation
    || createHash("sha256").update(raw).digest("hex") !== ref.sha256) fail("founder_sent_direction_invalid");
  let authority: FounderSentObservationDirection;
  try { authority = JSON.parse(raw); } catch { return fail("founder_sent_direction_invalid"); }
  const scope = authority?.scope as Record<string, unknown> | undefined;
  if (authority?.version !== FOUNDER_SENT_DIRECTION_VERSION || authority.owner !== "Nijel Hunt"
    || !Number.isFinite(Date.parse(authority.approvedAt)) || Date.parse(authority.approvedAt) > now()
    || !Number.isFinite(Date.parse(authority.expiresAt)) || Date.parse(authority.expiresAt) <= now()
    || authority.direction?.kind !== FOUNDER_SENT_DIRECTION_KIND
    || typeof authority.direction.text !== "string" || !authority.direction.text.trim()
    || typeof authority.direction.sourceRef !== "string"
    || !/^gs:\/\/blueprint-8c1ca\.appspot\.com\/operations\/recovery\//.test(authority.direction.sourceRef)
    || authority.binding?.mailbox !== FOUNDER_MAILBOX || authority.binding.readScope !== FOUNDER_GMAIL_READ_SCOPE
    || !scope || typeof scope !== "object" || Object.keys(scope).length !== Object.keys(DIRECTION_SCOPE).length
    || Object.entries(DIRECTION_SCOPE).some(([key, value]) => scope[key] !== value)) fail("founder_sent_direction_invalid");
  return { ref, digest: communicationsDigest(authority), expiresAt: authority.expiresAt };
}

/** Reply intake on founder-sent threads uses the same flag, owner direction
 * and read capability as observation. It makes no Gmail call. */
export async function founderSentRepliesAllowed(db: FirebaseFirestore.Firestore,
  options: { now?: () => number; requireCapability?: () => Promise<void> } = {}) {
  try {
    if (!founderSentObserverEnabled()) return false;
    if (!await founderSentDirection(db, options.now ?? (() => Date.now()))) return false;
    await (options.requireCapability ?? requireFounderReadCapability)();
    return true;
  } catch { return false; }
}

type VerifiedDraftBinding = {
  version: "blueprint.communications-gmail-draft-binding.v1"; jobId: string; ledgerId: string; prospectId: string;
  deliveryKey: string; state: "verified"; draftId: string; verifiedAt: number; revisionId?: string | null;
  content: { jobId: string; to: string; subject: string; body: string; payloadDigest: string; reviewDigest: string; messageId?: string };
  receipt: { draftId: string; messageId: string; threadId: string; authoredRfcMessageId?: string; observedRfcMessageId?: string };
};
function verifiedBinding(jobId: string, value: any): VerifiedDraftBinding | null {
  const hex = /^[a-f0-9]{64}$/, text = (item: unknown) => typeof item === "string" && item.length > 0;
  if (!hex.test(jobId) || value?.version !== "blueprint.communications-gmail-draft-binding.v1" || value.state !== "verified"
    || value.jobId !== jobId || value.ledgerId !== `communications_${jobId}` || !text(value.prospectId)
    || !hex.test(value.deliveryKey ?? "") || !text(value.draftId) || value.receipt?.draftId !== value.draftId
    || !text(value.receipt?.threadId) || !text(value.receipt?.messageId)
    || typeof value.verifiedAt !== "number" || !Number.isFinite(value.verifiedAt)
    || value.content?.jobId !== jobId || !text(value.content?.to) || typeof value.content?.subject !== "string"
    || typeof value.content?.body !== "string" || !hex.test(value.content?.payloadDigest ?? "")
    || !hex.test(value.content?.reviewDigest ?? "")) return null;
  return value as VerifiedDraftBinding;
}

type CheckRecord = {
  version: typeof CHECK_VERSION; jobId: string; bindingDigest: string; state: string; reason: string | null;
  checks: number; draftPresentChecks: number; absentChecks: number; firstAbsentAt: number | null;
  errors: number; lastError: string | null; lastCheckedAt: number; nextCheckAt: number | null; observationDigest?: string;
};
/** Counters restart if the draft binding itself ever changes. */
function checkRecord(jobId: string, bindingDigest: string, previous: any, update: Partial<CheckRecord>, now: number): CheckRecord {
  const base = previous?.bindingDigest === bindingDigest ? previous : {};
  return { version: CHECK_VERSION, jobId, bindingDigest, state: "pending", reason: null,
    checks: (base.checks ?? 0) + 1, draftPresentChecks: base.draftPresentChecks ?? 0, absentChecks: base.absentChecks ?? 0,
    firstAbsentAt: base.firstAbsentAt ?? null, errors: base.errors ?? 0, lastError: base.lastError ?? null,
    lastCheckedAt: now, nextCheckAt: null, ...update };
}
const backoff = (attempt: number) => Math.min(BACKOFF_CAP, BACKOFF_BASE * 2 ** Math.max(0, attempt - 1));

type DueCheck = { state: "due"; binding: VerifiedDraftBinding; bindingDigest: string; previous: any }
  | { state: string; reason?: string };
/** Firestore reads only; no Gmail call happens for a binding that is not due. */
async function dueCheck(db: FirebaseFirestore.Firestore, jobId: string, value: unknown, now: number): Promise<DueCheck> {
  const root = db.doc(COMMUNICATIONS_ROOT), checkRef = root.collection("founderSendChecks").doc(jobId);
  const bindingDigest = communicationsDigest(founderDraftBindingIdentity(value));
  const [check, observation] = await Promise.all([checkRef.get(), root.collection("founderSendObservations").doc(jobId).get()]);
  if (observation.exists) return { state: "observed" };
  const previous = check.data();
  if (previous?.bindingDigest === bindingDigest && TERMINAL_STATES.includes(previous.state)) return { state: previous.state, reason: previous.reason ?? undefined };
  const binding = verifiedBinding(jobId, value);
  const settle = async (state: string, reason: string) => {
    await checkRef.set(checkRecord(jobId, bindingDigest, previous, { state, reason }, now));
    return { state, reason };
  };
  if (!binding) return settle("requires_reconciliation", "founder_sent_binding_invalid");
  // A system send attempt owns its own receipt path; never anchor both.
  if ((await root.collection("sendReceipts").doc(binding.deliveryKey).get()).exists) return settle("system_send_owned", "founder_sent_system_receipt_exists");
  if (previous?.bindingDigest === bindingDigest && (previous.nextCheckAt ?? 0) > now) return { state: "not_due" };
  return { state: "due", binding, bindingDigest, previous };
}

type ThreadEvaluation = { kind: "absent" } | { kind: "reconcile"; reason: string } | { kind: "match"; message: FounderSentThreadMessage };
/** A match is SENT, not DRAFT, from the founder, to exactly the bound
 * recipient and dated after the copy was verified. Message-ID and job
 * headers are recorded as evidence only, never required for matching. */
export function evaluateFounderSentThread(thread: FounderSentThread | null, binding: Pick<VerifiedDraftBinding, "verifiedAt" | "content" | "receipt">): ThreadEvaluation {
  if (!thread) return { kind: "absent" };
  if (thread.threadId !== binding.receipt.threadId) return { kind: "reconcile", reason: "founder_sent_thread_identity_changed" };
  if (thread.messages.length > MAX_THREAD_MESSAGES) return { kind: "reconcile", reason: "founder_sent_thread_context_limit_exceeded" };
  const recipient = binding.content.to.toLowerCase(), matches: FounderSentThreadMessage[] = [];
  for (const message of thread.messages) {
    // Unsent drafts, including this binding's own copy, are never send evidence.
    if (message.labelIds.includes("DRAFT") || !message.labelIds.includes("SENT")) continue;
    if (!Number.isFinite(message.internalDate)) return { kind: "reconcile", reason: "founder_sent_message_invalid" };
    if (message.internalDate <= binding.verifiedAt) continue;
    if (!message.gmailMessageId || message.threadId !== thread.threadId || message.from.length !== 1
      || message.rfcMessageIds.length !== 1) return { kind: "reconcile", reason: "founder_sent_message_invalid" };
    const recipients = [...message.to, ...message.cc, ...message.bcc];
    if (message.from[0] !== FOUNDER_MAILBOX || message.to.length !== 1 || recipients.length !== 1 || message.to[0] !== recipient) {
      return { kind: "reconcile", reason: "founder_sent_recipient_or_sender_changed" };
    }
    matches.push(message);
  }
  if (matches.length > 1) return { kind: "reconcile", reason: "founder_sent_multiple_matches" };
  return matches.length ? { kind: "match", message: matches[0] } : { kind: "absent" };
}

type ObservationEvidence = Omit<FounderSendObservation, "evidenceDigest" | "recipientSuppressedAtObservation" | "observedAt" | "recordedAt">;
/** One create-only transaction. A replay with the same evidence digest is a
 * no-op; different evidence is refused. Never writes sendReceipts or approval. */
async function recordFounderSendObservation(db: FirebaseFirestore.Firestore, input: { jobId: string; binding: VerifiedDraftBinding;
  bindingDigest: string; direction: AdmittedDirection; message: FounderSentThreadMessage; now: number }) {
  const { jobId, binding, bindingDigest, direction, message, now } = input;
  const root = db.doc(COMMUNICATIONS_ROOT), recipient = binding.content.to.toLowerCase();
  const observationRef = root.collection("founderSendObservations").doc(jobId), checkRef = root.collection("founderSendChecks").doc(jobId);
  return db.runTransaction(async tx => {
    const [saved, currentBinding, jobSnapshot, receipt, check] = await Promise.all([tx.get(observationRef),
      tx.get(root.collection("gmailDraftBindings").doc(jobId)), tx.get(root.collection("jobs").doc(jobId)),
      tx.get(root.collection("sendReceipts").doc(binding.deliveryKey)), tx.get(checkRef)]);
    if (communicationsDigest(founderDraftBindingIdentity(currentBinding.data())) !== bindingDigest) fail("founder_sent_binding_changed");
    if (receipt.exists) fail("founder_sent_system_receipt_exists");
    const record = jobSnapshot.data();
    let job: CommunicationsJob;
    try { job = communicationsJobSchema.parse(Object.fromEntries(["jobId", "prospectId", "briefId", "briefDigest", "intent", "inboundMessageId"].map(key => [key, record?.[key]]))); }
    catch { return fail("founder_sent_job_context_invalid"); }
    if (job.jobId !== jobId || record?.ledgerId !== binding.ledgerId || job.prospectId !== binding.prospectId
      || communicationsDeliveryKey(job) !== binding.deliveryKey) fail("founder_sent_job_identity_changed");
    const prospectRef = db.collection("outboundProspects").doc(job.prospectId);
    const eventRef = prospectRef.collection("communicationsEvents").doc(`founder_sent_${jobId}`);
    const firstTouchRef = root.collection("recipientFirstTouches").doc(firstContactRecipientKey(recipient));
    const [briefSnapshot, prospect, event, suppression, firstTouch] = await Promise.all([tx.get(root.collection("briefs").doc(job.briefId)),
      tx.get(prospectRef), tx.get(eventRef), tx.get(db.collection("email_suppressions").doc(recipient)), tx.get(firstTouchRef)]);
    let brief: CommunicationsBrief;
    try { brief = communicationsBriefSchema.parse(briefSnapshot.data()); } catch { return fail("founder_sent_job_context_invalid"); }
    if (communicationsDigest(brief) !== job.briefDigest || brief.prospectId !== job.prospectId
      || brief.contact.email.toLowerCase() !== recipient) fail("founder_sent_job_context_invalid");
    const normalize = (value: string) => value.replace(/\r\n/g, "\n"), rfcMessageId = message.rfcMessageIds[0];
    const evidence: ObservationEvidence = {
      version: FOUNDER_SEND_OBSERVATION_VERSION, state: "observed", jobId, prospectId: job.prospectId, briefId: job.briefId,
      briefDigest: job.briefDigest, intent: job.intent, inboundMessageId: job.inboundMessageId, ledgerId: binding.ledgerId,
      deliveryKey: binding.deliveryKey, payloadDigest: binding.content.payloadDigest, reviewDigest: binding.content.reviewDigest,
      recipient, gmailDraftBindingDigest: bindingDigest, directionDigest: direction.digest, direction: direction.ref,
      draft: { draftId: binding.draftId, messageId: binding.receipt.messageId, threadId: binding.receipt.threadId, verifiedAt: binding.verifiedAt },
      sent: { gmailMessageId: message.gmailMessageId, threadId: message.threadId, rfcMessageId,
        sentAt: new Date(message.internalDate).toISOString(),
        subjectSha256: founderSentContentSha256(message.subject), bodySha256: founderSentContentSha256(message.body),
        jobHeaderMatched: message.blueprintJobIds.length === 1 && message.blueprintJobIds[0] === jobId,
        rfcMatchesDraft: [binding.receipt.observedRfcMessageId, binding.receipt.authoredRfcMessageId, binding.content.messageId].includes(rfcMessageId) },
      // Differences may be founder edits or Gmail client re-encoding.
      contentMatch: message.subject === binding.content.subject && normalize(message.body) === normalize(binding.content.body)
        ? "exact" : "differs_from_draft",
      sendsAuthorized: false, approvalGranted: false,
    };
    const evidenceDigest = founderSendEvidenceDigest(evidence);
    if (saved.exists) {
      if (saved.data()?.evidenceDigest !== evidenceDigest) fail("founder_send_observation_changed");
      return "existing" as const;
    }
    if (event.exists) fail("founder_sent_event_conflict");
    const suppressed = suppression.data();
    let observation: FounderSendObservation;
    try {
      observation = verifyFounderSendObservation({ ...evidence, evidenceDigest,
        recipientSuppressedAtObservation: suppressed?.global_suppressed === true || (Array.isArray(suppressed?.suppressed_scopes)
          && suppressed.suppressed_scopes.some((scope: unknown) => scope === "all" || scope === "growth_campaign")),
        observedAt: new Date(now).toISOString(), recordedAt: now });
    } catch { return fail("founder_sent_evidence_invalid"); }
    // A flag change is not evidence about this binding: abort without a verdict.
    if (!founderSentObserverEnabled()) throw new Error("founder_sent_observer_disabled_before_write");
    tx.create(observationRef, observation);
    tx.create(eventRef, { version: "blueprint.communications-founder-sent-event.v1", type: "founder_sent", trust: "founder_authored",
      job, jobId, prospectId: job.prospectId, ledgerId: binding.ledgerId, observationDigest: evidenceDigest,
      founderSentMessage: { gmailMessageId: observation.sent.gmailMessageId, threadId: observation.sent.threadId,
        rfcMessageId: observation.sent.rfcMessageId, sentAt: observation.sent.sentAt },
      contentMatch: observation.contentMatch, sendsAuthorized: false, approvalGranted: false, recordedAt: now });
    if (job.intent === "outreach") {
      const row = prospect.data();
      if (row?.stage === "drafted" && row.contactEmail?.toLowerCase() === recipient) {
        tx.set(prospectRef, { stage: "contacted", contactedAtIso: observation.sent.sentAt }, { merge: true });
      }
      // Blocks a later automatic first contact; it is not a send receipt.
      if (!firstTouch.exists) tx.create(firstTouchRef, { jobId, prospectId: job.prospectId, deliveryKey: binding.deliveryKey,
        contactEmail: recipient, payloadDigest: binding.content.payloadDigest, origin: "founder_send_observed",
        founderSendObservationDigest: evidenceDigest, attemptedAt: observation.sent.sentAt });
    }
    tx.set(checkRef, checkRecord(jobId, bindingDigest, check.data(), { state: "observed", observationDigest: evidenceDigest }, now));
    return "observed" as const;
  });
}

async function observeBinding(db: FirebaseFirestore.Firestore, ports: FounderSentObserverPorts, jobId: string,
  due: Extract<DueCheck, { state: "due" }>, direction: AdmittedDirection, now: number, active: () => boolean): Promise<FounderSentObserverOutcome> {
  const { binding, bindingDigest, previous } = due, checkRef = db.doc(COMMUNICATIONS_ROOT).collection("founderSendChecks").doc(jobId);
  const write = (update: Partial<CheckRecord>) => checkRef.set(checkRecord(jobId, bindingDigest, previous, update, now));
  if (await ports.draftExists(binding.draftId)) {
    const draftPresentChecks = (previous?.bindingDigest === bindingDigest ? previous.draftPresentChecks ?? 0 : 0) + 1;
    await write({ reason: "draft_present", draftPresentChecks, nextCheckAt: now + backoff(draftPresentChecks) });
    return { jobId, state: "draft_present" };
  }
  const evaluation = evaluateFounderSentThread(await ports.readThread(binding.receipt.threadId), binding);
  if (evaluation.kind === "reconcile") {
    await write({ state: "requires_reconciliation", reason: evaluation.reason });
    return { jobId, state: "requires_reconciliation", reason: evaluation.reason };
  }
  if (evaluation.kind === "absent") {
    const base = previous?.bindingDigest === bindingDigest ? previous : {};
    const absentChecks = (base.absentChecks ?? 0) + 1, firstAbsentAt = base.firstAbsentAt ?? now;
    if (absentChecks >= ABSENT_CHECKS && now - firstAbsentAt >= ABSENT_WINDOW) {
      await write({ state: "draft_absent_unsent", reason: "draft_absent_without_matching_sent_message", absentChecks, firstAbsentAt });
      return { jobId, state: "draft_absent_unsent" };
    }
    await write({ reason: "draft_absent_unobserved", absentChecks, firstAbsentAt, nextCheckAt: now + ABSENT_RECHECK });
    return { jobId, state: "draft_absent_pending" };
  }
  if (!active()) return { jobId, state: "stopped" };
  try {
    return { jobId, state: await recordFounderSendObservation(db, { jobId, binding, bindingDigest, direction, message: evaluation.message, now }) };
  } catch (error) {
    if (!(error instanceof FounderSentObserverError)) throw error;
    await write({ state: "requires_reconciliation", reason: error.message });
    return { jobId, state: "requires_reconciliation", reason: error.message };
  }
}

/** Bounded rotating pass over verified Gmail draft copies: at most five per
 * tick. Fails closed with no Gmail call unless the flag, send-off state, owner
 * direction and durable read capability all hold. A 401/403 stops the tick and
 * writes only intakeState/founderSentObserver {blocked, reason}. */
export async function runCommunicationsFounderSentObserver(db: FirebaseFirestore.Firestore, options: {
  now?: () => number; ports?: FounderSentObserverPorts; canContinue?: () => boolean } = {}): Promise<FounderSentObserverResult> {
  const now = options.now ?? (() => Date.now()), canContinue = options.canContinue ?? (() => true);
  if (!founderSentObserverEnabled()) return { state: "disabled", outcomes: [] };
  const direction = await founderSentDirection(db, now);
  if (!direction) return { state: "disabled", reason: "founder_sent_direction_missing", outcomes: [] };
  const ports = options.ports ?? configuredFounderSentObserverPorts();
  await ports.requireCapability();
  const active = () => founderSentObserverEnabled() && canContinue() && now() < Date.parse(direction.expiresAt);
  const root = db.doc(COMMUNICATIONS_ROOT), stateRef = root.collection("intakeState").doc("founderSentObserver");
  const cursor = (await stateRef.get()).data()?.cursor;
  let query = root.collection("gmailDraftBindings").where("state", "==", "verified").orderBy("__name__").limit(PAGE_SIZE);
  if (typeof cursor === "string") query = query.startAfter(cursor);
  const page = await query.get(), outcomes: FounderSentObserverOutcome[] = [];
  let mailboxVerified = false;
  const stop = async (error: unknown, fallback: string): Promise<FounderSentObserverResult> => {
    const denied = accessDenied(error);
    if (denied) await stateRef.set({ blocked: true, reason: denied }, { merge: true });
    return { state: "blocked", reason: denied ?? safeCode(error, fallback), outcomes };
  };
  for (const row of page.docs) {
    if (!active()) return { state: "stopped", outcomes };
    const due = await dueCheck(db, row.id, row.data(), now());
    let outcome: FounderSentObserverOutcome;
    if (due.state !== "due" || !("binding" in due)) outcome = { jobId: row.id, state: due.state, ...("reason" in due && due.reason ? { reason: due.reason } : {}) };
    else {
      if (!mailboxVerified) {
        try { await ports.verifyMailbox(); mailboxVerified = true; }
        catch (error) { return stop(error, "founder_sent_mailbox_unverified"); }
      }
      try { outcome = await observeBinding(db, ports, row.id, due, direction, now(), active); }
      catch (error) {
        if (accessDenied(error)) return stop(error, "founder_sent_gmail_unavailable");
        if (!active()) return { state: "stopped", outcomes };
        const errors = (due.previous?.bindingDigest === due.bindingDigest ? due.previous.errors ?? 0 : 0) + 1, reason = safeCode(error, "founder_sent_check_unavailable");
        await root.collection("founderSendChecks").doc(row.id).set(checkRecord(row.id, due.bindingDigest, due.previous,
          { reason: "check_error", errors, lastError: reason, nextCheckAt: now() + backoff(errors) }, now()));
        outcome = { jobId: row.id, state: "error", reason };
      }
      // Revisit this binding first next time; nothing about it was decided.
      if (outcome.state === "stopped") return { state: "stopped", outcomes };
    }
    outcomes.push(outcome);
    await stateRef.set({ cursor: row.id, ...(mailboxVerified ? { blocked: false, reason: null } : {}) }, { merge: true });
  }
  if (page.size < PAGE_SIZE) await stateRef.set({ cursor: null, ...(mailboxVerified ? { blocked: false, reason: null } : {}) }, { merge: true });
  return { state: "completed", outcomes };
}

function founderSentThreadMessage(message: gmail_v1.Schema$Message): FounderSentThreadMessage {
  const headers = message.payload?.headers ?? [];
  const values = (name: string) => headers.filter(header => (header.name ?? "").toLowerCase() === name.toLowerCase())
    .map(header => header.value?.trim() ?? "");
  const all = (name: string) => values(name).flatMap(value => addresses(value));
  return { gmailMessageId: message.id ?? "", threadId: message.threadId ?? "", labelIds: message.labelIds ?? [],
    internalDate: Number(message.internalDate ?? Number.NaN), from: all("From"), to: all("To"), cc: all("Cc"), bcc: all("Bcc"),
    rfcMessageIds: values("Message-ID").filter(Boolean), subject: subjectText(values("Subject")[0] || null),
    body: extractPlainTextBody(message.payload), blueprintJobIds: values("X-Blueprint-Job-ID").filter(Boolean) };
}

/** Read-only adapter: users.getProfile, settings.sendAs.list, drafts.get and
 * threads.get. Provider error bodies are never retained. */
export function configuredFounderSentObserverPorts(gmail?: gmail_v1.Gmail): FounderSentObserverPorts {
  const client = async () => gmail ??= await existingFounderGmail();
  async function guarded<T>(call: () => Promise<T>, onMissing?: () => T): Promise<T> {
    try { return await call(); }
    catch (error) {
      const status = providerStatus(error);
      if (status === 404 && onMissing) return onMissing();
      if (status === 401 || status === 403) throw new FounderSentObserverError(`founder_sent_gmail_http_${status}`, true);
      if (error instanceof FounderSentObserverError) throw error;
      throw new FounderSentObserverError(safeCode(error, "founder_sent_gmail_unavailable"));
    }
  }
  return {
    requireCapability: requireFounderReadCapability,
    verifyMailbox: () => guarded(async () => verifyFounderMailbox(await client())),
    draftExists: draftId => guarded(async () => {
      const response = await (await client()).users.drafts.get({ userId: "me", id: draftId, format: "minimal" });
      if (response.data.id !== draftId) fail("founder_sent_draft_identity_changed");
      return true;
    }, () => false),
    readThread: threadId => guarded(async () => {
      const response = await (await client()).users.threads.get({ userId: "me", id: threadId, format: "full" });
      if (response.data.id !== threadId) fail("founder_sent_thread_identity_changed");
      return { threadId, messages: (response.data.messages ?? []).map(founderSentThreadMessage) };
    }, () => null),
  };
}
