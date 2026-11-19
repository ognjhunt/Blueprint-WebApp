import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/**
 * The per-job spending cap (owner decision 2026-11-19, "One cap at $40") has one
 * source, the Pipeline's `config/website_job_spend_cap.v1.json`, mirrored here
 * byte for byte. A test pins `websiteJobCeiling.ts` to this mirror; this script
 * pins the mirror to the Pipeline file when a sibling checkout is present.
 */
const root = process.cwd();
const localPath = path.resolve(root, "contracts/pipeline/website-job-spend-cap.v1.json");
const defaultPipelinePaths = [path.resolve(root, "../BlueprintCapturePipeline/config/website_job_spend_cap.v1.json")];
const explicitPipelinePath = String(process.env.PIPELINE_WEBSITE_JOB_SPEND_CAP_PATH || "").trim();
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
  blockers.push("WebApp website job spend cap mirror does not exactly match Pipeline");
} else if (!pipelineSha256 && requirePipeline) {
  blockers.push("Pipeline website job spend cap is not checked in");
}

console.log(JSON.stringify({
  schema_version: "blueprint.webapp.website_job_spend_cap_parity.v1",
  status: blockers.length ? "blocked" : pipelineSha256 ? "passed_against_pipeline" : "proposed_dependency_unmerged",
  local_contract_source: localPath, local_sha256: localSha256,
  pipeline_contract_source: pipelinePath, pipeline_sha256: pipelineSha256,
  exact_bytes_match: pipelineSha256 ? pipelineSha256 === localSha256 : null, blockers,
}, null, 2));
if (blockers.length) process.exitCode = 1;
