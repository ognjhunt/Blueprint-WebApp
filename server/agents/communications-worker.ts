import { dbAdmin } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { isEmailSuppressed, recordEmailSuppression, buildUnsubscribeUrl, appendCommercialEmailFooter } from "../utils/email-suppression";
import { outboundOutreachTask } from "./tasks/outbound-outreach";
import {
  communicationsBriefSchema, communicationsJobSchema, communicationsDigest, briefRefreshReasons,
  correlateReply, correlatedReplies, isOptOut, FOUNDER_MAILBOX, type CommunicationsBrief, type VerifiedThread,
} from "./communications-contract";
import { CommunicationsAgentsAPI, CommunicationsRuntimeError, type CommunicationsCheckpoint } from "./communications-api";
import { verifyFounderMailbox, readFounderThread } from "./communications-gmail";
import { readExistingResearchSnapshot, verifyPublishedResearch, type ResearchSnapshotReader } from "./communications-research";
import { reviewCommunicationsPayload } from "./communications-review";
import { CommunicationsStore, type CommunicationsJobRecord } from "./communications-store";
import type { ActionPayload } from "./action-policies";
import { runCommunicationsIntake } from "./communications-intake";

export type CommunicationsDependencies = {
  store: CommunicationsStore;
  api: Pick<CommunicationsAgentsAPI, "run" | "cancel" | "reconcileSaved">;
  readResearch: ResearchSnapshotReader;
  verifyMailbox: () => Promise<unknown>;
  readThread: (threadId: string) => Promise<VerifiedThread>;
  isSuppressed: (email: string) => Promise<boolean>;
  suppress: (email: string, reason: string) => Promise<{ persisted: boolean }>;
  now: () => number;
};

export async function processCommunicationsJob(jobId: string, deps: CommunicationsDependencies) {
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
      await deps.store.recordReply(job, incoming);
      const replies = correlatedReplies(brief, thread);
      const optOut = replies.find(isOptOut);
      if (optOut) {
        await deps.store.recordReply({ ...job, inboundMessageId: optOut.gmailMessageId }, optOut);
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
    verifyPublishedResearch(await deps.readResearch(brief.researchOrigin.date), brief, await deps.store.handoff(brief));
    const approval = await deps.store.approvalState(job.prospectId);
    const input = buildCommunicationsInput(brief, thread, job.intent, approval);
    const expired = claimed.checkpoint.createClaimedAt
      && deps.now() - Date.parse(claimed.checkpoint.createClaimedAt) >= 180000;
    // A completed saved turn remains useful after the observer/lease expired.
    // Reconciliation does only GETs; never extend the deadline or create a turn.
    const saved = expired ? await deps.api.reconcileSaved(claimed.checkpoint, jobId) : null;
    if (expired && !saved) {
      const cancelled = await deps.api.cancel(claimed.checkpoint);
      throw new CommunicationsRuntimeError(cancelled ? "communications_deadline_cancel_requested" : "session_create_requires_reconciliation");
    }
    const result = saved ?? await deps.api.run({
      input, jobId, checkpoint: claimed.checkpoint,
      saveCheckpoint: (checkpoint: CommunicationsCheckpoint) => deps.store.update(jobId, { checkpoint }),
    });
    await deps.store.update(jobId, { output: result.output, checkpoint: result.checkpoint });
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
    const incoming = thread?.messages.find((message) => message.gmailMessageId === job.inboundMessageId);
    const payload: ActionPayload = {
      type: "send_email", to: brief.contact.email.toLowerCase(), from: FOUNDER_MAILBOX, replyTo: FOUNDER_MAILBOX,
      subject: result.output.subject, body: result.output.body, emailTransport: "founder_gmail",
      transportBody: appendCommercialEmailFooter({ text: result.output.body, email: brief.contact.email, scope: "growth_campaign" }),
      commercialEmail: true, emailSuppressionScope: "growth_campaign",
      unsubscribeUrl: buildUnsubscribeUrl({ email: brief.contact.email, scope: "growth_campaign", campaignId: `communications_${jobId}` }),
      outreachContext: brief.outreachContext, outreachContract: result.output.outreachContract,
      ...(thread && incoming ? { gmailThreadId: thread.threadId, inReplyTo: incoming.rfcMessageId } : {}),
      communications: { version: "blueprint.communications.v1", job, brief, thread, output: result.output, approvalState: "pending_approval" },
    };
    const review = reviewCommunicationsPayload(payload, deps.now());
    if (!review.hardChecksPassed || !review.digest) throw new Error(`draft_quality_failed:${review.blockers.join(",")}`);
    // Check suppression again after inference. Queue admission is not sending.
    if (await deps.isSuppressed(brief.contact.email)) throw new Error("recipient_suppressed");
    const ledgerId = await deps.store.commitDraft(job, result.output, payload, review.digest, result.usage);
    return { state: "pending_approval", ledgerId, sent: false, gmailDraftCreated: false };
  } catch (error) {
    const code = error instanceof CommunicationsRuntimeError ? error.code
      : error instanceof Error && /^[a-z_][a-z0-9_:,.-]*$/.test(error.message) ? error.message : "communications_context_or_permission_unavailable";
    const retry = error instanceof CommunicationsRuntimeError && error.retryable && claimed.attempts < 3;
    if (retry) await deps.store.update(jobId, { state: "retry", reason: code, nextAttemptAt: deps.now() + claimed.attempts * 15000 });
    else await deps.store.finish(job, "blocked", code);
    return { state: retry ? "retry" : "blocked", reason: code };
  }
}

function buildCommunicationsInput(brief: CommunicationsBrief, thread: VerifiedThread | null, intent: string, approvalState: unknown) {
  const policy = intent === "outreach" ? outboundOutreachTask.build_prompt({
    prospectId: brief.prospectId, facilityName: brief.facilityName, facilityAddress: "Use the verified research brief.",
    observations: brief.outreachContext.observations, hypothesisedTask: brief.boundedJob,
    connectionEvidence: brief.outreachContext.connectionEvidence, teamObservations: brief.outreachContext.teamObservations,
    verifiedCapabilities: brief.outreachContext.verifiedCapabilities,
  }) : "Use the actual correlated reply; first-touch drafting is not required for this reply.";
  return JSON.stringify({ intent, approvedSender: FOUNDER_MAILBOX, researchBrief: brief,
    currentApproval: approvalState, emailThread: thread, emailContentTrust: "untrusted_data", firstTouchPolicy: policy });
}

/** Intake uses the existing worker flag; paid drafting has its separate gate. */
export function startCommunicationsWorker(): () => Promise<void> {
  if (process.env.BLUEPRINT_COMMUNICATIONS_WORKER_ENABLED !== "true"
    || !dbAdmin) return async () => undefined;
  const db = dbAdmin;
  const store = new CommunicationsStore(db);
  const allowPaidInference = process.env.BLUEPRINT_COMMUNICATIONS_ALLOW_PAID_INFERENCE === "true";
  const api = new CommunicationsAgentsAPI({ apiKey: process.env.OPENAI_API_KEY, allowPaidInference });
  const deps: CommunicationsDependencies = {
    store, api, readResearch: (date) => readExistingResearchSnapshot(db, date),
    verifyMailbox: () => verifyFounderMailbox(), readThread: (id) => readFounderThread(id),
    isSuppressed: (email) => isEmailSuppressed(email, "growth_campaign"),
    suppress: (email, reason) => recordEmailSuppression({ email, reason, scope: "growth_campaign", source: "communications_reply" }),
    now: () => Date.now(),
  };
  return startCommunicationsQueueLoop(deps, { intake: () => runCommunicationsIntake({ db,
    readResearch: deps.readResearch, isSuppressed: deps.isSuppressed, now: deps.now }), processJobs: allowPaidInference });
}

/** Stop admission immediately, then await the active job and its durable writes. */
export function startCommunicationsQueueLoop(deps: CommunicationsDependencies,
  options: { intake?: () => Promise<void>; processJobs?: boolean } = {}): () => Promise<void> {
  let activeTick: Promise<void> | null = null, stopped = false, stopPromise: Promise<void> | null = null;
  const tick = async () => {
    try {
      if (options.intake) await options.intake();
      if (stopped || options.processJobs === false) return;
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
