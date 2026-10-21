import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const localPath = path.resolve(
  root,
  "contracts/pipeline/site-task-testbed-compilation-submission.v2.schema.json",
);
const defaultPipelinePaths = [
  path.resolve(
    root,
    "../BlueprintCapturePipeline-design-partner-beta-reconstruction-20260730/docs/schemas/site_task_testbed_compilation_submission.v2.schema.json",
  ),
  path.resolve(
    root,
    "../BlueprintCapturePipeline/docs/schemas/site_task_testbed_compilation_submission.v2.schema.json",
  ),
];
const explicitPipelinePath = String(
  process.env.PIPELINE_TESTBED_COMPILATION_CONTRACT_PATH || "",
).trim();
const requirePipeline = process.argv.includes("--require-pipeline");

function digest(filePath: string) {
  return createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

const blockers: string[] = [];
const versions = [2, 3].map(version => {
  const currentLocalPath = localPath.replace(".v2.", `.v${version}.`);
  const candidates = defaultPipelinePaths.map(candidate => candidate.replace(".v2.", `.v${version}.`));
  const pipelinePath = explicitPipelinePath
    ? path.resolve(explicitPipelinePath.replace(/\.v[23]\./, `.v${version}.`))
    : candidates.find(candidate => fs.existsSync(candidate)) || null;
  const localSha256 = digest(currentLocalPath);
  const pipelineSha256 = pipelinePath && fs.existsSync(pipelinePath) ? digest(pipelinePath) : null;
  if (pipelineSha256 && pipelineSha256 !== localSha256) blockers.push(`WebApp v${version} compilation schema differs from Pipeline`);
  else if (!pipelineSha256 && requirePipeline) blockers.push(`Pipeline v${version} compilation schema is absent`);
  return { version, local_contract_source: currentLocalPath, local_sha256: localSha256,
    pipeline_contract_source: pipelinePath, pipeline_sha256: pipelineSha256,
    exact_bytes_match: pipelineSha256 ? pipelineSha256 === localSha256 : null };
});
const matched = versions.every(row => row.exact_bytes_match === true);
console.log(JSON.stringify({
  schema_version: "blueprint.webapp.testbed_compilation_contract_parity.v1",
  status: blockers.length ? "blocked" : matched ? "passed_against_pipeline" : "proposed_dependency_unmerged",
  ...versions[0], versions,
  // Schema parity is software verification, not a live service execution.
  live_cross_repo_compatibility_proven: false,
  pipeline_owns_scientific_compilation_inputs: true,
  webapp_provider_selection_allowed: false,
  blockers,
}, null, 2));
if (blockers.length) process.exitCode = 1;
