import "../config/bootstrap-env";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import type { AgentProvider, AgentTaskKind } from "./types";

type StructuredProvider = Extract<
  AgentProvider,
  "openai_responses" | "anthropic_agent_sdk" | "acp_harness" | "openclaw" | "codex_local"
>;

const STRUCTURED_PROVIDER_VALUES = new Set<StructuredProvider>([
  "openai_responses",
  "anthropic_agent_sdk",
  "acp_harness",
  "openclaw",
  "codex_local",
]);

const TASK_MODEL_SUFFIXES: Partial<Record<AgentTaskKind, string>> = {
  waitlist_triage: "WAITLIST_AUTOMATION_MODEL",
  inbound_qualification: "INBOUND_QUALIFICATION_MODEL",
  post_signup_scheduling: "POST_SIGNUP_MODEL",
  support_triage: "SUPPORT_TRIAGE_MODEL",
  payout_exception_triage: "PAYOUT_EXCEPTION_MODEL",
  preview_diagnosis: "PREVIEW_DIAGNOSIS_MODEL",
  operator_thread: "OPERATOR_THREAD_MODEL",
  external_harness_thread: "EXTERNAL_HARNESS_MODEL",
};

const DEFAULT_MODELS: Record<StructuredProvider, string> = {
  openai_responses: "gpt-5.4",
  anthropic_agent_sdk: "claude-sonnet-4-5",
  acp_harness: "codex",
  openclaw: "gpt-5.4",
  codex_local: "gpt-5.4-mini",
};

let codexAvailability: boolean | null = null;

function isCodexLocalConfigured() {
  const forced = (process.env.CODEX_LOCAL_AVAILABLE || "").trim().toLowerCase();
  if (forced === "1" || forced === "true" || forced === "yes" || forced === "on") {
    codexAvailability = true;
    return codexAvailability;
  }
  if (forced === "0" || forced === "false" || forced === "no" || forced === "off") {
    codexAvailability = false;
    return codexAvailability;
  }

  if (codexAvailability !== null) {
    return codexAvailability;
  }

  const authPath = process.env.CODEX_AUTH_FILE?.trim() || path.join(os.homedir(), ".codex", "auth.json");
  if (!fs.existsSync(authPath)) {
    codexAvailability = false;
    return codexAvailability;
  }

  const probe = spawnSync(
    process.env.CODEX_LOCAL_COMMAND?.trim() || "codex",
    ["--version"],
    { stdio: "ignore" },
  );
  codexAvailability = probe.status === 0;
  return codexAvailability;
}

function normalizeProvider(value: string | undefined | null): StructuredProvider | null {
  const normalized = String(value || "").trim() as StructuredProvider;
  return STRUCTURED_PROVIDER_VALUES.has(normalized) ? normalized : null;
}

export function isProviderConfigured(provider: StructuredProvider): boolean {
  switch (provider) {
    case "codex_local":
      return isCodexLocalConfigured();
    case "openai_responses":
      return Boolean(process.env.OPENAI_API_KEY?.trim());
    case "anthropic_agent_sdk":
      return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
    case "acp_harness":
      return Boolean(process.env.ACP_HARNESS_URL?.trim());
    case "openclaw":
      return Boolean(process.env.OPENCLAW_BASE_URL?.trim());
  }
}

export function getStructuredAutomationProvider(): StructuredProvider {
  const preferred = normalizeProvider(
    process.env.BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDER,
  );
  const fallback = normalizeProvider(
    process.env.BLUEPRINT_STRUCTURED_AUTOMATION_FALLBACK_PROVIDER,
  );

  const candidates = [
    preferred,
    fallback,
    normalizeProvider(isCodexLocalConfigured() ? "codex_local" : null),
    normalizeProvider(process.env.ACP_HARNESS_URL ? "acp_harness" : null),
    normalizeProvider(process.env.ANTHROPIC_API_KEY ? "anthropic_agent_sdk" : null),
    normalizeProvider(process.env.OPENAI_API_KEY ? "openai_responses" : null),
    normalizeProvider(process.env.OPENCLAW_BASE_URL ? "openclaw" : null),
    "codex_local" as StructuredProvider,
  ].filter((candidate, index, array): candidate is StructuredProvider => {
    return Boolean(candidate) && array.indexOf(candidate) === index;
  });

  return candidates.find(isProviderConfigured) || candidates[0];
}

export function getStructuredAutomationFallbackProvider():
  | StructuredProvider
  | null {
  const selected = getStructuredAutomationProvider();
  const preferredFallback = normalizeProvider(
    process.env.BLUEPRINT_STRUCTURED_AUTOMATION_FALLBACK_PROVIDER,
  );

  const candidates = [
    preferredFallback,
    "codex_local" as StructuredProvider,
    "anthropic_agent_sdk" as StructuredProvider,
    "openai_responses" as StructuredProvider,
    "acp_harness" as StructuredProvider,
    "openclaw" as StructuredProvider,
  ].filter((candidate, index, array): candidate is StructuredProvider => {
    return Boolean(candidate) && candidate !== selected && array.indexOf(candidate) === index;
  });

  return candidates.find(isProviderConfigured) || null;
}

export function getTaskModelByProvider(taskKind: AgentTaskKind) {
  const suffix = TASK_MODEL_SUFFIXES[taskKind];
  return {
    codex_local:
      (suffix ? process.env[`CODEX_${suffix}`]?.trim() : null)
      || process.env.CODEX_DEFAULT_MODEL?.trim()
      || DEFAULT_MODELS.codex_local,
    openai_responses:
      (suffix ? process.env[`OPENAI_${suffix}`]?.trim() : null)
      || process.env.OPENAI_DEFAULT_MODEL?.trim()
      || DEFAULT_MODELS.openai_responses,
    anthropic_agent_sdk:
      (suffix ? process.env[`ANTHROPIC_${suffix}`]?.trim() : null)
      || process.env.ANTHROPIC_DEFAULT_MODEL?.trim()
      || DEFAULT_MODELS.anthropic_agent_sdk,
    acp_harness:
      process.env.ACP_DEFAULT_HARNESS?.trim()
      || DEFAULT_MODELS.acp_harness,
    openclaw:
      (suffix ? process.env[`OPENCLAW_${suffix}`]?.trim() : null)
      || process.env.OPENCLAW_DEFAULT_MODEL?.trim()
      || DEFAULT_MODELS.openclaw,
  } satisfies Partial<Record<AgentProvider, string>>;
}
