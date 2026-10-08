import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical)
  : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)])) : value;
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
export const judgmentFamilies = ["ambiguous_occluded", "absent_action", "cropped_evidence", "reordered_evidence",
  "unsupported_dimensions", "unsupported_robot_capability", "conflicting_statements", "stale_specifications",
  "citation_non_entailment", "source_preserving_positive"] as const;
const profiles = [
  { task: "bin transfer", object: "bin", visible: "Bin moves onto table", absent: "Bin is stacked", constraint: "payload", value: "12 kg" },
  { task: "door operation", object: "door", visible: "Door opens", absent: "Door is latched", constraint: "force", value: "90 N" },
  { task: "rack operation", object: "rack", visible: "Rack slides outward", absent: "Rack is loaded", constraint: "reach", value: "1.3 m" },
  { task: "part placement", object: "part", visible: "Part touches fixture", absent: "Part is fully seated", constraint: "precision", value: "0.2 mm" },
];
export function makeJudgmentMutations(codeSha = "unrecorded") {
  return judgmentFamilies.flatMap(family => Array.from({ length: 12 }, (_, index) => {
    const profile = profiles[Math.floor(index / 3)];
    const context = ["clear single action", "partial cycle before occlusion", "recovery after initially undone result"][index % 3];
    const sourceId = `synthetic-v1-${profile.task.replaceAll(" ", "-")}-${context.replaceAll(" ", "-")}`;
    const split = BigInt(`0x${createHash("sha256").update(sourceId).digest("hex")}`) % BigInt(5) === BigInt(0) ? "holdout" : "development";
    const start = [0, 8, 16][index % 3], end = start + [2, 4, 6][index % 3];
    const semanticOnly = ["unsupported_dimensions", "conflicting_statements", "stale_specifications", "citation_non_entailment"].includes(family);
    const relationship = family === "source_preserving_positive" || family === "reordered_evidence" && index % 2 === 0 ? "invariant"
      : family === "conflicting_statements" ? "change" : family === "stale_specifications" ? "weaken" : "abstain";
    const requiredValue = [["12 kg", "24 kg", "36 kg"], ["90 N", "180 N", "270 N"], ["1.3 m", "1.8 m", "2.3 m"], ["0.2 mm", "0.5 mm", "1 mm"]][Math.floor(index / 3)][index % 3];
    const parameters = { ...profile, value: requiredValue, demandBand: ["low", "middle", "high"][index % 3], context, start, end, family,
      citationSeconds: ["unsupported_robot_capability", "stale_specifications"].includes(family) ? null : family === "cropped_evidence" ? end + 5 : start,
      evidenceMutation: family === "ambiguous_occluded" ? "visible event replaced by explicit not_visible/estimate finding"
        : family === "absent_action" ? "claimed action absent from all supplied observations"
        : family === "cropped_evidence" ? "claim retains old timestamp after observation interval is cropped"
        : family === "reordered_evidence" ? index % 2 === 0 ? "array reordered, timestamps unchanged" : "start/end reversed without reindexing"
        : family === "unsupported_dimensions" ? `video contains no metric calibration or measurement of ${profile.constraint}`
        : family === "unsupported_robot_capability" ? "owner speculation relabeled as published capability"
        : family === "conflicting_statements" ? "owner and specification disagree with the source observation"
        : family === "stale_specifications" ? "original specification marked corrected and non-current"
        : family === "citation_non_entailment" ? "real source and timestamp but claim describes a different event"
        : "claim and source basis and timestamp preserved", expectedRelationship: relationship,
      assertedBasis: family === "unsupported_dimensions" ? "measured" : ["unsupported_robot_capability", "stale_specifications"].includes(family) ? "published" : "observed",
      sourceBasis: family === "ambiguous_occluded" ? index % 2 === 0 ? "not_visible" : "estimate"
        : family === "absent_action" ? "not_visible" : "observed" };
    const structuralExpectation = semanticOnly ? "not_a_semantic_oracle"
      : relationship === "invariant" ? "accept" : "reject";
    const expectedTransitions = ["source admitted", "assessment factual claim validated", relationship];
    const semanticHash = hash({ kind: "judgment", family, parameters, expectedTransitions, sourceId, split });
    return { caseId: `J-${family}-${semanticHash.slice(0, 12)}`, kind: "judgment", family, parameters,
      expectedTransitions,
      assertions: semanticOnly ? ["retain uncertainty/contradiction; no accuracy score without supported truth label"] : [`production validator must ${structuralExpectation}`],
      layer: "production_evidence_validator", providerMode: "no_provider", sourceId, split,
      labelVersion: "judgment-rubric.v1", labelStatus: "PROVISIONAL", codeSha, promptVersion: "site_assessment.v1",
      semanticHash, structuralExpectation, semanticOnly,
      replayCommand: "RELIABILITY_C_OUTPUT=/workspace/reliability-program/C npx vitest run server/tests/site-assessment-mutations.test.ts",
      repeats: ["ambiguous_occluded", "absent_action", "unsupported_robot_capability", "unsupported_dimensions", "conflicting_statements", "citation_non_entailment"].includes(family) ? 3 : 1 };
  }));
}
if (process.argv.includes("--catalog")) {
  const codeSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const cases = makeJudgmentMutations(codeSha);
  const output = process.env.RELIABILITY_C_OUTPUT;
  if (!output) throw new Error("RELIABILITY_C_OUTPUT required");
  writeFileSync(`${output}/mutations.json`, JSON.stringify(cases, null, 2) + "\n");
  writeFileSync(`${output}/cases.json`, JSON.stringify(cases, null, 2) + "\n");
  console.log(JSON.stringify({ generated: cases.length, unique: new Set(cases.map(c => c.semanticHash)).size,
    sourceCount: new Set(cases.map(c => c.sourceId)).size,
    holdoutSourceCount: new Set(cases.filter(c => c.split === "holdout").map(c => c.sourceId)).size }));
}
