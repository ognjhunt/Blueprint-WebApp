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
  AgentContextOptionsResponse,
  OpsActionLogRecord,
  OpsDocumentRecord,
  AgentRunRecord,
  AgentSessionRecord,
  AgentTaskKind,
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

export default function AdminAgentConsole() {
  const queryClient = useQueryClient();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [title, setTitle] = useState("Ops agent thread");
  const [taskKind, setTaskKind] = useState<AgentTaskKind>("operator_thread");
  const [message, setMessage] = useState("");
  const [operatorNotes, setOperatorNotes] = useState("");
  const [selectedStartupPackIds, setSelectedStartupPackIds] = useState<string[]>([]);
  const [selectedRepoDocs, setSelectedRepoDocs] = useState<string[]>([]);
  const [selectedBlueprintIds, setSelectedBlueprintIds] = useState<string[]>([]);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
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

  const selectedSession =
    sessionDetailQuery.data?.session
    || sessionsQuery.data?.sessions?.find((session) => session.id === activeSessionId)
    || null;

  const createSessionMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title,
        task_kind: taskKind,
        metadata: {
          startupContext: {
            startupPackIds: selectedStartupPackIds,
            repoDocPaths: selectedRepoDocs,
            blueprintIds: selectedBlueprintIds,
            documentIds: selectedDocumentIds,
            externalSources: parseExternalSources(externalSourcesText),
            operatorNotes,
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
        blueprintIds: selectedBlueprintIds,
        documentIds: selectedDocumentIds,
        externalSources: parseExternalSources(externalSourcesText),
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
      const body = {
        task_kind: selectedSession?.task_kind || "operator_thread",
        input: { message },
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

  const availableRepoDocs = contextOptionsQuery.data?.repoDocs || [];
  const availableBlueprints = contextOptionsQuery.data?.blueprints || [];
  const availableOpsDocuments = contextOptionsQuery.data?.opsDocuments || [];
  const availableStartupPacks = contextOptionsQuery.data?.startupPacks || [];
  const runs = runsQuery.data?.runs || [];
  const actionLogs = actionLogsQuery.data?.actionLogs || [];
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
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
                Execution backend: OpenAI Responses
              </div>

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
                            setSelectedBlueprintIds(pack.blueprintIds || []);
                            setSelectedDocumentIds(pack.documentIds || []);
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
                  <p className="mt-2 text-xs text-zinc-500">
                    Last updated {formatTimestamp(selectedSession.updated_at)}
                  </p>
                </div>

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
                    {selectedSession.metadata?.startupContext?.operatorNotes ? (
                      <p>Notes: {selectedSession.metadata.startupContext.operatorNotes}</p>
                    ) : null}
                  </div>
                </div>

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
                    {run.output ? (
                      <pre className="mt-3 overflow-x-auto rounded-lg bg-zinc-950 p-3 text-xs text-zinc-100">
                        {JSON.stringify(run.output, null, 2)}
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
        </div>
      </div>
    </div>
  );
}
