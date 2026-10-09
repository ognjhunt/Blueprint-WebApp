// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
vi.mock("../../client/src/lib/firebaseAdmin", () => ({ dbAdmin: null, authAdmin: null, default: {} }));
import { founderOutreachFixture } from "./fixtures/founder-outreach";
import { communicationsNow } from "./fixtures/communications";
import { communicationsDigest, outreachReadySendRefusal } from "../agents/communications-contract";
import { parseCommunicationsOutput } from "../agents/communications-output";
import { buildCommunicationsInput, buildCommunicationsPayload } from "../agents/communications-worker";
import { reviewCommunicationsPayload } from "../agents/communications-review";
import { COMMUNICATIONS_FRAMING_VERSION } from "../agents/communications-launch-framing";
import { COMMUNICATIONS_PERSONALIZED_PROFILE } from "../agents/communications-saved-agent";
import { COMMUNICATIONS_FOUNDER_WRITING_GUIDANCE, communicationsWritingVariant, communicationsBatchRepetition, communicationsWritingSignals } from "../agents/communications-outreach-quality";

describe("prospective founder outreach quality (offline fixtures)", () => {
  it.each(["named", "inbox", "dated", "future"] as const)("retains evidence and accepts a natural %s first reply through real input/parser/review", kind => {
    const f = founderOutreachFixture(kind), before = communicationsDigest(f.brief);
    const input = JSON.parse(buildCommunicationsInput(f.brief, null, "outreach", "pending_approval", undefined, undefined,
      COMMUNICATIONS_FOUNDER_WRITING_GUIDANCE, COMMUNICATIONS_FRAMING_VERSION, undefined, undefined, COMMUNICATIONS_PERSONALIZED_PROFILE));
    expect(input.researchBrief).toEqual(f.brief);
    expect(input.firstTouchFraming).not.toHaveProperty("question");
    const variant = communicationsWritingVariant({ ...f.output, reason: "[writing-hypothesis:job-relevance] Evidence-backed relevance, no outcome yet." })!;
    expect(variant).toMatchObject({ hypothesisId: "job-relevance", interpretationOnly: true });
    const changed = communicationsWritingVariant({ ...f.output, reason: "[writing-hypothesis:job-relevance]", subject: "A different supported angle" })!;
    expect(changed.variantId).not.toBe(variant.variantId);
    expect(changed.subjectVariantId).not.toBe(variant.subjectVariantId);
    expect(changed.bodyVariantId).toBe(variant.bodyVariantId);
    expect(communicationsWritingVariant(f.output)).toBeNull();
    expect(input.firstTouchPolicy).toContain("Unknown automation, manual work");
    expect(input.firstTouchPolicy).toContain("recipient-site conflicts remain held");
    expect(input.firstTouchPolicy).toContain("Keep dated announcements dated");
    // Prospective profile keeps the same recorded evidence, with flexible ordering and subject punctuation.
    const prospective = structuredClone(f.output);
    (prospective.outreachContract as any).version = "blueprint.outreach.v5";
    prospective.subject += "?";
    if (kind === "future") {
      const contract = prospective.outreachContract as any;
      const original = contract.questions[0].question, request = original.replace(/\?$/, ".");
      contract.questions[0].question = request;
      contract.opening.relevance = request; contract.recipientChoice = request;
      prospective.body = prospective.body.replace(original, "");
      const firstBreak = prospective.body.indexOf("\n\n");
      prospective.body = prospective.body.slice(0, firstBreak) + "\n\n" + request + prospective.body.slice(firstBreak);
    }
    const { output } = parseCommunicationsOutput(JSON.stringify(prospective));
    const payload = buildCommunicationsPayload(f.job, f.brief, null, output, false, null);
    expect(reviewCommunicationsPayload(payload, communicationsNow)).toMatchObject({ hardChecksPassed: true, blockers: [] });
    expect(communicationsDigest(f.brief)).toBe(before);
    if (kind === "future") expect(output.body.match(/\?/g)).toBeNull();
    else expect(output.body.match(/\?/g)).toHaveLength(1);
    expect(output.body).toContain("Thanks,\nNijel Hunt\nBlueprint");
    expect(output.body).not.toMatch(/done by hand|labor savings|ready to deploy|and if so, why|That could mean/);
    expect(communicationsWritingSignals(output.body, f.brief.boundedJob)).toEqual([]);
    expect(outreachReadySendRefusal(f.brief)).toBe("outreach_ready_hypothesis_draft_only");
    if (kind === "dated") {
      expect(output.body).toContain("2020 announcement");
      expect(input.researchBrief.facts[0]).toMatchObject({ publishedAt: "2020-03-01", assertionScope: "as_of_background" });
    }
    if (kind === "future") expect(output.body).toContain("help plan for later");
  });
  it.each([
    ["a person guessed for a general inbox", "Hi Alex,", "hypothesis_recipient_greeting_mismatch"],
    ["a second request", "Can you also explain why?", "exactly_one_initial_question_required"],
    ["invented results", "We guarantee labor savings.", "pressure_or_guarantee"],
    ["invented capabilities", "Our Atlas solves this.", "capability_claim_not_verified_in_record"],
    ["a deployment-ready solution", "We are ready to deploy.", "discovery_cannot_promise_qualified_match_or_capacity"],
  ])("holds %s through real validation", (_name, text, blocker) => {
    const f = founderOutreachFixture("inbox"), output = structuredClone(f.output);
    (output.outreachContract as any).version = "blueprint.outreach.v5";
    output.body = text.startsWith("Hi ") ? output.body.replace("Hi machining team,", text) : output.body + "\n\n" + text;
    const review = reviewCommunicationsPayload(buildCommunicationsPayload(f.job, f.brief, null, output, false, null), communicationsNow);
    expect(review.blockers).toContain(blocker);
  });
  it("reports repeated boilerplate around different tasks without making it a rejection or another model call", () => {
    const bodies = ["packing orders", "CNC machine tending", "sorting returned parcels"].map(job =>
      `I'm building Blueprint to help businesses explore where robots could fit into their operations. ${job} is the specific job I'd like to explore. That could mean improving a job now, learning what's practical, or preparing for later.\n\nWould exploring robotics for ${job} be useful?\n\nThanks,\nNijel Hunt\nBlueprint`);
    expect(communicationsBatchRepetition(bodies)).toEqual(expect.arrayContaining([
      expect.objectContaining({ draftIndexes: [0, 1, 2], advisoryOnly: true }),
    ]));
    expect(communicationsWritingSignals(bodies[1], "CNC machine tending")).toMatchObject([{ code: "repeated_job_statement" }]);
    expect(communicationsBatchRepetition(["Hi Riley,\n\nThanks,\nNijel Hunt\nBlueprint", "Hi team,\n\nThanks,\nNijel Hunt\nBlueprint"])).toEqual([]);
  });
});
