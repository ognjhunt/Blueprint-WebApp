import crypto from "node:crypto";

import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import type { AgentProfileRecord } from "./types";

const AGENT_PROFILE_COLLECTION = "agentProfiles";
const BUILT_IN_TIMESTAMP = "2026-04-09T00:00:00.000Z";

function nowTimestamp() {
  return admin.firestore.FieldValue.serverTimestamp();
}

function normalizeStringArray(value: unknown) {
  return Array.from(
    new Set(
      Array.isArray(value)
        ? value
            .filter((entry): entry is string => typeof entry === "string")
            .map((entry) => entry.trim())
            .filter(Boolean)
        : [],
    ),
  );
}

function normalizeRecord<T extends Record<string, unknown>>(value: unknown) {
  return value && typeof value === "object" ? (value as T) : undefined;
}

const builtInAgentProfiles: AgentProfileRecord[] = [
  {
    id: "built-in-ops-operator",
    key: "ops-operator",
    name: "Ops Operator",
    description: "General bounded operator thread for internal investigation and execution planning.",
    task_kind: "operator_thread",
    default_provider: "deepseek_chat",
    default_runtime: "deepseek_chat",
    default_model: "deepseek-v4-flash",
    lane: "session",
    default_environment_profile_id: "built-in-session-default",
    capabilities: [
      "bounded delegation",
      "ops investigation",
      "startup-context synthesis",
      "proof-aware summaries",
    ],
    human_gates: [
      "pricing changes",
      "rights/privacy decisions",
      "irreversible external actions",
    ],
    allowed_subagent_profile_ids: [
      "built-in-research-subagent",
      "built-in-implementation-subagent",
      "built-in-review-subagent",
      "built-in-preview-diagnosis-specialist",
      "built-in-browser-research-subagent",
      "built-in-launch-qa-subagent",
    ],
    outcome_contract: {
      objective: "Produce a bounded operator-quality answer with clear next actions.",
      success_criteria: [
        "Answer stays within the scoped task.",
        "Summary is specific and operationally useful.",
        "Suggested actions are concrete.",
      ],
      self_checks: [
        "Verify that no unsupported claim is stated as fact.",
        "Verify that any escalation need is explicit.",
      ],
      proof_requirements: [
        "Reference attached startup context when it materially informed the answer.",
      ],
      pass_threshold: 0.75,
      bounded_scope: "One operator request per run.",
      grader_name: "blueprint-operator-grader",
    },
    built_in: true,
    created_at: BUILT_IN_TIMESTAMP,
    updated_at: BUILT_IN_TIMESTAMP,
  },
  {
    id: "built-in-support-triage",
    key: "support-triage-specialist",
    name: "Support Triage Specialist",
    description: "Structured support investigation profile with stronger guardrails.",
    task_kind: "support_triage",
    default_provider: "deepseek_chat",
    default_runtime: "deepseek_chat",
    default_model: "deepseek-v4-flash",
    lane: "support",
    default_environment_profile_id: "built-in-support-guarded",
    capabilities: [
      "triage",
      "issue summarization",
      "risk-aware routing",
    ],
    human_gates: [
      "refund decisions",
      "contract commitments",
      "security/privacy promises",
    ],
    allowed_subagent_profile_ids: ["built-in-research-subagent"],
    outcome_contract: {
      objective: "Classify and summarize the support issue without overcommitting.",
      success_criteria: [
        "Issue classification is explicit.",
        "Recommended next action is safe and reversible.",
        "Escalation need is called out when confidence is low.",
      ],
      self_checks: [
        "Check that no unsupported operational promise is made.",
      ],
      proof_requirements: [
        "Include ticket-specific evidence in the summary.",
      ],
      pass_threshold: 0.8,
      bounded_scope: "One support issue per run.",
      grader_name: "blueprint-support-grader",
    },
    built_in: true,
    created_at: BUILT_IN_TIMESTAMP,
    updated_at: BUILT_IN_TIMESTAMP,
  },
  {
    id: "built-in-preview-diagnosis-specialist",
    key: "preview-diagnosis-specialist",
    name: "Preview Diagnosis Specialist",
    description: "Structured preview-failure specialist with isolated browser-backed evidence posture.",
    task_kind: "preview_diagnosis",
    default_provider: "deepseek_chat",
    default_runtime: "deepseek_chat",
    default_model: "deepseek-v4-flash",
    lane: "preview",
    default_environment_profile_id: "built-in-preview-browser-shadow",
    capabilities: [
      "preview failure diagnosis",
      "browser-backed evidence capture",
      "release-risk escalation",
    ],
    human_gates: [
      "preview release decisions",
      "provider escalation closure",
    ],
    allowed_subagent_profile_ids: [],
    outcome_contract: {
      objective: "Diagnose preview failures safely with explicit release posture and next action.",
      success_criteria: [
        "Disposition is explicit and schema-valid.",
        "Retry guidance is evidence-backed.",
        "Release-risk cases fail closed.",
      ],
      self_checks: [
        "Verify rendered browser evidence does not override primary system truth.",
        "Verify any escalation need is explicit.",
      ],
      proof_requirements: [
        "Attach or reference screenshots, console output, or provider artifacts when they materially informed the result.",
      ],
      pass_threshold: 0.85,
      bounded_scope: "One preview diagnosis task.",
      grader_name: "blueprint-preview-diagnosis-grader",
    },
    built_in: true,
    created_at: BUILT_IN_TIMESTAMP,
    updated_at: BUILT_IN_TIMESTAMP,
  },
  {
    id: "built-in-research-subagent",
    key: "research-subagent",
    name: "Research Subagent",
    description: "Short-lived worker for evidence gathering and concise synthesis.",
    task_kind: "operator_thread",
    default_provider: "deepseek_chat",
    default_runtime: "deepseek_chat",
    default_model: "deepseek-v4-flash",
    lane: "session",
    default_environment_profile_id: "built-in-web-research",
    capabilities: ["web-backed research", "evidence extraction", "comparison briefs"],
    human_gates: [],
    allowed_subagent_profile_ids: [],
    outcome_contract: {
      objective: "Return the requested evidence slice with tight scope.",
      success_criteria: [
        "Research stays scoped to the assigned question.",
        "Findings are concise and attributable.",
      ],
      self_checks: [
        "Avoid recommendation drift beyond the assigned question.",
      ],
      proof_requirements: [
        "Capture sources or internal references used.",
      ],
      pass_threshold: 0.7,
      bounded_scope: "Single evidence request.",
      grader_name: "blueprint-subagent-grader",
    },
    built_in: true,
    created_at: BUILT_IN_TIMESTAMP,
    updated_at: BUILT_IN_TIMESTAMP,
  },
  {
    id: "built-in-browser-research-subagent",
    key: "browser-research-subagent",
    name: "Browser Research Subagent",
    description: "Short-lived worker for supervised, read-only browser research and proof capture.",
    task_kind: "operator_thread",
    default_provider: "deepseek_chat",
    default_runtime: "deepseek_chat",
    default_model: "deepseek-v4-flash",
    lane: "session",
    default_environment_profile_id: "built-in-browser-research-guarded",
    capabilities: [
      "read-only browser research",
      "screenshot proof capture",
      "competitor-flow inspection",
    ],
    human_gates: ["external writes", "unsupported product claims"],
    allowed_subagent_profile_ids: [],
    outcome_contract: {
      objective: "Gather narrow browser-backed evidence without taking external actions.",
      success_criteria: [
        "Research stays within the assigned scope and allowlist.",
        "Findings are concise and attributable.",
      ],
      self_checks: [
        "Verify no external mutation or unsupported claim is made.",
      ],
      proof_requirements: [
        "Capture browser evidence when it materially supports the finding.",
      ],
      pass_threshold: 0.75,
      bounded_scope: "Single supervised browser research request.",
      grader_name: "blueprint-browser-research-grader",
    },
    built_in: true,
    created_at: BUILT_IN_TIMESTAMP,
    updated_at: BUILT_IN_TIMESTAMP,
  },
  {
    id: "built-in-implementation-subagent",
    key: "implementation-subagent",
    name: "Implementation Subagent",
    description: "Short-lived execution worker intended for bounded implementation work.",
    task_kind: "external_harness_thread",
    default_provider: "acp_harness",
    default_runtime: "acp_harness",
    default_model: "codex",
    lane: "external_harness",
    default_environment_profile_id: "built-in-external-harness-codex",
    capabilities: ["bounded implementation", "file-targeted changes", "artifact-producing execution"],
    human_gates: ["merge or deploy decisions"],
    allowed_subagent_profile_ids: [
      "built-in-review-subagent",
      "built-in-launch-qa-subagent",
    ],
    outcome_contract: {
      objective: "Complete the bounded implementation task and report the result clearly.",
      success_criteria: [
        "Implementation scope stays bounded.",
        "Result states what changed or why it failed.",
      ],
      self_checks: [
        "Confirm the requested files or modules are the only write focus.",
      ],
      proof_requirements: [
        "Name changed files or produced artifacts.",
      ],
      pass_threshold: 0.8,
      bounded_scope: "One bounded implementation task.",
      grader_name: "blueprint-implementation-grader",
    },
    built_in: true,
    created_at: BUILT_IN_TIMESTAMP,
    updated_at: BUILT_IN_TIMESTAMP,
  },
  {
    id: "built-in-launch-qa-subagent",
    key: "launch-qa-subagent",
    name: "Launch QA Subagent",
    description: "Short-lived worker for supervised launch-surface verification using isolated browser evidence.",
    task_kind: "operator_thread",
    default_provider: "deepseek_chat",
    default_runtime: "deepseek_chat",
    default_model: "deepseek-v4-flash",
    lane: "review",
    default_environment_profile_id: "built-in-launch-qa-browser",
    capabilities: ["launch-surface QA", "browser verification", "console and screenshot capture"],
    human_gates: ["deploy decisions", "external writes"],
    allowed_subagent_profile_ids: [],
    outcome_contract: {
      objective: "Verify the launch surface with browser-backed evidence and bounded conclusions.",
      success_criteria: [
        "Findings are specific and user-visible.",
        "Any blocker or regression is clearly named.",
      ],
      self_checks: [
        "Verify findings are backed by direct evidence rather than inference alone.",
      ],
      proof_requirements: [
        "Reference screenshots, console output, or page-state evidence reviewed.",
      ],
      pass_threshold: 0.8,
      bounded_scope: "One supervised QA verification pass.",
      grader_name: "blueprint-launch-qa-grader",
    },
    built_in: true,
    created_at: BUILT_IN_TIMESTAMP,
    updated_at: BUILT_IN_TIMESTAMP,
  },
  {
    id: "built-in-review-subagent",
    key: "review-subagent",
    name: "Review Subagent",
    description: "Short-lived worker for QA and review passes on prior work.",
    task_kind: "operator_thread",
    default_provider: "deepseek_chat",
    default_runtime: "deepseek_chat",
    default_model: "deepseek-v4-flash",
    lane: "review",
    default_environment_profile_id: "built-in-session-default",
    capabilities: ["qa review", "risk listing", "verification notes"],
    human_gates: [],
    allowed_subagent_profile_ids: [
      "built-in-preview-diagnosis-specialist",
      "built-in-launch-qa-subagent",
    ],
    outcome_contract: {
      objective: "Evaluate the result and surface concrete issues or validation results.",
      success_criteria: [
        "Findings are prioritized and actionable.",
        "No fabricated verification claims are made.",
      ],
      self_checks: [
        "State residual risk when verification is incomplete.",
      ],
      proof_requirements: [
        "Reference the evidence reviewed.",
      ],
      pass_threshold: 0.75,
      bounded_scope: "One review or QA pass.",
      grader_name: "blueprint-review-grader",
    },
    built_in: true,
    created_at: BUILT_IN_TIMESTAMP,
    updated_at: BUILT_IN_TIMESTAMP,
  },
];

function normalizeProfileRecord(
  profileId: string,
  params: Partial<AgentProfileRecord> & Pick<AgentProfileRecord, "key" | "name" | "task_kind">,
): AgentProfileRecord {
  return {
    id: profileId,
    key: params.key.trim(),
    name: params.name.trim(),
    description: params.description?.trim() || "",
    task_kind: params.task_kind,
    default_provider: params.default_provider,
    default_runtime: params.default_runtime,
    default_model: params.default_model?.trim() || null,
    lane: params.lane?.trim() || null,
    default_environment_profile_id: params.default_environment_profile_id || null,
    startup_context: normalizeRecord(params.startup_context),
    tool_policy: normalizeRecord(params.tool_policy),
    approval_policy: normalizeRecord(params.approval_policy),
    session_policy: normalizeRecord(params.session_policy),
    outcome_contract: normalizeRecord(params.outcome_contract) as AgentProfileRecord["outcome_contract"],
    capabilities: normalizeStringArray(params.capabilities),
    human_gates: normalizeStringArray(params.human_gates),
    allowed_subagent_profile_ids: normalizeStringArray(params.allowed_subagent_profile_ids),
    built_in: params.built_in === true,
    created_at: params.created_at || nowTimestamp(),
    updated_at: nowTimestamp(),
  };
}

export async function listAgentProfiles(limit = 100) {
  const builtIns = [...builtInAgentProfiles];
  if (!db) {
    return builtIns.slice(0, limit);
  }

  const snapshot = await db
    .collection(AGENT_PROFILE_COLLECTION)
    .orderBy("updated_at", "desc")
    .limit(Math.max(1, Math.min(limit, 200)))
    .get();

  const stored = snapshot.docs.map((doc) => doc.data() as AgentProfileRecord);
  const storedKeys = new Set(stored.map((record) => record.key));
  return [...stored, ...builtIns.filter((record) => !storedKeys.has(record.key))].slice(0, limit);
}

export async function getAgentProfile(profileId: string) {
  const builtIn = builtInAgentProfiles.find((profile) => profile.id === profileId || profile.key === profileId);
  if (builtIn) {
    return builtIn;
  }
  if (!db || !profileId) {
    return null;
  }

  const doc = await db.collection(AGENT_PROFILE_COLLECTION).doc(profileId).get();
  if (!doc.exists) {
    return null;
  }
  return doc.data() as AgentProfileRecord;
}

export async function createAgentProfile(
  params: Partial<AgentProfileRecord> & Pick<AgentProfileRecord, "key" | "name" | "task_kind">,
) {
  const profileId = crypto.randomUUID();
  const record = normalizeProfileRecord(profileId, params);
  if (db) {
    await db.collection(AGENT_PROFILE_COLLECTION).doc(profileId).set(record);
    return (await getAgentProfile(profileId)) || record;
  }
  return record;
}

export async function updateAgentProfile(
  profileId: string,
  params: Partial<AgentProfileRecord>,
) {
  if (!db) {
    return null;
  }

  const existing = await getAgentProfile(profileId);
  if (!existing || existing.built_in) {
    return null;
  }

  const record = normalizeProfileRecord(profileId, {
    ...existing,
    ...params,
    key: params.key ?? existing.key,
    name: params.name ?? existing.name,
    task_kind: params.task_kind ?? existing.task_kind,
    created_at: existing.created_at,
  });

  await db.collection(AGENT_PROFILE_COLLECTION).doc(profileId).set(record, { merge: true });
  return getAgentProfile(profileId);
}
