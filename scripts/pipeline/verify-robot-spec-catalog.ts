import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/**
 * The robot spec catalog (published figures for every robot model the site's
 * answer checks) is kept by the Pipeline and mirrored here byte for byte. This
 * script pins the mirror to the Pipeline file when a sibling checkout is present.
 */
const root = process.cwd();
const localPath = path.resolve(root, "contracts/pipeline/robot-spec-catalog.v1.json");
const defaultPipelinePaths = [
  path.resolve(root, "../BlueprintCapturePipeline/src/blueprint_pipeline/_catalog_data/robot_spec_catalog.v1.json"),
];
const explicitPipelinePath = String(process.env.PIPELINE_ROBOT_SPEC_CATALOG_PATH || "").trim();
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
  blockers.push("WebApp robot spec catalog mirror does not exactly match Pipeline");
} else if (!pipelineSha256 && requirePipeline) {
  blockers.push("Pipeline robot spec catalog is not checked in");
}

const report = {
  schema_version: "blueprint.webapp.robot_spec_catalog_parity.v1",
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
