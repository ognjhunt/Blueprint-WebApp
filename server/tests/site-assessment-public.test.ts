// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { createHash } from "node:crypto";
import { renderToStaticMarkup } from "react-dom/server";
import * as assessmentRuntime from "../agents/site-assessment";
vi.mock("../../client/src/lib/firebaseAdmin", () => ({ default: {}, dbAdmin: null, storageAdmin: null }));
import { projectCustomerSiteAdvisory, projectCurrentSiteAssessmentView } from "../utils/siteAssessmentPublic";
import { projectCurrentSiteJobDecision, siteJobDecisionSourceDigest } from "../utils/siteJobDecision";
import { SiteAdvisoryReport } from "../../client/src/components/site/SiteAdvisoryReport";
import type { SiteAssessment } from "../agents/site-assessment";

const video = { source_id: "video:private-fixture", kind: "video", canonical_ref: "gs://private-bucket/fixture.mp4", sha256: "a".repeat(64), checked_at: null,
  content: { duration_seconds: 30, evidence: { summary: "Rack movement", observations: [
    { category: "motion", finding: "The upper rack slides outward", basis: "observed", start_seconds: 8, end_seconds: 10, uncertainty: "Force is not measured" },
  ], not_observable: ["Required production rate", "Physical robot performance"] } } };
const observed = () => ({ text: "A robot has already passed this job", basis: "observed" as const,
  evidence: [{ source_id: video.source_id, at_seconds: 8, selector: { kind: "video_observation" as const, observation_index: 0, field_path: null } }] });
const assessment = (): SiteAssessment => ({ status: "assessment", job: [observed()], objects_motions_conditions_variations: [], operator_success: [], known: [],
  estimates: [], missing: [], approaches: [], questions: [],
  next_action: { kind: "measure", action: "Measure the pull force at the upper rack's handle before selecting a gripper.", why: observed() } });
const packet = (raw = assessment()) => ({ schema_version: "site_assessment.v2", request_id: "private-request-fixture", sources: [structuredClone(video)], raw_model_assessment: raw });
const project = (raw = assessment()) => projectCustomerSiteAdvisory(packet(raw), "bp-advisory-test", 30);

// Historical values captured by running the pre-basics projector on this
// synthetic packet. They must not be derived from the implementation under test.
const legacyReviewDigest = "130fa2a1c1adc89e27077d9a847b6a6bc78a47e71b86fd6fd0f7b7d2d565a94c";
const basicsReviewDigest = "4a7d2f322735e01ae79867598eef22eec134feb9d1748bb6eb7424799e16ada9";
const decisionPacket = () => ({ schema_version: "site_assessment.v2", request_id: "synthetic-request", sources: [{
  source_id: "synthetic-video", kind: "video", canonical_ref: "gs://synthetic.invalid/video", sha256: "a".repeat(64), checked_at: null,
  content: { duration_seconds: 30, evidence: { summary: "Rack movement", observations: [{ category: "motion", finding: "Upper rack moves outward",
    basis: "observed", start_seconds: 8, end_seconds: 10, uncertainty: "Force unmeasured" }], not_observable: ["Robot performance"] } },
}], raw_model_assessment: { ...assessment(), job: [{ text: "Rack movement", basis: "observed", evidence: [{ source_id: "synthetic-video", at_seconds: 8,
  selector: { kind: "video_observation", observation_index: 0, field_path: null } }] }], next_action: { kind: "measure", action: "Measure rack pull force.",
  why: { text: "Pull force remains unknown", basis: "unknown", evidence: [] } } } });
const decisionBrief = { summary: "Open the rack", confirmedAtIso: "2026-09-01T00:00:00Z" };
const decisionRecord = (sourceDigest = legacyReviewDigest): Record<string, any> => ({ request: { taskStatement: "Open the rack",
  consent_attestation: { granted: true, statement_version: "2026-09-18.v1", recorded_at_iso: "2026-09-01T00:00:00Z" } },
  site_advisory: { job_id: "synthetic-job", state: "completed", source_key: "source-a", context_digest: "context-a" },
  customerConversation: [], site_task_clarification: null, pilot_recommendation: null,
  customer_decision: { schemaVersion: "site_job_decision.v1", sourceDigest, reviewedBy: "synthetic-reviewer", reviewedAtIso: "2026-09-02T00:00:00Z",
    recommendation: "Obtain pull force measurements", why: "A measurement is needed", decisiveUncertainty: "Pull force", nextAction: "Measure force",
    question: { text: "Which final state is required?", reason: "Defines success" } } });

describe("reviewed decision survives customer-only redaction", () => {
  const view = () => projectCurrentSiteAssessmentView(decisionPacket(), "synthetic-correlation", 30);
  const reviewed = (record = decisionRecord(), brief = decisionBrief, current = view()) =>
    projectCurrentSiteJobDecision(record, brief, current.decisionAssessment, current.compatibleDecisionAssessments);
  it("retains the exact pre-basics named review without altering canonical evidence or exposing analysis", () => {
    const input = decisionPacket(), original = structuredClone(input), current = projectCurrentSiteAssessmentView(input, "synthetic-correlation", 30);
    const { decisionEvidence, ...legacy } = current.decisionAssessment!;
    expect(siteJobDecisionSourceDigest(decisionRecord(), decisionBrief, legacy)).toBe(legacyReviewDigest);
    expect(siteJobDecisionSourceDigest(decisionRecord(), decisionBrief, current.decisionAssessment)).not.toBe(legacyReviewDigest);
    expect(decisionEvidence).toMatchObject({ schemaVersion: "site_decision_evidence.v1", legacyReviewCompatible: true,
      packetSha256: createHash("sha256").update(JSON.stringify(input)).digest("hex") });
    expect(reviewed()).toMatchObject({ nextAction: "Measure force", question: { text: "Which final state is required?" } });
    expect(current.customerAdvisory).toEqual(projectCustomerSiteAdvisory(input, "synthetic-correlation", 30));
    expect(JSON.stringify(current.customerAdvisory)).not.toMatch(/Upper rack moves outward|Reasoning to check|decisionAssessment|decisionEvidence|packetSha256|qualificationSha256/);
    expect(input).toEqual(original);
  });
  it("withholds redacted-era reviews whose immutable reviewed evidence identity was never stored", () => {
    const current = view();
    expect(current.compatibleDecisionAssessments).toEqual([]);
    expect(reviewed(decisionRecord(basicsReviewDigest))).toBeNull();
    expect(siteJobDecisionSourceDigest(decisionRecord(), decisionBrief, current.decisionAssessment)).not.toBe(basicsReviewDigest);
    expect(reviewed(decisionRecord("b".repeat(64)))).toBeNull();
  });
  it("does not infer approval from either historical question-filtered presentation", () => {
    const input = decisionPacket();
    input.raw_model_assessment.questions = [{ question: "What payload can Robot X lift?", decision_it_changes: "Which payload requirement to investigate" }];
    const current = projectCurrentSiteAssessmentView(input, "synthetic-correlation", 30);
    // Captured actual3d6/eaeb digests lack immutable reviewed evidence identity.
    for (const digest of ["4ba59a14fc7e6ef45a8e0f877ded44ed012b001cb4826df7177e5275ab38d4c9", basicsReviewDigest]) {
      expect(reviewed(decisionRecord(digest), decisionBrief, current)).toBeNull();
    }
    expect(current.compatibleDecisionAssessments).toEqual([]);
    expect(JSON.stringify(current.customerAdvisory)).not.toContain("Robot X");
  });
  it.each(["selector", "observation", "unsupported_question"] as const)("rejects the independent stale-alias counterexample: %s", kind => {
    const input = decisionPacket();
    input.raw_model_assessment.next_action = { kind: "research", action: "Check current specifications and unresolved evidence.",
      why: { text: "Pull force remains unknown", basis: "unknown", evidence: [] } };
    input.raw_model_assessment.questions = [{ question: "Which handle must be operated?", decision_it_changes: "Required interaction" }];
    const before = projectCurrentSiteAssessmentView(input, "synthetic-correlation", 30);
    const redactedDigest = siteJobDecisionSourceDigest(decisionRecord(), decisionBrief, before.customerAdvisory);
    const fullDigest = siteJobDecisionSourceDigest(decisionRecord(), decisionBrief, before.decisionAssessment);
    expect(reviewed(decisionRecord(fullDigest), decisionBrief, before)).not.toBeNull();
    // No packet/qualification identity was recorded with the old reduced hash.
    expect(reviewed(decisionRecord(redactedDigest), decisionBrief, before)).toBeNull();
    const changed = structuredClone(input);
    if (kind === "selector") changed.raw_model_assessment.job[0].evidence[0].selector = null as any;
    if (kind === "observation") changed.sources[0].content.evidence.observations[0].finding = "Upper rack remains stationary";
    if (kind === "unsupported_question") changed.raw_model_assessment.questions.push({ question: "What load is required and Robot X can lift 250 kg?", decision_it_changes: "Robot capability" });
    const after = projectCurrentSiteAssessmentView(changed, "synthetic-correlation", 30);
    expect(after.customerAdvisory).toEqual(before.customerAdvisory);
    expect(siteJobDecisionSourceDigest(decisionRecord(), decisionBrief, after.decisionAssessment)).not.toBe(fullDigest);
    for (const digest of [redactedDigest, fullDigest]) {
      expect(reviewed(decisionRecord(digest), decisionBrief, after)).toBeNull();
      // Even an explicitly supplied lossy candidate is not a source authority.
      expect(projectCurrentSiteJobDecision(decisionRecord(digest), decisionBrief, after.decisionAssessment, [before.customerAdvisory])).toBeNull();
    }
  });
  it("invalidates qualification-only renderer changes while binding the same canonical packet", () => {
    const input = decisionPacket(), original = structuredClone(input), before = projectCurrentSiteAssessmentView(input, "synthetic-correlation", 30);
    const digest = siteJobDecisionSourceDigest(decisionRecord(), decisionBrief, before.decisionAssessment);
    const render = assessmentRuntime.renderSourceBoundAssessment;
    const qualification = vi.spyOn(assessmentRuntime, "renderSourceBoundAssessment").mockImplementationOnce((...args) => {
      const current = render(...args);
      // Synthetic CURRENT policy qualification change, not a provider call:
      // identical raw packet now has an unverified factual interpretation.
      current.verification.unverified_claims++;
      return current;
    });
    const after = projectCurrentSiteAssessmentView(input, "synthetic-correlation", 30);
    qualification.mockRestore();
    expect(input).toEqual(original);
    expect(after.decisionAssessment?.decisionEvidence?.packetSha256).toBe(before.decisionAssessment?.decisionEvidence?.packetSha256);
    expect(after.decisionAssessment?.decisionEvidence?.qualificationSha256).not.toBe(before.decisionAssessment?.decisionEvidence?.qualificationSha256);
    expect(after.decisionAssessment?.decisionEvidence?.legacyReviewCompatible).toBe(false);
    expect(reviewed(decisionRecord(digest), decisionBrief, after)).toBeNull();
    expect(reviewed(decisionRecord(legacyReviewDigest), decisionBrief, after)).toBeNull();
  });
  it.each([
    ["request", (r: Record<string, any>) => { r.request.taskStatement = "Close the rack"; }],
    ["withdrawal", (r: Record<string, any>) => { r.request.consent_attestation.withdrawn_at_iso = "2026-09-03T00:00:00Z"; }],
    ["context", (r: Record<string, any>) => { r.site_advisory.context_digest = "context-b"; }],
    ["source", (r: Record<string, any>) => { r.site_advisory.source_key = "source-b"; }],
    ["stage", (r: Record<string, any>) => { r.site_advisory.state = "needs_review"; }],
    ["answer", (r: Record<string, any>) => { r.customerConversation.push({ text: "Close the rack" }); }],
    ["clarification", (r: Record<string, any>) => { r.site_task_clarification = { explanation: "Different final state" }; }],
    ["proposal", (r: Record<string, any>) => { r.pilot_recommendation = { state: "proposed" }; }],
  ] as const)("invalidates a real %s change for both historical review bases", (_kind, edit) => {
    for (const digest of [legacyReviewDigest, basicsReviewDigest]) {
      const record = decisionRecord(digest); edit(record); expect(reviewed(record)).toBeNull();
    }
  });
  it("invalidates changed brief and canonical observation, despite keeping the same private projection format", () => {
    expect(reviewed(decisionRecord(), { ...decisionBrief, summary: "Different work" })).toBeNull();
    const changed = decisionPacket(); changed.sources[0].content.evidence.observations[0].finding = "Upper rack remains stationary";
    expect(reviewed(decisionRecord(), decisionBrief, projectCurrentSiteAssessmentView(changed, "synthetic-correlation", 30))).toBeNull();
  });
  it("uses current evidence qualifications for every historical presentation, never old unsafe bindings", () => {
    const changed = decisionPacket();
    changed.raw_model_assessment.job[0].evidence[0].selector = null as any;
    const current = projectCurrentSiteAssessmentView(changed, "synthetic-correlation", 30);
    expect(current.decisionAssessment?.sections).toEqual([]);
    for (const digest of [legacyReviewDigest, basicsReviewDigest]) expect(reviewed(decisionRecord(digest), decisionBrief, current)).toBeNull();
  });
  it.each(["unavailable", "authority_ended"] as const)("does not retain a ready review when the current reader is %s", state => {
    const unavailable = { ...view().customerAdvisory!, state, sections: [], unknowns: [], nextAction: null };
    expect(projectCurrentSiteJobDecision(decisionRecord(), decisionBrief, unavailable)).toBeNull();
  });
  it.each([{ reviewedBy: "" }, { reviewedAtIso: "bad-date" }, { schemaVersion: "other" }])("preserves named-human/schema/timestamp checks: %s", changes => {
    const record = decisionRecord(); Object.assign(record.customer_decision, changes); expect(reviewed(record)).toBeNull();
  });
});

describe("customer advisory decision details through the existing DTO", () => {
  it("preserves the specific safe proposed action while keeping analysis and rationale internal", () => {
    const result = project();
    expect(result.nextAction).toContain("Recommended next step (proposal): Measure the pull force at the upper rack's handle");
    expect(result.nextAction).not.toContain("Why:");
    expect(result.sections).toEqual([]);
    expect(JSON.stringify(result)).not.toContain("The upper rack slides outward");
    expect(JSON.stringify(result)).not.toContain("A robot has already passed");
    expect(result).toMatchObject({ schemaVersion: "site_customer_advisory.v1", state: "ready", correlationId: "bp-advisory-test" });
  });
  it("keeps decisive missing facts and questions with their decision consequence in the mounted customer report", () => {
    const raw = assessment(); raw.status = "needs_operator_input";
    raw.missing = [{ text: "The required number of rack operations per hour is unknown", basis: "unknown", evidence: [] }];
    raw.questions = [{ question: "How many rack operations must finish each hour?", decision_it_changes: "Whether a slower assisted workflow could meet your production requirement" }];
    raw.next_action = { kind: "ask_operator", action: "Confirm the required hourly rate before choosing an assisted or autonomous workflow.",
      why: { text: "A rate target could change the workflow recommendation", basis: "unknown", evidence: [] } };
    const result = project(raw), html = renderToStaticMarkup(createElement(SiteAdvisoryReport, { advisory: result }));
    expect(result.unknowns).toContain("Unresolved: The required number of rack operations per hour is unknown");
    expect(html).toContain("How many rack operations must finish each hour?");
    expect(html).toContain("Whether a slower assisted workflow could meet your production requirement");
    expect(html).toContain("Confirm the required hourly rate");
    expect(result.nextAction).not.toContain("Reasoning to check:");
    expect(html).not.toContain("Clarify unresolved job facts and success criteria.");
  });
  it("retains safe questions while refusing the raw recommendation when factual bindings failed", () => {
    const raw = assessment(); raw.job[0].evidence[0].selector = null;
    raw.next_action = { kind: "robot_trial", action: "Deploy immediately because robot success is proven.", why: { text: "Fit is proven", basis: "unknown", evidence: [] } };
    raw.questions = [{ question: "Which rack handle must be operated?", decision_it_changes: "Which contact point to investigate" }];
    const result = project(raw);
    expect(result.nextAction).not.toMatch(/Deploy immediately|success is proven|Fit is proven/);
    expect(result.unknowns.join(" ")).toContain("Which rack handle must be operated?");
    expect(result.sections).toEqual([]);
  });
  it("does not restore an unsupported universal no-robot verdict from raw prose", () => {
    const raw = assessment(); raw.next_action.kind = "no_robot"; raw.next_action.action = "No robot can perform this job.";
    const result = project(raw);
    expect(result.nextAction).not.toContain("No robot can perform");
    expect(result.nextAction).toContain("Check current specifications");
  });
  it("scrubs private references in every newly projected free-form field without losing the question", () => {
    const raw = assessment();
    const secret = `https://private.invalid/signed?token=secret gs://private-bucket/fixture.mp4 Bearer fixture-secret ${video.source_id} ${video.sha256} owner@example.invalid`;
    raw.next_action.action = `Measure pull force; private notes ${secret}`;
    raw.missing = [{ text: `Force remains unknown; ${secret}`, basis: "unknown", evidence: [] }];
    raw.questions = [{ question: `What pull force is required? ${secret}`, decision_it_changes: `Which gripper to investigate; ${secret}` }];
    const result = project(raw), text = JSON.stringify(result);
    expect(text).not.toMatch(/private\.invalid|gs:\/\/|fixture-secret|video:private-fixture|a{64}|owner@example\.invalid/);
    expect(text).toContain("What pull force is required?");
    expect(text).toContain("Which gripper to investigate");
  });
  it("does not expose an asserted completed or scheduled pilot as the proposed next action", () => {
    const raw = assessment(); raw.next_action.kind = "robot_trial"; raw.next_action.action = "The pilot is already scheduled and the reconstruction is completed.";
    const result = project(raw);
    expect(result.nextAction).not.toContain("already scheduled");
    expect(result.nextAction).not.toContain("reconstruction is completed");
    expect(result.nextAction).toContain("Consider a bounded physical trial");
  });
  it.each(["We booked your pilot for October12.", "The pilot is confirmed for next week.", "Use Robot X because it can safely lift250kg."])("quarantines declarative commitment or capability prose: %s", action => {
    const raw = assessment(); raw.job = []; raw.next_action = { kind: "robot_trial", action, why: { text: "Fit is unknown", basis: "unknown", evidence: [] } };
    const input = packet(raw); input.sources = [];
    const result = projectCustomerSiteAdvisory(input, "bp-advisory-test", 30);
    expect(result.nextAction).not.toContain(action);
    expect(result.nextAction).toContain("Consider a bounded physical trial");
  });
  it("keeps a concrete bounded trial plan as a proposal rather than an execution receipt", () => {
    const raw = assessment(); raw.next_action.kind = "robot_trial"; raw.next_action.action = "Plan a bounded upper-rack opening trial with a measured pull-force limit.";
    expect(project(raw).nextAction).toContain(raw.next_action.action);
  });
  it("quarantines raw capability estimates and reasons, keeping the genuine missing fact", () => {
    const raw = assessment();
    raw.missing = [{ text: "Robot X can safely lift250kg", basis: "estimate", evidence: [] }, { text: "Required production rate remains unknown", basis: "unknown", evidence: [] }];
    raw.next_action.why = { text: "Robot X can safely lift250kg", basis: "unknown", evidence: [] };
    const text = JSON.stringify(project(raw));
    expect(text).not.toContain("lift250kg");
    expect(text).toContain("Required production rate remains unknown");
  });
  it("does not launder assertion clauses through questions or decision consequences", () => {
    const raw = assessment(); raw.questions = [
      { question: "Since Robot X can safely lift250kg, what should we do?", decision_it_changes: "Whether to book the pilot" },
      { question: "Which rack handle must be operated?", decision_it_changes: "Robot X can safely lift250kg so the pilot is confirmed" },
    ];
    const text = JSON.stringify(project(raw));
    expect(text).not.toContain("lift250kg");
    expect(text).not.toContain("pilot is confirmed");
    expect(text).toContain("Which rack handle must be operated?");
  });
  it("normalizes harmless line breaks and missing question punctuation", () => {
    const raw = assessment(); raw.next_action.action = "Measure\n the pull force at the upper rack's handle.";
    raw.questions = [{ question: "How many rack operations\n are required per hour", decision_it_changes: "Whether assisted operation would meet the requirement" }];
    const result = project(raw);
    expect(result.nextAction).toContain("Measure the pull force at the upper rack's handle.");
    expect(result.unknowns.join(" ")).toContain("How many rack operations are required per hour?");
  });
  it.each([
    ["What load is required and Robot X can lift 250 kg?", "Robot X can lift 250 kg"],
    ["What sequence is required and the pilot will start tomorrow?", "the pilot will start tomorrow"],
    ["What pull force is required and the force is 20 N?", "the force is 20 N"],
    ["What sequence is required and the pilot is tomorrow?", "the pilot is tomorrow"],
    ["What load is required but Robot X could lift 250 kg?", "Robot X could lift 250 kg"],
    ["What sequence is required or the pilot would start tomorrow?", "the pilot would start tomorrow"],
    ["What load is required and Robot X lifts 250 kg?", "Robot X lifts 250 kg"],
    ["What sequence is required and the pilot starts tomorrow?", "the pilot starts tomorrow"],
    ["What load and Robot X lifts 250 kg should be tested?", "Robot X lifts 250 kg"],
    ["What handles and the pilot starts tomorrow need inspection?", "the pilot starts tomorrow"],
    ["What rack load Robot X can lift must be tested?", "Robot X can lift"],
    ["What sequence the pilot will complete must be tested?", "the pilot will complete"],
    ["What load is required Robot X is available?", "Robot X is available"],
  ])("rejects embedded or coordinated declarative assertions while preserving a safe sibling: %s", (question, forbidden) => {
    const raw = assessment(); raw.questions = [
      { question, decision_it_changes: "Which test requirement to clarify" },
      { question: "Which rack handle must be operated?", decision_it_changes: "Which contact point to investigate" },
    ];
    const input = packet(raw), original = structuredClone(input);
    const result = projectCustomerSiteAdvisory(input, "bp-advisory-test", 30), text = result.unknowns.join(" ");
    expect(text).not.toContain(forbidden);
    expect(text).toContain("Which rack handle must be operated?");
    expect(result.sections).toEqual([]);
    expect(input).toEqual(original);
  });
  it.each([
    "What load is required and how many operations are needed?",
    "What handles and rack endpoints need inspection?",
    "What exact sequence and final state should the test achieve?",
    "How many rack operations must finish each hour?",
  ])("retains supported direct questions, repeated interrogatives and noun lists: %s", question => {
    const raw = assessment(); raw.questions = [{ question, decision_it_changes: "Which requirement to clarify" }];
    expect(project(raw).unknowns.join(" ")).toContain(question);
  });
  it("leaves the original private packet intact and does not add API fields", () => {
    const raw = assessment(); raw.missing = [observed()];
    const input = packet(raw), original = structuredClone(input);
    const result = projectCustomerSiteAdvisory(input, "bp-advisory-test", 30);
    expect(JSON.stringify(result)).not.toContain("The upper rack slides outward");
    expect(result.unknowns.join(" ")).toContain("Some job facts and interpretations remain unresolved");
    expect(input).toEqual(original);
    expect(Object.keys(result).sort()).toEqual(["schemaVersion", "state", "correlationId", "sections", "unknowns", "nextAction"].sort());
  });
});
