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
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { withCsrfHeader } from "@/lib/csrf";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  OPPORTUNITY_STATES,
  QUALIFICATION_STATES,
} from "@/lib/requestTaxonomy";
import { hasAnyRole } from "@/lib/adminAccess";
import type {
  InboundRequestDetail,
  InboundRequestListItem,
  OpportunityState,
  QualificationState,
  RequestPriority,
  SceneDashboardSummary,
  UpdateRequestOpsPayload,
} from "@/types/inbound-request";
import {
  BUYER_TYPE_LABELS as buyerTypeLabels,
  REQUEST_CAPTURE_POLICY_LABELS as capturePolicyLabels,
  REQUEST_CAPTURE_STATUS_LABELS as captureStatusLabels,
  OPPORTUNITY_STATE_LABELS as opportunityStateLabels,
  REQUEST_QUOTE_STATUS_LABELS as quoteStatusLabels,
  REQUESTED_LANE_LABELS as requestedLaneLabels,
  REQUEST_PRIORITY_LABELS as priorityLabels,
  REQUEST_RIGHTS_STATUS_LABELS as rightsStatusLabels,
  REQUEST_STATUS_LABELS as statusLabels,
} from "@/types/inbound-request";
import AdminAgentConsole from "@/components/admin/AdminAgentConsole";

const qualificationStates: QualificationState[] = [...QUALIFICATION_STATES];

const opportunityStates: OpportunityState[] = [...OPPORTUNITY_STATES];

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
  needs_refresh: "bg-fuchsia-100 text-fuchsia-800",
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

interface WaitlistSubmissionItem {
  id: string;
  email: string;
  email_domain: string;
  location_type: string;
  market: string;
  role: string;
  device: string;
  phone: string;
  source: string;
  status: string;
  queue: string;
  intent: string;
  filter_tags: string[];
  created_at: string | null;
  updated_at: string | null;
  ops_automation: {
    status: string;
    version: string;
    model: string;
    next_action: string;
    recommended_path: string;
    eligible_for_ai_triage: boolean;
    confidence: number | null;
    market_fit_score: number | null;
    device_fit_score: number | null;
    invite_readiness_score: number | null;
    recommendation: string;
    rationale: string;
    market_summary: string;
    requires_human_review: boolean;
    block_reason_code?: string | null;
    retryable?: boolean;
    last_error: string | null;
    last_attempt_at: string | null;
    processed_at: string | null;
    draft_email: {
      subject: string;
      body: string;
    } | null;
  };
}

interface WaitlistSubmissionsResponse {
  submissions: WaitlistSubmissionItem[];
  pagination: {
    total: number;
    limit: number;
    hasMore: boolean;
    lastId: string | null;
  };
}

interface WaitlistAutomationRunResponse {
  ok: boolean;
  processedCount: number;
  failedCount: number;
  results: Array<{
    submissionId: string;
    status: "processed" | "failed";
    recommendation?: string;
    recommendedQueue?: string;
    inviteReadinessScore?: number;
    requiresHumanReview?: boolean;
    error?: string;
  }>;
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
  const { currentUser, userData, tokenClaims } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [activeView, setActiveView] = useState<"submissions" | "waitlist" | "agent">("submissions");
  const [qualificationFilter, setQualificationFilter] = useState<QualificationState | "">("");
  const [priorityFilter, setPriorityFilter] = useState<RequestPriority | "">("");
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [selectedWaitlistSubmissionId, setSelectedWaitlistSubmissionId] = useState<string | null>(null);
  const [waitlistRoleFilter, setWaitlistRoleFilter] = useState("");
  const [waitlistDeviceFilter, setWaitlistDeviceFilter] = useState("");
  const [waitlistStatusFilter, setWaitlistStatusFilter] = useState("");
  const [waitlistQueueFilter, setWaitlistQueueFilter] = useState("");
  const [waitlistSearch, setWaitlistSearch] = useState("");
  const [note, setNote] = useState("");

  const isAdmin = hasAnyRole(["admin", "ops"], userData, tokenClaims);

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
    enabled: isAdmin && activeView === "submissions" && !!selectedRequestId,
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

  const createCaptureJobMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const response = await fetch(`/api/admin/leads/${requestId}/capture-job`, {
        method: "POST",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
      });
      if (!response.ok) throw new Error("Failed to create capture job");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-submissions"] });
      queryClient.invalidateQueries({ queryKey: ["admin-submission-detail"] });
    },
  });

  const triggerPreviewMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const response = await fetch(`/api/admin/leads/${requestId}/trigger-preview`, {
        method: "POST",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
      });
      if (!response.ok) throw new Error("Failed to trigger preview");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-submission-detail"] });
    },
  });

  const updateOpsMutation = useMutation({
    mutationFn: async (payload: UpdateRequestOpsPayload) => {
      const response = await fetch(`/api/admin/leads/${payload.requestId}/ops`, {
        method: "PATCH",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Failed to update ops state");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-submissions"] });
      queryClient.invalidateQueries({ queryKey: ["admin-submission-detail"] });
      setNote("");
    },
  });

  const reviewLinkMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const response = await fetch(`/api/admin/leads/${requestId}/review-link`, {
        method: "POST",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
      });
      if (!response.ok) throw new Error("Failed to issue review link");
      return response.json() as Promise<{ buyer_review_url: string }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-submission-detail"] });
    },
  });
  const runWaitlistAutomationMutation = useMutation({
    mutationFn: async ({
      submissionId,
      limit,
    }: {
      submissionId?: string;
      limit?: number;
    }) => {
      const response = await fetch("/api/admin/leads/waitlist-submissions/automation/run", {
        method: "POST",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          submissionId,
          limit,
        }),
      });
      if (!response.ok) throw new Error("Failed to run waitlist automation");
      return response.json() as Promise<WaitlistAutomationRunResponse>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-waitlist-submissions"] });
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
  const waitlistQuery = useQuery<WaitlistSubmissionsResponse>({
    queryKey: [
      "admin-waitlist-submissions",
      waitlistRoleFilter,
      waitlistDeviceFilter,
      waitlistStatusFilter,
      waitlistQueueFilter,
    ],
    enabled: isAdmin && activeView === "waitlist",
    queryFn: async () => {
      const params = new URLSearchParams();
      if (waitlistRoleFilter) params.set("role", waitlistRoleFilter);
      if (waitlistDeviceFilter) params.set("device", waitlistDeviceFilter);
      if (waitlistStatusFilter) params.set("status", waitlistStatusFilter);
      if (waitlistQueueFilter) params.set("queue", waitlistQueueFilter);
      params.set("limit", "150");

      const response = await fetch(`/api/admin/leads/waitlist-submissions?${params.toString()}`, {
        headers: await withCsrfHeader({}),
      });
      if (!response.ok) throw new Error("Failed to fetch waitlist submissions");
      return response.json();
    },
  });
  const leads = leadsQuery.data?.leads ?? [];
  const waitlistSubmissions = waitlistQuery.data?.submissions ?? [];
  const filteredWaitlistSubmissions = useMemo(() => {
    const search = waitlistSearch.trim().toLowerCase();
    if (!search) {
      return waitlistSubmissions;
    }

    return waitlistSubmissions.filter((submission) => {
      const haystacks = [
        submission.email,
        submission.market,
        submission.phone,
        submission.role,
        submission.device,
        submission.queue,
        submission.status,
        submission.location_type,
        submission.source,
        ...submission.filter_tags,
      ]
        .filter(Boolean)
        .map((value) => value.toLowerCase());

      return haystacks.some((value) => value.includes(search));
    });
  }, [waitlistSearch, waitlistSubmissions]);
  const selectedWaitlistSubmission =
    filteredWaitlistSubmissions.find((submission) => submission.id === selectedWaitlistSubmissionId) ??
    waitlistSubmissions.find((submission) => submission.id === selectedWaitlistSubmissionId) ??
    filteredWaitlistSubmissions[0] ??
    null;

  useEffect(() => {
    if (activeView === "waitlist" && !selectedWaitlistSubmissionId && filteredWaitlistSubmissions[0]) {
      setSelectedWaitlistSubmissionId(filteredWaitlistSubmissions[0].id);
    }
  }, [activeView, filteredWaitlistSubmissions, selectedWaitlistSubmissionId]);

  const statCards = useMemo(() => {
    if (activeView === "waitlist") {
      const now = Date.now();
      return [
        {
          label: "Total requests",
          value: waitlistQuery.data?.pagination.total ?? filteredWaitlistSubmissions.length,
        },
        {
          label: "Last 24h",
          value: filteredWaitlistSubmissions.filter((submission) => {
            if (!submission.created_at) return false;
            return now - new Date(submission.created_at).getTime() <= 24 * 60 * 60 * 1000;
          }).length,
        },
        {
          label: "AI-triage eligible",
          value: filteredWaitlistSubmissions.filter(
            (submission) => submission.ops_automation.eligible_for_ai_triage,
          ).length,
        },
        {
          label: "Pending automation",
          value: filteredWaitlistSubmissions.filter(
            (submission) => submission.ops_automation.status === "pending",
          ).length,
        },
      ];
    }

    if (activeView === "agent") {
      return [];
    }

    return [
      { label: "Total submissions", value: statsQuery.data?.total ?? 0 },
      { label: "Last 24h", value: statsQuery.data?.newLast24h ?? 0 },
      {
        label: "Ready / risky",
        value:
          (statsQuery.data?.byStatus?.qualified_ready ?? 0) +
          (statsQuery.data?.byStatus?.qualified_risky ?? 0),
      },
      { label: "Needs evidence", value: statsQuery.data?.byStatus?.needs_more_evidence ?? 0 },
    ];
  }, [activeView, filteredWaitlistSubmissions, statsQuery.data, waitlistQuery.data?.pagination.total]);

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
              {activeView === "submissions"
                ? "Admin Review Queue"
                : activeView === "waitlist"
                  ? "Ops Intake Queue"
                  : "Ops Agent Console"}
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-zinc-950">
              {activeView === "submissions"
                ? "Qualification submissions"
                : activeView === "waitlist"
                  ? "Waitlist and beta requests"
                  : "Startup operations agent"}
            </h1>
            <p className="mt-2 text-zinc-600">
              {activeView === "submissions"
                ? "Move submissions through qualification state and only activate opportunity state once a site clears review."
                : activeView === "waitlist"
                  ? "Review structured waitlist and private beta intake without dropping into Firestore."
                  : "Create agent threads, attach startup context, route work into Codex or Claude Code, and approve sensitive runs in one place."}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Tabs
      value={activeView}
      onValueChange={(value) => setActiveView(value as "submissions" | "waitlist" | "agent")}
            >
              <TabsList className="rounded-full border border-zinc-200 bg-white p-1">
                <TabsTrigger value="submissions" className="rounded-full px-4">
                  Qualification
                </TabsTrigger>
                <TabsTrigger value="waitlist" className="rounded-full px-4">
                  Waitlist / Beta
                </TabsTrigger>
                <TabsTrigger value="agent" className="rounded-full px-4">
                  Agent
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <button
              type="button"
              onClick={() =>
                activeView === "submissions"
                  ? leadsQuery.refetch()
                  : activeView === "waitlist"
                    ? waitlistQuery.refetch()
                    : queryClient.invalidateQueries({ queryKey: ["admin-agent-sessions"] })
              }
              className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-700"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </button>
            {activeView === "waitlist" ? (
              <button
                type="button"
                onClick={() => runWaitlistAutomationMutation.mutate({ limit: 10 })}
                className="inline-flex items-center rounded-full bg-zinc-950 px-4 py-2 text-sm text-white"
                disabled={runWaitlistAutomationMutation.isPending}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                {runWaitlistAutomationMutation.isPending ? "Running AI triage..." : "Run AI triage"}
              </button>
            ) : null}
          </div>
        </div>

        {statCards.length > 0 ? (
          <div className="mb-6 grid gap-4 md:grid-cols-4">
            {statCards.map((card) => (
              <div key={card.label} className="rounded-2xl border border-zinc-200 bg-white p-5">
                <p className="text-sm text-zinc-500">{card.label}</p>
                <p className="mt-2 text-3xl font-semibold text-zinc-950">{card.value}</p>
              </div>
            ))}
          </div>
        ) : null}

        {activeView === "agent" ? (
          <AdminAgentConsole />
        ) : activeView === "submissions" ? (
          <>
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

                <div className="flex flex-wrap gap-3">
                  {selectedLead.buyer_review_access?.buyer_review_url ? (
                    <a
                      href={selectedLead.buyer_review_access.buyer_review_url}
                      className="inline-flex items-center rounded-full border border-zinc-200 px-4 py-2 text-sm text-zinc-700"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Buyer review
                      <ArrowUpRight className="ml-2 h-4 w-4" />
                    </a>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => reviewLinkMutation.mutate(selectedLead.requestId)}
                    className="inline-flex items-center rounded-full border border-zinc-200 px-4 py-2 text-sm text-zinc-700"
                  >
                    Issue review link
                  </button>
                  <button
                    type="button"
                    onClick={() => createCaptureJobMutation.mutate(selectedLead.requestId)}
                    className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white"
                  >
                    Create capture job
                  </button>
                  <button
                    type="button"
                    onClick={() => triggerPreviewMutation.mutate(selectedLead.requestId)}
                    className="inline-flex items-center rounded-full border border-zinc-200 px-4 py-2 text-sm text-zinc-700"
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    Trigger preview
                  </button>
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

                <div className="rounded-xl border border-zinc-200 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Ops controls</p>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-zinc-700">
                        Assigned region
                      </label>
                      <input
                        className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                        defaultValue={selectedLead.ops?.assigned_region_id || ""}
                        onBlur={(event) =>
                          updateOpsMutation.mutate({
                            requestId: selectedLead.requestId,
                            assigned_region_id: event.target.value || null,
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-zinc-700">
                        Rights status
                      </label>
                      <select
                        className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                        value={selectedLead.ops?.rights_status || "unknown"}
                        onChange={(event) =>
                          updateOpsMutation.mutate({
                            requestId: selectedLead.requestId,
                            rights_status: event.target.value as UpdateRequestOpsPayload["rights_status"],
                          })
                        }
                      >
                        {Object.entries(rightsStatusLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-zinc-700">
                        Capture policy
                      </label>
                      <select
                        className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                        value={selectedLead.ops?.capture_policy_tier || "review_required"}
                        onChange={(event) =>
                          updateOpsMutation.mutate({
                            requestId: selectedLead.requestId,
                            capture_policy_tier:
                              event.target.value as UpdateRequestOpsPayload["capture_policy_tier"],
                          })
                        }
                      >
                        {Object.entries(capturePolicyLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-zinc-700">
                        Capture status
                      </label>
                      <select
                        className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                        value={selectedLead.ops?.capture_status || "not_requested"}
                        onChange={(event) =>
                          updateOpsMutation.mutate({
                            requestId: selectedLead.requestId,
                            capture_status:
                              event.target.value as UpdateRequestOpsPayload["capture_status"],
                          })
                        }
                      >
                        {Object.entries(captureStatusLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-zinc-700">
                        Quote status
                      </label>
                      <select
                        className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                        value={selectedLead.ops?.quote_status || "not_started"}
                        onChange={(event) =>
                          updateOpsMutation.mutate({
                            requestId: selectedLead.requestId,
                            quote_status:
                              event.target.value as UpdateRequestOpsPayload["quote_status"],
                          })
                        }
                      >
                        {Object.entries(quoteStatusLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="mb-1 block text-sm font-medium text-zinc-700">
                        Next step
                      </label>
                      <input
                        className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                        defaultValue={selectedLead.ops?.next_step || ""}
                        onBlur={(event) =>
                          updateOpsMutation.mutate({
                            requestId: selectedLead.requestId,
                            next_step: event.target.value || null,
                          })
                        }
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="mb-1 block text-sm font-medium text-zinc-700">
                        Recapture guidance
                      </label>
                      <textarea
                        className="min-h-20 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                        defaultValue={selectedLead.ops?.recapture_reason || ""}
                        onBlur={(event) =>
                          updateOpsMutation.mutate({
                            requestId: selectedLead.requestId,
                            recapture_reason: event.target.value || null,
                          })
                        }
                      />
                    </div>
                  </div>
                </div>

                {selectedLead.deployment_readiness ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-zinc-200 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Buyer trust</p>
                      <p className="mt-2 text-3xl font-semibold text-zinc-950">
                        {selectedLead.deployment_readiness.buyer_trust_score?.score ?? "N/A"}
                      </p>
                      <p className="mt-1 text-sm text-zinc-600">
                        {selectedLead.deployment_readiness.buyer_trust_score?.band ?? "unknown"} confidence
                      </p>
                      {selectedLead.deployment_readiness.buyer_trust_score?.reasons?.length ? (
                        <ul className="mt-3 list-disc space-y-1 pl-4 text-sm text-zinc-600">
                          {selectedLead.deployment_readiness.buyer_trust_score.reasons.map((reason) => (
                            <li key={reason}>{reason}</li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                    <div className="rounded-xl border border-zinc-200 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Preview run</p>
                      <p className="mt-2 text-sm text-zinc-700">
                        Status: {selectedLead.deployment_readiness.preview_status || "not_requested"}
                      </p>
                      <p className="mt-1 text-sm text-zinc-700">
                        Provider: {selectedLead.deployment_readiness.provider_run?.provider_name || "none"}
                      </p>
                      {selectedLead.deployment_readiness.provider_run?.failure_reason ? (
                        <p className="mt-3 text-sm text-rose-700">
                          {selectedLead.deployment_readiness.provider_run.failure_reason}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : null}

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
        </>
        ) : (
          <>
            <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 md:flex-row md:flex-wrap">
              <div className="flex items-center gap-2 text-sm font-medium text-zinc-700">
                <Filter className="h-4 w-4" />
                Filters
              </div>
              <select
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                value={waitlistRoleFilter}
                onChange={(event) => setWaitlistRoleFilter(event.target.value)}
              >
                <option value="">All roles</option>
                <option value="capturer">Capturer</option>
              </select>
              <select
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                value={waitlistDeviceFilter}
                onChange={(event) => setWaitlistDeviceFilter(event.target.value)}
              >
                <option value="">All devices</option>
                <option value="iphone">iPhone</option>
                <option value="ipad">iPad</option>
                <option value="smart_glasses">Smart glasses</option>
                <option value="android">Android</option>
              </select>
              <select
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                value={waitlistStatusFilter}
                onChange={(event) => setWaitlistStatusFilter(event.target.value)}
              >
                <option value="">All statuses</option>
                <option value="new">New</option>
              </select>
              <select
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                value={waitlistQueueFilter}
                onChange={(event) => setWaitlistQueueFilter(event.target.value)}
              >
                <option value="">All queues</option>
                <option value="capturer_beta_review">Capturer beta review</option>
                <option value="website_waitlist_review">Website waitlist review</option>
              </select>
              <input
                className="min-w-[260px] flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                value={waitlistSearch}
                onChange={(event) => setWaitlistSearch(event.target.value)}
                placeholder="Search market, email, phone, source, or tags"
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="space-y-3">
                {waitlistQuery.isLoading ? (
                  <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-zinc-600">
                    Loading waitlist submissions...
                  </div>
                ) : filteredWaitlistSubmissions.length === 0 ? (
                  <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-zinc-600">
                    No waitlist requests match the current filters.
                  </div>
                ) : (
                  filteredWaitlistSubmissions.map((submission) => (
                    <button
                      key={submission.id}
                      type="button"
                      onClick={() => setSelectedWaitlistSubmissionId(submission.id)}
                      className={`w-full rounded-2xl border p-5 text-left ${
                        selectedWaitlistSubmission?.id === submission.id
                          ? "border-zinc-900 bg-white"
                          : "border-zinc-200 bg-white"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-zinc-900">
                            {submission.market || "Unknown market"}
                          </p>
                          <p className="text-sm text-zinc-600">
                            {submission.email} {submission.phone ? `· ${submission.phone}` : ""}
                          </p>
                        </div>
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                          {submission.status}
                        </span>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2 text-xs">
                        {submission.role ? (
                          <span className="rounded-full bg-zinc-100 px-3 py-1 text-zinc-700">
                            {submission.role}
                          </span>
                        ) : null}
                        {submission.device ? (
                          <span className="rounded-full bg-zinc-100 px-3 py-1 text-zinc-700">
                            {submission.device}
                          </span>
                        ) : null}
                        {submission.queue ? (
                          <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-800">
                            {submission.queue}
                          </span>
                        ) : null}
                        {submission.ops_automation.eligible_for_ai_triage ? (
                          <span className="rounded-full bg-blue-100 px-3 py-1 text-blue-700">
                            AI triage
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-3 text-xs text-zinc-400">
                        {submission.created_at ? formatDate(submission.created_at) : "Unknown date"}
                      </p>
                    </button>
                  ))
                )}
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                {selectedWaitlistSubmission ? (
                  <div className="space-y-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                          Waitlist submission
                        </p>
                        <h2 className="mt-2 text-2xl font-semibold text-zinc-950">
                          {selectedWaitlistSubmission.market || "Unknown market"}
                        </h2>
                        <p className="mt-1 text-zinc-600">
                          {selectedWaitlistSubmission.location_type || "No location type"}
                        </p>
                      </div>
                      <span className="rounded-full border border-zinc-200 px-3 py-1 text-xs text-zinc-600">
                        {selectedWaitlistSubmission.id}
                      </span>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-xl bg-zinc-50 p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Contact</p>
                        <a
                          href={`mailto:${selectedWaitlistSubmission.email}`}
                          className="mt-2 inline-flex items-center text-sm text-zinc-700 hover:text-zinc-900"
                        >
                          <Mail className="mr-2 h-4 w-4" />
                          {selectedWaitlistSubmission.email}
                        </a>
                        {selectedWaitlistSubmission.phone ? (
                          <p className="mt-2 text-sm text-zinc-600">
                            {selectedWaitlistSubmission.phone}
                          </p>
                        ) : null}
                        {selectedWaitlistSubmission.email_domain ? (
                          <p className="mt-2 text-xs text-zinc-400">
                            Domain: {selectedWaitlistSubmission.email_domain}
                          </p>
                        ) : null}
                      </div>
                      <div className="rounded-xl bg-zinc-50 p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Request facts</p>
                        <div className="mt-2 space-y-2 text-sm text-zinc-700">
                          <p>Role: {selectedWaitlistSubmission.role || "unknown"}</p>
                          <p>Device: {selectedWaitlistSubmission.device || "unknown"}</p>
                          <p>Queue: {selectedWaitlistSubmission.queue || "unassigned"}</p>
                          <p>Source: {selectedWaitlistSubmission.source || "unknown"}</p>
                          <p>
                            Created:{" "}
                            {selectedWaitlistSubmission.created_at
                              ? formatDate(selectedWaitlistSubmission.created_at)
                              : "Unknown"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-zinc-200 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Automation state</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-700">
                          {selectedWaitlistSubmission.ops_automation.status}
                        </span>
                        {selectedWaitlistSubmission.ops_automation.recommendation ? (
                          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-700">
                            {selectedWaitlistSubmission.ops_automation.recommendation}
                          </span>
                        ) : null}
                        {selectedWaitlistSubmission.ops_automation.requires_human_review ? (
                          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-800">
                            Human review
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-3 grid gap-4 md:grid-cols-2">
                        <div>
                          <p className="text-sm text-zinc-500">Status</p>
                          <p className="mt-1 font-medium text-zinc-900">
                            {selectedWaitlistSubmission.ops_automation.status}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-zinc-500">Next action</p>
                          <p className="mt-1 font-medium text-zinc-900">
                            {selectedWaitlistSubmission.ops_automation.next_action || "None"}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-zinc-500">Recommended path</p>
                          <p className="mt-1 font-medium text-zinc-900">
                            {selectedWaitlistSubmission.ops_automation.recommended_path || "None"}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-zinc-500">AI triage</p>
                          <p className="mt-1 font-medium text-zinc-900">
                            {selectedWaitlistSubmission.ops_automation.eligible_for_ai_triage
                              ? "Eligible"
                              : "No"}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-zinc-500">Invite readiness</p>
                          <p className="mt-1 font-medium text-zinc-900">
                            {selectedWaitlistSubmission.ops_automation.invite_readiness_score ?? "N/A"}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-zinc-500">Confidence</p>
                          <p className="mt-1 font-medium text-zinc-900">
                            {selectedWaitlistSubmission.ops_automation.confidence !== null
                              ? `${Math.round(selectedWaitlistSubmission.ops_automation.confidence * 100)}%`
                              : "N/A"}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-zinc-500">Market fit</p>
                          <p className="mt-1 font-medium text-zinc-900">
                            {selectedWaitlistSubmission.ops_automation.market_fit_score ?? "N/A"}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-zinc-500">Device fit</p>
                          <p className="mt-1 font-medium text-zinc-900">
                            {selectedWaitlistSubmission.ops_automation.device_fit_score ?? "N/A"}
                          </p>
                        </div>
                      </div>
                      {selectedWaitlistSubmission.ops_automation.model ? (
                        <p className="mt-4 text-xs text-zinc-500">
                          Model: {selectedWaitlistSubmission.ops_automation.model}
                        </p>
                      ) : null}
                      {selectedWaitlistSubmission.ops_automation.market_summary ? (
                        <p className="mt-4 text-sm text-zinc-700">
                          {selectedWaitlistSubmission.ops_automation.market_summary}
                        </p>
                      ) : null}
                      {selectedWaitlistSubmission.ops_automation.rationale ? (
                        <p className="mt-3 text-sm text-zinc-600">
                          {selectedWaitlistSubmission.ops_automation.rationale}
                        </p>
                      ) : null}
                      {selectedWaitlistSubmission.ops_automation.last_error ? (
                        <p className="mt-4 text-sm text-rose-700">
                          Last error: {selectedWaitlistSubmission.ops_automation.last_error}
                        </p>
                      ) : null}
                    </div>

                    <div className="rounded-xl border border-zinc-200 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">
                          Draft response
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            runWaitlistAutomationMutation.mutate({
                              submissionId: selectedWaitlistSubmission.id,
                            })
                          }
                          className="inline-flex items-center rounded-full border border-zinc-200 px-3 py-1.5 text-xs text-zinc-700"
                          disabled={runWaitlistAutomationMutation.isPending}
                        >
                          <Sparkles className="mr-2 h-3.5 w-3.5" />
                          Re-run AI triage
                        </button>
                      </div>
                      {selectedWaitlistSubmission.ops_automation.draft_email ? (
                        <div className="mt-3 space-y-3">
                          <div className="rounded-lg bg-zinc-50 p-3">
                            <p className="text-xs text-zinc-500">Subject</p>
                            <p className="mt-1 text-sm font-medium text-zinc-900">
                              {selectedWaitlistSubmission.ops_automation.draft_email.subject}
                            </p>
                          </div>
                          <div className="rounded-lg bg-zinc-50 p-3">
                            <p className="text-xs text-zinc-500">Body</p>
                            <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-700">
                              {selectedWaitlistSubmission.ops_automation.draft_email.body}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <p className="mt-3 text-sm text-zinc-500">
                          No AI draft yet. Run triage to generate one.
                        </p>
                      )}
                    </div>

                    <div className="rounded-xl border border-zinc-200 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Filter tags</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {selectedWaitlistSubmission.filter_tags.length ? (
                          selectedWaitlistSubmission.filter_tags.map((tag) => (
                            <span key={tag} className="rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-700">
                              {tag}
                            </span>
                          ))
                        ) : (
                          <p className="text-sm text-zinc-500">No tags assigned.</p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex min-h-[420px] flex-col items-center justify-center text-center text-zinc-500">
                    <ClipboardList className="mb-3 h-10 w-10" />
                    <p>Select a waitlist request to inspect its automation fields.</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
