#!/usr/bin/env tsx
import fs from "node:fs";
import path from "node:path";

import yaml from "js-yaml";

const DEFAULT_COMPANY_CONFIG = "ops/paperclip/blueprint-company/.paperclip.yaml";
const DEFAULT_CONTROL_ROOM_MAP = "ops/paperclip/control-room-map.md";
const DEFAULT_PLAN_DOC = "docs/architecture/autonomous-org-500-month-operating-budget-2026-06-01.md";
const DEFAULT_SPEND_SOURCES = "config/autonomy/spend-sources.yaml";
const DEFAULT_OUTCOME_SOURCES = "config/autonomy/outcome-sources.yaml";
const DEFAULT_ALLOCATION_POLICY = "config/autonomy/budget-allocation-policy.yaml";
const DEFAULT_OUTCOME_SNAPSHOT = "output/autonomous-org/budget/outcomes/latest.json";
const DEFAULT_SPEND_SNAPSHOT = "output/autonomous-org/budget/spend-snapshots/latest.json";
const DEFAULT_DYNAMIC_RECOMMENDATIONS = "output/autonomous-org/budget/dynamic/latest/recommendations.json";
const DEFAULT_DYNAMIC_VERIFICATION = "output/autonomous-org/budget/dynamic/latest/verification.json";
const DEFAULT_DYNAMIC_APPROVAL_PACKET = "output/autonomous-org/budget/dynamic/latest/human-approval-packet.md";
const DEFAULT_DYNAMIC_PROPOSED_DIFF = "output/autonomous-org/budget/dynamic/latest/proposed-repo-local-budget-diff.patch";
const DEFAULT_SUMMARY_JSON = "output/autonomous-org/budget/latest/summary.json";
const DEFAULT_AUDIT_JSON = "output/autonomous-org/budget/latest/completion-audit.json";
const DEFAULT_CLOSEOUT_MD = "output/autonomous-org/budget/latest/closeout.md";
const DEFAULT_LIVE_PROOF_BACKLOG_JSON = "output/autonomous-org/budget/latest/live-proof-backlog.json";
const DEFAULT_LIVE_PROOF_BACKLOG_MD = "output/autonomous-org/budget/latest/live-proof-backlog.md";
const DEFAULT_LIVE_PROOF_RECONCILIATION_JSON = "output/autonomous-org/budget/latest/live-proof-reconciliation.json";
const DEFAULT_LIVE_PROOF_RECONCILIATION_MD = "output/autonomous-org/budget/latest/live-proof-reconciliation.md";
const DEFAULT_LIVE_PROOF_INTAKE_TEMPLATE_JSON = "output/autonomous-org/budget/latest/live-proof-intake-template.json";
const DEFAULT_LIVE_PROOF_INTAKE_TEMPLATE_MD = "output/autonomous-org/budget/latest/live-proof-intake-template.md";
const DEFAULT_LIVE_PROOF_INTAKE_VALIDATION_JSON = "output/autonomous-org/budget/latest/live-proof-intake-validation.json";
const DEFAULT_LIVE_PROOF_INTAKE_VALIDATION_MD = "output/autonomous-org/budget/latest/live-proof-intake-validation.md";
const DEFAULT_NEXT_GOAL_QUEUE_JSON = "output/autonomous-org/budget/latest/next-goal-queue.json";
const DEFAULT_NEXT_GOAL_QUEUE_MD = "output/autonomous-org/budget/latest/next-goal-queue.md";
const DEFAULT_BUDGET_DELEGATION_PACKET_JSON = "output/autonomous-org/budget/latest/budget-delegation-packet.json";
const DEFAULT_BUDGET_DELEGATION_PACKET_MD = "output/autonomous-org/budget/latest/budget-delegation-packet.md";
const DEFAULT_LIVE_ACTION_GATE_JSON = "output/autonomous-org/budget/latest/live-action-gate.json";
const DEFAULT_LIVE_ACTION_GATE_MD = "output/autonomous-org/budget/latest/live-action-gate.md";
const DEFAULT_CONTROL_STATUS_JSON = "output/autonomous-org/budget/latest/control-status.json";
const DEFAULT_CONTROL_STATUS_MD = "output/autonomous-org/budget/latest/control-status.md";
const DEFAULT_LAUNCH_NOW_APPROVAL_PACKET_JSON = "output/autonomous-org/budget/latest/launch-now-approval-packet.json";
const DEFAULT_LAUNCH_NOW_APPROVAL_PACKET_MD = "output/autonomous-org/budget/latest/launch-now-approval-packet.md";
const DEFAULT_HUMAN_BLOCKER_PACKET_JSON = "output/autonomous-org/budget/latest/human-blocker-packet.json";
const DEFAULT_HUMAN_BLOCKER_PACKET_MD = "output/autonomous-org/budget/latest/human-blocker-packet.md";
const DEFAULT_OUT_DIR = "output/autonomous-org/budget/latest";

type PaperclipConfig = {
  agents?: Record<string, {
    budgetMonthlyCents?: number;
  }>;
  routines?: Record<string, {
    status?: string;
  }>;
};

type BudgetLine = {
  line: string;
  current_usd: number | null;
  target_usd: number;
  variance_usd: number | null;
  owner_system: string;
  proof_source: string;
  proof_level: "repo-local" | "estimate" | "live-verified";
};

type RepoSpendControlSurface = {
  path: string;
  role: string;
  proof_level: "repo-local";
  live_money_status: string;
};

type SpendSource = {
  id: string;
  budgetLine: string;
  targetUsd?: number | null;
};

type SpendSourceRegistry = {
  schema: string;
  sources?: SpendSource[];
};

type OutcomeSourceRegistry = {
  schema: string;
  sources?: Array<{ id: string; budgetLine: string; canAffectAllocation?: boolean }>;
};

type AllocationPolicy = {
  schema: string;
  budget_cap_usd: number;
  paperclip_declared_subcap_usd: number;
  openai_api_target_usd: number;
  max_single_move_usd: number;
  budget_lines?: Array<{ budget_line: string; target_usd: number }>;
};

type OutcomeSnapshot = {
  schema: string;
  mode: {
    live_mutation_attempted: boolean;
  };
  outcomes?: Array<{
    source_id: string;
    proof_level: string;
    proof_status: string;
    can_affect_allocation: boolean;
  }>;
};

type DynamicRecommendation = {
  id: string;
  action: string;
  from_budget_line: string | null;
  to_budget_line: string | null;
  amount_usd: number;
  approval_required: boolean;
  proof_level: string;
  evidence_refs: string[];
  live_mutation_attempted: boolean;
};

type DynamicRecommendations = {
  schema: string;
  mode: {
    repo_local_diff_only: boolean;
    live_mutation_attempted: boolean;
  };
  budget_cap_usd: number;
  projected_target_total_usd: number;
  projected_budget_lines: Record<string, number>;
  recommendations: DynamicRecommendation[];
};

type DynamicVerification = {
  schema: string;
  pass: boolean;
  errors: string[];
};

type LiveProofBacklogItem = {
  id: string;
  closeout_gap: string;
  budget_line: string;
  target_usd: number;
  owner_system: string;
  status: string;
  currently_have: string;
  proof_needed: string;
  safe_proof_command: string;
  exact_input_needed: string;
  approval_required_before_live_spend_change: boolean;
  live_mutation_allowed: boolean;
  disallowed_workaround: string;
};

type LiveProofBacklog = {
  schema: string;
  state: string;
  blocker_id: string;
  no_live_mutation_attempted: boolean;
  codex_oauth_pro: {
    budget_line: string;
    target_usd: number;
    status: string;
    proof_boundary: string;
  };
  openai_api_guardrail: {
    budget_line: string;
    target_usd: number;
    current_usd: number;
    status: string;
    proof_path: string;
    proof_boundary: string;
  };
  source_snapshots: string[];
  safe_resume_commands: string[];
  remaining_items: LiveProofBacklogItem[];
};

type LiveProofReconciliation = {
  schema: string;
  state: string;
  blocker_id: string;
  backlog_path: string;
  spend_snapshot_path: string;
  no_live_provider_calls_made_by_reconciliation: boolean;
  no_live_mutation_attempted: boolean;
  secrets_persisted: boolean;
  total_items: number;
  closed_items: number;
  partial_items: number;
  open_items: number;
  all_live_mutation_allowed: boolean;
  codex_oauth_pro: {
    target_usd: number;
    status: string;
    excluded_from_500_budget: boolean;
  };
  openai_api_guardrail: {
    target_usd: number;
    current_usd: number;
    status: string;
    latest_source_status: string | null;
    latest_source_proof_level: string | null;
    verified_zero: boolean;
  };
  items: Array<{
    id: string;
    reconciliation_status: "closed" | "partial_source_proof" | "open";
    safe_proof_command: string;
    approval_required_before_live_spend_change: boolean;
    live_mutation_allowed: boolean;
    source_evidence: Array<{
      id: string;
      proof_status: "budget_actual" | "partial" | "missing";
      live_mutation_attempted: boolean;
    }>;
    missing_source_ids: string[];
  }>;
  safe_resume_commands: string[];
};

type LiveProofIntakeTemplate = {
  schema: string;
  state: string;
  blocker_id: string;
  backlog_path: string;
  reconciliation_path: string;
  no_live_provider_calls_made: boolean;
  no_live_mutation_attempted: boolean;
  secrets_persisted: boolean;
  codex_oauth_pro: {
    target_usd: number;
    status: string;
    excluded_from_500_budget: boolean;
  };
  openai_api_guardrail: {
    target_usd: number;
    current_usd: number;
    status: string;
    proof_path: string;
  };
  accepted_artifact_types: string[];
  required_artifact_fields: string[];
  instructions: string[];
  items: Array<{
    id: string;
    current_reconciliation_status: "closed" | "partial_source_proof" | "open" | "not_reconciled";
    target_usd: number;
    artifact_intake_template: {
      artifact_path: string;
      artifact_type: string;
      current_period_amount_usd: number | null;
      human_confirmation: string;
    };
    acceptance_criteria: string[];
    approval_required_before_live_spend_change: boolean;
    live_mutation_allowed: boolean;
  }>;
};

type LiveProofIntakeValidation = {
  schema: string;
  state: string;
  blocker_id: string;
  template_path: string;
  intake_path: string;
  no_live_provider_calls_made: boolean;
  no_live_mutation_attempted: boolean;
  secrets_persisted: boolean;
  command_passed: boolean;
  intake_complete: boolean;
  proof_ready_to_count_as_live_billing: boolean;
  codex_oauth_pro: {
    target_usd: number;
    status: string;
    excluded_from_500_budget: boolean;
  };
  openai_api_guardrail: {
    target_usd: number;
    current_usd: number;
    status: string;
  };
  totals: {
    total_items: number;
    accepted_for_manual_review: number;
    missing_submission: number;
    rejected: number;
  };
  items: Array<{
    id: string;
    validation_status: "accepted_for_manual_review" | "missing_submission" | "rejected";
    counts_as_live_billing_proof: false;
    approval_required_before_live_spend_change: boolean;
    live_mutation_allowed: boolean;
  }>;
  required_next_commands: string[];
};

type SpendProofSnapshot = {
  schema: string;
  mode?: {
    live_read_enabled?: boolean;
    live_mutation_attempted?: boolean;
    secrets_persisted?: boolean;
    keychain_enabled?: boolean;
    keychain_loaded_env?: string[];
  };
  totals?: {
    target_usd?: number;
    live_billing_verified_usd?: number;
    live_credit_balance_sources?: number;
    live_usage_only_sources?: number;
    missing_or_unverified_target_usd?: number;
  };
  sources?: Array<{
    id: string;
    status: string;
    proof_level: string;
    target_usd: number | null;
    amount_usd_current_period: number | null;
    credit_balance_usd?: number | null;
    can_count_toward_budget_actuals?: boolean;
    live_read_attempted: boolean;
    live_mutation_attempted: boolean;
    missing_to_verify?: string[];
    error: string | null;
  }>;
};

type HumanBlockerPacket = {
  schema: string;
  state: string;
  blocker_title: string;
  blocker_id: string;
  why_this_is_blocked: {
    what_is_blocked: string;
    why_human_gated: string;
    why_agent_cannot_proceed_alone: string;
  };
  recommended_answer: string;
  alternatives: string[];
  downside_risk: string;
  exact_response_needed: string;
  execution_owner_after_reply: string;
  immediate_next_action_after_reply: string;
  deadline_checkpoint: string;
  evidence: string[];
  non_scope: string[];
  routing_surface: string;
  channel_target: string;
  safe_resume_commands: string[];
  retry_resume_condition: string;
  disallowed_workarounds: string[];
};

type NextGoalQueue = {
  schema: string;
  generated_at: string;
  state: string;
  budget_cap_usd: number;
  paperclip_declared_envelope_usd: number;
  deepseek_direct_model_reserve_usd: number;
  no_live_mutation_authorized: boolean;
  codex_oauth_pro_excluded_from_budget: boolean;
  openai_api_target_usd: number;
  queue: Array<{
    rank: number;
    goal_command: string;
    lane: string;
    owner: string;
    budget_boundary_usd: number | null;
    safe_commands: string[];
    success_criteria: string[];
    blocked_claims: string[];
    why_goal_is_appropriate: string;
    requires_human_approval_before_live_action: boolean;
    live_mutation_allowed: boolean;
    live_mutation_allowed_without_human_approval: boolean;
    codex_oauth_pro_budget_treatment: string;
    openai_api_budget_treatment: string;
  }>;
};

type BudgetDelegationPacket = {
  schema: string;
  state: string;
  budget_cap_usd: number;
  target_total_usd: number;
  paperclip_declared_envelope_usd: number;
  active_routines: number;
  paused_routines: number;
  codex_oauth_pro_excluded_from_budget: boolean;
  openai_api_target_usd: number;
  no_live_mutation_authorized: boolean;
  live_billing_verified: boolean;
  allocator: {
    recommendation_count: number;
    spend_affecting_recommendation_count: number;
    recommendation_state: string;
    projected_target_total_usd: number;
    human_approval_required: boolean;
    live_mutation_attempted: boolean;
  };
  proof_gate: {
    proof_ready_to_count_as_live_billing: boolean;
    total_items: number;
    accepted_for_manual_review: number;
    missing_submission: number;
    rejected: number;
  };
  budget_line_delegations: Array<{
    budget_line: string;
    target_usd: number;
    owner: string;
    lane: string;
    authority: string;
    spend_release_status: string;
    required_before_spend: string[];
  }>;
  work_orders: Array<{
    rank: number;
    owner: string;
    lane: string;
    goal_command: string;
    safe_commands: string[];
    success_criteria: string[];
    blocked_claims: string[];
    required_checks: string[];
    can_start_without_live_approval: boolean;
    can_spend_without_human_approval: boolean;
    can_mutate_live_systems: boolean;
    requires_human_approval_before_live_action: boolean;
    live_mutation_allowed: boolean;
  }>;
  required_checks_before_any_live_action: string[];
  live_delegation_blockers: string[];
};

type LiveActionGate = {
  schema: string;
  state: string;
  validation_pass: boolean;
  live_action_allowed: boolean;
  repo_local_work_allowed: boolean;
  mode: {
    no_live_provider_calls_made: boolean;
    no_live_mutation_attempted: boolean;
    secrets_persisted: boolean;
    strict_live_action_ready_required: boolean;
  };
  budget_cap_usd: number;
  codex_oauth_pro_excluded_from_budget: boolean;
  openai_api_target_usd: number;
  blocker_count: number;
  error_count: number;
  checks: Array<{
    id: string;
    pass: boolean;
    severity: string;
    evidence: string;
  }>;
  blockers: string[];
  errors: string[];
  required_before_live_action: string[];
};

type BudgetControlStatus = {
  schema: string;
  state: string;
  validation_pass: boolean;
  budget_cap_usd: number;
  target_total_usd: number;
  can_allocate_repo_local: boolean;
  can_delegate_repo_local: boolean;
  can_mutate_live_spend: boolean;
  can_claim_live_budget_complete: boolean;
  can_claim_operational_launch_ready: boolean;
  codex_oauth_pro_excluded_from_budget: boolean;
  openai_api_target_usd: number;
  paperclip_declared_envelope_usd: number;
  active_routines: number;
  paused_routines: number;
  next_goal_queue_items: number;
  delegation_work_orders: number;
  delegation_spend_without_approval_items: number;
  delegation_live_mutation_allowed_items: number;
  live_action_gate_blockers: number;
  live_proof_gaps: string[];
  required_before_live_action: string[];
  next_safe_agent_actions: string[];
  errors: string[];
  blockers: string[];
  mode: {
    no_live_provider_calls_made: boolean;
    no_live_mutation_attempted: boolean;
    secrets_persisted: boolean;
    strict_live_action_ready_required: boolean;
  };
};

type BudgetSummary = {
  schema: string;
  state_claimed: string;
  budget_cap_usd: number;
  target_total_usd: number;
  proof_scope: {
    repo_local_controls_implemented: boolean;
    live_billing_verified: boolean;
    live_mutation_attempted: boolean;
    operational_launch_ready_claimed: boolean;
  };
  paperclip_compression: {
    declared_agent_budget_before_usd: number;
    declared_agent_budget_after_usd: number;
    declared_agent_budget_target_usd: number;
    active_routines_after: number;
    paused_routines_after: number;
    routines_total: number;
  };
  repo_spend_control_surfaces: RepoSpendControlSurface[];
  budget_ledger: BudgetLine[];
  completion_audit_path: string;
  live_proof_backlog_path: string;
  live_proof_reconciliation_path: string;
  live_proof_intake_template_path: string;
  live_proof_intake_validation_path: string;
  next_goal_queue_path: string;
  budget_delegation_packet_path: string;
  live_action_gate_path: string;
  control_status_path: string;
  launch_now_approval_packet_path: string;
  control_suite_path: string;
  human_blocker_packet_path: string;
  next_goal_queue: string[];
  live_proof_gaps: string[];
};

type LaunchNowApprovalPacket = {
  schema: string;
  state: string;
  approval_effective: boolean;
  no_live_mutation_attempted: boolean;
  no_provider_calls_made: boolean;
  secrets_persisted: boolean;
  budget_cap_usd: number;
  repo_local_paperclip_envelope_usd: number;
  requested_live_spend_ceiling_usd: number;
  combined_budget_ceiling_usd: number;
  codex_oauth_pro_excluded_from_budget: boolean;
  openai_api_target_usd: number;
  control_status: {
    can_mutate_live_spend: boolean;
    can_claim_live_budget_complete: boolean;
    can_claim_operational_launch_ready: boolean;
  };
  approval_capture: {
    human_approved: boolean;
    approver: string | null;
    approved_at: string | null;
    source: string | null;
    exact_text_received: string | null;
  };
  approval_items: Array<{
    budget_line: string;
    max_usd: number;
  }>;
  non_spend_guardrails: Array<{
    budget_line: string;
    max_usd: number;
  }>;
  exact_human_approval_text: string;
};

type CompletionAudit = {
  schema: string;
  state_claimed_for_repo_local_work: string;
  state_claimed_for_live_budget_truth: string;
  live_mutation_attempted: boolean;
  completion_summary: {
    repo_local_budget_controls_complete: boolean;
    live_billing_truth_complete: boolean;
    goal_can_be_marked_complete_without_billing_exports: boolean;
  };
  current_state_evidence: {
    paperclip_inventory_current: {
      declared_monthly_agent_budget_usd: number;
      active_routines: number;
      paused_routines: number;
      true_missing_desired_skills: number;
    };
    repo_spend_control_surfaces?: {
      result: string;
      conclusion: string;
      checked: string[];
      live_money_status: string;
    };
    dynamic_allocation_loop?: {
      result: string;
      recommendation_state: string;
      human_approval_required: boolean;
      projected_target_total_usd: number;
      live_mutation_attempted: boolean;
      artifacts: string[];
    };
    live_proof_backlog?: {
      result: string;
      json_path: string;
      markdown_path: string;
      blocker_id: string;
      remaining_items: number;
      live_mutation_allowed: boolean;
    };
    live_proof_reconciliation?: {
      result: string;
      json_path: string;
      markdown_path: string;
      blocker_id: string;
      total_items: number;
      closed_items: number;
      partial_items: number;
      open_items: number;
      live_mutation_allowed: boolean;
    };
    live_proof_intake_template?: {
      result: string;
      json_path: string;
      markdown_path: string;
      blocker_id: string;
      items: number;
      accepted_artifact_types: number;
      live_mutation_allowed: boolean;
    };
    live_proof_intake_validation?: {
      result: string;
      json_path: string;
      markdown_path: string;
      blocker_id: string;
      total_items: number;
      accepted_for_manual_review: number;
      missing_submission: number;
      rejected: number;
      proof_ready_to_count_as_live_billing: boolean;
      live_mutation_allowed: boolean;
    };
    next_goal_queue?: {
      result: string;
      json_path: string;
      markdown_path: string;
      items: number;
      live_mutation_allowed: boolean;
      codex_oauth_pro_excluded_from_budget: boolean;
      openai_api_target_usd: number;
    };
    budget_delegation_packet?: {
      result: string;
      json_path: string;
      markdown_path: string;
      work_orders: number;
      budget_line_delegations: number;
      live_mutation_allowed: boolean;
      can_spend_without_human_approval: boolean;
    };
    live_action_gate?: {
      result: string;
      json_path: string;
      markdown_path: string;
      state: string;
      validation_pass: boolean;
      live_action_allowed: boolean;
      repo_local_work_allowed: boolean;
      blocker_count: number;
      error_count: number;
    };
    budget_control_status?: {
      result: string;
      json_path: string;
      markdown_path: string;
      state: string;
      validation_pass: boolean;
      can_allocate_repo_local: boolean;
      can_delegate_repo_local: boolean;
      can_mutate_live_spend: boolean;
      can_claim_live_budget_complete: boolean;
      live_action_gate_blockers: number;
    };
    launch_now_approval_packet?: {
      result: string;
      json_path: string;
      markdown_path: string;
      state: string;
      approval_effective: boolean;
      requested_live_spend_ceiling_usd: number;
      repo_local_paperclip_envelope_usd: number;
      combined_budget_ceiling_usd: number;
      openai_api_target_usd: number;
      codex_oauth_pro_excluded_from_budget: boolean;
      live_mutation_allowed: boolean;
    };
    control_suite?: {
      result: string;
      json_path: string;
      markdown_path: string;
      command_count: number;
      passed_count: number;
      failed_count: number;
      live_mutation_allowed: boolean;
    };
    spend_observability_current?: {
      result: string;
      default_snapshot_path: string;
      dated_live_read_snapshot_path: string;
      keychain_loaded_env_count: number;
      openai_api_costs_current_usd: number;
      openai_api_costs_status: string;
      codex_oauth_pro_status: string;
      deepseek_credit_balance_usd: number | null;
      live_billing_truth_complete: boolean;
      live_mutation_attempted: boolean;
      secrets_persisted: boolean;
    };
    human_blocker_packet?: {
      result: string;
      json_path: string;
      markdown_path: string;
      blocker_id: string;
      routing_surface: string;
      recommended_answer: string;
      live_mutation_allowed: boolean;
    };
  };
  requirement_audit: Array<{
    requirement: string;
    status: string;
    evidence: string;
  }>;
};

type VerificationResult = {
  schema: "blueprint/autonomous-org-budget-verification/v1";
  generated_at: string;
  pass: boolean;
  errors: string[];
  warnings: string[];
  computed: {
    declared_agent_budget_usd: number;
    active_routines: number;
    paused_routines: number;
    total_routines: number;
    budget_ledger_target_total_usd: number;
    spend_registry_target_total_usd: number;
    repo_local_ledger_target_usd: number;
    estimate_ledger_target_usd: number;
    live_verified_ledger_target_usd: number;
    codex_oauth_pro_target_usd: number;
    openai_api_target_usd: number;
    deepseek_direct_target_usd: number;
    dynamic_projected_target_total_usd: number;
    dynamic_recommendation_count: number;
    dynamic_spend_affecting_recommendation_count: number;
    live_proof_backlog_item_count: number;
    live_proof_reconciliation_closed_items: number;
    live_proof_reconciliation_partial_items: number;
    live_proof_reconciliation_open_items: number;
    live_proof_intake_template_items: number;
    live_proof_intake_validation_accepted_items: number;
    live_proof_intake_validation_missing_items: number;
    live_proof_intake_validation_rejected_items: number;
    next_goal_queue_items: number;
    next_goal_queue_live_mutation_allowed_items: number;
    budget_delegation_work_orders: number;
    budget_delegation_spend_without_approval_items: number;
    live_action_gate_blocker_count: number;
    live_action_allowed: boolean;
    budget_control_status_live_spend_allowed: boolean;
  };
  checked_paths: {
    company_config: string;
    control_room_map: string;
    plan_doc: string;
    spend_sources: string;
    outcome_sources: string;
    allocation_policy: string;
    outcome_snapshot: string;
    spend_snapshot: string;
    dynamic_recommendations: string;
    dynamic_verification: string;
    dynamic_approval_packet: string;
    dynamic_proposed_diff: string;
    summary_json: string;
    completion_audit_json: string;
    closeout_md: string;
    live_proof_backlog_json: string;
    live_proof_backlog_md: string;
    live_proof_reconciliation_json: string;
    live_proof_reconciliation_md: string;
    live_proof_intake_template_json: string;
    live_proof_intake_template_md: string;
    live_proof_intake_validation_json: string;
    live_proof_intake_validation_md: string;
    next_goal_queue_json: string;
    next_goal_queue_md: string;
    budget_delegation_packet_json: string;
    budget_delegation_packet_md: string;
    live_action_gate_json: string;
    live_action_gate_md: string;
    control_status_json: string;
    control_status_md: string;
    launch_now_approval_packet_json: string;
    launch_now_approval_packet_md: string;
    human_blocker_packet_json: string;
    human_blocker_packet_md: string;
    openai_api_costs_proof: string;
  };
  proof_boundary: {
    repo_local_controls_verified: boolean;
    live_billing_verified: boolean;
    live_mutation_attempted: boolean;
    goal_complete_without_billing_exports: boolean;
  };
};

function readArg(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function hasFlag(name: string) {
  return process.argv.includes(name);
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function formatUsd(value: number) {
  return `$${value.toFixed(2)}`;
}

function moneyEquals(left: number, right: number) {
  return Math.abs(left - right) < 0.001;
}

function sumBudgetCents(config: PaperclipConfig) {
  return Object.values(config.agents ?? {}).reduce(
    (sum, agent) => sum + (agent.budgetMonthlyCents ?? 0),
    0,
  );
}

function countRoutines(config: PaperclipConfig) {
  return Object.values(config.routines ?? {}).reduce<Record<string, number>>((counts, routine) => {
    const status = routine.status ?? "active";
    counts[status] = (counts[status] ?? 0) + 1;
    return counts;
  }, {});
}

function assertCondition(errors: string[], condition: boolean, message: string) {
  if (!condition) {
    errors.push(message);
  }
}

function includesEvery(body: string, needles: string[]) {
  return needles.every((needle) => body.includes(needle));
}

const EXPECTED_SPEND_CONTROL_SURFACES = [
  "docs/agentic-spend-control-plane-2026-04-30.md",
  "ops/paperclip/plugins/blueprint-automation/src/agent-spend-tool.ts",
  "ops/paperclip/plugins/blueprint-automation/src/server-agent-spend-ledger.ts",
  "server/utils/agentSpendPolicy.ts",
  "server/utils/agentSpendProviders.ts",
  "server/utils/agentSpendLedger.ts",
] as const;

const SPEND_AFFECTING_DYNAMIC_ACTIONS = new Set(["reallocate", "increase", "reduce"]);

function renderMarkdown(result: VerificationResult) {
  const lines = [
    "# Autonomous Org Budget Verification",
    "",
    `Generated: ${result.generated_at}`,
    `Status: ${result.pass ? "pass" : "fail"}`,
    "",
    "## Computed State",
    "",
    `- Declared Paperclip agent budget: ${formatUsd(result.computed.declared_agent_budget_usd)}`,
    `- Routines: ${result.computed.total_routines} total, ${result.computed.active_routines} active, ${result.computed.paused_routines} paused`,
    `- Budget ledger target total: ${formatUsd(result.computed.budget_ledger_target_total_usd)}`,
    `- Spend source registry target total: ${formatUsd(result.computed.spend_registry_target_total_usd)}`,
    `- Repo-local ledger target: ${formatUsd(result.computed.repo_local_ledger_target_usd)}`,
    `- Estimate ledger target: ${formatUsd(result.computed.estimate_ledger_target_usd)}`,
    `- Live-verified ledger target: ${formatUsd(result.computed.live_verified_ledger_target_usd)}`,
    `- Codex OAuth / Pro target: ${formatUsd(result.computed.codex_oauth_pro_target_usd)}`,
    `- OpenAI API target: ${formatUsd(result.computed.openai_api_target_usd)}`,
    `- DeepSeek direct model reserve target: ${formatUsd(result.computed.deepseek_direct_target_usd)}`,
    `- Dynamic projected target total: ${formatUsd(result.computed.dynamic_projected_target_total_usd)}`,
    `- Dynamic recommendations: ${result.computed.dynamic_recommendation_count}`,
    `- Dynamic spend-affecting recommendations: ${result.computed.dynamic_spend_affecting_recommendation_count}`,
    `- Live-proof backlog items: ${result.computed.live_proof_backlog_item_count}`,
    `- Live-proof reconciliation: ${result.computed.live_proof_reconciliation_closed_items} closed, ${result.computed.live_proof_reconciliation_partial_items} partial, ${result.computed.live_proof_reconciliation_open_items} open/blocking`,
    `- Live-proof intake template items: ${result.computed.live_proof_intake_template_items}`,
    `- Live-proof intake validation: ${result.computed.live_proof_intake_validation_accepted_items} accepted, ${result.computed.live_proof_intake_validation_missing_items} missing, ${result.computed.live_proof_intake_validation_rejected_items} rejected`,
    `- Next-goal queue items: ${result.computed.next_goal_queue_items}`,
    `- Next-goal queue live-mutation allowed items: ${result.computed.next_goal_queue_live_mutation_allowed_items}`,
    `- Budget delegation work orders: ${result.computed.budget_delegation_work_orders}`,
    `- Budget delegation spend-without-approval items: ${result.computed.budget_delegation_spend_without_approval_items}`,
    `- Live-action gate blockers: ${result.computed.live_action_gate_blocker_count}`,
    `- Live action allowed: ${result.computed.live_action_allowed ? "yes" : "no"}`,
    `- Control status live spend allowed: ${result.computed.budget_control_status_live_spend_allowed ? "yes" : "no"}`,
    "",
    "## Proof Boundary",
    "",
    `- Repo-local controls verified: ${result.proof_boundary.repo_local_controls_verified ? "yes" : "no"}`,
    `- Live billing verified: ${result.proof_boundary.live_billing_verified ? "yes" : "no"}`,
    `- Live mutation attempted: ${result.proof_boundary.live_mutation_attempted ? "yes" : "no"}`,
    `- Goal complete without billing exports: ${result.proof_boundary.goal_complete_without_billing_exports ? "yes" : "no"}`,
  ];

  if (result.errors.length > 0) {
    lines.push("", "## Errors", "", ...result.errors.map((error) => `- ${error}`));
  }

  if (result.warnings.length > 0) {
    lines.push("", "## Warnings", "", ...result.warnings.map((warning) => `- ${warning}`));
  }

  lines.push(
    "",
    "## Checked Paths",
    "",
    `- ${result.checked_paths.company_config}`,
    `- ${result.checked_paths.control_room_map}`,
    `- ${result.checked_paths.plan_doc}`,
    `- ${result.checked_paths.spend_sources}`,
    `- ${result.checked_paths.outcome_sources}`,
    `- ${result.checked_paths.allocation_policy}`,
    `- ${result.checked_paths.outcome_snapshot}`,
    `- ${result.checked_paths.spend_snapshot}`,
    `- ${result.checked_paths.dynamic_recommendations}`,
    `- ${result.checked_paths.dynamic_verification}`,
    `- ${result.checked_paths.dynamic_approval_packet}`,
    `- ${result.checked_paths.dynamic_proposed_diff}`,
    `- ${result.checked_paths.summary_json}`,
    `- ${result.checked_paths.completion_audit_json}`,
    `- ${result.checked_paths.closeout_md}`,
    `- ${result.checked_paths.live_proof_backlog_json}`,
    `- ${result.checked_paths.live_proof_backlog_md}`,
    `- ${result.checked_paths.live_proof_reconciliation_json}`,
    `- ${result.checked_paths.live_proof_reconciliation_md}`,
    `- ${result.checked_paths.live_proof_intake_template_json}`,
    `- ${result.checked_paths.live_proof_intake_template_md}`,
    `- ${result.checked_paths.live_proof_intake_validation_json}`,
    `- ${result.checked_paths.live_proof_intake_validation_md}`,
    `- ${result.checked_paths.next_goal_queue_json}`,
    `- ${result.checked_paths.next_goal_queue_md}`,
    `- ${result.checked_paths.budget_delegation_packet_json}`,
    `- ${result.checked_paths.budget_delegation_packet_md}`,
    `- ${result.checked_paths.live_action_gate_json}`,
    `- ${result.checked_paths.live_action_gate_md}`,
    `- ${result.checked_paths.control_status_json}`,
    `- ${result.checked_paths.control_status_md}`,
    `- ${result.checked_paths.launch_now_approval_packet_json}`,
    `- ${result.checked_paths.launch_now_approval_packet_md}`,
    `- ${result.checked_paths.human_blocker_packet_json}`,
    `- ${result.checked_paths.human_blocker_packet_md}`,
    `- ${result.checked_paths.openai_api_costs_proof}`,
  );

  return lines.join("\n");
}

function verify() {
  const companyConfigPath = readArg("--config") || DEFAULT_COMPANY_CONFIG;
  const controlRoomMapPath = readArg("--control-room-map") || DEFAULT_CONTROL_ROOM_MAP;
  const planDocPath = readArg("--plan-doc") || DEFAULT_PLAN_DOC;
  const spendSourcesPath = readArg("--spend-sources") || DEFAULT_SPEND_SOURCES;
  const outcomeSourcesPath = readArg("--outcome-sources") || DEFAULT_OUTCOME_SOURCES;
  const allocationPolicyPath = readArg("--allocation-policy") || DEFAULT_ALLOCATION_POLICY;
  const outcomeSnapshotPath = readArg("--outcome-snapshot") || DEFAULT_OUTCOME_SNAPSHOT;
  const spendSnapshotPath = readArg("--spend-snapshot") || DEFAULT_SPEND_SNAPSHOT;
  const dynamicRecommendationsPath = readArg("--dynamic-recommendations") || DEFAULT_DYNAMIC_RECOMMENDATIONS;
  const dynamicVerificationPath = readArg("--dynamic-verification") || DEFAULT_DYNAMIC_VERIFICATION;
  const dynamicApprovalPacketPath = readArg("--dynamic-approval-packet") || DEFAULT_DYNAMIC_APPROVAL_PACKET;
  const dynamicProposedDiffPath = readArg("--dynamic-proposed-diff") || DEFAULT_DYNAMIC_PROPOSED_DIFF;
  const summaryJsonPath = readArg("--summary") || DEFAULT_SUMMARY_JSON;
  const auditJsonPath = readArg("--audit") || DEFAULT_AUDIT_JSON;
  const closeoutMdPath = readArg("--closeout") || DEFAULT_CLOSEOUT_MD;
  const liveProofBacklogJsonPath = readArg("--live-proof-backlog") || DEFAULT_LIVE_PROOF_BACKLOG_JSON;
  const liveProofBacklogMdPath = readArg("--live-proof-backlog-md") || DEFAULT_LIVE_PROOF_BACKLOG_MD;
  const liveProofReconciliationJsonPath = readArg("--live-proof-reconciliation") || DEFAULT_LIVE_PROOF_RECONCILIATION_JSON;
  const liveProofReconciliationMdPath = readArg("--live-proof-reconciliation-md") || DEFAULT_LIVE_PROOF_RECONCILIATION_MD;
  const liveProofIntakeTemplateJsonPath = readArg("--live-proof-intake-template") || DEFAULT_LIVE_PROOF_INTAKE_TEMPLATE_JSON;
  const liveProofIntakeTemplateMdPath = readArg("--live-proof-intake-template-md") || DEFAULT_LIVE_PROOF_INTAKE_TEMPLATE_MD;
  const liveProofIntakeValidationJsonPath = readArg("--live-proof-intake-validation") || DEFAULT_LIVE_PROOF_INTAKE_VALIDATION_JSON;
  const liveProofIntakeValidationMdPath = readArg("--live-proof-intake-validation-md") || DEFAULT_LIVE_PROOF_INTAKE_VALIDATION_MD;
  const nextGoalQueueJsonPath = readArg("--next-goal-queue") || DEFAULT_NEXT_GOAL_QUEUE_JSON;
  const nextGoalQueueMdPath = readArg("--next-goal-queue-md") || DEFAULT_NEXT_GOAL_QUEUE_MD;
  const budgetDelegationPacketJsonPath = readArg("--budget-delegation-packet") || DEFAULT_BUDGET_DELEGATION_PACKET_JSON;
  const budgetDelegationPacketMdPath = readArg("--budget-delegation-packet-md") || DEFAULT_BUDGET_DELEGATION_PACKET_MD;
  const liveActionGateJsonPath = readArg("--live-action-gate") || DEFAULT_LIVE_ACTION_GATE_JSON;
  const liveActionGateMdPath = readArg("--live-action-gate-md") || DEFAULT_LIVE_ACTION_GATE_MD;
  const controlStatusJsonPath = readArg("--control-status") || DEFAULT_CONTROL_STATUS_JSON;
  const controlStatusMdPath = readArg("--control-status-md") || DEFAULT_CONTROL_STATUS_MD;
  const launchNowApprovalPacketJsonPath = readArg("--launch-now-approval-packet") || DEFAULT_LAUNCH_NOW_APPROVAL_PACKET_JSON;
  const launchNowApprovalPacketMdPath = readArg("--launch-now-approval-packet-md") || DEFAULT_LAUNCH_NOW_APPROVAL_PACKET_MD;
  const humanBlockerPacketJsonPath = readArg("--human-blocker-packet") || DEFAULT_HUMAN_BLOCKER_PACKET_JSON;
  const humanBlockerPacketMdPath = readArg("--human-blocker-packet-md") || DEFAULT_HUMAN_BLOCKER_PACKET_MD;
  const outDir = readArg("--out-dir") || DEFAULT_OUT_DIR;

  const config = yaml.load(fs.readFileSync(companyConfigPath, "utf8")) as PaperclipConfig;
  const controlRoomMap = fs.readFileSync(controlRoomMapPath, "utf8");
  const planDoc = fs.readFileSync(planDocPath, "utf8");
  const spendSourceRegistry = yaml.load(
    fs.readFileSync(spendSourcesPath, "utf8"),
  ) as SpendSourceRegistry;
  const outcomeSourceRegistry = yaml.load(
    fs.readFileSync(outcomeSourcesPath, "utf8"),
  ) as OutcomeSourceRegistry;
  const allocationPolicy = yaml.load(
    fs.readFileSync(allocationPolicyPath, "utf8"),
  ) as AllocationPolicy;
  const outcomeSnapshot = readJson<OutcomeSnapshot>(outcomeSnapshotPath);
  const spendSnapshot = readJson<SpendProofSnapshot>(spendSnapshotPath);
  const dynamicRecommendations = readJson<DynamicRecommendations>(dynamicRecommendationsPath);
  const dynamicVerification = readJson<DynamicVerification>(dynamicVerificationPath);
  const dynamicApprovalPacket = fs.readFileSync(dynamicApprovalPacketPath, "utf8");
  const dynamicProposedDiff = fs.readFileSync(dynamicProposedDiffPath, "utf8");
  const summary = readJson<BudgetSummary>(summaryJsonPath);
  const audit = readJson<CompletionAudit>(auditJsonPath);
  const closeoutMd = fs.readFileSync(closeoutMdPath, "utf8");
  const liveProofBacklog = readJson<LiveProofBacklog>(liveProofBacklogJsonPath);
  const liveProofBacklogMd = fs.readFileSync(liveProofBacklogMdPath, "utf8");
  const liveProofReconciliation = readJson<LiveProofReconciliation>(liveProofReconciliationJsonPath);
  const liveProofReconciliationMd = fs.readFileSync(liveProofReconciliationMdPath, "utf8");
  const liveProofIntakeTemplate = readJson<LiveProofIntakeTemplate>(liveProofIntakeTemplateJsonPath);
  const liveProofIntakeTemplateMd = fs.readFileSync(liveProofIntakeTemplateMdPath, "utf8");
  const liveProofIntakeValidation = readJson<LiveProofIntakeValidation>(liveProofIntakeValidationJsonPath);
  const liveProofIntakeValidationMd = fs.readFileSync(liveProofIntakeValidationMdPath, "utf8");
  const nextGoalQueue = readJson<NextGoalQueue>(nextGoalQueueJsonPath);
  const nextGoalQueueMd = fs.readFileSync(nextGoalQueueMdPath, "utf8");
  const budgetDelegationPacket = readJson<BudgetDelegationPacket>(budgetDelegationPacketJsonPath);
  const budgetDelegationPacketMd = fs.readFileSync(budgetDelegationPacketMdPath, "utf8");
  const liveActionGate = readJson<LiveActionGate>(liveActionGateJsonPath);
  const liveActionGateMd = fs.readFileSync(liveActionGateMdPath, "utf8");
  const controlStatus = readJson<BudgetControlStatus>(controlStatusJsonPath);
  const controlStatusMd = fs.readFileSync(controlStatusMdPath, "utf8");
  const launchNowApprovalPacket = readJson<LaunchNowApprovalPacket>(launchNowApprovalPacketJsonPath);
  const launchNowApprovalPacketMd = fs.readFileSync(launchNowApprovalPacketMdPath, "utf8");
  const humanBlockerPacket = readJson<HumanBlockerPacket>(humanBlockerPacketJsonPath);
  const humanBlockerPacketMd = fs.readFileSync(humanBlockerPacketMdPath, "utf8");
  const openAiProofSnapshot = readJson<SpendProofSnapshot>(liveProofBacklog.openai_api_guardrail.proof_path);
  const openAiProofSource = openAiProofSnapshot.sources?.find((source) => source.id === "openai_api_costs") ?? null;
  const latestOpenAiSource = spendSnapshot.sources?.find((source) => source.id === "openai_api_costs") ?? null;
  const latestCodexSource = spendSnapshot.sources?.find((source) => source.id === "codex_oauth_pro_seat") ?? null;
  const latestDeepSeekSource = spendSnapshot.sources?.find((source) => source.id === "deepseek_balance") ?? null;

  const declaredAgentBudgetUsd = sumBudgetCents(config) / 100;
  const routineCounts = countRoutines(config);
  const activeRoutines = routineCounts.active ?? 0;
  const pausedRoutines = routineCounts.paused ?? 0;
  const totalRoutines = activeRoutines + pausedRoutines;
  const ledgerTargetTotal = summary.budget_ledger.reduce(
    (sum, line) => sum + line.target_usd,
    0,
  );
  const targetByProofLevel = summary.budget_ledger.reduce<Record<string, number>>((totals, line) => {
    totals[line.proof_level] = (totals[line.proof_level] ?? 0) + line.target_usd;
    return totals;
  }, {});
  const spendSources = spendSourceRegistry.sources ?? [];
  const spendSourceTargetTotal = spendSources.reduce(
    (sum, source) => sum + (source.targetUsd ?? 0),
    0,
  );
  const targetByBudgetLine = spendSources.reduce<Map<string, number>>((totals, source) => {
    totals.set(source.budgetLine, (totals.get(source.budgetLine) ?? 0) + (source.targetUsd ?? 0));
    return totals;
  }, new Map<string, number>());
  const targetBySourceId = spendSources.reduce<Map<string, number>>((totals, source) => {
    totals.set(source.id, source.targetUsd ?? 0);
    return totals;
  }, new Map<string, number>());
  const summaryTargetByBudgetLine = summary.budget_ledger.reduce<Map<string, number>>((totals, line) => {
    totals.set(line.line, line.target_usd);
    return totals;
  }, new Map<string, number>());
  const backlogGaps = new Set(liveProofBacklog.remaining_items.map((item) => item.closeout_gap));
  const backlogItemsById = new Map(liveProofBacklog.remaining_items.map((item) => [item.id, item]));
  const reconciledItemsById = new Map(liveProofReconciliation.items.map((item) => [item.id, item]));
  const intakeTemplateItemsById = new Map(liveProofIntakeTemplate.items.map((item) => [item.id, item]));
  const intakeValidationItemsById = new Map(liveProofIntakeValidation.items.map((item) => [item.id, item]));
  const backlogBudgetLineTargets = liveProofBacklog.remaining_items.reduce<Map<string, number>>((totals, item) => {
    totals.set(item.budget_line, item.target_usd);
    return totals;
  }, new Map<string, number>());
  const openAiLedgerLine = summary.budget_ledger.find((line) => line.line === "OpenAI API costs (approval-only guardrail)") ?? null;
  const launchApprovalTargetUsd = summary.budget_ledger
    .filter((line) => line.target_usd > 0)
    .filter((line) => !line.line.includes("Paperclip agent/runtime"))
    .filter((line) => !line.line.includes("Codex OAuth"))
    .filter((line) => !line.line.includes("OpenAI API"))
    .reduce((sum, line) => sum + line.target_usd, 0);
  const launchApprovalItemTotalUsd = launchNowApprovalPacket.approval_items.reduce(
    (sum, item) => sum + item.max_usd,
    0,
  );
  const dynamicSpendAffectingRecommendations = dynamicRecommendations.recommendations.filter(
    (recommendation) => SPEND_AFFECTING_DYNAMIC_ACTIONS.has(recommendation.action),
  );
  const closedReconciliationItems = liveProofReconciliation.items.filter(
    (item) => item.reconciliation_status === "closed",
  );
  const partialReconciliationItems = liveProofReconciliation.items.filter(
    (item) => item.reconciliation_status === "partial_source_proof",
  );
  const openReconciliationItems = liveProofReconciliation.items.filter(
    (item) => item.reconciliation_status !== "closed",
  );
  const nextGoalCommands = nextGoalQueue.queue.map((item) => item.goal_command);
  const nextGoalLiveMutationAllowedItems = nextGoalQueue.queue.filter((item) => item.live_mutation_allowed);
  const delegationSpendWithoutApprovalItems = budgetDelegationPacket.work_orders.filter((item) => item.can_spend_without_human_approval);
  const delegationLiveMutationAllowedItems = budgetDelegationPacket.work_orders.filter((item) => item.live_mutation_allowed || item.can_mutate_live_systems);
  const delegationByBudgetLine = new Map(budgetDelegationPacket.budget_line_delegations.map((item) => [item.budget_line, item]));
  const delegationWorkOrdersByGoal = new Map(budgetDelegationPacket.work_orders.map((item) => [item.goal_command, item]));
  const liveActionGateChecksById = new Map(liveActionGate.checks.map((item) => [item.id, item]));

  const errors: string[] = [];
  const warnings: string[] = [];

  assertCondition(errors, summary.schema === "blueprint/autonomous-org-budget-summary/v1", "summary schema mismatch");
  assertCondition(errors, audit.schema === "blueprint/autonomous-org-budget-completion-audit/v1", "completion audit schema mismatch");
  assertCondition(errors, spendSourceRegistry.schema === "blueprint/autonomous-spend-sources/v1", "spend source registry schema mismatch");
  assertCondition(errors, outcomeSourceRegistry.schema === "blueprint/autonomous-outcome-sources/v1", "outcome source registry schema mismatch");
  assertCondition(errors, allocationPolicy.schema === "blueprint/dynamic-budget-allocation-policy/v1", "allocation policy schema mismatch");
  assertCondition(errors, outcomeSnapshot.schema === "blueprint/autonomous-outcome-snapshot/v1", "outcome snapshot schema mismatch");
  assertCondition(errors, spendSnapshot.schema === "blueprint/autonomous-spend-snapshot/v1", "spend snapshot schema mismatch");
  assertCondition(errors, dynamicRecommendations.schema === "blueprint/dynamic-budget-recommendations/v1", "dynamic recommendations schema mismatch");
  assertCondition(errors, dynamicVerification.schema === "blueprint/dynamic-budget-allocator-verification/v1", "dynamic verifier schema mismatch");
  assertCondition(errors, liveProofBacklog.schema === "blueprint/autonomous-budget-live-proof-backlog/v1", "live proof backlog schema mismatch");
  assertCondition(errors, liveProofReconciliation.schema === "blueprint/autonomous-budget-live-proof-reconciliation/v1", "live proof reconciliation schema mismatch");
  assertCondition(errors, liveProofIntakeTemplate.schema === "blueprint/autonomous-budget-live-proof-intake-template/v1", "live proof intake template schema mismatch");
  assertCondition(errors, liveProofIntakeValidation.schema === "blueprint/autonomous-budget-live-proof-intake-validation/v1", "live proof intake validation schema mismatch");
  assertCondition(errors, nextGoalQueue.schema === "blueprint/autonomous-budget-next-goal-queue/v1", "next goal queue schema mismatch");
  assertCondition(errors, budgetDelegationPacket.schema === "blueprint/autonomous-budget-delegation-packet/v1", "budget delegation packet schema mismatch");
  assertCondition(errors, liveActionGate.schema === "blueprint/autonomous-budget-live-action-gate/v1", "live action gate schema mismatch");
  assertCondition(errors, controlStatus.schema === "blueprint/autonomous-budget-control-status/v1", "budget control status schema mismatch");
  assertCondition(errors, launchNowApprovalPacket.schema === "blueprint/autonomous-budget-launch-now-approval-packet/v1", "launch-now approval packet schema mismatch");
  assertCondition(errors, humanBlockerPacket.schema === "blueprint/autonomous-org-budget-human-blocker-packet/v1", "human blocker packet schema mismatch");
  assertCondition(errors, spendSources.length > 0, "spend source registry must list sources");
  assertCondition(errors, (outcomeSourceRegistry.sources ?? []).length > 0, "outcome source registry must list sources");
  assertCondition(errors, summary.budget_cap_usd === 500, "summary budget cap must be $500");
  assertCondition(errors, summary.target_total_usd === 500, "summary target total must be $500");
  assertCondition(errors, allocationPolicy.budget_cap_usd === 500, "allocation policy budget cap must be $500");
  assertCondition(errors, allocationPolicy.paperclip_declared_subcap_usd === declaredAgentBudgetUsd, "allocation policy Paperclip subcap must match implemented $173 cap");
  assertCondition(errors, allocationPolicy.openai_api_target_usd === 0, "allocation policy must keep OpenAI API target at $0");
  assertCondition(errors, allocationPolicy.max_single_move_usd <= 40, "allocation policy max single move must stay at or below $40");
  assertCondition(errors, moneyEquals(ledgerTargetTotal, summary.target_total_usd), "budget ledger targets must sum to target_total_usd");
  assertCondition(errors, moneyEquals(spendSourceTargetTotal, summary.target_total_usd), "spend source targets must sum to summary target_total_usd");
  assertCondition(errors, moneyEquals(spendSourceTargetTotal, ledgerTargetTotal), "spend source targets must match budget ledger targets");
  for (const line of summary.budget_ledger) {
    assertCondition(
      errors,
      moneyEquals(targetByBudgetLine.get(line.line) ?? 0, line.target_usd),
      `spend source targets for "${line.line}" must match the summary budget ledger`,
    );
  }
  for (const source of spendSources) {
    if ((source.targetUsd ?? 0) > 0) {
      assertCondition(
        errors,
        summary.budget_ledger.some((line) => line.line === source.budgetLine),
        `positive spend source ${source.id} must map to a summary budget ledger line`,
      );
    }
  }
  assertCondition(errors, targetBySourceId.get("codex_oauth_pro_seat") === 0, "Codex OAuth / Pro subscription target must stay $0 and outside the $500 cap");
  assertCondition(errors, targetBySourceId.get("openai_api_costs") === 0, "OpenAI API costs target must stay $0 unless human-approved");
  assertCondition(errors, targetBySourceId.get("deepseek_balance") === 80, "DeepSeek direct model reserve target must remain $80 in the current $500 allocation");
  assertCondition(errors, dynamicRecommendations.budget_cap_usd === 500, "dynamic recommendations budget cap must be $500");
  assertCondition(errors, dynamicRecommendations.projected_target_total_usd <= 500, "dynamic projected total must stay under the $500 cap");
  assertCondition(errors, moneyEquals(dynamicRecommendations.projected_target_total_usd, 500), "dynamic projected total must preserve the $500 target envelope");
  assertCondition(errors, dynamicRecommendations.projected_budget_lines["OpenAI API costs (approval-only guardrail)"] === 0, "dynamic recommendations must keep OpenAI API target at $0");
  assertCondition(errors, dynamicRecommendations.projected_budget_lines["Paperclip agent/runtime envelope"] === declaredAgentBudgetUsd, "dynamic recommendations must preserve the implemented Paperclip envelope");
  assertCondition(errors, dynamicRecommendations.mode.repo_local_diff_only === true, "dynamic recommendations must remain repo-local diff only");
  assertCondition(errors, dynamicRecommendations.mode.live_mutation_attempted === false, "dynamic recommendations must not attempt live mutation");
  assertCondition(errors, outcomeSnapshot.mode.live_mutation_attempted === false, "outcome snapshot must not attempt live mutation");
  assertCondition(errors, spendSnapshot.mode?.live_read_enabled === true, "current spend snapshot must be the Keychain-backed read-only snapshot");
  assertCondition(errors, spendSnapshot.mode?.keychain_enabled === true, "current spend snapshot must use Keychain-backed credentials");
  assertCondition(errors, (spendSnapshot.mode?.keychain_loaded_env ?? []).length > 0, "current spend snapshot must record loaded Keychain env names without values");
  assertCondition(errors, spendSnapshot.mode?.live_mutation_attempted === false, "current spend snapshot must not attempt live mutation");
  assertCondition(errors, spendSnapshot.mode?.secrets_persisted === false, "current spend snapshot must not persist secrets");
  assertCondition(errors, spendSnapshot.totals?.target_usd === 500, "current spend snapshot target total must be $500");
  assertCondition(errors, (spendSnapshot.totals?.missing_or_unverified_target_usd ?? 0) <= 500, "current spend snapshot missing/unverified target must not exceed the $500 cap");
  assertCondition(errors, latestOpenAiSource?.status === "live_billing_verified", "current spend snapshot must live-verify OpenAI API Costs");
  assertCondition(errors, latestOpenAiSource?.proof_level === "live-billing", "current spend snapshot OpenAI API proof must be live-billing");
  assertCondition(errors, latestOpenAiSource?.target_usd === 0, "current spend snapshot OpenAI API target must remain $0");
  assertCondition(errors, latestOpenAiSource?.amount_usd_current_period === 0, "current spend snapshot OpenAI API current-period amount must be $0");
  assertCondition(errors, latestOpenAiSource?.live_read_attempted === true, "current spend snapshot OpenAI API source must use read-only live read");
  assertCondition(errors, latestOpenAiSource?.live_mutation_attempted === false, "current spend snapshot OpenAI API source must not mutate");
  assertCondition(errors, latestOpenAiSource?.error === null, "current spend snapshot OpenAI API source must not have a read error");
  assertCondition(errors, latestCodexSource?.status === "outside_budget_excluded", "current spend snapshot must exclude Codex OAuth/Pro from the budget");
  assertCondition(errors, latestCodexSource?.target_usd === 0, "current spend snapshot Codex OAuth/Pro target must be $0");
  assertCondition(errors, latestCodexSource?.live_mutation_attempted === false, "current spend snapshot Codex OAuth/Pro source must not mutate");
  assertCondition(errors, latestDeepSeekSource?.status === "live_credit_balance_verified", "current spend snapshot must read DeepSeek credit balance when credentials are present");
  assertCondition(errors, latestDeepSeekSource?.target_usd === 80, "current spend snapshot DeepSeek target must remain $80");
  assertCondition(errors, latestDeepSeekSource?.proof_level === "live-credit-balance", "current spend snapshot DeepSeek proof must remain credit-balance proof, not billing proof");
  assertCondition(errors, latestDeepSeekSource?.can_count_toward_budget_actuals !== true, "current spend snapshot DeepSeek credit balance must not count as budget actuals");
  assertCondition(errors, latestDeepSeekSource?.missing_to_verify?.includes("DeepSeek monthly usage or invoice export") === true, "current spend snapshot must keep DeepSeek usage/export as missing proof");
  assertCondition(errors, dynamicVerification.pass === true, "dynamic allocator verification must pass");
  assertCondition(errors, dynamicVerification.errors.length === 0, "dynamic allocator verification must have no errors");
  for (const recommendation of dynamicRecommendations.recommendations) {
    assertCondition(errors, recommendation.live_mutation_attempted === false, `${recommendation.id} must not attempt live mutation`);
    assertCondition(errors, recommendation.amount_usd <= allocationPolicy.max_single_move_usd, `${recommendation.id} must stay within max single move`);
    if (SPEND_AFFECTING_DYNAMIC_ACTIONS.has(recommendation.action)) {
      assertCondition(errors, recommendation.approval_required === true, `${recommendation.id} must require human approval`);
      assertCondition(errors, recommendation.evidence_refs.length > 0, `${recommendation.id} must cite evidence refs`);
      assertCondition(errors, !["missing", "stale", "fixture", "unsupported", "repo-local-config"].includes(recommendation.proof_level), `${recommendation.id} must not use weak proof for spend-affecting allocation`);
    }
  }
  assertCondition(errors, declaredAgentBudgetUsd === summary.paperclip_compression.declared_agent_budget_after_usd, "summary Paperclip budget must match .paperclip.yaml");
  assertCondition(errors, declaredAgentBudgetUsd === audit.current_state_evidence.paperclip_inventory_current.declared_monthly_agent_budget_usd, "audit Paperclip budget must match .paperclip.yaml");
  assertCondition(errors, declaredAgentBudgetUsd <= summary.paperclip_compression.declared_agent_budget_target_usd, "declared Paperclip budget must stay under its sub-budget target");
  assertCondition(errors, activeRoutines === summary.paperclip_compression.active_routines_after, "summary active routine count must match .paperclip.yaml");
  assertCondition(errors, activeRoutines === audit.current_state_evidence.paperclip_inventory_current.active_routines, "audit active routine count must match .paperclip.yaml");
  assertCondition(errors, pausedRoutines === summary.paperclip_compression.paused_routines_after, "summary paused routine count must match .paperclip.yaml");
  assertCondition(errors, pausedRoutines === audit.current_state_evidence.paperclip_inventory_current.paused_routines, "audit paused routine count must match .paperclip.yaml");
  assertCondition(errors, totalRoutines === summary.paperclip_compression.routines_total, "summary total routines must match .paperclip.yaml");
  assertCondition(errors, summary.proof_scope.repo_local_controls_implemented === true, "summary must mark repo-local controls implemented");
  assertCondition(errors, summary.proof_scope.live_billing_verified === false, "summary must not mark live billing verified");
  assertCondition(errors, summary.proof_scope.live_mutation_attempted === false, "summary must not mark live mutation attempted");
  assertCondition(errors, summary.proof_scope.operational_launch_ready_claimed === false, "summary must not claim Operational Launch Ready");
  assertCondition(errors, audit.live_mutation_attempted === false, "audit must not mark live mutation attempted");
  assertCondition(errors, audit.completion_summary.repo_local_budget_controls_complete === true, "audit must mark repo-local controls complete");
  assertCondition(errors, audit.completion_summary.live_billing_truth_complete === false, "audit must keep live billing truth incomplete");
  assertCondition(errors, audit.completion_summary.goal_can_be_marked_complete_without_billing_exports === false, "audit must not allow completion without billing exports");
  assertCondition(errors, summary.state_claimed === "awaiting_human_decision", "summary state must remain awaiting_human_decision");
  assertCondition(errors, audit.state_claimed_for_live_budget_truth === "awaiting_human_decision", "audit live budget state must remain awaiting_human_decision");
  assertCondition(errors, audit.current_state_evidence.paperclip_inventory_current.true_missing_desired_skills === 0, "audit must keep true missing desired skills at 0");
  assertCondition(errors, summary.completion_audit_path === auditJsonPath, "summary completion_audit_path must point at the checked audit path");
  assertCondition(errors, summary.live_proof_gaps.length > 0, "summary must list live proof gaps");
  assertCondition(errors, summary.live_proof_backlog_path === liveProofBacklogJsonPath, "summary live_proof_backlog_path must point at the checked backlog path");
  assertCondition(errors, summary.live_proof_reconciliation_path === liveProofReconciliationJsonPath, "summary live_proof_reconciliation_path must point at the checked reconciliation path");
  assertCondition(errors, summary.live_proof_intake_template_path === liveProofIntakeTemplateJsonPath, "summary live_proof_intake_template_path must point at the checked intake template path");
  assertCondition(errors, summary.live_proof_intake_validation_path === liveProofIntakeValidationJsonPath, "summary live_proof_intake_validation_path must point at the checked intake validation path");
  assertCondition(errors, summary.next_goal_queue_path === nextGoalQueueJsonPath, "summary next_goal_queue_path must point at the checked next-goal queue path");
  assertCondition(errors, summary.budget_delegation_packet_path === budgetDelegationPacketJsonPath, "summary budget_delegation_packet_path must point at the checked delegation packet path");
  assertCondition(errors, summary.live_action_gate_path === liveActionGateJsonPath, "summary live_action_gate_path must point at the checked live action gate path");
  assertCondition(errors, summary.control_status_path === controlStatusJsonPath, "summary control_status_path must point at the checked control status path");
  assertCondition(errors, summary.launch_now_approval_packet_path === launchNowApprovalPacketJsonPath, "summary launch_now_approval_packet_path must point at the checked launch approval path");
  assertCondition(errors, summary.human_blocker_packet_path === humanBlockerPacketJsonPath, "summary human_blocker_packet_path must point at the checked packet path");
  assertCondition(errors, launchNowApprovalPacket.state === "pending_human_signature", "launch-now approval packet must remain pending human signature");
  assertCondition(errors, launchNowApprovalPacket.approval_effective === false, "launch-now approval packet must not be effective by default");
  assertCondition(errors, launchNowApprovalPacket.no_live_mutation_attempted === true, "launch-now approval packet must not claim live mutation");
  assertCondition(errors, launchNowApprovalPacket.no_provider_calls_made === true, "launch-now approval packet must not make provider calls");
  assertCondition(errors, launchNowApprovalPacket.secrets_persisted === false, "launch-now approval packet must not persist secrets");
  assertCondition(errors, launchNowApprovalPacket.budget_cap_usd === summary.budget_cap_usd, "launch-now approval packet budget cap must match summary");
  assertCondition(errors, launchNowApprovalPacket.repo_local_paperclip_envelope_usd === declaredAgentBudgetUsd, "launch-now approval packet Paperclip envelope must match implemented budget");
  assertCondition(errors, moneyEquals(launchNowApprovalPacket.requested_live_spend_ceiling_usd, launchApprovalTargetUsd), "launch-now approval live ceiling must match eligible live launch/growth ledger targets");
  assertCondition(errors, moneyEquals(launchApprovalItemTotalUsd, launchNowApprovalPacket.requested_live_spend_ceiling_usd), "launch-now approval item totals must match requested live ceiling");
  assertCondition(errors, launchNowApprovalPacket.combined_budget_ceiling_usd === summary.budget_cap_usd, "launch-now approval combined ceiling must remain $500");
  assertCondition(errors, launchNowApprovalPacket.codex_oauth_pro_excluded_from_budget === true, "launch-now approval must exclude Codex OAuth/Pro from the $500 budget");
  assertCondition(errors, launchNowApprovalPacket.openai_api_target_usd === 0, "launch-now approval must keep OpenAI API target at $0");
  assertCondition(errors, launchNowApprovalPacket.control_status.can_mutate_live_spend === false, "launch-now approval control status must keep live spend blocked");
  assertCondition(errors, launchNowApprovalPacket.control_status.can_claim_live_budget_complete === false, "launch-now approval control status must not claim live billing complete");
  assertCondition(errors, launchNowApprovalPacket.control_status.can_claim_operational_launch_ready === false, "launch-now approval control status must not claim Operational Launch Ready");
  assertCondition(errors, launchNowApprovalPacket.approval_capture.human_approved === false, "launch-now approval capture must remain unset until exact approval is recorded");
  assertCondition(errors, launchNowApprovalPacket.exact_human_approval_text.includes("$327.00 in live launch/growth spend"), "launch-now approval text must include the $327 live ceiling");
  assertCondition(errors, launchNowApprovalPacket.exact_human_approval_text.includes("OpenAI API spend remains $0.00"), "launch-now approval text must keep OpenAI API spend at $0");
  assertCondition(errors, launchNowApprovalPacketMd.includes("Approval effective: no"), "launch-now approval markdown must show approval is not effective");
  assertCondition(errors, liveProofBacklog.state === "awaiting_human_decision", "live proof backlog state must remain awaiting_human_decision");
  assertCondition(errors, liveProofBacklog.blocker_id === "autonomous-org-budget-live-proof-20260601", "live proof backlog must keep the durable blocker id");
  assertCondition(errors, liveProofBacklog.no_live_mutation_attempted === true, "live proof backlog must not claim live mutation");
  assertCondition(errors, liveProofBacklog.codex_oauth_pro.target_usd === 0, "live proof backlog must keep Codex OAuth/Pro at $0");
  assertCondition(errors, liveProofBacklog.codex_oauth_pro.status === "outside_budget_excluded", "live proof backlog must keep Codex OAuth/Pro outside the budget");
  assertCondition(errors, liveProofBacklog.openai_api_guardrail.target_usd === 0, "live proof backlog must keep OpenAI API target at $0");
  assertCondition(errors, liveProofBacklog.openai_api_guardrail.current_usd === 0, "live proof backlog must keep current OpenAI API spend at $0");
  assertCondition(errors, liveProofBacklog.openai_api_guardrail.status === "live_verified_zero", "live proof backlog must preserve OpenAI API live-verified-zero proof");
  assertCondition(errors, fs.existsSync(liveProofBacklog.openai_api_guardrail.proof_path), "OpenAI API live-verified-zero proof path must exist");
  assertCondition(errors, openAiLedgerLine?.proof_source === liveProofBacklog.openai_api_guardrail.proof_path, "summary OpenAI API proof source must match live proof backlog proof path");
  assertCondition(errors, openAiLedgerLine?.target_usd === 0, "summary OpenAI API target must remain $0");
  assertCondition(errors, openAiLedgerLine?.current_usd === 0, "summary OpenAI API current spend must remain $0");
  assertCondition(errors, openAiProofSnapshot.schema === "blueprint/autonomous-spend-snapshot/v1", "OpenAI API proof snapshot schema mismatch");
  assertCondition(errors, openAiProofSnapshot.mode?.live_read_enabled === true, "OpenAI API proof snapshot must come from live-read mode");
  assertCondition(errors, openAiProofSnapshot.mode?.live_mutation_attempted === false, "OpenAI API proof snapshot must not attempt live mutation");
  assertCondition(errors, openAiProofSnapshot.mode?.secrets_persisted === false, "OpenAI API proof snapshot must not persist secrets");
  assertCondition(errors, Boolean(openAiProofSource), "OpenAI API proof snapshot must include openai_api_costs source");
  assertCondition(errors, openAiProofSource?.target_usd === 0, "OpenAI API proof source target must be $0");
  assertCondition(errors, openAiProofSource?.status === "live_billing_verified", "OpenAI API proof source must be live_billing_verified");
  assertCondition(errors, openAiProofSource?.proof_level === "live-billing", "OpenAI API proof source must be live-billing proof");
  assertCondition(errors, openAiProofSource?.amount_usd_current_period === 0, "OpenAI API proof source current-period amount must be $0");
  assertCondition(errors, openAiProofSource?.live_read_attempted === true, "OpenAI API proof source must attempt a read-only live read");
  assertCondition(errors, openAiProofSource?.live_mutation_attempted === false, "OpenAI API proof source must not attempt live mutation");
  assertCondition(errors, openAiProofSource?.error === null, "OpenAI API proof source must not have a read error");
  assertCondition(errors, liveProofBacklog.remaining_items.length === summary.live_proof_gaps.length, "live proof backlog items must match the number of summary live proof gaps");
  assertCondition(errors, summary.live_proof_gaps.every((gap) => backlogGaps.has(gap)), "every summary live proof gap must have a backlog item");
  assertCondition(
    errors,
    liveProofBacklog.remaining_items.every((item) => summary.live_proof_gaps.includes(item.closeout_gap)),
    "every backlog gap must be listed in the summary live proof gaps",
  );
  assertCondition(errors, !backlogBudgetLineTargets.has("Codex OAuth / Pro subscription seat"), "Codex OAuth/Pro must not appear as a remaining spend backlog item");
  assertCondition(errors, !backlogBudgetLineTargets.has("OpenAI API costs (approval-only guardrail)"), "OpenAI API costs must not appear as a remaining spend backlog item while target is $0");
  assertCondition(errors, liveProofBacklog.safe_resume_commands.includes("npm run autonomy:budget:verify"), "live proof backlog safe resume commands must include the verifier");
  assertCondition(errors, liveProofBacklog.source_snapshots.includes("output/autonomous-org/budget/spend-snapshots/keychain-live-read-2026-06-01/latest.json"), "live proof backlog must reference the keychain live-read snapshot");
  for (const sourceSnapshot of liveProofBacklog.source_snapshots) {
    assertCondition(errors, fs.existsSync(sourceSnapshot), `live proof backlog source snapshot missing: ${sourceSnapshot}`);
  }
  for (const backlogItem of liveProofBacklog.remaining_items) {
    assertCondition(errors, backlogItem.id.length > 0, "every live proof backlog item must have an id");
    assertCondition(errors, backlogItem.owner_system.length > 0, `${backlogItem.id} must name an owner system`);
    assertCondition(errors, backlogItem.status.length > 0, `${backlogItem.id} must name current proof status`);
    assertCondition(errors, backlogItem.currently_have.length > 0, `${backlogItem.id} must state currently available proof`);
    assertCondition(errors, backlogItem.proof_needed.length > 0, `${backlogItem.id} must state needed proof`);
    assertCondition(errors, backlogItem.safe_proof_command.length > 0, `${backlogItem.id} must provide a safe proof command`);
    assertCondition(errors, backlogItem.exact_input_needed.length > 0, `${backlogItem.id} must state exact needed input`);
    assertCondition(errors, backlogItem.disallowed_workaround.length > 0, `${backlogItem.id} must block unsafe workarounds`);
    assertCondition(errors, backlogItem.approval_required_before_live_spend_change === true, `${backlogItem.id} must require approval before spend changes`);
    assertCondition(errors, backlogItem.live_mutation_allowed === false, `${backlogItem.id} must not allow live mutation`);
    assertCondition(errors, summaryTargetByBudgetLine.has(backlogItem.budget_line), `${backlogItem.id} must map to a summary budget ledger line`);
    assertCondition(
      errors,
      moneyEquals(summaryTargetByBudgetLine.get(backlogItem.budget_line) ?? Number.NaN, backlogItem.target_usd),
      `${backlogItem.id} target must match the summary budget ledger`,
    );
  }
  assertCondition(errors, liveProofReconciliation.state === "awaiting_human_decision", "live proof reconciliation state must remain awaiting_human_decision");
  assertCondition(errors, liveProofReconciliation.blocker_id === liveProofBacklog.blocker_id, "live proof reconciliation blocker id must match backlog");
  assertCondition(errors, liveProofReconciliation.backlog_path === liveProofBacklogJsonPath, "live proof reconciliation must reference the checked backlog path");
  assertCondition(errors, liveProofReconciliation.spend_snapshot_path === spendSnapshotPath, "live proof reconciliation must reference the checked spend snapshot path");
  assertCondition(errors, liveProofReconciliation.no_live_provider_calls_made_by_reconciliation === true, "live proof reconciliation must not make provider calls");
  assertCondition(errors, liveProofReconciliation.no_live_mutation_attempted === true, "live proof reconciliation must not attempt live mutation");
  assertCondition(errors, liveProofReconciliation.secrets_persisted === false, "live proof reconciliation must not persist secrets");
  assertCondition(errors, liveProofReconciliation.all_live_mutation_allowed === false, "live proof reconciliation must not allow live mutation");
  assertCondition(errors, liveProofReconciliation.codex_oauth_pro.target_usd === 0, "live proof reconciliation must keep Codex OAuth/Pro at $0");
  assertCondition(errors, liveProofReconciliation.codex_oauth_pro.status === "outside_budget_excluded", "live proof reconciliation must keep Codex OAuth/Pro excluded");
  assertCondition(errors, liveProofReconciliation.codex_oauth_pro.excluded_from_500_budget === true, "live proof reconciliation must exclude Codex OAuth/Pro from the $500 budget");
  assertCondition(errors, liveProofReconciliation.openai_api_guardrail.target_usd === 0, "live proof reconciliation must keep OpenAI API target at $0");
  assertCondition(errors, liveProofReconciliation.openai_api_guardrail.current_usd === 0, "live proof reconciliation must keep OpenAI API current spend at $0");
  assertCondition(errors, liveProofReconciliation.openai_api_guardrail.verified_zero === true, "live proof reconciliation must preserve OpenAI API verified-zero guardrail");
  assertCondition(errors, liveProofReconciliation.openai_api_guardrail.latest_source_status === "live_billing_verified", "live proof reconciliation must use current OpenAI live-billing source status");
  assertCondition(errors, liveProofReconciliation.openai_api_guardrail.latest_source_proof_level === "live-billing", "live proof reconciliation must use current OpenAI live-billing proof level");
  assertCondition(errors, liveProofReconciliation.total_items === liveProofBacklog.remaining_items.length, "live proof reconciliation item count must match backlog");
  assertCondition(errors, liveProofReconciliation.closed_items === closedReconciliationItems.length, "live proof reconciliation closed count must match item statuses");
  assertCondition(errors, liveProofReconciliation.partial_items === partialReconciliationItems.length, "live proof reconciliation partial count must match item statuses");
  assertCondition(errors, liveProofReconciliation.open_items === openReconciliationItems.length, "live proof reconciliation open count must match non-closed statuses");
  assertCondition(errors, liveProofReconciliation.safe_resume_commands.includes("npm run autonomy:budget:live-proof:reconcile"), "live proof reconciliation safe resume commands must include itself");
  assertCondition(errors, liveProofReconciliation.safe_resume_commands.includes("npm run autonomy:budget:live-proof:template"), "live proof reconciliation safe resume commands must include intake template refresh");
  assertCondition(errors, liveProofReconciliation.safe_resume_commands.includes("npm run autonomy:budget:verify"), "live proof reconciliation safe resume commands must include the budget verifier");
  for (const backlogItem of liveProofBacklog.remaining_items) {
    const reconciledItem = reconciledItemsById.get(backlogItem.id);
    assertCondition(errors, Boolean(reconciledItem), `live proof reconciliation missing backlog item ${backlogItem.id}`);
    assertCondition(errors, reconciledItem?.safe_proof_command === backlogItem.safe_proof_command, `${backlogItem.id} reconciliation must preserve safe proof command`);
    assertCondition(errors, reconciledItem?.approval_required_before_live_spend_change === true, `${backlogItem.id} reconciliation must require approval before live spend change`);
    assertCondition(errors, reconciledItem?.live_mutation_allowed === false, `${backlogItem.id} reconciliation must not allow live mutation`);
    assertCondition(errors, reconciledItem?.source_evidence.every((source) => source.live_mutation_attempted === false) === true, `${backlogItem.id} source evidence must not include live mutation`);
    if (reconciledItem?.reconciliation_status === "closed") {
      assertCondition(errors, reconciledItem.missing_source_ids.length === 0, `${backlogItem.id} closed reconciliation must not have missing source ids`);
      assertCondition(errors, reconciledItem.source_evidence.every((source) => source.proof_status === "budget_actual"), `${backlogItem.id} closed reconciliation must have budget actual proof for every source`);
    }
  }
  assertCondition(
    errors,
    liveProofReconciliation.items.every((item) => backlogItemsById.has(item.id)),
    "every reconciliation item must map back to a live proof backlog item",
  );
  assertCondition(errors, liveProofReconciliationMd.includes("No live provider calls were made"), "live proof reconciliation markdown must state that it made no provider calls");
  assertCondition(errors, liveProofReconciliationMd.includes("Partial proof is not spend proof"), "live proof reconciliation markdown must preserve partial-proof boundary");
  assertCondition(errors, liveProofIntakeTemplate.state === "awaiting_human_decision", "live proof intake template state must remain awaiting_human_decision");
  assertCondition(errors, liveProofIntakeTemplate.blocker_id === liveProofBacklog.blocker_id, "live proof intake template blocker id must match backlog");
  assertCondition(errors, liveProofIntakeTemplate.backlog_path === liveProofBacklogJsonPath, "live proof intake template must reference checked backlog path");
  assertCondition(errors, liveProofIntakeTemplate.reconciliation_path === liveProofReconciliationJsonPath, "live proof intake template must reference checked reconciliation path");
  assertCondition(errors, liveProofIntakeTemplate.no_live_provider_calls_made === true, "live proof intake template must not make provider calls");
  assertCondition(errors, liveProofIntakeTemplate.no_live_mutation_attempted === true, "live proof intake template must not attempt live mutation");
  assertCondition(errors, liveProofIntakeTemplate.secrets_persisted === false, "live proof intake template must not persist secrets");
  assertCondition(errors, liveProofIntakeTemplate.codex_oauth_pro.target_usd === 0, "live proof intake template must keep Codex OAuth/Pro at $0");
  assertCondition(errors, liveProofIntakeTemplate.codex_oauth_pro.status === "outside_budget_excluded", "live proof intake template must keep Codex OAuth/Pro excluded");
  assertCondition(errors, liveProofIntakeTemplate.codex_oauth_pro.excluded_from_500_budget === true, "live proof intake template must exclude Codex OAuth/Pro from the $500 budget");
  assertCondition(errors, liveProofIntakeTemplate.openai_api_guardrail.target_usd === 0, "live proof intake template must keep OpenAI API target at $0");
  assertCondition(errors, liveProofIntakeTemplate.openai_api_guardrail.current_usd === 0, "live proof intake template must keep OpenAI API current spend at $0");
  assertCondition(errors, liveProofIntakeTemplate.openai_api_guardrail.status === "live_verified_zero", "live proof intake template must preserve OpenAI verified-zero guardrail");
  assertCondition(errors, liveProofIntakeTemplate.openai_api_guardrail.proof_path === liveProofBacklog.openai_api_guardrail.proof_path, "live proof intake template OpenAI proof path must match backlog");
  assertCondition(errors, liveProofIntakeTemplate.items.length === liveProofBacklog.remaining_items.length, "live proof intake template items must match backlog item count");
  assertCondition(errors, liveProofIntakeTemplate.accepted_artifact_types.includes("billing_export_json"), "live proof intake template must accept billing exports");
  assertCondition(errors, liveProofIntakeTemplate.accepted_artifact_types.includes("explicit_no_spend_confirmation"), "live proof intake template must accept explicit no-spend confirmations");
  for (const field of [
    "artifact_path",
    "artifact_type",
    "owner_system_account_label",
    "billing_period_start",
    "billing_period_end",
    "current_period_amount_usd",
    "currency",
    "source_system_generated_at",
    "human_confirmation",
  ]) {
    assertCondition(errors, liveProofIntakeTemplate.required_artifact_fields.includes(field), `live proof intake template must require ${field}`);
  }
  for (const backlogItem of liveProofBacklog.remaining_items) {
    const intakeItem = intakeTemplateItemsById.get(backlogItem.id);
    const reconciledItem = reconciledItemsById.get(backlogItem.id);
    assertCondition(errors, Boolean(intakeItem), `live proof intake template missing backlog item ${backlogItem.id}`);
    assertCondition(errors, intakeItem?.target_usd === backlogItem.target_usd, `${backlogItem.id} intake target must match backlog`);
    assertCondition(errors, intakeItem?.current_reconciliation_status === reconciledItem?.reconciliation_status, `${backlogItem.id} intake status must match reconciliation`);
    assertCondition(errors, intakeItem?.approval_required_before_live_spend_change === true, `${backlogItem.id} intake must require approval before live spend change`);
    assertCondition(errors, intakeItem?.live_mutation_allowed === false, `${backlogItem.id} intake must not allow live mutation`);
    assertCondition(errors, intakeItem?.artifact_intake_template.artifact_path === "", `${backlogItem.id} intake artifact path must be blank in the template`);
    assertCondition(errors, intakeItem?.artifact_intake_template.artifact_type === "", `${backlogItem.id} intake artifact type must be blank in the template`);
    assertCondition(errors, intakeItem?.artifact_intake_template.current_period_amount_usd === null, `${backlogItem.id} intake amount must be null in the template`);
    assertCondition(errors, intakeItem?.artifact_intake_template.human_confirmation.includes("does not authorize live mutation"), `${backlogItem.id} intake must include no-live-mutation confirmation`);
    assertCondition(errors, (intakeItem?.acceptance_criteria.length ?? 0) > 0, `${backlogItem.id} intake must include acceptance criteria`);
  }
  assertCondition(errors, liveProofIntakeTemplateMd.includes("does not verify spend by itself"), "live proof intake template markdown must state that the template is not spend proof");
  assertCondition(errors, liveProofIntakeTemplateMd.includes("Live spend movement still requires explicit human approval"), "live proof intake template markdown must preserve human approval gate");
  assertCondition(errors, liveProofIntakeValidation.state === "awaiting_human_decision", "live proof intake validation state must remain awaiting_human_decision");
  assertCondition(errors, liveProofIntakeValidation.blocker_id === liveProofBacklog.blocker_id, "live proof intake validation blocker id must match backlog");
  assertCondition(errors, liveProofIntakeValidation.template_path === liveProofIntakeTemplateJsonPath, "live proof intake validation must reference checked template path");
  assertCondition(errors, liveProofIntakeValidation.intake_path === liveProofIntakeTemplateJsonPath, "default live proof intake validation must validate the checked template path");
  assertCondition(errors, liveProofIntakeValidation.no_live_provider_calls_made === true, "live proof intake validation must not make provider calls");
  assertCondition(errors, liveProofIntakeValidation.no_live_mutation_attempted === true, "live proof intake validation must not attempt live mutation");
  assertCondition(errors, liveProofIntakeValidation.secrets_persisted === false, "live proof intake validation must not persist secrets");
  assertCondition(errors, liveProofIntakeValidation.command_passed === true, "live proof intake validation command must pass");
  assertCondition(errors, liveProofIntakeValidation.proof_ready_to_count_as_live_billing === false, "live proof intake validation must not count artifacts as live billing proof");
  assertCondition(errors, liveProofIntakeValidation.codex_oauth_pro.target_usd === 0, "live proof intake validation must keep Codex OAuth/Pro at $0");
  assertCondition(errors, liveProofIntakeValidation.codex_oauth_pro.status === "outside_budget_excluded", "live proof intake validation must keep Codex OAuth/Pro excluded");
  assertCondition(errors, liveProofIntakeValidation.codex_oauth_pro.excluded_from_500_budget === true, "live proof intake validation must exclude Codex OAuth/Pro from the $500 budget");
  assertCondition(errors, liveProofIntakeValidation.openai_api_guardrail.target_usd === 0, "live proof intake validation must keep OpenAI API target at $0");
  assertCondition(errors, liveProofIntakeValidation.openai_api_guardrail.current_usd === 0, "live proof intake validation must keep OpenAI API current spend at $0");
  assertCondition(errors, liveProofIntakeValidation.openai_api_guardrail.status === "live_verified_zero", "live proof intake validation must preserve OpenAI verified-zero guardrail");
  assertCondition(errors, liveProofIntakeValidation.totals.total_items === liveProofIntakeTemplate.items.length, "live proof intake validation total must match intake template item count");
  assertCondition(errors, liveProofIntakeValidation.totals.accepted_for_manual_review === liveProofIntakeValidation.items.filter((item) => item.validation_status === "accepted_for_manual_review").length, "live proof intake validation accepted count must match items");
  assertCondition(errors, liveProofIntakeValidation.totals.missing_submission === liveProofIntakeValidation.items.filter((item) => item.validation_status === "missing_submission").length, "live proof intake validation missing count must match items");
  assertCondition(errors, liveProofIntakeValidation.totals.rejected === liveProofIntakeValidation.items.filter((item) => item.validation_status === "rejected").length, "live proof intake validation rejected count must match items");
  assertCondition(errors, liveProofIntakeValidation.required_next_commands.includes("npm run autonomy:budget:live-proof:validate"), "live proof intake validation next commands must include itself");
  assertCondition(errors, liveProofIntakeValidation.required_next_commands.includes("npm run autonomy:budget:verify"), "live proof intake validation next commands must include the budget verifier");
  for (const intakeItem of liveProofIntakeTemplate.items) {
    const validationItem = intakeValidationItemsById.get(intakeItem.id);
    assertCondition(errors, Boolean(validationItem), `live proof intake validation missing template item ${intakeItem.id}`);
    assertCondition(errors, validationItem?.counts_as_live_billing_proof === false, `${intakeItem.id} validation item must not count as live billing proof`);
    assertCondition(errors, validationItem?.approval_required_before_live_spend_change === true, `${intakeItem.id} validation item must require approval before live spend change`);
    assertCondition(errors, validationItem?.live_mutation_allowed === false, `${intakeItem.id} validation item must not allow live mutation`);
  }
  assertCondition(errors, liveProofIntakeValidationMd.includes("does not count artifacts as live billing proof"), "live proof intake validation markdown must preserve no-count boundary");
  assertCondition(errors, liveProofIntakeValidationMd.includes("Accepted rows are only ready for manual review"), "live proof intake validation markdown must preserve manual-review boundary");
  assertCondition(errors, nextGoalQueue.state === "awaiting_human_decision", "next goal queue state must remain awaiting_human_decision");
  assertCondition(errors, nextGoalQueue.budget_cap_usd === 500, "next goal queue budget cap must be $500");
  assertCondition(errors, nextGoalQueue.paperclip_declared_envelope_usd === declaredAgentBudgetUsd, "next goal queue Paperclip envelope must match implemented budget");
  assertCondition(errors, nextGoalQueue.deepseek_direct_model_reserve_usd === 80, "next goal queue must preserve the DeepSeek direct model reserve");
  assertCondition(errors, nextGoalQueue.no_live_mutation_authorized === true, "next goal queue must not authorize live mutation");
  assertCondition(errors, nextGoalQueue.codex_oauth_pro_excluded_from_budget === true, "next goal queue must exclude Codex OAuth/Pro from the $500 budget");
  assertCondition(errors, nextGoalQueue.openai_api_target_usd === 0, "next goal queue must keep OpenAI API target at $0");
  assertCondition(errors, nextGoalQueue.queue.length === 5, "next goal queue must contain exactly five items");
  assertCondition(errors, summary.next_goal_queue.length === nextGoalQueue.queue.length, "summary next_goal_queue count must match the canonical queue artifact");
  assertCondition(errors, summary.next_goal_queue.every((goal, index) => goal === nextGoalCommands[index]), "summary next_goal_queue must match canonical queue commands in rank order");
  assertCondition(errors, nextGoalQueueMd.includes("Codex OAuth/Pro is excluded from the $500 budget"), "next goal queue markdown must preserve Codex OAuth/Pro exclusion");
  assertCondition(errors, nextGoalQueueMd.includes("OpenAI API target remains $0 unless explicitly approved"), "next goal queue markdown must preserve OpenAI API guardrail");
  assertCondition(errors, nextGoalQueueMd.includes("No live mutation is authorized"), "next goal queue markdown must block live mutation");
  for (const [index, item] of nextGoalQueue.queue.entries()) {
    assertCondition(errors, item.rank === index + 1, `next goal queue item ${item.goal_command} must have sequential rank`);
    assertCondition(errors, item.goal_command.startsWith("/goal "), `${item.goal_command} must start with /goal`);
    assertCondition(errors, item.lane.length > 0, `${item.goal_command} must name a lane`);
    assertCondition(errors, item.owner.length > 0, `${item.goal_command} must name an owner`);
    assertCondition(errors, item.safe_commands.length > 0, `${item.goal_command} must include safe commands`);
    assertCondition(errors, item.success_criteria.length > 0, `${item.goal_command} must include success criteria`);
    assertCondition(errors, item.blocked_claims.length > 0, `${item.goal_command} must include blocked claims`);
    assertCondition(errors, item.why_goal_is_appropriate.length > 0, `${item.goal_command} must explain why it is /goal-appropriate`);
    assertCondition(errors, item.requires_human_approval_before_live_action === true, `${item.goal_command} must require approval before live action`);
    assertCondition(errors, item.live_mutation_allowed === false, `${item.goal_command} must not allow live mutation`);
    assertCondition(errors, item.live_mutation_allowed_without_human_approval === false, `${item.goal_command} must not allow live mutation without approval`);
    assertCondition(errors, item.codex_oauth_pro_budget_treatment === "excluded_from_500_budget", `${item.goal_command} must preserve Codex OAuth/Pro exclusion`);
    assertCondition(errors, item.openai_api_budget_treatment === "target_zero_unless_approved", `${item.goal_command} must preserve OpenAI API $0 guardrail`);
  }
  assertCondition(errors, budgetDelegationPacket.state === "awaiting_human_decision", "budget delegation packet state must remain awaiting_human_decision");
  assertCondition(errors, budgetDelegationPacket.budget_cap_usd === 500, "budget delegation packet budget cap must be $500");
  assertCondition(errors, budgetDelegationPacket.target_total_usd === 500, "budget delegation packet target total must be $500");
  assertCondition(errors, budgetDelegationPacket.paperclip_declared_envelope_usd === declaredAgentBudgetUsd, "budget delegation packet Paperclip envelope must match implemented budget");
  assertCondition(errors, budgetDelegationPacket.active_routines === activeRoutines, "budget delegation packet active routine count must match .paperclip.yaml");
  assertCondition(errors, budgetDelegationPacket.paused_routines === pausedRoutines, "budget delegation packet paused routine count must match .paperclip.yaml");
  assertCondition(errors, budgetDelegationPacket.codex_oauth_pro_excluded_from_budget === true, "budget delegation packet must exclude Codex OAuth/Pro from the $500 budget");
  assertCondition(errors, budgetDelegationPacket.openai_api_target_usd === 0, "budget delegation packet must keep OpenAI API target at $0");
  assertCondition(errors, budgetDelegationPacket.no_live_mutation_authorized === true, "budget delegation packet must not authorize live mutation");
  assertCondition(errors, budgetDelegationPacket.live_billing_verified === false, "budget delegation packet must not mark live billing verified");
  assertCondition(errors, budgetDelegationPacket.allocator.recommendation_count === dynamicRecommendations.recommendations.length, "budget delegation packet recommendation count must match dynamic recommendations");
  assertCondition(errors, budgetDelegationPacket.allocator.spend_affecting_recommendation_count === dynamicSpendAffectingRecommendations.length, "budget delegation packet spend-affecting count must match dynamic recommendations");
  assertCondition(errors, budgetDelegationPacket.allocator.projected_target_total_usd === dynamicRecommendations.projected_target_total_usd, "budget delegation packet projected target total must match dynamic recommendations");
  assertCondition(errors, budgetDelegationPacket.allocator.human_approval_required === dynamicRecommendations.human_approval_required, "budget delegation packet approval flag must match dynamic recommendations");
  assertCondition(errors, budgetDelegationPacket.allocator.live_mutation_attempted === false, "budget delegation packet allocator state must not show live mutation");
  assertCondition(errors, budgetDelegationPacket.proof_gate.proof_ready_to_count_as_live_billing === liveProofIntakeValidation.proof_ready_to_count_as_live_billing, "budget delegation packet proof gate must match intake validation");
  assertCondition(errors, budgetDelegationPacket.proof_gate.total_items === liveProofIntakeValidation.totals.total_items, "budget delegation packet proof total must match intake validation");
  assertCondition(errors, budgetDelegationPacket.proof_gate.missing_submission === liveProofIntakeValidation.totals.missing_submission, "budget delegation packet missing proof count must match intake validation");
  assertCondition(errors, budgetDelegationPacket.budget_line_delegations.length === summary.budget_ledger.length, "budget delegation packet must include every budget ledger line");
  assertCondition(errors, budgetDelegationPacket.work_orders.length === nextGoalQueue.queue.length, "budget delegation packet work orders must match next-goal queue count");
  assertCondition(errors, delegationSpendWithoutApprovalItems.length === 0, "budget delegation packet must not allow spend without human approval");
  assertCondition(errors, delegationLiveMutationAllowedItems.length === 0, "budget delegation packet must not allow live mutation");
  assertCondition(errors, budgetDelegationPacket.live_delegation_blockers.length > 0, "budget delegation packet must list live delegation blockers while proof is incomplete");
  assertCondition(errors, budgetDelegationPacket.required_checks_before_any_live_action.includes("npm run autonomy:budget:control-suite"), "budget delegation packet must require the control suite before live action");
  assertCondition(errors, budgetDelegationPacket.required_checks_before_any_live_action.includes("npm run autonomy:budget:delegate"), "budget delegation packet must require delegation packet refresh before live action");
  assertCondition(errors, budgetDelegationPacket.required_checks_before_any_live_action.includes("npm run autonomy:budget:live-action-gate -- --require-live-action-ready"), "budget delegation packet must require strict live-action gate before live action");
  for (const line of summary.budget_ledger) {
    const delegatedLine = delegationByBudgetLine.get(line.line);
    assertCondition(errors, Boolean(delegatedLine), `budget delegation packet missing budget line ${line.line}`);
    assertCondition(errors, delegatedLine?.target_usd === line.target_usd, `${line.line} delegation target must match summary ledger`);
    assertCondition(errors, (delegatedLine?.required_before_spend.length ?? 0) > 0, `${line.line} delegation must include required_before_spend`);
    if (line.line === "Codex OAuth / Pro subscription seat") {
      assertCondition(errors, delegatedLine?.spend_release_status === "not_spendable", "Codex OAuth/Pro delegation must remain not spendable because it is excluded from the budget");
    }
    if (line.line === "OpenAI API costs (approval-only guardrail)") {
      assertCondition(errors, delegatedLine?.spend_release_status === "not_spendable", "OpenAI API delegation must remain not spendable without approval");
    }
  }
  for (const item of nextGoalQueue.queue) {
    const workOrder = delegationWorkOrdersByGoal.get(item.goal_command);
    assertCondition(errors, Boolean(workOrder), `budget delegation packet missing work order ${item.goal_command}`);
    assertCondition(errors, workOrder?.owner === item.owner, `${item.goal_command} work order owner must match next-goal queue`);
    assertCondition(errors, workOrder?.lane === item.lane, `${item.goal_command} work order lane must match next-goal queue`);
    assertCondition(errors, workOrder?.can_start_without_live_approval === true, `${item.goal_command} work order should allow safe local start`);
    assertCondition(errors, workOrder?.can_spend_without_human_approval === false, `${item.goal_command} work order must not allow spend without approval`);
    assertCondition(errors, workOrder?.can_mutate_live_systems === false, `${item.goal_command} work order must not allow live mutation`);
    assertCondition(errors, workOrder?.live_mutation_allowed === false, `${item.goal_command} work order must keep live mutation false`);
    assertCondition(errors, workOrder?.required_checks.includes("npm run autonomy:budget:verify") === true, `${item.goal_command} work order must include budget verifier`);
    assertCondition(errors, workOrder?.required_checks.includes("npm run autonomy:budget:control-suite") === true, `${item.goal_command} work order must include control suite`);
    assertCondition(errors, workOrder?.required_checks.includes("npm run autonomy:budget:live-action-gate -- --require-live-action-ready") === true, `${item.goal_command} work order must include strict live-action gate`);
  }
  assertCondition(errors, budgetDelegationPacketMd.includes("does not authorize live spend"), "budget delegation markdown must block live spend");
  assertCondition(errors, budgetDelegationPacketMd.includes("Required Checks Before Any Live Action"), "budget delegation markdown must list required live-action checks");
  assertCondition(errors, liveActionGate.state === "live_action_blocked", "live action gate must block live action while proof is incomplete");
  assertCondition(errors, liveActionGate.validation_pass === true, "live action gate validation must pass");
  assertCondition(errors, liveActionGate.live_action_allowed === false, "live action gate must not allow live action");
  assertCondition(errors, liveActionGate.repo_local_work_allowed === true, "live action gate must allow repo-local work");
  assertCondition(errors, liveActionGate.mode.no_live_provider_calls_made === true, "live action gate must not make provider calls");
  assertCondition(errors, liveActionGate.mode.no_live_mutation_attempted === true, "live action gate must not attempt live mutation");
  assertCondition(errors, liveActionGate.mode.secrets_persisted === false, "live action gate must not persist secrets");
  assertCondition(errors, liveActionGate.budget_cap_usd === 500, "live action gate budget cap must be $500");
  assertCondition(errors, liveActionGate.codex_oauth_pro_excluded_from_budget === true, "live action gate must exclude Codex OAuth/Pro from the $500 budget");
  assertCondition(errors, liveActionGate.openai_api_target_usd === 0, "live action gate must keep OpenAI API target at $0");
  assertCondition(errors, liveActionGate.blocker_count > 0, "live action gate must list blockers until live proof and approval are complete");
  assertCondition(errors, liveActionGate.error_count === 0, "live action gate must have no local-control errors");
  assertCondition(errors, liveActionGateChecksById.get("live_billing_verified")?.pass === false, "live action gate must require live billing verification");
  assertCondition(errors, liveActionGateChecksById.get("approval_artifact_required")?.pass === false, "live action gate must require explicit human approval before live action");
  assertCondition(errors, liveActionGate.required_before_live_action.includes("npm run autonomy:budget:control-suite"), "live action gate must require the control suite before live action");
  assertCondition(errors, liveActionGate.required_before_live_action.includes("npm run autonomy:budget:delegate"), "live action gate must require delegation packet refresh before live action");
  assertCondition(errors, liveActionGate.required_before_live_action.includes("npm run autonomy:budget:live-action-gate -- --require-live-action-ready"), "live action gate must require strict mode before live action");
  assertCondition(errors, liveActionGateMd.includes("Live action allowed: no"), "live action gate markdown must show live action blocked");
  assertCondition(errors, liveActionGateMd.includes("--require-live-action-ready"), "live action gate markdown must document strict fail-closed mode");
  assertCondition(errors, controlStatus.state === "repo_local_controls_ready_live_action_blocked", "budget control status must show repo-local controls ready and live action blocked");
  assertCondition(errors, controlStatus.validation_pass === true, "budget control status validation must pass");
  assertCondition(errors, controlStatus.budget_cap_usd === 500, "budget control status budget cap must be $500");
  assertCondition(errors, controlStatus.target_total_usd === 500, "budget control status target total must be $500");
  assertCondition(errors, controlStatus.can_allocate_repo_local === true, "budget control status must allow repo-local allocation work");
  assertCondition(errors, controlStatus.can_delegate_repo_local === true, "budget control status must allow repo-local delegation work");
  assertCondition(errors, controlStatus.can_mutate_live_spend === false, "budget control status must block live spend mutation");
  assertCondition(errors, controlStatus.can_claim_live_budget_complete === false, "budget control status must block live budget completion claims");
  assertCondition(errors, controlStatus.can_claim_operational_launch_ready === false, "budget control status must block Operational Launch Ready claims");
  assertCondition(errors, controlStatus.codex_oauth_pro_excluded_from_budget === true, "budget control status must exclude Codex OAuth/Pro from the $500 budget");
  assertCondition(errors, controlStatus.openai_api_target_usd === 0, "budget control status must keep OpenAI API target at $0");
  assertCondition(errors, controlStatus.paperclip_declared_envelope_usd === declaredAgentBudgetUsd, "budget control status Paperclip envelope must match .paperclip.yaml");
  assertCondition(errors, controlStatus.active_routines === activeRoutines, "budget control status active routine count must match .paperclip.yaml");
  assertCondition(errors, controlStatus.paused_routines === pausedRoutines, "budget control status paused routine count must match .paperclip.yaml");
  assertCondition(errors, controlStatus.next_goal_queue_items === nextGoalQueue.queue.length, "budget control status next-goal count must match queue");
  assertCondition(errors, controlStatus.delegation_work_orders === budgetDelegationPacket.work_orders.length, "budget control status work-order count must match delegation packet");
  assertCondition(errors, controlStatus.delegation_spend_without_approval_items === 0, "budget control status must show no spend-without-approval delegation items");
  assertCondition(errors, controlStatus.delegation_live_mutation_allowed_items === 0, "budget control status must show no live-mutation delegation items");
  assertCondition(errors, controlStatus.live_action_gate_blockers === liveActionGate.blocker_count, "budget control status blocker count must match live-action gate");
  assertCondition(errors, controlStatus.live_proof_gaps.length === summary.live_proof_gaps.length, "budget control status live proof gaps must match summary");
  assertCondition(errors, controlStatus.required_before_live_action.includes("npm run autonomy:budget:live-action-gate -- --require-live-action-ready"), "budget control status must require strict live-action gate before live action");
  assertCondition(errors, controlStatus.next_safe_agent_actions.includes("npm run autonomy:budget:control-suite"), "budget control status must list control suite as a next safe action");
  assertCondition(errors, controlStatus.next_safe_agent_actions.includes("npm run autonomy:budget:verify"), "budget control status must list verifier as a next safe action");
  assertCondition(errors, controlStatus.errors.length === 0, "budget control status must have no local-control errors");
  assertCondition(errors, controlStatus.blockers.length > 0, "budget control status must keep live-action blockers while proof is incomplete");
  assertCondition(errors, controlStatus.mode.no_live_provider_calls_made === true, "budget control status must not make provider calls");
  assertCondition(errors, controlStatus.mode.no_live_mutation_attempted === true, "budget control status must not attempt live mutation");
  assertCondition(errors, controlStatus.mode.secrets_persisted === false, "budget control status must not persist secrets");
  assertCondition(errors, controlStatusMd.includes("Repo-local allocation allowed: yes"), "budget control status markdown must answer repo-local allocation state");
  assertCondition(errors, controlStatusMd.includes("Live spend mutation allowed: no"), "budget control status markdown must answer live spend mutation state");
  assertCondition(errors, controlStatusMd.includes("Operational Launch Ready claim allowed: no"), "budget control status markdown must block Operational Launch Ready claims");
  assertCondition(errors, audit.current_state_evidence.live_proof_backlog?.result === "written", "audit must mark live proof backlog written");
  assertCondition(errors, audit.current_state_evidence.live_proof_backlog?.json_path === liveProofBacklogJsonPath, "audit must reference checked live proof backlog JSON");
  assertCondition(errors, audit.current_state_evidence.live_proof_backlog?.markdown_path === liveProofBacklogMdPath, "audit must reference checked live proof backlog markdown");
  assertCondition(errors, audit.current_state_evidence.live_proof_backlog?.blocker_id === liveProofBacklog.blocker_id, "audit live proof blocker id must match backlog");
  assertCondition(errors, audit.current_state_evidence.live_proof_backlog?.remaining_items === liveProofBacklog.remaining_items.length, "audit live proof backlog count must match backlog items");
  assertCondition(errors, audit.current_state_evidence.live_proof_backlog?.live_mutation_allowed === false, "audit live proof backlog must not allow live mutation");
  assertCondition(errors, audit.current_state_evidence.live_proof_reconciliation?.result === "written", "audit must mark live proof reconciliation written");
  assertCondition(errors, audit.current_state_evidence.live_proof_reconciliation?.json_path === liveProofReconciliationJsonPath, "audit must reference checked live proof reconciliation JSON");
  assertCondition(errors, audit.current_state_evidence.live_proof_reconciliation?.markdown_path === liveProofReconciliationMdPath, "audit must reference checked live proof reconciliation markdown");
  assertCondition(errors, audit.current_state_evidence.live_proof_reconciliation?.blocker_id === liveProofReconciliation.blocker_id, "audit reconciliation blocker id must match reconciliation");
  assertCondition(errors, audit.current_state_evidence.live_proof_reconciliation?.total_items === liveProofReconciliation.total_items, "audit reconciliation total count must match reconciliation");
  assertCondition(errors, audit.current_state_evidence.live_proof_reconciliation?.closed_items === liveProofReconciliation.closed_items, "audit reconciliation closed count must match reconciliation");
  assertCondition(errors, audit.current_state_evidence.live_proof_reconciliation?.partial_items === liveProofReconciliation.partial_items, "audit reconciliation partial count must match reconciliation");
  assertCondition(errors, audit.current_state_evidence.live_proof_reconciliation?.open_items === liveProofReconciliation.open_items, "audit reconciliation open count must match reconciliation");
  assertCondition(errors, audit.current_state_evidence.live_proof_reconciliation?.live_mutation_allowed === false, "audit live proof reconciliation must not allow live mutation");
  assertCondition(errors, audit.current_state_evidence.live_proof_intake_template?.result === "written", "audit must mark live proof intake template written");
  assertCondition(errors, audit.current_state_evidence.live_proof_intake_template?.json_path === liveProofIntakeTemplateJsonPath, "audit must reference checked live proof intake template JSON");
  assertCondition(errors, audit.current_state_evidence.live_proof_intake_template?.markdown_path === liveProofIntakeTemplateMdPath, "audit must reference checked live proof intake template markdown");
  assertCondition(errors, audit.current_state_evidence.live_proof_intake_template?.blocker_id === liveProofIntakeTemplate.blocker_id, "audit intake template blocker id must match template");
  assertCondition(errors, audit.current_state_evidence.live_proof_intake_template?.items === liveProofIntakeTemplate.items.length, "audit intake template item count must match template");
  assertCondition(errors, audit.current_state_evidence.live_proof_intake_template?.accepted_artifact_types === liveProofIntakeTemplate.accepted_artifact_types.length, "audit intake template artifact type count must match template");
  assertCondition(errors, audit.current_state_evidence.live_proof_intake_template?.live_mutation_allowed === false, "audit live proof intake template must not allow live mutation");
  assertCondition(errors, audit.current_state_evidence.live_proof_intake_validation?.result === "written", "audit must mark live proof intake validation written");
  assertCondition(errors, audit.current_state_evidence.live_proof_intake_validation?.json_path === liveProofIntakeValidationJsonPath, "audit must reference checked live proof intake validation JSON");
  assertCondition(errors, audit.current_state_evidence.live_proof_intake_validation?.markdown_path === liveProofIntakeValidationMdPath, "audit must reference checked live proof intake validation markdown");
  assertCondition(errors, audit.current_state_evidence.live_proof_intake_validation?.blocker_id === liveProofIntakeValidation.blocker_id, "audit intake validation blocker id must match validation");
  assertCondition(errors, audit.current_state_evidence.live_proof_intake_validation?.total_items === liveProofIntakeValidation.totals.total_items, "audit intake validation total count must match validation");
  assertCondition(errors, audit.current_state_evidence.live_proof_intake_validation?.accepted_for_manual_review === liveProofIntakeValidation.totals.accepted_for_manual_review, "audit intake validation accepted count must match validation");
  assertCondition(errors, audit.current_state_evidence.live_proof_intake_validation?.missing_submission === liveProofIntakeValidation.totals.missing_submission, "audit intake validation missing count must match validation");
  assertCondition(errors, audit.current_state_evidence.live_proof_intake_validation?.rejected === liveProofIntakeValidation.totals.rejected, "audit intake validation rejected count must match validation");
  assertCondition(errors, audit.current_state_evidence.live_proof_intake_validation?.proof_ready_to_count_as_live_billing === false, "audit intake validation must not count as live billing proof");
  assertCondition(errors, audit.current_state_evidence.live_proof_intake_validation?.live_mutation_allowed === false, "audit live proof intake validation must not allow live mutation");
  assertCondition(errors, audit.current_state_evidence.next_goal_queue?.result === "written", "audit must mark next goal queue written");
  assertCondition(errors, audit.current_state_evidence.next_goal_queue?.json_path === nextGoalQueueJsonPath, "audit must reference checked next goal queue JSON");
  assertCondition(errors, audit.current_state_evidence.next_goal_queue?.markdown_path === nextGoalQueueMdPath, "audit must reference checked next goal queue markdown");
  assertCondition(errors, audit.current_state_evidence.next_goal_queue?.items === nextGoalQueue.queue.length, "audit next goal queue count must match canonical queue");
  assertCondition(errors, audit.current_state_evidence.next_goal_queue?.live_mutation_allowed === false, "audit next goal queue must not allow live mutation");
  assertCondition(errors, audit.current_state_evidence.next_goal_queue?.codex_oauth_pro_excluded_from_budget === true, "audit next goal queue must preserve Codex OAuth/Pro exclusion");
  assertCondition(errors, audit.current_state_evidence.next_goal_queue?.openai_api_target_usd === 0, "audit next goal queue must preserve OpenAI API $0 guardrail");
  assertCondition(errors, audit.current_state_evidence.budget_delegation_packet?.result === "written", "audit must mark budget delegation packet written");
  assertCondition(errors, audit.current_state_evidence.budget_delegation_packet?.json_path === budgetDelegationPacketJsonPath, "audit must reference checked budget delegation packet JSON");
  assertCondition(errors, audit.current_state_evidence.budget_delegation_packet?.markdown_path === budgetDelegationPacketMdPath, "audit must reference checked budget delegation packet markdown");
  assertCondition(errors, audit.current_state_evidence.budget_delegation_packet?.work_orders === budgetDelegationPacket.work_orders.length, "audit budget delegation work order count must match packet");
  assertCondition(errors, audit.current_state_evidence.budget_delegation_packet?.budget_line_delegations === budgetDelegationPacket.budget_line_delegations.length, "audit budget line delegation count must match packet");
  assertCondition(errors, audit.current_state_evidence.budget_delegation_packet?.live_mutation_allowed === false, "audit budget delegation packet must not allow live mutation");
  assertCondition(errors, audit.current_state_evidence.budget_delegation_packet?.can_spend_without_human_approval === false, "audit budget delegation packet must not allow spend without approval");
  assertCondition(errors, audit.current_state_evidence.live_action_gate?.result === "written", "audit must mark live action gate written");
  assertCondition(errors, audit.current_state_evidence.live_action_gate?.json_path === liveActionGateJsonPath, "audit must reference checked live action gate JSON");
  assertCondition(errors, audit.current_state_evidence.live_action_gate?.markdown_path === liveActionGateMdPath, "audit must reference checked live action gate markdown");
  assertCondition(errors, audit.current_state_evidence.live_action_gate?.state === liveActionGate.state, "audit live action gate state must match canonical gate");
  assertCondition(errors, audit.current_state_evidence.live_action_gate?.validation_pass === liveActionGate.validation_pass, "audit live action gate validation state must match canonical gate");
  assertCondition(errors, audit.current_state_evidence.live_action_gate?.live_action_allowed === liveActionGate.live_action_allowed, "audit live action gate live-action state must match canonical gate");
  assertCondition(errors, audit.current_state_evidence.live_action_gate?.repo_local_work_allowed === liveActionGate.repo_local_work_allowed, "audit live action gate repo-local state must match canonical gate");
  assertCondition(errors, audit.current_state_evidence.live_action_gate?.blocker_count === liveActionGate.blocker_count, "audit live action gate blocker count must match canonical gate");
  assertCondition(errors, audit.current_state_evidence.live_action_gate?.error_count === liveActionGate.error_count, "audit live action gate error count must match canonical gate");
  assertCondition(errors, audit.current_state_evidence.budget_control_status?.result === "written", "audit must mark budget control status written");
  assertCondition(errors, audit.current_state_evidence.budget_control_status?.json_path === controlStatusJsonPath, "audit must reference checked budget control status JSON");
  assertCondition(errors, audit.current_state_evidence.budget_control_status?.markdown_path === controlStatusMdPath, "audit must reference checked budget control status markdown");
  assertCondition(errors, audit.current_state_evidence.budget_control_status?.state === controlStatus.state, "audit budget control status state must match canonical status");
  assertCondition(errors, audit.current_state_evidence.budget_control_status?.validation_pass === controlStatus.validation_pass, "audit budget control status validation must match canonical status");
  assertCondition(errors, audit.current_state_evidence.budget_control_status?.can_allocate_repo_local === controlStatus.can_allocate_repo_local, "audit budget control status repo-local allocation state must match canonical status");
  assertCondition(errors, audit.current_state_evidence.budget_control_status?.can_delegate_repo_local === controlStatus.can_delegate_repo_local, "audit budget control status delegation state must match canonical status");
  assertCondition(errors, audit.current_state_evidence.budget_control_status?.can_mutate_live_spend === controlStatus.can_mutate_live_spend, "audit budget control status live-spend state must match canonical status");
  assertCondition(errors, audit.current_state_evidence.budget_control_status?.can_claim_live_budget_complete === controlStatus.can_claim_live_budget_complete, "audit budget control status live-budget claim state must match canonical status");
  assertCondition(errors, audit.current_state_evidence.budget_control_status?.live_action_gate_blockers === controlStatus.live_action_gate_blockers, "audit budget control status blocker count must match canonical status");
  assertCondition(errors, audit.current_state_evidence.launch_now_approval_packet?.result === "written", "audit must mark launch-now approval packet written");
  assertCondition(errors, audit.current_state_evidence.launch_now_approval_packet?.json_path === launchNowApprovalPacketJsonPath, "audit must reference checked launch-now approval packet JSON");
  assertCondition(errors, audit.current_state_evidence.launch_now_approval_packet?.markdown_path === launchNowApprovalPacketMdPath, "audit must reference checked launch-now approval packet markdown");
  assertCondition(errors, audit.current_state_evidence.launch_now_approval_packet?.state === launchNowApprovalPacket.state, "audit launch-now approval state must match canonical packet");
  assertCondition(errors, audit.current_state_evidence.launch_now_approval_packet?.approval_effective === launchNowApprovalPacket.approval_effective, "audit launch-now approval effective flag must match canonical packet");
  assertCondition(errors, audit.current_state_evidence.launch_now_approval_packet?.requested_live_spend_ceiling_usd === launchNowApprovalPacket.requested_live_spend_ceiling_usd, "audit launch-now approval live ceiling must match canonical packet");
  assertCondition(errors, audit.current_state_evidence.launch_now_approval_packet?.repo_local_paperclip_envelope_usd === launchNowApprovalPacket.repo_local_paperclip_envelope_usd, "audit launch-now approval Paperclip envelope must match canonical packet");
  assertCondition(errors, audit.current_state_evidence.launch_now_approval_packet?.combined_budget_ceiling_usd === launchNowApprovalPacket.combined_budget_ceiling_usd, "audit launch-now approval combined ceiling must match canonical packet");
  assertCondition(errors, audit.current_state_evidence.launch_now_approval_packet?.openai_api_target_usd === launchNowApprovalPacket.openai_api_target_usd, "audit launch-now approval OpenAI target must match canonical packet");
  assertCondition(errors, audit.current_state_evidence.launch_now_approval_packet?.codex_oauth_pro_excluded_from_budget === launchNowApprovalPacket.codex_oauth_pro_excluded_from_budget, "audit launch-now approval Codex exclusion must match canonical packet");
  assertCondition(errors, audit.current_state_evidence.launch_now_approval_packet?.live_mutation_allowed === false, "audit launch-now approval packet must not allow live mutation");
  assertCondition(errors, audit.current_state_evidence.control_suite?.command_count === 17, "audit control suite command count must include launch approval generation and tests");
  assertCondition(errors, audit.current_state_evidence.control_suite?.passed_count === 17, "audit control suite passed count must include launch approval generation and tests");
  assertCondition(errors, audit.current_state_evidence.control_suite?.failed_count === 0, "audit control suite failed count must remain zero");
  assertCondition(errors, humanBlockerPacket.state === "awaiting_human_decision", "human blocker packet state must remain awaiting_human_decision");
  assertCondition(errors, humanBlockerPacket.blocker_id === liveProofBacklog.blocker_id, "human blocker packet blocker id must match live proof backlog");
  assertCondition(errors, humanBlockerPacket.routing_surface === "repo-local no-send packet", "human blocker packet must remain repo-local no-send");
  assertCondition(errors, humanBlockerPacket.evidence.includes(liveProofBacklogJsonPath), "human blocker packet must cite the live proof backlog");
  assertCondition(errors, humanBlockerPacket.evidence.includes(liveProofReconciliationJsonPath), "human blocker packet must cite the live proof reconciliation");
  assertCondition(errors, humanBlockerPacket.evidence.includes(liveProofIntakeTemplateJsonPath), "human blocker packet must cite the live proof intake template");
  assertCondition(errors, humanBlockerPacket.evidence.includes(liveProofIntakeValidationJsonPath), "human blocker packet must cite the live proof intake validation");
  assertCondition(errors, humanBlockerPacket.evidence.includes(spendSnapshotPath), "human blocker packet must cite the current spend snapshot");
  assertCondition(errors, humanBlockerPacket.evidence.includes(liveProofBacklog.openai_api_guardrail.proof_path), "human blocker packet must cite the dated OpenAI proof snapshot");
  assertCondition(errors, humanBlockerPacket.safe_resume_commands.includes("npm run autonomy:budget:live-proof:reconcile"), "human blocker packet safe resume commands must include live-proof reconciliation");
  assertCondition(errors, humanBlockerPacket.safe_resume_commands.includes("npm run autonomy:budget:live-proof:template"), "human blocker packet safe resume commands must include live-proof intake template refresh");
  assertCondition(errors, humanBlockerPacket.safe_resume_commands.includes("npm run autonomy:budget:live-proof:validate"), "human blocker packet safe resume commands must include live-proof intake validation");
  assertCondition(errors, humanBlockerPacket.safe_resume_commands.includes("npm run autonomy:budget:verify"), "human blocker packet safe resume commands must include the budget verifier");
  assertCondition(errors, humanBlockerPacket.recommended_answer.includes("Codex OAuth/Pro outside the $500 budget"), "human blocker packet must preserve Codex OAuth/Pro exclusion");
  assertCondition(errors, humanBlockerPacket.recommended_answer.includes("OpenAI API spend at $0"), "human blocker packet must preserve OpenAI API $0 guardrail");
  assertCondition(errors, humanBlockerPacket.exact_response_needed.includes("owner-system billing/export proof"), "human blocker packet must ask for owner-system proof");
  assertCondition(errors, humanBlockerPacket.non_scope.some((entry) => entry.includes("Does not authorize live spend movement")), "human blocker packet must block live spend movement");
  assertCondition(errors, humanBlockerPacket.non_scope.some((entry) => entry.includes("Does not count Codex OAuth/Pro")), "human blocker packet must keep Codex outside the cap");
  assertCondition(errors, humanBlockerPacket.non_scope.some((entry) => entry.includes("OpenAI API spend above $0")), "human blocker packet must block OpenAI API spend above $0");
  assertCondition(errors, humanBlockerPacket.disallowed_workarounds.some((entry) => entry.includes("credit balances")), "human blocker packet must block credit-balance-as-spend workaround");
  assertCondition(errors, humanBlockerPacket.disallowed_workarounds.some((entry) => entry.includes("live sends")), "human blocker packet must block live sends and live mutations");
  assertCondition(errors, audit.current_state_evidence.human_blocker_packet?.result === "written", "audit must mark human blocker packet written");
  assertCondition(errors, audit.current_state_evidence.human_blocker_packet?.json_path === humanBlockerPacketJsonPath, "audit must reference checked human blocker packet JSON");
  assertCondition(errors, audit.current_state_evidence.human_blocker_packet?.markdown_path === humanBlockerPacketMdPath, "audit must reference checked human blocker packet markdown");
  assertCondition(errors, audit.current_state_evidence.human_blocker_packet?.blocker_id === humanBlockerPacket.blocker_id, "audit human blocker id must match packet");
  assertCondition(errors, audit.current_state_evidence.human_blocker_packet?.routing_surface === humanBlockerPacket.routing_surface, "audit human blocker routing surface must match packet");
  assertCondition(errors, audit.current_state_evidence.human_blocker_packet?.live_mutation_allowed === false, "audit human blocker packet must not allow live mutation");
  assertCondition(errors, audit.current_state_evidence.spend_observability_current?.result === "passed", "audit must mark spend observability passed");
  assertCondition(errors, audit.current_state_evidence.spend_observability_current?.default_snapshot_path === spendSnapshotPath, "audit must reference checked current spend snapshot");
  assertCondition(errors, audit.current_state_evidence.spend_observability_current?.dated_live_read_snapshot_path === liveProofBacklog.openai_api_guardrail.proof_path, "audit must reference checked dated live-read spend snapshot");
  assertCondition(errors, audit.current_state_evidence.spend_observability_current?.openai_api_costs_current_usd === 0, "audit must preserve OpenAI API current spend at $0");
  assertCondition(errors, audit.current_state_evidence.spend_observability_current?.openai_api_costs_status === "live_billing_verified", "audit must mark OpenAI API Costs live_billing_verified");
  assertCondition(errors, audit.current_state_evidence.spend_observability_current?.codex_oauth_pro_status === "outside_budget_excluded", "audit must preserve Codex OAuth/Pro exclusion");
  assertCondition(errors, audit.current_state_evidence.spend_observability_current?.live_billing_truth_complete === false, "audit must keep overall live billing truth incomplete");
  assertCondition(errors, audit.current_state_evidence.spend_observability_current?.live_mutation_attempted === false, "audit spend observability must not attempt live mutation");
  assertCondition(errors, audit.current_state_evidence.spend_observability_current?.secrets_persisted === false, "audit spend observability must not persist secrets");
  assertCondition(errors, planDoc.includes("## Budget Ledger"), "plan doc must include a Budget Ledger section");
  assertCondition(errors, planDoc.includes("## Repo Spend-Control Surfaces Inspected"), "plan doc must include inspected spend-control surfaces");
  assertCondition(errors, planDoc.includes("## Routine Classification"), "plan doc must include routine classification");
  assertCondition(errors, planDoc.includes("## Model Ladder"), "plan doc must include model ladder");
  assertCondition(errors, planDoc.includes("## Dynamic Allocation Loop"), "plan doc must include dynamic allocation loop");
  assertCondition(errors, planDoc.includes("## Next 5 `/goal` Queue"), "plan doc must include the next 5 goal queue");
  assertCondition(errors, planDoc.includes(liveProofBacklogJsonPath), "plan doc must reference the live proof backlog");
  assertCondition(errors, planDoc.includes(liveProofReconciliationJsonPath), "plan doc must reference the live proof reconciliation");
  assertCondition(errors, planDoc.includes(liveProofIntakeTemplateJsonPath), "plan doc must reference the live proof intake template");
  assertCondition(errors, planDoc.includes(liveProofIntakeValidationJsonPath), "plan doc must reference the live proof intake validation");
  assertCondition(errors, planDoc.includes(nextGoalQueueJsonPath), "plan doc must reference the next goal queue artifact");
  assertCondition(errors, planDoc.includes(budgetDelegationPacketJsonPath), "plan doc must reference the budget delegation packet artifact");
  assertCondition(errors, planDoc.includes(liveActionGateJsonPath), "plan doc must reference the live action gate artifact");
  assertCondition(errors, planDoc.includes(controlStatusJsonPath), "plan doc must reference the budget control status artifact");
  assertCondition(errors, planDoc.includes(launchNowApprovalPacketJsonPath), "plan doc must reference the launch-now approval packet artifact");
  assertCondition(errors, planDoc.includes(humanBlockerPacketJsonPath), "plan doc must reference the human blocker packet");
  assertCondition(errors, planDoc.includes("State claimed for live budget truth: `awaiting_human_decision`"), "plan doc must keep live budget state human-gated");
  assertCondition(errors, planDoc.includes("Codex Pro/OAuth is treated as pre-existing tooling outside the $500 launch/growth cash envelope"), "plan doc must exclude Codex Pro/OAuth from the $500 cash envelope");
  assertCondition(errors, planDoc.includes("Keep OpenAI API model spend at `$0.00` unless a human explicitly approves it"), "plan doc must keep OpenAI API spend at $0 unless human-approved");
  assertCondition(errors, summary.live_proof_gaps.every((gap) => !gap.toLowerCase().includes("codex")), "live proof gaps must not require Codex Pro/OAuth billing proof for the $500 cap");
  assertCondition(errors, controlRoomMap.includes("| Declared monthly agent budget | $173.00 |"), "control-room map must reflect $173 declared budget");
  assertCondition(errors, controlRoomMap.includes("| Active routines | 26 |"), "control-room map must reflect 26 active routines");
  assertCondition(errors, controlRoomMap.includes("| Paused routines | 36 |"), "control-room map must reflect 36 paused routines");
  assertCondition(errors, Array.isArray(summary.repo_spend_control_surfaces), "summary must list repo spend-control surfaces");
  assertCondition(errors, summary.repo_spend_control_surfaces.length === EXPECTED_SPEND_CONTROL_SURFACES.length, "summary must list all expected repo spend-control surfaces");
  assertCondition(errors, audit.current_state_evidence.repo_spend_control_surfaces?.result === "inspected", "audit must mark repo spend-control surfaces inspected");
  assertCondition(errors, audit.current_state_evidence.repo_spend_control_surfaces?.live_money_status === "disabled or fail-closed", "audit must keep spend-control live money disabled or fail-closed");
  assertCondition(errors, fs.existsSync(dynamicApprovalPacketPath), "dynamic human approval packet must exist");
  assertCondition(errors, fs.existsSync(dynamicProposedDiffPath), "dynamic proposed repo-local diff artifact must exist");
  assertCondition(errors, includesEvery(dynamicApprovalPacket, [
    "No live spend was moved.",
    "No ads were created or launched.",
    "No sends were made.",
    "No provider jobs were started.",
    "No Stripe, Render, Firebase, Notion, or Paperclip production state was mutated.",
  ]), "dynamic approval packet must include hard no-live-mutation boundaries");
  assertCondition(errors, dynamicProposedDiff.includes("No repo-local budget diff proposed.") || dynamicProposedDiff.includes("Proposed repo-local budget target changes."), "dynamic proposed diff artifact must state whether a diff is proposed");
  assertCondition(errors, audit.current_state_evidence.dynamic_allocation_loop?.result === "passed", "audit must mark dynamic allocation loop passed");
  assertCondition(errors, audit.current_state_evidence.dynamic_allocation_loop?.live_mutation_attempted === false, "audit dynamic allocation loop must not attempt live mutation");
  assertCondition(errors, closeoutMd.includes("State: `awaiting_human_decision`"), "closeout must keep awaiting_human_decision state");
  assertCondition(errors, closeoutMd.includes("Blocker id: `autonomous-org-budget-live-proof-20260601`"), "closeout must include durable blocker id");
  assertCondition(errors, closeoutMd.includes("Codex OAuth/Pro"), "closeout must preserve Codex OAuth/Pro budget exclusion");
  assertCondition(errors, closeoutMd.includes(liveProofBacklogJsonPath), "closeout must reference the live proof backlog JSON");
  assertCondition(errors, closeoutMd.includes(liveProofReconciliationJsonPath), "closeout must reference the live proof reconciliation JSON");
  assertCondition(errors, closeoutMd.includes(liveProofIntakeTemplateJsonPath), "closeout must reference the live proof intake template JSON");
  assertCondition(errors, closeoutMd.includes(liveProofIntakeValidationJsonPath), "closeout must reference the live proof intake validation JSON");
  assertCondition(errors, closeoutMd.includes(nextGoalQueueJsonPath), "closeout must reference the next goal queue JSON");
  assertCondition(errors, closeoutMd.includes(budgetDelegationPacketJsonPath), "closeout must reference the budget delegation packet JSON");
  assertCondition(errors, closeoutMd.includes(liveActionGateJsonPath), "closeout must reference the live action gate JSON");
  assertCondition(errors, closeoutMd.includes(controlStatusJsonPath), "closeout must reference the budget control status JSON");
  assertCondition(errors, closeoutMd.includes(launchNowApprovalPacketJsonPath), "closeout must reference the launch-now approval packet JSON");
  assertCondition(errors, closeoutMd.includes(humanBlockerPacketJsonPath), "closeout must reference the human blocker packet JSON");
  assertCondition(errors, closeoutMd.includes("This packet does not claim Operational Launch Ready"), "closeout must reject Operational Launch Ready claim");
  assertCondition(errors, liveProofBacklogMd.includes("State: `awaiting_human_decision`"), "live proof backlog markdown must keep awaiting_human_decision state");
  assertCondition(errors, liveProofBacklogMd.includes("Blocker id: `autonomous-org-budget-live-proof-20260601`"), "live proof backlog markdown must include durable blocker id");
  assertCondition(errors, liveProofBacklogMd.includes("Do not count Codex OAuth/Pro subscription usage against the `$500` budget."), "live proof backlog markdown must exclude Codex OAuth/Pro from the $500 budget");
  assertCondition(errors, liveProofBacklogMd.includes("Do not run live sends, ads, provider jobs"), "live proof backlog markdown must block live mutation workarounds");
  assertCondition(errors, humanBlockerPacketMd.includes("## 1. Blocker Title"), "human blocker markdown must follow required field order");
  assertCondition(errors, humanBlockerPacketMd.includes("## 1a. Blocker Id"), "human blocker markdown must include blocker id field");
  assertCondition(errors, humanBlockerPacketMd.includes("## 6. Exact Response Needed"), "human blocker markdown must include exact response field");
  assertCondition(errors, humanBlockerPacketMd.includes("## 11. Non-Scope"), "human blocker markdown must include non-scope field");
  assertCondition(errors, humanBlockerPacketMd.includes("repo-local no-send packet"), "human blocker markdown must remain no-send");
  for (const spendControlPath of EXPECTED_SPEND_CONTROL_SURFACES) {
    const summaryEntry = summary.repo_spend_control_surfaces.find((entry) => entry.path === spendControlPath);
    assertCondition(errors, Boolean(summaryEntry), `summary missing spend-control surface ${spendControlPath}`);
    assertCondition(errors, fs.existsSync(spendControlPath), `spend-control surface file missing: ${spendControlPath}`);
    assertCondition(errors, planDoc.includes(spendControlPath), `plan doc must reference spend-control surface ${spendControlPath}`);
    assertCondition(errors, audit.current_state_evidence.repo_spend_control_surfaces?.checked.includes(spendControlPath) === true, `audit must reference spend-control surface ${spendControlPath}`);
    assertCondition(errors, summaryEntry?.proof_level === "repo-local", `spend-control surface ${spendControlPath} must remain repo-local proof`);
  }

  if ((targetByProofLevel["live-verified"] ?? 0) > 0) {
    warnings.push("Budget ledger contains live-verified spend; confirm owner-system proof paths are current.");
  }
  if ((targetByProofLevel.estimate ?? 0) === 0) {
    warnings.push("Budget ledger has no estimate lines; this is unusual before live billing exports are attached.");
  }

  const result: VerificationResult = {
    schema: "blueprint/autonomous-org-budget-verification/v1",
    generated_at: new Date().toISOString(),
    pass: errors.length === 0,
    errors,
    warnings,
    computed: {
      declared_agent_budget_usd: declaredAgentBudgetUsd,
      active_routines: activeRoutines,
      paused_routines: pausedRoutines,
      total_routines: totalRoutines,
      budget_ledger_target_total_usd: ledgerTargetTotal,
      spend_registry_target_total_usd: spendSourceTargetTotal,
      repo_local_ledger_target_usd: targetByProofLevel["repo-local"] ?? 0,
      estimate_ledger_target_usd: targetByProofLevel.estimate ?? 0,
      live_verified_ledger_target_usd: targetByProofLevel["live-verified"] ?? 0,
      codex_oauth_pro_target_usd: targetBySourceId.get("codex_oauth_pro_seat") ?? 0,
      openai_api_target_usd: targetBySourceId.get("openai_api_costs") ?? 0,
      deepseek_direct_target_usd: targetBySourceId.get("deepseek_balance") ?? 0,
      dynamic_projected_target_total_usd: dynamicRecommendations.projected_target_total_usd,
      dynamic_recommendation_count: dynamicRecommendations.recommendations.length,
      dynamic_spend_affecting_recommendation_count: dynamicSpendAffectingRecommendations.length,
      live_proof_backlog_item_count: liveProofBacklog.remaining_items.length,
      live_proof_reconciliation_closed_items: liveProofReconciliation.closed_items,
      live_proof_reconciliation_partial_items: liveProofReconciliation.partial_items,
      live_proof_reconciliation_open_items: liveProofReconciliation.open_items,
      live_proof_intake_template_items: liveProofIntakeTemplate.items.length,
      live_proof_intake_validation_accepted_items: liveProofIntakeValidation.totals.accepted_for_manual_review,
      live_proof_intake_validation_missing_items: liveProofIntakeValidation.totals.missing_submission,
      live_proof_intake_validation_rejected_items: liveProofIntakeValidation.totals.rejected,
      next_goal_queue_items: nextGoalQueue.queue.length,
      next_goal_queue_live_mutation_allowed_items: nextGoalLiveMutationAllowedItems.length,
      budget_delegation_work_orders: budgetDelegationPacket.work_orders.length,
      budget_delegation_spend_without_approval_items: delegationSpendWithoutApprovalItems.length,
      live_action_gate_blocker_count: liveActionGate.blocker_count,
      live_action_allowed: liveActionGate.live_action_allowed,
      budget_control_status_live_spend_allowed: controlStatus.can_mutate_live_spend,
    },
    checked_paths: {
      company_config: companyConfigPath,
      control_room_map: controlRoomMapPath,
      plan_doc: planDocPath,
      spend_sources: spendSourcesPath,
      outcome_sources: outcomeSourcesPath,
      allocation_policy: allocationPolicyPath,
      outcome_snapshot: outcomeSnapshotPath,
      spend_snapshot: spendSnapshotPath,
      dynamic_recommendations: dynamicRecommendationsPath,
      dynamic_verification: dynamicVerificationPath,
      dynamic_approval_packet: dynamicApprovalPacketPath,
      dynamic_proposed_diff: dynamicProposedDiffPath,
      summary_json: summaryJsonPath,
      completion_audit_json: auditJsonPath,
      closeout_md: closeoutMdPath,
      live_proof_backlog_json: liveProofBacklogJsonPath,
      live_proof_backlog_md: liveProofBacklogMdPath,
      live_proof_reconciliation_json: liveProofReconciliationJsonPath,
      live_proof_reconciliation_md: liveProofReconciliationMdPath,
      live_proof_intake_template_json: liveProofIntakeTemplateJsonPath,
      live_proof_intake_template_md: liveProofIntakeTemplateMdPath,
      live_proof_intake_validation_json: liveProofIntakeValidationJsonPath,
      live_proof_intake_validation_md: liveProofIntakeValidationMdPath,
      next_goal_queue_json: nextGoalQueueJsonPath,
      next_goal_queue_md: nextGoalQueueMdPath,
      budget_delegation_packet_json: budgetDelegationPacketJsonPath,
      budget_delegation_packet_md: budgetDelegationPacketMdPath,
      live_action_gate_json: liveActionGateJsonPath,
      live_action_gate_md: liveActionGateMdPath,
      control_status_json: controlStatusJsonPath,
      control_status_md: controlStatusMdPath,
      launch_now_approval_packet_json: launchNowApprovalPacketJsonPath,
      launch_now_approval_packet_md: launchNowApprovalPacketMdPath,
      human_blocker_packet_json: humanBlockerPacketJsonPath,
      human_blocker_packet_md: humanBlockerPacketMdPath,
      openai_api_costs_proof: liveProofBacklog.openai_api_guardrail.proof_path,
    },
    proof_boundary: {
      repo_local_controls_verified:
        summary.proof_scope.repo_local_controls_implemented
        && audit.completion_summary.repo_local_budget_controls_complete
        && errors.length === 0,
      live_billing_verified: summary.proof_scope.live_billing_verified,
      live_mutation_attempted:
        summary.proof_scope.live_mutation_attempted || audit.live_mutation_attempted,
      goal_complete_without_billing_exports:
        audit.completion_summary.goal_can_be_marked_complete_without_billing_exports,
    },
  };

  if (!hasFlag("--no-write")) {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(
      path.join(outDir, "verification.json"),
      `${JSON.stringify(result, null, 2)}\n`,
    );
    fs.writeFileSync(path.join(outDir, "verification.md"), `${renderMarkdown(result)}\n`);
  }

  if (hasFlag("--json")) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(renderMarkdown(result));
  }

  if (!result.pass) {
    process.exit(1);
  }
}

verify();
