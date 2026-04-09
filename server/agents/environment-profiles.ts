import crypto from "node:crypto";

import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import type { AgentEnvironmentProfileRecord } from "./types";

const ENVIRONMENT_PROFILE_COLLECTION = "agentEnvironmentProfiles";
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

function parseCommaSeparatedEnv(value: string | undefined | null) {
  return normalizeStringArray(String(value || "").split(","));
}

function normalizeRecord<T extends Record<string, unknown>>(value: unknown) {
  return value && typeof value === "object" ? (value as T) : undefined;
}

const previewBrowserShadowDomains = parseCommaSeparatedEnv(
  process.env.BLUEPRINT_PREVIEW_DIAGNOSIS_BROWSER_SHADOW_ALLOWED_DOMAINS,
);
const browserResearchDomains = parseCommaSeparatedEnv(
  process.env.BLUEPRINT_BROWSER_RESEARCH_ALLOWED_DOMAINS,
);
const browserQaDomains = parseCommaSeparatedEnv(
  process.env.BLUEPRINT_BROWSER_QA_ALLOWED_DOMAINS,
);

const builtInEnvironmentProfiles: AgentEnvironmentProfileRecord[] = [
  {
    id: "built-in-session-default",
    key: "session-default",
    name: "Session Default",
    description: "Default internal session environment with repo access and mixed tools.",
    lane: "session",
    repo_mounts: [process.cwd()],
    package_set: ["nodejs", "git", "ripgrep"],
    secret_bindings: ["OPENAI_API_KEY", "ANTHROPIC_API_KEY"],
    startup_pack_ids: [],
    network_rules: {
      mode: "restricted",
      allow_network: true,
      allow_domains: [],
      deny_domains: [],
    },
    runtime_constraints: {
      isolated_runtime: false,
      checkpoint_on_failure: true,
      checkpoint_on_control: true,
    },
    tool_policy: {
      mode: "mixed",
      prefer_direct_api: true,
      browser_fallback_allowed: true,
      isolated_runtime_required: false,
      allowed_actions: ["repo_read", "web_lookup", "structured_summary"],
    },
    session_policy: {
      lane: "session",
      dispatch_mode: "collect",
      max_concurrent: 1,
    },
    built_in: true,
    created_at: BUILT_IN_TIMESTAMP,
    updated_at: BUILT_IN_TIMESTAMP,
  },
  {
    id: "built-in-web-research",
    key: "web-research",
    name: "Web Research",
    description: "Research-oriented environment with explicit outbound network use.",
    lane: "session",
    repo_mounts: [process.cwd()],
    package_set: ["nodejs", "curl"],
    secret_bindings: ["OPENAI_API_KEY", "SEARCH_API_KEY"],
    startup_pack_ids: [],
    network_rules: {
      mode: "open",
      allow_network: true,
      allow_domains: [],
      deny_domains: [],
    },
    runtime_constraints: {
      isolated_runtime: false,
      checkpoint_on_failure: true,
      checkpoint_on_control: true,
    },
    tool_policy: {
      mode: "mixed",
      prefer_direct_api: true,
      browser_fallback_allowed: true,
      isolated_runtime_required: false,
      allowed_actions: ["web_search", "web_fetch", "reference_capture"],
    },
    session_policy: {
      lane: "session",
      dispatch_mode: "collect",
      max_concurrent: 2,
    },
    built_in: true,
    created_at: BUILT_IN_TIMESTAMP,
    updated_at: BUILT_IN_TIMESTAMP,
  },
  {
    id: "built-in-external-harness-codex",
    key: "external-harness-codex",
    name: "External Harness Codex",
    description: "Bounded external harness environment for implementation-oriented work.",
    lane: "external_harness",
    repo_mounts: [process.cwd()],
    package_set: ["nodejs", "python3", "git", "ripgrep"],
    secret_bindings: ["ACP_HARNESS_URL", "ACP_HARNESS_TOKEN"],
    startup_pack_ids: [],
    network_rules: {
      mode: "restricted",
      allow_network: true,
      allow_domains: [],
      deny_domains: [],
    },
    runtime_constraints: {
      isolated_runtime: true,
      checkpoint_on_failure: true,
      checkpoint_on_control: true,
    },
    tool_policy: {
      mode: "external_harness",
      prefer_direct_api: false,
      browser_fallback_allowed: false,
      isolated_runtime_required: true,
      allowed_actions: ["bounded_write", "test_run", "artifact_report"],
    },
    session_policy: {
      lane: "external_harness",
      dispatch_mode: "collect",
      max_concurrent: 1,
    },
    built_in: true,
    created_at: BUILT_IN_TIMESTAMP,
    updated_at: BUILT_IN_TIMESTAMP,
  },
  {
    id: "built-in-support-guarded",
    key: "support-guarded",
    name: "Support Guarded",
    description: "Support environment with stricter approval posture and narrow actions.",
    lane: "support",
    repo_mounts: [process.cwd()],
    package_set: ["nodejs"],
    secret_bindings: ["OPENAI_API_KEY"],
    startup_pack_ids: [],
    network_rules: {
      mode: "restricted",
      allow_network: false,
      allow_domains: [],
      deny_domains: [],
    },
    runtime_constraints: {
      isolated_runtime: false,
      checkpoint_on_failure: true,
      checkpoint_on_control: true,
    },
    tool_policy: {
      mode: "api",
      prefer_direct_api: true,
      browser_fallback_allowed: false,
      isolated_runtime_required: false,
      allowed_actions: ["ticket_summary", "routing_recommendation"],
    },
    approval_policy: {
      require_human_approval: false,
      sensitive_actions: ["financial", "compliance"],
      allow_preapproval: false,
    },
    session_policy: {
      lane: "support",
      dispatch_mode: "collect",
      max_concurrent: 1,
    },
    built_in: true,
    created_at: BUILT_IN_TIMESTAMP,
    updated_at: BUILT_IN_TIMESTAMP,
  },
  {
    id: "built-in-preview-browser-shadow",
    key: "preview-browser-shadow",
    name: "Preview Browser Shadow",
    description: "Isolated, read-only browser environment for preview diagnosis shadow runs.",
    lane: "preview",
    repo_mounts: [process.cwd()],
    package_set: ["nodejs", "curl"],
    secret_bindings: ["OPENAI_API_KEY", "OPENCLAW_BASE_URL", "OPENCLAW_AUTH_TOKEN"],
    startup_pack_ids: [],
    network_rules: {
      mode: "restricted",
      allow_network: true,
      allow_domains: previewBrowserShadowDomains,
      deny_domains: [],
    },
    runtime_constraints: {
      isolated_runtime: true,
      checkpoint_on_failure: true,
      checkpoint_on_control: true,
    },
    tool_policy: {
      mode: "browser",
      prefer_direct_api: false,
      browser_fallback_allowed: true,
      isolated_runtime_required: true,
      allowed_domains: previewBrowserShadowDomains,
      allowed_actions: [
        "read_only_browser",
        "screenshot_capture",
        "console_capture",
        "artifact_report",
      ],
    },
    session_policy: {
      lane: "preview",
      dispatch_mode: "collect",
      max_concurrent: 1,
    },
    built_in: true,
    created_at: BUILT_IN_TIMESTAMP,
    updated_at: BUILT_IN_TIMESTAMP,
  },
  {
    id: "built-in-browser-research-guarded",
    key: "browser-research-guarded",
    name: "Browser Research Guarded",
    description: "Isolated read-only browser research environment for supervised market and demand work.",
    lane: "session",
    repo_mounts: [process.cwd()],
    package_set: ["nodejs", "curl"],
    secret_bindings: [
      "OPENAI_API_KEY",
      "SEARCH_API_KEY",
      "OPENCLAW_BASE_URL",
      "OPENCLAW_AUTH_TOKEN",
    ],
    startup_pack_ids: [],
    network_rules: {
      mode: "restricted",
      allow_network: true,
      allow_domains: browserResearchDomains,
      deny_domains: [],
    },
    runtime_constraints: {
      isolated_runtime: true,
      checkpoint_on_failure: true,
      checkpoint_on_control: true,
    },
    tool_policy: {
      mode: "mixed",
      prefer_direct_api: true,
      browser_fallback_allowed: true,
      isolated_runtime_required: true,
      allowed_domains: browserResearchDomains,
      allowed_actions: [
        "web_search",
        "web_fetch",
        "reference_capture",
        "read_only_browser",
        "screenshot_capture",
      ],
    },
    session_policy: {
      lane: "session",
      dispatch_mode: "collect",
      max_concurrent: 1,
    },
    built_in: true,
    created_at: BUILT_IN_TIMESTAMP,
    updated_at: BUILT_IN_TIMESTAMP,
  },
  {
    id: "built-in-launch-qa-browser",
    key: "launch-qa-browser",
    name: "Launch QA Browser",
    description: "Isolated browser environment for supervised launch-surface verification and proof capture.",
    lane: "review",
    repo_mounts: [process.cwd()],
    package_set: ["nodejs", "curl", "git"],
    secret_bindings: ["OPENAI_API_KEY", "OPENCLAW_BASE_URL", "OPENCLAW_AUTH_TOKEN"],
    startup_pack_ids: [],
    network_rules: {
      mode: "restricted",
      allow_network: true,
      allow_domains: browserQaDomains,
      deny_domains: [],
    },
    runtime_constraints: {
      isolated_runtime: true,
      checkpoint_on_failure: true,
      checkpoint_on_control: true,
    },
    tool_policy: {
      mode: "mixed",
      prefer_direct_api: true,
      browser_fallback_allowed: true,
      isolated_runtime_required: true,
      allowed_domains: browserQaDomains,
      allowed_actions: [
        "repo_read",
        "structured_summary",
        "read_only_browser",
        "screenshot_capture",
        "console_capture",
        "artifact_report",
      ],
    },
    session_policy: {
      lane: "review",
      dispatch_mode: "collect",
      max_concurrent: 1,
    },
    built_in: true,
    created_at: BUILT_IN_TIMESTAMP,
    updated_at: BUILT_IN_TIMESTAMP,
  },
];

function normalizeEnvironmentRecord(
  profileId: string,
  params: Partial<AgentEnvironmentProfileRecord> & Pick<AgentEnvironmentProfileRecord, "key" | "name" | "lane">,
): AgentEnvironmentProfileRecord {
  return {
    id: profileId,
    key: params.key.trim(),
    name: params.name.trim(),
    description: params.description?.trim() || "",
    lane: params.lane.trim(),
    repo_mounts: normalizeStringArray(params.repo_mounts),
    package_set: normalizeStringArray(params.package_set),
    secret_bindings: normalizeStringArray(params.secret_bindings),
    startup_pack_ids: normalizeStringArray(params.startup_pack_ids),
    network_rules: {
      mode:
        params.network_rules?.mode === "open" || params.network_rules?.mode === "deny_list"
          ? params.network_rules.mode
          : "restricted",
      allow_network: params.network_rules?.allow_network !== false,
      allow_domains: normalizeStringArray(params.network_rules?.allow_domains),
      deny_domains: normalizeStringArray(params.network_rules?.deny_domains),
    },
    runtime_constraints: {
      isolated_runtime: params.runtime_constraints?.isolated_runtime === true,
      checkpoint_on_failure: params.runtime_constraints?.checkpoint_on_failure !== false,
      checkpoint_on_control: params.runtime_constraints?.checkpoint_on_control !== false,
    },
    tool_policy: normalizeRecord(params.tool_policy),
    approval_policy: normalizeRecord(params.approval_policy),
    session_policy: normalizeRecord(params.session_policy),
    built_in: params.built_in === true,
    created_at: params.created_at || nowTimestamp(),
    updated_at: nowTimestamp(),
  };
}

export async function listEnvironmentProfiles(limit = 100) {
  const builtIns = [...builtInEnvironmentProfiles];
  if (!db) {
    return builtIns.slice(0, limit);
  }

  const snapshot = await db
    .collection(ENVIRONMENT_PROFILE_COLLECTION)
    .orderBy("updated_at", "desc")
    .limit(Math.max(1, Math.min(limit, 200)))
    .get();

  const stored = snapshot.docs.map((doc) => doc.data() as AgentEnvironmentProfileRecord);
  const storedKeys = new Set(stored.map((record) => record.key));
  return [...stored, ...builtIns.filter((record) => !storedKeys.has(record.key))].slice(0, limit);
}

export async function getEnvironmentProfile(profileId: string) {
  const builtIn = builtInEnvironmentProfiles.find((profile) => profile.id === profileId || profile.key === profileId);
  if (builtIn) {
    return builtIn;
  }
  if (!db || !profileId) {
    return null;
  }

  const doc = await db.collection(ENVIRONMENT_PROFILE_COLLECTION).doc(profileId).get();
  if (!doc.exists) {
    return null;
  }
  return doc.data() as AgentEnvironmentProfileRecord;
}

export async function createEnvironmentProfile(
  params: Partial<AgentEnvironmentProfileRecord> & Pick<AgentEnvironmentProfileRecord, "key" | "name" | "lane">,
) {
  const profileId = crypto.randomUUID();
  const record = normalizeEnvironmentRecord(profileId, params);
  if (db) {
    await db.collection(ENVIRONMENT_PROFILE_COLLECTION).doc(profileId).set(record);
    return (await getEnvironmentProfile(profileId)) || record;
  }
  return record;
}

export async function updateEnvironmentProfile(
  profileId: string,
  params: Partial<AgentEnvironmentProfileRecord>,
) {
  if (!db) {
    return null;
  }

  const existing = await getEnvironmentProfile(profileId);
  if (!existing || existing.built_in) {
    return null;
  }

  const record = normalizeEnvironmentRecord(profileId, {
    ...existing,
    ...params,
    key: params.key ?? existing.key,
    name: params.name ?? existing.name,
    lane: params.lane ?? existing.lane,
    created_at: existing.created_at,
  });

  await db.collection(ENVIRONMENT_PROFILE_COLLECTION).doc(profileId).set(record, { merge: true });
  return getEnvironmentProfile(profileId);
}
