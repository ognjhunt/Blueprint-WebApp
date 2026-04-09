import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { fileURLToPath } from "node:url";
import type { EnvironmentProfile } from "./types.js";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const RUNTIME_ENVIRONMENTS_DIR = path.resolve(MODULE_DIR, "../../../../runtime/environments");

function normalizeProfile(raw: unknown, fallbackKey: string): EnvironmentProfile {
  const record = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  return {
    key: typeof record.key === "string" && record.key.trim().length > 0 ? record.key.trim() : fallbackKey,
    description: typeof record.description === "string" ? record.description.trim() : "",
    runtime_lane: typeof record.runtime_lane === "string" ? record.runtime_lane.trim() : "general",
    adapter_policy: record.adapter_policy && typeof record.adapter_policy === "object"
      ? { preferred: Array.isArray((record.adapter_policy as Record<string, unknown>).preferred) ? ((record.adapter_policy as Record<string, unknown>).preferred as string[]) : [] }
      : undefined,
    tools: record.tools && typeof record.tools === "object"
      ? {
        allow: Array.isArray((record.tools as Record<string, unknown>).allow) ? ((record.tools as Record<string, unknown>).allow as string[]) : [],
        deny: Array.isArray((record.tools as Record<string, unknown>).deny) ? ((record.tools as Record<string, unknown>).deny as string[]) : [],
      }
      : undefined,
    network_policy: record.network_policy && typeof record.network_policy === "object"
      ? { mode: typeof (record.network_policy as Record<string, unknown>).mode === "string" ? String((record.network_policy as Record<string, unknown>).mode).trim() : undefined }
      : undefined,
    repo_mounts: Array.isArray(record.repo_mounts) ? (record.repo_mounts as string[]) : [],
    memory: record.memory && typeof record.memory === "object"
      ? { bind: Array.isArray((record.memory as Record<string, unknown>).bind) ? ((record.memory as Record<string, unknown>).bind as string[]) : [] }
      : undefined,
    vault: record.vault && typeof record.vault === "object"
      ? {
        default_scope: typeof (record.vault as Record<string, unknown>).default_scope === "string"
          ? String((record.vault as Record<string, unknown>).default_scope).trim() as EnvironmentProfile["vault"]["default_scope"]
          : undefined,
        allowed_refs: Array.isArray((record.vault as Record<string, unknown>).allowed_refs)
          ? ((record.vault as Record<string, unknown>).allowed_refs as string[])
          : [],
        allowed_tools: Array.isArray((record.vault as Record<string, unknown>).allowed_tools)
          ? ((record.vault as Record<string, unknown>).allowed_tools as string[])
          : [],
      }
      : undefined,
    artifacts: record.artifacts && typeof record.artifacts === "object"
      ? {
        require_trace_link: Boolean((record.artifacts as Record<string, unknown>).require_trace_link),
        publish_to_issue: Boolean((record.artifacts as Record<string, unknown>).publish_to_issue),
      }
      : undefined,
    review: record.review && typeof record.review === "object"
      ? { human_gate: typeof (record.review as Record<string, unknown>).human_gate === "string" ? String((record.review as Record<string, unknown>).human_gate).trim() : undefined }
      : undefined,
  };
}

export function listEnvironmentProfileKeys() {
  if (!existsSync(RUNTIME_ENVIRONMENTS_DIR)) {
    return [];
  }
  return readdirSync(RUNTIME_ENVIRONMENTS_DIR)
    .filter((entry) => entry.endsWith(".yaml"))
    .map((entry) => entry.replace(/\.yaml$/i, ""))
    .sort();
}

export function loadEnvironmentProfile(profileKey: string): EnvironmentProfile | null {
  const filePath = path.join(RUNTIME_ENVIRONMENTS_DIR, `${profileKey}.yaml`);
  if (!existsSync(filePath)) {
    return null;
  }
  const raw = yaml.load(readFileSync(filePath, "utf8"));
  return normalizeProfile(raw, profileKey);
}

export function getEnvironmentProfilePath(profileKey: string) {
  return path.join(RUNTIME_ENVIRONMENTS_DIR, `${profileKey}.yaml`);
}
