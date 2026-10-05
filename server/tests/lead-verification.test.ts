// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { evaluateLeadCohort, evaluateLeadVerification, LEAD_DIAGNOSTIC_RESULT_VERSION, LEAD_OUTREACH_RESULT_VERSION, leadIdentityKey, leadPacketCandidates,
  requireVerifiedLead } from "../agents/lead-verification";
import { verificationDigest } from "../agents/research-digest";
import { syntheticLeadVerification } from "./fixtures/lead-verification";

const now = Date.parse("2026-10-01T12:00:00Z");
const candidate = { candidate_key: "synthetic", organization: "Synthetic Operator", site: "Invented packing site",
  location: "10 Test Road, Test City", task: "packing" };
describe("evidence-bound lead verification (hermetic invented evidence)", () => {
  it("matches every Pipeline v2 diagnostic fixture, including lossless aliases and unknown expiry", () => {
    const cases = JSON.parse(readFileSync(new URL("./fixtures/lead-verification-diagnostics.json", import.meta.url), "utf8"));
    for (const item of cases) {
      const original = structuredClone(item.assessment);
      expect(evaluateLeadVerification(item.candidate, item.assessment, Date.parse(item.now)), item.name).toMatchObject(item.expected);
      expect(item.assessment).toEqual(original);
    }
  });

  it("matches Pipeline's retained cross-language digest/status fixture including Unicode and inert floats", () => {
    const fixture = JSON.parse(readFileSync(new URL("./fixtures/lead-verification.json", import.meta.url), "utf8"));
    expect(evaluateLeadVerification(fixture.candidate, fixture.assessment, Date.parse(fixture.now))).toMatchObject(fixture.expected);
    expect(verificationDigest({ "\ue000": 1, "𐀀": 0.5 })).toBe("ffd04b569cc3ceacad10bb3ec5e32d019e4fa4e46e2426be8debab3917e149e7");
  });
  it.each([2 ** 53, 1e20])("retains unresolved evidence for nonportable whole-valued numeric metadata %s", value => {
    const assessment: any = syntheticLeadVerification(candidate);
    assessment.provider_metadata = { original_numeric_value: value };
    const result = evaluateLeadVerification(candidate, assessment, now);
    expect(result).toMatchObject({ status: "unresolved", eligible_for_qualified_promotion: false, assessment_digest: null });
    expect(result.assessment).toBe(assessment);
    expect(result.reasons.join(" ")).toContain("retain large IDs as strings");
  });
  it("requires a source-linked current fact for operator, physical site, task and human workflow, while fit can be inference", () => {
    const assessment = syntheticLeadVerification(candidate);
    (assessment as any).retained_provider_metadata = { note: "Keep original harmless metadata and precision." };
    const result = evaluateLeadVerification(candidate, assessment, now);
    expect(result).toMatchObject({ status: "verified", eligible_for_qualified_promotion: true,
      assessment_present: true, assessment_valid: true, assessment_digest: verificationDigest(assessment) });
    expect(result.assessment).toBe(assessment);
    expect(result.separate_gates).toEqual(["buying_intent", "consent_rights", "commercial_qualification", "robot_compatibility", "deployment_readiness"]);
  });
  it("retains raw discovery with unresolved feedback when an assessment is absent", () => {
    const result = evaluateLeadVerification(candidate, null, now);
    expect(result).toMatchObject({ status: "unresolved", eligible_for_qualified_promotion: false, assessment_present: false });
    expect(result.reasons.join(" ")).toContain("perform source assessment");
    expect(() => requireVerifiedLead({ candidate, status: "verified" }, now)).toThrow("lead_verification_required");
  });
  it("rejects impossible calendar dates and preserves submillisecond check/assessment ordering", () => {
    const assessment = syntheticLeadVerification(candidate);
    assessment.assessed_at = "2026-02-31T12:00:00Z";
    expect(evaluateLeadVerification(candidate, assessment, now).status).toBe("unresolved");
    assessment.assessed_at = "2026-10-01T12:00:00.000001Z";
    expect(evaluateLeadVerification(candidate, assessment, now).status).toBe("unresolved");
    assessment.assessed_at = "2026-10-01T11:00:00.123000Z";
    assessment.sources[0].checked_at = "2026-10-01T11:00:00.123001Z";
    expect(evaluateLeadVerification(candidate, assessment, now).status).toBe("unresolved");
  });
  it.each(["operator", "physical_site", "site_task", "human_workflow"])("refuses inference as factual %s proof", field => {
    const assessment = syntheticLeadVerification(candidate);
    assessment.claims[field].status = "inference";
    expect(evaluateLeadVerification(candidate, assessment, now).status).toBe("unresolved");
  });
  it.each(["snippet", "unreachable", "vendor", "independent", "stale", "unknown", "historical", "future_check", "empty_quote", "no_freshness_reason", "no_publisher", "missing_reference"])("keeps %s support unresolved without fabricating rejection", issue => {
    const assessment: any = syntheticLeadVerification(candidate), source = assessment.sources[0];
    if (["snippet", "unreachable"].includes(issue)) source.retrieval = issue;
    if (["vendor", "independent"].includes(issue)) source.classification = issue;
    if (["stale", "unknown", "historical"].includes(issue)) source.freshness = issue;
    if (issue === "future_check") source.checked_at = "2026-10-02T00:00:00Z";
    if (issue === "empty_quote") source.quote = " ";
    if (issue === "no_freshness_reason") delete source.freshness_reason;
    if (issue === "no_publisher") delete source.publisher;
    if (issue === "missing_reference") assessment.claims.human_workflow.source_refs = ["unknown-source"];
    const result = evaluateLeadVerification(candidate, assessment, now);
    expect(result.status).toBe("unresolved");
    expect(result.assessment).toBe(assessment);
  });
  it.each(["changed_candidate", "expired", "future_assessment", "duplicate_source", "malformed_claim", "missing_counter_search"])("returns actionable repair feedback for %s", issue => {
    const assessment: any = syntheticLeadVerification(candidate);
    if (issue === "changed_candidate") assessment.candidate_digest = "a".repeat(64);
    if (issue === "expired") assessment.valid_until = "2026-10-01T12:00:00Z";
    if (issue === "future_assessment") assessment.assessed_at = "2026-10-01T13:00:00Z";
    if (issue === "duplicate_source") assessment.sources.push(structuredClone(assessment.sources[0]));
    if (issue === "malformed_claim") assessment.claims.site_task = { status: "verified_fact", reason: "" };
    if (issue === "missing_counter_search") assessment.counterevidence = { status: "checked", reason: "No evidence retained", searches: [], source_refs: [] };
    const result = evaluateLeadVerification(candidate, assessment, now);
    expect(result.status).toBe("unresolved");
    expect(result.reasons.length).toBeGreaterThan(0);
  });
  it("rejects only a retrieved supported contradiction and retains its reason", () => {
    const assessment = syntheticLeadVerification(candidate);
    assessment.claims.human_workflow = { status: "contradicted", reason: "Synthetic operator says this task is fully automated at this site.", source_refs: ["synthetic-operator"] };
    const result = evaluateLeadVerification(candidate, assessment, now);
    expect(result.status).toBe("rejected");
    expect(result.reasons.join(" ")).toContain("fully automated");
    assessment.sources[0].retrieval = "unreachable";
    expect(evaluateLeadVerification(candidate, assessment, now).status).toBe("unresolved");
  });
  it("requires contradiction searches and does not let vendor-only counterevidence reject a site", () => {
    const assessment = syntheticLeadVerification(candidate);
    assessment.counterevidence.status = "unresolved";
    expect(evaluateLeadVerification(candidate, assessment, now).status).toBe("unresolved");
    assessment.counterevidence.status = "contradicted";
    expect(evaluateLeadVerification(candidate, assessment, now).status).toBe("rejected");
    assessment.sources[0].classification = "vendor";
    expect(evaluateLeadVerification(candidate, assessment, now).status).toBe("unresolved");
  });
  it("deduplicates normalized operator/site/location/task while preserving distinct physical sites in one city", () => {
    expect(leadIdentityKey(candidate)).toBe(leadIdentityKey({ ...candidate, organization: "ＳＹＮＴＨＥＴＩＣ OPERATOR", site: "INVENTED packing SITE", location: "10 test road TEST CITY" }));
    expect(leadIdentityKey(candidate)).not.toBe(leadIdentityKey({ ...candidate, task: "sorting" }));
    expect(leadIdentityKey(candidate)).not.toBe(leadIdentityKey({ ...candidate, location: "20 Test Road" }));
    expect(leadIdentityKey(candidate)).not.toBe(leadIdentityKey({ ...candidate, site: "South plant, 20 Test Road" }));
    expect(leadIdentityKey({ ...candidate, site: "", location: "" })).toBeNull();
  });
  it("recomputes the entire raw cohort and refuses a verified duplicate with rejected counterevidence", () => {
    const alias = { ...candidate, candidate_key: "alias", site: "Alias label" };
    const a = syntheticLeadVerification(candidate), b = syntheticLeadVerification(alias);
    b.claims.human_workflow.status = "contradicted";
    const context = { candidates: [candidate, alias], assessments: { synthetic: a, alias: b }, duplicateChecks: { alias: { duplicate: true, duplicate_of: "synthetic", reason: "Invented exact physical-site alias linkage." } } };
    const results = evaluateLeadCohort(context.candidates, context.assessments, now, context.duplicateChecks);
    expect(results.every(result => result.status === "unresolved" && !result.eligible_for_qualified_promotion)).toBe(true);
    expect(results[1].duplicate_of).toBe("synthetic");
    expect(() => requireVerifiedLead({ candidate, leadVerification: a, leadVerificationCohort: context }, now)).toThrow("duplicate assessments conflict");
    b.claims.human_workflow.status = "verified_fact";
    expect(evaluateLeadCohort(context.candidates, context.assessments, now, context.duplicateChecks).map(result => result.eligible_for_qualified_promotion)).toEqual([true, false]);
  });
  it("retains preselection duplicates and lets an assessed original follow an earlier semantic alias", () => {
    const alias = { ...candidate, candidate_key: "alias", organization: "Synthetic Operator LLC", discovery_index: 0 };
    const original = { ...candidate, discovery_index: 1 };
    const packet = { verification_cohort_version: "blueprint.lead-verification.v1", candidates: [original], duplicates: [alias] };
    const rows = leadPacketCandidates(packet);
    expect(rows).toEqual([alias, original]);
    const assessments = { alias: syntheticLeadVerification(alias), synthetic: syntheticLeadVerification(original) };
    const checks = { alias: { duplicate: true, duplicate_of: "synthetic", reason: "Invented official alias linkage." } };
    const result = evaluateLeadCohort(rows, assessments, now, checks);
    expect(result.map(row => row.eligible_for_qualified_promotion)).toEqual([false, true]);
    expect(result[0]).toMatchObject({ duplicate_of: "synthetic", identity_key: result[1].identity_key });
    const unresolved = evaluateLeadCohort(rows, assessments, now, { alias: { ...checks.alias, duplicate_of: "missing" } });
    expect(unresolved[0].status).toBe("unresolved");
    const cyclic = evaluateLeadCohort(rows, assessments, now, { alias: checks.alias,
      synthetic: { duplicate: true, duplicate_of: "alias", reason: "Synthetic cyclic identity." } });
    expect(cyclic.every(row => !row.eligible_for_qualified_promotion)).toBe(true);
  });
});

describe("result-version pinning (independent review S7)", () => {
  it("re-verifies an unpinned historical row with the original v1 evaluator and a pinned row with v2", () => {
    const cases = JSON.parse(readFileSync(new URL("./fixtures/lead-verification-diagnostics.json", import.meta.url), "utf8"));
    const alias = cases.find((c: any) => c.name === "schema_alias");
    const now = Date.parse(alias.now);
    const source = (resultVersion?: string) => ({ candidate: alias.candidate, leadVerification: alias.assessment,
      leadVerificationCohort: { candidates: [alias.candidate], assessments: { [alias.candidate.candidate_key]: alias.assessment },
        duplicateChecks: {}, ...(resultVersion ? { resultVersion } : {}) } });
    // v1 (unpinned) never accepted the schema_version alias; v2 accepts it losslessly.
    expect(() => requireVerifiedLead(source(), now)).toThrow();
    expect(requireVerifiedLead(source(LEAD_DIAGNOSTIC_RESULT_VERSION), now).status).toBe("verified");
  });
  it("decides a v3-pinned (outreach-ready) row's verified status by the v2 rules and derives no tier", () => {
    const cases = JSON.parse(readFileSync(new URL("./fixtures/lead-verification-diagnostics.json", import.meta.url), "utf8"));
    for (const item of cases) {
      const v2 = evaluateLeadVerification(item.candidate, item.assessment, Date.parse(item.now), LEAD_DIAGNOSTIC_RESULT_VERSION);
      expect(evaluateLeadVerification(item.candidate, item.assessment, Date.parse(item.now), LEAD_OUTREACH_RESULT_VERSION), item.name).toEqual(v2);
    }
    const alias = cases.find((c: any) => c.name === "schema_alias"), aliasNow = Date.parse(alias.now);
    const verified = requireVerifiedLead({ candidate: alias.candidate, leadVerification: alias.assessment, leadVerificationCohort: {
      candidates: [alias.candidate], assessments: { [alias.candidate.candidate_key]: alias.assessment }, duplicateChecks: {},
      resultVersion: LEAD_OUTREACH_RESULT_VERSION } }, aliasNow);
    expect(verified).toMatchObject({ status: "verified", version: LEAD_DIAGNOSTIC_RESULT_VERSION });
    expect(verified).not.toHaveProperty("tier");
    // An outreach-ready candidate (manual workflow unresolved) is never a verified lead under the pin.
    const hypothesis = syntheticLeadVerification(candidate);
    hypothesis.claims.human_workflow = { status: "unresolved", reason: "Invented: manual work is not stated.", source_refs: [] };
    expect(evaluateLeadVerification(candidate, hypothesis, now, LEAD_OUTREACH_RESULT_VERSION))
      .toMatchObject({ status: "unresolved", eligible_for_qualified_promotion: false });
    expect(() => evaluateLeadVerification(candidate, hypothesis, now, "blueprint.lead-verification-result.v4"))
      .toThrow("lead verification result version unsupported");
  });
});
