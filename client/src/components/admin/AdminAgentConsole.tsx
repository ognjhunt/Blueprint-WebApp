import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bot,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Layers3,
  Loader2,
  MessageSquare,
  PlayCircle,
  ShieldAlert,
  SquareX,
} from "lucide-react";

import { withCsrfHeader } from "@/lib/csrf";
import type {
  AgentCheckpointRecord,
  AgentCompactionRecord,
  AgentContextOptionsResponse,
  AgentEnvironmentProfileRecord,
  AgentProfileRecord,
  OpsActionLogRecord,
  OpsDocumentRecord,
  AgentRunRecord,
  AgentSessionRecord,
  AgentThreadPhase,
  AgentTaskKind,
  RuntimeEventRecord,
  StartupPackRecord,
} from "@/types/agent";

const sessionTaskOptions: Array<{
  value: AgentTaskKind;
  label: string;
  description: string;
}> = [
  {
    value: "operator_thread",
    label: "Ops agent thread",
    description: "Internal operator assistant with attached startup context.",
  },
  {
    value: "support_triage",
    label: "Support triage",
    description: "Structured support investigations through the alpha agent runtime.",
  },
  {
    value: "external_harness_thread",
    label: "External harness thread",
    description: "Bounded external-harness execution lane for implementation subagents.",
  },
];

function formatTimestamp(value?: string | null) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function parseExternalSources(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [title, url, description] = line.split("|").map((part) => part.trim());
      return {
        title: title || url,
        url,
        description: description || undefined,
      };
    })
    .filter((entry) => entry.title && entry.url);
}

function parseLineList(value: string) {
  return value
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function matchesLooseText(value: string, patterns: string[]) {
  const normalized = value.toLowerCase();
  return patterns.some((pattern) => normalized.includes(pattern));
}

function statusColor(status: AgentRunRecord["status"]) {
  switch (status) {
    case "completed":
      return "bg-emerald-100 text-emerald-700";
    case "running":
      return "bg-blue-100 text-blue-700";
    case "pending_approval":
      return "bg-amber-100 text-amber-800";
    case "failed":
      return "bg-rose-100 text-rose-700";
    case "cancelled":
      return "bg-zinc-200 text-zinc-700";
    default:
      return "bg-zinc-100 text-zinc-700";
  }
}

function actionLogStatusColor(status: OpsActionLogRecord["status"]) {
  switch (status) {
    case "completed":
      return "bg-emerald-100 text-emerald-700";
    case "started":
      return "bg-blue-100 text-blue-700";
    case "pending_approval":
      return "bg-amber-100 text-amber-800";
    case "failed":
      return "bg-rose-100 text-rose-700";
    case "cancelled":
      return "bg-zinc-200 text-zinc-700";
    case "queued":
      return "bg-violet-100 text-violet-700";
    default:
      return "bg-zinc-100 text-zinc-700";
  }
}

function riskColor(riskLevel: OpsActionLogRecord["riskLevel"]) {
  switch (riskLevel) {
    case "critical":
      return "text-rose-700";
    case "high":
      return "text-amber-700";
    case "medium":
      return "text-blue-700";
    default:
      return "text-zinc-500";
  }
}

function formatLatency(latencyMs?: number | null) {
  if (!latencyMs || latencyMs < 1) return null;
  if (latencyMs < 1000) return `${latencyMs} ms`;
  return `${(latencyMs / 1000).toFixed(1)} s`;
}

function runtimeEventStatusColor(status: RuntimeEventRecord["status"]) {
  switch (status) {
    case "success":
      return "bg-emerald-100 text-emerald-700";
    case "warning":
      return "bg-amber-100 text-amber-800";
    case "error":
      return "bg-rose-100 text-rose-700";
    default:
      return "bg-zinc-100 text-zinc-700";
  }
}

function scorePercent(score?: number | null) {
  if (typeof score !== "number") return null;
  return `${Math.round(score * 100)}%`;
}

function phaseLabel(phase: AgentThreadPhase) {
  switch (phase) {
    case "implementation":
      return "Implementation";
    case "review_qa":
      return "Review/QA";
    default:
      return "Investigation";
  }
}

function isContextWindowFailure(error?: string | null) {
  return Boolean(
    error &&
      /(context window|out of room|too much (earlier )?history|prompt (is )?too long|maximum context|token limit|max[_ ]output[_ ]tokens|incomplete response returned|stream disconnected before completion)/i.test(
        error,
      ),
  );
}

type ForkSessionResponse = {
  ok: boolean;
  session: AgentSessionRecord;
  handoffPrompt: string;
  dispatch: {
    queued: boolean;
    runId: string;
  };
};

type OpenClawConnectivityResponse = {
  ok: boolean;
  connectivity: {
    provider?: string;
    configured: boolean;
    auth_configured: boolean;
    timeout_ms: number;
    default_model: string | null;
    task_models?: Record<string, string | null>;
  };
};

type OpenClawSmokeTestResponse = {
  ok: boolean;
  smokeTest?: {
    ok: boolean;
    duration_ms: number;
    final?: {
      status?: string;
      openclaw_run_id?: string | null;
      error?: string | null;
      result?: unknown;
    };
  };
  error?: string;
};

type KnowledgePageRecommendation = {
  path: string;
  title: string;
  reason: string;
};

export default function AdminAgentConsole() {
  const queryClient = useQueryClient();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [title, setTitle] = useState("Ops agent thread");
  const [taskKind, setTaskKind] = useState<AgentTaskKind>("operator_thread");
  const [selectedAgentProfileId, setSelectedAgentProfileId] = useState<string>("");
  const [selectedEnvironmentProfileId, setSelectedEnvironmentProfileId] = useState<string>("");
  const [message, setMessage] = useState("");
  const [steerMessage, setSteerMessage] = useState("");
  const [delegationTitle, setDelegationTitle] = useState("Bounded delegated task");
  const [delegationMessage, setDelegationMessage] = useState("");
  const [delegationProfileId, setDelegationProfileId] = useState("");
  const [delegationEnvironmentProfileId, setDelegationEnvironmentProfileId] = useState("");
  const [compactPhase, setCompactPhase] = useState<AgentThreadPhase>("investigation");
  const [profileEditorId, setProfileEditorId] = useState<string | null>(null);
  const [profileEditorName, setProfileEditorName] = useState("");
  const [profileEditorKey, setProfileEditorKey] = useState("");
  const [profileEditorDescription, setProfileEditorDescription] = useState("");
  const [profileEditorTaskKind, setProfileEditorTaskKind] = useState<AgentTaskKind>("operator_thread");
  const [profileEditorCapabilities, setProfileEditorCapabilities] = useState("");
  const [profileEditorHumanGates, setProfileEditorHumanGates] = useState("");
  const [environmentEditorId, setEnvironmentEditorId] = useState<string | null>(null);
  const [environmentEditorName, setEnvironmentEditorName] = useState("");
  const [environmentEditorKey, setEnvironmentEditorKey] = useState("");
  const [environmentEditorDescription, setEnvironmentEditorDescription] = useState("");
  const [environmentEditorLane, setEnvironmentEditorLane] = useState("session");
  const [environmentEditorPackages, setEnvironmentEditorPackages] = useState("");
  const [environmentEditorSecrets, setEnvironmentEditorSecrets] = useState("");
  const [environmentEditorMounts, setEnvironmentEditorMounts] = useState("");
  const [operatorNotes, setOperatorNotes] = useState("");
  const [selectedStartupPackIds, setSelectedStartupPackIds] = useState<string[]>([]);
  const [selectedRepoDocs, setSelectedRepoDocs] = useState<string[]>([]);
  const [selectedKnowledgePagePaths, setSelectedKnowledgePagePaths] = useState<string[]>([]);
  const [selectedBlueprintIds, setSelectedBlueprintIds] = useState<string[]>([]);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [selectedCreativeRunIds, setSelectedCreativeRunIds] = useState<string[]>([]);
  const [externalSourcesText, setExternalSourcesText] = useState("");
  const [startupPackName, setStartupPackName] = useState("");
  const [startupPackDescription, setStartupPackDescription] = useState("");
  const [editingStartupPackId, setEditingStartupPackId] = useState<string | null>(null);
  const [opsDocumentTitle, setOpsDocumentTitle] = useState("");
  const [opsDocumentSourceFileUri, setOpsDocumentSourceFileUri] = useState("");
  const [openClawSmokeModel, setOpenClawSmokeModel] = useState("");

  const sessionsQuery = useQuery<{ ok: boolean; sessions: AgentSessionRecord[] }>({
    queryKey: ["admin-agent-sessions"],
    queryFn: async () => {
      const response = await fetch("/api/admin/agent/sessions", {
        headers: await withCsrfHeader({}),
      });
      if (!response.ok) throw new Error("Failed to fetch agent sessions");
      return response.json();
    },
  });

  const activeSessionId =
    selectedSessionId ?? sessionsQuery.data?.sessions?.[0]?.id ?? null;

  const contextOptionsQuery = useQuery<AgentContextOptionsResponse>({
    queryKey: ["admin-agent-context-options"],
    queryFn: async () => {
      const response = await fetch("/api/admin/agent/context/options", {
        headers: await withCsrfHeader({}),
      });
      if (!response.ok) throw new Error("Failed to fetch startup context options");
      return response.json();
    },
  });

  const sessionDetailQuery = useQuery<{ ok: boolean; session: AgentSessionRecord }>({
    queryKey: ["admin-agent-session", activeSessionId],
    enabled: Boolean(activeSessionId),
    queryFn: async () => {
      const response = await fetch(`/api/admin/agent/sessions/${activeSessionId}`, {
        headers: await withCsrfHeader({}),
      });
      if (!response.ok) throw new Error("Failed to fetch agent session");
      return response.json();
    },
  });

  const runsQuery = useQuery<{ ok: boolean; runs: AgentRunRecord[] }>({
    queryKey: ["admin-agent-runs", activeSessionId],
    enabled: Boolean(activeSessionId),
    queryFn: async () => {
      const response = await fetch(`/api/admin/agent/sessions/${activeSessionId}/runs`, {
        headers: await withCsrfHeader({}),
      });
      if (!response.ok) throw new Error("Failed to fetch agent runs");
      return response.json();
    },
  });

  const actionLogsQuery = useQuery<{ ok: boolean; actionLogs: OpsActionLogRecord[] }>({
    queryKey: ["admin-agent-action-logs", activeSessionId],
    enabled: Boolean(activeSessionId),
    queryFn: async () => {
      const response = await fetch(
        `/api/admin/agent/sessions/${activeSessionId}/action-logs`,
        {
          headers: await withCsrfHeader({}),
        },
      );
      if (!response.ok) throw new Error("Failed to fetch action logs");
      return response.json();
    },
  });

  const eventsQuery = useQuery<{ ok: boolean; events: RuntimeEventRecord[] }>({
    queryKey: ["admin-agent-events", activeSessionId],
    enabled: Boolean(activeSessionId),
    queryFn: async () => {
      const response = await fetch(`/api/admin/agent/sessions/${activeSessionId}/events`, {
        headers: await withCsrfHeader({}),
      });
      if (!response.ok) throw new Error("Failed to fetch runtime events");
      return response.json();
    },
  });

  const checkpointsQuery = useQuery<{ ok: boolean; checkpoints: AgentCheckpointRecord[] }>({
    queryKey: ["admin-agent-checkpoints", activeSessionId],
    enabled: Boolean(activeSessionId),
    queryFn: async () => {
      const response = await fetch(`/api/admin/agent/sessions/${activeSessionId}/checkpoints`, {
        headers: await withCsrfHeader({}),
      });
      if (!response.ok) throw new Error("Failed to fetch checkpoints");
      return response.json();
    },
  });

  const compactionsQuery = useQuery<{ ok: boolean; compactions: AgentCompactionRecord[] }>({
    queryKey: ["admin-agent-compactions", activeSessionId],
    enabled: Boolean(activeSessionId),
    queryFn: async () => {
      const response = await fetch(`/api/admin/agent/sessions/${activeSessionId}/compactions`, {
        headers: await withCsrfHeader({}),
      });
      if (!response.ok) throw new Error("Failed to fetch compactions");
      return response.json();
    },
  });

  const openClawConnectivityQuery = useQuery<OpenClawConnectivityResponse>({
    queryKey: ["admin-agent-openclaw-connectivity"],
    queryFn: async () => {
      const response = await fetch("/api/admin/agent/runtime/connectivity", {
        headers: await withCsrfHeader({}),
      });
      if (!response.ok) throw new Error("Failed to fetch agent runtime connectivity");
      return response.json();
    },
  });

  useEffect(() => {
    if (!selectedSessionId && sessionsQuery.data?.sessions?.[0]) {
      setSelectedSessionId(sessionsQuery.data.sessions[0].id);
    }
  }, [selectedSessionId, sessionsQuery.data?.sessions]);

  useEffect(() => {
    const profiles = contextOptionsQuery.data?.profiles || [];
    if (!selectedAgentProfileId && profiles[0]?.id) {
      setSelectedAgentProfileId(profiles[0].id);
    }
    if (!delegationProfileId && profiles[0]?.id) {
      setDelegationProfileId(profiles[0].id);
    }
  }, [contextOptionsQuery.data?.profiles, selectedAgentProfileId, delegationProfileId]);

  useEffect(() => {
    const environments = contextOptionsQuery.data?.environments || [];
    if (!selectedEnvironmentProfileId && environments[0]?.id) {
      setSelectedEnvironmentProfileId(environments[0].id);
    }
    if (!delegationEnvironmentProfileId && environments[0]?.id) {
      setDelegationEnvironmentProfileId(environments[0].id);
    }
  }, [
    contextOptionsQuery.data?.environments,
    selectedEnvironmentProfileId,
    delegationEnvironmentProfileId,
  ]);

  useEffect(() => {
    const profile = (contextOptionsQuery.data?.profiles || []).find(
      (entry) => entry.id === selectedAgentProfileId,
    );
    if (profile?.task_kind) {
      setTaskKind(profile.task_kind);
    }
    if (profile?.default_environment_profile_id && !selectedEnvironmentProfileId) {
      setSelectedEnvironmentProfileId(profile.default_environment_profile_id);
    }
  }, [contextOptionsQuery.data?.profiles, selectedAgentProfileId, selectedEnvironmentProfileId]);

  const selectedSession =
    sessionDetailQuery.data?.session
    || sessionsQuery.data?.sessions?.find((session) => session.id === activeSessionId)
    || null;

  const createSessionMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title,
        task_kind: taskKind,
        agent_profile_id: selectedAgentProfileId || undefined,
        environment_profile_id: selectedEnvironmentProfileId || undefined,
        metadata: {
          startupContext: {
            startupPackIds: selectedStartupPackIds,
            repoDocPaths: selectedRepoDocs,
            knowledgePagePaths: selectedKnowledgePagePaths,
            blueprintIds: selectedBlueprintIds,
            documentIds: selectedDocumentIds,
            externalSources: parseExternalSources(externalSourcesText),
            creativeContexts: availableCreativeRuns
              .filter((run) => selectedCreativeRunIds.includes(run.id))
              .map((run) => ({
                id: run.id,
                sku_name: run.skuName,
                created_at: run.createdAt,
                rollout_variant: run.rolloutVariant || null,
                research_topic: run.researchTopic || null,
                storage_uri: run.storageUri,
              })),
            operatorNotes,
          },
          managedRuntime: {
            agentProfileId: selectedAgentProfileId || null,
            environmentProfileId: selectedEnvironmentProfileId || null,
          },
        },
      };
      const response = await fetch("/api/admin/agent/sessions", {
        method: "POST",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Failed to create session");
      return response.json() as Promise<{ ok: boolean; session: AgentSessionRecord }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-agent-sessions"] });
      setSelectedSessionId(data.session.id);
    },
  });

  const createStartupPackMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: startupPackName,
        description: startupPackDescription,
        repoDocPaths: selectedRepoDocs,
        knowledgePagePaths: selectedKnowledgePagePaths,
        blueprintIds: selectedBlueprintIds,
        documentIds: selectedDocumentIds,
        externalSources: parseExternalSources(externalSourcesText),
        creativeContexts: availableCreativeRuns
          .filter((run) => selectedCreativeRunIds.includes(run.id))
          .map((run) => ({
            id: run.id,
            sku_name: run.skuName,
            created_at: run.createdAt,
            rollout_variant: run.rolloutVariant || null,
            research_topic: run.researchTopic || null,
            storage_uri: run.storageUri,
          })),
        operatorNotes,
      };
      const response = await fetch(
        editingStartupPackId
          ? `/api/admin/agent/startup-packs/${editingStartupPackId}`
          : "/api/admin/agent/startup-packs",
        {
          method: editingStartupPackId ? "PATCH" : "POST",
          headers: await withCsrfHeader({ "Content-Type": "application/json" }),
          body: JSON.stringify(payload),
        },
      );
      if (!response.ok) {
        throw new Error(
          editingStartupPackId
            ? "Failed to update startup pack"
            : "Failed to create startup pack",
        );
      }
      return response.json() as Promise<{ ok: boolean; startupPack: StartupPackRecord }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-agent-context-options"] });
      setSelectedStartupPackIds((current) =>
        current.includes(data.startupPack.id)
          ? current
          : [...current, data.startupPack.id],
      );
      setStartupPackName("");
      setStartupPackDescription("");
      setEditingStartupPackId(null);
    },
  });

  const createOpsDocumentMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/admin/agent/documents", {
        method: "POST",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          title: opsDocumentTitle,
          sourceFileUri: opsDocumentSourceFileUri,
          blueprintIds: selectedBlueprintIds,
          startupPackIds: selectedStartupPackIds,
          autoExtract: true,
        }),
      });
      if (!response.ok) throw new Error("Failed to create ops document");
      return response.json() as Promise<{ ok: boolean; document: OpsDocumentRecord }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-agent-context-options"] });
      setSelectedDocumentIds((current) =>
        current.includes(data.document.id)
          ? current
          : [...current, data.document.id],
      );
      setOpsDocumentTitle("");
      setOpsDocumentSourceFileUri("");
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async () => {
      if (!activeSessionId) {
        throw new Error("No session selected");
      }
      const sessionTaskKind = selectedSession?.task_kind || "operator_thread";
      const body = {
        task_kind: sessionTaskKind,
        input:
          sessionTaskKind === "support_triage"
            ? { summary: message, message }
            : sessionTaskKind === "external_harness_thread"
              ? { message, harness: "codex" }
              : { message },
      };

      const response = await fetch(
        `/api/admin/agent/sessions/${activeSessionId}/messages`,
        {
          method: "POST",
          headers: await withCsrfHeader({ "Content-Type": "application/json" }),
          body: JSON.stringify(body),
        },
      );
      if (!response.ok) throw new Error("Failed to send agent message");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-agent-runs", activeSessionId] });
      queryClient.invalidateQueries({ queryKey: ["admin-agent-sessions"] });
      queryClient.invalidateQueries({
        queryKey: ["admin-agent-action-logs", activeSessionId],
      });
      queryClient.invalidateQueries({ queryKey: ["admin-agent-events", activeSessionId] });
      queryClient.invalidateQueries({ queryKey: ["admin-agent-checkpoints", activeSessionId] });
      setMessage("");
    },
  });

  const approveRunMutation = useMutation({
    mutationFn: async (runId: string) => {
      const response = await fetch(`/api/admin/agent/runs/${runId}/approve`, {
        method: "POST",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
      });
      if (!response.ok) throw new Error("Failed to approve run");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-agent-runs", activeSessionId] });
      queryClient.invalidateQueries({
        queryKey: ["admin-agent-action-logs", activeSessionId],
      });
      queryClient.invalidateQueries({ queryKey: ["admin-agent-events", activeSessionId] });
    },
  });

  const cancelRunMutation = useMutation({
    mutationFn: async (runId: string) => {
      const response = await fetch(`/api/admin/agent/runs/${runId}/cancel`, {
        method: "POST",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
      });
      if (!response.ok) throw new Error("Failed to cancel run");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-agent-runs", activeSessionId] });
      queryClient.invalidateQueries({
        queryKey: ["admin-agent-action-logs", activeSessionId],
      });
      queryClient.invalidateQueries({ queryKey: ["admin-agent-events", activeSessionId] });
    },
  });

  const openClawSmokeTestMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/admin/agent/runtime/smoke-test", {
        method: "POST",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          model: openClawSmokeModel.trim() || undefined,
          includeArtifactProbe: true,
        }),
      });
      return response.json() as Promise<OpenClawSmokeTestResponse>;
    },
  });

  const forkSessionMutation = useMutation({
    mutationFn: async (phase: AgentThreadPhase) => {
      if (!activeSessionId) {
        throw new Error("No session selected");
      }

      const response = await fetch(`/api/admin/agent/sessions/${activeSessionId}/fork`, {
        method: "POST",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          phase,
          source_run_id: runs[0]?.id,
        }),
      });
      if (!response.ok) {
        throw new Error("Failed to create fresh handoff thread");
      }
      return response.json() as Promise<ForkSessionResponse>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-agent-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["admin-agent-runs", activeSessionId] });
      queryClient.invalidateQueries({
        queryKey: ["admin-agent-action-logs", activeSessionId],
      });
      queryClient.invalidateQueries({ queryKey: ["admin-agent-events", activeSessionId] });
      queryClient.invalidateQueries({ queryKey: ["admin-agent-checkpoints", activeSessionId] });
      queryClient.invalidateQueries({ queryKey: ["admin-agent-compactions", activeSessionId] });
      setSelectedSessionId(data.session.id);
    },
  });

  const startSessionMutation = useMutation({
    mutationFn: async () => {
      if (!activeSessionId) throw new Error("No session selected");
      const response = await fetch(`/api/admin/agent/sessions/${activeSessionId}/control/start`, {
        method: "POST",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
        body: JSON.stringify({ message: message.trim() || "Start the bounded task." }),
      });
      if (!response.ok) throw new Error("Failed to start session");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-agent-runs", activeSessionId] });
      queryClient.invalidateQueries({ queryKey: ["admin-agent-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["admin-agent-action-logs", activeSessionId] });
      queryClient.invalidateQueries({ queryKey: ["admin-agent-events", activeSessionId] });
    },
  });

  const interruptSessionMutation = useMutation({
    mutationFn: async () => {
      if (!activeSessionId) throw new Error("No session selected");
      const response = await fetch(`/api/admin/agent/sessions/${activeSessionId}/control/interrupt`, {
        method: "POST",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
        body: JSON.stringify({ reason: "Interrupted by operator from managed runtime console" }),
      });
      if (!response.ok) throw new Error("Failed to interrupt session");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-agent-runs", activeSessionId] });
      queryClient.invalidateQueries({ queryKey: ["admin-agent-events", activeSessionId] });
    },
  });

  const steerSessionMutation = useMutation({
    mutationFn: async () => {
      if (!activeSessionId) throw new Error("No session selected");
      const response = await fetch(`/api/admin/agent/sessions/${activeSessionId}/control/steer`, {
        method: "POST",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
        body: JSON.stringify({ message: steerMessage }),
      });
      if (!response.ok) throw new Error("Failed to steer session");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-agent-runs", activeSessionId] });
      queryClient.invalidateQueries({ queryKey: ["admin-agent-events", activeSessionId] });
      queryClient.invalidateQueries({ queryKey: ["admin-agent-action-logs", activeSessionId] });
      setSteerMessage("");
    },
  });

  const resumeSessionMutation = useMutation({
    mutationFn: async (checkpointId?: string) => {
      if (!activeSessionId) throw new Error("No session selected");
      const response = await fetch(`/api/admin/agent/sessions/${activeSessionId}/control/resume`, {
        method: "POST",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
        body: JSON.stringify({ checkpoint_id: checkpointId }),
      });
      if (!response.ok) throw new Error("Failed to resume session");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-agent-runs", activeSessionId] });
      queryClient.invalidateQueries({ queryKey: ["admin-agent-events", activeSessionId] });
      queryClient.invalidateQueries({ queryKey: ["admin-agent-checkpoints", activeSessionId] });
    },
  });

  const cancelSessionMutation = useMutation({
    mutationFn: async () => {
      if (!activeSessionId) throw new Error("No session selected");
      const response = await fetch(`/api/admin/agent/sessions/${activeSessionId}/control/cancel`, {
        method: "POST",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
        body: JSON.stringify({ reason: "Cancelled from managed runtime console" }),
      });
      if (!response.ok) throw new Error("Failed to cancel session");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-agent-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["admin-agent-runs", activeSessionId] });
      queryClient.invalidateQueries({ queryKey: ["admin-agent-events", activeSessionId] });
    },
  });

  const delegationMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/admin/agent/delegations", {
        method: "POST",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          title: delegationTitle,
          message: delegationMessage,
          agent_profile_id: delegationProfileId,
          environment_profile_id: delegationEnvironmentProfileId || null,
          parent_session_id: activeSessionId || null,
          parent_run_id: runs[0]?.id || null,
        }),
      });
      if (!response.ok) throw new Error("Failed to delegate managed task");
      return response.json() as Promise<{ ok: boolean; session: AgentSessionRecord }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-agent-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["admin-agent-events", activeSessionId] });
      setDelegationMessage("");
      setSelectedSessionId(data.session.id);
    },
  });

  const compactSessionMutation = useMutation({
    mutationFn: async () => {
      if (!activeSessionId) throw new Error("No session selected");
      const response = await fetch(`/api/admin/agent/sessions/${activeSessionId}/control/compact`, {
        method: "POST",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
        body: JSON.stringify({ phase: compactPhase }),
      });
      if (!response.ok) throw new Error("Failed to compact session");
      return response.json() as Promise<ForkSessionResponse>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-agent-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["admin-agent-compactions", activeSessionId] });
      queryClient.invalidateQueries({ queryKey: ["admin-agent-events", activeSessionId] });
      setSelectedSessionId(data.session.id);
    },
  });

  const saveProfileMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        key: profileEditorKey,
        name: profileEditorName,
        description: profileEditorDescription,
        task_kind: profileEditorTaskKind,
        capabilities: parseLineList(profileEditorCapabilities),
        human_gates: parseLineList(profileEditorHumanGates),
      };
      const response = await fetch(
        profileEditorId ? `/api/admin/agent/profiles/${profileEditorId}` : "/api/admin/agent/profiles",
        {
          method: profileEditorId ? "PATCH" : "POST",
          headers: await withCsrfHeader({ "Content-Type": "application/json" }),
          body: JSON.stringify(payload),
        },
      );
      if (!response.ok) throw new Error("Failed to save agent profile");
      return response.json() as Promise<{ ok: boolean; profile: AgentProfileRecord }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-agent-context-options"] });
      setSelectedAgentProfileId(data.profile.id);
      setDelegationProfileId((current) => current || data.profile.id);
      setProfileEditorId(null);
      setProfileEditorName("");
      setProfileEditorKey("");
      setProfileEditorDescription("");
      setProfileEditorCapabilities("");
      setProfileEditorHumanGates("");
    },
  });

  const saveEnvironmentMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        key: environmentEditorKey,
        name: environmentEditorName,
        description: environmentEditorDescription,
        lane: environmentEditorLane,
        package_set: parseLineList(environmentEditorPackages),
        secret_bindings: parseLineList(environmentEditorSecrets),
        repo_mounts: parseLineList(environmentEditorMounts),
      };
      const response = await fetch(
        environmentEditorId
          ? `/api/admin/agent/environments/${environmentEditorId}`
          : "/api/admin/agent/environments",
        {
          method: environmentEditorId ? "PATCH" : "POST",
          headers: await withCsrfHeader({ "Content-Type": "application/json" }),
          body: JSON.stringify(payload),
        },
      );
      if (!response.ok) throw new Error("Failed to save environment profile");
      return response.json() as Promise<{ ok: boolean; environment: AgentEnvironmentProfileRecord }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-agent-context-options"] });
      setSelectedEnvironmentProfileId(data.environment.id);
      setDelegationEnvironmentProfileId((current) => current || data.environment.id);
      setEnvironmentEditorId(null);
      setEnvironmentEditorName("");
      setEnvironmentEditorKey("");
      setEnvironmentEditorDescription("");
      setEnvironmentEditorLane("session");
      setEnvironmentEditorPackages("");
      setEnvironmentEditorSecrets("");
      setEnvironmentEditorMounts("");
    },
  });

  const availableRepoDocs = contextOptionsQuery.data?.repoDocs || [];
  const availableKnowledgePages = contextOptionsQuery.data?.knowledgePages || [];
  const availableBlueprints = contextOptionsQuery.data?.blueprints || [];
  const availableOpsDocuments = contextOptionsQuery.data?.opsDocuments || [];
  const availableStartupPacks = contextOptionsQuery.data?.startupPacks || [];
  const availableProfiles = contextOptionsQuery.data?.profiles || [];
  const availableEnvironments = contextOptionsQuery.data?.environments || [];
  const availableCreativeRuns = contextOptionsQuery.data?.recentCreativeRuns || [];
  const runs = runsQuery.data?.runs || [];
  const actionLogs = actionLogsQuery.data?.actionLogs || [];
  const runtimeEvents = eventsQuery.data?.events || [];
  const checkpoints = checkpointsQuery.data?.checkpoints || [];
  const compactions = compactionsQuery.data?.compactions || [];
  const openClawConnectivity = openClawConnectivityQuery.data?.connectivity || null;
  const openClawSmokeResult = openClawSmokeTestMutation.data?.smokeTest || null;
  const openClawSmokeError =
    openClawSmokeTestMutation.data && !openClawSmokeTestMutation.data.ok
      ? openClawSmokeTestMutation.data.error || "Smoke test failed"
      : openClawSmokeTestMutation.error instanceof Error
        ? openClawSmokeTestMutation.error.message
        : null;

  const sessionStats = useMemo(
    () => ({
      totalSessions: sessionsQuery.data?.sessions.length || 0,
      pendingApprovals: runs.filter((run) => run.status === "pending_approval").length,
      running: runs.filter((run) => run.status === "running").length,
      failed: runs.filter((run) => run.status === "failed").length,
    }),
    [runs, sessionsQuery.data?.sessions.length],
  );

  const startupPackLabelById = useMemo(
    () =>
      new Map(
        availableStartupPacks.map((pack) => [
          pack.id,
          `${pack.name} · v${pack.version}`,
        ]),
      ),
    [availableStartupPacks],
  );

  const documentLabelById = useMemo(
    () =>
      new Map(
        availableOpsDocuments.map((document) => [
          document.id,
          document.title,
        ]),
      ),
    [availableOpsDocuments],
  );
  const knowledgePageLabelByPath = useMemo(
    () =>
      new Map(
        availableKnowledgePages.map((page) => [
          page.path,
          `${page.title}${page.pageKind ? ` · ${page.pageKind}` : ""}`,
        ]),
      ),
    [availableKnowledgePages],
  );
  const recommendedKnowledgePages = useMemo<KnowledgePageRecommendation[]>(() => {
    const selectedStartupPacks = availableStartupPacks.filter((pack) =>
      selectedStartupPackIds.includes(pack.id),
    );
    const startupPackKnowledgePaths = new Set(
      selectedStartupPacks.flatMap((pack) => pack.knowledgePagePaths || []),
    );
    const contextText = [title, operatorNotes, message]
      .filter(Boolean)
      .join(" \n ")
      .toLowerCase();

    const scored = availableKnowledgePages
      .map((page) => {
        let score = 0;
        const reasons: string[] = [];

        if (startupPackKnowledgePaths.has(page.path)) {
          score += 6;
          reasons.push("included in a selected startup pack");
        }

        if (selectedBlueprintIds.length > 0 && page.pageKind === "buyer_dossier") {
          score += 4;
          reasons.push("buyer dossier matches attached blueprint context");
        }

        if (taskKind === "operator_thread" && page.pageKind === "proof_pattern") {
          score += 3;
          reasons.push("proof-pattern context fits operator sessions");
        }

        if (taskKind === "external_harness_thread" && page.pageKind === "doctrine_claim") {
          score += 3;
          reasons.push("doctrine guidance helps bounded implementation work");
        }

        if (taskKind === "support_triage" && page.pageKind === "support_playbook") {
          score += 4;
          reasons.push("support playbook fits support triage");
        }

        if (
          page.pageKind === "support_playbook" &&
          matchesLooseText(contextText, ["support", "procurement", "security", "objection"])
        ) {
          score += 3;
          reasons.push("operator notes mention support or procurement topics");
        }

        if (
          page.pageKind === "proof_pattern" &&
          matchesLooseText(contextText, ["hosted review", "proof", "demo", "package", "exact-site"])
        ) {
          score += 3;
          reasons.push("operator notes mention proof or hosted-review work");
        }

        if (
          page.pageKind === "doctrine_claim" &&
          matchesLooseText(contextText, ["claim", "positioning", "wording", "doctrine"])
        ) {
          score += 3;
          reasons.push("operator notes mention doctrine or claim-shaping");
        }

        if (
          page.pageKind === "city_brief" &&
          matchesLooseText(contextText, ["city", "region", "launch", "market"])
        ) {
          score += 2;
          reasons.push("operator notes mention city or launch context");
        }

        if (
          page.pageKind === "market_entity" &&
          matchesLooseText(contextText, ["competitor", "market", "platform", "vendor"])
        ) {
          score += 2;
          reasons.push("operator notes mention market or competitor context");
        }

        return {
          page,
          score,
          reasons,
        };
      })
      .filter((entry) => entry.score > 0 && !selectedKnowledgePagePaths.includes(entry.page.path))
      .sort((left, right) => right.score - left.score || left.page.title.localeCompare(right.page.title))
      .slice(0, 6)
      .map((entry) => ({
        path: entry.page.path,
        title: entry.page.title,
        reason: entry.reasons[0] || "relevant to the current context",
      }));

    return scored;
  }, [
    availableKnowledgePages,
    availableStartupPacks,
    message,
    operatorNotes,
    selectedBlueprintIds,
    selectedKnowledgePagePaths,
    selectedStartupPackIds,
    taskKind,
    title,
  ]);
  const latestRun = runs[0] || null;
  const latestRunNeedsFreshThread = isContextWindowFailure(latestRun?.error);
  const workflowPhase = selectedSession?.metadata?.workflow?.phase;
  const workflowRetryCount = selectedSession?.metadata?.workflow?.retryCount ?? 0;
  const workflowHandoffPrompt = selectedSession?.metadata?.workflow?.handoffPrompt;
  const selectedProfile = availableProfiles.find((profile) => profile.id === selectedAgentProfileId) || null;
  const selectedEnvironment =
    availableEnvironments.find((environment) => environment.id === selectedEnvironmentProfileId) || null;
  const selectedDelegationProfile =
    availableProfiles.find((profile) => profile.id === delegationProfileId) || null;
  const sessionTimeline = useMemo(
    () =>
      [...runtimeEvents, ...actionLogs.map((log) => ({
        id: `action-${log.id}`,
        session_id: log.sessionId || activeSessionId || "",
        run_id: log.runId || null,
        kind: log.actionKey,
        status:
          log.status === "completed"
            ? "success"
            : log.status === "failed"
              ? "error"
              : log.status === "pending_approval"
                ? "warning"
                : "info",
        summary: log.summary || log.actionKey,
        detail: null,
        metadata: log.metadata || {},
        created_at: log.createdAt,
      }))].sort((a, b) => {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bTime - aTime;
      }),
    [runtimeEvents, actionLogs, activeSessionId],
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <p className="text-sm text-zinc-500">Sessions</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-950">{sessionStats.totalSessions}</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <p className="text-sm text-zinc-500">Pending approval</p>
          <p className="mt-2 text-3xl font-semibold text-amber-700">{sessionStats.pendingApprovals}</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <p className="text-sm text-zinc-500">Running</p>
          <p className="mt-2 text-3xl font-semibold text-blue-700">{sessionStats.running}</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <p className="text-sm text-zinc-500">Failed</p>
          <p className="mt-2 text-3xl font-semibold text-rose-700">{sessionStats.failed}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-zinc-500" />
              <h2 className="font-semibold text-zinc-950">Create agent session</h2>
            </div>
            <div className="mt-4 space-y-3">
              <input
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Session title"
              />
              <select
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                value={taskKind}
                onChange={(event) => setTaskKind(event.target.value as AgentTaskKind)}
              >
                {sessionTaskOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                value={selectedAgentProfileId}
                onChange={(event) => setSelectedAgentProfileId(event.target.value)}
              >
                <option value="">Select agent profile</option>
                {availableProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                    {profile.built_in ? " · built-in" : ""}
                  </option>
                ))}
              </select>
              <select
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                value={selectedEnvironmentProfileId}
                onChange={(event) => setSelectedEnvironmentProfileId(event.target.value)}
              >
                <option value="">Select environment profile</option>
                {availableEnvironments.map((environment) => (
                  <option key={environment.id} value={environment.id}>
                    {environment.name}
                    {environment.built_in ? " · built-in" : ""}
                  </option>
                ))}
              </select>
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
                Execution backend: {selectedProfile?.default_provider || "openai_responses"}
              </div>
              {selectedProfile ? (
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
                  <p className="font-medium text-zinc-900">{selectedProfile.name}</p>
                  {selectedProfile.description ? (
                    <p className="mt-1 text-zinc-600">{selectedProfile.description}</p>
                  ) : null}
                  <p className="mt-2 text-xs text-zinc-500">
                    Task kind: {selectedProfile.task_kind}
                    {selectedProfile.outcome_contract?.bounded_scope
                      ? ` · ${selectedProfile.outcome_contract.bounded_scope}`
                      : ""}
                  </p>
                </div>
              ) : null}
              {selectedEnvironment ? (
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
                  <p className="font-medium text-zinc-900">{selectedEnvironment.name}</p>
                  {selectedEnvironment.description ? (
                    <p className="mt-1 text-zinc-600">{selectedEnvironment.description}</p>
                  ) : null}
                  <p className="mt-2 text-xs text-zinc-500">
                    Lane: {selectedEnvironment.lane} · Packages:{" "}
                    {selectedEnvironment.package_set.join(", ") || "None"}
                  </p>
                </div>
              ) : null}

              <div className="rounded-xl border border-zinc-200 p-3">
                <div className="flex items-center gap-2">
                  <Layers3 className="h-4 w-4 text-zinc-500" />
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Attach startup packs
                  </p>
                </div>
                <div className="mt-2 max-h-36 space-y-2 overflow-y-auto">
                  {availableStartupPacks.length === 0 ? (
                    <p className="text-sm text-zinc-500">
                      No saved startup packs yet.
                    </p>
                  ) : (
                    availableStartupPacks.map((pack) => (
                      <div
                        key={pack.id}
                        className="flex items-start justify-between gap-3 text-sm text-zinc-700"
                      >
                        <label className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            checked={selectedStartupPackIds.includes(pack.id)}
                            onChange={() =>
                              setSelectedStartupPackIds((current) =>
                                current.includes(pack.id)
                                  ? current.filter((value) => value !== pack.id)
                                  : [...current, pack.id],
                              )
                            }
                          />
                          <span>
                            {pack.name}
                            <span className="ml-1 text-xs text-zinc-400">
                              v{pack.version}
                            </span>
                            {pack.description ? (
                              <span className="block text-xs text-zinc-500">
                                {pack.description}
                              </span>
                            ) : null}
                          </span>
                        </label>
                        <button
                          type="button"
                          className="text-xs text-zinc-500 underline"
                          onClick={() => {
                            setEditingStartupPackId(pack.id);
                            setStartupPackName(pack.name);
                            setStartupPackDescription(pack.description || "");
                            setSelectedRepoDocs(pack.repoDocPaths || []);
                            setSelectedKnowledgePagePaths(pack.knowledgePagePaths || []);
                            setSelectedBlueprintIds(pack.blueprintIds || []);
                            setSelectedDocumentIds(pack.documentIds || []);
                            setSelectedCreativeRunIds(
                              (pack.creativeContexts || []).map((context) => context.id),
                            );
                            setExternalSourcesText(
                              (pack.externalSources || [])
                                .map(
                                  (source) =>
                                    `${source.title} | ${source.url} | ${source.description || ""}`,
                                )
                                .join("\n"),
                            );
                            setOperatorNotes(pack.operatorNotes || "");
                          }}
                        >
                          Edit
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-zinc-200 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Attach repo docs
                </p>
                <div className="mt-2 max-h-40 space-y-2 overflow-y-auto">
                  {availableRepoDocs.slice(0, 20).map((docPath) => (
                    <label key={docPath} className="flex items-start gap-2 text-sm text-zinc-700">
                      <input
                        type="checkbox"
                        checked={selectedRepoDocs.includes(docPath)}
                        onChange={() =>
                          setSelectedRepoDocs((current) =>
                            current.includes(docPath)
                              ? current.filter((value) => value !== docPath)
                              : [...current, docPath],
                          )
                        }
                      />
                      <span>{docPath}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-zinc-200 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Attach KB pages
                </p>
                {recommendedKnowledgePages.length > 0 ? (
                  <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50/70 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                        Recommended
                      </p>
                      <button
                        type="button"
                        className="text-xs text-emerald-700 underline"
                        onClick={() =>
                          setSelectedKnowledgePagePaths((current) => [
                            ...current,
                            ...recommendedKnowledgePages
                              .map((page) => page.path)
                              .filter((pagePath) => !current.includes(pagePath)),
                          ])
                        }
                      >
                        Add all
                      </button>
                    </div>
                    <div className="mt-2 space-y-2">
                      {recommendedKnowledgePages.map((page) => (
                        <div
                          key={page.path}
                          className="flex items-start justify-between gap-3 text-sm text-zinc-700"
                        >
                          <div>
                            <p className="font-medium text-zinc-900">{page.title}</p>
                            <p className="text-xs text-zinc-500">{page.reason}</p>
                          </div>
                          <button
                            type="button"
                            className="text-xs text-emerald-700 underline"
                            onClick={() =>
                              setSelectedKnowledgePagePaths((current) =>
                                current.includes(page.path) ? current : [...current, page.path],
                              )
                            }
                          >
                            Add
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="mt-2 max-h-40 space-y-2 overflow-y-auto">
                  {availableKnowledgePages.length === 0 ? (
                    <p className="text-sm text-zinc-500">No KB pages available yet.</p>
                  ) : (
                    availableKnowledgePages.map((page) => (
                      <label key={page.path} className="flex items-start gap-2 text-sm text-zinc-700">
                        <input
                          type="checkbox"
                          checked={selectedKnowledgePagePaths.includes(page.path)}
                          onChange={() =>
                            setSelectedKnowledgePagePaths((current) =>
                              current.includes(page.path)
                                ? current.filter((value) => value !== page.path)
                                : [...current, page.path],
                            )
                          }
                        />
                        <span>
                          {page.title}
                          {page.pageKind ? (
                            <span className="ml-1 text-xs text-zinc-400">{page.pageKind}</span>
                          ) : null}
                          <span className="block text-xs text-zinc-500">{page.path}</span>
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-zinc-200 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Attach ops documents
                </p>
                <div className="mt-2 max-h-36 space-y-2 overflow-y-auto">
                  {availableOpsDocuments.length === 0 ? (
                    <p className="text-sm text-zinc-500">No ops documents yet.</p>
                  ) : (
                    availableOpsDocuments.map((document) => (
                      <label
                        key={document.id}
                        className="flex items-start gap-2 text-sm text-zinc-700"
                      >
                        <input
                          type="checkbox"
                          checked={selectedDocumentIds.includes(document.id)}
                          onChange={() =>
                            setSelectedDocumentIds((current) =>
                              current.includes(document.id)
                                ? current.filter((value) => value !== document.id)
                                : [...current, document.id],
                            )
                          }
                        />
                        <span>
                          {document.title}
                          <span className="ml-1 text-xs text-zinc-400">
                            {document.extractionStatus}
                          </span>
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-zinc-200 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Attach recent creative runs
                </p>
                <div className="mt-2 max-h-36 space-y-2 overflow-y-auto">
                  {availableCreativeRuns.length === 0 ? (
                    <p className="text-sm text-zinc-500">No durable creative runs yet.</p>
                  ) : (
                    availableCreativeRuns.map((run) => (
                      <label key={run.id} className="flex items-start gap-2 text-sm text-zinc-700">
                        <input
                          type="checkbox"
                          checked={selectedCreativeRunIds.includes(run.id)}
                          onChange={() =>
                            setSelectedCreativeRunIds((current) =>
                              current.includes(run.id)
                                ? current.filter((value) => value !== run.id)
                                : [...current, run.id],
                            )
                          }
                        />
                        <span>
                          {run.skuName}
                          <span className="ml-1 text-xs text-zinc-400">
                            {run.createdAt ? formatTimestamp(run.createdAt) : "Unknown time"}
                          </span>
                          <span className="block break-all font-mono text-[11px] text-zinc-500">
                            {run.storageUri}
                          </span>
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-zinc-200 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Attach blueprints
                </p>
                <div className="mt-2 max-h-36 space-y-2 overflow-y-auto">
                  {availableBlueprints.map((blueprint) => (
                    <label key={blueprint.id} className="flex items-start gap-2 text-sm text-zinc-700">
                      <input
                        type="checkbox"
                        checked={selectedBlueprintIds.includes(blueprint.id)}
                        onChange={() =>
                          setSelectedBlueprintIds((current) =>
                            current.includes(blueprint.id)
                              ? current.filter((value) => value !== blueprint.id)
                              : [...current, blueprint.id],
                          )
                        }
                      />
                      <span>{blueprint.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <textarea
                className="min-h-[90px] w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                value={operatorNotes}
                onChange={(event) => setOperatorNotes(event.target.value)}
                placeholder="Operator notes for this session"
              />
              <textarea
                className="min-h-[90px] w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                value={externalSourcesText}
                onChange={(event) => setExternalSourcesText(event.target.value)}
                placeholder={"External references, one per line:\nTitle | https://url | Optional description"}
              />

              <div className="rounded-xl border border-dashed border-zinc-300 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  {editingStartupPackId ? "Update startup pack" : "Save current context as startup pack"}
                </p>
                <div className="mt-3 space-y-3">
                  <input
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                    value={startupPackName}
                    onChange={(event) => setStartupPackName(event.target.value)}
                    placeholder="Startup pack name"
                  />
                  <input
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                    value={startupPackDescription}
                    onChange={(event) => setStartupPackDescription(event.target.value)}
                    placeholder="Short description"
                  />
                  <button
                    type="button"
                    onClick={() => createStartupPackMutation.mutate()}
                    className="inline-flex items-center rounded-full border border-zinc-300 px-4 py-2 text-sm text-zinc-800"
                    disabled={
                      createStartupPackMutation.isPending || !startupPackName.trim()
                    }
                  >
                    {createStartupPackMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Layers3 className="mr-2 h-4 w-4" />
                    )}
                    {editingStartupPackId ? "Update startup pack" : "Save startup pack"}
                  </button>
                  {editingStartupPackId ? (
                    <button
                      type="button"
                      className="ml-2 inline-flex items-center rounded-full border border-zinc-300 px-4 py-2 text-sm text-zinc-700"
                      onClick={() => {
                        setEditingStartupPackId(null);
                        setStartupPackName("");
                        setStartupPackDescription("");
                        setSelectedKnowledgePagePaths([]);
                      }}
                    >
                      Clear edit
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="rounded-xl border border-dashed border-zinc-300 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Create ops document
                </p>
                <div className="mt-3 space-y-3">
                  <input
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                    value={opsDocumentTitle}
                    onChange={(event) => setOpsDocumentTitle(event.target.value)}
                    placeholder="Document title"
                  />
                  <input
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                    value={opsDocumentSourceFileUri}
                    onChange={(event) => setOpsDocumentSourceFileUri(event.target.value)}
                    placeholder="PDF source URI"
                  />
                  <button
                    type="button"
                    onClick={() => createOpsDocumentMutation.mutate()}
                    className="inline-flex items-center rounded-full border border-zinc-300 px-4 py-2 text-sm text-zinc-800"
                    disabled={
                      createOpsDocumentMutation.isPending ||
                      !opsDocumentTitle.trim() ||
                      !opsDocumentSourceFileUri.trim()
                    }
                  >
                    {createOpsDocumentMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Layers3 className="mr-2 h-4 w-4" />
                    )}
                    Create and extract document
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-dashed border-zinc-300 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Agent profile library
                </p>
                <div className="mt-3 space-y-2">
                  <div className="max-h-36 space-y-2 overflow-y-auto">
                    {availableProfiles.map((profile) => (
                      <div key={profile.id} className="flex items-start justify-between gap-3 rounded-lg border border-zinc-200 p-2 text-sm">
                        <div>
                          <p className="font-medium text-zinc-900">{profile.name}</p>
                          <p className="text-xs text-zinc-500">{profile.task_kind}</p>
                        </div>
                        <button
                          type="button"
                          className="text-xs text-zinc-500 underline"
                          onClick={() => {
                            setProfileEditorId(profile.built_in ? null : profile.id);
                            setProfileEditorName(profile.name);
                            setProfileEditorKey(profile.key);
                            setProfileEditorDescription(profile.description || "");
                            setProfileEditorTaskKind(profile.task_kind);
                            setProfileEditorCapabilities((profile.capabilities || []).join("\n"));
                            setProfileEditorHumanGates((profile.human_gates || []).join("\n"));
                          }}
                        >
                          {profile.built_in ? "Clone" : "Edit"}
                        </button>
                      </div>
                    ))}
                  </div>
                  <input
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                    value={profileEditorName}
                    onChange={(event) => setProfileEditorName(event.target.value)}
                    placeholder="Profile name"
                  />
                  <input
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                    value={profileEditorKey}
                    onChange={(event) => setProfileEditorKey(event.target.value)}
                    placeholder="Profile key"
                  />
                  <select
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                    value={profileEditorTaskKind}
                    onChange={(event) => setProfileEditorTaskKind(event.target.value as AgentTaskKind)}
                  >
                    {sessionTaskOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <textarea
                    className="min-h-[72px] w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                    value={profileEditorDescription}
                    onChange={(event) => setProfileEditorDescription(event.target.value)}
                    placeholder="Profile description"
                  />
                  <textarea
                    className="min-h-[72px] w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                    value={profileEditorCapabilities}
                    onChange={(event) => setProfileEditorCapabilities(event.target.value)}
                    placeholder="Capabilities, one per line"
                  />
                  <textarea
                    className="min-h-[72px] w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                    value={profileEditorHumanGates}
                    onChange={(event) => setProfileEditorHumanGates(event.target.value)}
                    placeholder="Human gates, one per line"
                  />
                  <button
                    type="button"
                    onClick={() => saveProfileMutation.mutate()}
                    className="inline-flex items-center rounded-full border border-zinc-300 px-4 py-2 text-sm text-zinc-800"
                    disabled={!profileEditorName.trim() || !profileEditorKey.trim() || saveProfileMutation.isPending}
                  >
                    {saveProfileMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Layers3 className="mr-2 h-4 w-4" />
                    )}
                    {profileEditorId ? "Update profile" : "Create profile"}
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-dashed border-zinc-300 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Environment library
                </p>
                <div className="mt-3 space-y-2">
                  <div className="max-h-36 space-y-2 overflow-y-auto">
                    {availableEnvironments.map((environment) => (
                      <div key={environment.id} className="flex items-start justify-between gap-3 rounded-lg border border-zinc-200 p-2 text-sm">
                        <div>
                          <p className="font-medium text-zinc-900">{environment.name}</p>
                          <p className="text-xs text-zinc-500">{environment.lane}</p>
                        </div>
                        <button
                          type="button"
                          className="text-xs text-zinc-500 underline"
                          onClick={() => {
                            setEnvironmentEditorId(environment.built_in ? null : environment.id);
                            setEnvironmentEditorName(environment.name);
                            setEnvironmentEditorKey(environment.key);
                            setEnvironmentEditorDescription(environment.description || "");
                            setEnvironmentEditorLane(environment.lane);
                            setEnvironmentEditorPackages((environment.package_set || []).join("\n"));
                            setEnvironmentEditorSecrets((environment.secret_bindings || []).join("\n"));
                            setEnvironmentEditorMounts((environment.repo_mounts || []).join("\n"));
                          }}
                        >
                          {environment.built_in ? "Clone" : "Edit"}
                        </button>
                      </div>
                    ))}
                  </div>
                  <input
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                    value={environmentEditorName}
                    onChange={(event) => setEnvironmentEditorName(event.target.value)}
                    placeholder="Environment name"
                  />
                  <input
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                    value={environmentEditorKey}
                    onChange={(event) => setEnvironmentEditorKey(event.target.value)}
                    placeholder="Environment key"
                  />
                  <input
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                    value={environmentEditorLane}
                    onChange={(event) => setEnvironmentEditorLane(event.target.value)}
                    placeholder="Lane"
                  />
                  <textarea
                    className="min-h-[72px] w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                    value={environmentEditorDescription}
                    onChange={(event) => setEnvironmentEditorDescription(event.target.value)}
                    placeholder="Environment description"
                  />
                  <textarea
                    className="min-h-[72px] w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                    value={environmentEditorPackages}
                    onChange={(event) => setEnvironmentEditorPackages(event.target.value)}
                    placeholder="Packages, one per line"
                  />
                  <textarea
                    className="min-h-[72px] w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                    value={environmentEditorSecrets}
                    onChange={(event) => setEnvironmentEditorSecrets(event.target.value)}
                    placeholder="Secrets, one per line"
                  />
                  <textarea
                    className="min-h-[72px] w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                    value={environmentEditorMounts}
                    onChange={(event) => setEnvironmentEditorMounts(event.target.value)}
                    placeholder="Repo mounts, one per line"
                  />
                  <button
                    type="button"
                    onClick={() => saveEnvironmentMutation.mutate()}
                    className="inline-flex items-center rounded-full border border-zinc-300 px-4 py-2 text-sm text-zinc-800"
                    disabled={!environmentEditorName.trim() || !environmentEditorKey.trim() || saveEnvironmentMutation.isPending}
                  >
                    {saveEnvironmentMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Layers3 className="mr-2 h-4 w-4" />
                    )}
                    {environmentEditorId ? "Update environment" : "Create environment"}
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => createSessionMutation.mutate()}
                className="inline-flex items-center rounded-full bg-zinc-950 px-4 py-2 text-sm text-white"
                disabled={createSessionMutation.isPending}
              >
                {createSessionMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <PlayCircle className="mr-2 h-4 w-4" />
                )}
                Create session
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-zinc-500" />
              <h2 className="font-semibold text-zinc-950">Sessions</h2>
            </div>
            <div className="mt-4 space-y-2">
              {sessionsQuery.isLoading ? (
                <p className="text-sm text-zinc-500">Loading sessions...</p>
              ) : (sessionsQuery.data?.sessions || []).length === 0 ? (
                <p className="text-sm text-zinc-500">No agent sessions yet.</p>
              ) : (
                sessionsQuery.data?.sessions.map((session) => (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => setSelectedSessionId(session.id)}
                    className={`w-full rounded-xl border p-3 text-left ${
                      selectedSessionId === session.id
                        ? "border-zinc-950 bg-zinc-50"
                        : "border-zinc-200 bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-zinc-900">{session.title}</p>
                        <p className="text-xs text-zinc-500">
                          {session.task_kind} · {session.provider}
                        </p>
                        {session.metadata?.managedRuntime?.profileName ? (
                          <p className="text-[11px] text-zinc-400">
                            {session.metadata.managedRuntime.profileName}
                            {session.metadata.managedRuntime.environmentName
                              ? ` · ${session.metadata.managedRuntime.environmentName}`
                              : ""}
                          </p>
                        ) : null}
                      </div>
                      <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-700">
                        {session.status}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-zinc-400">
                      Updated {formatTimestamp(session.updated_at)}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-zinc-500" />
                <h2 className="font-semibold text-zinc-950">Agent runtime</h2>
              </div>
              <button
                type="button"
                onClick={() =>
                  openClawConnectivityQuery.refetch({
                    throwOnError: false,
                  })
                }
                className="rounded-full border border-zinc-200 px-3 py-1 text-xs text-zinc-700"
                disabled={openClawConnectivityQuery.isFetching}
              >
                {openClawConnectivityQuery.isFetching ? "Checking..." : "Check runtime connectivity"}
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm text-zinc-700">
              {openClawConnectivityQuery.isLoading ? (
                <p className="text-zinc-500">Loading runtime connectivity...</p>
              ) : openClawConnectivity ? (
                <>
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          openClawConnectivity.configured
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-rose-100 text-rose-700"
                        }`}
                      >
                        {openClawConnectivity.configured ? "configured" : "not configured"}
                      </span>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          openClawConnectivity.auth_configured
                            ? "bg-blue-100 text-blue-700"
                            : "bg-zinc-100 text-zinc-700"
                        }`}
                      >
                        {openClawConnectivity.auth_configured ? "configured" : "not configured"}
                      </span>
                    </div>
                    <p className="mt-3">
                      Provider: {openClawConnectivity.provider || "openai_responses"}
                    </p>
                    <p className="mt-1">
                      Default model: {openClawConnectivity.default_model || "Fallback to gpt-5.4"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-dashed border-zinc-300 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                      Smoke test
                    </p>
                    <input
                      className="mt-3 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                      value={openClawSmokeModel}
                      onChange={(event) => setOpenClawSmokeModel(event.target.value)}
                      placeholder="Optional model override"
                    />
                    <button
                      type="button"
                      onClick={() => openClawSmokeTestMutation.mutate()}
                      className="mt-3 inline-flex items-center rounded-full bg-zinc-950 px-4 py-2 text-sm text-white"
                      disabled={openClawSmokeTestMutation.isPending}
                    >
                      {openClawSmokeTestMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <PlayCircle className="mr-2 h-4 w-4" />
                      )}
                      Run smoke test
                    </button>
                    {openClawSmokeError ? (
                      <p className="mt-3 text-sm text-rose-700">{openClawSmokeError}</p>
                    ) : null}
                    {openClawSmokeResult ? (
                      <div className="mt-3 rounded-lg bg-zinc-950 p-3 text-xs text-zinc-100">
                        <p>Status: {openClawSmokeResult.ok ? "passed" : "failed"}</p>
                        <p>Duration: {formatLatency(openClawSmokeResult.duration_ms) || `${openClawSmokeResult.duration_ms} ms`}</p>
                        <p>Provider: {("provider" in (openClawSmokeResult.final || {}) ? (openClawSmokeResult.final as { provider?: string }).provider : "openai_responses") || "openai_responses"}</p>
                        <p>Final status: {openClawSmokeResult.final?.status || "Unknown"}</p>
                      </div>
                    ) : null}
                  </div>
                </>
              ) : (
                <p className="text-zinc-500">No runtime connectivity data yet.</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5">
            <h2 className="font-semibold text-zinc-950">Selected session</h2>
            {selectedSession ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-xl bg-zinc-50 p-4">
                  <p className="font-medium text-zinc-900">{selectedSession.title}</p>
                  <p className="mt-1 text-sm text-zinc-600">
                    {selectedSession.task_kind} · {selectedSession.provider}
                  </p>
                  {selectedSession.metadata?.managedRuntime?.profileName ? (
                    <p className="mt-1 text-xs text-zinc-500">
                      Profile: {selectedSession.metadata.managedRuntime.profileName}
                      {selectedSession.metadata.managedRuntime.environmentName
                        ? ` · Environment: ${selectedSession.metadata.managedRuntime.environmentName}`
                        : ""}
                    </p>
                  ) : null}
                  {workflowPhase ? (
                    <p className="mt-1 text-xs text-zinc-500">
                      Phase: {phaseLabel(workflowPhase)}
                      {workflowRetryCount > 0 ? ` · Retry ${workflowRetryCount + 1}` : ""}
                    </p>
                  ) : null}
                  <p className="mt-2 text-xs text-zinc-500">
                    Last updated {formatTimestamp(selectedSession.updated_at)}
                  </p>
                </div>

                <div className="rounded-xl border border-zinc-200 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Live controls
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => startSessionMutation.mutate()}
                      className="inline-flex items-center rounded-full border border-zinc-300 px-3 py-1 text-xs text-zinc-800"
                      disabled={startSessionMutation.isPending}
                    >
                      {startSessionMutation.isPending ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <PlayCircle className="mr-1 h-3 w-3" />
                      )}
                      Start
                    </button>
                    <button
                      type="button"
                      onClick={() => interruptSessionMutation.mutate()}
                      className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs text-amber-800"
                      disabled={interruptSessionMutation.isPending}
                    >
                      {interruptSessionMutation.isPending ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <SquareX className="mr-1 h-3 w-3" />
                      )}
                      Interrupt
                    </button>
                    <button
                      type="button"
                      onClick={() => resumeSessionMutation.mutate(selectedSession.latest_checkpoint_id || undefined)}
                      className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs text-blue-700"
                      disabled={resumeSessionMutation.isPending}
                    >
                      {resumeSessionMutation.isPending ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <PlayCircle className="mr-1 h-3 w-3" />
                      )}
                      Resume
                    </button>
                    <button
                      type="button"
                      onClick={() => cancelSessionMutation.mutate()}
                      className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs text-rose-700"
                      disabled={cancelSessionMutation.isPending}
                    >
                      {cancelSessionMutation.isPending ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <SquareX className="mr-1 h-3 w-3" />
                      )}
                      Cancel session
                    </button>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <select
                      className="rounded-lg border border-zinc-200 px-3 py-2 text-xs"
                      value={compactPhase}
                      onChange={(event) => setCompactPhase(event.target.value as AgentThreadPhase)}
                    >
                      <option value="investigation">Investigation</option>
                      <option value="implementation">Implementation</option>
                      <option value="review_qa">Review/QA</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => compactSessionMutation.mutate()}
                      className="inline-flex items-center rounded-full border border-zinc-300 px-3 py-1 text-xs text-zinc-800"
                      disabled={compactSessionMutation.isPending}
                    >
                      {compactSessionMutation.isPending ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <Layers3 className="mr-1 h-3 w-3" />
                      )}
                      Compact into fresh thread
                    </button>
                  </div>
                  <textarea
                    className="mt-3 min-h-[88px] w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                    value={steerMessage}
                    onChange={(event) => setSteerMessage(event.target.value)}
                    placeholder="Steer the active session with a fresh instruction"
                  />
                  <button
                    type="button"
                    onClick={() => steerSessionMutation.mutate()}
                    className="mt-3 inline-flex items-center rounded-full border border-zinc-300 px-3 py-1 text-xs text-zinc-800"
                    disabled={steerSessionMutation.isPending || !steerMessage.trim()}
                  >
                    {steerSessionMutation.isPending ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <MessageSquare className="mr-1 h-3 w-3" />
                    )}
                    Steer active run
                  </button>
                </div>

                <div className="rounded-xl border border-zinc-200 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Human delegation
                  </p>
                  <p className="mt-2 text-sm text-zinc-600">
                    Assign a bounded task to another managed agent profile without touching raw Paperclip state.
                  </p>
                  <div className="mt-3 grid gap-3">
                    <input
                      className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                      value={delegationTitle}
                      onChange={(event) => setDelegationTitle(event.target.value)}
                      placeholder="Delegation title"
                    />
                    <select
                      className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                      value={delegationProfileId}
                      onChange={(event) => setDelegationProfileId(event.target.value)}
                    >
                      <option value="">Select subagent profile</option>
                      {availableProfiles.map((profile) => (
                        <option key={profile.id} value={profile.id}>
                          {profile.name}
                        </option>
                      ))}
                    </select>
                    <select
                      className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                      value={delegationEnvironmentProfileId}
                      onChange={(event) => setDelegationEnvironmentProfileId(event.target.value)}
                    >
                      <option value="">Select environment</option>
                      {availableEnvironments.map((environment) => (
                        <option key={environment.id} value={environment.id}>
                          {environment.name}
                        </option>
                      ))}
                    </select>
                    {selectedDelegationProfile?.outcome_contract ? (
                      <div className="rounded-lg bg-zinc-50 p-3 text-xs text-zinc-600">
                        Outcome contract: {selectedDelegationProfile.outcome_contract.objective}
                      </div>
                    ) : null}
                    <textarea
                      className="min-h-[100px] w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                      value={delegationMessage}
                      onChange={(event) => setDelegationMessage(event.target.value)}
                      placeholder="Bounded task for the delegated agent"
                    />
                    <button
                      type="button"
                      onClick={() => delegationMutation.mutate()}
                      className="inline-flex items-center rounded-full border border-zinc-300 px-3 py-1 text-xs text-zinc-800"
                      disabled={
                        delegationMutation.isPending ||
                        !delegationTitle.trim() ||
                        !delegationMessage.trim() ||
                        !delegationProfileId
                      }
                    >
                      {delegationMutation.isPending ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <Layers3 className="mr-1 h-3 w-3" />
                      )}
                      Delegate bounded task
                    </button>
                  </div>
                </div>

                {selectedSession.metadata?.latest_outcome_evaluation ? (
                  <div className="rounded-xl border border-zinc-200 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                      Latest outcome grade
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          selectedSession.metadata.latest_outcome_evaluation.status === "pass"
                            ? "bg-emerald-100 text-emerald-700"
                            : selectedSession.metadata.latest_outcome_evaluation.status === "partial"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-rose-100 text-rose-700"
                        }`}
                      >
                        {selectedSession.metadata.latest_outcome_evaluation.status}
                      </span>
                      <span className="text-sm text-zinc-600">
                        {scorePercent(selectedSession.metadata.latest_outcome_evaluation.score)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-zinc-700">
                      {selectedSession.metadata.latest_outcome_evaluation.summary}
                    </p>
                  </div>
                ) : null}

                <div className="rounded-xl border border-zinc-200 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Fresh thread actions
                  </p>
                  <p className="mt-2 text-sm text-zinc-600">
                    Create bounded follow-up sessions with a compressed handoff instead of carrying the full history forward.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(["investigation", "implementation", "review_qa"] as AgentThreadPhase[]).map((phase) => (
                      <button
                        key={phase}
                        type="button"
                        onClick={() => forkSessionMutation.mutate(phase)}
                        className="inline-flex items-center rounded-full border border-zinc-300 px-3 py-1 text-xs text-zinc-800"
                        disabled={forkSessionMutation.isPending}
                      >
                        {forkSessionMutation.isPending ? (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        ) : (
                          <PlayCircle className="mr-1 h-3 w-3" />
                        )}
                        Start {phaseLabel(phase)} thread
                      </button>
                    ))}
                  </div>
                  {forkSessionMutation.isError && forkSessionMutation.error instanceof Error ? (
                    <p className="mt-3 text-sm text-rose-700">{forkSessionMutation.error.message}</p>
                  ) : null}
                </div>

                {latestRunNeedsFreshThread ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                    <p className="font-medium">Latest run hit a context-window failure.</p>
                    <p className="mt-2">
                      Start a fresh thread with a compressed handoff, retry once there, then split or reroute the work if it fails again.
                    </p>
                  </div>
                ) : null}

                <div className="rounded-xl border border-zinc-200 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Attached startup context
                  </p>
                  <div className="mt-3 space-y-2 text-sm text-zinc-700">
                    <p>
                      Startup packs:{" "}
                      {(selectedSession.metadata?.startupContext?.startupPackIds || [])
                        .map((startupPackId) =>
                          startupPackLabelById.get(startupPackId) || startupPackId,
                        )
                        .join(", ") || "None"}
                    </p>
                    <p>
                      Repo docs:{" "}
                      {(selectedSession.metadata?.startupContext?.repoDocPaths || []).join(", ") ||
                        "None"}
                    </p>
                    <p>
                      KB pages:{" "}
                      {(selectedSession.metadata?.startupContext?.knowledgePagePaths || [])
                        .map((pagePath) => knowledgePageLabelByPath.get(pagePath) || pagePath)
                        .join(", ") || "None"}
                    </p>
                    <p>
                      Blueprints:{" "}
                      {(selectedSession.metadata?.startupContext?.blueprintIds || []).join(", ") ||
                        "None"}
                    </p>
                    <p>
                      Documents:{" "}
                      {(selectedSession.metadata?.startupContext?.documentIds || [])
                        .map((documentId) => documentLabelById.get(documentId) || documentId)
                        .join(", ") || "None"}
                    </p>
                    <p>
                      External references:{" "}
                      {(selectedSession.metadata?.startupContext?.externalSources || [])
                        .map((source) => source.title)
                        .join(", ") || "None"}
                    </p>
                    <div>
                      <p>
                        Creative contexts:{" "}
                        {(selectedSession.metadata?.startupContext?.creativeContexts || [])
                          .map((context) => context.id)
                          .join(", ") || "None"}
                      </p>
                      {(selectedSession.metadata?.startupContext?.creativeContexts || []).length > 0 ? (
                        <div className="mt-2 space-y-2">
                          {(selectedSession.metadata?.startupContext?.creativeContexts || []).map((context) => (
                            <p key={context.id} className="break-all font-mono text-[11px] text-zinc-500">
                              {context.storage_uri}
                            </p>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    {selectedSession.metadata?.startupContext?.operatorNotes ? (
                      <p>Notes: {selectedSession.metadata.startupContext.operatorNotes}</p>
                    ) : null}
                  </div>
                </div>

                {workflowHandoffPrompt ? (
                  <div className="rounded-xl border border-zinc-200 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                      Generated handoff
                    </p>
                    <pre className="mt-3 overflow-x-auto rounded-lg bg-zinc-950 p-3 text-xs text-zinc-100">
                      {workflowHandoffPrompt}
                    </pre>
                  </div>
                ) : null}

                <textarea
                  className="min-h-[120px] w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Send a message into this agent session"
                />
                <button
                  type="button"
                  onClick={() => sendMessageMutation.mutate()}
                  className="inline-flex items-center rounded-full bg-zinc-950 px-4 py-2 text-sm text-white"
                  disabled={sendMessageMutation.isPending || !message.trim()}
                >
                  {sendMessageMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <MessageSquare className="mr-2 h-4 w-4" />
                  )}
                  Send message
                </button>
              </div>
            ) : (
              <p className="mt-4 text-sm text-zinc-500">Select or create a session to begin.</p>
            )}
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5">
            <div className="flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-zinc-500" />
              <h2 className="font-semibold text-zinc-950">Run history</h2>
            </div>
            <div className="mt-4 space-y-3">
              {runsQuery.isLoading ? (
                <p className="text-sm text-zinc-500">Loading runs...</p>
              ) : runs.length === 0 ? (
                <p className="text-sm text-zinc-500">No runs for this session yet.</p>
              ) : (
                runs.map((run) => (
                  <div key={run.id} className="rounded-xl border border-zinc-200 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusColor(run.status)}`}>
                        {run.status}
                      </span>
                      <span className="text-xs text-zinc-500">
                        {run.provider} · {run.model}
                      </span>
                      <span className="text-xs text-zinc-400">
                        {formatTimestamp(run.created_at)}
                      </span>
                    </div>
                    {run.approval_reason ? (
                      <div className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                        <div className="flex items-start gap-2">
                          <ShieldAlert className="mt-0.5 h-4 w-4" />
                          <p>{run.approval_reason}</p>
                        </div>
                      </div>
                    ) : null}
                    {run.error ? (
                      <p className="mt-3 text-sm text-rose-700">{run.error}</p>
                    ) : null}
                    {run.outcome_evaluation ? (
                      <div className="mt-3 rounded-lg bg-zinc-50 p-3 text-sm text-zinc-700">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-medium ${
                              run.outcome_evaluation.status === "pass"
                                ? "bg-emerald-100 text-emerald-700"
                                : run.outcome_evaluation.status === "partial"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-rose-100 text-rose-700"
                            }`}
                          >
                            {run.outcome_evaluation.status}
                          </span>
                          <span className="text-xs text-zinc-500">
                            {scorePercent(run.outcome_evaluation.score)}
                          </span>
                        </div>
                        <p className="mt-2">{run.outcome_evaluation.summary}</p>
                      </div>
                    ) : null}
                    {run.outcome_contract ? (
                      <div className="mt-3 rounded-lg border border-zinc-200 p-3 text-sm text-zinc-700">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                          Outcome contract
                        </p>
                        <p className="mt-2">{run.outcome_contract.objective}</p>
                      </div>
                    ) : null}
                    {run.output ? (
                      <pre className="mt-3 overflow-x-auto rounded-lg bg-zinc-950 p-3 text-xs text-zinc-100">
                        {JSON.stringify(run.output, null, 2)}
                      </pre>
                    ) : null}
                    {run.metadata && Object.keys(run.metadata).length > 0 ? (
                      <pre className="mt-3 overflow-x-auto rounded-lg bg-zinc-100 p-3 text-xs text-zinc-800">
                        {JSON.stringify(run.metadata, null, 2)}
                      </pre>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {run.status === "pending_approval" &&
                      ["operator_thread", "external_harness_thread"].includes(run.task_kind) ? (
                        <button
                          type="button"
                          onClick={() => approveRunMutation.mutate(run.id)}
                          className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-700"
                        >
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Approve
                        </button>
                      ) : null}
                      {["queued", "running", "pending_approval"].includes(run.status) ? (
                        <button
                          type="button"
                          onClick={() => cancelRunMutation.mutate(run.id)}
                          className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs text-rose-700"
                        >
                          <SquareX className="mr-1 h-3 w-3" />
                          Cancel
                        </button>
                      ) : null}
                      {run.raw_output_text ? (
                        <a
                          className="inline-flex items-center rounded-full border border-zinc-200 px-3 py-1 text-xs text-zinc-700"
                          href={`data:text/plain;charset=utf-8,${encodeURIComponent(run.raw_output_text)}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Raw output
                          <ExternalLink className="ml-1 h-3 w-3" />
                        </a>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5">
            <div className="flex items-center gap-2">
              <Layers3 className="h-4 w-4 text-zinc-500" />
              <h2 className="font-semibold text-zinc-950">Action trail</h2>
            </div>
            <div className="mt-4 space-y-3">
              {actionLogsQuery.isLoading ? (
                <p className="text-sm text-zinc-500">Loading action logs...</p>
              ) : actionLogs.length === 0 ? (
                <p className="text-sm text-zinc-500">No action logs for this session yet.</p>
              ) : (
                actionLogs.map((log) => (
                  <div key={log.id} className="rounded-xl border border-zinc-200 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${actionLogStatusColor(log.status)}`}
                      >
                        {log.status}
                      </span>
                      <span className="text-xs font-medium text-zinc-700">
                        {log.actionKey}
                      </span>
                      <span className={`text-xs ${riskColor(log.riskLevel)}`}>
                        {log.riskLevel} risk
                      </span>
                      <span className="text-xs text-zinc-400">
                        {formatTimestamp(log.createdAt)}
                      </span>
                    </div>
                    {log.summary ? (
                      <p className="mt-3 text-sm text-zinc-700">{log.summary}</p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-zinc-500">
                      {log.provider ? <span>{log.provider}</span> : null}
                      {log.taskKind ? <span>{log.taskKind}</span> : null}
                      {formatLatency(log.latencyMs) ? (
                        <span>{formatLatency(log.latencyMs)}</span>
                      ) : null}
                      {log.requiresApproval ? <span>approval required</span> : null}
                      {!log.reversible ? <span>non-reversible</span> : null}
                    </div>
                    {log.metadata && Object.keys(log.metadata).length > 0 ? (
                      <pre className="mt-3 overflow-x-auto rounded-lg bg-zinc-950 p-3 text-xs text-zinc-100">
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5">
            <div className="flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-zinc-500" />
              <h2 className="font-semibold text-zinc-950">Managed runtime timeline</h2>
            </div>
            <div className="mt-4 space-y-3">
              {eventsQuery.isLoading ? (
                <p className="text-sm text-zinc-500">Loading runtime events...</p>
              ) : sessionTimeline.length === 0 ? (
                <p className="text-sm text-zinc-500">No runtime events yet.</p>
              ) : (
                sessionTimeline.map((item) => (
                  <div key={item.id} className="rounded-xl border border-zinc-200 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${runtimeEventStatusColor(item.status as RuntimeEventRecord["status"])}`}>
                        {item.status}
                      </span>
                      <span className="text-xs font-medium text-zinc-700">{item.kind}</span>
                      <span className="text-xs text-zinc-400">{formatTimestamp(item.created_at)}</span>
                    </div>
                    <p className="mt-3 text-sm text-zinc-700">{item.summary}</p>
                    {item.detail ? <p className="mt-2 text-xs text-zinc-500">{item.detail}</p> : null}
                    {item.metadata && Object.keys(item.metadata).length > 0 ? (
                      <pre className="mt-3 overflow-x-auto rounded-lg bg-zinc-950 p-3 text-xs text-zinc-100">
                        {JSON.stringify(item.metadata, null, 2)}
                      </pre>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5">
            <div className="flex items-center gap-2">
              <Layers3 className="h-4 w-4 text-zinc-500" />
              <h2 className="font-semibold text-zinc-950">Checkpoints</h2>
            </div>
            <div className="mt-4 space-y-3">
              {checkpointsQuery.isLoading ? (
                <p className="text-sm text-zinc-500">Loading checkpoints...</p>
              ) : checkpoints.length === 0 ? (
                <p className="text-sm text-zinc-500">No checkpoints for this session yet.</p>
              ) : (
                checkpoints.map((checkpoint) => (
                  <div key={checkpoint.id} className="rounded-xl border border-zinc-200 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-700">
                        {checkpoint.trigger}
                      </span>
                      <span className="text-xs text-zinc-400">
                        {formatTimestamp(checkpoint.created_at)}
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-zinc-700">{checkpoint.label}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {checkpoint.replayable ? (
                        <button
                          type="button"
                          onClick={() => resumeSessionMutation.mutate(checkpoint.id)}
                          className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs text-blue-700"
                          disabled={resumeSessionMutation.isPending}
                        >
                          {resumeSessionMutation.isPending ? (
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          ) : (
                            <PlayCircle className="mr-1 h-3 w-3" />
                          )}
                          Replay from checkpoint
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5">
            <div className="flex items-center gap-2">
              <Layers3 className="h-4 w-4 text-zinc-500" />
              <h2 className="font-semibold text-zinc-950">Compactions</h2>
            </div>
            <div className="mt-4 space-y-3">
              {compactionsQuery.isLoading ? (
                <p className="text-sm text-zinc-500">Loading compactions...</p>
              ) : compactions.length === 0 ? (
                <p className="text-sm text-zinc-500">No compactions for this session yet.</p>
              ) : (
                compactions.map((compaction) => (
                  <div key={compaction.id} className="rounded-xl border border-zinc-200 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                        compaction.status === "continued"
                          ? "bg-emerald-100 text-emerald-700"
                          : compaction.status === "failed"
                            ? "bg-rose-100 text-rose-700"
                            : "bg-zinc-100 text-zinc-700"
                      }`}>
                        {compaction.status}
                      </span>
                      <span className="text-xs text-zinc-500">{compaction.reason}</span>
                      <span className="text-xs text-zinc-400">
                        {formatTimestamp(compaction.created_at)}
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-zinc-700">{compaction.summary}</p>
                    {compaction.phase ? (
                      <p className="mt-2 text-xs text-zinc-500">
                        Phase: {phaseLabel(compaction.phase)}
                      </p>
                    ) : null}
                    <pre className="mt-3 overflow-x-auto rounded-lg bg-zinc-950 p-3 text-xs text-zinc-100">
                      {compaction.handoff_prompt}
                    </pre>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
