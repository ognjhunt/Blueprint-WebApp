import { createHash } from "node:crypto";
import { z } from "zod";
import { outreachContextSchema, outreachReviewContractSchema } from "./outreach-review";

export const COMMUNICATIONS_MODEL = "gpt-6-luna";
export const COMMUNICATIONS_PROJECT = "proj_F2tFJuxLaovJru8RrtXRaqNj";
export const FOUNDER_MAILBOX = "nijel@tryblueprint.io";
export const FOUNDER_MAILBOX_ALIASES = [FOUNDER_MAILBOX, "hello@tryblueprint.io"] as const;
const id = z.string().trim().min(1).max(160).regex(/^[a-zA-Z0-9_.:-]+$/);
const text = z.string().trim().min(1).max(1200);
const date = z.string().datetime({ offset: true });
const sourceDate = z.union([date, z.string().date()]);
const publicUrl = z.string().url().max(1000).refine((value) => {
  const url = new URL(value);
  return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
});
const evidence = z.object({
  id, claim: text, sourceUrl: publicUrl,
  evidenceClass: z.enum(["primary", "corroborated", "operator_stated", "vendor_reported", "inference"]),
  sourceCheckedAt: sourceDate, publishedAt: sourceDate.nullable(), eventAt: sourceDate.nullable(),
  assertionScope: z.enum(["as_of_background", "current_operational", "deployment_critical"]).optional(),
  consequential: z.boolean(),
}).strict();

/** Immutable, quality-reviewed research handoff. Load time never refreshes evidence. */
export const communicationsBriefSchema = z.object({
  version: z.literal("blueprint.communications-brief.v1"),
  briefId: id, revision: z.number().int().positive(),
  prospectId: id, siteId: id, taskId: id, teamIds: z.array(id).max(8),
  caseId: id, capabilityIds: z.array(id).max(8),
  facilityName: text, boundedJob: text, decision: text, decisionOwner: text.nullable(),
  facts: z.array(evidence).min(1).max(16), unknowns: z.array(text).max(16),
  conflicts: z.array(text).max(8),
  stage: z.object({
    interest: z.enum(["unknown", "expressed", "pilot", "deployed"]),
    evidenceIds: z.array(id).max(8),
  }).strict(),
  contact: z.object({
    email: z.string().email().max(254), purpose: text, learningQuestion: text,
    sourceUrl: publicUrl, sourceCheckedAt: sourceDate,
    scope: z.enum(["site", "organization_business_route"]).optional(),
    // Original unknowns remain in the brief; this overlays only a proved contact gap.
    resolvedMissingContactGaps: z.array(text).max(16).optional(),
  }).strict(),
  consent: z.object({
    status: z.enum(["unknown", "public_business_contact", "reply_requested", "opted_out"]),
    sharingBoundary: text, sourceRefs: z.array(text).max(8),
  }).strict(),
  priorConversation: z.object({
    gmailThreadId: id, gmailMessageIds: z.array(id).min(1).max(20),
  }).strict().nullable(),
  // Backend-only lineage for an attachment to an already approved sent thread,
  // or to a founder-authored send observed in the founder mailbox. It carries
  // no permission grant and does not change the original QA dates. The legacy
  // system-send shape is unchanged so existing brief digests stay stable.
  replyOrigin: z.union([
    z.object({ parentBriefId: id, parentBriefDigest: z.string().regex(/^[a-f0-9]{64}$/),
      sendReceiptKey: z.string().regex(/^[a-f0-9]{64}$/) }).strict(),
    z.object({ origin: z.literal("founder_send_observed"), parentBriefId: id,
      parentBriefDigest: z.string().regex(/^[a-f0-9]{64}$/),
      founderSendObservationId: z.string().regex(/^[a-f0-9]{64}$/),
      founderSendObservationDigest: z.string().regex(/^[a-f0-9]{64}$/) }).strict(),
  ]).optional(),
  outreachContext: outreachContextSchema,
  qualityReview: z.object({
    state: z.literal("approved"), reviewedBy: text, reviewedAt: date, sourceRecordUrl: publicUrl,
  }).strict(),
  researchOrigin: z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), candidateKey: text,
    packetDigest: z.string().regex(/^[a-f0-9]{64}$/),
    rawArtifactDigest: z.string().regex(/^[a-f0-9]{64}$/),
    admissionId: z.string().regex(/^[a-f0-9]{64}$/).optional(),
    // Communications adapter provenance; original candidate stays in an
    // immutable source record, including quotes, unknowns and cached fact IDs.
    sourceDigest: z.string().regex(/^[a-f0-9]{64}$/).optional(),
    contactEvidenceDigest: z.string().regex(/^[a-f0-9]{64}$/).optional(),
    contactEvidenceKind: z.enum(["published_evidence", "public_operator_resolution"]).optional(),
  }).strict(),
}).strict();
export type CommunicationsBrief = z.infer<typeof communicationsBriefSchema>;
export type CommunicationsFounderReplyOrigin = Extract<NonNullable<CommunicationsBrief["replyOrigin"]>, { origin: "founder_send_observed" }>;
/** Founder-authored threads never carry system send approval or first-contact authority. */
export function isFounderReplyOrigin(origin: CommunicationsBrief["replyOrigin"]): origin is CommunicationsFounderReplyOrigin {
  return !!origin && "origin" in origin && origin.origin === "founder_send_observed";
}

/** Separate immutable record written by research QA/publication or the verified
 * publication adapter after verified agent context or optional operator review, never by the
 * communications model or directly from a request body. */
export const communicationsHandoffSchema = z.object({
  version: z.literal("blueprint.communications-handoff.v1"), state: z.literal("approved"),
  briefDigest: z.string().regex(/^[a-f0-9]{64}$/), reviewedBy: text, reviewedAt: date,
  sourceRecordUrl: publicUrl, sheetsReceipt: text.nullable(), notionReceipt: text.nullable(),
  recordReceipt: text.optional(),
}).strict();
export type CommunicationsHandoff = z.infer<typeof communicationsHandoffSchema>;
export function verifyCommunicationsHandoff(value: unknown, brief: CommunicationsBrief) {
  const handoff = communicationsHandoffSchema.parse(value);
  if (handoff.briefDigest !== communicationsDigest(brief)
    || handoff.reviewedBy !== brief.qualityReview.reviewedBy
    || handoff.reviewedAt !== brief.qualityReview.reviewedAt
    || handoff.sourceRecordUrl !== brief.qualityReview.sourceRecordUrl) throw new Error("research_handoff_approval_missing_or_changed");
  return handoff;
}

const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const communicationsReplyBindingSchema = z.object({
  version: z.literal("blueprint.communications-reply-binding.v1"),
  briefDigest: hash, parentBriefId: id, parentBriefDigest: hash,
  sendReceiptKey: hash, sendReceiptDigest: hash, approvalLedgerId: id,
  outgoingMessageId: id, outgoingRfcMessageId: z.string().min(1).max(500),
}).strict();

/** Bind consequential sent provenance, while retaining the entire original
 * receipt separately. Optional recovery notes/timestamps cannot revoke it. */
export function communicationsSentReceiptIdentity(value: unknown) {
  return z.object({ state: z.literal("sent"), jobId: id, payloadDigest: hash, approvalLedgerId: id,
    rfcMessageId: z.string().min(1).max(500), firstContactAuthorityDigest: hash.optional(),
    receipt: z.object({ messageId: id, threadId: id, rfcMessageId: z.string().min(1).max(500) }),
  }).parse(value);
}

/** A thread attachment inherits research review; it never reviews new claims,
 * refreshes dates, or changes the original permission/sharing boundary. */
export function verifyCommunicationsReplyBinding(value: unknown, brief: CommunicationsBrief, parent: CommunicationsBrief) {
  const binding = communicationsReplyBindingSchema.parse(value);
  const expected = { ...parent, briefId: brief.briefId,
    replyOrigin: { parentBriefId: parent.briefId, parentBriefDigest: communicationsDigest(parent), sendReceiptKey: binding.sendReceiptKey },
    priorConversation: { gmailThreadId: brief.priorConversation?.gmailThreadId,
      gmailMessageIds: [binding.outgoingMessageId] } };
  if (brief.briefId === parent.briefId || binding.briefDigest !== communicationsDigest(brief)
    || binding.parentBriefId !== parent.briefId || binding.parentBriefDigest !== communicationsDigest(parent)
    || communicationsDigest(expected) !== communicationsDigest(brief)) throw new Error("reply_parent_context_changed");
  return binding;
}

/** Reply attachment to a founder-authored send. The observation, its Gmail
 * draft-copy binding and the owner observation direction replace the system
 * approval/receipt chain; nothing here grants send or approval authority. */
export const communicationsFounderReplyBindingSchema = z.object({
  version: z.literal("blueprint.communications-reply-binding.v2"),
  replyOrigin: z.literal("founder_send_observed"),
  briefDigest: hash, parentBriefId: id, parentBriefDigest: hash,
  founderSendObservationId: hash, founderSendObservationDigest: hash,
  gmailDraftBindingDigest: hash, directionDigest: hash, ledgerId: id,
  outgoingMessageId: id, outgoingRfcMessageId: z.string().min(1).max(500), outgoingBodySha256: hash,
  sendsAuthorized: z.literal(false), approvalGranted: z.literal(false),
}).strict();
export type CommunicationsFounderReplyBinding = z.infer<typeof communicationsFounderReplyBindingSchema>;
export function verifyCommunicationsFounderReplyBinding(value: unknown, brief: CommunicationsBrief, parent: CommunicationsBrief) {
  const binding = communicationsFounderReplyBindingSchema.parse(value);
  const expected = { ...parent, briefId: brief.briefId,
    replyOrigin: { origin: "founder_send_observed", parentBriefId: parent.briefId, parentBriefDigest: communicationsDigest(parent),
      founderSendObservationId: binding.founderSendObservationId, founderSendObservationDigest: binding.founderSendObservationDigest },
    priorConversation: { gmailThreadId: brief.priorConversation?.gmailThreadId, gmailMessageIds: [binding.outgoingMessageId] } };
  if (brief.briefId === parent.briefId || binding.briefDigest !== communicationsDigest(brief)
    || binding.parentBriefId !== parent.briefId || binding.parentBriefDigest !== communicationsDigest(parent)
    || communicationsDigest(expected) !== communicationsDigest(brief)) throw new Error("reply_parent_context_changed");
  return binding;
}

/** Same plain-text normalization as reply intake's outgoing-body comparison. */
export function founderSentContentSha256(value: string) {
  return createHash("sha256").update(value.replace(/\r\n/g, "\n")).digest("hex");
}
/** Consequential fields of a verified Gmail draft-copy binding. */
export function founderDraftBindingIdentity(value: unknown) {
  const row = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  return Object.fromEntries(["version", "jobId", "ledgerId", "prospectId", "deliveryKey", "state", "draftId",
    "content", "receipt", "verifiedAt", "revisionId"].map(key => [key, row[key] ?? null]));
}
export const FOUNDER_SEND_OBSERVATION_VERSION = "blueprint.communications-founder-send-observation.v1" as const;
/** Evidence that the founder sent a Blueprint-copied Gmail draft. Message
 * bodies are never stored; only their hashes and Gmail/RFC identifiers. */
export const founderSendObservationSchema = z.object({
  version: z.literal(FOUNDER_SEND_OBSERVATION_VERSION), state: z.literal("observed"),
  jobId: hash, prospectId: id, briefId: id, briefDigest: hash,
  intent: z.enum(["outreach", "reply"]), inboundMessageId: id.nullable(),
  ledgerId: z.string().regex(/^communications_[a-f0-9]{64}$/), deliveryKey: hash,
  payloadDigest: hash, reviewDigest: hash, recipient: z.string().email().max(254),
  gmailDraftBindingDigest: hash, directionDigest: hash,
  direction: z.object({ uri: z.string().min(1).max(1000), generation: z.string().regex(/^[0-9]+$/), sha256: hash }).strict(),
  draft: z.object({ draftId: id, messageId: id, threadId: id, verifiedAt: z.number().finite() }).strict(),
  sent: z.object({ gmailMessageId: id, threadId: id, rfcMessageId: z.string().min(1).max(500), sentAt: date,
    subjectSha256: hash, bodySha256: hash,
    // thread_origin: the earliest send in an outreach copy's own new thread.
    // A reply copy shares an existing thread, so it needs the job header, the
    // draft's Message-ID or exact content. Cc/Bcc are recorded only as a flag.
    jobHeaderMatched: z.boolean(), rfcMatchesDraft: z.boolean(), additionalRecipients: z.boolean(),
    matchBasis: z.enum(["thread_origin", "job_header", "rfc_message_id", "exact_content"]) }).strict(),
  contentMatch: z.enum(["exact", "differs_from_draft"]),
  sendsAuthorized: z.literal(false), approvalGranted: z.literal(false),
  evidenceDigest: hash, recipientSuppressedAtObservation: z.boolean(),
  observedAt: date, recordedAt: z.number().finite(),
}).strict();
export type FounderSendObservation = z.infer<typeof founderSendObservationSchema>;
/** Replays compare this digest; observation-time context is excluded. */
export function founderSendEvidenceDigest(value: Omit<FounderSendObservation, "evidenceDigest" | "recipientSuppressedAtObservation" | "observedAt" | "recordedAt">
  | FounderSendObservation) {
  const { evidenceDigest: _digest, recipientSuppressedAtObservation: _suppressed, observedAt: _observed, recordedAt: _recorded, ...evidence } = value as FounderSendObservation;
  return communicationsDigest(evidence);
}
export function verifyFounderSendObservation(value: unknown): FounderSendObservation {
  const observation = founderSendObservationSchema.parse(value);
  if (founderSendEvidenceDigest(observation) !== observation.evidenceDigest
    || observation.ledgerId !== `communications_${observation.jobId}`) throw new Error("founder_send_observation_digest_mismatch");
  return observation;
}
/** Bind a founder-origin reply to the immutable observation and draft copy. */
export function verifyFounderReplyAnchor(binding: CommunicationsFounderReplyBinding, observationValue: unknown,
  draftBindingValue: unknown, brief: CommunicationsBrief) {
  let observation: FounderSendObservation;
  try { observation = verifyFounderSendObservation(observationValue); }
  catch { throw new Error("reply_parent_observation_or_handoff_changed"); }
  if (observation.jobId !== binding.founderSendObservationId || observation.evidenceDigest !== binding.founderSendObservationDigest
    || observation.gmailDraftBindingDigest !== binding.gmailDraftBindingDigest || observation.directionDigest !== binding.directionDigest
    || observation.ledgerId !== binding.ledgerId || observation.briefDigest !== binding.parentBriefDigest
    || observation.sent.gmailMessageId !== binding.outgoingMessageId || observation.sent.rfcMessageId !== binding.outgoingRfcMessageId
    || observation.sent.bodySha256 !== binding.outgoingBodySha256 || observation.sent.threadId !== brief.priorConversation?.gmailThreadId
    || communicationsDigest(founderDraftBindingIdentity(draftBindingValue)) !== observation.gmailDraftBindingDigest) {
    throw new Error("reply_parent_observation_or_handoff_changed");
  }
  return observation;
}

export const communicationsJobSchema = z.object({
  jobId: id, prospectId: id, briefId: id, briefDigest: z.string().regex(/^[a-f0-9]{64}$/),
  intent: z.enum(["outreach", "reply"]), inboundMessageId: id.nullable(),
}).strict();
export type CommunicationsJob = z.infer<typeof communicationsJobSchema>;
export type ThreadMessage = {
  gmailMessageId: string; rfcMessageId: string; gmailThreadId: string;
  from: string; to: string[]; subject: string; body: string; receivedAt: string;
  inReplyTo: string | null; references: string[];
};
export type VerifiedThread = {
  mailbox: typeof FOUNDER_MAILBOX; threadId: string; messages: ThreadMessage[]; fetchedAt: string;
};

export const communicationsOutputSchema = z.object({
  disposition: z.enum(["draft", "research_refresh", "no_reply"]),
  subject: z.string().trim().max(1000), body: z.string().trim().max(20000),
  // Reasoning is evidence, not a field-length quota. Retain it completely within
  // the existing bounded provider response; send and review authority stay separate.
  reason: z.string().trim().min(1), usedFactIds: z.array(id).max(16),
  refreshFactIds: z.array(id).max(16),
  outreachContract: outreachReviewContractSchema.nullable(),
  requiresHumanReview: z.literal(true),
}).strict();
export type CommunicationsOutput = z.infer<typeof communicationsOutputSchema>;

export const communicationsEnvelopeSchema = z.object({
  version: z.literal("blueprint.communications.v1"),
  job: communicationsJobSchema, brief: communicationsBriefSchema,
  thread: z.object({
    mailbox: z.literal(FOUNDER_MAILBOX), threadId: id, fetchedAt: date,
    messages: z.array(z.object({
      gmailMessageId: id, rfcMessageId: z.string().min(1).max(500), gmailThreadId: id,
      from: z.string().email(), to: z.array(z.string().email()).min(1).max(20),
      subject: z.string().max(1000), body: z.string().max(12000), receivedAt: date,
      inReplyTo: z.string().max(500).nullable(), references: z.array(z.string().max(500)).max(40),
    }).strict()).min(1).max(20),
  }).strict().nullable(),
  output: communicationsOutputSchema,
  approvalState: z.literal("pending_approval"),
}).strict();
export type CommunicationsEnvelope = z.infer<typeof communicationsEnvelopeSchema>;

export function communicationsDigest(value: unknown) {
  // Deterministic across Firestore's map-key ordering.
  const canonical = (item: any): any => Array.isArray(item) ? item.map(canonical)
    : item && typeof item === "object"
      ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, canonical(item[key])])) : item;
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}

export function briefRefreshReasons(brief: CommunicationsBrief, now: number): string[] {
  const stale = (time: string, days: number) => {
    const age = now - Date.parse(time);
    return !Number.isFinite(age) || age < 0 || age > days * 86400000;
  };
  const reasons = brief.facts.filter((fact) => stale(fact.sourceCheckedAt, fact.consequential ? 7 : 30))
    .map((fact) => `stale_fact:${fact.id}`);
  if (stale(brief.contact.sourceCheckedAt, 30)) reasons.push("stale_contact");
  if (brief.conflicts.length) reasons.push("conflicting_evidence");
  if (brief.stage.interest !== "unknown" && (!brief.stage.evidenceIds.length
    || brief.stage.evidenceIds.some((ref) => !brief.facts.some((fact) => fact.id === ref && fact.evidenceClass !== "inference")))) {
    reasons.push("stage_evidence_missing");
  }
  if (!brief.contact.learningQuestion.endsWith("?") || (brief.contact.learningQuestion.match(/\?/g) || []).length !== 1) {
    reasons.push("one_learning_question_required");
  }
  for (const observation of [...brief.outreachContext.observations, ...brief.outreachContext.teamObservations]) {
    if (!brief.facts.some((fact) => fact.claim === observation.claim && fact.sourceUrl === observation.source && fact.evidenceClass !== "inference")) {
      reasons.push("observation_evidence_missing");
    }
  }
  return [...new Set(reasons)];
}

/** Both provider IDs and RFC references must match; subject similarity is insufficient. */
export function correlateReply(brief: CommunicationsBrief, thread: VerifiedThread, messageId: string): ThreadMessage | null {
  const prior = brief.priorConversation;
  if (!prior || prior.gmailThreadId !== thread.threadId || thread.mailbox !== FOUNDER_MAILBOX) return null;
  const message = thread.messages.find((item) => item.gmailMessageId === messageId);
  if (!message || message.gmailThreadId !== thread.threadId || message.from !== brief.contact.email.toLowerCase()
    || !message.to.some((to) => (FOUNDER_MAILBOX_ALIASES as readonly string[]).includes(to.toLowerCase()))) return null;
  const priorMessages = thread.messages.filter((item) => prior.gmailMessageIds.includes(item.gmailMessageId));
  if (priorMessages.length !== prior.gmailMessageIds.length) return null;
  const previousFounderMessages = priorMessages.filter((item) => item.from === FOUNDER_MAILBOX
    && item.to.includes(brief.contact.email.toLowerCase()) && Date.parse(item.receivedAt) < Date.parse(message.receivedAt));
  return previousFounderMessages.some((item) => message.inReplyTo === item.rfcMessageId
    || message.references.includes(item.rfcMessageId)) ? message : null;
}

/** Read author text only; quoted messages cannot authorize or suppress anything. */
export function authorText(body: string) {
  const lines = body.split(/\r?\n/);
  const end = lines.findIndex((line) => /^(?:On .{1,500}wrote:|[- ]*Original Message[- ]*|From:.*@)/i.test(line));
  return lines.slice(0, end < 0 ? lines.length : end).filter((line) => !/^\s*>/.test(line)).join("\n").trim();
}
/** Plain-text form for founder-thread scans that hold no ThreadMessage. */
export function isOptOutText(body: string) {
  return /\b(?:unsubscribe|remove (?:me|us) from|take (?:me|us) off|(?:do not|don't) (?:contact|email|message|follow[ -]?up)|stop (?:emailing|contacting|sending|messaging|following[ -]?up)|no (?:more |further )?(?:follow[ -]?ups?)|no more (?:emails|messages))\b/i
    .test(authorText(body).replace(/[’‘]/g, "'"));
}

export function isOptOut(message: ThreadMessage) {
  return isOptOutText(message.body);
}

/** Largest thread reply intake reads; founder-send observation uses the same bound. */
export const FOUNDER_THREAD_MESSAGE_LIMIT = 20;

export function correlatedReplies(brief: CommunicationsBrief, thread: VerifiedThread) {
  return thread.messages.filter((message) => correlateReply(brief, thread, message.gmailMessageId))
    .sort((a, b) => Date.parse(a.receivedAt) - Date.parse(b.receivedAt));
}

/** A revision cannot license a second first touch or a second answer to one reply. */
export function communicationsDeliveryKey(job: CommunicationsJob) {
  return communicationsDigest({ mailbox: FOUNDER_MAILBOX, prospectId: job.prospectId,
    intent: job.intent, inboundMessageId: job.intent === "reply" ? job.inboundMessageId : null });
}
