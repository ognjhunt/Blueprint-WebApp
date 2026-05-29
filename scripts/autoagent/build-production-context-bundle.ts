import fs from "node:fs/promises";
import path from "node:path";

import {
  AUTOAGENT_BLOCKED_PRODUCTION_ACTION_TYPES,
  AUTOAGENT_INITIAL_LIVE_PRODUCTION_ACTION_TYPES,
  AUTOAGENT_NEXT_LIVE_PRODUCTION_ACTION_TYPES,
  AUTOAGENT_PRODUCTION_ACTION_DEFAULT_MODE,
  AUTOAGENT_PRODUCTION_ACTION_REGISTRY_PATH,
  AUTOAGENT_REGISTERED_LIVE_PRODUCTION_ACTION_TYPES,
} from "../../server/agents/autoagent-production-action-registry.ts";

export type ProductionContextBundle = {
  schema: "blueprint/autoagent-production-context-bundle/v1";
  generated_at: string;
  default_mode: typeof AUTOAGENT_PRODUCTION_ACTION_DEFAULT_MODE;
  production_action_registry_path: typeof AUTOAGENT_PRODUCTION_ACTION_REGISTRY_PATH;
  allowed_live_action_types: string[];
  registered_live_action_types: string[];
  proven_live_action_types: string[];
  first_live_lane_proof_path: string;
  first_live_lane_proven: boolean;
  blocked_action_types: string[];
  owner_system: "paperclip_hermes";
  target_record_id: "recursive-agent-improvement-loop";
  proof_source: "paperclip_issue_metadata_snapshot";
  proof_path: string;
  rollback_snapshot_path: string;
  candidate_path: string | null;
  constraints: string[];
};

export type BuildProductionContextBundleResult = {
  bundle: ProductionContextBundle;
  bundlePath: string;
  bundleMarkdownPath: string;
  proofPath: string;
  rollbackSnapshotPath: string;
};

export type BuildProductionContextBundleOptions = {
  cwd?: string;
  outputDir: string;
  candidatePath?: string | null;
  paperclipConfigPath?: string | null;
  writeArtifacts?: boolean;
  now?: Date;
};

async function writeJson(filePath: string, value: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function writeText(filePath: string, value: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, value.endsWith("\n") ? value : `${value}\n`, "utf8");
}

async function readJsonIfExists(filePath: string) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8")) as unknown;
  } catch {
    return null;
  }
}

function isFirstLiveLaneProven(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const record = value as {
    action?: { action_type?: unknown };
    execution?: {
      result?: unknown;
      live_mutation_committed?: unknown;
    };
  };
  return Boolean(
    record.action?.action_type === "paperclip_hermes_internal_metadata_update"
      && record.execution?.result === "canary_committed"
      && record.execution?.live_mutation_committed === true,
  );
}

function renderMarkdown(bundle: ProductionContextBundle) {
  const list = (items: string[]) =>
    items.length > 0 ? items.map((item) => `- ${item}`).join("\n") : "- none";

  return [
    "# AutoAgent Production Context Bundle",
    "",
    `Generated: ${bundle.generated_at}`,
    `Default mode: ${bundle.default_mode}`,
    `Registry: ${bundle.production_action_registry_path}`,
    `Owner system: ${bundle.owner_system}`,
    `Target record: ${bundle.target_record_id}`,
    `Proof source: ${bundle.proof_source}`,
    `Proof path: ${bundle.proof_path}`,
    `Rollback snapshot: ${bundle.rollback_snapshot_path}`,
    `Candidate path: ${bundle.candidate_path ?? "none"}`,
    "",
    "## Allowed Live Action Types",
    "",
    list(bundle.allowed_live_action_types),
    "",
    "## Registered Live Action Types",
    "",
    list(bundle.registered_live_action_types),
    "",
    "## Proven Live Action Types",
    "",
    list(bundle.proven_live_action_types),
    "",
    `First live lane proof: ${bundle.first_live_lane_proof_path}`,
    `First live lane proven: ${bundle.first_live_lane_proven}`,
    "",
    "## Blocked Action Types",
    "",
    list(bundle.blocked_action_types),
    "",
    "## Constraints",
    "",
    list(bundle.constraints),
    "",
  ].join("\n");
}

export async function buildProductionContextBundle(
  options: BuildProductionContextBundleOptions,
): Promise<BuildProductionContextBundleResult> {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const outputDir = path.resolve(cwd, options.outputDir);
  const generatedAt = (options.now ?? new Date()).toISOString();
  const bundlePath = path.join(outputDir, "context-bundle.json");
  const bundleMarkdownPath = path.join(outputDir, "context-bundle.md");
  const proofPath = path.join(outputDir, "paperclip-issue-metadata-snapshot.json");
  const rollbackSnapshotPath = path.join(outputDir, "rollback-snapshot.json");
  const firstLiveLaneProofPath = path.resolve(
    outputDir,
    "..",
    "production-canary",
    "execution.json",
  );
  const firstLiveLaneProven = isFirstLiveLaneProven(
    await readJsonIfExists(firstLiveLaneProofPath),
  );
  const provenLiveActionTypes = firstLiveLaneProven
    ? [...AUTOAGENT_INITIAL_LIVE_PRODUCTION_ACTION_TYPES]
    : [];
  const allowedLiveActionTypes = firstLiveLaneProven
    ? [
      ...AUTOAGENT_INITIAL_LIVE_PRODUCTION_ACTION_TYPES,
      ...AUTOAGENT_NEXT_LIVE_PRODUCTION_ACTION_TYPES,
    ]
    : [...AUTOAGENT_INITIAL_LIVE_PRODUCTION_ACTION_TYPES];
  const candidatePath = options.candidatePath
    ? path.resolve(cwd, options.candidatePath)
    : null;
  const paperclipConfigPath = options.paperclipConfigPath
    ? path.resolve(cwd, options.paperclipConfigPath)
    : null;

  const proof = {
    schema: "blueprint/autoagent-production-context-proof/v1",
    generated_at: generatedAt,
    owner_system: "paperclip_hermes",
    proof_source: "paperclip_issue_metadata_snapshot",
    target_record_id: "recursive-agent-improvement-loop",
    candidate_path: candidatePath,
    paperclip_config_path: paperclipConfigPath,
    evidence_class:
      "deterministic repo-local owner-system snapshot for allowlisted production canary validation",
    current_metadata: {
      "metadata.autoagent.production_decision_loop": "previous_or_unset",
      "metadata.autoagent.latest_production_report_pointer": null,
    },
    first_live_lane_proof_path: firstLiveLaneProofPath,
    first_live_lane_proven: firstLiveLaneProven,
    live_provider_or_send_proof: false,
  };
  const rollbackSnapshot = {
    schema: "blueprint/autoagent-production-rollback-snapshot/v1",
    generated_at: generatedAt,
    owner_system: "paperclip_hermes",
    target_record_id: "recursive-agent-improvement-loop",
    rollback_strategy: "restore_previous_metadata_snapshot",
    previous_metadata: {
      "metadata.autoagent.production_decision_loop": "previous_or_unset",
      "metadata.autoagent.latest_production_report_pointer": null,
    },
    alternate_rollback_strategies: {
      restore_previous_report_pointer_snapshot:
        "restore metadata.autoagent.latest_production_report_pointer from previous_metadata",
    },
    live_provider_or_send_rollback: false,
  };
  const bundle: ProductionContextBundle = {
    schema: "blueprint/autoagent-production-context-bundle/v1",
    generated_at: generatedAt,
    default_mode: AUTOAGENT_PRODUCTION_ACTION_DEFAULT_MODE,
    production_action_registry_path: AUTOAGENT_PRODUCTION_ACTION_REGISTRY_PATH,
    allowed_live_action_types: allowedLiveActionTypes,
    registered_live_action_types: [
      ...AUTOAGENT_REGISTERED_LIVE_PRODUCTION_ACTION_TYPES,
    ],
    proven_live_action_types: provenLiveActionTypes,
    first_live_lane_proof_path: firstLiveLaneProofPath,
    first_live_lane_proven: firstLiveLaneProven,
    blocked_action_types: [...AUTOAGENT_BLOCKED_PRODUCTION_ACTION_TYPES],
    owner_system: "paperclip_hermes",
    target_record_id: "recursive-agent-improvement-loop",
    proof_source: "paperclip_issue_metadata_snapshot",
    proof_path: proofPath,
    rollback_snapshot_path: rollbackSnapshotPath,
    candidate_path: candidatePath,
    constraints: [
      "default command remains dry-run",
      "production execution requires --execute-production-canary",
      "AI proposal is report/proposal only and never executes directly",
      "deterministic validator may reject any proposal",
      "only registry-approved production actions can execute",
      "paperclip_internal_report_pointer_update is allowed only after paperclip_hermes_internal_metadata_update has a committed execution proof",
      "external sends, payments, providers, hosted sessions, rights/legal, city-launch, and customer claims remain blocked",
      "every execution writes audit proof and uses an idempotency key",
      "rollback snapshot must exist before canary execution",
    ],
  };

  if (options.writeArtifacts !== false) {
    await writeJson(proofPath, proof);
    await writeJson(rollbackSnapshotPath, rollbackSnapshot);
    await writeJson(bundlePath, bundle);
    await writeText(bundleMarkdownPath, renderMarkdown(bundle));
  }

  return {
    bundle,
    bundlePath,
    bundleMarkdownPath,
    proofPath,
    rollbackSnapshotPath,
  };
}
