// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  reviewOutreachDraft, validateOutreachSemanticReview, type OutreachReviewContract,
} from "../agents/outreach-review";
import { outreachContext, outreachContract, outreachDraft, passingOutreachChecks } from "./fixtures/outreach-review";

describe("first-contact outreach review", () => {
  it("makes a sourced, bounded cold draft reviewable without granting send approval", () => {
    const result = reviewOutreachDraft(outreachDraft);
    expect(result.hardChecksPassed).toBe(true);
    expect(result.digest).toMatch(/^[a-f0-9]{64}$/);
    expect(Object.keys(result.semanticReviewRequired)).toHaveLength(6);
    expect(validateOutreachSemanticReview(result, undefined)).toBe("outreach_semantic_review_required");
    expect(validateOutreachSemanticReview(result, { digest: result.digest, checks: passingOutreachChecks })).toBeNull();
  });

  it.each([undefined, null, {}, { ...outreachContract, version: "old" }])("fails closed for invalid contracts: %j", (contract) => {
    expect(reviewOutreachDraft({ ...outreachDraft, contract }).blockers).toContain("outreach_contract_missing_or_invalid");
  });

  it("rejects a fabricated public detail or source even when present in the body", () => {
    const contract = structuredClone(outreachContract);
    if (contract.opening.kind !== "cold") throw new Error("fixture must be cold");
    contract.opening.publicDetail.source = "https://invented.example/news";
    expect(reviewOutreachDraft({ ...outreachDraft, contract }).blockers).toContain("cold_detail_not_in_recorded_evidence");
  });

  it("retains the exact source claim internally while reviewing a short faithful cold opening", () => {
    const contract = structuredClone(outreachContract);
    if (contract.opening.kind !== "cold") throw new Error("fixture must be cold");
    const original = contract.opening.publicDetail.claim;
    const recorded = original + " This sourced paragraph includes internal context that does not belong in the email.";
    const concise = "Your careers page mentions a packing station.";
    const context = { ...structuredClone(outreachContext), observations: [{ claim: recorded, source: contract.opening.publicDetail.source }] };
    contract.opening.publicDetail = { ...contract.opening.publicDetail, claim: concise, sourceClaim: recorded };
    const draft = { ...outreachDraft, body: outreachDraft.body.replace(original, concise), context, contract };
    const result = reviewOutreachDraft(draft);
    expect(result.hardChecksPassed).toBe(true);
    expect(draft.body).not.toContain(recorded);
    expect(validateOutreachSemanticReview(result, undefined)).toBe("outreach_semantic_review_required");
    expect(validateOutreachSemanticReview(result, { digest: result.digest, checks: { ...passingOutreachChecks, evidence: "block" } }))
      .toBe("outreach_semantic_review_not_passed");
    for (const changed of [
      { ...contract.opening.publicDetail, sourceClaim: "A different, unrecorded source claim." },
      { ...contract.opening.publicDetail, source: "https://different.example/news" },
      { claim: concise, source: contract.opening.publicDetail.source },
    ]) {
      expect(reviewOutreachDraft({ ...draft, contract: { ...contract, opening: { ...contract.opening, publicDetail: changed } } }).blockers)
        .toContain("cold_detail_not_in_recorded_evidence");
    }
    expect(reviewOutreachDraft({ ...draft, body: outreachDraft.body }).blockers).toContain("review_anchor_missing_from_body");
  });

  it.each(["inferred", "file:///private/research", "https://user:secret@facility.example/news", "javascript:alert(1)"])("requires a public-source URL: %s", (source) => {
    const contract = structuredClone(outreachContract);
    if (contract.opening.kind !== "cold") throw new Error("fixture must be cold");
    contract.opening.publicDetail.source = source;
    const context = { ...outreachContext, observations: [contract.opening.publicDetail] };
    expect(reviewOutreachDraft({ ...outreachDraft, contract, context }).blockers).toContain("cold_detail_requires_public_url");
  });

  it.each(["relevance", "offer", "limits", "question", "recipientChoice"])("rejects metadata that is missing from recipient text: %s", (field) => {
    const anchor = field === "relevance" && outreachContract.opening.kind === "cold" ? outreachContract.opening.relevance
      : field === "offer" || field === "limits" ? outreachContract.value[field]
      : outreachContract[field as "question" | "recipientChoice"];
    expect(reviewOutreachDraft({ ...outreachDraft, body: outreachDraft.body.replace(anchor, "") }).blockers).toContain("review_anchor_missing_from_body");
  });

  it("requires the evidence opening before the offer or question", () => {
    expect(reviewOutreachDraft({ ...outreachDraft, body: outreachContract.question + " " + outreachDraft.body.replace(outreachContract.question, "") }).blockers)
      .toContain("verified_or_public_opening_must_come_first");
  });

  it.each([outreachDraft.body.replace("?", "."), outreachDraft.body + " What is your budget?"])("rejects zero or multiple questions", (body) => {
    expect(reviewOutreachDraft({ ...outreachDraft, body }).blockers).toContain("exactly_one_initial_question_required");
  });

  it.each([
    ["Please schedule a call.", "default_meeting_or_questionnaire"],
    ["Fill out this questionnaire.", "default_meeting_or_questionnaire"],
    ["Please upload a video.", "confidential_or_capture_ask"],
    ["Share your confidential internal documents.", "confidential_or_capture_ask"],
    ["Act now, this is your last chance.", "pressure_or_guarantee"],
    ["We guarantee robot fit.", "pressure_or_guarantee"],
    ["Our mutual friend referred us.", "unverified_connection_claim"],
  ])("rejects explicit violations in the subject as well as body: %s", (text, code) => {
    expect(reviewOutreachDraft({ ...outreachDraft, subject: text }).blockers).toContain(code);
    expect(reviewOutreachDraft({ ...outreachDraft, body: outreachDraft.body + " " + text }).blockers).toContain(code);
  });

  it.each(["connection", "introduction", "shared_community"] as const)("requires recorded verification for %s", (kind) => {
    const claim = kind === "shared_community" ? "We are both members of the Packing Forum." : "We met at the Packing Forum.";
    const contract: OutreachReviewContract = { ...outreachContract, opening: { kind, claim } };
    const body = claim + " " + outreachDraft.body;
    const draft = { ...outreachDraft, contract, body };
    expect(reviewOutreachDraft(draft).blockers).toContain("connection_claim_not_verified_in_record");
    const evidence = { kind, claim, source: "operator-record:forum", supportingExcerpt: "Membership confirmed for both parties.", verifiedBy: "reviewer", verifiedAt: "2026-09-30T19:00:00.000Z" };
    expect(reviewOutreachDraft({ ...draft, context: { ...outreachContext, connectionEvidence: evidence } }).hardChecksPassed).toBe(true);
    expect(reviewOutreachDraft({ ...draft, context: { ...outreachContext, connectionEvidence: { ...evidence, verifiedBy: "" } } }).hardChecksPassed).toBe(false);
    if (kind === "shared_community") {
      expect(reviewOutreachDraft({ ...draft, body: body + " The forum endorsed us.", context: { ...outreachContext, connectionEvidence: evidence } }).blockers)
        .toContain("shared_community_implies_endorsement");
    }
  });

  it.each(["connection", "evidence", "boundedValue", "easyQuestion", "recipientChoice", "workflow"] as const)("blocks semantic failures on %s even when hard checks pass", (check) => {
    const result = reviewOutreachDraft(outreachDraft);
    for (const decision of ["revise", "block"]) {
      expect(validateOutreachSemanticReview(result, { digest: result.digest, checks: { ...passingOutreachChecks, [check]: decision } }))
        .toBe("outreach_semantic_review_not_passed");
    }
  });

  it("cannot certify a compound question or invented unlisted assertion with lexical checks", () => {
    const question = "Is packing relevant and what is your internal throughput?";
    const contract = { ...outreachContract, question };
    const body = outreachDraft.body.replace(outreachContract.question, question) + " Your team uses twelve robot arms.";
    const result = reviewOutreachDraft({ ...outreachDraft, contract, body });
    expect(result.hardChecksPassed).toBe(true);
    expect(validateOutreachSemanticReview(result, undefined)).toBe("outreach_semantic_review_required");
    expect(validateOutreachSemanticReview(result, { digest: result.digest, checks: { ...passingOutreachChecks, evidence: "block", easyQuestion: "block" } }))
      .toBe("outreach_semantic_review_not_passed");
  });

  it("requires semantic rejection of assumed interest despite valid question anchors", () => {
    const question = "What prompted your interest in a packing robot?";
    const contract = { ...outreachContract, question };
    const body = outreachDraft.body.replace(outreachContract.question, question);
    // The fixture's public packing-station detail does not express interest in robotics.
    const result = reviewOutreachDraft({ ...outreachDraft, contract, body });
    expect(result.hardChecksPassed).toBe(true);
    expect(result.semanticReviewRequired.easyQuestion).toContain("unknown interest means ask relevance without assuming interest");
    expect(result.semanticReviewRequired.easyQuestion).toContain("expressed interest means ask the learning goal");
    expect(result.semanticReviewRequired.easyQuestion).toContain("pilot means ask an unresolved uncertainty");
    expect(result.semanticReviewRequired.easyQuestion).toContain("existing deployment means ask about expansion learning");
    expect(result.semanticReviewRequired.easyQuestion).toContain("public-signal provenance");
    expect(validateOutreachSemanticReview(result, undefined)).toBe("outreach_semantic_review_required");
    expect(validateOutreachSemanticReview(result, { digest: result.digest, checks: { ...passingOutreachChecks, easyQuestion: "block" } }))
      .toBe("outreach_semantic_review_not_passed");
  });

  it("binds review to recipient, text, contract, and evidence", () => {
    const result = reviewOutreachDraft(outreachDraft);
    const attestation = { digest: result.digest, checks: passingOutreachChecks };
    for (const changed of [
      { ...outreachDraft, to: "another@facility.example" },
      { ...outreachDraft, subject: "Changed subject" },
      { ...outreachDraft, body: outreachDraft.body + " Regards." },
      { ...outreachDraft, contract: { ...outreachContract, value: { ...outreachContract.value, kind: "observation" } } },
      { ...outreachDraft, context: { ...outreachContext, observations: [...outreachContext.observations, { claim: "Other fact", source: "https://facility.example/other" }] } },
    ]) {
      expect(validateOutreachSemanticReview(reviewOutreachDraft(changed), attestation)).toBe("outreach_review_does_not_match_draft");
    }
  });

  it("requires Blueprint identity in the first-contact body before the offer", () => {
    expect(reviewOutreachDraft({ ...outreachDraft, contract: { ...outreachContract, senderIdentity: "I am an independent researcher." } }).blockers)
      .toContain("blueprint_identity_required");
    const body = outreachDraft.body.replace(outreachContract.senderIdentity, "") + " " + outreachContract.senderIdentity;
    expect(reviewOutreachDraft({ ...outreachDraft, body }).blockers).toContain("blueprint_identity_required_before_offer");
  });

  it("separates site-led learning from promises of participation, capacity, or a fee-triggering match", () => {
    for (const workflow of [
      { ...outreachContract.workflow, briefKind: "qualified_match" },
      { ...outreachContract.workflow, nextStep: "footage_upload" },
    ]) expect(reviewOutreachDraft({ ...outreachDraft, contract: { ...outreachContract, workflow } }).hardChecksPassed).toBe(false);
    for (const body of ["We found a match.", "Your team is ready to deploy.", "We already shared your job with robot teams."]) {
      expect(reviewOutreachDraft({ ...outreachDraft, body: outreachDraft.body + " " + body }).hardChecksPassed).toBe(false);
    }
    // Nuanced distinctions still need review; there is no participation or capacity state mutation.
    const result = reviewOutreachDraft({ ...outreachDraft, body: outreachDraft.body + " A reply means consent to evaluate and share your job." });
    expect(validateOutreachSemanticReview(result, { digest: result.digest, checks: { ...passingOutreachChecks, workflow: "block" } }))
      .toBe("outreach_semantic_review_not_passed");
  });

  it("keeps parallel team feasibility pending until evidence is recorded", () => {
    const teamObservation = { claim: "The team's public report discusses packing.", source: "https://robot-team.example/research" };
    const workflow = { ...outreachContract.workflow, teamFeasibility: "public_research", teamFeasibilitySources: [teamObservation] };
    const contract = { ...outreachContract, workflow };
    expect(reviewOutreachDraft({ ...outreachDraft, contract }).blockers).toContain("team_feasibility_not_in_recorded_evidence");
    expect(reviewOutreachDraft({ ...outreachDraft, contract, context: { ...outreachContext, teamObservations: [teamObservation] } }).hardChecksPassed).toBe(true);
    expect(reviewOutreachDraft({ ...outreachDraft, contract: { ...contract, workflow: { ...workflow, teamFeasibilitySources: [] } } }).blockers)
      .toContain("team_feasibility_status_requires_matching_evidence");
  });

  it.each(["Atlas", "pipeline"] as const)("blocks %s claims without exact operator-recorded capability evidence", (name) => {
    const claim = `${name} supports this bounded research check.`;
    const body = outreachDraft.body + " " + claim;
    expect(reviewOutreachDraft({ ...outreachDraft, body }).blockers).toContain("capability_claim_not_verified_in_record");
    const reference = { name, claim, source: "verification-record:capability" };
    const contract = { ...outreachContract, capabilityClaims: [reference] };
    expect(reviewOutreachDraft({ ...outreachDraft, body, contract }).blockers).toContain("capability_claim_not_verified_in_record");
    const evidence = { ...reference, supportingExcerpt: "Recorded scoped check passed.", verifiedBy: "operator", verifiedAt: "2026-09-30T19:00:00.000Z" };
    expect(reviewOutreachDraft({ ...outreachDraft, body, contract, context: { ...outreachContext, verifiedCapabilities: [evidence] } }).hardChecksPassed).toBe(true);
  });
});

// Design v1.1: an outreach-ready hypothesis asks exactly one question, the published one, verbatim.
describe("blueprint.outreach.v2 for outreach-ready hypothesis drafts (synthetic)", () => {
  const QUESTION = "Which parts of sorting returned parcels at Synthetic sorting site still need people, and what has kept them from being automated?";
  const ADDRESSEE = "whoever runs sorting returned parcels at Synthetic sorting site";
  const context = { observations: [
    { claim: "Synthetic hypothesis operator runs the Synthetic sorting site", source: "https://hypothesis-operator.example/locations/sorting" },
    { claim: "Associates sort returned parcels at the Synthetic sorting site", source: "https://hypothesis-operator.example/careers/sorting-associate" }],
  connectionEvidence: null, teamObservations: [], verifiedCapabilities: [] };
  const qualification = { tier: "outreach_ready", label: "hypothesis", openChecks: ["manual_workflow", "existing_automation", "fit", "interest"],
    openQuestions: [QUESTION], ownerDecision: { reference: "synthetic://owner-decision", direction: { uri: "synthetic://direction", generation: "1", sha256: "c".repeat(64) } },
    sendsAuthorized: false };
  const contract = { version: "blueprint.outreach.v2", senderIdentity: "I'm building Blueprint.",
    opening: { kind: "cold", noVerifiedConnectionReason: "No verified relationship is recorded.",
      publicDetail: { claim: "Your job post says associates sort returned parcels at the Synthetic sorting site.",
        source: "https://hypothesis-operator.example/careers/sorting-associate", sourceClaim: "Associates sort returned parcels at the Synthetic sorting site" },
      relevance: "I'm trying to learn how that work is done today." },
    questions: [{ question: QUESTION, checks: ["manual_workflow"] }],
    recipientChoice: "Whether to answer is entirely up to you." };
  const body = [`Hello, I'm hoping this reaches ${ADDRESSEE}.`, contract.senderIdentity, contract.opening.publicDetail.claim,
    contract.opening.relevance, QUESTION, contract.recipientChoice, "Nijel"].join("\n\n");
  const draft = (change: (value: any) => void = () => undefined) => {
    const value: any = { to: "sortingops@hypothesis-operator.example", subject: "Sorting returned parcels at Synthetic sorting site", body,
      contract: structuredClone(contract), context: structuredClone(context), qualification: structuredClone(qualification),
      recipient: { kind: "inbox", addressee: ADDRESSEE, person: { name: "Synthetic Person", role: "operations manager", sourceUrl: "https://news.example/story" } } };
    change(value);
    return value;
  };

  it("passes a draft that asks only the published question, verbatim, with one question mark", () => {
    const result = reviewOutreachDraft(draft());
    expect(result).toMatchObject({ hardChecksPassed: true, blockers: [] });
    expect(result.digest).toMatch(/^[a-f0-9]{64}$/);
    // The digest binds the published question and the recipient too.
    expect(reviewOutreachDraft(draft(value => { value.recipient.person = null; })).digest).not.toBe(result.digest);
  });
  it("greets a named person whose own address this is, by name", () => {
    const named = draft(value => { value.recipient = { kind: "named_person", name: "Synthetic Person", role: "Manager",
      sourceUrl: "https://hypothesis-operator.example/team" }; value.body = value.body.replace(`Hello, I'm hoping this reaches ${ADDRESSEE}.`, "Hi Synthetic,"); });
    expect(reviewOutreachDraft(named)).toMatchObject({ hardChecksPassed: true });
  });
  it.each<[string, (value: any) => void, string]>([
    ["a question that is not the published one", value => { value.contract.questions[0].question = "Is sorting returned parcels still done by hand?";
      value.body = value.body.replace(QUESTION, "Is sorting returned parcels still done by hand?"); }, "hypothesis_question_not_published"],
    ["the published question missing from the body", value => { value.body = value.body.replace(QUESTION, "Tell me about the work."); },
      "hypothesis_question_missing_from_body"],
    ["a second question in the body", value => { value.body += "\n\nP.S. Is this useful?"; }, "exactly_one_initial_question_required"],
    ["a question mark in the subject", value => { value.subject = "A question about sorting?"; }, "hypothesis_subject_has_question"],
    ["two questions in the contract", value => { value.contract.questions.push({ question: "Is this useful?", checks: ["interest"] }); },
      "outreach_contract_missing_or_invalid"],
    ["no question in the contract", value => { value.contract.questions = []; }, "outreach_contract_missing_or_invalid"],
    ["the wrong open check for the question", value => { value.contract.questions[0].checks = ["interest"]; }, "hypothesis_question_checks_mismatch"],
    ["the verified-lead v1 contract", value => { value.contract = { ...outreachContract }; }, "outreach_hypothesis_contract_required"],
    ["no qualification block", value => { delete value.qualification; }, "outreach_hypothesis_qualification_missing"],
    ["an opening detail not in the recorded evidence", value => { value.contract.opening.publicDetail.sourceClaim = "Invented claim"; },
      "cold_detail_not_in_recorded_evidence"],
    ["a capability claim", value => { value.body = value.body.replace("Nijel", "Our Atlas system could help.\n\nNijel"); },
      "capability_claim_not_verified_in_record"],
    ["an inbox draft that does not address whoever runs the task", value => { value.body = value.body.replace(` ${ADDRESSEE}`, " the team"); },
      "hypothesis_recipient_greeting_mismatch"],
    ["an inbox draft that names the person behind the role", value => { value.body = value.body.replace("Hello,", "Hello Synthetic Person,"); },
      "hypothesis_recipient_greeting_mismatch"],
    ["a named person who is not greeted", value => { value.recipient = { kind: "named_person", name: "Synthetic Person", role: "Manager",
      sourceUrl: "https://hypothesis-operator.example/team" }; }, "hypothesis_recipient_greeting_mismatch"],
    ["no recipient", value => { delete value.recipient; }, "hypothesis_recipient_greeting_mismatch"],
    ["a meeting request", value => { value.body = value.body.replace("Nijel", "Can we book a call to discuss.\n\nNijel"); }, "default_meeting_or_questionnaire"],
  ])("rejects %s", (_name, change, blocker) => {
    const result = reviewOutreachDraft(draft(change));
    expect(result.hardChecksPassed).toBe(false);
    expect(result.blockers).toContain(blocker);
  });
  it("never reviews a v2 contract as a verified-lead draft, and keeps the v1 review unchanged", () => {
    const { qualification: _q, recipient: _r, ...plain } = draft();
    expect(reviewOutreachDraft(plain).blockers).toContain("outreach_hypothesis_qualification_missing");
    expect(reviewOutreachDraft(outreachDraft)).toMatchObject({ hardChecksPassed: true, blockers: [] });
  });
});
