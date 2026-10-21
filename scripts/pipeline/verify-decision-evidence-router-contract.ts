/** Verify the actual byte-bound Pipeline handoff; legacy public-reader schemas remain versioned separately. */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { jobDecisionEnvelopeSchema } from "../../server/utils/jobEvidenceContract";

const root = path.resolve("contracts/pipeline/decision-evidence-router.v1");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "artifact-manifest.json"), "utf8"));
const blockers: string[] = [];
if (manifest.schema_version !== "decision_evidence_webapp_handoff_manifest.v1") blockers.push("manifest_schema_mismatch");
const expected = new Set<string>();
for (const entry of manifest.artifacts) {
  expected.add(entry.path);
  const file = path.join(root, entry.path);
  if (!fs.existsSync(file) || createHash("sha256").update(fs.readFileSync(file)).digest("hex") !== entry.sha256) blockers.push(`artifact_digest_mismatch:${entry.path}`);
}
for (const file of fs.readdirSync(root)) if (file !== "artifact-manifest.json" && !expected.has(file)) blockers.push(`unexpected_artifact:${file}`);
const examples = JSON.parse(fs.readFileSync(path.join(root, "examples.json"), "utf8"));
for (const [name, example] of Object.entries(examples.examples)) if (!jobDecisionEnvelopeSchema.safeParse(example).success) blockers.push(`native_result_reader_mismatch:${name}`);
const explicit = process.env.PIPELINE_DECISION_EVIDENCE_CONTRACT_PATH;
const source = explicit || [path.resolve("../pipeline/docs/webapp_handoff/decision-evidence-router.v1"),
  path.resolve("../BlueprintCapturePipeline/docs/webapp_handoff/decision-evidence-router.v1")].find(fs.existsSync);
if (source) {
  for (const file of ["artifact-manifest.json", ...expected]) if (!fs.existsSync(path.join(source, file))
    || !fs.readFileSync(path.join(source, file)).equals(fs.readFileSync(path.join(root, file)))) blockers.push(`pipeline_source_mismatch:${file}`);
} else if (process.argv.includes("--require-pipeline")) blockers.push("pipeline_source_unavailable");
console.log(JSON.stringify({ schema_version: "decision_evidence_webapp_handoff_verification.v1", status: blockers.length ? "failed" : "passed",
  artifact_count: expected.size, pipeline_source_compared: Boolean(source), blockers,
  scientific_verdict_recomputed_by_webapp: false, deployed_compatibility_proven: false }, null, 2));
if (blockers.length) process.exitCode = 1;
