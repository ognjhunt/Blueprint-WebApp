import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/**
 * The site-task measurement catalog is rendered by the Pipeline's
 * fidelity-profile templates and mirrored here byte for byte. A test pins the
 * TypeScript catalog to this mirror; this script pins the mirror to the
 * Pipeline file when a sibling checkout is present.
 */
const root = process.cwd();
const localPath = path.resolve(root, "contracts/pipeline/site-task-measurement-catalog.v1.json");
const defaultPipelinePaths = [
  path.resolve(root, "../BlueprintCapturePipeline/docs/schemas/site_task_measurement_catalog.v1.json"),
];
const explicitPipelinePath = String(process.env.PIPELINE_SITE_TASK_MEASUREMENT_CATALOG_PATH || "").trim();
const requirePipeline = process.argv.includes("--require-pipeline");

function digest(filePath: string) {
  return createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

const blockers: string[] = [];
const localSha256 = digest(localPath);
const pipelinePath = explicitPipelinePath
  ? path.resolve(explicitPipelinePath)
  : defaultPipelinePaths.find((candidate) => fs.existsSync(candidate)) || null;
const pipelineSha256 = pipelinePath && fs.existsSync(pipelinePath) ? digest(pipelinePath) : null;

if (pipelineSha256 && pipelineSha256 !== localSha256) {
  blockers.push("WebApp site-task measurement catalog mirror does not exactly match Pipeline");
} else if (!pipelineSha256 && requirePipeline) {
  blockers.push("Pipeline site-task measurement catalog is not checked in");
}

const report = {
  schema_version: "blueprint.webapp.site_task_measurement_catalog_parity.v1",
  status: blockers.length ? "blocked" : pipelineSha256 ? "passed_against_pipeline" : "proposed_dependency_unmerged",
  local_contract_source: localPath,
  local_sha256: localSha256,
  pipeline_contract_source: pipelinePath,
  pipeline_sha256: pipelineSha256,
  exact_bytes_match: pipelineSha256 ? pipelineSha256 === localSha256 : null,
  blockers,
};

console.log(JSON.stringify(report, null, 2));
if (blockers.length) process.exitCode = 1;
