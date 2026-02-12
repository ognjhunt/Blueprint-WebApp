import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Search,
  Filter,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Mail,
  Phone,
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Building2,
  User,
  DollarSign,
  Tag,
  MessageSquare,
  Download,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { withCsrfHeader } from "@/lib/csrf";
import type {
  InboundRequestListItem,
  InboundRequestDetail,
  RequestStatus,
  RequestPriority,
  RequestNote,
  REQUEST_STATUS_LABELS,
  REQUEST_PRIORITY_LABELS,
  HELP_WITH_LABELS,
  BUDGET_BUCKET_LABELS,
} from "@/types/inbound-request";

// Admin email allowlist (must match server)
const ADMIN_EMAILS = ["ohstnhunt@gmail.com", "ops@tryblueprint.io"];

const STATUS_LABELS: Record<RequestStatus, string> = {
  new: "New",
  triaging: "Triaging",
  scheduled: "Scheduled",
  qualified: "Qualified",
  disqualified: "Disqualified",
  closed: "Closed",
};

const PRIORITY_LABELS: Record<RequestPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
};

const HELP_LABELS: Record<string, string> = {
  "benchmark-packs": "Benchmark Packs",
  "scene-library": "Scene Library",
  "dataset-packs": "Dataset Packs",
  "custom-capture": "Custom Scene",
  "pilot-exchange-location-brief": "Pilot Exchange: Location Brief",
  "pilot-exchange-policy-submission": "Pilot Exchange: Policy Submission",
  "pilot-exchange-data-licensing": "Pilot Exchange: Data Licensing",
};

const STATUS_COLORS: Record<RequestStatus, string> = {
  new: "bg-blue-100 text-blue-700",
  triaging: "bg-yellow-100 text-yellow-700",
  scheduled: "bg-purple-100 text-purple-700",
  qualified: "bg-green-100 text-green-700",
  disqualified: "bg-red-100 text-red-700",
  closed: "bg-zinc-100 text-zinc-700",
};

const PRIORITY_COLORS: Record<RequestPriority, string> = {
  low: "bg-zinc-100 text-zinc-600",
  normal: "bg-blue-100 text-blue-600",
  high: "bg-red-100 text-red-600",
};

interface LeadsResponse {
  leads: InboundRequestListItem[];
  pagination: {
    total: number;
    limit: number;
    hasMore: boolean;
    lastId: string | null;
  };
}

interface StatsResponse {
  total: number;
  newLast24h: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
}

export default function AdminLeads() {
  const { currentUser } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<RequestStatus | "">("");
  const [priorityFilter, setPriorityFilter] = useState<RequestPriority | "">("");
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [newNote, setNewNote] = useState("");

  // Check if user is admin
  const isAdmin = Boolean(currentUser?.email && ADMIN_EMAILS.includes(currentUser.email));

  // Redirect non-admin users
  useEffect(() => {
    if (currentUser && !isAdmin) {
      setLocation("/");
    }
  }, [currentUser, isAdmin, setLocation]);

  // Fetch leads
  const {
    data: leadsData,
    isLoading: isLoadingLeads,
    refetch: refetchLeads,
  } = useQuery<LeadsResponse>({
    queryKey: ["admin-leads", statusFilter, priorityFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (priorityFilter) params.set("priority", priorityFilter);
      params.set("limit", "50");

      const res = await fetch(`/api/admin/leads?${params.toString()}`, {
        headers: await withCsrfHeader({}),
      });

      if (!res.ok) {
        throw new Error("Failed to fetch leads");
      }

      return res.json();
    },
    enabled: isAdmin,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch stats
  const { data: statsData } = useQuery<StatsResponse>({
    queryKey: ["admin-leads-stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/leads/stats/summary", {
        headers: await withCsrfHeader({}),
      });

      if (!res.ok) {
        throw new Error("Failed to fetch stats");
      }

      return res.json();
    },
    enabled: isAdmin,
    refetchInterval: 60000, // Refresh every minute
  });

  // Fetch lead detail
  const {
    data: selectedLead,
    isLoading: isLoadingDetail,
  } = useQuery<InboundRequestDetail>({
    queryKey: ["admin-lead-detail", selectedRequestId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/leads/${selectedRequestId}`, {
        headers: await withCsrfHeader({}),
      });

      if (!res.ok) {
        throw new Error("Failed to fetch lead details");
      }

      return res.json();
    },
    enabled: !!selectedRequestId && isAdmin,
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({
      requestId,
      status,
      note,
    }: {
      requestId: string;
      status: RequestStatus;
      note?: string;
    }) => {
      const res = await fetch(`/api/admin/leads/${requestId}/status`, {
        method: "PATCH",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
        body: JSON.stringify({ status, note }),
      });

      if (!res.ok) {
        throw new Error("Failed to update status");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-leads"] });
      queryClient.invalidateQueries({ queryKey: ["admin-lead-detail"] });
      queryClient.invalidateQueries({ queryKey: ["admin-leads-stats"] });
    },
  });

  // Add note mutation
  const addNoteMutation = useMutation({
    mutationFn: async ({
      requestId,
      content,
    }: {
      requestId: string;
      content: string;
    }) => {
      const res = await fetch(`/api/admin/leads/${requestId}/notes`, {
        method: "POST",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
        body: JSON.stringify({ content }),
      });

      if (!res.ok) {
        throw new Error("Failed to add note");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-lead-detail"] });
      setNewNote("");
    },
  });

  // Filter leads by search query
  const filteredLeads = leadsData?.leads.filter((lead) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      lead.contact.firstName.toLowerCase().includes(query) ||
      lead.contact.lastName.toLowerCase().includes(query) ||
      lead.contact.email.toLowerCase().includes(query) ||
      lead.contact.company.toLowerCase().includes(query)
    );
  });

  // Handle export
  const handleExport = useCallback(async () => {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);

    const res = await fetch(`/api/admin/leads/export/csv?${params.toString()}`, {
      headers: await withCsrfHeader({}),
    });

    if (!res.ok) {
      alert("Failed to export leads");
      return;
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-export-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }, [statusFilter]);

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours < 1) {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      return `${diffMins}m ago`;
    }
    if (diffHours < 24) {
      return `${Math.floor(diffHours)}h ago`;
    }
    if (diffHours < 48) {
      return "Yesterday";
    }
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  };

  // Check if lead is urgent (new and > 2 hours old)
  const isUrgent = (lead: InboundRequestListItem) => {
    if (lead.status !== "new") return false;
    const createdAt = new Date(lead.createdAt);
    const now = new Date();
    const diffHours = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
    return diffHours > 2;
  };

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
          <h2 className="mt-4 text-xl font-semibold text-zinc-900">
            Access Denied
          </h2>
          <p className="mt-2 text-zinc-600">
            You don't have permission to access this page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
      <div className="border-b border-zinc-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">Leads Inbox</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Manage inbound requests and customer inquiries
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => refetchLeads()}
              className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Stats */}
        {statsData && (
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-lg border border-zinc-200 bg-white p-4">
              <p className="text-sm text-zinc-500">Total Leads</p>
              <p className="mt-1 text-2xl font-bold text-zinc-900">
                {statsData.total}
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white p-4">
              <p className="text-sm text-zinc-500">New (24h)</p>
              <p className="mt-1 text-2xl font-bold text-blue-600">
                {statsData.newLast24h}
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white p-4">
              <p className="text-sm text-zinc-500">Needs Response</p>
              <p className="mt-1 text-2xl font-bold text-yellow-600">
                {statsData.byStatus.new + statsData.byStatus.triaging}
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white p-4">
              <p className="text-sm text-zinc-500">High Priority</p>
              <p className="mt-1 text-2xl font-bold text-red-600">
                {statsData.byPriority.high}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="flex">
        {/* List Panel */}
        <div className="w-full border-r border-zinc-200 bg-white lg:w-2/5">
          {/* Filters */}
          <div className="border-b border-zinc-200 p-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search leads..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-2 pl-10 pr-4 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as RequestStatus | "")
                }
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">All Status</option>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <select
                value={priorityFilter}
                onChange={(e) =>
                  setPriorityFilter(e.target.value as RequestPriority | "")
                }
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">All Priority</option>
                {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Lead List */}
          <div className="divide-y divide-zinc-100 overflow-y-auto" style={{ maxHeight: "calc(100vh - 300px)" }}>
            {isLoadingLeads ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
              </div>
            ) : filteredLeads && filteredLeads.length > 0 ? (
              filteredLeads.map((lead) => (
                <button
                  key={lead.requestId}
                  onClick={() => setSelectedRequestId(lead.requestId)}
                  className={`w-full p-4 text-left transition hover:bg-zinc-50 ${
                    selectedRequestId === lead.requestId ? "bg-indigo-50" : ""
                  } ${isUrgent(lead) ? "border-l-4 border-l-red-500" : ""}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-zinc-900">
                          {lead.contact.firstName} {lead.contact.lastName}
                        </span>
                        {isUrgent(lead) && (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                            Urgent
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-sm text-zinc-600">
                        {lead.contact.company}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            STATUS_COLORS[lead.status]
                          }`}
                        >
                          {STATUS_LABELS[lead.status]}
                        </span>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            PRIORITY_COLORS[lead.priority]
                          }`}
                        >
                          {PRIORITY_LABELS[lead.priority]}
                        </span>
                        <span className="text-xs text-zinc-500">
                          {lead.request.budgetBucket}
                        </span>
                      </div>
                    </div>
                    <div className="ml-4 flex flex-col items-end">
                      <span className="text-xs text-zinc-500">
                        {formatDate(lead.createdAt)}
                      </span>
                      <ChevronRight className="mt-2 h-4 w-4 text-zinc-400" />
                    </div>
                  </div>
                </button>
              ))
            ) : (
              <div className="py-12 text-center text-zinc-500">
                No leads found
              </div>
            )}
          </div>
        </div>

        {/* Detail Panel */}
        <div className="hidden flex-1 overflow-y-auto bg-zinc-50 lg:block" style={{ maxHeight: "calc(100vh - 180px)" }}>
          {selectedRequestId && selectedLead ? (
            <div className="p-6">
              {/* Contact Info */}
              <div className="rounded-xl border border-zinc-200 bg-white p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-zinc-900">
                      {selectedLead.contact.firstName} {selectedLead.contact.lastName}
                    </h2>
                    <p className="mt-1 text-zinc-600">
                      {selectedLead.contact.roleTitle} at {selectedLead.contact.company}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <a
                      href={`mailto:${selectedLead.contact.email}`}
                      className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                    >
                      <Mail className="h-4 w-4" />
                      Email
                    </a>
                    <a
                      href="https://calendly.com/blueprintar/30min"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                    >
                      <Calendar className="h-4 w-4" />
                      Schedule
                    </a>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-zinc-400" />
                    <div>
                      <p className="text-xs text-zinc-500">Email</p>
                      <a
                        href={`mailto:${selectedLead.contact.email}`}
                        className="text-sm text-indigo-600 hover:underline"
                      >
                        {selectedLead.contact.email}
                      </a>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Building2 className="h-5 w-5 text-zinc-400" />
                    <div>
                      <p className="text-xs text-zinc-500">Company</p>
                      <p className="text-sm text-zinc-900">
                        {selectedLead.contact.company}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <DollarSign className="h-5 w-5 text-zinc-400" />
                    <div>
                      <p className="text-xs text-zinc-500">Budget</p>
                      <p className="text-sm text-zinc-900">
                        {selectedLead.request.budgetBucket}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-zinc-400" />
                    <div>
                      <p className="text-xs text-zinc-500">Submitted</p>
                      <p className="text-sm text-zinc-900">
                        {new Date(selectedLead.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status & Priority */}
              <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-6">
                <h3 className="font-semibold text-zinc-900">Status & Priority</h3>
                <div className="mt-4 flex gap-4">
                  <div className="flex-1">
                    <label className="text-xs text-zinc-500">Status</label>
                    <select
                      value={selectedLead.status}
                      onChange={(e) => {
                        const note = window.prompt(
                          "Add a note for this status change (optional):"
                        );
                        updateStatusMutation.mutate({
                          requestId: selectedLead.requestId,
                          status: e.target.value as RequestStatus,
                          note: note || undefined,
                        });
                      }}
                      className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      {Object.entries(STATUS_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-zinc-500">Priority</label>
                    <div className="mt-1">
                      <span
                        className={`inline-flex rounded-full px-3 py-1.5 text-sm font-medium ${
                          PRIORITY_COLORS[selectedLead.priority]
                        }`}
                      >
                        {PRIORITY_LABELS[selectedLead.priority]}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Interests */}
              <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-6">
                <h3 className="font-semibold text-zinc-900">Interested In</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedLead.request.helpWith.map((item) => (
                    <span
                      key={item}
                      className="inline-flex items-center gap-1.5 rounded-full bg-indigo-100 px-3 py-1 text-sm font-medium text-indigo-700"
                    >
                      <Tag className="h-3.5 w-3.5" />
                      {HELP_LABELS[item] || item}
                    </span>
                  ))}
                </div>
                {selectedLead.request.details && (
                  <div className="mt-4 rounded-lg bg-zinc-50 p-4">
                    <p className="text-xs text-zinc-500">Additional Details</p>
                    <p className="mt-1 text-sm text-zinc-700">
                      {selectedLead.request.details}
                    </p>
                  </div>
                )}
              </div>

              {/* Context */}
              <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-6">
                <h3 className="font-semibold text-zinc-900">Source Context</h3>
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Source Page</span>
                    <a
                      href={selectedLead.context.sourcePageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-indigo-600 hover:underline"
                    >
                      {selectedLead.context.sourcePageUrl.slice(0, 40)}...
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  {selectedLead.context.referrer && (
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Referrer</span>
                      <span className="text-zinc-900">
                        {selectedLead.context.referrer}
                      </span>
                    </div>
                  )}
                  {selectedLead.context.utm.source && (
                    <div className="flex justify-between">
                      <span className="text-zinc-500">UTM Source</span>
                      <span className="text-zinc-900">
                        {selectedLead.context.utm.source}
                      </span>
                    </div>
                  )}
                  {selectedLead.context.utm.campaign && (
                    <div className="flex justify-between">
                      <span className="text-zinc-500">UTM Campaign</span>
                      <span className="text-zinc-900">
                        {selectedLead.context.utm.campaign}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Events */}
              <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-6">
                <h3 className="font-semibold text-zinc-900">Automations</h3>
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2">
                    {selectedLead.events.confirmationEmailSentAt ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-zinc-300" />
                    )}
                    <span className="text-sm text-zinc-700">
                      Confirmation email{" "}
                      {selectedLead.events.confirmationEmailSentAt
                        ? "sent"
                        : "not sent"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedLead.events.slackNotifiedAt ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-zinc-300" />
                    )}
                    <span className="text-sm text-zinc-700">
                      Slack notification{" "}
                      {selectedLead.events.slackNotifiedAt ? "sent" : "not sent"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-6">
                <h3 className="font-semibold text-zinc-900">Notes</h3>

                {/* Add note form */}
                <div className="mt-3">
                  <textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Add a note..."
                    rows={2}
                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    onClick={() => {
                      if (newNote.trim()) {
                        addNoteMutation.mutate({
                          requestId: selectedLead.requestId,
                          content: newNote.trim(),
                        });
                      }
                    }}
                    disabled={!newNote.trim() || addNoteMutation.isPending}
                    className="mt-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {addNoteMutation.isPending ? "Adding..." : "Add Note"}
                  </button>
                </div>

                {/* Notes list */}
                {selectedLead.notes && selectedLead.notes.length > 0 && (
                  <div className="mt-4 space-y-3">
                    {selectedLead.notes.map((note) => (
                      <div
                        key={note.id}
                        className="rounded-lg bg-zinc-50 p-3"
                      >
                        <p className="text-sm text-zinc-700">{note.content}</p>
                        <p className="mt-2 text-xs text-zinc-500">
                          {note.authorEmail} -{" "}
                          {new Date(note.createdAt).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Request ID */}
              <div className="mt-4 text-center">
                <p className="text-xs text-zinc-400">
                  Request ID: {selectedLead.requestId}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="text-center text-zinc-500">
                <MessageSquare className="mx-auto h-12 w-12 text-zinc-300" />
                <p className="mt-4">Select a lead to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
