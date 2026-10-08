// @vitest-environment node
import { afterAll, describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { validateAssessmentEvidence, type SiteAssessment } from "../agents/site-assessment";
import { makeJudgmentMutations } from "./fixtures/site-assessment-mutations";
const codeSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const diffHash = createHash("sha256").update(execFileSync("git", ["diff", "--", "server/agents/site-assessment.ts"])).digest("hex");
const allCases = makeJudgmentMutations(codeSha);
const cases = process.env.RELIABILITY_C_SPLIT ? allCases.filter(c => c.split === process.env.RELIABILITY_C_SPLIT) : allCases;
const results: Array<Record<string, unknown>> = [];

afterAll(() => {
  if (process.env.RELIABILITY_C_OUTPUT) writeFileSync(`${process.env.RELIABILITY_C_OUTPUT}/${process.env.RELIABILITY_C_RUN ?? "results"}.json`, JSON.stringify({
    layer: "production_evidence_validator", providerMode: "no_provider", codeSha, worktreeDiffHash: diffHash,
    promptVersion: "site_assessment.v1", labelVersion: "judgment-rubric.v1", generated: allCases.length,
    deduplicated: new Set(allCases.map(c => c.semanticHash)).size, attempted: new Set(results.map(r => r.caseId)).size,
    passed: new Set(results.filter(r => r.status === "passed").map(r => r.caseId)).size,
    failed: new Set(results.filter(r => r.status === "failed").map(r => r.caseId)).size,
    partial: new Set(results.filter(r => r.status === "partial").map(r => r.caseId)).size,
    skipped: 0, blocked: 0, invocationCount: results.length, liveProviderCalls: 0, knownCostUsd: 0,
    scoredAccuracySamples: 0, actualInputUnique: new Set(results.map(r => r.actualInputHash)).size, results,
  }, null, 2) + "\n");
});

describe("synthetic semantic mutation replay (structural evidence admission only)", () => {
  it.each(cases)("$caseId", c => {
    const p = c.parameters;
    let observations = [{ category: "motion", finding: p.visible, basis: p.sourceBasis,
      start_seconds: p.start, end_seconds: p.end, uncertainty: p.sourceBasis === "observed" ? null : "Occluded or inferred; event not established" }];
    if (c.family === "reordered_evidence") observations = c.structuralExpectation === "accept"
      ? [{ ...observations[0], start_seconds: p.end + 1, end_seconds: p.end + 2 }, ...observations]
      : [{ ...observations[0], start_seconds: p.end, end_seconds: p.start }];
    // Contexts alter evidence, rather than adding IDs or counting mere retries.
    if (p.context === "partial cycle before occlusion") observations[0].uncertainty = "Only the start is visible; completion is occluded";
    if (p.context === "recovery after initially undone result") observations.push(
      { category: "motion", finding: `${p.object} returns to its initial position; apparent result is undone`, basis: "observed", start_seconds: p.end + 1, end_seconds: p.end + 2, uncertainty: null },
      { category: "motion", finding: `${p.object} is moved again after a manual recovery`, basis: "observed", start_seconds: p.end + 3, end_seconds: p.end + 4, uncertainty: null });
    const content = { evidence: { summary: p.context, observations,
      not_observable: [p.absent, `${p.constraint} measurement`, ...(p.context === "partial cycle before occlusion" ? ["Full cycle completion"] : [])] } };
    const source = { source_id: c.sourceId, kind: c.family === "unsupported_robot_capability" ? "operator" as const
      : c.family === "stale_specifications" ? "knowledge" as const : "video" as const,
      canonical_ref: `synthetic/${c.sourceId}`, sha256: "b".repeat(64), checked_at: c.family === "stale_specifications" ? "2020-01-01" : null,
      content: c.family === "stale_specifications" ? { current: false, original_checked_at: "2020-01-01", corrections: [`The ${p.constraint} claim is superseded`], content: { spec: p.value } }
        : c.family === "unsupported_robot_capability" ? `Owner: I guess this robot achieves ${p.value}` : content };
    const text = c.family === "unsupported_dimensions" ? `${p.object} ${p.constraint} is measured at ${p.value}`
      : c.family === "unsupported_robot_capability" ? `Published robot ${p.constraint} is ${p.value}`
      : c.family === "citation_non_entailment" || c.family === "absent_action" ? p.absent
      : c.family === "conflicting_statements" ? `Owner says ${p.absent}; specification requires a different result; video proves success`
      : c.family === "stale_specifications" ? `Current robot ${p.constraint} is ${p.value}` : p.visible;
    const assessment: SiteAssessment = { status: "assessment", job: [{ text, basis: p.assertedBasis as SiteAssessment["job"][number]["basis"],
      evidence: [{ source_id: source.source_id, at_seconds: p.citationSeconds }] }],
      objects_motions_conditions_variations: [], operator_success: [], known: [], estimates: [], missing: [], approaches: [],
      next_action: { kind: "research", action: "Resolve missing evidence", why: { text: "Decision remains uncertain", basis: "unknown", evidence: [] } }, questions: [] };
    const sourceMap = new Map<string, Parameters<typeof validateAssessmentEvidence>[1] extends ReadonlyMap<string, infer T> ? T : never>([[source.source_id, source]]);
    if (c.family === "conflicting_statements") {
      sourceMap.set("operator:conflict", { ...source, source_id: "operator:conflict", kind: "operator", content: `Owner says ${p.absent}` });
      sourceMap.set("knowledge:conflict", { ...source, source_id: "knowledge:conflict", kind: "knowledge", content: { current: true, specification: `Required outcome is ${p.absent}; ${p.visible} is insufficient` } });
    }
    const actualInputHash = createHash("sha256").update(JSON.stringify({ sources: [...sourceMap.values()].map(row => ({ kind: row.kind, content: row.content, checked_at: row.checked_at })),
      assessment: { ...assessment, job: assessment.job.map(claim => ({ ...claim, evidence: claim.evidence.map(ref => ({ ...ref, source_id: "primary" })) })) }, expectedRelationship: p.expectedRelationship })).digest("hex");
    for (let repeat = 1; repeat <= c.repeats; repeat++) {
      const start = performance.now();
      let error: string | null = null;
      try { validateAssessmentEvidence(assessment, sourceMap, 60); }
      catch (e) { error = e instanceof Error ? e.message : "non_error_throw"; }
      const actual = error ? "reject" : "accept";
      const status = c.semanticOnly ? "partial" : actual === c.structuralExpectation ? "passed" : "failed";
      results.push({ caseId: c.caseId, semanticHash: c.semanticHash, actualInputHash, sourceId: c.sourceId, split: c.split,
        status, attempted: true, repeat, latencyMs: performance.now() - start, actual, error,
        expectedRelationship: p.expectedRelationship, structuralExpectation: c.structuralExpectation,
        interpretation: c.semanticOnly ? "Actual guard executed; sentence truth/entailment/contradiction/capability not adjudicated. No accuracy denominator." : "Synthetic provenance contract regression; no video perception measured",
        layer: c.layer, providerMode: c.providerMode, usage: { providerCalls: 0, costUsd: 0 } });
      if (!c.semanticOnly) expect(actual).toBe(c.structuralExpectation);
    }
  });
});
