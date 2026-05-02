import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { fileURLToPath } from "node:url";
import type {
  RuntimeAgentChannel,
  RuntimeAgentManifest,
  RuntimeAgentVersion,
} from "./types.js";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const RUNTIME_AGENTS_DIR = path.resolve(MODULE_DIR, "../../../../runtime/agents");
type VaultVersion = NonNullable<RuntimeAgentVersion["vault"]>;

function normalizeManifest(agentKey: string, raw: unknown): RuntimeAgentManifest {
  const record = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const employeeKit = record.employee_kit && typeof record.employee_kit === "object"
    ? record.employee_kit as Record<string, unknown>
    : {};
  const promotionPolicy = record.promotion_policy && typeof record.promotion_policy === "object"
    ? record.promotion_policy as Record<string, unknown>
    : {};
  return {
    agent_key: typeof record.agent_key === "string" ? record.agent_key.trim() : agentKey,
    default_channel: typeof record.default_channel === "string" ? record.default_channel.trim() : "production",
    default_environment_profile: typeof record.default_environment_profile === "string"
      ? record.default_environment_profile.trim()
      : "engineering_impl_default",
    employee_kit: {
      agent_path: typeof employeeKit.agent_path === "string" ? employeeKit.agent_path.trim() : "",
      soul_path: typeof employeeKit.soul_path === "string" ? employeeKit.soul_path.trim() : undefined,
      tools_path: typeof employeeKit.tools_path === "string" ? employeeKit.tools_path.trim() : undefined,
      heartbeat_path: typeof employeeKit.heartbeat_path === "string" ? employeeKit.heartbeat_path.trim() : undefined,
      task_paths: Array.isArray(employeeKit.task_paths) ? (employeeKit.task_paths as string[]) : [],
    },
    memory_bindings: Array.isArray(record.memory_bindings) ? (record.memory_bindings as string[]) : [],
    promotion_policy: {
      staging_requires: Array.isArray(promotionPolicy.staging_requires) ? (promotionPolicy.staging_requires as string[]) : [],
      production_requires: Array.isArray(promotionPolicy.production_requires) ? (promotionPolicy.production_requires as string[]) : [],
    },
  };
}

function normalizeVersion(agentKey: string, raw: unknown): RuntimeAgentVersion {
  const record = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const resolvedInputs = record.resolved_inputs && typeof record.resolved_inputs === "object"
    ? record.resolved_inputs as Record<string, unknown>
    : {};
  const vault = record.vault && typeof record.vault === "object"
    ? record.vault as Record<string, unknown>
    : {};
  const adapterPolicy = record.adapter_policy && typeof record.adapter_policy === "object"
    ? record.adapter_policy as Record<string, unknown>
    : {};
  const reviewPolicy = record.review_policy && typeof record.review_policy === "object"
    ? record.review_policy as Record<string, unknown>
    : {};
  return {
    version: typeof record.version === "string" ? record.version.trim() : "unknown",
    agent_key: typeof record.agent_key === "string" ? record.agent_key.trim() : agentKey,
    environment_profile: typeof record.environment_profile === "string"
      ? record.environment_profile.trim()
      : "engineering_impl_default",
    resolved_inputs: {
      sources: Array.isArray(resolvedInputs.sources) ? (resolvedInputs.sources as string[]) : [],
      summary: typeof resolvedInputs.summary === "string" ? resolvedInputs.summary.trim() : undefined,
    },
    active_tools: Array.isArray(record.active_tools) ? (record.active_tools as string[]) : [],
    active_skills: Array.isArray(record.active_skills) ? (record.active_skills as string[]) : [],
    memory_bindings: Array.isArray(record.memory_bindings) ? (record.memory_bindings as string[]) : [],
    vault: {
      default_scope: typeof vault.default_scope === "string" ? vault.default_scope.trim() as VaultVersion["default_scope"] : undefined,
      allowed_refs: Array.isArray(vault.allowed_refs) ? (vault.allowed_refs as string[]) : [],
      allowed_tools: Array.isArray(vault.allowed_tools) ? (vault.allowed_tools as string[]) : [],
    },
    adapter_policy: {
      preferred: Array.isArray(adapterPolicy.preferred) ? (adapterPolicy.preferred as string[]) : [],
    },
    review_policy: {
      requires_verification: Boolean(reviewPolicy.requires_verification),
      evidence: Array.isArray(reviewPolicy.evidence) ? (reviewPolicy.evidence as string[]) : [],
    },
  };
}

function normalizeChannel(agentKey: string, raw: unknown, channel: string): RuntimeAgentChannel {
  const record = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  return {
    channel: typeof record.channel === "string" ? record.channel.trim() : channel,
    agent_key: typeof record.agent_key === "string" ? record.agent_key.trim() : agentKey,
    version: typeof record.version === "string" ? record.version.trim() : "unknown",
    approved_by: typeof record.approved_by === "string" ? record.approved_by.trim() : undefined,
    approved_at: typeof record.approved_at === "string" ? record.approved_at.trim() : undefined,
    notes: typeof record.notes === "string" ? record.notes.trim() : undefined,
  };
}

export function runtimeAgentDir(agentKey: string) {
  return path.join(RUNTIME_AGENTS_DIR, agentKey);
}

export function loadRuntimeAgentManifest(agentKey: string): RuntimeAgentManifest | null {
  const filePath = path.join(runtimeAgentDir(agentKey), "manifest.yaml");
  if (!existsSync(filePath)) {
    return null;
  }
  return normalizeManifest(agentKey, yaml.load(readFileSync(filePath, "utf8")));
}

export function loadRuntimeAgentChannel(agentKey: string, channel: string): RuntimeAgentChannel | null {
  const filePath = path.join(runtimeAgentDir(agentKey), "channels", `${channel}.yaml`);
  if (!existsSync(filePath)) {
    return null;
  }
  return normalizeChannel(agentKey, yaml.load(readFileSync(filePath, "utf8")), channel);
}

export function loadRuntimeAgentVersion(agentKey: string, version: string): RuntimeAgentVersion | null {
  const filePath = path.join(runtimeAgentDir(agentKey), "versions", `${version}.yaml`);
  if (!existsSync(filePath)) {
    return null;
  }
  return normalizeVersion(agentKey, yaml.load(readFileSync(filePath, "utf8")));
}

export function resolveRuntimeAgentRelease(agentKey: string, requestedChannel?: string | null) {
  const manifest = loadRuntimeAgentManifest(agentKey);
  if (!manifest) {
    return null;
  }
  const channelRef = requestedChannel ?? manifest.default_channel ?? "production";
  const channel = loadRuntimeAgentChannel(agentKey, channelRef);
  if (!channel) {
    return null;
  }
  const version = loadRuntimeAgentVersion(agentKey, channel.version);
  if (!version) {
    return null;
  }
  return {
    manifest,
    channel,
    version,
  };
}

export function buildBlueprintRuntimeMetadata(agentKey: string, requestedChannel?: string | null) {
  const release = resolveRuntimeAgentRelease(agentKey, requestedChannel);
  if (!release) {
    return null;
  }
  return {
    agentKey,
    channelRef: release.channel.channel,
    agentVersionRef: release.version.version,
    manifest: release.manifest,
    version: release.version,
  };
}
