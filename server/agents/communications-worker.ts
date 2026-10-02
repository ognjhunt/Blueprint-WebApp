import { dbAdmin } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { isEmailSuppressed, recordEmailSuppression, buildUnsubscribeUrl, appendCommercialEmailFooter } from "../utils/email-suppression";
import { COMMUNICATIONS_OUTREACH_GUIDANCE } from "./communications-instructions";
import {
  communicationsBriefSchema, communicationsJobSchema, communicationsDigest, briefRefreshReasons,
  correlateReply, correlatedReplies, isOptOut, FOUNDER_MAILBOX, type CommunicationsBrief, type VerifiedThread,
  type CommunicationsJob, type CommunicationsOutput,
} from "./communications-contract";
import { CommunicationsAgentsAPI, CommunicationsRuntimeError, type CommunicationsCheckpoint,
  type CommunicationsOutputFeedback } from "./communications-api";
import { verifyFounderMailbox, readFounderThread } from "./communications-gmail";
import { readExistingResearchSnapshot, verifyPublishedResearch, type ResearchSnapshotReader } from "./communications-research";
import { reviewCommunicationsPayload } from "./communications-review";
import { CommunicationsStore, type CommunicationsJobRecord } from "./communications-store";
import type { ActionPayload } from "./action-policies";
import { runCommunicationsIntake } from "./communications-intake";
import { runCommunicationsReplyIntake } from "./communications-reply-intake";
import { readPublicContactPage } from "./communications-contact-fetch";
import { automaticFirstContactEnabled, firstContactGeography, ROUTINE_COMMUNICATIONS_POLICY,
  routineCommunicationsContentBlockers } from "./communications-first-contact";
import { executeAutomaticFirstContact } from "./communications-send";
import { appendFirstContactFooter, firstContactPostalLine } from "./communications-first-contact-footer";
import { CommunicationsDraftBudgetError, reserveCommunicationsDraft, recordCommunicationsDraftUsage,
  reconcileCommunicationsDraftCost } from "./communications-draft-budget";
import { createNativeLearningHooks, REVIEWED_NATIVE_LEARNING_CONFIG } from "../research-learning/native-hooks";

type CommunicationsLearningHooks = Pick<ReturnType<typeof createNativeLearningHooks>, "prepareNativeJob" | "afterNativeWork">;
type PreparedLearning = Awaited<ReturnType<CommunicationsLearningHooks["prepareNativeJob"]>>;

export type CommunicationsDependencies = {
  store: CommunicationsStore;
  api: Pick<CommunicationsAgentsAPI, "run" | "cancel" | "reconcileSaved">;
  readResearch: ResearchSnapshotReader;
  verifyMailbox: () => Promise<unknown>;
  readThread: (threadId: string) => Promise<VerifiedThread>;
  isSuppressed: (email: string) => Promise<boolean>;
  suppress: (email: string, reason: string) => Promise<{ persisted: boolean }>;
  now: () => number;
  learningHooks?: CommunicationsLearningHooks;
  sendAutomatic?: (ledgerId: string) => Promise<{ state: "sent" | "auto_approved" | "failed"; reason?: string }>;
};

/** Trusted operator lane, after the existing authenticated retry/claim checks.
 * This observes the same reviewed saved output and queues human review only. */
export function recoverSavedCommunicationsDraft(jobId: string, expectedOutputSha256: string, deps: CommunicationsDependencies) {
  if (!/^[a-f0-9]{64}$/.test(expectedOutputSha256)) throw new Error("communications_saved_output_digest_invalid");
  return processCommunicationsJob(jobId, deps, { expectedOutputSha256 });
}

export async function processCommunicationsJob(jobId: string, deps: CommunicationsDependencies,
  recovery?: { expectedOutputSha256: string }) {
  const claimed = await deps.store.claim(jobId);
  if (!claimed) return { state: "no_op" };
  const job = communicationsJobSchema.parse(Object.fromEntries(Object.entries(claimed).filter(([key]) =>
    ["jobId", "prospectId", "briefId", "briefDigest", "intent", "inboundMessageId"].includes(key))));
  try {
    const brief = communicationsBriefSchema.parse(await deps.store.brief(job.briefId));
    if (brief.prospectId !== job.prospectId || job.briefDigest !== communicationsDigest(brief)) throw new Error("research_brief_changed");
    const source = await deps.store.db.collection("outboundProspects").doc(job.prospectId).get();
    const prospect = source.data();
    if (!source.exists || prospect?.contactEmail?.toLowerCase() !== brief.contact.email.toLowerCase()
      || prospect?.siteId !== brief.siteId || prospect?.taskId !== brief.taskId) throw new Error("canonical_prospect_identity_missing_or_changed");
    let thread: VerifiedThread | null = null;
    if (job.intent === "reply") {
      if (!brief.priorConversation || !job.inboundMessageId) throw new Error("real_reply_context_missing");
      thread = await deps.readThread(brief.priorConversation.gmailThreadId);
      const incoming = correlateReply(brief, thread, job.inboundMessageId);
      if (!incoming) throw new Error("reply_correlation_missing");
      // Preserve what actually arrived. No model classification can rewrite it
      // into verified CRM fields or silently qualify the site.
      await deps.store.recordReply(job, incoming, thread.fetchedAt);
      const replies = correlatedReplies(brief, thread);
      const optOut = replies.find(isOptOut);
      if (optOut) {
        await deps.store.recordReply({ ...job, inboundMessageId: optOut.gmailMessageId }, optOut, thread.fetchedAt);
        const suppressed = await deps.suppress(brief.contact.email, `Correlated opt-out reply ${optOut.gmailMessageId}`);
        if (!suppressed.persisted) throw new Error("opt_out_suppression_not_persisted");
        await deps.store.db.collection("outboundProspects").doc(job.prospectId).set({
          stage: "closed", closedReason: "recipient_opt_out", closedAtIso: new Date(deps.now()).toISOString(),
        }, { merge: true });
        await deps.store.finish(job, "opted_out", "recipient_opt_out");
        return { state: "opted_out" };
      }
      if (replies.at(-1)?.gmailMessageId !== incoming.gmailMessageId) throw new Error("reply_superseded_requires_latest_context");
    } else {
      if (job.inboundMessageId || brief.priorConversation) throw new Error("outreach_requires_first_touch_context");
    }
    if (prospect?.stage === "closed" || brief.consent.status === "opted_out" || await deps.isSuppressed(brief.contact.email)) {
      throw new Error("recipient_suppressed");
    }
    if (brief.consent.status === "unknown") throw new Error("contact_permission_missing");
    if (job.intent === "outreach" && prospect?.stage !== "drafted") throw new Error("prospect_already_contacted");
    const refresh = briefRefreshReasons(brief, deps.now());
    if (refresh.length) {
      await deps.store.requestRefresh(job, refresh);
      return { state: "awaiting_research", reasons: refresh };
    }
    verifyPublishedResearch(await deps.readResearch(brief.researchOrigin.date, brief.researchOrigin.admissionId), brief, await deps.store.handoff(brief), await deps.store.contactProof(brief));
    const approval = await deps.store.approvalState(job.prospectId);
    const agentChosenHistory = !claimed.checkpoint.createClaimedAt && !claimed.checkpoint.sessionId
      || claimed.checkpoint.historyProfile === "agent-history-v1";
    // New sessions choose/fetch history themselves. Legacy charged sessions
    // retain their original frozen context and after-work observation.
    const learning = deps.learningHooks && !agentChosenHistory ? await deps.learningHooks.prepareNativeJob("communications",
      `blueprintCommunications/default/jobs/${jobId}`, [job.prospectId],
      { allowCreate: !recovery && !claimed.checkpoint.createClaimedAt && !claimed.checkpoint.sessionId }) : null;
    const input = buildCommunicationsInput(brief, thread, job.intent, approval, learning);
    // Bind only prospective work before its first paid create. Reconnected
    // sessions retain this decision; old charged/Tony sessions never acquire it.
    if (!recovery && !claimed.checkpoint.createClaimedAt && !claimed.checkpoint.sessionId && automaticFirstContactEnabled()) {
      claimed.automationPolicyVersion = ROUTINE_COMMUNICATIONS_POLICY.version;
      await deps.store.update(jobId, { automationPolicyVersion: claimed.automationPolicyVersion });
    }
    const automatic = !recovery && claimed.automationPolicyVersion === ROUTINE_COMMUNICATIONS_POLICY.version
      && automaticFirstContactEnabled() && !!firstContactPostalLine();
    const provenance = automatic ? (await deps.store.db.doc("blueprintCommunications/default").collection("researchSources").doc(job.briefDigest).get()).data() : null;
    const recipientGeography = automatic ? firstContactGeography(provenance, brief, deps.now()) : null;
    const assemble = (output: CommunicationsOutput) => buildCommunicationsPayload(job, brief, thread, output, automatic, recipientGeography);
    const assertRepairAllowed = async () => {
      // Repair cannot refresh or replace consequential context. The original
      // input, dates, lease and thread remain the correction boundary.
      const current = (await deps.store.db.doc("blueprintCommunications/default").collection("jobs").doc(jobId).get()).data();
      if (!current || !claimed.lease || current.lease?.owner !== claimed.lease.owner || !Number.isFinite(current.lease?.until)
        || current.lease.until <= deps.now() || claimed.lease.until <= deps.now()) throw new Error("communications_lease_lost");
      if (await deps.isSuppressed(brief.contact.email)) throw new Error("recipient_suppressed");
      if (briefRefreshReasons(brief, deps.now()).length) throw new Error("research_refresh_required");
      if (communicationsDigest(await deps.store.brief(job.briefId)) !== job.briefDigest) throw new Error("research_brief_changed");
      verifyPublishedResearch(await deps.readResearch(brief.researchOrigin.date, brief.researchOrigin.admissionId),
        brief, await deps.store.handoff(brief), await deps.store.contactProof(brief));
      const latest = (await deps.store.db.collection("outboundProspects").doc(job.prospectId).get()).data();
      if (!latest || latest.stage === "closed" || latest.contactEmail?.toLowerCase() !== brief.contact.email.toLowerCase()
        || latest.siteId !== brief.siteId || latest.taskId !== brief.taskId) throw new Error("canonical_prospect_identity_missing_or_changed");
      if (thread && communicationsDigest((await deps.readThread(thread.threadId)).messages) !== communicationsDigest(thread.messages)) {
        throw new Error("reply_thread_changed_requires_current_context");
      }
      if (current.lease.until <= deps.now() || claimed.lease.until <= deps.now()) throw new Error("communications_lease_lost");
    };
    const expired = claimed.checkpoint.createClaimedAt
      && deps.now() - Date.parse(claimed.checkpoint.createClaimedAt) >= 180000;
    // A completed saved turn remains useful after the observer/lease expired.
    // Reconciliation does only GETs; never extend the deadline or create a turn.
    const saved = recovery || expired ? await deps.api.reconcileSaved(claimed.checkpoint, jobId) : null;
    if (recovery && !saved) throw new CommunicationsRuntimeError("communications_saved_output_not_completed");
    if (expired && !saved) {
      const cancelled = await deps.api.cancel(claimed.checkpoint);
      throw new CommunicationsRuntimeError(cancelled ? "communications_deadline_cancel_requested" : "session_create_requires_reconciliation");
    }
    const result = saved ?? await deps.api.run({
      input, jobId, checkpoint: claimed.checkpoint,
      saveCheckpoint: (checkpoint: CommunicationsCheckpoint) => deps.store.update(jobId, { checkpoint }),
      assertRepairAllowed,
      validateOutput: async (output) => {
        const issues: CommunicationsOutputFeedback = output.disposition === "research_refresh"
          ? output.refreshFactIds.some(id => !brief.facts.some(fact => fact.id === id))
            ? [{ path: "refreshFactIds", code: "refresh_fact_unknown", message: "Select only fact IDs already present in researchBrief.facts; do not invent evidence." }] : []
          : output.disposition === "no_reply" ? [] : communicationsDraftFeedback(assemble(output), output, job.intent, automatic, deps.now());
        if (!issues.length) return null;
        await assertRepairAllowed();
        return issues;
      },
    });
    if (recovery && (!("outputSource" in result) || result.outputSource?.rawOutputSha256 !== recovery.expectedOutputSha256)) {
      throw new CommunicationsRuntimeError("communications_saved_output_changed", false, "outputSource" in result ? result.outputSource : undefined);
    }
    await deps.store.update(jobId, { output: result.output, checkpoint: result.checkpoint,
      ...("outputSource" in result && result.outputSource ? { outputSource: result.outputSource } : {}) });
    if (result.output.disposition === "research_refresh") {
      const factIds = result.output.refreshFactIds;
      if (factIds.some((id) => !brief.facts.some((fact) => fact.id === id))) throw new Error("refresh_fact_unknown");
      await deps.store.requestRefresh(job, [...factIds.map((id) => `refresh_fact:${id}`), result.output.reason]);
      return { state: "awaiting_research" };
    }
    if (result.output.disposition === "no_reply") {
      await deps.store.finish(job, "no_reply", result.output.reason);
      return { state: "no_reply" };
    }
    // Retain the writer's exact message. The separately verified immutable
    // server policy, not model prose or schema markers, supplies send authority.
    const output = result.output;
    const payload = assemble(output);
    const review = reviewCommunicationsPayload(payload, deps.now());
    if (!review.digest) throw new Error(`draft_quality_failed:${review.blockers.join(",")}`);
    // Preserve useful drafts and isolate unresolved claims/style diagnostics in
    // the existing human-review ledger. Approval/send still revalidate them.
    if (!review.hardChecksPassed) payload.communicationsDraftDiagnostics = { blockers: review.blockers };
    // Check suppression again after inference. Queue admission is not sending.
    if (await deps.isSuppressed(brief.contact.email)) throw new Error("recipient_suppressed");
    const ledgerId = await deps.store.commitDraft(job, output, payload, review.digest, result.usage);
    if (await deps.store.automaticDraft(ledgerId)) {
      const outcome = deps.sendAutomatic ? await deps.sendAutomatic(ledgerId) : { state: "auto_approved" as const };
      const persisted = await deps.store.finishAutomatic(job, outcome);
      return { ...outcome, ...persisted, ledgerId, sent: persisted.state === "sent", gmailDraftCreated: false };
    }
    const persisted = (await deps.store.db.doc("blueprintCommunications/default").collection("jobs").doc(jobId).get()).data();
    if (persisted?.state === "blocked") return { state: "blocked", reason: persisted.reason, ledgerId, sent: false, gmailDraftCreated: false };
    return { state: "pending_approval", ledgerId, sent: false, gmailDraftCreated: false };
  } catch (error) {
    if (error instanceof CommunicationsRuntimeError && error.outputSource) {
      await deps.store.update(jobId, { reason: error.code, ...{ outputSource: error.outputSource } });
    }
    if (error instanceof CommunicationsDraftBudgetError
      && ["communications_draft_cost_unresolved", "communications_draft_daily_admission_limit", "communications_draft_soft_target_reached"].includes(error.code)
      && !claimed.checkpoint.createClaimedAt && !claimed.checkpoint.sessionId) {
      await deps.store.deferDraftForBudget(jobId, error.code);
      return { state: "queued", reason: error.code, sent: false };
    }
    const code = error instanceof CommunicationsRuntimeError ? error.code
      : error instanceof Error && /^[a-z_][a-z0-9_:,.-]*$/.test(error.message) ? error.message : "communications_context_or_permission_unavailable";
    const retry = error instanceof CommunicationsRuntimeError && error.retryable && claimed.attempts < 3;
    if (retry) await deps.store.update(jobId, { state: "retry", reason: code, nextAttemptAt: deps.now() + claimed.attempts * 15000 });
    else await deps.store.finish(job, "blocked", code);
    return { state: retry ? "retry" : "blocked", reason: code };
  } finally {
    if (deps.learningHooks) {
      try { await deps.learningHooks.afterNativeWork(`blueprintCommunications/default/jobs/${jobId}`); }
      catch { logger.warn({ code: "communications_learning_observation_unavailable", jobId }, "Communications result retained; learning observation unavailable"); }
    }
  }
}

function buildCommunicationsPayload(job: CommunicationsJob, brief: CommunicationsBrief, thread: VerifiedThread | null,
  output: CommunicationsOutput, automatic: boolean, recipientGeography: ReturnType<typeof firstContactGeography>): ActionPayload {
  const incoming = thread?.messages.find(message => message.gmailMessageId === job.inboundMessageId);
  return {
    type: "send_email", to: brief.contact.email.toLowerCase(), from: FOUNDER_MAILBOX, replyTo: FOUNDER_MAILBOX,
    subject: output.subject, body: output.body, emailTransport: "founder_gmail",
    transportBody: automatic ? appendFirstContactFooter(output.body, brief.contact.email)
      : appendCommercialEmailFooter({ text: output.body, email: brief.contact.email, scope: "growth_campaign" }),
    commercialEmail: true, emailSuppressionScope: "growth_campaign",
    unsubscribeUrl: buildUnsubscribeUrl({ email: brief.contact.email, scope: automatic ? "all" : "growth_campaign", campaignId: `communications_${job.jobId}` }),
    outreachContext: brief.outreachContext, outreachContract: output.outreachContract,
    ...(recipientGeography ? { recipientGeography } : {}),
    ...(thread && incoming ? { gmailThreadId: thread.threadId, inReplyTo: incoming.rfcMessageId } : {}),
    communications: { version: "blueprint.communications.v1", job, brief, thread, output, approvalState: "pending_approval" },
  };
}

/** Field diagnostics only: this does not approve, publish, commit or send. */
function communicationsDraftFeedback(payload: ActionPayload, output: CommunicationsOutput, intent: CommunicationsJob["intent"], automatic: boolean, now: number): CommunicationsOutputFeedback {
  const fixes: Record<string, [string, string]> = {
    used_fact_missing: ["usedFactIds", "Reference only existing researchBrief.facts IDs; remove unsupported claims and IDs. Outreach needs a sourced fact; a plain acknowledgment need not cite one."],
    learning_question_mismatch: ["body", "For first outreach, use one easy question fitting the verified site; replies may adapt to the actual incoming message."],
    not_a_sendable_draft: ["disposition", "Provide a nonempty subject/body for a draft, or choose no_reply/research_refresh. A draft must have no refreshFactIds."],
    outreach_contract_missing_or_invalid: ["outreachContract", "For outreach, supply the recorded structured outreach contract matching this message; replies use null."],
    blueprint_identity_required: ["outreachContract.senderIdentity", "Identify Blueprint truthfully in the body and matching senderIdentity."],
    blueprint_identity_required_before_offer: ["body", "Put the recorded Blueprint identity before the offer."],
    review_anchor_missing_from_body: ["outreachContract", "Align the contract anchors with the exact authored body; preserve verified evidence and sharing limits."],
    verified_or_public_opening_must_come_first: ["body", "Place the verified/public opening before the offer and question."],
    exactly_one_initial_question_required: ["outreachContract.question", "Use one easy question ending in '?' for first outreach and include that exact question in the body."],
    team_feasibility_status_requires_matching_evidence: ["outreachContract.workflow", "Use pending with no feasibility sources, or public_research with sources already recorded in teamObservations."],
    team_feasibility_not_in_recorded_evidence: ["outreachContract.workflow.teamFeasibilitySources", "Use only sources already in the verified teamObservations; otherwise keep feasibility pending."],
    capability_claim_not_verified_in_record: ["outreachContract.capabilityClaims", "Remove unsupported capability claims; reference only capabilities already verified in this brief."],
    cold_detail_not_in_recorded_evidence: ["outreachContract.opening.publicDetail", "Choose an exact public observation already in the recorded outreachContext."],
    cold_detail_requires_public_url: ["outreachContract.opening.publicDetail.source", "Use the public source URL already recorded for that observation."],
    unverified_connection_claim: ["body", "Remove the claimed relationship; use the existing public-business context without inventing a connection."],
    connection_claim_not_verified_in_record: ["outreachContract.opening", "Use a cold public opening unless this brief already contains verified relationship evidence."],
    shared_community_implies_endorsement: ["body", "Remove the endorsement claim; a shared community does not establish endorsement."],
    discovery_cannot_promise_qualified_match_or_capacity: ["body", "Remove unsupported match, capacity or deployment promises; preserve evidence limits."],
    discovery_cannot_claim_site_sharing_permission: ["body", "Remove the sharing claim; this context does not authorize site disclosure."],
    default_meeting_or_questionnaire: ["body", "Remove the unapproved meeting/questionnaire request; keep the response within the recorded purpose."],
    confidential_or_capture_ask: ["body", "Remove requests for private data, footage or credentials; use existing authorized public context."],
    pressure_or_guarantee: ["body", "Remove pressure or guarantees; preserve recipient choice and unknown outcomes."],
    unsafe_reply_content: ["body", "Remove guarantees, pressure, credential or unapproved footage/private-data requests."],
    reply_subject_changed: ["subject", "Use the exact subject of the correlated incoming message already supplied in emailThread."],
    routine_public_scope_content_not_authorized: ["body", "Keep routine communications within the recorded public-business purpose; remove pricing, commitments, private/sensitive claims or requests. Do not invent additional authority."],
  };
  const review = reviewCommunicationsPayload(payload, now);
  const blockers = [...new Set([...review.blockers, ...(automatic ? routineCommunicationsContentBlockers(output, intent) : [])])];
  const consequential = blockers.filter(code => !fixes[code]);
  if (consequential.length) throw new Error(`communications_context_not_repairable:${consequential.join(",")}`);
  const issues = blockers.map(code => ({ code, path: fixes[code][0], message: fixes[code][1] }));
  if (/[\r\n]/.test(output.subject)) issues.push({ path: "subject", code: "email_header_injection", message: "Use a single-line subject; remove carriage returns and newlines." });
  return issues;
}

export function buildCommunicationsInput(brief: CommunicationsBrief, thread: VerifiedThread | null, intent: string, approvalState: unknown, learning?: PreparedLearning) {
  const policy = intent === "outreach" ? COMMUNICATIONS_OUTREACH_GUIDANCE
    : "Use the actual correlated reply; first-touch drafting is not required for this reply.";
  const base = { intent, approvedSender: FOUNDER_MAILBOX, researchBrief: brief,
    currentApproval: approvalState, emailThread: thread, emailContentTrust: "untrusted_data", firstTouchPolicy: policy };
  if (!learning) return JSON.stringify(base); // Legacy checkpoints keep their original input shape.
  const h = learning.handoff, reference = { inputHash: learning.inputHash, recordRef: learning.recordRef,
    preparedAt: learning.preparedAt, trust: "untrusted_evidence_only", sourceChecksRefreshed: false };
  const learningHistory = { ...reference, unknown: learning.unknown,
    ...(h ? { asOf: h.asOf, contextHash: h.contextHash, priorResearch: h.priorResearch.nativeResearchSubjects,
      priorContactAndOutcomes: { coverage: h.priorContactAndOutcomes.coverage, prospects: h.priorContactAndOutcomes.prospects,
        missingRecordsMean: h.priorContactAndOutcomes.missingRecordsMean },
      businessHistory: h.businessHistory, businessOverview: h.businessOverview,
      ...(learning.relevantHistory ? { relevantHistory: learning.relevantHistory } : {}),
      unknowns: h.unknowns, provenance: h.provenance } : {}) };
  const input = JSON.stringify({ ...base, learningHistory });
  // Retain the immutable full context by reference without making its inline
  // size a new first-draft gate. This choice replays from the same frozen input.
  return Buffer.byteLength(input) <= 64000 ? input : JSON.stringify({ ...base,
    learningHistory: { ...reference, unknown: "native_learning_context_exceeds_inline_budget" } });
}

/** Intake uses the existing worker flag; paid drafting has its separate gate. */
export function startCommunicationsWorker(): () => Promise<void> {
  if (process.env.BLUEPRINT_COMMUNICATIONS_WORKER_ENABLED !== "true"
    || !dbAdmin) return async () => undefined;
  const db = dbAdmin;
  const store = new CommunicationsStore(db);
  const allowPaidInference = process.env.BLUEPRINT_COMMUNICATIONS_ALLOW_PAID_INFERENCE === "true";
  const api: CommunicationsAgentsAPI = new CommunicationsAgentsAPI({ apiKey: process.env.OPENAI_API_KEY, allowPaidInference,
    reservePaidDraft: async (jobId, digest) => {
      await reconcileCommunicationsDraftCost(db, api, Date.now());
      return reserveCommunicationsDraft(db, jobId, digest, Date.now());
    },
    recordPaidDraftUsage: (jobId, digest, usage) => recordCommunicationsDraftUsage(db, jobId, digest, usage, Date.now()),
  });
  const deps: CommunicationsDependencies = {
    store, api, readResearch: (date, admissionId) => readExistingResearchSnapshot(db, date, admissionId),
    learningHooks: createNativeLearningHooks(db, REVIEWED_NATIVE_LEARNING_CONFIG),
    verifyMailbox: () => verifyFounderMailbox(), readThread: (id) => readFounderThread(id),
    isSuppressed: (email) => isEmailSuppressed(email, "growth_campaign"),
    suppress: (email, reason) => recordEmailSuppression({ email, reason, scope: "all", source: "communications_reply" }),
    now: () => Date.now(),
    sendAutomatic: executeAutomaticFirstContact,
  };
  return startCommunicationsQueueLoop(deps, { intake: async () => {
    // Bound-thread opt-outs run before unrelated intake and the paid gate.
    await runCommunicationsReplyIntake({ db, readResearch: deps.readResearch, readThread: deps.readThread,
      isSuppressed: deps.isSuppressed, suppress: deps.suppress, now: deps.now });
    await runCommunicationsIntake({ db, readResearch: deps.readResearch,
      isSuppressed: deps.isSuppressed, now: deps.now, readContactPage: readPublicContactPage });
  }, processJobs: allowPaidInference });
}

/** Stop admission immediately, then await the active job and its durable writes. */
export function startCommunicationsQueueLoop(deps: CommunicationsDependencies,
  options: { intake?: () => Promise<void>; processJobs?: boolean } = {}): () => Promise<void> {
  let activeTick: Promise<void> | null = null, stopped = false, stopPromise: Promise<void> | null = null;
  let automaticCursor: string | undefined;
  const tick = async () => {
    try {
      if (options.intake) await options.intake();
      if (stopped || options.processJobs === false) return;
      if (deps.sendAutomatic && automaticFirstContactEnabled()) {
        for (const job of await deps.store.automaticJobs(5, automaticCursor)) {
          if (stopped) break;
          // Advance before observing the send result so a corrupt/held row
          // cannot monopolize the next tick even when recovery throws.
          automaticCursor = job.jobId;
          const outcome = await deps.sendAutomatic(`communications_${job.jobId}`);
          await deps.store.finishAutomatic(job, outcome);
        }
      }
      for (const id of await deps.store.dueJobIds()) {
        if (stopped) break;
        await processCommunicationsJob(id, deps);
      }
    } catch { logger.warn({ code: "communications_worker_tick_failed" }, "Communications worker requires recovery"); }
  };
  const timer = setInterval(() => {
    if (!stopped && !activeTick) activeTick = tick().finally(() => { activeTick = null; });
  }, 60000);
  timer.unref();
  return () => {
    if (stopPromise) return stopPromise;
    stopped = true;
    clearInterval(timer);
    stopPromise = (async () => { await activeTick; })();
    return stopPromise;
  };
}
