import { requireVerifiedLead } from "./lead-verification";
import { communicationsBriefSchema, communicationsDigest, communicationsEnvelopeSchema,
  briefRefreshReasons, correlateReply, correlatedReplies, isOptOut, type CommunicationsBrief, type CommunicationsOutput } from "./communications-contract";
import { publishedPublicContact, contactProhibition, PUBLIC_CONTACT_PREFIX, containsContactName } from "./communications-contact-evidence";
import { verifyContactResolution } from "./communications-contact-resolution";
import { reviewCommunicationsPayload } from "./communications-review";
import { validateRecipientEmailAddress, type ActionPayload } from "./action-policies";
import { appendFirstContactFooter, firstContactPostalLine } from "./communications-first-contact-footer";
import { assessedSiteGeography, qualifiedSourceContact } from "./communications-source-assessment";

/** The founder authorized routine first contact only. This is not authority for
 * follow-ups, replies, private data, commitments, pricing or other send lanes. */
export const FIRST_CONTACT_POLICY = Object.freeze({
  version: "blueprint.automatic-first-contact-policy.v1",
  category: "qualified_public_business_first_contact",
  qualification: "source_qa_public_task_and_verified_business_contact_not_pilot_readiness",
  sourceMaxAgeDays: 7,
  maxDailyAttempts: 5,
  dailyTimezone: "America/Chicago",
  bodyMaxWords: 150,
  allowedStates: ["unknown", "expressed", "pilot", "deployed"],
  recipientScope: "published_site_prospect",
  automaticRecipientCountry: "US",
  followUpsAuthorized: false,
  optOutScope: "all",
  geographyActivationReviewRequired: true,
  outreachPostalSource: "owner_configured_server_only",
});
export const FIRST_CONTACT_POLICY_DIGEST = communicationsDigest(FIRST_CONTACT_POLICY);
/** Owner-activated prospective agent writing. The original compiler policy is
 * retained verbatim so old charged drafts and send receipts remain verifiable. */
export const ROUTINE_COMMUNICATIONS_POLICY = Object.freeze({ ...FIRST_CONTACT_POLICY,
  version: "blueprint.automatic-communications-policy.v2",
  category: "qualified_public_business_agent_communications",
  bodyMaxWords: null, bodyBounds: "existing_communications_output_schema",
  writer: "saved_communications_agent", automaticRepliesAuthorized: true,
  replyScope: "exact_correlated_inbound_on_verified_sent_thread",
});
export const automaticFirstContactEnabled = () => process.env.BLUEPRINT_COMMUNICATIONS_AUTOMATIC_FIRST_CONTACT_ENABLED === "true";
export function firstContactDailyLimit() {
  const raw = process.env.BLUEPRINT_COMMUNICATIONS_FIRST_CONTACT_DAILY_LIMIT ?? "";
  const limit = Number(raw);
  return /^[1-9]\d*$/.test(raw) && Number.isSafeInteger(limit) && limit <= FIRST_CONTACT_POLICY.maxDailyAttempts ? limit : 0;
}
export function firstContactCalendarDay(now = Date.now()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: FIRST_CONTACT_POLICY.dailyTimezone,
    year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

const restricted = /\b(?:pricing|price|dollars?|payment|contract|guarantee[ds]?|password|credentials|confidential|patient|medical|health|children?|minors?|teen(?:ager)?s?|students?|pupils?|birthdate|date of birth|creditworthiness|credit score|salary|bank|financial|immigration|criminal|lawsuit|legal|ssn|social security|api[ _-]?key|access[ _-]?token|refresh[ _-]?token|bearer|ignore instructions|system prompt|we met|our mutual|referred me|fellow member|you must|act now)\b|[$€£]|\b(?:sk-[a-z0-9_-]{10,}|AIza[a-z0-9_-]{20,}|AKIA[a-z0-9]{12,}|eyJ[a-z0-9_-]{15,}\.[a-z0-9_-]+\.[a-z0-9_-]+)\b/i;
const safeFragment = (value: string, max: number) => value.length <= max && value.trim() === value
  && !/[\x00-\x1f\x7f?<>@]/.test(value) && !restricted.test(value) && !contactProhibition.test(value);
const fresh = (value: string, now: number) => Number.isFinite(Date.parse(value))
  && Date.parse(value) <= now && now - Date.parse(value) <= FIRST_CONTACT_POLICY.sourceMaxAgeDays * 86400000;

export function routineCommunicationsContentBlockers(output: CommunicationsOutput, intent: "outreach" | "reply" = "outreach") {
  // A reply subject is immutable recipient provenance, not an authored claim.
  return restricted.test((intent === "reply" ? "" : output.subject + " ") + output.body)
    ? ["routine_public_scope_content_not_authorized"] : [];
}

/** Conservative positive anchors supplement source QA; generic robotics work,
 * negated/future activity and a pilot do not establish a production deployment. */
export function firstContactStateProof(brief: CommunicationsBrief, fact: CommunicationsBrief["facts"][number], now: number) {
  if (!["operator_stated", "primary", "corroborated"].includes(fact.evidenceClass)
    || fact.assertionScope !== "current_operational" || !fresh(fact.sourceCheckedAt, now)
    || !safeFragment(fact.claim, 360) || !fact.claim.toLowerCase().includes(brief.boundedJob.toLowerCase())
    || /\b(?:not|no|never|former|previous|will|plans?|planning|proposed|considering|may|might|could)\b/i.test(fact.claim)) return false;
  const explicit = {
    unknown: /$a/,
    expressed: /\b(?:expressed|stated|confirmed)\b.{0,35}\binterest\b.{0,60}\b(?:robotics|robots?|robotic|automation)\b/i,
    pilot: /\b(?:running|conducting|active|current)\b.{0,30}\b(?:robotics|robotic|robot)\b.{0,20}\bpilot\b/i,
    deployed: /\b(?:robots?|robotics|robotic)\b.{0,35}\b(?:in production|production deployment|production operation)\b|\b(?:production deployment|production operation)\b.{0,35}\b(?:robots?|robotics|robotic)\b/i,
  };
  return explicit[brief.stage.interest].test(fact.claim);
}

/** Task-specific questions use verified state; unknown interest needs no buying
 * signal. Existing deployment is not an expansion plan or match promise. */
export function firstContactLearningQuestion(task: string, state: CommunicationsBrief["stage"]["interest"] = "unknown") {
  if (!safeFragment(task, 120)) throw new Error("first_contact_task_requires_review");
  const questions = {
    unknown: `Is exploring robotics for ${task} relevant to your site?`,
    expressed: `What would you most want to learn about robotics for ${task}?`,
    pilot: `What is the main unresolved uncertainty in your robotics pilot for ${task}?`,
    deployed: `Is there an unresolved question about your robot deployment for ${task} that would be useful to explore?`,
  };
  return questions[state];
}

/** Compile only public quoted evidence and fixed bounded language. Richer model
 * wording remains a human-reviewed draft; regex alone cannot attest its meaning. */
export function compileAutomaticFirstContact(briefValue: unknown, now: number): CommunicationsOutput | null {
  const parsed = communicationsBriefSchema.safeParse(briefValue);
  if (!parsed.success) return null;
  const brief = parsed.data;
  if (brief.priorConversation || brief.consent.status !== "public_business_contact"
    || !validateRecipientEmailAddress(brief.contact.email).valid
    || !brief.researchOrigin.sourceDigest || !brief.researchOrigin.contactEvidenceDigest
    || !brief.researchOrigin.contactEvidenceKind || !brief.consent.sourceRefs.includes(brief.contact.sourceUrl)
    || !fresh(brief.contact.sourceCheckedAt, now) || briefRefreshReasons(brief, now).length
    || brief.outreachContext.connectionEvidence || brief.outreachContext.verifiedCapabilities.length
    || brief.capabilityIds.length || !safeFragment(brief.boundedJob, 120)) return null;
  const observation = brief.outreachContext.observations.find(item => !item.claim.startsWith(PUBLIC_CONTACT_PREFIX)
    && safeFragment(item.claim, 360) && brief.facts.some(fact => fact.claim === item.claim && fact.sourceUrl === item.source
      && ["operator_stated", "primary", "corroborated"].includes(fact.evidenceClass) && fresh(fact.sourceCheckedAt, now)));
  if (!observation) return null;
  const fact = brief.facts.find(item => item.claim === observation.claim && item.sourceUrl === observation.source)!;
  if (brief.stage.interest !== "unknown" && (!brief.stage.evidenceIds.length || brief.stage.evidenceIds.some(id => {
    const proof = brief.facts.find(item => item.id === id);
    return !proof || !firstContactStateProof(brief, proof, now);
  }))) return null;
  const question = firstContactLearningQuestion(brief.boundedJob, brief.stage.interest);
  if (brief.contact.learningQuestion !== question) return null;
  const senderIdentity = "I'm building Blueprint.";
  const relevance = `I'm asking about ${brief.boundedJob}.`;
  const offer = {
    unknown: `For ${brief.boundedJob}, a useful first step could be separating the repeatable part from the exceptions before considering robot options.`,
    expressed: `For ${brief.boundedJob}, a small learning brief could separate what public sources establish from the questions an evaluation would need to resolve.`,
    pilot: `For ${brief.boundedJob}, a useful pilot checklist could separate the repeatable step from the exceptions that still need testing.`,
    deployed: `For ${brief.boundedJob}, a small learning brief could separate what the current deployment already shows from what remains uncertain.`,
  }[brief.stage.interest];
  const limits = "This uses public sources only; it doesn't establish robot fit or permission to share site details.";
  const recipientChoice = "You can decide whether any deeper conversation is useful. No follow-up is assumed.";
  const body = [senderIdentity, `Your public material says: “${observation.claim}”`, relevance, offer, limits, question, recipientChoice,
    "This is commercial outreach from Blueprint."].join("\n\n");
  const output: CommunicationsOutput = {
    disposition: "draft", subject: `A question about ${brief.boundedJob}`, body,
    reason: "Compiled from a verified public task under the bounded first-contact policy",
    usedFactIds: [...new Set([fact.id, ...brief.stage.evidenceIds])], refreshFactIds: [],
    // The model never grants authority. The separate server policy record does.
    requiresHumanReview: true,
    outreachContract: { version: "blueprint.outreach.v1", senderIdentity,
      opening: { kind: "cold", noVerifiedConnectionReason: "No verified relationship is recorded.", publicDetail: observation, relevance },
      value: { kind: "observation", offer, limits }, question, recipientChoice,
      workflow: { phase: "site_led_discovery", briefKind: "readiness_learning", nextStep: "job_brief_question", teamFeasibility: "pending", teamFeasibilitySources: [] },
      capabilityClaims: [],
    },
  };
  return output.subject.length <= 120 && body.length <= 2200 && body.split(/\s+/).length <= FIRST_CONTACT_POLICY.bodyMaxWords ? output : null;
}

const payloadKeys = new Set(["type", "to", "from", "replyTo", "subject", "body", "emailTransport", "transportBody",
  "commercialEmail", "emailSuppressionScope", "unsubscribeUrl", "outreachContext", "outreachContract", "communications", "recipientGeography",
  "gmailThreadId", "inReplyTo"]);

/** No country inference from email domain, timezone, city or state name. Only an
 * explicit US location in the source-QA-approved operator geography excerpt
 * qualifies; unknown/non-US locations remain in the review queue. */
export function firstContactGeography(provenance: any, brief: CommunicationsBrief, now: number) {
  const source = provenance?.source;
  if (source?.assessment) {
    if (communicationsDigest(source) !== brief.researchOrigin.sourceDigest) return null;
    try {
      const country = assessedSiteGeography(source.candidate, source.assessment);
      const entry = source.candidate.evidence[source.assessment.geography.evidenceIndex];
      return fresh(country.sourceCheckedAt, now) && brief.facts.some(fact => fact.claim === entry.claim && fact.sourceUrl === entry.url
        && fact.evidenceClass === "operator_stated" && fact.sourceCheckedAt === country.sourceCheckedAt) ? country : null;
    } catch { return null; }
  }
  const explicitUS = (value: string) => /(?:\bUnited States(?: of America)?\b|\bUSA\b|\bU\.S\.(?:A\.)?)/i.test(value)
    && !/\b(?:outside|not located|headquarters|HQ|corporate office|elsewhere|overseas|worldwide|international|global|other sites?|other facilities|multiple|locations|facilities|warehouses|plants|Canada|Canadian|Mexico|Mexican)\b/i.test(value);
  if (!source || communicationsDigest(source) !== brief.researchOrigin.sourceDigest
    || typeof source.candidate?.location !== "string" || !explicitUS(source.candidate.location)) return null;
  const entry = source.candidate?.evidence?.find((item: any) => item.role === "geography"
    && item.classification === "operator" && item.claim_kind === "fact" && item.origin === "live"
    && item.assertion_scope === "current_operational" && typeof item.quote === "string"
    && explicitUS(item.quote) && containsContactName(item.quote, source.candidate.site)
    && /\b(?:located|address|site|facility|plant|warehouse|factory|laundry|kitchen)\b/i.test(item.quote)
    && fresh(item.source_checked_at ?? item.checked_date, now)
    && brief.facts.some(fact => fact.claim === item.claim && fact.sourceUrl === item.url
      && fact.evidenceClass === "operator_stated" && fact.sourceCheckedAt === (item.source_checked_at ?? item.checked_date)));
  return entry ? { countryCode: "US", sourceUrl: entry.url, sourceCheckedAt: entry.source_checked_at ?? entry.checked_date,
    claim: entry.claim, evidenceDigest: communicationsDigest(entry), scope: "published_business_site" } : null;
}

/** This is a reproducible authority snapshot, not a fabricated human attestation. */
export function firstContactAuthority(payload: ActionPayload, now: number, savedPostalLine?: string, legacy = false) {
  const parsed = communicationsEnvelopeSchema.safeParse(payload.communications);
  if (!parsed.success || payload.type !== "send_email" || Object.keys(payload).some(key => !payloadKeys.has(key))) return null;
  const { job, brief, output, thread } = parsed.data;
  const postalLine = savedPostalLine ?? firstContactPostalLine();
  if (!postalLine || payload.commercialEmail !== true || payload.emailSuppressionScope !== "growth_campaign"
    || ![false, true].some(legacyFooter => payload.transportBody === appendFirstContactFooter(output.body, brief.contact.email, postalLine, legacyFooter))) return null;
  const geography = payload.recipientGeography as ReturnType<typeof firstContactGeography>;
  if (!geography || geography.countryCode !== "US" || !fresh(geography.sourceCheckedAt, now)) return null;
  if (legacy) {
    if (job.intent !== "outreach" || job.inboundMessageId || thread || brief.priorConversation) return null;
    const compiled = compileAutomaticFirstContact(brief, now);
    if (!compiled || communicationsDigest(output) !== communicationsDigest(compiled)) return null;
  } else {
    // Input text and the writer's review marker never supply permission. Only
    // existing published-business admission and a real correlated reply qualify.
    if (brief.consent.status !== "public_business_contact" || !validateRecipientEmailAddress(brief.contact.email).valid
      || !brief.researchOrigin.sourceDigest || !brief.researchOrigin.contactEvidenceDigest
      || !brief.researchOrigin.contactEvidenceKind || !brief.consent.sourceRefs.includes(brief.contact.sourceUrl)
      || !fresh(brief.contact.sourceCheckedAt, now) || briefRefreshReasons(brief, now).length) return null;
    if (brief.stage.interest !== "unknown" && brief.stage.evidenceIds.some(id => {
      const fact = brief.facts.find(item => item.id === id);
      return !fact || !firstContactStateProof(brief, fact, now);
    })) return null;
    if (job.intent === "outreach") {
      if (job.inboundMessageId || thread || brief.priorConversation || payload.gmailThreadId || payload.inReplyTo) return null;
    } else {
      if (!brief.replyOrigin || !thread || !job.inboundMessageId || !correlateReply(brief, thread, job.inboundMessageId)) return null;
      const replies = correlatedReplies(brief, thread);
      if (replies.some(isOptOut) || replies.at(-1)?.gmailMessageId !== job.inboundMessageId) return null;
    }
    // Retain the original public-only scope; broader disclosure/commitments do
    // not become authorized because the recipient or writer asks for them.
    if (routineCommunicationsContentBlockers(output, job.intent).length) return null;
  }
  const review = reviewCommunicationsPayload(payload, now, postalLine);
  if (!review.hardChecksPassed || !review.digest) return null;
  const policy = legacy ? FIRST_CONTACT_POLICY : ROUTINE_COMMUNICATIONS_POLICY;
  return { version: legacy ? "blueprint.first-contact-authority.v1" : "blueprint.first-contact-authority.v2",
    kind: legacy ? "standing_first_contact_policy" : "standing_agent_communications_policy",
    policyVersion: policy.version, policyDigest: communicationsDigest(policy),
    dailyTimezone: FIRST_CONTACT_POLICY.dailyTimezone,
    qualification: FIRST_CONTACT_POLICY.qualification, evaluatedAt: new Date(now).toISOString(),
    jobId: job.jobId, prospectId: job.prospectId, siteId: brief.siteId, taskId: brief.taskId,
    briefDigest: job.briefDigest, payloadDigest: communicationsDigest(payload), reviewDigest: review.digest,
    contact: { email: brief.contact.email.toLowerCase(), sourceUrl: brief.contact.sourceUrl,
      sourceCheckedAt: brief.contact.sourceCheckedAt, evidenceDigest: brief.researchOrigin.contactEvidenceDigest },
    sourceDigest: brief.researchOrigin.sourceDigest, packetDigest: brief.researchOrigin.packetDigest,
    rawArtifactDigest: brief.researchOrigin.rawArtifactDigest, sourceRecordUrl: brief.qualityReview.sourceRecordUrl,
    stage: brief.stage, usedEvidence: output.usedFactIds.map(id => brief.facts.find(fact => fact.id === id)),
    recipientGeography: geography,
    outreachPostalLine: postalLine,
    followUpsAuthorized: false,
    ...(!legacy ? { intent: job.intent, inboundMessageId: job.inboundMessageId,
      threadDigest: thread ? communicationsDigest(thread) : null, replyOrigin: brief.replyOrigin ?? null } : {}),
  };
}
export type FirstContactAuthority = NonNullable<ReturnType<typeof firstContactAuthority>>;

export function verifyFirstContactAuthority(value: any, payload: ActionPayload, now: number, historical = false) {
  const legacy = value?.version === "blueprint.first-contact-authority.v1" && value?.kind === "standing_first_contact_policy";
  const routine = value?.version === "blueprint.first-contact-authority.v2" && value?.kind === "standing_agent_communications_policy";
  if ((!legacy && !routine) || !Number.isFinite(Date.parse(value?.evaluatedAt))
    || Date.parse(value.evaluatedAt) > now) throw new Error("first_contact_authority_missing_or_changed");
  const expected = firstContactAuthority(payload, Date.parse(value.evaluatedAt), value.outreachPostalLine, legacy);
  if (!expected || communicationsDigest(expected) !== communicationsDigest(value)
    || (!historical && !firstContactAuthority(payload, now, undefined, legacy))) throw new Error("first_contact_authority_missing_or_changed");
  return expected;
}

/** Reverify the stored publication/contact relationship, not a bare CRM address.
 * The separate protected source record is read in the send transaction too. */
export function verifyFirstContactSource(provenance: any, brief: CommunicationsBrief, contactProof?: unknown, geography?: unknown, now = Date.now()) {
  const source = provenance?.source;
  if (provenance?.contactSourceIdentifiesRecipient !== true || provenance?.briefDigest !== communicationsDigest(brief)
    || communicationsDigest(source ?? null) !== brief.researchOrigin.sourceDigest
    || source?.candidate?.organization !== brief.facilityName || source?.candidate?.task !== brief.boundedJob
    || typeof source?.candidate?.site !== "string" || !source.candidate.site
    || source?.researchReview?.source_support_verified !== true || source?.researchReview?.crm_rechecked !== true
    || !source?.researchReview?.accepted_keys?.includes(brief.researchOrigin.candidateKey)) throw new Error("first_contact_source_missing_or_changed");
  requireVerifiedLead(source, now);
  const contact = brief.researchOrigin.contactEvidenceKind === "public_operator_resolution"
    ? verifyContactResolution(contactProof, source, brief.prospectId) : qualifiedSourceContact(source);
  if (contact.email !== brief.contact.email.toLowerCase() || contact.sourceUrl !== brief.contact.sourceUrl
    || contact.sourceCheckedAt !== brief.contact.sourceCheckedAt || contact.evidenceDigest !== brief.researchOrigin.contactEvidenceDigest) {
    throw new Error("first_contact_source_missing_or_changed");
  }
  const observations = brief.outreachContext.observations.every(item => source.candidate.evidence.some((entry: any) =>
    entry.role === "task" && ["operator", "independent"].includes(entry.classification) && entry.claim_kind === "fact"
    && entry.claim === item.claim && entry.url === item.source));
  if (!observations || !brief.outreachContext.observations.length) throw new Error("first_contact_public_task_missing");
  const country = firstContactGeography(provenance, brief, now);
  if (!country || communicationsDigest(country) !== communicationsDigest(geography ?? null)) throw new Error("first_contact_geography_requires_review");
  return source;
}

export const firstContactRecipientKey = (email: string) => communicationsDigest({ mailbox: "nijel@tryblueprint.io", email: email.trim().toLowerCase() });
