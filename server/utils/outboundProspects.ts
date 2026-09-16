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
import type { GateAnswerSources } from "../../client/src/lib/gateProvenance";

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
  | "already_contacted";

/**
 * Everything that must be true before a cold email leaves the building.
 *
 * Fails closed on every branch, including the suppression lookup itself: if we
 * cannot confirm someone has *not* unsubscribed, we do not send. An outbound
 * program dies from exactly two things — contacting people who asked not to be,
 * and asserting facts that turn out to be invented — and both are checked here
 * rather than trusted to whatever composed the message.
 */
export async function guardProspectSend(
  prospect: OutboundProspect,
  deps: { isSuppressed?: typeof isEmailSuppressed } = {},
): Promise<SendGuardResult> {
  const email = normalizeSuppressionEmail(prospect.contactEmail);
  if (!email || !email.includes("@")) {
    return { send: false, blocker: "email_missing", detail: "No usable contact address." };
  }

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
