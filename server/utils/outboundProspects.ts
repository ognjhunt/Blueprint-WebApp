/**
 * A site we approached, before it is a site that approached us.
 *
 * ## Why this is a different record, and why it stops being one
 *
 * Inbound and outbound differ in exactly one way that matters: who asserted the
 * facts. Everything downstream — gates, dispatch, capture, reconstruction,
 * evaluation — is identical and should stay identical, because a second funnel
 * is a second set of bugs and a second thing to keep honest.
 *
 * So a prospect is deliberately thin. It holds the hypothesis we formed, the
 * sources behind it, and the contact record. The moment an operator replies and
 * states their own answers, it converts into an ordinary `inboundRequest` with
 * `operator_stated` provenance and rejoins the existing path. Outbound is a way
 * of starting a conversation, not a parallel product.
 *
 * ## What a beta needs, and what it does not
 *
 * Not here on purpose: lead discovery, sequences, drip logic, reply
 * classification. Twenty facilities can be chosen by hand and twenty replies can
 * be read by a person, and doing both manually first is how you learn what the
 * agent should do. Automating discovery before anyone has hand-written twenty
 * of these would be building a machine to produce something nobody has yet
 * produced once.
 *
 * Here because it cannot be skipped: every claim carries a source, suppression
 * is checked before send and fails closed, and a hypothesis can never qualify a
 * site.
 */

import {
  isEmailSuppressed,
  normalizeSuppressionEmail,
} from "./email-suppression";
import { dbAdmin } from "../../client/src/lib/firebaseAdmin";
import type { GateAnswerSources } from "../../client/src/lib/gateProvenance";
import type { OutreachConnectionEvidence, OutreachCapabilityEvidence } from "../agents/outreach-review";

/**
 * One observable fact about a facility, and where it came from.
 *
 * The repo already refuses to publish a figure without a primary source
 * (`deploymentMarket.ts`). An outbound email asserting something about a
 * stranger's building is the same claim with a higher cost of being wrong: a
 * hallucinated detail in a cold email is a credibility failure the recipient
 * can verify instantly and never forgets.
 */
export interface ProspectObservation {
  /** The claim, phrased as something the recipient could confirm or deny. */
  claim: string;
  /** Where it came from. A URL, a public filing, a listing. Never "inferred". */
  source: string;
}

export type ProspectStage =
  /** Hypothesis formed, nothing sent. */
  | "drafted"
  /** Approached once. */
  | "contacted"
  /** They replied. A person reads it during the beta. */
  | "replied"
  /** Converted into an inboundRequest and out of this table. */
  | "converted"
  /** Asked not to be contacted, or bounced. Terminal. */
  | "closed";

export interface OutboundProspect {
  prospectId: string;
  /** Facility, not company: the evaluation is of one site. */
  facilityName: string;
  facilityAddress: string;
  contactEmail: string;
  /** Observations behind the hypothesis. Empty is not allowed at send time. */
  observations: ProspectObservation[];
  /** Verified by an operator before the writer may use a warm opening. */
  connectionEvidence?: OutreachConnectionEvidence | null;
  /** Public team research is feasibility evidence, never confirmed participation/capacity. */
  teamObservations?: ProspectObservation[];
  verifiedCapabilities?: OutreachCapabilityEvidence[];
  /** The task we think they run, in our words, for them to correct. */
  hypothesisedTask: string;
  /** Gate answers we guessed. Always paired with inferred provenance. */
  inferredGates: Record<string, string>;
  gateAnswerSources: GateAnswerSources;
  stage: ProspectStage;
  /** Why we contacted this facility. Auditable after the fact. */
  reasonForContact: string;
  createdAtIso: string;
  contactedAtIso?: string | null;
  /** Why we stopped, when we stopped. Set together with a suppression entry. */
  closedReason?: string | null;
  closedAtIso?: string | null;
}

export type SendGuardResult =
  | { send: true; email: string }
  | { send: false; blocker: SendBlocker; detail: string };

export type SendBlocker =
  | "email_missing"
  | "email_suppressed"
  | "prospect_closed"
  | "no_sourced_observations"
  | "unsourced_observation"
  | "hypothesis_missing"
  | "already_contacted"
  | ResearchSendBlocker;

export type ResearchSendBlocker = "outreach_ready_hypothesis_draft_only" | "communications_sending_disabled"
  | "recipient_research_origin_unavailable";

/**
 * Where a canonical prospect record came from.
 *
 * - `none`: chosen by hand for the outbound beta; no research admission field.
 * - `verified`: admitted from verified published research (intake or the
 *   reviewed adapter), the only research tier that exists today.
 * - `hypothesis`: an outreach-ready hypothesis, a site-screen admission, or a
 *   research marker this code does not recognise. Unknown values fail closed.
 *
 * Research intake that admits a hypothesis must write `qualificationTier`
 * (or `screenAdmissionId`) on the prospect, so this reads as `hypothesis`.
 */
export type ProspectResearchTier = "none" | "verified" | "hypothesis";
const RESEARCH_ADMISSION_FIELDS = ["researchPublicationId", "communicationsContextReview", "entityAdmission",
  "qualificationTier", "screenAdmissionId"];
export function prospectResearchTier(prospect: unknown): ProspectResearchTier {
  const record = prospect && typeof prospect === "object" ? prospect as Record<string, unknown> : {};
  if (!RESEARCH_ADMISSION_FIELDS.some((field) => Object.hasOwn(record, field))) return "none";
  const verified = (!Object.hasOwn(record, "qualificationTier") || record.qualificationTier === "verified")
    && !Object.hasOwn(record, "screenAdmissionId")
    && (!Object.hasOwn(record, "entityAdmission") || record.entityAdmission === "research_provisional");
  return verified ? "verified" : "hypothesis";
}

/** Reads every canonical prospect record whose `contactEmail` is one of these spellings. */
export type RecipientProspectReader = (addresses: string[]) => Promise<unknown[]>;

/** The production reader. Tests inject their own: a real Firestore must never be read. */
export const readRecipientProspects: RecipientProspectReader = async (addresses) => {
  if (!dbAdmin) throw new Error("prospect_store_unavailable");
  const snapshot = await dbAdmin.collection("outboundProspects").where("contactEmail", "in", addresses).limit(101).get();
  if (snapshot.size > 100) throw new Error("recipient_prospect_records_overflow");
  return snapshot.docs.map((doc) => doc.data());
};

/**
 * Recipient-level backstop: an address that belongs to an outreach-ready
 * hypothesis is never sent to, whichever prospect record or route the send
 * started from. Every canonical prospect record that carries the address, as
 * written or normalized, is read, and any research tier other than verified
 * refuses (`prospectResearchTier`, so unknown markers refuse too).
 *
 * It fails closed only for a research-backed send. When the records cannot be
 * read, a send whose own prospect is research-derived refuses, and a send to a
 * hand-chosen prospect keeps the gates it already had.
 */
export async function assertNotHypothesisRecipient(
  recipients: readonly unknown[],
  options: { researchBacked: boolean; readProspects?: RecipientProspectReader },
): Promise<void> {
  const addresses = [...new Set(recipients.flatMap((value) => typeof value === "string" && value.trim()
    ? [value.trim(), normalizeSuppressionEmail(value)] : []).filter(Boolean))];
  let records: unknown[];
  try {
    if (!addresses.length) throw new Error("recipient_missing");
    records = await (options.readProspects ?? readRecipientProspects)(addresses);
    if (!Array.isArray(records)) throw new Error("recipient_prospect_records_unreadable");
  } catch {
    if (options.researchBacked) throw new Error("recipient_research_origin_unavailable");
    return;
  }
  if (records.some((record) => prospectResearchTier(record) === "hypothesis")) {
    throw new Error("outreach_ready_hypothesis_draft_only");
  }
}

/** `assertNotHypothesisRecipient` as a send-guard result. */
async function recipientResearchBlocker(
  recipients: readonly unknown[],
  researchBacked: boolean,
  readProspects?: RecipientProspectReader,
): Promise<{ blocker: ResearchSendBlocker; detail: string } | null> {
  try {
    await assertNotHypothesisRecipient(recipients, { researchBacked, readProspects });
    return null;
  } catch (error) {
    return error instanceof Error && error.message === "outreach_ready_hypothesis_draft_only"
      ? { blocker: "outreach_ready_hypothesis_draft_only", detail: "This address belongs to an outreach-ready hypothesis, which is draft only." }
      : { blocker: "recipient_research_origin_unavailable", detail: "The prospect records for this research-derived address could not be read." };
  }
}

/** Same flag as `communicationsSendingEnabled`, read here because communications-send imports this module. */
const communicationsSendFlag = () => process.env.BLUEPRINT_COMMUNICATIONS_SEND_ENABLED === "true";

/**
 * The research-origin rule for the legacy mailer route, shared by the queue
 * guard and the action executor at release time.
 *
 * An outreach-ready hypothesis is draft only and is refused whatever the flags
 * say. Any other research-derived prospect has its own send path; it stays off
 * the legacy mailer while the communications send flag is off.
 */
export function researchProspectSendBlocker(
  prospect: unknown,
  sendingEnabled: boolean,
): { blocker: ResearchSendBlocker; detail: string } | null {
  const tier = prospectResearchTier(prospect);
  if (tier === "hypothesis") {
    return {
      blocker: "outreach_ready_hypothesis_draft_only",
      detail: "An outreach-ready hypothesis is draft only and is never sent by any route.",
    };
  }
  if (tier === "verified" && !sendingEnabled) {
    return {
      blocker: "communications_sending_disabled",
      detail: "Research-derived prospects are not sent by this route while BLUEPRINT_COMMUNICATIONS_SEND_ENABLED is off.",
    };
  }
  return null;
}

/**
 * Everything that must be true before a cold email leaves the building.
 *
 * Fails closed on every branch, including the suppression lookup itself: if we
 * cannot confirm someone has *not* unsubscribed, we do not send. An outbound
 * program dies from exactly two things — contacting people who asked not to be,
 * and asserting facts that turn out to be invented — and both are checked here
 * rather than trusted to whatever composed the message.
 *
 * Research-derived prospects also pass `researchProspectSendBlocker`, and every
 * address passes `assertNotHypothesisRecipient`. The action executor applies the
 * same rules again when an approval releases the message.
 */
export async function guardProspectSend(
  prospect: OutboundProspect,
  deps: { isSuppressed?: typeof isEmailSuppressed; sendingEnabled?: () => boolean;
    readRecipientProspects?: RecipientProspectReader } = {},
): Promise<SendGuardResult> {
  // First, before any flag or lookup: a hypothesis is draft only. With sending
  // treated as enabled, only the hypothesis refusal can apply here.
  const hypothesis = researchProspectSendBlocker(prospect, true);
  if (hypothesis) return { send: false, ...hypothesis };

  const email = normalizeSuppressionEmail(prospect.contactEmail);
  if (!email || !email.includes("@")) {
    return { send: false, blocker: "email_missing", detail: "No usable contact address." };
  }

  // Then the address itself, before any other refusal: another canonical record
  // may hold it as a hypothesis.
  const recipient = await recipientResearchBlocker([prospect.contactEmail],
    prospectResearchTier(prospect) !== "none", deps.readRecipientProspects);
  if (recipient) return { send: false, ...recipient };

  // Checked before `already_contacted` and kept separate from it on purpose:
  // drafting a second version of a message nobody approved is fine, and the
  // draft route lets `already_contacted` through for exactly that reason.
  // Someone who asked us to stop is not that case, and must not be reachable by
  // any route the send guard protects.
  if (prospect.stage === "closed") {
    return {
      send: false,
      blocker: "prospect_closed",
      detail: prospect.closedReason
        ? `Prospect was closed: ${prospect.closedReason}`
        : "Prospect was closed and must not be contacted again.",
    };
  }

  if (prospect.stage === "contacted" || prospect.stage === "converted") {
    return {
      send: false,
      blocker: "already_contacted",
      detail: `Prospect is already at stage ${prospect.stage}; a beta sends once.`,
    };
  }

  if (!prospect.hypothesisedTask.trim()) {
    return {
      send: false,
      blocker: "hypothesis_missing",
      detail: "Nothing specific to say. A generic pitch is not worth the send.",
    };
  }

  if (!prospect.observations.length) {
    return {
      send: false,
      blocker: "no_sourced_observations",
      detail: "The hypothesis rests on nothing checkable.",
    };
  }

  const unsourced = prospect.observations.filter((item) => !item.source.trim());
  if (unsourced.length) {
    return {
      send: false,
      blocker: "unsourced_observation",
      detail: `Unsourced claims: ${unsourced.map((item) => item.claim).join("; ")}.`,
    };
  }

  const suppressionCheck = deps.isSuppressed || isEmailSuppressed;
  let suppressed: boolean;
  try {
    suppressed = await suppressionCheck(email, "growth_campaign");
  } catch {
    // Fail closed. Not knowing whether someone opted out is not permission.
    return {
      send: false,
      blocker: "email_suppressed",
      detail: "Suppression state could not be read; treating as suppressed.",
    };
  }

  if (suppressed) {
    return { send: false, blocker: "email_suppressed", detail: "Recipient has opted out." };
  }

  // Last on purpose: only a prospect that passes every other check reaches it,
  // so the draft route can let it through without skipping another refusal.
  const research = researchProspectSendBlocker(prospect, (deps.sendingEnabled ?? communicationsSendFlag)());
  if (research) return { send: false, ...research };

  return { send: true, email };
}

/**
 * Turn a prospect who replied into an ordinary inbound request.
 *
 * `statedFieldIds` are the gates the operator actually addressed. Everything
 * else stays inferred and continues to hold dispatch, which is what stops a
 * warm reply from silently ratifying five guesses it never mentioned.
 */
export function convertProspectToRequestPayload(params: {
  prospect: OutboundProspect;
  /** Gate answers as the operator stated them, keyed by field id. */
  statedGates: Record<string, string>;
  /** What they said the task is, in their words. */
  taskStatement: string;
  captureMode?: string | null;
}) {
  const statedFieldIds = Object.keys(params.statedGates);
  const gateAnswerSources: Record<string, "operator_stated" | "inferred"> = {
    ...params.prospect.gateAnswerSources,
  };
  for (const fieldId of statedFieldIds) {
    gateAnswerSources[fieldId] = "operator_stated";
  }

  return {
    // Their answers win wherever they gave one; ours remain only as the
    // starting point they did not correct.
    siteTaskGates: { ...params.prospect.inferredGates, ...params.statedGates },
    gateAnswerSources,
    taskStatement: params.taskStatement,
    captureMode: params.captureMode ?? null,
    siteName: params.prospect.facilityName,
    siteLocation: params.prospect.facilityAddress,
    email: params.prospect.contactEmail,
    /** Kept so a converted request can be told from one that arrived on its own. */
    acquisitionSource: "outbound" as const,
    outboundProspectId: params.prospect.prospectId,
  };
}
