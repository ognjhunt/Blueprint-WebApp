import { createHash } from "node:crypto";
import { z } from "zod";
import { outreachContextSchema, outreachReviewContractSchema } from "./outreach-review";

export const COMMUNICATIONS_MODEL = "gpt-6-luna";
export const COMMUNICATIONS_PROJECT = "proj_F2tFJuxLaovJru8RrtXRaqNj";
export const FOUNDER_MAILBOX = "nijel@tryblueprint.io";
export const FOUNDER_MAILBOX_ALIASES = [FOUNDER_MAILBOX, "hello@tryblueprint.io"] as const;
const id = z.string().trim().min(1).max(160).regex(/^[a-zA-Z0-9_.:-]+$/);
const text = z.string().trim().min(1).max(1200);
const date = z.string().datetime();
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
  }).strict(),
  consent: z.object({
    status: z.enum(["unknown", "public_business_contact", "reply_requested", "opted_out"]),
    sharingBoundary: text, sourceRefs: z.array(text).max(8),
  }).strict(),
  priorConversation: z.object({
    gmailThreadId: id, gmailMessageIds: z.array(id).min(1).max(20),
  }).strict().nullable(),
  outreachContext: outreachContextSchema,
  qualityReview: z.object({
    state: z.literal("approved"), reviewedBy: text, reviewedAt: date, sourceRecordUrl: publicUrl,
  }).strict(),
  researchOrigin: z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), candidateKey: text,
    packetDigest: z.string().regex(/^[a-f0-9]{64}$/),
    rawArtifactDigest: z.string().regex(/^[a-f0-9]{64}$/),
    // Communications adapter provenance; original candidate stays in an
    // immutable source record, including quotes, unknowns and cached fact IDs.
    sourceDigest: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  }).strict(),
}).strict();
export type CommunicationsBrief = z.infer<typeof communicationsBriefSchema>;

/** Separate immutable record written by research QA/publication or the verified
 * publication adapter after authenticated human context review, never by the
 * communications model or directly from a request body. */
export const communicationsHandoffSchema = z.object({
  version: z.literal("blueprint.communications-handoff.v1"), state: z.literal("approved"),
  briefDigest: z.string().regex(/^[a-f0-9]{64}$/), reviewedBy: text, reviewedAt: date,
  sourceRecordUrl: publicUrl, sheetsReceipt: text, notionReceipt: text,
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
  subject: z.string().trim().max(120), body: z.string().trim().max(2200),
  reason: text, usedFactIds: z.array(id).max(16),
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
export function isOptOut(message: ThreadMessage) {
  return /\b(?:unsubscribe|remove (?:me|us) from|take (?:me|us) off|(?:do not|don't) (?:contact|email|message)|stop (?:emailing|contacting|sending|messaging)|no more (?:emails|messages))\b/i
    .test(authorText(message.body).replace(/[’‘]/g, "'"));
}

export function correlatedReplies(brief: CommunicationsBrief, thread: VerifiedThread) {
  return thread.messages.filter((message) => correlateReply(brief, thread, message.gmailMessageId))
    .sort((a, b) => Date.parse(a.receivedAt) - Date.parse(b.receivedAt));
}

/** A revision cannot license a second first touch or a second answer to one reply. */
export function communicationsDeliveryKey(job: CommunicationsJob) {
  return communicationsDigest({ mailbox: FOUNDER_MAILBOX, prospectId: job.prospectId,
    intent: job.intent, inboundMessageId: job.intent === "reply" ? job.inboundMessageId : null });
}
