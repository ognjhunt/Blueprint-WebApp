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

/** Free preparation consumed by reply intake and refreshed by evidence review.
 * Uninterpreted text cannot establish which details the recipient omitted. */
export function prepareReplyFollowup(value: any) {
  const reviewed = value.state === "reviewed", closed = value.state === "opted_out" || value.nextAction === "no_action";
  const fields = ["statedTask", "desiredOutcome", "timing"] as const;
  const unresolved = reviewed ? fields.filter(field => !value[field]) : null;
  const role = value.audienceRole, taskQuestion = role === "site"
    ? "Which recurring task would you like to explore?"
    : role === "world_model_evaluation" ? "What would you want to validate about your model or evaluation methods?"
    : "What part of finding customers or assessing tasks would you want help with?";
  const outcomeQuestion = role === "site" ? "What would you want to improve or learn about that task?"
    : role === "world_model_evaluation" ? "What would a useful technical validation help you learn?"
    : "What would you want Blueprint's help to accomplish in that process?";
  const questions = { statedTask: taskQuestion, desiredOutcome: outcomeQuestion,
    timing: "What timing, if any, would be useful for exploring this?" };
  const continuing = reviewed && ["exploratory_interest", "explicit_commitment"].includes(value.responseMeaning);
  const field = continuing ? unresolved?.[0] : null;
  const conditional = !continuing;
  const question = field ? questions[field] : "What, if anything, would you like Blueprint's help exploring?";
  const action = closed ? "no_action" : value.contextMissing ? "clarify_context"
    : !continuing ? "review_reply" : field ? "prepare_clarification_for_owner" : "review_next_step";
  const binding = { evidenceDigest: value.evidenceDigest, reviewRevisionId: value.review?.revisionId ?? null,
    contextMissing: value.contextMissing, responseMeaning: value.responseMeaning, nextAction: value.nextAction,
    statedTask: value.statedTask, desiredOutcome: value.desiredOutcome, timing: value.timing };
  return { version: "blueprint.reply-preparation.v1", bindingDigest: communicationsDigest(binding), ...binding,
    owner: value.owner, action, sourceMessageIds: value.evidence.map((item: any) => item.messageId),
    fieldStatus: Object.fromEntries(fields.map(field => [field, !reviewed ? "not_interpreted" : value[field] ? "evidence_recorded" : "unresolved"])),
    unresolvedFields: unresolved,
    ownerTask: closed ? "Retain the response; prepare no follow-up."
      : value.contextMissing ? "Repair the original site/task/contact linkage before considering a follow-up."
      : !continuing ? "Review the linked reply and record its supported meaning and details before choosing a follow-up."
      : field ? "Review the proposed single clarification against the actual reply before composing it in the founder's thread."
      : "Review the established task, desired outcome and timing, then choose a bounded next step within the existing permissions.",
    proposedDraft: closed || value.contextMissing || continuing && !field ? null : {
      body: `Thanks for your reply.\n\n${question}\n\nNijel`, question, requiresOwnerReview: true,
      condition: conditional ? "Use only if review confirms continuation is appropriate and this question is still unanswered." : null,
    },
    authority: { spending: false, listing: false, recording: false, sharing: false, sending: false },
  };
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
  const priorReviewedContext = changed && saved?.review ? {
    evidenceDigest: saved.evidenceDigest, review: saved.review, responseMeaning: saved.responseMeaning,
    meaningEvidence: saved.meaningEvidence ?? null, statedTask: saved.statedTask, desiredOutcome: saved.desiredOutcome,
    timing: saved.timing, nextAction: saved.nextAction, status: "historical_requires_reassessment",
  } : saved?.priorReviewedContext ?? null;
  const value = { ...identity, evidenceDigest, owner: FOUNDER_MAILBOX, untrusted: true,
    state: optedOut ? "opted_out" : changed ? "awaiting_owner_review" : saved.state,
    responseMeaning: optedOut ? "opt_out" : changed ? "unknown" : saved.responseMeaning,
    meaningEvidence: changed ? null : saved.meaningEvidence ?? null,
    statedTask: changed ? null : saved.statedTask, desiredOutcome: changed ? null : saved.desiredOutcome,
    timing: changed ? null : saved.timing, nextAction: optedOut ? "no_action" : changed ? "review_reply" : saved.nextAction,
    contextMissing: input.contextMissing, originalObservedAt: saved?.originalObservedAt ?? input.observedAt,
    updatedAt: input.now, review: changed ? null : saved.review ?? null,
    priorReviewedContext,
    authority: { spending: false, listing: false, recording: false, sharing: false, sending: false },
  };
  return { ...value, preparation: prepareReplyFollowup(value) };
}

export function verifyReplyFollowup(value: any) {
  if (!value || value.version !== "blueprint.reply-followup.v1") throw new Error("reply_followup_missing");
  const identity = Object.fromEntries(["version", "handoffId", "prospectId", "parentBriefDigest", "threadId", "recipient",
    "siteId", "taskId", "taskHypothesis", "audienceRole", "consent", "evidence"].map(key => [key, value[key]]));
  if (communicationsDigest(identity) !== value.evidenceDigest
    || replyFollowupId(value.prospectId, value.parentBriefDigest, value.threadId) !== value.handoffId) {
    throw new Error("reply_followup_binding_changed");
  }
  if (value.preparation && communicationsDigest(value.preparation) !== communicationsDigest(prepareReplyFollowup(value))) {
    throw new Error("reply_followup_preparation_changed");
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
    if (saved.state === "reviewed" && saved.preparation && saved.review?.reviewedBy === actor
      && communicationsDigest(Object.fromEntries(Object.keys(meaning).map(key => [key, saved[key]]))) === communicationsDigest(meaning)) return saved;
    const attestation = { ...meaning, evidenceDigest: saved.evidenceDigest, reviewedBy: actor, reviewedAt: now };
    const revisionId = communicationsDigest(attestation), revision = ref.collection("reviews").doc(revisionId);
    const previous = await tx.get(revision);
    if (!previous.exists) tx.create(revision, attestation);
    const value = { ...saved, ...meaning, state: "reviewed", review: { revisionId, reviewedBy: actor, reviewedAt: now }, updatedAt: now };
    const preparation = prepareReplyFollowup(value);
    tx.update(ref, { ...meaning, state: value.state, review: value.review, updatedAt: now, preparation });
    return { ...value, preparation };
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
