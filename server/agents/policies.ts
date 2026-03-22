import {
  type AgentTask,
  type ApprovalPolicy,
  type SessionPolicy,
  type ToolPolicy,
} from "./types";

export const DEFAULT_TOOL_POLICY: ToolPolicy = {
  mode: "api",
  prefer_direct_api: true,
  browser_fallback_allowed: false,
  isolated_runtime_required: false,
  allowed_mcp_servers: [],
  allowed_domains: [],
  allowed_actions: [],
};

export const DEFAULT_APPROVAL_POLICY: ApprovalPolicy = {
  require_human_approval: false,
  sensitive_actions: [],
  allow_preapproval: false,
};

export const DEFAULT_SESSION_POLICY: SessionPolicy = {
  dispatch_mode: "collect",
  lane: "main",
  max_concurrent: 1,
};

export function mergeToolPolicy(
  ...policies: Array<Partial<ToolPolicy> | undefined>
): ToolPolicy {
  return policies.reduce<ToolPolicy>(
    (acc, policy) => ({
      ...acc,
      ...policy,
      allowed_mcp_servers: policy?.allowed_mcp_servers
        ? [...policy.allowed_mcp_servers]
        : acc.allowed_mcp_servers,
      allowed_domains: policy?.allowed_domains
        ? [...policy.allowed_domains]
        : acc.allowed_domains,
      allowed_actions: policy?.allowed_actions
        ? [...policy.allowed_actions]
        : acc.allowed_actions,
    }),
    { ...DEFAULT_TOOL_POLICY },
  );
}

export function mergeApprovalPolicy(
  ...policies: Array<Partial<ApprovalPolicy> | undefined>
): ApprovalPolicy {
  return policies.reduce<ApprovalPolicy>(
    (acc, policy) => ({
      ...acc,
      ...policy,
      sensitive_actions: policy?.sensitive_actions
        ? [...policy.sensitive_actions]
        : acc.sensitive_actions,
    }),
    { ...DEFAULT_APPROVAL_POLICY },
  );
}

export function mergeSessionPolicy(
  ...policies: Array<Partial<SessionPolicy> | undefined>
): SessionPolicy {
  return policies.reduce<SessionPolicy>(
    (acc, policy) => ({
      ...acc,
      ...policy,
    }),
    { ...DEFAULT_SESSION_POLICY },
  );
}

export function requiresApproval(task: AgentTask, approvalPolicy: ApprovalPolicy): {
  required: boolean;
  reason: string | null;
} {
  if (task.metadata?.approved === true) {
    return { required: false, reason: null };
  }

  if (approvalPolicy.require_human_approval) {
    return {
      required: true,
      reason:
        approvalPolicy.sensitive_actions.length > 0
          ? `Sensitive actions require approval: ${approvalPolicy.sensitive_actions.join(", ")}`
          : "This run requires explicit human approval.",
    };
  }

  if (approvalPolicy.sensitive_actions.length > 0 && !approvalPolicy.allow_preapproval) {
    return {
      required: true,
      reason: `Sensitive actions require approval: ${approvalPolicy.sensitive_actions.join(", ")}`,
    };
  }

  return { required: false, reason: null };
}
