// @vitest-environment node
import { describe, expect, it } from "vitest";
import { validateAssessmentEvidence, type SiteAssessment } from "../agents/site-assessment";

// Synthetic applicability controls. No model, video, DB or customer publication.
const sourceId = "knowledge:synthetic-superseded-spec";
const source = (current?: unknown) => ({ source_id: sourceId, kind: "knowledge" as const,
  canonical_ref: "synthetic/specification", sha256: "c".repeat(64), checked_at: "2020-01-01",
  content: { ...(current === undefined ? {} : { current }), original_checked_at: "2020-01-01",
    content: { reachM: 2, correction: "Superseded: current model reach is 1 m" } } });
const claim = (basis: "published" | "unknown" | "estimate" = "published") => ({ text: "The robot currently has a 2 m reach",
  basis, evidence: [{ source_id: sourceId, at_seconds: null }] });
const packet = (): SiteAssessment => ({ status: "assessment", job: [], objects_motions_conditions_variations: [], operator_success: [],
  known: [], estimates: [], missing: [], approaches: [], questions: [],
  next_action: { kind: "research", action: "Obtain the current specification", why: { text: "Current applicability is unknown", basis: "unknown", evidence: [] } } });
const placements = ["job", "objects_motions_conditions_variations", "operator_success", "known", "estimates", "missing", "approach_reason", "next_action_why"] as const;
function place(location: typeof placements[number], basis: "published" | "unknown" | "estimate" = "published") {
  const value = packet();
  if (location === "approach_reason") value.approaches = [{ approach: "Direct reach", disposition: "needs_evidence", reasons: [claim(basis)], remaining_checks: ["Obtain current reach"] }];
  else if (location === "next_action_why") value.next_action.why = claim(basis);
  else value[location] = [claim(basis)];
  return value;
}

describe("published-source applicability at every factual placement", () => {
  it.each(placements)("rejects explicit non-current published source in %s while retaining raw bytes", location => {
    const value = place(location), row = source(false), original = structuredClone({ value, row });
    const code = location === "known" ? "assessment_known_published_source_not_current" : "assessment_published_source_not_current";
    expect(() => validateAssessmentEvidence(value, new Map([[sourceId, row]]), null)).toThrow(code);
    expect({ value, row }).toEqual(original);
  });
  it.each([true, undefined, null, "false"])("does not derive an applicability veto from %s or source age", current => {
    for (const location of placements) expect(() => validateAssessmentEvidence(place(location), new Map([[sourceId, source(current)]]), null)).not.toThrow();
  });
  it.each(["unknown", "estimate"] as const)("keeps superseded metadata available under %s at every placement", basis => {
    const row = source(false), original = structuredClone(row);
    for (const location of placements) expect(() => validateAssessmentEvidence(place(location, basis), new Map([[sourceId, row]]), null)).not.toThrow();
    expect(row).toEqual(original);
  });
  it("accepts a current source beside historical unknown context without modifying either", () => {
    const current = { ...source(true), source_id: "knowledge:synthetic-current-spec", content: { current: true, content: { reachM: 1 } } };
    const prior = source(false), value = packet();
    value.job = [{ text: "The current synthetic record states a 1 m reach", basis: "published", evidence: [{ source_id: current.source_id, at_seconds: null }] }];
    value.missing = [{ text: "The older 2 m record is superseded; its historical use remains inspectable", basis: "unknown", evidence: [{ source_id: sourceId, at_seconds: null }] }];
    const original = structuredClone({ current, prior, value });
    expect(() => validateAssessmentEvidence(value, new Map<string, Parameters<typeof validateAssessmentEvidence>[1] extends ReadonlyMap<string, infer T> ? T : never>([[current.source_id, current], [sourceId, prior]]), null)).not.toThrow();
    expect({ current, prior, value }).toEqual(original);
  });
});
