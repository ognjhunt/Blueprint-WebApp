export type RuntimeSessionStatus =
  | "queued"
  | "starting"
  | "running"
  | "waiting_for_tool"
  | "waiting_for_human"
  | "idle"
  | "blocked"
  | "completed"
  | "failed"
  | "cancelled"
  | "archived";

export type RuntimeTraceActor = "agent" | "runtime" | "human" | "tool" | "subagent";

export type RuntimeTraceEventType =
  | "session.started"
  | "session.resumed"
  | "session.status_changed"
  | "model.turn_started"
  | "model.turn_completed"
  | "tool.requested"
  | "tool.approved"
  | "tool.denied"
  | "tool.started"
  | "tool.completed"
  | "tool.failed"
  | "memory.read"
  | "memory.write"
  | "vault.granted"
  | "vault.used"
  | "artifact.created"
  | "artifact.promoted"
  | "subagent.spawned"
  | "subagent.completed"
  | "handoff.created"
  | "human_gate.required"
  | "human_gate.cleared"
  | "session.checkpointed"
  | "session.failed";

export interface RuntimeSession {
  id: string;
  issueId: string | null;
  parentSessionId: string | null;
  rootSessionId: string;
  agentKey: string;
  agentVersionRef: string;
  channelRef: string | null;
  environmentProfileKey: string;
  status: RuntimeSessionStatus;
  startedAt: string | null;
  endedAt: string | null;
  wakeReason: string | null;
  summary: string | null;
  lastTraceEventAt: string | null;
  latestCheckpointId: string | null;
  outputArtifactPaths: string[];
  proofLinks: string[];
  memoryBindings: string[];
  vaultGrantIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface RuntimeTraceEvent {
  id: string;
  sessionId: string;
  sequence: number;
  at: string;
  type: RuntimeTraceEventType;
  actor: RuntimeTraceActor;
  summary: string;
  detail: Record<string, unknown> | null;
}

export interface RuntimeCheckpoint {
  id: string;
  sessionId: string;
  createdAt: string;
  reason: string;
  status: RuntimeSessionStatus;
  traceLength: number;
  outputArtifactPaths: string[];
  proofLinks: string[];
  memoryBindings: string[];
}

export type MemoryScope =
  | "doctrine_shared"
  | "project_shared"
  | "agent_local"
  | "session_scratch";

export type MemoryAuthority =
  | "repo"
  | "paperclip"
  | "notion_reviewed"
  | "agent_candidate"
  | "human_authored";

export type MemoryDurability = "ephemeral" | "candidate_durable" | "approved_durable";

export interface MemoryRecord {
  id: string;
  storeKey: string;
  path: string;
  scope: MemoryScope;
  title: string;
  content: string;
  labels: string[];
  sourceSessionId: string | null;
  sourceIssueId: string | null;
  authority: MemoryAuthority;
  durability: MemoryDurability;
  version: number;
  redacted: boolean;
  approvalEvidence: string | null;
  createdAt: string;
  updatedAt: string;
}

export type VaultScope = "company" | "workspace" | "agent" | "session";

export interface VaultGrant {
  id: string;
  scope: VaultScope;
  scopeRef: string;
  sessionId: string | null;
  agentKey: string | null;
  secretRefs: string[];
  allowedTools: string[];
  expiresAt: string | null;
  createdBy: string;
  createdAt: string;
  revokedAt: string | null;
}

export interface RuntimeSubagent {
  id: string;
  parentSessionId: string;
  childSessionId: string;
  requestedByAgentKey: string;
  assignedAgentKey: string;
  purpose: string;
  expectedOutput: string;
  status: "queued" | "running" | "completed" | "blocked" | "failed" | "cancelled";
  environmentProfileKey: string;
  memoryBindings: string[];
  vaultGrantIds: string[];
  createdAt: string;
  completedAt: string | null;
}

export interface RuntimeSessionIndex {
  activeByIssueAgent: Record<string, string>;
  latestByIssue: Record<string, string>;
  latestByAgent: Record<string, string>;
  latestByParentSession: Record<string, string>;
  sessionIdsByIssue: Record<string, string[]>;
  sessionIdsByAgent: Record<string, string[]>;
  sessionIdsByParent: Record<string, string[]>;
  recentSessionIds: string[];
}

export interface RuntimeSubagentIndex {
  byId: Record<string, RuntimeSubagent>;
  childIdsByParentSession: Record<string, string[]>;
}

export interface RuntimeMemoryIndex {
  latestVersionByRecordKey: Record<string, number>;
  versionsByStorePath: Record<string, number[]>;
}

export interface EnvironmentProfile {
  key: string;
  description: string;
  runtime_lane: string;
  adapter_policy?: {
    preferred?: string[];
  };
  tools?: {
    allow?: string[];
    deny?: string[];
  };
  network_policy?: {
    mode?: string;
  };
  repo_mounts?: string[];
  memory?: {
    bind?: string[];
  };
  vault?: {
    default_scope?: VaultScope;
    allowed_refs?: string[];
    allowed_tools?: string[];
  };
  artifacts?: {
    require_trace_link?: boolean;
    publish_to_issue?: boolean;
  };
  review?: {
    human_gate?: string;
  };
}

export interface RuntimeAgentManifest {
  agent_key: string;
  default_channel?: string;
  default_environment_profile: string;
  employee_kit: {
    agent_path: string;
    soul_path?: string;
    tools_path?: string;
    heartbeat_path?: string;
    task_paths?: string[];
  };
  memory_bindings?: string[];
  promotion_policy?: {
    staging_requires?: string[];
    production_requires?: string[];
  };
}

export interface RuntimeAgentVersion {
  version: string;
  agent_key: string;
  environment_profile: string;
  resolved_inputs?: {
    sources?: string[];
    summary?: string;
  };
  active_tools?: string[];
  active_skills?: string[];
  memory_bindings?: string[];
  vault?: {
    default_scope?: VaultScope;
    allowed_refs?: string[];
    allowed_tools?: string[];
  };
  adapter_policy?: {
    preferred?: string[];
  };
  review_policy?: {
    requires_verification?: boolean;
    evidence?: string[];
  };
}

export interface RuntimeAgentChannel {
  channel: string;
  agent_key: string;
  version: string;
  approved_by?: string;
  approved_at?: string;
  notes?: string;
}

export function nowIso() {
  return new Date().toISOString();
}

export function isTerminalRuntimeSessionStatus(status: RuntimeSessionStatus) {
  return status === "completed" || status === "failed" || status === "cancelled" || status === "archived";
}

export function emptyRuntimeSessionIndex(): RuntimeSessionIndex {
  return {
    activeByIssueAgent: {},
    latestByIssue: {},
    latestByAgent: {},
    latestByParentSession: {},
    sessionIdsByIssue: {},
    sessionIdsByAgent: {},
    sessionIdsByParent: {},
    recentSessionIds: [],
  };
}

export function emptyRuntimeSubagentIndex(): RuntimeSubagentIndex {
  return {
    byId: {},
    childIdsByParentSession: {},
  };
}

export function emptyRuntimeMemoryIndex(): RuntimeMemoryIndex {
  return {
    latestVersionByRecordKey: {},
    versionsByStorePath: {},
  };
}

export function issueStatusToRuntimeSessionStatus(
  issueStatus: string | null | undefined,
  fallback: RuntimeSessionStatus = "queued",
): RuntimeSessionStatus {
  switch (issueStatus) {
    case "backlog":
    case "todo":
      return "queued";
    case "in_progress":
    case "in_review":
      return "running";
    case "blocked":
      return "blocked";
    case "done":
      return "completed";
    case "cancelled":
      return "cancelled";
    default:
      return fallback;
  }
}

export function uniqueStrings(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value && value.trim().length > 0)).map((value) => value.trim()))];
}
