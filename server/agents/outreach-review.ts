import { createHash } from "node:crypto";
import { z } from "zod";
import { communicationsLaunchFraming, COMMUNICATIONS_LAUNCH_GUIDANCE, COMMUNICATIONS_FRAMING_V2, type CommunicationsAudienceRole } from "./communications-launch-framing";

const text = z.string().trim().min(1).max(1200);
const source = z.string().trim().min(1).max(500);
const observation = z.object({ claim: text, source }).strict();

export const outreachCapabilityEvidenceSchema = z.object({
  name: z.enum(["Atlas", "pipeline"]),
  claim: text,
  source,
  supportingExcerpt: text,
  verifiedBy: text,
  verifiedAt: z.string().datetime(),
}).strict();

/** Source verification is recorded by the operator, never inferred by the writer. */
export const outreachConnectionEvidenceSchema = z.object({
  kind: z.enum(["connection", "introduction", "shared_community"]),
  claim: text,
  source,
  supportingExcerpt: text,
  verifiedBy: text,
  verifiedAt: z.string().datetime(),
}).strict();

export const outreachContextSchema = z.object({
  observations: z.array(observation).max(8),
  teamObservations: z.array(observation).max(8).default([]),
  verifiedCapabilities: z.array(outreachCapabilityEvidenceSchema).max(8).default([]),
  connectionEvidence: outreachConnectionEvidenceSchema.nullable(),
}).strict();

/** Draft metadata provides anchors to review, not a claim that the draft passed. */
export const outreachReviewContractSchema = z.object({
  version: z.literal("blueprint.outreach.v1"),
  senderIdentity: text,
  opening: z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("cold"),
      noVerifiedConnectionReason: text,
      publicDetail: observation.extend({ sourceClaim: text.optional() }).strict(),
      relevance: text,
    }).strict(),
    z.object({
      kind: z.enum(["connection", "introduction", "shared_community"]),
      claim: text,
    }).strict(),
  ]),
  value: z.object({
    kind: z.enum(["observation", "research_brief"]),
    offer: text,
    limits: text,
  }).strict(),
  question: text,
  recipientChoice: text,
  workflow: z.object({
    phase: z.literal("site_led_discovery"),
    briefKind: z.literal("readiness_learning"),
    nextStep: z.literal("job_brief_question"),
    teamFeasibility: z.enum(["pending", "public_research"]),
    teamFeasibilitySources: z.array(observation).max(8),
  }).strict(),
  capabilityClaims: z.array(z.object({ name: z.enum(["Atlas", "pipeline"]), claim: text, source }).strict()).max(8),
}).strict();

const OPEN_CHECKS = ["site_link", "manual_workflow", "freshness", "existing_automation", "fit", "interest"] as const;
export const OUTREACH_HYPOTHESIS_CONTRACT_VERSION = "blueprint.outreach.v2" as const;
/** Draft metadata for an outreach-ready hypothesis (design v1.1): a cold opening from a recorded
 * observation, exactly one question (the published one, asked verbatim, with the open check it
 * answers) and the recipient's choice. No offer, workflow or capability claim. Anchors only. */
export const outreachHypothesisContractSchema = z.object({
  version: z.literal(OUTREACH_HYPOTHESIS_CONTRACT_VERSION),
  senderIdentity: text,
  opening: z.object({
    kind: z.literal("cold"),
    noVerifiedConnectionReason: text,
    publicDetail: observation.extend({ sourceClaim: text.optional() }).strict(),
    relevance: text,
  }).strict(),
  questions: z.array(z.object({ question: text, checks: z.array(z.enum(OPEN_CHECKS)).min(1).max(OPEN_CHECKS.length) }).strict()).length(1),
  recipientChoice: text,
}).strict();
export type OutreachHypothesisContract = z.infer<typeof outreachHypothesisContractSchema>;
export const OUTREACH_LAUNCH_CONTRACT_VERSION = "blueprint.outreach.v3" as const;
export const outreachLaunchContractSchema = outreachHypothesisContractSchema.extend({
  version: z.literal(OUTREACH_LAUNCH_CONTRACT_VERSION),
  questions: z.array(z.object({ question: text, checks: z.tuple([z.literal("interest")]) }).strict()).length(1),
}).strict();
export type OutreachLaunchContract = z.infer<typeof outreachLaunchContractSchema>;
/** Prospective natural interest question, anchored to the actual body rather
 * than a generated exact template. Evidence and addressing checks still apply. */
export const OUTREACH_FOUNDER_CONTRACT_VERSION = "blueprint.outreach.v4" as const;
export const outreachFounderContractSchema = outreachLaunchContractSchema.extend({
  version: z.literal(OUTREACH_FOUNDER_CONTRACT_VERSION),
}).strict();
export type OutreachFounderContract = z.infer<typeof outreachFounderContractSchema>;

export const OUTREACH_SEMANTIC_CHECKS = {
  connection: "Use a known verified connection/introduction/community where possible; only claimed relationships require proof. Web research and verified business contact routes lead discovery; no network mining or exhaustive network search is required for legitimate cold contact. LinkedIn is optional role verification. Check the source and recipient identity; a shared community implies no endorsement.",
  evidence: "Verify every factual claim against its source. For cold contact verify the public detail and its relevance; reject invented connections and unsupported claims.",
  boundedValue: "Confirm the observation or task-specific research brief is useful, deliverable, and has clear limits; no capability or outcome guarantees.",
  easyQuestion: "Confirm there is exactly one easy, non-confidential question; no compound questionnaire, private operational data, video/upload, or meeting request by default. Tailor it to verified site state: unknown interest means ask relevance without assuming interest; expressed interest means ask the learning goal; pilot means ask an unresolved uncertainty; existing deployment means ask about expansion learning without assuming expansion plans. Verify recipient/site-specific public-signal provenance for claimed interest, pilot, or deployment. Do not invent motivation/status or ask 'what prompted your interest' without evidence of expressed interest. These are directions, not rigid templates; structural anchors do not establish semantic truth.",
  recipientChoice: "Confirm the recipient decides whether deeper conversation is worthwhile; reject pressure, urgency, implied obligation, or automatic follow-up commitments.",
  workflow: "Disclose Blueprint identity from first contact using the founder's 'I'm building Blueprint' framing; do not pose as academic research or imply a large established company. Research site/job/team jointly with site-led discovery and parallel team feasibility. Separate interest in talking, evaluation participation, and deployment capacity. Keep readiness/learning distinct from the pilot booking fee. Use a progressive job brief before footage/details; obtain site permission before sharing with teams. Confirm team configuration/support/timing before any match promise; evaluations and physical-outcome feedback require evidence and consent. Verify every Atlas/pipeline capability claim. " + COMMUNICATIONS_LAUNCH_GUIDANCE,
} as const;

const decision = z.enum(["pass", "revise", "block"]);
export const outreachSemanticReviewSchema = z.object({
  digest: z.string().regex(/^[a-f0-9]{64}$/),
  checks: z.object({
    connection: decision,
    evidence: decision,
    boundedValue: decision,
    easyQuestion: decision,
    recipientChoice: decision,
    workflow: decision,
  }).strict(),
}).strict();

export type OutreachConnectionEvidence = z.infer<typeof outreachConnectionEvidenceSchema>;
export type OutreachCapabilityEvidence = z.infer<typeof outreachCapabilityEvidenceSchema>;
export type OutreachContext = z.infer<typeof outreachContextSchema>;
export type OutreachReviewContract = z.infer<typeof outreachReviewContractSchema>;
export type OutreachSemanticReview = z.infer<typeof outreachSemanticReviewSchema>;
/** `qualification` and `recipient` are present only for an outreach-ready hypothesis brief. */
export type OutreachDraft = { to: string; subject: string; body: string; contract: unknown; context: unknown;
  qualification?: unknown; recipient?: unknown;
  framingContext?: { boundedJob: string; facilityName: string; audienceRole?: CommunicationsAudienceRole } };
export type OutreachReviewResult = {
  hardChecksPassed: boolean;
  blockers: string[];
  digest: string | null;
  semanticReviewRequired: typeof OUTREACH_SEMANTIC_CHECKS;
};

// These catch explicit violations only. Passing them does not establish meaning.
const prohibitedPatterns: [string, RegExp][] = [
  ["default_meeting_or_questionnaire", /\b(?:book|schedule|join)\b.{0,40}\b(?:call|meeting|demo)\b|\b(?:calendly|questionnaire|survey)\b/i],
  ["confidential_or_capture_ask", /\b(?:send|share|upload|film|record)\b.{0,50}\b(?:video|footage|password|credentials|confidential|internal documents)\b/i],
  ["pressure_or_guarantee", /\b(?:last chance|act now|limited time|guaranteed|we guarantee|you must|you owe)\b/i],
  ["unsupported_readiness_or_supply", /\b(?:pilot[- ]ready|we (?:supply|provide) (?:free )?(?:robots|hardware)|free (?:hardware|integration|site matching)|committed partners|guaranteed compatibility)\b/i],
];

const connectionClaim = /\b(?:we (?:met|know)|introduced (?:me|us)|our mutual|referred (?:me|us)|fellow member)\b/i;
const matchPromise = /\b(?:we (?:have|found)|already)\b.{0,30}\b(?:matched|a match|qualified team)\b|\b(?:guaranteed match|deployment.ready|ready to deploy)\b/i;
const sharingClaim = /\b(?:shared|forwarded|sent)\b.{0,40}\b(?:with|to)\b.{0,20}\b(?:robot teams|teams)\b/i;
// Question marks in any script a draft might use: ASCII "?", full-width "？" and Arabic "؟".
const QUESTION_MARKS = /[?\uFF1F\u061F]/g;
/** A name, as whole words, in any letter case. */
function namedIn(value: string, name: string) {
  const normalized = (text: string) => text.normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();
  const haystack = normalized(value), needle = normalized(name);
  for (let at = needle ? haystack.indexOf(needle) : -1; at >= 0; at = haystack.indexOf(needle, at + 1)) {
    if (!/[\p{L}\p{N}]/u.test(haystack[at - 1] ?? "") && !/[\p{L}\p{N}]/u.test(haystack[at + needle.length] ?? "")) return true;
  }
  return false;
}

/** blueprint.outreach.v2: exactly one question, the published one, verbatim in the body, and the
 * body's only question mark. The recipient is addressed as the brief records: a named person by
 * name only for their own address, otherwise whoever runs the task, with no one named. */
function reviewHypothesisOutreachDraft(draft: OutreachDraft): OutreachReviewResult {
  const blockers: string[] = [];
  const result = (digest: string | null): OutreachReviewResult => ({ hardChecksPassed: blockers.length === 0, blockers, digest,
    semanticReviewRequired: OUTREACH_SEMANTIC_CHECKS });
  const qualification = draft.qualification as { openChecks?: unknown; openQuestions?: unknown } | undefined;
  const open = Array.isArray(qualification?.openChecks) && qualification!.openChecks.every(check => typeof check === "string")
    ? qualification!.openChecks as string[] : null;
  const published = Array.isArray(qualification?.openQuestions) && qualification!.openQuestions.length === 1
    && typeof qualification!.openQuestions[0] === "string" ? qualification!.openQuestions[0] as string : null;
  if (!open || !published) blockers.push("outreach_hypothesis_qualification_missing");
  const natural = (draft.contract as any)?.version === OUTREACH_FOUNDER_CONTRACT_VERSION;
  const launch = natural || (draft.contract as any)?.version === OUTREACH_LAUNCH_CONTRACT_VERSION;
  const parsed = (natural ? outreachFounderContractSchema : launch ? outreachLaunchContractSchema : outreachHypothesisContractSchema).safeParse(draft.contract);
  const context = outreachContextSchema.safeParse(draft.context);
  if (!parsed.success) blockers.push((draft.contract as any)?.version === "blueprint.outreach.v1"
    ? "outreach_hypothesis_contract_required" : "outreach_contract_missing_or_invalid");
  if (!context.success) blockers.push("outreach_evidence_missing_or_invalid");
  if (!parsed.success || !context.success || !open || !published) return result(null);
  const contract = parsed.data, opening = contract.opening, asked = contract.questions[0], text = draft.subject + " " + draft.body;
  // The question answers the open check that chose its template: S, then M, then A.
  const answered = open.includes("site_link") ? "site_link" : open.includes("manual_workflow") ? "manual_workflow" : "existing_automation";
  // Archived v3 contracts keep the v1/v2 question even after the default moves.
  const expected = natural ? asked.question : launch && draft.framingContext
    ? communicationsLaunchFraming(draft.framingContext, COMMUNICATIONS_FRAMING_V2).question : published;
  if (launch && !draft.framingContext) blockers.push("launch_framing_context_missing");
  if (asked.question !== expected) blockers.push(launch ? "launch_question_mismatch" : "hypothesis_question_not_published");
  if (asked.checks.length !== 1 || asked.checks[0] !== (launch ? "interest" : answered)) blockers.push("hypothesis_question_checks_mismatch");
  if (!draft.body.includes(expected)) blockers.push("hypothesis_question_missing_from_body");
  if ((draft.body.match(QUESTION_MARKS) || []).length !== 1) blockers.push("exactly_one_initial_question_required");
  if (natural && (!asked.question.endsWith("?") || (asked.question.match(QUESTION_MARKS) || []).length !== 1)) blockers.push("exactly_one_initial_question_required");
  if ((draft.subject.match(QUESTION_MARKS) || []).length) blockers.push("hypothesis_subject_has_question");
  if (!/\bBlueprint\b/.test(contract.senderIdentity)) blockers.push("blueprint_identity_required");
  if (draft.body.indexOf(contract.senderIdentity) > draft.body.indexOf(asked.question)) blockers.push("blueprint_identity_required_before_question");
  if (!context.data.observations.some(item => item.claim === (opening.publicDetail.sourceClaim ?? opening.publicDetail.claim)
    && item.source === opening.publicDetail.source)) blockers.push("cold_detail_not_in_recorded_evidence");
  try {
    const url = new URL(opening.publicDetail.source);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) blockers.push("cold_detail_requires_public_url");
  } catch { blockers.push("cold_detail_requires_public_url"); }
  if (connectionClaim.test(text)) blockers.push("unverified_connection_claim");
  for (const anchor of [contract.senderIdentity, opening.publicDetail.claim, opening.relevance, asked.question, contract.recipientChoice]) {
    if (!draft.body.includes(anchor)) blockers.push("review_anchor_missing_from_body");
  }
  if (draft.body.indexOf(opening.publicDetail.claim) > draft.body.indexOf(asked.question)) blockers.push("verified_or_public_opening_must_come_first");
  for (const name of ["Atlas", "pipeline"]) if (new RegExp(`\\b${name}\\b`, "i").test(text)) blockers.push("capability_claim_not_verified_in_record");
  if (matchPromise.test(text)) blockers.push("discovery_cannot_promise_qualified_match_or_capacity");
  if (sharingClaim.test(text)) blockers.push("discovery_cannot_claim_site_sharing_permission");
  const recipient = draft.recipient as any, opener = draft.body.trim().split(/\n\s*\n/)[0] ?? "";
  if (recipient?.kind === "named_person" && typeof recipient.name === "string") {
    // A salutation that names them: "Hi Jane", "Hello Jane Doe", "Dear Ms. Doe".
    const parts = recipient.name.trim().split(/\s+/), escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const names = [recipient.name.trim(), parts[0], parts.at(-1)].map(escape).join("|");
    if (!new RegExp(`^(?:hi|hello|dear|hey|good (?:morning|afternoon|evening))\\s+(?:(?:mr|ms|mrs|mx|dr)\\.?\\s+)?(?:${names})(?![\\p{L}\\p{N}])`, "iu")
      .test(draft.body.trim())) blockers.push("hypothesis_recipient_greeting_mismatch");
  } else if (recipient?.kind === "inbox" && typeof recipient.addressee === "string") {
    // A role inbox keeps a generic salutation even when the research knows a person's name.
    // Checking only the full name misses first names, surnames, honorifics and invented recipients.
    const salutation = /^(?:hi|hello|dear|hey|good (?:morning|afternoon|evening))\b/iu.exec(opener);
    const stripPunctuation = (value: string) => value.trim().replace(/^[,.:;!?—–-]+\s*/u, "");
    const remaining = stripPunctuation(salutation ? opener.slice(salutation[0].length) : opener);
    const fragment = /^([^,\n!?;:.]{1,160})(?:[,\n!?;:.]|$)/u.exec(remaining);
    const addressed = fragment?.[1]?.trim() ?? "";
    const neutralProse = (value: string) => /^(?:i(?:['’]m| am|['’]d| would| hope| was| noticed| found| saw)\b|we(?:['’]re| are| hope| were)\b|hoping\b|your\b|the\b|this\b)/iu.test(value);
    const genericAddress = /^(?:team|everyone|all|there|folks|(?:operations|plant|site|office|business|engineering|manufacturing|production) team)$/iu.test(addressed)
      || addressed.toLowerCase() === recipient.addressee.toLowerCase();
    // A greeting can be followed by neutral routing prose or an explicit generic addressee.
    // Unknown comma/colon/period-separated names never become generic by failing to parse.
    const afterAddress = stripPunctuation(fragment ? remaining.slice(fragment[0].length) : remaining);
    const generic = (!remaining && !!salutation) || neutralProse(remaining)
      || (genericAddress && (!afterAddress || neutralProse(afterAddress)));
    if (!opener.includes(recipient.addressee) || !generic
      || (typeof recipient.person?.name === "string" && namedIn(draft.body, recipient.person.name))) {
      blockers.push("hypothesis_recipient_greeting_mismatch");
    }
  } else blockers.push("hypothesis_recipient_greeting_mismatch");
  for (const [code, pattern] of prohibitedPatterns) if (pattern.test(text)) blockers.push(code);
  return result(createHash("sha256").update(JSON.stringify({ to: draft.to, subject: draft.subject, body: draft.body, contract,
    context: context.data, qualification: { openChecks: open, openQuestions: [published] }, recipient: recipient ?? null })).digest("hex"));
}

export function reviewOutreachDraft(draft: OutreachDraft): OutreachReviewResult {
  // Only a hypothesis brief, which carries its qualification block, is reviewed by the v2 rules. Any other
  // draft keeps the v1 review, so a v2 contract there fails as an invalid v1 contract, which the writer can repair.
  if (draft.qualification !== undefined) return reviewHypothesisOutreachDraft(draft);
  const blockers: string[] = [];
  const parsed = outreachReviewContractSchema.safeParse(draft.contract);
  const context = outreachContextSchema.safeParse(draft.context);
  const result = (digest: string | null): OutreachReviewResult => ({
    hardChecksPassed: blockers.length === 0,
    blockers,
    digest,
    semanticReviewRequired: OUTREACH_SEMANTIC_CHECKS,
  });
  if (!parsed.success) blockers.push("outreach_contract_missing_or_invalid");
  if (!context.success) blockers.push("outreach_evidence_missing_or_invalid");
  if (!parsed.success || !context.success) return result(null);

  const contract = parsed.data;
  const opening = contract.opening;
  const openingClaim = opening.kind === "cold" ? opening.publicDetail.claim : opening.claim;
  const anchors = [contract.senderIdentity, contract.value.offer, contract.value.limits, contract.question, contract.recipientChoice];
  if (!/\bBlueprint\b/.test(contract.senderIdentity)) blockers.push("blueprint_identity_required");
  if (draft.body.indexOf(contract.senderIdentity) > draft.body.indexOf(contract.value.offer)) {
    blockers.push("blueprint_identity_required_before_offer");
  }
  const teamSources = contract.workflow.teamFeasibilitySources;
  if ((contract.workflow.teamFeasibility === "pending" && teamSources.length > 0)
    || (contract.workflow.teamFeasibility === "public_research" && teamSources.length === 0)) {
    blockers.push("team_feasibility_status_requires_matching_evidence");
  }
  if (teamSources.some((item) => !context.data.teamObservations.some((record) => record.claim === item.claim && record.source === item.source))) {
    blockers.push("team_feasibility_not_in_recorded_evidence");
  }
  for (const claim of contract.capabilityClaims) {
    anchors.push(claim.claim);
    if (!context.data.verifiedCapabilities.some((item) => item.name === claim.name && item.claim === claim.claim && item.source === claim.source)) {
      blockers.push("capability_claim_not_verified_in_record");
    }
  }
  for (const name of ["Atlas", "pipeline"] as const) {
    if (new RegExp(`\\b${name}\\b`, "i").test(draft.subject + " " + draft.body) && !contract.capabilityClaims.some((claim) => claim.name === name)) {
      blockers.push("capability_claim_not_verified_in_record");
    }
  }
  if (/\b(?:we (?:have|found)|already)\b.{0,30}\b(?:matched|a match|qualified team)\b|\b(?:guaranteed match|deployment.ready|ready to deploy)\b/i.test(draft.subject + " " + draft.body)) {
    blockers.push("discovery_cannot_promise_qualified_match_or_capacity");
  }
  if (/\b(?:shared|forwarded|sent)\b.{0,40}\b(?:with|to)\b.{0,20}\b(?:robot teams|teams)\b/i.test(draft.subject + " " + draft.body)) {
    blockers.push("discovery_cannot_claim_site_sharing_permission");
  }
  if (opening.kind === "cold") {
    anchors.push(opening.publicDetail.claim, opening.relevance);
    if (!context.data.observations.some((item) =>
      item.claim === (opening.publicDetail.sourceClaim ?? opening.publicDetail.claim) && item.source === opening.publicDetail.source,
    )) blockers.push("cold_detail_not_in_recorded_evidence");
    try {
      const url = new URL(opening.publicDetail.source);
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
        blockers.push("cold_detail_requires_public_url");
      }
    } catch { blockers.push("cold_detail_requires_public_url"); }
    if (/\b(?:we (?:met|know)|introduced (?:me|us)|our mutual|referred (?:me|us)|fellow member)\b/i.test(draft.subject + " " + draft.body)) {
      blockers.push("unverified_connection_claim");
    }
  } else {
    anchors.push(opening.claim);
    const evidence = context.data.connectionEvidence;
    if (!evidence || evidence.kind !== opening.kind || evidence.claim !== opening.claim) {
      blockers.push("connection_claim_not_verified_in_record");
    }
    if (opening.kind === "shared_community" && /\b(?:endorsed|recommended|vouched|on behalf of)\b/i.test(draft.subject + " " + draft.body)) {
      blockers.push("shared_community_implies_endorsement");
    }
  }
  for (const anchor of anchors) {
    if (!draft.body.includes(anchor)) blockers.push("review_anchor_missing_from_body");
  }
  if ([contract.value.offer, contract.question].some((anchor) => draft.body.indexOf(openingClaim) > draft.body.indexOf(anchor))) {
    blockers.push("verified_or_public_opening_must_come_first");
  }
  if ((draft.body.match(/\?/g) || []).length !== 1 || !contract.question.endsWith("?")) {
    blockers.push("exactly_one_initial_question_required");
  }
  for (const [code, pattern] of prohibitedPatterns) {
    if (pattern.test(draft.subject + " " + draft.body)) blockers.push(code);
  }
  // A review is invalidated by changes to recipient, text, contract, or evidence.
  const digest = createHash("sha256").update(JSON.stringify({
    to: draft.to, subject: draft.subject, body: draft.body,
    contract, context: context.data,
  })).digest("hex");
  return result(digest);
}

/** Only the authenticated approval route supplies this separate attestation. */
export function validateOutreachSemanticReview(result: OutreachReviewResult, review: unknown): string | null {
  if (!result.hardChecksPassed) return result.blockers.join(", ");
  const parsed = outreachSemanticReviewSchema.safeParse(review);
  if (!parsed.success) return "outreach_semantic_review_required";
  if (parsed.data.digest !== result.digest) return "outreach_review_does_not_match_draft";
  if (Object.values(parsed.data.checks).some((value) => value !== "pass")) return "outreach_semantic_review_not_passed";
  return null;
}
