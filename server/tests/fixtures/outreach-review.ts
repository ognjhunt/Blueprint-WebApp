import type { OutreachContext, OutreachDraft, OutreachReviewContract } from "../../agents/outreach-review";

export const outreachContext: OutreachContext = {
  observations: [{ claim: "Your public careers page describes a packing station.", source: "https://facility.example/careers" }],
  connectionEvidence: null,
  teamObservations: [],
  verifiedCapabilities: [],
};
export const outreachContract: OutreachReviewContract = {
  version: "blueprint.outreach.v1",
  senderIdentity: "I'm reaching out from Blueprint.",
  opening: {
    kind: "cold",
    noVerifiedConnectionReason: "No verified relationship or shared community is recorded.",
    publicDetail: outreachContext.observations[0],
    relevance: "That relates to our question about a bounded packing job.",
  },
  value: {
    kind: "research_brief",
    offer: "I can share a short packing-job research brief.",
    limits: "It uses public sources only and cannot establish robot fit.",
  },
  question: "Is packing a relevant job to discuss?",
  recipientChoice: "You can decide whether any deeper conversation is useful.",
  workflow: { phase: "site_led_discovery", briefKind: "readiness_learning", nextStep: "job_brief_question", teamFeasibility: "pending", teamFeasibilitySources: [] },
  capabilityClaims: [],
};
export const outreachDraft: OutreachDraft = {
  to: "ops@packing-facility.co",
  subject: "A bounded packing-job question",
  body: [outreachContext.observations[0].claim, outreachContract.senderIdentity, outreachContract.opening.kind === "cold" ? outreachContract.opening.relevance : "",
    outreachContract.value.offer, outreachContract.value.limits, outreachContract.question, outreachContract.recipientChoice].join(" "),
  contract: outreachContract,
  context: outreachContext,
};
export const passingOutreachChecks = {
  connection: "pass", evidence: "pass", boundedValue: "pass", easyQuestion: "pass", recipientChoice: "pass", workflow: "pass",
} as const;
