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
  resume_from_run_id?: string | null;
  metadata?: Record<string, unknown>;
}

export interface StructuredTaskDefinition<TInput = unknown, TOutput = unknown> {
  kind: AgentTaskKind;
  default_provider: AgentProvider;
  default_runtime?: AgentRuntime;
  model_by_provider?: Partial<Record<AgentProvider, string>>;
  output_schema: z.ZodType<TOutput>;
  build_prompt: (input: TInput) => string;
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
  openclaw_session_id?: string | null;
  openclaw_run_id?: string | null;
  tool_policy: ToolPolicy;
  approval_policy: ApprovalPolicy;
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
