import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowUpRight, ClipboardList, ExternalLink, Filter, Mail, RefreshCw, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { analyticsEvents } from "@/lib/analytics";
import { withCsrfHeader } from "@/lib/csrf";
import { withFirebaseAuthHeaders } from "@/lib/firebaseAuthHeaders";
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
  PilotOpportunityOutcome,
  ProofPathMilestoneKey,
  QualificationState,
  RequestPriority,
  SceneDashboardSummary,
  UpdateRequestOpsPayload,
} from "@/types/inbound-request";
import {
  BUYER_TYPE_LABELS as buyerTypeLabels,
  DISPLAY_ADVISORY_SCAN_HINT_LABELS as displayAdvisoryScanHintLabels,
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
import { SiteScreeningCallPanel } from "@/components/admin/SiteScreeningCallPanel";
import { OutreachApprovalReview, type OutreachApproval, type OutreachReviewSummary } from "@/components/admin/OutreachApprovalReview";
import { FounderMailboxConnection } from "@/components/admin/FounderMailboxConnection";
import { CommunicationsRecovery } from "@/components/admin/CommunicationsRecovery";
import { CommunicationsDraftEditor, type GmailDraftSummary, type GmailDraftResult, type LinkedinSearch } from "@/components/admin/CommunicationsDraftEditor";

const qualificationStates: QualificationState[] = [...QUALIFICATION_STATES];

const opportunityStates: OpportunityState[] = [...OPPORTUNITY_STATES];

const pilotOpportunityOutcomes: PilotOpportunityOutcome[] = [
  "review_pending",
  "evaluation_candidate",
  "wrong_robot_class",
  "economics_insufficient",
  "missing_evidence",
];

const pilotOpportunityOutcomeLabels: Record<PilotOpportunityOutcome, string> = {
  not_requested: "Not requested",
  review_pending: "Review pending",
  evaluation_candidate: "Evaluation candidate",
  wrong_robot_class: "Wrong robot class",
  economics_insufficient: "Economics insufficient",
  missing_evidence: "Missing evidence",
};

const priorityColors: Record<RequestPriority, string> = {
  low: "runway-chip-quiet",
  normal: "runway-chip-neutral",
  high: "runway-chip-open",
};

const qualificationColors: Record<QualificationState, string> = {
  submitted: "runway-chip-quiet",
  capture_requested: "runway-chip-open",
  qa_passed: "runway-chip-neutral",
  needs_more_evidence: "runway-chip-open",
  in_review: "runway-chip-neutral",
  qualified_ready: "runway-chip-live",
  qualified_risky: "runway-chip-open",
  needs_refresh: "runway-chip-open",
  not_ready_yet: "runway-chip-fail",
};

const nextActionColors: Record<SceneDashboardSummary["categories"]["pick"]["tasks"][number]["next_action"], string> = {
  "advance to human signoff": "runway-chip-live",
  recapture: "runway-chip-open",
  redesign: "runway-chip-neutral",
  defer: "runway-chip-fail",
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
  outreach_review?: OutreachReviewSummary;
  sending_enabled?: boolean;
  draft_revision_id?: string|null;
  gmail_draft?: GmailDraftSummary;
  // Present only on an outreach-ready hypothesis draft.
  qualification_tier?: string;
  send_authority?: string;
  linkedin_search?: LinkedinSearch;
}

/** An outreach-ready hypothesis draft: shown, revisable and copyable to Gmail Drafts, never approvable. */
function isDraftOnlyHypothesis(item: ActionQueueItem) {
  return item.send_authority === "none" || item.qualification_tier === "outreach_ready"
    || item.approval_reason === "outreach_ready_hypothesis_draft_only"
    || !!(item.action_payload.communications as { brief?: { qualification?: unknown } } | undefined)?.brief?.qualification;
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

function formatMachineLabel(value?: string | null) {
  return value ? value.replace(/_/g, " ") : "";
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

export default function AdminLeads() {
  const { currentUser, userData, tokenClaims } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [activeView, setActiveView] = useState<
    | "submissions"
    | "hosted_review"
    | "waitlist"
    | "approvals"
    | "agent"
  >(() => ["prepare", "returned"].includes(new URLSearchParams(window.location.search).get("founder_gmail") || "") ? "approvals" : "submissions");
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
      pilotOpportunityOutcome,
      note: mutationNote,
    }: {
      requestId: string;
      qualificationState: QualificationState;
      opportunityState?: OpportunityState | null;
      pilotOpportunityOutcome?: PilotOpportunityOutcome | null;
      note?: string;
    }) => {
      const response = await fetch(`/api/admin/leads/${requestId}/status`, {
        method: "PATCH",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          qualification_state: qualificationState,
          ...(opportunityState ? { opportunity_state: opportunityState } : {}),
          ...(pilotOpportunityOutcome
            ? { pilot_opportunity_outcome: pilotOpportunityOutcome }
            : {}),
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
    queryKey: ["admin-action-queue", currentUser?.uid],
    enabled: isAdmin && Boolean(currentUser) && activeView === "approvals",
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
    queryFn: async () => {
      const response = await fetch("/api/admin/leads/action-queue?limit=100", {
        headers: await withCsrfHeader(await withFirebaseAuthHeaders(currentUser)),
      });
      if (!response.ok) throw new Error(`Could not load the action queue (${response.status}). Retry the request.`);
      return response.json();
    },
  });

  const founderDraftCapability = useQuery<{draftScopeGranted?:boolean}>({
    queryKey:["founder-gmail-consent-status",currentUser?.uid], enabled:isAdmin && Boolean(currentUser) && activeView==="approvals", retry:false,
    queryFn:async()=>{const response=await fetch("/api/communications/gmail/oauth/status",{headers:await withFirebaseAuthHeaders(currentUser)});
      if(!response.ok)throw new Error("Founder draft capability is unavailable.");return response.json();},
  });
  const saveGmailDraftMutation = useMutation({
    mutationFn:async({ledgerId,...input}:{ledgerId:string;expectedReviewDigest:string;expectedRevisionId:string|null;mode:"write"|"reconcile"})=>{
      const response=await fetch(`/api/admin/leads/action-queue/${ledgerId}/gmail-draft`,{method:"POST",credentials:"include",
        headers:await withCsrfHeader(await withFirebaseAuthHeaders(currentUser,{"Content-Type":"application/json"}),{refresh:true}),body:JSON.stringify(input)});
      const result=await response.json();if(!response.ok)throw new Error(result.error ?? "Gmail draft could not be verified. Check the existing draft before another write.");
      return result as GmailDraftResult;
    },
    onSuccess:()=>queryClient.invalidateQueries({queryKey:["admin-action-queue"]}),
  });

  const approveActionMutation = useMutation({
    mutationFn: async ({ ledgerId, outreachSemanticReview }: { ledgerId: string; outreachSemanticReview?: OutreachApproval }) => {
      const response = await fetch(`/api/admin/leads/action-queue/${ledgerId}/approve`, {
        method: "POST",
        headers: await withCsrfHeader(await withFirebaseAuthHeaders(currentUser, { "Content-Type": "application/json" })),
        ...(outreachSemanticReview ? { body: JSON.stringify({ outreachSemanticReview }) } : {}),
      });
      if (!response.ok) throw new Error("Failed to approve action");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-action-queue"] });
    },
  });

  const reviseActionMutation = useMutation({
    mutationFn: async ({ ledgerId, ...input }: { ledgerId: string; expectedReviewDigest: string; output: Record<string, unknown> }) => {
      const response = await fetch(`/api/admin/leads/action-queue/${ledgerId}/revise`, {
        method: "POST",
        credentials: "include",
        // Refresh before the explicit save: another session/cookie update can
        // leave an open editor's cached token stale. Do not replay a draft POST.
        headers: await withCsrfHeader(await withFirebaseAuthHeaders(currentUser, { "Content-Type": "application/json" }), { refresh: true }),
        body: JSON.stringify(input),
      });
      const result = await response.json();
      if (!response.ok) throw new Error([result.error ?? "Could not save this draft revision.",
        ...(result.issues ?? []).map((issue: { path?: string | (string | number)[]; message?: string }) => `${Array.isArray(issue.path) ? issue.path.join(".") : issue.path ?? "draft"}: ${issue.message ?? "Invalid value"}`)].join(" "));
      return result as { review: OutreachReviewSummary };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-action-queue"] }),
  });

  const rejectActionMutation = useMutation({
    mutationFn: async ({ ledgerId, reason }: { ledgerId: string; reason: string }) => {
      const response = await fetch(`/api/admin/leads/action-queue/${ledgerId}/reject`, {
        method: "POST",
        headers: await withCsrfHeader(await withFirebaseAuthHeaders(currentUser, { "Content-Type": "application/json" })),
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
        headers: await withCsrfHeader(await withFirebaseAuthHeaders(currentUser, { "Content-Type": "application/json" })),
      });
      if (!response.ok) throw new Error("Failed to retry action");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-action-queue"] });
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
      const countsKnown = Boolean(approvalQueueQuery.data) && !approvalQueueQuery.isError;
      return [
        {
          label: "Queued items",
          value: countsKnown ? approvalQueueQuery.data!.summary.total : "—",
        },
        {
          label: "Pending approval",
          value: countsKnown ? approvalQueueQuery.data!.summary.pending_approval : "—",
        },
        {
          label: "Failed",
          value: countsKnown ? approvalQueueQuery.data!.summary.failed : "—",
        },
        {
          label: "Tier 3 items",
          value: countsKnown ? approvalQueueItems.filter((item) => item.action_tier === 3).length : "—",
        },
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
    approvalQueueQuery.isError,
    approvalQueueQuery.data?.summary.failed,
    approvalQueueQuery.data?.summary.pending_approval,
    approvalQueueQuery.data?.summary.total,
    filteredWaitlistSubmissions,
    leads,
    statsQuery.data,
    waitlistQuery.data?.pagination.total,
  ]);

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-runway-red" />
          <h1 className="mt-4 font-display text-xl font-semibold uppercase tracking-[0.005em] text-runway-text">Admin access required</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-runway-deep px-4 py-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="runway-eyebrow-muted">
              {activeView === "submissions"
                ? "Admin Review Queue"
                : activeView === "hosted_review"
                  ? "Exact-Site Hosted Review Queue"
                : activeView === "waitlist"
                  ? "Ops Intake Queue"
                  : activeView === "approvals"
                    ? "Action Ledger"
                  : "Ops Agent Console"}
            </p>
            <h1 className="mt-2 font-display text-3xl font-semibold uppercase tracking-[0.005em] text-runway-text">
              {activeView === "submissions"
                ? "Qualification submissions"
                : activeView === "hosted_review"
                  ? "Hosted-review requests"
                : activeView === "waitlist"
                  ? "Waitlist and beta requests"
                  : activeView === "approvals"
                    ? "Phase 2 approvals"
                  : "Startup operations agent"}
            </h1>
            <p className="mt-2 text-runway-mute">
              {activeView === "submissions"
                ? "Move submissions through qualification state and only activate opportunity state once a site clears review."
                : activeView === "hosted_review"
                  ? "Work the narrow exact-site hosted-review wedge from intake to proof-pack, hosted review, and human commercial handoff."
                : activeView === "waitlist"
                  ? "Review structured waitlist and private beta intake without dropping into Firestore."
                  : activeView === "approvals"
                    ? "Review the Phase 2 action ledger, then approve, reject, or retry low-risk operator actions."
                  : "Create agent threads, attach startup context, route work into Codex or Claude Code, and approve sensitive runs in one place."}
            </p>
          </div>
          <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-center lg:w-auto">
            <div className="max-w-full overflow-x-auto pb-1">
              <Tabs
                value={activeView}
                onValueChange={(value) =>
                  setActiveView(
                    value as
                      | "submissions"
                      | "hosted_review"
                      | "waitlist"
                      | "approvals"
                      | "agent",
                  )
                }
              >
                <TabsList className="w-max rounded-none border border-runway-line bg-runway-panel p-1">
                  <TabsTrigger value="submissions" className="rounded-none px-4">
                    Qualification
                  </TabsTrigger>
                  <TabsTrigger value="hosted_review" className="rounded-none px-4">
                    Hosted Review
                  </TabsTrigger>
                  <TabsTrigger value="waitlist" className="rounded-none px-4">
                    Waitlist / Beta
                  </TabsTrigger>
                  <TabsTrigger value="approvals" className="rounded-none px-4">
                    Approvals
                  </TabsTrigger>
                  <TabsTrigger value="agent" className="rounded-none px-4">
                    Agent
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <button
              type="button"
              onClick={() =>
                activeView === "submissions" || activeView === "hosted_review"
                  ? leadsQuery.refetch()
                  : activeView === "waitlist"
                    ? waitlistQuery.refetch()
                    : activeView === "approvals"
                      ? approvalQueueQuery.refetch()
                    : queryClient.invalidateQueries({ queryKey: ["admin-agent-sessions"] })
              }
              className="runway-cta-ghost min-h-0 px-4 py-2 text-sm"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </button>
            <a
              href="/admin/jobs"
              className="runway-cta-ghost min-h-0 px-4 py-2 text-sm"
            >
              Job console
            </a>
            {activeView === "waitlist" ? (
              <button
                type="button"
                onClick={() => runWaitlistAutomationMutation.mutate({ limit: 10 })}
                className="runway-cta-ghost min-h-0 px-4 py-2 text-sm"
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
              <div key={card.label} className="runway-panel p-5">
                <p className="text-sm text-runway-faint">{card.label}</p>
                <p className="mt-2 text-3xl font-semibold text-runway-text">{card.value}</p>
              </div>
            ))}
          </div>
        ) : null}

        {activeView === "agent" ? (
          <AdminAgentConsole />
        ) : activeView === "approvals" ? (
          <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="space-y-3">
              <FounderMailboxConnection />
              <CommunicationsRecovery />
              {approvalQueueQuery.isError ? (
                <div role="alert" className="runway-panel p-6 text-runway-red">
                  <p>{approvalQueueQuery.error.message}</p>
                  {approvalQueueItems.length ? <p>Showing the last loaded drafts. Your current edit is preserved; retry to refresh their status.</p> : null}
                  <button type="button" className="runway-cta-ghost mt-3 min-h-0 px-3 py-2 text-sm"
                    disabled={approvalQueueQuery.isFetching} onClick={() => void approvalQueueQuery.refetch()}>
                    Retry loading approvals
                  </button>
                </div>
              ) : null}
              {approvalQueueQuery.isLoading ? (
                <div className="runway-panel p-6 text-runway-mute">Loading action queue...</div>
              ) : approvalQueueItems.length === 0 ? (
                approvalQueueQuery.isError ? null : <div className="runway-panel p-6 text-runway-mute">
                  No pending approvals or failed actions right now.
                </div>
              ) : (
                approvalQueueItems.map((item) => (
                  <div key={item.id} className="runway-panel p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="runway-meta">
                          {item.lane}
                        </p>
                        <p className="mt-1 text-lg font-medium text-runway-text">{item.action_type}</p>
                        <p className="runway-num mt-1 text-sm text-runway-mute">
                          {item.source_collection} / {item.source_doc_id}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span
                          className={`runway-chip ${
                            item.status === "failed"
                              ? "runway-chip-fail"
                              : "runway-chip-open"
                          }`}
                        >
                          {item.status.replace(/_/g, " ")}
                        </span>
                        <span className="runway-chip runway-chip-quiet">
                          Tier {item.action_tier}
                        </span>
                        {isDraftOnlyHypothesis(item) ? (
                          <span className="runway-chip runway-chip-quiet">{item.approval_reason === "footerless_draft_requires_delivery_review" ? "Unsent · delivery review required" : "Hypothesis · draft only"}</span>
                        ) : null}
                      </div>
                    </div>

                    <p className="mt-3 text-sm text-runway-body">{formatActionPreview(item)}</p>
                    <div className="runway-num mt-4 grid gap-2 text-xs text-runway-faint md:grid-cols-2">
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
                      <p className="mt-3 border border-runway-red-dim px-3 py-2 text-sm text-runway-red">
                        {item.last_execution_error}
                      </p>
                    ) : null}
                    {item.approval_reason?.startsWith("content_validation_failed:") ? (
                      <p role="alert" className="mt-3 text-sm text-runway-red">Review blocked: {item.approval_reason}</p>
                    ) : null}

                    {extractCreativeAssetUri(item) ? (
                      <div className="mt-3 border border-runway-green-dim px-3 py-3 text-sm text-runway-green">
                        <p className="font-medium">Creative asset context</p>
                        <p className="runway-num mt-2 break-all text-xs">
                          {extractCreativeAssetUri(item)}
                        </p>
                      </div>
                    ) : null}

                    <div className="mt-4 flex flex-wrap gap-2">
                      {item.status === "pending_approval" ? (
                        <>
                          {item.action_payload.communications ? <CommunicationsDraftEditor payload={item.action_payload} review={item.outreach_review}
                            revisionId={item.draft_revision_id ?? null} linkedinSearch={item.linkedin_search}
                            gmailDraft={item.gmail_draft ? {...item.gmail_draft,writesEnabled:item.gmail_draft.writesEnabled && founderDraftCapability.data?.draftScopeGranted===true && !founderDraftCapability.isError && !approvalQueueQuery.isError} : undefined}
                            onGmailSave={input=>saveGmailDraftMutation.mutateAsync({ledgerId:item.id,...input})}
                            onSave={input => reviseActionMutation.mutateAsync({ ledgerId: item.id, ...input })} /> : null}
                          {item.lane === "outbound_prospect" || item.source_collection === "outboundProspects" || item.action_payload.communications ? (
                            <OutreachApprovalReview review={item.outreach_review} payload={item.action_payload}
                              sendingEnabled={item.sending_enabled} draftOnly={isDraftOnlyHypothesis(item)}
                              pending={approveActionMutation.isPending || approvalQueueQuery.isError}
                              onApprove={(outreachSemanticReview) => approveActionMutation.mutate({ ledgerId: item.id, outreachSemanticReview })} />
                          ) : isDraftOnlyHypothesis(item) ? null : (
                            <button type="button" onClick={() => approveActionMutation.mutate({ ledgerId: item.id })}
                              className="runway-cta-ghost min-h-0 px-4 py-2 text-sm" disabled={approveActionMutation.isPending || approvalQueueQuery.isError}>
                              Approve
                            </button>
                          )}
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
                            className="runway-cta-ghost min-h-0 px-4 py-2 text-sm"
                            disabled={rejectActionMutation.isPending}
                          >
                            Reject
                          </button>
                        </>
                      ) : null}
                      {item.status === "failed" || (item.action_payload.communications && ["executing", "operator_approved"].includes(item.status)) ? (
                        <button
                          type="button"
                          onClick={() => retryActionMutation.mutate(item.id)}
                          className="runway-cta-ghost min-h-0 px-4 py-2 text-sm"
                          disabled={retryActionMutation.isPending}
                        >
                          {item.status === "failed" ? "Retry" : "Check delivery"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="runway-panel p-6">
              <p className="runway-eyebrow-muted">
                Control model
              </p>
              <div className="mt-4 space-y-3 text-sm text-runway-body">
                <p>Low-risk reversible actions can auto-send when the lane policy allows it.</p>
                <p>Pending approval items stay parked until an operator approves or rejects them.</p>
                <p>Failed actions can be retried if the executor marks them as safe to replay.</p>
                <p>Money movement, disputes, rights, privacy, and unusual cases remain human-gated.</p>
              </div>
            </div>
          </div>
        ) : activeView === "submissions" || activeView === "hosted_review" ? (
          <>
            <div className="runway-panel mb-6 flex flex-col gap-3 p-4 md:flex-row">
              <div className="flex items-center gap-2 text-sm font-medium text-runway-body">
                <Filter className="h-4 w-4" />
                Filters
              </div>
              <select
                className="runway-input"
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
                className="runway-input"
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
                  <div className="runway-panel p-6 text-runway-mute">
                    Loading submissions...
                  </div>
                ) : leads.length === 0 ? (
                  <div className="runway-panel p-6 text-runway-mute">
                    No submissions match the current filters.
                  </div>
                ) : (
                  leads.map((lead) => (
                    <button
                      key={lead.requestId}
                      type="button"
                      onClick={() => setSelectedRequestId(lead.requestId)}
                      className={`w-full border p-5 text-left transition-colors ${
                        selectedRequestId === lead.requestId
                          ? "border-runway-signal bg-runway-raised"
                          : "border-runway-line bg-runway-panel hover:bg-runway-raised"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-runway-text">{lead.request.siteName}</p>
                          <p className="text-sm text-runway-mute">
                            {lead.contact.company} · {lead.request.siteLocation}
                          </p>
                        </div>
                        <span
                          className={`runway-chip ${qualificationColors[lead.qualification_state]}`}
                        >
                          {statusLabels[lead.qualification_state]}
                        </span>
                      </div>
                      <p className="mt-3 text-sm text-runway-mute">{lead.request.taskStatement}</p>
                      <div className="mt-4 flex flex-wrap gap-2 text-xs">
                        <span className={`runway-chip ${priorityColors[lead.priority]}`}>
                          {priorityLabels[lead.priority]}
                        </span>
                        {lead.growth_wedge ? (
                          <span className="runway-chip runway-chip-live">
                            exact-site wedge
                          </span>
                        ) : null}
                        {lead.queue_key === "exact_site_hosted_review_queue" ? (
                          <span className="runway-chip runway-chip-neutral">
                            hosted-review queue
                          </span>
                        ) : null}
                        {lead.request.commercialRequestPath ? (
                          <span className="runway-chip runway-chip-quiet">
                            {formatCommercialRequestPath(lead.request.commercialRequestPath)}
                          </span>
                        ) : null}
                        {lead.request.requestedLanes.map((lane) => (
                          <span key={lane} className="runway-chip runway-chip-quiet">
                            {requestedLaneLabels[lane]}
                          </span>
                        ))}
                      </div>
                      <p className="mt-3 text-xs text-runway-faint">{formatDate(lead.createdAt)}</p>
                    </button>
                  ))
                )}
              </div>

              <div className="runway-panel p-6">
                {selectedLead ? (
              <div className="space-y-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="runway-eyebrow-muted">
                      Submission {selectedLead.site_submission_id}
                    </p>
                    <h2 className="mt-2 font-display text-2xl font-semibold uppercase tracking-[0.005em] text-runway-text">
                      {selectedLead.request.siteName}
                    </h2>
                    <p className="mt-1 text-runway-mute">{selectedLead.request.siteLocation}</p>
                    {selectedLead.queue_key ? (
                      <p className="mt-2 text-sm text-runway-faint">
                        Queue: {selectedLead.queue_key.replace(/_/g, " ")}
                      </p>
                    ) : null}
                  </div>
                  <a
                    href={selectedLead.context.sourcePageUrl}
                    className="inline-flex items-center text-sm text-runway-mute hover:text-runway-text"
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
                      className="runway-cta-ghost min-h-0 px-4 py-2 text-sm"
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
                    className="runway-cta-ghost min-h-0 px-4 py-2 text-sm"
                  >
                    Issue review link
                  </button>
                  <button
                    type="button"
                    onClick={() => triggerPreviewMutation.mutate(selectedLead.requestId)}
                    className="runway-cta-ghost min-h-0 px-4 py-2 text-sm"
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    Trigger preview
                  </button>
                </div>

                {selectedLead.request.buyerType === "site_operator" ? (
                  <SiteScreeningCallPanel
                    requestId={selectedLead.requestId}
                    triage={selectedLead.site_task_triage}
                    gatesOnFile={selectedLead.site_task_gates_on_file ?? {}}
                    briefConfirmed={Boolean(selectedLead.site_task_brief_confirmed)}
                    screenGateEnded={selectedLead.site_task_screen_gate_ended === true}
                  />
                ) : null}

                {selectedLead.request.pilotOpportunity?.requested ? (
                  <div className="border border-runway-line p-4">
                    <p className="runway-meta">Pilot opportunity dossier</p>
                    <div className="mt-3 grid gap-3 text-sm text-runway-body md:grid-cols-2">
                      <p>Visibility: {selectedLead.request.pilotOpportunity.visibility.replace(/_/g, " ")}</p>
                      <p>
                        Gate gaps: {selectedLead.structured_intake?.missing_pilot_opportunity_fields?.length
                          ? selectedLead.structured_intake.missing_pilot_opportunity_fields.join(", ").replace(/_/g, " ")
                          : "None recorded"}
                      </p>
                    </div>
                    <p className="mt-3 text-sm text-runway-mute">
                      A simulation candidate remains below deployment readiness until robot-specific
                      and authoritative physical evidence is joined.
                    </p>
                  </div>
                ) : null}

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="border border-runway-line bg-runway-black p-4">
                    <p className="runway-meta">Contact</p>
                    <p className="mt-2 font-medium text-runway-text">
                      {selectedLead.contact.firstName} {selectedLead.contact.lastName}
                    </p>
                    <p className="text-sm text-runway-mute">{selectedLead.contact.company}</p>
                    <p className="text-sm text-runway-mute">{selectedLead.contact.roleTitle}</p>
                    <a
                      href={`mailto:${selectedLead.contact.email}`}
                      className="mt-3 inline-flex items-center text-sm text-runway-body hover:text-runway-text"
                    >
                      <Mail className="mr-2 h-4 w-4" />
                      {selectedLead.contact.email}
                    </a>
                  </div>
                  <div className="border border-runway-line bg-runway-black p-4">
                    <p className="runway-meta">Submission facts</p>
                    <div className="mt-2 space-y-2 text-sm text-runway-body">
                      <p>Buyer type: {buyerTypeLabels[selectedLead.request.buyerType]}</p>
                      <p>Request path: {formatCommercialRequestPath(selectedLead.request.commercialRequestPath)}</p>
                      <p>Budget: {selectedLead.request.budgetBucket}</p>
                      <p>Priority: {priorityLabels[selectedLead.priority]}</p>
                      <p>Created: {formatDate(selectedLead.createdAt)}</p>
                    </div>
                  </div>
                </div>

                <div className="border border-runway-line p-4">
                  <p className="runway-meta">
                    {selectedLead.request.buyerType === "robot_team"
                      ? "Immediate workflow question"
                      : "Task statement"}
                  </p>
                  <p className="mt-2 text-sm text-runway-text">{selectedLead.request.taskStatement}</p>
                </div>

                <div className="border border-runway-line p-4">
                  <p className="runway-meta">
                    Intake routing
                  </p>
                  <div className="mt-3 grid gap-3 text-sm text-runway-body md:grid-cols-2">
                    <p>
                      Owner lane:{" "}
                      {selectedLead.structured_intake?.owner_lane ||
                        selectedLead.ops_automation?.queue_label ||
                        "Not assigned"}
                    </p>
                    <p>
                      Calendar:{" "}
                      {selectedLead.structured_intake?.calendar_summary ||
                        formatMachineLabel(selectedLead.structured_intake?.calendar_disposition) ||
                        "not evaluated"}
                    </p>
                    <p>
                      Recommended path:{" "}
                      {formatMachineLabel(selectedLead.structured_intake?.recommended_path) ||
                        formatMachineLabel(selectedLead.ops_automation?.recommended_path) ||
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
                  <p className="mt-3 text-sm leading-6 text-runway-body">
                    {selectedLead.structured_intake?.routing_summary ||
                      selectedLead.structured_intake?.next_action ||
                      selectedLead.ops_automation?.next_action ||
                      "No intake next action recorded yet."}
                  </p>
                  {selectedLead.structured_intake?.proof_path_summary ? (
                    <p className="mt-2 text-sm leading-6 text-runway-mute">
                      {selectedLead.structured_intake.proof_path_summary}
                    </p>
                  ) : null}
                  {selectedLead.structured_intake?.missing_structured_fields?.length ? (
                    <p className="mt-2 text-xs text-runway-faint">
                      Missing:{" "}
                      {(selectedLead.structured_intake.missing_structured_field_labels?.length
                        ? selectedLead.structured_intake.missing_structured_field_labels
                        : selectedLead.structured_intake.missing_structured_fields
                      ).join(", ")}
                    </p>
                  ) : null}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="border border-runway-line p-4">
                    <p className="runway-meta">
                      Target site type
                    </p>
                    <p className="mt-2 text-sm text-runway-body">
                      {selectedLead.request.targetSiteType || "No site type supplied."}
                    </p>
                  </div>
                  <div className="border border-runway-line p-4">
                    <p className="runway-meta">
                      Proof path
                    </p>
                    <p className="mt-2 text-sm text-runway-body">
                      {selectedLead.request.proofPathPreference
                        ? proofPathPreferenceLabels[selectedLead.request.proofPathPreference]
                        : "No proof-path preference supplied."}
                    </p>
                  </div>
                  {selectedLead.request.displayCaptureMetadata ? (
                    <div className="border border-runway-line bg-runway-black p-4 md:col-span-2">
                      <p className="runway-meta">
                        Display HUD pilot
                      </p>
                      <p className="mt-2 text-sm leading-6 text-runway-body">
                        Target:{" "}
                        {selectedLead.request.displayCaptureMetadata.targetName ||
                          selectedLead.request.siteName}
                        {" · "}
                        {selectedLead.request.displayCaptureMetadata.addressLabel ||
                          selectedLead.request.siteLocation}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-runway-body">
                        {selectedLead.request.displayCaptureMetadata.captureBrief ||
                          "No display capture brief supplied."}
                      </p>
                      {selectedLead.request.displayCaptureMetadata.allowedAdvisoryHints?.length ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {selectedLead.request.displayCaptureMetadata.allowedAdvisoryHints.map((hint) => (
                            <span
                              key={hint}
                              className="runway-chip runway-chip-quiet"
                            >
                              {displayAdvisoryScanHintLabels[hint]}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      <p className="mt-3 text-xs leading-5 text-runway-faint">
                        Display coaching is advisory UX telemetry, not geometry, pose, depth,
                        coverage, rights, or qualification proof.
                      </p>
                    </div>
                  ) : null}
                  <div className="border border-runway-line p-4">
                    <p className="runway-meta">Workflow context</p>
                    <p className="mt-2 text-sm text-runway-body">
                      {selectedLead.request.workflowContext || "No workflow context supplied."}
                    </p>
                  </div>
                  <div className="border border-runway-line p-4">
                    <p className="runway-meta">
                      Operating constraints
                    </p>
                    <p className="mt-2 text-sm text-runway-body">
                      {selectedLead.request.operatingConstraints || "No operating constraints supplied."}
                    </p>
                  </div>
                  <div className="border border-runway-line p-4">
                    <p className="runway-meta">
                      Privacy / security
                    </p>
                    <p className="mt-2 text-sm text-runway-body">
                      {selectedLead.request.privacySecurityConstraints ||
                        "No privacy or security constraints supplied."}
                    </p>
                  </div>
                  <div className="border border-runway-line p-4">
                    <p className="runway-meta">Known blockers</p>
                    <p className="mt-2 text-sm text-runway-body">
                      {selectedLead.request.knownBlockers || "No blockers supplied."}
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="border border-runway-line p-4">
                    <p className="runway-meta">
                      Existing stack / review workflow
                    </p>
                    <p className="mt-2 text-sm text-runway-body">
                      {selectedLead.request.existingStackReviewWorkflow ||
                        "No stack or review workflow supplied."}
                    </p>
                  </div>
                  <div className="border border-runway-line p-4">
                    <p className="runway-meta">
                      Human-gated topics
                    </p>
                    <p className="mt-2 text-sm text-runway-body">
                      {selectedLead.request.humanGateTopics ||
                        "No early escalation topics supplied."}
                    </p>
                  </div>
                </div>

                <div className="border border-runway-line p-4">
                  <p className="runway-meta">Requested lanes</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedLead.request.requestedLanes.map((lane) => (
                      <span key={lane} className="runway-chip runway-chip-quiet">
                        {requestedLaneLabels[lane]}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="border border-runway-line p-4">
                  <p className="runway-meta">Ops controls</p>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="runway-label">
                        Assigned region
                      </label>
                      <input
                        className="runway-input"
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
                      <label className="runway-label">
                        Rights status
                      </label>
                      <select
                        className="runway-input"
                        value={selectedLead.ops?.rights_status || ""}
                        onChange={(event) => {
                          if (!event.target.value) return;
                          updateOpsMutation.mutate({
                            requestId: selectedLead.requestId,
                            rights_status: event.target.value as UpdateRequestOpsPayload["rights_status"],
                          });
                        }}
                      >
                        <option value="" disabled>Not recorded</option>
                        {Object.entries(rightsStatusLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="runway-label">
                        Capture policy
                      </label>
                      <select
                        className="runway-input"
                        value={selectedLead.ops?.capture_policy_tier || ""}
                        onChange={(event) => {
                          if (!event.target.value) return;
                          updateOpsMutation.mutate({
                            requestId: selectedLead.requestId,
                            capture_policy_tier:
                              event.target.value as UpdateRequestOpsPayload["capture_policy_tier"],
                          });
                        }}
                      >
                        <option value="" disabled>Not recorded</option>
                        {Object.entries(capturePolicyLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="runway-label">
                        Capture status
                      </label>
                      <select
                        className="runway-input"
                        value={selectedLead.ops?.capture_status || ""}
                        onChange={(event) => {
                          if (!event.target.value) return;
                          updateOpsMutation.mutate({
                            requestId: selectedLead.requestId,
                            capture_status:
                              event.target.value as UpdateRequestOpsPayload["capture_status"],
                          });
                        }}
                      >
                        <option value="" disabled>Not recorded</option>
                        {Object.entries(captureStatusLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="runway-label">
                        Quote status
                      </label>
                      <select
                        className="runway-input"
                        value={selectedLead.ops?.quote_status || ""}
                        onChange={(event) => {
                          if (!event.target.value) return;
                          updateOpsMutation.mutate({
                            requestId: selectedLead.requestId,
                            quote_status:
                              event.target.value as UpdateRequestOpsPayload["quote_status"],
                          });
                        }}
                      >
                        <option value="" disabled>Not recorded</option>
                        {Object.entries(quoteStatusLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="runway-label">
                        Next step
                      </label>
                      <input
                        className="runway-input"
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
                      <label className="runway-label">
                        Recapture guidance
                      </label>
                      <textarea
                        className="runway-input min-h-20"
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

                <div className="border border-runway-line p-4">
                  <p className="runway-meta">
                    Proof-path milestones
                  </p>
                  <p className="mt-2 text-sm text-runway-mute">
                    These timestamps back the robot-team proof funnel. Auto-known stages fill from the request lifecycle; operator-only stages should be marked here when they actually happen.
                  </p>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {Object.entries(proofPathMilestoneLabels).map(([field, label]) => {
                      const value =
                        selectedLead.ops?.proof_path?.[
                          field as keyof typeof proofPathMilestoneLabels
                        ] || null;

                      return (
                        <div key={field} className="border border-runway-line bg-runway-black p-3">
                          <p className="runway-meta">
                            {label}
                          </p>
                          <p className="mt-1 text-sm text-runway-text">
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
                        className="runway-cta-ghost min-h-0 px-3 py-2 text-sm"
                      >
                        {button.label}
                      </button>
                    ))}
                  </div>
                </div>

                {selectedLead.evaluation_readiness ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="border border-runway-line p-4">
                      <p className="runway-meta">Buyer trust</p>
                      <p className="mt-2 text-3xl font-semibold text-runway-text">
                        {selectedLead.evaluation_readiness.buyer_trust_score?.score ?? "N/A"}
                      </p>
                      <p className="mt-1 text-sm text-runway-mute">
                        {selectedLead.evaluation_readiness.buyer_trust_score?.band ?? "Not recorded"} confidence
                      </p>
                      {selectedLead.evaluation_readiness.buyer_trust_score?.reasons?.length ? (
                        <ul className="mt-3 list-disc space-y-1 pl-4 text-sm text-runway-mute">
                          {selectedLead.evaluation_readiness.buyer_trust_score.reasons.map((reason) => (
                            <li key={reason}>{reason}</li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                    <div className="border border-runway-line p-4">
                      <p className="runway-meta">Preview run</p>
                      <p className="mt-2 text-sm text-runway-body">
                        Status: {selectedLead.evaluation_readiness.preview_status || "Not recorded"}
                      </p>
                      <p className="mt-1 text-sm text-runway-body">
                        Provider: {selectedLead.evaluation_readiness.provider_run?.provider_name || "Not attached"}
                      </p>
                      {selectedLead.evaluation_readiness.provider_run?.failure_reason ? (
                        <p className="mt-3 text-sm text-runway-red">
                          {selectedLead.evaluation_readiness.provider_run.failure_reason}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label htmlFor="admin-qualification-state" className="runway-label">
                      Qualification state
                    </label>
                    <select
                      id="admin-qualification-state"
                      className="runway-input"
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
                    <label htmlFor="admin-opportunity-state" className="runway-label">
                      Opportunity state
                    </label>
                    <select
                      id="admin-opportunity-state"
                      className="runway-input"
                      value={selectedLead.opportunity_state || ""}
                      onChange={(event) =>
                        updateStateMutation.mutate({
                          requestId: selectedLead.requestId,
                          qualificationState: selectedLead.qualification_state,
                          opportunityState: event.target.value as OpportunityState,
                          note: note || undefined,
                        })
                      }
                    >
                      <option value="" disabled>Not recorded</option>
                      {opportunityStates.map((state) => (
                        <option key={state} value={state}>
                          {opportunityStateLabels[state]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="admin-pilot-opportunity-outcome" className="runway-label">
                      Pilot opportunity outcome
                    </label>
                    <select
                      id="admin-pilot-opportunity-outcome"
                      className="runway-input"
                      value={selectedLead.structured_intake?.pilot_opportunity_outcome || "not_requested"}
                      disabled={!selectedLead.request.pilotOpportunity?.requested}
                      onChange={(event) =>
                        updateStateMutation.mutate({
                          requestId: selectedLead.requestId,
                          qualificationState: selectedLead.qualification_state,
                          opportunityState: selectedLead.opportunity_state,
                          pilotOpportunityOutcome: event.target.value as PilotOpportunityOutcome,
                          note: note || undefined,
                        })
                      }
                    >
                      {!selectedLead.request.pilotOpportunity?.requested ? (
                        <option value="not_requested">Not requested</option>
                      ) : null}
                      {pilotOpportunityOutcomes.map((outcome) => (
                        <option key={outcome} value={outcome}>
                          {pilotOpportunityOutcomeLabels[outcome]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="border border-runway-line p-4">
                  <label className="runway-label">Add note</label>
                  <textarea
                    className="runway-input min-h-24"
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
                      className="runway-cta-ghost min-h-0 px-4 py-2 text-sm disabled:opacity-50"
                    >
                      Save note
                    </button>
                    {updateStateMutation.isPending || addNoteMutation.isPending ? (
                      <span className="text-sm text-runway-faint">Saving...</span>
                    ) : null}
                  </div>
                </div>

                {selectedLead.pipeline ? (
                  <div className="border border-runway-line p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="runway-meta">Scene readiness</p>
                        <p className="mt-2 text-sm text-runway-body">
                          Scene `{selectedLead.pipeline.scene_id}` · Capture `{selectedLead.pipeline.capture_id}`
                        </p>
                      </div>
                      {selectedLead.pipeline.synced_at ? (
                        <p className="text-xs text-runway-faint">
                          Synced {formatDate(selectedLead.pipeline.synced_at)}
                        </p>
                      ) : null}
                    </div>

                    {sceneDashboardQuery.isLoading ? (
                      <p className="mt-4 text-sm text-runway-faint">Loading scene dashboard...</p>
                    ) : sceneDashboardQuery.data ? (
                      <div className="mt-4 space-y-4">
                        <div className="grid gap-3 md:grid-cols-4">
                          <div className="border border-runway-line bg-runway-black p-3">
                            <p className="runway-meta">
                              {sceneDashboardQuery.data.site_type || "Site"} status
                            </p>
                            <p className="mt-2 font-medium text-runway-text">
                              {(sceneDashboardQuery.data.overview ?? sceneDashboardQuery.data.whole_home)
                                ?.status ?? "review required"}
                            </p>
                          </div>
                          <div className="border border-runway-line bg-runway-black p-3">
                            <p className="runway-meta">Ready now</p>
                            <p className="runway-num mt-2 text-2xl font-semibold text-runway-text">
                              {sceneDashboardQuery.data.deployment_summary.ready_now}
                            </p>
                          </div>
                          <div className="border border-runway-line bg-runway-black p-3">
                            <p className="runway-meta">Need redesign</p>
                            <p className="runway-num mt-2 text-2xl font-semibold text-runway-text">
                              {sceneDashboardQuery.data.deployment_summary.needs_redesign}
                            </p>
                          </div>
                          <div className="border border-runway-line bg-runway-black p-3">
                            <p className="runway-meta">Outside envelope</p>
                            <p className="runway-num mt-2 text-2xl font-semibold text-runway-text">
                              {sceneDashboardQuery.data.deployment_summary.outside_robot_envelope}
                            </p>
                          </div>
                        </div>

                        {Object.entries(
                          sceneDashboardQuery.data.task_groups ?? sceneDashboardQuery.data.categories,
                        ).map(([category, categorySummary]) => {
                          const tasks = categorySummary.tasks;
                          return (
                            <div key={category} className="border border-runway-line p-4">
                              <p className="runway-meta">{category}</p>
                              <div className="mt-3 space-y-3">
                                {tasks.length ? (
                                  tasks.map((task) => (
                                    <div
                                      key={`${category}-${task.capture_id}`}
                                      className="border border-runway-line bg-runway-black p-3"
                                    >
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span
                                          className={`runway-chip ${nextActionColors[task.next_action]}`}
                                        >
                                          {task.next_action}
                                        </span>
                                        <span className="text-xs text-runway-faint">{task.capture_id}</span>
                                      </div>
                                      <p className="mt-2 text-sm text-runway-text">{task.task_text}</p>
                                      <p className="mt-1 text-xs text-runway-faint">
                                        Themes: {task.themes.join(", ") || "none"}
                                      </p>
                                      {task.memo_uri ? (
                                        task.memo_uri.startsWith("http") ? (
                                          <a
                                            href={task.memo_uri}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="mt-2 inline-flex items-center text-xs text-runway-body hover:text-runway-text"
                                          >
                                            Memo
                                            <ExternalLink className="ml-1 h-3 w-3" />
                                          </a>
                                        ) : (
                                          <p className="mt-2 text-xs text-runway-faint">Memo URI: {task.memo_uri}</p>
                                        )
                                      ) : null}
                                    </div>
                                  ))
                                ) : (
                                  <p className="text-sm text-runway-faint">No tasks in this category.</p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : selectedLead.pipeline.artifacts.dashboard_summary_uri ? (
                      <p className="mt-4 text-sm text-runway-faint">
                        Scene dashboard could not be loaded.
                      </p>
                    ) : (
                      <p className="mt-4 text-sm text-runway-faint">
                        Pipeline attachment exists, but no scene dashboard has been emitted for this request yet.
                      </p>
                    )}
                  </div>
                ) : null}

                <div className="border border-runway-line p-4">
                  <p className="runway-meta mb-3">Notes</p>
                  <div className="space-y-3">
                    {selectedLead.notes?.length ? (
                      selectedLead.notes.map((entry) => (
                        <div key={entry.id} className="border border-runway-line bg-runway-black p-3 text-sm">
                          <p className="text-runway-text">{entry.content}</p>
                          <p className="mt-2 text-xs text-runway-faint">{formatDate(entry.createdAt)}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-runway-faint">No notes yet.</p>
                    )}
                  </div>
                </div>
                </div>
              ) : (
                <div className="flex min-h-[420px] flex-col items-center justify-center text-center text-runway-faint">
                  <ClipboardList className="mb-3 h-10 w-10" />
                  <p>Select a submission to review the intake and update its states.</p>
                </div>
              )}
            </div>
          </div>
        </>
        ) : (
          <>
            <div className="runway-panel mb-6 flex flex-col gap-3 p-4 md:flex-row md:flex-wrap">
              <div className="flex items-center gap-2 text-sm font-medium text-runway-body">
                <Filter className="h-4 w-4" />
                Filters
              </div>
              <select
                className="runway-input"
                value={waitlistRoleFilter}
                onChange={(event) => setWaitlistRoleFilter(event.target.value)}
              >
                <option value="">All roles</option>
                <option value="capturer">Capturer</option>
              </select>
              <select
                className="runway-input"
                value={waitlistDeviceFilter}
                onChange={(event) => setWaitlistDeviceFilter(event.target.value)}
              >
                <option value="">All devices</option>
                <option value="iphone">iPhone</option>
                <option value="ipad">iPad</option>
                <option value="camera_360">360 camera</option>
                <option value="android">Android</option>
              </select>
              <select
                className="runway-input"
                value={waitlistStatusFilter}
                onChange={(event) => setWaitlistStatusFilter(event.target.value)}
              >
                <option value="">All statuses</option>
                <option value="new">New</option>
              </select>
              <select
                className="runway-input"
                value={waitlistQueueFilter}
                onChange={(event) => setWaitlistQueueFilter(event.target.value)}
              >
                <option value="">All queues</option>
                <option value="capturer_beta_review">Capturer beta review</option>
                <option value="website_waitlist_review">Website waitlist review</option>
              </select>
              <input
                className="runway-input min-w-[260px] flex-1"
                value={waitlistSearch}
                onChange={(event) => setWaitlistSearch(event.target.value)}
                placeholder="Search market, email, phone, source, or tags"
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="space-y-3">
                {waitlistQuery.isLoading ? (
                  <div className="runway-panel p-6 text-runway-mute">
                    Loading waitlist submissions...
                  </div>
                ) : filteredWaitlistSubmissions.length === 0 ? (
                  <div className="runway-panel p-6 text-runway-mute">
                    No waitlist requests match the current filters.
                  </div>
                ) : (
                  filteredWaitlistSubmissions.map((submission) => (
                    <button
                      key={submission.id}
                      type="button"
                      onClick={() => setSelectedWaitlistSubmissionId(submission.id)}
                      className={`w-full border p-5 text-left transition-colors ${
                        selectedWaitlistSubmission?.id === submission.id
                          ? "border-runway-signal bg-runway-raised"
                          : "border-runway-line bg-runway-panel hover:bg-runway-raised"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-runway-text">
                            {submission.market || "Unknown market"}
                          </p>
                          <p className="text-sm text-runway-mute">
                            {submission.email} {submission.phone ? `· ${submission.phone}` : ""}
                          </p>
                        </div>
                        <span className="runway-chip runway-chip-live">
                          {submission.status}
                        </span>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2 text-xs">
                        {submission.role ? (
                          <span className="runway-chip runway-chip-quiet">
                            {submission.role}
                          </span>
                        ) : null}
                        {submission.device ? (
                          <span className="runway-chip runway-chip-quiet">
                            {submission.device}
                          </span>
                        ) : null}
                        {submission.queue ? (
                          <span className="runway-chip runway-chip-open">
                            {submission.queue}
                          </span>
                        ) : null}
                        {submission.ops_automation.eligible_for_ai_triage ? (
                          <span className="runway-chip runway-chip-neutral">
                            AI triage
                          </span>
                        ) : null}
                      </div>
                      <p className="runway-num mt-3 text-xs text-runway-faint">
                        {submission.created_at ? formatDate(submission.created_at) : "Unknown date"}
                      </p>
                    </button>
                  ))
                )}
              </div>

              <div className="runway-panel p-6">
                {selectedWaitlistSubmission ? (
                  <div className="space-y-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="runway-eyebrow-muted">
                          Waitlist submission
                        </p>
                        <h2 className="mt-2 font-display text-2xl font-semibold uppercase tracking-[0.005em] text-runway-text">
                          {selectedWaitlistSubmission.market || "Unknown market"}
                        </h2>
                        <p className="mt-1 text-runway-mute">
                          {selectedWaitlistSubmission.location_type || "No location type"}
                        </p>
                      </div>
                      <span className="runway-chip runway-chip-quiet">
                        {selectedWaitlistSubmission.id}
                      </span>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="border border-runway-line bg-runway-black p-4">
                        <p className="runway-meta">Contact</p>
                        <a
                          href={`mailto:${selectedWaitlistSubmission.email}`}
                          className="mt-2 inline-flex items-center text-sm text-runway-body hover:text-runway-text"
                        >
                          <Mail className="mr-2 h-4 w-4" />
                          {selectedWaitlistSubmission.email}
                        </a>
                        {selectedWaitlistSubmission.phone ? (
                          <p className="mt-2 text-sm text-runway-mute">
                            {selectedWaitlistSubmission.phone}
                          </p>
                        ) : null}
                        {selectedWaitlistSubmission.email_domain ? (
                          <p className="mt-2 text-xs text-runway-faint">
                            Domain: {selectedWaitlistSubmission.email_domain}
                          </p>
                        ) : null}
                      </div>
                      <div className="border border-runway-line bg-runway-black p-4">
                        <p className="runway-meta">Request facts</p>
                        <div className="mt-2 space-y-2 text-sm text-runway-body">
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

                    <div className="border border-runway-line p-4">
                      <p className="runway-meta">Automation state</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="runway-chip runway-chip-quiet">
                          {selectedWaitlistSubmission.ops_automation.status}
                        </span>
                        {selectedWaitlistSubmission.ops_automation.recommendation ? (
                          <span className="runway-chip runway-chip-live">
                            {selectedWaitlistSubmission.ops_automation.recommendation}
                          </span>
                        ) : null}
                        {selectedWaitlistSubmission.ops_automation.requires_human_review ? (
                          <span className="runway-chip runway-chip-open">
                            Human review
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-3 grid gap-4 md:grid-cols-2">
                        <div>
                          <p className="text-sm text-runway-faint">Status</p>
                          <p className="mt-1 font-medium text-runway-text">
                            {selectedWaitlistSubmission.ops_automation.status}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-runway-faint">Next action</p>
                          <p className="mt-1 font-medium text-runway-text">
                            {selectedWaitlistSubmission.ops_automation.next_action || "None"}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-runway-faint">Recommended path</p>
                          <p className="mt-1 font-medium text-runway-text">
                            {selectedWaitlistSubmission.ops_automation.recommended_path || "None"}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-runway-faint">AI triage</p>
                          <p className="mt-1 font-medium text-runway-text">
                            {selectedWaitlistSubmission.ops_automation.eligible_for_ai_triage
                              ? "Eligible"
                              : "No"}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-runway-faint">Invite readiness</p>
                          <p className="mt-1 font-medium text-runway-text">
                            {selectedWaitlistSubmission.ops_automation.invite_readiness_score ?? "N/A"}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-runway-faint">Confidence</p>
                          <p className="mt-1 font-medium text-runway-text">
                            {selectedWaitlistSubmission.ops_automation.confidence !== null
                              ? `${Math.round(selectedWaitlistSubmission.ops_automation.confidence * 100)}%`
                              : "N/A"}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-runway-faint">Market fit</p>
                          <p className="mt-1 font-medium text-runway-text">
                            {selectedWaitlistSubmission.ops_automation.market_fit_score ?? "N/A"}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-runway-faint">Device fit</p>
                          <p className="mt-1 font-medium text-runway-text">
                            {selectedWaitlistSubmission.ops_automation.device_fit_score ?? "N/A"}
                          </p>
                        </div>
                      </div>
                      {selectedWaitlistSubmission.ops_automation.model ? (
                        <p className="mt-4 text-xs text-runway-faint">
                          Model: {selectedWaitlistSubmission.ops_automation.model}
                        </p>
                      ) : null}
                      {selectedWaitlistSubmission.ops_automation.market_summary ? (
                        <p className="mt-4 text-sm text-runway-body">
                          {selectedWaitlistSubmission.ops_automation.market_summary}
                        </p>
                      ) : null}
                      {selectedWaitlistSubmission.ops_automation.rationale ? (
                        <p className="mt-3 text-sm text-runway-mute">
                          {selectedWaitlistSubmission.ops_automation.rationale}
                        </p>
                      ) : null}
                      {selectedWaitlistSubmission.ops_automation.last_error ? (
                        <p className="mt-4 text-sm text-runway-red">
                          Last error: {selectedWaitlistSubmission.ops_automation.last_error}
                        </p>
                      ) : null}
                    </div>

                    <div className="border border-runway-line p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="runway-meta">
                          Draft response
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            runWaitlistAutomationMutation.mutate({
                              submissionId: selectedWaitlistSubmission.id,
                            })
                          }
                          className="runway-cta-ghost min-h-0 px-3 py-2 text-xs"
                          disabled={runWaitlistAutomationMutation.isPending}
                        >
                          <Sparkles className="mr-2 h-3.5 w-3.5" />
                          Re-run AI triage
                        </button>
                      </div>
                      {selectedWaitlistSubmission.ops_automation.draft_email ? (
                        <div className="mt-3 space-y-3">
                          <div className="border border-runway-line bg-runway-black p-3">
                            <p className="text-xs text-runway-faint">Subject</p>
                            <p className="mt-1 text-sm font-medium text-runway-text">
                              {selectedWaitlistSubmission.ops_automation.draft_email.subject}
                            </p>
                          </div>
                          <div className="border border-runway-line bg-runway-black p-3">
                            <p className="text-xs text-runway-faint">Body</p>
                            <p className="mt-1 whitespace-pre-wrap text-sm text-runway-body">
                              {selectedWaitlistSubmission.ops_automation.draft_email.body}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <p className="mt-3 text-sm text-runway-faint">
                          No AI draft yet. Run triage to generate one.
                        </p>
                      )}
                    </div>

                    <div className="border border-runway-line p-4">
                      <p className="runway-meta">Filter tags</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {selectedWaitlistSubmission.filter_tags.length ? (
                          selectedWaitlistSubmission.filter_tags.map((tag) => (
                            <span key={tag} className="runway-chip runway-chip-quiet">
                              {tag}
                            </span>
                          ))
                        ) : (
                          <p className="text-sm text-runway-faint">No tags assigned.</p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex min-h-[420px] flex-col items-center justify-center text-center text-runway-faint">
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
