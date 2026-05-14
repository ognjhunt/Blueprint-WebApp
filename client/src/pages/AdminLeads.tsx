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
import { analyticsEvents } from "@/lib/analytics";
import { withCsrfHeader } from "@/lib/csrf";
import {
  getDemandAttributionFromContext,
  hasDemandAttribution,
} from "@/lib/demandAttribution";
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
  ProofPathMilestoneKey,
  QualificationState,
  RequestPriority,
  SceneDashboardSummary,
  UpdateRequestOpsPayload,
} from "@/types/inbound-request";
import {
  BUYER_TYPE_LABELS as buyerTypeLabels,
  PROOF_PATH_MILESTONE_LABELS as proofPathMilestoneLabels,
  PROOF_PATH_PREFERENCE_LABELS as proofPathPreferenceLabels,
  REQUEST_CAPTURE_POLICY_LABELS as capturePolicyLabels,
  REQUEST_CAPTURE_STATUS_LABELS as captureStatusLabels,
  OPPORTUNITY_STATE_LABELS as opportunityStateLabels,
  REQUEST_QUOTE_STATUS_LABELS as quoteStatusLabels,
  COMMERCIAL_REQUEST_PATH_LABELS as commercialRequestPathLabels,
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

const proofPathStageButtons: Array<{
  stage: ProofPathMilestoneKey;
  label: string;
}> = [
  { stage: "proof_pack_delivered", label: "Mark proof pack delivered" },
  { stage: "proof_pack_reviewed", label: "Mark proof pack reviewed" },
  { stage: "hosted_review_ready", label: "Mark hosted review ready" },
  { stage: "hosted_review_started", label: "Mark hosted review started" },
  { stage: "hosted_review_follow_up", label: "Mark hosted follow-up" },
  { stage: "artifact_handoff_delivered", label: "Mark artifact handoff delivered" },
  { stage: "artifact_handoff_accepted", label: "Mark artifact handoff accepted" },
  { stage: "human_commercial_handoff", label: "Mark human commercial handoff" },
];

interface LeadsResponse {
  leads: InboundRequestListItem[];
}

interface StatsResponse {
  total: number;
  newLast24h: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  byQueue?: Record<string, number>;
  byWedge?: Record<string, number>;
  byRequestPath?: Record<string, number>;
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

interface ActionQueueItem {
  id: string;
  status: "pending_approval" | "failed" | string;
  lane: string;
  action_type: string;
  source_collection: string;
  source_doc_id: string;
  action_tier: number;
  idempotency_key: string;
  auto_approve_reason: string | null;
  approval_reason: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejected_by: string | null;
  rejected_reason: string | null;
  execution_attempts: number;
  last_execution_error: string | null;
  created_at: string | null;
  updated_at: string | null;
  sent_at: string | null;
  last_execution_at: string | null;
  action_payload: Record<string, unknown>;
  draft_output: Record<string, unknown>;
}

interface ActionQueueResponse {
  items: ActionQueueItem[];
  summary: {
    total: number;
    pending_approval: number;
    failed: number;
    sent?: number;
  };
}

interface FieldOpsJob {
  id: string;
  title: string;
  address: string;
  status: string;
  buyer_request_id: string | null;
  marketplace_state: string | null;
  rights_status: string | null;
  capture_policy_tier: string | null;
  field_ops: Record<string, any>;
  site_access: Record<string, any>;
  updated_at: string | null;
}

interface FieldOpsJobsResponse {
  jobs: FieldOpsJob[];
}

interface CapturerCandidate {
  uid: string;
  name: string | null;
  email: string | null;
  phone_number: string | null;
  market: string | null;
  availability: string | null;
  equipment: string[];
  totalCaptures: number;
  approvedCaptures: number;
  avgQuality: number;
  score: number;
  score_breakdown: {
    market: number;
    availability: number;
    equipment: number;
    quality: number;
    reliability: number;
  };
  travel_estimate_minutes: number | null;
  travel_estimate_source: string;
}

interface CapturerCandidatesResponse {
  candidates: CapturerCandidate[];
}

interface SiteAccessContact {
  id?: string;
  email: string;
  name: string | null;
  source: string;
  company: string | null;
  roleTitle: string | null;
  phone_number?: string | null;
  verification_status?: string | null;
  permission_state?: string | null;
  last_outreach_at?: string | null;
  last_response_at?: string | null;
  notes?: string | null;
}

interface SiteAccessContactsResponse {
  contacts: SiteAccessContact[];
}

interface RescheduleQueueItem {
  id: string;
  businessName: string;
  email: string;
  current_date: string | null;
  current_time: string | null;
  requested_date: string | null;
  requested_time: string | null;
  requested_by: string | null;
  status: string;
  reason: string | null;
}

interface RescheduleQueueResponse {
  items: RescheduleQueueItem[];
}

interface FinanceQueueItem {
  id: string;
  status: string;
  creator_id: string | null;
  capture_id: string | null;
  stripe_payout_id: string | null;
  failure_reason: string | null;
  queue: string | null;
  ops_automation: Record<string, unknown>;
  finance_review: Record<string, unknown>;
  updated_at: string | null;
}

interface SiteAccessContactFormState {
  name: string;
  email: string;
  company: string;
  roleTitle: string;
  phoneNumber: string;
  notes: string;
}

interface FinanceQueueResponse {
  items: FinanceQueueItem[];
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

function formatActionPreview(item: ActionQueueItem) {
  const payload = item.action_payload || {};
  const subject =
    typeof payload.subject === "string" && payload.subject.trim()
      ? payload.subject.trim()
      : "";
  const body =
    typeof payload.body === "string" && payload.body.trim()
      ? payload.body.trim()
      : "";
  const message =
    typeof payload.message === "string" && payload.message.trim()
      ? payload.message.trim()
      : "";

  const preview = (value: string) =>
    value.length > 240 ? `${value.slice(0, 240)}…` : value;

  if (subject || body) {
    return preview(`${subject || "Draft"}${body ? ` · ${body}` : ""}`);
  }

  if (message) {
    return preview(message);
  }

  if (typeof payload.queue === "string" && payload.queue.trim()) {
    return preview(`Route to ${payload.queue.trim()}`);
  }

  return preview(item.approval_reason || item.auto_approve_reason || "No preview available.");
}

function formatCommercialRequestPath(
  value: InboundRequestListItem["request"]["commercialRequestPath"],
) {
  return value ? commercialRequestPathLabels[value] : "Request path unknown";
}

function extractCreativeAssetUri(item: ActionQueueItem) {
  const payload = item.action_payload || {};
  const creativeContext =
    payload.creativeContext && typeof payload.creativeContext === "object"
      ? (payload.creativeContext as Record<string, unknown>)
      : null;

  if (typeof creativeContext?.storage_uri === "string" && creativeContext.storage_uri.trim()) {
    return creativeContext.storage_uri.trim();
  }

  if (
    typeof item.draft_output?.creative_asset_uri === "string"
    && item.draft_output.creative_asset_uri.trim()
  ) {
    return item.draft_output.creative_asset_uri.trim();
  }

  return null;
}

function formatStringList(value: unknown) {
  if (!Array.isArray(value)) {
    return "";
  }

  return value
    .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    .join(", ");
}

export default function AdminLeads() {
  const { currentUser, userData, tokenClaims } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [activeView, setActiveView] = useState<
    "submissions" | "hosted_review" | "waitlist" | "approvals" | "field_ops" | "agent"
  >("submissions");
  const [qualificationFilter, setQualificationFilter] = useState<QualificationState | "">("");
  const [priorityFilter, setPriorityFilter] = useState<RequestPriority | "">("");
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [selectedWaitlistSubmissionId, setSelectedWaitlistSubmissionId] = useState<string | null>(null);
  const [selectedCaptureJobId, setSelectedCaptureJobId] = useState<string | null>(null);
  const [waitlistRoleFilter, setWaitlistRoleFilter] = useState("");
  const [waitlistDeviceFilter, setWaitlistDeviceFilter] = useState("");
  const [waitlistStatusFilter, setWaitlistStatusFilter] = useState("");
  const [waitlistQueueFilter, setWaitlistQueueFilter] = useState("");
  const [waitlistSearch, setWaitlistSearch] = useState("");
  const [note, setNote] = useState("");
  const [siteAccessReviewNotes, setSiteAccessReviewNotes] = useState("");
  const [siteAccessDecisionSummary, setSiteAccessDecisionSummary] = useState("");
  const [siteAccessContactForm, setSiteAccessContactForm] = useState<SiteAccessContactFormState>({
    name: "",
    email: "",
    company: "",
    roleTitle: "",
    phoneNumber: "",
    notes: "",
  });

  const isAdmin = hasAnyRole(["admin", "ops"], userData, tokenClaims);
  const effectiveLeadQueueFilter =
    activeView === "hosted_review" ? "exact_site_hosted_review_queue" : "";

  useEffect(() => {
    if (currentUser && !isAdmin) {
      setLocation("/");
    }
  }, [currentUser, isAdmin, setLocation]);

  const leadsQuery = useQuery<LeadsResponse>({
    queryKey: ["admin-submissions", activeView, qualificationFilter, priorityFilter, effectiveLeadQueueFilter],
    enabled: isAdmin && (activeView === "submissions" || activeView === "hosted_review"),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (qualificationFilter) params.set("status", qualificationFilter);
      if (priorityFilter) params.set("priority", priorityFilter);
      if (effectiveLeadQueueFilter) params.set("queue", effectiveLeadQueueFilter);
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
    enabled:
      isAdmin &&
      (activeView === "submissions" || activeView === "hosted_review") &&
      !!selectedRequestId,
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
    onSuccess: (_, payload) => {
      queryClient.invalidateQueries({ queryKey: ["admin-submissions"] });
      queryClient.invalidateQueries({ queryKey: ["admin-submission-detail"] });
      setNote("");
      if (!selectedLead || !payload.proof_path_stage) {
        return;
      }

      const demandAttribution = getDemandAttributionFromContext(selectedLead.context);
      analyticsEvents.proofPathStageUpdated({
        proofPathStage: payload.proof_path_stage,
        action: payload.proof_path_stage_action || "mark",
        eventOrigin: "admin_ops",
        buyerType: selectedLead.request.buyerType,
        requestedLaneCount: selectedLead.request.requestedLanes.length,
        demandAttribution: hasDemandAttribution(demandAttribution)
          ? demandAttribution
          : undefined,
      });
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
      if (!selectedLead) {
        return;
      }

      const demandAttribution = getDemandAttributionFromContext(selectedLead.context);
      analyticsEvents.proofPathStageUpdated({
        proofPathStage: "hosted_review_ready",
        action: "mark",
        eventOrigin: "admin_review_link",
        buyerType: selectedLead.request.buyerType,
        requestedLaneCount: selectedLead.request.requestedLanes.length,
        demandAttribution: hasDemandAttribution(demandAttribution)
          ? demandAttribution
          : undefined,
      });
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

  const approvalQueueQuery = useQuery<ActionQueueResponse>({
    queryKey: ["admin-action-queue"],
    enabled: isAdmin && activeView === "approvals",
    queryFn: async () => {
      const response = await fetch("/api/admin/leads/action-queue?limit=100", {
        headers: await withCsrfHeader({}),
      });
      if (!response.ok) throw new Error("Failed to fetch action queue");
      return response.json();
    },
  });

  const approveActionMutation = useMutation({
    mutationFn: async (ledgerId: string) => {
      const response = await fetch(`/api/admin/leads/action-queue/${ledgerId}/approve`, {
        method: "POST",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
      });
      if (!response.ok) throw new Error("Failed to approve action");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-action-queue"] });
    },
  });

  const rejectActionMutation = useMutation({
    mutationFn: async ({ ledgerId, reason }: { ledgerId: string; reason: string }) => {
      const response = await fetch(`/api/admin/leads/action-queue/${ledgerId}/reject`, {
        method: "POST",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
        body: JSON.stringify({ reason }),
      });
      if (!response.ok) throw new Error("Failed to reject action");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-action-queue"] });
    },
  });

  const retryActionMutation = useMutation({
    mutationFn: async (ledgerId: string) => {
      const response = await fetch(`/api/admin/leads/action-queue/${ledgerId}/retry`, {
        method: "POST",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
      });
      if (!response.ok) throw new Error("Failed to retry action");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-action-queue"] });
    },
  });

  const fieldOpsJobsQuery = useQuery<FieldOpsJobsResponse>({
    queryKey: ["admin-field-ops-jobs"],
    enabled: isAdmin && activeView === "field_ops",
    queryFn: async () => {
      const response = await fetch("/api/admin/field-ops/capture-jobs?limit=50", {
        headers: await withCsrfHeader({}),
      });
      if (!response.ok) throw new Error("Failed to fetch field ops jobs");
      return response.json();
    },
  });

  const fieldOpsCandidatesQuery = useQuery<CapturerCandidatesResponse>({
    queryKey: ["admin-field-ops-candidates", selectedCaptureJobId],
    enabled: isAdmin && activeView === "field_ops" && !!selectedCaptureJobId,
    queryFn: async () => {
      const response = await fetch(
        `/api/admin/field-ops/capture-jobs/${selectedCaptureJobId}/candidates`,
        {
          headers: await withCsrfHeader({}),
        },
      );
      if (!response.ok) throw new Error("Failed to fetch capturer candidates");
      return response.json();
    },
  });

  const siteAccessContactsQuery = useQuery<SiteAccessContactsResponse>({
    queryKey: ["admin-field-ops-site-access-contacts", selectedCaptureJobId],
    enabled: isAdmin && activeView === "field_ops" && !!selectedCaptureJobId,
    queryFn: async () => {
      const response = await fetch(
        `/api/admin/field-ops/capture-jobs/${selectedCaptureJobId}/site-access/contacts`,
        {
          headers: await withCsrfHeader({}),
        },
      );
      if (!response.ok) throw new Error("Failed to fetch site-access contacts");
      return response.json();
    },
  });

  const rescheduleQueueQuery = useQuery<RescheduleQueueResponse>({
    queryKey: ["admin-field-ops-reschedule-queue"],
    enabled: isAdmin && activeView === "field_ops",
    queryFn: async () => {
      const response = await fetch("/api/admin/field-ops/reschedule-queue", {
        headers: await withCsrfHeader({}),
      });
      if (!response.ok) throw new Error("Failed to fetch reschedule queue");
      return response.json();
    },
  });

  const financeQueueQuery = useQuery<FinanceQueueResponse>({
    queryKey: ["admin-field-ops-finance-queue"],
    enabled: isAdmin && activeView === "field_ops",
    queryFn: async () => {
      const response = await fetch("/api/admin/field-ops/finance-queue", {
        headers: await withCsrfHeader({}),
      });
      if (!response.ok) throw new Error("Failed to fetch finance queue");
      return response.json();
    },
  });

  const assignCapturerMutation = useMutation({
    mutationFn: async ({
      captureJobId,
      creatorId,
      sendConfirmation,
    }: {
      captureJobId: string;
      creatorId: string;
      sendConfirmation: boolean;
    }) => {
      const response = await fetch(
        `/api/admin/field-ops/capture-jobs/${captureJobId}/assign-capturer`,
        {
          method: "POST",
          headers: await withCsrfHeader({ "Content-Type": "application/json" }),
          body: JSON.stringify({
            creator_id: creatorId,
            send_confirmation: sendConfirmation,
          }),
        },
      );
      if (!response.ok) throw new Error("Failed to assign capturer");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-field-ops-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["admin-field-ops-candidates"] });
    },
  });

  const sendCapturerCommMutation = useMutation({
    mutationFn: async ({
      captureJobId,
      communicationType,
    }: {
      captureJobId: string;
      communicationType: string;
    }) => {
      const response = await fetch(
        `/api/admin/field-ops/capture-jobs/${captureJobId}/capturer-comms`,
        {
          method: "POST",
          headers: await withCsrfHeader({ "Content-Type": "application/json" }),
          body: JSON.stringify({ communication_type: communicationType }),
        },
      );
      if (!response.ok) throw new Error("Failed to send capturer communication");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-field-ops-jobs"] });
    },
  });

  const sendSiteAccessOutreachMutation = useMutation({
    mutationFn: async ({
      captureJobId,
      operatorEmail,
      operatorName,
      operatorCompany,
      operatorRoleTitle,
      operatorPhoneNumber,
      source,
    }: {
      captureJobId: string;
      operatorEmail: string;
      operatorName?: string | null;
      operatorCompany?: string | null;
      operatorRoleTitle?: string | null;
      operatorPhoneNumber?: string | null;
      source?: string | null;
    }) => {
      const response = await fetch(
        `/api/admin/field-ops/capture-jobs/${captureJobId}/site-access/outreach`,
        {
          method: "POST",
          headers: await withCsrfHeader({ "Content-Type": "application/json" }),
          body: JSON.stringify({
            operator_email: operatorEmail,
            operator_name: operatorName,
            operator_company: operatorCompany,
            operator_role_title: operatorRoleTitle,
            operator_phone_number: operatorPhoneNumber,
            source,
          }),
        },
      );
      if (!response.ok) throw new Error("Failed to send site-access outreach");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-field-ops-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["admin-field-ops-site-access-contacts"] });
    },
  });

  const updateSiteAccessStatusMutation = useMutation({
    mutationFn: async ({
      captureJobId,
      status,
      operatorEmail,
      operatorName,
      operatorCompany,
      operatorRoleTitle,
      operatorPhoneNumber,
      notes,
      decisionSummary,
    }: {
      captureJobId: string;
      status: string;
      operatorEmail?: string | null;
      operatorName?: string | null;
      operatorCompany?: string | null;
      operatorRoleTitle?: string | null;
      operatorPhoneNumber?: string | null;
      notes?: string;
      decisionSummary?: string;
    }) => {
      const response = await fetch(
        `/api/admin/field-ops/capture-jobs/${captureJobId}/site-access/status`,
        {
          method: "PATCH",
          headers: await withCsrfHeader({ "Content-Type": "application/json" }),
          body: JSON.stringify({
            status,
            operator_email: operatorEmail,
            operator_name: operatorName,
            operator_company: operatorCompany,
            operator_role_title: operatorRoleTitle,
            operator_phone_number: operatorPhoneNumber,
            notes,
            decision_summary: decisionSummary,
          }),
        },
      );
      if (!response.ok) throw new Error("Failed to update site-access status");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-field-ops-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["admin-field-ops-site-access-contacts"] });
    },
  });

  const saveSiteAccessContactMutation = useMutation({
    mutationFn: async ({
      captureJobId,
      ...payload
    }: SiteAccessContactFormState & { captureJobId: string }) => {
      const response = await fetch(
        `/api/admin/field-ops/capture-jobs/${captureJobId}/site-access/contacts`,
        {
          method: "POST",
          headers: await withCsrfHeader({ "Content-Type": "application/json" }),
          body: JSON.stringify({
            email: payload.email,
            name: payload.name,
            company: payload.company,
            role_title: payload.roleTitle,
            phone_number: payload.phoneNumber,
            notes: payload.notes,
            source: "manual_entry",
            verification_status: "unverified",
          }),
        },
      );
      if (!response.ok) throw new Error("Failed to save site-access contact");
      return response.json();
    },
    onSuccess: () => {
      setSiteAccessContactForm({
        name: "",
        email: "",
        company: "",
        roleTitle: "",
        phoneNumber: "",
        notes: "",
      });
      queryClient.invalidateQueries({ queryKey: ["admin-field-ops-site-access-contacts"] });
    },
  });

  const updateFinanceReviewMutation = useMutation({
    mutationFn: async ({
      payoutId,
      reviewStatus,
      nextAction,
      notes,
      ownerEmail,
      manualActionType,
    }: {
      payoutId: string;
      reviewStatus: string;
      nextAction: string;
      notes?: string;
      ownerEmail?: string;
      manualActionType?: string;
    }) => {
      const response = await fetch(`/api/admin/field-ops/finance-queue/${payoutId}`, {
        method: "PATCH",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          review_status: reviewStatus,
          next_action: nextAction,
          notes,
          owner_email: ownerEmail,
          manual_action_type: manualActionType,
        }),
      });
      if (!response.ok) throw new Error("Failed to update finance review");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-field-ops-finance-queue"] });
    },
  });

  const runReminderLoopMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/admin/field-ops/automation/capturer-reminders/run", {
        method: "POST",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
      });
      if (!response.ok) throw new Error("Failed to run reminder loop");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-field-ops-jobs"] });
    },
  });

  const runOverdueReviewWatchdogMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/admin/field-ops/automation/manual-review-watchdogs/run", {
        method: "POST",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
      });
      if (!response.ok) throw new Error("Failed to run overdue review watchdogs");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-field-ops-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["admin-field-ops-finance-queue"] });
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
  const approvalQueueItems = approvalQueueQuery.data?.items ?? [];
  const fieldOpsJobs = fieldOpsJobsQuery.data?.jobs ?? [];
  const selectedCaptureJob =
    fieldOpsJobs.find((job) => job.id === selectedCaptureJobId)
    ?? fieldOpsJobs[0]
    ?? null;
  const capturerCandidates = fieldOpsCandidatesQuery.data?.candidates ?? [];
  const siteAccessContacts = siteAccessContactsQuery.data?.contacts ?? [];
  const rescheduleQueueItems = rescheduleQueueQuery.data?.items ?? [];
  const financeQueueItems = financeQueueQuery.data?.items ?? [];
  const primarySiteAccessContact = siteAccessContacts[0] ?? null;
  const selectedSiteAccess = selectedCaptureJob?.site_access ?? {};
  const selectedDispatchReview = selectedCaptureJob?.field_ops?.dispatch_review ?? {};
  const selectedSiteAccessOverdueReview =
    (selectedSiteAccess.overdue_review as Record<string, unknown> | undefined) ?? {};
  const overdueSiteAccessCount = fieldOpsJobs.filter(
    (job) =>
      ((job.site_access?.overdue_review as Record<string, unknown> | undefined)?.active) === true,
  ).length;
  const overdueFinanceCount = financeQueueItems.filter(
    (item) =>
      ((item.finance_review?.overdue_review as Record<string, unknown> | undefined)?.active) ===
      true,
  ).length;

  useEffect(() => {
    if ((activeView === "submissions" || activeView === "hosted_review") && leads[0]) {
      const hasSelectedLead = leads.some((lead) => lead.requestId === selectedRequestId);
      if (!hasSelectedLead) {
        setSelectedRequestId(leads[0].requestId);
      }
    }
  }, [activeView, leads, selectedRequestId]);

  useEffect(() => {
    if (activeView === "waitlist" && !selectedWaitlistSubmissionId && filteredWaitlistSubmissions[0]) {
      setSelectedWaitlistSubmissionId(filteredWaitlistSubmissions[0].id);
    }
  }, [activeView, filteredWaitlistSubmissions, selectedWaitlistSubmissionId]);

  useEffect(() => {
    if (activeView === "field_ops" && !selectedCaptureJobId && fieldOpsJobs[0]) {
      setSelectedCaptureJobId(fieldOpsJobs[0].id);
    }
  }, [activeView, fieldOpsJobs, selectedCaptureJobId]);

  useEffect(() => {
    setSiteAccessReviewNotes("");
    setSiteAccessDecisionSummary("");
    setSiteAccessContactForm({
      name: "",
      email: "",
      company: "",
      roleTitle: "",
      phoneNumber: "",
      notes: "",
    });
  }, [selectedCaptureJobId]);

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

    if (activeView === "approvals") {
      return [
        {
          label: "Queued items",
          value: approvalQueueQuery.data?.summary.total ?? approvalQueueItems.length,
        },
        {
          label: "Pending approval",
          value: approvalQueueQuery.data?.summary.pending_approval ?? 0,
        },
        {
          label: "Failed",
          value: approvalQueueQuery.data?.summary.failed ?? 0,
        },
        {
          label: "Tier 3 items",
          value: approvalQueueItems.filter((item) => item.action_tier === 3).length,
        },
      ];
    }

    if (activeView === "field_ops") {
      return [
        { label: "Capture jobs", value: fieldOpsJobs.length },
        {
          label: "Pending site access",
          value: fieldOpsJobs.filter(
            (job) => job.site_access?.permission_state === "awaiting_response",
          ).length,
        },
        { label: "Overdue site access", value: overdueSiteAccessCount },
        { label: "Reschedules", value: rescheduleQueueItems.length },
        { label: "Finance queue", value: financeQueueItems.length },
        { label: "Overdue finance", value: overdueFinanceCount },
      ];
    }

    if (activeView === "agent") {
      return [];
    }

    if (activeView === "hosted_review") {
      return [
        {
          label: "Hosted-review queue",
          value: statsQuery.data?.byQueue?.exact_site_hosted_review_queue ?? leads.length,
        },
        {
          label: "Exact-site wedge",
          value: statsQuery.data?.byWedge?.exact_site_hosted_review ?? leads.length,
        },
        {
          label: "High priority",
          value: leads.filter((lead) => lead.priority === "high").length,
        },
        {
          label: "Exact-site required",
          value: leads.filter(
            (lead) => lead.request.proofPathPreference === "exact_site_required",
          ).length,
        },
      ];
    }

    return [
      { label: "Total submissions", value: statsQuery.data?.total ?? 0 },
      { label: "Last 24h", value: statsQuery.data?.newLast24h ?? 0 },
      {
        label: "World model",
        value:
          statsQuery.data?.byRequestPath?.world_model ??
          leads.filter((lead) => lead.request.commercialRequestPath === "world_model").length,
      },
      {
        label: "Hosted eval",
        value:
          statsQuery.data?.byRequestPath?.hosted_evaluation ??
          leads.filter((lead) => lead.request.commercialRequestPath === "hosted_evaluation").length,
      },
      {
        label: "Capture access",
        value:
          statsQuery.data?.byRequestPath?.capture_access ??
          leads.filter((lead) => lead.request.commercialRequestPath === "capture_access").length,
      },
    ];
  }, [
    activeView,
    approvalQueueItems,
    fieldOpsJobs,
    financeQueueItems.length,
    approvalQueueQuery.data?.summary.failed,
    approvalQueueQuery.data?.summary.pending_approval,
    approvalQueueQuery.data?.summary.total,
    filteredWaitlistSubmissions,
    leads,
    overdueFinanceCount,
    overdueSiteAccessCount,
    rescheduleQueueItems.length,
    statsQuery.data,
    waitlistQuery.data?.pagination.total,
  ]);

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
                : activeView === "hosted_review"
                  ? "Exact-Site Hosted Review Queue"
                : activeView === "waitlist"
                  ? "Ops Intake Queue"
                  : activeView === "approvals"
                    ? "Action Ledger"
                    : activeView === "field_ops"
                      ? "Field Ops"
                  : "Ops Agent Console"}
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-zinc-950">
              {activeView === "submissions"
                ? "Qualification submissions"
                : activeView === "hosted_review"
                  ? "Hosted-review requests"
                : activeView === "waitlist"
                  ? "Waitlist and beta requests"
                  : activeView === "approvals"
                    ? "Phase 2 approvals"
                    : activeView === "field_ops"
                      ? "Field ops control room"
                  : "Startup operations agent"}
            </h1>
            <p className="mt-2 text-zinc-600">
              {activeView === "submissions"
                ? "Move submissions through qualification state and only activate opportunity state once a site clears review."
                : activeView === "hosted_review"
                  ? "Work the narrow exact-site hosted-review wedge from intake to proof-pack, hosted review, and human commercial handoff."
                : activeView === "waitlist"
                  ? "Review structured waitlist and private beta intake without dropping into Firestore."
                  : activeView === "approvals"
                    ? "Review the Phase 2 action ledger, then approve, reject, or retry low-risk operator actions."
                    : activeView === "field_ops"
                      ? "Assign capturers, send comms, work the reschedule queue, and track site-access plus finance review from one place."
                  : "Create agent threads, attach startup context, route work into Codex or Claude Code, and approve sensitive runs in one place."}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Tabs
              value={activeView}
              onValueChange={(value) =>
                setActiveView(
                  value as
                    | "submissions"
                    | "hosted_review"
                    | "waitlist"
                    | "approvals"
                    | "field_ops"
                    | "agent",
                )
              }
            >
              <TabsList className="rounded-full border border-zinc-200 bg-white p-1">
                <TabsTrigger value="submissions" className="rounded-full px-4">
                  Qualification
                </TabsTrigger>
                <TabsTrigger value="hosted_review" className="rounded-full px-4">
                  Hosted Review
                </TabsTrigger>
                <TabsTrigger value="waitlist" className="rounded-full px-4">
                  Waitlist / Beta
                </TabsTrigger>
                <TabsTrigger value="approvals" className="rounded-full px-4">
                  Approvals
                </TabsTrigger>
                <TabsTrigger value="field_ops" className="rounded-full px-4">
                  Field Ops
                </TabsTrigger>
                <TabsTrigger value="agent" className="rounded-full px-4">
                  Agent
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <button
              type="button"
              onClick={() =>
                activeView === "submissions" || activeView === "hosted_review"
                  ? leadsQuery.refetch()
                  : activeView === "waitlist"
                    ? waitlistQuery.refetch()
                    : activeView === "approvals"
                      ? approvalQueueQuery.refetch()
                      : activeView === "field_ops"
                        ? Promise.all([
                            fieldOpsJobsQuery.refetch(),
                            rescheduleQueueQuery.refetch(),
                            financeQueueQuery.refetch(),
                            selectedCaptureJobId
                              ? fieldOpsCandidatesQuery.refetch()
                              : Promise.resolve(undefined),
                            selectedCaptureJobId
                              ? siteAccessContactsQuery.refetch()
                              : Promise.resolve(undefined),
                          ])
                    : queryClient.invalidateQueries({ queryKey: ["admin-agent-sessions"] })
              }
              className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-700"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </button>
            <a
              href="/admin/growth-ops-scorecard"
              className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-700"
            >
              <ClipboardList className="mr-2 h-4 w-4" />
              Growth scorecard
            </a>
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
            ) : activeView === "field_ops" ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => runOverdueReviewWatchdogMutation.mutate()}
                  className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-700"
                  disabled={runOverdueReviewWatchdogMutation.isPending}
                >
                  <AlertCircle className="mr-2 h-4 w-4" />
                  {runOverdueReviewWatchdogMutation.isPending
                    ? "Running overdue scan..."
                    : "Run overdue review scan"}
                </button>
                <button
                  type="button"
                  onClick={() => runReminderLoopMutation.mutate()}
                  className="inline-flex items-center rounded-full bg-zinc-950 px-4 py-2 text-sm text-white"
                  disabled={runReminderLoopMutation.isPending}
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  {runReminderLoopMutation.isPending ? "Running reminders..." : "Run reminders"}
                </button>
              </div>
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
        ) : activeView === "approvals" ? (
          <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="space-y-3">
              {approvalQueueQuery.isLoading ? (
                <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-zinc-600">
                  Loading action queue...
                </div>
              ) : approvalQueueItems.length === 0 ? (
                <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-zinc-600">
                  No pending approvals or failed actions right now.
                </div>
              ) : (
                approvalQueueItems.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-zinc-200 bg-white p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">
                          {item.lane}
                        </p>
                        <p className="mt-1 text-lg font-medium text-zinc-950">{item.action_type}</p>
                        <p className="mt-1 text-sm text-zinc-600">
                          {item.source_collection} / {item.source_doc_id}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            item.status === "failed"
                              ? "bg-rose-100 text-rose-700"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {item.status.replace(/_/g, " ")}
                        </span>
                        <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-700">
                          Tier {item.action_tier}
                        </span>
                      </div>
                    </div>

                    <p className="mt-3 text-sm text-zinc-700">{formatActionPreview(item)}</p>
                    <div className="mt-4 grid gap-2 text-xs text-zinc-500 md:grid-cols-2">
                      <p>Attempts: {item.execution_attempts}</p>
                      <p>Updated: {item.updated_at ? formatDate(item.updated_at) : "unknown"}</p>
                      <p>
                        Confidence:{" "}
                        {typeof item.draft_output.confidence === "number"
                          ? Math.round(item.draft_output.confidence * 100) / 100
                          : "n/a"}
                      </p>
                      <p>
                        Recommendation:{" "}
                        {typeof item.draft_output.recommendation === "string"
                          ? item.draft_output.recommendation
                          : "n/a"}
                      </p>
                    </div>

                    {item.last_execution_error ? (
                      <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
                        {item.last_execution_error}
                      </p>
                    ) : null}

                    {extractCreativeAssetUri(item) ? (
                      <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
                        <p className="font-medium">Creative asset context</p>
                        <p className="mt-2 break-all font-mono text-xs">
                          {extractCreativeAssetUri(item)}
                        </p>
                      </div>
                    ) : null}

                    <div className="mt-4 flex flex-wrap gap-2">
                      {item.status === "pending_approval" ? (
                        <>
                          <button
                            type="button"
                            onClick={() => approveActionMutation.mutate(item.id)}
                            className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white"
                            disabled={approveActionMutation.isPending}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const reason = window.prompt(
                                "Why is this action being rejected?",
                                "Operator review required",
                              );
                              if (!reason?.trim()) {
                                return;
                              }
                              rejectActionMutation.mutate({
                                ledgerId: item.id,
                                reason: reason.trim(),
                              });
                            }}
                            className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700"
                            disabled={rejectActionMutation.isPending}
                          >
                            Reject
                          </button>
                        </>
                      ) : null}
                      {item.status === "failed" ? (
                        <button
                          type="button"
                          onClick={() => retryActionMutation.mutate(item.id)}
                          className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700"
                          disabled={retryActionMutation.isPending}
                        >
                          Retry
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Control model
              </p>
              <div className="mt-4 space-y-3 text-sm text-zinc-700">
                <p>Low-risk reversible actions can auto-send when the lane policy allows it.</p>
                <p>Pending approval items stay parked until an operator approves or rejects them.</p>
                <p>Failed actions can be retried if the executor marks them as safe to replay.</p>
                <p>Money movement, disputes, rights, privacy, and unusual cases remain human-gated.</p>
              </div>
            </div>
          </div>
        ) : activeView === "field_ops" ? (
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="space-y-3">
                {fieldOpsJobsQuery.isLoading ? (
                  <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-zinc-600">
                    Loading capture jobs...
                  </div>
                ) : fieldOpsJobs.length === 0 ? (
                  <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-zinc-600">
                    No capture jobs are available right now.
                  </div>
                ) : (
                  fieldOpsJobs.map((job) => (
                    <button
                      key={job.id}
                      type="button"
                      onClick={() => setSelectedCaptureJobId(job.id)}
                      className={`w-full rounded-2xl border p-5 text-left ${
                        selectedCaptureJob?.id === job.id
                          ? "border-zinc-900 bg-white"
                          : "border-zinc-200 bg-white"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">
                            {job.marketplace_state || "capture job"}
                          </p>
                          <p className="mt-1 text-lg font-medium text-zinc-950">{job.title}</p>
                          <p className="mt-1 text-sm text-zinc-600">{job.address}</p>
                        </div>
                        <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-700">
                          {job.status || "untracked"}
                        </span>
                      </div>
                      <div className="mt-3 grid gap-2 text-xs text-zinc-500 md:grid-cols-2">
                        <p>
                          Assigned:{" "}
                          {typeof job.field_ops?.capturer_assignment?.name === "string"
                            ? job.field_ops.capturer_assignment.name
                            : "unassigned"}
                        </p>
                        <p>
                          Site access:{" "}
                          {typeof job.site_access?.permission_state === "string"
                            ? job.site_access.permission_state
                            : "not_started"}
                        </p>
                      </div>
                      {job.site_access?.overdue_review?.active === true ? (
                        <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
                          Overdue site-access follow-up:{" "}
                          {typeof job.site_access?.overdue_review?.reason === "string"
                            ? job.site_access.overdue_review.reason
                            : "Needs human follow-up."}
                        </p>
                      ) : null}
                    </button>
                  ))
                )}
              </div>

              <div className="space-y-6">
                {selectedCaptureJob ? (
                  <>
                    <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                            Selected capture job
                          </p>
                          <h2 className="mt-2 text-2xl font-semibold text-zinc-950">
                            {selectedCaptureJob.title}
                          </h2>
                          <p className="mt-2 text-sm text-zinc-600">
                            {selectedCaptureJob.address}
                          </p>
                        </div>
                        <a
                          href={selectedCaptureJob.buyer_request_id
                            ? `#request-${selectedCaptureJob.buyer_request_id}`
                            : "#"}
                          className="inline-flex items-center text-sm text-zinc-600"
                        >
                          Request link
                          <ArrowUpRight className="ml-2 h-4 w-4" />
                        </a>
                      </div>

                      <div className="mt-4 grid gap-3 text-sm text-zinc-700 md:grid-cols-2">
                        <p>Rights: {selectedCaptureJob.rights_status || "unknown"}</p>
                        <p>Policy: {selectedCaptureJob.capture_policy_tier || "review_required"}</p>
                        <p>
                          Assigned capturer:{" "}
                          {selectedCaptureJob.field_ops?.capturer_assignment?.name || "unassigned"}
                        </p>
                        <p>
                          Site access:{" "}
                          {selectedCaptureJob.site_access?.permission_state || "not_started"}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                        Capturer assignment
                      </p>
                      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                        <p className="font-medium">Dispatch remains heuristic-only.</p>
                        <p className="mt-1 text-amber-800">
                          Ranking uses stored market, equipment, availability, and capture stats. This lane does not have live calendar availability or travel-routing verification, so operators still need to confirm acceptance and logistics.
                        </p>
                        <p className="mt-2 text-xs text-amber-700">
                          Current review state: {typeof selectedDispatchReview.review_state === "string"
                            ? selectedDispatchReview.review_state
                            : "not recorded"}
                        </p>
                        {Array.isArray(selectedDispatchReview.missing_inputs) ? (
                          <p className="mt-1 text-xs text-amber-700">
                            Missing inputs: {formatStringList(selectedDispatchReview.missing_inputs)}
                          </p>
                        ) : null}
                      </div>
                      <div className="mt-4 space-y-3">
                        {capturerCandidates.map((candidate) => (
                          <div
                            key={candidate.uid}
                            className="rounded-xl border border-zinc-200 p-4"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-medium text-zinc-950">
                                  {candidate.name || candidate.email || candidate.uid}
                                </p>
                                <p className="mt-1 text-xs text-zinc-500">
                                  {candidate.market || "Unknown market"} · {candidate.availability || "Unknown availability"}
                                </p>
                                <p className="mt-1 text-xs text-zinc-500">
                                  Equipment: {candidate.equipment.join(", ") || "unknown"}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-medium text-zinc-950">
                                  Score {candidate.score}
                                </p>
                                <p className="text-xs text-zinc-500">
                                  Travel {candidate.travel_estimate_minutes ?? "?"} min
                                </p>
                                <p className="mt-1 text-[11px] text-zinc-400">
                                  {candidate.travel_estimate_source === "unknown"
                                    ? "No routing integration"
                                    : `Source: ${candidate.travel_estimate_source}`}
                                </p>
                              </div>
                            </div>
                            <div className="mt-3 grid gap-2 text-xs text-zinc-500 md:grid-cols-2">
                              <p>Market fit: {candidate.score_breakdown.market}</p>
                              <p>Availability fit: {candidate.score_breakdown.availability}</p>
                              <p>Equipment fit: {candidate.score_breakdown.equipment}</p>
                              <p>Reliability fit: {candidate.score_breakdown.reliability}</p>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  assignCapturerMutation.mutate({
                                    captureJobId: selectedCaptureJob.id,
                                    creatorId: candidate.uid,
                                    sendConfirmation: false,
                                  })
                                }
                                className="rounded-full border border-zinc-200 px-3 py-2 text-sm text-zinc-700"
                              >
                                Assign
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  assignCapturerMutation.mutate({
                                    captureJobId: selectedCaptureJob.id,
                                    creatorId: candidate.uid,
                                    sendConfirmation: true,
                                  })
                                }
                                className="rounded-full bg-zinc-950 px-3 py-2 text-sm text-white"
                              >
                                Assign + confirm
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                        Ops actions
                      </p>
                      <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                        <p className="font-medium">Site access is structured, not autonomous.</p>
                        <p className="mt-1 text-blue-800">
                          Blueprint can draft the first outreach and preserve provenance on who was contacted, but access negotiations, conditional terms, privacy/legal interpretation, and denials stay with a human operator.
                        </p>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            sendCapturerCommMutation.mutate({
                              captureJobId: selectedCaptureJob.id,
                              communicationType: "reminder_48h",
                            })
                          }
                          className="rounded-full border border-zinc-200 px-3 py-2 text-sm text-zinc-700"
                        >
                          Send 48h reminder
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            sendCapturerCommMutation.mutate({
                              captureJobId: selectedCaptureJob.id,
                              communicationType: "reminder_24h",
                            })
                          }
                          className="rounded-full border border-zinc-200 px-3 py-2 text-sm text-zinc-700"
                        >
                          Send 24h reminder
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateSiteAccessStatusMutation.mutate({
                              captureJobId: selectedCaptureJob.id,
                              status: "granted",
                              operatorEmail: primarySiteAccessContact?.email || null,
                              operatorName: primarySiteAccessContact?.name || null,
                              operatorCompany: primarySiteAccessContact?.company || null,
                              operatorRoleTitle: primarySiteAccessContact?.roleTitle || null,
                              operatorPhoneNumber: primarySiteAccessContact?.phone_number || null,
                              notes: siteAccessReviewNotes,
                              decisionSummary:
                                siteAccessDecisionSummary
                                || "Human operator confirmed that site access is granted.",
                            })
                          }
                          className="rounded-full border border-zinc-200 px-3 py-2 text-sm text-zinc-700"
                        >
                          Mark site access granted
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateSiteAccessStatusMutation.mutate({
                              captureJobId: selectedCaptureJob.id,
                              status: "conditional",
                              operatorEmail: primarySiteAccessContact?.email || null,
                              operatorName: primarySiteAccessContact?.name || null,
                              operatorCompany: primarySiteAccessContact?.company || null,
                              operatorRoleTitle: primarySiteAccessContact?.roleTitle || null,
                              operatorPhoneNumber: primarySiteAccessContact?.phone_number || null,
                              notes: siteAccessReviewNotes,
                              decisionSummary:
                                siteAccessDecisionSummary
                                || "Conditional access requires human follow-up on terms or restrictions.",
                            })
                          }
                          className="rounded-full border border-zinc-200 px-3 py-2 text-sm text-zinc-700"
                        >
                          Mark conditional
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateSiteAccessStatusMutation.mutate({
                              captureJobId: selectedCaptureJob.id,
                              status: "review_required",
                              operatorEmail: primarySiteAccessContact?.email || null,
                              operatorName: primarySiteAccessContact?.name || null,
                              operatorCompany: primarySiteAccessContact?.company || null,
                              operatorRoleTitle: primarySiteAccessContact?.roleTitle || null,
                              operatorPhoneNumber: primarySiteAccessContact?.phone_number || null,
                              notes: siteAccessReviewNotes,
                              decisionSummary:
                                siteAccessDecisionSummary
                                || "Operator review is still required before any capture is scheduled.",
                            })
                          }
                          className="rounded-full border border-zinc-200 px-3 py-2 text-sm text-zinc-700"
                        >
                          Keep in review
                        </button>
                      </div>

                      <div className="mt-6 grid gap-3 md:grid-cols-2">
                        <label className="space-y-2 text-sm text-zinc-700">
                          <span className="font-medium text-zinc-900">Operator notes</span>
                          <textarea
                            value={siteAccessReviewNotes}
                            onChange={(event) => setSiteAccessReviewNotes(event.target.value)}
                            placeholder="Document access restrictions, unanswered questions, or what needs human follow-up."
                            className="min-h-[96px] w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                          />
                        </label>
                        <label className="space-y-2 text-sm text-zinc-700">
                          <span className="font-medium text-zinc-900">Decision summary</span>
                          <textarea
                            value={siteAccessDecisionSummary}
                            onChange={(event) => setSiteAccessDecisionSummary(event.target.value)}
                            placeholder="Capture the current human judgment: granted, conditional, denied, or still unresolved."
                            className="min-h-[96px] w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                          />
                        </label>
                      </div>

                      <div className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
                        <p className="font-medium text-zinc-900">Current site-access review</p>
                        {selectedSiteAccessOverdueReview.active === true ? (
                          <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
                            Overdue review:{" "}
                            {typeof selectedSiteAccessOverdueReview.reason === "string"
                              ? selectedSiteAccessOverdueReview.reason
                              : "Human follow-up is past due."}
                          </p>
                        ) : null}
                        <div className="mt-3 grid gap-2 md:grid-cols-2">
                          <p>
                            Workflow stage:{" "}
                            {typeof selectedSiteAccess.workflow_stage === "string"
                              ? selectedSiteAccess.workflow_stage
                              : "contact_acquisition"}
                          </p>
                          <p>
                            Follow-up due:{" "}
                            {typeof selectedSiteAccess.follow_up_due_at === "string"
                              ? formatDate(selectedSiteAccess.follow_up_due_at)
                              : "not set"}
                          </p>
                          <p>
                            Evidence required:{" "}
                            {formatStringList(selectedSiteAccess.review_requirements?.required_evidence)
                              || "verified contact, window, restrictions"}
                          </p>
                          <p>
                            Restrictions:{" "}
                            {formatStringList(selectedSiteAccess.restrictions) || "not documented"}
                          </p>
                        </div>
                        {typeof selectedSiteAccess.human_only_boundary === "string" ? (
                          <p className="mt-3 text-xs text-zinc-500">
                            {selectedSiteAccess.human_only_boundary}
                          </p>
                        ) : null}
                      </div>

                      <div className="mt-6">
                        <p className="text-sm font-medium text-zinc-900">
                          Site-access contacts
                        </p>
                        <div className="mt-3 space-y-2">
                          {siteAccessContacts.length === 0 ? (
                            <p className="text-sm text-zinc-500">
                              No discovered contacts yet.
                            </p>
                          ) : (
                            siteAccessContacts.map((contact) => (
                              <div
                                key={`${contact.source}-${contact.email}`}
                                className="flex items-center justify-between rounded-xl border border-zinc-200 p-3"
                              >
                                <div>
                                  <p className="text-sm font-medium text-zinc-950">
                                    {contact.name || contact.email}
                                  </p>
                                  <p className="text-xs text-zinc-500">
                                    {contact.email} · {contact.source}
                                    {contact.verification_status
                                      ? ` · ${contact.verification_status}`
                                      : ""}
                                  </p>
                                  {contact.company || contact.roleTitle ? (
                                    <p className="text-xs text-zinc-500">
                                      {[contact.company, contact.roleTitle].filter(Boolean).join(" · ")}
                                    </p>
                                  ) : null}
                                  {contact.notes ? (
                                    <p className="mt-1 text-xs text-zinc-500">{contact.notes}</p>
                                  ) : null}
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    sendSiteAccessOutreachMutation.mutate({
                                      captureJobId: selectedCaptureJob.id,
                                      operatorEmail: contact.email,
                                      operatorName: contact.name,
                                      operatorCompany: contact.company,
                                      operatorRoleTitle: contact.roleTitle,
                                      operatorPhoneNumber: contact.phone_number,
                                      source: contact.source,
                                    })
                                  }
                                  className="rounded-full border border-zinc-200 px-3 py-2 text-sm text-zinc-700"
                                >
                                  Send outreach
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="mt-6 rounded-xl border border-zinc-200 p-4">
                        <p className="text-sm font-medium text-zinc-900">Add operator contact</p>
                        <p className="mt-1 text-xs text-zinc-500">
                          Use this when the correct contact comes from a call, email thread, or site visit rather than an existing Blueprint record.
                        </p>
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <input
                            value={siteAccessContactForm.name}
                            onChange={(event) =>
                              setSiteAccessContactForm((current) => ({
                                ...current,
                                name: event.target.value,
                              }))
                            }
                            placeholder="Contact name"
                            className="rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                          />
                          <input
                            value={siteAccessContactForm.email}
                            onChange={(event) =>
                              setSiteAccessContactForm((current) => ({
                                ...current,
                                email: event.target.value,
                              }))
                            }
                            placeholder="contact@site.com"
                            className="rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                          />
                          <input
                            value={siteAccessContactForm.company}
                            onChange={(event) =>
                              setSiteAccessContactForm((current) => ({
                                ...current,
                                company: event.target.value,
                              }))
                            }
                            placeholder="Operator company"
                            className="rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                          />
                          <input
                            value={siteAccessContactForm.roleTitle}
                            onChange={(event) =>
                              setSiteAccessContactForm((current) => ({
                                ...current,
                                roleTitle: event.target.value,
                              }))
                            }
                            placeholder="Role / title"
                            className="rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                          />
                          <input
                            value={siteAccessContactForm.phoneNumber}
                            onChange={(event) =>
                              setSiteAccessContactForm((current) => ({
                                ...current,
                                phoneNumber: event.target.value,
                              }))
                            }
                            placeholder="Phone number"
                            className="rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                          />
                          <textarea
                            value={siteAccessContactForm.notes}
                            onChange={(event) =>
                              setSiteAccessContactForm((current) => ({
                                ...current,
                                notes: event.target.value,
                              }))
                            }
                            placeholder="How this contact was obtained or what they control"
                            className="min-h-[84px] rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                          />
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              saveSiteAccessContactMutation.mutate({
                                captureJobId: selectedCaptureJob.id,
                                ...siteAccessContactForm,
                              })
                            }
                            disabled={
                              saveSiteAccessContactMutation.isPending
                              || !siteAccessContactForm.email.trim()
                            }
                            className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Save contact
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-zinc-600">
                    Select a capture job to view field-ops details.
                  </div>
                )}
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Reschedule queue
                </p>
                <div className="mt-4 space-y-3">
                  {rescheduleQueueItems.length === 0 ? (
                    <p className="text-sm text-zinc-500">No reschedule requests are queued.</p>
                  ) : (
                    rescheduleQueueItems.map((item) => (
                      <div key={item.id} className="rounded-xl border border-zinc-200 p-4">
                        <p className="text-sm font-medium text-zinc-950">{item.businessName}</p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {item.current_date} {item.current_time} → {item.requested_date} {item.requested_time}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {item.status} · {item.requested_by || "buyer"}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Finance review
                </p>
                <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
                  <p className="font-medium">Execution remains human-only.</p>
                  <p className="mt-1 text-rose-800">
                    This queue is for evidence gathering, owner assignment, and next-step planning. Blueprint does not auto-run payouts, refunds, or dispute submissions.
                  </p>
                </div>
                <div className="mt-4 space-y-3">
                  {financeQueueItems.length === 0 ? (
                    <p className="text-sm text-zinc-500">No finance review items are queued.</p>
                  ) : (
                    financeQueueItems.map((item) => {
                      const overdueReview =
                        (item.finance_review?.overdue_review as Record<string, unknown> | undefined)
                        ?? {};

                      return (
                        <div key={item.id} className="rounded-xl border border-zinc-200 p-4">
                        <p className="text-sm font-medium text-zinc-950">
                          {item.id} · {item.status}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {item.failure_reason
                            || (typeof item.ops_automation?.rationale === "string"
                              ? item.ops_automation.rationale
                              : "Needs manual review")}
                        </p>
                        <div className="mt-3 grid gap-2 text-xs text-zinc-500 md:grid-cols-2">
                          <p>
                            Owner:{" "}
                            {typeof item.finance_review?.owner_email === "string"
                              ? item.finance_review.owner_email
                              : "unassigned"}
                          </p>
                          <p>
                            SLA:{" "}
                            {typeof item.finance_review?.sla_due_at === "string"
                              ? formatDate(item.finance_review.sla_due_at)
                              : "not set"}
                          </p>
                          <p>
                            Manual action:{" "}
                            {typeof item.finance_review?.manual_action_type === "string"
                              ? item.finance_review.manual_action_type
                              : "not set"}
                          </p>
                          <p>
                            Evidence:{" "}
                            {formatStringList(item.finance_review?.required_evidence)
                              || "stripe event details, payout linkage, operator notes"}
                          </p>
                        </div>
                        {overdueReview.active === true ? (
                          <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
                            Overdue finance review:{" "}
                            {typeof overdueReview.reason === "string"
                              ? overdueReview.reason
                              : "Manual review is past SLA."}
                          </p>
                        ) : null}
                        {typeof item.finance_review?.human_only_boundary === "string" ? (
                          <p className="mt-3 text-xs text-zinc-500">
                            {item.finance_review.human_only_boundary}
                          </p>
                        ) : null}
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              updateFinanceReviewMutation.mutate({
                                payoutId: item.id,
                                reviewStatus: "investigating",
                                nextAction: "Investigate payout or dispute details",
                                ownerEmail: currentUser?.email || undefined,
                                manualActionType: "investigation",
                              })
                            }
                            className="rounded-full border border-zinc-200 px-3 py-2 text-sm text-zinc-700"
                          >
                            Assign to me + investigate
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              updateFinanceReviewMutation.mutate({
                                payoutId: item.id,
                                reviewStatus: "ready_for_manual_action",
                                nextAction: "Manual finance action required",
                                ownerEmail: currentUser?.email || undefined,
                                manualActionType: "manual_finance_execution",
                              })
                            }
                            className="rounded-full border border-zinc-200 px-3 py-2 text-sm text-zinc-700"
                          >
                            Ready for manual action
                          </button>
                        </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : activeView === "submissions" || activeView === "hosted_review" ? (
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
                        {lead.growth_wedge ? (
                          <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">
                            exact-site wedge
                          </span>
                        ) : null}
                        {lead.queue_key === "exact_site_hosted_review_queue" ? (
                          <span className="rounded-full bg-indigo-100 px-3 py-1 text-indigo-700">
                            hosted-review queue
                          </span>
                        ) : null}
                        {lead.request.commercialRequestPath ? (
                          <span className="rounded-full bg-slate-900 px-3 py-1 text-white">
                            {formatCommercialRequestPath(lead.request.commercialRequestPath)}
                          </span>
                        ) : null}
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
                    {selectedLead.queue_key ? (
                      <p className="mt-2 text-sm text-zinc-500">
                        Queue: {selectedLead.queue_key.replace(/_/g, " ")}
                      </p>
                    ) : null}
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
                      <p>Request path: {formatCommercialRequestPath(selectedLead.request.commercialRequestPath)}</p>
                      <p>Budget: {selectedLead.request.budgetBucket}</p>
                      <p>Priority: {priorityLabels[selectedLead.priority]}</p>
                      <p>Created: {formatDate(selectedLead.createdAt)}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-zinc-200 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">
                    {selectedLead.request.buyerType === "robot_team"
                      ? "Immediate workflow question"
                      : "Task statement"}
                  </p>
                  <p className="mt-2 text-sm text-zinc-800">{selectedLead.request.taskStatement}</p>
                </div>

                <div className="rounded-xl border border-zinc-200 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">
                    Intake routing
                  </p>
                  <div className="mt-3 grid gap-3 text-sm text-zinc-700 md:grid-cols-2">
                    <p>
                      Owner lane:{" "}
                      {selectedLead.structured_intake?.owner_lane ||
                        selectedLead.ops_automation?.queue_label ||
                        "Not assigned"}
                    </p>
                    <p>
                      Calendar:{" "}
                      {selectedLead.structured_intake?.calendar_disposition?.replace(/_/g, " ") ||
                        "not evaluated"}
                    </p>
                    <p>
                      Recommended path:{" "}
                      {selectedLead.structured_intake?.recommended_path?.replace(/_/g, " ") ||
                        selectedLead.ops_automation?.recommended_path?.replace(/_/g, " ") ||
                        "not evaluated"}
                    </p>
                    <p>
                      Human review:{" "}
                      {selectedLead.structured_intake?.calendar_disposition ===
                        "required_before_next_step" ||
                      selectedLead.ops_automation?.requires_human_review
                        ? "required"
                        : "not required by intake"}
                    </p>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-zinc-700">
                    {selectedLead.structured_intake?.next_action ||
                      selectedLead.ops_automation?.next_action ||
                      "No intake next action recorded yet."}
                  </p>
                  {selectedLead.structured_intake?.missing_structured_fields?.length ? (
                    <p className="mt-2 text-xs text-zinc-500">
                      Missing: {selectedLead.structured_intake.missing_structured_fields.join(", ")}
                    </p>
                  ) : null}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-zinc-200 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">
                      Target site type
                    </p>
                    <p className="mt-2 text-sm text-zinc-700">
                      {selectedLead.request.targetSiteType || "No site type supplied."}
                    </p>
                  </div>
                  <div className="rounded-xl border border-zinc-200 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">
                      Proof path
                    </p>
                    <p className="mt-2 text-sm text-zinc-700">
                      {selectedLead.request.proofPathPreference
                        ? proofPathPreferenceLabels[selectedLead.request.proofPathPreference]
                        : "No proof-path preference supplied."}
                    </p>
                  </div>
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

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-zinc-200 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">
                      Existing stack / review workflow
                    </p>
                    <p className="mt-2 text-sm text-zinc-700">
                      {selectedLead.request.existingStackReviewWorkflow ||
                        "No stack or review workflow supplied."}
                    </p>
                  </div>
                  <div className="rounded-xl border border-zinc-200 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">
                      Human-gated topics
                    </p>
                    <p className="mt-2 text-sm text-zinc-700">
                      {selectedLead.request.humanGateTopics ||
                        "No early escalation topics supplied."}
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

                <div className="rounded-xl border border-zinc-200 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">
                    Proof-path milestones
                  </p>
                  <p className="mt-2 text-sm text-zinc-600">
                    These timestamps back the robot-team proof funnel. Auto-known stages fill from the request lifecycle; operator-only stages should be marked here when they actually happen.
                  </p>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {Object.entries(proofPathMilestoneLabels).map(([field, label]) => {
                      const value =
                        selectedLead.ops?.proof_path?.[
                          field as keyof typeof proofPathMilestoneLabels
                        ] || null;

                      return (
                        <div key={field} className="rounded-lg bg-zinc-50 p-3">
                          <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">
                            {label}
                          </p>
                          <p className="mt-1 text-sm text-zinc-800">
                            {typeof value === "string" ? formatDate(value) : "Not recorded"}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {proofPathStageButtons.map((button) => (
                      <button
                        key={button.stage}
                        type="button"
                        onClick={() =>
                          updateOpsMutation.mutate({
                            requestId: selectedLead.requestId,
                            proof_path_stage: button.stage,
                          })
                        }
                        className="rounded-full border border-zinc-200 px-3 py-2 text-sm text-zinc-700"
                      >
                        {button.label}
                      </button>
                    ))}
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
