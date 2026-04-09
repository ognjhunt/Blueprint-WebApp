import type { z } from "zod";

export type AgentProvider =
  | "openclaw"
  | "openai_responses"
  | "anthropic_agent_sdk"
  | "acp_harness"
  | "codex_local";

export type AgentRuntime = AgentProvider;

export type AgentTaskKind =
  | "waitlist_triage"
  | "inbound_qualification"
  | "post_signup_scheduling"
  | "support_triage"
  | "payout_exception_triage"
  | "preview_diagnosis"
  | "operator_thread"
  | "external_harness_thread";

export type AgentRunStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "pending_approval"
  | "cancelled";

export type RuntimeEventStatus = "info" | "success" | "warning" | "error";

export type AgentToolMode =
  | "none"
  | "api"
  | "mcp"
  | "shell"
  | "browser"
  | "mixed"
  | "local_tools"
  | "external_harness";

export type SessionDispatchMode = "collect" | "interrupt" | "steer";
export type AgentThreadPhase = "investigation" | "implementation" | "review_qa";

export type HarnessTarget = "codex" | "claude_code";

export type StartupPackOwnerScope = "workspace_admin" | "org";
export type StartupPackVisibility = "private" | "workspace" | "org";

export type StartupContextDocumentReference = {
  id: string;
  title: string;
  source_file_uri?: string;
  extraction_status?: string;
};

export type SensitiveAction =
  | "financial"
  | "payout"
  | "rights"
  | "licensing"
  | "preview_release"
  | "destructive"
  | "authenticated_browser"
  | "compliance";

export interface ToolPolicy {
  mode: AgentToolMode;
  prefer_direct_api: boolean;
  browser_fallback_allowed: boolean;
  isolated_runtime_required: boolean;
  allowed_mcp_servers: string[];
  allowed_domains: string[];
  allowed_actions: string[];
}

export interface ApprovalPolicy {
  require_human_approval: boolean;
  sensitive_actions: SensitiveAction[];
  allow_preapproval: boolean;
}

export interface SessionPolicy {
  dispatch_mode: SessionDispatchMode;
  lane: string;
  max_concurrent: number;
}

export interface OutcomeContract {
  objective: string;
  success_criteria: string[];
  self_checks: string[];
  proof_requirements: string[];
  pass_threshold: number;
  bounded_scope?: string;
  grader_name?: string;
}

export interface OutcomeCheckResult {
  label: string;
  passed: boolean;
  detail: string;
}

export interface OutcomeEvaluation {
  status: "pass" | "partial" | "fail";
  score: number;
  summary: string;
  checks: OutcomeCheckResult[];
}

export interface ExternalKnowledgeSource {
  title: string;
  url: string;
  description?: string;
  source_type?: string;
}

export interface CreativeContextReference {
  id: string;
  sku_name?: string;
  created_at?: string | null;
  rollout_variant?: string | null;
  research_topic?: string | null;
  storage_uri: string;
}

export interface StartupContextMetadata {
  startupPackIds?: string[];
  repoDocPaths?: string[];
  blueprintIds?: string[];
  documentIds?: string[];
  externalSources?: ExternalKnowledgeSource[];
  creativeContexts?: CreativeContextReference[];
  operatorNotes?: string;
  targetHarness?: HarnessTarget;
}

export interface AgentTask<TInput = unknown> {
  kind: AgentTaskKind;
  input: TInput;
  provider?: AgentProvider;
  runtime?: AgentRuntime;
  model?: string;
  session_id?: string | null;
  session_key?: string | null;
  tool_policy?: Partial<ToolPolicy>;
  approval_policy?: Partial<ApprovalPolicy>;
  session_policy?: Partial<SessionPolicy>;
  outcome_contract?: Partial<OutcomeContract>;
  resume_from_run_id?: string | null;
  parent_run_id?: string | null;
  metadata?: Record<string, unknown>;
}

export interface StructuredTaskDefinition<TInput = unknown, TOutput = unknown> {
  kind: AgentTaskKind;
  default_provider: AgentProvider;
  default_runtime?: AgentRuntime;
  model_by_provider?: Partial<Record<AgentProvider, string>>;
  output_schema: z.ZodType<TOutput>;
  build_prompt: (input: TInput) => string;
  build_outcome_contract?: (input: TInput) => OutcomeContract;
  tool_policy?: Partial<ToolPolicy>;
  approval_policy?: Partial<ApprovalPolicy>;
  session_policy?: Partial<SessionPolicy>;
}

export interface NormalizedAgentTask<TInput = unknown, TOutput = unknown>
  extends AgentTask<TInput> {
  provider: AgentProvider;
  runtime: AgentRuntime;
  model: string;
  tool_policy: ToolPolicy;
  approval_policy: ApprovalPolicy;
  session_policy: SessionPolicy;
  outcome_contract: OutcomeContract;
  definition: StructuredTaskDefinition<TInput, TOutput>;
}

export interface AgentResult<TOutput = unknown> {
  status: AgentRunStatus;
  provider: AgentProvider;
  runtime: AgentRuntime;
  model: string;
  tool_mode: AgentToolMode;
  output?: TOutput;
  raw_output_text?: string;
  error?: string | null;
  requires_human_review: boolean;
  requires_approval: boolean;
  approval_reason?: string | null;
  openclaw_session_id?: string | null;
  openclaw_run_id?: string | null;
  artifacts?: Record<string, unknown> | null;
  logs?: Array<Record<string, unknown>> | null;
}

export interface PersistedAgentSession {
  id: string;
  task_kind: AgentTaskKind;
  provider: AgentProvider;
  runtime: AgentRuntime;
  status: "active" | "idle" | "cancelled";
  title: string;
  session_key: string;
  created_at: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue | string;
  updated_at: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue | string;
  last_run_id?: string | null;
  agent_profile_id?: string | null;
  environment_profile_id?: string | null;
  latest_checkpoint_id?: string | null;
  metadata?: Record<string, unknown>;
}

export interface PersistedAgentRun {
  id: string;
  session_id?: string | null;
  session_key?: string | null;
  task_kind: AgentTaskKind;
  provider: AgentProvider;
  runtime: AgentRuntime;
  model: string;
  status: AgentRunStatus;
  dispatch_mode: SessionDispatchMode;
  input: unknown;
  output?: unknown;
  raw_output_text?: string | null;
  artifacts?: Record<string, unknown> | null;
  logs?: Array<Record<string, unknown>> | null;
  error?: string | null;
  approval_reason?: string | null;
  requires_human_review: boolean;
  parent_run_id?: string | null;
  openclaw_session_id?: string | null;
  openclaw_run_id?: string | null;
  tool_policy: ToolPolicy;
  approval_policy: ApprovalPolicy;
  outcome_contract?: OutcomeContract | null;
  outcome_evaluation?: OutcomeEvaluation | null;
  metadata?: Record<string, unknown>;
  created_at: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue | string;
  updated_at: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue | string;
  started_at?: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue | string | null;
  completed_at?: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue | string | null;
  cancelled_at?: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue | string | null;
  resume_from_run_id?: string | null;
}

export interface StartupPackRecord {
  id: string;
  name: string;
  description?: string;
  repo_doc_paths: string[];
  blueprint_ids: string[];
  document_ids: string[];
  external_sources: ExternalKnowledgeSource[];
  creative_contexts?: CreativeContextReference[];
  operator_notes?: string;
  tool_policies?: Record<string, unknown>;
  owner_scope?: StartupPackOwnerScope;
  owner_id?: string | null;
  visibility?: StartupPackVisibility;
  version: number;
  created_by?: {
    uid?: string | null;
    email?: string | null;
  };
  updated_by?: {
    uid?: string | null;
    email?: string | null;
  };
  created_at: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue | string;
  updated_at: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue | string;
}

export type OpsDocumentExtractionStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed";

export type OpsDocumentIndexingStatus =
  | "not_started"
  | "completed"
  | "partial"
  | "failed";

export interface OpsDocumentRecord {
  id: string;
  title: string;
  source_file_uri: string;
  mime_type?: string | null;
  blueprint_ids: string[];
  startup_pack_ids: string[];
  extraction_status: OpsDocumentExtractionStatus;
  indexing_status: OpsDocumentIndexingStatus;
  extracted_summary?: string | null;
  extracted_text?: string | null;
  structured_result?: Record<string, unknown> | null;
  artifacts?: Record<string, unknown> | null;
  logs?: Array<Record<string, unknown>> | null;
  openclaw_session_id?: string | null;
  openclaw_run_id?: string | null;
  error?: string | null;
  created_by?: {
    uid?: string | null;
    email?: string | null;
  };
  updated_by?: {
    uid?: string | null;
    email?: string | null;
  };
  created_at: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue | string;
  updated_at: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue | string;
}

export type OpsActionLogStatus =
  | "queued"
  | "started"
  | "completed"
  | "failed"
  | "pending_approval"
  | "cancelled"
  | "info";

export type OpsActionRiskLevel = "low" | "medium" | "high" | "critical";

export interface PersistedOpsActionLog {
  id: string;
  session_id?: string | null;
  run_id?: string | null;
  session_key?: string | null;
  action_key: string;
  status: OpsActionLogStatus;
  summary?: string | null;
  provider?: AgentProvider | null;
  runtime?: AgentRuntime | null;
  task_kind?: AgentTaskKind | null;
  risk_level: OpsActionRiskLevel;
  reversible: boolean;
  requires_approval: boolean;
  latency_ms?: number | null;
  metadata?: Record<string, unknown>;
  created_at: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue | string;
}

export interface AgentProfileRecord {
  id: string;
  key: string;
  name: string;
  description?: string;
  task_kind: AgentTaskKind;
  default_provider?: AgentProvider;
  default_runtime?: AgentRuntime;
  default_model?: string | null;
  lane?: string | null;
  default_environment_profile_id?: string | null;
  startup_context?: StartupContextMetadata;
  tool_policy?: Partial<ToolPolicy>;
  approval_policy?: Partial<ApprovalPolicy>;
  session_policy?: Partial<SessionPolicy>;
  outcome_contract?: OutcomeContract | null;
  capabilities?: string[];
  human_gates?: string[];
  allowed_subagent_profile_ids?: string[];
  built_in?: boolean;
  created_at: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue | string;
  updated_at: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue | string;
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
  network_rules: {
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
  tool_policy?: Partial<ToolPolicy>;
  approval_policy?: Partial<ApprovalPolicy>;
  session_policy?: Partial<SessionPolicy>;
  built_in?: boolean;
  created_at: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue | string;
  updated_at: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue | string;
}

export interface RuntimeEventRecord {
  id: string;
  session_id: string;
  run_id?: string | null;
  checkpoint_id?: string | null;
  kind: string;
  status: RuntimeEventStatus;
  summary: string;
  detail?: string | null;
  metadata?: Record<string, unknown>;
  created_at: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue | string;
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
  created_at: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue | string;
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
  created_at: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue | string;
  updated_at: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue | string;
}
