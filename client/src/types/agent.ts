export type AgentProvider =
  | "openclaw"
  | "openai_responses"
  | "anthropic_agent_sdk"
  | "acp_harness"
  | "codex_local";

export type HarnessTarget = "codex" | "claude_code";
export type AgentThreadPhase = "investigation" | "implementation" | "review_qa";

export type AgentTaskKind =
  | "operator_thread"
  | "external_harness_thread"
  | "support_triage";

export type AgentRunStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "pending_approval"
  | "cancelled";

export type StartupContextMetadata = {
  startupPackIds?: string[];
  repoDocPaths?: string[];
  blueprintIds?: string[];
  documentIds?: string[];
  externalSources?: Array<{
    title: string;
    url: string;
    description?: string;
    source_type?: string;
  }>;
  creativeContexts?: Array<{
    id: string;
    sku_name?: string;
    created_at?: string | null;
    rollout_variant?: string | null;
    research_topic?: string | null;
    storage_uri: string;
  }>;
  operatorNotes?: string;
  targetHarness?: HarnessTarget;
};

export type OutcomeContract = {
  objective: string;
  success_criteria: string[];
  self_checks: string[];
  proof_requirements: string[];
  pass_threshold: number;
  bounded_scope?: string;
  grader_name?: string;
};

export type OutcomeEvaluation = {
  status: "pass" | "partial" | "fail";
  score: number;
  summary: string;
  checks: Array<{
    label: string;
    passed: boolean;
    detail: string;
  }>;
};

export interface AgentSessionRecord {
  id: string;
  task_kind: AgentTaskKind;
  provider: AgentProvider;
  runtime: AgentProvider;
  status: "active" | "idle" | "cancelled";
  title: string;
  session_key: string;
  created_at: string | null;
  updated_at: string | null;
  last_run_id?: string | null;
  agent_profile_id?: string | null;
  environment_profile_id?: string | null;
  latest_checkpoint_id?: string | null;
  metadata?: {
    startupContext?: StartupContextMetadata;
    workflow?: {
      phase?: AgentThreadPhase;
      parentSessionId?: string;
      parentRunId?: string;
      retryCount?: number;
      startupContextMode?: "default" | "compact_references";
      handoffPrompt?: string;
      sourceSessionTitle?: string;
    };
    managedRuntime?: {
      agentProfileId?: string | null;
      environmentProfileId?: string | null;
      profileName?: string | null;
      environmentName?: string | null;
      environmentSnapshot?: Record<string, unknown> | null;
      agentProfileSnapshot?: Record<string, unknown> | null;
      delegation?: {
        parentSessionId?: string | null;
        parentRunId?: string | null;
      };
    };
    latest_outcome_evaluation?: OutcomeEvaluation;
  } & Record<string, unknown>;
}

export interface AgentRunRecord {
  id: string;
  session_id?: string | null;
  session_key?: string | null;
  task_kind: string;
  provider: AgentProvider;
  runtime: AgentProvider;
  model: string;
  status: AgentRunStatus;
  dispatch_mode: string;
  input: unknown;
  output?: unknown;
  raw_output_text?: string | null;
  artifacts?: Record<string, unknown> | null;
  logs?: Array<Record<string, unknown>> | null;
  metadata?: Record<string, unknown> | null;
  error?: string | null;
  approval_reason?: string | null;
  requires_human_review: boolean;
  parent_run_id?: string | null;
  outcome_contract?: OutcomeContract | null;
  outcome_evaluation?: OutcomeEvaluation | null;
  openclaw_session_id?: string | null;
  openclaw_run_id?: string | null;
  created_at: string | null;
  updated_at: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  cancelled_at?: string | null;
}

export interface AgentContextOptionsResponse {
  ok: boolean;
  repoDocs: string[];
  blueprints: Array<{ id: string; name: string }>;
  opsDocuments: OpsDocumentRecord[];
  startupPacks: StartupPackRecord[];
  profiles?: AgentProfileRecord[];
  environments?: AgentEnvironmentProfileRecord[];
  recentCreativeRuns: Array<{
    id: string;
    skuName: string;
    createdAt: string | null;
    rolloutVariant?: string | null;
    researchTopic?: string | null;
    storageUri: string;
  }>;
  externalSourceTypes: string[];
}

export interface StartupPackRecord {
  id: string;
  name: string;
  description: string;
  repoDocPaths: string[];
  blueprintIds: string[];
  documentIds: string[];
  externalSources: Array<{
    title: string;
    url: string;
    description?: string;
    source_type?: string;
  }>;
  creativeContexts?: Array<{
    id: string;
    sku_name?: string;
    created_at?: string | null;
    rollout_variant?: string | null;
    research_topic?: string | null;
    storage_uri: string;
  }>;
  operatorNotes: string;
  toolPolicies?: Record<string, unknown>;
  ownerScope?: "workspace_admin" | "org";
  ownerId?: string | null;
  visibility?: "private" | "workspace" | "org";
  version: number;
  createdBy?: {
    uid?: string | null;
    email?: string | null;
  } | null;
  updatedBy?: {
    uid?: string | null;
    email?: string | null;
  } | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface OpsDocumentRecord {
  id: string;
  title: string;
  sourceFileUri: string;
  mimeType?: string | null;
  blueprintIds: string[];
  startupPackIds: string[];
  extractionStatus: "pending" | "running" | "completed" | "failed";
  indexingStatus: "not_started" | "completed" | "partial" | "failed";
  createdAt: string | null;
  updatedAt: string | null;
}

export interface OpsActionLogRecord {
  id: string;
  sessionId?: string | null;
  runId?: string | null;
  sessionKey?: string | null;
  actionKey: string;
  status:
    | "queued"
    | "started"
    | "completed"
    | "failed"
    | "pending_approval"
    | "cancelled"
    | "info";
  summary: string;
  provider?: AgentProvider | null;
  runtime?: AgentProvider | null;
  taskKind?: string | null;
  riskLevel: "low" | "medium" | "high" | "critical";
  reversible: boolean;
  requiresApproval: boolean;
  latencyMs?: number | null;
  metadata?: Record<string, unknown>;
  createdAt: string | null;
}

export interface AgentProfileRecord {
  id: string;
  key: string;
  name: string;
  description?: string;
  task_kind: AgentTaskKind;
  default_provider?: AgentProvider;
  default_runtime?: AgentProvider;
  default_model?: string | null;
  lane?: string | null;
  default_environment_profile_id?: string | null;
  outcome_contract?: OutcomeContract | null;
  capabilities?: string[];
  human_gates?: string[];
  allowed_subagent_profile_ids?: string[];
  built_in?: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface AgentEnvironmentProfileRecord {
  id: string;
  key: string;
  name: string;
  description?: string;
  lane: string;
  repo_mounts: string[];
  package_set: string[];
  secret_bindings: string[];
  startup_pack_ids?: string[];
  network_rules?: {
    mode: "restricted" | "open" | "deny_list";
    allow_network: boolean;
    allow_domains: string[];
    deny_domains: string[];
  };
  runtime_constraints?: {
    isolated_runtime: boolean;
    checkpoint_on_failure: boolean;
    checkpoint_on_control: boolean;
  };
  built_in?: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface RuntimeEventRecord {
  id: string;
  session_id: string;
  run_id?: string | null;
  checkpoint_id?: string | null;
  kind: string;
  status: "info" | "success" | "warning" | "error";
  summary: string;
  detail?: string | null;
  metadata?: Record<string, unknown>;
  created_at: string | null;
}

export interface AgentCheckpointRecord {
  id: string;
  session_id: string;
  run_id?: string | null;
  session_key?: string | null;
  label: string;
  trigger: string;
  replayable: boolean;
  snapshot: Record<string, unknown>;
  created_at: string | null;
}

export interface AgentCompactionRecord {
  id: string;
  source_session_id: string;
  source_run_id?: string | null;
  target_session_id?: string | null;
  target_run_id?: string | null;
  phase?: AgentThreadPhase | null;
  reason: string;
  status: "created" | "continued" | "failed";
  handoff_prompt: string;
  summary: string;
  metadata?: Record<string, unknown>;
  created_at: string | null;
  updated_at: string | null;
}
