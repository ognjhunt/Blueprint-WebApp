import { z } from "zod";
import { communicationsDigest, FOUNDER_MAILBOX, type CommunicationsBrief, type ThreadMessage } from "./communications-contract";

const id = z.string().regex(/^[a-zA-Z0-9_.:@-]{1,254}$/);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const supportedText = z.object({ value: z.string().trim().min(1).max(1200),
  messageId: id, quote: z.string().min(1).max(4000) }).strict();
export const replyFollowupReviewSchema = z.object({ expectedEvidenceDigest: hash,
  responseMeaning: z.enum(["unknown", "exploratory_interest", "no_need", "negative", "explicit_commitment"]),
  meaningEvidence: supportedText.nullable(), statedTask: supportedText.nullable(),
  desiredOutcome: supportedText.nullable(), timing: supportedText.nullable(),
  nextAction: z.enum(["review_reply", "clarify_context", "prepare_draft_for_review", "no_action"]),
}).strict().refine(value => value.responseMeaning === "unknown" || value.meaningEvidence !== null,
  "a recorded meaning requires original reply evidence")
  .refine(value => !["no_need", "negative"].includes(value.responseMeaning) || value.nextAction === "no_action",
    "a negative response must not queue outreach");

export function replyFollowupId(prospectId: string, parentBriefDigest: string, threadId: string) {
  return communicationsDigest({ prospectId, parentBriefDigest, threadId });
}
export function replyFollowupRef(db: FirebaseFirestore.Firestore, prospectId: string, handoffId: string) {
  return db.collection("outboundProspects").doc(prospectId).collection("replyFollowups").doc(handoffId);
}

/** Part of the intake transaction, after all reads. Existing CRM events retain
 * exact bytes; this is an actionable private owner queue with portable links. */
export function makeReplyFollowup(input: { brief: CommunicationsBrief; parentBriefDigest: string; threadId: string;
  replies: ThreadMessage[]; observedAt: string; now: number; optOut: boolean; contextMissing: boolean }, saved?: any) {
  if (saved) verifyReplyFollowup(saved);
  const { brief } = input, handoffId = replyFollowupId(brief.prospectId, input.parentBriefDigest, input.threadId);
  const evidence = new Map<string, any>((saved?.evidence ?? []).map((item: any) => [item.messageId, item]));
  for (const message of input.replies) {
    const item = { messageId: message.gmailMessageId, rfcMessageId: message.rfcMessageId, receivedAt: message.receivedAt,
      messageHash: communicationsDigest(message), recordRef: `outboundProspects/${brief.prospectId}/communicationsEvents/reply_${message.gmailMessageId}` };
    if (evidence.has(item.messageId) && communicationsDigest(evidence.get(item.messageId)) !== communicationsDigest(item)) {
      throw new Error("reply_followup_evidence_changed");
    }
    evidence.set(item.messageId, item);
  }
  const identity = { version: "blueprint.reply-followup.v1", handoffId, prospectId: brief.prospectId,
    parentBriefDigest: input.parentBriefDigest, threadId: input.threadId, recipient: brief.contact.email.toLowerCase(),
    siteId: brief.siteId, taskId: brief.taskId, taskHypothesis: brief.boundedJob, audienceRole: brief.audienceRole ?? "site",
    consent: brief.consent, evidence: [...evidence.values()].sort((a, b) => a.messageId.localeCompare(b.messageId)) };
  const evidenceDigest = communicationsDigest(identity);
  const changed = saved?.evidenceDigest !== evidenceDigest;
  const optedOut = input.optOut || saved?.state === "opted_out";
  return { ...identity, evidenceDigest, owner: FOUNDER_MAILBOX, untrusted: true,
    state: optedOut ? "opted_out" : changed ? "awaiting_owner_review" : saved.state,
    responseMeaning: optedOut ? "opt_out" : changed ? "unknown" : saved.responseMeaning,
    statedTask: changed ? null : saved.statedTask, desiredOutcome: changed ? null : saved.desiredOutcome,
    timing: changed ? null : saved.timing, nextAction: optedOut ? "no_action" : changed ? "review_reply" : saved.nextAction,
    contextMissing: input.contextMissing, originalObservedAt: saved?.originalObservedAt ?? input.observedAt,
    updatedAt: input.now, review: changed ? null : saved.review ?? null,
    authority: { spending: false, listing: false, recording: false, sharing: false, sending: false },
  };
}

export function verifyReplyFollowup(value: any) {
  if (!value || value.version !== "blueprint.reply-followup.v1") throw new Error("reply_followup_missing");
  const identity = Object.fromEntries(["version", "handoffId", "prospectId", "parentBriefDigest", "threadId", "recipient",
    "siteId", "taskId", "taskHypothesis", "audienceRole", "consent", "evidence"].map(key => [key, value[key]]));
  if (communicationsDigest(identity) !== value.evidenceDigest
    || replyFollowupId(value.prospectId, value.parentBriefDigest, value.threadId) !== value.handoffId) {
    throw new Error("reply_followup_binding_changed");
  }
  return value;
}

/** Authenticated operator records meaning against exact observed bytes. It never
 * mutates a consent/qualification field or queues a model, Gmail copy or send. */
export async function reviewReplyFollowup(db: FirebaseFirestore.Firestore, prospectId: string, handoffId: string,
  input: unknown, actor: string, now: number) {
  id.parse(prospectId); hash.parse(handoffId); id.parse(actor);
  const review = replyFollowupReviewSchema.parse(input), ref = replyFollowupRef(db, prospectId, handoffId);
  return db.runTransaction(async tx => {
    const saved = verifyReplyFollowup((await tx.get(ref)).data());
    if (saved.prospectId !== prospectId || saved.handoffId !== handoffId || saved.evidenceDigest !== review.expectedEvidenceDigest) {
      throw new Error("reply_followup_binding_changed");
    }
    if (saved.state === "opted_out") throw new Error("reply_followup_opted_out");
    const evidence = await Promise.all(saved.evidence.map((item: any) => tx.get(db.doc(item.recordRef))));
    for (let index = 0; index < evidence.length; index++) {
      if (evidence[index].data()?.untrusted !== true
        || communicationsDigest(evidence[index].data()?.message) !== saved.evidence[index].messageHash) throw new Error("reply_followup_evidence_changed");
    }
    for (const field of [review.meaningEvidence, review.statedTask, review.desiredOutcome, review.timing]) {
      if (field && !evidence.some(event => event.data()?.message.gmailMessageId === field.messageId
        && event.data()?.message.body.includes(field.quote))) throw new Error("reply_followup_quote_not_observed");
    }
    const { expectedEvidenceDigest: _, ...meaning } = review;
    if (saved.state === "reviewed" && saved.review?.reviewedBy === actor
      && communicationsDigest(Object.fromEntries(Object.keys(meaning).map(key => [key, saved[key]]))) === communicationsDigest(meaning)) return saved;
    const attestation = { ...meaning, evidenceDigest: saved.evidenceDigest, reviewedBy: actor, reviewedAt: now };
    const revisionId = communicationsDigest(attestation), revision = ref.collection("reviews").doc(revisionId);
    const previous = await tx.get(revision);
    if (!previous.exists) tx.create(revision, attestation);
    tx.update(ref, { ...meaning, state: "reviewed", review: { revisionId, reviewedBy: actor, reviewedAt: now }, updatedAt: now });
    return { ...saved, ...meaning, state: "reviewed", review: { revisionId, reviewedBy: actor, reviewedAt: now } };
  });
}

export async function readReplyFollowup(db: FirebaseFirestore.Firestore, brief: CommunicationsBrief, threadId: string) {
  if (!brief.replyOrigin) return null;
  const handoffId = replyFollowupId(brief.prospectId, brief.replyOrigin.parentBriefDigest, threadId);
  const value = (await replyFollowupRef(db, brief.prospectId, handoffId).get()).data();
  if (!value) return null; // Legacy reply jobs may predate handoff creation.
  const saved = verifyReplyFollowup(value);
  if (saved.recipient !== brief.contact.email.toLowerCase() || saved.siteId !== brief.siteId || saved.taskId !== brief.taskId) {
    throw new Error("reply_followup_binding_changed");
  }
  return saved;
}
