import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowUpRight,
  Building2,
  ClipboardList,
  ExternalLink,
  Filter,
  Mail,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { withCsrfHeader } from "@/lib/csrf";
import type {
  InboundRequestDetail,
  InboundRequestListItem,
  OpportunityState,
  QualificationState,
  RequestPriority,
  SceneDashboardSummary,
} from "@/types/inbound-request";
import {
  BUYER_TYPE_LABELS as buyerTypeLabels,
  OPPORTUNITY_STATE_LABELS as opportunityStateLabels,
  REQUESTED_LANE_LABELS as requestedLaneLabels,
  REQUEST_PRIORITY_LABELS as priorityLabels,
  REQUEST_STATUS_LABELS as statusLabels,
} from "@/types/inbound-request";

const ADMIN_EMAILS = ["ohstnhunt@gmail.com", "ops@tryblueprint.io"];

const qualificationStates: QualificationState[] = [
  "submitted",
  "capture_requested",
  "qa_passed",
  "needs_more_evidence",
  "in_review",
  "qualified_ready",
  "qualified_risky",
  "not_ready_yet",
];

const opportunityStates: OpportunityState[] = [
  "not_applicable",
  "handoff_ready",
  "escalated_to_geometry",
  "escalated_to_validation",
];

const priorityColors: Record<RequestPriority, string> = {
  low: "bg-zinc-100 text-zinc-700",
  normal: "bg-blue-100 text-blue-700",
  high: "bg-amber-100 text-amber-800",
};

const qualificationColors: Record<QualificationState, string> = {
  submitted: "bg-zinc-100 text-zinc-700",
  capture_requested: "bg-amber-100 text-amber-800",
  qa_passed: "bg-sky-100 text-sky-800",
  needs_more_evidence: "bg-orange-100 text-orange-800",
  in_review: "bg-blue-100 text-blue-700",
  qualified_ready: "bg-emerald-100 text-emerald-700",
  qualified_risky: "bg-yellow-100 text-yellow-800",
  not_ready_yet: "bg-rose-100 text-rose-700",
};

const nextActionColors: Record<SceneDashboardSummary["categories"]["pick"]["tasks"][number]["next_action"], string> = {
  "advance to human signoff": "bg-emerald-100 text-emerald-700",
  recapture: "bg-orange-100 text-orange-800",
  redesign: "bg-blue-100 text-blue-700",
  defer: "bg-rose-100 text-rose-700",
};

interface LeadsResponse {
  leads: InboundRequestListItem[];
}

interface StatsResponse {
  total: number;
  newLast24h: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function AdminLeads() {
  const { currentUser } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [qualificationFilter, setQualificationFilter] = useState<QualificationState | "">("");
  const [priorityFilter, setPriorityFilter] = useState<RequestPriority | "">("");
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const isAdmin = Boolean(currentUser?.email && ADMIN_EMAILS.includes(currentUser.email));

  useEffect(() => {
    if (currentUser && !isAdmin) {
      setLocation("/");
    }
  }, [currentUser, isAdmin, setLocation]);

  const leadsQuery = useQuery<LeadsResponse>({
    queryKey: ["admin-submissions", qualificationFilter, priorityFilter],
    enabled: isAdmin,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (qualificationFilter) params.set("status", qualificationFilter);
      if (priorityFilter) params.set("priority", priorityFilter);
      const response = await fetch(`/api/admin/leads?${params.toString()}`, {
        headers: await withCsrfHeader({}),
      });
      if (!response.ok) throw new Error("Failed to fetch submissions");
      return response.json();
    },
  });

  const statsQuery = useQuery<StatsResponse>({
    queryKey: ["admin-submissions-stats"],
    enabled: isAdmin,
    queryFn: async () => {
      const response = await fetch("/api/admin/leads/stats/summary", {
        headers: await withCsrfHeader({}),
      });
      if (!response.ok) throw new Error("Failed to fetch stats");
      return response.json();
    },
  });

  const detailQuery = useQuery<InboundRequestDetail>({
    queryKey: ["admin-submission-detail", selectedRequestId],
    enabled: isAdmin && !!selectedRequestId,
    queryFn: async () => {
      const response = await fetch(`/api/admin/leads/${selectedRequestId}`, {
        headers: await withCsrfHeader({}),
      });
      if (!response.ok) throw new Error("Failed to fetch submission");
      return response.json();
    },
  });

  const updateStateMutation = useMutation({
    mutationFn: async ({
      requestId,
      qualificationState,
      opportunityState,
      note: mutationNote,
    }: {
      requestId: string;
      qualificationState: QualificationState;
      opportunityState: OpportunityState;
      note?: string;
    }) => {
      const response = await fetch(`/api/admin/leads/${requestId}/status`, {
        method: "PATCH",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          qualification_state: qualificationState,
          opportunity_state: opportunityState,
          note: mutationNote,
        }),
      });
      if (!response.ok) throw new Error("Failed to update submission");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-submissions"] });
      queryClient.invalidateQueries({ queryKey: ["admin-submissions-stats"] });
      queryClient.invalidateQueries({ queryKey: ["admin-submission-detail"] });
      setNote("");
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: async ({ requestId, content }: { requestId: string; content: string }) => {
      const response = await fetch(`/api/admin/leads/${requestId}/notes`, {
        method: "POST",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
        body: JSON.stringify({ content }),
      });
      if (!response.ok) throw new Error("Failed to add note");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-submission-detail"] });
      setNote("");
    },
  });

  const selectedLead = detailQuery.data;
  const sceneDashboardQuery = useQuery<SceneDashboardSummary>({
    queryKey: [
      "admin-submission-scene-dashboard",
      selectedRequestId,
      selectedLead?.pipeline?.artifacts?.dashboard_summary_uri,
    ],
    enabled:
      isAdmin &&
      !!selectedRequestId &&
      !!selectedLead?.pipeline?.artifacts?.dashboard_summary_uri,
    queryFn: async () => {
      const response = await fetch(`/api/admin/leads/${selectedRequestId}/pipeline/dashboard`, {
        headers: await withCsrfHeader({}),
      });
      if (!response.ok) throw new Error("Failed to fetch scene dashboard");
      return response.json();
    },
  });
  const leads = leadsQuery.data?.leads ?? [];

  const statCards = useMemo(
    () => [
      { label: "Total submissions", value: statsQuery.data?.total ?? 0 },
      { label: "Last 24h", value: statsQuery.data?.newLast24h ?? 0 },
      {
        label: "Ready / risky",
        value:
          (statsQuery.data?.byStatus?.qualified_ready ?? 0) +
          (statsQuery.data?.byStatus?.qualified_risky ?? 0),
      },
      { label: "Needs evidence", value: statsQuery.data?.byStatus?.needs_more_evidence ?? 0 },
    ],
    [statsQuery.data]
  );

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-red-500" />
          <h1 className="mt-4 text-xl font-semibold text-zinc-900">Admin access required</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Admin Review Queue
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-zinc-950">Qualification submissions</h1>
            <p className="mt-2 text-zinc-600">
              Move submissions through qualification state and only activate opportunity state once a site clears review.
            </p>
          </div>
          <button
            type="button"
            onClick={() => leadsQuery.refetch()}
            className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-700"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </button>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-4">
          {statCards.map((card) => (
            <div key={card.label} className="rounded-2xl border border-zinc-200 bg-white p-5">
              <p className="text-sm text-zinc-500">{card.label}</p>
              <p className="mt-2 text-3xl font-semibold text-zinc-950">{card.value}</p>
            </div>
          ))}
        </div>

        <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 md:flex-row">
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-700">
            <Filter className="h-4 w-4" />
            Filters
          </div>
          <select
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
            value={qualificationFilter}
            onChange={(event) => setQualificationFilter(event.target.value as QualificationState | "")}
          >
            <option value="">All qualification states</option>
            {qualificationStates.map((state) => (
              <option key={state} value={state}>
                {statusLabels[state]}
              </option>
            ))}
          </select>
          <select
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
            value={priorityFilter}
            onChange={(event) => setPriorityFilter(event.target.value as RequestPriority | "")}
          >
            <option value="">All priorities</option>
            {(["low", "normal", "high"] as RequestPriority[]).map((priority) => (
              <option key={priority} value={priority}>
                {priorityLabels[priority]}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-3">
            {leadsQuery.isLoading ? (
              <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-zinc-600">
                Loading submissions...
              </div>
            ) : leads.length === 0 ? (
              <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-zinc-600">
                No submissions match the current filters.
              </div>
            ) : (
              leads.map((lead) => (
                <button
                  key={lead.requestId}
                  type="button"
                  onClick={() => setSelectedRequestId(lead.requestId)}
                  className={`w-full rounded-2xl border p-5 text-left ${
                    selectedRequestId === lead.requestId
                      ? "border-zinc-900 bg-white"
                      : "border-zinc-200 bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-zinc-900">{lead.request.siteName}</p>
                      <p className="text-sm text-zinc-600">
                        {lead.contact.company} · {lead.request.siteLocation}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${qualificationColors[lead.qualification_state]}`}
                    >
                      {statusLabels[lead.qualification_state]}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-zinc-600">{lead.request.taskStatement}</p>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs">
                    <span className={`rounded-full px-3 py-1 ${priorityColors[lead.priority]}`}>
                      {priorityLabels[lead.priority]}
                    </span>
                    {lead.request.requestedLanes.map((lane) => (
                      <span key={lane} className="rounded-full bg-zinc-100 px-3 py-1 text-zinc-700">
                        {requestedLaneLabels[lane]}
                      </span>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-zinc-400">{formatDate(lead.createdAt)}</p>
                </button>
              ))
            )}
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6">
            {selectedLead ? (
              <div className="space-y-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                      Submission {selectedLead.site_submission_id}
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold text-zinc-950">
                      {selectedLead.request.siteName}
                    </h2>
                    <p className="mt-1 text-zinc-600">{selectedLead.request.siteLocation}</p>
                  </div>
                  <a
                    href={selectedLead.context.sourcePageUrl}
                    className="inline-flex items-center text-sm text-zinc-600 hover:text-zinc-900"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Source
                    <ArrowUpRight className="ml-1 h-4 w-4" />
                  </a>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl bg-zinc-50 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Contact</p>
                    <p className="mt-2 font-medium text-zinc-900">
                      {selectedLead.contact.firstName} {selectedLead.contact.lastName}
                    </p>
                    <p className="text-sm text-zinc-600">{selectedLead.contact.company}</p>
                    <p className="text-sm text-zinc-600">{selectedLead.contact.roleTitle}</p>
                    <a
                      href={`mailto:${selectedLead.contact.email}`}
                      className="mt-3 inline-flex items-center text-sm text-zinc-700 hover:text-zinc-900"
                    >
                      <Mail className="mr-2 h-4 w-4" />
                      {selectedLead.contact.email}
                    </a>
                  </div>
                  <div className="rounded-xl bg-zinc-50 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Submission facts</p>
                    <div className="mt-2 space-y-2 text-sm text-zinc-700">
                      <p>Buyer type: {buyerTypeLabels[selectedLead.request.buyerType]}</p>
                      <p>Budget: {selectedLead.request.budgetBucket}</p>
                      <p>Priority: {priorityLabels[selectedLead.priority]}</p>
                      <p>Created: {formatDate(selectedLead.createdAt)}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-zinc-200 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Task statement</p>
                  <p className="mt-2 text-sm text-zinc-800">{selectedLead.request.taskStatement}</p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-zinc-200 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Workflow context</p>
                    <p className="mt-2 text-sm text-zinc-700">
                      {selectedLead.request.workflowContext || "No workflow context supplied."}
                    </p>
                  </div>
                  <div className="rounded-xl border border-zinc-200 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">
                      Operating constraints
                    </p>
                    <p className="mt-2 text-sm text-zinc-700">
                      {selectedLead.request.operatingConstraints || "No operating constraints supplied."}
                    </p>
                  </div>
                  <div className="rounded-xl border border-zinc-200 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">
                      Privacy / security
                    </p>
                    <p className="mt-2 text-sm text-zinc-700">
                      {selectedLead.request.privacySecurityConstraints ||
                        "No privacy or security constraints supplied."}
                    </p>
                  </div>
                  <div className="rounded-xl border border-zinc-200 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Known blockers</p>
                    <p className="mt-2 text-sm text-zinc-700">
                      {selectedLead.request.knownBlockers || "No blockers supplied."}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-zinc-200 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Requested lanes</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedLead.request.requestedLanes.map((lane) => (
                      <span key={lane} className="rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-700">
                        {requestedLaneLabels[lane]}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-zinc-700">
                      Qualification state
                    </label>
                    <select
                      className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                      value={selectedLead.qualification_state}
                      onChange={(event) =>
                        updateStateMutation.mutate({
                          requestId: selectedLead.requestId,
                          qualificationState: event.target.value as QualificationState,
                          opportunityState: selectedLead.opportunity_state,
                          note: note || undefined,
                        })
                      }
                    >
                      {qualificationStates.map((state) => (
                        <option key={state} value={state}>
                          {statusLabels[state]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-zinc-700">
                      Opportunity state
                    </label>
                    <select
                      className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                      value={selectedLead.opportunity_state}
                      onChange={(event) =>
                        updateStateMutation.mutate({
                          requestId: selectedLead.requestId,
                          qualificationState: selectedLead.qualification_state,
                          opportunityState: event.target.value as OpportunityState,
                          note: note || undefined,
                        })
                      }
                    >
                      {opportunityStates.map((state) => (
                        <option key={state} value={state}>
                          {opportunityStateLabels[state]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="rounded-xl border border-zinc-200 p-4">
                  <label className="mb-1 block text-sm font-medium text-zinc-700">Add note</label>
                  <textarea
                    className="min-h-24 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Capture why the state changed or what evidence is still missing."
                  />
                  <div className="mt-3 flex gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        addNoteMutation.mutate({
                          requestId: selectedLead.requestId,
                          content: note,
                        })
                      }
                      disabled={!note.trim()}
                      className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                    >
                      Save note
                    </button>
                    {updateStateMutation.isPending || addNoteMutation.isPending ? (
                      <span className="text-sm text-zinc-500">Saving...</span>
                    ) : null}
                  </div>
                </div>

                {selectedLead.pipeline ? (
                  <div className="rounded-xl border border-zinc-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Scene readiness</p>
                        <p className="mt-2 text-sm text-zinc-700">
                          Scene `{selectedLead.pipeline.scene_id}` · Capture `{selectedLead.pipeline.capture_id}`
                        </p>
                      </div>
                      {selectedLead.pipeline.synced_at ? (
                        <p className="text-xs text-zinc-400">
                          Synced {formatDate(selectedLead.pipeline.synced_at)}
                        </p>
                      ) : null}
                    </div>

                    {sceneDashboardQuery.isLoading ? (
                      <p className="mt-4 text-sm text-zinc-500">Loading scene dashboard...</p>
                    ) : sceneDashboardQuery.data ? (
                      <div className="mt-4 space-y-4">
                        <div className="grid gap-3 md:grid-cols-4">
                          <div className="rounded-xl bg-zinc-50 p-3">
                            <p className="text-xs uppercase tracking-[0.16em] text-zinc-400">Whole-home</p>
                            <p className="mt-2 font-medium text-zinc-900">
                              {sceneDashboardQuery.data.whole_home.status}
                            </p>
                          </div>
                          <div className="rounded-xl bg-zinc-50 p-3">
                            <p className="text-xs uppercase tracking-[0.16em] text-zinc-400">Ready now</p>
                            <p className="mt-2 text-2xl font-semibold text-zinc-950">
                              {sceneDashboardQuery.data.deployment_summary.ready_now}
                            </p>
                          </div>
                          <div className="rounded-xl bg-zinc-50 p-3">
                            <p className="text-xs uppercase tracking-[0.16em] text-zinc-400">Need redesign</p>
                            <p className="mt-2 text-2xl font-semibold text-zinc-950">
                              {sceneDashboardQuery.data.deployment_summary.needs_redesign}
                            </p>
                          </div>
                          <div className="rounded-xl bg-zinc-50 p-3">
                            <p className="text-xs uppercase tracking-[0.16em] text-zinc-400">Outside envelope</p>
                            <p className="mt-2 text-2xl font-semibold text-zinc-950">
                              {sceneDashboardQuery.data.deployment_summary.outside_robot_envelope}
                            </p>
                          </div>
                        </div>

                        {(["pick", "open_close", "navigate"] as const).map((category) => {
                          const tasks = sceneDashboardQuery.data.categories[category].tasks;
                          return (
                            <div key={category} className="rounded-xl border border-zinc-200 p-4">
                              <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">{category}</p>
                              <div className="mt-3 space-y-3">
                                {tasks.length ? (
                                  tasks.map((task) => (
                                    <div
                                      key={`${category}-${task.capture_id}`}
                                      className="rounded-lg bg-zinc-50 p-3"
                                    >
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span
                                          className={`rounded-full px-3 py-1 text-xs font-medium ${nextActionColors[task.next_action]}`}
                                        >
                                          {task.next_action}
                                        </span>
                                        <span className="text-xs text-zinc-400">{task.capture_id}</span>
                                      </div>
                                      <p className="mt-2 text-sm text-zinc-900">{task.task_text}</p>
                                      <p className="mt-1 text-xs text-zinc-500">
                                        Themes: {task.themes.join(", ") || "none"}
                                      </p>
                                      {task.memo_uri ? (
                                        task.memo_uri.startsWith("http") ? (
                                          <a
                                            href={task.memo_uri}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="mt-2 inline-flex items-center text-xs text-zinc-700 hover:text-zinc-900"
                                          >
                                            Memo
                                            <ExternalLink className="ml-1 h-3 w-3" />
                                          </a>
                                        ) : (
                                          <p className="mt-2 text-xs text-zinc-500">Memo URI: {task.memo_uri}</p>
                                        )
                                      ) : null}
                                    </div>
                                  ))
                                ) : (
                                  <p className="text-sm text-zinc-500">No tasks in this category.</p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : selectedLead.pipeline.artifacts.dashboard_summary_uri ? (
                      <p className="mt-4 text-sm text-zinc-500">
                        Scene dashboard could not be loaded.
                      </p>
                    ) : (
                      <p className="mt-4 text-sm text-zinc-500">
                        Pipeline attachment exists, but no scene dashboard has been emitted for this request yet.
                      </p>
                    )}
                  </div>
                ) : null}

                <div className="rounded-xl border border-zinc-200 p-4">
                  <p className="mb-3 text-xs uppercase tracking-[0.18em] text-zinc-400">Notes</p>
                  <div className="space-y-3">
                    {selectedLead.notes?.length ? (
                      selectedLead.notes.map((entry) => (
                        <div key={entry.id} className="rounded-lg bg-zinc-50 p-3 text-sm">
                          <p className="text-zinc-800">{entry.content}</p>
                          <p className="mt-2 text-xs text-zinc-400">{formatDate(entry.createdAt)}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-zinc-500">No notes yet.</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[420px] flex-col items-center justify-center text-center text-zinc-500">
                <ClipboardList className="mb-3 h-10 w-10" />
                <p>Select a submission to review the intake and update its states.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
