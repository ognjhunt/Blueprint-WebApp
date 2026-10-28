// @vitest-environment node
import { expect, it } from "vitest";
import { renderSourceBoundAssessment, validateAssessmentEvidence } from "../agents/site-assessment";
import { recoverSiteAssessmentPostprocessing } from "../agents/site-assessment-postprocessing";
import { failedDescriptionAssessment } from "./fixtures/site-assessment-postprocessing";

it("quarantines only the selected unqualified registry description and preserves exact raw evidence", () => {
  const fixture = failedDescriptionAssessment(), before = structuredClone(fixture);
  const sources = new Map(fixture.sources.map(s => [s.source_id, s])) as any;
  expect(() => validateAssessmentEvidence(fixture.raw, sources, 2)).toThrow("assessment_registry_source_basis_required");
  const result = renderSourceBoundAssessment(fixture.raw, sources, 2);
  expect(result.verification).toMatchObject({ source_bound_claims: 1, unverified_claims: 0, unqualified_registry_context_claims: 1 });
  expect(result.assessment.known[0]).toMatchObject({ basis: "unknown", verification_status: "interpretation" });
  expect(result.assessment.known[0].text).toContain("deployment fit and reach are unknown");
  expect(result.assessment.known[0].text).not.toContain("Unsupported model interpretation");
  expect(result.assessment.approaches[0].disposition).toBe("needs_evidence");
  expect(fixture).toEqual(before);
});

it.each([null, "", [], {}, 3])("keeps malformed registry description %j refused", description => {
  const { raw, sources } = failedDescriptionAssessment();
  (sources[1].content as any).capabilityDescription = description;
  expect(() => renderSourceBoundAssessment(raw, new Map(sources.map(s => [s.source_id, s])) as any, 2))
    .toThrow("assessment_registry_source_basis_required");
});

it("never turns description context into a measured field or an exclusion", () => {
  const { raw, sources } = failedDescriptionAssessment(), map = new Map(sources.map(s => [s.source_id, s])) as any;
  raw.known[0].basis = "measured";
  expect(() => renderSourceBoundAssessment(raw, map, 2)).toThrow("assessment_registry_source_basis_required");
  raw.known[0].basis = "published";
  raw.approaches[0].disposition = "excluded"; raw.approaches[0].reasons = [raw.known[0]];
  expect(() => renderSourceBoundAssessment(raw, map, 2)).toThrow("assessment_exclusion_evidence_required");
});

it("recovers a completed retained answer without changing its usage or reservations", () => {
  const { run, binding } = failedDescriptionAssessment(), before = structuredClone(run);
  const result = recoverSiteAssessmentPostprocessing(run, binding)!;
  expect(result.packet.raw_model_assessment).toEqual(JSON.parse(run.artifacts.provider_responses[0].response.output[0].content[0].text));
  expect(result.recovery).toMatchObject({ previous_status: "failed", previous_error: "site_assessment_failed",
    provider_calls: 0, spending_reservations_created: 0 });
  expect(run).toEqual(before);
});

it.each(["cancelled", "running", "completed"])('never recovers a %s run', status => {
  const { run, binding } = failedDescriptionAssessment(); run.status = status;
  expect(recoverSiteAssessmentPostprocessing(run, binding)).toBeNull();
});

it.each(["source", "context", "usage", "incomplete", "error", "tool", "unknown_reference", "missing_video", "invalid_video", "quarantine"])
("holds %s ambiguity instead of inventing a completion", mode => {
  const { run, binding } = failedDescriptionAssessment(); const r: any = run;
  if (mode === "source") binding.source_key += "changed";
  if (mode === "context") binding.context_digest += "changed";
  if (mode === "usage") r.artifacts.provider_responses[0].cost_usd = null;
  if (mode === "incomplete") r.artifacts.provider_responses[0].response.status = "incomplete";
  if (mode === "error") r.error = "site_assessment_context_changed";
  if (mode === "tool") r.artifacts.provider_responses[0].response.output.push({ type: "function_call" });
  if (mode === "unknown_reference") r.artifacts.site_assessment_partial_evidence.sources[1].source_id = "unknown";
  if (mode === "missing_video") r.artifacts.site_assessment_partial_evidence.sources.shift();
  if (mode === "invalid_video") r.artifacts.site_assessment_partial_evidence.sources[0].content.evidence = null;
  if (mode === "quarantine") r.mutation_reconciliation_required = true;
  expect(recoverSiteAssessmentPostprocessing(run, binding)).toBeNull();
});

it("quarantines published supply-record fields as registry context, one accepted shape each", () => {
  const fixture = failedDescriptionAssessment(), registry = fixture.sources[1];
  Object.assign(registry.content as any, { status: "prospect", willing_supply: false,
    supply_agreements_missing: ["freeEvaluation", "pilotIfPassed"] });
  const cite = (field: string) => ({ text: `Claim from ${field}`, basis: "published", evidence: [{ source_id: registry.source_id,
    at_seconds: null, selector: { kind: "qualified_field", observation_index: null, field_path: [field] } }] });
  (fixture.raw as any).known = [cite("willing_supply"), cite("status"), cite("supply_agreements_missing")];
  const result = renderSourceBoundAssessment(fixture.raw, new Map(fixture.sources.map(s => [s.source_id, s])) as any, 2);
  expect(result.verification).toMatchObject({ unverified_claims: 0, unqualified_registry_context_claims: 3 });
  expect(result.assessment.known.map((claim: any) => [claim.basis, claim.verification_status]))
    .toEqual(Array(3).fill(["unknown", "interpretation"]));
  expect(result.assessment.known[0].text).toContain("Registry record willing_supply: false");
  expect(result.assessment.known[2].text).toContain("freeEvaluation, pilotIfPassed");
});

it.each([["willing_supply", "false"], ["status", " "], ["supply_agreements_missing", []],
  ["supply_agreements_missing", [3]], ["name", "Fixture team"]])("keeps a published %s citation of %j refused", (field, value) => {
  const fixture = failedDescriptionAssessment();
  (fixture.sources[1].content as any)[field] = value;
  (fixture.raw as any).known[0].evidence[0].selector.field_path = [field];
  expect(() => renderSourceBoundAssessment(fixture.raw, new Map(fixture.sources.map(s => [s.source_id, s])) as any, 2))
    .toThrow("assessment_registry_source_basis_required");
});

it("never turns a supply-record field into a measured claim", () => {
  const fixture = failedDescriptionAssessment();
  (fixture.sources[1].content as any).willing_supply = true;
  (fixture.raw as any).known[0].evidence[0].selector.field_path = ["willing_supply"];
  (fixture.raw as any).known[0].basis = "measured";
  expect(() => renderSourceBoundAssessment(fixture.raw, new Map(fixture.sources.map(s => [s.source_id, s])) as any, 2))
    .toThrow("assessment_registry_source_basis_required");
});
