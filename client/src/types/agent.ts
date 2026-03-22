export type AgentProvider =
  | "openclaw"
  | "openai_responses"
  | "anthropic_agent_sdk"
  | "acp_harness";

export type HarnessTarget = "codex" | "claude_code";

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
  operatorNotes?: string;
  targetHarness?: HarnessTarget;
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
  metadata?: {
    startupContext?: StartupContextMetadata;
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
  error?: string | null;
  approval_reason?: string | null;
  requires_human_review: boolean;
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
