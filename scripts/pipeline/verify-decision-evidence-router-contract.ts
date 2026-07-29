import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  DECISION_ENVELOPE_SCHEMA_VERSION,
  DECISION_EVIDENCE_REQUEST_SCHEMA_VERSION,
  DECISION_EVIDENCE_ROUTING_AUTHORITY,
  DECISION_EVIDENCE_RUN_STATES,
} from "../../server/utils/decisionEvidenceContract";

type ContractManifest = {
  authority?: unknown;
  schema_versions?: Record<string, unknown>;
  run_states?: unknown;
  decision_outcomes?: unknown;
  claim_outcomes?: unknown;
  evidence_classes?: unknown;
  request_required_fields?: unknown;
  result_required_fields?: unknown;
  invariants?: Record<string, unknown>;
};

const root = process.cwd();
const localPath = path.resolve(
  root,
  "contracts/pipeline/decision-evidence-router.v1.json",
);
const defaultPipelinePaths = [
  path.resolve(
    root,
    "../BlueprintCapturePipeline-decision-evidence-router-20260729/contracts/decision_evidence_router/decision-evidence-router.v1.json",
  ),
  path.resolve(
    root,
    "../BlueprintCapturePipeline/contracts/decision_evidence_router/decision-evidence-router.v1.json",
  ),
];
const explicitPipelinePath = String(
  process.env.PIPELINE_DECISION_EVIDENCE_CONTRACT_PATH || "",
).trim();
const requirePipeline = process.argv.includes("--require-pipeline");

function readManifest(filePath: string): ContractManifest {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as ContractManifest;
}

function stable(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stable).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stable(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: unknown) {
  return createHash("sha256").update(stable(value)).digest("hex");
}

function parityProjection(manifest: ContractManifest) {
  return {
    authority: manifest.authority,
    schema_versions: manifest.schema_versions,
    run_states: manifest.run_states,
    decision_outcomes: manifest.decision_outcomes,
    claim_outcomes: manifest.claim_outcomes,
    evidence_classes: manifest.evidence_classes,
    request_required_fields: manifest.request_required_fields,
    result_required_fields: manifest.result_required_fields,
    invariants: manifest.invariants,
  };
}

const local = readManifest(localPath);
const blockers: string[] = [];
if (local.authority !== DECISION_EVIDENCE_ROUTING_AUTHORITY) {
  blockers.push("local contract authority must be BlueprintCapturePipeline");
}
if (
  local.schema_versions?.decision_evidence_request !==
  DECISION_EVIDENCE_REQUEST_SCHEMA_VERSION
) {
  blockers.push("local request schema version does not match the runtime validator");
}
if (
  local.schema_versions?.decision_envelope !== DECISION_ENVELOPE_SCHEMA_VERSION
) {
  blockers.push("local decision envelope version does not match the runtime validator");
}
if (
  stable(local.run_states) !== stable([...DECISION_EVIDENCE_RUN_STATES])
) {
  blockers.push("local run states do not match the runtime state machine");
}

const pipelinePath = explicitPipelinePath
  ? path.resolve(explicitPipelinePath)
  : defaultPipelinePaths.find((candidate) => fs.existsSync(candidate)) || null;
let pipeline: ContractManifest | null = null;
let parityMatches: boolean | null = null;
if (pipelinePath && fs.existsSync(pipelinePath)) {
  pipeline = readManifest(pipelinePath);
  parityMatches =
    sha256(parityProjection(local)) === sha256(parityProjection(pipeline));
  if (!parityMatches) {
    blockers.push("WebApp mirror does not match the Pipeline contract parity projection");
  }
} else if (requirePipeline) {
  blockers.push("Pipeline Decision/Evidence Router contract is not checked in");
}

const report = {
  schema_version: "blueprint.webapp.decision_evidence_contract_parity.v1",
  status:
    blockers.length > 0
      ? "blocked"
      : pipeline
        ? "passed_against_pipeline"
        : "proposed_dependency_unmerged",
  local_contract_source: localPath,
  local_parity_sha256: sha256(parityProjection(local)),
  pipeline_contract_source: pipelinePath,
  pipeline_parity_sha256: pipeline
    ? sha256(parityProjection(pipeline))
    : null,
  pipeline_parity_matches: parityMatches,
  live_cross_repo_compatibility_proven: Boolean(pipeline && parityMatches),
  blockers,
};

console.log(JSON.stringify(report, null, 2));
if (blockers.length > 0) {
  process.exitCode = 1;
}
