// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("../../client/src/lib/firebaseAdmin", () => ({ default: {}, dbAdmin: null, storageAdmin: null }));
import { projectCustomerSiteAdvisory } from "../utils/siteAssessmentPublic";
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
