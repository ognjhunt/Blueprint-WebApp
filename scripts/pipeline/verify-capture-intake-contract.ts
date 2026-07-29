import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const localPath = path.resolve(
  root,
  "contracts/pipeline/capture-intake-envelope.v1.schema.json",
);
const defaultPipelinePaths = [
  path.resolve(
    root,
    "../BlueprintCapturePipeline-design-partner-beta-20260729/docs/schemas/capture_intake_envelope.schema.json",
  ),
  path.resolve(
    root,
    "../BlueprintCapturePipeline/docs/schemas/capture_intake_envelope.schema.json",
  ),
];
const explicitPipelinePath = String(
  process.env.PIPELINE_CAPTURE_INTAKE_CONTRACT_PATH || "",
).trim();
const requirePipeline = process.argv.includes("--require-pipeline");

function digest(filePath: string) {
  return createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

const blockers: string[] = [];
const localSha256 = digest(localPath);
const pipelinePath = explicitPipelinePath
  ? path.resolve(explicitPipelinePath)
  : defaultPipelinePaths.find((candidate) => fs.existsSync(candidate)) || null;
const pipelineSha256 = pipelinePath && fs.existsSync(pipelinePath)
  ? digest(pipelinePath)
  : null;

if (pipelineSha256 && pipelineSha256 !== localSha256) {
  blockers.push("WebApp Capture Intake Envelope mirror does not exactly match Pipeline");
} else if (!pipelineSha256 && requirePipeline) {
  blockers.push("Pipeline Capture Intake Envelope schema is not checked in");
}

const report = {
  schema_version: "blueprint.webapp.capture_intake_contract_parity.v1",
  status: blockers.length
    ? "blocked"
    : pipelineSha256
      ? "passed_against_pipeline"
      : "proposed_dependency_unmerged",
  local_contract_source: localPath,
  local_sha256: localSha256,
  pipeline_contract_source: pipelinePath,
  pipeline_sha256: pipelineSha256,
  exact_bytes_match: pipelineSha256 ? pipelineSha256 === localSha256 : null,
  live_cross_repo_compatibility_proven: Boolean(
    pipelineSha256 && pipelineSha256 === localSha256,
  ),
  blockers,
};

console.log(JSON.stringify(report, null, 2));
if (blockers.length) process.exitCode = 1;
